const { escapeHtml } = require('../helpers/html');
const { ensureStoreSettings } = require('../services/db');
const { renderAppThemeScaffold, renderAppProductCard } = require('./store-themes');

function resolveBuilderHref(base, rawHref) {
  const href = String(rawHref || '').trim();
  if (!href) return `${base}/shop`;
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
  if (href.startsWith('/')) return `${base}${href}`;
  return `${base}/${href.replace(/^\/+/, '')}`;
}

function getSectionProducts(store, section) {
  const settings = section.settings || {};
  const limit = Math.max(1, Math.min(24, Number(settings.limit || 8) || 8));
  const source = String(settings.source || 'featured').trim();
  const products = (Array.isArray(store.products) ? store.products : []).filter((product) => product.active !== false);
  if (source === 'latest') {
    return products.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, limit);
  }
  return products.slice(0, limit);
}

function renderHeroSection(base, store, section) {
  const settings = section.settings || {};
  const image = settings.image || (store.products[0] && store.products[0].image) || '';
  return `<section class="app-feature-hero" style="background:${escapeHtml(settings.backgroundColor || '#ffffff')};"><div class="app-feature-media">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(settings.title || store.name)}">` : '<div class="app-product-placeholder">No image</div>'}</div><div class="app-feature-overlay" style="text-align:${escapeHtml(settings.textAlign || 'left')};padding-top:${escapeHtml(String(settings.paddingTop || 48))}px;padding-bottom:${escapeHtml(String(settings.paddingBottom || 48))}px;"><h1>${escapeHtml(settings.title || store.name)}</h1>${settings.subtitle ? `<p>${escapeHtml(settings.subtitle)}</p>` : ''}<div class="app-feature-actions"><a class="btn" href="${resolveBuilderHref(base, settings.buttonLink || '/shop')}">${escapeHtml(settings.buttonText || 'Shop now')}</a></div></div></section>`;
}

function renderBannerSection(base, store, section) {
  const settings = section.settings || {};
  const image = settings.image || (store.products[0] && store.products[0].image) || '';
  return `<section class="app-banner"><div class="app-banner-slides"><div class="app-banner-slide">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(settings.title || store.name)}">` : '<div class="app-product-placeholder">No image</div>'}</div></div><div class="app-banner-content" style="text-align:${escapeHtml(settings.textAlign || 'left')};"><h2 class="app-banner-title">${escapeHtml(settings.title || 'Banner title')}</h2>${settings.subtitle ? `<p class="app-banner-sub">${escapeHtml(settings.subtitle)}</p>` : ''}${settings.buttonText ? `<a class="app-banner-cta" href="${resolveBuilderHref(base, settings.buttonLink || '/shop')}">${escapeHtml(settings.buttonText)}</a>` : ''}</div></section>`;
}

function renderCategoriesGridSection(base, store, section, categories) {
  const settings = section.settings || {};
  const limit = Math.max(1, Math.min(12, Number(settings.limit || 8) || 8));
  const visibleCategories = (Array.isArray(categories) ? categories : []).slice(0, limit);
  return `<section class="app-section"><div class="app-rail-head"><div><span class="app-eyebrow">Categories</span><h2 class="app-section-title">${escapeHtml(settings.title || 'Shop by category')}</h2>${settings.subtitle ? `<p class="section-muted">${escapeHtml(settings.subtitle)}</p>` : ''}</div><a href="${base}/categories">View all</a></div><div class="app-category-grid">${visibleCategories.map((category) => `<a class="app-category-card" href="${base}/shop?category=${encodeURIComponent(category.name)}"><div class="app-category-card-media">${category.image ? `<img src="${escapeHtml(category.image)}" alt="${escapeHtml(category.name)}">` : `<div class="app-category-card-ph">${escapeHtml(String(category.name || 'C').charAt(0).toUpperCase())}</div>`}</div><div class="app-category-card-body"><strong>${escapeHtml(category.name)}</strong><span>${escapeHtml(String((category.productIds || []).length || 0))} products</span></div></a>`).join('') || '<div class="store-empty">No categories yet.</div>'}</div></section>`;
}

function renderProductGridSection(base, store, section, cfg, labels, wishlist) {
  const settings = section.settings || {};
  const products = getSectionProducts(store, section);
  return `<section class="app-section"><div class="app-rail-head"><div><span class="app-eyebrow">Products</span><h2 class="app-section-title">${escapeHtml(settings.title || 'Featured products')}</h2>${settings.subtitle ? `<p class="section-muted">${escapeHtml(settings.subtitle)}</p>` : ''}</div><a href="${base}/shop">View all</a></div><div class="app-grid">${products.map((product) => renderAppProductCard(product, { base, wished: Array.isArray(wishlist) && wishlist.includes(product.id), cfg, labels, compact: false })).join('') || '<div class="store-empty">No products yet.</div>'}</div></section>`;
}

function renderRichTextSection(base, section) {
  const settings = section.settings || {};
  return `<section class="app-section"><div class="app-builder-rich-card" style="text-align:${escapeHtml(settings.textAlign || 'left')};background:${escapeHtml(settings.backgroundColor || '#ffffff')};"><h2 class="app-section-title">${escapeHtml(settings.title || 'Content section')}</h2>${settings.body ? `<p class="section-muted">${escapeHtml(settings.body)}</p>` : ''}${settings.buttonText ? `<div style="margin-top:16px;"><a class="btn" href="${resolveBuilderHref(base, settings.buttonLink || '/shop')}">${escapeHtml(settings.buttonText)}</a></div>` : ''}</div></section>`;
}

function renderBuilderSections(base, store, pageSchema, data) {
  const sections = Array.isArray(pageSchema && pageSchema.sections) ? pageSchema.sections : [];
  const cfg = data.cfg || {};
  const labels = ensureStoreSettings(store).labelSettings;
  return sections.map((section) => {
    if (!section || !section.type) return '';
    if (section.type === 'hero') return renderHeroSection(base, store, section);
    if (section.type === 'banner') return renderBannerSection(base, store, section);
    if (section.type === 'categories-grid') return renderCategoriesGridSection(base, store, section, data.categories || []);
    if (section.type === 'product-grid') return renderProductGridSection(base, store, section, cfg, labels, data.wishlist || []);
    return renderRichTextSection(base, section);
  }).join('');
}

function renderStoreBuilderPage(store, slug, pageSchema, data) {
  const base = data.storeBase !== undefined ? data.storeBase : '/store/' + encodeURIComponent(slug);
  const labels = ensureStoreSettings(store).labelSettings;
  const content = renderBuilderSections(base, store, pageSchema, data);
  return renderAppThemeScaffold(store, slug, {
    base,
    cfg: data.cfg || {},
    customer: data.customer,
    cartCount: data.cartCount || 0,
    wishlistCount: data.wishlistCount || 0,
    cartDetails: data.cartDetails || [],
    wishlistItems: data.wishlistItems || [],
    categories: data.categories || [],
    labels,
    search: data.search || '',
    filterState: data.filterState || {},
    activeNav: 'home',
    content,
    floatingWhatsapp: (data.cfg || {}).showWhatsappButton !== false
  });
}

module.exports = {
  renderStoreBuilderPage
};
