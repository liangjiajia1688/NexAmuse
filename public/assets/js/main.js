/* main.js — NexAmuse Global */

// ── Auth Helpers ─────────────────────────────────────────────────
const SESSION_KEY = 'nexamuse_user';
function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch(e){ return null; }
}
function frontendLogout() {
  localStorage.removeItem(SESSION_KEY);
  window.location.reload();
}

// ── Sync user profile from server (keeps level/points/role fresh) ──
// The session stored at login is a snapshot; if an admin upgrades a member
// (e.g. Standard -> VIP) the cached level would be stale forever. This pulls
// the latest profile from /api/me and merges it into the local session.
async function syncUser() {
  const s = getSession();
  if (!s || !s.token) return null;
  try {
    const res = await fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + s.token } });
    if (!res.ok) {
      // Token invalid/expired — drop the stale session so pages show the right state.
      if (res.status === 401) localStorage.removeItem(SESSION_KEY);
      return null;
    }
    const data = await res.json();
    const u = data.user || {};
    const merged = Object.assign({}, s, {
      id: u.id || s.id,
      name: u.username || s.name,
      username: u.username || s.username,
      email: u.email || s.email,
      role: u.role || s.role,
      avatar: u.avatar || s.avatar,
      level: u.level || 'Standard',
      points: typeof u.points === 'number' ? u.points : (s.points || 0),
      status: u.status || 'active',
      is_super: u.is_super || 0
    });
    localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
    return merged;
  } catch (e) {
    return s; // network hiccup — keep the cached session, don't break the page
  }
}

// ── Ad slot helpers ──────────────────────────────────────────────
// Canonical size of each slot class — must mirror `.ad-slot-*` rules in style.css
// so the "AD · 1200×100" badge always matches the real placement.
const AD_SLOT_SIZES = {
  'ad-slot-hero': '1200×100',
  'ad-slot-section': '960×200',
  'ad-slot-leaderboard': '728×90',
  'ad-slot-article-mid': '970×250',
  'ad-slot-article-footer': '728×90',
  'ad-slot-product-grid': '300×300',
  'ad-slot-strip': '1200×90',
  'ad-slot-ticker': '1200×60',
  'ad-slot-sidebar': '300×250',
  'ad-slot-medium-rectangle': '300×250',
  'ad-slot-half-page': '300×600',
  'ad-slot-skyscraper': '160×600',
  'ad-slot-forum-top': '970×90',
  'ad-slot-between-posts': '300×250'
};

// Per-zone default icon + house-ad copy, used when an ad has no image
// or when the zone has no booked inventory yet.
const AD_ZONE_DEFAULTS = {
  homepage: { emoji: '🏠', title: 'Advertise on the NexAmuse Homepage' },
  sidebar:  { emoji: '📌', title: 'Sidebar Ad Space Available' },
  article:  { emoji: '📰', title: 'Sponsor the NexAmuse Editorial' },
  products: { emoji: '🎮', title: 'Feature Your Product Here' },
  forum:    { emoji: '💬', title: 'Reach Industry Buyers in the Forum' },
  ticker:   { emoji: '📢', title: 'Advertise with NexAmuse' }
};

function adSlotSize(el) {
  const cls = Array.prototype.find.call(el.classList, function(c) { return AD_SLOT_SIZES[c]; });
  return cls ? AD_SLOT_SIZES[cls] : '';
}

function adBadge(size) {
  return '<span style="position:absolute;top:5px;right:7px;display:inline-flex;align-items:baseline;gap:4px;'
    + 'font-size:8px;letter-spacing:1px;color:rgba(255,255,255,.75);background:rgba(0,0,0,.5);'
    + 'padding:2px 7px;border-radius:6px;text-transform:uppercase;pointer-events:none;line-height:1.2;">AD'
    + (size ? '<em style="font-size:6.5px;font-style:normal;letter-spacing:.3px;opacity:.7;">' + size + '</em>' : '')
    + '</span>';
}

// ── Render a single ad from /api/ads into a container ────────────
// zone maps to the ad `zone` field (homepage/sidebar/article/products/forum/ticker).
// If the zone has no active ad, a house-ad icon placeholder is shown instead of
// hiding the slot, so every planned position is always visible.
// Impressions + clicks are tracked for real (booked) ads only.
async function renderAdSlot(zone, containerId, opts) {
  opts = opts || {};
  const el = document.getElementById(containerId);
  if (!el) return;
  const size = adSlotSize(el);
  const fallback = AD_ZONE_DEFAULTS[zone] || { emoji: '📢', title: 'Advertise with NexAmuse' };

  // House-ad placeholder: icon + copy, links to the contact page.
  function renderPlaceholder() {
    el.innerHTML = '<a href="/pages/contact.html" class="ad-slot-link" style="display:flex;width:100%;height:100%;'
      + 'align-items:center;justify-content:center;gap:10px;border-radius:inherit;text-decoration:none;position:relative;'
      + 'background:linear-gradient(135deg,rgba(245,208,110,.06),rgba(10,14,26,.9));color:rgba(245,208,110,.75);'
      + 'font-weight:600;font-size:13px;padding:0 16px;text-align:center;">'
      + '<span style="font-size:20px;line-height:1;">' + fallback.emoji + '</span><span>' + fallback.title + '</span>'
      + adBadge(size) + '</a>';
    el.style.display = 'block';
  }

  // opts.index lets a page host several slots in the same zone without repeating
  // the same creative: slot N takes the Nth ad, unsold slots fall back to the house ad.
  const idx = Number(opts.index) || 0;

  try {
    const r = await fetch('/api/ads?zone=' + encodeURIComponent(zone) + '&limit=' + (idx + 1));
    if (!r.ok) { renderPlaceholder(); return; }
    const data = await r.json();
    const ads = data.ads || [];
    if (ads.length <= idx) { renderPlaceholder(); return; }

    const ad = ads[idx];
    const href = ad.link_url || '#';
    const emoji = ad.emoji || fallback.emoji;
    const creative = ad.image_url
      ? '<img src="' + ad.image_url + '" alt="' + (ad.alt_text || ad.title || 'Advertisement') + '" style="width:100%;height:100%;object-fit:cover;object-position:center;display:block;">'
      : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:10px;'
        + 'background:linear-gradient(135deg,#1a1208,#0a0e1a);color:#f5d06e;font-weight:600;font-size:14px;padding:0 16px;text-align:center;">'
        + '<span style="font-size:20px;line-height:1;">' + emoji + '</span><span>' + (ad.title || 'Sponsor') + '</span></div>';

    el.innerHTML = '<a href="' + href + '" target="_blank" rel="nofollow sponsored" class="ad-slot-link" data-ad-id="' + ad.id + '" style="display:block;width:100%;height:100%;border-radius:inherit;text-decoration:none;position:relative;">'
      + creative + adBadge(size) + '</a>';
    // Dimensions are controlled by the slot's CSS class so the admin size matches the front-end placement.
    el.style.display = 'block';
    // record impression
    fetch('/api/ads?id=' + ad.id + '&type=impression', { method: 'POST' }).catch(function(){});
    const link = el.querySelector('.ad-slot-link');
    if (link) link.addEventListener('click', function() {
      fetch('/api/ads?id=' + ad.id + '&type=click', { method: 'POST' }).catch(function(){});
    });
  } catch (e) { renderPlaceholder(); }
}

// ── Render Nav Auth State ─────────────────────────────────────────
function levelBadge(user) {
  if (!user) return '';
  const lvl = user.level || 'Standard';
  const map = {
    'VIP': ['👑 VIP', 'background:rgba(245,208,110,.18);color:#f5d06e;border:1px solid rgba(245,208,110,.35)'],
    'Premium': ['⭐ Premium', 'background:rgba(201,162,39,.15);color:#c9a227;border:1px solid rgba(201,162,39,.3)'],
    'Standard': ['🔵 Standard', 'background:rgba(99,102,241,.15);color:#818cf8;border:1px solid rgba(99,102,241,.25)']
  };
  const [label, style] = map[lvl] || map['Standard'];
  return `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;letter-spacing:.3px;flex-shrink:0;${style}">${label}</span>`;
}

function renderAuthNav() {
  const session = getSession();
  // Desktop nav-actions: find Login & Register btns
  const navActions = document.querySelector('.nav-actions');
  if (!navActions) return;

  // Remove existing login/register links and user-state block
  navActions.querySelectorAll('.auth-login-btn, .auth-register-btn, .auth-user-block').forEach(el => el.remove());

  const searchBtn = navActions.querySelector('.search-btn');
  const hamburger = navActions.querySelector('.hamburger');
  const isInPages = window.location.pathname.includes('/pages/');

  if (session) {
    // Logged in: show avatar + dropdown
    const initials = session.name ? session.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : 'U';
    const userBlock = document.createElement('div');
    userBlock.className = 'auth-user-block';
    userBlock.style.cssText = 'position:relative;display:flex;align-items:center;';
    userBlock.innerHTML = `
      <button class="auth-avatar-btn" id="frontUserBtn" onclick="toggleFrontUserMenu(event)" title="${session.name}" style="display:flex;align-items:center;gap:8px;background:rgba(201,162,39,.12);border:1px solid rgba(201,162,39,.35);border-radius:8px;padding:6px 12px;cursor:pointer;transition:.2s;">
        <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#c9a227,#f5d06e);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#0a0e1a;">${initials}</div>
        <span style="font-size:13px;color:#e2e8f0;font-weight:500;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${session.name}</span>
        ${levelBadge(session)}
        <span style="font-size:10px;color:#9aa0b4;">▼</span>
      </button>
      <div id="frontUserDropdown" style="position:absolute;top:calc(100% + 10px);right:0;width:210px;background:#111827;border:1px solid rgba(255,255,255,.1);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.5);z-index:999;overflow:hidden;opacity:0;transform:translateY(-8px);pointer-events:none;transition:opacity .2s,transform .2s;">
        <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.07);">
          <div style="font-size:13px;font-weight:600;color:#e2e8f0;">${session.name}</div>
          <div style="font-size:11px;color:#6b7280;">${session.email}</div>
        </div>
        ${session.role === 'admin' ? `<a href="${isInPages ? '../' : ''}admin/index.html" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:#9aa0b4;font-size:13px;text-decoration:none;transition:.15s;" onmouseover="this.style.background='rgba(255,255,255,.05)';this.style.color='#e2e8f0'" onmouseout="this.style.background='';this.style.color='#9aa0b4'">🛠️ Admin Dashboard</a>` : ''}
        <a href="${isInPages ? '' : 'pages/'}member-points.html" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:#9aa0b4;font-size:13px;text-decoration:none;transition:.15s;" onmouseover="this.style.background='rgba(255,255,255,.05)';this.style.color='#e2e8f0'" onmouseout="this.style.background='';this.style.color='#9aa0b4'">⭐ Member Center</a>
        ${(['Premium','VIP'].includes(session.level) || session.role==='admin') ? `
        <a href="${isInPages ? '' : 'pages/'}company-dashboard.html" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:#f5d06e;font-size:13px;font-weight:600;text-decoration:none;transition:.15s;" onmouseover="this.style.background='rgba(255,255,255,.05)';this.style.color='#fff'" onmouseout="this.style.background='';this.style.color='#f5d06e'">🎛️ Dashboard</a>
        <a href="${isInPages ? '' : 'pages/'}company-profile.html" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:#9aa0b4;font-size:13px;text-decoration:none;transition:.15s;" onmouseover="this.style.background='rgba(255,255,255,.05)';this.style.color='#e2e8f0'" onmouseout="this.style.background='';this.style.color='#9aa0b4'">🏭 My Company</a>
        <a href="${isInPages ? '' : 'pages/'}company-products.html" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:#9aa0b4;font-size:13px;text-decoration:none;transition:.15s;" onmouseover="this.style.background='rgba(255,255,255,.05)';this.style.color='#e2e8f0'" onmouseout="this.style.background='';this.style.color='#9aa0b4'">📦 My Products</a>
        <a href="${isInPages ? '' : 'pages/'}company-dashboard.html#articles" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:#9aa0b4;font-size:13px;text-decoration:none;transition:.15s;" onmouseover="this.style.background='rgba(255,255,255,.05)';this.style.color='#e2e8f0'" onmouseout="this.style.background='';this.style.color='#9aa0b4'">📝 My Articles</a>
        <a href="${isInPages ? '' : 'pages/'}company-dashboard.html#forum" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:#9aa0b4;font-size:13px;text-decoration:none;transition:.15s;" onmouseover="this.style.background='rgba(255,255,255,.05)';this.style.color='#e2e8f0'" onmouseout="this.style.background='';this.style.color='#9aa0b4'">💬 My Forum</a>` : ''}
        <a href="${isInPages ? '' : 'pages/'}profile.html" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:#9aa0b4;font-size:13px;text-decoration:none;transition:.15s;" onmouseover="this.style.background=\'rgba(255,255,255,.05)\';this.style.color=\'#e2e8f0\'" onmouseout="this.style.background=\'\';this.style.color=\'#9aa0b4\'">👤 My Profile</a>
        <div style="height:1px;background:rgba(255,255,255,.07);margin:4px 0;"></div>
        <a href="#" onclick="frontendLogout();return false;" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:#f87171;font-size:13px;text-decoration:none;transition:.15s;" onmouseover="this.style.background=\'rgba(238,9,121,.08)\'" onmouseout="this.style.background=\'\'">🚪 Sign Out</a>
      </div>`;
    // Insert before hamburger
    if (hamburger) navActions.insertBefore(userBlock, hamburger);
    else navActions.appendChild(userBlock);

  } else {
    // Not logged in: show Login + Register
    const base = isInPages ? '' : 'pages/';
    const loginBtn = document.createElement('a');
    loginBtn.className = 'btn btn-outline btn-sm auth-login-btn';
    loginBtn.href = base + 'login.html';
    loginBtn.textContent = 'Login';

    const regBtn = document.createElement('a');
    regBtn.className = 'btn btn-primary btn-sm auth-register-btn';
    regBtn.href = base + 'register.html';
    regBtn.textContent = 'Register';

    if (hamburger) {
      navActions.insertBefore(regBtn, hamburger);
      navActions.insertBefore(loginBtn, regBtn);
    } else {
      navActions.appendChild(loginBtn);
      navActions.appendChild(regBtn);
    }
  }

  // Mobile menu auth state
  const mobileMenu = document.getElementById('mobileMenu');
  if (mobileMenu) {
    const mobileAuthWrap = mobileMenu.querySelector('.mobile-auth-wrap');
    if (mobileAuthWrap) {
      if (session) {
        mobileAuthWrap.innerHTML = `
          <div style="padding:12px 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;display:flex;align-items:center;gap:8px;">Signed in as ${session.name} ${levelBadge(session)}</div>
        ${session.role === 'admin' ? `<a href="${isInPages ? '../' : ''}admin/index.html" style="display:block;padding:10px 0;color:#c9a227;font-size:14px;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.07);">🛠️ Admin Dashboard</a>` : ''}
          <a href="${isInPages ? '' : 'pages/'}member-points.html" style="display:block;padding:10px 0;color:#e2e8f0;font-size:14px;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.07);">⭐ Member Center</a>
          ${(['Premium','VIP'].includes(session.level) || session.role==='admin') ? `
          <a href="${isInPages ? '' : 'pages/'}company-dashboard.html" style="display:block;padding:10px 0;color:#f5d06e;font-size:14px;font-weight:600;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.07);">🎛️ Dashboard</a>
          <a href="${isInPages ? '' : 'pages/'}company-profile.html" style="display:block;padding:10px 0;color:#e2e8f0;font-size:14px;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.07);">🏭 My Company</a>
          <a href="${isInPages ? '' : 'pages/'}company-products.html" style="display:block;padding:10px 0;color:#e2e8f0;font-size:14px;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.07);">📦 My Products</a>
          <a href="${isInPages ? '' : 'pages/'}company-dashboard.html#articles" style="display:block;padding:10px 0;color:#e2e8f0;font-size:14px;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.07);">📝 My Articles</a>
          <a href="${isInPages ? '' : 'pages/'}company-dashboard.html#forum" style="display:block;padding:10px 0;color:#e2e8f0;font-size:14px;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.07);">💬 My Forum</a>` : ''}
          <a href="${isInPages ? '' : 'pages/'}profile.html" style="display:block;padding:10px 0;color:#e2e8f0;font-size:14px;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.07);">👤 My Profile</a>
          <button onclick="frontendLogout()" style="width:100%;margin-top:12px;padding:12px;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3);border-radius:10px;color:#f87171;font-size:14px;font-weight:600;cursor:pointer;">🚪 Sign Out</button>`;
      } else {
        const base = isInPages ? '' : 'pages/';
        mobileAuthWrap.innerHTML = `
          <a href="${base}login.html" class="btn btn-outline" style="width:100%;justify-content:center;margin-bottom:10px;">🔑 Login</a>
          <a href="${base}register.html" class="btn btn-primary" style="width:100%;justify-content:center;">✨ Register Free</a>`;
      }
    }
  }
}

function toggleFrontUserMenu(e) {
  e.stopPropagation();
  const d = document.getElementById('frontUserDropdown');
  const isOpen = d.style.opacity === '1';
  if (isOpen) {
    d.style.opacity = '0'; d.style.transform = 'translateY(-8px)'; d.style.pointerEvents = 'none';
  } else {
    d.style.opacity = '1'; d.style.transform = 'translateY(0)'; d.style.pointerEvents = 'auto';
  }
}
document.addEventListener('click', () => {
  const d = document.getElementById('frontUserDropdown');
  if (d) { d.style.opacity = '0'; d.style.transform = 'translateY(-8px)'; d.style.pointerEvents = 'none'; }
});

document.addEventListener('DOMContentLoaded', () => {

  // Run auth nav render
  renderAuthNav();

  // Refresh the user's latest profile (level/points/role/is_super) from the
  // server, then re-render the nav so an admin's upgrade takes effect on the
  // very next page load — no re-login needed.
  syncUser().then(() => renderAuthNav());

  /* ── Search Overlay ── */
  const searchOverlay = document.getElementById('searchOverlay');
  document.querySelectorAll('.js-open-search').forEach(btn => {
    btn.addEventListener('click', () => { searchOverlay?.classList.add('open'); document.body.style.overflow='hidden'; });
  });
  document.getElementById('searchClose')?.addEventListener('click', () => { searchOverlay?.classList.remove('open'); document.body.style.overflow=''; });
  searchOverlay?.addEventListener('click', (e) => { if(e.target === searchOverlay){ searchOverlay.classList.remove('open'); document.body.style.overflow=''; } });

  /* ── Mobile Menu ── */
  const mobileMenu = document.getElementById('mobileMenu');
  document.getElementById('hamburger')?.addEventListener('click', () => { mobileMenu?.classList.add('open'); document.body.style.overflow='hidden'; });
  document.getElementById('mobileClose')?.addEventListener('click', () => { mobileMenu?.classList.remove('open'); document.body.style.overflow=''; });

  /* ── Scroll to Top ── */
  const scrollBtn = document.getElementById('scrollTop');
  window.addEventListener('scroll', () => {
    if(window.scrollY > 400){ scrollBtn?.classList.add('visible'); }
    else { scrollBtn?.classList.remove('visible'); }
  });
  scrollBtn?.addEventListener('click', () => window.scrollTo({top:0,behavior:'smooth'}));

  /* ── Filter Buttons ── */
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function(){
      const group = this.dataset.group;
      document.querySelectorAll(`.filter-btn[data-group="${group}"]`).forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const target = this.dataset.filter;
      const container = this.closest('section')?.querySelector('.filterable-grid');
      if(!container) return;
      container.querySelectorAll('.filterable-item').forEach(item => {
        const show = target === 'all' || item.dataset.category === target;
        item.style.display = show ? '' : 'none';
      });
    });
  });

  /* ── Fade-in on scroll ── */
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('visible'); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

  /* ── Newsletter form ── */
  document.querySelectorAll('.newsletter-form').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      const btn = form.querySelector('button');
      if(input?.value){
        const orig = btn.textContent;
        btn.textContent = '✓ Subscribed!';
        btn.style.background = '#22c55e';
        setTimeout(() => { btn.textContent = orig; btn.style.background = ''; input.value = ''; }, 3000);
      }
    });
  });

  /* ── Inquiry Modal ── */
  const modal = document.getElementById('inquiryModal');
  document.querySelectorAll('.js-inquiry').forEach(btn => {
    btn.addEventListener('click', () => { modal?.classList.add('open'); document.body.style.overflow='hidden'; });
  });
  document.getElementById('modalClose')?.addEventListener('click', () => { modal?.classList.remove('open'); document.body.style.overflow=''; });
  modal?.addEventListener('click', (e) => { if(e.target === modal){ modal.classList.remove('open'); document.body.style.overflow=''; } });
  document.getElementById('inquiryForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    btn.textContent = '✓ Inquiry Sent Successfully!';
    btn.style.background = '#22c55e';
    setTimeout(() => { modal?.classList.remove('open'); document.body.style.overflow=''; btn.textContent = 'Submit Inquiry'; btn.style.background = ''; e.target.reset(); }, 2500);
  });

  /* ── Active nav link ── */
  const currentPage = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    if(a.getAttribute('href') === currentPage || (currentPage === '' && a.getAttribute('href') === 'index.html')){
      a.classList.add('active');
    }
  });

  /* ── Currency converter hint ── */
  const currencyEl = document.getElementById('currencyDisplay');
  const rates = { USD: 1, EUR: 0.93, GBP: 0.79, CNY: 7.24, JPY: 149.5, AED: 3.67 };

  /* ── Analytics beacon ── */
  (function sendBeacon(){
    try{
      if(location.hostname==='localhost' || location.protocol==='file:') return;
      fetch('/api/track', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({path: location.pathname + location.search}),
        keepalive: true
      }).catch(()=>{});
    }catch(e){}
  })();
  const symbols = { USD:'$', EUR:'€', GBP:'£', CNY:'¥', JPY:'¥', AED:'د.إ' };
  let currentCurrency = 'USD';
  document.querySelectorAll('.js-currency').forEach(btn => {
    btn.addEventListener('click', () => {
      currentCurrency = btn.dataset.currency;
      if(currencyEl) currencyEl.textContent = currentCurrency;
    });
  });

});
