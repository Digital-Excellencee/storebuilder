const express = require('express');
const router = express.Router();
const { loadDB, saveDB, ensureStoreSettings, removeStoredFile, saveUploadedFile, runUploader, DEFAULT_TEMPLATES, saveStoreProductFast, deleteStoreProductFast, getDBStatus } = require('../services/db');
const { escapeHtml, slugify, formatDate, formatMoney, parsePrice, sanitizePhone, sanitizeInput, sanitizeTrackingCode, generateId, generateTrackingCode, generateOrderNumber, INPUT_LIMITS } = require('../helpers/html');
const { validateEmail, validatePhone } = require('../helpers/validation');
const { setFlash, renderFlashMessages } = require('../helpers/flash');
const { getStatusBadge, getStoreRevenue, getUniqueCustomers, getSetupChecklist, getTemplateById, buildStoreUrl, getStoreOwner, renderMiniBar, getPlatformStartedAt, applyRoundingMode, getEffectiveShippingFee, getProductDisplayRating } = require('../helpers/store');
const { renderHtmlShell } = require('../views/shell');
const { renderStoreCss, getThemeCSS } = require('../views/store-css');
const { renderStoreByTheme } = require('../views/store-themes');
const { renderGlobalError } = require('../views/error-views');
const { getStoreMetaTags } = require('../views/store-components');
const { getStoreCart, getStoreWishlist, getLoggedCustomer, getCartDetails, getCheckoutDraft, saveCheckoutDraft, clearCheckoutDraft, normalizeCheckoutMode, normalizeCheckoutStep, getCheckoutLineItems, saveStoreCart, setLoggedCustomer, addProductToCart } = require('../helpers/store-session');
const { requireAuth } = require('../middleware/auth');
const { route } = require('../middleware/error');
const { upload, csvUpload } = require('../middleware/upload');
const config = require('../config');
const { ORDER_STATUSES, BASE_DOMAIN } = config;
const { adminStyles, renderAdminLayout, DISPLAY_SETTINGS_SECTIONS, STORE_SETTINGS_SECTIONS, sanitizeThemeField, checkboxValue, pickDisplaySection, pickStoreSettingsSection, getDashboardReturnTo, onlineStoreAdminStyles, storeAdminPanelStyles, renderOnlineStoreAdminLayout, renderDisplayToggle, renderDisplaySectionNav, renderDisplaySettingsSection, renderStoreSettingsSectionNav, renderStoreSettingsSection } = require('../views/admin');
const { getAppCatalog, getAppDefinition, normalizeStoreApps } = require('../services/apps');
const { sendOrderShippedEmail, sendOrderDeliveredEmail, sendVendorOrderStatusUpdate, sendEmail } = require('../services/email');

function parseVariantsFromBody(body) {
  const variants = [];
  Object.keys(body || {}).filter((key) => key.startsWith('variantName_')).forEach((key) => {
    const variantId = key.replace('variantName_', '');
    const variantName = sanitizeInput(body[key], 60);
    if (!variantName) return;
    const options = Object.keys(body || {}).filter((optionKey) => optionKey.startsWith(`optLabel_${variantId}_`)).map((optionKey) => {
      const token = optionKey.replace(`optLabel_${variantId}_`, '');
      return {
        label: sanitizeInput(body[optionKey], 40),
        price: parsePrice(body[`optPrice_${variantId}_${token}`] || '0'),
        stock: Math.max(0, parseInt(body[`optStock_${variantId}_${token}`] || '0', 10) || 0),
        sku: sanitizeInput(body[`optSku_${variantId}_${token}`] || '', 60)
      };
    }).filter((option) => option.label);
    if (options.length) {
      variants.push({ id: generateId('v'), name: variantName, options });
    }
  });
  return variants;
}

function renderVariantBuilder(existingVariants) {
  const safeSeed = JSON.stringify(Array.isArray(existingVariants) ? existingVariants : []);
  return `
    <div class="field">
      <label>Variants (optional)</label>
      <div id="variantsList" class="form-grid"></div>
      <button type="button" onclick="addVariant()" class="btn btn-secondary" style="margin-top:8px;">+ Add Variant (Size/Color)</button>
      <span class="muted" style="font-size:12px;">Example: Size → S / M / L or Color → Red / Blue.</span>
    </div>
    <script>
    (function(){
      var variantsRoot = document.getElementById('variantsList');
      if (!variantsRoot) return;
      var variantCount = 0;
      function createOption(vId, option) {
        var token = Date.now().toString() + '_' + Math.random().toString(16).slice(2, 8);
        var row = document.createElement('div');
        row.style = 'display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr;gap:8px;margin-top:8px;';
        row.innerHTML = '<input name="optLabel_' + vId + '_' + token + '" placeholder="Label (S/M/Red)" value="' + (option && option.label ? String(option.label).replace(/"/g, '&quot;') : '') + '">' +
          '<input name="optPrice_' + vId + '_' + token + '" placeholder="Price" value="' + (option && option.price != null ? String(option.price).replace(/"/g, '&quot;') : '') + '">' +
          '<input name="optStock_' + vId + '_' + token + '" placeholder="Stock" value="' + (option && option.stock != null ? String(option.stock).replace(/"/g, '&quot;') : '') + '">' +
          '<input name="optSku_' + vId + '_' + token + '" placeholder="SKU" value="' + (option && option.sku ? String(option.sku).replace(/"/g, '&quot;') : '') + '">';
        document.getElementById('variantOptions_' + vId).appendChild(row);
      }
      window.addOption = function(vId, option) { createOption(vId, option || null); };
      window.addVariant = function(seed) {
        variantCount++;
        var div = document.createElement('div');
        div.style = 'border:1px solid #e5e7eb;border-radius:14px;padding:14px;background:#fff;';
        div.innerHTML = '<input name="variantName_' + variantCount + '" placeholder="Variant name (e.g. Size)" value="' + (seed && seed.name ? String(seed.name).replace(/"/g, '&quot;') : '') + '" style="margin-bottom:8px;">' +
          '<div id="variantOptions_' + variantCount + '"></div>' +
          '<button type="button" onclick="addOption(' + variantCount + ')" class="btn btn-secondary" style="margin-top:8px;min-height:34px;padding:8px 12px;font-size:12px;">+ Add Option</button>';
        variantsRoot.appendChild(div);
        var options = seed && Array.isArray(seed.options) ? seed.options : [];
        if (options.length) {
          options.forEach(function(option){ createOption(variantCount, option); });
        } else {
          createOption(variantCount, null);
        }
      };
      var seed = ${safeSeed};
      if (seed.length) seed.forEach(function(item){ window.addVariant(item); });
    })();
    </script>`;
}

function renderProductGalleryPreview(product) {
  const images = Array.isArray(product && product.images) ? product.images.filter(Boolean) : [];
  if (!images.length) {
    return '<div class="muted">No gallery images</div>';
  }
  return `<div style="display:flex;gap:8px;overflow-x:auto;flex-wrap:wrap;">${images.map((image) => `<img class="product-thumb" src="${escapeHtml(image)}" alt="Product image" style="width:72px;height:72px;">`).join('')}</div>`;
}

function getChecklistAction(item, storeUrl) {
  const title = String(item && item.title || '');
  if (title === 'Store name & description') return { href: '/dashboard/settings?section=store-details', label: 'Complete' };
  if (title === 'WhatsApp number') return { href: '/dashboard/settings?section=store-details', label: 'Add number' };
  if (title === 'At least one product') return { href: '/dashboard/products', label: 'Add product' };
  if (title === 'Store logo') return { href: '/dashboard/settings?section=store-details', label: 'Upload logo' };
  if (title === 'Choose a theme') return { href: '/dashboard/theme', label: 'Choose theme' };
  if (title === 'Share your store link') return { href: storeUrl, label: 'Open store', external: true };
  return null;
}

function appConfigured(appId, data) {
  if (!data) return false;
  if (appId === 'smtp') return !!(data.host && data.user && data.pass);
  if (appId === 'fast2sms') return !!data.apiKey;
  if (appId === 'tawkto') return !!(data.propertyId && data.widgetId);
  if (appId === 'salesPopup') return data.enabled === true;
  if (appId === 'metaPixel') return !!data.pixelId;
  if (appId === 'googleAnalytics') return !!data.gaId;
  if (appId === 'googleTagManager') return !!data.containerId;
  if (appId === 'razorpay') return !!(data.keyId && data.keySecret);
  if (appId === 'cashfree') return !!(data.appId && data.secretKey);
  if (appId === 'payu') return !!(data.merchantKey && data.merchantSalt);
  if (appId === 'shiprocket') return !!(data.email && data.password);
  if (appId === 'delhivery') return !!(data.apiKey && data.clientName);
  if (appId === 'shipway') return !!data.apiKey;
  if (appId === 'webhooks') return !!(data.orderCreatedUrl || data.orderUpdatedUrl || data.orderDeliveredUrl);
  return false;
}

function renderAppConfiguration(appId, app, store) {
  if (appId === 'smtp') {
    return `<form method="POST" action="/dashboard/apps/save/${appId}" class="form-grid"><div class="form-grid two"><div class="field"><label>SMTP Host</label><input name="host" value="${escapeHtml(app.host || '')}" placeholder="smtp.gmail.com"></div><div class="field"><label>Port</label><input name="port" value="${escapeHtml(String(app.port || 587))}"></div><div class="field"><label>Username</label><input name="user" value="${escapeHtml(app.user || '')}"></div><div class="field"><label>Password</label><input name="pass" type="password" value="${escapeHtml(app.pass || '')}"></div><div class="field"><label>From Email</label><input name="fromEmail" value="${escapeHtml(app.fromEmail || '')}"></div><div class="field"><label>From Name</label><input name="fromName" value="${escapeHtml(app.fromName || store.name || '')}"></div><div class="field"><label>Reply-To</label><input name="replyTo" value="${escapeHtml(app.replyTo || '')}"></div><div class="field"><label>Secure SSL</label><select name="secure"><option value="no"${!app.secure ? ' selected' : ''}>No</option><option value="yes"${app.secure ? ' selected' : ''}>Yes</option></select></div></div><div class="actions"><button class="btn" type="submit">Save SMTP App</button></div></form>`;
  }
  if (appId === 'fast2sms') {
    return `<form method="POST" action="/dashboard/apps/save/${appId}" class="form-grid"><div class="form-grid two"><div class="field"><label>Fast2SMS API Key</label><input name="apiKey" value="${escapeHtml(app.apiKey || '')}"></div><div class="field"><label>Sender ID</label><input name="senderId" value="${escapeHtml(app.senderId || 'FSTSMS')}"></div><div class="field"><label>Route</label><input name="route" value="${escapeHtml(app.route || 'q')}"></div><div class="field"><label>OTP Expiry (minutes)</label><input name="expiryMinutes" value="${escapeHtml(String(app.expiryMinutes || 10))}"></div></div><div class="field"><label>SMS Template</label><textarea name="template">${escapeHtml(app.template || 'Your OTP for {{STORE}} is {{OTP}}')}</textarea><span class="muted" style="font-size:12px;">Use {{OTP}} and {{STORE}} placeholders.</span></div><div class="actions"><button class="btn" type="submit">Save OTP App</button></div></form>`;
  }
  if (appId === 'tawkto') {
    return `<form method="POST" action="/dashboard/apps/save/${appId}" class="form-grid"><div class="form-grid two"><div class="field"><label>Property ID</label><input name="propertyId" value="${escapeHtml(app.propertyId || '')}"></div><div class="field"><label>Widget ID</label><input name="widgetId" value="${escapeHtml(app.widgetId || '')}"></div></div><div class="actions"><button class="btn" type="submit">Save Live Chat App</button></div></form>`;
  }
  if (appId === 'salesPopup') {
    return `<form method="POST" action="/dashboard/apps/save/${appId}" class="form-grid"><div class="form-grid two"><div class="field"><label>Show popups</label><select name="enabled"><option value="yes"${app.enabled ? ' selected' : ''}>Yes</option><option value="no"${!app.enabled ? ' selected' : ''}>No</option></select></div><div class="field"><label>Interval (seconds)</label><input name="intervalSeconds" value="${escapeHtml(String(app.intervalSeconds || 8))}"></div><div class="field"><label>Show on Home</label><select name="showHome"><option value="yes"${app.showHome !== false ? ' selected' : ''}>Yes</option><option value="no"${app.showHome === false ? ' selected' : ''}>No</option></select></div><div class="field"><label>Show on Product Pages</label><select name="showProduct"><option value="yes"${app.showProduct !== false ? ' selected' : ''}>Yes</option><option value="no"${app.showProduct === false ? ' selected' : ''}>No</option></select></div></div><div class="field"><label>Popup Title</label><input name="title" value="${escapeHtml(app.title || 'Someone purchased')}"></div><div class="field"><label>Popup Text</label><input name="text" value="${escapeHtml(app.text || '{{product}} from {{city}}')}"><span class="muted" style="font-size:12px;">Use {{product}}, {{name}}, and {{city}} placeholders.</span></div><div class="actions"><button class="btn" type="submit">Save Popup App</button></div></form>`;
  }
  if (appId === 'metaPixel') {
    return `<form method="POST" action="/dashboard/apps/save/${appId}" class="form-grid"><div class="field"><label>Pixel ID</label><input name="pixelId" value="${escapeHtml(app.pixelId || '')}"></div><div class="actions"><button class="btn" type="submit">Save Pixel App</button></div></form>`;
  }
  if (appId === 'googleAnalytics') {
    return `<form method="POST" action="/dashboard/apps/save/${appId}" class="form-grid"><div class="field"><label>Measurement ID</label><input name="gaId" value="${escapeHtml(app.gaId || '')}" placeholder="G-XXXXXXX"></div><div class="actions"><button class="btn" type="submit">Save Analytics App</button></div></form>`;
  }
  if (appId === 'googleTagManager') {
    return `<form method="POST" action="/dashboard/apps/save/${appId}" class="form-grid"><div class="field"><label>Container ID</label><input name="containerId" value="${escapeHtml(app.containerId || '')}" placeholder="GTM-XXXX"></div><div class="actions"><button class="btn" type="submit">Save GTM App</button></div></form>`;
  }
  if (appId === 'razorpay') {
    return `<form method="POST" action="/dashboard/apps/save/${appId}" class="form-grid"><div class="form-grid two"><div class="field"><label>Key ID</label><input name="keyId" value="${escapeHtml(app.keyId || '')}"></div><div class="field"><label>Key Secret</label><input name="keySecret" value="${escapeHtml(app.keySecret || '')}"></div><div class="field"><label>Theme Color</label><input name="themeColor" value="${escapeHtml(app.themeColor || '#111827')}"></div></div><div class="actions"><button class="btn" type="submit">Save Razorpay App</button></div></form>`;
  }
  if (appId === 'cashfree') {
    return `<form method="POST" action="/dashboard/apps/save/${appId}" class="form-grid"><div class="form-grid two"><div class="field"><label>App ID</label><input name="appId" value="${escapeHtml(app.appId || '')}"></div><div class="field"><label>Secret Key</label><input name="secretKey" value="${escapeHtml(app.secretKey || '')}"></div></div><div class="actions"><button class="btn" type="submit">Save Cashfree App</button></div></form>`;
  }
  if (appId === 'payu') {
    return `<form method="POST" action="/dashboard/apps/save/${appId}" class="form-grid"><div class="form-grid two"><div class="field"><label>Merchant Key</label><input name="merchantKey" value="${escapeHtml(app.merchantKey || '')}"></div><div class="field"><label>Merchant Salt</label><input name="merchantSalt" value="${escapeHtml(app.merchantSalt || '')}"></div></div><div class="actions"><button class="btn" type="submit">Save PayU App</button></div></form>`;
  }
  if (appId === 'shiprocket') {
    return `<form method="POST" action="/dashboard/apps/save/${appId}" class="form-grid"><div class="form-grid two"><div class="field"><label>Shiprocket Email</label><input name="email" value="${escapeHtml(app.email || '')}"></div><div class="field"><label>Shiprocket Password</label><input name="password" type="password" value="${escapeHtml(app.password || '')}"></div><div class="field"><label>Pickup Location</label><input name="pickupLocation" value="${escapeHtml(app.pickupLocation || '')}"></div></div><div class="actions"><button class="btn" type="submit">Save Shiprocket App</button></div></form>`;
  }
  if (appId === 'delhivery') {
    return `<form method="POST" action="/dashboard/apps/save/${appId}" class="form-grid"><div class="form-grid two"><div class="field"><label>API Key</label><input name="apiKey" value="${escapeHtml(app.apiKey || '')}"></div><div class="field"><label>Client Name</label><input name="clientName" value="${escapeHtml(app.clientName || '')}"></div></div><div class="actions"><button class="btn" type="submit">Save Delhivery App</button></div></form>`;
  }
  if (appId === 'shipway') {
    return `<form method="POST" action="/dashboard/apps/save/${appId}" class="form-grid"><div class="form-grid two"><div class="field"><label>API Key</label><input name="apiKey" value="${escapeHtml(app.apiKey || '')}"></div><div class="field"><label>Courier Code</label><input name="courierCode" value="${escapeHtml(app.courierCode || '')}"></div></div><div class="actions"><button class="btn" type="submit">Save Shipway App</button></div></form>`;
  }
  if (appId === 'webhooks') {
    return `<form method="POST" action="/dashboard/apps/save/${appId}" class="form-grid"><div class="field"><label>Order Created URL</label><input name="orderCreatedUrl" value="${escapeHtml(app.orderCreatedUrl || '')}"></div><div class="field"><label>Order Updated URL</label><input name="orderUpdatedUrl" value="${escapeHtml(app.orderUpdatedUrl || '')}"></div><div class="field"><label>Order Delivered URL</label><input name="orderDeliveredUrl" value="${escapeHtml(app.orderDeliveredUrl || '')}"></div><div class="actions"><button class="btn" type="submit">Save Webhooks App</button></div></form>`;
  }
  return '<div class="empty">No configuration required.</div>';
}

router.get('/dashboard', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const revenue = getStoreRevenue(store);
  const customers = getUniqueCustomers(store);
  const recentOrders = [...store.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const topProducts = [...store.products]
    .map((product) => ({ ...product, sold: store.orders.filter((order) => order.productId === product.id && (order.status === 'confirmed' || order.status === 'delivered')).length }))
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 4);
  const checklist = getSetupChecklist(store);
  const recentOrdersHtml = recentOrders.length ? `
      <div class="table-wrap"><table><thead><tr><th>Order</th><th>Product</th><th>Customer</th><th>Status</th><th>Amount</th><th>Date</th></tr></thead><tbody>
      ${recentOrders.map((order) => `<tr><td>${escapeHtml(order.id)}</td><td>${escapeHtml(order.productName)}</td><td>${escapeHtml(order.customerName || 'WhatsApp lead')}</td><td>${getStatusBadge(order.status)}</td><td>${escapeHtml(formatMoney(order.amount))}</td><td>${escapeHtml(formatDate(order.createdAt))}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">No orders yet.</div>';
  const topProductsHtml = topProducts.length ? `
      <div class="table-wrap"><table><thead><tr><th>#</th><th>Product</th><th>Sold</th><th>Price</th></tr></thead><tbody>
      ${topProducts.map((product, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(product.name)}</td><td>${escapeHtml(String(product.sold))}</td><td>${escapeHtml(formatMoney(product.price))}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">No product sales yet.</div>';
  const customersHtml = customers.length ? `
      <div class="table-wrap"><table><thead><tr><th>Customer</th><th>Phone</th><th>Orders</th><th>First seen</th></tr></thead><tbody>
      ${customers.slice(0, 5).map((customer) => `<tr><td>${escapeHtml(customer.name)}</td><td>${escapeHtml(customer.phone)}</td><td>${escapeHtml(String(customer.orders))}</td><td>${escapeHtml(formatDate(customer.firstSeen))}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">No customers yet.</div>';
  const storeUrl = buildStoreUrl(store.slug, req);
  const setupHtml = checklist.items.map((item) => {
    const action = getChecklistAction(item, storeUrl);
    return `
    <div class="setup-item">
      <div class="setup-check ${item.done ? 'done' : ''}">${item.done ? 'âœ“' : 'â€¢'}</div>
      <div>
        <div class="setup-title${item.done ? '' : ''}">${escapeHtml(item.title)}</div>
        <div class="setup-hint">${escapeHtml(item.hint)}</div>
      </div>
      ${!item.done && action ? `<a class="btn btn-secondary" href="${escapeHtml(action.href)}"${action.external ? ' target="_blank" rel="noopener noreferrer"' : ''} style="margin-left:auto;white-space:nowrap;">${escapeHtml(action.label)}</a>` : ''}
    </div>
  `;
  }).join('');
  const todayOrders = store.orders.filter((o) => new Date(o.createdAt).toDateString() === new Date().toDateString()).length;
  const todayRevenue = store.orders.filter((o) => ['confirmed', 'delivered'].includes(o.status) && new Date(o.createdAt).toDateString() === new Date().toDateString()).reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const pendingOrders = store.orders.filter((o) => o.status === 'pending').length;
  const lowStockProducts = store.products.filter((product) => {
    const stock = Number(product.stock || 0);
    return stock > 0 && stock <= 5;
  });
  const outOfStockProducts = store.products.filter((product) => Number(product.stock || 0) === 0);
  const abandonedCount = Array.isArray(store.abandonedCarts) ? store.abandonedCarts.length : 0;
  const quickStartHtml = [
    { title: '1. Add products', hint: 'Upload photos, names, prices, and stock.', href: '/dashboard/products' },
    { title: '2. Pick a look', hint: 'Choose a theme that matches your brand.', href: '/dashboard/theme' },
    { title: '3. Share your store', hint: 'Open the public link and start selling.', href: `/store/${escapeHtml(store.slug)}` }
  ].map((item) => `
    <a class="card data-chip" href="${escapeHtml(item.href)}">
      <div class="data-chip-label">${escapeHtml(item.title)}</div>
      <div class="data-chip-value" style="font-size:16px; line-height:1.5;">${escapeHtml(item.hint)}</div>
    </a>
  `).join('');
  const metricCards = [
    { label: 'Products', value: store.products.length, icon: 'â–£', color: '#3b5bfd' },
    { label: 'Orders', value: store.orders.length, icon: 'â—«', color: '#10b981' },
    { label: 'Revenue', value: formatMoney(revenue), icon: 'â†—', color: '#f59e0b' },
    { label: 'Views', value: store.visits, icon: 'â—Œ', color: '#8b5cf6' }
  ].map((item) => `
    <div class="card metric-card">
      <div class="metric-icon" style="background:${item.color}14; color:${item.color};">${escapeHtml(item.icon)}</div>
      <div>
        <div class="metric-label">${escapeHtml(item.label)}</div>
        <div class="metric-value">${escapeHtml(String(item.value))}</div>
      </div>
    </div>
  `).join('');
  res.send(renderAdminLayout(req, 'Dashboard', 'dashboard', `
      <div class="title-row">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Everything important in one place, with simple next steps.</p>
        </div>
        <a class="btn btn-secondary" href="/dashboard/getting-started">Guide</a>
      </div>

      <section class="card hero-card">
        <div class="page-header" style="margin-bottom:0;">
          <div>
            <div class="badge badge-live" style="margin-bottom:12px;">Store is live</div>
            <h2 class="section-title" style="margin:0 0 8px; font-size:26px;">Run your shop from one clean screen.</h2>
            <p class="section-subtitle" style="max-width:62ch; margin-bottom:18px;">Add products, track orders, and change your store look without hunting around. Everything is arranged in simple steps.</p>
            <div class="hero-meta">
              <span class="topbar-pill">Store: ${escapeHtml(store.slug)}</span>
              <span class="topbar-pill">URL: ${escapeHtml(storeUrl)}</span>
              <span class="topbar-pill">Orders: ${escapeHtml(String(store.orders.length))}</span>
              <span class="topbar-pill">Products: ${escapeHtml(String(store.products.length))}</span>
            </div>
          </div>
          <div class="action-bar">
            <a class="btn" href="/dashboard/products">Add product</a>
            <a class="btn btn-secondary" href="${escapeHtml(storeUrl)}" target="_blank" rel="noopener noreferrer">Open store</a>
          </div>
        </div>
      </section>

      <div class="hero-grid">
        <div class="stacked">
          <div class="mini-grid">${metricCards}</div>

          <div class="card panel">
            <div class="section-head"><h2 class="section-title" style="font-size:18px; margin:0;">Start here</h2><span class="muted">Simple setup path</span></div>
            <div class="data-strip">${quickStartHtml}</div>
          </div>

          <div class="card panel">
            <div class="title-row"><h2 class="section-title" style="font-size:18px; margin:0;">Today</h2></div>
            <div class="mini-grid">
              <div class="card metric-card" style="box-shadow:none;">
                <div class="metric-icon" style="background:#10b98114; color:#10b981;">â—«</div>
                <div><div class="metric-label">Today's Orders</div><div class="metric-value" style="font-size:22px;">${escapeHtml(String(todayOrders))}</div></div>
              </div>
              <div class="card metric-card" style="box-shadow:none;">
                <div class="metric-icon" style="background:#f59e0b14; color:#f59e0b;">â†—</div>
                <div><div class="metric-label">Today's Revenue</div><div class="metric-value" style="font-size:22px;">${escapeHtml(formatMoney(todayRevenue))}</div></div>
              </div>
              <div class="card metric-card" style="box-shadow:none;">
                <div class="metric-icon" style="background:#3b5bfd14; color:#3b5bfd;">â—”</div>
                <div><div class="metric-label">New Customers</div><div class="metric-value" style="font-size:22px;">${escapeHtml(String(customers.length))}</div></div>
              </div>
            </div>
          </div>

          <div class="card panel">
            <div class="title-row"><h2 class="section-title" style="font-size:18px; margin:0;">Needs attention</h2></div>
            <div class="setup-item" style="border:0; padding:10px 0 16px;">
              <div class="setup-check" style="background:#fef3c7; color:#b45309;">!</div>
              <div><div class="setup-title">Pending Orders</div><div class="setup-hint">Orders waiting for action</div></div>
              <div style="margin-left:auto; font-weight:900;">${escapeHtml(String(pendingOrders))}</div>
            </div>
            <div class="setup-item" style="border:0; padding:10px 0 0;">
              <div class="setup-check" style="background:#fee2e2; color:#dc2626;">!</div>
              <div><div class="setup-title">Abandoned Carts</div><div class="setup-hint">Recovery flow placeholder</div></div>
              <div style="margin-left:auto; font-weight:900;">${escapeHtml(String(abandonedCount))}</div>
            </div>
            <div class="setup-item" style="border:0; padding:16px 0 0;">
              <div class="setup-check" style="background:#ffedd5; color:#c2410c;">!</div>
              <div><div class="setup-title">Low Stock Products</div><div class="setup-hint">${lowStockProducts.length ? escapeHtml(lowStockProducts.slice(0, 3).map((product) => `${product.name} (${product.stock})`).join(', ')) : 'No low stock products right now.'}</div></div>
              <div style="margin-left:auto; font-weight:900;">${escapeHtml(String(lowStockProducts.length))}</div>
            </div>
            <div class="setup-item" style="border:0; padding:16px 0 0;">
              <div class="setup-check" style="background:#dbeafe; color:#1d4ed8;">!</div>
              <div><div class="setup-title">Out of Stock</div><div class="setup-hint">${outOfStockProducts.length ? escapeHtml(outOfStockProducts.slice(0, 3).map((product) => product.name).join(', ')) : 'All live products still have inventory.'}</div></div>
              <div style="margin-left:auto; font-weight:900;">${escapeHtml(String(outOfStockProducts.length))}</div>
            </div>
          </div>

          <div class="card panel">
            <div class="section-head"><h2 class="section-title" style="font-size:18px; margin:0;">Recent orders</h2><a href="/dashboard/orders" class="btn btn-secondary">View all</a></div>
            ${recentOrdersHtml}
          </div>
        </div>

        <div class="stacked">
          <div class="card panel">
            <div class="section-head"><h3 class="section-title" style="font-size:18px; margin:0;">Store setup</h3><span class="badge badge-live">${checklist.doneCount}/${checklist.total} done</span></div>
            <div class="setup-list">${setupHtml}</div>
          </div>
          <div class="card panel">
            <div class="section-head"><h2 class="section-title" style="font-size:18px; margin:0;">Top products</h2><a href="/dashboard/products" class="btn btn-secondary">Manage</a></div>
            ${topProductsHtml}
          </div>
          <div class="card panel">
            <div class="section-head"><h2 class="section-title" style="font-size:18px; margin:0;">Quick actions</h2></div>
            <div class="actions">
              <a class="btn" href="/dashboard/products">Add product</a>
              <a class="btn btn-secondary" href="/dashboard/categories">Categories</a>
              <a class="btn btn-secondary" href="/dashboard/bulk-upload">Bulk Upload</a>
              <a class="btn btn-secondary" href="/dashboard/coupons">Coupons</a>
              <a class="btn btn-secondary" href="/dashboard/payments">Payments</a>
              <a class="btn btn-secondary" href="/dashboard/shipping">Shipping</a>
            </div>
          </div>
          <div class="card panel">
            <div class="section-head"><h2 class="section-title" style="font-size:18px; margin:0;">Customers</h2><a href="/dashboard/customers" class="btn btn-secondary">Open</a></div>
            ${customersHtml}
          </div>
          <div class="card panel">
            <div class="section-head"><h2 class="section-title" style="font-size:18px; margin:0;">Revenue</h2></div>
            ${renderMiniBar('Revenue', revenue, Math.max(1, revenue, 1000), 'linear-gradient(135deg, #7c3aed, #2563eb)')}
            ${renderMiniBar('Orders', store.orders.length, Math.max(1, store.orders.length, 10), 'linear-gradient(135deg, #10b981, #059669)')}
            ${renderMiniBar('Views', store.visits, Math.max(1, store.visits, 10), 'linear-gradient(135deg, #f59e0b, #f97316)')}
          </div>
        </div>
      </div>
    `));
}));

router.get('/dashboard/products', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  store.categories = Array.isArray(store.categories) ? store.categories : [];
  const categoryOptions = store.categories.map((category) => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`).join('');
  const rows = store.products.length ? `
      <div class="table-wrap"><table><thead><tr><th>Image</th><th>Name</th><th>Price</th><th>Compare</th><th>Stock</th><th>SKU</th><th>Status</th><th>Date</th><th>Edit</th><th>Delete</th></tr></thead><tbody>
      ${store.products.map((product) => `<tr><td>${product.image ? `<img class="product-thumb" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : '-'}</td><td><strong>${escapeHtml(product.name)}</strong><div class="muted" style="font-size:12px;">${escapeHtml(product.category || 'General')}</div><div class="muted" style="font-size:12px;">Variants: ${escapeHtml(String(Array.isArray(product.variants) ? product.variants.length : 0))}</div></td><td>${escapeHtml(formatMoney(product.price))}</td><td>${Number(product.comparePrice || 0) > Number(product.price || 0) ? escapeHtml(formatMoney(product.comparePrice)) : '-'}</td><td>${escapeHtml(product.stock)}</td><td>${escapeHtml(product.sku || '-')}</td><td><form method="POST" action="/dashboard/products/toggle/${encodeURIComponent(product.id)}"><button class="btn ${product.active !== false ? 'btn-success' : 'btn-secondary'}" type="submit" style="min-height:34px;padding:6px 12px;font-size:12px;">${product.active !== false ? 'Live' : 'Hidden'}</button></form></td><td>${escapeHtml(formatDate(product.createdAt))}</td><td><a class="btn btn-secondary" href="/dashboard/products/edit/${encodeURIComponent(product.id)}">Edit</a></td><td><form method="POST" action="/dashboard/products/delete/${encodeURIComponent(product.id)}" onsubmit="return confirm('Delete this product?');"><button class="btn btn-danger" type="submit">Delete</button></form></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">No products added yet.</div>';
  res.send(renderAdminLayout(req, 'Products', 'products', `
      <section class="card panel">
        <h1 class="section-title">Products</h1>
        <p class="section-subtitle">Add products to your store and keep inventory updated.</p>
        <form method="POST" action="/dashboard/products/add" enctype="multipart/form-data" class="form-grid">
          <div class="form-grid two">
            <div class="field"><label for="name">Product Name</label><input id="name" name="name" required></div>
            <div class="field"><label for="price">Price</label><input id="price" name="price" required></div>
            <div class="field"><label for="comparePrice">Compare at Price (MRP / Original Price)</label><input id="comparePrice" name="comparePrice" placeholder="e.g. 999"></div>
            <div class="field"><label for="stock">Stock</label><input id="stock" name="stock" required></div>
            <div class="field"><label for="sku">SKU</label><input id="sku" name="sku" placeholder="SKU-001"></div>
            <div class="field"><label for="category">Category</label><select id="category" name="category"><option value="">General</option>${categoryOptions}</select></div>
            <div class="field"><label for="image">Image</label><input id="image" name="image" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" required></div>
          </div>
          <div class="field"><label for="additionalImages">Additional Images (max 4, optional)</label><input id="additionalImages" name="additionalImages" type="file" multiple accept=".jpg,.jpeg,.png,.webp,image/*"><span class="muted" style="font-size:12px;">Upload up to 4 extra product photos</span></div>
          <div class="field"><label for="description">Description</label><textarea id="description" name="description"></textarea></div>
          ${renderVariantBuilder([])}
          <div class="actions"><button class="btn" type="submit">Add Product</button></div>
        </form>
      </section>
      <section class="card panel"><h2 class="section-title" style="font-size:24px;">Product list</h2>${rows}</section>
    `));
}));

router.get('/dashboard/getting-started', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const checklist = getSetupChecklist(store);
  const storeUrl = buildStoreUrl(store.slug, req);
  const steps = checklist.items.map((item) => {
    const action = getChecklistAction(item, storeUrl);
    return `<div class="setup-item"><div class="setup-check ${item.done ? 'done' : ''}">${item.done ? 'âœ“' : String(item.title).match(/^\d+/) ? String(item.title).match(/^\d+/)[0] : 'â€¢'}</div><div><div class="setup-title">${escapeHtml(item.title)}</div><div class="setup-hint">${escapeHtml(item.hint)}</div></div>${action ? `<a class="btn btn-secondary" href="${escapeHtml(action.href)}"${action.external ? ' target="_blank" rel="noopener noreferrer"' : ''} style="margin-left:auto;white-space:nowrap;">${escapeHtml(action.label)}</a>` : ''}</div>`;
  }).join('');
  res.send(renderAdminLayout(req, 'Getting Started', 'dashboard', `<section class="card panel"><div class="title-row"><div><h1 class="page-title">Getting Started</h1><p class="page-subtitle">Finish these basics to make the store faster to launch and easier to trust.</p></div><a class="btn btn-secondary" href="${escapeHtml(storeUrl)}" target="_blank" rel="noopener noreferrer">Open Store</a></div><div style="height:16px;"></div><div class="section-head"><h2 class="section-title" style="font-size:18px; margin:0;">Launch Checklist</h2><span class="badge badge-live">${escapeHtml(String(checklist.doneCount))}/${escapeHtml(String(checklist.total))} done</span></div><div class="setup-list">${steps}</div></section>`));
}));

router.get('/dashboard/system-status', requireAuth, route(async (req, res) => {
  const status = getDBStatus();
  const items = [
    { label: 'DB cache', value: status.hasCache ? 'Warm' : 'Cold', hint: status.cacheAgeMs == null ? 'No cache yet' : `${status.cacheAgeMs}ms old` },
    { label: 'Background refresh', value: status.refreshInFlight ? 'Running' : 'Idle', hint: 'Non-blocking DB refresh state' },
    { label: 'Supabase', value: status.usesSupabase ? 'Connected' : 'Disabled', hint: 'Primary app data source' },
    { label: 'Cloudinary', value: status.cloudinaryEnabled ? 'Connected' : 'Disabled', hint: 'Image storage status' },
    { label: 'Mirror queue', value: status.backgroundMirrorPending ? 'Pending' : 'Clear', hint: 'Legacy app_data sync state' },
    { label: 'Environment', value: process.env.NODE_ENV || 'development', hint: process.env.BASE_DOMAIN || 'No base domain' }
  ].map((item) => `<div class="card metric-card" style="box-shadow:none;"><div><div class="metric-label">${escapeHtml(item.label)}</div><div class="metric-value" style="font-size:22px;">${escapeHtml(item.value)}</div><div class="setup-hint" style="margin-top:6px;">${escapeHtml(item.hint)}</div></div></div>`).join('');
  res.send(renderAdminLayout(req, 'System Status', 'system-status', `<section class="card panel"><div class="title-row"><div><h1 class="page-title">System Status</h1><p class="page-subtitle">Quick diagnostics for storage, cache, and background syncs.</p></div><a class="btn btn-secondary" href="/health" target="_blank" rel="noopener noreferrer">Open JSON Health</a></div><div style="height:16px;"></div><div class="mini-grid">${items}</div></section>`));
}));

router.post('/dashboard/products/add', requireAuth, route(async (req, res) => {
  try {
    await runUploader(upload.fields([{ name: 'image', maxCount: 1 }, { name: 'additionalImages', maxCount: 4 }]), req, res);
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    const name = String(req.body.name || '').trim();
    const price = String(req.body.price || '').trim();
    const comparePrice = parsePrice(req.body.comparePrice || '0');
    const description = String(req.body.description || '').trim();
    const stock = String(req.body.stock || '').trim();
    const sku = sanitizeInput(req.body.sku || '', 60);
    const category = sanitizeInput(req.body.category || '', 60);
    const variants = parseVariantsFromBody(req.body);
    const mainImage = req.files && req.files.image && req.files.image[0] ? req.files.image[0] : null;
    const extraFiles = req.files && Array.isArray(req.files.additionalImages) ? req.files.additionalImages : [];
    if (name.length < 2) { setFlash(req, 'error', 'Product name must be at least 2 characters.'); res.redirect('/dashboard/products'); return; }
    if (!(Number(price) > 0)) { setFlash(req, 'error', 'Price must be a positive number.'); res.redirect('/dashboard/products'); return; }
    if (!mainImage) { setFlash(req, 'error', 'Product image is required.'); res.redirect('/dashboard/products'); return; }
    if (mainImage.size > 10 * 1024 * 1024) { setFlash(req, 'error', 'Product image must be 10MB or less.'); res.redirect('/dashboard/products'); return; }
    const imagePath = await saveUploadedFile(mainImage, 'product');
    const extraImages = await Promise.all(extraFiles.slice(0, 4).map((file) => saveUploadedFile(file, 'product')));
    const now = new Date().toISOString();
    store.products.push({ id: generateId('p'), name, price: parsePrice(price), comparePrice, mrp: comparePrice || parsePrice(price), description, image: imagePath, images: [imagePath, ...extraImages], stock: Math.max(0, parseInt(stock, 10) || 0), sku, category, variants, reviews: [], active: true, createdAt: now, updatedAt: '' });
    await saveStoreProductFast(db, store.slug, store.products[store.products.length - 1]);
    setFlash(req, 'success', 'Product added successfully.');
    res.redirect('/dashboard/products');
  } catch (error) {
    setFlash(req, 'error', error.message || 'Unable to add product.');
    res.redirect('/dashboard/products');
  }
}));

router.get('/dashboard/products/edit/:id', requireAuth, route(async (req, res) => {
  const product = req.currentStore.products.find((item) => item.id === req.params.id);
  if (!product) {
    setFlash(req, 'error', 'Product not found.');
    res.redirect('/dashboard/products');
    return;
  }
  res.send(renderAdminLayout(req, 'Edit Product', 'products', `
      <section class="card panel">
        <h1 class="section-title">Edit product</h1>
        <p class="section-subtitle">Update details and optionally replace the product image.</p>
        <form method="POST" action="/dashboard/products/edit/${encodeURIComponent(product.id)}" enctype="multipart/form-data" class="form-grid">
          <div class="form-grid two">
            <div class="field"><label for="name">Product Name</label><input id="name" name="name" value="${escapeHtml(product.name)}" required></div>
            <div class="field"><label for="price">Price</label><input id="price" name="price" value="${escapeHtml(product.price)}" required></div>
            <div class="field"><label for="comparePrice">Compare at Price (MRP / Original Price)</label><input id="comparePrice" name="comparePrice" value="${escapeHtml(product.comparePrice || product.mrp || '')}"></div>
            <div class="field"><label for="stock">Stock</label><input id="stock" name="stock" value="${escapeHtml(product.stock)}" required></div>
            <div class="field"><label for="sku">SKU</label><input id="sku" name="sku" value="${escapeHtml(product.sku || '')}"></div>
            <div class="field"><label for="category">Category</label><input id="category" name="category" value="${escapeHtml(product.category || '')}"></div>
            <div class="field"><label for="image">Replace Image</label><input id="image" name="image" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif"></div>
          </div>
          <div class="field"><label for="additionalImages">Additional Images (max 4, optional)</label><input id="additionalImages" name="additionalImages" type="file" multiple accept=".jpg,.jpeg,.png,.webp,image/*"></div>
          <div class="field"><label for="description">Description</label><textarea id="description" name="description">${escapeHtml(product.description)}</textarea></div>
          <div class="field"><label>Current Image</label>${product.image ? `<img class="product-thumb" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : '<div class="muted">No image</div>'}</div>
          <div class="field"><label>Current Gallery</label>${renderProductGalleryPreview(product)}</div>
          ${renderVariantBuilder(product.variants || [])}
          <div class="actions"><button class="btn" type="submit">Save Changes</button><a class="btn btn-secondary" href="/dashboard/products">Back</a></div>
        </form>
      </section>
    `));
}));

router.post('/dashboard/products/edit/:id', requireAuth, route(async (req, res) => {
  try {
    await runUploader(upload.fields([{ name: 'image', maxCount: 1 }, { name: 'additionalImages', maxCount: 4 }]), req, res);
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    const product = store.products.find((item) => item.id === req.params.id);
    if (!product) { setFlash(req, 'error', 'Product not found.'); res.redirect('/dashboard/products'); return; }
    const name = String(req.body.name || '').trim();
    const price = String(req.body.price || '').trim();
    const comparePrice = parsePrice(req.body.comparePrice || '0');
    const description = String(req.body.description || '').trim();
    const stock = String(req.body.stock || '').trim();
    const sku = sanitizeInput(req.body.sku || '', 60);
    const category = sanitizeInput(req.body.category || '', 60);
    const variants = parseVariantsFromBody(req.body);
    const mainImage = req.files && req.files.image && req.files.image[0] ? req.files.image[0] : null;
    const extraFiles = req.files && Array.isArray(req.files.additionalImages) ? req.files.additionalImages : [];
    if (name.length < 2) { setFlash(req, 'error', 'Product name must be at least 2 characters.'); res.redirect(`/dashboard/products/edit/${encodeURIComponent(req.params.id)}`); return; }
    if (!(Number(price) > 0)) { setFlash(req, 'error', 'Price must be a positive number.'); res.redirect(`/dashboard/products/edit/${encodeURIComponent(req.params.id)}`); return; }
    if (mainImage && mainImage.size > 10 * 1024 * 1024) { setFlash(req, 'error', 'Product image must be 10MB or less.'); res.redirect(`/dashboard/products/edit/${encodeURIComponent(req.params.id)}`); return; }
    product.name = name;
    product.price = parsePrice(price);
    product.comparePrice = comparePrice;
    product.mrp = comparePrice || parsePrice(price);
    product.description = description;
    product.stock = Math.max(0, parseInt(stock, 10) || 0);
    product.sku = sku;
    product.category = category;
    product.variants = variants;
    product.updatedAt = new Date().toISOString();
    const previousMainImage = product.image;
    if (mainImage) {
      const newImagePath = await saveUploadedFile(mainImage, 'product');
      await removeStoredFile(previousMainImage);
      product.image = newImagePath;
    }
    const existingImages = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
    const galleryImages = existingImages.filter((image) => image && image !== product.image && image !== previousMainImage);
    const newAdditionalImages = await Promise.all(extraFiles.slice(0, 4).map((file) => saveUploadedFile(file, 'product')));
    product.images = [product.image, ...galleryImages, ...newAdditionalImages].filter(Boolean).slice(0, 5);
    await saveStoreProductFast(db, store.slug, product);
    setFlash(req, 'success', 'Product updated successfully.');
    res.redirect('/dashboard/products');
  } catch (error) {
    setFlash(req, 'error', error.message || 'Unable to update product.');
    res.redirect(`/dashboard/products/edit/${encodeURIComponent(req.params.id)}`);
  }
}));

router.post('/dashboard/products/delete/:id', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    const productIndex = store.products.findIndex((item) => item.id === req.params.id);
    if (productIndex === -1) { setFlash(req, 'error', 'Product not found.'); res.redirect('/dashboard/products'); return; }
    const removed = store.products.splice(productIndex, 1)[0];
    await Promise.all((Array.isArray(removed.images) ? removed.images : [removed.image]).filter(Boolean).map((image) => removeStoredFile(image)));
    await deleteStoreProductFast(db, store.slug, removed.id);
    setFlash(req, 'success', 'Product deleted successfully.');
    res.redirect('/dashboard/products');
  } catch (error) {
    setFlash(req, 'error', 'Unable to delete product.');
    res.redirect('/dashboard/products');
  }
}));

router.post('/dashboard/products/toggle/:id', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const store = db.stores[db.users[req.session.userId].storeSlug];
    const product = store.products.find((entry) => entry.id === req.params.id);
    if (product) {
      product.active = product.active === false ? true : false;
      await saveStoreProductFast(db, store.slug, product);
      setFlash(req, 'success', `Product ${product.active ? 'visible' : 'hidden'}.`);
    }
    res.redirect('/dashboard/products');
  } catch (error) {
    setFlash(req, 'error', 'Unable to update product status.');
    res.redirect('/dashboard/products');
  }
}));

router.get('/dashboard/orders', requireAuth, route(async (req, res) => {
  const orders = [...req.currentStore.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const rows = orders.length ? `
      <div class="table-wrap"><table><thead><tr><th>Order ID</th><th>Product</th><th>Customer</th><th>Phone</th><th>Status</th><th>Date</th><th>Update</th></tr></thead><tbody>
      ${orders.map((order) => `<tr><td>${escapeHtml(order.id)}</td><td>${escapeHtml(order.productName)}</td><td>${escapeHtml(order.customerName || 'WhatsApp lead')}</td><td>${escapeHtml(order.customerPhone || '-')}</td><td>${getStatusBadge(order.status)}</td><td>${escapeHtml(formatDate(order.createdAt))}</td><td><form class="inline-form" method="POST" action="/dashboard/orders/status/${encodeURIComponent(order.id)}"><select class="status-select" name="status">${ORDER_STATUSES.map((status) => `<option value="${escapeHtml(status)}"${order.status === status ? ' selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select><button class="btn" type="submit">Save</button></form></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">No orders yet.</div>';
  res.send(renderAdminLayout(req, 'Orders', 'orders', `<section class="card panel"><h1 class="section-title">Orders</h1><p class="section-subtitle">Update order status and track incoming WhatsApp leads.</p>${rows}</section>`));
}));

router.post('/dashboard/orders/status/:id', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    const order = store.orders.find((item) => item.id === req.params.id);
    const status = String(req.body.status || '').trim();
    if (!order) { setFlash(req, 'error', 'Order not found.'); res.redirect('/dashboard/orders'); return; }
    if (!ORDER_STATUSES.includes(status)) { setFlash(req, 'error', 'Invalid order status.'); res.redirect('/dashboard/orders'); return; }
    const previousStatus = order.status;
    order.status = status;
    order.updatedAt = new Date().toISOString();
    order.trackingHistory = Array.isArray(order.trackingHistory) ? order.trackingHistory : [];
    order.trackingHistory.push({ status, at: order.updatedAt });
    await saveDB(db);
    if (previousStatus !== status) {
      if (status === 'shipped' && order.customerEmail) sendOrderShippedEmail(order, store).catch(console.error);
      if (status === 'delivered' && order.customerEmail) sendOrderDeliveredEmail(order, store).catch(console.error);
      sendVendorOrderStatusUpdate(order, store, user.email || store.ownerId).catch(console.error);
      if (order.customerEmail && !['shipped', 'delivered'].includes(status)) {
        sendEmail({
          to: order.customerEmail,
          subject: `Order update: ${order.orderNumber || order.id}`,
          store,
          html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:24px;"><div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:28px;"><h2 style="margin-top:0;">Order status updated</h2><p>Your order <strong>${escapeHtml(order.orderNumber || order.id)}</strong> is now <strong>${escapeHtml(status)}</strong>.</p><p>Tracking ID: <strong>${escapeHtml(order.trackingCode || '-')}</strong></p><p><a href="${escapeHtml(`${process.env.BASE_URL || ''}/store/${encodeURIComponent(store.slug)}/order/${encodeURIComponent(order.trackingCode || order.id)}`)}" style="display:inline-block;padding:12px 20px;background:#111827;color:#fff;border-radius:12px;text-decoration:none;font-weight:700;">View Order</a></p></div></body></html>`
        }).catch(console.error);
      }
    }
    setFlash(req, 'success', 'Order status updated.');
    res.redirect('/dashboard/orders');
  } catch (error) {
    setFlash(req, 'error', 'Unable to update order status.');
    res.redirect('/dashboard/orders');
  }
}));

router.get('/dashboard/orders/export', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const orders = [...store.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const csvRows = ['Order#,Date,Customer,Phone,Email,Items,Amount,Status,Address'];
  orders.forEach((o) => {
    const items = Array.isArray(o.items) ? o.items.map((i) => `${i.name} x${i.quantity}`).join('; ') : o.productName;
    csvRows.push([
      `"${o.orderNumber || o.id}"`,
      `"${formatDate(o.createdAt)}"`,
      `"${(o.customerName || '').replace(/"/g, '""')}"`,
      `"${o.customerPhone || ''}"`,
      `"${o.customerEmail || ''}"`,
      `"${(items || '').replace(/"/g, '""')}"`,
      `"${formatMoney(o.amount)}"`,
      `"${o.status}"`,
      `"${(o.shippingAddress || '').replace(/"/g, '""')}"`
    ].join(','));
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${store.slug}-orders.csv"`);
  res.send(csvRows.join('\n'));
}));

router.get('/dashboard/analytics', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const revenue = store.orders.filter((order) => order.status === 'confirmed' || order.status === 'delivered').reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const breakdown = ORDER_STATUSES.reduce((acc, status) => { acc[status] = store.orders.filter((order) => order.status === status).length; return acc; }, {});
  const publicUrl = buildStoreUrl(store.slug, req);
  const subdomainUrl = store.subdomain && BASE_DOMAIN ? `${(req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']).split(',')[0].trim() : req.protocol || 'https')}://${store.subdomain}` : '';
  const last7Days = [];
  const last7DaysRevenue = [];
  const last7DaysOrders = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    const dateStr = day.toDateString();
    const dayOrders = store.orders.filter((order) => new Date(order.createdAt).toDateString() === dateStr);
    last7Days.push(day.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }));
    last7DaysOrders.push(dayOrders.length);
    last7DaysRevenue.push(dayOrders.filter((order) => ['confirmed', 'delivered'].includes(order.status)).reduce((sum, order) => sum + Number(order.amount || 0), 0));
  }
  res.send(renderAdminLayout(req, 'Analytics', 'analytics', `
      <section class="stat-grid">
        <div class="card stat-card"><div class="stat-label">Visits</div><div class="stat-value">${escapeHtml(String(store.visits))}</div></div>
        <div class="card stat-card"><div class="stat-label">Revenue</div><div class="stat-value">${escapeHtml(formatMoney(revenue))}</div></div>
        <div class="card stat-card"><div class="stat-label">Total Products</div><div class="stat-value">${escapeHtml(String(store.products.length))}</div></div>
        <div class="card stat-card"><div class="stat-label">Total Orders</div><div class="stat-value">${escapeHtml(String(store.orders.length))}</div></div>
      </section>
      <section class="grid-2" style="margin-top:20px;">
        <div class="card panel"><h2 class="section-title" style="font-size:24px;">Order breakdown</h2><div class="kpi-list"><div class="kpi-item"><strong>Pending</strong><span>${escapeHtml(String(breakdown.pending))}</span></div><div class="kpi-item"><strong>Confirmed</strong><span>${escapeHtml(String(breakdown.confirmed))}</span></div><div class="kpi-item"><strong>Cancelled</strong><span>${escapeHtml(String(breakdown.cancelled))}</span></div><div class="kpi-item"><strong>Delivered</strong><span>${escapeHtml(String(breakdown.delivered))}</span></div></div></div>
        <div class="card panel"><h2 class="section-title" style="font-size:24px;">Public store URL</h2><div class="public-url">${escapeHtml(publicUrl)}</div>${subdomainUrl ? `<div style="margin-top:8px;font-size:13px;color:#64748b;">Subdomain: <strong>${escapeHtml(subdomainUrl)}</strong></div>` : ''}<div style="height:16px;"></div><a class="btn" href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener noreferrer">Open Store</a></div>
      </section>
      <section class="card panel" style="margin-top:20px;">
        <h2 class="section-title" style="font-size:18px;">Revenue - Last 7 Days</h2>
        <canvas id="revenueChart" height="80"></canvas>
      </section>
      <section class="card panel" style="margin-top:20px;">
        <h2 class="section-title" style="font-size:18px;">Orders - Last 7 Days</h2>
        <canvas id="ordersChart" height="80"></canvas>
      </section>
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
      <script>
      (function(){
        var labels = ${JSON.stringify(last7Days)};
        var revenueData = ${JSON.stringify(last7DaysRevenue)};
        var ordersData = ${JSON.stringify(last7DaysOrders)};
        var revenueNode = document.getElementById('revenueChart');
        var ordersNode = document.getElementById('ordersChart');
        if (typeof Chart === 'undefined' || !revenueNode || !ordersNode) return;
        new Chart(revenueNode, {
          type: 'bar',
          data: { labels: labels, datasets: [{ label: 'Revenue (Rs)', data: revenueData, backgroundColor: 'rgba(124,58,237,0.7)', borderRadius: 8 }] },
          options: { responsive: true, plugins: { legend: { display: false } } }
        });
        new Chart(ordersNode, {
          type: 'line',
          data: { labels: labels, datasets: [{ label: 'Orders', data: ordersData, borderColor: 'rgba(37,99,235,0.9)', backgroundColor: 'rgba(37,99,235,0.15)', tension: 0.35, fill: true }] },
          options: { responsive: true, plugins: { legend: { display: false } } }
        });
      })();
      </script>
    `));
}));

router.get('/dashboard/settings', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const section = pickStoreSettingsSection(req.query.section || 'store-details');
  ensureStoreSettings(store);
  res.send(renderAdminLayout(req, 'Store Settings', 'settings', `
    <div class="osa-page-head">
      <div>
        <h1>Store Settings</h1>
        <p>Everything from store details to SEO, checkout, delivery, policies, labels, and robots.txt is grouped here section by section.</p>
      </div>
    </div>
    <div class="osa-settings-layout">
      ${renderStoreSettingsSectionNav(section)}
      ${renderStoreSettingsSection(store, section)}
    </div>
  `, storeAdminPanelStyles));
}));

router.post('/dashboard/settings/update', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    ensureStoreSettings(store);
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    const whatsapp = sanitizePhone(req.body.whatsapp || '');
    const theme = String(req.body.theme || '').trim();
    if (name.length < 3) { setFlash(req, 'error', 'Store name must be at least 3 characters.'); res.redirect('/dashboard/settings'); return; }
    if (!description || description.length > 200) { setFlash(req, 'error', 'Description is required and must be at most 200 characters.'); res.redirect('/dashboard/settings'); return; }
    if (whatsapp.length < 10) { setFlash(req, 'error', 'WhatsApp number must be at least 10 digits.'); res.redirect('/dashboard/settings'); return; }
    if (!['default', 'dark'].includes(theme)) { setFlash(req, 'error', 'Invalid theme selection.'); res.redirect('/dashboard/settings'); return; }
    store.name = name;
    store.description = description;
    store.whatsapp = whatsapp;
    store.theme = theme;
    await saveDB(db);
    setFlash(req, 'success', 'Settings updated.');
    res.redirect('/dashboard/settings?section=store-details');
  } catch (error) {
    setFlash(req, 'error', 'Unable to update settings.');
    res.redirect('/dashboard/settings?section=store-details');
  }
}));

router.post('/dashboard/settings/logo', requireAuth, route(async (req, res) => {
  try {
    await runUploader(upload.single('logo'), req, res);
    if (!req.file) { setFlash(req, 'error', 'Please choose a logo file.'); res.redirect('/dashboard/settings?section=store-details'); return; }
    if (req.file.size > 5 * 1024 * 1024) { setFlash(req, 'error', 'Logo size must be 5MB or less.'); res.redirect('/dashboard/settings?section=store-details'); return; }
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    const newLogo = await saveUploadedFile(req.file, 'logo');
    await removeStoredFile(store.logo);
    store.logo = newLogo;
    await saveDB(db);
    setFlash(req, 'success', 'Logo updated successfully.');
    res.redirect('/dashboard/settings?section=store-details');
  } catch (error) {
    setFlash(req, 'error', error.message || 'Unable to update logo.');
    res.redirect('/dashboard/settings?section=store-details');
  }
}));

router.post('/dashboard/settings/favicon', requireAuth, route(async (req, res) => {
  try {
    await runUploader(upload.single('favicon'), req, res);
    if (!req.file) { setFlash(req, 'error', 'Please choose a favicon file.'); res.redirect('/dashboard/settings?section=store-details'); return; }
    if (req.file.size > 5 * 1024 * 1024) { setFlash(req, 'error', 'Favicon size must be 5MB or less.'); res.redirect('/dashboard/settings?section=store-details'); return; }
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    ensureStoreSettings(store);
    const newFavicon = await saveUploadedFile(req.file, 'logo');
    await removeStoredFile(store.storeSettings.storeDetails.favicon);
    store.storeSettings.storeDetails.favicon = newFavicon;
    await saveDB(db);
    setFlash(req, 'success', 'Favicon updated successfully.');
    res.redirect('/dashboard/settings?section=store-details');
  } catch (error) {
    setFlash(req, 'error', error.message || 'Unable to update favicon.');
    res.redirect('/dashboard/settings?section=store-details');
  }
}));

router.post('/dashboard/settings/save', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    const ss = ensureStoreSettings(store);
    const section = pickStoreSettingsSection(req.body.section || 'store-details');

    if (section === 'store-details') {
      const name = sanitizeThemeField(req.body.name, 80);
      const description = sanitizeThemeField(req.body.description, 200);
      const whatsapp = sanitizePhone(req.body.whatsapp || '');
      const theme = ['default', 'dark'].includes(String(req.body.theme || '')) ? String(req.body.theme) : 'default';
      if (name.length < 3) { setFlash(req, 'error', 'Store name must be at least 3 characters.'); res.redirect('/dashboard/settings?section=store-details'); return; }
      store.name = name;
      store.description = description;
      store.whatsapp = whatsapp;
      store.theme = theme;
      ss.storeDetails.category = sanitizeThemeField(req.body.category, 60) || 'General Store';
      ss.storeDetails.phone = sanitizePhone(req.body.phone || '');
      ss.storeDetails.email = sanitizeThemeField(req.body.email, 100).toLowerCase();
      ss.storeDetails.legalName = sanitizeThemeField(req.body.legalName, 100);
      ss.storeDetails.businessType = sanitizeThemeField(req.body.businessType, 60) || 'Individual';
      ss.storeDetails.address = sanitizeThemeField(req.body.address, 400);
      ss.storeDetails.socialLinks.facebook = sanitizeThemeField(req.body.facebook, 200);
      ss.storeDetails.socialLinks.youtube = sanitizeThemeField(req.body.youtube, 200);
      ss.storeDetails.socialLinks.instagram = sanitizeThemeField(req.body.instagram, 200);
    } else if (section === 'store-domain') {
      ss.domain.customDomain = sanitizeThemeField(req.body.customDomain, 100).toLowerCase();
      ss.domain.subdomain = sanitizeThemeField(req.body.subdomain, 100).toLowerCase();
      store.domain = { customDomain: ss.domain.customDomain, subdomain: ss.domain.subdomain };
      store.subdomain = ss.domain.subdomain;
    } else if (section === 'products-settings') {
      ss.productSettings.hideOutOfStock = checkboxValue(req, 'hideOutOfStock');
      ss.productSettings.displaySingleVariantDetails = checkboxValue(req, 'displaySingleVariantDetails');
      ss.productSettings.showCartCheckoutPopup = checkboxValue(req, 'showCartCheckoutPopup');
      ss.productSettings.productCardSalePrice = sanitizeThemeField(req.body.productCardSalePrice, 40) || 'sale-tax';
      ss.productSettings.productPageSalePrice = sanitizeThemeField(req.body.productPageSalePrice, 40) || 'sale-tax';
      ss.productSettings.minimumQtyIncrementRule = sanitizeThemeField(req.body.minimumQtyIncrementRule, 20) || 'single';
      ss.productSettings.variantSelectorType = sanitizeThemeField(req.body.variantSelectorType, 20) || 'chips';
    } else if (section === 'checkout-settings') {
      ss.checkoutSettings.roundingMode = sanitizeThemeField(req.body.roundingMode, 20) || 'none';
      ss.checkoutSettings.showTaxInfo = checkboxValue(req, 'showTaxInfo');
      ss.checkoutSettings.minimumOrderAmount = sanitizeThemeField(req.body.minimumOrderAmount, 20) || '0';
      ss.checkoutSettings.cartNote = String(req.body.cartNote || '').slice(0, 2000);
    } else if (section === 'delivery-settings') {
      ss.deliverySettings.fee = sanitizeThemeField(req.body.deliveryFee, 20) || '0';
      ss.deliverySettings.freeDeliveryAbove = sanitizeThemeField(req.body.freeDeliveryAbove, 20);
      ss.deliverySettings.allIndiaDelivery = checkboxValue(req, 'allIndiaDelivery');
      ss.deliverySettings.deliveryRadius = sanitizeThemeField(req.body.deliveryRadius, 20) || '5';
      ss.deliverySettings.serviceType = sanitizeThemeField(req.body.serviceType, 30) || 'delivery';
      ss.deliverySettings.addressType = sanitizeThemeField(req.body.addressType, 30) || 'form';
      ss.deliverySettings.nextDayTitle = sanitizeThemeField(req.body.nextDayTitle, 80);
      ss.deliverySettings.nextDaySubtitle = sanitizeThemeField(req.body.nextDaySubtitle, 180);
      ss.deliverySettings.normalTitle = sanitizeThemeField(req.body.normalTitle, 80);
      ss.deliverySettings.normalSubtitle = sanitizeThemeField(req.body.normalSubtitle, 180);
      store.shipping = { mode: ss.deliverySettings.serviceType === 'pickup' ? 'pickup' : 'flat', fee: ss.deliverySettings.fee, notes: ss.deliverySettings.normalSubtitle };
    } else if (section === 'payment-settings') {
      ss.paymentSettings.cod = checkboxValue(req, 'cod');
      ss.paymentSettings.partialCod = checkboxValue(req, 'partialCod');
      ss.paymentSettings.onlinePayment = checkboxValue(req, 'onlinePayment');
      ss.paymentSettings.bankDetails = String(req.body.bankDetails || '').slice(0, 2000);
      ss.paymentSettings.paymentModeRules = String(req.body.paymentModeRules || '').slice(0, 2000);
    } else if (section === 'order-settings') {
      ss.orderSettings.allowInvoiceDownload = checkboxValue(req, 'allowInvoiceDownload');
      ss.orderSettings.allowOrderCancellation = checkboxValue(req, 'allowOrderCancellation');
      ss.orderSettings.autoConfirmPaymentMode = sanitizeThemeField(req.body.autoConfirmPaymentMode, 20) || 'online';
      ss.orderSettings.orderNote = String(req.body.orderNote || '').slice(0, 2000);
    } else if (section === 'return-order-settings') {
      ss.returnOrderSettings.allowReturnRequests = checkboxValue(req, 'allowReturnRequests');
      ss.returnOrderSettings.returnWindowDays = sanitizeThemeField(req.body.returnWindowDays, 10) || '7';
      ss.returnOrderSettings.instructions = String(req.body.returnInstructions || '').slice(0, 2000);
    } else if (section === 'label-settings') {
      const labels = ss.labelSettings;
      labels.searchBoxText = sanitizeThemeField(req.body.searchBoxText, 80) || labels.searchBoxText;
      labels.selectLocationText = sanitizeThemeField(req.body.selectLocationText, 80) || labels.selectLocationText;
      labels.categoriesHeading = sanitizeThemeField(req.body.categoriesHeading, 80) || labels.categoriesHeading;
      labels.collectionsHeading = sanitizeThemeField(req.body.collectionsHeading, 80) || labels.collectionsHeading;
      labels.productsHeading = sanitizeThemeField(req.body.productsHeading, 80) || labels.productsHeading;
      labels.addProductButton = sanitizeThemeField(req.body.addProductButton, 40) || labels.addProductButton;
      labels.productCardEnquiryButton = sanitizeThemeField(req.body.productCardEnquiryButton, 40) || labels.productCardEnquiryButton;
      labels.viewAllProductsButton = sanitizeThemeField(req.body.viewAllProductsButton, 60) || labels.viewAllProductsButton;
      labels.bottomNavHome = sanitizeThemeField(req.body.bottomNavHome, 30) || labels.bottomNavHome;
      labels.bottomNavOrders = sanitizeThemeField(req.body.bottomNavOrders, 30) || labels.bottomNavOrders;
      labels.bottomNavCart = sanitizeThemeField(req.body.bottomNavCart, 30) || labels.bottomNavCart;
      labels.bottomNavAccount = sanitizeThemeField(req.body.bottomNavAccount, 30) || labels.bottomNavAccount;
      labels.signInHeading = sanitizeThemeField(req.body.signInHeading, 50) || labels.signInHeading;
      labels.signUpHeading = sanitizeThemeField(req.body.signUpHeading, 50) || labels.signUpHeading;
      labels.requestOtpButton = sanitizeThemeField(req.body.requestOtpButton, 50) || labels.requestOtpButton;
      store.themeConfig.categoryTitle = labels.categoriesHeading;
      store.themeConfig.productsTitle = labels.productsHeading;
      store.themeConfig.menuHomeLabel = labels.bottomNavHome;
      store.themeConfig.menuCartLabel = labels.bottomNavCart;
      store.themeConfig.menuAccountLabel = labels.bottomNavAccount;
    } else if (section === 'seo-settings') {
      ss.seoSettings.title = sanitizeThemeField(req.body.seoTitle, 120);
      ss.seoSettings.description = sanitizeThemeField(req.body.seoDescription, 200);
      ss.seoSettings.keywords = sanitizeThemeField(req.body.seoKeywords, 200);
      ss.seoSettings.googleSiteVerification = sanitizeThemeField(req.body.googleSiteVerification, 120);
      ss.seoSettings.facebookDomainVerification = sanitizeThemeField(req.body.facebookDomainVerification, 120);
      ss.seoSettings.pinterestDomainVerification = sanitizeThemeField(req.body.pinterestDomainVerification, 120);
    } else if (section === 'llm-settings') {
      ss.llmSettings.enabled = checkboxValue(req, 'llmEnabled');
      ss.llmSettings.businessSummary = String(req.body.businessSummary || '').slice(0, 2000);
      ss.llmSettings.supportEmail = sanitizeThemeField(req.body.supportEmail, 100);
      ss.llmSettings.supportPhone = sanitizeThemeField(req.body.supportPhone, 30);
    } else if (section === 'notifications-settings') {
      ss.notificationsSettings.newOrder = checkboxValue(req, 'newOrder');
      ss.notificationsSettings.whatsappLead = checkboxValue(req, 'whatsappLead');
      ss.notificationsSettings.lowStock = checkboxValue(req, 'lowStock');
      ss.notificationsSettings.abandonedCart = checkboxValue(req, 'abandonedCart');
      store.notifications = { newOrder: ss.notificationsSettings.newOrder, whatsappLead: ss.notificationsSettings.whatsappLead, lowStock: ss.notificationsSettings.lowStock, abandonedCart: ss.notificationsSettings.abandonedCart };
    } else if (section === 'login-settings') {
      ss.loginSettings.allowRegistration = checkboxValue(req, 'allowRegistration');
      ss.loginSettings.signInHeading = sanitizeThemeField(req.body.loginSignInHeading, 60) || 'Sign In';
      ss.loginSettings.signUpHeading = sanitizeThemeField(req.body.loginSignUpHeading, 60) || 'Sign Up';
      ss.loginSettings.requestOtpButton = sanitizeThemeField(req.body.loginRequestOtpButton, 60) || 'Send SMS OTP';
      ss.labelSettings.signInHeading = ss.loginSettings.signInHeading;
      ss.labelSettings.signUpHeading = ss.loginSettings.signUpHeading;
      ss.labelSettings.requestOtpButton = ss.loginSettings.requestOtpButton;
    } else if (section === 'robots-txt') {
      ss.robotsSettings.mode = sanitizeThemeField(req.body.robotsMode, 20) || 'normal';
      ss.robotsSettings.allowAll = checkboxValue(req, 'allowAll');
      ss.robotsSettings.homeOnly = checkboxValue(req, 'homeOnly');
      ss.robotsSettings.blockAll = checkboxValue(req, 'blockAll');
      ss.robotsSettings.customText = String(req.body.robotsCustomText || '').slice(0, 4000);
    } else if (section === 'policies') {
      ss.policies.terms = String(req.body.policyTerms || '').slice(0, 12000);
      ss.policies.shipping = String(req.body.policyShipping || '').slice(0, 12000);
      ss.policies.payment = String(req.body.policyPayment || '').slice(0, 12000);
      ss.policies.returnRefund = String(req.body.policyReturnRefund || '').slice(0, 12000);
      ss.policies.privacy = String(req.body.policyPrivacy || '').slice(0, 12000);
    } else if (section === 'about-us') {
      ss.aboutUs.title = sanitizeThemeField(req.body.aboutTitle, 100) || 'About Us';
      ss.aboutUs.content = String(req.body.aboutContent || '').slice(0, 12000);
    }

    await saveDB(db);
    setFlash(req, 'success', `${STORE_SETTINGS_SECTIONS.find((item) => item.id === section).label} updated.`);
    res.redirect(`/dashboard/settings?section=${encodeURIComponent(section)}`);
  } catch (error) {
    const section = pickStoreSettingsSection(req.body.section || 'store-details');
    setFlash(req, 'error', 'Unable to save store settings.');
    res.redirect(`/dashboard/settings?section=${encodeURIComponent(section)}`);
  }
}));

router.post('/dashboard/settings/redirects/add', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    const ss = ensureStoreSettings(store);
    const from = sanitizeThemeField(req.body.from, 160);
    const to = sanitizeThemeField(req.body.to, 200);
    if (!from || !to) { setFlash(req, 'error', 'Both redirect fields are required.'); res.redirect('/dashboard/settings?section=url-redirects'); return; }
    ss.urlRedirects.push({ from, to });
    await saveDB(db);
    setFlash(req, 'success', 'Redirect rule added.');
    res.redirect('/dashboard/settings?section=url-redirects');
  } catch (error) {
    setFlash(req, 'error', 'Unable to add redirect.');
    res.redirect('/dashboard/settings?section=url-redirects');
  }
}));

router.post('/dashboard/settings/redirects/delete/:index', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    const ss = ensureStoreSettings(store);
    const index = Number(req.params.index);
    if (index >= 0 && index < ss.urlRedirects.length) {
      ss.urlRedirects.splice(index, 1);
      await saveDB(db);
      setFlash(req, 'success', 'Redirect removed.');
    }
    res.redirect('/dashboard/settings?section=url-redirects');
  } catch (error) {
    setFlash(req, 'error', 'Unable to remove redirect.');
    res.redirect('/dashboard/settings?section=url-redirects');
  }
}));

router.get('/dashboard/display-settings', requireAuth, route(async (req, res) => {
  const section = pickDisplaySection(req.query.section || 'announcement');
  res.send(renderAdminLayout(req, 'Display Settings', 'display-settings', `
    <div class="osa-page-head">
      <div>
        <h1>Display Settings</h1>
        <p>Every important storefront element has its own section. Open one section, change one thing, save, and check the live preview.</p>
      </div>
    </div>
    <div class="osa-settings-layout">
      ${renderDisplaySectionNav(section)}
      ${renderDisplaySettingsSection(req.currentStore, section)}
    </div>
  `, storeAdminPanelStyles));
}));

router.post('/dashboard/display-settings/save', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.themeConfig = store.themeConfig || {};
    const cfg = store.themeConfig;
    const section = pickDisplaySection(req.body.section || 'announcement');

    if (section === 'announcement') {
      cfg.announcementEnabled = checkboxValue(req, 'announcementEnabled');
      cfg.topBarText = sanitizeThemeField(req.body.topBarText, 180);
      cfg.topBarMarquee = String(req.body.topBarMarquee || 'true') !== 'false';
      cfg.topBarBg = sanitizeThemeField(req.body.topBarBgText, 30);
      cfg.topBarColor = sanitizeThemeField(req.body.topBarColorText, 30);
    } else if (section === 'header') {
      cfg.headerLayout = ['search', 'center', 'left'].includes(String(req.body.headerLayout || '')) ? String(req.body.headerLayout) : 'search';
      cfg.headerSticky = checkboxValue(req, 'headerSticky');
      cfg.showSearch = checkboxValue(req, 'showSearch');
      cfg.showWishlistIcon = checkboxValue(req, 'showWishlistIcon');
      cfg.showCartIcon = checkboxValue(req, 'showCartIcon');
    } else if (section === 'menu') {
      cfg.menuHomeLabel = sanitizeThemeField(req.body.menuHomeLabel, 30) || 'Home';
      cfg.menuShopLabel = sanitizeThemeField(req.body.menuShopLabel, 30) || 'Shop All';
      cfg.menuWishlistLabel = sanitizeThemeField(req.body.menuWishlistLabel, 30) || 'Wishlist';
      cfg.menuCartLabel = sanitizeThemeField(req.body.menuCartLabel, 30) || 'Cart';
      cfg.menuTrackLabel = sanitizeThemeField(req.body.menuTrackLabel, 30) || 'Track Order';
      cfg.menuAccountLabel = sanitizeThemeField(req.body.menuAccountLabel, 30) || 'My Account';
    } else if (section === 'banner') {
      cfg.showBanner = checkboxValue(req, 'showBanner');
      cfg.bannerTitle = sanitizeThemeField(req.body.bannerTitle, 80);
      cfg.bannerSubtitle = sanitizeThemeField(req.body.bannerSubtitle, 220);
      cfg.bannerCta = sanitizeThemeField(req.body.bannerCta, 40);
    } else if (section === 'categories') {
      cfg.showCategories = checkboxValue(req, 'showCategories');
      cfg.categoryTitle = sanitizeThemeField(req.body.categoryTitle, 40) || 'Categories';
      cfg.categoryLayout = ['auto', 'carousel', 'grid'].includes(String(req.body.categoryLayout || '')) ? String(req.body.categoryLayout) : 'auto';
      cfg.categoryStyle = ['circle', 'square', 'grid', 'pill'].includes(String(req.body.categoryStyle || '')) ? String(req.body.categoryStyle) : 'circle';
    } else if (section === 'products') {
      cfg.productsTitle = sanitizeThemeField(req.body.productsTitle, 50) || 'All Products';
      cfg.showFlashDeals = checkboxValue(req, 'showFlashDeals');
    } else if (section === 'footer') {
      cfg.showFooter = checkboxValue(req, 'showFooter');
      cfg.showPoweredBy = checkboxValue(req, 'showPoweredBy');
      cfg.footerText = sanitizeThemeField(req.body.footerText, 120);
    } else if (section === 'product-card') {
      cfg.productCardStyle = ['style-1', 'style-2', 'style-3', 'style-4'].includes(String(req.body.productCardStyle || '')) ? String(req.body.productCardStyle) : 'style-2';
      cfg.showDiscount = checkboxValue(req, 'showDiscount');
      cfg.showRating = checkboxValue(req, 'showRating');
      cfg.showProductStock = checkboxValue(req, 'showProductStock');
    } else if (section === 'product-page') {
      cfg.showProductDescription = checkboxValue(req, 'showProductDescription');
      cfg.showProductPageStock = checkboxValue(req, 'showProductPageStock');
      cfg.showWhatsappButton = checkboxValue(req, 'showWhatsappButton');
    } else if (section === 'color-font') {
      cfg.primaryColor = sanitizeThemeField(req.body.primaryColorText, 30);
      cfg.secondaryColor = sanitizeThemeField(req.body.secondaryColorText, 30);
      cfg.btnColor = sanitizeThemeField(req.body.btnColorText, 30);
      cfg.bgColor = sanitizeThemeField(req.body.bgColorText, 30);
      cfg.headingFont = sanitizeThemeField(req.body.headingFont, 30);
      cfg.bodyFont = sanitizeThemeField(req.body.bodyFont, 30);
      cfg.borderRadius = ['sharp', 'rounded', 'pill'].includes(String(req.body.borderRadius || '')) ? String(req.body.borderRadius) : 'rounded';
      cfg.btnStyle = ['sharp', 'rounded', 'pill'].includes(String(req.body.btnStyle || '')) ? String(req.body.btnStyle) : 'pill';
    } else if (section === 'custom-css') {
      cfg.customCss = String(req.body.customCss || '').slice(0, 10000);
    }

    await saveDB(db);
    setFlash(req, 'success', `${DISPLAY_SETTINGS_SECTIONS.find((item) => item.id === section).label} updated.`);
    res.redirect(`/dashboard/display-settings?section=${encodeURIComponent(section)}`);
  } catch (error) {
    const section = pickDisplaySection(req.body.section || 'announcement');
    setFlash(req, 'error', 'Unable to save display settings.');
    res.redirect(`/dashboard/display-settings?section=${encodeURIComponent(section)}`);
  }
}));

router.get('/dashboard/theme', requireAuth, route(async (req, res) => {
  const db = req.db;
  const store = req.currentStore;
  const currentId = store.template;
  const templatesHtml = db.templates.map((template) => {
    const isActive = currentId === template.id;
    const badge = template.layout === 'bold' ? 'Business' : template.layout === 'minimal' ? 'Basic' : 'Business';
    return `<article class="osa-card osa-theme-card ${isActive ? 'active' : ''}">${isActive ? '<div class="osa-theme-check">âœ“</div>' : ''}<div class="osa-theme-media"><iframe class="osa-theme-iframe" src="/dashboard/theme/preview/${escapeHtml(template.id)}" title="${escapeHtml(template.name)} preview" loading="lazy"></iframe></div><div><h3>${escapeHtml(template.name)}</h3><p>${escapeHtml(template.description || '')}</p></div><div class="osa-theme-meta"><span class="osa-chip">${escapeHtml(badge)}</span><div class="osa-actions" style="margin-top:0;">${isActive ? '<span class="osa-btn secondary" style="cursor:default;">Selected</span>' : `<form method="POST" action="/dashboard/theme/update"><input type="hidden" name="template" value="${escapeHtml(template.id)}"><button class="osa-btn" type="submit">Apply</button></form>`}<a class="osa-btn secondary" href="/dashboard/theme/preview/${escapeHtml(template.id)}" target="_blank" rel="noopener noreferrer">Preview</a></div></div></article>`;
  }).join('');
  res.send(renderAdminLayout(req, 'Themes', 'theme', `
    <div class="osa-page-head">
      <div>
        <h1>Themes</h1>
        <p>Pick the storefront style first, then fine-tune every section from Display Settings. Preview each theme before applying it.</p>
      </div>
      <div class="osa-actions" style="margin-top:0;"><a class="osa-btn secondary" href="/dashboard/display-settings">Open display settings</a><a class="osa-btn" href="/dashboard/theme/preview/${escapeHtml(currentId)}" target="_blank" rel="noopener noreferrer">Preview current theme</a></div>
    </div>

    <section class="osa-card osa-page-card">
      <div class="osa-theme-grid">${templatesHtml}</div>
    </section>

    <section class="osa-card osa-page-card">
      <div class="osa-form-head"><h2>Live preview</h2><p>Check the exact storefront output with your current store data.</p></div>
      <div class="osa-iframe-wrap" style="margin-top:18px;"><div class="osa-iframe-bar"><span></span><span></span><span></span><b>/${escapeHtml(store.slug)}</b></div><iframe class="osa-iframe" src="/store/${encodeURIComponent(store.slug)}"></iframe></div>
    </section>
  `, storeAdminPanelStyles));
}));

router.get('/dashboard/theme/preview/:id', requireAuth, route(async (req, res) => {
  const db = await loadDB();
  const user = db.users[req.session.userId];
  const store = db.stores[user.storeSlug];
  if (!store) { res.status(404).send(renderGlobalError('Not Found', 'Store not found.', 404)); return; }
  const templateId = String(req.params.id || '').trim();
  const template = (db.templates || []).find((t) => t.id === templateId) || DEFAULT_TEMPLATES[0];
  const cfg = store.themeConfig || {};
  const cart = getStoreCart(req, store.slug);
  const wishlist = getStoreWishlist(req, store.slug);
  const categories = Array.isArray(store.categories) ? store.categories : [];
  const cartCount = cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const customer = await getLoggedCustomer(req, store.slug);
  const isDark = store.theme === 'dark';
  const themeCSS = getThemeCSS(template, store.theme, cfg);
  const storeContent = renderStoreByTheme(template, store, store.slug, {
    products: store.products, categories, cartCount, wishlistCount: wishlist.length, wishlist, search: '', selectedCategory: '', currentTemplate: template, customer, cfg, isDark
  });
  res.send(renderHtmlShell(`${store.name} - Preview (${template.name})`, `<div class="store-page"><div class="store-wrap">${storeContent}</div></div>`, { extraStyles: themeCSS }));
}));

router.post('/dashboard/theme/update', requireAuth, route(async (req, res) => {
  try {
    const templateId = String(req.body.template || '').trim();
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    if (!['app-style', 'minimal', 'bold-fashion', 'minto-fresh', 'aerion-modern', 'nestly-home', 'nudist-style', 'fresh-grid'].includes(templateId)) {
      setFlash(req, 'error', 'Invalid template selected.');
      res.redirect('/dashboard/theme');
      return;
    }
    store.template = templateId;
    await saveDB(db);
    setFlash(req, 'success', 'Theme applied successfully.');
    res.redirect('/dashboard/theme');
  } catch (error) {
    setFlash(req, 'error', 'Unable to apply theme.');
    res.redirect('/dashboard/theme');
  }
}));

router.post('/dashboard/theme/customize', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.themeConfig = store.themeConfig || {};
    const pick = (key, fallback) => {
      const val = String(req.body[key] || '').trim();
      return val || fallback || '';
    };
    store.themeConfig.primaryColor = pick('primaryColorText', store.themeConfig.primaryColor);
    store.themeConfig.secondaryColor = pick('secondaryColorText', store.themeConfig.secondaryColor);
    store.themeConfig.btnColor = pick('btnColorText', store.themeConfig.btnColor);
    store.themeConfig.bgColor = pick('bgColorText', store.themeConfig.bgColor);
    store.themeConfig.headingFont = pick('headingFont', '');
    store.themeConfig.bodyFont = pick('bodyFont', '');
    store.themeConfig.borderRadius = pick('borderRadius', 'rounded');
    store.themeConfig.btnStyle = pick('btnStyle', 'pill');
    store.themeConfig.categoryStyle = pick('categoryStyle', 'circle');
    store.themeConfig.headerLayout = pick('headerLayout', 'search');
    store.themeConfig.bottomNavStyle = pick('bottomNavStyle', 'classic');
    store.themeConfig.productCardStyle = pick('productCardStyle', 'style-2');
    store.themeConfig.headerSticky = req.body.headerSticky !== 'false';
    store.themeConfig.showSearch = req.body.showSearch !== 'false';
    store.themeConfig.showDiscount = req.body.showDiscount !== 'false';
    store.themeConfig.bannerTitle = pick('bannerTitle', '');
    store.themeConfig.bannerSubtitle = pick('bannerSubtitle', '');
    store.themeConfig.bannerCta = pick('bannerCta', '');
    store.themeConfig.topBarText = pick('topBarText', '');
    store.themeConfig.topBarMarquee = req.body.topBarMarquee !== 'false';
    store.themeConfig.topBarBg = pick('topBarBgText', store.themeConfig.topBarBg);
    store.themeConfig.topBarColor = pick('topBarColorText', store.themeConfig.topBarColor);
    store.themeConfig.categoryLayout = pick('categoryLayout', 'auto');
    await saveDB(db);
    setFlash(req, 'success', 'Theme customization saved!');
    res.redirect('/dashboard/display-settings?section=color-font');
  } catch (error) {
    setFlash(req, 'error', 'Unable to save customization.');
    res.redirect('/dashboard/display-settings?section=color-font');
  }
}));

router.post('/dashboard/theme/banner/add', requireAuth, route(async (req, res) => {
  try {
    const returnTo = getDashboardReturnTo(req, '/dashboard/display-settings?section=banner');
    await runUploader(upload.single('image'), req, res);
    if (!req.file) { setFlash(req, 'error', 'Please choose an image.'); res.redirect(returnTo); return; }
    if (req.file.size > 5 * 1024 * 1024) { setFlash(req, 'error', 'Image must be 5MB or less.'); res.redirect(returnTo); return; }
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.themeConfig = store.themeConfig || {};
    store.themeConfig.bannerImages = Array.isArray(store.themeConfig.bannerImages) ? store.themeConfig.bannerImages : [];
    if (store.themeConfig.bannerImages.length >= 5) { setFlash(req, 'error', 'Maximum 5 desktop banners allowed.'); res.redirect(returnTo); return; }
    const imagePath = await saveUploadedFile(req.file, 'banner');
    store.themeConfig.bannerImages.push(imagePath);
    await saveDB(db);
    setFlash(req, 'success', 'Desktop banner added!');
    res.redirect(returnTo);
  } catch (error) {
    setFlash(req, 'error', error.message || 'Unable to add banner.');
    res.redirect(getDashboardReturnTo(req, '/dashboard/display-settings?section=banner'));
  }
}));

router.post('/dashboard/theme/banner/mobile/add', requireAuth, route(async (req, res) => {
  try {
    const returnTo = getDashboardReturnTo(req, '/dashboard/display-settings?section=banner');
    await runUploader(upload.single('image'), req, res);
    if (!req.file) { setFlash(req, 'error', 'Please choose an image.'); res.redirect(returnTo); return; }
    if (req.file.size > 5 * 1024 * 1024) { setFlash(req, 'error', 'Image must be 5MB or less.'); res.redirect(returnTo); return; }
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.themeConfig = store.themeConfig || {};
    store.themeConfig.bannerImagesMobile = Array.isArray(store.themeConfig.bannerImagesMobile) ? store.themeConfig.bannerImagesMobile : [];
    if (store.themeConfig.bannerImagesMobile.length >= 5) { setFlash(req, 'error', 'Maximum 5 mobile banners allowed.'); res.redirect(returnTo); return; }
    const imagePath = await saveUploadedFile(req.file, 'banner');
    store.themeConfig.bannerImagesMobile.push(imagePath);
    await saveDB(db);
    setFlash(req, 'success', 'Mobile banner added!');
    res.redirect(returnTo);
  } catch (error) {
    setFlash(req, 'error', error.message || 'Unable to add banner.');
    res.redirect(getDashboardReturnTo(req, '/dashboard/display-settings?section=banner'));
  }
}));

router.post('/dashboard/theme/banner/delete/:index', requireAuth, route(async (req, res) => {
  try {
    const returnTo = getDashboardReturnTo(req, '/dashboard/display-settings?section=banner');
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    const index = Number(req.params.index);
    store.themeConfig = store.themeConfig || {};
    store.themeConfig.bannerImages = Array.isArray(store.themeConfig.bannerImages) ? store.themeConfig.bannerImages : [];
    if (index >= 0 && index < store.themeConfig.bannerImages.length) {
      await removeStoredFile(store.themeConfig.bannerImages[index]);
      store.themeConfig.bannerImages.splice(index, 1);
      await saveDB(db);
      setFlash(req, 'success', 'Desktop banner removed.');
    }
    res.redirect(returnTo);
  } catch (error) {
    setFlash(req, 'error', 'Unable to remove banner.');
    res.redirect(getDashboardReturnTo(req, '/dashboard/display-settings?section=banner'));
  }
}));

router.post('/dashboard/theme/banner/mobile/delete/:index', requireAuth, route(async (req, res) => {
  try {
    const returnTo = getDashboardReturnTo(req, '/dashboard/display-settings?section=banner');
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    const index = Number(req.params.index);
    store.themeConfig = store.themeConfig || {};
    store.themeConfig.bannerImagesMobile = Array.isArray(store.themeConfig.bannerImagesMobile) ? store.themeConfig.bannerImagesMobile : [];
    if (index >= 0 && index < store.themeConfig.bannerImagesMobile.length) {
      await removeStoredFile(store.themeConfig.bannerImagesMobile[index]);
      store.themeConfig.bannerImagesMobile.splice(index, 1);
      await saveDB(db);
      setFlash(req, 'success', 'Mobile banner removed.');
    }
    res.redirect(returnTo);
  } catch (error) {
    setFlash(req, 'error', 'Unable to remove banner.');
    res.redirect(getDashboardReturnTo(req, '/dashboard/display-settings?section=banner'));
  }
}));

router.get('/dashboard/customers', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const customers = getUniqueCustomers(store);
  const html = customers.length ? `
    <div class="table-wrap"><table><thead><tr><th>Customer</th><th>Phone</th><th>Orders</th><th>First seen</th></tr></thead><tbody>
      ${customers.map((customer) => `<tr><td>${escapeHtml(customer.name)}</td><td>${escapeHtml(customer.phone)}</td><td>${escapeHtml(String(customer.orders))}</td><td>${escapeHtml(formatDate(customer.firstSeen))}</td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">No customers yet.</div>';
  res.send(renderAdminLayout(req, 'Customers', 'customers', `
    <section class="card panel">
      <div class="section-head"><div><h1 class="section-title">Customers</h1><p class="section-subtitle">All customer leads captured from WhatsApp buys.</p></div><span class="badge badge-live">${escapeHtml(String(customers.length))} total</span></div>
      ${html}
    </section>
  `));
}));

router.get('/dashboard/collections', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const collections = Array.isArray(store.collections) ? store.collections : [];
  const html = collections.length ? `
    <div class="table-wrap"><table><thead><tr><th>Collection</th><th>Description</th><th>Delete</th></tr></thead><tbody>
      ${collections.map((collection, index) => `<tr><td>${escapeHtml(collection.name)}</td><td>${escapeHtml(collection.description || '')}</td><td><form method="POST" action="/dashboard/collections/delete/${index}" onsubmit="return confirm('Delete collection?');"><button class="btn btn-danger" type="submit">Delete</button></form></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">No collections yet.</div>';
  res.send(renderAdminLayout(req, 'Collections', 'collections', `
    <section class="card panel">
      <div class="section-head"><div><h1 class="section-title">Collections</h1><p class="section-subtitle">Organize products into groups like Shopify collections.</p></div></div>
      <form method="POST" action="/dashboard/collections/add" class="form-grid" style="margin-bottom:18px;">
        <div class="form-grid two">
          <div class="field"><label for="name">Collection name</label><input id="name" name="name" required></div>
          <div class="field"><label for="description">Description</label><input id="description" name="description"></div>
        </div>
        <div class="actions"><button class="btn" type="submit">Add collection</button></div>
      </form>
      ${html}
    </section>
  `));
}));

router.post('/dashboard/collections/add', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    if (name.length < 2) { setFlash(req, 'error', 'Collection name is required.'); res.redirect('/dashboard/collections'); return; }
    store.collections = Array.isArray(store.collections) ? store.collections : [];
    store.collections.push({ id: generateId('col'), name, description, createdAt: new Date().toISOString() });
    await saveDB(db);
    setFlash(req, 'success', 'Collection added.');
    res.redirect('/dashboard/collections');
  } catch (error) {
    setFlash(req, 'error', 'Unable to add collection.');
    res.redirect('/dashboard/collections');
  }
}));

router.post('/dashboard/collections/delete/:index', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.collections = Array.isArray(store.collections) ? store.collections : [];
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= store.collections.length) { setFlash(req, 'error', 'Collection not found.'); res.redirect('/dashboard/collections'); return; }
    store.collections.splice(index, 1);
    await saveDB(db);
    setFlash(req, 'success', 'Collection deleted.');
    res.redirect('/dashboard/collections');
  } catch (error) {
    setFlash(req, 'error', 'Unable to delete collection.');
    res.redirect('/dashboard/collections');
  }
}));

router.get('/dashboard/media', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const images = [store.logo, ...store.products.map((product) => product.image)].filter(Boolean);
  const html = images.length ? `
    <div class="grid-3">
      ${images.map((src) => `<div class="card template-card"><img class="product-thumb" style="width:100%;height:180px;" src="${escapeHtml(src)}" alt="media"></div>`).join('')}
    </div>` : '<div class="empty">No media uploaded yet.</div>';
  res.send(renderAdminLayout(req, 'Media library', 'media', `
    <section class="card panel">
      <div class="section-head"><div><h1 class="section-title">Media library</h1><p class="section-subtitle">Uploaded logos and product images.</p></div></div>
      ${html}
    </section>
  `));
}));

router.get('/dashboard/discounts', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  store.discounts = Array.isArray(store.discounts) ? store.discounts : [];
  const html = store.discounts.length ? `
    <div class="table-wrap"><table><thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Status</th><th>Delete</th></tr></thead><tbody>
      ${store.discounts.map((discount, index) => `<tr><td>${escapeHtml(discount.code)}</td><td>${escapeHtml(discount.type)}</td><td>${escapeHtml(discount.value)}</td><td>${escapeHtml(discount.active ? 'Active' : 'Inactive')}</td><td><form method="POST" action="/dashboard/discounts/delete/${index}" onsubmit="return confirm('Delete discount?');"><button class="btn btn-danger" type="submit">Delete</button></form></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">No discounts created yet.</div>';
  res.send(renderAdminLayout(req, 'Discounts', 'discounts', `
    <section class="card panel">
      <div class="section-head"><div><h1 class="section-title">Discounts</h1><p class="section-subtitle">Create simple coupon codes for your store.</p></div></div>
      <form method="POST" action="/dashboard/discounts/add" class="form-grid" style="margin-bottom:18px;">
        <div class="form-grid two">
          <div class="field"><label for="code">Code</label><input id="code" name="code" required></div>
          <div class="field"><label for="value">Value</label><input id="value" name="value" required></div>
          <div class="field"><label for="type">Type</label><select id="type" name="type"><option value="percent">Percent</option><option value="flat">Flat</option></select></div>
          <div class="field"><label for="active">Status</label><select id="active" name="active"><option value="yes">Active</option><option value="no">Inactive</option></select></div>
        </div>
        <div class="actions"><button class="btn" type="submit">Add discount</button></div>
      </form>
      ${html}
    </section>
  `));
}));

router.post('/dashboard/discounts/add', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.discounts = Array.isArray(store.discounts) ? store.discounts : [];
    const code = String(req.body.code || '').trim().toUpperCase();
    const value = String(req.body.value || '').trim();
    const type = String(req.body.type || 'percent').trim();
    const active = String(req.body.active || 'yes') === 'yes';
    if (code.length < 3) { setFlash(req, 'error', 'Discount code is required.'); res.redirect('/dashboard/discounts'); return; }
    store.discounts.push({ id: generateId('disc'), code, value, type, active, createdAt: new Date().toISOString() });
    await saveDB(db);
    setFlash(req, 'success', 'Discount added.');
    res.redirect('/dashboard/discounts');
  } catch (error) {
    setFlash(req, 'error', 'Unable to add discount.');
    res.redirect('/dashboard/discounts');
  }
}));

router.post('/dashboard/discounts/delete/:index', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.discounts = Array.isArray(store.discounts) ? store.discounts : [];
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= store.discounts.length) { setFlash(req, 'error', 'Discount not found.'); res.redirect('/dashboard/discounts'); return; }
    store.discounts.splice(index, 1);
    await saveDB(db);
    setFlash(req, 'success', 'Discount deleted.');
    res.redirect('/dashboard/discounts');
  } catch (error) {
    setFlash(req, 'error', 'Unable to delete discount.');
    res.redirect('/dashboard/discounts');
  }
}));

router.get('/dashboard/shipping', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const shipping = store.shipping || { mode: 'flat', fee: '', notes: '' };
  res.send(renderAdminLayout(req, 'Shipping', 'shipping', `
    <section class="card panel">
      <div class="section-head"><div><h1 class="section-title">Shipping</h1><p class="section-subtitle">Set a basic shipping fee and notes for your store.</p></div></div>
      <form method="POST" action="/dashboard/shipping/update" class="form-grid">
        <div class="form-grid two">
          <div class="field"><label for="mode">Mode</label><select id="mode" name="mode"><option value="flat"${shipping.mode === 'flat' ? ' selected' : ''}>Flat</option><option value="free"${shipping.mode === 'free' ? ' selected' : ''}>Free</option></select></div>
          <div class="field"><label for="fee">Fee</label><input id="fee" name="fee" value="${escapeHtml(shipping.fee || '')}"></div>
        </div>
        <div class="field"><label for="notes">Notes</label><textarea id="notes" name="notes">${escapeHtml(shipping.notes || '')}</textarea></div>
        <div class="actions"><button class="btn" type="submit">Save shipping</button></div>
      </form>
    </section>
  `));
}));

router.post('/dashboard/shipping/update', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.shipping = { mode: String(req.body.mode || 'flat'), fee: String(req.body.fee || '').trim(), notes: String(req.body.notes || '').trim() };
    await saveDB(db);
    setFlash(req, 'success', 'Shipping settings saved.');
    res.redirect('/dashboard/shipping');
  } catch (error) {
    setFlash(req, 'error', 'Unable to save shipping settings.');
    res.redirect('/dashboard/shipping');
  }
}));

router.get('/dashboard/payments', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const payment = store.paymentSettings || { mode: 'whatsapp', notes: '' };
  res.send(renderAdminLayout(req, 'Payments', 'payments', `
    <section class="card panel">
      <div class="section-head"><div><h1 class="section-title">Payments</h1><p class="section-subtitle">WhatsApp lead flow is enabled by default.</p></div></div>
      <form method="POST" action="/dashboard/payments/update" class="form-grid">
        <div class="form-grid two">
          <div class="field"><label for="mode">Payment mode</label><select id="mode" name="mode"><option value="whatsapp"${payment.mode === 'whatsapp' ? ' selected' : ''}>WhatsApp</option><option value="manual"${payment.mode === 'manual' ? ' selected' : ''}>Manual</option></select></div>
          <div class="field"><label for="notes">Notes</label><input id="notes" name="notes" value="${escapeHtml(payment.notes || '')}"></div>
        </div>
        <div class="actions"><button class="btn" type="submit">Save payment setup</button></div>
      </form>
    </section>
  `));
}));

router.post('/dashboard/payments/update', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.paymentSettings = { mode: String(req.body.mode || 'whatsapp'), notes: String(req.body.notes || '').trim() };
    await saveDB(db);
    setFlash(req, 'success', 'Payment settings saved.');
    res.redirect('/dashboard/payments');
  } catch (error) {
    setFlash(req, 'error', 'Unable to save payment settings.');
    res.redirect('/dashboard/payments');
  }
}));

router.get('/dashboard/notifications', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const notifications = store.notifications || { newOrder: true, whatsappLead: true, lowStock: false, abandonedCart: false };
  res.send(renderAdminLayout(req, 'Notifications', 'notifications', `
    <section class="card panel">
      <div class="section-head"><div><h1 class="section-title">Notifications</h1><p class="section-subtitle">Control basic store notifications.</p></div></div>
      <form method="POST" action="/dashboard/notifications/update" class="form-grid">
        <div class="form-grid two">
          <div class="field"><label for="newOrder">New order alert</label><select id="newOrder" name="newOrder"><option value="yes"${notifications.newOrder ? ' selected' : ''}>Yes</option><option value="no"${!notifications.newOrder ? ' selected' : ''}>No</option></select></div>
          <div class="field"><label for="whatsappLead">WhatsApp lead alert</label><select id="whatsappLead" name="whatsappLead"><option value="yes"${notifications.whatsappLead ? ' selected' : ''}>Yes</option><option value="no"${!notifications.whatsappLead ? ' selected' : ''}>No</option></select></div>
          <div class="field"><label for="lowStock">Low stock alert</label><select id="lowStock" name="lowStock"><option value="yes"${notifications.lowStock ? ' selected' : ''}>Yes</option><option value="no"${!notifications.lowStock ? ' selected' : ''}>No</option></select></div>
          <div class="field"><label for="abandonedCart">Abandoned cart alert</label><select id="abandonedCart" name="abandonedCart"><option value="yes"${notifications.abandonedCart ? ' selected' : ''}>Yes</option><option value="no"${!notifications.abandonedCart ? ' selected' : ''}>No</option></select></div>
        </div>
        <div class="actions"><button class="btn" type="submit">Save notifications</button></div>
      </form>
    </section>
  `));
}));

router.post('/dashboard/notifications/update', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.notifications = {
      newOrder: String(req.body.newOrder || 'yes') === 'yes',
      whatsappLead: String(req.body.whatsappLead || 'yes') === 'yes',
      lowStock: String(req.body.lowStock || 'no') === 'yes',
      abandonedCart: String(req.body.abandonedCart || 'no') === 'yes'
    };
    await saveDB(db);
    setFlash(req, 'success', 'Notifications saved.');
    res.redirect('/dashboard/notifications');
  } catch (error) {
    setFlash(req, 'error', 'Unable to save notifications.');
    res.redirect('/dashboard/notifications');
  }
}));

router.get('/dashboard/abandoned-carts', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const abandoned = Array.isArray(store.abandonedCarts) ? store.abandonedCarts : [];
  const html = abandoned.length ? `
    <div class="table-wrap"><table><thead><tr>
      <th>Session</th><th>Items</th><th>Started At</th><th>Customer</th>
    </tr></thead><tbody>
    ${abandoned.map((cart) => `<tr>
      <td>${escapeHtml(cart.sessionId ? cart.sessionId.slice(0, 8) + '...' : '-')}</td>
      <td>${escapeHtml(String(Array.isArray(cart.cart) ? cart.cart.length : 0))} items</td>
      <td>${escapeHtml(formatDate(cart.startedAt))}</td>
      <td>${escapeHtml(cart.customerName || 'Anonymous')}</td>
    </tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">No abandoned carts tracked yet.</div>';
  res.send(renderAdminLayout(req, 'Abandoned carts', 'abandoned', `
    <section class="card panel">
      <div class="section-head"><div>
        <h1 class="section-title">Abandoned carts</h1>
        <p class="section-subtitle">Customers who started checkout but did not complete the order.</p>
      </div><span class="badge badge-pending">${escapeHtml(String(abandoned.length))} total</span></div>
      ${html}
    </section>
  `));
}));

router.get('/dashboard/categories', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  store.categories = Array.isArray(store.categories) ? store.categories : [];
  const cards = store.categories.length ? store.categories.map((category) => `
    <div class="card template-card">
      ${category.image ? `<div class="template-preview" style="background:url('${escapeHtml(category.image)}') center/cover no-repeat;"></div>` : '<div class="template-preview" style="background: linear-gradient(135deg, #e2e8f0, #cbd5e1); display:grid; place-items:center; color:#94a3b8; font-size:13px;">No image</div>'}
      <h3 style="margin-top:10px;">${escapeHtml(category.name)}</h3>
      <p class="muted">${escapeHtml(category.description || 'Category')}</p>
      <div class="actions" style="margin-top:8px;">
        <form method="POST" action="/dashboard/categories/delete/${encodeURIComponent(category.id)}" onsubmit="return confirm('Delete this category?');"><button class="btn btn-danger" type="submit" style="min-height:34px;padding:8px 12px;font-size:12px;">Delete</button></form>
      </div>
    </div>
  `).join('') : '<div class="empty">No categories yet.</div>';
  res.send(renderAdminLayout(req, 'Categories', 'categories', `
    <div class="title-row"><div><h1 class="page-title">Categories</h1><p class="page-subtitle">Manage categories with images. They auto-arrange on your store.</p></div></div>
    <section class="card panel" id="add">
      <h2 class="section-title" style="font-size:18px;margin:0 0 12px;">Add Category</h2>
      <form method="POST" action="/dashboard/categories/add" enctype="multipart/form-data" class="form-grid">
        <div class="form-grid two">
          <div class="field"><label for="name">Category name</label><input id="name" name="name" required></div>
          <div class="field"><label for="description">Description</label><input id="description" name="description"></div>
        </div>
        <div class="field"><label>Category Image (optional)</label><input type="file" name="image" accept=".jpg,.jpeg,.png,.webp,image/*"><span class="muted" style="font-size:12px;">Square image recommended (1:1). Shows on store category section.</span></div>
        <div class="actions"><button class="btn" type="submit">Add Category</button></div>
      </form>
    </section>
    <h2 class="section-title" style="font-size:18px;">All Categories (${escapeHtml(String(store.categories.length))})</h2>
    <div class="grid-3">${cards}</div>
  `));
}));

router.post('/dashboard/categories/add', requireAuth, route(async (req, res) => {
  try {
    await runUploader(upload.single('image'), req, res);
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.categories = Array.isArray(store.categories) ? store.categories : [];
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    if (name.length < 2) { setFlash(req, 'error', 'Category name is required.'); res.redirect('/dashboard/categories'); return; }
    const imagePath = req.file ? await saveUploadedFile(req.file, 'category') : '';
    store.categories.push({ id: generateId('cat'), name, description, image: imagePath, createdAt: new Date().toISOString() });
    await saveDB(db);
    setFlash(req, 'success', 'Category added.');
    res.redirect('/dashboard/categories');
  } catch (error) {
    setFlash(req, 'error', 'Unable to add category.');
    res.redirect('/dashboard/categories');
  }
}));

router.post('/dashboard/categories/delete/:id', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.categories = Array.isArray(store.categories) ? store.categories : [];
    const index = store.categories.findIndex((c) => c.id === req.params.id);
    if (index >= 0) {
      if (store.categories[index].image) await removeStoredFile(store.categories[index].image);
      store.categories.splice(index, 1);
      await saveDB(db);
      setFlash(req, 'success', 'Category deleted.');
    }
    res.redirect('/dashboard/categories');
  } catch (error) {
    setFlash(req, 'error', 'Unable to delete category.');
    res.redirect('/dashboard/categories');
  }
}));

router.get('/dashboard/bulk-upload', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const productsUsed = store.products.length;
  res.send(renderAdminLayout(req, 'Bulk Upload', 'bulk-upload', `
    <div class="title-row"><div><h1 class="page-title">Import Products (CSV)</h1><p class="page-subtitle">Upload a CSV file and products will appear on your store automatically.</p></div></div>
    <div class="grid-2">
      <section class="card panel">
        <h2 class="section-title" style="font-size:18px;margin:0 0 6px;">ðŸ“¥ Import Products</h2>
        <p class="muted" style="font-size:13px;margin:0 0 16px;">Upload a CSV file with columns: <strong>name, price, description, stock</strong></p>
        <form method="POST" action="/dashboard/bulk-upload/import" enctype="multipart/form-data" class="form-grid">
          <div class="field"><label for="csv">Choose CSV File</label><input id="csv" name="csv" type="file" accept=".csv,text/csv" required></div>
          <div class="actions"><button class="btn" type="submit">Import Products</button></div>
        </form>
        <div style="margin-top:16px;padding:14px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;">
          <strong style="font-size:13px;">CSV Format Example:</strong>
          <pre style="margin:8px 0 0;font-size:12px;overflow-x:auto;">name,price,description,stock
Red T-Shirt,499,Cotton round neck,50
Blue Jeans,999,Slim fit denim,30</pre>
        </div>
      </section>
      <section class="card panel">
        <h2 class="section-title" style="font-size:18px;margin:0 0 6px;">ðŸ“¤ Export & Template</h2>
        <p class="muted" style="font-size:13px;margin:0 0 16px;">Download existing products or get a blank template.</p>
        <div class="form-grid">
          <a class="btn" href="/dashboard/bulk-upload/export" style="text-align:center;">Download Export (CSV)</a>
          <a class="btn btn-secondary" href="/dashboard/bulk-upload/template" style="text-align:center;">Download Blank Template</a>
        </div>
        <div style="margin-top:16px;padding:14px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;">
          <strong style="font-size:13px;">Current Products:</strong>
          <div style="font-size:28px;font-weight:900;margin-top:6px;">${escapeHtml(String(productsUsed))}</div>
        </div>
      </section>
    </div>
  `));
}));

router.get('/dashboard/bulk-upload/template', requireAuth, route(async (req, res) => {
  const csv = 'name,price,comparePrice,description,stock,image,sku,category,active\nSample Product,499,799,Demo description,10,https://example.com/sample.webp,SKU-001,General,true\n';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="products-template.csv"');
  res.send(csv);
}));

router.get('/dashboard/bulk-upload/export', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const rows = ['name,price,comparePrice,description,stock,image,sku,category,active'];
  store.products.forEach((product) => {
    rows.push([product.name, product.price, product.comparePrice || product.mrp || '', product.description, product.stock, product.image || '', product.sku || '', product.category || '', product.active !== false].map((v) => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="products-export.csv"');
  res.send(rows.join('\n'));
}));

router.post('/dashboard/bulk-upload/import', requireAuth, route(async (req, res) => {
  try {
    await runUploader(csvUpload.single('csv'), req, res);
    if (!req.file) { setFlash(req, 'error', 'CSV file required.'); res.redirect('/dashboard/bulk-upload'); return; }
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    let text = req.file.buffer.toString('utf8').trim();
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) { setFlash(req, 'error', 'CSV must include a header row and at least one data row.'); res.redirect('/dashboard/bulk-upload'); return; }
    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"') {
            if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
            else { inQuotes = false; }
          } else { current += ch; }
        } else {
          if (ch === '"') { inQuotes = true; }
          else if (ch === ',') { result.push(current); current = ''; }
          else { current += ch; }
        }
      }
      result.push(current);
      return result;
    };
    const headers = parseCSVLine(lines.shift()).map((s) => s.trim().toLowerCase());
    let imported = 0;
    lines.forEach((line) => {
      if (!line.trim()) return;
      const cells = parseCSVLine(line);
      const row = {};
      headers.forEach((header, index) => { row[header] = (cells[index] || '').trim(); });
      if ((row.name || '').trim()) {
        const imageUrl = String(row.image || row.images || row.image_url || row.imageurl || '').trim();
          store.products.push({
            id: generateId('p'),
            name: row.name.trim(),
            price: parsePrice(row.price || '0'),
            comparePrice: parsePrice(row.compareprice || row.compare_price || '0'),
            mrp: parsePrice(row.compareprice || row.compare_price || row.price || '0'),
            description: String(row.description || '').trim(),
            image: imageUrl,
            images: imageUrl ? [imageUrl] : [],
            stock: Math.max(0, parseInt(String(row.stock || '0').replace(/[^0-9]/g, '').trim(), 10) || 0),
            sku: String(row.sku || '').trim(),
            category: String(row.category || '').trim(),
            variants: [],
            reviews: [],
            active: String(row.active || 'true').trim().toLowerCase() !== 'false',
            createdAt: new Date().toISOString(),
            updatedAt: ''
        });
        imported++;
      }
    });
    await saveDB(db);
    setFlash(req, 'success', `Imported ${imported} products successfully.`);
    res.redirect('/dashboard/bulk-upload');
  } catch (error) {
    setFlash(req, 'error', error.message || 'Unable to import CSV.');
    res.redirect('/dashboard/bulk-upload');
  }
}));

router.get('/dashboard/leads', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const leads = store.orders.filter((order) => order.customerName === 'WhatsApp lead' || !order.customerPhone);
  const html = leads.length ? `
    <div class="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Product</th><th>Status</th><th>Date</th></tr></thead><tbody>
      ${leads.map((lead) => `<tr><td>${escapeHtml(lead.customerName || 'Lead')}</td><td>${escapeHtml(lead.customerPhone || '-')}</td><td>${escapeHtml(lead.productName)}</td><td>${getStatusBadge(lead.status)}</td><td>${escapeHtml(formatDate(lead.createdAt))}</td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">No leads yet.</div>';
  res.send(renderAdminLayout(req, 'Leads', 'leads', `
    <section class="card panel">
      <div class="title-row"><div><h1 class="page-title">Customer Leads</h1><p class="page-subtitle">People who ordered via WhatsApp</p></div></div>
      ${html}
    </section>
  `));
}));

router.get('/dashboard/coupons', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  store.discounts = Array.isArray(store.discounts) ? store.discounts : [];
  const html = store.discounts.length ? `
    <div class="table-wrap"><table><thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Status</th><th>Delete</th></tr></thead><tbody>
      ${store.discounts.map((discount, index) => `<tr><td>${escapeHtml(discount.code)}</td><td>${escapeHtml(discount.type)}</td><td>${escapeHtml(discount.value)}</td><td>${escapeHtml(discount.active ? 'Active' : 'Inactive')}</td><td><form method="POST" action="/dashboard/discounts/delete/${index}" onsubmit="return confirm('Delete coupon?');"><button class="btn btn-danger" type="submit">Delete</button></form></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">No coupons yet.</div>';
  res.send(renderAdminLayout(req, 'Coupons', 'coupons', `
    <div class="title-row"><div><h1 class="page-title">Coupons</h1><p class="page-subtitle">Create and manage discount coupons</p></div><a class="btn btn-secondary" href="/dashboard/coupons#add">Create Coupon</a></div>
    <section class="card panel" id="add">
      <form method="POST" action="/dashboard/discounts/add" class="form-grid">
        <div class="form-grid two">
          <div class="field"><label for="code">Code</label><input id="code" name="code" required></div>
          <div class="field"><label for="value">Value</label><input id="value" name="value" required></div>
          <div class="field"><label for="type">Type</label><select id="type" name="type"><option value="percent">Percent</option><option value="flat">Flat</option></select></div>
          <div class="field"><label for="active">Status</label><select id="active" name="active"><option value="yes">Active</option><option value="no">Inactive</option></select></div>
        </div>
        <div class="actions"><button class="btn" type="submit">Create Coupon</button></div>
      </form>
    </section>
    <section class="card panel">${html}</section>
  `));
}));

router.get('/dashboard/tax', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const tax = store.taxSettings || { enabled: false, name: 'GST', rate: '', inclusive: false };
  res.send(renderAdminLayout(req, 'Tax / GST', 'tax', `
    <section class="card panel">
      <div class="title-row"><div><h1 class="page-title">Tax / GST Settings</h1><p class="page-subtitle">Configure tax for your store orders</p></div></div>
      <form method="POST" action="/dashboard/tax/update" class="form-grid">
        <div class="field"><label for="enabled">Enable Tax</label><select id="enabled" name="enabled"><option value="yes"${tax.enabled ? ' selected' : ''}>Yes</option><option value="no"${!tax.enabled ? ' selected' : ''}>No</option></select></div>
        <div class="form-grid two">
          <div class="field"><label for="name">Tax Name</label><input id="name" name="name" value="${escapeHtml(tax.name || 'GST')}"></div>
          <div class="field"><label for="rate">Tax Rate (%)</label><input id="rate" name="rate" value="${escapeHtml(tax.rate || '0')}"></div>
        </div>
        <div class="field"><label for="inclusive">Prices are tax-inclusive</label><select id="inclusive" name="inclusive"><option value="yes"${tax.inclusive ? ' selected' : ''}>Yes</option><option value="no"${!tax.inclusive ? ' selected' : ''}>No</option></select></div>
        <div class="actions"><button class="btn" type="submit">Save Tax Settings</button></div>
      </form>
    </section>
  `));
}));

router.post('/dashboard/tax/update', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.taxSettings = { enabled: String(req.body.enabled || 'no') === 'yes', name: String(req.body.name || 'GST').trim(), rate: String(req.body.rate || '0').trim(), inclusive: String(req.body.inclusive || 'no') === 'yes' };
    await saveDB(db);
    setFlash(req, 'success', 'Tax settings saved.');
    res.redirect('/dashboard/tax');
  } catch (error) {
    setFlash(req, 'error', 'Unable to save tax settings.');
    res.redirect('/dashboard/tax');
  }
}));

router.get('/dashboard/whatsapp-marketing', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const marketing = store.whatsappMarketing || { welcome: '', recovery: '', promo: '' };
  const customers = Object.values(store.customers || {});
  const waLinks = customers.slice(0, 50).map((customer) => {
    if (!customer || !customer.phone) return '';
    const phone = String(customer.phone).replace(/\D/g, '');
    if (!phone) return '';
    const msg = encodeURIComponent(marketing.promo || `Hi ${customer.name || 'there'}, check out our latest offers at your favorite store!`);
    return `<a href="https://wa.me/${phone}?text=${msg}" target="_blank" rel="noopener" style="display:block;padding:8px;border-radius:8px;background:#25D366;color:white;text-align:center;margin-bottom:6px;font-size:13px;">Send to ${escapeHtml(customer.name || 'Customer')} (${escapeHtml(customer.phone)})</a>`;
  }).filter(Boolean).join('');
  res.send(renderAdminLayout(req, 'WhatsApp Marketing', 'whatsapp-marketing', `
    <section class="card panel">
      <div class="title-row"><div><h1 class="page-title">WhatsApp Marketing</h1><p class="page-subtitle">Create message templates for leads and promotions</p></div></div>
      <form method="POST" action="/dashboard/whatsapp-marketing/update" class="form-grid">
        <div class="field"><label for="welcome">Welcome message</label><textarea id="welcome" name="welcome">${escapeHtml(marketing.welcome || '')}</textarea></div>
        <div class="field"><label for="recovery">Recovery message</label><textarea id="recovery" name="recovery">${escapeHtml(marketing.recovery || '')}</textarea></div>
        <div class="field"><label for="promo">Promo message</label><textarea id="promo" name="promo">${escapeHtml(marketing.promo || '')}</textarea></div>
        <div class="actions"><button class="btn" type="submit">Save Messages</button></div>
      </form>
    </section>
    <section class="card panel">
      <div class="title-row"><div><h2 class="section-title" style="font-size:20px;">Send promo via WhatsApp Web</h2><p class="section-subtitle">Quick launch links for up to 50 customers.</p></div></div>
      ${waLinks || '<div class="empty">No customer phone numbers found yet.</div>'}
    </section>
  `));
}));

router.post('/dashboard/whatsapp-marketing/update', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.whatsappMarketing = { welcome: String(req.body.welcome || '').trim(), recovery: String(req.body.recovery || '').trim(), promo: String(req.body.promo || '').trim() };
    await saveDB(db);
    setFlash(req, 'success', 'WhatsApp messages saved.');
    res.redirect('/dashboard/whatsapp-marketing');
  } catch (error) {
    setFlash(req, 'error', 'Unable to save WhatsApp marketing.');
    res.redirect('/dashboard/whatsapp-marketing');
  }
}));

router.get('/dashboard/tracking', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const tracking = store.tracking || { pixel: '', google: '' };
  res.send(renderAdminLayout(req, 'Tracking & Analytics', 'tracking', `
    <section class="card panel">
      <div class="title-row"><div><h1 class="page-title">Tracking & Analytics</h1><p class="page-subtitle">Add tracking codes for your store</p></div></div>
      <form method="POST" action="/dashboard/tracking/update" class="form-grid">
        <div class="field"><label for="pixel">Meta Pixel</label><input id="pixel" name="pixel" value="${escapeHtml(tracking.pixel || '')}"></div>
        <div class="field"><label for="google">Google Analytics</label><input id="google" name="google" value="${escapeHtml(tracking.google || '')}"></div>
        <div class="actions"><button class="btn" type="submit">Save Tracking</button></div>
      </form>
    </section>
  `));
}));

router.post('/dashboard/tracking/update', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.apps = normalizeStoreApps(store.apps);
    store.tracking = { pixel: String(req.body.pixel || '').trim(), google: String(req.body.google || '').trim() };
    store.apps.metaPixel.pixelId = store.tracking.pixel;
    store.apps.metaPixel.installed = !!store.tracking.pixel;
    store.apps.metaPixel.configured = !!store.tracking.pixel;
    store.apps.googleAnalytics.gaId = store.tracking.google;
    store.apps.googleAnalytics.installed = !!store.tracking.google;
    store.apps.googleAnalytics.configured = !!store.tracking.google;
    await saveDB(db);
    setFlash(req, 'success', 'Tracking settings saved.');
    res.redirect('/dashboard/tracking');
  } catch (error) {
    setFlash(req, 'error', 'Unable to save tracking settings.');
    res.redirect('/dashboard/tracking');
  }
}));

router.get('/dashboard/apps', requireAuth, route(async (req, res) => {
  const db = await loadDB();
  const store = db.stores[db.users[req.session.userId].storeSlug];
  store.apps = normalizeStoreApps(store.apps);
  const activeAppId = String(req.query.app || '').trim();
  const apps = getAppCatalog();
  const selectedApp = getAppDefinition(activeAppId) || apps[0];
  const selectedConfig = selectedApp ? store.apps[selectedApp.id] : null;
  const grouped = apps.reduce((acc, app) => {
    if (!acc[app.category]) acc[app.category] = [];
    acc[app.category].push(app);
    return acc;
  }, {});
  const catalogHtml = Object.entries(grouped).map(([category, items]) => `
    <section class="card panel">
      <div class="section-head"><div><h2 class="section-title" style="font-size:20px; margin:0;">${escapeHtml(category)}</h2><p class="section-subtitle">Install apps and connect external services to each merchant store.</p></div></div>
      <div class="option-grid">${items.map((app) => {
        const state = store.apps[app.id] || {};
        const installed = state.installed === true;
        const configured = state.configured === true;
        return `<article class="option-card ${selectedApp && selectedApp.id === app.id ? 'active' : ''}"><div class="option-card-preview">${escapeHtml(app.badge || 'APP')}</div><div class="option-card-title">${escapeHtml(app.name)}</div><div class="option-card-sub">${escapeHtml(app.description)}</div><div class="osa-actions" style="margin-top:12px;"><form method="POST" action="/dashboard/apps/toggle/${escapeHtml(app.id)}"><button class="osa-btn ${installed ? 'secondary' : ''}" type="submit">${installed ? 'Uninstall' : 'Install'}</button></form><a class="osa-btn secondary" href="/dashboard/apps?app=${encodeURIComponent(app.id)}">${configured ? 'Configure' : 'Setup'}</a></div><div style="margin-top:10px;font-size:12px;color:#64748b;">Status: <strong>${installed ? (configured ? 'Installed' : 'Installed · Setup needed') : 'Not installed'}</strong></div></article>`;
      }).join('')}</div>
    </section>`).join('');
  const configHtml = selectedApp ? `
    <section class="card panel">
      <div class="section-head"><div><h1 class="section-title">${escapeHtml(selectedApp.name)}</h1><p class="section-subtitle">${escapeHtml(selectedApp.description)}</p></div><span class="badge badge-${selectedConfig && selectedConfig.installed ? 'live' : 'pending'}">${escapeHtml(selectedConfig && selectedConfig.installed ? 'Installed' : 'Not installed')}</span></div>
      ${selectedConfig && selectedConfig.installed ? renderAppConfiguration(selectedApp.id, selectedConfig, store) : '<div class="empty">Install this app first to configure it.</div>'}
    </section>` : '';
  res.send(renderAdminLayout(req, 'App Store', 'apps', `${catalogHtml}${configHtml}`));
}));

router.post('/dashboard/apps/toggle/:id', requireAuth, route(async (req, res) => {
  const appId = String(req.params.id || '').trim();
  const appDefinition = getAppDefinition(appId);
  if (!appDefinition) { setFlash(req, 'error', 'App not found.'); res.redirect('/dashboard/apps'); return; }
  const db = await loadDB();
  const store = db.stores[db.users[req.session.userId].storeSlug];
  store.apps = normalizeStoreApps(store.apps);
  store.apps[appId].installed = !store.apps[appId].installed;
  if (!store.apps[appId].installed) {
    store.apps[appId].configured = false;
  }
  if (appId === 'metaPixel' && !store.apps[appId].installed) {
    store.tracking = store.tracking && typeof store.tracking === 'object' ? store.tracking : {};
    store.tracking.pixel = '';
  }
  if (appId === 'googleAnalytics' && !store.apps[appId].installed) {
    store.tracking = store.tracking && typeof store.tracking === 'object' ? store.tracking : {};
    store.tracking.google = '';
  }
  await saveDB(db);
  setFlash(req, 'success', `${appDefinition.name} ${store.apps[appId].installed ? 'installed' : 'uninstalled'}.`);
  res.redirect(`/dashboard/apps?app=${encodeURIComponent(appId)}`);
}));

router.post('/dashboard/apps/save/:id', requireAuth, route(async (req, res) => {
  const appId = String(req.params.id || '').trim();
  const appDefinition = getAppDefinition(appId);
  if (!appDefinition) { setFlash(req, 'error', 'App not found.'); res.redirect('/dashboard/apps'); return; }
  const db = await loadDB();
  const store = db.stores[db.users[req.session.userId].storeSlug];
  store.apps = normalizeStoreApps(store.apps);
  if (!store.apps[appId].installed) store.apps[appId].installed = true;
  const target = Object.assign({}, store.apps[appId]);
  Object.keys(req.body || {}).forEach((key) => {
    target[key] = String(req.body[key] || '').trim();
  });
  if (appId === 'smtp') {
    target.port = Number(req.body.port || 587) || 587;
    target.secure = String(req.body.secure || 'no') === 'yes';
  }
  if (appId === 'salesPopup') {
    target.enabled = String(req.body.enabled || 'no') === 'yes';
    target.showHome = String(req.body.showHome || 'yes') === 'yes';
    target.showProduct = String(req.body.showProduct || 'yes') === 'yes';
    target.intervalSeconds = Math.max(4, Math.min(30, Number(req.body.intervalSeconds || 8) || 8));
  }
  if (appId === 'fast2sms') {
    target.expiryMinutes = Math.max(1, Math.min(30, Number(req.body.expiryMinutes || 10) || 10));
  }
  target.configured = appConfigured(appId, target);
  store.apps[appId] = target;
  if (appId === 'metaPixel') {
    store.tracking = store.tracking && typeof store.tracking === 'object' ? store.tracking : {};
    store.tracking.pixel = target.pixelId || '';
  }
  if (appId === 'googleAnalytics') {
    store.tracking = store.tracking && typeof store.tracking === 'object' ? store.tracking : {};
    store.tracking.google = target.gaId || '';
  }
  await saveDB(db);
  setFlash(req, 'success', `${appDefinition.name} configuration saved.`);
  res.redirect(`/dashboard/apps?app=${encodeURIComponent(appId)}`);
}));

router.get('/dashboard/pages', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  store.pages = Array.isArray(store.pages) ? store.pages : [];
  const rows = store.pages.length ? `
    <div class="table-wrap"><table><thead><tr><th>Page</th><th>Slug</th><th>Status</th><th>Delete</th></tr></thead><tbody>
      ${store.pages.map((page, index) => `<tr><td>${escapeHtml(page.title)}</td><td>${escapeHtml(page.slug)}</td><td>${escapeHtml(page.active ? 'Published' : 'Draft')}</td><td><form method="POST" action="/dashboard/pages/delete/${index}" onsubmit="return confirm('Delete page?');"><button class="btn btn-danger" type="submit">Delete</button></form></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">No pages yet.</div>';
  res.send(renderAdminLayout(req, 'Store Pages', 'pages', `
    <div class="osa-page-head">
      <div>
        <h1>Store Pages</h1>
        <p>Create simple extra pages like About Us, Contact, Shipping Policy, or Return Policy.</p>
      </div>
    </div>
    <section class="osa-card osa-page-card">
      <form method="POST" action="/dashboard/pages/add" class="osa-form-grid" style="margin-bottom:18px;">
        <div class="osa-form-grid two">
          <div class="osa-field"><label for="title">Page title</label><input id="title" name="title" required></div>
          <div class="osa-field"><label for="slug">Page slug</label><input id="slug" name="slug" required></div>
          <div class="osa-field"><label for="content">Content</label><textarea id="content" name="content"></textarea></div>
          <div class="osa-field"><label for="active">Publish</label><select id="active" name="active"><option value="yes">Yes</option><option value="no">No</option></select></div>
        </div>
        <div class="osa-actions"><button class="osa-btn" type="submit">Add page</button></div>
      </form>
      ${rows}
    </section>
  `, storeAdminPanelStyles));
}));

router.post('/dashboard/pages/add', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.pages = Array.isArray(store.pages) ? store.pages : [];
    const title = String(req.body.title || '').trim();
    const slug = slugify(String(req.body.slug || '').trim()) || generateId('page');
    const content = String(req.body.content || '').trim();
    const active = String(req.body.active || 'yes') === 'yes';
    if (title.length < 2) { setFlash(req, 'error', 'Page title required.'); res.redirect('/dashboard/pages'); return; }
    store.pages.push({ id: generateId('page'), title, slug, content, active, createdAt: new Date().toISOString() });
    await saveDB(db);
    setFlash(req, 'success', 'Page added.');
    res.redirect('/dashboard/pages');
  } catch (error) {
    setFlash(req, 'error', 'Unable to add page.');
    res.redirect('/dashboard/pages');
  }
}));

router.post('/dashboard/pages/delete/:index', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.pages = Array.isArray(store.pages) ? store.pages : [];
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= store.pages.length) { setFlash(req, 'error', 'Page not found.'); res.redirect('/dashboard/pages'); return; }
    store.pages.splice(index, 1);
    await saveDB(db);
    setFlash(req, 'success', 'Page deleted.');
    res.redirect('/dashboard/pages');
  } catch (error) {
    setFlash(req, 'error', 'Unable to delete page.');
    res.redirect('/dashboard/pages');
  }
}));

router.get('/dashboard/domain', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  store.domain = store.domain || { customDomain: '', subdomain: '' };
  res.send(renderAdminLayout(req, 'Domain', 'domain', `
    <section class="card panel">
      <div class="title-row"><div><h1 class="page-title">Domain</h1><p class="page-subtitle">Connect your own domain and we will redirect its homepage to your canonical /store URL.</p></div></div>
      <form method="POST" action="/dashboard/domain/update" class="form-grid">
        <div class="field"><label for="customDomain">Custom domain</label><input id="customDomain" name="customDomain" value="${escapeHtml(store.domain.customDomain || '')}"></div>
        <div class="field"><label for="subdomain">Subdomain</label><input id="subdomain" name="subdomain" value="${escapeHtml(store.domain.subdomain || '')}"></div>
        <div class="actions"><button class="btn" type="submit">Save Domain</button></div>
      </form>
    </section>
  `));
}));

router.post('/dashboard/domain/update', requireAuth, route(async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.domain = { customDomain: String(req.body.customDomain || '').trim(), subdomain: String(req.body.subdomain || '').trim() };
    await saveDB(db);
    setFlash(req, 'success', 'Domain settings saved.');
    res.redirect('/dashboard/domain');
  } catch (error) {
    setFlash(req, 'error', 'Unable to save domain settings.');
    res.redirect('/dashboard/domain');
  }
}));


module.exports = router;
