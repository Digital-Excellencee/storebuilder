const config = require('../config');
const { escapeHtml, parsePrice, formatDate, generateId } = require('./html');

const { ORDER_STATUSES, BASE_DOMAIN, DB_PATH } = config;

function getStatusBadge(status) {
  const map = {
    pending: 'badge-pending',
    'payment-review': 'badge-pending',
    confirmed: 'badge-confirmed',
    shipped: 'badge-live',
    cancelled: 'badge-cancelled',
    delivered: 'badge-delivered'
  };
  return `<span class="badge ${map[status] || 'badge-live'}">${escapeHtml(status)}</span>`;
}

function getStoreRevenue(store) {
  return store.orders
    .filter((order) => order.status === 'confirmed' || order.status === 'delivered')
    .reduce((sum, order) => sum + Number(order.amount || 0), 0);
}

function getStoreCustomerCount(store) {
  return Object.keys(store.customers || {}).length;
}

function getUniqueCustomers(store) {
  const customers = store.customers || {};
  return Object.values(customers)
    .map((customer) => {
      const name = typeof customer.name === 'string' ? customer.name : customer.id || customer.email || 'Customer';
      const phone = typeof customer.phone === 'string' ? customer.phone : customer.id || '-';
      const orderCount = Array.isArray(customer.orders) ? customer.orders.length : 0;
      const createdAt = customer.createdAt || (Array.isArray(customer.orders) && customer.orders.length ? customer.orders[customer.orders.length - 1].createdAt : '') || '';
      return {
        name,
        phone,
        orders: orderCount,
        firstSeen: createdAt
      };
    })
    .sort((a, b) => new Date(b.firstSeen) - new Date(a.firstSeen));
}

function renderMiniBar(label, value, max, color) {
  const safe = Math.max(0, Number(value) || 0);
  const maxSafe = Math.max(1, Number(max) || 1);
  const percent = Math.min(100, (safe / maxSafe) * 100);
  return `<div class="mini-bar-row">
    <span class="mini-bar-label">${escapeHtml(label)}</span>
    <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${percent.toFixed(1)}%;background:${color};"></div></div>
    <span class="mini-bar-value">${escapeHtml(safe.toLocaleString('en-IN'))}</span>
  </div>`;
}

function getSetupChecklist(store) {
  const items = [
    {
      title: 'Store name & description',
      hint: 'Give your store a clear identity.',
      done: !!(store.name && store.name.trim() && store.description && store.description.trim())
    },
    {
      title: 'WhatsApp number',
      hint: 'Add your WhatsApp so buyers can contact you directly.',
      done: !!(store.whatsapp && String(store.whatsapp).replace(/\D/g, '').length >= 10)
    },
    {
      title: 'At least one product',
      hint: 'Add a product to start selling.',
      done: Array.isArray(store.products) && store.products.length > 0
    },
    {
      title: 'Store logo',
      hint: 'Upload a square logo for branding.',
      done: !!(store.logo && store.logo.trim())
    },
    {
      title: 'Choose a theme',
      hint: 'Pick a theme so the store looks polished.',
      done: !!(store.theme && store.theme.trim())
    },
    {
      title: 'Share your store link',
      hint: 'Copy the link and share on WhatsApp or social media.',
      done: Array.isArray(store.orders) && store.orders.length > 0
    }
  ];
  const doneCount = items.filter((item) => item.done).length;
  return { items, doneCount, total: items.length };
}

function storeUrl(slug, pathSuffix, req) {
  const protocol = req.headers['x-forwarded-proto']
    ? String(req.headers['x-forwarded-proto']).split(',')[0].trim()
    : req.protocol;
  const host = req.get('host') || '';
  const base = `${protocol}://${host}`;
  if (slug) {
    return `${base}/store/${encodeURIComponent(slug)}${pathSuffix || ''}`;
  }
  return `${base}${pathSuffix || ''}`;
}

function buildStoreUrl(slug, req) {
  return storeUrl(slug, '', req);
}

function getTemplateById(db, templateId) {
  const templates = db && Array.isArray(db.templates) ? db.templates : [];
  return templates.find((template) => template.id === templateId) || templates[0] || {
    id: 'app-style',
    name: 'App Style',
    description: 'Default mobile-first template.',
    colors: { primary: '#3b5bfd', secondary: '#06b6d4' },
    layout: 'app'
  };
}

function getStoreOwner(db, store) {
  if (!db || !db.users || !store || !store.ownerId) return null;
  return db.users[store.ownerId] || null;
}

function applyRoundingMode(amount, mode) {
  const value = Number(amount || 0);
  if (!Number.isFinite(value)) return 0;
  if (mode === 'up') return Math.ceil(value);
  if (mode === 'down') return Math.floor(value);
  if (mode === 'nearest') return Math.round(value);
  return Math.round(value * 100) / 100;
}

function getEffectiveShippingFee(store, subtotal) {
  const ss = (store && typeof store === 'object' && store.storeSettings && typeof store.storeSettings === 'object') ? store.storeSettings : null;
  if (!ss) return 0;
  const freeAbove = Number(ss.deliverySettings.freeDeliveryAbove || 0);
  if (ss.deliverySettings.serviceType === 'pickup') return 0;
  if (freeAbove > 0 && Number(subtotal || 0) >= freeAbove) return 0;
  return Number(ss.deliverySettings.fee || 0) || 0;
}

function getProductDisplayRating(product) {
  if (product && Array.isArray(product.reviews) && product.reviews.length) {
    const total = product.reviews.reduce((sum, review) => sum + Math.max(1, Math.min(5, Number(review.rating || 0))), 0);
    return (total / product.reviews.length).toFixed(1);
  }
  const seed = String((product && (product.sku || product.id || product.name)) || 'seed');
  let score = 0;
  for (let i = 0; i < seed.length; i += 1) score += seed.charCodeAt(i);
  return (4 + ((score % 10) / 10)).toFixed(1);
}

function getPlatformStartedAt() {
  try {
    const { existsSync, statSync } = require('fs');
    if (!existsSync(DB_PATH)) {
      return new Date().toISOString();
    }
    return statSync(DB_PATH).birthtime.toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

module.exports = {
  getStatusBadge,
  getStoreRevenue,
  getStoreCustomerCount,
  getUniqueCustomers,
  renderMiniBar,
  getSetupChecklist,
  storeUrl,
  buildStoreUrl,
  getTemplateById,
  getStoreOwner,
  applyRoundingMode,
  getEffectiveShippingFee,
  getProductDisplayRating,
  getPlatformStartedAt
};
