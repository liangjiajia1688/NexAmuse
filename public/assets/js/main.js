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

// ── Render Nav Auth State ─────────────────────────────────────────
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
        <span style="font-size:10px;color:#9aa0b4;">▼</span>
      </button>
      <div id="frontUserDropdown" style="position:absolute;top:calc(100% + 10px);right:0;width:210px;background:#111827;border:1px solid rgba(255,255,255,.1);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.5);z-index:999;overflow:hidden;opacity:0;transform:translateY(-8px);pointer-events:none;transition:opacity .2s,transform .2s;">
        <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.07);">
          <div style="font-size:13px;font-weight:600;color:#e2e8f0;">${session.name}</div>
          <div style="font-size:11px;color:#6b7280;">${session.email}</div>
        </div>
        ${session.role === 'admin' ? `<a href="${isInPages ? '../' : ''}admin/index.html" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:#9aa0b4;font-size:13px;text-decoration:none;transition:.15s;" onmouseover="this.style.background='rgba(255,255,255,.05)';this.style.color='#e2e8f0'" onmouseout="this.style.background='';this.style.color='#9aa0b4'">🛠️ Admin Dashboard</a>` : ''}
        <a href="${isInPages ? '' : 'pages/'}member-points.html" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:#9aa0b4;font-size:13px;text-decoration:none;transition:.15s;" onmouseover="this.style.background='rgba(255,255,255,.05)';this.style.color='#e2e8f0'" onmouseout="this.style.background='';this.style.color='#9aa0b4'">⭐ Member Center</a>
        <a href="#" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:#9aa0b4;font-size:13px;text-decoration:none;transition:.15s;" onmouseover="this.style.background=\'rgba(255,255,255,.05)\';this.style.color=\'#e2e8f0\'" onmouseout="this.style.background=\'\';this.style.color=\'#9aa0b4\'">👤 My Profile</a>
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
          <div style="padding:12px 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Signed in as ${session.name}</div>
        ${session.role === 'admin' ? `<a href="${isInPages ? '../' : ''}admin/index.html" style="display:block;padding:10px 0;color:#c9a227;font-size:14px;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.07);">🛠️ Admin Dashboard</a>` : ''}
          <a href="${isInPages ? '' : 'pages/'}member-points.html" style="display:block;padding:10px 0;color:#e2e8f0;font-size:14px;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.07);">⭐ Member Center</a>
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
  const symbols = { USD:'$', EUR:'€', GBP:'£', CNY:'¥', JPY:'¥', AED:'د.إ' };
  let currentCurrency = 'USD';
  document.querySelectorAll('.js-currency').forEach(btn => {
    btn.addEventListener('click', () => {
      currentCurrency = btn.dataset.currency;
      if(currencyEl) currencyEl.textContent = currentCurrency;
    });
  });

});
