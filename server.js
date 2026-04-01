const express = require('express');
const session = require('express-session');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let helmet, rateLimit, MemoryStore;
try { helmet = require('helmet'); } catch (e) { console.log('[WARN] Install helmet: npm install helmet'); }
try { rateLimit = require('express-rate-limit'); } catch (e) { console.log('[WARN] Install express-rate-limit: npm install express-rate-limit'); }
try { MemoryStore = require('memorystore')(session); } catch (e) { console.log('[WARN] Install memorystore: npm install memorystore'); }

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const ROOT_DIR = __dirname;
const DB_PATH = path.join(ROOT_DIR, 'database.json');
const SESSION_PATH = path.join(ROOT_DIR, 'sessions.json');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const LOGOS_DIR = path.join(PUBLIC_DIR, 'logos');
const PRODUCTS_DIR = path.join(ROOT_DIR, 'products');

function loadEnvFile() {
  try {
    const envPath = path.join(ROOT_DIR, '.env');
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    lines.forEach((line) => {
      const trimmed = String(line || '').trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    });
  } catch (error) {
    console.error('[WARN] Unable to read .env file', error.message || error);
  }
}

loadEnvFile();

if (!process.env.SESSION_SECRET) {
  console.error('[FATAL] SESSION_SECRET environment variable is required. Set it before starting the server.');
  process.exit(1);
}
const SESSION_SECRET = process.env.SESSION_SECRET;
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ORDER_STATUSES = ['pending', 'confirmed', 'cancelled', 'delivered'];

const DEFAULT_TEMPLATES = [
  {
    id: 'app-style',
    name: 'App Style',
    description: 'Mobile-first layout like Meesho/Flipkart. Sticky header, category carousel, floating buttons.',
    colors: { primary: '#3b5bfd', secondary: '#06b6d4' },
    layout: 'app'
  },
  {
    id: 'minimal',
    name: 'Minimal Clean',
    description: 'Clean white layout like Apple. Centered content, premium typography, grid products.',
    colors: { primary: '#111827', secondary: '#64748b' },
    layout: 'minimal'
  },
  {
    id: 'bold-fashion',
    name: 'Bold Fashion',
    description: 'Large banners, big typography, dark/light contrast. Zara/H&M inspired fashion brand style.',
    colors: { primary: '#dc2626', secondary: '#111827' },
    layout: 'bold'
  }
];

const DEFAULT_DB = {
  users: {},
  stores: {},
  templates: DEFAULT_TEMPLATES,
  superAdmin: null
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      cb(new Error('Only JPEG, PNG, WEBP, and GIF files are allowed.'));
      return;
    }
    cb(null, true);
  }
});

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || name.endsWith('.csv')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only CSV files are allowed.'));
  }
});

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

function cloneDefaultDB() {
  return JSON.parse(JSON.stringify(DEFAULT_DB));
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
          primaryColor: '',
          secondaryColor: '',
          bgColor: '',
          btnColor: '',
          headingFont: '',
          bodyFont: '',
          headerLayout: 'search',
          headerSticky: true,
          showSearch: true,
          showDiscount: true,
          showRating: true,
          borderRadius: 'rounded',
          btnStyle: 'pill',
          bottomNavStyle: 'classic',
          productCardStyle: 'style-2',
          categoryStyle: 'circle',
          bannerTitle: '',
          bannerSubtitle: '',
          bannerCta: '',
          bannerImage: '',
          bannerImages: [],
          bannerImagesMobile: [],
          headerStyle: 'clean',
          topBarText: '🚚 Free Shipping on orders above ₹499 | 🔥 Flat 50% OFF on first order!',
          topBarMarquee: true,
          topBarBg: '',
          topBarColor: '',
          categoryLayout: 'auto'
        },
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
      store.template = ['app-style', 'minimal', 'bold-fashion'].includes(store.template) ? store.template : 'app-style';
    }
    store.theme = store.theme || 'default';
    store.themeConfig = store.themeConfig && typeof store.themeConfig === 'object' ? store.themeConfig : {};
    store.themeConfig.primaryColor = store.themeConfig.primaryColor || '';
    store.themeConfig.secondaryColor = store.themeConfig.secondaryColor || '';
    store.themeConfig.bgColor = store.themeConfig.bgColor || '';
    store.themeConfig.btnColor = store.themeConfig.btnColor || '';
    store.themeConfig.headingFont = store.themeConfig.headingFont || '';
    store.themeConfig.bodyFont = store.themeConfig.bodyFont || '';
    store.themeConfig.headerLayout = store.themeConfig.headerLayout || 'search';
    store.themeConfig.headerSticky = store.themeConfig.headerSticky !== false;
    store.themeConfig.showSearch = store.themeConfig.showSearch !== false;
    store.themeConfig.showDiscount = store.themeConfig.showDiscount !== false;
    store.themeConfig.showRating = store.themeConfig.showRating !== false;
    store.themeConfig.borderRadius = store.themeConfig.borderRadius || 'rounded';
    store.themeConfig.btnStyle = store.themeConfig.btnStyle || 'pill';
    store.themeConfig.bottomNavStyle = store.themeConfig.bottomNavStyle || 'classic';
    store.themeConfig.productCardStyle = store.themeConfig.productCardStyle || 'style-2';
    store.themeConfig.categoryStyle = store.themeConfig.categoryStyle || 'circle';
    store.themeConfig.bannerTitle = store.themeConfig.bannerTitle || '';
    store.themeConfig.bannerSubtitle = store.themeConfig.bannerSubtitle || '';
    store.themeConfig.bannerCta = store.themeConfig.bannerCta || '';
    store.themeConfig.bannerImage = store.themeConfig.bannerImage || '';
    store.themeConfig.bannerImages = Array.isArray(store.themeConfig.bannerImages) ? store.themeConfig.bannerImages : [];
    store.themeConfig.bannerImagesMobile = Array.isArray(store.themeConfig.bannerImagesMobile) ? store.themeConfig.bannerImagesMobile : [];
    store.themeConfig.headerStyle = store.themeConfig.headerStyle || 'clean';
    store.themeConfig.topBarText = store.themeConfig.topBarText || '';
    store.themeConfig.topBarMarquee = store.themeConfig.topBarMarquee !== false;
    store.themeConfig.topBarBg = store.themeConfig.topBarBg || '';
    store.themeConfig.topBarColor = store.themeConfig.topBarColor || '';
    store.themeConfig.categoryLayout = store.themeConfig.categoryLayout || 'auto';
    store.logo = store.logo || '';
    store.description = typeof store.description === 'string' ? store.description : '';
    store.whatsapp = typeof store.whatsapp === 'string' ? store.whatsapp : '';
    store.createdAt = store.createdAt || new Date().toISOString();
    store.customers = store.customers && typeof store.customers === 'object' ? store.customers : {};
    store.products = store.products.map((product) => ({
      id: product.id || generateId('p'),
      name: typeof product.name === 'string' ? product.name : '',
      price: parsePrice(product.price),
      description: typeof product.description === 'string' ? product.description : '',
      image: typeof product.image === 'string' ? product.image : '',
      stock: Math.max(0, parseInt(product.stock || 0, 10) || 0),
      sku: typeof product.sku === 'string' ? product.sku : '',
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
      items: Array.isArray(order.items) ? order.items : [],
      customerName: typeof order.customerName === 'string' ? order.customerName : '',
      customerPhone: typeof order.customerPhone === 'string' ? order.customerPhone : '',
      customerEmail: typeof order.customerEmail === 'string' ? order.customerEmail : '',
      shippingAddress: typeof order.shippingAddress === 'string' ? order.shippingAddress : '',
      notes: typeof order.notes === 'string' ? order.notes : '',
      paymentMethod: typeof order.paymentMethod === 'string' ? order.paymentMethod : 'cod',
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

function loadDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      saveDB(cloneDefaultDB());
      return cloneDefaultDB();
    }
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    if (!raw.trim()) {
      saveDB(cloneDefaultDB());
      return cloneDefaultDB();
    }
    const parsed = JSON.parse(raw);
    return normalizeDB(parsed);
  } catch (error) {
    const fallback = cloneDefaultDB();
    saveDB(fallback);
    return fallback;
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(normalizeDB(db), null, 2), 'utf8');
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

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim().toLowerCase());
}

function validatePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function sanitizeInput(value, maxLen) {
  const str = String(value || '').trim();
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

function parsePrice(value) {
  const num = parseFloat(String(value || '0').replace(/[^0-9.]/g, ''));
  return isNaN(num) || num < 0 ? 0 : num;
}

function sanitizeTrackingCode(code) {
  return String(code || '').replace(/[^A-Z0-9\-]/gi, '').slice(0, 30);
}

const INPUT_LIMITS = { storeName: 80, productName: 120, description: 2000, whatsapp: 15, notes: 500, domain: 100 };

function generateId(prefix) {
  return `${prefix || 'id'}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(password || ''), salt, 120000, 64, 'sha512').toString('hex');
  return `pbkdf2$120000$${salt}$${hash}`;
}

function verifyPassword(password, passwordHash) {
  const value = String(passwordHash || '');
  if (!value.startsWith('pbkdf2$')) {
    return false;
  }
  const parts = value.split('$');
  if (parts.length !== 4) {
    return false;
  }
  const iterations = Number(parts[1]);
  const salt = parts[2];
  const expected = parts[3];
  const actual = crypto.pbkdf2Sync(String(password || ''), salt, iterations, 64, 'sha512').toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
  } catch (error) {
    return false;
  }
}

function formatDate(isoString) {
  if (!isoString) {
    return '-';
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function setFlash(req, type, message) {
  req.session.flash = { type: type || 'info', message: String(message || '') };
}

function consumeFlash(req) {
  const flash = req.session.flash || null;
  delete req.session.flash;
  return flash;
}

function renderFlashMessages(req) {
  const flash = consumeFlash(req);
  if (!flash || !flash.message) {
    return '';
  }
  const typeClass = flash.type === 'error' ? 'flash-error' : flash.type === 'success' ? 'flash-success' : 'flash-info';
  return `<div class="flash ${typeClass}">${escapeHtml(flash.message)}</div>`;
}

function renderHtmlShell(title, content, options) {
  const safeOptions = options || {};
  const pageTitle = escapeHtml(title || 'MyShopBuilder');
  const extraStyles = safeOptions.extraStyles || '';
  const bodyClass = escapeHtml(safeOptions.bodyClass || '');
  const metaTags = safeOptions.metaTags || '';
  const uiScript = `
<script>
(() => {
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.style.scrollBehavior = 'smooth';
  if (reduceMotion) return;

  const animateNumber = (el) => {
    const text = (el.textContent || '').trim();
    const match = text.match(/^([^\d-]*)(-?[\d,]+(?:\.\d+)?)([^\d]*)$/);
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
${content}
${uiScript}
</body>
</html>`;
}

function renderStoreCss(template, theme) {
  const safeTemplate = template || DEFAULT_TEMPLATES[0];
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
.checkout-steps { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px; }
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

function renderTopBar(cfg) {
  const text = (cfg.topBarText || '').trim();
  if (!text) return '';
  const bg = cfg.topBarBg || '';
  const color = cfg.topBarColor || '#fff';
  const isMarquee = cfg.topBarMarquee !== false;
  const bgStyle = bg ? `background:${bg};` : 'background:linear-gradient(90deg, #3b5bfd, #06b6d4);';
  if (isMarquee) {
    return `<div class="store-topbar" style="${bgStyle}color:${color};overflow:hidden;height:36px;display:flex;align-items:center;">
      <div class="marquee-track"><span class="marquee-text">${escapeHtml(text)}</span><span class="marquee-text" aria-hidden="true">${escapeHtml(text)}</span></div>
    </div>`;
  }
  return `<div class="store-topbar" style="${bgStyle}color:${color};height:36px;display:flex;align-items:center;justify-content:center;padding:0 16px;">
    <span style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(text)}</span>
  </div>`;
}

function renderCategorySection(categories, slug, cfg) {
  if (!categories.length) return '';
  const layout = cfg.categoryLayout || 'auto';
  const style = cfg.categoryStyle || 'circle';
  const forceGrid = layout === 'grid' || style === 'grid';
  const forceCarousel = layout === 'carousel';
  const isCarousel = forceCarousel || (!forceGrid && layout === 'auto' && categories.length > 4 && style !== 'pill');
  const catIcons = ['👕','👗','👟','👜','⌚','📱','🎧','💄','🏠','🎮','📚','🧸'];
  const items = categories.map((cat, i) => {
    if (style === 'pill') {
      return `<a class="cat-tag" href="/store/${encodeURIComponent(slug)}?category=${encodeURIComponent(cat.name)}">${escapeHtml(cat.name)}</a>`;
    }
    const tileClass = style === 'square' || style === 'grid' ? 'cat-icon square' : 'cat-icon';
    const icon = cat.image ? `<img class="cat-img ${style === 'square' || style === 'grid' ? 'square' : ''}" src="${escapeHtml(cat.image)}" alt="${escapeHtml(cat.name)}">` : `<div class="${tileClass}">${catIcons[i % catIcons.length]}</div>`;
    return `<a class="cat-item ${style === 'grid' ? 'grid-item' : ''}" href="/store/${encodeURIComponent(slug)}?category=${encodeURIComponent(cat.name)}">${icon}<span class="cat-label">${escapeHtml(cat.name)}</span></a>`;
  }).join('');
  if (style === 'pill') {
    return `<div class="app-section"><div class="app-section-head"><h2 class="app-section-title">Categories</h2><a href="/store/${encodeURIComponent(slug)}">View all</a></div><div class="cat-tags">${items}</div></div>`;
  }
  if (isCarousel) {
    return `<div class="app-section"><div class="app-section-head"><h2 class="app-section-title">Categories</h2><a href="/store/${encodeURIComponent(slug)}">View all</a></div><div class="cat-scroll">${items}</div></div>`;
  }
  return `<div class="app-section"><div class="app-section-head"><h2 class="app-section-title">Categories</h2><a href="/store/${encodeURIComponent(slug)}">View all</a></div><div class="cat-grid">${items}</div></div>`;
}

function renderBannerCarousel(cfg, slug) {
  const desktopImages = Array.isArray(cfg.bannerImages) ? cfg.bannerImages.filter(Boolean) : [];
  const mobileImages = Array.isArray(cfg.bannerImagesMobile) ? cfg.bannerImagesMobile.filter(Boolean) : [];
  const title = cfg.bannerTitle || '';
  const subtitle = cfg.bannerSubtitle || '';
  const cta = cfg.bannerCta || 'Shop Now';
  const hasDesktop = desktopImages.length > 0;
  const hasMobile = mobileImages.length > 0;

  if (!hasDesktop && !hasMobile) {
    const primary = cfg.primaryColor || '#3b5bfd';
    const secondary = cfg.secondaryColor || '#06b6d4';
    return `<div class="hero-carousel" style="background:linear-gradient(135deg, ${primary}, ${secondary});">
      <div class="hero-overlay-text">
        ${title ? `<h2>${escapeHtml(title)}</h2>` : ''}
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
        ${title ? `<a href="/store/${encodeURIComponent(slug)}">${escapeHtml(cta)}</a>` : ''}
      </div>
    </div>`;
  }

  const desktopSlides = hasDesktop ? desktopImages.map((img, i) => `<div class="carousel-slide${i === 0 ? ' active' : ''}"><img class="slide-img" src="${escapeHtml(img)}" alt="Banner ${i+1}"><div class="hero-overlay-text">${title ? `<h2>${escapeHtml(title)}</h2>` : ''}${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}${title ? `<a href="/store/${encodeURIComponent(slug)}">${escapeHtml(cta)}</a>` : ''}</div></div>`).join('') : '';
  const mobileSlides = hasMobile ? mobileImages.map((img, i) => `<div class="carousel-slide${i === 0 ? ' active' : ''}"><img class="slide-img" src="${escapeHtml(img)}" alt="Banner ${i+1}"><div class="hero-overlay-text">${title ? `<h2>${escapeHtml(title)}</h2>` : ''}${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}${title ? `<a href="/store/${encodeURIComponent(slug)}">${escapeHtml(cta)}</a>` : ''}</div></div>`).join('') : '';
  const totalSlides = hasDesktop ? desktopImages.length : mobileImages.length;
  const dots = Array.from({ length: totalSlides }, (_, i) => `<span class="carousel-dot${i === 0 ? ' active' : ''}" data-index="${i}"></span>`).join('');

  return `<div class="hero-carousel" data-autoplay="4000">
    ${hasDesktop ? `<div class="carousel-desktop">${desktopSlides}</div>` : ''}
    ${hasMobile ? `<div class="carousel-mobile">${mobileSlides}</div>` : ''}
    ${!hasDesktop && hasMobile ? `<div class="carousel-desktop">${mobileSlides}</div>` : ''}
    ${!hasMobile && hasDesktop ? `<div class="carousel-mobile">${desktopSlides}</div>` : ''}
    <div class="carousel-dots">${dots}</div>
    <button class="carousel-arrow carousel-prev" aria-label="Previous">&#10094;</button>
    <button class="carousel-arrow carousel-next" aria-label="Next">&#10095;</button>
  </div>
  <script>
  (() => {
    document.querySelectorAll('.hero-carousel[data-autoplay]').forEach(function(carousel) {
      var desktopSlides = carousel.querySelectorAll('.carousel-desktop .carousel-slide');
      var mobileSlides = carousel.querySelectorAll('.carousel-mobile .carousel-slide');
      var dots = carousel.querySelectorAll('.carousel-dot');
      var allSlides = [desktopSlides, mobileSlides];
      var current = 0;
      var total = dots.length;
      if (total <= 1) { carousel.querySelector('.carousel-dots') && (carousel.querySelector('.carousel-dots').style.display='none'); carousel.querySelectorAll('.carousel-arrow').forEach(function(a){a.style.display='none';}); return; }
      function show(index) {
        current = ((index % total) + total) % total;
        allSlides.forEach(function(slides) { slides.forEach(function(s, i) { s.classList.toggle('active', i === current); }); });
        dots.forEach(function(d, i) { d.classList.toggle('active', i === current); });
      }
      dots.forEach(function(d) { d.addEventListener('click', function() { show(parseInt(d.dataset.index)); }); });
      carousel.querySelector('.carousel-prev') && carousel.querySelector('.carousel-prev').addEventListener('click', function() { show(current - 1); });
      carousel.querySelector('.carousel-next') && carousel.querySelector('.carousel-next').addEventListener('click', function() { show(current + 1); });
      var interval = parseInt(carousel.dataset.autoplay) || 4000;
      var timer = setInterval(function() { show(current + 1); }, interval);
      carousel.addEventListener('mouseenter', function() { clearInterval(timer); });
      carousel.addEventListener('mouseleave', function() { timer = setInterval(function() { show(current + 1); }, interval); });
      var startX = 0;
      carousel.addEventListener('touchstart', function(e) { startX = e.touches[0].clientX; clearInterval(timer); }, { passive: true });
      carousel.addEventListener('touchend', function(e) { var diff = e.changedTouches[0].clientX - startX; if (Math.abs(diff) > 40) { diff > 0 ? show(current - 1) : show(current + 1); } timer = setInterval(function() { show(current + 1); }, interval); }, { passive: true });
    });
  })();
  </script>`;
}

function getThemeRadius(style) {
  if (style === 'sharp') return '6px';
  if (style === 'rounded') return '14px';
  return '999px';
}

function getThemeBtnRadius(style) {
  if (style === 'sharp') return '6px';
  if (style === 'rounded') return '14px';
  return '999px';
}

function getThemeCSS(template, theme, cfg) {
  const safeTemplate = template || DEFAULT_TEMPLATES[0];
  const isDark = theme === 'dark';
  const primary = cfg.primaryColor || safeTemplate.colors.primary;
  const secondary = cfg.secondaryColor || safeTemplate.colors.secondary;
  const pageBg = cfg.bgColor || (isDark ? '#0f172a' : '#f8fafc');
  const cardBg = isDark ? '#111827' : '#ffffff';
  const text = isDark ? '#f8fafc' : '#111827';
  const muted = isDark ? '#cbd5e1' : '#6b7280';
  const headingFont = cfg.headingFont || 'Inter';
  const bodyFont = cfg.bodyFont || 'Inter';
  const radius = getThemeRadius(cfg.borderRadius);
  const btnRadius = getThemeBtnRadius(cfg.btnStyle);
  const layout = safeTemplate.layout || 'app';

  if (layout === 'app') {
    return `
    * { box-sizing:border-box; }
    .store-page { min-height:100vh; background:${pageBg}; color:${text}; font-family:${bodyFont},system-ui,sans-serif; padding-bottom:88px; }
    .store-wrap { width:min(1180px, 100%); margin:0 auto; }
    .app-header { position:${cfg.headerSticky !== false ? 'sticky' : 'static'}; top:0; left:0; right:0; z-index:40; background:${cardBg}; border-bottom:1px solid ${isDark ? '#1e293b' : '#eceff4'}; padding:14px 16px; display:flex; align-items:center; gap:12px; }
    .app-shell { position:relative; }
    .app-drawer-overlay { position:fixed; inset:0; background:rgba(15,23,42,.44); opacity:0; pointer-events:none; transition:opacity .25s ease; z-index:45; }
    .app-drawer { position:fixed; top:0; left:0; bottom:0; width:min(84vw, 320px); background:${cardBg}; transform:translateX(-100%); transition:transform .28s ease; z-index:46; box-shadow:20px 0 40px rgba(15,23,42,.14); padding:18px 18px 28px; display:grid; grid-template-rows:auto 1fr; gap:18px; }
    .app-shell.drawer-open .app-drawer { transform:translateX(0); }
    .app-shell.drawer-open .app-drawer-overlay { opacity:1; pointer-events:auto; }
    .app-drawer-top { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .app-drawer-close { width:40px; height:40px; border-radius:50%; border:2px solid ${primary}; background:#fff; color:${primary}; display:grid; place-items:center; font-size:22px; cursor:pointer; }
    .app-drawer-nav { display:grid; gap:8px; align-content:start; }
    .app-drawer-link { padding:12px 12px; border-radius:14px; color:${text}; text-decoration:none; font-weight:700; }
    .app-drawer-link:hover { background:${primary}08; }
    .app-header.header-left { grid-template-columns:22px 34px minmax(0,1fr) auto; display:grid; }
    .app-header.header-left .app-header-title { text-align:left; font-size:15px; }
    .app-header.header-center { display:grid; grid-template-columns:22px 34px minmax(0,1fr) auto; }
    .app-header.header-center .app-header-title { text-align:center; }
    .app-header.header-search { display:grid; grid-template-columns:22px 34px minmax(0,1fr) auto; }
    .app-header.header-search .app-header-title { display:none; }
    .app-header-menu { width:22px; height:22px; display:grid; place-items:center; color:${text}; font-size:20px; flex:0 0 auto; cursor:pointer; }
    .app-logo { width:34px; height:34px; border-radius:10px; object-fit:cover; background:#f1f5f9; flex-shrink:0; }
    .app-logo-ph { width:34px; height:34px; border-radius:10px; background:${primary}14; display:grid; place-items:center; color:${primary}; font-weight:900; font-size:16px; flex-shrink:0; }
    .app-header-search { flex:1; display:flex; align-items:center; gap:10px; min-width:0; padding:0 2px; color:#111; font-size:13px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-family:${headingFont},system-ui,sans-serif; }
    .app-header-title { flex:1; min-width:0; font-size:18px; font-weight:900; letter-spacing:-.03em; text-align:center; font-family:${headingFont},system-ui,sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .app-header-title.left { text-align:left; font-size:15px; }
    .app-header-search svg { width:18px; height:18px; stroke:currentColor; fill:none; stroke-width:1.9; stroke-linecap:round; stroke-linejoin:round; flex:0 0 auto; }
    .app-actions { display:flex; gap:8px; }
    .app-icon-btn { width:38px; height:38px; border-radius:12px; border:1px solid ${isDark ? '#334155' : '#eceff4'}; background:${cardBg}; display:grid; place-items:center; font-size:18px; position:relative; text-decoration:none; color:${text}; transition:background .2s, transform .2s; }
    .app-icon-btn:hover { background:${isDark ? '#1e293b' : '#f8fafc'}; transform:translateY(-1px); }
    .app-badge { position:absolute; top:-4px; right:-4px; min-width:18px; height:18px; border-radius:999px; background:${primary}; color:#fff; font-size:10px; font-weight:800; display:inline-flex; align-items:center; justify-content:center; padding:0 4px; }
    .app-section { padding:18px 16px; }
    .app-section-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:0 0 12px; }
    .app-section-head a { font-size:13px; color:${primary}; text-decoration:none; font-weight:700; }
    .app-section-title { margin:0; font-size:16px; font-weight:900; letter-spacing:-.02em; font-family:${headingFont},system-ui,sans-serif; }
    .cat-scroll { display:flex; gap:14px; overflow-x:auto; padding-bottom:8px; scrollbar-width:none; -ms-overflow-style:none; }
    .cat-scroll::-webkit-scrollbar { display:none; }
    .cat-item { display:flex; flex-direction:column; align-items:center; gap:8px; min-width:68px; text-decoration:none; color:${text}; }
    .cat-item.grid-item { min-width:0; }
    .cat-icon { width:64px; height:64px; border-radius:50%; background:${primary}10; display:grid; place-items:center; font-size:24px; transition:transform .2s, box-shadow .2s; border:1px solid ${primary}12; }
    .cat-icon.square { border-radius:18px; }
    .cat-item:hover .cat-icon { transform:scale(1.08); box-shadow:0 6px 16px ${primary}22; }
    .cat-label { font-size:11px; font-weight:700; text-align:center; color:${text}; line-height:1.25; max-width:70px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .app-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
    .app-grid.list-layout { grid-template-columns:1fr; }
    .cat-grid .cat-item { padding:12px 8px; border-radius:18px; background:#fff; border:1px solid #eef2f7; }
    .cat-grid .cat-item:hover { background:${primary}06; }
    .app-card { background:${cardBg}; border-radius:18px; overflow:hidden; border:1px solid ${isDark ? '#1e293b' : '#11111122'}; transition:transform .2s, box-shadow .2s; text-decoration:none; color:${text}; display:flex; flex-direction:column; box-shadow:0 8px 20px rgba(15,23,42,.04); }
    .app-card:hover { transform:translateY(-3px); box-shadow:0 16px 30px rgba(0,0,0,.08); }
    .app-card-img { width:100%; aspect-ratio:1/1; object-fit:cover; background:#f1f5f9; }
    .app-card-body { padding:10px 12px 12px; flex:1; display:flex; flex-direction:column; }
    .app-card-body h3 { margin:0 0 6px; font-size:13px; font-weight:800; line-height:1.32; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; min-height:34px; font-family:${headingFont},system-ui,sans-serif; }
    .app-card-body .price { font-size:16px; font-weight:900; color:#111; margin-top:auto; }
    .app-card-body .old-price { font-size:12px; color:${muted}; text-decoration:line-through; margin-left:6px; }
    .app-card-body .stock { font-size:11px; color:${muted}; margin-top:4px; }
    .app-card-actions { display:flex; gap:6px; padding:0 12px 12px; }
    .app-card-actions form { flex:1; }
    .app-card-actions button, .app-card-actions a { width:100%; padding:9px; border-radius:14px; border:1px solid ${primary}30; background:${primary}08; color:${primary}; font-size:12px; font-weight:800; cursor:pointer; text-align:center; text-decoration:none; transition:background .2s; display:inline-flex; align-items:center; justify-content:center; }
    .app-card-actions button:hover, .app-card-actions a:hover { background:${primary}18; }
    .app-card-actions .primary-btn { background:#111; color:#fff; border-color:#111; }
    .app-card-actions .primary-btn:hover { filter:brightness(1.1); }
    .product-style-style-1 { border-radius:14px; border-color:${isDark ? '#1e293b' : '#eef2f7'}; box-shadow:none; }
    .product-style-style-1 .app-card-figure { padding:8px; background:#fff; }
    .product-style-style-1 .app-card-img { border-radius:14px; }
    .product-style-style-1 .app-sale-badge { display:none; }
    .product-style-style-1 .app-card-actions .primary-btn { background:${primary}; border-color:${primary}; }
    .product-style-style-2 .app-sale-badge { display:inline-flex; }
    .product-style-style-3 { border-radius:22px; box-shadow:0 18px 36px rgba(15,23,42,.1); background:#111; color:#fff; }
    .product-style-style-3 .app-card-body { padding:14px; }
    .product-style-style-3 .app-card-figure { background:#111; }
    .product-style-style-3 .app-card-img { mix-blend-mode:screen; opacity:.94; }
    .product-style-style-3 .app-card-body .price { color:#fff; }
    .product-style-style-3 .app-card-body .stock, .product-style-style-3 .old-price { color:#cbd5e1; }
    .product-style-style-3 .primary-btn { background:${primary}; border-color:${primary}; }
    .product-style-style-3 .app-card-actions button:not(.primary-btn) { background:#ffffff14; border-color:#ffffff22; color:#fff; }
    .product-style-style-4 { display:grid; grid-template-columns:92px 1fr; align-items:stretch; }
    .product-style-style-4 .app-card-figure { height:100%; }
    .product-style-style-4 .app-card-img { height:100%; aspect-ratio:auto; }
    .product-style-style-4 .app-card-actions { grid-column:2; padding-top:0; }
    .product-style-style-4 .app-card-body { padding:12px 12px 8px; }
    .product-style-style-4 .app-card-body h3 { min-height:auto; -webkit-line-clamp:1; }
    .product-style-style-4 .app-sale-badge { display:none; }
    .app-sale-badge { position:absolute; top:8px; left:8px; z-index:2; padding:5px 8px; border-radius:999px; background:#111; color:#fff; font-size:10px; font-weight:900; letter-spacing:.02em; }
    .app-card-figure { position:relative; }
    .flash-strip { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px; }
    .flash-title { display:flex; align-items:center; gap:10px; font-size:16px; font-weight:900; letter-spacing:-.02em; }
    .flash-title span:first-child { width:28px; height:28px; border-radius:10px; background:#111; color:#fff; display:grid; place-items:center; font-size:15px; }
    .flash-timer { display:flex; gap:6px; align-items:center; color:${muted}; font-size:12px; font-weight:800; }
    .flash-timer strong { min-width:26px; padding:6px 0; border-radius:10px; background:#111; color:#fff; text-align:center; font-size:11px; }
    .cat-tags { display:flex; gap:10px; flex-wrap:wrap; }
    .cat-tag { padding:9px 14px; border-radius:999px; background:${primary}08; border:1px solid ${primary}18; color:${text}; text-decoration:none; font-size:12px; font-weight:700; }
    .cat-tag:hover { background:${primary}; color:#fff; }
    .app-float-wa { position:fixed; bottom:84px; right:16px; width:52px; height:52px; border-radius:50%; background:#25D366; color:#fff; display:grid; place-items:center; font-size:24px; box-shadow:0 6px 20px rgba(37,211,102,.35); z-index:30; text-decoration:none; transition:transform .2s; }
    .app-float-wa:hover { transform:scale(1.1); }
    .app-bottom-nav { display:none; position:fixed; bottom:0; left:0; right:0; height:64px; background:${cardBg}; border-top:1px solid ${isDark ? '#1e293b' : '#e2e8f0'}; justify-content:space-around; align-items:center; z-index:35; box-shadow:0 -4px 16px rgba(0,0,0,.04); }
    .app-bottom-nav a { display:flex; flex-direction:column; align-items:center; gap:3px; padding:6px 0; min-width:56px; color:${muted}; font-size:10px; font-weight:700; text-decoration:none; border-radius:999px; transition:color .2s, background .2s; }
    .app-bottom-nav a.active, .app-bottom-nav a:hover { color:${cardBg}; background:#111; }
    .app-bottom-nav svg { width:22px; height:22px; stroke:currentColor; fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
    .nav-classic { left:0; right:0; bottom:0; height:64px; border-radius:0; padding:0 6px; box-shadow:0 -4px 16px rgba(0,0,0,.04); }
    .nav-classic a.active, .nav-classic a:hover { color:${cardBg}; background:#111; }
    .nav-modern { left:12px; right:12px; bottom:10px; height:62px; border-radius:999px; padding:0 10px; box-shadow:0 12px 36px rgba(15,23,42,.16); }
    .nav-modern a.active, .nav-modern a:hover { background:${primary}; color:#fff; }
    .nav-compact { left:8px; right:8px; bottom:8px; height:58px; border-radius:22px; padding:0 8px; }
    .nav-compact a { min-width:44px; font-size:0; }
    .nav-compact a span { display:none; }
    .nav-compact a.active, .nav-compact a:hover { color:${primary}; background:${primary}10; }
    @media (max-width:640px) { .app-bottom-nav { display:flex; } .nav-modern { left:12px; right:12px; bottom:10px; height:62px; border-radius:999px; padding:0 10px; box-shadow:0 12px 36px rgba(15,23,42,.16); } .nav-classic { left:0; right:0; bottom:0; height:64px; border-radius:0; padding:0 6px; } .nav-compact { left:8px; right:8px; bottom:8px; height:58px; border-radius:22px; padding:0 8px; } .store-page { padding-bottom:94px; } .app-float-wa { bottom:88px; } }
    .hero-carousel { position:relative; width:100%; aspect-ratio:16/7; overflow:hidden; background:linear-gradient(135deg, ${primary}, ${secondary}); }
    .carousel-desktop, .carousel-mobile { position:relative; width:100%; height:100%; }
    .carousel-mobile { display:none; }
    .carousel-slide { position:absolute; inset:0; opacity:0; transition:opacity .8s ease; }
    .carousel-slide.active { opacity:1; }
    .carousel-slide img.slide-img { width:100%; height:100%; object-fit:cover; display:block; }
    .hero-overlay-text { position:absolute; inset:0; display:flex; flex-direction:column; align-items:flex-start; justify-content:flex-end; text-align:left; padding:20px 18px 26px; background:linear-gradient(transparent 30%, rgba(0,0,0,.72)); color:#fff; z-index:2; }
    .hero-overlay-text h2 { margin:0 0 6px; font-size:clamp(16px,4vw,24px); font-weight:900; line-height:1.04; text-shadow:0 2px 8px rgba(0,0,0,.4); max-width:12ch; font-family:${headingFont},system-ui,sans-serif; }
    .hero-overlay-text p { margin:0 0 12px; font-size:clamp(12px,2vw,14px); opacity:.98; text-shadow:0 1px 4px rgba(0,0,0,.3); max-width:24ch; }
    .hero-overlay-text a { display:inline-block; padding:10px 22px; border-radius:${btnRadius}; background:#111; color:#fff; font-weight:800; font-size:13px; text-decoration:none; transition:transform .2s; box-shadow:0 4px 12px rgba(0,0,0,.15); }
    .hero-overlay-text a:hover { transform:scale(1.05); }
    .carousel-dots { position:absolute; bottom:12px; left:50%; transform:translateX(-50%); display:flex; gap:8px; z-index:3; }
    .carousel-dot { width:10px; height:10px; border-radius:50%; background:rgba(255,255,255,.5); cursor:pointer; transition:background .2s, transform .2s; }
    .carousel-dot.active { background:#fff; transform:scale(1.2); }
    .carousel-arrow { position:absolute; top:50%; transform:translateY(-50%); z-index:3; width:36px; height:36px; border-radius:50%; border:0; background:rgba(255,255,255,.85); color:#333; font-size:16px; cursor:pointer; display:grid; place-items:center; transition:background .2s; box-shadow:0 2px 8px rgba(0,0,0,.1); }
    .carousel-arrow:hover { background:#fff; }
    .carousel-prev { left:12px; }
    .carousel-next { right:12px; }
    @media (max-width:640px) { .hero-carousel { aspect-ratio:1/1; } .carousel-desktop { display:none; } .carousel-mobile { display:block; } .carousel-arrow { display:none; } }
    .store-topbar { position:relative; }
    .marquee-track { display:flex; animation:marquee 20s linear infinite; white-space:nowrap; }
    .marquee-text { padding:0 40px; font-size:13px; font-weight:600; }
    @keyframes marquee { 0% { transform:translateX(0); } 100% { transform:translateX(-50%); } }
    .cat-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(72px, 1fr)); gap:12px; }
    .cat-img { width:64px; height:64px; border-radius:50%; object-fit:cover; border:1px solid ${primary}12; }
    .cat-img.square { border-radius:18px; }
    .cat-scroll .cat-img { width:64px; height:64px; border-radius:50%; object-fit:cover; border:1px solid ${primary}12; }
    .cat-scroll .cat-img.square { border-radius:18px; }
    @media (max-width:640px) { .cat-grid { grid-template-columns:repeat(4,1fr); } }
    .store-empty { padding:40px 16px; text-align:center; color:${muted}; }
    .store-footer { text-align:center; color:${muted}; padding:20px 16px 90px; font-size:13px; }
    .store-nav { display:flex; gap:8px; overflow-x:auto; padding:0 16px 12px; scrollbar-width:none; }
    .store-nav::-webkit-scrollbar { display:none; }
    .store-nav a { padding:8px 14px; border-radius:${btnRadius}; background:${cardBg}; border:1px solid ${isDark ? '#1e293b' : '#e2e8f0'}; font-size:13px; font-weight:600; white-space:nowrap; text-decoration:none; color:${text}; transition:background .2s, color .2s; }
    .store-nav a:hover, .store-nav a.active { background:${primary}; color:#fff; border-color:${primary}; }
    .product-detail { display:grid; gap:16px; }
    .product-detail img { width:100%; border-radius:${radius}; aspect-ratio:1/1; object-fit:cover; }
    .product-meta { display:flex; gap:8px; flex-wrap:wrap; margin:10px 0 14px; }
    .price-tag { font-size:24px; font-weight:900; color:${primary}; }
    .stock-tag { font-size:13px; font-weight:700; color:${muted}; }
    .store-pill { display:inline-flex; align-items:center; gap:6px; padding:8px 12px; border-radius:999px; background:${primary}12; color:${primary}; font-weight:700; font-size:12px; }
    .cart-page, .account-page, .checkout-page, .wishlist-page, .tracking-page { display:grid; gap:14px; padding:0 16px; }
    .checkout-layout { display:grid; gap:14px; }
    .checkout-steps { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
    .checkout-step { padding:12px; border-radius:${radius}; background:${cardBg}; border:1px solid ${isDark ? '#1e293b' : '#e2e8f0'}; color:${muted}; font-size:13px; }
    .checkout-step.active { color:${text}; border-color:${primary}44; }
    .checkout-step strong { display:block; margin-bottom:2px; font-size:14px; }
    .summary-box { padding:14px; border-radius:${radius}; background:${cardBg}; border:1px solid ${isDark ? '#1e293b' : '#e2e8f0'}; }
    .summary-row { display:flex; justify-content:space-between; gap:10px; margin-bottom:8px; font-size:14px; }
    .form-grid { display:grid; gap:14px; }
    .form-grid.two { grid-template-columns:1fr; }
    .field { display:grid; gap:6px; }
    .field label { font-weight:700; font-size:13px; }
    .field input, .field textarea, .field select { width:100%; padding:10px 12px; border-radius:${radius}; border:1px solid ${isDark ? '#334155' : '#e2e8f0'}; background:${cardBg}; font-size:14px; outline:none; transition:border-color .2s; }
    .field input:focus, .field textarea:focus, .field select:focus { border-color:${primary}; }
    .btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:10px 16px; border-radius:${btnRadius}; border:0; background:${cfg.btnColor || primary}; color:#fff; font-weight:700; font-size:14px; cursor:pointer; transition:transform .2s, filter .2s; text-decoration:none; }
    .btn:hover { transform:translateY(-1px); filter:brightness(1.06); }
    .btn:active { transform:scale(.97); }
    .btn-secondary { background:${cardBg}; color:${text}; border:1px solid ${isDark ? '#334155' : '#e2e8f0'}; }
    .btn-outline { background:transparent; color:${primary}; border:1px solid ${primary}44; }
    .actions { display:flex; flex-wrap:wrap; gap:8px; }
    .flash { margin:0 16px 12px; border-radius:${radius}; padding:12px 14px; font-weight:700; font-size:13px; }
    .flash-success { background:rgba(16,185,129,.12); color:#047857; }
    .flash-error { background:rgba(239,68,68,.12); color:#b91c1c; }
    .badge { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; font-size:11px; font-weight:700; }
    .badge-live { background:rgba(16,185,129,.12); color:#047857; }
    .badge-pending { background:rgba(245,158,11,.14); color:#b45309; }
    .badge-confirmed { background:rgba(37,99,235,.14); color:#1d4ed8; }
    .badge-cancelled { background:rgba(239,68,68,.14); color:#b91c1c; }
    .badge-delivered { background:rgba(16,185,129,.14); color:#047857; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th, td { text-align:left; padding:10px 8px; border-bottom:1px solid ${isDark ? '#1e293b' : '#e2e8f0'}; }
    .kpi-list { display:grid; gap:10px; }
    .kpi-item { display:flex; justify-content:space-between; gap:10px; padding:10px 0; border-bottom:1px solid ${isDark ? '#1e293b' : '#e2e8f0'}; }
    .card { background:${cardBg}; border-radius:${radius}; border:1px solid ${isDark ? '#1e293b' : '#f1f5f9'}; }
    .panel { padding:16px; }
    @media (min-width:640px) { .app-grid { grid-template-columns:repeat(3,1fr); } .product-detail { grid-template-columns:1fr 1fr; } .form-grid.two { grid-template-columns:repeat(2,1fr); } .checkout-layout { grid-template-columns:1fr 1fr; } }
    @media (min-width:920px) { .app-grid { grid-template-columns:repeat(4,1fr); } .store-wrap { max-width:1100px; margin:0 auto; } }
    `;
  }

  if (layout === 'minimal') {
    return `
    * { box-sizing:border-box; }
    .store-page { min-height:100vh; background:${pageBg}; color:${text}; font-family:${bodyFont},system-ui,sans-serif; }
    .store-wrap { width:min(1080px, calc(100% - 48px)); margin:0 auto; padding:40px 0 60px; }
    .store-header { text-align:center; margin-bottom:36px; padding:20px; }
    .store-logo { width:80px; height:80px; object-fit:cover; border-radius:20px; background:#f1f5f9; margin:0 auto 16px; }
    .store-logo-ph { width:80px; height:80px; border-radius:20px; background:${primary}08; display:grid; place-items:center; color:${primary}; font-weight:900; font-size:28px; margin:0 auto 16px; }
    .store-title { margin:0 0 8px; font-size:32px; font-weight:800; letter-spacing:-.02em; font-family:${headingFont},system-ui,sans-serif; }
    .store-desc { margin:0 auto; color:${muted}; line-height:1.7; max-width:50ch; }
    .store-meta { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-top:14px; }
    .store-badge { padding:7px 12px; border-radius:999px; background:${primary}08; color:${primary}; font-weight:700; font-size:12px; }
    .store-hero-actions { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-top:16px; }
    .store-pill { display:inline-flex; align-items:center; gap:6px; padding:8px 12px; border-radius:999px; background:${primary}08; color:${primary}; font-weight:700; font-size:12px; }
    .store-nav { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin-bottom:24px; }
    .store-nav a { padding:8px 16px; border-radius:${btnRadius}; background:${cardBg}; border:1px solid ${isDark ? '#1e293b' : '#e2e8f0'}; font-size:13px; font-weight:600; text-decoration:none; color:${text}; transition:all .2s; }
    .store-nav a:hover, .store-nav a.active { background:${primary}; color:#fff; border-color:${primary}; }
    .store-grid { display:grid; gap:20px; grid-template-columns:repeat(3,1fr); }
    .store-card { background:${cardBg}; border-radius:${radius}; overflow:hidden; border:1px solid ${isDark ? '#1e293b' : '#f1f5f9'}; transition:transform .2s, box-shadow .2s; display:flex; flex-direction:column; }
    .store-card:hover { transform:translateY(-4px); box-shadow:0 16px 40px rgba(0,0,0,.06); }
    .store-card img { width:100%; aspect-ratio:1/1; object-fit:cover; background:#f8fafc; }
    .store-card-body { padding:16px; flex:1; display:flex; flex-direction:column; }
    .store-card-body h3 { margin:0 0 6px; font-size:16px; font-weight:700; font-family:${headingFont},system-ui,sans-serif; }
    .store-card-body p { margin:0 0 10px; color:${muted}; font-size:13px; line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .price-row { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:auto; padding-top:10px; }
    .price-tag { font-size:18px; font-weight:900; color:${primary}; }
    .stock-tag { font-size:12px; font-weight:600; color:${muted}; }
    .store-card-actions { display:flex; gap:8px; padding:0 16px 16px; }
    .store-card-actions button, .store-card-actions a { flex:1; padding:10px; border-radius:${btnRadius}; border:0; background:${cfg.btnColor || primary}; color:#fff; font-size:13px; font-weight:700; cursor:pointer; text-align:center; text-decoration:none; transition:transform .2s, filter .2s; display:inline-flex; align-items:center; justify-content:center; }
    .store-card-actions button:hover, .store-card-actions a:hover { filter:brightness(1.06); transform:translateY(-1px); }
    .btn-outline { background:transparent; color:${primary}; border:1px solid ${primary}33; }
    .wishlist-active { background:rgba(239,68,68,.08); color:#dc2626; border-color:rgba(239,68,68,.15); }
    .hero-carousel { position:relative; width:100%; aspect-ratio:16/6; overflow:hidden; border-radius:${radius}; margin-bottom:28px; background:linear-gradient(135deg, ${primary}08, ${secondary}08); }
    .carousel-desktop, .carousel-mobile { position:relative; width:100%; height:100%; }
    .carousel-mobile { display:none; }
    .carousel-slide { position:absolute; inset:0; opacity:0; transition:opacity .8s ease; border-radius:${radius}; }
    .carousel-slide.active { opacity:1; }
    .carousel-slide img.slide-img { width:100%; height:100%; object-fit:cover; border-radius:${radius}; display:block; }
    .hero-overlay-text { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:20px; color:#fff; z-index:2; }
    .hero-overlay-text h2 { margin:0 0 8px; font-size:clamp(20px,4vw,32px); font-weight:800; letter-spacing:-.02em; text-shadow:0 2px 8px rgba(0,0,0,.25); }
    .hero-overlay-text p { margin:0 0 14px; font-size:14px; opacity:.9; }
    .hero-overlay-text a { display:inline-block; padding:10px 24px; border-radius:${btnRadius}; background:#fff; color:${primary}; font-weight:700; font-size:13px; text-decoration:none; transition:transform .2s; }
    .carousel-dots { position:absolute; bottom:14px; left:50%; transform:translateX(-50%); display:flex; gap:8px; z-index:3; }
    .carousel-dot { width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,.5); cursor:pointer; transition:all .2s; }
    .carousel-dot.active { background:#fff; transform:scale(1.3); }
    .carousel-arrow { position:absolute; top:50%; transform:translateY(-50%); z-index:3; width:34px; height:34px; border-radius:50%; border:0; background:rgba(255,255,255,.7); color:#333; font-size:14px; cursor:pointer; display:grid; place-items:center; }
    .carousel-prev { left:12px; }
    .carousel-next { right:12px; }
    @media (max-width:640px) { .hero-carousel { aspect-ratio:1/1; border-radius:0; margin-bottom:0; } .carousel-desktop { display:none; } .carousel-mobile { display:block; } }
    .store-empty { padding:60px 20px; text-align:center; color:${muted}; border:1px dashed ${isDark ? '#334155' : '#e2e8f0'}; border-radius:${radius}; }
    .store-footer { text-align:center; color:${muted}; padding:30px 0 0; font-size:13px; }
    .product-detail { display:grid; grid-template-columns:1fr 1fr; gap:32px; }
    .product-detail img { width:100%; border-radius:${radius}; aspect-ratio:1/1; object-fit:cover; }
    .product-meta { display:flex; gap:8px; flex-wrap:wrap; margin:14px 0 20px; }
    .price-tag { font-size:28px; }
    .store-pill { }
    .cart-page, .account-page, .checkout-page, .wishlist-page, .tracking-page { display:grid; gap:18px; }
    .checkout-layout { display:grid; grid-template-columns:1.1fr .9fr; gap:20px; align-items:start; }
    .checkout-steps { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
    .checkout-step { padding:14px; border-radius:${radius}; background:${cardBg}; border:1px solid ${isDark ? '#1e293b' : '#e2e8f0'}; color:${muted}; }
    .checkout-step.active { color:${text}; border-color:${primary}44; }
    .checkout-step strong { display:block; margin-bottom:4px; }
    .summary-box { padding:18px; border-radius:${radius}; background:${cardBg}; border:1px solid ${isDark ? '#1e293b' : '#e2e8f0'}; }
    .summary-row { display:flex; justify-content:space-between; gap:10px; margin-bottom:10px; }
    .form-grid { display:grid; gap:14px; }
    .form-grid.two { grid-template-columns:repeat(2,1fr); }
    .field { display:grid; gap:6px; }
    .field label { font-weight:700; font-size:13px; }
    .field input, .field textarea, .field select { width:100%; padding:12px 14px; border-radius:${radius}; border:1px solid ${isDark ? '#334155' : '#e2e8f0'}; background:${cardBg}; font-size:14px; outline:none; transition:border-color .2s; }
    .field input:focus, .field textarea:focus, .field select:focus { border-color:${primary}; }
    .btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:12px 20px; border-radius:${btnRadius}; border:0; background:${cfg.btnColor || primary}; color:#fff; font-weight:700; font-size:14px; cursor:pointer; transition:transform .2s, filter .2s; text-decoration:none; }
    .btn:hover { transform:translateY(-1px); filter:brightness(1.06); }
    .btn:active { transform:scale(.97); }
    .btn-secondary { background:${cardBg}; color:${text}; border:1px solid ${isDark ? '#334155' : '#e2e8f0'}; }
    .btn-outline { background:transparent; color:${primary}; border:1px solid ${primary}44; }
    .actions { display:flex; flex-wrap:wrap; gap:8px; }
    .flash { margin-bottom:16px; border-radius:${radius}; padding:12px 16px; font-weight:700; }
    .flash-success { background:rgba(16,185,129,.12); color:#047857; }
    .flash-error { background:rgba(239,68,68,.12); color:#b91c1c; }
    .badge { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; font-size:11px; font-weight:700; }
    .badge-live { background:rgba(16,185,129,.12); color:#047857; }
    .badge-pending { background:rgba(245,158,11,.14); color:#b45309; }
    .badge-confirmed { background:rgba(37,99,235,.14); color:#1d4ed8; }
    .badge-cancelled { background:rgba(239,68,68,.14); color:#b91c1c; }
    .badge-delivered { background:rgba(16,185,129,.14); color:#047857; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th, td { text-align:left; padding:12px 10px; border-bottom:1px solid ${isDark ? '#1e293b' : '#e2e8f0'}; }
    .kpi-list { display:grid; gap:10px; }
    .kpi-item { display:flex; justify-content:space-between; gap:10px; padding:12px 0; border-bottom:1px solid ${isDark ? '#1e293b' : '#e2e8f0'}; }
    .card { background:${cardBg}; border-radius:${radius}; border:1px solid ${isDark ? '#1e293b' : '#f1f5f9'}; }
    .panel { padding:20px; }
    @media (max-width:920px) { .store-grid { grid-template-columns:repeat(2,1fr); } }
    @media (max-width:640px) { .store-grid { grid-template-columns:1fr; } .product-detail { grid-template-columns:1fr; } .form-grid.two { grid-template-columns:1fr; } .checkout-layout { grid-template-columns:1fr; } .checkout-steps { grid-template-columns:1fr; } .store-title { font-size:26px; } }
    `;
  }

  if (layout === 'bold') {
    return `
    * { box-sizing:border-box; }
    .store-page { min-height:100vh; background:${isDark ? '#0a0a0a' : '#fafafa'}; color:${text}; font-family:${bodyFont},system-ui,sans-serif; }
    .store-wrap { width:100%; max-width:1200px; margin:0 auto; }
    .bold-hero { width:100%; min-height:60vh; background:linear-gradient(135deg, ${primary}, ${secondary}); display:flex; align-items:center; justify-content:center; text-align:center; padding:60px 24px; position:relative; overflow:hidden; }
    .bold-hero::after { content:''; position:absolute; inset:0; background:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2240%22 fill=%22none%22 stroke=%22rgba(255,255,255,.08)%22 stroke-width=%22.5%22/></svg>') center/cover; pointer-events:none; }
    .bold-hero-text { position:relative; z-index:2; color:#fff; max-width:600px; }
    .bold-hero-text h1 { margin:0 0 16px; font-size:clamp(32px,6vw,56px); font-weight:900; letter-spacing:-.03em; line-height:1.05; font-family:${headingFont},system-ui,sans-serif; }
    .bold-hero-text p { margin:0 0 24px; font-size:18px; opacity:.85; line-height:1.5; }
    .bold-hero-text a { display:inline-block; padding:14px 32px; border-radius:${btnRadius}; background:#fff; color:${primary}; font-weight:800; font-size:15px; text-decoration:none; transition:transform .2s; }
    .bold-hero-text a:hover { transform:scale(1.05); }
    .bold-nav { display:flex; justify-content:space-between; align-items:center; padding:16px 24px; background:${cardBg}; border-bottom:1px solid ${isDark ? '#1a1a1a' : '#eee'}; position:sticky; top:0; z-index:40; }
    .bold-nav-links { display:flex; gap:16px; align-items:center; }
    .bold-nav-links a { font-size:14px; font-weight:600; text-decoration:none; color:${muted}; transition:color .2s; }
    .bold-nav-links a:hover { color:${primary}; }
    .bold-section { padding:60px 24px; }
    .bold-section-title { font-size:clamp(28px,4vw,42px); font-weight:900; letter-spacing:-.03em; margin:0 0 8px; }
    .bold-section-sub { color:${muted}; font-size:16px; margin:0 0 32px; }
    .bold-grid { display:grid; gap:24px; grid-template-columns:repeat(2,1fr); }
    .bold-card { position:relative; overflow:hidden; border-radius:${radius}; background:${isDark ? '#111' : '#fff'}; border:1px solid ${isDark ? '#1a1a1a' : '#f0f0f0'}; transition:transform .3s, box-shadow .3s; }
    .bold-card:hover { transform:translateY(-6px); box-shadow:0 20px 40px rgba(0,0,0,.1); }
    .bold-card img { width:100%; aspect-ratio:3/4; object-fit:cover; }
    .bold-card-body { padding:20px; }
    .bold-card-body h3 { margin:0 0 6px; font-size:18px; font-weight:800; letter-spacing:-.01em; font-family:${headingFont},system-ui,sans-serif; }
    .bold-card-body .price { font-size:20px; font-weight:900; color:${primary}; margin-top:8px; }
    .bold-card-body .old-price { font-size:14px; color:${muted}; text-decoration:line-through; margin-left:8px; }
    .bold-card-actions { display:flex; gap:8px; padding:0 20px 20px; }
    .bold-card-actions button, .bold-card-actions a { flex:1; padding:12px; border-radius:${btnRadius}; border:2px solid ${primary}; background:transparent; color:${primary}; font-size:13px; font-weight:800; cursor:pointer; text-align:center; text-decoration:none; text-transform:uppercase; letter-spacing:.04em; transition:all .2s; }
    .bold-card-actions button:hover, .bold-card-actions a:hover { background:${primary}; color:#fff; }
    .bold-card-actions .primary-btn { background:${primary}; color:#fff; }
    .bold-card-actions .primary-btn:hover { filter:brightness(1.15); }
    .hero-carousel { position:relative; width:100%; min-height:70vh; overflow:hidden; background:linear-gradient(135deg, ${primary}, ${secondary}); }
    .carousel-desktop, .carousel-mobile { position:relative; width:100%; height:100%; min-height:inherit; }
    .carousel-mobile { display:none; }
    .carousel-slide { position:absolute; inset:0; opacity:0; transition:opacity 1s ease; }
    .carousel-slide.active { opacity:1; }
    .carousel-slide img.slide-img { width:100%; height:100%; object-fit:cover; display:block; }
    .hero-overlay-text { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:40px; background:linear-gradient(transparent 30%, rgba(0,0,0,.5)); color:#fff; z-index:2; }
    .hero-overlay-text h2 { margin:0 0 12px; font-size:clamp(28px,6vw,52px); font-weight:900; letter-spacing:-.03em; text-shadow:0 4px 12px rgba(0,0,0,.4); }
    .hero-overlay-text p { margin:0 0 20px; font-size:clamp(14px,2vw,18px); opacity:.95; max-width:50ch; text-shadow:0 2px 6px rgba(0,0,0,.3); }
    .hero-overlay-text a { display:inline-block; padding:14px 36px; border-radius:${btnRadius}; background:#fff; color:${primary}; font-weight:800; font-size:15px; text-decoration:none; text-transform:uppercase; letter-spacing:.04em; transition:transform .2s; box-shadow:0 4px 16px rgba(0,0,0,.2); }
    .carousel-dots { position:absolute; bottom:20px; left:50%; transform:translateX(-50%); display:flex; gap:10px; z-index:3; }
    .carousel-dot { width:12px; height:12px; border-radius:50%; background:rgba(255,255,255,.4); cursor:pointer; transition:all .2s; }
    .carousel-dot.active { background:#fff; transform:scale(1.3); }
    .carousel-arrow { position:absolute; top:50%; transform:translateY(-50%); z-index:3; width:44px; height:44px; border-radius:50%; border:2px solid rgba(255,255,255,.5); background:rgba(0,0,0,.3); color:#fff; font-size:18px; cursor:pointer; display:grid; place-items:center; transition:all .2s; }
    .carousel-arrow:hover { background:rgba(0,0,0,.6); border-color:#fff; }
    .carousel-prev { left:20px; }
    .carousel-next { right:20px; }
    @media (max-width:640px) { .hero-carousel { min-height:50vh; } .carousel-desktop { display:none; } .carousel-mobile { display:block; } .carousel-arrow { display:none; } }
    .store-empty { padding:80px 24px; text-align:center; color:${muted}; font-size:18px; }
    .bold-footer { background:${isDark ? '#111' : '#111827'}; color:#fff; padding:48px 24px; text-align:center; }
    .bold-footer p { margin:0; opacity:.6; font-size:14px; }
    .product-detail { display:grid; grid-template-columns:1fr 1fr; gap:40px; padding:40px 24px; max-width:1100px; margin:0 auto; }
    .product-detail img { width:100%; border-radius:${radius}; aspect-ratio:3/4; object-fit:cover; }
    .product-meta { display:flex; gap:10px; flex-wrap:wrap; margin:16px 0 24px; }
    .price-tag { font-size:32px; font-weight:900; color:${primary}; }
    .stock-tag { font-size:14px; font-weight:700; color:${muted}; }
    .store-pill { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:999px; background:${primary}12; color:${primary}; font-weight:700; font-size:12px; }
    .store-nav { display:flex; gap:8px; padding:0 24px 20px; overflow-x:auto; }
    .store-nav a { padding:10px 18px; border-radius:${btnRadius}; background:${isDark ? '#111' : '#fff'}; border:1px solid ${isDark ? '#1a1a1a' : '#eee'}; font-size:13px; font-weight:700; text-decoration:none; color:${text}; transition:all .2s; text-transform:uppercase; letter-spacing:.03em; }
    .store-nav a:hover, .store-nav a.active { background:${primary}; color:#fff; border-color:${primary}; }
    .cart-page, .account-page, .checkout-page, .wishlist-page, .tracking-page { display:grid; gap:18px; padding:0 24px; max-width:900px; margin:0 auto; }
    .checkout-layout { display:grid; grid-template-columns:1.1fr .9fr; gap:20px; align-items:start; }
    .checkout-steps { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
    .checkout-step { padding:16px; border-radius:${radius}; background:${cardBg}; border:1px solid ${isDark ? '#1a1a1a' : '#eee'}; color:${muted}; }
    .checkout-step.active { color:${text}; border-color:${primary}44; }
    .checkout-step strong { display:block; margin-bottom:4px; }
    .summary-box { padding:20px; border-radius:${radius}; background:${cardBg}; border:1px solid ${isDark ? '#1a1a1a' : '#eee'}; }
    .summary-row { display:flex; justify-content:space-between; gap:10px; margin-bottom:10px; }
    .form-grid { display:grid; gap:16px; }
    .form-grid.two { grid-template-columns:repeat(2,1fr); }
    .field { display:grid; gap:8px; }
    .field label { font-weight:800; font-size:13px; text-transform:uppercase; letter-spacing:.04em; }
    .field input, .field textarea, .field select { width:100%; padding:14px 16px; border-radius:${radius}; border:2px solid ${isDark ? '#222' : '#e5e5e5'}; background:${cardBg}; font-size:14px; outline:none; transition:border-color .2s; }
    .field input:focus, .field textarea:focus, .field select:focus { border-color:${primary}; }
    .btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:14px 28px; border-radius:${btnRadius}; border:2px solid ${primary}; background:${primary}; color:#fff; font-weight:800; font-size:14px; cursor:pointer; transition:all .2s; text-decoration:none; text-transform:uppercase; letter-spacing:.03em; }
    .btn:hover { transform:translateY(-2px); filter:brightness(1.1); }
    .btn:active { transform:scale(.97); }
    .btn-secondary { background:transparent; color:${primary}; }
    .btn-outline { background:transparent; color:${primary}; border-color:${primary}; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; }
    .flash { margin:0 24px 16px; border-radius:${radius}; padding:14px 18px; font-weight:700; }
    .flash-success { background:rgba(16,185,129,.12); color:#047857; }
    .flash-error { background:rgba(239,68,68,.12); color:#b91c1c; }
    .badge { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:999px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; }
    .badge-live { background:rgba(16,185,129,.12); color:#047857; }
    .badge-pending { background:rgba(245,158,11,.14); color:#b45309; }
    .badge-confirmed { background:rgba(37,99,235,.14); color:#1d4ed8; }
    .badge-cancelled { background:rgba(239,68,68,.14); color:#b91c1c; }
    .badge-delivered { background:rgba(16,185,129,.14); color:#047857; }
    table { width:100%; border-collapse:collapse; font-size:14px; }
    th, td { text-align:left; padding:14px 12px; border-bottom:1px solid ${isDark ? '#1a1a1a' : '#eee'}; text-transform:uppercase; letter-spacing:.02em; font-size:12px; }
    th { font-weight:800; }
    .kpi-list { display:grid; gap:10px; }
    .kpi-item { display:flex; justify-content:space-between; gap:10px; padding:14px 0; border-bottom:1px solid ${isDark ? '#1a1a1a' : '#eee'}; }
    .card { background:${cardBg}; border-radius:${radius}; border:1px solid ${isDark ? '#1a1a1a' : '#eee'}; }
    .panel { padding:24px; }
    @media (max-width:920px) { .bold-grid { grid-template-columns:repeat(2,1fr); } .bold-hero { min-height:50vh; } }
    @media (max-width:640px) { .bold-grid { grid-template-columns:1fr; } .bold-hero { min-height:40vh; padding:40px 20px; } .bold-section { padding:40px 20px; } .product-detail { grid-template-columns:1fr; padding:20px; } .form-grid.two { grid-template-columns:1fr; } .checkout-layout { grid-template-columns:1fr; } .checkout-steps { grid-template-columns:1fr; } }
    `;
  }

  return renderStoreCss(template, theme);
}

function renderStoreByTheme(template, store, slug, data) {
  const layout = template && template.layout ? template.layout : 'app';
  if (layout === 'app') return renderAppStyleStore(store, slug, data);
  if (layout === 'minimal') return renderMinimalStore(store, slug, data);
  if (layout === 'bold') return renderBoldFashionStore(store, slug, data);
  return renderAppStyleStore(store, slug, data);
}

function renderAppStyleStore(store, slug, data) {
  const { products, categories, cartCount, wishlistCount, wishlist, search, selectedCategory, currentTemplate, customer, cfg, isDark, sortOptions, paginationHtml } = data;
  const primary = cfg.primaryColor || currentTemplate.colors.primary;
  const catScroll = renderCategorySection(categories, slug, cfg);
  const carousel = renderBannerCarousel(cfg, slug);
  const topBar = renderTopBar(cfg);
  const headerLayout = cfg.headerLayout || 'search';
  const productCardStyle = cfg.productCardStyle || 'style-2';
  const logoBlock = store.logo ? `<img class="app-logo" src="${escapeHtml(store.logo)}" alt="${escapeHtml(store.name)}">` : `<div class="app-logo-ph">${escapeHtml(store.name.charAt(0).toUpperCase())}</div>`;
  const headerCenter = headerLayout === 'center' ? `<div class="app-header-title">${escapeHtml(store.name)}</div>` : headerLayout === 'left' ? `<div class="app-header-title">${escapeHtml(store.name)}</div>` : `<div class="app-header-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.35-4.35"></path></svg><span>Search products...</span></div>`;
  const drawerHtml = `<div class="app-drawer-overlay" onclick="this.parentElement.classList.remove('drawer-open')"></div><aside class="app-drawer"><div class="app-drawer-top">${logoBlock}<button class="app-drawer-close" type="button" onclick="this.closest('.app-shell').classList.remove('drawer-open')">×</button></div><nav class="app-drawer-nav"><a class="app-drawer-link" href="/store/${encodeURIComponent(slug)}">Home</a><a class="app-drawer-link" href="/store/${encodeURIComponent(slug)}?category=all">Shop All</a><a class="app-drawer-link" href="/store/${encodeURIComponent(slug)}/wishlist">Wishlist</a><a class="app-drawer-link" href="/store/${encodeURIComponent(slug)}/cart">Cart</a><a class="app-drawer-link" href="/store/${encodeURIComponent(slug)}/track-order">Track Order</a><a class="app-drawer-link" href="${customer ? `/store/${encodeURIComponent(slug)}/account` : `/store/${encodeURIComponent(slug)}/account/login`}">My Account</a></nav></aside>`;
  const headerHtml = `<header class="app-header header-${escapeHtml(headerLayout)}">
    <div class="app-header-menu" onclick="this.closest('.app-shell').classList.add('drawer-open')">☰</div>
    ${logoBlock}
    ${headerCenter}
    <div class="app-actions">
      <a class="app-icon-btn" href="/store/${encodeURIComponent(slug)}/wishlist" title="Wishlist">♡${wishlistCount ? `<span class="app-badge">${wishlistCount}</span>` : ''}</a>
      <a class="app-icon-btn" href="/store/${encodeURIComponent(slug)}/cart" title="Cart">🛒${cartCount ? `<span class="app-badge">${cartCount}</span>` : ''}</a>
    </div>
  </header>`;
  const searchHtml = cfg.showSearch !== false ? `<div class="app-section" style="padding-top:10px;"><form method="GET" action="/store/${encodeURIComponent(slug)}" style="display:flex;gap:8px;"><input name="search" value="${escapeHtml(search)}" placeholder="Search products..." style="flex:1;padding:12px 16px;border-radius:999px;border:1px solid ${isDark ? '#334155' : '#e2e8f0'};background:${isDark ? '#1e293b' : '#f8fafc'};font-size:14px;outline:none;"><button class="btn" type="submit" style="padding:12px 18px;border-radius:999px;">Go</button></form></div>` : '';
  const productCards = products.map((p) => {
    const wished = wishlist.includes(p.id);
    const saleBadge = cfg.showDiscount !== false ? `<div class="app-sale-badge">${Math.max(7, Math.min(50, Math.round((p.price || 0) % 37) + 7))}% OFF</div>` : '';
    const oldPrice = Number(p.price || 0) ? `<span class="old-price">${escapeHtml(formatMoney(Number(p.price || 0) * 1.25))}</span>` : '';
    return `<div class="app-card product-style-${escapeHtml(productCardStyle)}"><div class="app-card-figure">${saleBadge}<a href="/store/${encodeURIComponent(slug)}/product/${encodeURIComponent(p.id)}">${p.image ? `<img class="app-card-img" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}">` : `<div class="app-card-img" style="display:grid;place-items:center;color:#94a3b8;font-size:13px;">No image</div>`}</a></div><div class="app-card-body"><h3>${escapeHtml(p.name)}</h3><div><span class="price">${escapeHtml(formatMoney(p.price))}</span>${oldPrice}</div><span class="stock">${escapeHtml(String(p.stock || 0))} left</span></div><div class="app-card-actions"><form method="POST" action="/store/${encodeURIComponent(slug)}/cart/add/${encodeURIComponent(p.id)}"><button class="primary-btn" type="submit">Add</button></form><form method="POST" action="/store/${encodeURIComponent(slug)}/wishlist/toggle/${encodeURIComponent(p.id)}"><button class="${wished ? 'wishlist-active' : ''}" type="submit">${wished ? '♥' : '♡'}</button></form></div></div>`;
  }).join('');
  const flashDeals = products.slice(0, 3).length ? `<div class="app-section"><div class="flash-strip"><div class="flash-title"><span>⚡</span><strong>Flash Deals</strong></div><div class="flash-timer"><span>⏱</span><strong>05</strong><strong>25</strong><strong>44</strong></div></div><div class="app-grid">${products.slice(0, 3).map((p) => {
    const wished = wishlist.includes(p.id);
    return `<div class="app-card product-style-${escapeHtml(productCardStyle)}"><div class="app-card-figure">${cfg.showDiscount !== false ? `<div class="app-sale-badge">${Math.max(7, Math.min(50, Math.round((p.price || 0) % 37) + 7))}% OFF</div>` : ''}<a href="/store/${encodeURIComponent(slug)}/product/${encodeURIComponent(p.id)}">${p.image ? `<img class="app-card-img" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}">` : `<div class="app-card-img" style="display:grid;place-items:center;color:#94a3b8;font-size:13px;">No image</div>`}</a></div><div class="app-card-body"><h3>${escapeHtml(p.name)}</h3><div><span class="price">${escapeHtml(formatMoney(p.price))}</span><span class="old-price">${escapeHtml(formatMoney(Number(p.price || 0) * 1.25))}</span></div></div><div class="app-card-actions"><form method="POST" action="/store/${encodeURIComponent(slug)}/cart/add/${encodeURIComponent(p.id)}"><button class="primary-btn" type="submit">Add</button></form><form method="POST" action="/store/${encodeURIComponent(slug)}/wishlist/toggle/${encodeURIComponent(p.id)}"><button class="${wished ? 'wishlist-active' : ''}" type="submit">${wished ? '♥' : '♡'}</button></form></div></div>`;
  }).join('')}</div></div>` : '';
  const productsSection = `<div class="app-section"><div class="app-section-head"><h2 class="app-section-title">All Products</h2></div>${sortOptions || ''}<div class="app-grid ${productCardStyle === 'style-4' ? 'list-layout' : ''}">${productCards || '<div class="store-empty">No products yet.</div>'}</div>${paginationHtml || ''}</div>`;
  const waLink = store.whatsapp ? `<a class="app-float-wa" href="https://wa.me/${encodeURIComponent(store.whatsapp)}" target="_blank" rel="noopener">💬</a>` : '';
  const bottomNav = `<nav class="app-bottom-nav nav-${escapeHtml(cfg.bottomNavStyle || 'classic')}"><a href="/store/${encodeURIComponent(slug)}" class="active"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><span>Home</span></a><a href="/store/${encodeURIComponent(slug)}/cart"><svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg><span>Cart</span></a><a href="/store/${encodeURIComponent(slug)}/wishlist"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg><span>Wishlist</span></a><a href="${customer ? `/store/${encodeURIComponent(slug)}/account` : `/store/${encodeURIComponent(slug)}/account/login`}"><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>Account</span></a></nav>`;
  return `<div class="app-shell">${drawerHtml}${topBar}${headerHtml}${carousel}${searchHtml}${catScroll}${flashDeals}${productsSection}<div class="store-footer">Powered by MyShopBuilder</div>${waLink}${bottomNav}</div>`;
}

function renderMinimalStore(store, slug, data) {
  const { products, categories, cartCount, wishlistCount, wishlist, search, selectedCategory, currentTemplate, customer, cfg, isDark } = data;
  const primary = cfg.primaryColor || currentTemplate.colors.primary;
  const carousel = renderBannerCarousel(cfg, slug);
  const topBar = renderTopBar(cfg);
  const catPills = categories.length ? `<div class="store-nav">${categories.map((cat) => {
    const img = cat.image ? `<img src="${escapeHtml(cat.image)}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;margin-right:6px;vertical-align:middle;">` : '';
    return `<a href="/store/${encodeURIComponent(slug)}?category=${encodeURIComponent(cat.name)}" class="${selectedCategory === cat.name ? 'active' : ''}">${img}${escapeHtml(cat.name)}</a>`;
  }).join('')}</div>` : '';
  const searchHtml = cfg.showSearch !== false ? `<form method="GET" action="/store/${encodeURIComponent(slug)}" class="store-nav" style="justify-content:center;"><input name="search" value="${escapeHtml(search)}" placeholder="Search products..." style="padding:10px 14px;border-radius:999px;border:1px solid #e2e8f0;width:min(400px,100%);font-size:14px;outline:none;"><button class="btn" type="submit" style="padding:10px 20px;border-radius:999px;">Search</button></form>` : '';
  const productCards = products.map((p) => {
    const wished = wishlist.includes(p.id);
    return `<div class="store-card"><a href="/store/${encodeURIComponent(slug)}/product/${encodeURIComponent(p.id)}" style="text-decoration:none;color:inherit;">${p.image ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}">` : `<div style="width:100%;aspect-ratio:1/1;background:#f8fafc;display:grid;place-items:center;color:#94a3b8;font-size:13px;">No image</div>`}</a><div class="store-card-body"><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description)}</p><div class="price-row"><span class="price-tag">${escapeHtml(formatMoney(p.price))}</span><span class="stock-tag">${escapeHtml(p.stock || '0')} in stock</span></div></div><div class="store-card-actions"><form method="POST" action="/store/${encodeURIComponent(slug)}/cart/add/${encodeURIComponent(p.id)}"><button type="submit">Add to Cart</button></form><form method="POST" action="/store/${encodeURIComponent(slug)}/wishlist/toggle/${encodeURIComponent(p.id)}"><button class="btn-outline ${wished ? 'wishlist-active' : ''}" type="submit" style="padding:10px;border-radius:14px;font-size:13px;font-weight:700;cursor:pointer;">${wished ? '♥' : '♡'}</button></form></div></div>`;
  }).join('');
  return `${topBar}${carousel}<div class="store-header">${store.logo ? `<img class="store-logo" src="${escapeHtml(store.logo)}" alt="${escapeHtml(store.name)}">` : `<div class="store-logo-ph">${escapeHtml(store.name.charAt(0).toUpperCase())}</div>`}<h1 class="store-title">${escapeHtml(store.name)}</h1><p class="store-desc">${escapeHtml(store.description)}</p><div class="store-meta"><span class="store-badge">Products ${escapeHtml(String(products.length))}</span><span class="store-badge">Visits ${escapeHtml(String(store.visits))}</span></div><div class="store-hero-actions"><span class="store-pill">Cart ${escapeHtml(String(cartCount))}</span><a class="btn btn-secondary" href="/store/${encodeURIComponent(slug)}/cart">Cart</a><a class="btn btn-secondary" href="/store/${encodeURIComponent(slug)}/wishlist">Wishlist</a><a class="btn btn-secondary" href="/store/${encodeURIComponent(slug)}/track-order">Track</a>${customer ? `<a class="btn btn-secondary" href="/store/${encodeURIComponent(slug)}/account">Account</a>` : `<a class="btn btn-secondary" href="/store/${encodeURIComponent(slug)}/account/login">Login</a>`}</div></div>${searchHtml}${catPills}<div class="store-grid">${productCards || '<div class="store-empty">No products yet.</div>'}</div><div class="store-footer">Powered by MyShopBuilder</div>`;
}

function renderBoldFashionStore(store, slug, data) {
  const { products, categories, cartCount, wishlistCount, wishlist, search, selectedCategory, currentTemplate, customer, cfg, isDark } = data;
  const primary = cfg.primaryColor || currentTemplate.colors.primary;
  const carousel = renderBannerCarousel(cfg, slug);
  const topBar = renderTopBar(cfg);
  const nav = `<nav class="bold-nav"><div><strong style="font-size:18px;font-weight:900;letter-spacing:-.02em;">${escapeHtml(store.name)}</strong></div><div class="bold-nav-links"><a href="/store/${encodeURIComponent(slug)}/cart">Cart (${escapeHtml(String(cartCount))})</a><a href="/store/${encodeURIComponent(slug)}/wishlist">Wishlist</a><a href="/store/${encodeURIComponent(slug)}/track-order">Track</a>${customer ? `<a href="/store/${encodeURIComponent(slug)}/account">Account</a>` : `<a href="/store/${encodeURIComponent(slug)}/account/login">Login</a>`}</div></nav>`;
  const catPills = categories.length ? `<div class="store-nav">${categories.map((cat) => {
    const img = cat.image ? `<img src="${escapeHtml(cat.image)}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;margin-right:4px;vertical-align:middle;">` : '';
    return `<a href="/store/${encodeURIComponent(slug)}?category=${encodeURIComponent(cat.name)}">${img}${escapeHtml(cat.name)}</a>`;
  }).join('')}</div>` : '';
  const productCards = products.map((p) => {
    const wished = wishlist.includes(p.id);
    return `<div class="bold-card">${p.image ? `<a href="/store/${encodeURIComponent(slug)}/product/${encodeURIComponent(p.id)}"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}"></a>` : `<div style="width:100%;aspect-ratio:3/4;background:#f0f0f0;display:grid;place-items:center;color:#999;font-size:14px;">No image</div>`}<div class="bold-card-body"><h3>${escapeHtml(p.name)}</h3><div><span class="price">${escapeHtml(formatMoney(p.price))}</span></div></div><div class="bold-card-actions"><form method="POST" action="/store/${encodeURIComponent(slug)}/cart/add/${encodeURIComponent(p.id)}"><button class="primary-btn" type="submit">Add to Cart</button></form><form method="POST" action="/store/${encodeURIComponent(slug)}/wishlist/toggle/${encodeURIComponent(p.id)}"><button type="submit">${wished ? '♥ Saved' : '♡ Save'}</button></form></div></div>`;
  }).join('');
  const productsSection = `<div class="bold-section"><h2 class="bold-section-title">New Arrivals</h2><p class="bold-section-sub">Discover our latest collection</p><div class="bold-grid">${productCards || '<div class="store-empty">No products yet.</div>'}</div></div>`;
  const footer = `<footer class="bold-footer"><p>${escapeHtml(store.name)} · Powered by MyShopBuilder</p></footer>`;
  return `${topBar}${nav}${carousel}${catPills}${productsSection}${footer}`;
}

function renderGlobalError(title, message, statusCode) {
  return renderHtmlShell(title, `
<div class="error-page">
  <div class="card error-card">
    <div class="badge badge-${statusCode === 404 ? 'pending' : 'cancelled'}">${escapeHtml(String(statusCode || 500))}</div>
    <h1 class="section-title">${escapeHtml(title)}</h1>
    <p class="section-subtitle">${escapeHtml(message)}</p>
    <div class="actions" style="justify-content:center;">
      <a class="btn" href="/">Home</a>
      <a class="btn btn-secondary" href="/login">Login</a>
    </div>
  </div>
</div>`);
}

function getTemplateById(db, templateId) {
  const template = (db.templates || []).find((item) => item.id === templateId);
  return template || DEFAULT_TEMPLATES[0];
}

function getStoreOwner(db, store) {
  return store && store.ownerId ? db.users[store.ownerId] : null;
}

function sanitizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) {
    return 'Rs 0';
  }
  return `Rs ${amount.toLocaleString('en-IN')}`;
}

function getStatusBadge(status) {
  const safeStatus = ORDER_STATUSES.includes(status) ? status : 'pending';
  return `<span class="badge badge-${escapeHtml(safeStatus)}">${escapeHtml(safeStatus)}</span>`;
}

function getStoreRevenue(store) {
  return store.orders
    .filter((order) => order.status === 'confirmed' || order.status === 'delivered')
    .reduce((sum, order) => sum + Number(order.amount || 0), 0);
}

function getStoreCustomerCount(store) {
  return store.customers ? Object.keys(store.customers).length : 0;
}

function getSessionStoreObject(req, key) {
  if (!req.session[key] || typeof req.session[key] !== 'object') {
    req.session[key] = {};
  }
  return req.session[key];
}

function getCheckoutDraft(req, slug) {
  const drafts = getSessionStoreObject(req, 'checkoutDrafts');
  if (!drafts[slug] || typeof drafts[slug] !== 'object') {
    drafts[slug] = { mode: 'cart', step: 'contact' };
  } else {
    drafts[slug].mode = drafts[slug].mode === 'buy-now' ? 'buy-now' : 'cart';
    drafts[slug].step = ['contact', 'shipping', 'payment'].includes(drafts[slug].step) ? drafts[slug].step : 'contact';
  }
  return drafts[slug];
}

function saveCheckoutDraft(req, slug, draft) {
  const drafts = getSessionStoreObject(req, 'checkoutDrafts');
  drafts[slug] = draft;
}

function clearCheckoutDraft(req, slug) {
  const drafts = getSessionStoreObject(req, 'checkoutDrafts');
  delete drafts[slug];
}

function normalizeCheckoutMode(value) {
  return String(value || '').trim() === 'buy-now' ? 'buy-now' : 'cart';
}

function normalizeCheckoutStep(value) {
  return ['contact', 'shipping', 'payment'].includes(String(value || '').trim()) ? String(value || '').trim() : 'contact';
}

function getCheckoutLineItems(store, draft, cartDetails) {
  if (draft.mode === 'buy-now' && Array.isArray(draft.items) && draft.items.length) {
    return draft.items.map((item) => {
      const product = store.products.find((entry) => entry.id === item.productId);
      if (!product) {
        return null;
      }
      const quantity = Math.max(1, Number(item.quantity || 1));
      return {
        product,
        quantity,
        subtotal: Number(product.price || 0) * quantity
      };
    }).filter(Boolean);
  }
  return cartDetails;
}

function getStoreCart(req, slug) {
  const carts = getSessionStoreObject(req, 'carts');
  if (!Array.isArray(carts[slug])) {
    carts[slug] = [];
  }
  return carts[slug];
}

function saveStoreCart(req, slug, cart) {
  const carts = getSessionStoreObject(req, 'carts');
  carts[slug] = cart;
}

function getStoreWishlist(req, slug) {
  const wishlists = getSessionStoreObject(req, 'wishlists');
  if (!Array.isArray(wishlists[slug])) {
    wishlists[slug] = [];
  }
  return wishlists[slug];
}

function saveStoreWishlist(req, slug, wishlist) {
  const wishlists = getSessionStoreObject(req, 'wishlists');
  wishlists[slug] = wishlist;
}

function getLoggedCustomer(req, slug) {
  const customerSession = req.session.customerSession;
  if (!customerSession || customerSession.storeSlug !== slug || !customerSession.email) {
    return null;
  }
  const db = loadDB();
  const store = db.stores[slug];
  if (!store || !store.customers) {
    return null;
  }
  const customer = store.customers[customerSession.email];
  return customer || null;
}

function setLoggedCustomer(req, slug, email) {
  req.session.customerSession = { storeSlug: slug, email };
  req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
}

function clearLoggedCustomer(req) {
  delete req.session.customerSession;
}

function addProductToCart(req, slug, productId, quantity) {
  const db = loadDB();
  const store = db.stores[slug];
  if (!store) {
    return { ok: false, message: 'Store not found.' };
  }
  const product = store.products.find((item) => item.id === productId);
  if (!product) {
    return { ok: false, message: 'Product not found.' };
  }
  const cart = getStoreCart(req, slug);
  const qty = Math.max(1, Number(quantity || 1));
  const existing = cart.find((item) => item.productId === productId);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({ productId, quantity: qty });
  }
  saveStoreCart(req, slug, cart);
  return { ok: true };
}

function removeProductFromCart(req, slug, productId) {
  const cart = getStoreCart(req, slug).filter((item) => item.productId !== productId);
  saveStoreCart(req, slug, cart);
}

function toggleWishlistProduct(req, slug, productId) {
  const wishlist = getStoreWishlist(req, slug);
  const index = wishlist.indexOf(productId);
  const db = loadDB();
  const store = db.stores[slug];
  const loggedCustomer = getLoggedCustomer(req, slug);
  if (index >= 0) {
    wishlist.splice(index, 1);
    saveStoreWishlist(req, slug, wishlist);
    if (store && loggedCustomer) {
      store.customers = store.customers && typeof store.customers === 'object' ? store.customers : {};
      const customer = store.customers[loggedCustomer.email];
      if (customer) {
        customer.wishlist = Array.isArray(customer.wishlist) ? customer.wishlist.filter((item) => item !== productId) : [];
        saveDB(db);
      }
    }
    return false;
  }
  wishlist.push(productId);
  saveStoreWishlist(req, slug, wishlist);
  if (store && loggedCustomer) {
    store.customers = store.customers && typeof store.customers === 'object' ? store.customers : {};
    const customer = store.customers[loggedCustomer.email];
    if (customer) {
      customer.wishlist = Array.isArray(customer.wishlist) ? customer.wishlist : [];
      if (!customer.wishlist.includes(productId)) {
        customer.wishlist.push(productId);
      }
      saveDB(db);
    }
  }
  return true;
}

function getCartDetails(store, cart) {
  return cart.map((item) => {
    const product = store.products.find((p) => p.id === item.productId);
    const quantity = Math.max(1, Number(item.quantity || 1));
    const price = Number(product ? product.price : 0);
    return {
      product,
      quantity,
      subtotal: price * quantity
    };
  }).filter((item) => item.product);
}

function generateTrackingCode() {
  return `trk_${generateId('o').split('_')[1].slice(0, 8)}`;
}

function generateOrderNumber(store) {
  const count = (store.orders || []).length + 1001;
  return `#${count}`;
}

function getUniqueCustomers(store) {
  const map = new Map();
  store.orders.forEach((order) => {
    const key = `${String(order.customerPhone || '').trim()}|${String(order.customerName || '').trim()}`;
    if (!map.has(key)) {
      map.set(key, {
        name: order.customerName || 'WhatsApp lead',
        phone: order.customerPhone || '-',
        firstSeen: order.createdAt,
        orders: 0
      });
    }
    const item = map.get(key);
    item.orders += 1;
  });
  return [...map.values()].sort((a, b) => b.orders - a.orders);
}

function renderMiniBar(label, value, max, color) {
  const width = max > 0 ? Math.max(6, Math.round((Number(value) / max) * 100)) : 6;
  return `<div class="mini-bar-row"><div class="mini-bar-label">${escapeHtml(label)}</div><div class="mini-bar-track"><div class="mini-bar-fill" style="width:${width}%; background:${color};"></div></div><div class="mini-bar-value">${escapeHtml(String(value))}</div></div>`;
}

function getSetupChecklist(store) {
  const hasLogo = Boolean(store.logo);
  const hasDescription = Boolean(String(store.description || '').trim());
  const hasProduct = (store.products || []).length > 0;
  const hasWhatsApp = Boolean(String(store.whatsapp || '').trim());
  const hasTheme = Boolean(store.template);
  const hasSettings = store.theme === 'default' || store.theme === 'dark';
  const items = [
    { done: hasLogo, title: 'Add store logo', hint: 'Brand your storefront' },
    { done: hasDescription, title: 'Add store description', hint: 'Tell customers what you sell' },
    { done: hasProduct, title: 'Add your first product', hint: 'Start catalog setup' },
    { done: hasWhatsApp, title: 'Set WhatsApp number', hint: 'Connect leads to chat' },
    { done: hasTheme, title: 'Choose a template', hint: 'Pick your visual style' },
    { done: hasSettings, title: 'Theme mode set', hint: 'Default or dark' }
  ];
  const doneCount = items.filter((item) => item.done).length;
  return { items, doneCount, total: items.length };
}

function getBaseUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']).split(',')[0].trim() : req.protocol;
  const host = req.get('host') || `localhost:${PORT}`;
  return `${protocol}://${host}`;
}

function ensureAbsolutePath(relativePath) {
  const clean = String(relativePath || '').replace(/^\/+/, '');
  return path.join(PUBLIC_DIR, clean);
}

function removeStoredFile(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') {
    return;
  }
  if (!relativePath.startsWith('/logos/') && !relativePath.startsWith('/products/')) {
    return;
  }
  const absolute = ensureAbsolutePath(relativePath);
  if (absolute.startsWith(PUBLIC_DIR) && fs.existsSync(absolute)) {
    try {
      fs.unlinkSync(absolute);
    } catch (error) {
    }
  }
}

function getExtensionFromMime(mime) {
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  return '.bin';
}

function saveUploadedFile(file, type) {
  if (!file) {
    throw new Error('No file provided.');
  }
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    throw new Error('Only JPEG, PNG, WEBP, and GIF files are allowed.');
  }
  const ext = getExtensionFromMime(file.mimetype);
  const filename = `${generateId(type === 'logo' ? 'logo' : 'product')}${ext}`;
  const destinationDir = type === 'logo' ? LOGOS_DIR : PRODUCTS_DIR;
  const relativeBase = type === 'logo' ? '/logos/' : '/products/';
  const absolutePath = path.join(destinationDir, filename);
  fs.writeFileSync(absolutePath, file.buffer);
  return `${relativeBase}${filename}`;
}

function runUploader(uploader, req, res) {
  return new Promise((resolve, reject) => {
    uploader(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function route(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      console.error(`[ERROR] ${req.method} ${req.path}`, error.message || error);
      next(error);
    }
  };
}

function requireAuth(req, res, next) {
  try {
    if (!req.session.userId) {
      setFlash(req, 'error', 'Please log in to continue.');
      res.redirect('/login');
      return;
    }
    const db = loadDB();
    const user = db.users[req.session.userId];
    if (!user || !user.storeSlug || !db.stores[user.storeSlug]) {
      req.session.userId = null;
      setFlash(req, 'error', 'Your account session is no longer valid.');
      res.redirect('/login');
      return;
    }
    req.db = db;
    req.currentUser = user;
    req.currentStore = db.stores[user.storeSlug];
    next();
  } catch (error) {
    next(error);
  }
}

function requireSuperAdmin(req, res, next) {
  try {
    if (req.session.superAdminId !== 'superadmin') {
      setFlash(req, 'error', 'Please log in as super admin.');
      res.redirect('/superadmin');
      return;
    }
    const db = loadDB();
    if (!db.superAdmin || !db.superAdmin.email || !db.superAdmin.passwordHash) {
      setFlash(req, 'error', 'Super admin is not available.');
      res.redirect('/superadmin');
      return;
    }
    req.db = db;
    next();
  } catch (error) {
    next(error);
  }
}

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

function renderAdminLayout(req, title, activeKey, content) {
  const store = req.currentStore;
  const flash = renderFlashMessages(req);
  const items = [
    { section: 'Overview', key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: '▦' },
    { section: 'Overview', key: 'analytics', label: 'Analytics', href: '/dashboard/analytics', icon: '⌁' },
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
    { section: 'Appearance & Settings', key: 'theme', label: 'Theme', href: '/dashboard/theme', icon: '◐' },
    { section: 'Appearance & Settings', key: 'pages', label: 'Pages', href: '/dashboard/pages', icon: '▤' },
    { section: 'Appearance & Settings', key: 'domain', label: 'Domain', href: '/dashboard/domain', icon: '◈' },
    { section: 'Appearance & Settings', key: 'settings', label: 'Store Settings', href: '/dashboard/settings', icon: '⚙' },
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
        return `<a class="nav-link ${active}" href="${escapeHtml(item.href)}"${target}><span class="nav-icon">${escapeHtml(item.icon || '•')}</span><span class="nav-label">${escapeHtml(item.label)}</span>${item.key === 'orders' ? '<span class="nav-badge">3</span>' : ''}</a>`;
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
  <a href="/dashboard/settings"${activeKey === 'settings' ? ' class="active"' : ''}><svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>Profile</span></a>
</nav>`, { extraStyles: adminStyles });
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

async function ensureDatabaseReady() {
  ensureDirectories();
  let db = loadDB();
  let changed = false;
  if (!db.superAdmin || !db.superAdmin.email || !db.superAdmin.passwordHash) {
    db.superAdmin = {
      email: 'admin@myshopbuilder.com',
      passwordHash: hashPassword('123Radhe456@')
    };
    changed = true;
  } else if (db.superAdmin.email === 'admin@myshopbuilder.com') {
    db.superAdmin.passwordHash = hashPassword('123Radhe456@');
    changed = true;
  }
  if (!Array.isArray(db.templates) || !db.templates.length) {
    db.templates = DEFAULT_TEMPLATES;
    changed = true;
  }
  if (changed) {
    saveDB(db);
  }
}

function getPlatformStartedAt() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return new Date().toISOString();
    }
    return fs.statSync(DB_PATH).birthtime.toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

// Security headers
if (helmet) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://checkout.razorpay.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
        objectSrc: ["'none'"],
        frameSrc: ["https://api.razorpay.com"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));
}

// Rate limiting
if (rateLimit) {
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: 'Too many attempts. Try again later.' });
  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
  app.use('/login', authLimiter);
  app.use('/register', authLimiter);
  app.use('/superadmin', authLimiter);
  app.use('/', apiLimiter);
}

app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.set('trust proxy', 1);
app.use('/public', express.static(PUBLIC_DIR, { maxAge: '7d', etag: true, lastModified: true }));

const fileSessionStore = MemoryStore ? new MemoryStore({ checkPeriod: 86400000 }) : new FileSessionStore();
app.use(session({
  store: fileSessionStore,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));
app.use('/logos', express.static(LOGOS_DIR));
app.use('/products', express.static(PRODUCTS_DIR));

app.get('/', route(async (req, res) => {
  const db = loadDB();
  const templatesHtml = db.templates.map((template) => `
      <div class="card template-card">
        <div class="template-preview" style="background: linear-gradient(135deg, ${escapeHtml(template.colors.primary)}, ${escapeHtml(template.colors.secondary)});"></div>
        <h3>${escapeHtml(template.name)}</h3>
        <p class="muted">Multi-tenant store theme with clean product cards and mobile-ready storefront.</p>
      </div>
    `).join('');
  res.send(renderHtmlShell('MyShopBuilder', `
      <div class="page">
        <div class="container">
          <div class="card hero hero-card">
            <div>
              <div class="badge badge-live">Live SaaS MVP</div>
              <h1>Launch a store, manage products, and sell on WhatsApp.</h1>
              <p>MyShopBuilder is a Shopify-style storefront platform with tenant-isolated dashboards, public store pages, and a separate super admin panel.</p>
              <div class="actions">
                <a class="btn" href="/register">Create Your Store</a>
                <a class="btn btn-secondary" href="/login">User Login</a>
              </div>
            </div>
            <div class="card panel">
              <div class="kpi-list">
                <div class="kpi-item"><strong>Users</strong><span>${escapeHtml(String(Object.keys(db.users).length))}</span></div>
                <div class="kpi-item"><strong>Stores</strong><span>${escapeHtml(String(Object.keys(db.stores).length))}</span></div>
                <div class="kpi-item"><strong>Templates</strong><span>${escapeHtml(String(db.templates.length))}</span></div>
                <div class="kpi-item"><strong>Hostinger Friendly</strong><span>Yes</span></div>
              </div>
            </div>
          </div>
          <div style="height:24px;"></div>
          <div class="grid-3">${templatesHtml}</div>
        </div>
      </div>
    `));
}));

app.get('/register', route(async (req, res) => {
  const db = loadDB();
  const flash = renderFlashMessages(req);
  const templateOptions = db.templates.map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name)}</option>`).join('');
  res.send(renderHtmlShell('Register - MyShopBuilder', `
      <div class="auth-wrap">
        <div class="card auth-card">
          ${flash}
          <h1 class="section-title">Create your store</h1>
          <p class="section-subtitle">Quick setup. Fill the basics and go live.</p>
          <form method="POST" action="/register" enctype="multipart/form-data" class="form-grid">
            <div class="field"><label for="name">Full Name</label><input id="name" name="name" autocomplete="name" placeholder="Rahul Sharma" required></div>
            <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" placeholder="you@email.com" required></div>
            <div class="field"><label for="phone">Phone / WhatsApp</label><input id="phone" name="phone" autocomplete="tel" placeholder="9876543210" required></div>
            <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="new-password" placeholder="Minimum 8 characters" required></div>
            <div class="field"><label for="storeName">Store Name</label><input id="storeName" name="storeName" placeholder="My Store" required></div>
            <div class="field"><label for="template">Template</label><select id="template" name="template" required>${templateOptions}</select></div>
            <div class="field"><label for="description">Store Description</label><textarea id="description" name="description" maxlength="200" placeholder="Best products online" required></textarea></div>
            <div class="field"><label for="logo">Store Logo</label><input id="logo" name="logo" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" required></div>
            <div class="actions"><button class="btn" type="submit">Create Store</button><a class="btn btn-secondary" href="/login">Already have an account?</a></div>
          </form>
        </div>
      </div>
    `));
}));

app.post('/register', route(async (req, res) => {
  try {
    await runUploader(upload.single('logo'), req, res);
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = sanitizePhone(req.body.phone || '');
    const password = String(req.body.password || '');
    const storeName = String(req.body.storeName || '').trim();
    const description = String(req.body.description || '').trim();
    const templateId = String(req.body.template || '').trim();
    const db = loadDB();
    const templateExists = db.templates.some((item) => item.id === templateId);
    if (!name) { setFlash(req, 'error', 'Full name is required.'); res.redirect('/register'); return; }
    if (!validateEmail(email)) { setFlash(req, 'error', 'Please enter a valid email address.'); res.redirect('/register'); return; }
    if (phone.length < 10) { setFlash(req, 'error', 'Phone number must be at least 10 digits.'); res.redirect('/register'); return; }
    if (password.length < 8) { setFlash(req, 'error', 'Password must be at least 8 characters.'); res.redirect('/register'); return; }
    if (storeName.length < 3) { setFlash(req, 'error', 'Store name must be at least 3 characters.'); res.redirect('/register'); return; }
    if (!description || description.length > 200) { setFlash(req, 'error', 'Store description is required and must be at most 200 characters.'); res.redirect('/register'); return; }
    if (!templateExists) { setFlash(req, 'error', 'Please choose a valid template.'); res.redirect('/register'); return; }
    if (db.users[email]) { setFlash(req, 'error', 'Email already exists.'); res.redirect('/register'); return; }
    if (!req.file) { setFlash(req, 'error', 'Store logo is required.'); res.redirect('/register'); return; }
    if (req.file.size > 5 * 1024 * 1024) { setFlash(req, 'error', 'Logo size must be 5MB or less.'); res.redirect('/register'); return; }
    const logoPath = saveUploadedFile(req.file, 'logo');
    let slug = slugify(storeName) || `store-${Math.floor(Math.random() * 9000 + 1000)}`;
    while (db.stores[slug]) {
      slug = `${slugify(storeName) || 'store'}-${Math.floor(Math.random() * 9000 + 1000)}`;
    }
    const createdAt = new Date().toISOString();
    const passwordHash = hashPassword(password);
    db.users[email] = { id: email, email, name, phone, passwordHash, storeSlug: slug, createdAt };
    db.stores[slug] = { slug, ownerId: email, name: storeName, description, whatsapp: phone, logo: logoPath, template: templateId, theme: 'default', products: [], orders: [], customers: {}, visits: 0, createdAt };
    saveDB(db);
    req.session.userId = email;
    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    setFlash(req, 'success', 'Store created successfully.');
    res.redirect('/dashboard');
  } catch (error) {
    setFlash(req, 'error', error.message || 'Registration failed.');
    res.redirect('/register');
  }
}));

app.get('/login', route(async (req, res) => {
  const flash = renderFlashMessages(req);
  res.send(renderHtmlShell('Login - MyShopBuilder', `
      <div class="auth-wrap">
        <div class="card auth-card">
          ${flash}
          <h1 class="section-title">User login</h1>
          <p class="section-subtitle">Use the email and password you created.</p>
          <form method="POST" action="/login" class="form-grid">
            <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" placeholder="you@email.com" required></div>
            <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Your password" required></div>
            <div class="field" style="display:flex; align-items:center; gap:10px;">
              <input id="rememberMe" name="rememberMe" type="checkbox" style="width:18px; height:18px;">
              <label for="rememberMe" style="margin:0; font-weight:600;">Keep me logged in</label>
            </div>
            <div class="actions"><button class="btn" type="submit">Login</button><a class="btn btn-secondary" href="/register">Create account</a></div>
          </form>
        </div>
      </div>
    `));
}));

app.post('/login', route(async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const rememberMe = String(req.body.rememberMe || '') === 'on';
    if (!validateEmail(email)) { setFlash(req, 'error', 'Please enter a valid email address.'); res.redirect('/login'); return; }
    if (!password) { setFlash(req, 'error', 'Password is required.'); res.redirect('/login'); return; }
    const db = loadDB();
    const user = db.users[email];
    if (!user) { setFlash(req, 'error', 'Invalid email or password.'); res.redirect('/login'); return; }
    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) { setFlash(req, 'error', 'Invalid email or password.'); res.redirect('/login'); return; }
    req.session.userId = user.id;
    req.session.cookie.maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    setFlash(req, 'success', 'Welcome back.');
    res.redirect('/dashboard');
  } catch (error) {
    setFlash(req, 'error', 'Login failed.');
    res.redirect('/login');
  }
}));

app.get('/logout', route(async (req, res) => {
  try {
    await new Promise((resolve) => req.session.destroy(() => resolve()));
    res.redirect('/login');
  } catch (error) {
    res.redirect('/login');
  }
}));

app.get('/dashboard', requireAuth, route(async (req, res) => {
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
  const setupHtml = checklist.items.map((item) => `
    <div class="setup-item">
      <div class="setup-check ${item.done ? 'done' : ''}">${item.done ? '✓' : '•'}</div>
      <div>
        <div class="setup-title${item.done ? '' : ''}">${escapeHtml(item.title)}</div>
        <div class="setup-hint">${escapeHtml(item.hint)}</div>
      </div>
    </div>
  `).join('');
  const todayOrders = store.orders.filter((o) => new Date(o.createdAt).toDateString() === new Date().toDateString()).length;
  const todayRevenue = store.orders.filter((o) => ['confirmed', 'delivered'].includes(o.status) && new Date(o.createdAt).toDateString() === new Date().toDateString()).reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const pendingOrders = store.orders.filter((o) => o.status === 'pending').length;
  const abandonedCount = Array.isArray(store.abandonedCarts) ? store.abandonedCarts.length : 1;
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
    { label: 'Products', value: store.products.length, icon: '▣', color: '#3b5bfd' },
    { label: 'Orders', value: store.orders.length, icon: '◫', color: '#10b981' },
    { label: 'Revenue', value: formatMoney(revenue), icon: '↗', color: '#f59e0b' },
    { label: 'Views', value: store.visits, icon: '◌', color: '#8b5cf6' }
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
        <a class="btn btn-secondary" href="/dashboard/analytics">Guide</a>
      </div>

      <section class="card hero-card">
        <div class="page-header" style="margin-bottom:0;">
          <div>
            <div class="badge badge-live" style="margin-bottom:12px;">Store is live</div>
            <h2 class="section-title" style="margin:0 0 8px; font-size:26px;">Run your shop from one clean screen.</h2>
            <p class="section-subtitle" style="max-width:62ch; margin-bottom:18px;">Add products, track orders, and change your store look without hunting around. Everything is arranged in simple steps.</p>
            <div class="hero-meta">
              <span class="topbar-pill">Store: ${escapeHtml(store.slug)}</span>
              <span class="topbar-pill">Orders: ${escapeHtml(String(store.orders.length))}</span>
              <span class="topbar-pill">Products: ${escapeHtml(String(store.products.length))}</span>
            </div>
          </div>
          <div class="action-bar">
            <a class="btn" href="/dashboard/products">Add product</a>
            <a class="btn btn-secondary" href="/store/${escapeHtml(store.slug)}" target="_blank" rel="noopener noreferrer">Open store</a>
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
                <div class="metric-icon" style="background:#10b98114; color:#10b981;">◫</div>
                <div><div class="metric-label">Today's Orders</div><div class="metric-value" style="font-size:22px;">${escapeHtml(String(todayOrders))}</div></div>
              </div>
              <div class="card metric-card" style="box-shadow:none;">
                <div class="metric-icon" style="background:#f59e0b14; color:#f59e0b;">↗</div>
                <div><div class="metric-label">Today's Revenue</div><div class="metric-value" style="font-size:22px;">${escapeHtml(formatMoney(todayRevenue))}</div></div>
              </div>
              <div class="card metric-card" style="box-shadow:none;">
                <div class="metric-icon" style="background:#3b5bfd14; color:#3b5bfd;">◔</div>
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

app.get('/dashboard/products', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const rows = store.products.length ? `
      <div class="table-wrap"><table><thead><tr><th>Image</th><th>Name</th><th>Price</th><th>Stock</th><th>Date</th><th>Edit</th><th>Delete</th></tr></thead><tbody>
      ${store.products.map((product) => `<tr><td>${product.image ? `<img class="product-thumb" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : '-'}</td><td>${escapeHtml(product.name)}</td><td>${escapeHtml(formatMoney(product.price))}</td><td>${escapeHtml(product.stock)}</td><td>${escapeHtml(formatDate(product.createdAt))}</td><td><a class="btn btn-secondary" href="/dashboard/products/edit/${encodeURIComponent(product.id)}">Edit</a></td><td><form method="POST" action="/dashboard/products/delete/${encodeURIComponent(product.id)}" onsubmit="return confirm('Delete this product?');"><button class="btn btn-danger" type="submit">Delete</button></form></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">No products added yet.</div>';
  res.send(renderAdminLayout(req, 'Products', 'products', `
      <section class="card panel">
        <h1 class="section-title">Products</h1>
        <p class="section-subtitle">Add products to your store and keep inventory updated.</p>
        <form method="POST" action="/dashboard/products/add" enctype="multipart/form-data" class="form-grid">
          <div class="form-grid two">
            <div class="field"><label for="name">Product Name</label><input id="name" name="name" required></div>
            <div class="field"><label for="price">Price</label><input id="price" name="price" required></div>
            <div class="field"><label for="stock">Stock</label><input id="stock" name="stock" required></div>
            <div class="field"><label for="image">Image</label><input id="image" name="image" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" required></div>
          </div>
          <div class="field"><label for="description">Description</label><textarea id="description" name="description"></textarea></div>
          <div class="actions"><button class="btn" type="submit">Add Product</button></div>
        </form>
      </section>
      <section class="card panel"><h2 class="section-title" style="font-size:24px;">Product list</h2>${rows}</section>
    `));
}));

app.post('/dashboard/products/add', requireAuth, route(async (req, res) => {
  try {
    await runUploader(upload.single('image'), req, res);
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    const name = String(req.body.name || '').trim();
    const price = String(req.body.price || '').trim();
    const description = String(req.body.description || '').trim();
    const stock = String(req.body.stock || '').trim();
    if (name.length < 2) { setFlash(req, 'error', 'Product name must be at least 2 characters.'); res.redirect('/dashboard/products'); return; }
    if (!(Number(price) > 0)) { setFlash(req, 'error', 'Price must be a positive number.'); res.redirect('/dashboard/products'); return; }
    if (!req.file) { setFlash(req, 'error', 'Product image is required.'); res.redirect('/dashboard/products'); return; }
    if (req.file.size > 10 * 1024 * 1024) { setFlash(req, 'error', 'Product image must be 10MB or less.'); res.redirect('/dashboard/products'); return; }
    const imagePath = saveUploadedFile(req.file, 'product');
    const now = new Date().toISOString();
    store.products.push({ id: generateId('p'), name, price, description, image: imagePath, stock, createdAt: now, updatedAt: '' });
    saveDB(db);
    setFlash(req, 'success', 'Product added successfully.');
    res.redirect('/dashboard/products');
  } catch (error) {
    setFlash(req, 'error', error.message || 'Unable to add product.');
    res.redirect('/dashboard/products');
  }
}));

app.get('/dashboard/products/edit/:id', requireAuth, route(async (req, res) => {
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
            <div class="field"><label for="stock">Stock</label><input id="stock" name="stock" value="${escapeHtml(product.stock)}" required></div>
            <div class="field"><label for="image">Replace Image</label><input id="image" name="image" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif"></div>
          </div>
          <div class="field"><label for="description">Description</label><textarea id="description" name="description">${escapeHtml(product.description)}</textarea></div>
          <div class="field"><label>Current Image</label>${product.image ? `<img class="product-thumb" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : '<div class="muted">No image</div>'}</div>
          <div class="actions"><button class="btn" type="submit">Save Changes</button><a class="btn btn-secondary" href="/dashboard/products">Back</a></div>
        </form>
      </section>
    `));
}));

app.post('/dashboard/products/edit/:id', requireAuth, route(async (req, res) => {
  try {
    await runUploader(upload.single('image'), req, res);
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    const product = store.products.find((item) => item.id === req.params.id);
    if (!product) { setFlash(req, 'error', 'Product not found.'); res.redirect('/dashboard/products'); return; }
    const name = String(req.body.name || '').trim();
    const price = String(req.body.price || '').trim();
    const description = String(req.body.description || '').trim();
    const stock = String(req.body.stock || '').trim();
    if (name.length < 2) { setFlash(req, 'error', 'Product name must be at least 2 characters.'); res.redirect(`/dashboard/products/edit/${encodeURIComponent(req.params.id)}`); return; }
    if (!(Number(price) > 0)) { setFlash(req, 'error', 'Price must be a positive number.'); res.redirect(`/dashboard/products/edit/${encodeURIComponent(req.params.id)}`); return; }
    if (req.file && req.file.size > 10 * 1024 * 1024) { setFlash(req, 'error', 'Product image must be 10MB or less.'); res.redirect(`/dashboard/products/edit/${encodeURIComponent(req.params.id)}`); return; }
    product.name = name;
    product.price = price;
    product.description = description;
    product.stock = stock;
    product.updatedAt = new Date().toISOString();
    if (req.file) {
      const newImagePath = saveUploadedFile(req.file, 'product');
      removeStoredFile(product.image);
      product.image = newImagePath;
    }
    saveDB(db);
    setFlash(req, 'success', 'Product updated successfully.');
    res.redirect('/dashboard/products');
  } catch (error) {
    setFlash(req, 'error', error.message || 'Unable to update product.');
    res.redirect(`/dashboard/products/edit/${encodeURIComponent(req.params.id)}`);
  }
}));

app.post('/dashboard/products/delete/:id', requireAuth, route(async (req, res) => {
  try {
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    const productIndex = store.products.findIndex((item) => item.id === req.params.id);
    if (productIndex === -1) { setFlash(req, 'error', 'Product not found.'); res.redirect('/dashboard/products'); return; }
    const removed = store.products.splice(productIndex, 1)[0];
    removeStoredFile(removed.image);
    saveDB(db);
    setFlash(req, 'success', 'Product deleted successfully.');
    res.redirect('/dashboard/products');
  } catch (error) {
    setFlash(req, 'error', 'Unable to delete product.');
    res.redirect('/dashboard/products');
  }
}));

app.get('/dashboard/orders', requireAuth, route(async (req, res) => {
  const orders = [...req.currentStore.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const rows = orders.length ? `
      <div class="table-wrap"><table><thead><tr><th>Order ID</th><th>Product</th><th>Customer</th><th>Phone</th><th>Status</th><th>Date</th><th>Update</th></tr></thead><tbody>
      ${orders.map((order) => `<tr><td>${escapeHtml(order.id)}</td><td>${escapeHtml(order.productName)}</td><td>${escapeHtml(order.customerName || 'WhatsApp lead')}</td><td>${escapeHtml(order.customerPhone || '-')}</td><td>${getStatusBadge(order.status)}</td><td>${escapeHtml(formatDate(order.createdAt))}</td><td><form class="inline-form" method="POST" action="/dashboard/orders/status/${encodeURIComponent(order.id)}"><select class="status-select" name="status">${ORDER_STATUSES.map((status) => `<option value="${escapeHtml(status)}"${order.status === status ? ' selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select><button class="btn" type="submit">Save</button></form></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">No orders yet.</div>';
  res.send(renderAdminLayout(req, 'Orders', 'orders', `<section class="card panel"><h1 class="section-title">Orders</h1><p class="section-subtitle">Update order status and track incoming WhatsApp leads.</p>${rows}</section>`));
}));

app.post('/dashboard/orders/status/:id', requireAuth, route(async (req, res) => {
  try {
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    const order = store.orders.find((item) => item.id === req.params.id);
    const status = String(req.body.status || '').trim();
    if (!order) { setFlash(req, 'error', 'Order not found.'); res.redirect('/dashboard/orders'); return; }
    if (!ORDER_STATUSES.includes(status)) { setFlash(req, 'error', 'Invalid order status.'); res.redirect('/dashboard/orders'); return; }
    order.status = status;
    saveDB(db);
    setFlash(req, 'success', 'Order status updated.');
    res.redirect('/dashboard/orders');
  } catch (error) {
    setFlash(req, 'error', 'Unable to update order status.');
    res.redirect('/dashboard/orders');
  }
}));

app.get('/dashboard/orders/export', requireAuth, route(async (req, res) => {
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

app.get('/dashboard/analytics', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const revenue = store.orders.filter((order) => order.status === 'confirmed' || order.status === 'delivered').reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const breakdown = ORDER_STATUSES.reduce((acc, status) => { acc[status] = store.orders.filter((order) => order.status === status).length; return acc; }, {});
  const publicUrl = `${getBaseUrl(req)}/store/${encodeURIComponent(store.slug)}`;
  res.send(renderAdminLayout(req, 'Analytics', 'analytics', `
      <section class="stat-grid">
        <div class="card stat-card"><div class="stat-label">Visits</div><div class="stat-value">${escapeHtml(String(store.visits))}</div></div>
        <div class="card stat-card"><div class="stat-label">Revenue</div><div class="stat-value">${escapeHtml(formatMoney(revenue))}</div></div>
        <div class="card stat-card"><div class="stat-label">Total Products</div><div class="stat-value">${escapeHtml(String(store.products.length))}</div></div>
        <div class="card stat-card"><div class="stat-label">Total Orders</div><div class="stat-value">${escapeHtml(String(store.orders.length))}</div></div>
      </section>
      <section class="grid-2" style="margin-top:20px;">
        <div class="card panel"><h2 class="section-title" style="font-size:24px;">Order breakdown</h2><div class="kpi-list"><div class="kpi-item"><strong>Pending</strong><span>${escapeHtml(String(breakdown.pending))}</span></div><div class="kpi-item"><strong>Confirmed</strong><span>${escapeHtml(String(breakdown.confirmed))}</span></div><div class="kpi-item"><strong>Cancelled</strong><span>${escapeHtml(String(breakdown.cancelled))}</span></div><div class="kpi-item"><strong>Delivered</strong><span>${escapeHtml(String(breakdown.delivered))}</span></div></div></div>
        <div class="card panel"><h2 class="section-title" style="font-size:24px;">Public store URL</h2><div class="public-url">${escapeHtml(publicUrl)}</div><div style="height:16px;"></div><a class="btn" href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener noreferrer">Open Store</a></div>
      </section>
    `));
}));

app.get('/dashboard/settings', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  res.send(renderAdminLayout(req, 'Settings', 'settings', `
      <section class="card panel">
        <h1 class="section-title">Store settings</h1>
        <p class="section-subtitle">Manage store details, WhatsApp number, theme mode, and branding.</p>
        <form method="POST" action="/dashboard/settings/update" class="form-grid">
          <div class="form-grid two">
            <div class="field"><label for="name">Store Name</label><input id="name" name="name" value="${escapeHtml(store.name)}" required></div>
            <div class="field"><label for="whatsapp">WhatsApp Number</label><input id="whatsapp" name="whatsapp" value="${escapeHtml(store.whatsapp)}" required></div>
          </div>
          <div class="field"><label for="description">Description</label><textarea id="description" name="description" maxlength="200" required>${escapeHtml(store.description)}</textarea></div>
          <div class="field"><label for="theme">Theme Mode</label><select id="theme" name="theme"><option value="default"${store.theme === 'default' ? ' selected' : ''}>Default</option><option value="dark"${store.theme === 'dark' ? ' selected' : ''}>Dark</option></select></div>
          <div class="actions"><button class="btn" type="submit">Save Settings</button></div>
        </form>
      </section>
      <section class="card panel">
        <h2 class="section-title" style="font-size:24px;">Store logo</h2>
        <div class="actions" style="align-items:center; margin-bottom:16px;">${store.logo ? `<img class="logo-preview" src="${escapeHtml(store.logo)}" alt="${escapeHtml(store.name)}">` : '<div class="empty" style="padding:16px;">No logo</div>'}</div>
        <form method="POST" action="/dashboard/settings/logo" enctype="multipart/form-data" class="form-grid">
          <div class="field"><label for="logo">Upload new logo</label><input id="logo" name="logo" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" required></div>
          <div class="actions"><button class="btn" type="submit">Update Logo</button></div>
        </form>
      </section>
    `));
}));

app.post('/dashboard/settings/update', requireAuth, route(async (req, res) => {
  try {
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
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
    saveDB(db);
    setFlash(req, 'success', 'Settings updated.');
    res.redirect('/dashboard/settings');
  } catch (error) {
    setFlash(req, 'error', 'Unable to update settings.');
    res.redirect('/dashboard/settings');
  }
}));

app.post('/dashboard/settings/logo', requireAuth, route(async (req, res) => {
  try {
    await runUploader(upload.single('logo'), req, res);
    if (!req.file) { setFlash(req, 'error', 'Please choose a logo file.'); res.redirect('/dashboard/settings'); return; }
    if (req.file.size > 5 * 1024 * 1024) { setFlash(req, 'error', 'Logo size must be 5MB or less.'); res.redirect('/dashboard/settings'); return; }
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    const newLogo = saveUploadedFile(req.file, 'logo');
    removeStoredFile(store.logo);
    store.logo = newLogo;
    saveDB(db);
    setFlash(req, 'success', 'Logo updated successfully.');
    res.redirect('/dashboard/settings');
  } catch (error) {
    setFlash(req, 'error', error.message || 'Unable to update logo.');
    res.redirect('/dashboard/settings');
  }
}));

app.get('/dashboard/theme', requireAuth, route(async (req, res) => {
  const db = req.db;
  const store = req.currentStore;
  const cfg = store.themeConfig || {};
  const currentId = store.template;
  const templatesHtml = db.templates.map((template) => {
    const isActive = currentId === template.id;
    return `
      <div class="card template-card" style="${isActive ? 'border:2px solid #3b5bfd;' : ''}">
        <div class="template-preview" style="background: linear-gradient(135deg, ${escapeHtml(template.colors.primary)}, ${escapeHtml(template.colors.secondary)}); display:flex; align-items:flex-end; padding:14px;">
          <span style="background:rgba(255,255,255,.9); color:#111; padding:6px 12px; border-radius:999px; font-size:12px; font-weight:700;">${escapeHtml(template.description || '')}</span>
        </div>
        <h3 style="margin-top:14px;">${escapeHtml(template.name)}</h3>
        <p class="muted" style="font-size:13px;">Layout: ${escapeHtml(template.layout || 'app')}</p>
        <div class="actions" style="margin-top:12px;">
          ${isActive ? '<span class="badge badge-live">Active</span>' : `<form method="POST" action="/dashboard/theme/update" style="display:inline;"><input type="hidden" name="template" value="${escapeHtml(template.id)}"><button class="btn" type="submit">Apply</button></form>`}
          <a class="btn btn-secondary" href="/dashboard/theme/preview/${escapeHtml(template.id)}" target="_blank">Preview</a>
        </div>
      </div>`;
  }).join('');
  const colorFields = `
    <div class="form-grid two">
      <div class="field"><label for="primaryColor">Primary Color</label><input id="primaryColor" name="primaryColor" type="color" value="${escapeHtml(cfg.primaryColor || '#3b5bfd')}"><input name="primaryColorText" value="${escapeHtml(cfg.primaryColor || '')}" placeholder="#3b5bfd" style="margin-top:6px;"></div>
      <div class="field"><label for="secondaryColor">Secondary Color</label><input id="secondaryColor" name="secondaryColor" type="color" value="${escapeHtml(cfg.secondaryColor || '#06b6d4')}"><input name="secondaryColorText" value="${escapeHtml(cfg.secondaryColor || '')}" placeholder="#06b6d4" style="margin-top:6px;"></div>
      <div class="field"><label for="btnColor">Button Color</label><input id="btnColor" name="btnColor" type="color" value="${escapeHtml(cfg.btnColor || '#3b5bfd')}"><input name="btnColorText" value="${escapeHtml(cfg.btnColor || '')}" placeholder="#3b5bfd" style="margin-top:6px;"></div>
      <div class="field"><label for="bgColor">Background Color</label><input id="bgColor" name="bgColor" type="color" value="${escapeHtml(cfg.bgColor || '#f8fafc')}"><input name="bgColorText" value="${escapeHtml(cfg.bgColor || '')}" placeholder="#f8fafc" style="margin-top:6px;"></div>
    </div>`;
  const styleFields = `
    <div class="form-grid two">
      <div class="field"><label for="borderRadius">Card Corners</label><select id="borderRadius" name="borderRadius"><option value="sharp"${cfg.borderRadius === 'sharp' ? ' selected' : ''}>Sharp</option><option value="rounded"${!cfg.borderRadius || cfg.borderRadius === 'rounded' ? ' selected' : ''}>Rounded</option><option value="pill"${cfg.borderRadius === 'pill' ? ' selected' : ''}>Pill</option></select></div>
      <div class="field"><label for="btnStyle">Button Style</label><select id="btnStyle" name="btnStyle"><option value="sharp"${cfg.btnStyle === 'sharp' ? ' selected' : ''}>Sharp</option><option value="rounded"${cfg.btnStyle === 'rounded' ? ' selected' : ''}>Rounded</option><option value="pill"${!cfg.btnStyle || cfg.btnStyle === 'pill' ? ' selected' : ''}>Pill</option></select></div>
      <div class="field"><label>Header</label><select name="headerSticky"><option value="true"${cfg.headerSticky !== false ? ' selected' : ''}>Sticky</option><option value="false"${cfg.headerSticky === false ? ' selected' : ''}>Static</option></select></div>
    </div>`;
  const typographyFields = `
    <div class="form-grid two">
      <div class="field"><label for="headingFont">Heading Font</label><select id="headingFont" name="headingFont"><option value=""${!cfg.headingFont ? ' selected' : ''}>Default</option><option value="Inter"${cfg.headingFont === 'Inter' ? ' selected' : ''}>Inter</option><option value="DM Sans"${cfg.headingFont === 'DM Sans' ? ' selected' : ''}>DM Sans</option><option value="Poppins"${cfg.headingFont === 'Poppins' ? ' selected' : ''}>Poppins</option><option value="Alegreya SC"${cfg.headingFont === 'Alegreya SC' ? ' selected' : ''}>Alegreya SC</option></select></div>
      <div class="field"><label for="bodyFont">Body Font</label><select id="bodyFont" name="bodyFont"><option value=""${!cfg.bodyFont ? ' selected' : ''}>Default</option><option value="Inter"${cfg.bodyFont === 'Inter' ? ' selected' : ''}>Inter</option><option value="DM Sans"${cfg.bodyFont === 'DM Sans' ? ' selected' : ''}>DM Sans</option><option value="Poppins"${cfg.bodyFont === 'Poppins' ? ' selected' : ''}>Poppins</option></select></div>
    </div>`;
  const headerLayoutCards = [
    { id: 'left', title: 'Left', sub: 'Logo left aligned' },
    { id: 'center', title: 'Center', sub: 'Brand centered' },
    { id: 'search', title: 'With Search', sub: 'Search-first mobile header' }
  ].map((item) => `<label class="option-card ${cfg.headerLayout === item.id || (!cfg.headerLayout && item.id === 'search') ? 'active' : ''}"><input type="radio" name="headerLayout" value="${escapeHtml(item.id)}" ${cfg.headerLayout === item.id || (!cfg.headerLayout && item.id === 'search') ? 'checked' : ''} style="display:none;"><div class="option-card-preview">${item.id === 'left' ? '<span style="width:26px;height:12px;border-radius:999px;background:#4b5563;"></span><span style="margin-left:auto;display:flex;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#d1d5db;"></span><span style="width:8px;height:8px;border-radius:50%;background:#d1d5db;"></span></span>' : item.id === 'center' ? '<span style="width:8px;height:8px;border-radius:50%;background:#d1d5db;"></span><span style="width:26px;height:12px;border-radius:999px;background:#4b5563;"></span><span style="margin-left:auto;display:flex;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#d1d5db;"></span><span style="width:8px;height:8px;border-radius:50%;background:#d1d5db;"></span></span>' : '<span style="width:18px;height:12px;border-radius:999px;background:#4b5563;"></span><span style="flex:1;height:10px;border-radius:999px;background:#e5e7eb;"></span><span style="width:8px;height:8px;border-radius:50%;background:#d1d5db;"></span>'}</div><div class="option-card-title">${escapeHtml(item.title)}</div><div class="option-card-sub">${escapeHtml(item.sub)}</div>${cfg.headerLayout === item.id || (!cfg.headerLayout && item.id === 'search') ? '<div class="option-card-check">✓</div>' : ''}</label>`).join('');
  const bottomNavCards = [
    { id: 'classic', title: 'Classic', sub: 'Standard icon + label bar' },
    { id: 'modern', title: 'Modern', sub: 'Floating pill navigation' },
    { id: 'compact', title: 'Compact', sub: 'Minimal icon-forward bar' }
  ].map((item) => `<label class="option-card ${cfg.bottomNavStyle === item.id || (!cfg.bottomNavStyle && item.id === 'classic') ? 'active' : ''}"><input type="radio" name="bottomNavStyle" value="${escapeHtml(item.id)}" ${cfg.bottomNavStyle === item.id || (!cfg.bottomNavStyle && item.id === 'classic') ? 'checked' : ''} style="display:none;"><div class="option-card-preview" style="${item.id === 'modern' ? 'border-radius:999px;box-shadow:0 8px 18px rgba(15,23,42,.08);' : item.id === 'compact' ? 'border-radius:16px;' : ''}">${item.id === 'classic' ? '<span>⌂</span><span>🛒</span><span>♡</span><span>👤</span>' : item.id === 'modern' ? '<span style="padding:2px 8px;border-radius:999px;background:#111;color:#fff;font-size:11px;">Home</span><span>🛒</span><span>♡</span><span style="width:28px;height:28px;border-radius:50%;background:#111;color:#fff;display:grid;place-items:center;">🛍</span>' : '<span>⌂</span><span>▦</span><span>♡</span><span>👤</span>'}</div><div class="option-card-title">${escapeHtml(item.title)}</div><div class="option-card-sub">${escapeHtml(item.sub)}</div>${cfg.bottomNavStyle === item.id || (!cfg.bottomNavStyle && item.id === 'classic') ? '<div class="option-card-check">✓</div>' : ''}</label>`).join('');
  const productCardCards = [
    { id: 'style-1', title: 'Style 1', sub: 'Clean minimal' },
    { id: 'style-2', title: 'Style 2', sub: 'Badge & overlay' },
    { id: 'style-3', title: 'Style 3', sub: 'Bold modern' },
    { id: 'style-4', title: 'Style 4', sub: 'Compact list feel' }
  ].map((item) => `<label class="option-card ${cfg.productCardStyle === item.id || (!cfg.productCardStyle && item.id === 'style-2') ? 'active' : ''}"><input type="radio" name="productCardStyle" value="${escapeHtml(item.id)}" ${cfg.productCardStyle === item.id || (!cfg.productCardStyle && item.id === 'style-2') ? 'checked' : ''} style="display:none;"><div class="option-card-preview" style="height:72px; align-items:flex-start; padding:8px;">${item.id === 'style-1' ? '<div style="width:100%;height:100%;border-radius:12px;background:linear-gradient(180deg,#f8fafc,#fff);display:grid;place-items:center;">◫</div>' : item.id === 'style-2' ? '<div style="width:100%;height:100%;border-radius:12px;background:#fff;position:relative;border:1px solid #e5e7eb;"><span style="position:absolute;top:6px;left:6px;padding:2px 6px;border-radius:999px;background:#111;color:#fff;font-size:9px;">34% OFF</span><div style="position:absolute;inset:18px 10px 10px 10px;border-radius:10px;background:#e5e7eb;"></div></div>' : item.id === 'style-3' ? '<div style="width:100%;height:100%;border-radius:14px;background:#111;color:#fff;display:grid;place-items:center;box-shadow:0 10px 18px rgba(0,0,0,.12);">🛒</div>' : '<div style="width:100%;height:100%;display:grid;grid-template-columns:36px 1fr;gap:8px;"><div style="border-radius:10px;background:#e5e7eb;"></div><div style="display:grid;gap:6px;"><span style="height:10px;border-radius:999px;background:#dbe2ea;"></span><span style="height:10px;width:70%;border-radius:999px;background:#dbe2ea;"></span></div></div>'}</div><div class="option-card-title">${escapeHtml(item.title)}</div><div class="option-card-sub">${escapeHtml(item.sub)}</div>${cfg.productCardStyle === item.id || (!cfg.productCardStyle && item.id === 'style-2') ? '<div class="option-card-check">✓</div>' : ''}</label>`).join('');
  const categoryCards = [
    { id: 'circle', title: 'Circle Carousel', sub: 'Rounded scroll row' },
    { id: 'square', title: 'Square Carousel', sub: 'Modern tile strip' },
    { id: 'grid', title: 'Square Grid', sub: 'Balanced category grid' },
    { id: 'pill', title: 'Pill Tags', sub: 'Minimal tag style' }
  ].map((item) => `<label class="option-card ${cfg.categoryStyle === item.id || (!cfg.categoryStyle && item.id === 'circle') ? 'active' : ''}"><input type="radio" name="categoryStyle" value="${escapeHtml(item.id)}" ${cfg.categoryStyle === item.id || (!cfg.categoryStyle && item.id === 'circle') ? 'checked' : ''} style="display:none;"><div class="option-card-preview">${item.id === 'grid' ? '<span>◫</span><span>◫</span><span>◫</span><span>◫</span>' : item.id === 'pill' ? '<span style="padding:2px 8px;border-radius:999px;border:1px solid #cbd5e1;">Tag</span><span style="padding:2px 8px;border-radius:999px;border:1px solid #cbd5e1;">Tag</span>' : item.id === 'square' ? '<span style="width:14px;height:14px;border:1px solid #94a3b8;background:#eef2ff;"></span><span style="width:14px;height:14px;border:1px solid #94a3b8;background:#eef2ff;"></span><span style="width:14px;height:14px;border:1px solid #94a3b8;background:#eef2ff;"></span>' : '<span style="width:12px;height:12px;border-radius:50%;border:1px solid #94a3b8;"></span><span style="width:12px;height:12px;border-radius:50%;border:1px solid #94a3b8;"></span><span style="width:12px;height:12px;border-radius:50%;border:1px solid #94a3b8;"></span>'}</div><div class="option-card-title">${escapeHtml(item.title)}</div><div class="option-card-sub">${escapeHtml(item.sub)}</div>${cfg.categoryStyle === item.id || (!cfg.categoryStyle && item.id === 'circle') ? '<div class="option-card-check">✓</div>' : ''}</label>`).join('');
  const toggleFields = `
    <div class="form-grid two">
      <div class="field"><label>Show Search Bar</label><select name="showSearch"><option value="true"${cfg.showSearch !== false ? ' selected' : ''}>Yes</option><option value="false"${cfg.showSearch === false ? ' selected' : ''}>No</option></select></div>
      <div class="field"><label>Show Discount Badge</label><select name="showDiscount"><option value="true"${cfg.showDiscount !== false ? ' selected' : ''}>Yes</option><option value="false"${cfg.showDiscount === false ? ' selected' : ''}>No</option></select></div>
      <div class="field"><label>Category Layout</label><select name="categoryLayout"><option value="auto"${!cfg.categoryLayout || cfg.categoryLayout === 'auto' ? ' selected' : ''}>Auto (4+ = scroll)</option><option value="carousel"${cfg.categoryLayout === 'carousel' ? ' selected' : ''}>Always Carousel</option><option value="grid"${cfg.categoryLayout === 'grid' ? ' selected' : ''}>Always Grid</option></select></div>
    </div>`;
  const topBarFields = `
    <div class="form-grid two">
      <div class="field"><label for="topBarText">Announcement Text</label><input id="topBarText" name="topBarText" value="${escapeHtml(cfg.topBarText || '')}" placeholder="🚚 Free Shipping on orders above ₹499"></div>
      <div class="field"><label>Animation</label><select name="topBarMarquee"><option value="true"${cfg.topBarMarquee !== false ? ' selected' : ''}>Moving (Marquee)</option><option value="false"${cfg.topBarMarquee === false ? ' selected' : ''}>Static Text</option></select></div>
    </div>
    <div class="form-grid two">
      <div class="field"><label for="topBarBg">Top Bar Color</label><input id="topBarBg" name="topBarBg" type="color" value="${escapeHtml(cfg.topBarBg || '#3b5bfd')}"><input name="topBarBgText" value="${escapeHtml(cfg.topBarBg || '')}" placeholder="#3b5bfd" style="margin-top:6px;"></div>
      <div class="field"><label for="topBarColor">Text Color</label><input id="topBarColor" name="topBarColor" type="color" value="${escapeHtml(cfg.topBarColor || '#ffffff')}"><input name="topBarColorText" value="${escapeHtml(cfg.topBarColor || '')}" placeholder="#ffffff" style="margin-top:6px;"></div>
    </div>`;
  const bannerFields = `
    <div class="form-grid two">
      <div class="field"><label for="bannerTitle">Banner Title</label><input id="bannerTitle" name="bannerTitle" value="${escapeHtml(cfg.bannerTitle || '')}" placeholder="${escapeHtml(store.name)}"></div>
      <div class="field"><label for="bannerCta">Banner Button Text</label><input id="bannerCta" name="bannerCta" value="${escapeHtml(cfg.bannerCta || '')}" placeholder="Shop Now"></div>
    </div>
    <div class="field"><label for="bannerSubtitle">Banner Subtitle</label><textarea id="bannerSubtitle" name="bannerSubtitle" style="min-height:60px;">${escapeHtml(cfg.bannerSubtitle || '')}</textarea></div>`;
  const desktopBanners = Array.isArray(cfg.bannerImages) ? cfg.bannerImages : [];
  const mobileBanners = Array.isArray(cfg.bannerImagesMobile) ? cfg.bannerImagesMobile : [];
  const desktopBannerHtml = desktopBanners.length ? `<div style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0;">${desktopBanners.map((img, i) => `<div style="position:relative;width:120px;height:80px;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;"><img src="${escapeHtml(img)}" style="width:100%;height:100%;object-fit:cover;"><form method="POST" action="/dashboard/theme/banner/delete/${i}" style="position:absolute;top:4px;right:4px;"><button type="submit" style="width:22px;height:22px;border-radius:50%;border:0;background:rgba(239,68,68,.9);color:#fff;font-size:12px;cursor:pointer;display:grid;place-items:center;" onclick="return confirm('Remove this banner?')">×</button></form></div>`).join('')}</div>` : '<p class="muted" style="font-size:13px;">No desktop banners yet. Upload images below.</p>';
  const mobileBannerHtml = mobileBanners.length ? `<div style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0;">${mobileBanners.map((img, i) => `<div style="position:relative;width:80px;height:120px;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;"><img src="${escapeHtml(img)}" style="width:100%;height:100%;object-fit:cover;"><form method="POST" action="/dashboard/theme/banner/mobile/delete/${i}" style="position:absolute;top:4px;right:4px;"><button type="submit" style="width:22px;height:22px;border-radius:50%;border:0;background:rgba(239,68,68,.9);color:#fff;font-size:12px;cursor:pointer;display:grid;place-items:center;" onclick="return confirm('Remove this banner?')">×</button></form></div>`).join('')}</div>` : '<p class="muted" style="font-size:13px;">No mobile banners yet. Upload images below.</p>';
  res.send(renderAdminLayout(req, 'Theme', 'theme', `
    <section class="card hero-card">
      <div class="page-header" style="margin-bottom:0; align-items:center;">
        <div>
          <div class="badge badge-live" style="margin-bottom:12px;">Theme Studio</div>
          <h1 class="page-title" style="margin:0 0 8px;">Design a store that looks premium before it goes live.</h1>
          <p class="page-subtitle" style="max-width:62ch;">Pick a theme, tune the visual system, upload separate desktop/mobile banners, and preview the exact storefront before publishing.</p>
        </div>
        <div class="action-bar">
          <a class="btn btn-secondary" href="/store/${escapeHtml(store.slug)}" target="_blank">View live store</a>
          <a class="btn" href="/dashboard/theme/preview/${escapeHtml(currentId)}" target="_blank">Open full preview</a>
        </div>
      </div>
    </section>
    <section class="card panel">
      <div class="section-head"><h2 class="section-title" style="font-size:22px; margin:0;">Choose A Theme</h2><span class="muted">3 premium storefront systems</span></div>
      <div class="grid-3">${templatesHtml}</div>
    </section>
    <section class="split-grid">
      <div class="stacked">
        <section class="card panel">
          <div class="section-head"><h2 class="section-title" style="font-size:20px;margin:0;">Customize Theme</h2><span class="muted">Structured controls</span></div>
          <form method="POST" action="/dashboard/theme/customize" class="stacked">
            <div class="card" style="padding:18px; border:1px solid var(--border); box-shadow:none;">
              <h3 style="margin:0 0 12px;font-size:16px;">Colors</h3>
              ${colorFields}
            </div>
            <div class="card" style="padding:18px; border:1px solid var(--border); box-shadow:none;">
              <h3 style="margin:0 0 12px;font-size:16px;">Style</h3>
              ${styleFields}
            </div>
            <div class="card" style="padding:18px; border:1px solid var(--border); box-shadow:none;">
              <h3 style="margin:0 0 12px;font-size:16px;">Typography</h3>
              ${typographyFields}
            </div>
            <div class="card" style="padding:18px; border:1px solid var(--border); box-shadow:none;">
              <h3 style="margin:0 0 12px;font-size:16px;">Storefront Options</h3>
              ${toggleFields}
            </div>
            <div class="card" style="padding:18px; border:1px solid var(--border); box-shadow:none;">
              <h3 style="margin:0 0 12px;font-size:16px;">Header Layout</h3>
              <div class="option-grid">${headerLayoutCards}</div>
            </div>
            <div class="card" style="padding:18px; border:1px solid var(--border); box-shadow:none;">
              <h3 style="margin:0 0 12px;font-size:16px;">Mobile Bottom Navigation</h3>
              <div class="option-grid">${bottomNavCards}</div>
            </div>
            <div class="card" style="padding:18px; border:1px solid var(--border); box-shadow:none;">
              <h3 style="margin:0 0 12px;font-size:16px;">Product Card Design</h3>
              <div class="option-grid-4">${productCardCards}</div>
            </div>
            <div class="card" style="padding:18px; border:1px solid var(--border); box-shadow:none;">
              <h3 style="margin:0 0 12px;font-size:16px;">Category Section Design</h3>
              <div class="option-grid-4">${categoryCards}</div>
            </div>
            <div class="card" style="padding:18px; border:1px solid var(--border); box-shadow:none;">
              <h3 style="margin:0 0 12px;font-size:16px;">Announcement Top Bar</h3>
              ${topBarFields}
            </div>
            <div class="card" style="padding:18px; border:1px solid var(--border); box-shadow:none;">
              <h3 style="margin:0 0 12px;font-size:16px;">Hero Content</h3>
              ${bannerFields}
            </div>
            <div class="actions"><button class="btn" type="submit">Save Changes</button></div>
          </form>
        </section>
      </div>
      <div class="stacked">
        <section class="card panel">
          <h2 class="section-title" style="font-size:20px;margin:0;">Desktop Banner Images</h2>
          <p class="muted" style="font-size:13px;margin:4px 0 14px;">Upload up to 5 banners for desktop. Best ratio: 16:9.</p>
          ${desktopBannerHtml}
          <form method="POST" action="/dashboard/theme/banner/add" enctype="multipart/form-data" class="form-grid">
            <div class="field"><label>Upload Desktop Banner</label><input type="file" name="image" accept=".jpg,.jpeg,.png,.webp,image/*" required></div>
            <div class="actions"><button class="btn" type="submit">Add Desktop Banner</button></div>
          </form>
        </section>
        <section class="card panel">
          <h2 class="section-title" style="font-size:20px;margin:0;">Mobile Banner Images</h2>
          <p class="muted" style="font-size:13px;margin:4px 0 14px;">Upload up to 5 banners for mobile. Best ratio: 1:1 or 9:16.</p>
          ${mobileBannerHtml}
          <form method="POST" action="/dashboard/theme/banner/mobile/add" enctype="multipart/form-data" class="form-grid">
            <div class="field"><label>Upload Mobile Banner</label><input type="file" name="image" accept=".jpg,.jpeg,.png,.webp,image/*" required></div>
            <div class="actions"><button class="btn" type="submit">Add Mobile Banner</button></div>
          </form>
        </section>
        <section class="card panel">
          <div class="section-head"><h2 class="section-title" style="font-size:20px;margin:0;">Live Preview</h2><span class="muted">Actual storefront output</span></div>
          <div style="border:2px solid #e2e8f0;border-radius:24px;overflow:hidden;margin-top:12px;box-shadow:0 20px 45px rgba(15,23,42,.08);">
            <div style="background:#f8fafc;padding:10px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e2e8f0;">
              <span style="width:10px;height:10px;border-radius:50%;background:#ef4444;"></span>
              <span style="width:10px;height:10px;border-radius:50%;background:#f59e0b;"></span>
              <span style="width:10px;height:10px;border-radius:50%;background:#10b981;"></span>
              <span style="flex:1;text-align:center;font-size:12px;color:#64748b;">/${escapeHtml(store.slug)}</span>
            </div>
            <iframe src="/store/${encodeURIComponent(store.slug)}" style="width:100%;height:680px;border:0;display:block;background:#fff;"></iframe>
          </div>
        </section>
      </div>
    </section>
  `));
}));

app.get('/dashboard/theme/preview/:id', requireAuth, route(async (req, res) => {
  const db = loadDB();
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
  const customer = getLoggedCustomer(req, store.slug);
  const isDark = store.theme === 'dark';
  const themeCSS = getThemeCSS(template, store.theme, cfg);
  const storeContent = renderStoreByTheme(template, store, store.slug, {
    products: store.products, categories, cartCount, wishlistCount: wishlist.length, wishlist, search: '', selectedCategory: '', currentTemplate: template, customer, cfg, isDark
  });
  res.send(renderHtmlShell(`${store.name} - Preview (${template.name})`, `<div class="store-page"><div class="store-wrap">${storeContent}</div></div>`, { extraStyles: themeCSS }));
}));

app.post('/dashboard/theme/update', requireAuth, route(async (req, res) => {
  try {
    const templateId = String(req.body.template || '').trim();
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    if (!['app-style', 'minimal', 'bold-fashion'].includes(templateId)) {
      setFlash(req, 'error', 'Invalid template selected.');
      res.redirect('/dashboard/theme');
      return;
    }
    store.template = templateId;
    saveDB(db);
    setFlash(req, 'success', 'Theme applied successfully.');
    res.redirect('/dashboard/theme');
  } catch (error) {
    setFlash(req, 'error', 'Unable to apply theme.');
    res.redirect('/dashboard/theme');
  }
}));

app.post('/dashboard/theme/customize', requireAuth, route(async (req, res) => {
  try {
    const db = loadDB();
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
    saveDB(db);
    setFlash(req, 'success', 'Theme customization saved!');
    res.redirect('/dashboard/theme');
  } catch (error) {
    setFlash(req, 'error', 'Unable to save customization.');
    res.redirect('/dashboard/theme');
  }
}));

app.post('/dashboard/theme/banner/add', requireAuth, route(async (req, res) => {
  try {
    await runUploader(upload.single('image'), req, res);
    if (!req.file) { setFlash(req, 'error', 'Please choose an image.'); res.redirect('/dashboard/theme'); return; }
    if (req.file.size > 5 * 1024 * 1024) { setFlash(req, 'error', 'Image must be 5MB or less.'); res.redirect('/dashboard/theme'); return; }
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.themeConfig = store.themeConfig || {};
    store.themeConfig.bannerImages = Array.isArray(store.themeConfig.bannerImages) ? store.themeConfig.bannerImages : [];
    if (store.themeConfig.bannerImages.length >= 5) { setFlash(req, 'error', 'Maximum 5 desktop banners allowed.'); res.redirect('/dashboard/theme'); return; }
    const imagePath = saveUploadedFile(req.file, 'banner');
    store.themeConfig.bannerImages.push(imagePath);
    saveDB(db);
    setFlash(req, 'success', 'Desktop banner added!');
    res.redirect('/dashboard/theme');
  } catch (error) {
    setFlash(req, 'error', error.message || 'Unable to add banner.');
    res.redirect('/dashboard/theme');
  }
}));

app.post('/dashboard/theme/banner/mobile/add', requireAuth, route(async (req, res) => {
  try {
    await runUploader(upload.single('image'), req, res);
    if (!req.file) { setFlash(req, 'error', 'Please choose an image.'); res.redirect('/dashboard/theme'); return; }
    if (req.file.size > 5 * 1024 * 1024) { setFlash(req, 'error', 'Image must be 5MB or less.'); res.redirect('/dashboard/theme'); return; }
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.themeConfig = store.themeConfig || {};
    store.themeConfig.bannerImagesMobile = Array.isArray(store.themeConfig.bannerImagesMobile) ? store.themeConfig.bannerImagesMobile : [];
    if (store.themeConfig.bannerImagesMobile.length >= 5) { setFlash(req, 'error', 'Maximum 5 mobile banners allowed.'); res.redirect('/dashboard/theme'); return; }
    const imagePath = saveUploadedFile(req.file, 'banner');
    store.themeConfig.bannerImagesMobile.push(imagePath);
    saveDB(db);
    setFlash(req, 'success', 'Mobile banner added!');
    res.redirect('/dashboard/theme');
  } catch (error) {
    setFlash(req, 'error', error.message || 'Unable to add banner.');
    res.redirect('/dashboard/theme');
  }
}));

app.post('/dashboard/theme/banner/delete/:index', requireAuth, route(async (req, res) => {
  try {
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    const index = Number(req.params.index);
    store.themeConfig = store.themeConfig || {};
    store.themeConfig.bannerImages = Array.isArray(store.themeConfig.bannerImages) ? store.themeConfig.bannerImages : [];
    if (index >= 0 && index < store.themeConfig.bannerImages.length) {
      removeStoredFile(store.themeConfig.bannerImages[index]);
      store.themeConfig.bannerImages.splice(index, 1);
      saveDB(db);
      setFlash(req, 'success', 'Desktop banner removed.');
    }
    res.redirect('/dashboard/theme');
  } catch (error) {
    setFlash(req, 'error', 'Unable to remove banner.');
    res.redirect('/dashboard/theme');
  }
}));

app.post('/dashboard/theme/banner/mobile/delete/:index', requireAuth, route(async (req, res) => {
  try {
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    const index = Number(req.params.index);
    store.themeConfig = store.themeConfig || {};
    store.themeConfig.bannerImagesMobile = Array.isArray(store.themeConfig.bannerImagesMobile) ? store.themeConfig.bannerImagesMobile : [];
    if (index >= 0 && index < store.themeConfig.bannerImagesMobile.length) {
      removeStoredFile(store.themeConfig.bannerImagesMobile[index]);
      store.themeConfig.bannerImagesMobile.splice(index, 1);
      saveDB(db);
      setFlash(req, 'success', 'Mobile banner removed.');
    }
    res.redirect('/dashboard/theme');
  } catch (error) {
    setFlash(req, 'error', 'Unable to remove banner.');
    res.redirect('/dashboard/theme');
  }
}));

app.get('/dashboard/customers', requireAuth, route(async (req, res) => {
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

app.get('/dashboard/collections', requireAuth, route(async (req, res) => {
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

app.post('/dashboard/collections/add', requireAuth, route(async (req, res) => {
  try {
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    if (name.length < 2) { setFlash(req, 'error', 'Collection name is required.'); res.redirect('/dashboard/collections'); return; }
    store.collections = Array.isArray(store.collections) ? store.collections : [];
    store.collections.push({ id: generateId('col'), name, description, createdAt: new Date().toISOString() });
    saveDB(db);
    setFlash(req, 'success', 'Collection added.');
    res.redirect('/dashboard/collections');
  } catch (error) {
    setFlash(req, 'error', 'Unable to add collection.');
    res.redirect('/dashboard/collections');
  }
}));

app.post('/dashboard/collections/delete/:index', requireAuth, route(async (req, res) => {
  try {
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.collections = Array.isArray(store.collections) ? store.collections : [];
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= store.collections.length) { setFlash(req, 'error', 'Collection not found.'); res.redirect('/dashboard/collections'); return; }
    store.collections.splice(index, 1);
    saveDB(db);
    setFlash(req, 'success', 'Collection deleted.');
    res.redirect('/dashboard/collections');
  } catch (error) {
    setFlash(req, 'error', 'Unable to delete collection.');
    res.redirect('/dashboard/collections');
  }
}));

app.get('/dashboard/media', requireAuth, route(async (req, res) => {
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

app.get('/dashboard/discounts', requireAuth, route(async (req, res) => {
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

app.post('/dashboard/discounts/add', requireAuth, route(async (req, res) => {
  try {
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.discounts = Array.isArray(store.discounts) ? store.discounts : [];
    const code = String(req.body.code || '').trim().toUpperCase();
    const value = String(req.body.value || '').trim();
    const type = String(req.body.type || 'percent').trim();
    const active = String(req.body.active || 'yes') === 'yes';
    if (code.length < 3) { setFlash(req, 'error', 'Discount code is required.'); res.redirect('/dashboard/discounts'); return; }
    store.discounts.push({ id: generateId('disc'), code, value, type, active, createdAt: new Date().toISOString() });
    saveDB(db);
    setFlash(req, 'success', 'Discount added.');
    res.redirect('/dashboard/discounts');
  } catch (error) {
    setFlash(req, 'error', 'Unable to add discount.');
    res.redirect('/dashboard/discounts');
  }
}));

app.post('/dashboard/discounts/delete/:index', requireAuth, route(async (req, res) => {
  try {
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.discounts = Array.isArray(store.discounts) ? store.discounts : [];
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= store.discounts.length) { setFlash(req, 'error', 'Discount not found.'); res.redirect('/dashboard/discounts'); return; }
    store.discounts.splice(index, 1);
    saveDB(db);
    setFlash(req, 'success', 'Discount deleted.');
    res.redirect('/dashboard/discounts');
  } catch (error) {
    setFlash(req, 'error', 'Unable to delete discount.');
    res.redirect('/dashboard/discounts');
  }
}));

app.get('/dashboard/shipping', requireAuth, route(async (req, res) => {
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

app.post('/dashboard/shipping/update', requireAuth, route(async (req, res) => {
  try {
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.shipping = { mode: String(req.body.mode || 'flat'), fee: String(req.body.fee || '').trim(), notes: String(req.body.notes || '').trim() };
    saveDB(db);
    setFlash(req, 'success', 'Shipping settings saved.');
    res.redirect('/dashboard/shipping');
  } catch (error) {
    setFlash(req, 'error', 'Unable to save shipping settings.');
    res.redirect('/dashboard/shipping');
  }
}));

app.get('/dashboard/payments', requireAuth, route(async (req, res) => {
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

app.post('/dashboard/payments/update', requireAuth, route(async (req, res) => {
  try {
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.paymentSettings = { mode: String(req.body.mode || 'whatsapp'), notes: String(req.body.notes || '').trim() };
    saveDB(db);
    setFlash(req, 'success', 'Payment settings saved.');
    res.redirect('/dashboard/payments');
  } catch (error) {
    setFlash(req, 'error', 'Unable to save payment settings.');
    res.redirect('/dashboard/payments');
  }
}));

app.get('/dashboard/notifications', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const notifications = store.notifications || { newOrder: true, whatsappLead: true, lowStock: false };
  res.send(renderAdminLayout(req, 'Notifications', 'notifications', `
    <section class="card panel">
      <div class="section-head"><div><h1 class="section-title">Notifications</h1><p class="section-subtitle">Control basic store notifications.</p></div></div>
      <form method="POST" action="/dashboard/notifications/update" class="form-grid">
        <div class="form-grid two">
          <div class="field"><label for="newOrder">New order alert</label><select id="newOrder" name="newOrder"><option value="yes"${notifications.newOrder ? ' selected' : ''}>Yes</option><option value="no"${!notifications.newOrder ? ' selected' : ''}>No</option></select></div>
          <div class="field"><label for="whatsappLead">WhatsApp lead alert</label><select id="whatsappLead" name="whatsappLead"><option value="yes"${notifications.whatsappLead ? ' selected' : ''}>Yes</option><option value="no"${!notifications.whatsappLead ? ' selected' : ''}>No</option></select></div>
          <div class="field"><label for="lowStock">Low stock alert</label><select id="lowStock" name="lowStock"><option value="yes"${notifications.lowStock ? ' selected' : ''}>Yes</option><option value="no"${!notifications.lowStock ? ' selected' : ''}>No</option></select></div>
        </div>
        <div class="actions"><button class="btn" type="submit">Save notifications</button></div>
      </form>
    </section>
  `));
}));

app.post('/dashboard/notifications/update', requireAuth, route(async (req, res) => {
  try {
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.notifications = {
      newOrder: String(req.body.newOrder || 'yes') === 'yes',
      whatsappLead: String(req.body.whatsappLead || 'yes') === 'yes',
      lowStock: String(req.body.lowStock || 'no') === 'yes'
    };
    saveDB(db);
    setFlash(req, 'success', 'Notifications saved.');
    res.redirect('/dashboard/notifications');
  } catch (error) {
    setFlash(req, 'error', 'Unable to save notifications.');
    res.redirect('/dashboard/notifications');
  }
}));

app.get('/dashboard/abandoned-carts', requireAuth, route(async (req, res) => {
  res.send(renderAdminLayout(req, 'Abandoned carts', 'abandoned', `
    <section class="card panel">
      <div class="section-head"><div><h1 class="section-title">Abandoned carts</h1><p class="section-subtitle">This MVP does not track cart sessions yet. The section is ready for future upgrade.</p></div></div>
      <div class="empty">No abandoned cart tracking enabled.</div>
    </section>
  `));
}));

app.get('/dashboard/categories', requireAuth, route(async (req, res) => {
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

app.post('/dashboard/categories/add', requireAuth, route(async (req, res) => {
  try {
    await runUploader(upload.single('image'), req, res);
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.categories = Array.isArray(store.categories) ? store.categories : [];
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    if (name.length < 2) { setFlash(req, 'error', 'Category name is required.'); res.redirect('/dashboard/categories'); return; }
    const imagePath = req.file ? saveUploadedFile(req.file, 'category') : '';
    store.categories.push({ id: generateId('cat'), name, description, image: imagePath, createdAt: new Date().toISOString() });
    saveDB(db);
    setFlash(req, 'success', 'Category added.');
    res.redirect('/dashboard/categories');
  } catch (error) {
    setFlash(req, 'error', 'Unable to add category.');
    res.redirect('/dashboard/categories');
  }
}));

app.post('/dashboard/categories/delete/:id', requireAuth, route(async (req, res) => {
  try {
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.categories = Array.isArray(store.categories) ? store.categories : [];
    const index = store.categories.findIndex((c) => c.id === req.params.id);
    if (index >= 0) {
      if (store.categories[index].image) removeStoredFile(store.categories[index].image);
      store.categories.splice(index, 1);
      saveDB(db);
      setFlash(req, 'success', 'Category deleted.');
    }
    res.redirect('/dashboard/categories');
  } catch (error) {
    setFlash(req, 'error', 'Unable to delete category.');
    res.redirect('/dashboard/categories');
  }
}));

app.get('/dashboard/bulk-upload', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const productsUsed = store.products.length;
  res.send(renderAdminLayout(req, 'Bulk Upload', 'bulk-upload', `
    <div class="title-row"><div><h1 class="page-title">Import Products (CSV)</h1><p class="page-subtitle">Upload a CSV file and products will appear on your store automatically.</p></div></div>
    <div class="grid-2">
      <section class="card panel">
        <h2 class="section-title" style="font-size:18px;margin:0 0 6px;">📥 Import Products</h2>
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
        <h2 class="section-title" style="font-size:18px;margin:0 0 6px;">📤 Export & Template</h2>
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

app.get('/dashboard/bulk-upload/template', requireAuth, route(async (req, res) => {
  const csv = 'name,price,description,stock,image,sku,active\nSample Product,499,Demo description,10,https://example.com/sample.webp,SKU-001,true\n';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="products-template.csv"');
  res.send(csv);
}));

app.get('/dashboard/bulk-upload/export', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const rows = ['name,price,description,stock,image,sku,active'];
  store.products.forEach((product) => {
    rows.push([product.name, product.price, product.description, product.stock, product.image || '', product.sku || '', product.active !== false].map((v) => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="products-export.csv"');
  res.send(rows.join('\n'));
}));

app.post('/dashboard/bulk-upload/import', requireAuth, route(async (req, res) => {
  try {
    await runUploader(csvUpload.single('csv'), req, res);
    if (!req.file) { setFlash(req, 'error', 'CSV file required.'); res.redirect('/dashboard/bulk-upload'); return; }
    const db = loadDB();
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
          description: String(row.description || '').trim(),
          image: imageUrl,
          images: imageUrl ? [imageUrl] : [],
          stock: Math.max(0, parseInt(String(row.stock || '0').replace(/[^0-9]/g, '').trim(), 10) || 0),
          sku: String(row.sku || '').trim(),
          active: String(row.active || 'true').trim().toLowerCase() !== 'false',
          createdAt: new Date().toISOString(),
          updatedAt: ''
        });
        imported++;
      }
    });
    saveDB(db);
    setFlash(req, 'success', `Imported ${imported} products successfully.`);
    res.redirect('/dashboard/bulk-upload');
  } catch (error) {
    setFlash(req, 'error', error.message || 'Unable to import CSV.');
    res.redirect('/dashboard/bulk-upload');
  }
}));

app.get('/dashboard/leads', requireAuth, route(async (req, res) => {
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

app.get('/dashboard/coupons', requireAuth, route(async (req, res) => {
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

app.get('/dashboard/tax', requireAuth, route(async (req, res) => {
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

app.post('/dashboard/tax/update', requireAuth, route(async (req, res) => {
  try {
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.taxSettings = { enabled: String(req.body.enabled || 'no') === 'yes', name: String(req.body.name || 'GST').trim(), rate: String(req.body.rate || '0').trim(), inclusive: String(req.body.inclusive || 'no') === 'yes' };
    saveDB(db);
    setFlash(req, 'success', 'Tax settings saved.');
    res.redirect('/dashboard/tax');
  } catch (error) {
    setFlash(req, 'error', 'Unable to save tax settings.');
    res.redirect('/dashboard/tax');
  }
}));

app.get('/dashboard/whatsapp-marketing', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  const marketing = store.whatsappMarketing || { welcome: '', recovery: '', promo: '' };
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
  `));
}));

app.post('/dashboard/whatsapp-marketing/update', requireAuth, route(async (req, res) => {
  try {
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.whatsappMarketing = { welcome: String(req.body.welcome || '').trim(), recovery: String(req.body.recovery || '').trim(), promo: String(req.body.promo || '').trim() };
    saveDB(db);
    setFlash(req, 'success', 'WhatsApp messages saved.');
    res.redirect('/dashboard/whatsapp-marketing');
  } catch (error) {
    setFlash(req, 'error', 'Unable to save WhatsApp marketing.');
    res.redirect('/dashboard/whatsapp-marketing');
  }
}));

app.get('/dashboard/tracking', requireAuth, route(async (req, res) => {
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

app.post('/dashboard/tracking/update', requireAuth, route(async (req, res) => {
  try {
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.tracking = { pixel: String(req.body.pixel || '').trim(), google: String(req.body.google || '').trim() };
    saveDB(db);
    setFlash(req, 'success', 'Tracking settings saved.');
    res.redirect('/dashboard/tracking');
  } catch (error) {
    setFlash(req, 'error', 'Unable to save tracking settings.');
    res.redirect('/dashboard/tracking');
  }
}));

app.get('/dashboard/pages', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  store.pages = Array.isArray(store.pages) ? store.pages : [];
  const rows = store.pages.length ? `
    <div class="table-wrap"><table><thead><tr><th>Page</th><th>Slug</th><th>Status</th><th>Delete</th></tr></thead><tbody>
      ${store.pages.map((page, index) => `<tr><td>${escapeHtml(page.title)}</td><td>${escapeHtml(page.slug)}</td><td>${escapeHtml(page.active ? 'Published' : 'Draft')}</td><td><form method="POST" action="/dashboard/pages/delete/${index}" onsubmit="return confirm('Delete page?');"><button class="btn btn-danger" type="submit">Delete</button></form></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">No pages yet.</div>';
  res.send(renderAdminLayout(req, 'Pages', 'pages', `
    <section class="card panel">
      <div class="title-row"><div><h1 class="page-title">Pages</h1><p class="page-subtitle">Create and manage store pages</p></div></div>
      <form method="POST" action="/dashboard/pages/add" class="form-grid" style="margin-bottom:18px;">
        <div class="form-grid two">
          <div class="field"><label for="title">Title</label><input id="title" name="title" required></div>
          <div class="field"><label for="slug">Slug</label><input id="slug" name="slug" required></div>
          <div class="field"><label for="content">Content</label><textarea id="content" name="content"></textarea></div>
          <div class="field"><label for="active">Publish</label><select id="active" name="active"><option value="yes">Yes</option><option value="no">No</option></select></div>
        </div>
        <div class="actions"><button class="btn" type="submit">Add page</button></div>
      </form>
      ${rows}
    </section>
  `));
}));

app.post('/dashboard/pages/add', requireAuth, route(async (req, res) => {
  try {
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.pages = Array.isArray(store.pages) ? store.pages : [];
    const title = String(req.body.title || '').trim();
    const slug = slugify(String(req.body.slug || '').trim()) || generateId('page');
    const content = String(req.body.content || '').trim();
    const active = String(req.body.active || 'yes') === 'yes';
    if (title.length < 2) { setFlash(req, 'error', 'Page title required.'); res.redirect('/dashboard/pages'); return; }
    store.pages.push({ id: generateId('page'), title, slug, content, active, createdAt: new Date().toISOString() });
    saveDB(db);
    setFlash(req, 'success', 'Page added.');
    res.redirect('/dashboard/pages');
  } catch (error) {
    setFlash(req, 'error', 'Unable to add page.');
    res.redirect('/dashboard/pages');
  }
}));

app.post('/dashboard/pages/delete/:index', requireAuth, route(async (req, res) => {
  try {
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.pages = Array.isArray(store.pages) ? store.pages : [];
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= store.pages.length) { setFlash(req, 'error', 'Page not found.'); res.redirect('/dashboard/pages'); return; }
    store.pages.splice(index, 1);
    saveDB(db);
    setFlash(req, 'success', 'Page deleted.');
    res.redirect('/dashboard/pages');
  } catch (error) {
    setFlash(req, 'error', 'Unable to delete page.');
    res.redirect('/dashboard/pages');
  }
}));

app.get('/dashboard/domain', requireAuth, route(async (req, res) => {
  const store = req.currentStore;
  store.domain = store.domain || { customDomain: '', subdomain: '' };
  res.send(renderAdminLayout(req, 'Domain', 'domain', `
    <section class="card panel">
      <div class="title-row"><div><h1 class="page-title">Domain</h1><p class="page-subtitle">Connect your own domain or use the store URL</p></div></div>
      <form method="POST" action="/dashboard/domain/update" class="form-grid">
        <div class="field"><label for="customDomain">Custom domain</label><input id="customDomain" name="customDomain" value="${escapeHtml(store.domain.customDomain || '')}"></div>
        <div class="field"><label for="subdomain">Subdomain</label><input id="subdomain" name="subdomain" value="${escapeHtml(store.domain.subdomain || '')}"></div>
        <div class="actions"><button class="btn" type="submit">Save Domain</button></div>
      </form>
    </section>
  `));
}));

app.post('/dashboard/domain/update', requireAuth, route(async (req, res) => {
  try {
    const db = loadDB();
    const user = db.users[req.session.userId];
    const store = db.stores[user.storeSlug];
    store.domain = { customDomain: String(req.body.customDomain || '').trim(), subdomain: String(req.body.subdomain || '').trim() };
    saveDB(db);
    setFlash(req, 'success', 'Domain settings saved.');
    res.redirect('/dashboard/domain');
  } catch (error) {
    setFlash(req, 'error', 'Unable to save domain settings.');
    res.redirect('/dashboard/domain');
  }
}));

app.get('/store/:slug/robots.txt', route(async (req, res) => {
  const slug = String(req.params.slug || '').trim();
  const db = loadDB();
  const store = db.stores[slug];
  if (!store) { res.status(404).send('Not Found'); return; }
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nSitemap: ${req.protocol}://${req.get('host')}/store/${slug}/sitemap.xml`);
}));

app.get('/store/:slug/sitemap.xml', route(async (req, res) => {
  const slug = String(req.params.slug || '').trim();
  const db = loadDB();
  const store = db.stores[slug];
  if (!store) { res.status(404).send('Not Found'); return; }
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const urls = [`${baseUrl}/store/${slug}`];
  store.products.filter((p) => p.active !== false).forEach((p) => urls.push(`${baseUrl}/store/${slug}/product/${p.id}`));
  const pages = Array.isArray(store.pages) ? store.pages : [];
  pages.forEach((p) => urls.push(`${baseUrl}/store/${slug}/page/${p.slug}`));
  res.type('application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${escapeHtml(u)}</loc></url>`).join('\n')}\n</urlset>`);
}));

app.get('/store/:slug', route(async (req, res) => {
  const db = loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) {
    res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404));
    return;
  }
  store.visits += 1;
  saveDB(db);
  const currentTemplate = getTemplateById(db, store.template);
  const cfg = store.themeConfig || {};
  const cart = getStoreCart(req, slug);
  const wishlist = getStoreWishlist(req, slug);
  const search = String(req.query.search || '').trim().toLowerCase();
  const selectedCategory = String(req.query.category || '').trim();
  const sort = String(req.query.sort || '').trim();
  const page = Math.max(1, parseInt(req.query.page || 1, 10));
  const perPage = 12;
  const categories = Array.isArray(store.categories) ? store.categories : [];
  let visibleProducts = store.products.filter((product) => {
    if (product.active === false) return false;
    const matchesSearch = !search || `${product.name} ${product.description}`.toLowerCase().includes(search);
    const matchesCategory = !selectedCategory || selectedCategory === 'all' || categories.some((category) => category.name === selectedCategory && (category.productIds || []).includes(product.id));
    return matchesSearch && matchesCategory;
  });
  if (sort === 'price_asc') visibleProducts.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
  else if (sort === 'price_desc') visibleProducts.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
  else if (sort === 'newest') visibleProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const totalPages = Math.ceil(visibleProducts.length / perPage);
  const pagedProducts = visibleProducts.slice((page - 1) * perPage, page * perPage);
  const cartCount = cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const wishlistCount = wishlist.length;
  const customer = getLoggedCustomer(req, slug);
  const isDark = store.theme === 'dark';
  const themeCSS = getThemeCSS(currentTemplate, store.theme, cfg);
  const sortOptions = `
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
      <form method="GET" action="/store/${encodeURIComponent(slug)}" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        ${search ? `<input type="hidden" name="search" value="${escapeHtml(search)}">` : ''}
        ${selectedCategory ? `<input type="hidden" name="category" value="${escapeHtml(selectedCategory)}">` : ''}
        <select name="sort" onchange="this.form.submit()" style="padding:8px 12px;border-radius:999px;border:1px solid #e2e8f0;font-size:13px;">
          <option value="">Sort by</option>
          <option value="newest"${sort === 'newest' ? ' selected' : ''}>Newest First</option>
          <option value="price_asc"${sort === 'price_asc' ? ' selected' : ''}>Price: Low to High</option>
          <option value="price_desc"${sort === 'price_desc' ? ' selected' : ''}>Price: High to Low</option>
        </select>
      </form>
    </div>`;
  const paginationHtml = totalPages > 1 ? `<div style="display:flex;gap:8px;justify-content:center;padding:20px 0;flex-wrap:wrap;">${Array.from({ length: totalPages }, (_, i) => `<a href="/store/${encodeURIComponent(slug)}?page=${i + 1}${search ? '&search=' + encodeURIComponent(search) : ''}${selectedCategory ? '&category=' + encodeURIComponent(selectedCategory) : ''}${sort ? '&sort=' + encodeURIComponent(sort) : ''}" style="padding:8px 14px;border-radius:999px;background:${page === i + 1 ? (cfg.primaryColor || '#3b5bfd') : '#fff'};color:${page === i + 1 ? '#fff' : '#333'};border:1px solid #e2e8f0;font-size:13px;font-weight:700;text-decoration:none;">${i + 1}</a>`).join('')}</div>` : '';
  const storeContent = renderStoreByTheme(currentTemplate, store, slug, {
    products: pagedProducts, categories, cartCount, wishlistCount, wishlist, search, selectedCategory, currentTemplate, customer, cfg, isDark, sortOptions, paginationHtml
  });
  res.send(renderHtmlShell(`${store.name} - Store`, `<div class="store-page"><div class="store-wrap">${storeContent}</div></div>`, { extraStyles: themeCSS }));
}));

app.get('/store/:slug/product/:id', route(async (req, res) => {
  const db = loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) {
    res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404));
    return;
  }
  const currentTemplate = getTemplateById(db, store.template);
  const product = store.products.find((item) => item.id === String(req.params.id || '').trim());
  if (!product) {
    res.status(404).send(renderGlobalError('Product Not Found', 'The product you are looking for does not exist.', 404));
    return;
  }
  const wishlist = getStoreWishlist(req, slug);
  const related = store.products.filter((item) => item.id !== product.id && item.active !== false).slice(0, 4);
  const relatedHtml = related.length ? related.map((item) => `<a class="store-card" href="/store/${encodeURIComponent(slug)}/product/${encodeURIComponent(item.id)}" style="text-align:left;"><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p><div class="price-row"><div class="price-tag">${escapeHtml(formatMoney(item.price))}</div><div class="stock-tag">Stock: ${escapeHtml(String(item.stock || 0))}</div></div></a>`).join('') : '<div class="store-empty">No related products.</div>';
  const skuHtml = product.sku ? `<span class="store-pill">SKU: ${escapeHtml(product.sku)}</span>` : '';
  const ogTitle = escapeHtml(`${product.name} - ${store.name}`);
  const ogDesc = escapeHtml(product.description || store.description || '');
  const ogImage = product.image ? `<meta property="og:image" content="${escapeHtml(product.image)}">` : '';
  res.send(renderHtmlShell(`${product.name} - ${store.name}`, `
    <div class="store-page"><div class="store-wrap">
      <div class="store-nav"><a href="/store/${encodeURIComponent(slug)}">Back to store</a><a href="/store/${encodeURIComponent(slug)}/cart">Cart</a><a href="/store/${encodeURIComponent(slug)}/wishlist">Wishlist</a><a href="/store/${encodeURIComponent(slug)}/track-order">Track order</a></div>
      <div class="card panel product-detail">
        <div>${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : '<div class="store-empty">No image</div>'}</div>
        <div>
          <h1 class="section-title" style="margin-top:0;">${escapeHtml(product.name)}</h1>
          <p class="section-subtitle">${escapeHtml(product.description)}</p>
          <div class="product-meta"><span class="price-tag">${escapeHtml(formatMoney(product.price))}</span><span class="store-pill">Stock ${escapeHtml(String(product.stock || 0))}</span>${skuHtml}</div>
          <div class="actions" style="margin-bottom:14px;">
            <div style="display:flex;gap:10px;align-items:end;">
              <div class="field" style="width:80px;"><label style="font-size:12px;">Qty</label><input type="number" id="qty" value="1" min="1" max="${escapeHtml(String(Math.max(1, product.stock || 99)))}" style="padding:10px;text-align:center;"></div>
              <form method="POST" action="/store/${encodeURIComponent(slug)}/cart/add/${encodeURIComponent(product.id)}" style="flex:1;"><input type="hidden" name="quantity" id="qtyHidden" value="1"><button class="btn" type="submit" style="width:100%;min-height:44px;">Add to cart</button></form>
            </div>
          </div>
          <div class="actions">
            <a class="btn btn-secondary" href="/store/${encodeURIComponent(slug)}/buy/${encodeURIComponent(product.id)}">Buy now</a>
            <form method="POST" action="/store/${encodeURIComponent(slug)}/wishlist/toggle/${encodeURIComponent(product.id)}"><button class="btn btn-outline ${wishlist.includes(product.id) ? 'wishlist-active' : ''}" type="submit">${wishlist.includes(product.id) ? '♥ Wishlisted' : '♡ Wishlist'}</button></form>
          </div>
        </div>
      </div>
      <section class="card panel" style="margin-top:18px;">
        <div class="section-head"><h2 class="section-title" style="font-size:20px; margin:0;">Related products</h2></div>
        <div class="store-grid">${relatedHtml}</div>
      </section>
    </div></div>
    <script>var qty=document.getElementById('qty'),qtyH=document.getElementById('qtyHidden');if(qty&&qtyH)qty.addEventListener('input',function(){qtyH.value=qty.value;});</script>
  `, { extraStyles: renderStoreCss(currentTemplate, store.theme), metaTags: `<meta property="og:title" content="${ogTitle}"><meta property="og:description" content="${ogDesc}"><meta property="og:type" content="product">${ogImage}` }));
}));

app.post('/store/:slug/cart/add/:id', route(async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    const productId = String(req.params.id || '').trim();
    const result = addProductToCart(req, slug, productId, req.body.quantity || 1);
    if (!result.ok) {
      const referer = req.get('referer') || `/store/${encodeURIComponent(slug)}`;
      setFlash(req, 'error', result.message || 'Unable to add to cart.');
      res.redirect(referer);
      return;
    }
    const referer = req.get('referer');
    res.redirect(referer && referer.includes(`/store/${slug}`) ? referer : `/store/${encodeURIComponent(slug)}/cart`);
  } catch (error) {
    res.redirect(`/store/${encodeURIComponent(req.params.slug)}`);
  }
}));

app.post('/store/:slug/cart/remove/:id', route(async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    removeProductFromCart(req, slug, String(req.params.id || '').trim());
    res.redirect(`/store/${encodeURIComponent(slug)}/cart`);
  } catch (error) {
    res.redirect(`/store/${encodeURIComponent(req.params.slug)}/cart`);
  }
}));

app.post('/store/:slug/cart/update/:id', route(async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    const productId = String(req.params.id || '').trim();
    const quantity = Math.max(1, Number(req.body.quantity || 1));
    const cart = getStoreCart(req, slug);
    const item = cart.find((entry) => entry.productId === productId);
    if (item) {
      item.quantity = quantity;
      saveStoreCart(req, slug, cart);
    }
    res.redirect(`/store/${encodeURIComponent(slug)}/cart`);
  } catch (error) {
    res.redirect(`/store/${encodeURIComponent(req.params.slug)}/cart`);
  }
}));

app.post('/store/:slug/wishlist/toggle/:id', route(async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    toggleWishlistProduct(req, slug, String(req.params.id || '').trim());
    const referer = req.get('referer');
    res.redirect(referer && referer.includes(`/store/${slug}`) ? referer : `/store/${encodeURIComponent(slug)}/wishlist`);
  } catch (error) {
    res.redirect(`/store/${encodeURIComponent(req.params.slug)}`);
  }
}));

app.get('/store/:slug/cart', route(async (req, res) => {
  const db = loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) {
    res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404));
    return;
  }
  const currentTemplate = getTemplateById(db, store.template);
  const cartDetails = getCartDetails(store, getStoreCart(req, slug));
  const subtotal = cartDetails.reduce((sum, item) => sum + item.subtotal, 0);
  const shippingFee = store.shipping && store.shipping.mode === 'flat' ? Number(store.shipping.fee || 0) : 0;
  const taxRate = store.taxSettings && store.taxSettings.enabled ? Number(store.taxSettings.rate || 0) : 0;
  const taxAmount = store.taxSettings && store.taxSettings.enabled ? subtotal * (taxRate / 100) : 0;
  const total = subtotal + shippingFee + taxAmount;
  const rows = cartDetails.length ? cartDetails.map((item) => `
    <div class="summary-row">
      <div><strong>${escapeHtml(item.product.name)}</strong><div class="muted">${escapeHtml(formatMoney(item.product.price))} x ${escapeHtml(String(item.quantity))}</div></div>
      <div>
        <form class="inline-form" method="POST" action="/store/${encodeURIComponent(slug)}/cart/update/${encodeURIComponent(item.product.id)}">
          <input name="quantity" value="${escapeHtml(String(item.quantity))}" style="width:72px;" type="number" min="1">
          <button class="btn btn-secondary" type="submit">Save</button>
        </form>
        <form method="POST" action="/store/${encodeURIComponent(slug)}/cart/remove/${encodeURIComponent(item.product.id)}" style="margin-top:8px; text-align:right;"><button class="btn btn-danger" type="submit">Remove</button></form>
      </div>
    </div>
  `).join('') : '<div class="store-empty">Your cart is empty.</div>';
  res.send(renderHtmlShell(`${store.name} - Cart`, `
    <div class="store-page"><div class="store-wrap cart-page">
      <div class="store-nav"><a href="/store/${encodeURIComponent(slug)}">Continue shopping</a><a href="/store/${encodeURIComponent(slug)}/wishlist">Wishlist</a><a href="/store/${encodeURIComponent(slug)}/track-order">Track order</a></div>
      <section class="card panel">
        <div class="title-row"><div><h1 class="page-title">Cart</h1><p class="page-subtitle">Review items before checkout</p></div></div>
        ${rows}
      </section>
      <section class="card panel summary-box">
        <div class="summary-row"><span>Subtotal</span><strong>${escapeHtml(formatMoney(subtotal))}</strong></div>
        <div class="summary-row"><span>Shipping</span><strong>${escapeHtml(formatMoney(shippingFee))}</strong></div>
        <div class="summary-row"><span>Tax</span><strong>${escapeHtml(formatMoney(taxAmount))}</strong></div>
        <div class="summary-row"><span>Total</span><strong>${escapeHtml(formatMoney(total))}</strong></div>
        <div style="height:12px;"></div>
        <a class="btn ${cartDetails.length ? '' : 'btn-secondary'}" href="/store/${encodeURIComponent(slug)}/checkout?mode=cart">Proceed to checkout</a>
      </section>
    </div></div>
  `, { extraStyles: renderStoreCss(currentTemplate, store.theme) }));
}));

app.get('/store/:slug/wishlist', route(async (req, res) => {
  const db = loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) {
    res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404));
    return;
  }
  const currentTemplate = getTemplateById(db, store.template);
  const wishlist = getStoreWishlist(req, slug);
  const items = wishlist.map((productId) => store.products.find((product) => product.id === productId)).filter(Boolean);
  const html = items.length ? items.map((product) => `
    <div class="summary-row">
      <div><strong>${escapeHtml(product.name)}</strong><div class="muted">${escapeHtml(formatMoney(product.price))}</div></div>
      <div class="actions">
        <form method="POST" action="/store/${encodeURIComponent(slug)}/cart/add/${encodeURIComponent(product.id)}"><button class="btn" type="submit">Add to cart</button></form>
        <form method="POST" action="/store/${encodeURIComponent(slug)}/wishlist/toggle/${encodeURIComponent(product.id)}"><button class="btn btn-danger" type="submit">Remove</button></form>
      </div>
    </div>
  `).join('') : '<div class="store-empty">Wishlist is empty.</div>';
  res.send(renderHtmlShell(`${store.name} - Wishlist`, `
    <div class="store-page"><div class="store-wrap wishlist-page">
      <div class="store-nav"><a href="/store/${encodeURIComponent(slug)}">Continue shopping</a><a href="/store/${encodeURIComponent(slug)}/cart">Cart</a><a href="/store/${encodeURIComponent(slug)}/track-order">Track order</a></div>
      <section class="card panel">
        <div class="title-row"><div><h1 class="page-title">Wishlist</h1><p class="page-subtitle">Saved products</p></div></div>
        ${html}
      </section>
    </div></div>
  `, { extraStyles: renderStoreCss(currentTemplate, store.theme) }));
}));

app.get('/store/:slug/checkout', route(async (req, res) => {
  const db = loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) {
    res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404));
    return;
  }
  const currentTemplate = getTemplateById(db, store.template);
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
  if (!lineItems.length) {
    res.send(renderHtmlShell(`${store.name} - Checkout`, `<div class="store-page"><div class="store-wrap"><div class="store-empty">Your cart is empty. <a href="/store/${encodeURIComponent(slug)}">Go back</a></div></div></div>`, { extraStyles: renderStoreCss(currentTemplate, store.theme) }));
    return;
  }
  const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
  const shippingFee = store.shipping && store.shipping.mode === 'flat' ? Number(store.shipping.fee || 0) : 0;
  const taxRate = store.taxSettings && store.taxSettings.enabled ? Number(store.taxSettings.rate || 0) : 0;
  const taxAmount = store.taxSettings && store.taxSettings.enabled ? subtotal * (taxRate / 100) : 0;
  const total = subtotal + shippingFee + taxAmount;
  const customer = getLoggedCustomer(req, slug);
  const contactName = draft.contactName || (customer ? customer.name : '');
  const contactPhone = draft.contactPhone || (customer ? customer.phone : '');
  const contactEmail = draft.contactEmail || (customer ? customer.email : '');
  const shippingAddress = draft.shippingAddress || (customer && Array.isArray(customer.addresses) && customer.addresses.length ? customer.addresses[0] : '');
  const orderNotes = draft.orderNotes || '';
  const selectedPaymentMethod = draft.paymentMethod === 'online' ? 'online' : 'cod';
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
        <small>${escapeHtml(String(item.quantity))} x ${escapeHtml(formatMoney(item.product.price))}</small>
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
        <div class="summary-row"><span>Tax</span><strong>${escapeHtml(formatMoney(taxAmount))}</strong></div>
        <div class="summary-row"><span>Total</span><strong>${escapeHtml(formatMoney(total))}</strong></div>
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
        <div class="field"><label for="address">Shipping Address</label><textarea id="address" name="address" required>${escapeHtml(shippingAddress)}</textarea></div>
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
        <div class="field"><label for="paymentMethod">Payment Method</label><select id="paymentMethod" name="paymentMethod"><option value="cod"${selectedPaymentMethod === 'cod' ? ' selected' : ''}>Cash on Delivery</option><option value="online"${selectedPaymentMethod === 'online' ? ' selected' : ''}>Online / Manual</option></select></div>
        <div class="field"><label for="notes">Order Notes</label><textarea id="notes" name="notes" readonly>${escapeHtml(orderNotes)}</textarea></div>
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
  `, { extraStyles: renderStoreCss(currentTemplate, store.theme) }));
}));

app.post('/store/:slug/checkout', route(async (req, res) => {
  try {
    const db = loadDB();
    const slug = String(req.params.slug || '').trim();
    const store = db.stores[slug];
    if (!store) {
      res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404));
      return;
    }
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
    const paymentMethod = String(req.body.paymentMethod || draft.paymentMethod || 'cod').trim() === 'online' ? 'online' : 'cod';
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
    const shippingFee = store.shipping && store.shipping.mode === 'flat' ? Number(store.shipping.fee || 0) : 0;
    const taxRate = store.taxSettings && store.taxSettings.enabled ? Number(store.taxSettings.rate || 0) : 0;
    const taxAmount = store.taxSettings && store.taxSettings.enabled ? subtotal * (taxRate / 100) : 0;
    const total = subtotal + shippingFee + taxAmount;
    const createdAt = new Date().toISOString();
    const trackingCode = generateTrackingCode();
    const order = {
      id: generateId('ord'),
      orderNumber: generateOrderNumber(store),
      trackingCode,
      productId: lineItems[0].product.id,
      productName: lineItems.map((item) => item.product.name).join(', '),
      items: lineItems.map((item) => ({ productId: item.product.id, name: item.product.name, price: item.product.price, quantity: item.quantity })),
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
      shippingAddress: draft.shippingAddress,
      notes,
      paymentMethod,
      status: 'pending',
      amount: String(total),
      subtotal: String(subtotal),
      shippingFee: String(shippingFee),
      taxAmount: String(taxAmount),
      createdAt,
      trackingHistory: [{ status: 'placed', at: createdAt }]
    };
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
    // Decrement stock
    if (Array.isArray(lineItems)) {
      lineItems.forEach((item) => {
        const product = store.products.find((p) => p.id === item.product.id);
        if (product) {
          product.stock = Math.max(0, (parseInt(product.stock, 10) || 0) - (parseInt(item.quantity, 10) || 1));
        }
      });
    }
    saveDB(db);
    if (checkoutMode === 'cart') {
      saveStoreCart(req, slug, []);
    }
    clearCheckoutDraft(req, slug);
    setLoggedCustomer(req, slug, email);
    setFlash(req, 'success', 'Order placed successfully.');
    res.redirect(`/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(trackingCode)}`);
  } catch (error) {
    setFlash(req, 'error', 'Unable to place order.');
    res.redirect(`/store/${encodeURIComponent(req.params.slug)}/checkout`);
  }
}));

app.get('/store/:slug/buy/:id', route(async (req, res) => {
  try {
    const db = loadDB();
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
    const draft = getCheckoutDraft(req, slug);
    draft.mode = 'buy-now';
    draft.step = 'contact';
    draft.items = [{ productId: product.id, quantity: 1 }];
    saveCheckoutDraft(req, slug, draft);
    res.redirect(`/store/${encodeURIComponent(slug)}/checkout?mode=buy-now`);
  } catch (error) {
    res.redirect(`/store/${encodeURIComponent(req.params.slug)}`);
  }
}));

app.get('/store/:slug/track-order', route(async (req, res) => {
  const db = loadDB();
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
  `, { extraStyles: renderStoreCss(currentTemplate, store.theme) }));
}));

app.get('/store/:slug/order/:code', route(async (req, res) => {
  const db = loadDB();
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
  res.send(renderHtmlShell(`Order ${order.orderNumber}`, `
    <div class="store-page"><div class="store-wrap tracking-page">
      <section class="card panel">
        <div class="title-row"><div><h1 class="page-title">${escapeHtml(order.orderNumber)}</h1><p class="page-subtitle">${escapeHtml(order.productName)}</p></div><span class="badge badge-live">${escapeHtml(order.status)}</span></div>
        <div class="kpi-list"><div class="kpi-item"><strong>Customer</strong><span>${escapeHtml(order.customerName)}</span></div><div class="kpi-item"><strong>Email</strong><span>${escapeHtml(order.customerEmail || '-')}</span></div><div class="kpi-item"><strong>Phone</strong><span>${escapeHtml(order.customerPhone)}</span></div><div class="kpi-item"><strong>Tracking</strong><span>${escapeHtml(order.trackingCode)}</span></div><div class="kpi-item"><strong>Total</strong><span>${escapeHtml(formatMoney(order.amount))}</span></div></div>
      </section>
    </div></div>
  `, { extraStyles: renderStoreCss(currentTemplate, store.theme) }));
}));

app.get('/store/:slug/account/register', route(async (req, res) => {
  const db = loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
  const currentTemplate = getTemplateById(db, store.template);
  const flash = renderFlashMessages(req);
  res.send(renderHtmlShell(`${store.name} - Create Account`, `
    <div class="store-page"><div class="store-wrap account-page">
      <div class="store-nav"><a href="/store/${encodeURIComponent(slug)}">Home</a><a href="/store/${encodeURIComponent(slug)}/account/login">Login</a></div>
      <section class="card panel">
        ${flash}
        <h1 class="section-title">Create account</h1>
        <p class="section-subtitle">Register once and track orders faster.</p>
        <form method="POST" action="/store/${encodeURIComponent(slug)}/account/register" class="form-grid">
          <div class="field"><label for="name">Full Name</label><input id="name" name="name" autocomplete="name" required></div>
          <div class="field"><label for="phone">Phone</label><input id="phone" name="phone" autocomplete="tel" required></div>
          <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
          <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="new-password" required></div>
          <div class="actions"><button class="btn" type="submit">Create Account</button></div>
        </form>
      </section>
    </div></div>
  `, { extraStyles: renderStoreCss(currentTemplate, store.theme) }));
}));

app.post('/store/:slug/account/register', route(async (req, res) => {
  try {
    const db = loadDB();
    const slug = String(req.params.slug || '').trim();
    const store = db.stores[slug];
    if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
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
    store.customers[email] = { id: email, email, name, phone, passwordHash: hashPassword(password), orders: [], wishlist: [], createdAt: new Date().toISOString(), addresses: [] };
    saveDB(db);
    setLoggedCustomer(req, slug, email);
    setFlash(req, 'success', 'Account created.');
    res.redirect(`/store/${encodeURIComponent(slug)}/account`);
  } catch (error) {
    setFlash(req, 'error', 'Unable to create account.');
    res.redirect(`/store/${encodeURIComponent(req.params.slug)}/account/register`);
  }
}));

app.get('/store/:slug/account/login', route(async (req, res) => {
  const db = loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
  const currentTemplate = getTemplateById(db, store.template);
  const flash = renderFlashMessages(req);
  res.send(renderHtmlShell(`${store.name} - Login`, `
    <div class="store-page"><div class="store-wrap account-page">
      <div class="store-nav"><a href="/store/${encodeURIComponent(slug)}">Home</a><a href="/store/${encodeURIComponent(slug)}/account/register">Create account</a></div>
      <section class="card panel">${flash}<h1 class="section-title">Login</h1><p class="section-subtitle">Access your saved orders and wishlist.</p>
        <form method="POST" action="/store/${encodeURIComponent(slug)}/account/login" class="form-grid">
          <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
          <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>
          <div class="actions"><button class="btn" type="submit">Login</button></div>
        </form>
      </section>
    </div></div>
  `, { extraStyles: renderStoreCss(currentTemplate, store.theme) }));
}));

app.post('/store/:slug/account/login', route(async (req, res) => {
  try {
    const db = loadDB();
    const slug = String(req.params.slug || '').trim();
    const store = db.stores[slug];
    if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const customer = store.customers && store.customers[email];
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

app.get('/store/:slug/account/logout', route(async (req, res) => {
  try {
    clearLoggedCustomer(req);
    res.redirect(`/store/${encodeURIComponent(req.params.slug)}`);
  } catch (error) {
    res.redirect(`/store/${encodeURIComponent(req.params.slug)}`);
  }
}));

app.get('/store/:slug/account', route(async (req, res) => {
  const db = loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
  const currentTemplate = getTemplateById(db, store.template);
  const customer = getLoggedCustomer(req, slug);
  if (!customer) { res.redirect(`/store/${encodeURIComponent(slug)}/account/login`); return; }
  const orders = store.orders.filter((order) => order.customerEmail === customer.email).slice().reverse();
  res.send(renderHtmlShell(`${store.name} - Account`, `
    <div class="store-page"><div class="store-wrap account-page">
      <div class="store-nav"><a href="/store/${encodeURIComponent(slug)}">Home</a><a href="/store/${encodeURIComponent(slug)}/account/orders">Orders</a><a href="/store/${encodeURIComponent(slug)}/account/wishlist">Wishlist</a><a href="/store/${encodeURIComponent(slug)}/account/logout">Logout</a></div>
      <section class="card panel">
        <div class="title-row"><div><h1 class="page-title">My Account</h1><p class="page-subtitle">${escapeHtml(customer.name)}</p></div></div>
        <div class="kpi-list"><div class="kpi-item"><strong>Email</strong><span>${escapeHtml(customer.email)}</span></div><div class="kpi-item"><strong>Phone</strong><span>${escapeHtml(customer.phone)}</span></div><div class="kpi-item"><strong>Orders</strong><span>${escapeHtml(String(orders.length))}</span></div></div>
      </section>
      <section class="card panel">
        <div class="section-head"><h2 class="section-title" style="font-size:18px; margin:0;">Recent orders</h2><a class="btn btn-secondary" href="/store/${encodeURIComponent(slug)}/account/orders">View all</a></div>
        ${orders.length ? orders.slice(0, 5).map((order) => `<div class="summary-row"><div><strong>${escapeHtml(order.orderNumber)}</strong><div class="muted">${escapeHtml(order.productName)}</div></div><a class="btn btn-secondary" href="/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(order.trackingCode)}">Track</a></div>`).join('') : '<div class="store-empty">No orders yet.</div>'}
      </section>
    </div></div>
  `, { extraStyles: renderStoreCss(currentTemplate, store.theme) }));
}));

app.get('/store/:slug/account/orders', route(async (req, res) => {
  const db = loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
  const currentTemplate = getTemplateById(db, store.template);
  const customer = getLoggedCustomer(req, slug);
  if (!customer) { res.redirect(`/store/${encodeURIComponent(slug)}/account/login`); return; }
  const orders = store.orders.filter((order) => order.customerEmail === customer.email).slice().reverse();
  const html = orders.length ? orders.map((order) => `<div class="summary-row"><div><strong>${escapeHtml(order.orderNumber)}</strong><div class="muted">${escapeHtml(order.productName)}</div><div class="muted">${escapeHtml(formatDate(order.createdAt))}</div></div><div class="actions"><span class="badge badge-live">${escapeHtml(order.status)}</span><a class="btn btn-secondary" href="/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(order.trackingCode)}">Track</a></div></div>`).join('') : '<div class="store-empty">No orders yet.</div>';
  res.send(renderHtmlShell(`${store.name} - Orders`, `<div class="store-page"><div class="store-wrap account-page"><div class="store-nav"><a href="/store/${encodeURIComponent(slug)}/account">Back</a></div><section class="card panel"><h1 class="page-title">My Orders</h1>${html}</section></div></div>`, { extraStyles: renderStoreCss(currentTemplate, store.theme) }));
}));

app.get('/store/:slug/account/wishlist', route(async (req, res) => {
  const db = loadDB();
  const slug = String(req.params.slug || '').trim();
  const store = db.stores[slug];
  if (!store) { res.status(404).send(renderGlobalError('Store Not Found', 'The storefront you are looking for does not exist.', 404)); return; }
  const currentTemplate = getTemplateById(db, store.template);
  const customer = getLoggedCustomer(req, slug);
  if (!customer) { res.redirect(`/store/${encodeURIComponent(slug)}/account/login`); return; }
  const wish = Array.isArray(customer.wishlist) ? customer.wishlist : [];
  const items = wish.map((id) => store.products.find((product) => product.id === id)).filter(Boolean);
  const html = items.length ? items.map((product) => `<div class="summary-row"><div><strong>${escapeHtml(product.name)}</strong><div class="muted">${escapeHtml(formatMoney(product.price))}</div></div><div class="actions"><form method="POST" action="/store/${encodeURIComponent(slug)}/cart/add/${encodeURIComponent(product.id)}"><button class="btn" type="submit">Add to cart</button></form><form method="POST" action="/store/${encodeURIComponent(slug)}/wishlist/toggle/${encodeURIComponent(product.id)}"><button class="btn btn-danger" type="submit">Remove</button></form></div></div>`).join('') : '<div class="store-empty">Wishlist empty.</div>';
  res.send(renderHtmlShell(`${store.name} - Wishlist`, `<div class="store-page"><div class="store-wrap account-page"><div class="store-nav"><a href="/store/${encodeURIComponent(slug)}/account">Back</a></div><section class="card panel"><h1 class="page-title">Wishlist</h1>${html}</section></div></div>`, { extraStyles: renderStoreCss(currentTemplate, store.theme) }));
}));

app.get('/superadmin', route(async (req, res) => {
  if (req.session.superAdminId === 'superadmin') {
    res.redirect('/superadmin/dashboard');
    return;
  }
  const flash = renderFlashMessages(req);
  res.send(renderHtmlShell('Super Admin Login', `
      <div class="auth-wrap"><div class="card auth-card">${flash}<h1 class="section-title">Super admin login</h1><form method="POST" action="/superadmin/login" class="form-grid"><div class="field"><label for="email">Email</label><input id="email" name="email" type="email" required></div><div class="field"><label for="password">Password</label><input id="password" name="password" type="password" required></div><div class="actions"><button class="btn" type="submit">Login</button><a class="btn btn-secondary" href="/">Back to Home</a></div></form></div></div>
    `));
}));

app.post('/superadmin/login', route(async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!validateEmail(email)) { setFlash(req, 'error', 'Please enter a valid email address.'); res.redirect('/superadmin'); return; }
    if (!password) { setFlash(req, 'error', 'Password is required.'); res.redirect('/superadmin'); return; }
    const db = loadDB();
    if (!db.superAdmin || email !== db.superAdmin.email) { setFlash(req, 'error', 'Invalid super admin credentials.'); res.redirect('/superadmin'); return; }
    const valid = verifyPassword(password, db.superAdmin.passwordHash);
    if (!valid) { setFlash(req, 'error', 'Invalid super admin credentials.'); res.redirect('/superadmin'); return; }
    req.session.superAdminId = 'superadmin';
    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    setFlash(req, 'success', 'Super admin login successful.');
    res.redirect('/superadmin/dashboard');
  } catch (error) {
    setFlash(req, 'error', 'Super admin login failed.');
    res.redirect('/superadmin');
  }
}));

app.get('/superadmin/dashboard', requireSuperAdmin, route(async (req, res) => {
  const db = req.db;
  const stores = Object.values(db.stores);
  const users = Object.values(db.users);
  const totalProducts = stores.reduce((sum, store) => sum + store.products.length, 0);
  const totalOrders = stores.reduce((sum, store) => sum + store.orders.length, 0);
  const recentStores = [...stores].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  res.send(renderSuperAdminLayout(req, 'Super Admin Dashboard', 'dashboard', `
      <section class="stat-grid">
        <div class="card stat-card"><div class="stat-label">Total Stores</div><div class="stat-value">${escapeHtml(String(stores.length))}</div></div>
        <div class="card stat-card"><div class="stat-label">Total Users</div><div class="stat-value">${escapeHtml(String(users.length))}</div></div>
        <div class="card stat-card"><div class="stat-label">Total Products</div><div class="stat-value">${escapeHtml(String(totalProducts))}</div></div>
        <div class="card stat-card"><div class="stat-label">Total Orders</div><div class="stat-value">${escapeHtml(String(totalOrders))}</div></div>
      </section>
      <section class="grid-2" style="margin-top:20px;">
        <div class="card panel"><h2 class="section-title" style="font-size:24px;">Platform started</h2><p class="section-subtitle">${escapeHtml(formatDate(getPlatformStartedAt()))}</p></div>
        <div class="card panel"><h2 class="section-title" style="font-size:24px;">Recent stores</h2>${recentStores.length ? `<div class="table-wrap"><table><thead><tr><th>Store</th><th>Owner</th><th>Created</th></tr></thead><tbody>${recentStores.map((store) => { const owner = getStoreOwner(db, store); return `<tr><td><a href="/superadmin/store/${encodeURIComponent(store.slug)}">${escapeHtml(store.name)}</a></td><td>${escapeHtml(owner ? owner.email : '-')}</td><td>${escapeHtml(formatDate(store.createdAt))}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">No stores yet.</div>'}</div>
      </section>
    `));
}));

app.get('/superadmin/stores', requireSuperAdmin, route(async (req, res) => {
  const db = req.db;
  const stores = [...Object.values(db.stores)].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const html = stores.length ? `<div class="table-wrap"><table><thead><tr><th>Store</th><th>Slug</th><th>Owner</th><th>Products</th><th>Orders</th><th>Visits</th><th>Created</th><th>Actions</th></tr></thead><tbody>${stores.map((store) => { const owner = getStoreOwner(db, store); return `<tr><td>${escapeHtml(store.name)}</td><td>${escapeHtml(store.slug)}</td><td>${escapeHtml(owner ? owner.email : '-')}</td><td>${escapeHtml(String(store.products.length))}</td><td>${escapeHtml(String(store.orders.length))}</td><td>${escapeHtml(String(store.visits))}</td><td>${escapeHtml(formatDate(store.createdAt))}</td><td><div class="actions"><a class="btn btn-secondary" href="/store/${encodeURIComponent(store.slug)}" target="_blank" rel="noopener noreferrer">View</a><a class="btn btn-secondary" href="/superadmin/store/${encodeURIComponent(store.slug)}">Manage</a><form method="POST" action="/superadmin/store/${encodeURIComponent(store.slug)}/delete" onsubmit="return confirm('Delete this store and owner account?');"><button class="btn btn-danger" type="submit">Delete</button></form></div></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">No stores found.</div>';
  res.send(renderSuperAdminLayout(req, 'Stores', 'stores', `<section class="card panel"><h1 class="section-title">All stores</h1><p class="section-subtitle">Review every tenant store on the platform.</p>${html}</section>`));
}));

app.get('/superadmin/store/:slug', requireSuperAdmin, route(async (req, res) => {
  const db = req.db;
  const store = db.stores[req.params.slug];
  if (!store) { setFlash(req, 'error', 'Store not found.'); res.redirect('/superadmin/stores'); return; }
  const owner = getStoreOwner(db, store);
  const productsHtml = store.products.length ? `<div class="table-wrap"><table><thead><tr><th>Image</th><th>Name</th><th>Price</th><th>Stock</th><th>Delete</th></tr></thead><tbody>${store.products.map((product) => `<tr><td>${product.image ? `<img class="product-thumb" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : '-'}</td><td>${escapeHtml(product.name)}</td><td>${escapeHtml(formatMoney(product.price))}</td><td>${escapeHtml(product.stock)}</td><td><form method="POST" action="/superadmin/products/${encodeURIComponent(store.slug)}/delete/${encodeURIComponent(product.id)}" onsubmit="return confirm('Delete this product?');"><button class="btn btn-danger" type="submit">Delete</button></form></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No products found.</div>';
  const ordersHtml = store.orders.length ? `<div class="table-wrap"><table><thead><tr><th>Order</th><th>Product</th><th>Customer</th><th>Status</th><th>Amount</th><th>Date</th></tr></thead><tbody>${store.orders.map((order) => `<tr><td>${escapeHtml(order.id)}</td><td>${escapeHtml(order.productName)}</td><td>${escapeHtml(order.customerName || 'WhatsApp lead')}</td><td>${getStatusBadge(order.status)}</td><td>${escapeHtml(formatMoney(order.amount))}</td><td>${escapeHtml(formatDate(order.createdAt))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No orders found.</div>';
  res.send(renderSuperAdminLayout(req, `Manage ${store.name}`, 'stores', `
      <section class="grid-2">
        <div class="card panel"><h1 class="section-title">${escapeHtml(store.name)}</h1><div class="kpi-list"><div class="kpi-item"><strong>Slug</strong><span>${escapeHtml(store.slug)}</span></div><div class="kpi-item"><strong>Owner</strong><span>${escapeHtml(owner ? owner.email : '-')}</span></div><div class="kpi-item"><strong>WhatsApp</strong><span>${escapeHtml(store.whatsapp || '-')}</span></div><div class="kpi-item"><strong>Visits</strong><span>${escapeHtml(String(store.visits))}</span></div><div class="kpi-item"><strong>Created</strong><span>${escapeHtml(formatDate(store.createdAt))}</span></div></div><div style="height:16px;"></div><form method="POST" action="/superadmin/store/${encodeURIComponent(store.slug)}/delete" onsubmit="return confirm('Delete this store and owner account?');"><button class="btn btn-danger" type="submit">Delete Store</button></form></div>
        <div class="card panel"><h2 class="section-title" style="font-size:24px;">Store logo</h2>${store.logo ? `<img class="logo-preview" src="${escapeHtml(store.logo)}" alt="${escapeHtml(store.name)}">` : '<div class="empty">No logo uploaded</div>'}<div style="height:16px;"></div><p class="muted">${escapeHtml(store.description)}</p></div>
      </section>
      <section class="card panel"><h2 class="section-title" style="font-size:24px;">Products</h2>${productsHtml}</section>
      <section class="card panel"><h2 class="section-title" style="font-size:24px;">Orders</h2>${ordersHtml}</section>
    `));
}));

app.post('/superadmin/store/:slug/delete', requireSuperAdmin, route(async (req, res) => {
  try {
    const db = loadDB();
    const slug = String(req.params.slug || '').trim();
    const store = db.stores[slug];
    if (!store) { setFlash(req, 'error', 'Store not found.'); res.redirect('/superadmin/stores'); return; }
    if (store.logo) removeStoredFile(store.logo);
    store.products.forEach((product) => removeStoredFile(product.image));
    if (store.ownerId && db.users[store.ownerId]) delete db.users[store.ownerId];
    delete db.stores[slug];
    saveDB(db);
    setFlash(req, 'success', 'Store and owner account deleted successfully.');
    res.redirect('/superadmin/stores');
  } catch (error) {
    setFlash(req, 'error', 'Unable to delete store.');
    res.redirect('/superadmin/stores');
  }
}));

app.get('/superadmin/users', requireSuperAdmin, route(async (req, res) => {
  const db = req.db;
  const users = [...Object.values(db.users)].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const html = users.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Store Name</th><th>Store Slug</th><th>Products</th><th>Orders</th><th>Joined</th><th>Delete</th></tr></thead><tbody>${users.map((user) => { const store = db.stores[user.storeSlug]; return `<tr><td>${escapeHtml(user.name)}</td><td>${escapeHtml(user.email)}</td><td>${escapeHtml(user.phone || '-')}</td><td>${escapeHtml(store ? store.name : '-')}</td><td>${escapeHtml(store ? store.slug : '-')}</td><td>${escapeHtml(String(store ? store.products.length : 0))}</td><td>${escapeHtml(String(store ? store.orders.length : 0))}</td><td>${escapeHtml(formatDate(user.createdAt))}</td><td><form method="POST" action="/superadmin/user/${encodeURIComponent(user.id)}/delete" onsubmit="return confirm('Delete this user and store?');"><button class="btn btn-danger" type="submit">Delete</button></form></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">No users found.</div>';
  res.send(renderSuperAdminLayout(req, 'Users', 'users', `<section class="card panel"><h1 class="section-title">All users</h1><p class="section-subtitle">Manage registered store owners across the platform.</p>${html}</section>`));
}));

app.post('/superadmin/user/:id/delete', requireSuperAdmin, route(async (req, res) => {
  try {
    const db = loadDB();
    const userId = String(req.params.id || '').trim();
    const user = db.users[userId];
    if (!user) { setFlash(req, 'error', 'User not found.'); res.redirect('/superadmin/users'); return; }
    const store = db.stores[user.storeSlug];
    if (store) {
      if (store.logo) removeStoredFile(store.logo);
      store.products.forEach((product) => removeStoredFile(product.image));
      delete db.stores[user.storeSlug];
    }
    delete db.users[userId];
    saveDB(db);
    setFlash(req, 'success', 'User and store deleted successfully.');
    res.redirect('/superadmin/users');
  } catch (error) {
    setFlash(req, 'error', 'Unable to delete user.');
    res.redirect('/superadmin/users');
  }
}));

app.post('/superadmin/products/:slug/delete/:id', requireSuperAdmin, route(async (req, res) => {
  try {
    const db = loadDB();
    const slug = String(req.params.slug || '').trim();
    const productId = String(req.params.id || '').trim();
    const store = db.stores[slug];
    if (!store) { setFlash(req, 'error', 'Store not found.'); res.redirect('/superadmin/stores'); return; }
    const productIndex = store.products.findIndex((product) => product.id === productId);
    if (productIndex === -1) { setFlash(req, 'error', 'Product not found.'); res.redirect(`/superadmin/store/${encodeURIComponent(slug)}`); return; }
    const removed = store.products.splice(productIndex, 1)[0];
    removeStoredFile(removed.image);
    saveDB(db);
    setFlash(req, 'success', 'Product deleted successfully.');
    res.redirect(`/superadmin/store/${encodeURIComponent(slug)}`);
  } catch (error) {
    setFlash(req, 'error', 'Unable to delete product.');
    res.redirect(`/superadmin/store/${encodeURIComponent(req.params.slug)}`);
  }
}));

app.get('/superadmin/logout', route(async (req, res) => {
  try {
    await new Promise((resolve) => req.session.destroy(() => resolve()));
    res.redirect('/superadmin');
  } catch (error) {
    res.redirect('/superadmin');
  }
}));

app.use((req, res) => {
  res.status(404).send(renderGlobalError('Page Not Found', 'The page you requested could not be found.', 404));
});

app.use((error, req, res, next) => {
  try {
    const message = error && error.message ? error.message : 'Unexpected server error.';
    res.status(500).send(renderGlobalError('Server Error', message, 500));
  } catch (finalError) {
    res.status(500).send('<!DOCTYPE html><html><body><h1>Server Error</h1></body></html>');
  }
});

(async () => {
  await ensureDatabaseReady();
  app.listen(PORT, () => {
    console.log(`MyShopBuilder running on port ${PORT}`);
  });
})();
