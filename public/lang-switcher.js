/* ===== NexAmuse Language Switcher ===== */
(function () {
  'use strict';

  var LANGS = [
    { code: 'zh-CN', label: '中文', flag: '🇨🇳' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' }
  ];

  // English phrase -> { zh-CN, es, fr, de }. Keys are the exact served (English) text.
  var DICT = {
    // --- Top nav ---
    'Home': { 'zh-CN': '首页', 'es': 'Inicio', 'fr': 'Accueil', 'de': 'Start' },
    'Products ▾': { 'zh-CN': '产品 ▾', 'es': 'Productos ▾', 'fr': 'Produits ▾', 'de': 'Produkte ▾' },
    'News ▾': { 'zh-CN': '资讯 ▾', 'es': 'Noticias ▾', 'fr': 'Actualités ▾', 'de': 'Neuigkeiten ▾' },
    'Suppliers': { 'zh-CN': '供应商', 'es': 'Proveedores', 'fr': 'Fournisseurs', 'de': 'Lieferanten' },
    'Exhibitions ▾': { 'zh-CN': '展会 ▾', 'es': 'Exposiciones ▾', 'fr': 'Salons ▾', 'de': 'Messen ▾' },
    'Articles': { 'zh-CN': '文章', 'es': 'Artículos', 'fr': 'Articles', 'de': 'Artikel' },
    'Forum': { 'zh-CN': '论坛', 'es': 'Foro', 'fr': 'Forum', 'de': 'Forum' },
    'Points': { 'zh-CN': '积分', 'es': 'Puntos', 'fr': 'Points', 'de': 'Punkte' },
    'Videos': { 'zh-CN': '视频', 'es': 'Vídeos', 'fr': 'Vidéos', 'de': 'Videos' },
    'Contact': { 'zh-CN': '联系', 'es': 'Contacto', 'fr': 'Contact', 'de': 'Kontakt' },
    'Industry Report 2026': { 'zh-CN': '行业报告 2026', 'es': 'Informe de la Industria 2026', 'fr': 'Rapport Sectoriel 2026', 'de': 'Branchenbericht 2026' },

    // --- Mobile nav ---
    '🏠 Home': { 'zh-CN': '🏠 首页', 'es': '🏠 Inicio', 'fr': '🏠 Accueil', 'de': '🏠 Start' },
    '🎮 Products': { 'zh-CN': '🎮 产品', 'es': '🎮 Productos', 'fr': '🎮 Produits', 'de': '🎮 Produkte' },
    '📰 News & Articles': { 'zh-CN': '📰 资讯与文章', 'es': '📰 Noticias y Artículos', 'fr': '📰 Actualités et Articles', 'de': '📰 Neuigkeiten & Artikel' },
    '🏭 Suppliers': { 'zh-CN': '🏭 供应商', 'es': '🏭 Proveedores', 'fr': '🏭 Fournisseurs', 'de': '🏭 Lieferanten' },
    '🎪 Exhibitions': { 'zh-CN': '🎪 展会', 'es': '🎪 Exposiciones', 'fr': '🎪 Salons', 'de': '🎪 Messen' },
    '💬 Forum': { 'zh-CN': '💬 论坛', 'es': '💬 Foro', 'fr': '💬 Forum', 'de': '💬 Forum' },
    '⭐ Points': { 'zh-CN': '⭐ 积分', 'es': '⭐ Puntos', 'fr': '⭐ Points', 'de': '⭐ Punkte' },
    '🎬 Videos': { 'zh-CN': '🎬 视频', 'es': '🎬 Vídeos', 'fr': '🎬 Vidéos', 'de': '🎬 Videos' },
    '📩 Contact': { 'zh-CN': '📩 联系', 'es': '📩 Contacto', 'fr': '📩 Contact', 'de': '📩 Kontakt' },

    // --- Search overlay ---
    '🔍 Search': { 'zh-CN': '🔍 搜索', 'es': '🔍 Buscar', 'fr': '🔍 Rechercher', 'de': '🔍 Suche' },
    'Search NexAmuse Global': { 'zh-CN': '搜索 NexAmuse 全球', 'es': 'Buscar NexAmuse Global', 'fr': 'Rechercher NexAmuse Global', 'de': 'NexAmuse Global durchsuchen' },
    'Search': { 'zh-CN': '搜索', 'es': 'Buscar', 'fr': 'Rechercher', 'de': 'Suche' },
    'Popular:': { 'zh-CN': '热门：', 'es': 'Popular：', 'fr': 'Populaires :', 'de': 'Beliebt:' },

    // --- Products dropdown ---
    'Arcade Machines': { 'zh-CN': '街机设备', 'es': 'Máquinas Arcade', 'fr': 'Bornes d’arcade', 'de': 'Arcade-Automaten' },
    'VR / XR Attractions': { 'zh-CN': 'VR / XR 游乐项目', 'es': 'Atracciones VR / XR', 'fr': 'Attractions VR / XR', 'de': 'VR / XR Attraktionen' },
    'Kids & Family Rides': { 'zh-CN': '儿童与家庭游乐', 'es': 'Atracciones Infantiles y Familiares', 'fr': 'Manèges Enfants & Famille', 'de': 'Kinder- & Familienfahrgeschäfte' },
    'Redemption & Prize': { 'zh-CN': '礼品兑奖设备', 'es': 'Redención y Premios', 'fr': 'Redemption & Lots', 'de': 'Gewinnspiel & Preise' },
    'Simulation Rides': { 'zh-CN': '模拟体验设备', 'es': 'Simuladores', 'fr': 'Simulateurs', 'de': 'Simulationsfahrgeschäfte' },
    'Outdoor Attractions': { 'zh-CN': '户外游乐设施', 'es': 'Atracciones al Aire Libre', 'fr': 'Attractions Extérieures', 'de': 'Outdoor-Attraktionen' },
    'Water Park Equipment': { 'zh-CN': '水上乐园设备', 'es': 'Equipo de Parque Acuático', 'fr': 'Équipements de Parc Aquatique', 'de': 'Wasserpark-Ausrüstung' },
    'Accessories & Parts': { 'zh-CN': '配件与零件', 'es': 'Accesorios y Repuestos', 'fr': 'Accessoires & Pièces', 'de': 'Zubehör & Ersatzteile' },

    // --- News dropdown ---
    'Industry Dynamics': { 'zh-CN': '行业动态', 'es': 'Dinámica de la Industria', 'fr': 'Dynamique Sectorielle', 'de': 'Branchenentwicklung' },
    'Company News': { 'zh-CN': '企业新闻', 'es': 'Noticias de Empresa', 'fr': 'Actualités des Entreprises', 'de': 'Unternehmensnachrichten' },
    'Executive Interviews': { 'zh-CN': '高管访谈', 'es': 'Entrevistas Ejecutivas', 'fr': 'Interviews de Dirigeants', 'de': 'Führungsinterviews' },
    'New Product Releases': { 'zh-CN': '新品发布', 'es': 'Nuevos Lanzamientos', 'fr': 'Nouveautés Produits', 'de': 'Neue Produkteinführungen' },
    'Regulations & Compliance': { 'zh-CN': '法规与合规', 'es': 'Normativas y Cumplimiento', 'fr': 'Réglementations & Conformité', 'de': 'Vorschriften & Compliance' },

    // --- Exhibitions dropdown ---
    'Exhibition Calendar': { 'zh-CN': '展会日历', 'es': 'Calendario de Ferias', 'fr': 'Calendrier des Salons', 'de': 'Messeterminplan' },
    'Show Reports': { 'zh-CN': '展会报道', 'es': 'Reportes de Ferias', 'fr': 'Comptes Rendus de Salons', 'de': 'Messberichte' },
    'Pre-Register': { 'zh-CN': '预登记', 'es': 'Pre-Registro', 'fr': 'Pré-Inscription', 'de': 'Voranmeldung' },

    // --- Footer ---
    'Resources': { 'zh-CN': '资源', 'es': 'Recursos', 'fr': 'Ressources', 'de': 'Ressourcen' },
    'Company': { 'zh-CN': '公司', 'es': 'Empresa', 'fr': 'Entreprise', 'de': 'Unternehmen' },
    'Interviews': { 'zh-CN': '访谈', 'es': 'Entrevistas', 'fr': 'Interviews', 'de': 'Interviews' },
    'Regulations': { 'zh-CN': '法规', 'es': 'Normativas', 'fr': 'Réglementations', 'de': 'Vorschriften' },
    'About Us': { 'zh-CN': '关于我们', 'es': 'Acerca de Nosotros', 'fr': 'À Propos de Nous', 'de': 'Über Uns' },
    'Privacy Policy': { 'zh-CN': '隐私政策', 'es': 'Política de Privacidad', 'fr': 'Politique de Confidentialité', 'de': 'Datenschutz' },
    '© 2026 NexAmuse Global. All rights reserved.': { 'zh-CN': '© 2026 NexAmuse Global. 版权所有。', 'es': '© 2026 NexAmuse Global. Todos los derechos reservados.', 'fr': '© 2026 NexAmuse Global. Tous droits réservés.', 'de': '© 2026 NexAmuse Global. Alle Rechte vorbehalten.' },

    // --- Auth / account (injected by main.js) ---
    'Login': { 'zh-CN': '登录', 'es': 'Iniciar Sesión', 'fr': 'Se Connecter', 'de': 'Anmelden' },
    'Register': { 'zh-CN': '注册', 'es': 'Registrarse', 'fr': 'S’inscrire', 'de': 'Registrieren' },
    '🛠️ Admin Dashboard': { 'zh-CN': '🛠️ 管理控制台', 'es': '🛠️ Panel de Administración', 'fr': '🛠️ Tableau de Bord Admin', 'de': '🛠️ Admin-Dashboard' },
    '🚪 Sign Out': { 'zh-CN': '🚪 退出登录', 'es': '🚪 Cerrar Sesión', 'fr': '🚪 Se Déconnecter', 'de': '🚪 Abmelden' },
    '🔑 Login': { 'zh-CN': '🔑 登录', 'es': '🔑 Iniciar Sesión', 'fr': '🔑 Se Connecter', 'de': '🔑 Anmelden' },
    '✨ Register Free': { 'zh-CN': '✨ 免费注册', 'es': '✨ Registro Gratis', 'fr': '✨ Inscription Gratuite', 'de': '✨ Kostenlos Registrieren' },

    // --- Common UI verbs ---
    'Read More': { 'zh-CN': '阅读更多', 'es': 'Leer Más', 'fr': 'Lire la Suite', 'de': 'Mehr Lesen' },
    'View All': { 'zh-CN': '查看全部', 'es': 'Ver Todo', 'fr': 'Voir Tout', 'de': 'Alle Anzeigen' },
    'Load More': { 'zh-CN': '加载更多', 'es': 'Cargar Más', 'fr': 'Charger Plus', 'de': 'Mehr Laden' }
  };

  var STORAGE_KEY = 'nexamuse_lang';
  var current = localStorage.getItem(STORAGE_KEY) || 'en';

  function translateEl(el) {
    var txt = el.textContent.trim();
    if (!txt || !(txt in DICT)) return;
    if (!el.__i18nOrig) el.__i18nOrig = el.textContent;
    var t = DICT[txt][current];
    el.textContent = (current === 'en' || !t) ? el.__i18nOrig : t;
  }

  function scan() {
    var sel = '.navbar a, .mobile-menu a, .top-bar a, footer a, footer h4, ' +
      '.search-overlay h2, .search-overlay .search-suggestions p, .search-overlay .suggestion-tag, ' +
      '.breadcrumb a, .nav-actions button, .nav-actions a, .mobile-auth-wrap a, .mobile-auth-wrap button';
    var nodes = document.querySelectorAll(sel);
    for (var i = 0; i < nodes.length; i++) translateEl(nodes[i]);
  }

  function applyHtmlLang() {
    document.documentElement.setAttribute('lang', current === 'zh-CN' ? 'zh-CN' : current);
  }

  // --- Build switcher UI ---
  var root = document.createElement('div');
  root.id = 'langSwitcher';

  var toggle = document.createElement('button');
  toggle.className = 'ls-toggle';
  toggle.setAttribute('aria-label', 'Select language');
  toggle.innerHTML = '<span class="ls-flag"></span><span class="ls-caret">▼</span>';

  var menu = document.createElement('div');
  menu.className = 'ls-menu';
  menu.hidden = true;
  menu.innerHTML = '<div class="ls-title">Language</div>';

  LANGS.forEach(function (l) {
    var item = document.createElement('button');
    item.className = 'ls-item' + (l.code === current ? ' active' : '');
    item.setAttribute('data-lang', l.code);
    item.innerHTML = '<span class="ls-flag">' + l.flag + '</span><span>' + l.label + '</span><span class="ls-check">✓</span>';
    item.addEventListener('click', function () {
      setLang(l.code);
      menu.hidden = true;
    });
    menu.appendChild(item);
  });

  function setFlag() {
    var f = (LANGS.filter(function (l) { return l.code === current; })[0] || LANGS[1]).flag;
    toggle.querySelector('.ls-flag').textContent = f;
  }

  function setLang(code) {
    current = code;
    localStorage.setItem(STORAGE_KEY, code);
    applyHtmlLang();
    setFlag();
    var items = menu.querySelectorAll('.ls-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', items[i].getAttribute('data-lang') === code);
    }
    scan();
  }

  toggle.addEventListener('click', function (e) {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener('click', function () { menu.hidden = true; });

  root.appendChild(toggle);
  root.appendChild(menu);
  document.body.appendChild(root);

  setFlag();
  applyHtmlLang();
  scan();

  // Re-translate dynamically injected nodes (e.g. login/sign-out nav rendered by main.js)
  if (window.MutationObserver) {
    var debounce;
    var obs = new MutationObserver(function () {
      clearTimeout(debounce);
      debounce = setTimeout(scan, 250);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }
})();
