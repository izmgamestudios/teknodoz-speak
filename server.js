'use strict';
/**
 * Konuşma Pratiği: bağımlılıksız Node.js sunucusu
 * - public/ klasörünü sunar (gzip, ETag, önbellek, güvenlik başlıkları)
 * - İsteğe bağlı eşitleme API'si: /api/state/:profil ve /api/rec/:profil/:anahtar
 * Çalıştırma: node server.js   (PORT, HOST, DATA_DIR, SYNC_TOKEN, SYNC_ENABLED=1 ile isteğe bağlı eşitleme)
 */
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = path.join(__dirname, 'public');
const DATA = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const TOKEN = process.env.SYNC_TOKEN || '';
const SYNC = process.env.SYNC_ENABLED === '1'; // varsayılan kapalı: uygulama tamamen tarayıcıda çalışır
const MAX_JSON = 2 * 1024 * 1024;
const MAX_WAV = 10 * 1024 * 1024;
const MAX_REC_PER_PROFILE = 4000;
const VERSION = require('./package.json').version;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.wav': 'audio/wav', '.txt': 'text/plain; charset=utf-8'
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.txt']);

const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'microphone=(self), camera=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')
};

/* ---------- yardımcılar ---------- */
function send(res, status, body, headers) {
  const h = Object.assign({}, SECURITY, headers || {});
  res.writeHead(status, h);
  res.end(body);
}
function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
}
function log(req, status, t0) {
  console.log(`${new Date().toISOString()} ${req.socket.remoteAddress} ${req.method} ${req.url} ${status} ${Date.now() - t0}ms`);
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  return (xf ? String(xf).split(',')[0].trim() : req.socket.remoteAddress) || 'unknown';
}

/* basit hız sınırı: dakikada 240 API isteği / IP */
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  let e = hits.get(ip);
  if (!e || e.reset < now) { e = { n: 0, reset: now + 60000 }; hits.set(ip, e); }
  e.n++;
  return e.n > 240;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, 60000).unref();

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > max) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function writeAtomic(file, data) {
  const tmp = file + '.' + process.pid + '.' + Date.now() + '.tmp';
  await fsp.writeFile(tmp, data);
  await fsp.rename(tmp, file);
}

/* ---------- statik dosyalar ---------- */
const gzCache = new Map(); // dosya -> {mtime, buf}
async function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) return send(res, 403, 'Forbidden');
  let st;
  try { st = await fsp.stat(file); } catch (e) { return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' }); }
  if (st.isDirectory()) return serveStatic(req, res, urlPath.replace(/\/?$/, '/'));
  const ext = path.extname(file).toLowerCase();
  const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
  const isHtml = ext === '.html' || path.basename(file) === 'sw.js' || ext === '.webmanifest';
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'ETag': etag,
    'Last-Modified': st.mtime.toUTCString(),
    'Cache-Control': isHtml ? 'no-cache' : (rel.startsWith('/vendor/') ? 'public, max-age=604800, immutable' : 'public, max-age=86400')
  };
  if (req.headers['if-none-match'] === etag) return send(res, 304, null, headers);
  const wantGzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (req.method === 'HEAD') { headers['Content-Length'] = st.size; return send(res, 200, null, headers); }
  if (wantGzip) {
    let c = gzCache.get(file);
    if (!c || c.mtime !== st.mtimeMs) {
      const raw = await fsp.readFile(file);
      c = { mtime: st.mtimeMs, buf: zlib.gzipSync(raw, { level: 6 }) };
      gzCache.set(file, c);
    }
    headers['Content-Encoding'] = 'gzip';
    headers['Vary'] = 'Accept-Encoding';
    headers['Content-Length'] = c.buf.length;
    return send(res, 200, c.buf, headers);
  }
  headers['Content-Length'] = st.size;
  res.writeHead(200, Object.assign({}, SECURITY, headers));
  fs.createReadStream(file).pipe(res);
}

/* ---------- eşitleme API ---------- */
const PROFILE_RE = /^[A-Za-z0-9_-]{6,64}$/;
const KEY_RE = /^[a-z0-9_]{1,80}$/;

async function handleApi(req, res, parts, url) {
  if (parts[1] === 'health') {
    return sendJson(res, 200, { ok: true, version: VERSION, time: new Date().toISOString(), sync: SYNC, auth: !!TOKEN });
  }
  if (!SYNC) return sendJson(res, 404, { error: 'sync disabled' });
  if (TOKEN && !safeEqual(req.headers['x-sync-token'] || '', TOKEN)) return sendJson(res, 401, { error: 'unauthorized' });

  const kind = parts[1], profile = parts[2], key = parts[3];
  if (!['state', 'rec'].includes(kind) || !PROFILE_RE.test(profile || '')) return sendJson(res, 400, { error: 'bad request' });
  const dir = path.join(DATA, profile);

  if (kind === 'state') {
    const file = path.join(dir, 'state.json');
    if (req.method === 'GET') {
      try { return send(res, 200, await fsp.readFile(file), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); }
      catch (e) { return sendJson(res, 404, { error: 'not found' }); }
    }
    if (req.method === 'PUT') {
      const body = await readBody(req, MAX_JSON);
      let obj; try { obj = JSON.parse(body.toString('utf8')); } catch (e) { return sendJson(res, 400, { error: 'invalid json' }); }
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return sendJson(res, 400, { error: 'invalid json' });
      await fsp.mkdir(dir, { recursive: true });
      await writeAtomic(file, JSON.stringify(obj));
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 405, { error: 'method not allowed' });
  }

  // kind === 'rec'
  const recDir = path.join(dir, 'rec');
  const idxFile = path.join(recDir, 'index.json');
  const readIdx = async () => { try { return JSON.parse(await fsp.readFile(idxFile, 'utf8')); } catch (e) { return {}; } };
  if (!key) {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed' });
    const idx = await readIdx();
    const items = Object.keys(idx).map((k) => ({ key: k, en: idx[k].en, size: idx[k].size, t: idx[k].t }));
    return sendJson(res, 200, { items });
  }
  if (!KEY_RE.test(key)) return sendJson(res, 400, { error: 'bad key' });
  const wav = path.join(recDir, key + '.wav');
  if (req.method === 'GET') {
    try {
      const buf = await fsp.readFile(wav);
      return send(res, 200, buf, { 'Content-Type': 'audio/wav', 'Content-Length': buf.length, 'Cache-Control': 'no-store' });
    } catch (e) { return sendJson(res, 404, { error: 'not found' }); }
  }
  if (req.method === 'PUT') {
    const body = await readBody(req, MAX_WAV);
    if (body.length < 44 || body.toString('ascii', 0, 4) !== 'RIFF' || body.toString('ascii', 8, 12) !== 'WAVE') {
      return sendJson(res, 415, { error: 'not a wav file' });
    }
    let en = '';
    try { en = decodeURIComponent(String(req.headers['x-en'] || '')).slice(0, 300); } catch (e) { en = ''; }
    await fsp.mkdir(recDir, { recursive: true });
    const idx = await readIdx();
    if (!idx[key] && Object.keys(idx).length >= MAX_REC_PER_PROFILE) return sendJson(res, 507, { error: 'quota exceeded' });
    await writeAtomic(wav, body);
    idx[key] = { en, size: body.length, t: Date.now() };
    await writeAtomic(idxFile, JSON.stringify(idx));
    return sendJson(res, 200, { ok: true });
  }
  if (req.method === 'DELETE') {
    const idx = await readIdx();
    delete idx[key];
    try { await fsp.unlink(wav); } catch (e) { /* yok say */ }
    await fsp.mkdir(recDir, { recursive: true });
    await writeAtomic(idxFile, JSON.stringify(idx));
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 405, { error: 'method not allowed' });
}

/* ---------- sunucu ---------- */
const server = http.createServer(async (req, res) => {
  const t0 = Date.now();
  res.on('finish', () => log(req, res.statusCode, t0));
  try {
    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'api') {
      if (limited(clientIp(req))) return sendJson(res, 429, { error: 'too many requests' });
      return await handleApi(req, res, parts, url);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
    return await serveStatic(req, res, url.pathname);
  } catch (err) {
    const status = err && err.status ? err.status : 500;
    if (status === 500) console.error(err);
    if (!res.headersSent) sendJson(res, status, { error: status === 413 ? 'payload too large' : 'server error' });
    else res.end();
  }
});
server.keepAliveTimeout = 65000;
server.headersTimeout = 70000;

if (require.main === module) {
  fs.mkdirSync(DATA, { recursive: true });
  server.listen(PORT, HOST, () => console.log(`Konuşma Pratiği ${VERSION} http://${HOST}:${PORT} (veri: ${DATA}, eşitleme: ${SYNC ? 'açık' : 'kapalı'}${TOKEN ? ', anahtarlı' : ''})`));
  const stop = () => { console.log('Kapanıyor...'); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 5000).unref(); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
module.exports = server;
