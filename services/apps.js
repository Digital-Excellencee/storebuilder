const { sanitizePhone } = require('../helpers/html');

const APP_CATALOG = [
  {
    id: 'smtp',
    name: 'SMTP Email',
    category: 'Communication',
    badge: 'CORE',
    description: 'Send invoices, order alerts, and transactional emails using the merchant email inbox.'
  },
  {
    id: 'fast2sms',
    name: 'Fast2SMS OTP Login',
    category: 'Authentication',
    badge: 'CORE',
    description: 'Let customers login with mobile OTP directly from the storefront.'
  },
  {
    id: 'tawkto',
    name: 'Tawk.to Live Chat',
    category: 'Communication',
    badge: 'FREE',
    description: 'Embed live chat widget on the storefront for real-time support.'
  },
  {
    id: 'salesPopup',
    name: 'Sales Popup',
    category: 'Conversion',
    badge: 'CORE',
    description: 'Show recent purchase popups to build urgency and social proof.'
  },
  {
    id: 'metaPixel',
    name: 'Meta Pixel',
    category: 'Marketing',
    badge: 'CORE',
    description: 'Track PageView, AddToCart, InitiateCheckout, and Purchase events.'
  },
  {
    id: 'googleAnalytics',
    name: 'Google Analytics',
    category: 'Marketing',
    badge: 'CORE',
    description: 'Measure sessions and conversions through Google Analytics.'
  },
  {
    id: 'googleTagManager',
    name: 'Google Tag Manager',
    category: 'Marketing',
    badge: 'PRO',
    description: 'Manage tags and conversion scripts through GTM container injection.'
  },
  {
    id: 'razorpay',
    name: 'Razorpay Gateway',
    category: 'Payments',
    badge: 'CORE',
    description: 'Accept online payments with Razorpay checkout and signature verification.'
  },
  {
    id: 'cashfree',
    name: 'Cashfree Payments',
    category: 'Payments',
    badge: 'READY',
    description: 'Store Cashfree credentials for future online payment activation.'
  },
  {
    id: 'payu',
    name: 'PayU Gateway',
    category: 'Payments',
    badge: 'READY',
    description: 'Store PayU credentials for future online payment activation.'
  },
  {
    id: 'shiprocket',
    name: 'Shiprocket',
    category: 'Shipping',
    badge: 'CORE',
    description: 'Push new orders to Shiprocket after checkout and keep shipment data linked.'
  },
  {
    id: 'delhivery',
    name: 'Delhivery Logistics',
    category: 'Shipping',
    badge: 'READY',
    description: 'Store Delhivery API credentials for direct fulfillment workflows.'
  },
  {
    id: 'shipway',
    name: 'Shipway Logistics',
    category: 'Shipping',
    badge: 'READY',
    description: 'Store Shipway credentials to connect logistics workflows later.'
  },
  {
    id: 'webhooks',
    name: 'Outbound Webhooks',
    category: 'Automation',
    badge: 'PRO',
    description: 'Push order events to any external system or internal automation endpoint.'
  }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDefaultStoreApps() {
  return {
    smtp: { installed: false, configured: false, host: '', port: 587, secure: false, user: '', pass: '', fromEmail: '', fromName: '', replyTo: '' },
    fast2sms: { installed: false, configured: false, apiKey: '', senderId: 'FSTSMS', route: 'q', template: 'Your OTP for {{STORE}} is {{OTP}}', expiryMinutes: 10 },
    tawkto: { installed: false, configured: false, propertyId: '', widgetId: '' },
    salesPopup: { installed: false, configured: false, enabled: false, intervalSeconds: 8, title: 'Someone purchased', text: '{{product}} from {{city}}', showHome: true, showProduct: true },
    metaPixel: { installed: false, configured: false, pixelId: '' },
    googleAnalytics: { installed: false, configured: false, gaId: '' },
    googleTagManager: { installed: false, configured: false, containerId: '' },
    razorpay: { installed: false, configured: false, keyId: '', keySecret: '', themeColor: '#111827' },
    cashfree: { installed: false, configured: false, appId: '', secretKey: '' },
    payu: { installed: false, configured: false, merchantKey: '', merchantSalt: '' },
    shiprocket: { installed: false, configured: false, email: '', password: '', pickupLocation: '' },
    delhivery: { installed: false, configured: false, apiKey: '', clientName: '' },
    shipway: { installed: false, configured: false, apiKey: '', courierCode: '' },
    webhooks: { installed: false, configured: false, orderCreatedUrl: '', orderUpdatedUrl: '', orderDeliveredUrl: '' }
  };
}

function normalizeStoreApps(rawApps) {
  const defaults = getDefaultStoreApps();
  const apps = rawApps && typeof rawApps === 'object' ? rawApps : {};
  Object.keys(defaults).forEach((key) => {
    const source = apps[key] && typeof apps[key] === 'object' ? apps[key] : {};
    defaults[key] = Object.assign({}, defaults[key], source);
    defaults[key].installed = defaults[key].installed === true;
    defaults[key].configured = defaults[key].configured === true;
  });
  defaults.fast2sms.senderId = String(defaults.fast2sms.senderId || 'FSTSMS').slice(0, 30);
  defaults.fast2sms.route = String(defaults.fast2sms.route || 'q').slice(0, 20);
  defaults.fast2sms.expiryMinutes = Math.max(1, Math.min(30, Number(defaults.fast2sms.expiryMinutes || 10) || 10));
  defaults.smtp.port = Math.max(1, Number(defaults.smtp.port || 587) || 587);
  defaults.salesPopup.intervalSeconds = Math.max(4, Math.min(30, Number(defaults.salesPopup.intervalSeconds || 8) || 8));
  defaults.salesPopup.enabled = defaults.salesPopup.enabled === true;
  defaults.salesPopup.showHome = defaults.salesPopup.showHome !== false;
  defaults.salesPopup.showProduct = defaults.salesPopup.showProduct !== false;
  defaults.razorpay.themeColor = String(defaults.razorpay.themeColor || '#111827');
  defaults.webhooks.orderCreatedUrl = String(defaults.webhooks.orderCreatedUrl || '').trim();
  defaults.webhooks.orderUpdatedUrl = String(defaults.webhooks.orderUpdatedUrl || '').trim();
  defaults.webhooks.orderDeliveredUrl = String(defaults.webhooks.orderDeliveredUrl || '').trim();
  return defaults;
}

function getAppCatalog() {
  return clone(APP_CATALOG);
}

function getAppDefinition(appId) {
  return APP_CATALOG.find((app) => app.id === appId) || null;
}

function isAppReady(app) {
  return app && app.installed && app.configured;
}

function getSalesPopupItems(store) {
  const orders = Array.isArray(store && store.orders) ? store.orders : [];
  const byRecentOrders = orders.slice().reverse().slice(0, 8).map((order) => ({
    name: order.customerName || 'Someone',
    city: order.shippingAddress ? String(order.shippingAddress).split(',').slice(-1)[0].trim() : 'your area',
    product: order.productName || 'a product'
  }));
  if (byRecentOrders.length) return byRecentOrders;
  const products = Array.isArray(store && store.products) ? store.products.filter((item) => item.active !== false).slice(0, 6) : [];
  return products.map((product) => ({
    name: 'A shopper',
    city: 'nearby',
    product: product.name || 'a product'
  }));
}

function findCustomerByPhone(store, phone) {
  const clean = sanitizePhone(phone || '');
  if (!clean) return null;
  return Object.values(store && store.customers ? store.customers : {}).find((customer) => sanitizePhone(customer && customer.phone || '') === clean) || null;
}

module.exports = {
  getAppCatalog,
  getAppDefinition,
  getDefaultStoreApps,
  normalizeStoreApps,
  isAppReady,
  getSalesPopupItems,
  findCustomerByPhone
};
