// "Diğer Teknodoz Projeleri" sidebar block. Drop <div data-td-projects data-current="<project-id>"></div>
// into a sidebar and include this file plus teknodoz-projects.css. All text goes through textContent.
(() => {
  const API = 'https://teknodoz-projects.ortakofis.org';
  const T = { title: 'Diğer Teknodoz Projeleri', open: 'Açık Kaynak', priv: 'Özel', source: 'Kaynak kodu', unlock: 'Şifreyle aç', password: 'Şifre', go: 'Aç', fail: 'Liste şu an yüklenemedi.', wrong: 'Şifre hatalı.', busy: 'Çok fazla deneme. Biraz bekle.' };

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else node.setAttribute(k, v);
    }
    node.append(...children.filter(Boolean));
    return node;
  }

  const httpsOnly = (value) => {
    try { return new URL(value).protocol === 'https:' ? value : null; } catch { return null; }
  };

  function link(href, text) {
    const safe = httpsOnly(href);
    return safe ? el('a', { href: safe, target: '_blank', rel: 'noopener noreferrer' }, text) : el('span', {}, text);
  }

  async function unlock(project, input, message) {
    message.textContent = '';
    try {
      const res = await fetch(`${API}/v1/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: project.id, password: input.value }),
      });
      input.value = '';
      if (res.status === 429) { message.textContent = T.busy; return; }
      if (!res.ok) { message.textContent = T.wrong; return; }
      const { url } = await res.json();
      const safe = httpsOnly(url);
      if (safe) window.open(safe, '_blank', 'noopener,noreferrer');
    } catch {
      message.textContent = T.fail;
    }
  }

  function renderPrivate(project) {
    const message = el('p', { class: 'tdp-msg', role: 'status' });
    const input = el('input', { type: 'password', autocomplete: 'off', 'aria-label': `${project.name} ${T.password}`, placeholder: T.password, maxlength: '200' });
    const form = el('form', { class: 'tdp-form', hidden: '' }, input, el('button', { type: 'submit' }, T.go), message);
    form.addEventListener('submit', (e) => { e.preventDefault(); if (input.value) unlock(project, input, message); });
    const toggle = el('button', { type: 'button', class: 'tdp-toggle', 'aria-expanded': 'false' }, `🔒 ${T.unlock}`);
    toggle.addEventListener('click', () => {
      const open = form.hasAttribute('hidden');
      form.toggleAttribute('hidden', !open);
      toggle.setAttribute('aria-expanded', String(open));
      if (open) input.focus();
    });
    return [toggle, form];
  }

  function renderItem(p) {
    const head = el('div', { class: 'tdp-head' },
      p.locked ? el('span', { class: 'tdp-name' }, p.name) : link(p.url, p.name),
      el('span', { class: p.locked ? 'tdp-tag tdp-private' : 'tdp-tag tdp-open' }, p.locked ? T.priv : T.open));
    return el('li', { class: 'tdp-item' },
      head,
      p.description ? el('div', { class: 'tdp-desc' }, p.description) : null,
      p.locked ? null : (p.repo ? el('div', { class: 'tdp-desc' }, link(p.repo, T.source)) : null),
      ...(p.locked ? renderPrivate(p) : []));
  }

  async function mount(root) {
    const current = root.dataset.current || '';
    root.classList.add('tdp');
    root.replaceChildren(el('h2', { class: 'tdp-title' }, T.title));
    try {
      const res = await fetch(`${API}/v1/projects?current=${encodeURIComponent(current)}`);
      if (!res.ok) throw new Error(String(res.status));
      const { projects } = await res.json();
      root.append(el('ul', { class: 'tdp-list' }, ...projects.map(renderItem)));
    } catch {
      root.append(el('p', { class: 'tdp-msg' }, T.fail));
    }
  }

  document.querySelectorAll('[data-td-projects]').forEach(mount);
})();
