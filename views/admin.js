const { escapeHtml } = require('../helpers/html');
const { renderFlashMessages } = require('../helpers/flash');
const { ensureStoreSettings } = require('../services/db');
const { renderHtmlShell } = require('./shell');

const adminStyles = `
  .admin-shell { background:#f8fafc; }
  .topbar { position:fixed; top:0; left:0; right:0; height:56px; padding:0 18px; background:#fff; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; justify-content:space-between; z-index:50; }
  .topbar-left { display:flex; align-items:center; gap:14px; }
  .topbar-store { display:flex; flex-direction:column; }
  .topbar-name { font-weight:800; font-size:16px; }
  .topbar-sub { font-size:12px; color:var(--muted); }
  .topbar-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .topbar-pill { display:inline-flex; align-items:center; gap:8px; padding:9px 12px; border:1px solid var(--border); border-radius:999px; background:#fff; font-size:13px; }
  .topbar-dot { width:8px; height:8px; border-radius:50%; background:var(--success); }
  .hamburger { display:none; width:40px; height:40px; border:0; border-radius:10px; background:transparent; cursor:pointer; flex-direction:column; align-items:center; justify-content:center; gap:5px; padding:8px; margin-left:4px; }
  .hamburger span { display:block; width:20px; height:2px; border-radius:999px; background:#0f172a; transition:transform .25s ease, opacity .25s ease; }
  .hamburger:hover { background:#f1f5f9; }
  .sidebar-overlay { position:fixed; inset:0; background:rgba(15,23,42,.45); z-index:51; backdrop-filter:blur(4px); opacity:0; transition:opacity .3s ease; pointer-events:none; }
  .sidebar { position:fixed; top:56px; left:0; width:240px; height:calc(100vh - 56px); background:#fff; color:var(--text); border-right:1px solid #e2e8f0; padding:16px 12px; overflow-y:auto; z-index:44; transition:transform .3s cubic-bezier(.4,0,.2,1), box-shadow .3s ease; }
  .sidebar .nav-section { margin-bottom:16px; }
  .nav-section-title { padding:10px 12px 6px; font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#94a3b8; font-weight:800; }
  .sidebar .nav-link { color:#475569; border-radius:12px; margin-bottom:4px; display:flex !important; align-items:center; gap:10px; justify-content:flex-start; min-width:0; padding:11px 14px; transition:background-color .16s ease, color .16s ease; }
  .sidebar .nav-link:hover, .sidebar .nav-link.active { background:#eef2ff; color:#3b5bfd; }
  .sidebar .nav-link.active { font-weight:800; }
  .nav-icon { width:18px; display:inline-flex; justify-content:center; color:#64748b; font-size:18px; }
  .nav-label { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .nav-badge { min-width:24px; height:24px; border-radius:999px; background:#ef4444; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; padding:0 7px; }
  .main { margin-left:240px; padding:78px 24px 24px; }
  .content-wrap { display:grid; gap:16px; }
  .page-header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; flex-wrap:wrap; }
  .page-title { margin:0; font-size:28px; font-weight:800; }
  .page-subtitle { margin:6px 0 0; color:var(--muted); }
  .hero-grid { display:grid; grid-template-columns:1.3fr .9fr; gap:16px; }
  .hero-card { padding:20px 22px; position:relative; overflow:hidden; border:1px solid #dbe3ef; box-shadow:none; }
  .hero-card::before { content:''; position:absolute; inset:-40% auto auto -20%; width:260px; height:260px; background:radial-gradient(circle, rgba(59,91,253,.08), transparent 68%); pointer-events:none; }
  .hero-meta { display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; }
  .mini-grid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:16px; }
  .mini-card { padding:18px; }
  .metric-card { padding:18px; border:1px solid #dbe3ef; box-shadow:none; display:grid; grid-template-columns:auto 1fr; gap:12px; align-items:center; }
  .metric-icon { width:34px; height:34px; border-radius:10px; display:grid; place-items:center; background:#eef2ff; color:#3b5bfd; font-size:18px; }
  .metric-label { color:#64748b; font-size:13px; font-weight:500; }
  .metric-value { margin-top:2px; font-size:18px; font-weight:700; color:#0f172a; }
  .mini-title { color:var(--muted); font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; }
  .mini-number { margin-top:10px; font-size:32px; font-weight:900; }
  .setup-list { display:grid; gap:12px; }
  .setup-item { display:flex; align-items:flex-start; gap:12px; padding:12px 0; border-bottom:1px solid #e2e8f0; }
  .setup-check { width:22px; height:22px; border-radius:50%; display:grid; place-items:center; background:#e2e8f0; color:#64748b; font-size:13px; flex:0 0 auto; }
  .setup-check.done { background:rgba(16,185,129,.14); color:#059669; }
  .setup-title { font-weight:800; }
  .setup-hint { color:var(--muted); font-size:13px; }
  .section-head { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:10px; }
  .data-strip { display:grid; gap:14px; grid-template-columns:repeat(3, minmax(0,1fr)); }
  .data-chip { padding:14px 16px; border-radius:16px; background:#fff; border:1px solid #dbe3ef; }
  .data-chip-label { color:var(--muted); font-size:13px; font-weight:700; }
  .data-chip-value { margin-top:8px; font-size:20px; font-weight:900; }
  .option-grid { display:grid; gap:14px; grid-template-columns:repeat(3, minmax(0,1fr)); }
  .option-card { position:relative; padding:14px; border-radius:18px; border:1px solid #dbe3ef; background:#fff; text-decoration:none; color:inherit; }
  .option-card.active { border:2px solid #111827; background:#f8fafc; }
  .option-card-preview { height:46px; border-radius:14px; border:1px solid #e2e8f0; background:linear-gradient(180deg,#fff,#f8fafc); margin-bottom:10px; display:flex; align-items:center; justify-content:center; gap:14px; color:#64748b; font-size:12px; }
  .option-card-title { font-weight:800; font-size:14px; margin-bottom:3px; }
  .option-card-sub { color:var(--muted); font-size:12px; }
  .option-card-check { position:absolute; top:10px; right:10px; width:22px; height:22px; border-radius:50%; background:#111827; color:#fff; display:grid; place-items:center; font-size:12px; }
  .option-grid-4 { display:grid; gap:14px; grid-template-columns:repeat(4, minmax(0,1fr)); }
  .mini-bar-row { display:grid; grid-template-columns:130px 1fr 56px; gap:12px; align-items:center; margin-bottom:10px; }
  .mini-bar-label, .mini-bar-value { font-size:13px; color:#334155; }
  .mini-bar-track { height:10px; background:#e5e7eb; border-radius:999px; overflow:hidden; }
  .mini-bar-fill { height:100%; border-radius:999px; }
  .split-grid { display:grid; gap:16px; grid-template-columns:1.1fr .9fr; }
  .stacked { display:grid; gap:16px; }
  .action-bar { display:flex; gap:10px; flex-wrap:wrap; }
  .action-bar .btn, .action-bar .btn-secondary { min-height:38px; padding:10px 14px; }
  .title-row { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
  .section-muted { color:var(--muted); font-size:14px; }
  .card, .btn, .btn-secondary, .nav-link, .data-chip, .mini-card, .stat-card, .template-card, .topbar-pill, .flash { transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease, background-color .18s ease, color .18s ease; }
  .card:hover, .data-chip:hover, .mini-card:hover, .metric-card:hover, .stat-card:hover, .template-card:hover { transform:translateY(-1px); box-shadow:0 12px 28px rgba(15,23,42,.06); }
  .flash { animation:fadeUp .28s ease both; }
  .card, .stat-card, .mini-card, .metric-card, .data-chip, .template-card { animation:fadeUp .32s ease both; }
  .btn:hover, .btn-secondary:hover { transform:translateY(-1px); }
  .btn:active, .btn-secondary:active, .nav-link:active { transform:translateY(0); }
  @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation:none !important; transition:none !important; scroll-behavior:auto !important; } }
  @media (max-width: 1100px) { .hero-grid, .split-grid, .data-strip, .mini-grid, .option-grid { grid-template-columns:1fr; } }
  @media (max-width: 820px) {
    .hamburger { display:flex; }
    .sidebar { top:0; left:0; width:280px; height:100vh; transform:translateX(-100%); z-index:52; box-shadow:none; padding-top:20px; }
    body.sidebar-open .sidebar { transform:translateX(0); box-shadow:8px 0 30px rgba(0,0,0,.15); }
    body.sidebar-open .sidebar-overlay { opacity:1; pointer-events:auto; }
    body.sidebar-open .hamburger span:nth-child(1) { transform:rotate(45deg) translate(5px,5px); }
    body.sidebar-open .hamburger span:nth-child(2) { opacity:0; }
    body.sidebar-open .hamburger span:nth-child(3) { transform:rotate(-45deg) translate(5px,-5px); }
    .main { margin-left:0; padding:68px 16px 100px; }
    .content-wrap { gap:14px; }
    .page-title { font-size:22px; }
    .hero-grid { grid-template-columns:1fr; }
    .mini-grid { grid-template-columns:repeat(2,1fr); gap:12px; }
    .metric-card { padding:14px; }
    .data-strip { grid-template-columns:1fr; gap:10px; }
    .topbar-actions { display:none; }
    .mobile-nav { display:flex !important; }
    .panel { padding:18px; }
    .action-bar { gap:8px; }
    .action-bar .btn, .action-bar .btn-secondary { min-height:36px; padding:8px 12px; font-size:13px; }
    table { font-size:13px; }
    th, td { padding:10px 8px; }
    .brand { font-size:16px; }
    .topbar-sub { display:none; }
    .topbar-store { gap:0; }
    .topbar-name { font-size:14px; }
    .topbar-pill { font-size:12px; padding:6px 10px; }
    .option-grid { grid-template-columns:1fr; }
    .option-grid-4 { grid-template-columns:repeat(2, minmax(0,1fr)); }
    .option-card { padding:12px; border-radius:16px; }
    .option-card-title { font-size:13px; }
    .option-card-sub { font-size:11px; }
    .option-card-preview { height:52px; }
  }
  .mobile-nav { display:none; position:fixed; bottom:0; left:0; right:0; height:64px; background:#fff; border-top:1px solid #e2e8f0; z-index:60; justify-content:space-around; align-items:center; padding:0 4px; box-shadow:0 -4px 20px rgba(0,0,0,.06); }
  .mobile-nav a { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; padding:8px 0; min-width:60px; color:#94a3b8; font-size:10px; font-weight:600; border-radius:12px; transition:color .2s ease, background-color .2s ease; text-decoration:none; }
  .mobile-nav a.active { color:#3b5bfd; background:#eef2ff; }
  .mobile-nav a:hover { background:#f1f5f9; }
  .nav-svg { width:22px; height:22px; stroke-width:1.8; flex-shrink:0; }
  `;

function renderAdminLayout(req, title, activeKey, content, extraStylesOverride) {
  const store = req.currentStore;
  const flash = renderFlashMessages(req);
  const pageExtraStyles = extraStylesOverride || '';
  const pendingOrderCount = store && store.orders ? store.orders.filter((o) => o.status === 'pending').length : 0;
  const items = [
    { section: 'Overview', key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: '▦' },
    { section: 'Overview', key: 'analytics', label: 'Analytics', href: '/dashboard/analytics', icon: '⌁' },
    { section: 'Overview', key: 'system-status', label: 'System Status', href: '/dashboard/system-status', icon: '◉' },
    { section: 'Catalog', key: 'products', label: 'Products', href: '/dashboard/products', icon: '◫' },
    { section: 'Catalog', key: 'categories', label: 'Categories', href: '/dashboard/categories', icon: '◳' },
    { section: 'Catalog', key: 'media', label: 'Media Library', href: '/dashboard/media', icon: '◴' },
    { section: 'Catalog', key: 'bulk-upload', label: 'Bulk Upload', href: '/dashboard/bulk-upload', icon: '⇪' },
    { section: 'Sales & Customers', key: 'orders', label: 'Orders', href: '/dashboard/orders', icon: '⟡' },
    { section: 'Sales & Customers', key: 'customers', label: 'Customers', href: '/dashboard/customers', icon: '◔' },
    { section: 'Sales & Customers', key: 'leads', label: 'Leads', href: '/dashboard/leads', icon: '◌' },
    { section: 'Sales & Customers', key: 'abandoned', label: 'Abandoned Carts', href: '/dashboard/abandoned-carts', icon: '⌂' },
    { section: 'Payments & Shipping', key: 'payments', label: 'Payments', href: '/dashboard/payments', icon: '₪' },
    { section: 'Payments & Shipping', key: 'coupons', label: 'Coupons', href: '/dashboard/coupons', icon: '✦' },
    { section: 'Payments & Shipping', key: 'shipping', label: 'Shipping', href: '/dashboard/shipping', icon: '⇄' },
    { section: 'Payments & Shipping', key: 'tax', label: 'Tax / GST', href: '/dashboard/tax', icon: '₹' },
    { section: 'Marketing', key: 'whatsapp-marketing', label: 'WhatsApp Marketing', href: '/dashboard/whatsapp-marketing', icon: '◎' },
    { section: 'Marketing', key: 'tracking', label: 'Tracking & Analytics', href: '/dashboard/tracking', icon: '▣' },
    { section: 'Marketing', key: 'apps', label: 'App Store', href: '/dashboard/apps', icon: '◫' },
    { section: 'Appearance & Settings', key: 'theme', label: 'Themes', href: '/dashboard/theme', icon: '◐' },
    { section: 'Appearance & Settings', key: 'display-settings', label: 'Display Settings', href: '/dashboard/display-settings', icon: '▥' },
    { section: 'Appearance & Settings', key: 'pages', label: 'Store Pages', href: '/dashboard/pages', icon: '▤' },
    { section: 'Appearance & Settings', key: 'domain', label: 'Domain', href: '/dashboard/domain', icon: '◈' },
    { section: 'Appearance & Settings', key: 'settings', label: 'Store Settings', href: '/dashboard/settings?section=store-details', icon: '⚙' },
    { section: 'Account', key: 'store', label: 'View Store', href: `/store/${store.slug}`, icon: '↗' },
    { section: 'Account', key: 'logout', label: 'Sign out', href: '/logout', icon: '⎋' }
  ];
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});
  const sidebar = Object.entries(grouped).map(([section, links]) => `
    <div class="nav-section">
      <div class="nav-section-title">${escapeHtml(section)}</div>
      ${links.map((item) => {
        const active = activeKey === item.key ? 'active' : '';
        const target = item.key === 'store' ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a class="nav-link ${active}" href="${escapeHtml(item.href)}"${target}><span class="nav-icon">${escapeHtml(item.icon || '•')}</span><span class="nav-label">${escapeHtml(item.label)}</span>${item.key === 'orders' && pendingOrderCount > 0 ? `<span class="nav-badge">${escapeHtml(String(pendingOrderCount))}</span>` : ''}</a>`;
      }).join('')}
    </div>
  `).join('');
  return renderHtmlShell(title, `
<div class="topbar">
  <div class="topbar-left">
    <button class="hamburger" onclick="document.body.classList.toggle('sidebar-open')" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
    <div class="brand"><strong>MyShop</strong>Builder</div>
    <div class="topbar-store">
      <div class="topbar-name">${escapeHtml(store.name)}</div>
      <div class="topbar-sub">/${escapeHtml(store.slug)} · ${escapeHtml(req.currentUser.email)}</div>
    </div>
  </div>
  <div class="topbar-actions">
    <span class="topbar-pill"><span class="topbar-dot"></span> Live store</span>
    <a class="btn btn-secondary" href="/dashboard/analytics">Purge Cache</a>
    <a class="btn btn-secondary" href="/store/${escapeHtml(store.slug)}" target="_blank" rel="noopener noreferrer">View store</a>
  </div>
</div>
<div class="sidebar-overlay" onclick="document.body.classList.remove('sidebar-open')"></div>
<nav class="sidebar">${sidebar}</nav>
<main class="main admin-shell">${flash}<div class="content-wrap">${content}</div></main>
<nav class="mobile-nav">
  <a href="/dashboard"${activeKey === 'dashboard' ? ' class="active"' : ''}><svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><span>Home</span></a>
  <a href="/dashboard/orders"${activeKey === 'orders' ? ' class="active"' : ''}><svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg><span>Orders</span></a>
  <a href="/dashboard/products"${activeKey === 'products' ? ' class="active"' : ''}><svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg><span>Products</span></a>
  <a href="/dashboard/categories"${activeKey === 'categories' ? ' class="active"' : ''}><svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><span>Categories</span></a>
  <a href="/dashboard/apps"${activeKey === 'apps' ? ' class="active"' : ''}><svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg><span>Apps</span></a>
</nav>`, { extraStyles: adminStyles + pageExtraStyles });
}

const DISPLAY_SETTINGS_SECTIONS = [
  { id: 'announcement', label: 'Announcement', icon: '📣' },
  { id: 'header', label: 'Header', icon: 'H' },
  { id: 'menu', label: 'Menu', icon: '≡' },
  { id: 'banner', label: 'Banner', icon: '🖼' },
  { id: 'categories', label: 'Categories', icon: '▦' },
  { id: 'products', label: 'Products', icon: '◫' },
  { id: 'footer', label: 'Footer', icon: '▭' },
  { id: 'product-card', label: 'Product Card', icon: '◨' },
  { id: 'product-page', label: 'Product Page', icon: '📄' },
  { id: 'color-font', label: 'Color & Font', icon: '🎨' },
  { id: 'custom-css', label: 'Custom CSS', icon: '</>' }
];

const STORE_SETTINGS_SECTIONS = [
  { id: 'store-details', label: 'Store Details', icon: '🏪' },
  { id: 'store-domain', label: 'Store Domain', icon: '🌐' },
  { id: 'products-settings', label: 'Products Settings', icon: '📦' },
  { id: 'checkout-settings', label: 'Checkout Settings', icon: '🛒' },
  { id: 'delivery-settings', label: 'Delivery Settings', icon: '🚚' },
  { id: 'payment-settings', label: 'Payment Settings', icon: '💳' },
  { id: 'order-settings', label: 'Order Settings', icon: '👜' },
  { id: 'return-order-settings', label: 'Return Order Settings', icon: '↺' },
  { id: 'label-settings', label: 'Label Settings', icon: '🏷' },
  { id: 'seo-settings', label: 'SEO Settings', icon: '🔎' },
  { id: 'llm-settings', label: 'LLM Settings', icon: '🤖' },
  { id: 'notifications-settings', label: 'Notifications Settings', icon: '🔔' },
  { id: 'login-settings', label: 'Login Settings', icon: '↪' },
  { id: 'url-redirects', label: 'URL Redirects', icon: '↗' },
  { id: 'robots-txt', label: 'Robots TXT', icon: '🧰' },
  { id: 'policies', label: 'Policies', icon: '📄' },
  { id: 'about-us', label: 'About Us', icon: '✉' }
];

function sanitizeThemeField(value, maxLen) {
  const limit = Number(maxLen || 0) || 200;
  return String(value || '').trim().slice(0, limit);
}

function checkboxValue(req, key) {
  return req.body[key] === 'on' || req.body[key] === 'true';
}

function pickDisplaySection(section) {
  const safe = String(section || '').trim().toLowerCase();
  return DISPLAY_SETTINGS_SECTIONS.some((item) => item.id === safe) ? safe : 'announcement';
}

function pickStoreSettingsSection(section) {
  const safe = String(section || '').trim().toLowerCase();
  return STORE_SETTINGS_SECTIONS.some((item) => item.id === safe) ? safe : 'store-details';
}

function getDashboardReturnTo(req, fallback) {
  const raw = String((req.body && req.body.returnTo) || req.query.returnTo || req.get('referer') || '').trim();
  return raw.startsWith('/dashboard') ? raw : fallback;
}

const onlineStoreAdminStyles = `
  body { background:#eff2f7; }
  .osa-shell { min-height:100vh; background:#eff2f7; }
  .osa-sidebar { position:fixed; inset:0 auto 0 0; width:318px; background:#0d1a4f; color:#d8e0ff; padding:16px 14px 18px; display:grid; grid-template-rows:auto 1fr auto; gap:18px; z-index:35; }
  .osa-brand { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:2px 6px 10px; }
  .osa-brand-mark { display:flex; align-items:center; gap:12px; font-size:17px; font-weight:800; letter-spacing:-.03em; color:#fff; }
  .osa-brand-logo { width:32px; height:32px; border-radius:12px; background:linear-gradient(135deg,#fff,#c9d4ff); color:#0d1a4f; display:grid; place-items:center; font-weight:900; }
  .osa-brand-toggle { width:32px; height:32px; border-radius:12px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06); color:#fff; display:grid; place-items:center; font-weight:900; }
  .osa-nav { overflow:auto; padding-right:4px; }
  .osa-nav-group { display:grid; gap:6px; }
  .osa-link, .osa-parent { display:flex; align-items:center; gap:12px; min-height:54px; padding:0 18px; border-radius:16px; color:#d8e0ff; transition:background-color .16s ease, color .16s ease, border-color .16s ease; }
  .osa-link:hover, .osa-parent:hover { background:rgba(255,255,255,.06); color:#fff; }
  .osa-parent.active { background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.14); color:#fff; }
  .osa-link-icon, .osa-parent-icon { width:26px; text-align:center; font-size:18px; opacity:.95; flex:0 0 26px; }
  .osa-link-label, .osa-parent-label { flex:1; min-width:0; font-size:15px; font-weight:600; }
  .osa-parent-arrow { font-size:14px; }
  .osa-subnav { margin:4px 0 12px 42px; padding-left:16px; border-left:1px solid rgba(255,255,255,.16); display:grid; gap:4px; }
  .osa-subnav a { color:#c8d2fb; padding:8px 0; font-size:15px; font-weight:500; }
  .osa-subnav a.active { color:#fff; font-weight:800; }
  .osa-wallet { border-radius:16px; background:rgba(255,255,255,.10); padding:14px 16px; color:#fff; font-size:15px; font-weight:700; display:flex; align-items:center; gap:10px; }
  .osa-wallet b { color:#20dc73; font-size:18px; }
  .osa-topbar { position:fixed; top:0; left:318px; right:0; height:76px; background:rgba(255,255,255,.88); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border-bottom:1px solid #e5e7eb; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:0 24px; z-index:30; }
  .osa-topbar-right { display:flex; align-items:center; gap:14px; }
  .osa-plan-btn { min-height:44px; padding:0 22px; border-radius:999px; background:#1f4ff0; color:#fff; font-weight:800; display:inline-flex; align-items:center; justify-content:center; box-shadow:0 12px 24px rgba(31,79,240,.16); }
  .osa-store-chip { display:flex; align-items:center; gap:10px; min-height:48px; padding:0 14px; border-radius:14px; border:1px solid #dbe0ea; background:#fff; color:#111827; font-weight:700; }
  .osa-store-chip small { color:#64748b; font-weight:600; }
  .osa-avatar, .osa-bell { width:42px; height:42px; border-radius:50%; background:#fff; border:1px solid #dbe0ea; display:grid; place-items:center; color:#111827; }
  .osa-bell { position:relative; }
  .osa-bell::after { content:''; position:absolute; top:9px; right:10px; width:8px; height:8px; border-radius:50%; background:#ef4444; }
  .osa-main { margin-left:318px; padding:108px 28px 34px; }
  .osa-content { display:grid; gap:18px; }
  .osa-page-head { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; }
  .osa-page-head h1 { margin:0; font-size:42px; line-height:1; letter-spacing:-.05em; }
  .osa-page-head p { margin:10px 0 0; color:#64748b; max-width:60ch; line-height:1.65; }
  .osa-card { background:#fff; border:1px solid #e5e7eb; border-radius:24px; box-shadow:0 8px 26px rgba(15,23,42,.06); }
  .osa-page-card { padding:20px; }
  .osa-settings-layout { display:grid; grid-template-columns:320px minmax(0, 1fr); gap:24px; align-items:start; }
  .osa-section-nav { padding:12px; position:sticky; top:96px; }
  .osa-section-link { display:flex; align-items:center; gap:14px; min-height:52px; padding:0 14px; border-radius:14px; color:#475569; font-size:15px; font-weight:600; }
  .osa-section-link:hover { background:#f6f8fd; color:#111827; }
  .osa-section-link.active { background:#eef2ff; color:#1f4ff0; font-weight:800; }
  .osa-section-icon { width:34px; text-align:center; font-size:19px; color:inherit; flex:0 0 34px; }
  .osa-form-panel { padding:28px; }
  .osa-form-head h2 { margin:0; font-size:22px; letter-spacing:-.03em; }
  .osa-form-head p { margin:8px 0 0; color:#64748b; line-height:1.65; }
  .osa-block { margin-top:18px; padding:18px; border:1px solid #edf0f5; border-radius:20px; background:#fcfdff; }
  .osa-block + .osa-block { margin-top:14px; }
  .osa-block h3 { margin:0 0 10px; font-size:18px; letter-spacing:-.03em; }
  .osa-block-note { margin:8px 0 0; color:#64748b; font-size:14px; line-height:1.6; }
  .osa-form-grid { display:grid; gap:16px; }
  .osa-form-grid.two { grid-template-columns:repeat(2, minmax(0, 1fr)); }
  .osa-field { display:grid; gap:8px; }
  .osa-field label { font-size:14px; font-weight:700; color:#0f172a; }
  .osa-field input, .osa-field textarea, .osa-field select { width:100%; border:1px solid #d7dde8; border-radius:14px; background:#fff; padding:12px 14px; outline:none; }
  .osa-field textarea { min-height:94px; resize:vertical; }
  .osa-field input:focus, .osa-field textarea:focus, .osa-field select:focus { border-color:#1f4ff0; box-shadow:0 0 0 4px rgba(31,79,240,.10); }
  .osa-toggle-row { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; padding:18px; border:1px solid #edf0f5; border-radius:20px; background:#fff; }
  .osa-toggle-copy strong { display:block; font-size:18px; letter-spacing:-.02em; }
  .osa-toggle-copy span { display:block; margin-top:6px; color:#64748b; line-height:1.6; }
  .osa-switch { position:relative; width:46px; height:28px; flex:0 0 auto; }
  .osa-switch input { position:absolute; inset:0; opacity:0; margin:0; cursor:pointer; }
  .osa-switch-ui { position:absolute; inset:0; border-radius:999px; background:#d1d5db; transition:background-color .18s ease; }
  .osa-switch-ui::after { content:''; position:absolute; top:3px; left:3px; width:22px; height:22px; border-radius:50%; background:#fff; box-shadow:0 2px 8px rgba(15,23,42,.18); transition:transform .18s ease; }
  .osa-switch input:checked + .osa-switch-ui { background:#1f4ff0; }
  .osa-switch input:checked + .osa-switch-ui::after { transform:translateX(18px); }
  .osa-actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:18px; }
  .osa-btn { display:inline-flex; align-items:center; justify-content:center; min-height:48px; padding:0 22px; border-radius:999px; border:1px solid #c7d2fe; background:#1f4ff0; color:#fff; font-weight:800; cursor:pointer; box-shadow:0 14px 24px rgba(31,79,240,.14); }
  .osa-btn.secondary { background:#fff; color:#1f4ff0; box-shadow:none; }
  .osa-chip { display:inline-flex; align-items:center; gap:8px; padding:8px 12px; border-radius:999px; background:#fff4da; color:#b7791f; font-size:12px; font-weight:800; }
  .osa-theme-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:20px; }
  .osa-theme-card { padding:14px; display:grid; gap:14px; align-content:start; position:relative; }
  .osa-theme-card.active { border:2px solid #1f4ff0; }
  .osa-theme-check { position:absolute; top:14px; right:14px; width:30px; height:30px; border-radius:50%; background:#1f4ff0; color:#fff; display:grid; place-items:center; font-weight:900; }
  .osa-theme-media { position:relative; border-radius:18px; overflow:hidden; background:#f8fafc; border:1px solid #e8edf5; aspect-ratio:16 / 11; }
  .osa-theme-iframe { width:100%; height:100%; border:0; transform:scale(.8); transform-origin:top left; width:125%; height:125%; pointer-events:none; background:#fff; }
  .osa-theme-card h3 { margin:0; font-size:18px; letter-spacing:-.03em; }
  .osa-theme-card p { margin:6px 0 0; color:#64748b; line-height:1.55; min-height:48px; }
  .osa-theme-meta { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
  .osa-option-grid { display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); }
  .osa-option-card { position:relative; padding:16px; border:1px solid #dfe4ef; border-radius:18px; background:#fff; cursor:pointer; }
  .osa-option-card.active { border-color:#1f4ff0; box-shadow:0 0 0 3px rgba(31,79,240,.08); }
  .osa-option-card input { display:none; }
  .osa-option-card strong { display:block; font-size:15px; letter-spacing:-.02em; }
  .osa-option-card span { display:block; margin-top:6px; color:#64748b; font-size:13px; line-height:1.55; }
  .osa-preview-gallery { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }
  .osa-thumb { position:relative; width:128px; height:84px; border-radius:14px; overflow:hidden; border:1px solid #e2e8f0; background:#f8fafc; }
  .osa-thumb.mobile { width:86px; height:128px; }
  .osa-thumb img { width:100%; height:100%; object-fit:cover; }
  .osa-thumb form { position:absolute; top:6px; right:6px; }
  .osa-thumb button { width:24px; height:24px; border-radius:50%; border:0; background:rgba(239,68,68,.92); color:#fff; cursor:pointer; }
  .osa-iframe-wrap { border-radius:24px; overflow:hidden; border:1px solid #dbe2ea; background:#fff; box-shadow:0 22px 50px rgba(15,23,42,.08); }
  .osa-iframe-bar { display:flex; align-items:center; gap:8px; padding:12px 14px; background:#f8fafc; border-bottom:1px solid #e5e7eb; }
  .osa-iframe-bar span { width:10px; height:10px; border-radius:50%; }
  .osa-iframe-bar span:nth-child(1) { background:#ef4444; }
  .osa-iframe-bar span:nth-child(2) { background:#f59e0b; }
  .osa-iframe-bar span:nth-child(3) { background:#10b981; }
  .osa-iframe-bar b { margin-left:auto; color:#64748b; font-size:12px; }
  .osa-iframe { width:100%; height:720px; border:0; display:block; background:#fff; }
  @media (max-width: 1220px) {
    .osa-settings-layout, .osa-theme-grid { grid-template-columns:1fr; }
    .osa-section-nav { position:static; }
    .osa-form-grid.two { grid-template-columns:1fr; }
  }
  @media (max-width: 980px) {
    .osa-sidebar { transform:translateX(-100%); transition:transform .2s ease; }
    body.osa-nav-open .osa-sidebar { transform:translateX(0); }
    .osa-topbar, .osa-main { left:0; margin-left:0; }
    .osa-topbar { padding-left:18px; }
    .osa-main { padding:98px 16px 28px; }
    .osa-page-head { flex-direction:column; align-items:flex-start; }
    .osa-topbar-right { gap:10px; }
  }
`;

const storeAdminPanelStyles = `
  .osa-page-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; }
  .osa-page-head h1 { margin:0; font-size:38px; line-height:1; letter-spacing:-.04em; }
  .osa-page-head p { margin:10px 0 0; color:#64748b; max-width:62ch; line-height:1.65; }
  .osa-settings-layout { display:grid; grid-template-columns:300px minmax(0,1fr); gap:18px; align-items:start; }
  .osa-section-nav { position:sticky; top:84px; padding:12px; border-radius:22px; background:#fff; border:1px solid #dbe3ef; box-shadow:0 8px 24px rgba(15,23,42,.05); }
  .osa-section-link { display:flex; align-items:center; gap:12px; min-height:48px; padding:0 14px; border-radius:14px; color:#475569; font-weight:600; }
  .osa-section-link:hover { background:#f8fafc; color:#111827; }
  .osa-section-link.active { background:#eef2ff; color:#3b5bfd; font-weight:800; }
  .osa-section-icon { width:28px; text-align:center; font-size:18px; flex:0 0 28px; }
  .osa-page-card, .osa-form-panel, .osa-card { background:#fff; border:1px solid #dbe3ef; box-shadow:0 8px 24px rgba(15,23,42,.05); border-radius:22px; }
  .osa-page-card, .osa-form-panel { padding:24px; }
  .osa-form-panel h2, .osa-form-head h2 { margin:0; font-size:24px; letter-spacing:-.03em; }
  .osa-form-head p, .osa-form-panel p.lead { margin:8px 0 0; color:#64748b; line-height:1.65; }
  .osa-block { margin-top:18px; padding:18px; border:1px solid #e5edf7; border-radius:18px; background:#fff; }
  .osa-block h3 { margin:0 0 10px; font-size:18px; letter-spacing:-.02em; }
  .osa-block-note { margin:8px 0 0; color:#64748b; font-size:13px; line-height:1.6; }
  .osa-form-grid { display:grid; gap:16px; }
  .osa-form-grid.two { grid-template-columns:repeat(2, minmax(0,1fr)); }
  .osa-field { display:grid; gap:8px; }
  .osa-field label { font-size:14px; font-weight:700; color:#0f172a; }
  .osa-field input, .osa-field select, .osa-field textarea { width:100%; border:1px solid #d7dde8; border-radius:14px; background:#fff; padding:12px 14px; outline:none; }
  .osa-field textarea { min-height:96px; resize:vertical; }
  .osa-field input:focus, .osa-field select:focus, .osa-field textarea:focus { border-color:#3b5bfd; box-shadow:0 0 0 4px rgba(59,91,253,.10); }
  .osa-toggle-row { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; padding:18px; border:1px solid #e5edf7; border-radius:18px; background:#fff; }
  .osa-toggle-copy strong { display:block; font-size:18px; }
  .osa-toggle-copy span { display:block; margin-top:6px; color:#64748b; line-height:1.6; }
  .osa-switch { position:relative; width:46px; height:28px; flex:0 0 auto; }
  .osa-switch input { position:absolute; inset:0; opacity:0; margin:0; cursor:pointer; }
  .osa-switch-ui { position:absolute; inset:0; border-radius:999px; background:#d1d5db; transition:background-color .18s ease; }
  .osa-switch-ui::after { content:''; position:absolute; top:3px; left:3px; width:22px; height:22px; border-radius:50%; background:#fff; box-shadow:0 2px 8px rgba(15,23,42,.18); transition:transform .18s ease; }
  .osa-switch input:checked + .osa-switch-ui { background:#3b5bfd; }
  .osa-switch input:checked + .osa-switch-ui::after { transform:translateX(18px); }
  .osa-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:18px; }
  .osa-btn { display:inline-flex; align-items:center; justify-content:center; min-height:44px; padding:10px 18px; border-radius:999px; border:1px solid #c7d2fe; background:#3b5bfd; color:#fff; font-weight:800; cursor:pointer; box-shadow:0 12px 24px rgba(59,91,253,.14); }
  .osa-btn.secondary { background:#fff; color:#3b5bfd; box-shadow:none; }
  .osa-chip { display:inline-flex; align-items:center; gap:8px; padding:8px 12px; border-radius:999px; background:#fff4da; color:#b7791f; font-size:12px; font-weight:800; }
  .osa-theme-grid { display:grid; gap:18px; grid-template-columns:repeat(3, minmax(0,1fr)); }
  .osa-theme-card { position:relative; padding:14px; display:grid; gap:14px; }
  .osa-theme-card.active { border:2px solid #3b5bfd; }
  .osa-theme-check { position:absolute; top:14px; right:14px; width:28px; height:28px; border-radius:50%; background:#3b5bfd; color:#fff; display:grid; place-items:center; font-weight:900; }
  .osa-theme-media { border-radius:16px; overflow:hidden; border:1px solid #e5edf7; background:#f8fafc; aspect-ratio:16 / 11; }
  .osa-theme-iframe { border:0; width:125%; height:125%; transform:scale(.8); transform-origin:top left; pointer-events:none; background:#fff; }
  .osa-theme-card h3 { margin:0; font-size:18px; letter-spacing:-.02em; }
  .osa-theme-card p { margin:6px 0 0; color:#64748b; line-height:1.55; min-height:48px; }
  .osa-theme-meta { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
  .osa-option-grid { display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); }
  .osa-option-card { position:relative; padding:16px; border-radius:18px; border:1px solid #dbe3ef; background:#fff; cursor:pointer; }
  .osa-option-card.active { border-color:#3b5bfd; box-shadow:0 0 0 3px rgba(59,91,253,.08); }
  .osa-option-card input { display:none; }
  .osa-option-card strong { display:block; font-size:15px; }
  .osa-option-card span { display:block; margin-top:6px; color:#64748b; font-size:13px; line-height:1.55; }
  .osa-preview-gallery { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }
  .osa-thumb { position:relative; width:128px; height:84px; overflow:hidden; border-radius:14px; border:1px solid #e2e8f0; background:#f8fafc; }
  .osa-thumb.mobile { width:84px; height:128px; }
  .osa-thumb img { width:100%; height:100%; object-fit:cover; }
  .osa-thumb form { position:absolute; top:6px; right:6px; }
  .osa-thumb button { width:24px; height:24px; border-radius:50%; border:0; background:rgba(239,68,68,.92); color:#fff; cursor:pointer; }
  .osa-iframe-wrap { border-radius:22px; overflow:hidden; border:1px solid #dbe3ef; background:#fff; box-shadow:0 10px 28px rgba(15,23,42,.06); }
  .osa-iframe-bar { display:flex; align-items:center; gap:8px; padding:12px 14px; background:#f8fafc; border-bottom:1px solid #e2e8f0; }
  .osa-iframe-bar span { width:10px; height:10px; border-radius:50%; }
  .osa-iframe-bar span:nth-child(1){background:#ef4444}.osa-iframe-bar span:nth-child(2){background:#f59e0b}.osa-iframe-bar span:nth-child(3){background:#10b981}
  .osa-iframe-bar b { margin-left:auto; color:#64748b; font-size:12px; }
  .osa-iframe { width:100%; height:720px; border:0; display:block; }
  @media (max-width:1100px) {
    .osa-settings-layout, .osa-theme-grid { grid-template-columns:1fr; }
    .osa-section-nav { position:static; }
    .osa-form-grid.two { grid-template-columns:1fr; }
  }
`;

function renderOnlineStoreAdminLayout(req, title, activeKey, content) {
  const flash = renderFlashMessages(req);
  const store = req.currentStore;
  const onlineActive = ['settings', 'display-settings', 'theme', 'pages'].includes(activeKey);
  const secondaryLinks = [
    { key: 'settings', label: 'Store Settings', href: '/dashboard/settings?section=store-details' },
    { key: 'display-settings', label: 'Display Settings', href: '/dashboard/display-settings' },
    { key: 'theme', label: 'Themes', href: '/dashboard/theme' },
    { key: 'pages', label: 'Store Pages', href: '/dashboard/pages' }
  ];
  const mainLinks = [
    { label: 'Orders', href: '/dashboard/orders', icon: '🧾' },
    { label: 'Catalog', href: '/dashboard/products', icon: '🖼' },
    { label: 'Customers', href: '/dashboard/customers', icon: '👥' },
    { label: 'Promotions', href: '/dashboard/coupons', icon: '🏷' },
    { label: 'Reports', href: '/dashboard/analytics', icon: '📊' }
  ];
  return renderHtmlShell(title, `
    <div class="osa-shell">
      <aside class="osa-sidebar">
        <div class="osa-brand">
          <div class="osa-brand-mark"><span class="osa-brand-logo">S</span><span>MyShopBuilder</span></div>
          <button class="osa-brand-toggle" type="button" onclick="document.body.classList.remove('osa-nav-open')">‹</button>
        </div>
        <nav class="osa-nav">
          <div class="osa-nav-group">
            ${mainLinks.map((item) => `<a class="osa-link" href="${escapeHtml(item.href)}"><span class="osa-link-icon">${item.icon}</span><span class="osa-link-label">${escapeHtml(item.label)}</span></a>`).join('')}
            <div class="osa-parent ${onlineActive ? 'active' : ''}"><span class="osa-parent-icon">🌐</span><span class="osa-parent-label">Online Store</span><span class="osa-parent-arrow">⌃</span></div>
            <div class="osa-subnav">${secondaryLinks.map((item) => `<a href="${escapeHtml(item.href)}" class="${activeKey === item.key ? 'active' : ''}">${escapeHtml(item.label)}</a>`).join('')}</div>
          </div>
        </nav>
        <div class="osa-wallet"><span>💼</span><span>Store: <b>${escapeHtml(String((store.products || []).length))}</b></span></div>
      </aside>

      <div class="osa-topbar">
        <div class="topbar-left" style="display:flex;align-items:center;gap:12px;">
          <button class="hamburger" onclick="document.body.classList.toggle('osa-nav-open')" aria-label="Menu" style="display:flex;"><span></span><span></span><span></span></button>
        </div>
        <div class="osa-topbar-right">
          <a class="osa-plan-btn" href="/dashboard/theme">Select Plan</a>
          <a class="osa-store-chip" href="/store/${escapeHtml(store.slug)}" target="_blank" rel="noopener noreferrer"><small>Store</small><span>${escapeHtml(store.slug)}</span></a>
          <a class="osa-bell" href="/dashboard/orders" aria-label="Orders">🔔</a>
          <div class="osa-avatar" aria-hidden="true">👤</div>
        </div>
      </div>

      <main class="osa-main">${flash}<div class="osa-content">${content}</div></main>
    </div>
  `, { extraStyles: adminStyles + onlineStoreAdminStyles });
}

function renderSuperAdminLayout(req, title, activeKey, content) {
  const flash = renderFlashMessages(req);
  const items = [
    { key: 'dashboard', label: 'Dashboard', href: '/superadmin/dashboard', icon: '▦' },
    { key: 'stores', label: 'Stores', href: '/superadmin/stores', icon: '◫' },
    { key: 'users', label: 'Users', href: '/superadmin/users', icon: '◔' },
    { key: 'logout', label: 'Logout', href: '/superadmin/logout', icon: '⎋' }
  ];
  const sidebar = items.map((item) => {
    const active = activeKey === item.key ? 'active' : '';
    return `<a class="nav-link ${active}" href="${escapeHtml(item.href)}"><span class="nav-icon">${escapeHtml(item.icon)}</span><span class="nav-label">${escapeHtml(item.label)}</span></a>`;
  }).join('');
  return renderHtmlShell(title, `
<div class="topbar">
  <div class="topbar-left">
    <button class="hamburger" onclick="document.body.classList.toggle('sidebar-open')" aria-label="Menu"><span></span><span></span><span></span></button>
    <div class="brand"><strong>MyShop</strong>Builder</div>
    <div class="topbar-store"><div class="topbar-name">Super Admin</div><div class="topbar-sub">Platform control</div></div>
  </div>
</div>
<div class="sidebar-overlay" onclick="document.body.classList.remove('sidebar-open')"></div>
<nav class="sidebar">${sidebar}</nav>
<main class="main admin-shell">${flash}<div class="content-wrap">${content}</div></main>
<nav class="mobile-nav">
  <a href="/superadmin/dashboard"${activeKey === 'dashboard' ? ' class="active"' : ''}><svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><span>Home</span></a>
  <a href="/superadmin/stores"${activeKey === 'stores' ? ' class="active"' : ''}><svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg><span>Stores</span></a>
  <a href="/superadmin/users"${activeKey === 'users' ? ' class="active"' : ''}><svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span>Users</span></a>
  <a href="/superadmin/logout"><svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg><span>Logout</span></a>
</nav>`, { extraStyles: adminStyles });
}

function renderDisplayToggle(name, title, description, checked) {
  return `<label class="osa-toggle-row"><div class="osa-toggle-copy"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span></div><span class="osa-switch"><input type="checkbox" name="${escapeHtml(name)}" ${checked ? 'checked' : ''}><span class="osa-switch-ui"></span></span></label>`;
}

function renderDisplaySectionNav(activeSection) {
  return `<aside class="osa-card osa-section-nav">${DISPLAY_SETTINGS_SECTIONS.map((item) => `<a class="osa-section-link ${activeSection === item.id ? 'active' : ''}" href="/dashboard/display-settings?section=${encodeURIComponent(item.id)}"><span class="osa-section-icon">${escapeHtml(item.icon)}</span><span>${escapeHtml(item.label)}</span></a>`).join('')}</aside>`;
}

function renderDisplaySettingsSection(store, activeSection) {
  const cfg = store.themeConfig || {};
  const backToBanner = '/dashboard/display-settings?section=banner';
  const desktopBannerHtml = Array.isArray(cfg.bannerImages) && cfg.bannerImages.length
    ? `<div class="osa-preview-gallery">${cfg.bannerImages.map((img, i) => `<div class="osa-thumb"><img src="${escapeHtml(img)}" alt="Banner ${i + 1}"><form method="POST" action="/dashboard/theme/banner/delete/${i}?returnTo=${encodeURIComponent(backToBanner)}"><button type="submit" onclick="return confirm('Remove this banner?')">×</button></form></div>`).join('')}</div>`
    : '<p class="osa-block-note">No desktop banners yet.</p>';
  const mobileBannerHtml = Array.isArray(cfg.bannerImagesMobile) && cfg.bannerImagesMobile.length
    ? `<div class="osa-preview-gallery">${cfg.bannerImagesMobile.map((img, i) => `<div class="osa-thumb mobile"><img src="${escapeHtml(img)}" alt="Mobile banner ${i + 1}"><form method="POST" action="/dashboard/theme/banner/mobile/delete/${i}?returnTo=${encodeURIComponent(backToBanner)}"><button type="submit" onclick="return confirm('Remove this banner?')">×</button></form></div>`).join('')}</div>`
    : '<p class="osa-block-note">No mobile banners yet.</p>';

  const cardOptions = [
    { id: 'style-1', title: 'Minimal', sub: 'Very clean card layout' },
    { id: 'style-2', title: 'Sale badge', sub: 'Discount-first layout' },
    { id: 'style-3', title: 'Bold', sub: 'Dark premium card style' },
    { id: 'style-4', title: 'List', sub: 'Compact mobile-friendly layout' }
  ].map((item) => `<label class="osa-option-card ${cfg.productCardStyle === item.id || (!cfg.productCardStyle && item.id === 'style-2') ? 'active' : ''}"><input type="radio" name="productCardStyle" value="${escapeHtml(item.id)}" ${cfg.productCardStyle === item.id || (!cfg.productCardStyle && item.id === 'style-2') ? 'checked' : ''}><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.sub)}</span></label>`).join('');

  const categoryOptions = [
    { id: 'circle', title: 'Circle carousel', sub: 'Rounded icons in a slider' },
    { id: 'square', title: 'Square carousel', sub: 'Modern square category icons' },
    { id: 'grid', title: 'Grid', sub: 'Balanced square category grid' },
    { id: 'pill', title: 'Tag pills', sub: 'Simple chip-like category list' }
  ].map((item) => `<label class="osa-option-card ${cfg.categoryStyle === item.id || (!cfg.categoryStyle && item.id === 'circle') ? 'active' : ''}"><input type="radio" name="categoryStyle" value="${escapeHtml(item.id)}" ${cfg.categoryStyle === item.id || (!cfg.categoryStyle && item.id === 'circle') ? 'checked' : ''}><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.sub)}</span></label>`).join('');

  const headerOptions = [
    { id: 'search', title: 'Search first', sub: 'Large search in header' },
    { id: 'center', title: 'Centered brand', sub: 'Brand name in center' },
    { id: 'left', title: 'Left brand', sub: 'Brand aligned to the left' }
  ].map((item) => `<label class="osa-option-card ${cfg.headerLayout === item.id || (!cfg.headerLayout && item.id === 'search') ? 'active' : ''}"><input type="radio" name="headerLayout" value="${escapeHtml(item.id)}" ${cfg.headerLayout === item.id || (!cfg.headerLayout && item.id === 'search') ? 'checked' : ''}><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.sub)}</span></label>`).join('');

  const sectionMeta = DISPLAY_SETTINGS_SECTIONS.find((item) => item.id === activeSection) || DISPLAY_SETTINGS_SECTIONS[0];
  let body = '';

  if (activeSection === 'announcement') {
    body = `<form method="POST" action="/dashboard/display-settings/save" class="osa-form-grid"><input type="hidden" name="section" value="announcement">${renderDisplayToggle('announcementEnabled', 'Enable announcement bar', 'Show updates, offers, and shipping messages at the very top.', cfg.announcementEnabled !== false)}<div class="osa-block"><div class="osa-form-grid two"><div class="osa-field"><label for="topBarText">Announcement text</label><input id="topBarText" name="topBarText" value="${escapeHtml(cfg.topBarText || '')}" placeholder="Free shipping on orders above Rs 499"></div><div class="osa-field"><label for="topBarMarquee">Animation</label><select id="topBarMarquee" name="topBarMarquee"><option value="true"${cfg.topBarMarquee !== false ? ' selected' : ''}>Moving text</option><option value="false"${cfg.topBarMarquee === false ? ' selected' : ''}>Static text</option></select></div><div class="osa-field"><label for="topBarBgText">Bar color</label><input id="topBarBgText" name="topBarBgText" value="${escapeHtml(cfg.topBarBg || '')}" placeholder="#1f4ff0"></div><div class="osa-field"><label for="topBarColorText">Text color</label><input id="topBarColorText" name="topBarColorText" value="${escapeHtml(cfg.topBarColor || '')}" placeholder="#ffffff"></div></div></div><div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'header') {
    body = `<form method="POST" action="/dashboard/display-settings/save" class="osa-form-grid"><input type="hidden" name="section" value="header"><div class="osa-block"><h3>Header layout</h3><div class="osa-option-grid">${headerOptions}</div></div>${renderDisplayToggle('headerSticky', 'Sticky header', 'Keep the header visible while scrolling.', cfg.headerSticky !== false)}${renderDisplayToggle('showSearch', 'Show search bar', 'Let customers search directly from the storefront header.', cfg.showSearch !== false)}${renderDisplayToggle('showWishlistIcon', 'Show wishlist icon', 'Display the wishlist shortcut in the header.', cfg.showWishlistIcon !== false)}${renderDisplayToggle('showCartIcon', 'Show cart icon', 'Display the cart shortcut in the header.', cfg.showCartIcon !== false)}<div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'menu') {
    body = `<form method="POST" action="/dashboard/display-settings/save" class="osa-form-grid"><input type="hidden" name="section" value="menu"><div class="osa-block"><h3>Menu labels</h3><div class="osa-form-grid two"><div class="osa-field"><label for="menuHomeLabel">Home label</label><input id="menuHomeLabel" name="menuHomeLabel" value="${escapeHtml(cfg.menuHomeLabel || 'Home')}"></div><div class="osa-field"><label for="menuShopLabel">Shop label</label><input id="menuShopLabel" name="menuShopLabel" value="${escapeHtml(cfg.menuShopLabel || 'Shop All')}"></div><div class="osa-field"><label for="menuWishlistLabel">Wishlist label</label><input id="menuWishlistLabel" name="menuWishlistLabel" value="${escapeHtml(cfg.menuWishlistLabel || 'Wishlist')}"></div><div class="osa-field"><label for="menuCartLabel">Cart label</label><input id="menuCartLabel" name="menuCartLabel" value="${escapeHtml(cfg.menuCartLabel || 'Cart')}"></div><div class="osa-field"><label for="menuTrackLabel">Track order label</label><input id="menuTrackLabel" name="menuTrackLabel" value="${escapeHtml(cfg.menuTrackLabel || 'Track Order')}"></div><div class="osa-field"><label for="menuAccountLabel">Account label</label><input id="menuAccountLabel" name="menuAccountLabel" value="${escapeHtml(cfg.menuAccountLabel || 'My Account')}"></div></div><p class="osa-block-note">Use simple words so even first-time users understand the menu instantly.</p></div><div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'banner') {
    body = `<form method="POST" action="/dashboard/display-settings/save" class="osa-form-grid"><input type="hidden" name="section" value="banner">${renderDisplayToggle('showBanner', 'Enable banner / hero section', 'Show the large top banner on the storefront home page.', cfg.showBanner !== false)}<div class="osa-block"><div class="osa-form-grid two"><div class="osa-field"><label for="bannerTitle">Banner title</label><input id="bannerTitle" name="bannerTitle" value="${escapeHtml(cfg.bannerTitle || '')}" placeholder="Big sale is live"></div><div class="osa-field"><label for="bannerCta">Button text</label><input id="bannerCta" name="bannerCta" value="${escapeHtml(cfg.bannerCta || '')}" placeholder="Shop now"></div></div><div class="osa-field"><label for="bannerSubtitle">Banner subtitle</label><textarea id="bannerSubtitle" name="bannerSubtitle" placeholder="Write one simple line that explains the offer.">${escapeHtml(cfg.bannerSubtitle || '')}</textarea></div></div><div class="osa-actions"><button class="osa-btn" type="submit">Save content</button></div></form><div class="osa-block"><h3>Desktop banners</h3>${desktopBannerHtml}<form method="POST" action="/dashboard/theme/banner/add" enctype="multipart/form-data" class="osa-form-grid" style="margin-top:14px;"><input type="hidden" name="returnTo" value="${escapeHtml(backToBanner)}"><div class="osa-field"><label for="desktopBanner">Upload desktop banner</label><input id="desktopBanner" type="file" name="image" accept=".jpg,.jpeg,.png,.webp,image/*" required></div><div class="osa-actions"><button class="osa-btn secondary" type="submit">Add desktop banner</button></div></form></div><div class="osa-block"><h3>Mobile banners</h3>${mobileBannerHtml}<form method="POST" action="/dashboard/theme/banner/mobile/add" enctype="multipart/form-data" class="osa-form-grid" style="margin-top:14px;"><input type="hidden" name="returnTo" value="${escapeHtml(backToBanner)}"><div class="osa-field"><label for="mobileBanner">Upload mobile banner</label><input id="mobileBanner" type="file" name="image" accept=".jpg,.jpeg,.png,.webp,image/*" required></div><div class="osa-actions"><button class="osa-btn secondary" type="submit">Add mobile banner</button></div></form></div>`;
  } else if (activeSection === 'categories') {
    body = `<form method="POST" action="/dashboard/display-settings/save" class="osa-form-grid"><input type="hidden" name="section" value="categories">${renderDisplayToggle('showCategories', 'Show categories section', 'Display product categories on the home page.', cfg.showCategories !== false)}<div class="osa-block"><div class="osa-form-grid two"><div class="osa-field"><label for="categoryTitle">Section title</label><input id="categoryTitle" name="categoryTitle" value="${escapeHtml(cfg.categoryTitle || 'Categories')}"></div><div class="osa-field"><label for="categoryLayout">Layout behavior</label><select id="categoryLayout" name="categoryLayout"><option value="auto"${!cfg.categoryLayout || cfg.categoryLayout === 'auto' ? ' selected' : ''}>Auto</option><option value="carousel"${cfg.categoryLayout === 'carousel' ? ' selected' : ''}>Always carousel</option><option value="grid"${cfg.categoryLayout === 'grid' ? ' selected' : ''}>Always grid</option></select></div></div><div class="osa-option-grid">${categoryOptions}</div></div><div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'products') {
    body = `<form method="POST" action="/dashboard/display-settings/save" class="osa-form-grid"><input type="hidden" name="section" value="products"><div class="osa-block"><div class="osa-field"><label for="productsTitle">Products section title</label><input id="productsTitle" name="productsTitle" value="${escapeHtml(cfg.productsTitle || 'All Products')}" placeholder="Best sellers"></div></div>${renderDisplayToggle('showFlashDeals', 'Show flash deals section', 'Highlight a few products above the main product grid.', cfg.showFlashDeals !== false)}<div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'footer') {
    body = `<form method="POST" action="/dashboard/display-settings/save" class="osa-form-grid"><input type="hidden" name="section" value="footer">${renderDisplayToggle('showFooter', 'Show footer', 'Display the footer at the bottom of the store.', cfg.showFooter !== false)}${renderDisplayToggle('showPoweredBy', 'Show “Powered by MyShopBuilder”', 'Keep the platform credit visible in the footer.', cfg.showPoweredBy !== false)}<div class="osa-block"><div class="osa-field"><label for="footerText">Footer text</label><input id="footerText" name="footerText" value="${escapeHtml(cfg.footerText || '')}" placeholder="Your brand message or contact line"></div></div><div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'product-card') {
    body = `<form method="POST" action="/dashboard/display-settings/save" class="osa-form-grid"><input type="hidden" name="section" value="product-card"><div class="osa-block"><h3>Card style</h3><div class="osa-option-grid">${cardOptions}</div></div>${renderDisplayToggle('showDiscount', 'Show discount badge', 'Display discount percentage when MRP is higher than price.', cfg.showDiscount !== false)}${renderDisplayToggle('showRating', 'Show rating', 'Display a clean rating line on product cards.', cfg.showRating !== false)}${renderDisplayToggle('showProductStock', 'Show stock on cards', 'Display remaining stock directly on product cards.', cfg.showProductStock !== false)}<div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'product-page') {
    body = `<form method="POST" action="/dashboard/display-settings/save" class="osa-form-grid"><input type="hidden" name="section" value="product-page">${renderDisplayToggle('showProductDescription', 'Show product description', 'Display the product description on the detail page and related cards.', cfg.showProductDescription !== false)}${renderDisplayToggle('showProductPageStock', 'Show stock on product page', 'Show the stock pill on the product detail page.', cfg.showProductPageStock !== false)}${renderDisplayToggle('showWhatsappButton', 'Show WhatsApp button', 'Add a direct WhatsApp CTA on the product page.', cfg.showWhatsappButton !== false)}<div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'color-font') {
    body = `<form method="POST" action="/dashboard/display-settings/save" class="osa-form-grid"><input type="hidden" name="section" value="color-font"><div class="osa-block"><div class="osa-form-grid two"><div class="osa-field"><label for="primaryColorText">Primary color</label><input id="primaryColorText" name="primaryColorText" value="${escapeHtml(cfg.primaryColor || '')}" placeholder="#1f4ff0"></div><div class="osa-field"><label for="secondaryColorText">Secondary color</label><input id="secondaryColorText" name="secondaryColorText" value="${escapeHtml(cfg.secondaryColor || '')}" placeholder="#06b6d4"></div><div class="osa-field"><label for="btnColorText">Button color</label><input id="btnColorText" name="btnColorText" value="${escapeHtml(cfg.btnColor || '')}" placeholder="#1f4ff0"></div><div class="osa-field"><label for="bgColorText">Background color</label><input id="bgColorText" name="bgColorText" value="${escapeHtml(cfg.bgColor || '')}" placeholder="#f8fafc"></div><div class="osa-field"><label for="headingFont">Heading font</label><select id="headingFont" name="headingFont"><option value=""${!cfg.headingFont ? ' selected' : ''}>Default</option><option value="Inter"${cfg.headingFont === 'Inter' ? ' selected' : ''}>Inter</option><option value="DM Sans"${cfg.headingFont === 'DM Sans' ? ' selected' : ''}>DM Sans</option><option value="Poppins"${cfg.headingFont === 'Poppins' ? ' selected' : ''}>Poppins</option><option value="Alegreya SC"${cfg.headingFont === 'Alegreya SC' ? ' selected' : ''}>Alegreya SC</option></select></div><div class="osa-field"><label for="bodyFont">Body font</label><select id="bodyFont" name="bodyFont"><option value=""${!cfg.bodyFont ? ' selected' : ''}>Default</option><option value="Inter"${cfg.bodyFont === 'Inter' ? ' selected' : ''}>Inter</option><option value="DM Sans"${cfg.bodyFont === 'DM Sans' ? ' selected' : ''}>DM Sans</option><option value="Poppins"${cfg.bodyFont === 'Poppins' ? ' selected' : ''}>Poppins</option></select></div><div class="osa-field"><label for="borderRadius">Corner style</label><select id="borderRadius" name="borderRadius"><option value="sharp"${cfg.borderRadius === 'sharp' ? ' selected' : ''}>Sharp</option><option value="rounded"${!cfg.borderRadius || cfg.borderRadius === 'rounded' ? ' selected' : ''}>Rounded</option><option value="pill"${cfg.borderRadius === 'pill' ? ' selected' : ''}>Pill</option></select></div><div class="osa-field"><label for="btnStyle">Button shape</label><select id="btnStyle" name="btnStyle"><option value="sharp"${cfg.btnStyle === 'sharp' ? ' selected' : ''}>Sharp</option><option value="rounded"${cfg.btnStyle === 'rounded' ? ' selected' : ''}>Rounded</option><option value="pill"${!cfg.btnStyle || cfg.btnStyle === 'pill' ? ' selected' : ''}>Pill</option></select></div></div></div><div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else {
    body = `<form method="POST" action="/dashboard/display-settings/save" class="osa-form-grid"><input type="hidden" name="section" value="custom-css"><div class="osa-block"><div class="osa-field"><label for="customCss">Custom CSS</label><textarea id="customCss" name="customCss" placeholder=".store-footer { display:none; }">${escapeHtml(cfg.customCss || '')}</textarea></div><p class="osa-block-note">Use this only for advanced tweaks after the simple controls above are not enough.</p></div><div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  }

  return `<section class="osa-card osa-form-panel"><div class="osa-form-head"><h2>${escapeHtml(sectionMeta.label)}</h2><p>Dedicated controls for this section. Keep things simple and change only what you need.</p></div>${body}</section>`;
}

function renderStoreSettingsSectionNav(activeSection) {
  return `<aside class="osa-card osa-section-nav">${STORE_SETTINGS_SECTIONS.map((item) => `<a class="osa-section-link ${activeSection === item.id ? 'active' : ''}" href="/dashboard/settings?section=${encodeURIComponent(item.id)}"><span class="osa-section-icon">${escapeHtml(item.icon)}</span><span>${escapeHtml(item.label)}</span></a>`).join('')}</aside>`;
}

function renderStoreSettingsSection(store, activeSection) {
  const ss = ensureStoreSettings(store);
  const meta = STORE_SETTINGS_SECTIONS.find((item) => item.id === activeSection) || STORE_SETTINGS_SECTIONS[0];
  const social = ss.storeDetails.socialLinks || { facebook: '', youtube: '', instagram: '' };
  const redirectsHtml = Array.isArray(ss.urlRedirects) && ss.urlRedirects.length ? `<div class="osa-block">${ss.urlRedirects.map((item, index) => `<div class="osa-toggle-row" style="align-items:center;"><div class="osa-toggle-copy"><strong>${escapeHtml(item.from)}</strong><span>${escapeHtml(item.to)}</span></div><form method="POST" action="/dashboard/settings/redirects/delete/${index}"><button class="osa-btn secondary" type="submit">Delete</button></form></div>`).join('')}</div>` : '<p class="osa-block-note">No redirect rules added yet.</p>';
  const policyStatus = (text) => text && String(text).trim() ? 'Policy Set' : 'No Policy Set';
  let body = '';

  if (activeSection === 'store-details') {
    body = `
      <div class="osa-block"><h3>Store Logo</h3><div class="osa-form-grid two"><div>${store.logo ? `<img class="logo-preview" src="${escapeHtml(store.logo)}" alt="${escapeHtml(store.name)}">` : '<div class="empty" style="padding:18px;">No logo uploaded</div>'}<form method="POST" action="/dashboard/settings/logo" enctype="multipart/form-data" class="osa-form-grid" style="margin-top:12px;"><div class="osa-field"><label for="logo">Store logo</label><input id="logo" name="logo" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/*" required></div><div class="osa-actions"><button class="osa-btn secondary" type="submit">Update Logo</button></div></form></div><div>${ss.storeDetails.favicon ? `<img class="logo-preview" src="${escapeHtml(ss.storeDetails.favicon)}" alt="Favicon">` : '<div class="empty" style="padding:18px;">No favicon uploaded</div>'}<form method="POST" action="/dashboard/settings/favicon" enctype="multipart/form-data" class="osa-form-grid" style="margin-top:12px;"><div class="osa-field"><label for="favicon">Favicon</label><input id="favicon" name="favicon" type="file" accept=".png,image/png,.jpg,.jpeg,.webp,image/*" required></div><div class="osa-actions"><button class="osa-btn secondary" type="submit">Update Favicon</button></div></form></div></div></div>
      <form method="POST" action="/dashboard/settings/save" class="osa-form-grid"><input type="hidden" name="section" value="store-details"><div class="osa-block"><h3>Store Information</h3><div class="osa-form-grid two"><div class="osa-field"><label for="name">Store name</label><input id="name" name="name" value="${escapeHtml(store.name)}" required></div><div class="osa-field"><label for="category">Category</label><input id="category" name="category" value="${escapeHtml(ss.storeDetails.category)}"></div><div class="osa-field"><label for="phone">Phone number</label><input id="phone" name="phone" value="${escapeHtml(ss.storeDetails.phone)}"></div><div class="osa-field"><label for="email">Email</label><input id="email" name="email" type="email" value="${escapeHtml(ss.storeDetails.email)}"></div><div class="osa-field"><label for="whatsapp">WhatsApp number</label><input id="whatsapp" name="whatsapp" value="${escapeHtml(store.whatsapp)}"></div><div class="osa-field"><label for="theme">Theme mode</label><select id="theme" name="theme"><option value="default"${store.theme === 'default' ? ' selected' : ''}>Default</option><option value="dark"${store.theme === 'dark' ? ' selected' : ''}>Dark</option></select></div></div><div class="osa-field"><label for="description">Store description</label><textarea id="description" name="description">${escapeHtml(store.description)}</textarea></div></div><div class="osa-block"><h3>Business Information</h3><div class="osa-form-grid two"><div class="osa-field"><label for="legalName">Legal name</label><input id="legalName" name="legalName" value="${escapeHtml(ss.storeDetails.legalName)}"></div><div class="osa-field"><label for="businessType">Business type</label><select id="businessType" name="businessType"><option value="Individual"${ss.storeDetails.businessType === 'Individual' ? ' selected' : ''}>Individual</option><option value="Sole Proprietorship"${ss.storeDetails.businessType === 'Sole Proprietorship' ? ' selected' : ''}>Sole Proprietorship</option><option value="Partnership"${ss.storeDetails.businessType === 'Partnership' ? ' selected' : ''}>Partnership</option><option value="Private Limited"${ss.storeDetails.businessType === 'Private Limited' ? ' selected' : ''}>Private Limited</option></select></div></div><div class="osa-field"><label for="address">Address</label><textarea id="address" name="address">${escapeHtml(ss.storeDetails.address)}</textarea></div></div><div class="osa-block"><h3>Social Media Links</h3><div class="osa-form-grid"><div class="osa-field"><label for="facebook">Facebook</label><input id="facebook" name="facebook" value="${escapeHtml(social.facebook)}"></div><div class="osa-field"><label for="youtube">YouTube</label><input id="youtube" name="youtube" value="${escapeHtml(social.youtube)}"></div><div class="osa-field"><label for="instagram">Instagram</label><input id="instagram" name="instagram" value="${escapeHtml(social.instagram)}"></div></div></div><div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'store-domain') {
    body = `<form method="POST" action="/dashboard/settings/save" class="osa-form-grid"><input type="hidden" name="section" value="store-domain"><div class="osa-block"><div class="osa-form-grid two"><div class="osa-field"><label for="customDomain">Custom domain</label><input id="customDomain" name="customDomain" value="${escapeHtml(ss.domain.customDomain)}" placeholder="shop.example.com"></div><div class="osa-field"><label for="subdomain">Subdomain</label><input id="subdomain" name="subdomain" value="${escapeHtml(ss.domain.subdomain)}" placeholder="mybrand.example.com"></div></div><p class="osa-block-note">Use either a custom domain or a subdomain. These values are also used by the host-based redirect logic.</p></div><div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'products-settings') {
    body = `<form method="POST" action="/dashboard/settings/save" class="osa-form-grid"><input type="hidden" name="section" value="products-settings">${renderDisplayToggle('hideOutOfStock', 'Hide out-of-stock products', 'When enabled, zero-stock products will not appear in the storefront grid.', ss.productSettings.hideOutOfStock === true)}${renderDisplayToggle('displaySingleVariantDetails', 'Product card: display single variant details', 'Keep a placeholder toggle ready for products with a single variant.', ss.productSettings.displaySingleVariantDetails === true)}${renderDisplayToggle('showCartCheckoutPopup', 'Show cart checkout popup', 'After adding a product, send the customer quickly toward checkout.', ss.productSettings.showCartCheckoutPopup === true)}<div class="osa-block"><div class="osa-form-grid two"><div class="osa-field"><label for="productCardSalePrice">Product card sale price</label><select id="productCardSalePrice" name="productCardSalePrice"><option value="sale-tax"${ss.productSettings.productCardSalePrice === 'sale-tax' ? ' selected' : ''}>Sale Price with Tax Amount</option><option value="sale-only"${ss.productSettings.productCardSalePrice === 'sale-only' ? ' selected' : ''}>Sale Price Only</option><option value="sale-tax-exclusive"${ss.productSettings.productCardSalePrice === 'sale-tax-exclusive' ? ' selected' : ''}>Sale Price Tax Exclusive</option></select></div><div class="osa-field"><label for="productPageSalePrice">Product page sale price</label><select id="productPageSalePrice" name="productPageSalePrice"><option value="sale-tax"${ss.productSettings.productPageSalePrice === 'sale-tax' ? ' selected' : ''}>Sale Price with Tax Amount</option><option value="sale-only"${ss.productSettings.productPageSalePrice === 'sale-only' ? ' selected' : ''}>Sale Price Only</option><option value="sale-tax-exclusive"${ss.productSettings.productPageSalePrice === 'sale-tax-exclusive' ? ' selected' : ''}>Sale Price Tax Exclusive</option></select></div><div class="osa-field"><label for="minimumQtyIncrementRule">Minimum quantity increment rule</label><select id="minimumQtyIncrementRule" name="minimumQtyIncrementRule"><option value="single"${ss.productSettings.minimumQtyIncrementRule === 'single' ? ' selected' : ''}>Single increment after minimum</option><option value="pack"${ss.productSettings.minimumQtyIncrementRule === 'pack' ? ' selected' : ''}>Pack size only</option></select></div><div class="osa-field"><label for="variantSelectorType">Variant selector type</label><select id="variantSelectorType" name="variantSelectorType"><option value="chips"${ss.productSettings.variantSelectorType === 'chips' ? ' selected' : ''}>Chips</option><option value="dropdown"${ss.productSettings.variantSelectorType === 'dropdown' ? ' selected' : ''}>Dropdown</option></select></div></div></div><div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'checkout-settings') {
    body = `<form method="POST" action="/dashboard/settings/save" class="osa-form-grid"><input type="hidden" name="section" value="checkout-settings"><div class="osa-block"><div class="osa-form-grid two"><div class="osa-field"><label for="roundingMode">Cart total amount rounding mode</label><select id="roundingMode" name="roundingMode"><option value="none"${ss.checkoutSettings.roundingMode === 'none' ? ' selected' : ''}>No rounding</option><option value="up"${ss.checkoutSettings.roundingMode === 'up' ? ' selected' : ''}>Round up</option><option value="down"${ss.checkoutSettings.roundingMode === 'down' ? ' selected' : ''}>Round down</option><option value="nearest"${ss.checkoutSettings.roundingMode === 'nearest' ? ' selected' : ''}>Round to nearest rupee</option></select></div><div class="osa-field"><label for="minimumOrderAmount">Minimum order amount</label><input id="minimumOrderAmount" name="minimumOrderAmount" value="${escapeHtml(ss.checkoutSettings.minimumOrderAmount)}"></div></div></div>${renderDisplayToggle('showTaxInfo', 'Show tax information', 'Display tax details on cart and checkout.', ss.checkoutSettings.showTaxInfo !== false)}<div class="osa-block"><div class="osa-field"><label for="cartNote">Cart note</label><textarea id="cartNote" name="cartNote">${escapeHtml(ss.checkoutSettings.cartNote)}</textarea></div></div><div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'delivery-settings') {
    body = `<form method="POST" action="/dashboard/settings/save" class="osa-form-grid"><input type="hidden" name="section" value="delivery-settings"><div class="osa-block"><div class="osa-form-grid two"><div class="osa-field"><label for="deliveryFee">Delivery fees</label><input id="deliveryFee" name="deliveryFee" value="${escapeHtml(ss.deliverySettings.fee)}"></div><div class="osa-field"><label for="freeDeliveryAbove">Free delivery above</label><input id="freeDeliveryAbove" name="freeDeliveryAbove" value="${escapeHtml(ss.deliverySettings.freeDeliveryAbove)}"></div><div class="osa-field"><label for="deliveryRadius">Set delivery radius (KM)</label><input id="deliveryRadius" name="deliveryRadius" value="${escapeHtml(ss.deliverySettings.deliveryRadius)}"></div><div class="osa-field"><label for="serviceType">Service type</label><select id="serviceType" name="serviceType"><option value="delivery"${ss.deliverySettings.serviceType === 'delivery' ? ' selected' : ''}>Delivery</option><option value="pickup"${ss.deliverySettings.serviceType === 'pickup' ? ' selected' : ''}>Store pickup</option><option value="delivery-pickup"${ss.deliverySettings.serviceType === 'delivery-pickup' ? ' selected' : ''}>Delivery + Store pickup</option></select></div><div class="osa-field"><label for="addressType">Address type</label><select id="addressType" name="addressType"><option value="map"${ss.deliverySettings.addressType === 'map' ? ' selected' : ''}>Map</option><option value="form"${ss.deliverySettings.addressType === 'form' ? ' selected' : ''}>Form</option><option value="map-form"${ss.deliverySettings.addressType === 'map-form' ? ' selected' : ''}>Map + Form</option></select></div></div></div>${renderDisplayToggle('allIndiaDelivery', 'All India delivery', 'Allow checkout from all locations instead of only a local radius.', ss.deliverySettings.allIndiaDelivery !== false)}<div class="osa-block"><div class="osa-form-grid two"><div class="osa-field"><label for="nextDayTitle">Next day delivery title</label><input id="nextDayTitle" name="nextDayTitle" value="${escapeHtml(ss.deliverySettings.nextDayTitle)}"></div><div class="osa-field"><label for="nextDaySubtitle">Next day delivery subtitle</label><input id="nextDaySubtitle" name="nextDaySubtitle" value="${escapeHtml(ss.deliverySettings.nextDaySubtitle)}"></div><div class="osa-field"><label for="normalTitle">Normal delivery title</label><input id="normalTitle" name="normalTitle" value="${escapeHtml(ss.deliverySettings.normalTitle)}"></div><div class="osa-field"><label for="normalSubtitle">Normal delivery subtitle</label><input id="normalSubtitle" name="normalSubtitle" value="${escapeHtml(ss.deliverySettings.normalSubtitle)}"></div></div></div><div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'payment-settings') {
    body = `<form method="POST" action="/dashboard/settings/save" class="osa-form-grid"><input type="hidden" name="section" value="payment-settings">${renderDisplayToggle('cod', 'Cash on delivery', 'Collect cash at the time of delivery.', ss.paymentSettings.cod !== false)}${renderDisplayToggle('partialCod', 'Advance partial payment', 'Collect some advance payment for COD orders.', ss.paymentSettings.partialCod === true)}${renderDisplayToggle('onlinePayment', 'Online payment', 'Enable online/manual prepaid payment option at checkout.', ss.paymentSettings.onlinePayment === true)}<div class="osa-block"><div class="osa-field"><label for="bankDetails">Bank details</label><textarea id="bankDetails" name="bankDetails">${escapeHtml(ss.paymentSettings.bankDetails)}</textarea></div><div class="osa-field"><label for="paymentModeRules">Payment mode rules</label><textarea id="paymentModeRules" name="paymentModeRules">${escapeHtml(ss.paymentSettings.paymentModeRules)}</textarea></div></div><div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'order-settings') {
    body = `<form method="POST" action="/dashboard/settings/save" class="osa-form-grid"><input type="hidden" name="section" value="order-settings">${renderDisplayToggle('allowInvoiceDownload', 'Allow invoice download', 'Let customers download their invoice from order pages.', ss.orderSettings.allowInvoiceDownload !== false)}${renderDisplayToggle('allowOrderCancellation', 'Allow order cancellation', 'Allow customers to cancel orders before fulfillment begins.', ss.orderSettings.allowOrderCancellation !== false)}<div class="osa-block"><div class="osa-form-grid two"><div class="osa-field"><label for="autoConfirmPaymentMode">Auto-confirm orders based on payment mode</label><select id="autoConfirmPaymentMode" name="autoConfirmPaymentMode"><option value="online"${ss.orderSettings.autoConfirmPaymentMode === 'online' ? ' selected' : ''}>Online</option><option value="cod"${ss.orderSettings.autoConfirmPaymentMode === 'cod' ? ' selected' : ''}>COD</option><option value="both"${ss.orderSettings.autoConfirmPaymentMode === 'both' ? ' selected' : ''}>Both</option><option value="manual"${ss.orderSettings.autoConfirmPaymentMode === 'manual' ? ' selected' : ''}>Manual</option></select></div></div><div class="osa-field"><label for="orderNote">Order note shown to customer</label><textarea id="orderNote" name="orderNote">${escapeHtml(ss.orderSettings.orderNote)}</textarea></div></div><div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'return-order-settings') {
    body = `<form method="POST" action="/dashboard/settings/save" class="osa-form-grid"><input type="hidden" name="section" value="return-order-settings">${renderDisplayToggle('allowReturnRequests', 'Allow return requests', 'Let customers request returns after delivery.', ss.returnOrderSettings.allowReturnRequests === true)}<div class="osa-block"><div class="osa-form-grid two"><div class="osa-field"><label for="returnWindowDays">Return window (days)</label><input id="returnWindowDays" name="returnWindowDays" value="${escapeHtml(ss.returnOrderSettings.returnWindowDays)}"></div></div><div class="osa-field"><label for="returnInstructions">Return instructions</label><textarea id="returnInstructions" name="returnInstructions">${escapeHtml(ss.returnOrderSettings.instructions)}</textarea></div></div><div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'label-settings') {
    const labels = ss.labelSettings;
    body = `<form method="POST" action="/dashboard/settings/save" class="osa-form-grid"><input type="hidden" name="section" value="label-settings"><div class="osa-block"><div class="osa-form-grid two"><div class="osa-field"><label for="searchBoxText">Search box text</label><input id="searchBoxText" name="searchBoxText" value="${escapeHtml(labels.searchBoxText)}"></div><div class="osa-field"><label for="selectLocationText">Select location text</label><input id="selectLocationText" name="selectLocationText" value="${escapeHtml(labels.selectLocationText)}"></div><div class="osa-field"><label for="categoriesHeading">Categories heading</label><input id="categoriesHeading" name="categoriesHeading" value="${escapeHtml(labels.categoriesHeading)}"></div><div class="osa-field"><label for="collectionsHeading">Collections heading</label><input id="collectionsHeading" name="collectionsHeading" value="${escapeHtml(labels.collectionsHeading)}"></div><div class="osa-field"><label for="productsHeading">Products heading</label><input id="productsHeading" name="productsHeading" value="${escapeHtml(labels.productsHeading)}"></div><div class="osa-field"><label for="addProductButton">Add product button</label><input id="addProductButton" name="addProductButton" value="${escapeHtml(labels.addProductButton)}"></div><div class="osa-field"><label for="productCardEnquiryButton">Product card enquiry button</label><input id="productCardEnquiryButton" name="productCardEnquiryButton" value="${escapeHtml(labels.productCardEnquiryButton)}"></div><div class="osa-field"><label for="viewAllProductsButton">View all products button</label><input id="viewAllProductsButton" name="viewAllProductsButton" value="${escapeHtml(labels.viewAllProductsButton)}"></div><div class="osa-field"><label for="bottomNavHome">Bottom navigation - Home</label><input id="bottomNavHome" name="bottomNavHome" value="${escapeHtml(labels.bottomNavHome)}"></div><div class="osa-field"><label for="bottomNavOrders">Bottom navigation - Orders</label><input id="bottomNavOrders" name="bottomNavOrders" value="${escapeHtml(labels.bottomNavOrders)}"></div><div class="osa-field"><label for="bottomNavCart">Bottom navigation - Cart</label><input id="bottomNavCart" name="bottomNavCart" value="${escapeHtml(labels.bottomNavCart)}"></div><div class="osa-field"><label for="bottomNavAccount">Bottom navigation - Account</label><input id="bottomNavAccount" name="bottomNavAccount" value="${escapeHtml(labels.bottomNavAccount)}"></div><div class="osa-field"><label for="signInHeading">Sign in modal heading</label><input id="signInHeading" name="signInHeading" value="${escapeHtml(labels.signInHeading)}"></div><div class="osa-field"><label for="signUpHeading">Sign up modal heading</label><input id="signUpHeading" name="signUpHeading" value="${escapeHtml(labels.signUpHeading)}"></div><div class="osa-field"><label for="requestOtpButton">Request OTP button</label><input id="requestOtpButton" name="requestOtpButton" value="${escapeHtml(labels.requestOtpButton)}"></div></div></div><div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'seo-settings') {
    const seo = ss.seoSettings;
    body = `<form method="POST" action="/dashboard/settings/save" class="osa-form-grid"><input type="hidden" name="section" value="seo-settings"><div class="osa-block"><div class="osa-field"><label for="seoTitle">Title</label><input id="seoTitle" name="seoTitle" value="${escapeHtml(seo.title)}"></div><div class="osa-field"><label for="seoDescription">Description</label><textarea id="seoDescription" name="seoDescription">${escapeHtml(seo.description)}</textarea></div><div class="osa-field"><label for="seoKeywords">Keywords</label><input id="seoKeywords" name="seoKeywords" value="${escapeHtml(seo.keywords)}"></div><div class="osa-form-grid two"><div class="osa-field"><label for="googleSiteVerification">Google site verification ID</label><input id="googleSiteVerification" name="googleSiteVerification" value="${escapeHtml(seo.googleSiteVerification)}"></div><div class="osa-field"><label for="facebookDomainVerification">Facebook domain verification ID</label><input id="facebookDomainVerification" name="facebookDomainVerification" value="${escapeHtml(seo.facebookDomainVerification)}"></div><div class="osa-field"><label for="pinterestDomainVerification">Pinterest domain verification ID</label><input id="pinterestDomainVerification" name="pinterestDomainVerification" value="${escapeHtml(seo.pinterestDomainVerification)}"></div></div></div><div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'llm-settings') {
    const llm = ss.llmSettings;
    body = `<form method="POST" action="/dashboard/settings/save" class="osa-form-grid"><input type="hidden" name="section" value="llm-settings">${renderDisplayToggle('llmEnabled', 'Enable llms.txt output', 'Generate a simple llms.txt summary for AI tools.', llm.enabled === true)}<div class="osa-block"><div class="osa-field"><label for="businessSummary">Business summary</label><textarea id="businessSummary" name="businessSummary">${escapeHtml(llm.businessSummary)}</textarea></div><div class="osa-form-grid two"><div class="osa-field"><label for="supportEmail">Support email</label><input id="supportEmail" name="supportEmail" value="${escapeHtml(llm.supportEmail)}"></div><div class="osa-field"><label for="supportPhone">Support phone</label><input id="supportPhone" name="supportPhone" value="${escapeHtml(llm.supportPhone)}"></div></div></div><div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'notifications-settings') {
    const n = ss.notificationsSettings;
    body = `<form method="POST" action="/dashboard/settings/save" class="osa-form-grid"><input type="hidden" name="section" value="notifications-settings">${renderDisplayToggle('newOrder', 'New order notifications', 'Get notified whenever a new order arrives.', n.newOrder !== false)}${renderDisplayToggle('whatsappLead', 'WhatsApp lead notifications', 'Get notified about incoming WhatsApp leads.', n.whatsappLead !== false)}${renderDisplayToggle('lowStock', 'Low stock notifications', 'Get notified when stock gets low.', n.lowStock === true)}${renderDisplayToggle('abandonedCart', 'Abandoned cart notifications', 'Get notified when customers leave items in the cart.', n.abandonedCart === true)}<div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'login-settings') {
    const login = ss.loginSettings;
    body = `<form method="POST" action="/dashboard/settings/save" class="osa-form-grid"><input type="hidden" name="section" value="login-settings">${renderDisplayToggle('allowRegistration', 'Allow registration', 'Let customers create accounts from the storefront.', login.allowRegistration !== false)}<div class="osa-block"><div class="osa-form-grid two"><div class="osa-field"><label for="loginSignInHeading">Sign in heading</label><input id="loginSignInHeading" name="loginSignInHeading" value="${escapeHtml(login.signInHeading)}"></div><div class="osa-field"><label for="loginSignUpHeading">Sign up heading</label><input id="loginSignUpHeading" name="loginSignUpHeading" value="${escapeHtml(login.signUpHeading)}"></div><div class="osa-field"><label for="loginRequestOtpButton">Request OTP button</label><input id="loginRequestOtpButton" name="loginRequestOtpButton" value="${escapeHtml(login.requestOtpButton)}"></div></div></div><div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'url-redirects') {
    body = `<form method="POST" action="/dashboard/settings/redirects/add" class="osa-form-grid"><div class="osa-block"><div class="osa-form-grid two"><div class="osa-field"><label for="redirectFrom">From path</label><input id="redirectFrom" name="from" placeholder="/old-page"></div><div class="osa-field"><label for="redirectTo">To path / URL</label><input id="redirectTo" name="to" placeholder="/new-page or https://..."></div></div><p class="osa-block-note">Redirects work inside your store path and also accept full URLs.</p></div><div class="osa-actions"><button class="osa-btn" type="submit">Add redirect</button></div></form>${redirectsHtml}`;
  } else if (activeSection === 'robots-txt') {
    const robots = ss.robotsSettings;
    body = `<form method="POST" action="/dashboard/settings/save" class="osa-form-grid"><input type="hidden" name="section" value="robots-txt"><div class="osa-block"><div class="osa-field"><label for="robotsMode">Configuration mode</label><select id="robotsMode" name="robotsMode"><option value="normal"${robots.mode === 'normal' ? ' selected' : ''}>Normal</option><option value="advanced"${robots.mode === 'advanced' ? ' selected' : ''}>Advanced</option></select></div></div>${renderDisplayToggle('allowAll', 'Allow crawling (Default)', 'Allow all search engines and bots to crawl your site.', robots.allowAll !== false)}${renderDisplayToggle('homeOnly', 'Allow home page only', 'Allow crawling of home page only, block all other pages.', robots.homeOnly === true)}${renderDisplayToggle('blockAll', 'Block crawling', 'Prevent all bots and crawlers from accessing your site.', robots.blockAll === true)}<div class="osa-block"><div class="osa-field"><label for="robotsCustomText">Custom robots.txt</label><textarea id="robotsCustomText" name="robotsCustomText">${escapeHtml(robots.customText)}</textarea></div></div><div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else if (activeSection === 'policies') {
    const p = ss.policies;
    body = `<form method="POST" action="/dashboard/settings/save" class="osa-form-grid"><input type="hidden" name="section" value="policies"><div class="osa-block"><div class="osa-field"><label for="policyTerms">Terms and conditions (${policyStatus(p.terms)})</label><textarea id="policyTerms" name="policyTerms">${escapeHtml(p.terms)}</textarea></div><div class="osa-field"><label for="policyShipping">Shipping policy (${policyStatus(p.shipping)})</label><textarea id="policyShipping" name="policyShipping">${escapeHtml(p.shipping)}</textarea></div><div class="osa-field"><label for="policyPayment">Payment policy (${policyStatus(p.payment)})</label><textarea id="policyPayment" name="policyPayment">${escapeHtml(p.payment)}</textarea></div><div class="osa-field"><label for="policyReturnRefund">Return and refund policy (${policyStatus(p.returnRefund)})</label><textarea id="policyReturnRefund" name="policyReturnRefund">${escapeHtml(p.returnRefund)}</textarea></div><div class="osa-field"><label for="policyPrivacy">Privacy policy (${policyStatus(p.privacy)})</label><textarea id="policyPrivacy" name="policyPrivacy">${escapeHtml(p.privacy)}</textarea></div></div><div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  } else {
    const about = ss.aboutUs;
    body = `<form method="POST" action="/dashboard/settings/save" class="osa-form-grid"><input type="hidden" name="section" value="about-us"><div class="osa-block"><div class="osa-field"><label for="aboutTitle">About Us title</label><input id="aboutTitle" name="aboutTitle" value="${escapeHtml(about.title)}"></div><div class="osa-field"><label for="aboutContent">About Us content</label><textarea id="aboutContent" name="aboutContent">${escapeHtml(about.content)}</textarea></div></div><div class="osa-actions"><button class="osa-btn" type="submit">Save</button></div></form>`;
  }

  return `<section class="osa-card osa-form-panel"><div class="osa-form-head"><h2>${escapeHtml(meta.label)}</h2><p>Each submenu is dedicated to one area so setting up the store feels simple, even for first-time users.</p></div>${body}</section>`;
}

module.exports = {
  adminStyles,
  renderAdminLayout,
  DISPLAY_SETTINGS_SECTIONS,
  STORE_SETTINGS_SECTIONS,
  sanitizeThemeField,
  checkboxValue,
  pickDisplaySection,
  pickStoreSettingsSection,
  getDashboardReturnTo,
  onlineStoreAdminStyles,
  storeAdminPanelStyles,
  renderOnlineStoreAdminLayout,
  renderSuperAdminLayout,
  renderDisplayToggle,
  renderDisplaySectionNav,
  renderDisplaySettingsSection,
  renderStoreSettingsSectionNav,
  renderStoreSettingsSection
};
