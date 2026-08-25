// NexAmuse 鉴权与导航登录态（全局 window.Auth）
window.Auth = (function () {
  const TKEY = 'na_token', UKEY = 'na_user', CKEY = 'na_company';

  function getToken() { return localStorage.getItem(TKEY); }
  function getUser() { try { return JSON.parse(localStorage.getItem(UKEY)); } catch (e) { return null; } }
  function getCompany() { try { return JSON.parse(localStorage.getItem(CKEY)); } catch (e) { return null; } }
  function set(token, user, company) {
    localStorage.setItem(TKEY, token);
    localStorage.setItem(UKEY, JSON.stringify(user));
    if (company) localStorage.setItem(CKEY, JSON.stringify(company));
  }
  function clear() {
    localStorage.removeItem(TKEY); localStorage.removeItem(UKEY); localStorage.removeItem(CKEY);
  }
  function isLogin() { return !!getToken(); }

  // 拉取最新用户信息（用于刷新角色/企业）
  async function ensure() {
    if (!isLogin()) return null;
    try {
      const r = await window.Api.me();
      if (r.ok) { set(getToken(), r.user, r.company); return r.user; }
    } catch (e) { /* token 失效 */ }
    return getUser();
  }

  // 把登录/用户按钮注入到现有导航
  function renderNav() {
    const wrap = document.querySelector('.nav-actions');
    if (wrap) {
      const old = wrap.querySelector('.auth-slot');
      if (old) old.remove();
      const slot = document.createElement('span');
      slot.className = 'auth-slot';
      if (isLogin()) {
        const u = getUser();
        slot.innerHTML = `<a href="pages/dashboard.html" class="btn-ghost">${escapeHtml(u.username)}</a>` +
          `<button class="btn-ghost" id="naLogout">退出</button>`;
      } else {
        slot.innerHTML = `<a href="pages/login.html" class="btn-ghost">登录 / 注册</a>`;
      }
      const ham = wrap.querySelector('.hamburger');
      wrap.insertBefore(slot, ham);
      const lo = slot.querySelector('#naLogout');
      if (lo) lo.onclick = () => { clear(); location.reload(); };
    }

    const mwrap = document.querySelector('.mobile-auth-wrap');
    if (mwrap) {
      if (isLogin()) {
        const u = getUser();
        mwrap.innerHTML = `<a href="pages/dashboard.html" class="btn-primary" style="text-align:center">${escapeHtml(u.username)}</a>` +
          `<button class="btn-ghost" id="naLogoutM" style="text-align:center">退出登录</button>`;
      } else {
        mwrap.innerHTML = `<a href="pages/login.html" class="btn-primary" style="text-align:center">登录 / 注册</a>`;
      }
      const lo = mwrap.querySelector('#naLogoutM');
      if (lo) lo.onclick = () => { clear(); location.reload(); };
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  return { getToken, getUser, getCompany, set, clear, isLogin, ensure, renderNav, escapeHtml };
})();

document.addEventListener('DOMContentLoaded', () => {
  window.Auth.ensure().then(() => window.Auth.renderNav());
});
