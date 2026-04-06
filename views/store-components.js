const { escapeHtml } = require('../helpers/html');
const { ensureStoreSettings } = require('../services/db');

function renderTopBar(cfg) {
  if (cfg.announcementEnabled === false) return '';
  const text = (cfg.topBarText || '').trim();
  if (!text) return '';
  const bg = cfg.topBarBg || '';
  const color = cfg.topBarColor || '';
  const styleAttr = bg || color ? ` style="${bg ? `background:${escapeHtml(bg)};` : ''}${color ? `color:${escapeHtml(color)};` : ''}"` : '';
  if (cfg.topBarMarquee !== false) {
    return `<div class="top-bar"${styleAttr}><div class="top-bar-track"><span class="top-bar-text">${escapeHtml(text)}</span><span class="top-bar-text" aria-hidden="true">${escapeHtml(text)}</span></div></div>`;
  }
  return `<div class="top-bar"${styleAttr}><div class="top-bar-static"><span class="top-bar-text">${escapeHtml(text)}</span></div></div>`;
}

function renderCategorySection(categories, slug, cfg) {
  if (cfg.showCategories === false) return '';
  if (!categories.length) return '';
  const layout = cfg.categoryLayout || 'auto';
  const style = cfg.categoryStyle || 'circle';
  const title = cfg.categoryTitle || 'Categories';
  const forceGrid = layout === 'grid' || style === 'grid';
  const isCarousel = layout === 'carousel' || (!forceGrid && (layout === 'auto' && categories.length >= 4));
  const base = `/store/${encodeURIComponent(slug)}`;
  if (style === 'pill') {
    return `<div class="app-section"><div class="app-section-head"><h2 class="app-section-title">${escapeHtml(title)}</h2><a href="${base}">View all</a></div><div class="cat-tags">${categories.map((cat) => {
      const img = cat.image ? `<img src="${escapeHtml(cat.image)}" alt="${escapeHtml(cat.name)}">` : `<div class="cat-icon pill-icon">${escapeHtml(cat.name.charAt(0).toUpperCase())}</div>`;
      return `<a class="cat-tag" href="${base}?category=${encodeURIComponent(cat.name)}">${img}${escapeHtml(cat.name)}</a>`;
    }).join('')}</div></div>`;
  }
  if (isCarousel) {
    return `<div class="app-section"><div class="app-section-head"><h2 class="app-section-title">${escapeHtml(title)}</h2><a href="${base}">View all</a></div><div class="cat-scroll">${categories.map((cat) => {
      const img = cat.image ? `<img class="cat-icon" src="${escapeHtml(cat.image)}" alt="${escapeHtml(cat.name)}">` : `<div class="cat-icon ${escapeHtml(style)}">${escapeHtml(cat.name.charAt(0).toUpperCase())}</div>`;
      return `<a class="cat-item" href="${base}?category=${encodeURIComponent(cat.name)}">${img}<span class="cat-label">${escapeHtml(cat.name)}</span></a>`;
    }).join('')}</div></div>`;
  }
  return `<div class="app-section"><div class="app-section-head"><h2 class="app-section-title">${escapeHtml(title)}</h2><a href="${base}">View all</a></div><div class="cat-grid">${categories.map((cat) => {
    const img = cat.image ? `<img class="cat-icon" src="${escapeHtml(cat.image)}" alt="${escapeHtml(cat.name)}">` : `<div class="cat-icon ${escapeHtml(style)}">${escapeHtml(cat.name.charAt(0).toUpperCase())}</div>`;
    return `<a class="cat-item grid-item" href="${base}?category=${encodeURIComponent(cat.name)}">${img}<span class="cat-label">${escapeHtml(cat.name)}</span></a>`;
  }).join('')}</div></div>`;
}

function renderBannerCarousel(cfg, slug) {
  if (cfg.showBanner === false) return '';
  const desktopImages = Array.isArray(cfg.bannerImages) ? cfg.bannerImages.filter(Boolean) : [];
  const mobileImages = Array.isArray(cfg.bannerImagesMobile) ? cfg.bannerImagesMobile.filter(Boolean) : [];
  const images = desktopImages.length ? desktopImages : [cfg.bannerImage || ''].filter(Boolean);
  if (!images.length) return '';
  const title = (cfg.bannerTitle || '').trim();
  const subtitle = (cfg.bannerSubtitle || '').trim();
  const cta = (cfg.bannerCta || '').trim();
  const base = `/store/${encodeURIComponent(slug)}`;
  return `<div class="app-banner">
    <div class="app-banner-slides">
      ${images.map((img) => `<div class="app-banner-slide"><img src="${escapeHtml(img)}" alt="${escapeHtml(title || 'Banner')}" loading="eager"></div>`).join('')}
      ${mobileImages.map((img) => `<div class="app-banner-slide app-banner-slide-mobile"><img src="${escapeHtml(img)}" alt="${escapeHtml(title || 'Banner')}" loading="eager"></div>`).join('')}
    </div>
    ${title || subtitle || cta ? `<div class="app-banner-content">${title ? `<h2 class="app-banner-title">${escapeHtml(title)}</h2>` : ''}${subtitle ? `<p class="app-banner-sub">${escapeHtml(subtitle)}</p>` : ''}${cta ? `<a class="app-banner-cta" href="${base}">${escapeHtml(cta)}</a>` : ''}</div>` : ''}
    ${images.length > 1 ? `<div class="app-banner-dots">${images.map((_, i) => `<button type="button" class="app-banner-dot${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="Go to slide ${i + 1}"></button>`).join('')}</div>` : ''}
  </div>
  <script>
  (function(){
    var s=document.querySelector('.app-banner-slides');
    if(!s)return;
    var slides=[].slice.call(s.querySelectorAll('.app-banner-slide:not(.app-banner-slide-mobile)'));
    var dots=[].slice.call(document.querySelectorAll('.app-banner-dot'));
    if(slides.length<2)return;
    var cur=0;
    function go(n){
      cur=(n+slides.length)%slides.length;
      s.style.transform='translateX(-'+cur*100+'%)';
      dots.forEach(function(d,i){d.classList.toggle('active',i===cur);});
    }
    s.style.transition='transform .3s ease';
    s.style.display='flex';
    slides.forEach(function(sl){sl.style.flex='0 0 100%'; sl.style.minWidth='100%';});
    dots.forEach(function(d){d.addEventListener('click',function(){go(+d.dataset.index);});});
    setInterval(function(){go(cur+1);},5000);
  })();
  </script>`;
}

function renderStoreFooterBlock(store, cfg) {
  if (cfg.showFooter === false) return '';
  const customText = String(cfg.footerText || '').trim();
  const text = customText || store.name;
  const powered = cfg.showPoweredBy !== false ? ' · Powered by MyShopBuilder' : '';
  return `<div class="store-footer">${escapeHtml(text)}${powered}</div>`;
}

function getStoreMetaTags(store, options) {
  const safe = options || {};
  const ss = ensureStoreSettings(store);
  const title = safe.title || ss.seoSettings.title || `Shop at ${store.name}`;
  const description = safe.description || ss.seoSettings.description || store.description || `Buy from ${store.name}`;
  const keywords = ss.seoSettings.keywords ? `<meta name="keywords" content="${escapeHtml(ss.seoSettings.keywords)}">` : '';
  const google = ss.seoSettings.googleSiteVerification ? `<meta name="google-site-verification" content="${escapeHtml(ss.seoSettings.googleSiteVerification)}">` : '';
  const facebook = ss.seoSettings.facebookDomainVerification ? `<meta name="facebook-domain-verification" content="${escapeHtml(ss.seoSettings.facebookDomainVerification)}">` : '';
  const pinterest = ss.seoSettings.pinterestDomainVerification ? `<meta name="p:domain_verify" content="${escapeHtml(ss.seoSettings.pinterestDomainVerification)}">` : '';
  const favicon = ss.storeDetails.favicon ? `<link rel="icon" href="${escapeHtml(ss.storeDetails.favicon)}">` : '';
  return `<meta name="description" content="${escapeHtml(description)}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:type" content="website">${keywords}${google}${facebook}${pinterest}${favicon}`;
}

function getRobotsTxt(store, req, slug) {
  const ss = ensureStoreSettings(store);
  const robots = ss.robotsSettings || {};
  if (robots.mode === 'advanced' && String(robots.customText || '').trim()) {
    return String(robots.customText || '').trim();
  }
  const host = `${req.protocol}://${req.get('host')}`;
  if (robots.blockAll) {
    return `User-agent: *\nDisallow: /`;
  }
  if (robots.homeOnly) {
    return `User-agent: *\nAllow: /store/${slug}\nDisallow: /store/${slug}/product\nDisallow: /store/${slug}/account\nDisallow: /store/${slug}/cart\nDisallow: /store/${slug}/checkout\nSitemap: ${host}/store/${slug}/sitemap.xml`;
  }
  return `User-agent: *\nAllow: /\nSitemap: ${host}/store/${slug}/sitemap.xml`;
}

function resolveStoreRedirect(store, relativePath) {
  const ss = ensureStoreSettings(store);
  const clean = '/' + String(relativePath || '').replace(/^\/+/, '');
  const match = (ss.urlRedirects || []).find((item) => ('/' + String(item.from || '').replace(/^\/+/, '')) === clean);
  return match ? String(match.to || '').trim() : '';
}

module.exports = {
  renderTopBar,
  renderCategorySection,
  renderBannerCarousel,
  renderStoreFooterBlock,
  getStoreMetaTags,
  getRobotsTxt,
  resolveStoreRedirect
};
