const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { loadDB, saveDB, ensureStoreSettings, removeStoredFile, saveUploadedFile, runUploader, DEFAULT_TEMPLATES, recordStoreVisit, findStoreCustomerByEmail, saveStoreCustomerFast, getPublishedStoreBuilderPage } = require('../services/db');
const { hashPassword, verifyPassword } = require('../services/password');
const { escapeHtml, slugify, formatDate, formatMoney, parsePrice, sanitizePhone, generateId, generateTrackingCode, generateOrderNumber, getBaseUrl, sanitizeInput } = require('../helpers/html');
const { validateEmail } = require('../helpers/validation');
const { setFlash, renderFlashMessages } = require('../helpers/flash');
const { getStatusBadge, getTemplateById, applyRoundingMode, getEffectiveShippingFee, getProductDisplayRating } = require('../helpers/store');
const { renderStoreCss, getThemeCSS } = require('../views/store-css');
const { renderStoreByTheme, renderAppProductPage, renderAppShopAllPage, renderAppCategoriesPage, renderAppBuilderStore } = require('../views/store-themes');
const { renderStoreBuilderPage } = require('../views/store-builder');
const { renderGlobalError } = require('../views/error-views');
const { renderHtmlShell } = require('../views/shell');
const { getStoreMetaTags, getRobotsTxt, resolveStoreRedirect } = require('../views/store-components');
const { getStoreCart, saveStoreCart, getStoreWishlist, saveStoreWishlist, getLoggedCustomer, setLoggedCustomer, clearLoggedCustomer, addProductToCart, removeProductFromCart, toggleWishlistProduct, getCartDetails, getCheckoutDraft, saveCheckoutDraft, clearCheckoutDraft, normalizeCheckoutMode, normalizeCheckoutStep, getCheckoutLineItems, normalizeVariantSelections, resolveVariantSelectionState } = require('../helpers/store-session');
const { route } = require('../middleware/error');
const { sendOrderConfirmation, sendMerchantNewOrderAlert, sendCustomerWelcomeEmail, sendVerificationEmail, sendPaymentSuccessEmail, sendPaymentFailureEmail, sendAdminNewUserAlert, sendAdminNewOrderAlert } = require('../services/email');
const { normalizeStoreApps, getSalesPopupItems, findCustomerByPhone } = require('../services/apps');
const { syncCustomerToSupabaseAuth } = require('../services/supabase-auth');
const { sendFast2SmsOtp } = require('../services/sms');
const { createShiprocketOrder } = require('../services/shiprocket');
const { triggerOrderCreatedWebhooks } = require('../services/webhooks');
const { getRazorpayConfig, createRazorpayOrder, verifyRazorpaySignature } = require('../services/razorpay');
const { isTrustedNavigation } = require('../middleware/request-security');

const OTP_REQUEST_WINDOW_MS = 15 * 60 * 1000;
const OTP_REQUEST_LIMIT = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_VERIFY_LIMIT = 5;
const otpRequestBuckets = new Map();

function buildTawkScript(store) {
  const app = store && store.apps && store.apps.tawkto;
  if (!app || !app.installed || !app.configured || !app.propertyId || !app.widgetId) return '';
  return `<script>var Tawk_API=Tawk_API||{},Tawk_LoadStart=new Date();(function(){var s1=document.createElement('script'),s0=document.getElementsByTagName('script')[0];s1.async=true;s1.src='https://embed.tawk.to/${escapeHtml(app.propertyId)}/${escapeHtml(app.widgetId)}';s1.charset='UTF-8';s1.setAttribute('crossorigin','*');s0.parentNode.insertBefore(s1,s0);})();</script>`;
}

function renderStoreGoogleButton(slug) {
  return `<a href="/auth/google?flow=customer&store=${encodeURIComponent(slug)}&redirect=${encodeURIComponent(`/store/${slug}/account`)}" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:12px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;color:#111827;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:16px;transition:all 0.2s;"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>Continue with Google</a>`;
}

function buildSalesPopupScript(store, pathName) {
  const app = store && store.apps && store.apps.salesPopup;
  if (!app || !app.installed || !app.configured || app.enabled !== true) return '';
  const isProductPath = /\/product\//.test(pathName || '');
  if ((isProductPath && app.showProduct === false) || (!isProductPath && app.showHome === false && /\/store\//.test(pathName || ''))) return '';
  const items = getSalesPopupItems(store);
  if (!items.length) return '';
  const title = escapeHtml(app.title || 'Someone purchased');
  const textTemplate = JSON.stringify(String(app.text || '{{product}} from {{city}}'));
  const payload = JSON.stringify(items);
  const interval = Math.max(4, Math.min(30, Number(app.intervalSeconds || 8) || 8)) * 1000;
  return `<script>(function(){var items=${payload};if(!items.length)return;var root=document.createElement('div');root.className='sales-popup-root';document.body.appendChild(root);var idx=0;var template=${textTemplate};function safe(v){return String(v||'').replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});}function render(){var item=items[idx%items.length];idx++;var text=template.replace(/\{\{product\}\}/g,safe(item.product||'a product')).replace(/\{\{name\}\}/g,safe(item.name||'Someone')).replace(/\{\{city\}\}/g,safe(item.city||'your city'));root.innerHTML='<div class="sales-popup-card"><strong>${title}</strong><span>'+text+'</span></div>';root.classList.add('show');setTimeout(function(){root.classList.remove('show');},4200);} setTimeout(render,1800); setInterval(render,${interval});})();</script>`;
}

function buildStoreBodyStart(store) {
  const gtm = store && store.apps && store.apps.googleTagManager;
  return '';
}

function createCustomerEmailVerificationState(verified) {
  if (verified) {
    return { emailVerified: true, emailVerificationToken: '', emailVerificationExpiry: 0 };
  }
  return {
    emailVerified: false,
    emailVerificationToken: generateId('verify'),
    emailVerificationExpiry: Date.now() + (48 * 60 * 60 * 1000)
  };
}

function getStoreShellOptions(req, store, extraOptions) {
  const tracking = store && store.tracking && typeof store.tracking === 'object' ? store.tracking : {};
  const cfg = store && store.themeConfig && typeof store.themeConfig === 'object' ? store.themeConfig : {};
  const apps = normalizeStoreApps(store && store.apps);
  const eventsScript = consumePendingTrackingScripts(req);
  const bodyEndScripts = `${buildTawkScript({ apps })}${buildSalesPopupScript({ ...store, apps }, req.originalUrl || req.path || '')}${extraOptions && extraOptions.bodyEndScripts ? extraOptions.bodyEndScripts : ''}`;
  return Object.assign({
    trackingPixel: tracking.pixel || '',
    trackingGa: tracking.google || '',
    trackingGtm: apps.googleTagManager && apps.googleTagManager.installed && apps.googleTagManager.configured ? apps.googleTagManager.containerId || '' : '',
    storeSlug: store && store.slug ? store.slug : '',
    storeName: store && store.name ? store.name : 'MyShopBuilder',
    manifestPath: store && store.slug ? `/store/${encodeURIComponent(store.slug)}/manifest.json` : '',
    primaryColor: cfg.primaryColor || '',
    headExtras: eventsScript,
    bodyEndScripts
  }, extraOptions || {}, {
    headExtras: `${eventsScript}${extraOptions && extraOptions.headExtras ? extraOptions.headExtras : ''}`,
    bodyEndScripts
  });
}

function pushTrackingEvent(req, event) {
  if (!req.session) return;
  req.session.storeTrackingEvents = Array.isArray(req.session.storeTrackingEvents) ? req.session.storeTrackingEvents : [];
  req.session.storeTrackingEvents.push(event);
}

function consumePendingTrackingScripts(req) {
  if (!req.session || !Array.isArray(req.session.storeTrackingEvents) || !req.session.storeTrackingEvents.length) {
    return '';
  }
  const events = req.session.storeTrackingEvents.splice(0, req.session.storeTrackingEvents.length);
  return `<script>(function(){${events.map((event) => {
    const fbqPayload = JSON.stringify(event.fbqPayload || {});
    const gaPayload = JSON.stringify(event.gtagPayload || {});
    const parts = [];
    if (event.fbqEvent) parts.push(`if(typeof fbq!=='undefined'){fbq('track', '${event.fbqEvent}', ${fbqPayload});}`);
    if (event.gtagEvent) parts.push(`if(typeof gtag!=='undefined'){gtag('event', '${event.gtagEvent}', ${gaPayload});}`);
    return parts.join('');
  }).join('')}})();</script>`;
}

function buildVariantSelectionsFromRequest(body, product) {
  const selections = {};
  (Array.isArray(product && product.variants) ? product.variants : []).forEach((variant) => {
    const value = String(body && body[`variant_${variant.id}`] || '').trim();
    if (value) selections[variant.id] = value;
  });
  return normalizeVariantSelections(selections);
}

function buildStoreTrackingHead(type, payload) {
  if (!type) return '';
  const safePayload = JSON.stringify(payload || {});
  const gaEventMap = {
    ViewContent: 'view_item',
    AddToCart: 'add_to_cart',
    Purchase: 'purchase',
    InitiateCheckout: 'begin_checkout'
  };
  const gaEvent = gaEventMap[type] || '';
  return `<script>(function(){var payload=${safePayload};if(typeof fbq!=='undefined'){fbq('track','${type}',payload);}if(typeof gtag!=='undefined'&&'${gaEvent}'){gtag('event','${gaEvent}',payload);}})();</script>`;
}

function renderVariantSelectors(product) {
  if (!product || !Array.isArray(product.variants) || !product.variants.length) return '';
  return product.variants.map((variant) => `<div class="app-variant-group"><label class="app-variant-label">${escapeHtml(variant.name)}</label><div class="app-variant-options">${variant.options.map((option, index) => `<label class="app-variant-option"><input type="radio" name="variant_${escapeHtml(variant.id)}" value="${escapeHtml(option.label)}" ${index === 0 ? 'checked' : ''}><span class="variant-chip" data-stock="${escapeHtml(String(option.stock || 0))}">${escapeHtml(option.label)}</span></label>`).join('')}</div></div>`).join('');
}

function renderProductReviews(product, slug, base) {
  const reviews = Array.isArray(product && product.reviews) ? product.reviews.slice().reverse() : [];
  return `<section class="card panel" style="margin-top:18px;"><h2 style="font-size:18px;margin:0 0 16px;">Reviews (${escapeHtml(String(reviews.length))})</h2>${reviews.length ? reviews.map((review) => `<div style="padding:14px 0;border-bottom:1px solid #e5e7eb;"><div style="display:flex;justify-content:space-between;"><strong>${escapeHtml(review.customerName)}</strong><span>${escapeHtml('★'.repeat(Math.max(1, Math.min(5, Number(review.rating || 5)))))}</span></div><p style="margin:6px 0 0;color:#64748b;font-size:14px;">${escapeHtml(review.comment)}</p><div style="font-size:12px;color:#94a3b8;margin-top:4px;">${escapeHtml(formatDate(review.createdAt))}</div></div>`).join('') : '<p style="color:#94a3b8;">No reviews yet. Be the first!</p>'}<form method="POST" action="${base}/product/${encodeURIComponent(product.id)}/review" style="margin-top:20px;"><h3 style="font-size:16px;margin:0 0 12px;">Write a Review</h3><div style="display:grid;gap:10px;"><input name="reviewName" placeholder="Your name" required><select name="rating"><option value="5">★★★★★ (5 - Excellent)</option><option value="4">★★★★☆ (4 - Good)</option><option value="3">★★★☆☆ (3 - Average)</option><option value="2">★★☆☆☆ (2 - Poor)</option><option value="1">★☆☆☆☆ (1 - Terrible)</option></select><textarea name="comment" placeholder="Share your experience..." required style="min-height:80px;"></textarea><button type="submit" class="btn">Submit Review</button></div></form></section>`;
}

async function runOrderHooks(store, order, db) {
  if (store.notifications && store.notifications.newOrder) {
    console.log(`[NEW ORDER] Store: ${store.name} | Order: ${order.orderNumber} | Customer: ${order.customerName} | Amount: ${formatMoney(order.amount)}`);
  }
  if (store.notifications && store.notifications.lowStock) {
    (store.products || []).forEach((product) => {
      if (Number(product.stock || 0) <= 5 && Number(product.stock || 0) > 0) {
        console.log(`[LOW STOCK] Store: ${store.name} | Product: ${product.name} | Stock: ${product.stock}`);
      }
    });
  }
  if (order.customerEmail) {
    sendOrderConfirmation(order, store).catch(console.error);
  }
  if (store.notifications && store.notifications.newOrder && store.ownerId) {
    sendMerchantNewOrderAlert(order, store, store.ownerId).catch(console.error);
  }
  sendAdminNewOrderAlert(order, store).catch(console.error);
  if (store.apps && store.apps.shiprocket && store.apps.shiprocket.installed && store.apps.shiprocket.configured) {
    createShiprocketOrder(store, order).then(async (response) => {
      if (response) {
        order.shippingProvider = 'shiprocket';
        order.shippingResponse = response;
        if (db) await saveDB(db);
      }
    }).catch(console.error);
  }
  triggerOrderCreatedWebhooks(store, order).catch(console.error);
}

function getCustomerOtpSession(req) {
  return req.session && req.session.customerOtp ? req.session.customerOtp : null;
}

function setCustomerOtpSession(req, payload) {
  if (!req.session) return;
  req.session.customerOtp = payload;
}

function clearCustomerOtpSession(req) {
  if (req.session) delete req.session.customerOtp;
}

function getOtpBucketKey(slug, phone, req) {
  return `${String(slug || '').trim()}:${sanitizePhone(phone || '')}:${String((req && (req.headers['x-forwarded-for'] || req.ip)) || '').split(',')[0].trim()}`;
}

function consumeOtpQuota(slug, phone, req) {
  const key = getOtpBucketKey(slug, phone, req);
  const now = Date.now();
  const bucket = otpRequestBuckets.get(key) || { sentAt: [] };
  bucket.sentAt = bucket.sentAt.filter((stamp) => now - stamp < OTP_REQUEST_WINDOW_MS);
  if (bucket.lastSentAt && (now - bucket.lastSentAt) < OTP_RESEND_COOLDOWN_MS) {
    return { ok: false, reason: 'cooldown', retryAfterSec: Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - bucket.lastSentAt)) / 1000) };
  }
  if (bucket.sentAt.length >= OTP_REQUEST_LIMIT) {
    return { ok: false, reason: 'limit', retryAfterSec: Math.ceil((OTP_REQUEST_WINDOW_MS - (now - bucket.sentAt[0])) / 1000) };
  }
  bucket.sentAt.push(now);
  bucket.lastSentAt = now;
  otpRequestBuckets.set(key, bucket);
  return { ok: true };
}

function ensureLineItemsInStock(store, lineItems) {
  const products = Array.isArray(store && store.products) ? store.products : [];
  for (const item of Array.isArray(lineItems) ? lineItems : []) {
    const product = products.find((entry) => entry.id === item.product.id);
    const variantState = product ? resolveVariantSelectionState(product, item.variantSelections || {}) : null;
    const available = Math.max(0, Number((variantState && variantState.stock) || (product && product.stock) || 0));
    const required = Math.max(1, Number(item && item.quantity || 1));
    if (!product || required > available) {
      return { ok: false, productName: item && item.product && item.product.name ? item.product.name : 'Product' };
    }
  }
  return { ok: true };
}

function adjustOrderInventory(store, order, direction) {
  const delta = direction === 'restore' ? 1 : -1;
  let changed = false;
  (Array.isArray(order && order.items) ? order.items : []).forEach((item) => {
    const product = Array.isArray(store && store.products) ? store.products.find((entry) => entry.id === item.productId) : null;
    if (!product) return;
    const quantity = Math.max(1, Number(item.quantity || 1));
    const currentStock = Math.max(0, Number(product.stock || 0));
    product.stock = Math.max(0, currentStock + (delta * quantity));
    (Array.isArray(product.variants) ? product.variants : []).forEach((variant) => {
      const selectedLabel = item.variantSelections && item.variantSelections[variant.id];
      if (!selectedLabel) return;
      const option = (Array.isArray(variant.options) ? variant.options : []).find((entry) => entry.label === selectedLabel);
      if (!option || option.stock === undefined || option.stock === null || option.stock === '') return;
      option.stock = Math.max(0, Number(option.stock || 0) + (delta * quantity));
    });
    changed = true;
  });
  if (changed) {
    order.stockDeducted = direction !== 'restore';
    order.stockDeductedAt = direction !== 'restore' ? new Date().toISOString() : '';
    order.stockRestoredAt = direction === 'restore' ? new Date().toISOString() : '';
  }
  return changed;
}

function normalizeQueryList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  const safe = String(value || '').trim();
  return safe ? [safe] : [];
}

function getProductSalesMap(store) {
  const map = {};
  (Array.isArray(store && store.orders) ? store.orders : []).forEach((order) => {
    if (String(order && order.status || '').trim() === 'cancelled') return;
    (Array.isArray(order && order.items) ? order.items : []).forEach((item) => {
      const productId = String(item && item.productId || '').trim();
      if (!productId) return;
      map[productId] = (map[productId] || 0) + Math.max(1, Number(item.quantity || 1));
    });
  });
  return map;
}

function matchesSelectedCategories(product, categories, selectedCategories) {
  if (!selectedCategories.length) return true;
  return selectedCategories.some((selectedCategory) => {
    const directMatch = String(product.category || '').trim() === selectedCategory;
    const mappedMatch = categories.some((category) => category.name === selectedCategory && (category.productIds || []).includes(product.id));
    return directMatch || mappedMatch;
  });
}

function buildListingQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((item) => query.append(key, String(item)));
      return;
    }
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });
  const result = query.toString();
  return result ? `?${result}` : '';
}

function getFilteredAndSortedProducts(store, ss, categories, filters) {
  const searchText = String(filters && filters.search || '').trim();
  const search = searchText.toLowerCase();
  const selectedCategories = Array.isArray(filters && filters.selectedCategories) ? filters.selectedCategories : [];
  const availability = ['in_stock', 'out_of_stock'].includes(String(filters && filters.availability || '')) ? String(filters.availability || '') : '';
  const minPrice = Math.max(0, Number(filters && filters.minPrice || 0) || 0);
  const rawMaxPrice = Number(filters && filters.maxPrice || 0) || 0;
  const maxPrice = rawMaxPrice > 0 ? rawMaxPrice : 0;
  const salesMap = getProductSalesMap(store);
  let visibleProducts = (Array.isArray(store && store.products) ? store.products : []).filter((product) => {
    if (product.active === false) return false;
    const stock = Math.max(0, Number(product.stock || 0));
    if (availability === 'in_stock' && stock <= 0) return false;
    if (availability === 'out_of_stock' && stock > 0) return false;
    if (!availability && ss.productSettings.hideOutOfStock && stock <= 0) return false;
    const searchable = [product.name, product.description, product.sku, product.category, String(product.price || ''), String(product.comparePrice || '')].join(' ').toLowerCase();
    const matchesSearch = !search || searchable.includes(search);
    if (!matchesSearch) return false;
    if (!matchesSelectedCategories(product, categories, selectedCategories)) return false;
    const price = parsePrice(product.price);
    if (minPrice && price < minPrice) return false;
    if (maxPrice && price > maxPrice) return false;
    return true;
  });
  const sort = String(filters && filters.sort || '').trim();
  if (sort === 'price_asc') visibleProducts.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
  else if (sort === 'price_desc') visibleProducts.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
  else if (sort === 'newest') visibleProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  else if (sort === 'alpha_asc') visibleProducts.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  else if (sort === 'alpha_desc') visibleProducts.sort((a, b) => String(b.name || '').localeCompare(String(a.name || '')));
  else if (sort === 'best_selling') visibleProducts.sort((a, b) => (salesMap[b.id] || 0) - (salesMap[a.id] || 0));
  return { visibleProducts, sort, search: searchText, selectedCategories, availability, minPrice, maxPrice };
}

function renderListingSortOptions(action, state) {
  const hidden = [
    state.search ? `<input type="hidden" name="search" value="${escapeHtml(state.search)}">` : '',
    state.selectedCategories.map((category) => `<input type="hidden" name="category" value="${escapeHtml(category)}">`).join(''),
    state.minPrice ? `<input type="hidden" name="minPrice" value="${escapeHtml(String(state.minPrice))}">` : '',
    state.maxPrice ? `<input type="hidden" name="maxPrice" value="${escapeHtml(String(state.maxPrice))}">` : '',
    state.availability ? `<input type="hidden" name="availability" value="${escapeHtml(state.availability)}">` : ''
  ].join('');
  return `<div class="app-shop-toolbar"><form method="GET" action="${escapeHtml(action)}" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">${hidden}<select name="sort" onchange="this.form.submit()" style="padding:10px 14px;border-radius:999px;border:1px solid #e2e8f0;font-size:13px;background:#fff;"><option value="">Sort by</option><option value="best_selling"${state.sort === 'best_selling' ? ' selected' : ''}>Best Selling</option><option value="newest"${state.sort === 'newest' ? ' selected' : ''}>Newest First</option><option value="price_asc"${state.sort === 'price_asc' ? ' selected' : ''}>Price: Low to High</option><option value="price_desc"${state.sort === 'price_desc' ? ' selected' : ''}>Price: High to Low</option><option value="alpha_asc"${state.sort === 'alpha_asc' ? ' selected' : ''}>A-Z</option><option value="alpha_desc"${state.sort === 'alpha_desc' ? ' selected' : ''}>Z-A</option></select></form></div>`;
}

// URL redirect middleware
router.use('/:slug', route(async (req, res, next) => {
  const slug = String(req.params.slug || '').trim();
  const db = await loadDB();
  const store = db.stores[slug];
  if (!store) { next(); return; }
  const relativePath = String(req.path || '/').replace(/^\/+/, '');
  const redirectTarget = resolveStoreRedirect(store, relativePath || '/');
  if (!redirectTarget) { next(); return; }
  if (redirectTarget === req.originalUrl || redirectTarget === req.path) { next(); return; }
  res.redirect(302, redirectTarget);
}));

router.get('/:slug/robots.txt', route(async (req, res) => {
  const slug = String(req.params.slug || '').trim();
  const db = await loadDB();
  const store = db.stores[slug];
  if (!store) { res.status(404).send('Not Found'); return; }
  res.type('text/plain');
  res.send(getRobotsTxt(store, req, slug));
}));

router.get('/:slug/sitemap.xml', route(async (req, res) => {
  const slug = String(req.params.slug || '').trim();
  const db = await loadDB();
  const store = db.stores[slug];
  if (!store) { res.status(404).send('Not Found'); return; }
  const config = require('../config');
  const baseUrl = config.BASE_DOMAIN ? `https://${slug}.${config.BASE_DOMAIN}` : `${req.protocol}://${req.get('host')}`;
  const urls = [baseUrl];
  store.products.filter((p) => p.active !== false).forEach((p) => urls.push(`${baseUrl}/product/${p.id}`));
  const pages = Array.isArray(store.pages) ? store.pages : [];
  pages.forEach((p) => urls.push(`${baseUrl}/page/${p.slug}`));
  urls.push(`${baseUrl}/about`);
  ['terms', 'shipping', 'payment', 'return-refund', 'privacy'].forEach((type) => urls.push(`${baseUrl}/policy/${type}`));
  res.type('application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${escapeHtml(u)}</loc></url>`).join('\n')}\n</urlset>`);
}));

router.get('/:slug/manifest.json', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).json({}); return; }
  const manifest = {
    name: store.name,
    short_name: store.name.slice(0, 12),
    start_url: `/store/${store.slug}`,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: store.themeConfig && store.themeConfig.primaryColor ? store.themeConfig.primaryColor : '#7c3aed',
    description: store.description || '',
    icons: store.logo ? [
      { src: store.logo, sizes: '192x192', type: 'image/png' },
      { src: store.logo, sizes: '512x512', type: 'image/png' }
    ] : []
  };
  res.setHeader('Content-Type', 'application/manifest+json');
  res.json(manifest);
}));

router.get('/:slug/llms.txt', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).send('Not Found'); return; }
  const ss = ensureStoreSettings(store);
  if (!ss.llmSettings.enabled) { res.status(404).send('Not Found'); return; }
  res.type('text/plain');
  res.send([
    `# ${store.name}`,
    ss.llmSettings.businessSummary || store.description || '',
    ss.llmSettings.supportEmail ? `Support Email: ${ss.llmSettings.supportEmail}` : '',
    ss.llmSettings.supportPhone ? `Support Phone: ${ss.llmSettings.supportPhone}` : '',
    `Store URL: ${req.protocol}://${req.get('host')}/store/${slug}`
  ].filter(Boolean).join('\n'));
}));

router.get('/:slug/about', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
  const currentTemplate = getTemplateById(db, store.template);
  const ss = ensureStoreSettings(store);
  res.send(renderHtmlShell(`${store.name} - ${ss.aboutUs.title || 'About Us'}`, `<div class="store-page"><div class="store-wrap account-page"><div class="store-nav"><a href="/store/${encodeURIComponent(slug)}">Home</a></div><section class="card panel"><h1 class="page-title">${escapeHtml(ss.aboutUs.title || 'About Us')}</h1><p class="page-subtitle">${escapeHtml(ss.aboutUs.content || store.description || 'About this store.')}</p></section></div></div>`, getStoreShellOptions(req, store, { extraStyles: renderStoreCss(currentTemplate, store.theme), metaTags: getStoreMetaTags(store, { title: `${ss.aboutUs.title || 'About Us'} - ${store.name}`, description: ss.aboutUs.content || store.description }) })));
}));

router.get('/:slug/policy/:type', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
  const ss = ensureStoreSettings(store);
  const currentTemplate = getTemplateById(db, store.template);
  const map = { 'terms': ['Terms and Conditions', ss.policies.terms], 'shipping': ['Shipping Policy', ss.policies.shipping], 'payment': ['Payment Policy', ss.policies.payment], 'return-refund': ['Return and Refund Policy', ss.policies.returnRefund], 'privacy': ['Privacy Policy', ss.policies.privacy] };
  const entry = map[String(req.params.type || '').trim()];
  if (!entry) { res.status(404).send(renderGlobalError('Policy Not Found', 'The policy you are looking for does not exist.', 404)); return; }
  res.send(renderHtmlShell(`${store.name} - ${entry[0]}`, `<div class="store-page"><div class="store-wrap account-page"><div class="store-nav"><a href="/store/${encodeURIComponent(slug)}">Home</a></div><section class="card panel"><h1 class="page-title">${escapeHtml(entry[0])}</h1><p class="page-subtitle">${escapeHtml(entry[1] || 'This policy has not been written yet.')}</p></section></div></div>`, getStoreShellOptions(req, store, { extraStyles: renderStoreCss(currentTemplate, store.theme), metaTags: getStoreMetaTags(store, { title: `${entry[0]} - ${store.name}`, description: entry[1] || store.description }) })));
}));

router.get('/:slug/page/:pageSlug', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
  const pageSlug = String(req.params.pageSlug || '').trim();
  const page = (Array.isArray(store.pages) ? store.pages : []).find((item) => item.slug === pageSlug && item.active !== false);
  if (!page) { res.status(404).send(renderGlobalError('Page Not Found', 'The page you requested could not be found.', 404)); return; }
  const currentTemplate = getTemplateById(db, store.template);
  res.send(renderHtmlShell(`${page.title} - ${store.name}`, `<div class="store-page"><div class="store-wrap account-page"><div class="store-nav"><a href="/store/${encodeURIComponent(slug)}">Home</a></div><section class="card panel"><h1 class="page-title">${escapeHtml(page.title)}</h1><p class="page-subtitle">${escapeHtml(page.content || '')}</p></section></div></div>`, getStoreShellOptions(req, store, { extraStyles: renderStoreCss(currentTemplate, store.theme), metaTags: getStoreMetaTags(store, { title: `${page.title} - ${store.name}`, description: page.content || store.description }) })));
}));

// Main store page
router.get('/:slug', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
  recordStoreVisit(slug);
  const currentTemplate = getTemplateById(db, store.template);
  const ss = ensureStoreSettings(store);
  const cfg = store.themeConfig || {};
  const cart = getStoreCart(req, slug);
  const wishlist = getStoreWishlist(req, slug);
  const selectedCategories = normalizeQueryList(req.query.category);
  const page = Math.max(1, parseInt(req.query.page || 1, 10));
  const perPage = 12;
  const categories = Array.isArray(store.categories) ? store.categories : [];
  const listingState = getFilteredAndSortedProducts(store, ss, categories, {
    search: req.query.search,
    selectedCategories,
    availability: req.query.availability,
    minPrice: req.query.minPrice,
    maxPrice: req.query.maxPrice,
    sort: req.query.sort
  });
  const { visibleProducts, sort, search, availability, minPrice, maxPrice } = listingState;
  const totalPages = Math.ceil(visibleProducts.length / perPage);
  const pagedProducts = visibleProducts.slice((page - 1) * perPage, page * perPage);
  const cartDetails = getCartDetails(store, cart);
  const wishlistItems = wishlist.map((productId) => store.products.find((product) => product.id === productId)).filter(Boolean);
  const cartCount = cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const wishlistCount = wishlist.length;
  const customer = await getLoggedCustomer(req, slug);
  const isDark = store.theme === 'dark';
  const themeCSS = getThemeCSS(currentTemplate, store.theme, cfg);
  const isSubdomain = !!(req.subdomainSlug);
  const storeBase = isSubdomain ? '' : '/store/' + encodeURIComponent(slug);
  const sortOptions = renderListingSortOptions(storeBase || '/', { search, selectedCategories, sort, minPrice, maxPrice, availability });
  const paginationHtml = totalPages > 1 ? `<div style="display:flex;gap:8px;justify-content:center;padding:20px 0;flex-wrap:wrap;">${Array.from({ length: totalPages }, (_, i) => `<a href="${storeBase || '/'}${buildListingQuery({ page: i + 1, search, category: selectedCategories, sort, minPrice, maxPrice, availability })}" style="padding:8px 14px;border-radius:999px;background:${page === i + 1 ? (cfg.primaryColor || '#3b5bfd') : '#fff'};color:${page === i + 1 ? '#fff' : '#333'};border:1px solid #e2e8f0;font-size:13px;font-weight:700;text-decoration:none;">${i + 1}</a>`).join('')}</div>` : '';
  const publishedBuilder = (currentTemplate && currentTemplate.layout) === 'app' ? await getPublishedStoreBuilderPage(slug, 'home') : null;
  const publishedBuilderPage = publishedBuilder && publishedBuilder.snapshot ? publishedBuilder.snapshot.schemaJson : null;
  const storeContent = publishedBuilderPage
    ? renderStoreBuilderPage(store, slug, publishedBuilderPage, { products: pagedProducts, categories, cartCount, wishlistCount, wishlist, search, selectedCategory: selectedCategories[0] || '', selectedCategories, currentTemplate, customer, cfg, isDark, sortOptions, paginationHtml, isSubdomain, storeBase, req, cartDetails, wishlistItems, featuredProduct: visibleProducts[0] || store.products.find((item) => item.active !== false), filterState: { search, categories: selectedCategories, sort, minPrice, maxPrice, availability } })
    : renderStoreByTheme(currentTemplate, store, slug, { products: pagedProducts, categories, cartCount, wishlistCount, wishlist, search, selectedCategory: selectedCategories[0] || '', selectedCategories, currentTemplate, customer, cfg, isDark, sortOptions, paginationHtml, isSubdomain, storeBase, req, cartDetails, wishlistItems, featuredProduct: visibleProducts[0] || store.products.find((item) => item.active !== false), filterState: { search, categories: selectedCategories, sort, minPrice, maxPrice, availability } });
  res.send(renderHtmlShell(`${store.name} - Store`, `<div class="store-page"><div class="store-wrap">${storeContent}</div></div>`, getStoreShellOptions(req, store, { extraStyles: themeCSS, metaTags: getStoreMetaTags(store, { title: ss.seoSettings.title || `${store.name} - Store`, description: ss.seoSettings.description || store.description }) }))); 
}));

router.get('/:slug/shop', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
  recordStoreVisit(slug);
  const currentTemplate = getTemplateById(db, store.template);
  const ss = ensureStoreSettings(store);
  const cfg = store.themeConfig || {};
  const cart = getStoreCart(req, slug);
  const wishlist = getStoreWishlist(req, slug);
  const selectedCategories = normalizeQueryList(req.query.category);
  const page = Math.max(1, parseInt(req.query.page || 1, 10));
  const perPage = 24;
  const categories = Array.isArray(store.categories) ? store.categories : [];
  const listingState = getFilteredAndSortedProducts(store, ss, categories, {
    search: req.query.search,
    selectedCategories,
    availability: req.query.availability,
    minPrice: req.query.minPrice,
    maxPrice: req.query.maxPrice,
    sort: req.query.sort
  });
  const { visibleProducts, sort, search, availability, minPrice, maxPrice } = listingState;
  const totalPages = Math.ceil(visibleProducts.length / perPage);
  const pagedProducts = visibleProducts.slice((page - 1) * perPage, page * perPage);
  const cartDetails = getCartDetails(store, cart);
  const wishlistItems = wishlist.map((productId) => store.products.find((product) => product.id === productId)).filter(Boolean);
  const cartCount = cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const wishlistCount = wishlist.length;
  const customer = await getLoggedCustomer(req, slug);
  const isDark = store.theme === 'dark';
  const themeCSS = getThemeCSS(currentTemplate, store.theme, cfg);
  const isSubdomain = !!(req.subdomainSlug);
  const storeBase = isSubdomain ? '' : '/store/' + encodeURIComponent(slug);
  const sortOptions = renderListingSortOptions(`${storeBase}/shop`, { search, selectedCategories, sort, minPrice, maxPrice, availability });
  const paginationBase = `${storeBase}/shop`;
  const paginationHtml = totalPages > 1 ? `<div style="display:flex;gap:8px;justify-content:center;padding:20px 0;flex-wrap:wrap;">${Array.from({ length: totalPages }, (_, i) => `<a href="${paginationBase}${buildListingQuery({ page: i + 1, search, category: selectedCategories, sort, minPrice, maxPrice, availability })}" style="padding:8px 14px;border-radius:999px;background:${page === i + 1 ? (cfg.primaryColor || '#3b5bfd') : '#fff'};color:${page === i + 1 ? '#fff' : '#333'};border:1px solid #e2e8f0;font-size:13px;font-weight:700;text-decoration:none;">${i + 1}</a>`).join('')}</div>` : '';
  if ((currentTemplate && currentTemplate.layout) === 'app') {
    const storeContent = renderAppShopAllPage(store, slug, { products: pagedProducts, categories, cartCount, wishlistCount, wishlist, search, customer, cfg, paginationHtml, storeBase, cartDetails, wishlistItems, labels: ss.labelSettings, totalProducts: visibleProducts.length, sortOptions, filterState: { search, categories: selectedCategories, sort, minPrice, maxPrice, availability } });
    res.send(renderHtmlShell(`${store.name} - Shop All`, `<div class="store-page"><div class="store-wrap">${storeContent}</div></div>`, getStoreShellOptions(req, store, { extraStyles: themeCSS, metaTags: getStoreMetaTags(store, { title: `${store.name} - Shop All`, description: ss.seoSettings.description || store.description }) })));
    return;
  }
  res.redirect(`/store/${encodeURIComponent(slug)}${search ? `?search=${encodeURIComponent(search)}` : '?category=all'}`);
}));

router.get('/:slug/categories', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
  recordStoreVisit(slug);
  const currentTemplate = getTemplateById(db, store.template);
  const ss = ensureStoreSettings(store);
  const cfg = store.themeConfig || {};
  const cart = getStoreCart(req, slug);
  const wishlist = getStoreWishlist(req, slug);
  const search = String(req.query.search || '').trim();
  const categories = Array.isArray(store.categories) ? store.categories : [];
  const visibleProducts = store.products.filter((product) => product.active !== false);
  const cartDetails = getCartDetails(store, cart);
  const wishlistItems = wishlist.map((productId) => store.products.find((product) => product.id === productId)).filter(Boolean);
  const cartCount = cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const wishlistCount = wishlist.length;
  const customer = await getLoggedCustomer(req, slug);
  const themeCSS = getThemeCSS(currentTemplate, store.theme, cfg);
  const isSubdomain = !!(req.subdomainSlug);
  const storeBase = isSubdomain ? '' : '/store/' + encodeURIComponent(slug);
  if ((currentTemplate && currentTemplate.layout) === 'app') {
    const storeContent = renderAppCategoriesPage(store, slug, { categories, products: visibleProducts, cartCount, wishlistCount, wishlist, search, customer, cfg, storeBase, cartDetails, wishlistItems, labels: ss.labelSettings });
    res.send(renderHtmlShell(`${store.name} - Categories`, `<div class="store-page"><div class="store-wrap">${storeContent}</div></div>`, getStoreShellOptions(req, store, { extraStyles: themeCSS, metaTags: getStoreMetaTags(store, { title: `${store.name} - Categories`, description: ss.seoSettings.description || store.description }) })));
    return;
  }
  res.redirect(`/store/${encodeURIComponent(slug)}?category=all`);
}));

// Product page, cart, checkout, wishlist, orders, account routes...
// (All remaining store routes from server.js lines 4530-5359)

router.get('/:slug/product/:id', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
  const currentTemplate = getTemplateById(db, store.template);
  const cfg = store.themeConfig || {};
  const ss = ensureStoreSettings(store);
  const product = store.products.find((item) => item.id === String(req.params.id || '').trim());
  if (!product) { res.status(404).send(renderGlobalError('Product Not Found', 'The product you are looking for does not exist.', 404)); return; }
  const flash = renderFlashMessages(req);
  const wishlist = getStoreWishlist(req, slug);
  const cartDetails = getCartDetails(store, getStoreCart(req, slug));
  const cartCount = cartDetails.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const wishlistItems = wishlist.map((productId) => store.products.find((item) => item.id === productId)).filter(Boolean);
  const wishlistCount = wishlistItems.length;
  const isSubdomain = !!(req.subdomainSlug);
  const base = isSubdomain ? '' : '/store/' + encodeURIComponent(slug);
  const related = store.products.filter((item) => item.id !== product.id && item.active !== false).slice(0, 4);
  product.images = Array.isArray(product.images) && product.images.length ? product.images : [product.image].filter(Boolean);
  product.reviews = Array.isArray(product.reviews) ? product.reviews : [];
  const relatedHtml = related.length ? related.map((item) => `<a class="store-card" href="${base}/product/${encodeURIComponent(item.id)}" style="text-align:left;"><h3>${escapeHtml(item.name)}</h3>${cfg.showProductDescription !== false ? `<p>${escapeHtml(item.description)}</p>` : ''}<div class="price-row"><div class="price-tag">${escapeHtml(formatMoney(item.price))}</div>${cfg.showProductPageStock !== false ? `<div class="stock-tag">Stock: ${escapeHtml(String(item.stock || 0))}</div>` : ''}</div></a>`).join('') : '<div class="store-empty">No related products.</div>';
  const skuHtml = product.sku ? `<span class="store-pill">SKU: ${escapeHtml(product.sku)}</span>` : '';
  const ratingHtml = cfg.showRating !== false ? `<span class="store-pill">★ ${escapeHtml(getProductDisplayRating(product))}</span>` : '';
  const descriptionHtml = cfg.showProductDescription !== false ? `<p class="section-subtitle">${escapeHtml(product.description)}</p>` : '';
  const stockHtml = cfg.showProductPageStock !== false ? `<span class="store-pill">Stock ${escapeHtml(String(product.stock || 0))}</span>` : '';
  const whatsappHtml = cfg.showWhatsappButton !== false && store.whatsapp ? `<a class="btn btn-secondary" href="https://wa.me/${encodeURIComponent(store.whatsapp)}?text=${encodeURIComponent('Hi, I want to ask about ' + product.name)}" target="_blank" rel="noopener">WhatsApp</a>` : '';
  const priceSuffixCard = ss.productSettings.productPageSalePrice === 'sale-tax-exclusive' ? ' + tax' : ss.productSettings.productPageSalePrice === 'sale-tax' ? ' incl. tax' : '';
  const ogImage = product.image ? `<meta property="og:image" content="${escapeHtml(product.image)}">` : '';
  const variantSelectorsHtml = renderVariantSelectors(product);
  const reviewHtml = renderProductReviews(product, slug, base);
  const galleryThumbs = product.images.length > 1 ? `<div style="display:flex;gap:8px;margin-top:10px;overflow-x:auto;">${product.images.map((image) => `<img src="${escapeHtml(image)}" onclick="document.getElementById('mainImg').src=this.src" style="width:60px;height:60px;border-radius:10px;object-fit:cover;cursor:pointer;border:2px solid #e5e7eb;">`).join('')}</div>` : '';
  const viewContentHead = buildStoreTrackingHead('ViewContent', { content_name: product.name, value: Number(product.price || 0), currency: 'INR' });
  if ((currentTemplate && currentTemplate.layout) === 'app') {
    const productContent = renderAppProductPage(store, slug, { product, related, wishlist, customer: await getLoggedCustomer(req, slug), cfg, currentTemplate, cartCount, wishlistCount, cartDetails, wishlistItems, storeBase: base });
    res.send(renderHtmlShell(`${product.name} - ${store.name}`, `<div class="store-page"><div class="store-wrap">${flash}${productContent}</div></div>`, getStoreShellOptions(req, store, { extraStyles: getThemeCSS(currentTemplate, store.theme, cfg), metaTags: getStoreMetaTags(store, { title: `${product.name} - ${store.name}`, description: product.description || store.description }) + ogImage, headExtras: viewContentHead })));
    return;
  }
  res.send(renderHtmlShell(`${product.name} - ${store.name}`, `<div class="store-page"><div class="store-wrap">${flash}<div class="store-nav"><a href="${base || '/'}">Back to store</a><a href="${base}/cart">Cart</a><a href="${base}/wishlist">Wishlist</a><a href="${base}/track-order">Track order</a></div><div class="card panel product-detail"><div>${product.image ? `<img id="mainImg" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : '<div class="store-empty">No image</div>'}${galleryThumbs}</div><div><h1 class="section-title" style="margin-top:0;">${escapeHtml(product.name)}</h1>${descriptionHtml}<div class="product-meta"><span class="price-tag">${escapeHtml(formatMoney(product.price))}${escapeHtml(priceSuffixCard)}</span>${stockHtml}${skuHtml}${ratingHtml}</div><form id="productCartForm" method="POST" action="${base}/cart/add/${encodeURIComponent(product.id)}" class="form-grid">${variantSelectorsHtml}<div style="display:flex;gap:10px;align-items:end;"><div class="field" style="width:80px;"><label style="font-size:12px;">Qty</label><input type="number" id="qty" value="1" min="1" max="${escapeHtml(String(Math.max(1, product.stock || 99)))}" style="padding:10px;text-align:center;"></div><input type="hidden" name="quantity" id="qtyHidden" value="1"><button class="btn" type="submit" style="flex:1;min-height:44px;" ${Number(product.stock || 0) <= 0 ? 'disabled' : ''}>${Number(product.stock || 0) <= 0 ? 'Sold out' : 'Add to cart'}</button></div></form><div class="actions" style="margin-top:12px;"><button class="btn btn-secondary" type="button" id="buyNowBtn" data-buy-base="${base}/buy/${encodeURIComponent(product.id)}">Buy now</button><form method="POST" action="${base}/wishlist/toggle/${encodeURIComponent(product.id)}"><button class="btn btn-outline ${wishlist.includes(product.id) ? 'wishlist-active' : ''}" type="submit">${wishlist.includes(product.id) ? '♥ Wishlisted' : '♡ Wishlist'}</button></form>${whatsappHtml}</div></div></div><section class="card panel" style="margin-top:18px;"><div class="section-head"><h2 class="section-title" style="font-size:20px; margin:0;">Related products</h2></div><div class="store-grid">${relatedHtml}</div></section>${reviewHtml}</div></div><script>(function(){var qty=document.getElementById('qty'),qtyH=document.getElementById('qtyHidden'),buy=document.getElementById('buyNowBtn'),form=document.getElementById('productCartForm');function sync(){if(qty&&qtyH)qtyH.value=qty.value||'1';if(buy&&form){var url=new URL(buy.getAttribute('data-buy-base'),window.location.origin);url.searchParams.set('quantity',(qty&&qty.value)||'1');form.querySelectorAll('input[type="radio"]:checked').forEach(function(input){url.searchParams.set(input.name,input.value);});buy.onclick=function(){window.location.href=url.pathname+url.search;};}}if(qty)qty.addEventListener('input',sync);if(form){form.querySelectorAll('input[type="radio"]').forEach(function(input){input.addEventListener('change',sync);});}sync();})();</script>`, getStoreShellOptions(req, store, { extraStyles: renderStoreCss(currentTemplate, store.theme) + (cfg.customCss ? `\n${cfg.customCss}` : ''), metaTags: getStoreMetaTags(store, { title: `${product.name} - ${store.name}`, description: product.description || store.description }) + ogImage, headExtras: viewContentHead })));
}));

router.post('/:slug/product/:id/review', route(async (req, res) => {
  try {
    const db = await loadDB();
    const slug = String(req.params.slug || '').trim();
    const store = db.stores[slug];
    if (!store) { res.redirect('back'); return; }
    const product = store.products.find((entry) => entry.id === req.params.id);
    if (!product) { res.redirect('back'); return; }
    const name = sanitizeInput(req.body.reviewName || '', 60);
    const rating = Math.min(5, Math.max(1, Number(req.body.rating || 5)));
    const comment = sanitizeInput(req.body.comment || '', 500);
    if (!name || !comment) { setFlash(req, 'error', 'Please fill review details.'); res.redirect(`${req.get('referer') || `${req.protocol}://${req.get('host')}${req.originalUrl.replace('/review', '')}`}`); return; }
    product.reviews = Array.isArray(product.reviews) ? product.reviews : [];
    product.reviews.push({ id: generateId('rev'), customerName: name, rating, comment, createdAt: new Date().toISOString() });
    await saveDB(db);
    setFlash(req, 'success', 'Review submitted!');
    res.redirect(`/store/${encodeURIComponent(slug)}/product/${encodeURIComponent(product.id)}`);
  } catch (error) {
    res.redirect('back');
  }
}));

router.post('/:slug/cart/add/:id', route(async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    const productId = String(req.params.id || '').trim();
    const db = await loadDB();
    const store = db.stores[slug];
    const product = store && store.products.find((entry) => entry.id === productId);
    const variantSelections = buildVariantSelectionsFromRequest(req.body, product);
    const result = await addProductToCart(req, slug, productId, req.body.quantity || 1, variantSelections);
    if (!result.ok) { const referer = req.get('referer') || `/store/${encodeURIComponent(slug)}`; setFlash(req, 'error', result.message || 'Unable to add to cart.'); res.redirect(referer); return; }
    pushTrackingEvent(req, {
      fbqEvent: 'AddToCart',
      fbqPayload: { value: Number(result.price || (result.product && result.product.price) || 0), currency: 'INR', content_name: result.product ? result.product.name : 'Product' },
      gtagEvent: 'add_to_cart',
      gtagPayload: { currency: 'INR', value: Number(result.price || (result.product && result.product.price) || 0), item_name: result.product ? result.product.name : 'Product' }
    });
    const ss = store ? ensureStoreSettings(store) : null;
    if (ss && ss.productSettings.showCartCheckoutPopup) { res.redirect(`/store/${encodeURIComponent(slug)}/checkout?mode=cart`); return; }
    const referer = req.get('referer');
    res.redirect(referer && referer.includes(`/store/${slug}`) ? referer : `/store/${encodeURIComponent(slug)}/cart`);
  } catch (error) { res.redirect(`/store/${encodeURIComponent(req.params.slug)}`); }
}));

router.post('/:slug/cart/remove/:id', route(async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    const productId = String(req.params.id || '').trim();
    const itemKey = String(req.body.itemKey || '').trim();
    if (!itemKey) {
      removeProductFromCart(req, slug, productId);
    } else {
      const cart = getStoreCart(req, slug).filter((item) => !(item.productId === productId && JSON.stringify(item.variantSelections || {}) === itemKey));
      saveStoreCart(req, slug, cart);
    }
    res.redirect(`/store/${encodeURIComponent(req.params.slug)}/cart`);
  } catch (error) { res.redirect(`/store/${encodeURIComponent(req.params.slug)}/cart`); }
}));

router.post('/:slug/cart/update/:id', route(async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    const productId = String(req.params.id || '').trim();
    const quantity = Math.max(1, Number(req.body.quantity || 1));
    const db = await loadDB();
    const store = db.stores[slug];
    const product = store && store.products.find((entry) => entry.id === productId);
    const cart = getStoreCart(req, slug);
    const itemKey = String(req.body.itemKey || '').trim();
    const item = cart.find((entry) => entry.productId === productId && (!itemKey || JSON.stringify(entry.variantSelections || {}) === itemKey));
    if (item) { item.quantity = product ? Math.min(quantity, Math.max(1, Number(product.stock || 1))) : quantity; saveStoreCart(req, slug, cart); }
    res.redirect(`/store/${encodeURIComponent(slug)}/cart`);
  } catch (error) { res.redirect(`/store/${encodeURIComponent(req.params.slug)}/cart`); }
}));

router.post('/:slug/wishlist/toggle/:id', route(async (req, res) => {
  try { await toggleWishlistProduct(req, String(req.params.slug || '').trim(), String(req.params.id || '').trim()); const referer = req.get('referer'); res.redirect(referer && referer.includes(`/store/${req.params.slug}`) ? referer : `/store/${encodeURIComponent(req.params.slug)}/wishlist`); } catch (error) { res.redirect(`/store/${encodeURIComponent(req.params.slug)}`); }
}));

router.get('/:slug/cart', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) {
    res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404));
    return;
  }
  const currentTemplate = getTemplateById(db, store.template);
  const ss = ensureStoreSettings(store);
  const cartDetails = getCartDetails(store, getStoreCart(req, slug));
  const subtotal = cartDetails.reduce((sum, item) => sum + item.subtotal, 0);
  const shippingFee = getEffectiveShippingFee(store, subtotal);
  const taxRate = store.taxSettings && store.taxSettings.enabled ? Number(store.taxSettings.rate || 0) : 0;
  const taxAmount = store.taxSettings && store.taxSettings.enabled ? subtotal * (taxRate / 100) : 0;
  const total = applyRoundingMode(subtotal + shippingFee + taxAmount, ss.checkoutSettings.roundingMode);
  const isSubdomain = !!(req.subdomainSlug);
  const base = isSubdomain ? '' : '/store/' + encodeURIComponent(slug);
  const rows = cartDetails.length ? cartDetails.map((item) => `
    <div class="summary-row">
      <div><strong>${escapeHtml(item.product.name)}</strong><div class="muted">${escapeHtml(formatMoney(item.price))} x ${escapeHtml(String(item.quantity))}</div>${item.variantSummary ? `<div class="muted" style="font-size:12px;">${escapeHtml(item.variantSummary)}</div>` : ''}</div>
      <div>
        <form class="inline-form" method="POST" action="${base}/cart/update/${encodeURIComponent(item.product.id)}">
          <input type="hidden" name="itemKey" value="${escapeHtml(JSON.stringify(item.variantSelections || {}))}">
          <input name="quantity" value="${escapeHtml(String(item.quantity))}" style="width:72px;" type="number" min="1">
          <button class="btn btn-secondary" type="submit">Save</button>
        </form>
        <form method="POST" action="${base}/cart/remove/${encodeURIComponent(item.product.id)}" style="margin-top:8px; text-align:right;"><input type="hidden" name="itemKey" value="${escapeHtml(JSON.stringify(item.variantSelections || {}))}"><button class="btn btn-danger" type="submit">Remove</button></form>
      </div>
    </div>
  `).join('') : '<div class="store-empty">Your cart is empty.</div>';
  res.send(renderHtmlShell(`${store.name} - Cart`, `
    <div class="store-page"><div class="store-wrap cart-page">
      <div class="store-nav"><a href="${base || '/'}">Continue shopping</a><a href="${base}/wishlist">Wishlist</a><a href="${base}/track-order">Track order</a></div>
      <section class="card panel">
        <div class="title-row"><div><h1 class="page-title">Cart</h1><p class="page-subtitle">Review items before checkout</p></div></div>
        ${rows}
      </section>
      <section class="card panel summary-box">
        <div class="summary-row"><span>Subtotal</span><strong>${escapeHtml(formatMoney(subtotal))}</strong></div>
        <div class="summary-row"><span>Shipping</span><strong>${escapeHtml(formatMoney(shippingFee))}</strong></div>
        ${ss.checkoutSettings.showTaxInfo !== false ? `<div class="summary-row"><span>Tax</span><strong>${escapeHtml(formatMoney(taxAmount))}</strong></div>` : ''}
        <div class="summary-row"><span>Total</span><strong>${escapeHtml(formatMoney(total))}</strong></div>
        ${ss.checkoutSettings.cartNote ? `<div class="summary-row"><span>Cart note</span><strong>${escapeHtml(ss.checkoutSettings.cartNote)}</strong></div>` : ''}
        <div style="height:12px;"></div>
        ${Number(ss.checkoutSettings.minimumOrderAmount || 0) > 0 && subtotal < Number(ss.checkoutSettings.minimumOrderAmount || 0) ? `<div class="flash flash-error" style="margin:0 0 12px;">Minimum order amount is ${escapeHtml(formatMoney(ss.checkoutSettings.minimumOrderAmount))}.</div>` : ''}
        <a class="btn ${cartDetails.length && subtotal >= Number(ss.checkoutSettings.minimumOrderAmount || 0) ? '' : 'btn-secondary'}" href="${base}/checkout?mode=cart">Proceed to checkout</a>
      </section>
    </div></div>
  `, getStoreShellOptions(req, store, { extraStyles: renderStoreCss(currentTemplate, store.theme), metaTags: getStoreMetaTags(store, { title: `Cart - ${store.name}`, description: store.description }) })));
}));

router.get('/:slug/wishlist', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) {
    res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404));
    return;
  }
  const currentTemplate = getTemplateById(db, store.template);
  const wishlist = getStoreWishlist(req, slug);
  const items = wishlist.map((productId) => store.products.find((product) => product.id === productId)).filter(Boolean);
  const isSubdomain = !!(req.subdomainSlug);
  const base = isSubdomain ? '' : '/store/' + encodeURIComponent(slug);
  const html = items.length ? items.map((product) => `
    <div class="summary-row">
      <div><strong>${escapeHtml(product.name)}</strong><div class="muted">${escapeHtml(formatMoney(product.price))}</div></div>
      <div class="actions">
        <form method="POST" action="${base}/cart/add/${encodeURIComponent(product.id)}"><button class="btn" type="submit">Add to cart</button></form>
        <form method="POST" action="${base}/wishlist/toggle/${encodeURIComponent(product.id)}"><button class="btn btn-danger" type="submit">Remove</button></form>
      </div>
    </div>
  `).join('') : '<div class="store-empty">Wishlist is empty.</div>';
  res.send(renderHtmlShell(`${store.name} - Wishlist`, `
    <div class="store-page"><div class="store-wrap wishlist-page">
      <div class="store-nav"><a href="${base || '/'}">Continue shopping</a><a href="${base}/cart">Cart</a><a href="${base}/track-order">Track order</a></div>
      <section class="card panel">
        <div class="title-row"><div><h1 class="page-title">Wishlist</h1><p class="page-subtitle">Saved products</p></div></div>
        ${html}
      </section>
    </div></div>
  `, getStoreShellOptions(req, store, { extraStyles: renderStoreCss(currentTemplate, store.theme) })));
}));

router.get('/:slug/checkout', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) {
    res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404));
    return;
  }
  const currentTemplate = getTemplateById(db, store.template);
  const ss = ensureStoreSettings(store);
  const draft = getCheckoutDraft(req, slug);
  const checkoutMode = normalizeCheckoutMode(req.query.mode || draft.mode || 'cart');
  if (draft.mode !== checkoutMode) {
    draft.mode = checkoutMode;
    draft.step = 'contact';
    if (checkoutMode === 'cart') {
      delete draft.items;
    }
  }
  const checkoutStep = normalizeCheckoutStep(req.query.step || draft.step || 'contact');
  draft.step = checkoutStep;
  saveCheckoutDraft(req, slug, draft);
  const cartDetails = getCartDetails(store, getStoreCart(req, slug));
  const lineItems = getCheckoutLineItems(store, draft, cartDetails);
  if (cartDetails.length > 0) {
    store.abandonedCarts = Array.isArray(store.abandonedCarts) ? store.abandonedCarts : [];
    const existing = store.abandonedCarts.find((entry) => entry.sessionId === req.sessionID);
    if (existing) {
      existing.cart = cartDetails.map((item) => ({ productId: item.product.id, quantity: item.quantity, variantSummary: item.variantSummary || '' }));
      existing.customerName = draft.contactName || existing.customerName || '';
      existing.customerPhone = draft.contactPhone || existing.customerPhone || '';
      existing.updatedAt = new Date().toISOString();
    } else {
      store.abandonedCarts.push({
        sessionId: req.sessionID,
        cart: cartDetails.map((item) => ({ productId: item.product.id, quantity: item.quantity, variantSummary: item.variantSummary || '' })),
        startedAt: new Date().toISOString(),
        customerName: draft.contactName || '',
        customerPhone: draft.contactPhone || ''
      });
    }
    await saveDB(db);
  }
  if (!lineItems.length) {
    res.send(renderHtmlShell(`${store.name} - Checkout`, `<div class="store-page"><div class="store-wrap"><div class="store-empty">Your cart is empty. <a href="/store/${encodeURIComponent(slug)}">Go back</a></div></div></div>`, getStoreShellOptions(req, store, { extraStyles: renderStoreCss(currentTemplate, store.theme) })));
    return;
  }
  const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
  const shippingFee = getEffectiveShippingFee(store, subtotal);
  const taxRate = store.taxSettings && store.taxSettings.enabled ? Number(store.taxSettings.rate || 0) : 0;
  const taxAmount = store.taxSettings && store.taxSettings.enabled ? subtotal * (taxRate / 100) : 0;
  const total = applyRoundingMode(subtotal + shippingFee + taxAmount, ss.checkoutSettings.roundingMode);
  if (Number(ss.checkoutSettings.minimumOrderAmount || 0) > 0 && subtotal < Number(ss.checkoutSettings.minimumOrderAmount || 0)) {
    setFlash(req, 'error', `Minimum order amount is ${formatMoney(ss.checkoutSettings.minimumOrderAmount)}.`);
    res.redirect(`/store/${encodeURIComponent(slug)}/cart`);
    return;
  }
  const customer = await getLoggedCustomer(req, slug);
  const contactName = draft.contactName || (customer ? customer.name : '');
  const contactPhone = draft.contactPhone || (customer ? customer.phone : '');
  const contactEmail = draft.contactEmail || (customer ? customer.email : '');
  const shippingAddress = draft.shippingAddress || (customer && Array.isArray(customer.addresses) && customer.addresses.length ? customer.addresses[0] : '');
  const orderNotes = draft.orderNotes || ss.checkoutSettings.cartNote || '';
  const paymentOptions = [];
  if (ss.paymentSettings.cod === true) paymentOptions.push({ value: 'cod', label: 'Cash on Delivery', sub: 'Pay when you receive your order' });
  if (ss.paymentSettings.onlinePayment === true) paymentOptions.push({ value: 'online', label: 'Pay Online', sub: 'UPI, Card, Net Banking' });
  paymentOptions.push({ value: 'whatsapp', label: 'Pay via WhatsApp', sub: 'Confirm order on WhatsApp' });
  const selectedPaymentMethod = paymentOptions.some((item) => item.value === draft.paymentMethod) ? draft.paymentMethod : (paymentOptions[0] ? paymentOptions[0].value : 'whatsapp');
  const paymentOptionsHtml = `<div class="form-grid" style="margin-top:14px;">${paymentOptions.map((item) => `<label style="display:flex;gap:12px;align-items:center;padding:14px;border-radius:14px;border:1px solid var(--border);cursor:pointer;"><input type="radio" name="paymentMode" value="${escapeHtml(item.value)}" ${selectedPaymentMethod === item.value ? 'checked' : ''} required><div><strong>${escapeHtml(item.label)}</strong><div style="font-size:13px;color:#64748b;">${escapeHtml(item.sub)}</div></div></label>`).join('')}</div>`;
  const stepIndex = checkoutStep === 'contact' ? 1 : checkoutStep === 'shipping' ? 2 : 3;
  const stepperHtml = [
    { key: 'contact', title: 'Contact', text: 'Who is ordering?' },
    { key: 'shipping', title: 'Shipping', text: 'Where should it go?' },
    { key: 'payment', title: 'Payment', text: 'Review and place order' }
  ].map((item, index) => `<div class="checkout-step ${checkoutStep === item.key ? 'active' : ''}"><strong>${index + 1}. ${escapeHtml(item.title)}</strong><span>${escapeHtml(item.text)}</span></div>`).join('');
  const lineItemsHtml = lineItems.map((item) => `
    <div class="checkout-item">
      <div>
        <strong>${escapeHtml(item.product.name)}</strong>
        <small>${escapeHtml(String(item.quantity))} x ${escapeHtml(formatMoney(item.price != null ? item.price : item.product.price))}</small>
        ${item.variantSummary ? `<small>${escapeHtml(item.variantSummary)}</small>` : ''}
      </div>
      <strong>${escapeHtml(formatMoney(item.subtotal))}</strong>
    </div>
  `).join('');
  const summaryHtml = `
    <section class="card panel checkout-panel">
      <div class="title-row"><div><h2 class="section-title" style="font-size:20px; margin:0;">Order summary</h2><p class="section-subtitle">${escapeHtml(checkoutMode === 'buy-now' ? 'Single-item checkout' : 'Cart checkout')}</p></div></div>
      <div class="checkout-review">${lineItemsHtml}</div>
      <div class="summary-box" style="margin-top:16px;">
        <div class="summary-row"><span>Subtotal</span><strong>${escapeHtml(formatMoney(subtotal))}</strong></div>
        <div class="summary-row"><span>Shipping</span><strong>${escapeHtml(formatMoney(shippingFee))}</strong></div>
        ${ss.checkoutSettings.showTaxInfo !== false ? `<div class="summary-row"><span>Tax</span><strong>${escapeHtml(formatMoney(taxAmount))}</strong></div>` : ''}
        <div class="summary-row"><span>Total</span><strong>${escapeHtml(formatMoney(total))}</strong></div>
        ${ss.checkoutSettings.cartNote ? `<div class="summary-row"><span>Cart note</span><strong>${escapeHtml(ss.checkoutSettings.cartNote)}</strong></div>` : ''}
      </div>
    </section>`;
  const contactSection = checkoutStep === 'contact' ? `
    <section class="card panel">
      <div class="title-row"><div><h2 class="section-title" style="font-size:20px; margin:0;">Contact details</h2><p class="section-subtitle">Step ${stepIndex} of 3</p></div></div>
      <form method="POST" action="/store/${encodeURIComponent(slug)}/checkout" class="form-grid checkout-form">
        <input type="hidden" name="step" value="contact">
        <input type="hidden" name="mode" value="${escapeHtml(checkoutMode)}">
        <div class="form-grid two">
          <div class="field"><label for="name">Full Name</label><input id="name" name="name" value="${escapeHtml(contactName)}" required></div>
          <div class="field"><label for="phone">Phone</label><input id="phone" name="phone" value="${escapeHtml(contactPhone)}" required></div>
          <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" value="${escapeHtml(contactEmail)}" required></div>
         <div class="field"><label for="paymentMethod">Payment Method</label><select id="paymentMethod" name="paymentMethod" disabled><option>Choose at payment step</option></select></div>
        </div>
        <div class="actions"><button class="btn" type="submit">Continue to shipping</button></div>
      </form>
    </section>` : '';
  const shippingSection = checkoutStep === 'shipping' ? `
    <section class="card panel">
      <div class="title-row"><div><h2 class="section-title" style="font-size:20px; margin:0;">Shipping address</h2><p class="section-subtitle">Step ${stepIndex} of 3</p></div><a class="btn btn-secondary" href="/store/${encodeURIComponent(slug)}/checkout?mode=${encodeURIComponent(checkoutMode)}&step=contact">Edit contact</a></div>
      <div class="summary-box" style="margin-bottom:14px;">
        <div class="summary-row"><span>Name</span><strong>${escapeHtml(contactName)}</strong></div>
        <div class="summary-row"><span>Phone</span><strong>${escapeHtml(contactPhone)}</strong></div>
        <div class="summary-row"><span>Email</span><strong>${escapeHtml(contactEmail)}</strong></div>
      </div>
      <form method="POST" action="/store/${encodeURIComponent(slug)}/checkout" class="form-grid checkout-form">
        <input type="hidden" name="step" value="shipping">
        <input type="hidden" name="mode" value="${escapeHtml(checkoutMode)}">
        <div class="field"><label for="address">${escapeHtml(ss.deliverySettings.serviceType === 'pickup' ? 'Pickup Address / Landmark' : 'Shipping Address')}</label><textarea id="address" name="address" required>${escapeHtml(shippingAddress)}</textarea></div>
        <div class="field"><label for="notes">Order Notes</label><textarea id="notes" name="notes">${escapeHtml(orderNotes)}</textarea></div>
        <div class="actions"><a class="btn btn-secondary" href="/store/${encodeURIComponent(slug)}/checkout?mode=${encodeURIComponent(checkoutMode)}&step=contact">Back</a><button class="btn" type="submit">Continue to payment</button></div>
      </form>
    </section>` : '';
  const paymentSection = checkoutStep === 'payment' ? `
    <section class="card panel">
      <div class="title-row"><div><h2 class="section-title" style="font-size:20px; margin:0;">Payment & review</h2><p class="section-subtitle">Step ${stepIndex} of 3</p></div><a class="btn btn-secondary" href="/store/${encodeURIComponent(slug)}/checkout?mode=${encodeURIComponent(checkoutMode)}&step=shipping">Edit shipping</a></div>
      <div class="summary-box" style="margin-bottom:14px;">
        <div class="summary-row"><span>Name</span><strong>${escapeHtml(contactName)}</strong></div>
        <div class="summary-row"><span>Phone</span><strong>${escapeHtml(contactPhone)}</strong></div>
        <div class="summary-row"><span>Email</span><strong>${escapeHtml(contactEmail)}</strong></div>
        <div class="summary-row"><span>Address</span><strong>${escapeHtml(shippingAddress)}</strong></div>
      </div>
      <form method="POST" action="/store/${encodeURIComponent(slug)}/checkout" class="form-grid checkout-form">
        <input type="hidden" name="step" value="payment">
        <input type="hidden" name="mode" value="${escapeHtml(checkoutMode)}">
         <div class="field"><label>Payment Method</label>${paymentOptionsHtml}</div>
         <div class="field"><label for="notes">Order Notes</label><textarea id="notes" name="notes" readonly>${escapeHtml(orderNotes)}</textarea></div>
        ${ss.paymentSettings.partialCod ? `<div class="field"><label>Advance partial payment</label><input value="Enabled for COD orders" readonly></div>` : ''}
        ${ss.paymentSettings.bankDetails ? `<div class="field"><label>Bank details</label><textarea readonly>${escapeHtml(ss.paymentSettings.bankDetails)}</textarea></div>` : ''}
        <div class="actions"><a class="btn btn-secondary" href="/store/${encodeURIComponent(slug)}/checkout?mode=${encodeURIComponent(checkoutMode)}&step=shipping">Back</a><button class="btn" type="submit">Place Order</button></div>
      </form>
    </section>` : '';
  res.send(renderHtmlShell(`${store.name} - Checkout`, `
    <div class="store-page"><div class="store-wrap checkout-page">
      <div class="store-nav"><a href="/store/${encodeURIComponent(slug)}">Home</a><a href="/store/${encodeURIComponent(slug)}/cart?mode=cart">Cart</a><a href="/store/${encodeURIComponent(slug)}/wishlist">Wishlist</a></div>
      <section class="card panel">
        <div class="title-row"><div><h1 class="page-title">Checkout</h1><p class="page-subtitle">${escapeHtml(checkoutMode === 'buy-now' ? 'Fast checkout for a single item' : 'Complete your order in three steps')}</p></div></div>
        <div class="checkout-steps">${stepperHtml}</div>
      </section>
      <div class="checkout-layout">
        <div>
          ${contactSection}
          ${shippingSection}
          ${paymentSection}
        </div>
        ${summaryHtml}
      </div>
    </div></div>
  `, getStoreShellOptions(req, store, { extraStyles: renderStoreCss(currentTemplate, store.theme), metaTags: getStoreMetaTags(store, { title: `Checkout - ${store.name}`, description: store.description }), headExtras: buildStoreTrackingHead('InitiateCheckout', { value: Number(total || 0), currency: 'INR', content_name: store.name }) })));
}));

router.post('/:slug/checkout', route(async (req, res) => {
  try {
    const db = await loadDB();
    const slug = String(req.params.slug || '').trim();
    const store = db.stores[slug];
    if (!store) {
      res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404));
      return;
    }
    const ss = ensureStoreSettings(store);
    const draft = getCheckoutDraft(req, slug);
    const checkoutMode = normalizeCheckoutMode(req.body.mode || draft.mode || 'cart');
    if (draft.mode !== checkoutMode) {
      draft.mode = checkoutMode;
      if (checkoutMode === 'cart') {
        delete draft.items;
      }
    }
    const cartDetails = getCartDetails(store, getStoreCart(req, slug));
    const lineItems = getCheckoutLineItems(store, draft, cartDetails);
    if (!lineItems.length) {
      setFlash(req, 'error', 'Your cart is empty.');
      res.redirect(`/store/${encodeURIComponent(slug)}/cart`);
      return;
    }
    const step = normalizeCheckoutStep(req.body.step || draft.step || 'contact');
    const name = String(req.body.name || draft.contactName || '').trim();
    const phone = sanitizePhone(req.body.phone || draft.contactPhone || '');
    const email = String(req.body.email || draft.contactEmail || '').trim().toLowerCase();
    const address = String(req.body.address || draft.shippingAddress || '').trim();
    const notes = String(req.body.notes || draft.orderNotes || '').trim();
    const rawPaymentMode = String(req.body.paymentMode || req.body.paymentMethod || draft.paymentMethod || 'whatsapp').trim();
    const paymentMethod = ['cod', 'online', 'whatsapp'].includes(rawPaymentMode) ? rawPaymentMode : 'whatsapp';
    const allowedMethods = [];
    if (ss.paymentSettings.cod === true) allowedMethods.push('cod');
    if (ss.paymentSettings.onlinePayment === true) allowedMethods.push('online');
    allowedMethods.push('whatsapp');
    if (step === 'contact') {
      if (!name || !phone || !validateEmail(email)) {
        draft.mode = checkoutMode;
        draft.step = 'contact';
        draft.contactName = name;
        draft.contactPhone = phone;
        draft.contactEmail = email;
        saveCheckoutDraft(req, slug, draft);
        setFlash(req, 'error', 'Please fill your contact details.');
        res.redirect(`/store/${encodeURIComponent(slug)}/checkout?mode=${encodeURIComponent(checkoutMode)}&step=contact`);
        return;
      }
      draft.mode = checkoutMode;
      draft.step = 'shipping';
      draft.contactName = name;
      draft.contactPhone = phone;
      draft.contactEmail = email;
      store.abandonedCarts = Array.isArray(store.abandonedCarts) ? store.abandonedCarts : [];
      const existingAbandoned = store.abandonedCarts.find((entry) => entry.sessionId === req.sessionID);
      if (existingAbandoned) {
        existingAbandoned.customerName = name;
        existingAbandoned.customerPhone = phone;
      }
      await saveDB(db);
      saveCheckoutDraft(req, slug, draft);
      res.redirect(`/store/${encodeURIComponent(slug)}/checkout?mode=${encodeURIComponent(checkoutMode)}&step=shipping`);
      return;
    }
    if (!draft.contactName || !draft.contactPhone || !validateEmail(String(draft.contactEmail || ''))) {
      draft.mode = checkoutMode;
      draft.step = 'contact';
      saveCheckoutDraft(req, slug, draft);
      setFlash(req, 'error', 'Please complete contact details first.');
      res.redirect(`/store/${encodeURIComponent(slug)}/checkout?mode=${encodeURIComponent(checkoutMode)}&step=contact`);
      return;
    }
    if (step === 'shipping') {
      if (!address) {
        draft.mode = checkoutMode;
        draft.step = 'shipping';
        draft.shippingAddress = address;
        draft.orderNotes = notes;
        saveCheckoutDraft(req, slug, draft);
        setFlash(req, 'error', 'Please add a shipping address.');
        res.redirect(`/store/${encodeURIComponent(slug)}/checkout?mode=${encodeURIComponent(checkoutMode)}&step=shipping`);
        return;
      }
      draft.mode = checkoutMode;
      draft.step = 'payment';
      draft.shippingAddress = address;
      draft.orderNotes = notes;
      saveCheckoutDraft(req, slug, draft);
      res.redirect(`/store/${encodeURIComponent(slug)}/checkout?mode=${encodeURIComponent(checkoutMode)}&step=payment`);
      return;
    }
    if (!draft.shippingAddress) {
      draft.mode = checkoutMode;
      draft.step = 'shipping';
      draft.orderNotes = notes;
      saveCheckoutDraft(req, slug, draft);
      setFlash(req, 'error', 'Please add your shipping address.');
      res.redirect(`/store/${encodeURIComponent(slug)}/checkout?mode=${encodeURIComponent(checkoutMode)}&step=shipping`);
      return;
    }
    draft.paymentMethod = paymentMethod;
    const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
    if (Number(ss.checkoutSettings.minimumOrderAmount || 0) > 0 && subtotal < Number(ss.checkoutSettings.minimumOrderAmount || 0)) {
      setFlash(req, 'error', `Minimum order amount is ${formatMoney(ss.checkoutSettings.minimumOrderAmount)}.`);
      res.redirect(`/store/${encodeURIComponent(slug)}/cart`);
      return;
    }
    if (!allowedMethods.includes(paymentMethod)) {
      setFlash(req, 'error', 'Selected payment method is not available.');
      res.redirect(`/store/${encodeURIComponent(slug)}/checkout?mode=${encodeURIComponent(checkoutMode)}&step=payment`);
      return;
    }
    const stockCheck = ensureLineItemsInStock(store, lineItems);
    if (!stockCheck.ok) {
      setFlash(req, 'error', `${stockCheck.productName} is no longer available in the requested quantity.`);
      res.redirect(`/store/${encodeURIComponent(slug)}/cart`);
      return;
    }
    const shippingFee = getEffectiveShippingFee(store, subtotal);
    const taxRate = store.taxSettings && store.taxSettings.enabled ? Number(store.taxSettings.rate || 0) : 0;
    const taxAmount = store.taxSettings && store.taxSettings.enabled ? subtotal * (taxRate / 100) : 0;
    const total = applyRoundingMode(subtotal + shippingFee + taxAmount, ss.checkoutSettings.roundingMode);
    const createdAt = new Date().toISOString();
    const trackingCode = generateTrackingCode();
    const autoMode = ss.orderSettings.autoConfirmPaymentMode || 'online';
    const autoStatus = autoMode === 'both' || (autoMode === 'online' && paymentMethod === 'online') || (autoMode === 'cod' && paymentMethod === 'cod') ? 'confirmed' : 'pending';
    const razorpayConfig = paymentMethod === 'online' ? getRazorpayConfig(store) : null;
    const order = {
      id: generateId('ord'),
      storeSlug: slug,
      vendorId: store.ownerId || '',
      orderNumber: generateOrderNumber(store),
      trackingCode,
      productId: lineItems[0].product.id,
      productName: lineItems.map((item) => item.product.name).join(', '),
      items: lineItems.map((item) => ({ productId: item.product.id, name: item.product.name, price: item.price != null ? item.price : item.product.price, quantity: item.quantity, variantSelections: item.variantSelections || {}, variantSummary: item.variantSummary || '', sku: item.sku || item.product.sku || '' })),
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
      shippingAddress: draft.shippingAddress,
      notes,
      paymentMethod,
      paymentMode: paymentMethod,
      paymentGateway: razorpayConfig ? 'razorpay' : '',
      status: autoStatus,
      amount: String(total),
      subtotal: String(subtotal),
      shippingFee: String(shippingFee),
      taxAmount: String(taxAmount),
      createdAt,
      trackingHistory: [{ status: autoStatus === 'confirmed' ? 'confirmed' : 'placed', at: createdAt }],
      customerNote: ss.orderSettings.orderNote || '',
      deliveryType: ss.deliverySettings.serviceType || 'delivery'
    };
    if (razorpayConfig) {
      try {
        const gatewayOrder = await createRazorpayOrder(store, order);
        order.gatewayOrderId = gatewayOrder.id;
        order.gatewayPayload = gatewayOrder;
      } catch (gatewayError) {
        setFlash(req, 'error', gatewayError.message || 'Unable to start online payment.');
        res.redirect(`/store/${encodeURIComponent(slug)}/checkout?mode=${encodeURIComponent(checkoutMode)}&step=payment`);
        return;
      }
    }
    store.orders = Array.isArray(store.orders) ? store.orders : [];
    store.orders.push(order);
    store.customers = store.customers && typeof store.customers === 'object' ? store.customers : {};
    if (!store.customers[email]) {
      store.customers[email] = {
        id: email,
        email,
        name,
        phone,
        passwordHash: '',
        orders: [],
        wishlist: [],
        createdAt,
        addresses: [address]
      };
    }
    const customer = store.customers[email];
    customer.name = name;
    customer.phone = phone;
    customer.orders = Array.isArray(customer.orders) ? customer.orders : [];
    customer.orders.push(order.id);
    customer.addresses = Array.isArray(customer.addresses) ? customer.addresses : [];
    if (!customer.addresses.includes(draft.shippingAddress)) {
      customer.addresses.unshift(draft.shippingAddress);
    }
    if (paymentMethod !== 'online') {
      adjustOrderInventory(store, order, 'deduct');
    }
    store.abandonedCarts = (Array.isArray(store.abandonedCarts) ? store.abandonedCarts : []).filter((entry) => entry.sessionId !== req.sessionID);
    await saveDB(db);
    if (checkoutMode === 'cart') {
      saveStoreCart(req, slug, []);
    }
    clearCheckoutDraft(req, slug);
    setLoggedCustomer(req, slug, email);
    if (razorpayConfig && order.gatewayOrderId) {
      setFlash(req, 'info', 'Complete your payment to confirm the order.');
      res.redirect(`/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(trackingCode)}/pay`);
      return;
    }
    await runOrderHooks(store, order, db);
    pushTrackingEvent(req, {
      fbqEvent: 'Purchase',
      fbqPayload: { value: Number(order.amount || 0), currency: 'INR' },
      gtagEvent: 'purchase',
      gtagPayload: { transaction_id: order.orderNumber, value: Number(order.amount || 0), currency: 'INR' }
    });
    setFlash(req, 'success', 'Order placed successfully.');
    res.redirect(`/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(trackingCode)}`);
  } catch (error) {
    setFlash(req, 'error', 'Unable to place order.');
    res.redirect(`/store/${encodeURIComponent(req.params.slug)}/checkout`);
  }
}));

router.get('/:slug/buy/:id', route(async (req, res) => {
  try {
    const db = await loadDB();
    const slug = String(req.params.slug || '').trim();
    const productId = String(req.params.id || '').trim();
    const store = db.stores[slug];
    if (!store) {
      res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404));
      return;
    }
    const product = store.products.find((item) => item.id === productId);
    if (!product) {
      setFlash(req, 'error', 'Product not found.');
      res.redirect(`/store/${encodeURIComponent(slug)}`);
      return;
    }
    if (Number(product.stock || 0) <= 0) {
      setFlash(req, 'error', 'Product is out of stock.');
      res.redirect(`/store/${encodeURIComponent(slug)}`);
      return;
    }
    const draft = getCheckoutDraft(req, slug);
    const variantSelections = buildVariantSelectionsFromRequest(req.query, product);
    const variantState = resolveVariantSelectionState(product, variantSelections);
    draft.mode = 'buy-now';
    draft.step = 'contact';
    draft.items = [{ productId: product.id, quantity: Math.max(1, Math.min(Number(variantState.stock || product.stock || 1), Number(req.query.quantity || 1) || 1)), variantSelections, variantSummary: variantState.summary, price: variantState.price, sku: variantState.sku }];
    saveCheckoutDraft(req, slug, draft);
    res.redirect(`/store/${encodeURIComponent(slug)}/checkout?mode=buy-now`);
  } catch (error) {
    res.redirect(`/store/${encodeURIComponent(req.params.slug)}`);
  }
}));

router.get('/:slug/track-order', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) {
    res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404));
    return;
  }
  const currentTemplate = getTemplateById(db, store.template);
  const code = String(req.query.code || '').trim();
  const order = code ? store.orders.find((item) => item.trackingCode === code || item.orderNumber === code || item.id === code) : null;
  const orderHtml = order ? `<div class="card panel"><div class="title-row"><div><h2 class="section-title" style="font-size:20px; margin:0;">${escapeHtml(order.orderNumber)}</h2><p class="section-subtitle">${escapeHtml(order.productName)}</p></div><span class="badge badge-live">${escapeHtml(order.status)}</span></div><div class="kpi-list"><div class="kpi-item"><strong>Customer</strong><span>${escapeHtml(order.customerName)}</span></div><div class="kpi-item"><strong>Phone</strong><span>${escapeHtml(order.customerPhone)}</span></div><div class="kpi-item"><strong>Total</strong><span>${escapeHtml(formatMoney(order.amount))}</span></div><div class="kpi-item"><strong>Tracking Code</strong><span>${escapeHtml(order.trackingCode)}</span></div></div></div>` : '<div class="store-empty">Enter your tracking code to view order status.</div>';
  res.send(renderHtmlShell(`${store.name} - Track Order`, `
    <div class="store-page"><div class="store-wrap tracking-page">
      <div class="store-nav"><a href="/store/${encodeURIComponent(slug)}">Home</a><a href="/store/${encodeURIComponent(slug)}/cart">Cart</a><a href="/store/${encodeURIComponent(slug)}/wishlist">Wishlist</a></div>
      <section class="card panel">
        <div class="title-row"><div><h1 class="page-title">Track Order</h1><p class="page-subtitle">Enter tracking code or order number</p></div></div>
        <form method="GET" action="/store/${encodeURIComponent(slug)}/track-order" class="form-grid">
          <div class="field"><label for="code">Tracking code / order number</label><input id="code" name="code" value="${escapeHtml(code)}" placeholder="trk_xxx or #1001"></div>
          <div class="actions"><button class="btn" type="submit">Track</button></div>
        </form>
      </section>
      ${orderHtml}
    </div></div>
  `, getStoreShellOptions(req, store, { extraStyles: renderStoreCss(currentTemplate, store.theme) })));
}));

router.get('/:slug/order/:code', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) {
    res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404));
    return;
  }
  const order = store.orders.find((item) => item.trackingCode === req.params.code || item.orderNumber === req.params.code || item.id === req.params.code);
  if (!order) {
    res.status(404).send(renderGlobalError('Order Not Found', 'The order you are looking for does not exist.', 404));
    return;
  }
  const currentTemplate = getTemplateById(db, store.template);
  const ss = ensureStoreSettings(store);
  const flash = renderFlashMessages(req);
  const cancelHtml = ss.orderSettings.allowOrderCancellation !== false && ['pending', 'confirmed'].includes(order.status) ? `<form method="POST" action="/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(order.trackingCode)}/cancel"><button class="btn btn-danger" type="submit">Cancel order</button></form>` : '';
  const invoiceHtml = ss.orderSettings.allowInvoiceDownload !== false ? `<a class="btn btn-secondary" href="/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(order.trackingCode)}/invoice">Download invoice</a>` : '';
  const payHtml = order.paymentMode === 'online' && order.status === 'pending' && order.gatewayOrderId ? `<a class="btn" href="/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(order.trackingCode)}/pay">Complete payment</a>` : '';
  res.send(renderHtmlShell(`Order ${order.orderNumber}`, `
    <div class="store-page"><div class="store-wrap tracking-page">
      ${flash}
      <section class="card panel">
        <div class="title-row"><div><h1 class="page-title">${escapeHtml(order.orderNumber)}</h1><p class="page-subtitle">${escapeHtml(order.productName)}</p></div><span class="badge badge-live">${escapeHtml(order.status)}</span></div>
        <div class="kpi-list"><div class="kpi-item"><strong>Customer</strong><span>${escapeHtml(order.customerName)}</span></div><div class="kpi-item"><strong>Email</strong><span>${escapeHtml(order.customerEmail || '-')}</span></div><div class="kpi-item"><strong>Phone</strong><span>${escapeHtml(order.customerPhone)}</span></div><div class="kpi-item"><strong>Tracking</strong><span>${escapeHtml(order.trackingCode)}</span></div><div class="kpi-item"><strong>Total</strong><span>${escapeHtml(formatMoney(order.amount))}</span></div><div class="kpi-item"><strong>Payment Mode</strong><span>${escapeHtml(order.paymentMode || order.paymentMethod || 'whatsapp')}</span></div>${order.customerNote ? `<div class="kpi-item"><strong>Order note</strong><span>${escapeHtml(order.customerNote)}</span></div>` : ''}</div><div class="actions" style="margin-top:16px;">${payHtml}${invoiceHtml}${cancelHtml}</div>
      </section>
    </div></div>
  `, getStoreShellOptions(req, store, { extraStyles: renderStoreCss(currentTemplate, store.theme) })));
}));

router.get('/:slug/order/:code/pay', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
  const order = store.orders.find((item) => item.trackingCode === req.params.code || item.orderNumber === req.params.code || item.id === req.params.code);
  const razorpayConfig = getRazorpayConfig(store);
  if (!order || !razorpayConfig || !order.gatewayOrderId) { res.redirect(`/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(req.params.code)}`); return; }
  const currentTemplate = getTemplateById(db, store.template);
  const callbackUrl = `${getBaseUrl(req)}/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(order.trackingCode)}/razorpay/verify`;
  const paymentScript = `<script src="https://checkout.razorpay.com/v1/checkout.js"></script><script>(function(){var options={key:${JSON.stringify(razorpayConfig.keyId)},amount:${Math.round(Number(order.amount || 0) * 100)},currency:'INR',name:${JSON.stringify(store.name)},description:${JSON.stringify('Order ' + order.orderNumber)},order_id:${JSON.stringify(order.gatewayOrderId)},prefill:{name:${JSON.stringify(order.customerName || '')},email:${JSON.stringify(order.customerEmail || '')},contact:${JSON.stringify(order.customerPhone || '')}},theme:{color:${JSON.stringify(razorpayConfig.themeColor || '#111827')}},handler:function(response){var form=document.getElementById('razorpayVerifyForm');form.querySelector('[name="razorpay_order_id"]').value=response.razorpay_order_id;form.querySelector('[name="razorpay_payment_id"]').value=response.razorpay_payment_id;form.querySelector('[name="razorpay_signature"]').value=response.razorpay_signature;form.submit();},modal:{ondismiss:function(){window.location.href=${JSON.stringify(`/store/${slug}/order/${order.trackingCode}`)};}}};var rz=new Razorpay(options);document.getElementById('payNowButton').addEventListener('click',function(e){e.preventDefault();rz.open();});setTimeout(function(){document.getElementById('payNowButton').click();},300);})();</script>`;
  res.send(renderHtmlShell(`Pay ${order.orderNumber}`, `<div class="store-page"><div class="store-wrap account-page"><section class="card panel"><h1 class="section-title">Complete Payment</h1><p class="section-subtitle">Order ${escapeHtml(order.orderNumber)} · ${escapeHtml(formatMoney(order.amount))}</p><div class="actions"><button id="payNowButton" class="btn" type="button">Pay with Razorpay</button><a class="btn btn-secondary" href="/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(order.trackingCode)}">Back to Order</a></div><form id="razorpayVerifyForm" method="POST" action="${escapeHtml(callbackUrl)}" style="display:none;"><input type="hidden" name="razorpay_order_id"><input type="hidden" name="razorpay_payment_id"><input type="hidden" name="razorpay_signature"></form></section></div></div>`, getStoreShellOptions(req, store, { extraStyles: renderStoreCss(currentTemplate, store.theme), bodyEndScripts: paymentScript })));
}));

router.post('/:slug/order/:code/razorpay/verify', route(async (req, res) => {
  try {
    const db = await loadDB();
    const slug = String(req.params.slug || '').trim();
    const store = db.stores[slug];
    if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
    const order = store.orders.find((item) => item.trackingCode === req.params.code || item.orderNumber === req.params.code || item.id === req.params.code);
    if (!order) { res.status(404).send(renderGlobalError('Order Not Found', 'The order you are looking for does not exist.', 404)); return; }
    if (order.paymentVerifiedAt && order.status === 'confirmed') {
      setFlash(req, 'success', 'Payment was already verified for this order.');
      res.redirect(`/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(order.trackingCode)}`);
      return;
    }
    const valid = verifyRazorpaySignature(store, req.body.razorpay_order_id, req.body.razorpay_payment_id, req.body.razorpay_signature);
    if (!valid) {
      if (order.customerEmail) sendPaymentFailureEmail(order, store).catch(console.error);
      setFlash(req, 'error', 'Payment verification failed.');
      res.redirect(`/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(order.trackingCode)}`);
      return;
    }
    if (!order.stockDeducted) {
      const availability = ensureLineItemsInStock(store, (order.items || []).map((item) => ({ product: { id: item.productId, name: item.name }, quantity: item.quantity, variantSelections: item.variantSelections || {} })));
      if (!availability.ok) {
        order.status = 'payment-review';
        order.paymentVerifiedAt = new Date().toISOString();
        order.paymentReviewReason = 'insufficient_stock_after_payment';
        order.trackingHistory = Array.isArray(order.trackingHistory) ? order.trackingHistory : [];
        order.trackingHistory.push({ status: 'payment-review', at: order.paymentVerifiedAt });
        await saveDB(db);
        setFlash(req, 'info', 'Payment received. Your order is under manual review because stock changed before payment confirmation.');
        res.redirect(`/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(order.trackingCode)}`);
        return;
      }
      adjustOrderInventory(store, order, 'deduct');
    }
    order.paymentVerifiedAt = new Date().toISOString();
    order.razorpayPaymentId = String(req.body.razorpay_payment_id || '').trim();
    order.razorpaySignature = String(req.body.razorpay_signature || '').trim();
    order.status = 'confirmed';
    order.trackingHistory = Array.isArray(order.trackingHistory) ? order.trackingHistory : [];
    order.trackingHistory.push({ status: 'payment-confirmed', at: order.paymentVerifiedAt });
    await saveDB(db);
    if (order.customerEmail) sendPaymentSuccessEmail(order, store).catch(console.error);
    await runOrderHooks(store, order, db);
    pushTrackingEvent(req, {
      fbqEvent: 'Purchase',
      fbqPayload: { value: Number(order.amount || 0), currency: 'INR' },
      gtagEvent: 'purchase',
      gtagPayload: { transaction_id: order.orderNumber, value: Number(order.amount || 0), currency: 'INR' }
    });
    setFlash(req, 'success', 'Payment successful and order confirmed.');
    res.redirect(`/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(order.trackingCode)}`);
  } catch (error) {
    setFlash(req, 'error', 'Unable to verify payment.');
    res.redirect(`/store/${encodeURIComponent(req.params.slug)}/order/${encodeURIComponent(req.params.code)}`);
  }
}));

router.get('/:slug/order/:code/invoice', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).send('Store not found'); return; }
  const ss = ensureStoreSettings(store);
  const order = store.orders.find((item) => item.trackingCode === req.params.code || item.orderNumber === req.params.code || item.id === req.params.code);
  if (!order) { res.status(404).send('Order not found'); return; }
  if (ss.orderSettings && ss.orderSettings.allowInvoiceDownload === false) { res.status(403).send('Invoice download disabled'); return; }
  const invoiceHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Invoice - ${escapeHtml(order.orderNumber || order.id)}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #111; }
  .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111; padding-bottom: 20px; margin-bottom: 20px; }
  .invoice-title { font-size: 32px; font-weight: 900; }
  .store-name { font-size: 20px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th, td { padding: 10px 12px; border: 1px solid #e5e7eb; text-align: left; }
  th { background: #f9fafb; font-weight: 700; }
  .total-row { font-weight: 900; font-size: 16px; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
  @media print { body { margin: 0; max-width: 100%; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="invoice-title">INVOICE</div>
      <div style="margin-top:8px;color:#6b7280;">Order: <strong>${escapeHtml(order.orderNumber || order.id)}</strong></div>
      <div style="color:#6b7280;">Date: ${escapeHtml(formatDate(order.createdAt))}</div>
      <div style="color:#6b7280;">Tracking: ${escapeHtml(order.trackingCode || '-')}</div>
    </div>
    <div style="text-align:right;">
      <div class="store-name">${escapeHtml(store.name)}</div>
      ${store.whatsapp ? `<div style="color:#6b7280;">WhatsApp: ${escapeHtml(store.whatsapp)}</div>` : ''}
      ${ss.storeDetails && ss.storeDetails.email ? `<div style="color:#6b7280;">Email: ${escapeHtml(ss.storeDetails.email)}</div>` : ''}
      ${ss.storeDetails && ss.storeDetails.address ? `<div style="color:#6b7280;max-width:220px;">${escapeHtml(ss.storeDetails.address)}</div>` : ''}
      ${ss.storeDetails && ss.storeDetails.legalName ? `<div style="color:#6b7280;font-size:12px;">Legal: ${escapeHtml(ss.storeDetails.legalName)}</div>` : ''}
    </div>
  </div>
  <div style="margin-bottom:20px;">
    <strong>Bill To:</strong><br>
    ${escapeHtml(order.customerName || '-')}<br>
    ${order.customerPhone ? escapeHtml(order.customerPhone) + '<br>' : ''}
    ${order.customerEmail ? escapeHtml(order.customerEmail) + '<br>' : ''}
    ${order.shippingAddress ? `<br>${escapeHtml(order.shippingAddress)}` : ''}
  </div>
  <table>
    <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
    <tbody>
      ${Array.isArray(order.items) && order.items.length ? order.items.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.name || item.productName || '-')}</td><td>${escapeHtml(String(item.quantity || 1))}</td><td>${escapeHtml(formatMoney(item.price || 0))}</td><td>${escapeHtml(formatMoney((item.price || 0) * (item.quantity || 1)))}</td></tr>`).join('') : `<tr><td>1</td><td>${escapeHtml(order.productName || '-')}</td><td>1</td><td>${escapeHtml(formatMoney(order.amount))}</td><td>${escapeHtml(formatMoney(order.amount))}</td></tr>`}
      <tr class="total-row"><td colspan="4" style="text-align:right;"><strong>Total</strong></td><td><strong>${escapeHtml(formatMoney(order.amount))}</strong></td></tr>
    </tbody>
  </table>
  <div style="margin-top:16px;">
    <strong>Payment Mode:</strong> ${escapeHtml(order.paymentMode || order.paymentMethod || 'WhatsApp')} &nbsp;|&nbsp;
    <strong>Status:</strong> ${escapeHtml(order.status || 'pending')}
  </div>
  <div class="footer">
    Thank you for your purchase from ${escapeHtml(store.name)}!
    ${ss.policies && ss.policies.terms ? '<br>Terms & Conditions apply.' : ''}
  </div>
  <script>window.onload=function(){window.print();}</script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(invoiceHtml);
}));

router.post('/:slug/order/:code/cancel', route(async (req, res) => {
  try {
    const db = await loadDB();
    const slug = String(req.params.slug || '').trim();
    const store = db.stores[slug];
    if (!store) { res.redirect(`/store/${encodeURIComponent(slug)}`); return; }
    const ss = ensureStoreSettings(store);
    const order = store.orders.find((item) => item.trackingCode === req.params.code || item.orderNumber === req.params.code || item.id === req.params.code);
    if (!order || ss.orderSettings.allowOrderCancellation === false || !['pending', 'confirmed'].includes(order.status)) {
      setFlash(req, 'error', 'Order cannot be cancelled.');
      res.redirect(`/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(req.params.code)}`);
      return;
    }
    order.status = 'cancelled';
    order.trackingHistory = Array.isArray(order.trackingHistory) ? order.trackingHistory : [];
    order.trackingHistory.push({ status: 'cancelled', at: new Date().toISOString() });
    if (order.stockDeducted) {
      adjustOrderInventory(store, order, 'restore');
    }
    await saveDB(db);
    setFlash(req, 'success', 'Order cancelled successfully.');
    res.redirect(`/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(req.params.code)}`);
  } catch (error) {
    setFlash(req, 'error', 'Unable to cancel order.');
    res.redirect(`/store/${encodeURIComponent(req.params.slug)}/order/${encodeURIComponent(req.params.code)}`);
  }
}));

router.get('/:slug/account/register', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
  const currentTemplate = getTemplateById(db, store.template);
  const ss = ensureStoreSettings(store);
  const otpApp = store.apps && store.apps.fast2sms;
  const otpEnabled = otpApp && otpApp.installed && otpApp.configured;
  if (ss.loginSettings.allowRegistration === false) { res.redirect(`/store/${encodeURIComponent(slug)}/account/login`); return; }
  const flash = renderFlashMessages(req);
  res.send(renderHtmlShell(`${store.name} - Create Account`, `
    <div class="store-page"><div class="store-wrap account-page">
      <div class="store-nav"><a href="/store/${encodeURIComponent(slug)}">Home</a><a href="/store/${encodeURIComponent(slug)}/account/login">Login</a></div>
      <section class="card panel">
        ${flash}
        <h1 class="section-title">${escapeHtml(ss.loginSettings.signUpHeading || 'Create account')}</h1>
        <p class="section-subtitle">Register once and track orders faster.</p>
        <form method="POST" action="/store/${encodeURIComponent(slug)}/account/register" class="form-grid">
          <div class="field"><label for="name">Full Name</label><input id="name" name="name" autocomplete="name" required></div>
          <div class="field"><label for="phone">Phone</label><input id="phone" name="phone" autocomplete="tel" required></div>
          <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
          <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="new-password" required></div>
          <div class="actions"><button class="btn" type="submit">Create Account</button></div>
        </form>
        ${otpEnabled ? `<div class="empty" style="margin-top:18px;text-align:left;"><h3 style="margin:0 0 10px;">Quick signup with OTP</h3><form method="POST" action="/store/${encodeURIComponent(slug)}/account/request-otp" class="form-grid"><input type="hidden" name="mode" value="register"><div class="field"><label for="otpName">Full Name</label><input id="otpName" name="name" required></div><div class="field"><label for="otpPhone">Mobile Number</label><input id="otpPhone" name="phone" autocomplete="tel" required></div><div class="field"><label for="otpEmail">Email (optional)</label><input id="otpEmail" name="email" type="email" autocomplete="email"></div><div class="actions"><button class="btn btn-secondary" type="submit">Send OTP</button></div></form></div>` : ''}
      </section>
    </div></div>
  `, getStoreShellOptions(req, store, { extraStyles: renderStoreCss(currentTemplate, store.theme) })));
}));

router.post('/:slug/account/register', route(async (req, res) => {
  try {
    const db = await loadDB();
    const slug = String(req.params.slug || '').trim();
    const store = db.stores[slug];
    if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
    const ss = ensureStoreSettings(store);
    if (ss.loginSettings.allowRegistration === false) { setFlash(req, 'error', 'Registration is disabled.'); res.redirect(`/store/${encodeURIComponent(slug)}/account/login`); return; }
    const name = String(req.body.name || '').trim();
    const phone = sanitizePhone(req.body.phone || '');
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!name || phone.length < 10 || !validateEmail(email) || password.length < 8) {
      setFlash(req, 'error', 'Please fill all fields correctly.');
      res.redirect(`/store/${encodeURIComponent(slug)}/account/register`);
      return;
    }
    store.customers = store.customers && typeof store.customers === 'object' ? store.customers : {};
    if (store.customers[email]) {
      setFlash(req, 'error', 'Account already exists.');
      res.redirect(`/store/${encodeURIComponent(slug)}/account/login`);
      return;
    }
    const verification = createCustomerEmailVerificationState(false);
    store.customers[email] = { id: `${slug}:${email}`, email, name, phone, passwordHash: hashPassword(password), orders: [], wishlist: [], createdAt: new Date().toISOString(), addresses: [], authProvider: 'password', ...verification };
    await saveStoreCustomerFast(db, slug, store.customers[email]);
    try {
      await syncCustomerToSupabaseAuth(slug, store.customers[email], password);
    } catch (syncError) {
      delete store.customers[email];
      await saveDB(db);
      throw syncError;
    }
    sendCustomerWelcomeEmail(store.customers[email], store).catch(console.error);
    sendVerificationEmail(store.customers[email], 'customer', store, `${getBaseUrl(req)}/verify-email/${encodeURIComponent(store.customers[email].emailVerificationToken)}`).catch(console.error);
    sendAdminNewUserAlert(store.customers[email], 'customer', store).catch(console.error);
    setLoggedCustomer(req, slug, email);
    setFlash(req, 'success', 'Account created.');
    res.redirect(`/store/${encodeURIComponent(slug)}/account`);
  } catch (error) {
    setFlash(req, 'error', 'Unable to create account.');
    res.redirect(`/store/${encodeURIComponent(req.params.slug)}/account/register`);
  }
}));

router.get('/:slug/account/login', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
  const currentTemplate = getTemplateById(db, store.template);
  const ss = ensureStoreSettings(store);
  const otpApp = store.apps && store.apps.fast2sms;
  const otpEnabled = otpApp && otpApp.installed && otpApp.configured;
  const flash = renderFlashMessages(req);
  const googleButton = renderStoreGoogleButton(slug);
  res.send(renderHtmlShell(`${store.name} - Login`, `
    <div class="store-page"><div class="store-wrap account-page">
      <div class="store-nav"><a href="/store/${encodeURIComponent(slug)}">Home</a><a href="/store/${encodeURIComponent(slug)}/account/register">Create account</a></div>
      <section class="card panel">${flash}<h1 class="section-title">${escapeHtml(ss.loginSettings.signInHeading || 'Login')}</h1><p class="section-subtitle">Access your saved orders and wishlist.</p>
        <form method="POST" action="/store/${encodeURIComponent(slug)}/account/login" class="form-grid">
          ${googleButton}
          <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
          <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>
          <div class="actions"><button class="btn" type="submit">${escapeHtml(ss.loginSettings.requestOtpButton || 'Login')}</button></div>
        </form>
        ${otpEnabled ? `<div class="empty" style="margin-top:18px;text-align:left;"><h3 style="margin:0 0 10px;">Login with OTP</h3><form method="POST" action="/store/${encodeURIComponent(slug)}/account/request-otp" class="form-grid"><input type="hidden" name="mode" value="login"><div class="field"><label for="otpPhoneLogin">Mobile Number</label><input id="otpPhoneLogin" name="phone" autocomplete="tel" required></div><div class="field"><label for="otpNameLogin">Name (for new customers)</label><input id="otpNameLogin" name="name"></div><div class="field"><label for="otpEmailLogin">Email (optional)</label><input id="otpEmailLogin" name="email" type="email"></div><div class="actions"><button class="btn btn-secondary" type="submit">Send OTP</button></div></form></div>` : ''}
      </section>
    </div></div>
  `, getStoreShellOptions(req, store, { extraStyles: renderStoreCss(currentTemplate, store.theme) })));
}));

router.post('/:slug/account/login', route(async (req, res) => {
  try {
    const db = await loadDB();
    const slug = String(req.params.slug || '').trim();
    const store = db.stores[slug];
    if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const customer = await findStoreCustomerByEmail(slug, email);
    if (!customer || !verifyPassword(password, customer.passwordHash)) {
      setFlash(req, 'error', 'Invalid email or password.');
      res.redirect(`/store/${encodeURIComponent(slug)}/account/login`);
      return;
    }
    setLoggedCustomer(req, slug, email);
    setFlash(req, 'success', 'Logged in successfully.');
    res.redirect(`/store/${encodeURIComponent(slug)}/account`);
  } catch (error) {
    setFlash(req, 'error', 'Login failed.');
    res.redirect(`/store/${encodeURIComponent(req.params.slug)}/account/login`);
  }
}));

router.post('/:slug/account/request-otp', route(async (req, res) => {
  try {
    const db = await loadDB();
    const slug = String(req.params.slug || '').trim();
    const store = db.stores[slug];
    if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
    const otpApp = store.apps && store.apps.fast2sms;
    if (!otpApp || !otpApp.installed || !otpApp.configured) {
      setFlash(req, 'error', 'OTP login is not enabled for this store.');
      res.redirect(`/store/${encodeURIComponent(slug)}/account/login`);
      return;
    }
    const mode = String(req.body.mode || 'login').trim() === 'register' ? 'register' : 'login';
    const phone = sanitizePhone(req.body.phone || '');
    const name = sanitizeInput(req.body.name || '', 80);
    const email = String(req.body.email || '').trim().toLowerCase();
    if (phone.length < 10) {
      setFlash(req, 'error', 'Enter a valid mobile number.');
      res.redirect(`/store/${encodeURIComponent(slug)}/account/${mode === 'register' ? 'register' : 'login'}`);
      return;
    }
    const quota = consumeOtpQuota(slug, phone, req);
    if (!quota.ok) {
      const message = quota.reason === 'cooldown'
        ? `Please wait ${quota.retryAfterSec} seconds before requesting another OTP.`
        : `Too many OTP requests. Try again in ${quota.retryAfterSec} seconds.`;
      setFlash(req, 'error', message);
      res.redirect(`/store/${encodeURIComponent(slug)}/account/${mode === 'register' ? 'register' : 'login'}`);
      return;
    }
    if (email && !validateEmail(email)) {
      setFlash(req, 'error', 'Enter a valid email address.');
      res.redirect(`/store/${encodeURIComponent(slug)}/account/${mode === 'register' ? 'register' : 'login'}`);
      return;
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const sent = await sendFast2SmsOtp(store, phone, otp);
    if (!sent) {
      setFlash(req, 'error', 'Unable to send OTP right now. Please try again.');
      res.redirect(`/store/${encodeURIComponent(slug)}/account/${mode === 'register' ? 'register' : 'login'}`);
      return;
    }
    setCustomerOtpSession(req, {
      slug,
      phone,
      name,
      email,
      mode,
      otp,
      attempts: 0,
      expiresAt: Date.now() + ((Number(otpApp.expiryMinutes || 10) || 10) * 60 * 1000)
    });
    setFlash(req, 'success', `OTP sent to ${phone}.`);
    res.redirect(`/store/${encodeURIComponent(slug)}/account/verify-otp`);
  } catch (error) {
    setFlash(req, 'error', 'Unable to send OTP.');
    res.redirect(`/store/${encodeURIComponent(req.params.slug)}/account/login`);
  }
}));

router.get('/:slug/account/verify-otp', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
  const currentTemplate = getTemplateById(db, store.template);
  const otpSession = getCustomerOtpSession(req);
  if (!otpSession || otpSession.slug !== slug) {
    setFlash(req, 'error', 'Request a fresh OTP first.');
    res.redirect(`/store/${encodeURIComponent(slug)}/account/login`);
    return;
  }
  const flash = renderFlashMessages(req);
  res.send(renderHtmlShell(`${store.name} - Verify OTP`, `<div class="store-page"><div class="store-wrap account-page"><div class="store-nav"><a href="/store/${encodeURIComponent(slug)}/account/login">Back to login</a></div><section class="card panel">${flash}<h1 class="section-title">Verify OTP</h1><p class="section-subtitle">Enter the 6-digit OTP sent to ${escapeHtml(otpSession.phone)}.</p><form method="POST" action="/store/${encodeURIComponent(slug)}/account/verify-otp" class="form-grid"><div class="field"><label for="otp">OTP</label><input id="otp" name="otp" inputmode="numeric" maxlength="6" required></div><div class="actions"><button class="btn" type="submit">Verify & Login</button></div></form></section></div></div>`, getStoreShellOptions(req, store, { extraStyles: renderStoreCss(currentTemplate, store.theme) })));
}));

router.post('/:slug/account/verify-otp', route(async (req, res) => {
  try {
    const db = await loadDB();
    const slug = String(req.params.slug || '').trim();
    const store = db.stores[slug];
    if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
    const otpSession = getCustomerOtpSession(req);
    const otp = String(req.body.otp || '').trim();
    if (!otpSession || otpSession.slug !== slug || Number(otpSession.expiresAt || 0) < Date.now() || otp !== String(otpSession.otp || '')) {
      if (otpSession && otpSession.slug === slug) {
        otpSession.attempts = Math.max(0, Number(otpSession.attempts || 0)) + 1;
        setCustomerOtpSession(req, otpSession);
        if (otpSession.attempts >= OTP_VERIFY_LIMIT) {
          clearCustomerOtpSession(req);
          setFlash(req, 'error', 'Too many invalid OTP attempts. Request a fresh OTP.');
          res.redirect(`/store/${encodeURIComponent(slug)}/account/login`);
          return;
        }
      }
      setFlash(req, 'error', 'OTP is invalid or expired.');
      res.redirect(`/store/${encodeURIComponent(slug)}/account/verify-otp`);
      return;
    }
    store.customers = store.customers && typeof store.customers === 'object' ? store.customers : {};
    let customer = findCustomerByPhone(store, otpSession.phone);
    if (!customer && otpSession.email && store.customers[otpSession.email]) {
      customer = store.customers[otpSession.email];
    }
    if (!customer) {
      const customerKey = otpSession.email || `${otpSession.phone}@otp.customer`;
      customer = { id: otpSession.email ? `${slug}:${customerKey}` : customerKey, email: customerKey, name: otpSession.name || 'Customer', phone: otpSession.phone, passwordHash: '', orders: [], wishlist: [], createdAt: new Date().toISOString(), addresses: [], authProvider: 'otp', emailVerified: !!otpSession.email };
      store.customers[customerKey] = customer;
    } else {
      customer.phone = otpSession.phone;
      if (otpSession.name) customer.name = otpSession.name;
      if (otpSession.email && (!customer.email || customer.email.endsWith('@otp.customer'))) customer.email = otpSession.email;
      if (otpSession.email) customer.emailVerified = true;
    }
    await saveDB(db);
    try {
      await syncCustomerToSupabaseAuth(slug, customer, '');
    } catch (syncError) {
      console.error('[AUTH] Customer OTP sync failed.', syncError && syncError.message ? syncError.message : syncError);
    }
    clearCustomerOtpSession(req);
    setLoggedCustomer(req, slug, customer.email);
    setFlash(req, 'success', 'Logged in with OTP successfully.');
    res.redirect(`/store/${encodeURIComponent(slug)}/account`);
  } catch (error) {
    setFlash(req, 'error', 'Unable to verify OTP.');
    res.redirect(`/store/${encodeURIComponent(req.params.slug)}/account/login`);
  }
}));

async function handleCustomerLogout(req, res) {
  if (!isTrustedNavigation(req)) {
    setFlash(req, 'error', 'Security validation failed. Please try again from inside the store.');
    res.redirect(`/store/${encodeURIComponent(req.params.slug)}/account`);
    return;
  }
  try {
    clearLoggedCustomer(req);
    clearCustomerOtpSession(req);
    res.redirect(`/store/${encodeURIComponent(req.params.slug)}`);
  } catch (error) {
    res.redirect(`/store/${encodeURIComponent(req.params.slug)}`);
  }
}

router.get('/:slug/account/logout', route(handleCustomerLogout));
router.post('/:slug/account/logout', route(handleCustomerLogout));

router.get('/:slug/account', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
  const currentTemplate = getTemplateById(db, store.template);
  const customer = await getLoggedCustomer(req, slug);
  if (!customer) { res.redirect(`/store/${encodeURIComponent(slug)}/account/login`); return; }
  const visibleEmail = customer.email && !String(customer.email).endsWith('@otp.customer') ? customer.email : '-';
  const orders = store.orders.filter((order) => order.customerEmail === customer.email).slice().reverse();
  res.send(renderHtmlShell(`${store.name} - Account`, `
    <div class="store-page"><div class="store-wrap account-page">
      <div class="store-nav"><a href="/store/${encodeURIComponent(slug)}">Home</a><a href="/store/${encodeURIComponent(slug)}/account/orders">Orders</a><a href="/store/${encodeURIComponent(slug)}/account/wishlist">Wishlist</a><form method="POST" action="/store/${encodeURIComponent(slug)}/account/logout" style="display:inline;"><button class="btn btn-secondary" type="submit" style="min-height:auto;padding:8px 12px;">Logout</button></form></div>
      <section class="card panel">
        <div class="title-row"><div><h1 class="page-title">My Account</h1><p class="page-subtitle">${escapeHtml(customer.name)}</p></div></div>
        <div class="kpi-list"><div class="kpi-item"><strong>Email</strong><span>${escapeHtml(visibleEmail)}</span></div><div class="kpi-item"><strong>Phone</strong><span>${escapeHtml(customer.phone)}</span></div><div class="kpi-item"><strong>Orders</strong><span>${escapeHtml(String(orders.length))}</span></div></div>
      </section>
      <section class="card panel">
        <div class="section-head"><h2 class="section-title" style="font-size:18px; margin:0;">Recent orders</h2><a class="btn btn-secondary" href="/store/${encodeURIComponent(slug)}/account/orders">View all</a></div>
        ${orders.length ? orders.slice(0, 5).map((order) => `<div class="summary-row"><div><strong>${escapeHtml(order.orderNumber)}</strong><div class="muted">${escapeHtml(order.productName)}</div></div><a class="btn btn-secondary" href="/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(order.trackingCode)}">Track</a></div>`).join('') : '<div class="store-empty">No orders yet.</div>'}
      </section>
    </div></div>
  `, getStoreShellOptions(req, store, { extraStyles: renderStoreCss(currentTemplate, store.theme) })));
}));

router.get('/:slug/account/orders', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
  const currentTemplate = getTemplateById(db, store.template);
  const ss = ensureStoreSettings(store);
  const customer = await getLoggedCustomer(req, slug);
  if (!customer) { res.redirect(`/store/${encodeURIComponent(slug)}/account/login`); return; }
  const orders = store.orders.filter((order) => order.customerEmail === customer.email).slice().reverse();
  const html = orders.length ? orders.map((order) => `<div class="summary-row"><div><strong>${escapeHtml(order.orderNumber)}</strong><div class="muted">${escapeHtml(order.productName)}</div><div class="muted">${escapeHtml(formatDate(order.createdAt))}</div></div><div class="actions"><span class="badge badge-live">${escapeHtml(order.status)}</span><a class="btn btn-secondary" href="/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(order.trackingCode)}">Track</a>${ss.orderSettings.allowInvoiceDownload !== false ? `<a class="btn btn-secondary" href="/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(order.trackingCode)}/invoice">Invoice</a>` : ''}</div></div>`).join('') : '<div class="store-empty">No orders yet.</div>';
  res.send(renderHtmlShell(`${store.name} - Orders`, `<div class="store-page"><div class="store-wrap account-page"><div class="store-nav"><a href="/store/${encodeURIComponent(slug)}/account">Back</a></div><section class="card panel"><h1 class="page-title">My Orders</h1>${html}</section></div></div>`, getStoreShellOptions(req, store, { extraStyles: renderStoreCss(currentTemplate, store.theme) })));
}));

router.get('/:slug/my-orders', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  const customer = await getLoggedCustomer(req, slug);
  if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
  if (!customer) { setFlash(req, 'info', 'Please login to view your orders.'); res.redirect(`/store/${encodeURIComponent(slug)}/account/login`); return; }
  const currentTemplate = getTemplateById(db, store.template);
  const myOrders = store.orders.filter((order) => order.customerEmail === customer.email || order.customerPhone === customer.phone).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const ordersHtml = myOrders.length ? myOrders.map((order) => `<div style="padding:16px;border-radius:14px;border:1px solid #e5e7eb;margin-bottom:12px;"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;"><div><strong>${escapeHtml(order.orderNumber || order.id)}</strong><div style="font-size:13px;color:#64748b;">${escapeHtml(order.productName)}</div><div style="font-size:13px;color:#64748b;">${escapeHtml(formatDate(order.createdAt))}</div></div><div style="text-align:right;"><div style="font-weight:700;">${escapeHtml(formatMoney(order.amount))}</div>${getStatusBadge(order.status)}</div></div><div style="display:flex;gap:8px;margin-top:12px;"><a class="btn btn-secondary" href="/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(order.trackingCode)}" style="min-height:36px;padding:8px 14px;font-size:13px;">Track</a><a class="btn btn-secondary" href="/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(order.trackingCode)}/invoice" style="min-height:36px;padding:8px 14px;font-size:13px;">Invoice</a></div></div>`).join('') : '<div class="store-empty">No orders yet.</div>';
  res.send(renderHtmlShell(`${store.name} - My Orders`, `<div class="store-page"><div class="store-wrap account-page"><div class="store-nav"><a href="/store/${encodeURIComponent(slug)}/account">Back</a></div><section class="card panel"><h1 class="page-title">My Orders</h1>${ordersHtml}</section></div></div>`, getStoreShellOptions(req, store, { extraStyles: renderStoreCss(currentTemplate, store.theme) })));
}));

router.get('/:slug/account/wishlist', route(async (req, res) => {
  const db = await loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
  const currentTemplate = getTemplateById(db, store.template);
  const customer = await getLoggedCustomer(req, slug);
  if (!customer) { res.redirect(`/store/${encodeURIComponent(slug)}/account/login`); return; }
  const wish = Array.isArray(customer.wishlist) ? customer.wishlist : [];
  const items = wish.map((id) => store.products.find((product) => product.id === id)).filter(Boolean);
  const html = items.length ? items.map((product) => `<div class="summary-row"><div><strong>${escapeHtml(product.name)}</strong><div class="muted">${escapeHtml(formatMoney(product.price))}</div></div><div class="actions"><form method="POST" action="/store/${encodeURIComponent(slug)}/cart/add/${encodeURIComponent(product.id)}"><button class="btn" type="submit">Add to cart</button></form><form method="POST" action="/store/${encodeURIComponent(slug)}/wishlist/toggle/${encodeURIComponent(product.id)}"><button class="btn btn-danger" type="submit">Remove</button></form></div></div>`).join('') : '<div class="store-empty">Wishlist empty.</div>';
  res.send(renderHtmlShell(`${store.name} - Wishlist`, `<div class="store-page"><div class="store-wrap account-page"><div class="store-nav"><a href="/store/${encodeURIComponent(slug)}/account">Back</a></div><section class="card panel"><h1 class="page-title">Wishlist</h1>${html}</section></div></div>`, getStoreShellOptions(req, store, { extraStyles: renderStoreCss(currentTemplate, store.theme) })));
}));




module.exports = router;
