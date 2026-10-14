'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-'));
process.env.DATA_DIR = tmp;
process.env.SYNC_TOKEN = 'gizli-anahtar';
process.env.SYNC_ENABLED = '1';
const server = require('../server.js');

let base;
test.before(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(() => server.close());

function wavBuffer() {
  const b = Buffer.alloc(44 + 200);
  b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(36 + 200, 4); b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii'); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36, 'ascii'); b.writeUInt32LE(200, 40);
  return b;
}
const H = { 'x-sync-token': 'gizli-anahtar' };

test('ana sayfa ve güvenlik başlıkları', async () => {
  const r = await fetch(base + '/');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/html/);
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.match(r.headers.get('permissions-policy'), /microphone=\(self\)/);
  const html = await r.text();
  assert.match(html, /Konuşma Pratiği/);
});
test('gzip, manifest ve vendor dosyaları', async () => {
  const r = await fetch(base + '/manifest.webmanifest');
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.short_name, 'Konuşma');
  assert.equal((await fetch(base + '/vendor/jszip.min.js')).status, 200);
  assert.equal((await fetch(base + '/sw.js')).status, 200);
});
test('yol gezintisi engellenir', async () => {
  const r = await fetch(base + '/..%2fserver.js');
  assert.ok([403, 404].includes(r.status));
});
test('health açık, eşitleme anahtarsız 401', async () => {
  assert.equal((await (await fetch(base + '/api/health')).json()).sync, true);
  const h = await (await fetch(base + '/api/health')).json();
  assert.equal(h.ok, true); assert.equal(h.auth, true);
  assert.equal((await fetch(base + '/api/state/profil-test-1')).status, 401);
});
test('durum yaz/oku', async () => {
  const p = base + '/api/state/profil-test-1';
  assert.equal((await fetch(p, { headers: H })).status, 404);
  const put = await fetch(p, { method: 'PUT', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ v: 1, st: { hello: 'k' } }) });
  assert.equal(put.status, 200);
  const got = await (await fetch(p, { headers: H })).json();
  assert.equal(got.st.hello, 'k');
});
test('geçersiz profil ve json reddedilir', async () => {
  assert.equal((await fetch(base + '/api/state/ab', { headers: H })).status, 400);
  const r = await fetch(base + '/api/state/profil-test-1', { method: 'PUT', headers: H, body: 'not json' });
  assert.equal(r.status, 400);
});
test('WAV yükle, listele, indir, sil', async () => {
  const k = base + '/api/rec/profil-test-1/i_grab_my_keys';
  const bad = await fetch(k, { method: 'PUT', headers: { ...H, 'x-en': 'x' }, body: Buffer.from('merhaba dunya, bu wav degil ki') });
  assert.equal(bad.status, 415);
  const ok = await fetch(k, { method: 'PUT', headers: { ...H, 'Content-Type': 'audio/wav', 'x-en': encodeURIComponent('I grab my keys.') }, body: wavBuffer() });
  assert.equal(ok.status, 200);
  const list = await (await fetch(base + '/api/rec/profil-test-1', { headers: H })).json();
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].en, 'I grab my keys.');
  const dl = await fetch(k, { headers: H });
  assert.equal(dl.headers.get('content-type'), 'audio/wav');
  assert.equal((await dl.arrayBuffer()).byteLength, 244);
  assert.equal((await fetch(k, { method: 'DELETE', headers: H })).status, 200);
  assert.equal((await fetch(k, { headers: H })).status, 404);
});
