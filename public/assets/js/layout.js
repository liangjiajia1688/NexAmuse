// 统一布局注入：导航 + 页脚（根据当前所在目录自动调整相对路径）
(function () {
  const prefix = location.pathname.includes('/pages/') ? '../' : '';

  const header = document.getElementById('na-header');
  if (header) {
    header.innerHTML = `
    <div class="top-bar"><div class="container"><div class="top-bar-left">
      <span><span class="live-badge"><span class="live-dot"></span>LIVE</span> &nbsp;NexAmuse 二手设备交易平台</span>
      <span>🌐 全球游戏游艺设备门户</span>
    </div>
    <div class="top-bar-right">
      <a href="${prefix}pages/products.html">二手市场</a>
      <a href="${prefix}pages/companies.html">企业</a>
      <a href="${prefix}pages/forum.html">论坛</a>
      <a href="${prefix}pages/contact.html">联系</a>
    </div></div></div>

    <nav class="navbar"><div class="container">
      <a href="${prefix}index.html" class="logo">
        <div class="logo-icon">N</div>
        <div><div class="logo-text">Nex<span>Amuse</span></div><div class="logo-sub">Global Portal</div></div>
      </a>
      <ul class="nav-links">
        <li><a href="${prefix}index.html">首页</a></li>
        <li><a href="${prefix}pages/products.html">二手设备 ▾</a>
          <div class="dropdown-menu">
            <a href="${prefix}pages/products.html?cat=arcade">游戏机 / 街机</a>
            <a href="${prefix}pages/products.html?cat=amusement">游乐设备</a>
            <a href="${prefix}pages/products.html?cat=anime">动漫周边</a>
            <a href="${prefix}pages/products.html?cat=other">其他</a>
          </div>
        </li>
        <li><a href="${prefix}pages/news.html">行业新闻</a></li>
        <li><a href="${prefix}pages/companies.html">企业主页</a></li>
        <li><a href="${prefix}pages/forum.html">论坛</a></li>
      </ul>
      <div class="nav-actions">
        <button class="hamburger" id="hamburger"><span></span><span></span><span></span></button>
      </div>
    </div></nav>

    <div class="mobile-menu" id="mobileMenu">
      <button class="mobile-menu-close" id="mobileClose">✕</button>
      <ul class="mobile-nav-links">
        <li><a href="${prefix}index.html">🏠 首页</a></li>
        <li><a href="${prefix}pages/products.html">🎮 二手设备</a></li>
        <li><a href="${prefix}pages/news.html">📰 行业新闻</a></li>
        <li><a href="${prefix}pages/companies.html">🏭 企业主页</a></li>
        <li><a href="${prefix}pages/forum.html">💬 论坛</a></li>
        <li><a href="${prefix}pages/contact.html">📩 联系</a></li>
      </ul>
      <div class="mobile-auth-wrap" style="margin-top:32px;display:flex;flex-direction:column;gap:12px;"></div>
    </div>`;

    const ham = header.querySelector('#hamburger');
    const mm = header.querySelector('#mobileMenu');
    const close = header.querySelector('#mobileClose');
    if (ham) ham.onclick = () => mm.classList.add('open');
    if (close) close.onclick = () => mm.classList.remove('open');
  }

  const footer = document.getElementById('na-footer');
  if (footer) {
    footer.innerHTML = `<footer style="background:var(--primary);border-top:1px solid var(--border);padding:40px 20px;text-align:center;color:var(--text-secondary);margin-top:60px;">
      <div style="max-width:1100px;margin:0 auto;">
        <div class="logo-text" style="font-family:var(--font-display);font-size:1.4rem;color:var(--text-primary)">Nex<span style="color:var(--accent)">Amuse</span></div>
        <p style="margin:12px 0;">全球游戏游艺设备二手交易 · 企业展示 · 行业论坛</p>
        <p style="font-size:.8rem;">© 2026 NexAmuse Global. 保留所有权利。</p>
      </div></footer>`;
  }
})();
