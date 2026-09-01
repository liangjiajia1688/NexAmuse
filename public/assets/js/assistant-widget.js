/* NexAmuse Site Assistant — floating chat widget (rule-based).
   Loaded with `defer` on every public page. Reads config from
   /api/assistant/settings and talks to /api/assistant/chat. */
(function () {
  if (window.__nexAssistantLoaded) return;
  window.__nexAssistantLoaded = true;

  const CACHE_KEY = 'nex_assistant_cfg';
  const CACHE_TTL = 10 * 60 * 1000; // 10 min

  function hasSession() {
    try {
      const s = JSON.parse(localStorage.getItem('nexamuse_user') || 'null');
      return !!(s && s.token);
    } catch (e) { return false; }
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (Date.now() - (o.t || 0) > CACHE_TTL) return null;
      return o.cfg;
    } catch (e) { return null; }
  }
  function writeCache(cfg) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), cfg })); } catch (e) {}
  }

  async function getConfig() {
    const cached = readCache();
    if (cached) return cached;
    try {
      const r = await fetch('/api/assistant/settings', { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const cfg = await r.json();
      writeCache(cfg);
      return cfg;
    } catch (e) {
      // Safe fallback so the widget still appears with defaults if API is down.
      return {
        enabled: true, name: 'Nex — Your Amusement Guide', avatar: '🤖',
        greeting: "Hello! 👋 I'm Nex, your guide to NexAmuse Global. How can I help you today?",
        quickReplies: ['Browse VR Equipment', 'Find Suppliers', 'Upcoming Exhibitions'],
        showAllPages: true, requireLogin: false,
      };
    }
  }

  const CSS = `
#nexAw-root{position:fixed;right:20px;bottom:20px;z-index:99999;font-family:'Inter',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}
#nexAw-bubble{width:58px;height:58px;border-radius:50%;background:linear-gradient(135deg,#d4af37,#b8941e);color:#0a0e1a;border:none;cursor:pointer;font-size:26px;box-shadow:0 10px 30px rgba(201,162,39,.45);display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s;}
#nexAw-bubble:hover{transform:scale(1.08);box-shadow:0 14px 38px rgba(201,162,39,.6);}
#nexAw-panel{position:absolute;right:0;bottom:72px;width:360px;max-width:calc(100vw - 40px);height:520px;max-height:calc(100vh - 120px);background:#0a0e1a;border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.6);display:none;flex-direction:column;overflow:hidden;}
#nexAw-panel.open{display:flex;animation:nexAwPop .22s ease;}
@keyframes nexAwPop{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}
#nexAw-head{background:linear-gradient(135deg,#d4af37,#b8941e);padding:14px 16px;display:flex;align-items:center;gap:10px;color:#0a0e1a;}
#nexAw-head .ico{font-size:24px;}
#nexAw-head .meta{flex:1;}
#nexAw-head .nm{font-weight:700;font-size:14px;font-family:'Playfair Display',serif;}
#nexAw-head .st{font-size:11px;opacity:.7;}
#nexAw-head .x{background:rgba(0,0,0,.12);border:none;color:#0a0e1a;width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:16px;}
#nexAw-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background:#0f1428;}
#nexAw-msgs::-webkit-scrollbar{width:6px;}
#nexAw-msgs::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:6px;}
.nexAw-msg{max-width:86%;padding:11px 13px;border-radius:12px;font-size:13px;line-height:1.5;}
.nexAw-msg.bot{background:rgba(201,162,39,.12);border:1px solid rgba(201,162,39,.22);color:#e2e8f0;align-self:flex-start;border-bottom-left-radius:4px;}
.nexAw-msg.user{background:#1f6feb;color:#fff;align-self:flex-end;border-bottom-right-radius:4px;}
.nexAw-links{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;}
.nexAw-link{background:rgba(255,255,255,.06);border:1px solid rgba(201,162,39,.35);color:#f5d06e;padding:6px 11px;border-radius:16px;font-size:11px;cursor:pointer;text-decoration:none;}
.nexAw-link:hover{background:rgba(201,162,39,.18);}
#nexAw-chips{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px;border-top:1px solid rgba(255,255,255,.08);background:#0d1224;}
.nexAw-chip{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#cbd5e1;padding:5px 11px;border-radius:16px;font-size:11px;cursor:pointer;}
.nexAw-chip:hover{border-color:rgba(201,162,39,.5);color:#f5d06e;}
#nexAw-input{display:flex;gap:8px;padding:10px 12px;border-top:1px solid rgba(255,255,255,.08);background:#0d1224;}
#nexAw-input input{flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:9px 14px;color:#e2e8f0;font-size:13px;outline:none;}
#nexAw-input input:focus{border-color:rgba(201,162,39,.5);}
#nexAw-input button{background:linear-gradient(135deg,#d4af37,#b8941e);border:none;border-radius:50%;width:36px;height:36px;cursor:pointer;color:#0a0e1a;font-size:15px;flex-shrink:0;}
#nexAw-typing{font-size:12px;color:#9aa0b4;font-style:italic;padding:2px 2px;}
`;

  function injectCss() {
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function init(cfg) {
    injectCss();
    const root = el('div');
    root.id = 'nexAw-root';

    const bubble = el('button');
    bubble.id = 'nexAw-bubble';
    bubble.textContent = cfg.avatar || '🤖';
    bubble.setAttribute('aria-label', 'Open chat');

    const panel = el('div');
    panel.id = 'nexAw-panel';

    const head = el('div');
    head.id = 'nexAw-head';
    head.innerHTML =
      '<div class="ico">' + (cfg.avatar || '🤖') + '</div>' +
      '<div class="meta"><div class="nm">' + esc(cfg.name || 'Site Assistant') + '</div><div class="st">● Online</div></div>' +
      '<button class="x" title="Close">✕</button>';

    const msgs = el('div');
    msgs.id = 'nexAw-msgs';

    const chips = el('div');
    chips.id = 'nexAw-chips';

    const inputRow = el('div');
    inputRow.id = 'nexAw-input';
    const inp = el('input');
    inp.type = 'text';
    inp.placeholder = 'Type a message…';
    const send = el('button');
    send.textContent = '➤';
    inputRow.appendChild(inp);
    inputRow.appendChild(send);

    panel.appendChild(head);
    panel.appendChild(msgs);
    panel.appendChild(chips);
    panel.appendChild(inputRow);
    root.appendChild(bubble);
    root.appendChild(panel);
    document.body.appendChild(root);

    // Greeting as first bot message
    addBot(cfg.greeting || "Hello! 👋 How can I help you today?", []);
    renderChips(cfg.quickReplies || []);

    function addBot(text, links) {
      const m = el('div', 'nexAw-msg bot', esc(text));
      if (links && links.length) {
        const lk = el('div', 'nexAw-links');
        links.forEach(l => {
          const a = el('a', 'nexAw-link', esc(l.label));
          a.href = l.href; a.target = '_blank'; a.rel = 'noopener';
          lk.appendChild(a);
        });
        m.appendChild(lk);
      }
      msgs.appendChild(m);
      msgs.scrollTop = msgs.scrollHeight;
    }
    function addUser(text) {
      msgs.appendChild(el('div', 'nexAw-msg user', esc(text)));
      msgs.scrollTop = msgs.scrollHeight;
    }
    function renderChips(list) {
      chips.innerHTML = '';
      (list || []).forEach(c => {
        const b = el('div', 'nexAw-chip', esc(c));
        b.onclick = () => sendMsg(c);
        chips.appendChild(b);
      });
    }

    let busy = false;
    async function sendMsg(text) {
      text = (text || '').trim();
      if (!text || busy) return;
      addUser(text);
      busy = true;
      inp.value = '';
      const typing = el('div', 'nexAw-msg bot', '<span id="nexAw-typing">Nex is typing…</span>');
      msgs.appendChild(typing);
      msgs.scrollTop = msgs.scrollHeight;
      try {
        const r = await fetch('/api/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        });
        const data = await r.json();
        typing.remove();
        addBot(data.text || "Sorry, I didn't catch that.", data.links || []);
      } catch (e) {
        typing.remove();
        addBot("I'm having trouble connecting right now. Please try again in a moment.", []);
      } finally {
        busy = false;
      }
    }

    bubble.onclick = () => panel.classList.toggle('open');
    head.querySelector('.x').onclick = () => panel.classList.remove('open');
    send.onclick = () => sendMsg(inp.value);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(inp.value); });
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function boot() {
    getConfig().then(cfg => {
      if (cfg.enabled === false) return;
      if (cfg.requireLogin && !hasSession()) return;
      if (cfg.showAllPages === false) {
        const p = location.pathname;
        if (p !== '/' && !p.endsWith('/index.html') && !p.endsWith('index.html')) return;
      }
      init(cfg);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
