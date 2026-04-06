const { escapeHtml } = require('../helpers/html');

function renderHtmlShell(title, content, options) {
  const safeOptions = options || {};
  const pageTitle = escapeHtml(title || 'MyShopBuilder');
  const extraStyles = safeOptions.extraStyles || '';
  const bodyClass = escapeHtml(safeOptions.bodyClass || '');
  const metaTags = safeOptions.metaTags || '';
  const themeColor = escapeHtml(safeOptions.primaryColor || '#7c3aed');
  const storeSlug = escapeHtml(safeOptions.storeSlug || '');
  const storeName = escapeHtml(safeOptions.storeName || 'MyShopBuilder');
  const manifestPath = safeOptions.manifestPath || (storeSlug ? `/store/${storeSlug}/manifest.json` : '');
  const pixelId = String(safeOptions.trackingPixel || '').trim();
  const gaId = String(safeOptions.trackingGa || '').trim();
  const gtmId = String(safeOptions.trackingGtm || '').trim();
  const headExtras = safeOptions.headExtras || '';
  const bodyStart = safeOptions.bodyStart || '';
  const bodyEndScripts = safeOptions.bodyEndScripts || '';
  const manifestTags = manifestPath ? `
<link rel="manifest" href="${escapeHtml(manifestPath)}">
<meta name="theme-color" content="${themeColor}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${storeName}">` : '';
  const pixelScript = pixelId ? `
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${escapeHtml(pixelId)}');fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${escapeHtml(pixelId)}&ev=PageView&noscript=1"/></noscript>` : '';
  const gaScript = gaId ? `
<script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(gaId)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${escapeHtml(gaId)}');</script>` : '';
  const gtmHead = gtmId ? `
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${escapeHtml(gtmId)}');</script>` : '';
  const gtmBody = gtmId ? `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${escapeHtml(gtmId)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>` : '';
  const uiScript = `
<script>
(() => {
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.style.scrollBehavior = 'smooth';
  if (reduceMotion) return;

  const animateNumber = (el) => {
    const text = (el.textContent || '').trim();
    const match = text.match(/^([^\d-]*)(-?[\\d,]+(?:\\.\\d+)?)([^\\d]*)$/);
    if (!match) return;
    const prefix = match[1] || '';
    const suffix = match[3] || '';
    const target = Number(String(match[2]).replace(/,/g, ''));
    if (!Number.isFinite(target)) return;
    const start = performance.now();
    const duration = 720;
    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = prefix + Math.round(target * eased).toLocaleString('en-IN') + suffix;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const stagger = (selector, gap) => {
    document.querySelectorAll(selector).forEach((node, index) => {
      node.style.animationDelay = (index * gap) + 'ms';
      node.style.willChange = 'transform, opacity';
    });
  };

  stagger('.content-wrap > *, .card, .stat-card, .metric-card, .mini-card, .data-chip, .template-card, .flash', 50);
  document.querySelectorAll('.stat-value, .metric-value, .mini-number').forEach(animateNumber);
})();
</script>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pageTitle}</title>
${metaTags}
${manifestTags}
${pixelScript}
${gaScript}
${gtmHead}
${headExtras}
<style>
:root { --primary:#7c3aed; --secondary:#2563eb; --success:#10b981; --danger:#ef4444; --warning:#f59e0b; --whatsapp:#25D366; --text:#111827; --muted:#6b7280; --bg:#f5f7fb; --card:#ffffff; --border:#e5e7eb; --shadow:0 16px 40px rgba(15,23,42,0.08); --radius:18px; --topbar:60px; --sidebar:240px; font-family:Inter,system-ui,sans-serif; }
* { box-sizing:border-box; }
 html, body { margin:0; padding:0; background:var(--bg); color:var(--text); font-family:Inter,system-ui,sans-serif; scroll-behavior:smooth; }
 body { min-height:100vh; -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }
a { color:inherit; text-decoration:none; }
img { max-width:100%; display:block; }
button, input, textarea, select { font:inherit; }
.container { width:min(1120px, calc(100% - 32px)); margin:0 auto; }
.page { padding:32px 0; }
 .card { background:var(--card); border-radius:var(--radius); box-shadow:0 4px 20px rgba(0,0,0,0.05); border:1px solid rgba(229,231,235,0.75); will-change:transform, opacity; }
 .btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:44px; padding:12px 18px; border:0; border-radius:14px; background:linear-gradient(135deg, var(--primary), var(--secondary)); color:#fff; font-weight:700; cursor:pointer; transition:transform .2s ease, opacity .2s ease, box-shadow .2s ease, filter .2s ease; box-shadow:0 12px 24px rgba(124,58,237,.22); will-change:transform, opacity; }
 .btn:hover { transform:translateY(-1px) scale(1.03); opacity:.98; filter:saturate(1.05); }
 .btn:active { transform:translateY(0) scale(.97); }
.btn-secondary { background:#fff; color:var(--text); border:1px solid var(--border); box-shadow:none; }
.btn-danger { background:linear-gradient(135deg, #ef4444, #dc2626); }
.btn-success { background:linear-gradient(135deg, #10b981, #059669); }
.btn-whatsapp { width:100%; background:linear-gradient(135deg, #25D366, #128C7E); box-shadow:0 12px 24px rgba(37,211,102,.22); }
.form-grid { display:grid; gap:16px; }
.form-grid.two { grid-template-columns:repeat(2, minmax(0,1fr)); }
.field { display:grid; gap:8px; }
label { font-weight:700; font-size:14px; }
 input, textarea, select { width:100%; border:1px solid var(--border); background:#fff; border-radius:14px; padding:12px 14px; outline:none; transition:all .2s ease; will-change:transform, opacity; }
 textarea { min-height:110px; resize:vertical; }
 input:focus, textarea:focus, select:focus { border-color:var(--primary); box-shadow:0 0 0 4px rgba(124,58,237,.12); transform:translateY(-1px); }
 input::placeholder, textarea::placeholder { color:#94a3b8; transition:opacity .2s ease, color .2s ease; }
 input:focus::placeholder, textarea:focus::placeholder { opacity:.45; }
 .flash { margin-bottom:16px; border-radius:14px; padding:14px 16px; font-weight:700; will-change:transform, opacity; }
.flash-success { background:rgba(16,185,129,.12); color:#047857; border:1px solid rgba(16,185,129,.2); }
.flash-error { background:rgba(239,68,68,.12); color:#b91c1c; border:1px solid rgba(239,68,68,.2); }
.flash-info { background:rgba(37,99,235,.12); color:#1d4ed8; border:1px solid rgba(37,99,235,.2); }
.badge { display:inline-flex; align-items:center; gap:8px; padding:7px 12px; border-radius:999px; font-size:12px; font-weight:800; }
.badge-live { background:rgba(16,185,129,.12); color:#047857; }
.badge-pending { background:rgba(245,158,11,.14); color:#b45309; }
.badge-confirmed { background:rgba(37,99,235,.14); color:#1d4ed8; }
.badge-cancelled { background:rgba(239,68,68,.14); color:#b91c1c; }
.badge-delivered { background:rgba(16,185,129,.14); color:#047857; }
.table-wrap { width:100%; overflow-x:auto; }
table { width:100%; border-collapse:collapse; }
 th, td { text-align:left; padding:14px 12px; border-bottom:1px solid var(--border); vertical-align:top; transition:background-color .2s ease; }
 th { font-size:13px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
 tbody tr:hover td { background:#f8fbff; }
.stat-grid { display:grid; gap:16px; grid-template-columns:repeat(4, minmax(0,1fr)); }
 .stat-card { padding:22px; will-change:transform, opacity; }
.stat-label { color:var(--muted); font-size:14px; font-weight:700; }
.stat-value { margin-top:8px; font-size:30px; font-weight:800; }
.empty { padding:28px; text-align:center; color:var(--muted); border:1px dashed var(--border); border-radius:16px; }
.hero { display:grid; grid-template-columns:1.1fr .9fr; gap:24px; align-items:center; padding:36px; }
.hero h1 { margin:0 0 14px; font-size:clamp(36px, 4vw, 56px); line-height:1.02; }
.hero p { margin:0 0 24px; color:var(--muted); font-size:18px; line-height:1.6; }
.hero-card { padding:28px; background:radial-gradient(circle at top right, rgba(124,58,237,.18), rgba(37,99,235,.08), transparent 58%), #fff; }
.auth-wrap { min-height:100vh; display:grid; place-items:center; padding:24px; }
.auth-card { width:min(760px, 100%); padding:28px; }
.section-title { margin:0 0 8px; font-size:28px; }
.section-subtitle { margin:0 0 24px; color:var(--muted); }
.topbar { position:fixed; top:0; right:0; left:0; height:var(--topbar); display:flex; align-items:center; justify-content:space-between; background:#fff; border-bottom:1px solid #e2e8f0; z-index:50; padding:0 20px; }
.brand { font-size:20px; font-weight:900; letter-spacing:-.03em; }
.brand strong { color:var(--primary); }
.main { padding:24px; }
.panel { padding:24px; }
.panel + .panel { margin-top:20px; }
.actions { display:flex; flex-wrap:wrap; gap:10px; }
.grid-3 { display:grid; gap:18px; grid-template-columns:repeat(3, minmax(0,1fr)); }
.grid-2 { display:grid; gap:18px; grid-template-columns:repeat(2, minmax(0,1fr)); }
.product-thumb { width:70px; height:70px; border-radius:14px; object-fit:cover; background:#f1f5f9; border:1px solid var(--border); }
.logo-preview { width:84px; height:84px; border-radius:18px; object-fit:cover; background:#f1f5f9; border:1px solid var(--border); }
.inline-form { display:inline-flex; gap:8px; align-items:center; }
.status-select { min-width:140px; }
.kpi-list { display:grid; gap:14px; }
.kpi-item { display:flex; justify-content:space-between; gap:16px; padding:14px 0; border-bottom:1px solid var(--border); }
 .template-card { padding:20px; will-change:transform, opacity; }
.template-preview { height:120px; border-radius:16px; margin-bottom:16px; }
.public-url { display:inline-block; padding:12px 14px; border-radius:14px; background:#f8fafc; border:1px solid var(--border); word-break:break-all; }
.error-page { min-height:100vh; display:grid; place-items:center; padding:24px; }
.error-card { width:min(680px, 100%); padding:32px; text-align:center; }
.sales-popup-root { position:fixed; left:16px; bottom:96px; z-index:80; pointer-events:none; }
.sales-popup-card { min-width:240px; max-width:280px; background:#111827; color:#fff; padding:14px 16px; border-radius:18px; box-shadow:0 18px 40px rgba(15,23,42,.24); transform:translateY(30px); opacity:0; transition:all .28s ease; display:grid; gap:4px; }
.sales-popup-root.show .sales-popup-card { transform:translateY(0); opacity:1; }
.sales-popup-card strong { font-size:13px; }
.sales-popup-card span { font-size:12px; color:rgba(255,255,255,.82); line-height:1.5; }
 .muted { color:var(--muted); }
 ::-webkit-scrollbar { width:10px; height:10px; }
 ::-webkit-scrollbar-track { background:#eef2f7; }
 ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:999px; border:2px solid #eef2f7; }
 ::-webkit-scrollbar-thumb:hover { background:#94a3b8; }
  .card, .stat-card, .mini-card, .template-card, .data-chip, .flash { animation:fadeUp .45s ease both; }
  .content-wrap > * { animation:fadeUp .45s ease both; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation:none !important; transition:none !important; scroll-behavior:auto !important; } }
@media (max-width: 1024px) { .stat-grid { grid-template-columns:repeat(2, minmax(0,1fr)); } .grid-3 { grid-template-columns:repeat(2, minmax(0,1fr)); } .hero { grid-template-columns:1fr; } }
@media (max-width: 820px) { .form-grid.two, .grid-2, .grid-3, .stat-grid { grid-template-columns:1fr; } }
${extraStyles}
</style>
</head>
<body class="${bodyClass}">
${gtmBody}
${bodyStart}
${content}
${uiScript}
${bodyEndScripts}
</body>
</html>`;
}

module.exports = { renderHtmlShell };
