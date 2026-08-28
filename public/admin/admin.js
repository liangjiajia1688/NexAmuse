/* NexAmuse Global Admin — Shared JS */

// ── Session Management ────────────────────────────────────────────
const SESSION_KEY = 'nexamuse_user';

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch(e) { return null; }
}
function setSession(data) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
// API token helpers (admin pages call authenticated endpoints with these).
function getApiToken() {
  const s = getSession();
  return s && s.token ? s.token : '';
}
function apiHeaders(extra) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getApiToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return Object.assign(headers, extra || {});
}
async function apiGet(url) {
  const r = await fetch(url, { headers: apiHeaders() });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function apiSend(url, method, body) {
  const r = await fetch(url, { method, headers: apiHeaders(), body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
  return data;
}
function adminLogout() {
  clearSession();
  showToast('You have been signed out.', 'info');
  setTimeout(() => { window.location.href = 'login.html'; }, 800);
}

// ── Sidebar Navigation Data ──────────────────────────────────────
const NAV = [
  { section: 'Overview', items: [
    { href: 'index.html', icon: '📊', label: 'Dashboard', page: 'dashboard' },
  ]},
  { section: 'Members', items: [
    { href: 'members.html',           icon: '👥', label: 'Manage Members',   page: 'members' },
    { href: 'members-add.html',       icon: '➕', label: 'Add Member',       page: 'members-add' },
    { href: 'members-unverified.html',icon: '⏳', label: 'Unverified',       page: 'members-unverified', badge:'12' },
    { href: 'members-levels.html',    icon: '⭐', label: 'Member Levels',    page: 'members-levels' },
    { href: 'members-groups.html',    icon: '🗂', label: 'Member Groups',    page: 'members-groups' },
    { href: 'members-points.html',    icon: '💎', label: 'Points & Credits', page: 'members-points' },
    { href: 'members-messages.html',  icon: '💬', label: 'Messages',         page: 'members-messages', badge:'5' },
    { href: 'members-polls.html',     icon: '📊', label: 'Polls & Votes',    page: 'members-polls' },
    { href: 'members-lottery.html',   icon: '🎰', label: 'Lucky Draw',       page: 'members-lottery' },
    { href: 'members-wechat.html',    icon: '📱', label: 'WeChat Official',  page: 'members-wechat' },
    { href: 'members-assistant.html', icon: '🤖', label: 'Site Assistant',   page: 'members-assistant' },
    { href: 'members-notify.html',    icon: '🔔', label: 'Notifications',    page: 'members-notify' },
  ]},
  { section: 'Products', items: [
    { href: 'products.html',            icon: '🎮', label: 'Manage Products',  page: 'products' },
    { href: 'products-add.html',        icon: '➕', label: 'Add Product',      page: 'products-add' },
    { href: 'products-params.html',     icon: '⚙', label: 'Product Params',   page: 'products-params' },
    { href: 'products-categories.html', icon: '📁', label: 'Categories',       page: 'products-categories' },
    { href: 'products-tags.html',       icon: '🏷', label: 'Product Tags',     page: 'products-tags' },
  ]},
  { section: 'Articles', items: [
    { href: 'articles.html',            icon: '📰', label: 'Manage Articles',  page: 'articles' },
    { href: 'articles-add.html',        icon: '✍️', label: 'Add Article',      page: 'articles-add' },
    { href: 'articles-ai.html',         icon: '🤖', label: 'AI Batch Write',   page: 'articles-ai', badge:'NEW' },
    { href: 'articles-categories.html', icon: '📁', label: 'Article Categories',page:'articles-categories' },
  ]},
  { section: 'News', items: [
    { href: 'news-list.html',         icon: '🗞️', label: 'Manage News',     page: 'news-list', badge:'NEW' },
    { href: 'news-add.html',          icon: '➕', label: 'Add News',        page: 'news-add', badge:'NEW' },
    { href: 'news-crawler.html',      icon: '📡', label: 'RSS News',        page: 'news-crawler' },
    { href: 'news-categories.html',   icon: '🏷️', label: 'News Categories', page: 'news-categories', badge:'NEW' },
  ]},
  { section: 'Directory', items: [
    { href: 'companies.html',     icon: '🏭', label: 'Company Directory', page: 'companies', badge:'NEW' },
  ]},
  { section: 'Forum', items: [
    { href: 'forum.html',         icon: '💬', label: 'Forum Posts',      page: 'forum' },
    { href: 'forum-sections.html',icon: '📂', label: 'Forum Sections',   page: 'forum-sections' },
    { href: 'forum-reports.html', icon: '🚩', label: 'Reported Posts',   page: 'forum-reports', badge:'3' },
  ]},
  { section: 'Exhibitions', items: [
    { href: 'exhibitions.html',         icon: '🎪', label: 'Manage Exhibitions', page: 'exhibitions' },
    { href: 'exhibitions-crawler.html', icon: '🌐', label: 'Global Crawler',     page: 'exhibitions-crawler', badge:'NEW' },
  ]},
  { section: 'Advertising', items: [
    { href: 'ads.html',       icon: '📢', label: 'Ad Zones',          page: 'ads' },
    { href: 'ads-add.html',   icon: '➕', label: 'New Advertisement',  page: 'ads-add' },
    { href: 'ads-stats.html', icon: '📈', label: 'Ad Statistics',      page: 'ads-stats' },
  ]},
  { section: 'Media', items: [
    { href: 'gallery.html', icon: '🖼', label: 'Gallery / Albums', page: 'gallery' },
    { href: 'files.html',   icon: '💾', label: 'File Manager',     page: 'files' },
  ]},
  { section: 'Administration', items: [
    { href: 'admins.html',     icon: '🛡️', label: 'Admin Accounts',  page: 'admins' },
    { href: 'admin-log.html',  icon: '📋', label: 'Operation Logs',  page: 'admin-log' },
    { href: 'settings.html',   icon: '⚙️', label: 'Site Settings',   page: 'settings' },
  ]},
  { section: 'Site', items: [
    { href: '../index.html',       icon: '🌐', label: 'View Website', page: '' },
    { href: '../pages/forum.html', icon: '💬', label: 'View Forum',   page: '' },
    { href: '#', icon: '🚪', label: 'Logout', page: 'logout', onclick: 'adminLogout()' },
  ]},
];

// ── Render Sidebar ────────────────────────────────────────────────
(function renderNav() {
  const nav = document.getElementById('sidebarNav');
  if (!nav) return;
  const currentPage = window.location.pathname.split('/').pop().replace('.html','');
  let html = '';
  NAV.forEach(sec => {
    html += `<div class="nav-section"><div class="nav-section-title">${sec.section}</div>`;
    sec.items.forEach(item => {
      const active = (item.page === currentPage || item.href.includes(currentPage)) && currentPage ? 'active' : '';
      const badge = item.badge ? `<span class="badge ${item.badge==='NEW'?'new':''}">${item.badge}</span>` : '';
      const clickAttr = item.onclick ? ` onclick="${item.onclick}"` : '';
      html += `<a href="${item.href}" class="nav-item ${active}" data-page="${item.page}"${clickAttr}>
        <span class="nav-icon">${item.icon}</span>
        <span class="nav-label">${item.label}</span>${badge}
      </a>`;
    });
    html += '</div>';
  });
  nav.innerHTML = html;
})();

// ── Sidebar Toggle ────────────────────────────────────────────────
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const main = document.querySelector('.admin-main');
  if (!sb) return;
  const isOpen = sb.style.transform !== 'translateX(-100%)' && sb.style.transform !== '';
  if (window.innerWidth <= 768) {
    sb.style.transform = isOpen ? 'translateX(-100%)' : 'translateX(0)';
  } else {
    const collapsed = sb.dataset.collapsed === '1';
    if (!collapsed) {
      sb.style.width = '60px';
      sb.querySelectorAll('.nav-label,.nav-section-title,.badge,.logo-sub').forEach(el => el.style.display = 'none');
      sb.querySelector('.logo-text').style.display = 'none';
      if (main) main.style.marginLeft = '60px';
      sb.dataset.collapsed = '1';
    } else {
      sb.style.width = '';
      sb.querySelectorAll('.nav-label,.nav-section-title,.badge,.logo-sub').forEach(el => el.style.display = '');
      sb.querySelector('.logo-text').style.display = '';
      if (main) main.style.marginLeft = '';
      sb.dataset.collapsed = '0';
    }
  }
}

// ── Toast Notifications ───────────────────────────────────────────
let toastContainer = null;
function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}
function showToast(msg, type = 'info') {
  const colors = { success: '#56ab2f', error: '#ee0979', warning: '#f7971e', info: '#00c9ff' };
  const icons  = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.style.cssText = `background:#111827;border:1px solid ${colors[type]||colors.info};color:#e2e8f0;padding:12px 18px;border-radius:8px;font-size:13px;display:flex;align-items:center;gap:10px;pointer-events:auto;max-width:320px;box-shadow:0 4px 20px rgba(0,0,0,.4);animation:slideIn .3s ease;opacity:1;transition:opacity .3s`;
  toast.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span style="flex:1">${msg}</span><span style="cursor:pointer;opacity:.6;font-size:16px" onclick="this.parentElement.remove()">×</span>`;
  getToastContainer().appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// ── Inject global keyframe ────────────────────────────────────────
const styleEl = document.createElement('style');
styleEl.textContent = `@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`;
document.head.appendChild(styleEl);

// ── Responsive sidebar on mobile ─────────────────────────────────
window.addEventListener('resize', () => {
  const sb = document.getElementById('sidebar');
  if (!sb) return;
  if (window.innerWidth > 768) sb.style.transform = '';
});

// Safe no-op hook for per-page init (called from individual admin pages).
function initPage(){}
