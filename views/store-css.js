const { escapeHtml } = require('../helpers/html');

function getThemeRadius(cfgBorderRadius) {
  if (cfgBorderRadius === 'sharp') return '0px';
  if (cfgBorderRadius === 'pill') return '999px';
  return '18px';
}

function getThemeBtnRadius(cfgBtnStyle) {
  if (cfgBtnStyle === 'sharp') return '0px';
  if (cfgBtnStyle === 'rounded') return '14px';
  return '999px';
}

function renderStoreCss(template, theme) {
  const safeTemplate = template || { colors: { primary: '#3b5bfd', secondary: '#06b6d4' } };
  const isDark = theme === 'dark';
  const pageBg = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#111827' : '#ffffff';
  const text = isDark ? '#f8fafc' : '#111827';
  const muted = isDark ? '#cbd5e1' : '#6b7280';
  return `
.store-page { min-height:100vh; background:radial-gradient(circle at top right, ${safeTemplate.colors.primary}22, transparent 35%), radial-gradient(circle at top left, ${safeTemplate.colors.secondary}22, transparent 32%), ${pageBg}; color:${text}; }
.store-wrap { width:min(1180px, calc(100% - 32px)); margin:0 auto; padding:28px 0 40px; }
.store-header { display:grid; grid-template-columns:auto 1fr auto; gap:18px; align-items:center; margin-bottom:24px; padding:24px; background:${cardBg}; border:1px solid rgba(255,255,255,.08); border-radius:24px; box-shadow:0 18px 40px rgba(15,23,42,.08); }
.store-logo { width:96px; height:96px; object-fit:cover; border-radius:24px; background:#f1f5f9; border:1px solid rgba(255,255,255,.12); }
.store-title { margin:0 0 8px; font-size:clamp(30px, 4vw, 44px); }
.store-desc { margin:0; color:${muted}; line-height:1.7; }
.store-hero-actions { display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
.store-pill { display:inline-flex; align-items:center; gap:8px; padding:10px 14px; border-radius:999px; background:${safeTemplate.colors.primary}12; color:${safeTemplate.colors.primary}; font-weight:800; font-size:13px; }
.store-grid { display:grid; gap:18px; grid-template-columns:repeat(3, minmax(0,1fr)); }
.store-card { padding:18px; background:${cardBg}; border-radius:22px; border:1px solid rgba(255,255,255,.08); box-shadow:0 18px 40px rgba(15,23,42,.08); display:flex; flex-direction:column; }
.store-card img { width:100%; aspect-ratio:1 / 1; object-fit:cover; border-radius:18px; margin-bottom:16px; background:#e5e7eb; }
.store-card h3 { margin:0 0 8px; font-size:20px; }
.store-card p { margin:0 0 14px; color:${muted}; line-height:1.6; }
.store-card-top { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
.store-card-actions { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:auto; }
.btn-outline { background:transparent; color:${safeTemplate.colors.primary}; border:1px solid ${safeTemplate.colors.primary}44; box-shadow:none; }
.wishlist-active { background:rgba(239,68,68,.12); color:#dc2626; border:1px solid rgba(239,68,68,.18); }
.store-nav { display:flex; gap:10px; flex-wrap:wrap; margin:0 0 18px; }
.store-nav a { padding:10px 14px; border-radius:14px; background:${cardBg}; border:1px solid rgba(255,255,255,.08); box-shadow:0 10px 22px rgba(15,23,42,.04); }
.product-detail { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
.product-detail img { width:100%; border-radius:24px; aspect-ratio:1 / 1; object-fit:cover; }
.product-meta { display:flex; gap:10px; flex-wrap:wrap; margin:12px 0 18px; }
.cart-page, .account-page, .checkout-page, .wishlist-page, .tracking-page { display:grid; gap:18px; }
.checkout-layout { display:grid; grid-template-columns:minmax(0, 1.15fr) minmax(320px, .85fr); gap:18px; align-items:start; }
.checkout-steps { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px; }
.checkout-step { padding:14px 16px; border-radius:18px; background:${cardBg}; border:1px solid rgba(255,255,255,.08); color:${muted}; }
.checkout-step.active { color:${text}; border-color:${safeTemplate.colors.primary}44; box-shadow:0 14px 30px rgba(15,23,42,.08); }
.checkout-step strong { display:block; margin-bottom:4px; color:inherit; }
.checkout-step span { font-size:13px; line-height:1.5; }
.checkout-form { margin-top:12px; }
.checkout-review { display:grid; gap:10px; margin-top:14px; }
.checkout-item { display:flex; justify-content:space-between; gap:12px; }
.checkout-item small { color:${muted}; display:block; margin-top:3px; }
.checkout-panel { position:sticky; top:18px; }
.summary-box { padding:18px; border-radius:18px; background:${cardBg}; border:1px solid rgba(255,255,255,.08); }
.summary-row { display:flex; justify-content:space-between; gap:10px; margin-bottom:10px; }
.price-row { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }
.price-tag { font-size:22px; font-weight:900; color:${safeTemplate.colors.primary}; }
.stock-tag { font-size:13px; font-weight:700; color:${muted}; }
.store-meta { display:flex; gap:12px; flex-wrap:wrap; margin-top:14px; }
.store-badge { padding:9px 12px; border-radius:999px; background:${safeTemplate.colors.primary}14; color:${safeTemplate.colors.primary}; font-weight:800; font-size:12px; }
.store-empty { padding:28px; border-radius:22px; background:${cardBg}; color:${muted}; text-align:center; border:1px solid rgba(255,255,255,.08); }
.store-footer { text-align:center; color:${muted}; padding-top:20px; }
@media (max-width: 920px) { .store-grid { grid-template-columns:repeat(2, minmax(0,1fr)); } }
@media (max-width: 640px) { .store-header { grid-template-columns:1fr; } .store-grid { grid-template-columns:1fr; } .product-detail { grid-template-columns:1fr; } .checkout-layout { grid-template-columns:1fr; } .checkout-steps { grid-template-columns:1fr; } .store-hero-actions { justify-content:flex-start; } }
`;
}

function getThemeCSS(template, theme, cfg) {
  const safeTemplate = template || { colors: { primary: '#3b5bfd', secondary: '#06b6d4' } };
  const primary = cfg.primaryColor || safeTemplate.colors.primary;
  const secondary = cfg.secondaryColor || safeTemplate.colors.secondary;
  const isDark = theme === 'dark';
  const bg = cfg.bgColor || (isDark ? '#0f172a' : '#f8fafc');
  const text = isDark ? '#f8fafc' : '#111827';
  const muted = isDark ? '#cbd5e1' : '#6b7280';
  const cardBg = isDark ? '#111827' : '#ffffff';
  const border = isDark ? '#1e293b' : '#eceff4';
  const btnColor = cfg.btnColor || primary;
  const headingFont = cfg.headingFont || 'Inter';
  const bodyFont = cfg.bodyFont || 'Inter';
  const radius = getThemeRadius(cfg.borderRadius);
  const btnRadius = getThemeBtnRadius(cfg.btnStyle);
  const layout = safeTemplate.layout || 'app';
  const customCss = cfg.customCss ? `\n${cfg.customCss}` : '';

  if (layout === 'app') {
    return `
  body, .store-page { background:${bg} !important; color:${text} !important; font-family:${bodyFont},system-ui,sans-serif !important; }
  .store-page { min-height:100vh; background:linear-gradient(180deg, ${bg}, ${isDark ? '#0b1220' : '#f6f8fc'}); color:${text}; padding-bottom:106px; }
  .store-wrap { width:min(1180px, calc(100% - 24px)); margin:0 auto; }
  .store-footer, .app-footer { display:${cfg.showFooter === false ? 'none' : 'block'} !important; }
  .app-shell { position:relative; }
  .app-page-overlay { position:fixed; inset:0; background:rgba(15,23,42,.42); opacity:0; pointer-events:none; transition:opacity .22s ease; z-index:72; }
  .app-shell.panel-open .app-page-overlay { opacity:1; pointer-events:auto; }
  .app-side-panel { position:fixed; top:0; bottom:0; width:min(88vw, 380px); background:${cardBg}; box-shadow:0 24px 60px rgba(15,23,42,.18); z-index:74; display:grid; grid-template-rows:auto 1fr auto; transition:transform .26s ease; }
  .app-side-panel-left { left:0; transform:translateX(-104%); }
  .app-side-panel-right { right:0; transform:translateX(104%); }
  .app-side-panel.is-open { transform:translateX(0); }
  .app-panel-head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:18px 18px 14px; border-bottom:1px solid ${border}; }
  .app-panel-head strong { font-size:18px; font-weight:900; font-family:${headingFont},system-ui,sans-serif; }
  .app-panel-close { width:42px; height:42px; border-radius:50%; border:1px solid ${border}; background:${cardBg}; color:${text}; font-size:22px; cursor:pointer; }
  .app-panel-scroll { overflow:auto; padding:16px 18px 18px; display:grid; gap:14px; }
  .app-panel-foot { border-top:1px solid ${border}; padding:14px 18px 18px; display:grid; gap:12px; background:${cardBg}; }
  .app-panel-brand { display:grid; grid-template-columns:44px 1fr; gap:12px; align-items:center; padding:14px; border-radius:18px; background:${primary}0d; }
  .app-panel-brand strong { display:block; font-size:15px; }
  .app-panel-brand span { display:block; color:${muted}; font-size:12px; margin-top:3px; line-height:1.5; }
  .app-panel-nav { display:grid; gap:8px; }
  .app-panel-nav a { padding:13px 14px; border-radius:14px; color:${text}; text-decoration:none; background:${isDark ? '#111827' : '#f8fafc'}; border:1px solid ${border}; font-weight:700; }
  .app-panel-section { display:grid; gap:10px; }
  .app-panel-label { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:${muted}; }
  .app-panel-tags { display:flex; flex-wrap:wrap; gap:8px; }
  .app-panel-tags a { padding:8px 12px; border-radius:999px; border:1px solid ${border}; color:${text}; text-decoration:none; font-size:12px; font-weight:700; }
  .app-panel-empty { min-height:260px; display:grid; place-items:center; text-align:center; gap:10px; padding:30px 8px; color:${muted}; }
  .app-panel-empty h3 { margin:0; color:${text}; font-size:22px; font-family:${headingFont},system-ui,sans-serif; }
  .app-panel-empty p { margin:0; line-height:1.6; }
  .app-panel-empty-icon { font-size:44px; opacity:.75; }
  .app-panel-actions { display:flex; gap:10px; flex-wrap:wrap; }
  .app-panel-total { display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:15px; font-weight:800; }
  .app-mini-line, .app-mini-card { display:grid; grid-template-columns:56px 1fr auto; gap:12px; align-items:center; text-decoration:none; color:${text}; padding:10px 0; border-bottom:1px solid ${border}; }
  .app-mini-card { grid-template-columns:56px 1fr; }
  .app-mini-line img, .app-mini-card img, .app-mini-thumb { width:56px; height:56px; object-fit:cover; border-radius:14px; background:${isDark ? '#111827' : '#eef2f7'}; }
  .app-mini-line strong, .app-mini-card strong { display:block; font-size:14px; margin-bottom:3px; }
  .app-mini-line span, .app-mini-card span { display:block; font-size:12px; color:${muted}; }
  .app-account-card { padding:16px; border-radius:18px; background:${primary}0f; display:grid; gap:4px; }
  .app-account-card strong { font-size:16px; }
  .app-account-card span { color:${muted}; font-size:13px; }
  .top-bar { width:100%; overflow:hidden; padding:10px 0; font-size:13px; font-weight:700; text-align:center; position:relative; }
  .top-bar-static { display:flex; justify-content:center; align-items:center; width:100%; padding:0 16px; }
  .top-bar-text { white-space:nowrap; padding:0 24px; }
  .top-bar-track { display:flex; width:max-content; animation:topbar-scroll 18s linear infinite; }
  @keyframes topbar-scroll { from { transform:translateX(0); } to { transform:translateX(-50%); } }
  .app-header { position:${cfg.headerSticky !== false ? 'sticky' : 'static'}; top:0; z-index:55; }
  .app-header-premium { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:14px; padding:14px 16px; background:${cardBg}; border-bottom:1px solid ${border}; }
  .app-brand-lockup { display:flex; align-items:center; justify-content:center; gap:10px; color:${text}; text-decoration:none; font-weight:900; font-family:${headingFont},system-ui,sans-serif; letter-spacing:-.02em; }
  .app-brand-lockup span { max-width:160px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .app-logo { width:34px; height:34px; border-radius:12px; object-fit:cover; background:#f1f5f9; }
  .app-logo-ph { width:34px; height:34px; border-radius:12px; background:${primary}14; display:grid; place-items:center; color:${primary}; font-weight:900; font-size:16px; }
  .app-actions { display:flex; gap:8px; justify-content:flex-end; }
  .app-icon-btn, .app-filter-btn, .app-circle-ghost { width:42px; height:42px; border-radius:50%; border:1px solid ${border}; background:${cardBg}; color:${text}; display:grid; place-items:center; font-size:18px; cursor:pointer; position:relative; transition:transform .18s ease, background .18s ease; }
  .app-icon-btn.ghost { background:transparent; }
  .app-icon-btn:hover, .app-filter-btn:hover, .app-circle-ghost:hover { transform:translateY(-1px); background:${primary}0a; }
  .app-badge { position:absolute; top:-4px; right:-2px; min-width:18px; height:18px; border-radius:999px; padding:0 4px; background:${primary}; color:#fff; display:grid; place-items:center; font-size:10px; font-weight:800; }
  .app-search-section { padding:14px 16px 10px; }
  .app-search-shell { display:grid; grid-template-columns:1fr auto; gap:12px; align-items:center; }
  .app-search-form { display:flex; align-items:center; gap:10px; padding:0 16px; min-height:56px; border-radius:999px; background:${isDark ? '#111827' : '#eef2ff'}; border:1px solid ${border}; }
  .app-search-form svg { width:18px; height:18px; stroke:${muted}; fill:none; stroke-width:1.9; stroke-linecap:round; stroke-linejoin:round; }
  .app-search-form input { width:100%; border:0; background:transparent; outline:none; color:${text}; font-size:15px; }
  .app-filter-btn { border-radius:18px; width:56px; height:56px; background:#131a2b; color:#fff; border:0; }
  .app-section { padding:18px 16px; }
  .app-eyebrow { display:inline-block; margin-bottom:6px; color:${primary}; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.12em; }
  .app-section-title { margin:0; font-size:clamp(20px, 3vw, 28px); font-weight:900; letter-spacing:-.03em; font-family:${headingFont},system-ui,sans-serif; }
  .app-rail-head { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; margin-bottom:14px; }
  .app-rail-head a { color:${primary}; text-decoration:none; font-size:13px; font-weight:800; }
  .app-feature-hero { position:relative; margin:8px 16px 10px; border-radius:28px; overflow:hidden; min-height:420px; background:linear-gradient(180deg, ${primary}22, ${secondary}18); box-shadow:0 28px 60px rgba(15,23,42,.18); }
  .app-feature-media, .app-feature-media img { width:100%; height:100%; min-height:420px; object-fit:cover; display:block; }
  .app-feature-overlay { position:absolute; inset:0; display:flex; flex-direction:column; justify-content:flex-end; gap:10px; padding:28px 24px; background:linear-gradient(180deg, rgba(7,11,19,.06), rgba(7,11,19,.75)); color:#fff; }
  .app-feature-overlay h1 { margin:0; font-size:clamp(30px, 7vw, 54px); line-height:.95; font-weight:900; font-family:${headingFont},system-ui,sans-serif; text-transform:uppercase; letter-spacing:-.04em; max-width:10ch; }
  .app-feature-overlay p { margin:0; max-width:46ch; color:rgba(255,255,255,.88); line-height:1.6; }
  .app-feature-actions { display:flex; gap:10px; flex-wrap:wrap; }
  .app-empty-hero { border-radius:28px; background:${cardBg}; padding:32px 24px; box-shadow:0 18px 40px rgba(15,23,42,.08); border:1px solid ${border}; }
  .app-empty-hero h2 { margin:0 0 10px; font-size:28px; font-family:${headingFont},system-ui,sans-serif; }
  .app-empty-hero p { margin:0; color:${muted}; line-height:1.7; }
  .cat-scroll, .app-horizontal-cards { display:grid; grid-auto-flow:column; grid-auto-columns:minmax(180px, 74%); gap:14px; overflow:auto; padding-bottom:4px; scrollbar-width:none; }
  .cat-scroll::-webkit-scrollbar, .app-horizontal-cards::-webkit-scrollbar { display:none; }
  .cat-item { display:flex; flex-direction:column; align-items:center; gap:8px; min-width:68px; text-decoration:none; color:${text}; }
  .cat-item.grid-item { min-width:0; }
  .cat-icon { width:68px; height:68px; border-radius:50%; background:${primary}12; display:grid; place-items:center; font-size:24px; transition:transform .2s, box-shadow .2s; border:1px solid ${primary}14; }
  .cat-icon.square { border-radius:22px; }
  .cat-item:hover .cat-icon { transform:scale(1.06); box-shadow:0 8px 22px ${primary}22; }
  .cat-label { font-size:11px; font-weight:700; text-align:center; color:${text}; line-height:1.25; max-width:74px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .app-grid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:14px; }
  .app-grid.list-layout { grid-template-columns:1fr; }
  .app-card { background:${cardBg}; border-radius:24px; overflow:hidden; border:1px solid ${border}; text-decoration:none; color:${text}; display:flex; flex-direction:column; box-shadow:0 18px 34px rgba(15,23,42,.06); }
  .app-card.compact { min-width:220px; }
  .app-card-figure { position:relative; }
  .app-card-img { width:100%; aspect-ratio:0.85/1; object-fit:cover; background:${isDark ? '#0f172a' : '#f1f5f9'}; }
  .app-card-empty, .app-product-placeholder { display:grid; place-items:center; color:${muted}; background:${isDark ? '#0f172a' : '#eef2f7'}; }
  .app-card-body { padding:12px 14px 10px; display:flex; flex-direction:column; gap:6px; }
  .app-card-body h3 { margin:0; font-size:15px; font-weight:900; line-height:1.35; min-height:40px; font-family:${headingFont},system-ui,sans-serif; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .product-rating { color:${primary}; font-size:11px; font-weight:800; letter-spacing:.02em; }
  .app-card-price { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .app-card-body .price { font-size:18px; font-weight:900; color:${text}; }
  .app-card-body .old-price { font-size:12px; color:${muted}; text-decoration:line-through; }
  .app-card-body .stock { display:inline-flex; width:max-content; align-items:center; gap:6px; font-size:11px; font-weight:800; color:${muted}; background:${primary}0d; padding:5px 8px; border-radius:999px; }
  .app-card-actions { display:grid; grid-template-columns:1fr auto; gap:8px; padding:0 14px 14px; }
  .app-card-actions form { margin:0; }
  .primary-btn { width:100%; min-height:42px; padding:0 14px; border:0; border-radius:${btnRadius}; background:linear-gradient(135deg, ${btnColor}, ${secondary}); color:#fff; font-weight:900; font-size:12px; letter-spacing:.04em; text-transform:uppercase; cursor:pointer; box-shadow:0 10px 24px ${btnColor}33; }
  .primary-btn:hover { filter:brightness(1.06); }
  .app-mini-icon { width:42px; height:42px; border-radius:16px; border:1px solid ${border}; background:${cardBg}; color:${text}; font-size:18px; cursor:pointer; }
  .app-mini-icon.wishlist-active, .wishlist-active { background:rgba(239,68,68,.12); color:#dc2626; border-color:rgba(239,68,68,.18); }
  .app-sale-badge { position:absolute; top:12px; left:12px; background:#10b981; color:#fff; padding:6px 10px; border-radius:999px; font-size:11px; font-weight:900; z-index:2; }
  .cat-grid .cat-item { padding:12px 8px; border-radius:18px; background:${cardBg}; border:1px solid ${border}; }
  .flash-strip { display:flex; align-items:center; gap:12px; padding:14px 16px; border-radius:20px; background:linear-gradient(135deg, ${primary}12, ${secondary}0f); border:1px solid ${primary}22; }
  .flash-title { display:flex; align-items:center; gap:6px; font-size:14px; font-weight:900; }
  .flash-timer { display:flex; align-items:center; gap:6px; font-size:13px; color:${muted}; margin-left:auto; }
  .flash-timer strong { min-width:24px; text-align:center; background:${cardBg}; padding:4px 6px; border-radius:8px; color:${primary}; font-size:13px; }
  .btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:46px; padding:12px 18px; border:0; border-radius:${btnRadius}; background:linear-gradient(135deg, ${btnColor}, ${secondary}); color:#fff; font-weight:800; cursor:pointer; text-decoration:none; box-shadow:0 12px 24px ${btnColor}26; }
  .btn-secondary { background:${cardBg}; color:${text}; border:1px solid ${border}; box-shadow:none; }
  .btn-outline { background:transparent; color:${primary}; border:1px solid ${primary}44; box-shadow:none; }
  .store-empty { padding:34px 20px; border-radius:24px; background:${cardBg}; color:${muted}; text-align:center; border:1px solid ${border}; }
  .store-footer { text-align:center; color:${muted}; padding:18px 16px 8px; font-size:13px; }
  .app-bottom-nav { display:flex; position:fixed; left:10px; right:10px; bottom:10px; gap:6px; align-items:stretch; background:${cardBg}; border:1px solid ${border}; box-shadow:0 -10px 30px rgba(15,23,42,.12); z-index:60; padding:8px; }
  .app-bottom-nav a, .app-bottom-nav button { flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; padding:10px 4px; border-radius:16px; background:transparent; border:0; color:${muted}; font-size:11px; font-weight:700; text-decoration:none; cursor:pointer; }
  .app-bottom-nav a.active, .app-bottom-nav button.active { color:${primary}; background:${primary}10; }
  .app-bottom-nav svg { width:21px; height:21px; stroke:currentColor; fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
  .app-float-wa { position:fixed; right:16px; bottom:96px; width:58px; height:58px; border-radius:50%; background:#25D366; color:#fff; display:grid; place-items:center; font-size:24px; box-shadow:0 14px 28px rgba(37,211,102,.3); z-index:61; text-decoration:none; }
  .app-product-page { display:grid; gap:16px; padding:0 16px 18px; }
  .app-product-gallery { margin-top:4px; }
  .app-product-media { position:relative; overflow:hidden; border-radius:28px; background:${cardBg}; border:1px solid ${border}; box-shadow:0 18px 42px rgba(15,23,42,.08); }
  .app-product-media img { width:100%; aspect-ratio:.88/1; object-fit:cover; display:block; }
  .app-product-thumbs { display:flex; gap:10px; overflow:auto; margin-top:12px; padding-bottom:2px; }
  .app-thumb-btn { width:68px; height:68px; padding:0; border-radius:18px; overflow:hidden; border:2px solid ${border}; background:${cardBg}; cursor:pointer; }
  .app-thumb-btn img { width:100%; height:100%; object-fit:cover; }
  .app-share-btn { position:absolute; top:14px; right:14px; background:rgba(17,24,39,.72); color:#fff; border:0; }
  .app-product-badge { position:absolute; left:14px; top:14px; background:#10b981; color:#fff; padding:6px 10px; border-radius:999px; font-size:11px; font-weight:900; z-index:2; }
  .app-product-copy { display:grid; gap:14px; }
  .app-variant-group { display:grid; gap:8px; }
  .app-variant-label { font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; color:${muted}; }
  .app-variant-options { display:flex; flex-wrap:wrap; gap:8px; }
  .app-variant-option input { position:absolute; opacity:0; pointer-events:none; }
  .variant-chip { display:inline-flex; align-items:center; justify-content:center; min-height:40px; padding:0 14px; border-radius:999px; background:${cardBg}; border:1px solid ${border}; font-size:13px; font-weight:800; cursor:pointer; }
  .app-variant-option input:checked + .variant-chip { background:${primary}; color:#fff; border-color:${primary}; }
  .app-product-meta-row, .app-badge-stack { display:flex; gap:8px; flex-wrap:wrap; }
  .app-rating-pill, .app-inline-badge { display:inline-flex; align-items:center; gap:6px; padding:8px 12px; border-radius:999px; background:${cardBg}; border:1px solid ${border}; font-size:12px; font-weight:800; }
  .app-rating-pill.success { color:#047857; border-color:rgba(16,185,129,.22); background:rgba(16,185,129,.08); }
  .app-rating-pill.danger { color:#b91c1c; border-color:rgba(239,68,68,.2); background:rgba(239,68,68,.08); }
  .app-product-title { margin:0; font-size:clamp(28px, 7vw, 44px); line-height:.98; font-weight:900; letter-spacing:-.04em; font-family:${headingFont},system-ui,sans-serif; }
  .app-product-price-row { display:flex; justify-content:space-between; align-items:flex-end; gap:12px; }
  .app-product-price { font-size:34px; font-weight:900; line-height:1; color:${text}; }
  .app-product-compare { margin-top:6px; color:${muted}; text-decoration:line-through; font-size:14px; }
  .app-save-pill { padding:9px 12px; border-radius:999px; background:${primary}14; color:${primary}; font-size:12px; font-weight:900; }
  .app-product-subcopy { margin:0; color:${muted}; line-height:1.7; }
  .app-qty-card { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:14px 16px; border-radius:22px; background:${cardBg}; border:1px solid ${border}; }
  .app-qty-card strong { display:block; font-size:14px; }
  .app-qty-card span { display:block; margin-top:3px; font-size:12px; color:${muted}; }
  .app-qty-stepper { display:flex; align-items:center; gap:8px; }
  .app-qty-stepper button { width:34px; height:34px; border-radius:12px; border:1px solid ${border}; background:${isDark ? '#111827' : '#f8fafc'}; color:${text}; font-size:18px; cursor:pointer; }
  .app-qty-stepper input { width:52px; text-align:center; border:0; background:transparent; color:${text}; font-size:16px; font-weight:800; outline:none; }
  .app-product-actions { display:grid; grid-template-columns:1fr 1fr auto; gap:10px; }
  .app-grow-form { display:block; }
  .app-cta-btn { min-height:48px; font-size:13px; }
  .app-checkout-strip { padding:14px 16px; border-radius:22px; background:linear-gradient(135deg, ${primary}0d, ${secondary}0b); border:1px solid ${primary}18; }
  .app-checkout-strip strong { display:block; margin-bottom:5px; font-size:13px; text-transform:uppercase; letter-spacing:.08em; }
  .app-payment-mini { color:${muted}; font-size:13px; }
  .app-service-grid { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px; }
  .app-service-chip { padding:14px 12px; border-radius:20px; background:${cardBg}; border:1px solid ${border}; display:grid; gap:5px; }
  .app-service-chip strong { font-size:13px; }
  .app-service-chip span { color:${muted}; font-size:12px; line-height:1.5; }
  .app-accordion-list { display:grid; gap:10px; }
  .app-accordion { border:1px solid ${border}; border-radius:18px; background:${cardBg}; overflow:hidden; }
  .app-accordion summary { list-style:none; cursor:pointer; padding:16px 18px; font-weight:800; font-family:${headingFont},system-ui,sans-serif; }
  .app-accordion summary::-webkit-details-marker { display:none; }
  .app-accordion div { padding:0 18px 18px; color:${muted}; line-height:1.7; }
  .app-review-shell { display:grid; gap:12px; margin-bottom:16px; }
  .app-review-card { padding:16px 18px; border-radius:20px; background:${cardBg}; border:1px solid ${border}; }
  .app-review-card p { margin:10px 0 0; color:${muted}; line-height:1.7; }
  .app-review-card small { display:block; margin-top:10px; color:${muted}; }
  .app-review-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
  .app-review-form { display:grid; gap:10px; }
  .app-review-form textarea, .app-review-form input, .app-review-form select { width:100%; border:1px solid ${border}; background:${cardBg}; border-radius:14px; padding:12px 14px; outline:none; }
  .app-related-grid { grid-auto-columns:minmax(210px, 74%); }
  .app-sticky-buybar { position:fixed; left:12px; right:12px; bottom:82px; z-index:62; display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; align-items:center; padding:12px; border-radius:24px; background:rgba(255,255,255,.92); backdrop-filter:blur(14px); border:1px solid rgba(226,232,240,.8); box-shadow:0 18px 40px rgba(15,23,42,.16); }
  .app-sticky-buybar small { display:block; color:${muted}; font-size:11px; }
  .app-sticky-buybar strong { display:block; font-size:18px; font-weight:900; color:${text}; }
  .app-sticky-buybar form, .app-sticky-buybar a { margin:0; }
  .store-nav { display:flex; gap:10px; flex-wrap:wrap; margin:0 0 18px; }
  .store-nav a { padding:10px 14px; border-radius:14px; background:${cardBg}; border:1px solid ${border}; box-shadow:0 10px 22px rgba(15,23,42,.04); color:${text}; text-decoration:none; }
  .store-nav a.active { background:${primary}; color:#fff; }
  .store-header { display:grid; grid-template-columns:auto 1fr auto; gap:18px; align-items:center; margin-bottom:24px; padding:24px; background:${cardBg}; border:1px solid ${border}; border-radius:24px; box-shadow:0 18px 40px rgba(15,23,42,.08); }
  .store-logo { width:96px; height:96px; object-fit:cover; border-radius:24px; background:#f1f5f9; border:1px solid rgba(255,255,255,.12); }
  .store-logo-ph { width:96px; height:96px; border-radius:24px; background:${primary}14; display:grid; place-items:center; color:${primary}; font-weight:900; font-size:40px; }
  .store-title { margin:0 0 8px; font-size:clamp(30px, 4vw, 44px); font-family:${headingFont},system-ui,sans-serif; }
  .store-desc { margin:0; color:${muted}; line-height:1.7; }
  .store-hero-actions { display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
  .store-pill, .store-badge { display:inline-flex; align-items:center; gap:8px; padding:10px 14px; border-radius:999px; background:${primary}12; color:${primary}; font-weight:800; font-size:13px; }
  .store-grid { display:grid; gap:18px; grid-template-columns:repeat(3, minmax(0,1fr)); }
  .store-card { padding:18px; background:${cardBg}; border-radius:22px; border:1px solid ${border}; box-shadow:0 18px 40px rgba(15,23,42,.08); display:flex; flex-direction:column; }
  .store-card img { width:100%; aspect-ratio:1 / 1; object-fit:cover; border-radius:18px; margin-bottom:16px; background:#e5e7eb; }
  .store-card h3 { margin:0 0 8px; font-size:20px; font-family:${headingFont},system-ui,sans-serif; }
  .store-card p { margin:0 0 14px; color:${muted}; line-height:1.6; }
  .store-card-actions { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:auto; }
  .product-detail { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
  .product-detail img { width:100%; border-radius:24px; aspect-ratio:1 / 1; object-fit:cover; }
  .product-meta { display:flex; gap:10px; flex-wrap:wrap; margin:12px 0 18px; }
  .cart-page, .account-page, .checkout-page, .wishlist-page, .tracking-page { display:grid; gap:18px; }
  .checkout-layout { display:grid; grid-template-columns:minmax(0, 1.15fr) minmax(320px, .85fr); gap:18px; align-items:start; }
  .checkout-steps { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px; }
  .checkout-step { padding:14px 16px; border-radius:18px; background:${cardBg}; border:1px solid ${border}; color:${muted}; }
  .checkout-step.active { color:${text}; border-color:${primary}44; box-shadow:0 14px 30px rgba(15,23,42,.08); }
  .checkout-step strong { display:block; margin-bottom:4px; color:inherit; }
  .checkout-step span { font-size:13px; line-height:1.5; }
  .checkout-form { margin-top:12px; }
  .checkout-review { display:grid; gap:10px; margin-top:14px; }
  .checkout-item { display:flex; justify-content:space-between; gap:12px; }
  .checkout-item small { color:${muted}; display:block; margin-top:3px; }
  .checkout-panel { position:sticky; top:18px; }
  .summary-box { padding:18px; border-radius:18px; background:${cardBg}; border:1px solid ${border}; }
  .summary-row { display:flex; justify-content:space-between; gap:10px; margin-bottom:10px; }
  .price-row { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }
  .price-tag { font-size:22px; font-weight:900; color:${primary}; }
  .stock-tag { font-size:13px; font-weight:700; color:${muted}; }
  .app-banner { position:relative; margin:14px 16px; border-radius:26px; overflow:hidden; background:linear-gradient(135deg, ${primary}12, ${secondary}12); box-shadow:0 24px 48px rgba(15,23,42,.12); }
  .app-banner-slides { display:flex; width:100%; }
  .app-banner-slide { flex:0 0 100%; min-width:100%; position:relative; }
  .app-banner-slide img { width:100%; aspect-ratio:16/7; object-fit:cover; display:block; }
  .app-banner-slide-mobile { display:none; }
  .app-banner-content { position:absolute; inset:auto 18px 18px 18px; z-index:2; }
  .app-banner-title { margin:0 0 6px; font-size:clamp(20px, 3vw, 28px); font-weight:900; color:#fff; font-family:${headingFont},system-ui,sans-serif; text-shadow:0 2px 8px rgba(0,0,0,.18); }
  .app-banner-sub { margin:0 0 12px; font-size:14px; color:rgba(255,255,255,.88); }
  .app-banner-cta { display:inline-block; padding:10px 18px; border-radius:999px; background:${btnColor}; color:#fff; font-weight:800; font-size:13px; text-decoration:none; box-shadow:0 10px 20px ${btnColor}33; }
  .app-banner-dots { position:absolute; bottom:12px; right:16px; display:flex; gap:6px; z-index:2; }
  .app-banner-dot { width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,.35); border:0; cursor:pointer; }
  .app-banner-dot.active { background:#fff; }
  @media (max-width: 920px) { .store-grid { grid-template-columns:repeat(2, minmax(0,1fr)); } .app-service-grid { grid-template-columns:1fr 1fr 1fr; } }
  @media (max-width: 760px) { .app-banner-slide-mobile { display:block; } .app-banner-slide:not(.app-banner-slide-mobile) { display:none; } }
  @media (max-width: 640px) { .store-wrap { width:min(100%, calc(100% - 20px)); } .app-feature-hero { min-height:440px; } .app-feature-media, .app-feature-media img { min-height:440px; } .store-header { grid-template-columns:1fr; } .store-grid { grid-template-columns:1fr 1fr; } .app-grid { grid-template-columns:1fr 1fr; } .product-detail, .checkout-layout { grid-template-columns:1fr; } .checkout-steps { grid-template-columns:1fr; } .store-hero-actions { justify-content:flex-start; } .app-service-grid { grid-template-columns:1fr; } .app-product-actions { grid-template-columns:1fr 1fr auto; } .app-sticky-buybar { grid-template-columns:1fr 1fr; bottom:84px; } .app-sticky-buybar > div:first-child { grid-column:1 / -1; } .app-bottom-nav { display:flex; } .app-float-wa { bottom:154px; } }
  @media (max-width: 420px) { .app-grid, .store-grid { grid-template-columns:1fr 1fr; gap:12px; } .app-card-body h3 { font-size:14px; } .app-feature-overlay h1 { font-size:34px; } }
  ${customCss}`;
  }
  if (layout === 'minimal') {
    return `
  body, .store-page { background:${bg} !important; color:${text} !important; font-family:${bodyFont},system-ui,sans-serif !important; }
  .store-footer, .app-footer { display:${cfg.showFooter === false ? 'none' : 'block'} !important; }
  .app-top-bar, .top-bar { display:${cfg.topBarText && cfg.topBarText.trim() ? '' : 'none'}; }
  .top-bar { width:100%; overflow:hidden; padding:10px 0; font-size:13px; font-weight:700; text-align:center; position:relative; }
  .top-bar-static { display:flex; justify-content:center; align-items:center; width:100%; padding:0 16px; }
  .top-bar-text { white-space:nowrap; padding:0 24px; }
  .top-bar-track { display:flex; width:max-content; animation:topbar-scroll 18s linear infinite; }
  @keyframes topbar-scroll { from { transform:translateX(0); } to { transform:translateX(-50%); } }
  .store-page { min-height:100vh; background:radial-gradient(circle at top right, ${primary}22, transparent 35%), radial-gradient(circle at top left, ${secondary}22, transparent 32%), ${bg}; color:${text}; }
  .store-wrap { width:min(1180px, calc(100% - 32px)); margin:0 auto; padding:28px 0 40px; }
  .store-header { display:grid; grid-template-columns:auto 1fr auto; gap:18px; align-items:center; margin-bottom:24px; padding:24px; background:${cardBg}; border:1px solid rgba(255,255,255,.08); border-radius:24px; box-shadow:0 18px 40px rgba(15,23,42,.08); }
  .store-logo { width:96px; height:96px; object-fit:cover; border-radius:24px; background:#f1f5f9; border:1px solid rgba(255,255,255,.12); }
  .store-logo-ph { width:96px; height:96px; border-radius:24px; background:${primary}14; display:grid; place-items:center; color:${primary}; font-weight:900; font-size:48px; }
  .store-title { margin:0 0 8px; font-size:clamp(30px, 4vw, 44px); font-family:${headingFont},system-ui,sans-serif; }
  .store-desc { margin:0; color:${muted}; line-height:1.7; }
  .store-hero-actions { display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
  .store-pill { display:inline-flex; align-items:center; gap:8px; padding:10px 14px; border-radius:999px; background:${primary}12; color:${primary}; font-weight:800; font-size:13px; }
  .store-meta { display:flex; gap:12px; flex-wrap:wrap; margin-top:14px; }
  .store-badge { padding:9px 12px; border-radius:999px; background:${primary}14; color:${primary}; font-weight:800; font-size:12px; }
  .store-grid { display:grid; gap:18px; grid-template-columns:repeat(3, minmax(0,1fr)); }
  .store-card { padding:0; background:${cardBg}; border-radius:22px; border:1px solid rgba(255,255,255,.08); box-shadow:0 18px 40px rgba(15,23,42,.08); overflow:hidden; text-decoration:none; color:${text}; display:flex; flex-direction:column; }
  .store-card img { width:100%; aspect-ratio:1/1; object-fit:cover; }
  .store-card-body { padding:14px 16px 16px; flex:1; display:flex; flex-direction:column; }
  .store-card-body h3 { margin:0 0 6px; font-size:18px; font-family:${headingFont},system-ui,sans-serif; font-weight:800; }
  .store-card-body p { margin:0 0 14px; color:${muted}; font-size:14px; line-height:1.6; flex:1; }
  .price-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
  .price-tag { font-size:20px; font-weight:900; color:${primary}; }
  .stock-tag { font-size:12px; font-weight:700; color:${muted}; }
  .store-card-actions { display:grid; grid-template-columns:1fr auto; gap:8px; padding:0 16px 14px; }
  .store-card-actions button { min-height:40px; padding:0 16px; border-radius:${btnRadius}; border:0; background:linear-gradient(135deg, ${btnColor}, ${secondary}); color:#fff; font-weight:800; font-size:13px; cursor:pointer; }
  .store-card-actions .btn-outline { background:transparent; color:${primary}; border:1px solid ${primary}44; min-width:40px; padding:0 10px; }
  .store-card-actions .btn-outline.wishlist-active { background:rgba(239,68,68,.12); color:#dc2626; border-color:rgba(239,68,68,.18); }
  .store-empty { padding:28px; border-radius:22px; background:${cardBg}; color:${muted}; text-align:center; border:1px solid rgba(255,255,255,.08); }
  .store-footer { text-align:center; color:${muted}; padding-top:20px; }
  .store-nav { display:flex; gap:8px; flex-wrap:wrap; margin:0 0 16px; }
  .store-nav a { padding:8px 14px; border-radius:999px; background:${cardBg}; border:1px solid ${isDark ? '#334155' : '#e2e8f0'}; font-size:13px; font-weight:600; text-decoration:none; color:${text}; }
  .store-nav a.active { background:${primary}; color:#fff; }
  .app-section-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:0 0 14px; }
  .app-section-head a { font-size:13px; color:${primary}; text-decoration:none; font-weight:700; }
  .app-section-title { margin:0; font-size:16px; font-weight:900; letter-spacing:-.02em; font-family:${headingFont},system-ui,sans-serif; }
  .app-bottom-nav { display:grid; grid-template-columns:repeat(4,1fr); gap:0; position:fixed; bottom:0; left:0; right:0; background:${cardBg}; border-top:1px solid ${isDark ? '#1e293b' : '#eceff4'}; z-index:40; }
  .app-bottom-nav a { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; padding:8px 0; color:${muted}; font-size:11px; font-weight:600; text-decoration:none; transition:color .2s; }
  .app-bottom-nav a.active { color:${primary}; }
  .app-bottom-nav a svg { width:22px; height:22px; stroke:${muted}; fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; transition:stroke .2s; }
  .app-bottom-nav a.active svg { stroke:${primary}; }
  .app-bottom-nav.nav-modern { border-radius:24px; margin:0 12px 12px; border:1px solid ${isDark ? '#334155' : '#e2e8f0'}; box-shadow:0 -4px 20px rgba(0,0,0,.06); }
  .app-bottom-nav.nav-modern a { padding:12px 0; border-radius:18px; }
  .app-bottom-nav.nav-modern a.active { background:${primary}10; }
  .app-bottom-nav.nav-compact { border-radius:20px; margin:0 8px 8px; }
  .app-bottom-nav.nav-compact a { padding:10px 0; }
  .app-bottom-nav.nav-compact a span { display:none; }
  .app-float-wa { position:fixed; right:16px; bottom:76px; width:56px; height:56px; border-radius:50%; background:#25D366; color:#fff; display:grid; place-items:center; font-size:24px; box-shadow:0 8px 24px rgba(37,211,102,.3); z-index:38; text-decoration:none; transition:transform .2s; }
  .app-float-wa:hover { transform:scale(1.08); }
  @media (max-width: 920px) { .store-grid { grid-template-columns:repeat(2, minmax(0,1fr)); } }
  @media (max-width: 640px) { .store-header { grid-template-columns:1fr; } .store-grid { grid-template-columns:1fr; } }
  ${customCss}`;
  }

  return renderStoreCss(safeTemplate, theme) + customCss;
}

module.exports = {
  getThemeRadius,
  getThemeBtnRadius,
  renderStoreCss,
  getThemeCSS
};
