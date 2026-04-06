const fs = require('fs');
const path = require('path');
const session = require('express-session');
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const { v2: cloudinary } = require('cloudinary');
const config = require('../config');
const { escapeHtml, parsePrice, generateId, generateTrackingCode } = require('../helpers/html');
const { normalizeStoreApps } = require('./apps');

let _supabase = null;
let _cloudinaryClient;
let _schemaEnsurePromise = null;

const SCHEMA_SQL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS stores (
    slug TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    whatsapp TEXT DEFAULT '',
    logo TEXT DEFAULT '',
    template TEXT DEFAULT 'app-style',
    theme TEXT DEFAULT 'default',
    theme_config JSONB DEFAULT '{}'::jsonb,
    store_settings JSONB DEFAULT '{}'::jsonb,
    categories JSONB DEFAULT '[]'::jsonb,
    collections JSONB DEFAULT '[]'::jsonb,
    pages JSONB DEFAULT '[]'::jsonb,
    discounts JSONB DEFAULT '[]'::jsonb,
    subdomain TEXT DEFAULT '',
    visits INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    payload JSONB DEFAULT '{}'::jsonb
  );`,
  `ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';`,
  `ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS whatsapp TEXT DEFAULT '';`,
  `ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS logo TEXT DEFAULT '';`,
  `ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS template TEXT DEFAULT 'app-style';`,
  `ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'default';`,
  `ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS theme_config JSONB DEFAULT '{}'::jsonb;`,
  `ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS store_settings JSONB DEFAULT '{}'::jsonb;`,
  `ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '[]'::jsonb;`,
  `ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS collections JSONB DEFAULT '[]'::jsonb;`,
  `ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS pages JSONB DEFAULT '[]'::jsonb;`,
  `ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS discounts JSONB DEFAULT '[]'::jsonb;`,
  `ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS subdomain TEXT DEFAULT '';`,
  `ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS visits INTEGER DEFAULT 0;`,
  `ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`,
  `ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;`,

  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    password_hash TEXT DEFAULT '',
    store_slug TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    payload JSONB DEFAULT '{}'::jsonb
  );`,
  `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS name TEXT DEFAULT '';`,
  `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';`,
  `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT '';`,
  `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS store_slug TEXT DEFAULT '';`,
  `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`,
  `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;`,

  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    store_slug TEXT NOT NULL REFERENCES stores(slug) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price NUMERIC DEFAULT 0,
    compare_price NUMERIC DEFAULT 0,
    stock INTEGER DEFAULT 0,
    sku TEXT DEFAULT '',
    image TEXT DEFAULT '',
    images JSONB DEFAULT '[]'::jsonb,
    variants JSONB DEFAULT '[]'::jsonb,
    categories JSONB DEFAULT '[]'::jsonb,
    tags JSONB DEFAULT '[]'::jsonb,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    payload JSONB DEFAULT '{}'::jsonb
  );`,
  `ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';`,
  `ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS compare_price NUMERIC DEFAULT 0;`,
  `ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;`,
  `ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb;`,
  `ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '[]'::jsonb;`,
  `ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;`,
  `ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;`,
  `ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`,
  `ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;`,

  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    store_slug TEXT NOT NULL REFERENCES stores(slug) ON DELETE CASCADE,
    order_number TEXT,
    tracking_code TEXT,
    customer_name TEXT DEFAULT '',
    customer_phone TEXT DEFAULT '',
    customer_email TEXT DEFAULT '',
    shipping_address TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    payment_method TEXT DEFAULT 'cod',
    status TEXT DEFAULT 'pending',
    amount NUMERIC DEFAULT 0,
    subtotal NUMERIC DEFAULT 0,
    shipping_fee NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    discount_amount NUMERIC DEFAULT 0,
    discount_code TEXT DEFAULT '',
    items JSONB DEFAULT '[]'::jsonb,
    tracking_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    payload JSONB DEFAULT '{}'::jsonb
  );`,
  `ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS order_number TEXT DEFAULT '';`,
  `ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS tracking_code TEXT DEFAULT '';`,
  `ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS customer_name TEXT DEFAULT '';`,
  `ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS customer_phone TEXT DEFAULT '';`,
  `ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS customer_email TEXT DEFAULT '';`,
  `ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS shipping_address TEXT DEFAULT '';`,
  `ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';`,
  `ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cod';`,
  `ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';`,
  `ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;`,
  `ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;`,
  `ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC DEFAULT 0;`,
  `ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0;`,
  `ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;`,
  `ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS discount_code TEXT DEFAULT '';`,
  `ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;`,
  `ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS tracking_history JSONB DEFAULT '[]'::jsonb;`,
  `ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`,
  `ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;`,

  `CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    store_slug TEXT NOT NULL REFERENCES stores(slug) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    password_hash TEXT DEFAULT '',
    addresses JSONB DEFAULT '[]'::jsonb,
    wishlist JSONB DEFAULT '[]'::jsonb,
    order_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    payload JSONB DEFAULT '{}'::jsonb,
    UNIQUE(store_slug, email)
  );`,
  `CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS customers_store_slug_email_idx ON customers(store_slug, email);`
];

function getSupabaseDbConnectionString() {
  return String(
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    ''
  ).trim();
}

function sanitizeDbConnectionString(connectionString) {
  return String(connectionString || '')
    .replace(/([?&])sslmode=[^&]*/gi, '$1')
    .replace(/[?&]$/g, '')
    .replace(/\?&/, '?');
}

async function withSqlClient(work) {
  const connectionString = getSupabaseDbConnectionString();
  if (!connectionString) return null;
  const sanitizedConnectionString = sanitizeDbConnectionString(connectionString);
  const client = new Client({
    connectionString: sanitizedConnectionString,
    ssl: connectionString.includes('sslmode=disable') ? false : { rejectUnauthorized: false }
  });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) return null;
  _supabase = createClient(url, key);
  return _supabase;
}

function getCloudinary() {
  if (_cloudinaryClient !== undefined) return _cloudinaryClient;
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();
  if (!cloudName || !apiKey || !apiSecret) {
    _cloudinaryClient = null;
    return _cloudinaryClient;
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });
  _cloudinaryClient = cloudinary;
  return _cloudinaryClient;
}

const { DB_PATH, SESSION_PATH, PUBLIC_DIR, LOGOS_DIR, PRODUCTS_DIR, ALLOWED_MIMES, ORDER_STATUSES, BASE_DOMAIN } = config;

const DEFAULT_TEMPLATES = [
  {
    id: 'app-style',
    name: 'Classic',
    description: 'Mobile-first layout with sticky header, category carousel, and fast shopping flow.',
    colors: { primary: '#3b5bfd', secondary: '#06b6d4' },
    layout: 'app'
  },
  {
    id: 'minimal',
    name: 'Zippy - Quick Commerce',
    description: 'Clean centered storefront with premium typography and a soft commerce feel.',
    colors: { primary: '#111827', secondary: '#64748b' },
    layout: 'minimal'
  },
  {
    id: 'bold-fashion',
    name: 'Lumio - Fashion',
    description: 'Large banners, bold typography, and contrast-rich sections for strong brands.',
    colors: { primary: '#dc2626', secondary: '#111827' },
    layout: 'bold'
  },
  {
    id: 'minto-fresh',
    name: 'Minto - General Store',
    description: 'Fresh app-style storefront for grocery, daily needs, and utility-led catalogs.',
    colors: { primary: '#16a34a', secondary: '#84cc16' },
    layout: 'app'
  },
  {
    id: 'aerion-modern',
    name: 'Aerion - Modern Brands',
    description: 'Dark premium storefront for electronics, gadgets, and modern lifestyle brands.',
    colors: { primary: '#7c3aed', secondary: '#0f172a' },
    layout: 'bold'
  },
  {
    id: 'nestly-home',
    name: 'Nestly - Home Decor',
    description: 'Warm minimal storefront for home decor, furniture, and premium catalog browsing.',
    colors: { primary: '#92400e', secondary: '#eab308' },
    layout: 'minimal'
  },
  {
    id: 'nudist-style',
    name: 'Nudist - Stylish and Confident',
    description: 'Editorial fashion storefront with strong contrast and a polished luxury feel.',
    colors: { primary: '#111827', secondary: '#b91c1c' },
    layout: 'bold'
  },
  {
    id: 'fresh-grid',
    name: 'Fresh Grid',
    description: 'Balanced app layout for supermarkets, fruit stores, and fast everyday shopping.',
    colors: { primary: '#0f766e', secondary: '#22c55e' },
    layout: 'app'
  }
];

const DEFAULT_STORE_SETTINGS = {
  storeDetails: {
    favicon: '',
    category: 'General Store',
    phone: '',
    email: '',
    legalName: '',
    businessType: 'Individual',
    address: '',
    socialLinks: { facebook: '', youtube: '', instagram: '' }
  },
  productSettings: {
    hideOutOfStock: false,
    displaySingleVariantDetails: false,
    showCartCheckoutPopup: false,
    productCardSalePrice: 'sale-tax',
    productPageSalePrice: 'sale-tax',
    minimumQtyIncrementRule: 'single',
    variantSelectorType: 'chips'
  },
  checkoutSettings: {
    roundingMode: 'none',
    showTaxInfo: true,
    minimumOrderAmount: '0',
    cartNote: ''
  },
  deliverySettings: {
    fee: '0',
    freeDeliveryAbove: '',
    allIndiaDelivery: true,
    deliveryRadius: '5',
    serviceType: 'delivery',
    addressType: 'form',
    nextDayTitle: 'Delivery by Tomorrow',
    nextDaySubtitle: 'Order will be delivered by tomorrow',
    normalTitle: 'Normal Delivery',
    normalSubtitle: 'Order will be delivered on standard delivery time'
  },
  paymentSettings: {
    cod: true,
    partialCod: false,
    onlinePayment: false,
    bankDetails: '',
    paymentModeRules: ''
  },
  orderSettings: {
    allowInvoiceDownload: true,
    allowOrderCancellation: true,
    autoConfirmPaymentMode: 'online',
    orderNote: 'Order received. Thank you for shopping with us!'
  },
  returnOrderSettings: {
    allowReturnRequests: false,
    returnWindowDays: '7',
    instructions: ''
  },
  labelSettings: {
    searchBoxText: 'Search for a product',
    selectLocationText: 'Select Your Location',
    categoriesHeading: 'Browse Categories',
    collectionsHeading: 'Our Collections',
    productsHeading: 'Products',
    addProductButton: '+ Add',
    productCardEnquiryButton: 'Enquiry',
    viewAllProductsButton: 'View All Products',
    bottomNavHome: 'Home',
    bottomNavOrders: 'Orders',
    bottomNavCart: 'Cart',
    bottomNavAccount: 'Account',
    signInHeading: 'Sign In',
    signUpHeading: 'Sign Up',
    requestOtpButton: 'Send SMS OTP'
  },
  seoSettings: {
    title: '',
    description: '',
    keywords: '',
    googleSiteVerification: '',
    facebookDomainVerification: '',
    pinterestDomainVerification: ''
  },
  llmSettings: {
    enabled: false,
    businessSummary: '',
    supportEmail: '',
    supportPhone: ''
  },
  notificationsSettings: {
    newOrder: true,
    whatsappLead: true,
    lowStock: false,
    abandonedCart: false
  },
  loginSettings: {
    allowRegistration: true,
    signInHeading: 'Sign In',
    signUpHeading: 'Sign Up',
    requestOtpButton: 'Send SMS OTP'
  },
  urlRedirects: [],
  robotsSettings: {
    mode: 'normal',
    allowAll: true,
    homeOnly: false,
    blockAll: false,
    customText: ''
  },
  policies: {
    terms: '',
    shipping: '',
    payment: '',
    returnRefund: '',
    privacy: ''
  },
  aboutUs: {
    title: 'About Us',
    content: ''
  }
};

const DEFAULT_DB = {
  users: {},
  stores: {},
  templates: DEFAULT_TEMPLATES,
  superAdmin: null
};

function cloneDefaultDB() {
  return JSON.parse(JSON.stringify(DEFAULT_DB));
}

function cloneDefaultStoreSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_STORE_SETTINGS));
}

function ensureStoreSettings(store) {
  const safe = cloneDefaultStoreSettings();
  const current = store && store.storeSettings && typeof store.storeSettings === 'object' ? store.storeSettings : {};
  const domain = store && store.domain && typeof store.domain === 'object' ? store.domain : { customDomain: '', subdomain: '' };
  const shipping = store && store.shipping && typeof store.shipping === 'object' ? store.shipping : {};
  const notifications = store && store.notifications && typeof store.notifications === 'object' ? store.notifications : {};

  safe.storeDetails.favicon = String(current.storeDetails && current.storeDetails.favicon || '').trim();
  safe.storeDetails.category = String(current.storeDetails && current.storeDetails.category || 'General Store').trim() || 'General Store';
  safe.storeDetails.phone = String(current.storeDetails && current.storeDetails.phone || '').trim();
  safe.storeDetails.email = String(current.storeDetails && current.storeDetails.email || '').trim().toLowerCase();
  safe.storeDetails.legalName = String(current.storeDetails && current.storeDetails.legalName || store.name || '').trim();
  safe.storeDetails.businessType = String(current.storeDetails && current.storeDetails.businessType || 'Individual').trim() || 'Individual';
  safe.storeDetails.address = String(current.storeDetails && current.storeDetails.address || '').trim();
  safe.storeDetails.socialLinks.facebook = String(current.storeDetails && current.storeDetails.socialLinks && current.storeDetails.socialLinks.facebook || '').trim();
  safe.storeDetails.socialLinks.youtube = String(current.storeDetails && current.storeDetails.socialLinks && current.storeDetails.socialLinks.youtube || '').trim();
  safe.storeDetails.socialLinks.instagram = String(current.storeDetails && current.storeDetails.socialLinks && current.storeDetails.socialLinks.instagram || '').trim();

  Object.assign(safe.productSettings, current.productSettings || {});
  Object.assign(safe.checkoutSettings, current.checkoutSettings || {});
  Object.assign(safe.deliverySettings, current.deliverySettings || {});
  Object.assign(safe.paymentSettings, current.paymentSettings || {});
  Object.assign(safe.orderSettings, current.orderSettings || {});
  Object.assign(safe.returnOrderSettings, current.returnOrderSettings || {});
  Object.assign(safe.labelSettings, current.labelSettings || {});
  Object.assign(safe.seoSettings, current.seoSettings || {});
  Object.assign(safe.llmSettings, current.llmSettings || {});
  Object.assign(safe.notificationsSettings, current.notificationsSettings || {});
  Object.assign(safe.loginSettings, current.loginSettings || {});
  Object.assign(safe.robotsSettings, current.robotsSettings || {});
  Object.assign(safe.policies, current.policies || {});
  Object.assign(safe.aboutUs, current.aboutUs || {});

  safe.deliverySettings.fee = String(current.deliverySettings && current.deliverySettings.fee || shipping.fee || '0').trim() || '0';
  safe.deliverySettings.serviceType = String(current.deliverySettings && current.deliverySettings.serviceType || (shipping.mode === 'pickup' ? 'pickup' : 'delivery')).trim() || 'delivery';
  safe.deliverySettings.normalSubtitle = String(current.deliverySettings && current.deliverySettings.normalSubtitle || shipping.notes || safe.deliverySettings.normalSubtitle).trim() || safe.deliverySettings.normalSubtitle;

  safe.notificationsSettings.newOrder = current.notificationsSettings && Object.prototype.hasOwnProperty.call(current.notificationsSettings, 'newOrder') ? current.notificationsSettings.newOrder !== false : notifications.newOrder !== false;
  safe.notificationsSettings.whatsappLead = current.notificationsSettings && Object.prototype.hasOwnProperty.call(current.notificationsSettings, 'whatsappLead') ? current.notificationsSettings.whatsappLead !== false : notifications.whatsappLead !== false;
  safe.notificationsSettings.lowStock = current.notificationsSettings && Object.prototype.hasOwnProperty.call(current.notificationsSettings, 'lowStock') ? current.notificationsSettings.lowStock === true : notifications.lowStock === true;

  safe.urlRedirects = Array.isArray(current.urlRedirects) ? current.urlRedirects.map((item) => ({
    from: String(item && item.from || '').trim(),
    to: String(item && item.to || '').trim()
  })).filter((item) => item.from && item.to) : [];

  safe.domain = {
    customDomain: String(current.domain && current.domain.customDomain || domain.customDomain || '').trim(),
    subdomain: String(current.domain && current.domain.subdomain || domain.subdomain || '').trim()
  };

  store.storeSettings = safe;
  return safe;
}

function normalizeDomainHost(value) {
  let clean = String(value || '').trim().toLowerCase();
  if (!clean) return '';
  clean = clean.replace(/^https?:\/\//, '').split('/')[0];
  clean = clean.split(':')[0];
  return clean.replace(/\.+$/, '');
}

function buildManagedSubdomain(label) {
  const safeLabel = String(label || '').trim().toLowerCase();
  if (!safeLabel || !BASE_DOMAIN) return '';
  return `${safeLabel}.${BASE_DOMAIN}`;
}

function getSubdomainLabel(hostname, fallback) {
  const host = normalizeDomainHost(hostname);
  if (!host) return String(fallback || '').trim().toLowerCase();
  const parts = host.split('.').filter(Boolean);
  if (parts.length >= 3) return parts[0];
  return String(fallback || '').trim().toLowerCase();
}

function syncStoreManagedDomain(store, slug) {
  if (!store || typeof store !== 'object' || !BASE_DOMAIN) return;
  const currentCustomDomain = normalizeDomainHost(store.domain && store.domain.customDomain);
  if (currentCustomDomain) return;
  const currentSubdomain = normalizeDomainHost((store.domain && store.domain.subdomain) || store.subdomain || '');
  const label = getSubdomainLabel(currentSubdomain, slug);
  const managedSubdomain = buildManagedSubdomain(label || slug);
  if (!managedSubdomain) return;
  store.subdomain = managedSubdomain;
  store.domain = store.domain && typeof store.domain === 'object' ? store.domain : { customDomain: '', subdomain: '' };
  store.domain.subdomain = managedSubdomain;
  if (store.storeSettings && store.storeSettings.domain && typeof store.storeSettings.domain === 'object') {
    store.storeSettings.domain.subdomain = managedSubdomain;
  }
}

function normalizeDB(db) {
  const safe = cloneDefaultDB();
  safe.users = db && typeof db.users === 'object' && db.users ? db.users : {};
  safe.stores = db && typeof db.stores === 'object' && db.stores ? db.stores : {};
  safe.templates = DEFAULT_TEMPLATES;
  safe.superAdmin = db && Object.prototype.hasOwnProperty.call(db, 'superAdmin') ? db.superAdmin : null;

  Object.keys(safe.stores).forEach((slug) => {
    const store = safe.stores[slug];
    if (!store || typeof store !== 'object') {
      safe.stores[slug] = {
        slug,
        ownerId: '',
        name: '',
        description: '',
        whatsapp: '',
        logo: '',
        template: 'app-style',
        theme: 'default',
        themeConfig: {
          announcementEnabled: true,
          primaryColor: '',
          secondaryColor: '',
          bgColor: '',
          btnColor: '',
          headingFont: '',
          bodyFont: '',
          customCss: '',
          headerLayout: 'search',
          headerSticky: true,
          showSearch: true,
          showWishlistIcon: true,
          showCartIcon: true,
          showDiscount: true,
          showRating: true,
          showProductStock: true,
          showProductPageStock: true,
          showProductDescription: true,
          showWhatsappButton: true,
          showBanner: true,
          showCategories: true,
          showFlashDeals: true,
          showFooter: true,
          showPoweredBy: true,
          borderRadius: 'rounded',
          btnStyle: 'pill',
          bottomNavStyle: 'classic',
          productCardStyle: 'style-2',
          categoryStyle: 'circle',
          categoryTitle: 'Categories',
          productsTitle: 'All Products',
          bannerTitle: '',
          bannerSubtitle: '',
          bannerCta: '',
          bannerImage: '',
          bannerImages: [],
          bannerImagesMobile: [],
          headerStyle: 'clean',
          footerText: '',
          menuHomeLabel: 'Home',
          menuShopLabel: 'Shop All',
          menuWishlistLabel: 'Wishlist',
          menuCartLabel: 'Cart',
          menuTrackLabel: 'Track Order',
          menuAccountLabel: 'My Account',
          topBarText: '\uD83D\uDE9A Free Shipping on orders above \u20B9499 | \uD83D\uDD25 Flat 50% OFF on first order!',
          topBarMarquee: true,
          topBarBg: '',
          topBarColor: '',
          categoryLayout: 'auto'
        },
        storeSettings: cloneDefaultStoreSettings(),
        products: [],
        orders: [],
        customers: {},
        visits: 0,
        createdAt: new Date().toISOString()
      };
      return;
    }
    store.products = Array.isArray(store.products) ? store.products : [];
    store.orders = Array.isArray(store.orders) ? store.orders : [];
    store.visits = Number(store.visits || 0);
    if (store.template === 'modern') {
      store.template = 'app-style';
    } else if (store.template === 'vibrant') {
      store.template = 'bold-fashion';
    } else if (store.template === 'minimal') {
      store.template = 'minimal';
    } else {
      store.template = ['app-style', 'minimal', 'bold-fashion', 'minto-fresh', 'aerion-modern', 'nestly-home', 'nudist-style', 'fresh-grid'].includes(store.template) ? store.template : 'app-style';
    }
    store.theme = store.theme || 'default';
    store.themeConfig = store.themeConfig && typeof store.themeConfig === 'object' ? store.themeConfig : {};
    store.themeConfig.announcementEnabled = store.themeConfig.announcementEnabled !== false;
    store.themeConfig.primaryColor = store.themeConfig.primaryColor || '';
    store.themeConfig.secondaryColor = store.themeConfig.secondaryColor || '';
    store.themeConfig.bgColor = store.themeConfig.bgColor || '';
    store.themeConfig.btnColor = store.themeConfig.btnColor || '';
    store.themeConfig.headingFont = store.themeConfig.headingFont || '';
    store.themeConfig.bodyFont = store.themeConfig.bodyFont || '';
    store.themeConfig.customCss = store.themeConfig.customCss || '';
    store.themeConfig.headerLayout = store.themeConfig.headerLayout || 'search';
    store.themeConfig.headerSticky = store.themeConfig.headerSticky !== false;
    store.themeConfig.showSearch = store.themeConfig.showSearch !== false;
    store.themeConfig.showWishlistIcon = store.themeConfig.showWishlistIcon !== false;
    store.themeConfig.showCartIcon = store.themeConfig.showCartIcon !== false;
    store.themeConfig.showDiscount = store.themeConfig.showDiscount !== false;
    store.themeConfig.showRating = store.themeConfig.showRating !== false;
    store.themeConfig.showProductStock = store.themeConfig.showProductStock !== false;
    store.themeConfig.showProductPageStock = store.themeConfig.showProductPageStock !== false;
    store.themeConfig.showProductDescription = store.themeConfig.showProductDescription !== false;
    store.themeConfig.showWhatsappButton = store.themeConfig.showWhatsappButton !== false;
    store.themeConfig.showBanner = store.themeConfig.showBanner !== false;
    store.themeConfig.showCategories = store.themeConfig.showCategories !== false;
    store.themeConfig.showFlashDeals = store.themeConfig.showFlashDeals !== false;
    store.themeConfig.showFooter = store.themeConfig.showFooter !== false;
    store.themeConfig.showPoweredBy = store.themeConfig.showPoweredBy !== false;
    store.themeConfig.borderRadius = store.themeConfig.borderRadius || 'rounded';
    store.themeConfig.btnStyle = store.themeConfig.btnStyle || 'pill';
    store.themeConfig.bottomNavStyle = store.themeConfig.bottomNavStyle || 'classic';
    store.themeConfig.productCardStyle = store.themeConfig.productCardStyle || 'style-2';
    store.themeConfig.categoryStyle = store.themeConfig.categoryStyle || 'circle';
    store.themeConfig.categoryTitle = store.themeConfig.categoryTitle || 'Categories';
    store.themeConfig.productsTitle = store.themeConfig.productsTitle || 'All Products';
    store.themeConfig.bannerTitle = store.themeConfig.bannerTitle || '';
    store.themeConfig.bannerSubtitle = store.themeConfig.bannerSubtitle || '';
    store.themeConfig.bannerCta = store.themeConfig.bannerCta || '';
    store.themeConfig.bannerImage = store.themeConfig.bannerImage || '';
    store.themeConfig.bannerImages = Array.isArray(store.themeConfig.bannerImages) ? store.themeConfig.bannerImages : [];
    store.themeConfig.bannerImagesMobile = Array.isArray(store.themeConfig.bannerImagesMobile) ? store.themeConfig.bannerImagesMobile : [];
    store.themeConfig.headerStyle = store.themeConfig.headerStyle || 'clean';
    store.themeConfig.footerText = store.themeConfig.footerText || '';
    store.themeConfig.menuHomeLabel = store.themeConfig.menuHomeLabel || 'Home';
    store.themeConfig.menuShopLabel = store.themeConfig.menuShopLabel || 'Shop All';
    store.themeConfig.menuWishlistLabel = store.themeConfig.menuWishlistLabel || 'Wishlist';
    store.themeConfig.menuCartLabel = store.themeConfig.menuCartLabel || 'Cart';
    store.themeConfig.menuTrackLabel = store.themeConfig.menuTrackLabel || 'Track Order';
    store.themeConfig.menuAccountLabel = store.themeConfig.menuAccountLabel || 'My Account';
    store.themeConfig.topBarText = store.themeConfig.topBarText || '';
    store.themeConfig.topBarMarquee = store.themeConfig.topBarMarquee !== false;
    store.themeConfig.topBarBg = store.themeConfig.topBarBg || '';
    store.themeConfig.topBarColor = store.themeConfig.topBarColor || '';
    store.themeConfig.categoryLayout = store.themeConfig.categoryLayout || 'auto';
    ensureStoreSettings(store);
    store.logo = store.logo || '';
    store.subdomain = store.subdomain || '';
    store.description = typeof store.description === 'string' ? store.description : '';
    store.whatsapp = typeof store.whatsapp === 'string' ? store.whatsapp : '';
    store.createdAt = store.createdAt || new Date().toISOString();
    store.customers = store.customers && typeof store.customers === 'object' ? store.customers : {};
    store.categories = Array.isArray(store.categories) ? store.categories : [];
    store.discounts = Array.isArray(store.discounts) ? store.discounts : [];
    store.pages = Array.isArray(store.pages) ? store.pages : [];
    store.abandonedCarts = Array.isArray(store.abandonedCarts) ? store.abandonedCarts.map((entry) => ({
      sessionId: entry && entry.sessionId ? String(entry.sessionId) : '',
      cart: Array.isArray(entry && entry.cart) ? entry.cart : [],
      startedAt: entry && entry.startedAt ? entry.startedAt : new Date().toISOString(),
      updatedAt: entry && entry.updatedAt ? entry.updatedAt : '',
      customerName: entry && entry.customerName ? String(entry.customerName) : '',
      customerPhone: entry && entry.customerPhone ? String(entry.customerPhone) : ''
    })) : [];
    store.apps = normalizeStoreApps(store.apps);
    store.tracking = store.tracking && typeof store.tracking === 'object' ? store.tracking : { pixel: '', google: '' };
    store.tracking.pixel = typeof store.tracking.pixel === 'string' ? store.tracking.pixel : '';
    store.tracking.google = typeof store.tracking.google === 'string' ? store.tracking.google : '';
    if (store.apps.metaPixel.pixelId) {
      store.tracking.pixel = store.apps.metaPixel.pixelId;
      store.apps.metaPixel.configured = true;
    }
    if (store.apps.googleAnalytics.gaId) {
      store.tracking.google = store.apps.googleAnalytics.gaId;
      store.apps.googleAnalytics.configured = true;
    }
    syncStoreManagedDomain(store, slug);
    store.notifications = store.notifications && typeof store.notifications === 'object' ? store.notifications : {
      newOrder: true,
      whatsappLead: true,
      lowStock: false,
      abandonedCart: false
    };
    store.whatsappMarketing = store.whatsappMarketing && typeof store.whatsappMarketing === 'object' ? store.whatsappMarketing : { welcome: '', recovery: '', promo: '' };
    store.products = store.products.map((product) => ({
      id: product.id || generateId('p'),
      name: typeof product.name === 'string' ? product.name : '',
      price: parsePrice(product.price),
      mrp: parsePrice(product.mrp || product.comparePrice || product.price),
      comparePrice: parsePrice(product.comparePrice || product.mrp || product.price),
      description: typeof product.description === 'string' ? product.description : '',
      image: typeof product.image === 'string' ? product.image : '',
      images: Array.isArray(product.images) ? product.images.filter((item) => typeof item === 'string' && item.trim()) : (typeof product.image === 'string' && product.image ? [product.image] : []),
      stock: Math.max(0, parseInt(product.stock || 0, 10) || 0),
      sku: typeof product.sku === 'string' ? product.sku : '',
      category: typeof product.category === 'string' ? product.category : '',
      variants: Array.isArray(product.variants) ? product.variants.map((variant) => ({
        id: variant && variant.id ? String(variant.id) : generateId('v'),
        name: variant && variant.name ? String(variant.name).trim() : '',
        options: Array.isArray(variant && variant.options) ? variant.options.map((option) => ({
          label: option && option.label ? String(option.label).trim() : '',
          price: parsePrice(option && option.price),
          stock: Math.max(0, parseInt(option && option.stock || 0, 10) || 0),
          sku: option && option.sku ? String(option.sku).trim() : ''
        })).filter((option) => option.label) : []
      })).filter((variant) => variant.name && variant.options.length) : [],
      reviews: Array.isArray(product.reviews) ? product.reviews.map((review) => ({
        id: review && review.id ? String(review.id) : generateId('rev'),
        customerName: review && review.customerName ? String(review.customerName).trim() : 'Customer',
        rating: Math.max(1, Math.min(5, Number(review && review.rating || 5))),
        comment: review && review.comment ? String(review.comment).trim() : '',
        createdAt: review && review.createdAt ? review.createdAt : new Date().toISOString()
      })).filter((review) => review.comment) : [],
      active: product.active !== false,
      createdAt: product.createdAt || new Date().toISOString(),
      updatedAt: product.updatedAt || ''
    }));
    store.orders = store.orders.map((order) => ({
      id: order.id || generateId('ord'),
      orderNumber: order.orderNumber || order.id || generateId('ord'),
      trackingCode: order.trackingCode || order.id || generateTrackingCode(),
      productId: typeof order.productId === 'string' ? order.productId : '',
      productName: typeof order.productName === 'string' ? order.productName : '',
      items: Array.isArray(order.items) ? order.items.map((item) => ({
        productId: item && item.productId ? String(item.productId) : '',
        name: item && item.name ? String(item.name) : '',
        price: parsePrice(item && item.price),
        quantity: Math.max(1, parseInt(item && item.quantity || 1, 10) || 1),
        variantSummary: item && item.variantSummary ? String(item.variantSummary) : '',
        sku: item && item.sku ? String(item.sku) : ''
      })) : [],
      customerName: typeof order.customerName === 'string' ? order.customerName : '',
      customerPhone: typeof order.customerPhone === 'string' ? order.customerPhone : '',
      customerEmail: typeof order.customerEmail === 'string' ? order.customerEmail : '',
      shippingAddress: typeof order.shippingAddress === 'string' ? order.shippingAddress : '',
      notes: typeof order.notes === 'string' ? order.notes : '',
      paymentMethod: typeof order.paymentMethod === 'string' ? order.paymentMethod : 'cod',
      paymentMode: typeof order.paymentMode === 'string' ? order.paymentMode : (typeof order.paymentMethod === 'string' ? order.paymentMethod : 'cod'),
      status: ORDER_STATUSES.includes(order.status) ? order.status : 'pending',
      amount: parsePrice(order.amount),
      subtotal: parsePrice(order.subtotal),
      shippingFee: parsePrice(order.shippingFee),
      taxAmount: parsePrice(order.taxAmount),
      discountCode: typeof order.discountCode === 'string' ? order.discountCode : '',
      discountAmount: parsePrice(order.discountAmount),
      trackingHistory: Array.isArray(order.trackingHistory) ? order.trackingHistory : [],
      createdAt: order.createdAt || new Date().toISOString()
    }));
  });

  return safe;
}

let _dbCache = null;
let _dbCacheTime = 0;
let _dbRefreshPromise = null;
const DB_CACHE_TTL = Math.max(5000, Number(process.env.DB_CACHE_TTL_MS || 5 * 60 * 1000));
const DB_CACHE_MAX_STALE = Math.max(DB_CACHE_TTL, Number(process.env.DB_CACHE_MAX_STALE_MS || 30 * 60 * 1000));
const APP_DATA_MIRROR_DELAY = 2000;
const VISIT_FLUSH_DELAY = 5000;
const _pendingVisitCounts = new Map();
let _visitFlushTimer = null;
let _visitFlushChain = Promise.resolve();
let _pendingAppDataMirror = null;
let _appDataMirrorTimer = null;
let _appDataMirrorChain = Promise.resolve();

function scheduleAppDataMirror(db) {
  _pendingAppDataMirror = normalizeDB(db);
  if (_appDataMirrorTimer) return;
  _appDataMirrorTimer = setTimeout(() => {
    _appDataMirrorTimer = null;
    _appDataMirrorChain = _appDataMirrorChain
      .then(() => flushAppDataMirror())
      .catch((error) => {
        console.error('[DB] Background app_data mirror failed.', error && error.message ? error.message : error);
      });
  }, APP_DATA_MIRROR_DELAY);
  if (_appDataMirrorTimer && typeof _appDataMirrorTimer.unref === 'function') {
    _appDataMirrorTimer.unref();
  }
}

async function flushAppDataMirror() {
  if (!_pendingAppDataMirror) return;
  const snapshot = _pendingAppDataMirror;
  _pendingAppDataMirror = null;
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('app_data').upsert([buildSupabaseMainRow(snapshot)], { onConflict: 'key' });
    if (error) throw error;
  } catch (error) {
    if (!_pendingAppDataMirror) {
      _pendingAppDataMirror = snapshot;
    }
    scheduleAppDataMirror(_pendingAppDataMirror);
    throw error;
  }
}

function scheduleVisitFlush() {
  if (_visitFlushTimer) return;
  _visitFlushTimer = setTimeout(() => {
    _visitFlushTimer = null;
    _visitFlushChain = _visitFlushChain
      .then(() => flushPendingStoreVisits())
      .catch((error) => {
        console.error('[DB] Pending visit flush failed.', error && error.message ? error.message : error);
      });
  }, VISIT_FLUSH_DELAY);
  if (_visitFlushTimer && typeof _visitFlushTimer.unref === 'function') {
    _visitFlushTimer.unref();
  }
}

function recordStoreVisit(slug) {
  const safeSlug = String(slug || '').trim();
  if (!safeSlug) return;
  _pendingVisitCounts.set(safeSlug, (_pendingVisitCounts.get(safeSlug) || 0) + 1);
  scheduleVisitFlush();
}

async function flushPendingStoreVisits() {
  if (!_pendingVisitCounts.size) return;
  const entries = Array.from(_pendingVisitCounts.entries());
  _pendingVisitCounts.clear();
  try {
    const db = await loadDB();
    let changed = false;
    entries.forEach(([slug, count]) => {
      const store = db && db.stores ? db.stores[slug] : null;
      if (!store) return;
      store.visits = Number(store.visits || 0) + Number(count || 0);
      changed = true;
    });
    if (changed) {
      await saveDB(db);
    }
  } catch (error) {
    entries.forEach(([slug, count]) => {
      _pendingVisitCounts.set(slug, (_pendingVisitCounts.get(slug) || 0) + count);
    });
    scheduleVisitFlush();
    throw error;
  }
}

function writeLocalDBSync(db) {
  const normalized = normalizeDB(db);
  const tempPath = DB_PATH + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(normalized, null, 2), 'utf8');
  fs.renameSync(tempPath, DB_PATH);
  return normalized;
}

function syncLocalBackupFromRemote(db) {
  try {
    writeLocalDBSync(db);
  } catch (error) {
    console.error('[DB] Local backup sync from remote failed.', error.message || error);
  }
}

function readLocalDBSync() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return writeLocalDBSync(cloneDefaultDB());
    }
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    if (!raw.trim()) {
      return writeLocalDBSync(cloneDefaultDB());
    }
    return normalizeDB(JSON.parse(raw));
  } catch (error) {
    return writeLocalDBSync(cloneDefaultDB());
  }
}

function hasMeaningfulData(db) {
  return !!(db && typeof db === 'object' && ((db.users && Object.keys(db.users).length) || (db.stores && Object.keys(db.stores).length)));
}

function buildSupabaseMainRow(value) {
  return {
    key: 'main',
    value,
    updated_at: new Date().toISOString()
  };
}

const RELATIONAL_SCHEMA_TTL = 60000;
const RELATIONAL_PROBES = {
  users: 'id,email,name,phone,password_hash,store_slug,created_at,updated_at,payload',
  stores: 'slug,owner_id,name,description,whatsapp,logo,template,theme,theme_config,store_settings,categories,collections,pages,discounts,subdomain,visits,created_at,updated_at,payload',
  products: 'id,store_slug,name,description,price,compare_price,stock,sku,image,images,variants,categories,tags,active,created_at,updated_at,payload',
  orders: 'id,store_slug,order_number,tracking_code,customer_name,customer_phone,customer_email,shipping_address,notes,payment_method,status,amount,subtotal,shipping_fee,tax_amount,discount_amount,discount_code,items,tracking_history,created_at,updated_at,payload',
  customers: 'id,store_slug,email,name,phone,password_hash,addresses,wishlist,order_ids,created_at,updated_at,payload',
  app_config: 'key,value,updated_at'
};
const RELATIONAL_ORDERS = {
  users: 'id',
  stores: 'slug',
  products: 'id',
  orders: 'id',
  customers: 'id',
  app_config: 'key'
};
let _relationalSchemaReady = null;
let _relationalSchemaTime = 0;
let _relationalModeLogged = false;

async function ensureSupabaseSchema() {
  const supabase = getSupabase();
  if (!supabase) return false;
  if (_schemaEnsurePromise) return _schemaEnsurePromise;
  _schemaEnsurePromise = (async () => {
    try {
      if (await isRelationalSchemaReady(supabase)) return true;
      const connectionString = getSupabaseDbConnectionString();
      if (!connectionString) {
        console.warn('[DB] SUPABASE_DB_URL/DATABASE_URL not set. Auto schema migration skipped.');
        return false;
      }
      await withSqlClient(async (client) => {
        for (const statement of SCHEMA_SQL_STATEMENTS) {
          await client.query(statement);
        }
      });
      _relationalSchemaReady = null;
      _relationalSchemaTime = 0;
      return isRelationalSchemaReady(supabase);
    } catch (error) {
      console.error('[DB] Schema ensure failed.', error && error.message ? error.message : error);
      return false;
    }
  })().finally(() => {
    _schemaEnsurePromise = null;
  });
  return _schemaEnsurePromise;
}

async function loadAppConfigMap(supabase) {
  const rows = await fetchAllRows(supabase, 'app_config', RELATIONAL_PROBES.app_config);
  return rows.reduce((acc, row) => {
    if (row && row.key) acc[String(row.key)] = row.value;
    return acc;
  }, {});
}

async function saveAppConfigEntries(supabase, entries) {
  const rows = Object.entries(entries || {}).filter(([key, value]) => key && value !== undefined && value !== null).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString()
  }));
  if (!rows.length) return;
  await upsertRelationalRows(supabase, 'app_config', rows, 'key');
}

function getIsoTimestamp(value) {
  return String(value || '').trim() || new Date().toISOString();
}

function normalizePayload(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function omitKeys(source, keys) {
  const blocked = new Set(keys);
  return Object.keys(source && typeof source === 'object' ? source : {}).reduce((acc, key) => {
    if (!blocked.has(key)) acc[key] = source[key];
    return acc;
  }, {});
}

function countDbEntities(db) {
  const normalized = normalizeDB(db || {});
  let total = Object.keys(normalized.users || {}).length + Object.keys(normalized.stores || {}).length;
  Object.values(normalized.stores || {}).forEach((store) => {
    total += Array.isArray(store.products) ? store.products.length : 0;
    total += Array.isArray(store.orders) ? store.orders.length : 0;
    total += Object.keys(store.customers || {}).length;
  });
  return total;
}

function pickRicherDB(primary, secondary) {
  return countDbEntities(secondary) > countDbEntities(primary) ? secondary : primary;
}

function mergeSupplementalDb(base, supplemental) {
  const normalized = normalizeDB(base || {});
  const extra = supplemental && typeof supplemental === 'object' ? supplemental : null;
  if (extra && extra.superAdmin && !normalized.superAdmin) {
    normalized.superAdmin = extra.superAdmin;
  }
  return normalized;
}

async function isRelationalSchemaReady(supabase) {
  const now = Date.now();
  if (_relationalSchemaReady !== null && (now - _relationalSchemaTime) < RELATIONAL_SCHEMA_TTL) {
    return _relationalSchemaReady;
  }
  try {
    for (const [table, columns] of Object.entries(RELATIONAL_PROBES)) {
      const { error } = await supabase.from(table).select(columns, { head: true, count: 'exact' }).limit(1);
      if (error) throw error;
    }
    _relationalSchemaReady = true;
  } catch (error) {
    _relationalSchemaReady = false;
  }
  _relationalSchemaTime = now;
  return _relationalSchemaReady;
}

async function fetchAllRows(supabase, table, columns) {
  const orderColumn = RELATIONAL_ORDERS[table] || 'id';
  const pageSize = 1000;
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(columns).order(orderColumn, { ascending: true }).range(offset, offset + pageSize - 1);
    if (error) throw error;
    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function loadLegacySupabaseSnapshot(supabase) {
  const { data, error } = await supabase.from('app_data').select('value').eq('key', 'main').maybeSingle();
  if (error) throw error;
  if (!data || !data.value || typeof data.value !== 'object') return null;
  return normalizeDB(data.value);
}

function mapUserToRow(user) {
  const safeUser = user && typeof user === 'object' ? user : {};
  return {
    id: String(safeUser.id || safeUser.email || ''),
    email: String(safeUser.email || safeUser.id || '').trim().toLowerCase(),
    name: String(safeUser.name || '').trim(),
    phone: String(safeUser.phone || '').trim(),
    password_hash: String(safeUser.passwordHash || '').trim(),
    store_slug: String(safeUser.storeSlug || '').trim(),
    created_at: getIsoTimestamp(safeUser.createdAt),
    updated_at: getIsoTimestamp(safeUser.updatedAt || safeUser.createdAt),
    payload: omitKeys(safeUser, ['id', 'email', 'name', 'phone', 'passwordHash', 'storeSlug', 'createdAt', 'updatedAt'])
  };
}

function mapStoreToRow(store) {
  const safeStore = store && typeof store === 'object' ? store : {};
  return {
    slug: String(safeStore.slug || '').trim(),
    owner_id: String(safeStore.ownerId || '').trim(),
    name: String(safeStore.name || '').trim(),
    description: String(safeStore.description || '').trim(),
    whatsapp: String(safeStore.whatsapp || '').trim(),
    logo: String(safeStore.logo || '').trim(),
    template: String(safeStore.template || 'app-style').trim() || 'app-style',
    theme: String(safeStore.theme || 'default').trim() || 'default',
    theme_config: safeStore.themeConfig && typeof safeStore.themeConfig === 'object' ? safeStore.themeConfig : {},
    store_settings: safeStore.storeSettings && typeof safeStore.storeSettings === 'object' ? safeStore.storeSettings : {},
    categories: Array.isArray(safeStore.categories) ? safeStore.categories : [],
    collections: Array.isArray(safeStore.collections) ? safeStore.collections : [],
    pages: Array.isArray(safeStore.pages) ? safeStore.pages : [],
    discounts: Array.isArray(safeStore.discounts) ? safeStore.discounts : [],
    subdomain: String(safeStore.subdomain || '').trim(),
    visits: Number(safeStore.visits || 0),
    created_at: getIsoTimestamp(safeStore.createdAt),
    updated_at: getIsoTimestamp(safeStore.updatedAt || safeStore.createdAt),
    payload: omitKeys(safeStore, ['slug', 'ownerId', 'name', 'description', 'whatsapp', 'logo', 'template', 'theme', 'themeConfig', 'storeSettings', 'categories', 'collections', 'pages', 'discounts', 'subdomain', 'visits', 'createdAt', 'updatedAt', 'products', 'orders', 'customers'])
  };
}

function mapProductToRow(storeSlug, product) {
  const safeProduct = product && typeof product === 'object' ? product : {};
  const categories = Array.isArray(safeProduct.categories)
    ? safeProduct.categories
    : (safeProduct.category ? [String(safeProduct.category)] : []);
  return {
    id: String(safeProduct.id || ''),
    store_slug: String(storeSlug || '').trim(),
    name: String(safeProduct.name || '').trim(),
    description: String(safeProduct.description || '').trim(),
    price: parsePrice(safeProduct.price),
    compare_price: parsePrice(safeProduct.comparePrice || safeProduct.mrp || 0),
    stock: Math.max(0, parseInt(safeProduct.stock || 0, 10) || 0),
    image: String(safeProduct.image || '').trim(),
    images: Array.isArray(safeProduct.images) ? safeProduct.images.filter(Boolean) : (safeProduct.image ? [safeProduct.image] : []),
    variants: Array.isArray(safeProduct.variants) ? safeProduct.variants : [],
    categories,
    tags: Array.isArray(safeProduct.tags) ? safeProduct.tags : [],
    sku: String(safeProduct.sku || '').trim(),
    active: safeProduct.active !== false,
    created_at: getIsoTimestamp(safeProduct.createdAt),
    updated_at: getIsoTimestamp(safeProduct.updatedAt || safeProduct.createdAt),
    payload: omitKeys(safeProduct, ['id', 'name', 'description', 'price', 'comparePrice', 'mrp', 'stock', 'image', 'images', 'variants', 'category', 'categories', 'tags', 'sku', 'active', 'createdAt', 'updatedAt'])
  };
}

function mapOrderToRow(storeSlug, order) {
  const safeOrder = order && typeof order === 'object' ? order : {};
  return {
    id: String(safeOrder.id || ''),
    store_slug: String(storeSlug || '').trim(),
    order_number: String(safeOrder.orderNumber || safeOrder.id || '').trim(),
    tracking_code: String(safeOrder.trackingCode || safeOrder.id || '').trim(),
    customer_name: String(safeOrder.customerName || '').trim(),
    customer_phone: String(safeOrder.customerPhone || '').trim(),
    customer_email: String(safeOrder.customerEmail || '').trim().toLowerCase(),
    shipping_address: String(safeOrder.shippingAddress || '').trim(),
    notes: String(safeOrder.notes || '').trim(),
    payment_method: String(safeOrder.paymentMethod || 'cod').trim() || 'cod',
    amount: parsePrice(safeOrder.amount),
    subtotal: parsePrice(safeOrder.subtotal),
    shipping_fee: parsePrice(safeOrder.shippingFee),
    tax_amount: parsePrice(safeOrder.taxAmount),
    discount_amount: parsePrice(safeOrder.discountAmount),
    discount_code: String(safeOrder.discountCode || '').trim(),
    items: Array.isArray(safeOrder.items) ? safeOrder.items : [],
    tracking_history: Array.isArray(safeOrder.trackingHistory) ? safeOrder.trackingHistory : [],
    status: String(safeOrder.status || 'pending').trim() || 'pending',
    created_at: getIsoTimestamp(safeOrder.createdAt),
    updated_at: getIsoTimestamp(safeOrder.updatedAt || safeOrder.createdAt),
    payload: omitKeys(safeOrder, ['id', 'orderNumber', 'trackingCode', 'customerName', 'customerPhone', 'customerEmail', 'shippingAddress', 'notes', 'paymentMethod', 'status', 'amount', 'subtotal', 'shippingFee', 'taxAmount', 'discountAmount', 'discountCode', 'items', 'trackingHistory', 'createdAt', 'updatedAt'])
  };
}

function mapCustomerToRow(storeSlug, customer) {
  const safeCustomer = customer && typeof customer === 'object' ? customer : {};
  const email = String(safeCustomer.email || safeCustomer.id || '').trim().toLowerCase();
  return {
    id: String(safeCustomer.id || (email ? `${storeSlug}:${email}` : '')),
    store_slug: String(storeSlug || '').trim(),
    email,
    name: String(safeCustomer.name || '').trim(),
    phone: String(safeCustomer.phone || '').trim(),
    password_hash: String(safeCustomer.passwordHash || '').trim(),
    addresses: Array.isArray(safeCustomer.addresses) ? safeCustomer.addresses : [],
    wishlist: Array.isArray(safeCustomer.wishlist) ? safeCustomer.wishlist : [],
    order_ids: Array.isArray(safeCustomer.orders) ? safeCustomer.orders : [],
    created_at: getIsoTimestamp(safeCustomer.createdAt),
    updated_at: getIsoTimestamp(safeCustomer.updatedAt || safeCustomer.createdAt),
    payload: omitKeys(safeCustomer, ['id', 'email', 'phone', 'name', 'passwordHash', 'addresses', 'wishlist', 'orders', 'createdAt', 'updatedAt'])
  };
}

function buildRelationalRows(db) {
  const normalized = normalizeDB(db || {});
  const users = Object.values(normalized.users || {}).map(mapUserToRow).filter((row) => row.id && row.email);
  const stores = Object.values(normalized.stores || {}).map(mapStoreToRow).filter((row) => row.slug && row.owner_id);
  const products = [];
  const orders = [];
  const customers = [];
  Object.values(normalized.stores || {}).forEach((store) => {
    const slug = String(store && store.slug || '').trim();
    (Array.isArray(store && store.products) ? store.products : []).forEach((product) => {
      const row = mapProductToRow(slug, product);
      if (row.id && row.store_slug) products.push(row);
    });
    (Array.isArray(store && store.orders) ? store.orders : []).forEach((order) => {
      const row = mapOrderToRow(slug, order);
      if (row.id && row.store_slug) orders.push(row);
    });
    Object.values(store && store.customers && typeof store.customers === 'object' ? store.customers : {}).forEach((customer) => {
      const row = mapCustomerToRow(slug, customer);
      if (row.id && row.store_slug) customers.push(row);
    });
  });
  return { users, stores, products, orders, customers };
}

function collectRelationalIds(db) {
  const rows = buildRelationalRows(db);
  return {
    users: rows.users.map((row) => row.id),
    stores: rows.stores.map((row) => row.slug),
    products: rows.products.map((row) => row.id),
    orders: rows.orders.map((row) => row.id),
    customers: rows.customers.map((row) => row.id)
  };
}

function diffRemovedIds(previousDb, nextDb) {
  const previous = previousDb ? collectRelationalIds(previousDb) : { users: [], stores: [], products: [], orders: [], customers: [] };
  const next = collectRelationalIds(nextDb);
  return {
    users: previous.users.filter((id) => !next.users.includes(id)),
    stores: previous.stores.filter((id) => !next.stores.includes(id)),
    products: previous.products.filter((id) => !next.products.includes(id)),
    orders: previous.orders.filter((id) => !next.orders.includes(id)),
    customers: previous.customers.filter((id) => !next.customers.includes(id))
  };
}

function mapUserRowToObject(row) {
  const payload = normalizePayload(row && row.payload);
  const user = {
    ...payload,
    id: String(row && row.id || ''),
    email: String(row && row.email || row && row.id || '').trim().toLowerCase(),
    name: String(row && row.name || '').trim(),
    phone: String(row && row.phone || '').trim(),
    passwordHash: String(row && row.password_hash || '').trim(),
    storeSlug: String(row && row.store_slug || '').trim(),
    createdAt: getIsoTimestamp(row && row.created_at),
    updatedAt: getIsoTimestamp(row && (row.updated_at || row.created_at))
  };
  return user;
}

function mapStoreRowToObject(row) {
  const payload = normalizePayload(row && row.payload);
  return {
    ...payload,
    slug: String(row && row.slug || '').trim(),
    ownerId: String(row && row.owner_id || '').trim(),
    name: String(row && row.name || '').trim(),
    description: String(row && row.description || '').trim(),
    whatsapp: String(row && row.whatsapp || '').trim(),
    logo: String(row && row.logo || '').trim(),
    template: String(row && row.template || 'app-style').trim() || 'app-style',
    theme: String(row && row.theme || 'default').trim() || 'default',
    themeConfig: row && row.theme_config && typeof row.theme_config === 'object' ? row.theme_config : (payload.themeConfig && typeof payload.themeConfig === 'object' ? payload.themeConfig : {}),
    storeSettings: row && row.store_settings && typeof row.store_settings === 'object' ? row.store_settings : (payload.storeSettings && typeof payload.storeSettings === 'object' ? payload.storeSettings : {}),
    categories: Array.isArray(row && row.categories) ? row.categories : (Array.isArray(payload.categories) ? payload.categories : []),
    collections: Array.isArray(row && row.collections) ? row.collections : (Array.isArray(payload.collections) ? payload.collections : []),
    pages: Array.isArray(row && row.pages) ? row.pages : (Array.isArray(payload.pages) ? payload.pages : []),
    discounts: Array.isArray(row && row.discounts) ? row.discounts : (Array.isArray(payload.discounts) ? payload.discounts : []),
    subdomain: String(row && row.subdomain || '').trim(),
    visits: Number(row && row.visits || 0),
    createdAt: getIsoTimestamp(row && row.created_at),
    updatedAt: getIsoTimestamp(row && (row.updated_at || row.created_at)),
    products: [],
    orders: [],
    customers: {}
  };
}

function mapProductRowToObject(row) {
  const payload = normalizePayload(row && row.payload);
  const categories = Array.isArray(row && row.categories) ? row.categories : (Array.isArray(payload.categories) ? payload.categories : []);
  return {
    ...payload,
    id: String(row && row.id || ''),
    name: String(row && row.name || '').trim(),
    description: String(row && row.description || '').trim(),
    price: parsePrice(row && row.price),
    comparePrice: parsePrice(row && row.compare_price),
    mrp: parsePrice(row && row.compare_price),
    stock: Math.max(0, parseInt(row && row.stock || 0, 10) || 0),
    image: String(row && row.image || '').trim(),
    images: Array.isArray(row && row.images) ? row.images.filter(Boolean) : (String(row && row.image || '').trim() ? [String(row && row.image).trim()] : []),
    variants: Array.isArray(row && row.variants) ? row.variants : [],
    category: categories[0] || String(payload.category || '').trim(),
    categories,
    tags: Array.isArray(row && row.tags) ? row.tags : (Array.isArray(payload.tags) ? payload.tags : []),
    sku: String(row && row.sku || '').trim(),
    active: row && row.active !== false,
    createdAt: getIsoTimestamp(row && row.created_at),
    updatedAt: getIsoTimestamp(row && (row.updated_at || row.created_at))
  };
}

function mapOrderRowToObject(row) {
  const payload = normalizePayload(row && row.payload);
  return {
    ...payload,
    id: String(row && row.id || ''),
    orderNumber: String(row && row.order_number || row && row.id || '').trim(),
    trackingCode: String(row && row.tracking_code || row && row.id || '').trim(),
    customerName: String(row && row.customer_name || '').trim(),
    customerPhone: String(row && row.customer_phone || '').trim(),
    customerEmail: String(row && row.customer_email || '').trim().toLowerCase(),
    shippingAddress: String(row && row.shipping_address || '').trim(),
    notes: String(row && row.notes || '').trim(),
    paymentMethod: String(row && row.payment_method || 'cod').trim() || 'cod',
    amount: parsePrice(row && row.amount),
    subtotal: parsePrice(row && row.subtotal),
    shippingFee: parsePrice(row && row.shipping_fee),
    taxAmount: parsePrice(row && row.tax_amount),
    discountAmount: parsePrice(row && row.discount_amount),
    discountCode: String(row && row.discount_code || '').trim(),
    items: Array.isArray(row && row.items) ? row.items : [],
    trackingHistory: Array.isArray(row && row.tracking_history) ? row.tracking_history : [],
    status: String(row && row.status || 'pending').trim() || 'pending',
    createdAt: getIsoTimestamp(row && row.created_at),
    updatedAt: getIsoTimestamp(row && (row.updated_at || row.created_at))
  };
}

function mapCustomerRowToObject(row) {
  const payload = normalizePayload(row && row.payload);
  return {
    ...payload,
    id: String(row && row.id || row && row.email || ''),
    email: String(row && row.email || row && row.id || '').trim().toLowerCase(),
    name: String(row && row.name || '').trim(),
    phone: String(row && row.phone || '').trim(),
    passwordHash: String(row && row.password_hash || '').trim(),
    addresses: Array.isArray(row && row.addresses) ? row.addresses : (Array.isArray(payload.addresses) ? payload.addresses : []),
    wishlist: Array.isArray(row && row.wishlist) ? row.wishlist : (Array.isArray(payload.wishlist) ? payload.wishlist : []),
    orders: Array.isArray(row && row.order_ids) ? row.order_ids : (Array.isArray(payload.orders) ? payload.orders : []),
    createdAt: getIsoTimestamp(row && row.created_at),
    updatedAt: getIsoTimestamp(row && (row.updated_at || row.created_at))
  };
}

async function loadRelationalDB(supabase, supplementalDb) {
  const [userRows, storeRows, productRows, orderRows, customerRows, appConfig] = await Promise.all([
    fetchAllRows(supabase, 'users', RELATIONAL_PROBES.users),
    fetchAllRows(supabase, 'stores', RELATIONAL_PROBES.stores),
    fetchAllRows(supabase, 'products', RELATIONAL_PROBES.products),
    fetchAllRows(supabase, 'orders', RELATIONAL_PROBES.orders),
    fetchAllRows(supabase, 'customers', RELATIONAL_PROBES.customers),
    loadAppConfigMap(supabase)
  ]);
  const db = cloneDefaultDB();
  db.superAdmin = appConfig.superAdmin || (supplementalDb && supplementalDb.superAdmin ? supplementalDb.superAdmin : null);
  db.templates = Array.isArray(appConfig.templates) && appConfig.templates.length ? appConfig.templates : DEFAULT_TEMPLATES;
  userRows.forEach((row) => {
    const user = mapUserRowToObject(row);
    if (user.id) db.users[user.id] = user;
  });
  storeRows.forEach((row) => {
    const store = mapStoreRowToObject(row);
    if (store.slug) db.stores[store.slug] = store;
  });
  productRows.forEach((row) => {
    const slug = String(row && row.store_slug || '').trim();
    if (!db.stores[slug]) return;
    db.stores[slug].products.push(mapProductRowToObject(row));
  });
  orderRows.forEach((row) => {
    const slug = String(row && row.store_slug || '').trim();
    if (!db.stores[slug]) return;
    db.stores[slug].orders.push(mapOrderRowToObject(row));
  });
  customerRows.forEach((row) => {
    const slug = String(row && row.store_slug || '').trim();
    if (!db.stores[slug]) return;
    const customer = mapCustomerRowToObject(row);
    if (customer.email) db.stores[slug].customers[customer.email] = customer;
  });
  return normalizeDB(db);
}

async function upsertRelationalRows(supabase, table, rows, conflictColumn) {
  if (!rows.length) return;
  const chunkSize = 200;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: conflictColumn });
    if (error) throw error;
  }
}

async function deleteMissingRelationalRows(supabase, table, keyColumn, activeKeys) {
  const existingRows = await fetchAllRows(supabase, table, keyColumn);
  const existingKeys = existingRows.map((row) => String(row && row[keyColumn] || '')).filter(Boolean);
  const activeSet = new Set((activeKeys || []).map((value) => String(value || '')).filter(Boolean));
  const toDelete = existingKeys.filter((value) => !activeSet.has(value));
  const chunkSize = 200;
  for (let index = 0; index < toDelete.length; index += chunkSize) {
    const chunk = toDelete.slice(index, index + chunkSize);
    const { error } = await supabase.from(table).delete().in(keyColumn, chunk);
    if (error) throw error;
  }
}

async function deleteRelationalRowsByIds(supabase, table, keyColumn, ids) {
  const cleanIds = Array.isArray(ids) ? ids.map((value) => String(value || '')).filter(Boolean) : [];
  if (!cleanIds.length) return;
  const chunkSize = 200;
  for (let index = 0; index < cleanIds.length; index += chunkSize) {
    const chunk = cleanIds.slice(index, index + chunkSize);
    const { error } = await supabase.from(table).delete().in(keyColumn, chunk);
    if (error) throw error;
  }
}

async function saveRelationalDB(supabase, db, previousDb) {
  const rows = buildRelationalRows(db);
  const removed = diffRemovedIds(previousDb, db);
  await saveAppConfigEntries(supabase, {
    superAdmin: db.superAdmin || null,
    templates: Array.isArray(db.templates) && db.templates.length ? db.templates : DEFAULT_TEMPLATES
  });
  await upsertRelationalRows(supabase, 'users', rows.users, 'id');
  await upsertRelationalRows(supabase, 'stores', rows.stores, 'slug');
  await Promise.all([
    upsertRelationalRows(supabase, 'products', rows.products, 'id'),
    upsertRelationalRows(supabase, 'orders', rows.orders, 'id'),
    upsertRelationalRows(supabase, 'customers', rows.customers, 'id')
  ]);
  await Promise.all([
    deleteRelationalRowsByIds(supabase, 'customers', 'id', removed.customers),
    deleteRelationalRowsByIds(supabase, 'orders', 'id', removed.orders),
    deleteRelationalRowsByIds(supabase, 'products', 'id', removed.products)
  ]);
  await deleteRelationalRowsByIds(supabase, 'stores', 'slug', removed.stores);
  await deleteRelationalRowsByIds(supabase, 'users', 'id', removed.users);
}

async function migrateFromBlobToTables() {
  const supabase = getSupabase();
  if (!supabase) return false;
  let schemaReady = false;
  try {
    schemaReady = await ensureSupabaseSchema();
  } catch (error) {
    console.error('[MIGRATION] Schema ensure failed before migration.', error && error.message ? error.message : error);
    return false;
  }
  if (!schemaReady) {
    console.warn('[MIGRATION] Schema not ready. Skipping blob migration.');
    return false;
  }

  try {
    const { data: migrated, error: migratedError } = await supabase.from('app_config').select('value').eq('key', 'migration_done').maybeSingle();
    if (migratedError && migratedError.code !== 'PGRST116') throw migratedError;
    if (migrated && migrated.value === true) {
      console.log('[MIGRATION] Already done. Skipping.');
      return true;
    }

    console.log('[MIGRATION] Starting blob to tables migration...');
    const blobData = await loadLegacySupabaseSnapshot(supabase);
    const source = pickRicherDB(blobData, readLocalDBSync());
    if (!hasMeaningfulData(source)) {
      console.log('[MIGRATION] No blob data found.');
      return false;
    }

    const normalized = normalizeDB(source);
    await saveRelationalDB(supabase, normalized, null);
    await saveAppConfigEntries(supabase, {
      superAdmin: normalized.superAdmin || undefined,
      templates: Array.isArray(normalized.templates) && normalized.templates.length ? normalized.templates : DEFAULT_TEMPLATES,
      migration_done: true
    });
    _dbCache = normalized;
    _dbCacheTime = Date.now();
    syncLocalBackupFromRemote(normalized);
    console.log(`[MIGRATION] Complete. stores=${Object.keys(normalized.stores || {}).length} users=${Object.keys(normalized.users || {}).length}`);
    return true;
  } catch (error) {
    console.error('[MIGRATION] Failed.', error && error.message ? error.message : error);
    return false;
  }
}

async function refreshDBFromSource() {
  const now = Date.now();
  const supabase = getSupabase();
  if (supabase) {
    try {
      const relationalReady = await isRelationalSchemaReady(supabase) || await ensureSupabaseSchema();
      if (relationalReady) {
        if (!_relationalModeLogged) {
          console.log('[DB] Relational Supabase tables active.');
          _relationalModeLogged = true;
        }
        const supplemental = readLocalDBSync();
        const relational = await loadRelationalDB(supabase, supplemental);
        if (!hasMeaningfulData(relational) && hasMeaningfulData(supplemental)) {
          await saveRelationalDB(supabase, supplemental, null);
          console.log('[DB] Seeded relational tables from legacy backup.');
          _dbCache = mergeSupplementalDb(supplemental, supplemental);
        } else {
          _dbCache = mergeSupplementalDb(relational, supplemental);
        }
        syncLocalBackupFromRemote(_dbCache);
        _dbCacheTime = now;
        return _dbCache;
      }

      const legacy = await loadLegacySupabaseSnapshot(supabase);
      if (legacy) {
        const localBackup = readLocalDBSync();
        _dbCache = hasMeaningfulData(legacy) || !hasMeaningfulData(localBackup) ? legacy : localBackup;
        if (_dbCache === legacy) syncLocalBackupFromRemote(_dbCache);
        _dbCacheTime = now;
        return _dbCache;
      }
    } catch (error) {
      console.error('[DB] Supabase load failed. Falling back to local JSON.', error.message || error);
    }
  }
  _dbCache = readLocalDBSync();
  _dbCacheTime = now;
  return _dbCache;
}

function getStaleCache() {
  if (!_dbCache) return null;
  const age = Date.now() - _dbCacheTime;
  if (age > DB_CACHE_MAX_STALE) return null;
  return _dbCache;
}

function queueDBRefresh() {
  if (_dbRefreshPromise) return _dbRefreshPromise;
  _dbRefreshPromise = refreshDBFromSource()
    .catch((error) => {
      throw error;
    })
    .finally(() => {
      _dbRefreshPromise = null;
    });
  return _dbRefreshPromise;
}

async function loadDB() {
  const now = Date.now();
  if (_dbCache && (now - _dbCacheTime) < DB_CACHE_TTL) return _dbCache;
  if (!_dbCache) {
    _dbCache = readLocalDBSync();
    _dbCacheTime = now;
    queueDBRefresh().catch((error) => {
      console.error('[DB] Background refresh failed.', error && error.message ? error.message : error);
    });
    return _dbCache;
  }
  const stale = getStaleCache();
  if (stale) {
    queueDBRefresh().catch((error) => {
      console.error('[DB] Background refresh failed.', error && error.message ? error.message : error);
    });
    return stale;
  }
  const localBackup = readLocalDBSync();
  if (hasMeaningfulData(localBackup)) {
    _dbCache = localBackup;
    _dbCacheTime = now;
    queueDBRefresh().catch((error) => {
      console.error('[DB] Background refresh failed.', error && error.message ? error.message : error);
    });
    return _dbCache;
  }
  return queueDBRefresh();
}

async function saveDB(db) {
  const previousDb = _dbCache;
  const normalized = normalizeDB(db);
  _dbCache = normalized;
  _dbCacheTime = Date.now();
  let supabaseError = null;
  const supabase = getSupabase();
  if (supabase) {
    try {
      const relationalReady = await isRelationalSchemaReady(supabase) || await ensureSupabaseSchema();
      if (relationalReady) {
        await saveRelationalDB(supabase, normalized, previousDb);
        scheduleAppDataMirror(normalized);
      } else {
        const { error } = await supabase.from('app_data').upsert([buildSupabaseMainRow(normalized)], { onConflict: 'key' });
        if (error) throw error;
      }
    } catch (error) {
      supabaseError = error;
      console.error('[DB] Supabase save failed. Falling back to local JSON backup.', error.message || error);
    }
  }
  try {
    writeLocalDBSync(normalized);
  } catch (fileError) {
    if (supabase && !supabaseError) {
      console.error('[DB] Local JSON backup save failed.', fileError.message || fileError);
      return normalized;
    }
    throw fileError;
  }
  return normalized;
}

async function persistNormalizedDB(normalized, relationalTask) {
  _dbCache = normalized;
  _dbCacheTime = Date.now();
  let supabaseError = null;
  const supabase = getSupabase();
  if (supabase) {
    try {
      const relationalReady = await isRelationalSchemaReady(supabase) || await ensureSupabaseSchema();
      if (relationalReady) {
        if (typeof relationalTask === 'function') {
          await relationalTask(supabase, normalized);
        }
        scheduleAppDataMirror(normalized);
      } else {
        const { error } = await supabase.from('app_data').upsert([buildSupabaseMainRow(normalized)], { onConflict: 'key' });
        if (error) throw error;
      }
    } catch (error) {
      supabaseError = error;
      console.error('[DB] Targeted Supabase save failed. Falling back to local JSON backup.', error.message || error);
    }
  }
  try {
    writeLocalDBSync(normalized);
  } catch (fileError) {
    if (supabase && !supabaseError) {
      console.error('[DB] Local JSON backup save failed.', fileError.message || fileError);
      return normalized;
    }
    throw fileError;
  }
  return normalized;
}

async function findMerchantUserByEmail(email) {
  const safeEmail = String(email || '').trim().toLowerCase();
  if (!safeEmail) return null;
  if (_dbCache && _dbCache.users && _dbCache.users[safeEmail]) {
    return _dbCache.users[safeEmail];
  }
  const supabase = getSupabase();
  if (supabase && await isRelationalSchemaReady(supabase)) {
    const { data, error } = await supabase.from('users').select(RELATIONAL_PROBES.users).eq('email', safeEmail).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const user = mapUserRowToObject(data);
    if (_dbCache && _dbCache.users) _dbCache.users[safeEmail] = user;
    return user;
  }
  const db = await loadDB();
  return db.users[safeEmail] || null;
}

async function findStoreCustomerByEmail(storeSlug, email) {
  const safeSlug = String(storeSlug || '').trim();
  const safeEmail = String(email || '').trim().toLowerCase();
  if (!safeSlug || !safeEmail) return null;
  if (_dbCache && _dbCache.stores && _dbCache.stores[safeSlug] && _dbCache.stores[safeSlug].customers) {
    return _dbCache.stores[safeSlug].customers[safeEmail] || null;
  }
  const supabase = getSupabase();
  if (supabase && await isRelationalSchemaReady(supabase)) {
    const { data, error } = await supabase.from('customers').select(RELATIONAL_PROBES.customers).eq('store_slug', safeSlug).eq('email', safeEmail).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const customer = mapCustomerRowToObject(data);
    if (_dbCache && _dbCache.stores && _dbCache.stores[safeSlug]) {
      _dbCache.stores[safeSlug].customers = _dbCache.stores[safeSlug].customers && typeof _dbCache.stores[safeSlug].customers === 'object' ? _dbCache.stores[safeSlug].customers : {};
      _dbCache.stores[safeSlug].customers[safeEmail] = customer;
    }
    return customer;
  }
  const db = await loadDB();
  return db.stores[safeSlug] && db.stores[safeSlug].customers ? db.stores[safeSlug].customers[safeEmail] || null : null;
}

async function saveMerchantAndStoreFast(db, user, store) {
  const normalized = normalizeDB(db);
  return persistNormalizedDB(normalized, async (supabase) => {
    await Promise.all([
      upsertRelationalRows(supabase, 'users', [mapUserToRow(user)], 'id'),
      upsertRelationalRows(supabase, 'stores', [mapStoreToRow(store)], 'slug')
    ]);
  });
}

async function saveStoreCustomerFast(db, storeSlug, customer) {
  const normalized = normalizeDB(db);
  return persistNormalizedDB(normalized, async (supabase) => {
    await upsertRelationalRows(supabase, 'customers', [mapCustomerToRow(storeSlug, customer)], 'id');
  });
}

async function saveStoreProductFast(db, storeSlug, product) {
  const normalized = normalizeDB(db);
  return persistNormalizedDB(normalized, async (supabase) => {
    await upsertRelationalRows(supabase, 'products', [mapProductToRow(storeSlug, product)], 'id');
  });
}

async function deleteStoreProductFast(db, storeSlug, productId) {
  const normalized = normalizeDB(db);
  return persistNormalizedDB(normalized, async (supabase) => {
    await deleteRelationalRowsByIds(supabase, 'products', 'id', [productId]);
  });
}

function loadSessionData() {
  try {
    if (!fs.existsSync(SESSION_PATH)) {
      fs.writeFileSync(SESSION_PATH, '{}', 'utf8');
      return {};
    }
    const raw = fs.readFileSync(SESSION_PATH, 'utf8');
    if (!raw.trim()) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function saveSessionData(data) {
  fs.writeFileSync(SESSION_PATH, JSON.stringify(data || {}, null, 2), 'utf8');
}

function ensureDirectories() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOGOS_DIR)) {
    fs.mkdirSync(LOGOS_DIR, { recursive: true });
  }
  if (!fs.existsSync(PRODUCTS_DIR)) {
    fs.mkdirSync(PRODUCTS_DIR, { recursive: true });
  }
  if (!fs.existsSync(SESSION_PATH)) {
    fs.writeFileSync(SESSION_PATH, '{}', 'utf8');
  }
}

function ensureAbsolutePath(relativePath) {
  const clean = String(relativePath || '').replace(/^\/+/, '');
  return path.join(PUBLIC_DIR, clean);
}

function getUploadPrefix(type) {
  if (type === 'logo') return 'logo';
  if (type === 'banner') return 'banner';
  if (type === 'category') return 'category';
  return 'product';
}

function getLocalUploadBase(type) {
  return type === 'logo' ? { dir: LOGOS_DIR, base: '/logos/' } : { dir: PRODUCTS_DIR, base: '/products/' };
}

function getCloudinaryFolder(type) {
  const root = String(process.env.CLOUDINARY_FOLDER || 'myshopbuilder').trim().replace(/^\/+|\/+$/g, '');
  const leaf = type === 'logo' ? 'logos' : (type === 'banner' ? 'banners' : (type === 'category' ? 'categories' : 'products'));
  return root ? `${root}/${leaf}` : leaf;
}

function isLocalUploadPath(value) {
  return value.startsWith('/logos/') || value.startsWith('/products/');
}

function buildCloudinaryStoredUrl(upload) {
  return `${upload.secure_url}#cld-public-id=${encodeURIComponent(upload.public_id)}`;
}

function extractCloudinaryPublicId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const tagged = raw.match(/#cld-public-id=([^#]+)/);
  if (tagged) {
    try {
      return decodeURIComponent(tagged[1]);
    } catch (error) {
      return tagged[1];
    }
  }
  try {
    const parsed = new URL(raw);
    if (!/res\.cloudinary\.com$/i.test(parsed.hostname)) return '';
    const uploadIndex = parsed.pathname.indexOf('/upload/');
    if (uploadIndex === -1) return '';
    let publicId = parsed.pathname.slice(uploadIndex + '/upload/'.length);
    publicId = publicId.replace(/^v\d+\//, '');
    publicId = decodeURIComponent(publicId).replace(/\.[^/.]+$/, '');
    return publicId;
  } catch (error) {
    return '';
  }
}

function uploadToCloudinary(file, type) {
  const client = getCloudinary();
  if (!client) return null;
  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream({
      resource_type: 'image',
      folder: getCloudinaryFolder(type),
      public_id: generateId(getUploadPrefix(type)),
      overwrite: false
    }, (error, result) => {
      if (error || !result) {
        reject(error || new Error('Cloudinary upload failed.'));
        return;
      }
      resolve(buildCloudinaryStoredUrl(result));
    });
    stream.end(file.buffer);
  });
}

async function removeStoredFile(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') {
    return;
  }
  const value = String(relativePath || '').trim();
  if (isLocalUploadPath(value)) {
    const absolute = ensureAbsolutePath(value);
    if (absolute.startsWith(PUBLIC_DIR) && fs.existsSync(absolute)) {
      try {
        fs.unlinkSync(absolute);
      } catch (error) {
      }
    }
    return;
  }
  const publicId = extractCloudinaryPublicId(value);
  const client = getCloudinary();
  if (!publicId || !client) {
    return;
  }
  try {
    await client.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
  } catch (error) {
    console.error('[Cloudinary] Failed to delete asset.', error && error.message ? error.message : error);
  }
}

function writeLocalUploadedFile(file, type) {
  const ext = getExtensionFromMime(file.mimetype);
  const storage = getLocalUploadBase(type);
  const filename = `${generateId(getUploadPrefix(type))}${ext}`;
  const absolutePath = path.join(storage.dir, filename);
  fs.writeFileSync(absolutePath, file.buffer);
  return `${storage.base}${filename}`;
}

async function saveUploadedFile(file, type) {
  if (!file) {
    throw new Error('No file provided.');
  }
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    throw new Error('Only JPEG, PNG, WEBP, and GIF files are allowed.');
  }
  if (!isValidImageBuffer(file.buffer)) {
    throw new Error('Invalid image file. The file may be corrupted or not a real image.');
  }
  const cloudinaryUpload = uploadToCloudinary(file, type);
  if (cloudinaryUpload) {
    try {
      return await cloudinaryUpload;
    } catch (error) {
      console.error('[Cloudinary] Upload failed. Falling back to local storage.', error && error.message ? error.message : error);
    }
  }
  return writeLocalUploadedFile(file, type);
}

function getExtensionFromMime(mime) {
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  return '.bin';
}

function isValidImageBuffer(buffer) {
  if (!buffer || buffer.length < 8) return false;
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true;
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return true;
  return false;
}

function runUploader(uploader, req, res) {
  return new Promise((resolve, reject) => {
    uploader(req, res, (error) => {
      if (error) { reject(error); return; }
      resolve();
    });
  });
}

function getDBStatus() {
  return {
    hasCache: !!_dbCache,
    cacheAgeMs: _dbCacheTime ? Math.max(0, Date.now() - _dbCacheTime) : null,
    refreshInFlight: !!_dbRefreshPromise,
    backgroundMirrorPending: !!_pendingAppDataMirror,
    usesSupabase: !!getSupabase(),
    cloudinaryEnabled: !!getCloudinary()
  };
}

class FileSessionStore extends session.Store {
  constructor() {
    super();
    this.sessions = loadSessionData();
  }

  _cleanup() {
    const now = Date.now();
    let changed = false;
    Object.keys(this.sessions).forEach((sid) => {
      const entry = this.sessions[sid];
      const expiresAt = entry && entry.cookie && entry.cookie.expires ? new Date(entry.cookie.expires).getTime() : 0;
      if (expiresAt && expiresAt <= now) {
        delete this.sessions[sid];
        changed = true;
      }
    });
    if (changed) {
      saveSessionData(this.sessions);
    }
  }

  get(sid, callback) {
    try {
      this._cleanup();
      const sessionData = this.sessions[sid];
      if (!sessionData) {
        callback(null, null);
        return;
      }
      callback(null, sessionData);
    } catch (error) {
      callback(error);
    }
  }

  set(sid, sessionData, callback) {
    try {
      this.sessions[sid] = sessionData;
      saveSessionData(this.sessions);
      callback && callback(null);
    } catch (error) {
      callback && callback(error);
    }
  }

  destroy(sid, callback) {
    try {
      delete this.sessions[sid];
      saveSessionData(this.sessions);
      callback && callback(null);
    } catch (error) {
      callback && callback(error);
    }
  }

  touch(sid, sessionData, callback) {
    try {
      if (this.sessions[sid]) {
        this.sessions[sid] = sessionData;
        saveSessionData(this.sessions);
      }
      callback && callback(null);
    } catch (error) {
      callback && callback(error);
    }
  }
}

module.exports = {
  getSupabase,
  loadDB,
  saveDB,
  migrateFromBlobToTables,
  findMerchantUserByEmail,
  findStoreCustomerByEmail,
  saveMerchantAndStoreFast,
  saveStoreCustomerFast,
  saveStoreProductFast,
  deleteStoreProductFast,
  getDBStatus,
  recordStoreVisit,
  loadSessionData,
  saveSessionData,
  cloneDefaultDB,
  cloneDefaultStoreSettings,
  ensureStoreSettings,
  normalizeDB,
  ensureDirectories,
  removeStoredFile,
  saveUploadedFile,
  runUploader,
  FileSessionStore,
  DEFAULT_TEMPLATES,
  DEFAULT_STORE_SETTINGS,
  DEFAULT_DB
};
