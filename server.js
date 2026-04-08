const express = require('express');
const session = require('express-session');
const cors = require('cors');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const path = require('path');
const config = require('./config');
const { loadDB, saveDB, ensureDirectories, cloneDefaultDB, DEFAULT_TEMPLATES, FileSessionStore, getDBStatus, migrateFromBlobToTables, getSupabase, saveUploadedFile, removeStoredFile, runUploader } = require('./services/db');
const { hashPassword, verifyPassword } = require('./services/password');
const { syncLegacyUsersToSupabaseAuth } = require('./services/supabase-auth');
const { escapeHtml, slugify, generateId, generateTrackingCode, generateOrderNumber, parsePrice, sanitizePhone } = require('./helpers/html');
const { validateEmail } = require('./helpers/validation');
const { getEffectiveShippingFee, applyRoundingMode } = require('./helpers/store');
const { createRazorpayOrder, getRazorpayConfig } = require('./services/razorpay');
const { sendEmail } = require('./services/email');
const { getAppCatalog, getAppDefinition, normalizeStoreApps } = require('./services/apps');
const { upload, csvUpload } = require('./middleware/upload');
const { subdomainMiddleware } = require('./middleware/subdomain');
const { sameOriginGuard } = require('./middleware/request-security');
const { requireApiAuth, verifyApiToken } = require('./middleware/api-auth');

let helmet, rateLimit, MemoryStore;
try { helmet = require('helmet'); } catch (e) { console.log('[WARN] Install helmet: npm install helmet'); }
try { rateLimit = require('express-rate-limit'); } catch (e) { console.log('[WARN] Install express-rate-limit: npm install express-rate-limit'); }
try { MemoryStore = require('memorystore')(session); } catch (e) { console.log('[WARN] Install memorystore: npm install memorystore'); }

const app = express();
const { PORT, ROOT_DIR, STORAGE_ROOT, DB_PATH, SESSION_PATH, PUBLIC_DIR, LOGOS_DIR, PRODUCTS_DIR, SESSION_SECRET, ORDER_STATUSES, BASE_DOMAIN } = config;
const FRONTEND_DIST_DIR = path.join(ROOT_DIR, 'frontend', 'dist');
const JWT_SECRET = process.env.JWT_SECRET || SESSION_SECRET;
const FRONTEND_FRAME_ANCESTORS = [
  "'self'",
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
].concat(
  String(process.env.FRONTEND_ORIGIN || '')
    .split(',')
    .map((value) => String(value || '').trim())
    .filter(Boolean)
);

function generateToken(user) {
  return jwt.sign({ userId: user.id, email: user.email, role: 'vendor' }, JWT_SECRET, { expiresIn: '7d' });
}

function generateCustomerToken(customer, slug) {
  return jwt.sign({ customerId: customer.id, email: customer.email, storeSlug: slug, role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });
}

function generateSuperAdminToken() {
  return jwt.sign({ role: 'superadmin' }, JWT_SECRET, { expiresIn: '1d' });
}

function requireApiSuperAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  const decoded = verifyApiToken(auth.split(' ')[1]);
  if (!decoded || decoded.role !== 'superadmin') {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

function requireApiCustomer(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  const decoded = verifyApiToken(auth.split(' ')[1]);
  if (!decoded || decoded.role !== 'customer') {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  req.apiCustomerEmail = decoded.email;
  req.apiCustomerStoreSlug = decoded.storeSlug;
  next();
}

function getApiStore(db, slug) {
  return db && db.stores ? db.stores[String(slug || '').trim()] || null : null;
}

function getApiUser(db, email) {
  return db && db.users ? db.users[String(email || '').trim().toLowerCase()] || null : null;
}

function getPendingGoogleProfile(req) {
  const profile = req.session && req.session.googleAuth && typeof req.session.googleAuth === 'object' ? req.session.googleAuth : null;
  const email = String(profile && profile.email || '').trim().toLowerCase();
  const name = String(profile && profile.name || '').trim();
  if (!email || !validateEmail(email)) return null;
  return { email, name: name || email };
}

function decodeGoogleSignupToken(token) {
  try {
    const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
    const decoded = jwt.verify(String(token || ''), secret);
    if (!decoded || decoded.role !== 'google-signup') return null;
    const email = String(decoded.email || '').trim().toLowerCase();
    const name = String(decoded.name || '').trim();
    if (!email || !validateEmail(email)) return null;
    return { email, name: name || email };
  } catch (error) {
    return null;
  }
}

function sanitizeApiProduct(body) {
  return {
    name: String(body && body.name || '').trim(),
    description: String(body && body.description || '').trim(),
    price: parsePrice(body && body.price),
    comparePrice: parsePrice(body && (body.comparePrice != null ? body.comparePrice : body.mrp)),
    stock: Math.max(0, parseInt(body && body.stock || 0, 10) || 0),
    sku: String(body && body.sku || '').trim(),
    image: String(body && body.image || '').trim(),
    images: Array.isArray(body && body.images) ? body.images.filter(Boolean) : [],
    variants: Array.isArray(body && body.variants) ? body.variants : [],
    category: String(body && body.category || '').trim(),
    active: body && body.active !== false
  };
}

function buildStoreFromSignupPayload(payload, slug, ownerId, createdAt) {
  const orderMode = ['whatsapp', 'website', 'both'].includes(String(payload.orderMode || '').trim()) ? String(payload.orderMode || '').trim() : 'website';
  return {
    slug,
    ownerId,
    name: String(payload.storeName || '').trim(),
    description: String(payload.description || '').trim(),
    whatsapp: String(payload.whatsapp || payload.phone || '').trim(),
    logo: String(payload.logo || '').trim(),
    template: String(payload.templateId || 'app-style').trim() || 'app-style',
    theme: 'default',
    themeConfig: {
      bannerImages: payload.banner ? [String(payload.banner).trim()] : [],
      bannerImagesMobile: payload.bannerMobile ? [String(payload.bannerMobile).trim()] : []
    },
    products: [],
    orders: [],
    customers: {},
    visits: 0,
    createdAt,
    socialLinks: {
      instagram: String(payload.instagram || '').trim(),
      facebook: String(payload.facebook || '').trim()
    },
    storeSettings: {
      signupFlow: {
        plan: String(payload.plan || 'starter').trim(),
        currency: String(payload.currency || 'INR').trim(),
        orderMode
      },
      storeDetails: {
        address: String(payload.address || '').trim(),
        phone: String(payload.phone || '').trim(),
        email: String(payload.email || '').trim().toLowerCase(),
        socialLinks: {
          instagram: String(payload.instagram || '').trim(),
          facebook: String(payload.facebook || '').trim()
        },
        city: String(payload.city || '').trim(),
        state: String(payload.state || '').trim()
      }
    }
  };
}

function getVendorStoreFromReq(db, req) {
  const user = getApiUser(db, req.apiUserEmail);
  return user ? getApiStore(db, user.storeSlug) : null;
}

async function getVendorStoreOr404(req, res) {
  const db = await loadDB();
  const store = getVendorStoreFromReq(db, req);
  if (!store) {
    res.status(404).json({ success: false, error: 'Store not found' });
    return null;
  }
  return { db, store };
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

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function buildApiCheckoutLineItems(store, items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const product = (store.products || []).find((entry) => entry.id === item.productId);
    if (!product || product.active === false) return null;
    const quantity = Math.max(1, parseInt(item.quantity || 1, 10) || 1);
    const price = parsePrice(item.price != null ? item.price : product.price);
    return {
      product,
      quantity,
      price,
      subtotal: price * quantity,
      variantSummary: String(item.variantSummary || '').trim(),
      sku: String(item.sku || product.sku || '').trim()
    };
  }).filter(Boolean);
}

async function ensureDatabaseReady() {
  ensureDirectories();
  let db = await loadDB();
  let changed = false;
  const saEmail = String(process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const saPass = String(process.env.SUPER_ADMIN_PASSWORD || '');
  if ((!db.superAdmin || !db.superAdmin.email || !db.superAdmin.passwordHash) && saEmail && saPass) {
    db.superAdmin = { email: saEmail, passwordHash: hashPassword(saPass) };
    changed = true;
  } else if ((saEmail || saPass) && db.superAdmin && db.superAdmin.email && db.superAdmin.passwordHash) {
    if (saEmail && db.superAdmin.email !== saEmail) {
      db.superAdmin.email = saEmail;
      changed = true;
    }
    if (saPass) {
      db.superAdmin.passwordHash = hashPassword(saPass);
      changed = true;
    }
  }
  if (!Array.isArray(db.templates) || !db.templates.length) {
    db.templates = DEFAULT_TEMPLATES;
    changed = true;
  }
  if ((!db.superAdmin || !db.superAdmin.email || !db.superAdmin.passwordHash) && !(saEmail && saPass)) {
    console.warn('[SECURITY] Super admin credentials are not configured. Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD.');
  } else if (db.superAdmin && String(db.superAdmin.email || '').trim().toLowerCase() === 'admin@myshopbuilder.com' && verifyPassword('change-me-now', db.superAdmin.passwordHash)) {
    console.warn('[SECURITY] Default super admin credentials are still active. Rotate them immediately with SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD.');
  }
  if (changed) { await saveDB(db); }
}

function logStartupConfiguration() {
  const frontendIndex = path.join(FRONTEND_DIST_DIR, 'index.html');
  const landingPage = path.join(ROOT_DIR, 'landing-page.html');
  console.log('[BOOT] Runtime configuration');
  console.log(`[BOOT] PORT=${PORT} STORAGE_ROOT=${STORAGE_ROOT}`);
  console.log(`[BOOT] BASE_DOMAIN=${BASE_DOMAIN || '(disabled)'}`);
  console.log(`[BOOT] Supabase=${process.env.SUPABASE_URL ? 'enabled' : 'disabled'} Cloudinary=${process.env.CLOUDINARY_CLOUD_NAME ? 'enabled' : 'disabled'}`);
  console.log(`[BOOT] Landing page=${fs.existsSync(landingPage) ? 'present' : 'missing'} Frontend dist=${fs.existsSync(frontendIndex) ? 'present' : 'missing'}`);
  if (STORAGE_ROOT === ROOT_DIR && !process.env.SUPABASE_URL) {
    console.warn('[BOOT] STORAGE_ROOT points to the app directory and Supabase is disabled. Source-zip deploys can overwrite local runtime data.');
  }
}

async function ensureSupabaseAuthReady() {
  try {
    const db = await loadDB();
    const result = await syncLegacyUsersToSupabaseAuth(db);
    if (result && result.enabled) {
      console.log(`[AUTH] Synced merchants=${result.merchants} customers=${result.customers} created=${result.created || 0} updated=${result.updated || 0} skipped=${result.skipped || 0}`);
    }
  } catch (error) {
    console.error('[AUTH] Supabase auth sync failed.', error && error.message ? error.message : error);
  }
}

// Security headers
if (helmet) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://checkout.razorpay.com", "https://cdn.tailwindcss.com", "https://www.googletagmanager.com", "https://connect.facebook.net", "https://embed.tawk.to"],
        imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://www.facebook.com"],
        connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://raw.githubusercontent.com", "https://www.google-analytics.com", "https://region1.google-analytics.com", "https://www.googletagmanager.com", "https://connect.facebook.net", "https://graph.facebook.com", "https://embed.tawk.to", "https://va.tawk.to", "wss://*.tawk.to"],
        fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        frameSrc: ["https://api.razorpay.com", "https://www.googletagmanager.com", "https://www.facebook.com", "https://*.tawk.to"],
        frameAncestors: FRONTEND_FRAME_ANCESTORS
      }
    },
    crossOriginEmbedderPolicy: false,
    frameguard: false
  }));
}

app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.json({ limit: '15mb' }));
const allowedOrigins = [
  'https://storebanao.com',
  'https://www.storebanao.com',
  'http://localhost:5173',
  'http://localhost:3000'
].concat(
  String(process.env.FRONTEND_ORIGIN || '')
    .split(',')
    .map((value) => String(value || '').trim())
    .filter(Boolean)
);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.set('trust proxy', 1);

// Rate limiting
if (rateLimit) {
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/auth/google' || req.path === '/auth/callback' || req.path === '/auth/google/callback',
    message: 'Too many attempts. Try again later.'
  });
  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 2000, standardHeaders: true, legacyHeaders: false });
  app.use('/login', authLimiter);
  app.use('/register', authLimiter);
  app.use('/superadmin', authLimiter);
  app.use('/api', apiLimiter);
}

app.use('/public', express.static(PUBLIC_DIR, { maxAge: '7d', etag: true, lastModified: true }));
app.use('/app', express.static(FRONTEND_DIST_DIR, { maxAge: '7d', etag: true, lastModified: true }));

const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS || 800);
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startedAt;
    if (duration >= SLOW_REQUEST_MS) {
      console.log(`[SLOW] ${req.method} ${req.originalUrl} -> ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, 'https://' + req.headers.host + req.url);
  }
  next();
});

const fileSessionStore = MemoryStore ? new MemoryStore({ checkPeriod: 86400000 }) : new FileSessionStore();
app.use(session({
  store: fileSessionStore,
  proxy: true,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use('/logos', express.static(LOGOS_DIR));
app.use('/products', express.static(PRODUCTS_DIR));
app.use(sameOriginGuard);
app.use(subdomainMiddleware);

app.use((req, res, next) => { return next(); });

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    uptimeSec: Math.round(process.uptime()),
    db: getDBStatus(),
    files: {
      landingPage: fs.existsSync(path.join(ROOT_DIR, 'landing-page.html')),
      frontendDist: fs.existsSync(path.join(FRONTEND_DIST_DIR, 'index.html'))
    },
    env: {
      nodeEnv: process.env.NODE_ENV || 'development',
      baseDomain: process.env.BASE_DOMAIN || '',
      storageRoot: STORAGE_ROOT,
      cloudinaryFolder: process.env.CLOUDINARY_FOLDER || '',
      superAdminConfigured: !!(process.env.SUPER_ADMIN_EMAIL && process.env.SUPER_ADMIN_PASSWORD)
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    website: 'storebanao.com',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API is working!',
    website: 'storebanao.com',
    availableRoutes: [
      'GET /api/health',
      'POST /api/auth/login',
      'POST /api/auth/register',
      'GET /api/auth/me',
      'GET /api/store/:slug',
      'GET /api/store/:slug/products',
      'GET /api/store/:slug/product/:id',
      'GET /api/dashboard',
      'GET /api/dashboard/products',
      'GET /api/dashboard/orders',
      'GET /api/dashboard/customers',
      'PUT /api/dashboard/orders/:id/status',
      'POST /api/superadmin/login',
      'GET /api/superadmin/stores',
      'GET /api/superadmin/users'
    ]
  });
});

app.get('/api/landing', async (req, res) => {
  try {
    const db = await loadDB();
    const users = Object.values(db.users || {});
    const stores = Object.values(db.stores || {});
    const orderCount = stores.reduce((sum, store) => sum + ((store.orders || []).length), 0);
    const productCount = stores.reduce((sum, store) => sum + ((store.products || []).length), 0);
    res.json({
      success: true,
      stats: {
        userCount: users.length,
        storeCount: stores.length,
        orderCount,
        productCount
      },
      supportPhone: String(process.env.SUPPORT_WHATSAPP || process.env.SUPPORT_PHONE || '7300628199').replace(/\D/g, ''),
      supportWhatsappUrl: `https://wa.me/91${String(process.env.SUPPORT_WHATSAPP || process.env.SUPPORT_PHONE || '7300628199').replace(/\D/g, '')}?text=${encodeURIComponent('Hi StoreBanao, I need help with my online store.')}`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/templates', async (req, res) => {
  try {
    const db = await loadDB();
    const templates = Array.isArray(db.templates) && db.templates.length ? db.templates : DEFAULT_TEMPLATES;
    res.json({ success: true, templates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.use('/api/dashboard/pages', require('./routes/api/dashboard-pages.routes'));
app.use('/api/dashboard/builder', require('./routes/api/dashboard-builder.routes'));
app.use('/api/store', require('./routes/api/store-pages.routes'));
app.use('/api/store', require('./routes/api/store-builder.routes'));

app.post('/api/demo-request', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const phone = sanitizePhone(req.body.phone || '');
    const category = String(req.body.category || '').trim();
    const preferredTime = String(req.body.preferredTime || '').trim();
    if (!name || phone.length < 10 || !preferredTime) {
      return res.status(400).json({ success: false, error: 'Please fill required fields' });
    }
    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:24px;"><div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:28px;"><h2 style="margin-top:0;">New demo request</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:10px 0;color:#6b7280;width:160px;">Name</td><td style="padding:10px 0;font-weight:700;">${escapeHtml(name)}</td></tr><tr><td style="padding:10px 0;color:#6b7280;">Phone</td><td style="padding:10px 0;font-weight:700;">${escapeHtml(phone)}</td></tr><tr><td style="padding:10px 0;color:#6b7280;">What they sell</td><td style="padding:10px 0;font-weight:700;">${escapeHtml(category || '-')}</td></tr><tr><td style="padding:10px 0;color:#6b7280;">Preferred time</td><td style="padding:10px 0;font-weight:700;">${escapeHtml(preferredTime)}</td></tr><tr><td style="padding:10px 0;color:#6b7280;">Source</td><td style="padding:10px 0;font-weight:700;">React landing page</td></tr></table></div></body></html>`;
    const sent = await sendEmail({
      to: String(process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_USER || 'order@storebanao.com').split(',').map((value) => value.trim()).filter(Boolean),
      subject: `New demo request from ${name}`,
      html,
      replyTo: process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_USER || undefined
    });
    res.json({ success: !!sent });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }
    const db = await loadDB();
    const user = db.users[email];
    if (!user) {
      return res.status(404).json({ success: false, error: 'Account does not exist' });
    }
    if (!verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }
    const store = db.stores[user.storeSlug];
    const token = generateToken(user);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        storeSlug: user.storeSlug,
        createdAt: user.createdAt
      },
      store: store ? {
        slug: store.slug,
        name: store.name,
        logo: store.logo,
        template: store.template,
        theme: store.theme
      } : null
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/auth/google/profile', async (req, res) => {
  const profile = getPendingGoogleProfile(req);
  if (!profile) return res.status(404).json({ success: false, error: 'No pending Google profile' });
  res.json({ success: true, profile });
});

app.get('/api/store/:slug/auth/google/profile', async (req, res) => {
  const pending = req.session && req.session.googleCustomerAuth && typeof req.session.googleCustomerAuth === 'object' ? req.session.googleCustomerAuth : null;
  const slug = String(req.params.slug || '').trim();
  if (!pending || pending.storeSlug !== slug) return res.status(404).json({ success: false, error: 'No pending Google customer profile' });
  res.json({ success: true, profile: { email: pending.email, name: pending.name || pending.email, slug } });
});

app.post('/api/auth/google/login', async (req, res) => {
  try {
    const profile = getPendingGoogleProfile(req);
    if (!profile) return res.status(404).json({ success: false, error: 'No pending Google profile' });
    const db = await loadDB();
    const user = db.users[profile.email];
    if (!user || !user.storeSlug || !db.stores[user.storeSlug]) return res.status(404).json({ success: false, error: 'Google account is not linked to a store yet' });
    const store = db.stores[user.storeSlug];
    delete req.session.googleAuth;
    res.json({ success: true, token: generateToken(user), user: { id: user.id, email: user.email, name: user.name, phone: user.phone, storeSlug: user.storeSlug, createdAt: user.createdAt }, store: { slug: store.slug, name: store.name, logo: store.logo, template: store.template, theme: store.theme } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/store/:slug/auth/google/login', async (req, res) => {
  try {
    const pending = req.session && req.session.googleCustomerAuth && typeof req.session.googleCustomerAuth === 'object' ? req.session.googleCustomerAuth : null;
    const slug = String(req.params.slug || '').trim();
    if (!pending || pending.storeSlug !== slug) return res.status(404).json({ success: false, error: 'No pending Google customer login' });
    const db = await loadDB();
    const store = getApiStore(db, slug);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const customer = store.customers && store.customers[pending.email] ? store.customers[pending.email] : null;
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });
    delete req.session.googleCustomerAuth;
    res.json({ success: true, token: generateCustomerToken(customer, slug), customer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/auth/google/complete', async (req, res) => {
  try {
    const profile = getPendingGoogleProfile(req) || decodeGoogleSignupToken(req.body.signupToken);
    if (!profile) return res.status(404).json({ success: false, error: 'No pending Google profile' });
    const storeName = String(req.body.storeName || '').trim();
    const description = String(req.body.description || '').trim();
    const templateId = String(req.body.templateId || '').trim() || 'app-style';
    if (!storeName || !description) return res.status(400).json({ success: false, error: 'Store name and description required' });
    const db = await loadDB();
    if (db.users[profile.email]) return res.status(400).json({ success: false, error: 'Email already registered' });
    let slug = slugify(storeName);
    while (db.stores[slug]) slug = `${slugify(storeName)}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const createdAt = new Date().toISOString();
    db.users[profile.email] = { id: profile.email, email: profile.email, name: profile.name, phone: String(req.body.phone || req.body.whatsapp || '').trim(), passwordHash: '', storeSlug: slug, createdAt, authProvider: 'google', emailVerified: true };
    db.stores[slug] = buildStoreFromSignupPayload({ ...req.body, storeName, description, templateId, email: profile.email, name: profile.name }, slug, profile.email, createdAt);
    await saveDB(db);
    delete req.session.googleAuth;
    res.json({ success: true, token: generateToken(db.users[profile.email]), user: { id: profile.email, email: profile.email, name: profile.name, storeSlug: slug }, store: { slug, name: storeName } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const phone = String(req.body.phone || '').trim();
    const storeName = String(req.body.storeName || '').trim();
    const description = String(req.body.description || '').trim();
    const templateId = String(req.body.templateId || '').trim();
    if (!name || !email || !password || !storeName || !description) {
      return res.status(400).json({ success: false, error: 'All fields required' });
    }
    const db = await loadDB();
    if (db.users[email]) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }
    let slug = slugify(storeName);
    while (db.stores[slug]) {
      slug = `${slugify(storeName)}-${Math.floor(Math.random() * 9000 + 1000)}`;
    }
    const passwordHash = hashPassword(password);
    const createdAt = new Date().toISOString();
    db.users[email] = {
      id: email,
      email,
      name,
      phone: phone || '',
      passwordHash,
      storeSlug: slug,
      createdAt
    };
    db.stores[slug] = buildStoreFromSignupPayload({ ...req.body, storeName, description, templateId, email, phone, name }, slug, email, createdAt);
    await saveDB(db);
    const token = generateToken(db.users[email]);
    res.json({
      success: true,
      token,
      user: {
        id: email,
        email,
        name,
        storeSlug: slug
      },
      store: {
        slug,
        name: storeName
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/auth/me', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.apiUserEmail];
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const store = db.stores[user.storeSlug];
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        storeSlug: user.storeSlug,
        createdAt: user.createdAt
      },
      store: store || null
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/store/:slug', async (req, res) => {
  try {
    const db = await loadDB();
    const store = db.stores[req.params.slug];
    if (!store) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }
    store.visits = (parseInt(store.visits, 10) || 0) + 1;
    const initialProducts = (store.products || [])
      .filter((product) => product.active !== false)
      .slice(0, 12);
    res.json({
      success: true,
      store: {
        slug: store.slug,
        name: store.name,
        description: store.description,
        logo: store.logo,
        whatsapp: store.whatsapp,
        template: store.template,
        theme: store.theme,
        themeConfig: store.themeConfig,
        storeSettings: store.storeSettings,
        paymentSettings: store.paymentSettings || {},
        categories: store.categories || [],
        collections: store.collections || [],
        initialProducts,
        totalProducts: (store.products || []).filter((product) => product.active !== false).length,
        visits: store.visits,
        createdAt: store.createdAt
      }
    });
    saveDB(db).catch((error) => {
      console.error('[Store] Failed to persist visit count.', error && error.message ? error.message : error);
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/store/:slug/products', async (req, res) => {
  try {
    const db = await loadDB();
    const store = db.stores[req.params.slug];
    if (!store) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }
    const search = String(req.query.search || '').trim().toLowerCase();
    const category = String(req.query.category || '').trim();
    const sort = String(req.query.sort || '').trim();
    const page = String(req.query.page || '').trim();
    let products = (store.products || []).filter((product) => product.active !== false);
    if (search) {
      products = products.filter((product) => String(product.name || '').toLowerCase().includes(search) || String(product.description || '').toLowerCase().includes(search));
    }
    if (category && category !== 'all') {
      const cats = store.categories || [];
      products = products.filter((product) => {
        const matchesByName = String(product.category || '').trim().toLowerCase() === category.trim().toLowerCase();
        const matchesByRelation = cats.some((item) => item.name === category && (item.productIds || []).includes(product.id));
        return matchesByName || matchesByRelation;
      });
    }
    if (sort === 'price_asc') products.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    else if (sort === 'price_desc') products.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    else if (sort === 'newest') products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const perPage = 12;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const total = products.length;
    const totalPages = Math.ceil(total / perPage);
    const paged = products.slice((pageNum - 1) * perPage, pageNum * perPage);
    res.json({ success: true, products: paged, total, page: pageNum, totalPages, perPage });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/store/:slug/product/:id', async (req, res) => {
  try {
    const db = await loadDB();
    const store = db.stores[req.params.slug];
    if (!store) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }
    const product = (store.products || []).find((item) => item.id === req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    const related = (store.products || []).filter((item) => item.id !== product.id && item.active !== false).slice(0, 4);
    res.json({ success: true, product, related });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/dashboard', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.apiUserEmail];
    const store = user ? db.stores[user.storeSlug] : null;
    if (!store) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }
    const revenue = (store.orders || []).filter((order) => ['confirmed', 'delivered'].includes(order.status)).reduce((sum, order) => sum + parseFloat(order.amount || 0), 0);
    const todayOrders = (store.orders || []).filter((order) => new Date(order.createdAt).toDateString() === new Date().toDateString()).length;
    const pendingOrders = (store.orders || []).filter((order) => order.status === 'pending').length;
    res.json({
      success: true,
      store: { slug: store.slug, name: store.name, logo: store.logo, visits: store.visits },
      stats: {
        totalProducts: (store.products || []).length,
        totalOrders: (store.orders || []).length,
        totalRevenue: revenue,
        totalCustomers: Object.keys(store.customers || {}).length,
        todayOrders,
        pendingOrders
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/dashboard/products', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.apiUserEmail];
    const store = user ? db.stores[user.storeSlug] : null;
    if (!store) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }
    res.json({ success: true, products: store.products || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/dashboard/orders', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.apiUserEmail];
    const store = user ? db.stores[user.storeSlug] : null;
    if (!store) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }
    const orders = [...(store.orders || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/dashboard/orders/:id/status', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.apiUserEmail];
    const store = user ? db.stores[user.storeSlug] : null;
    if (!store) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }
    const order = (store.orders || []).find((item) => item.id === req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    order.status = String(req.body.status || '').trim();
    order.trackingHistory = [
      ...(order.trackingHistory || []),
      { status: order.status, at: new Date().toISOString() }
    ];
    await saveDB(db);
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/dashboard/orders/export', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const orders = [...(store.orders || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const csvRows = ['Order#,Date,Customer,Phone,Email,Items,Amount,Status,Address'];
    orders.forEach((order) => {
      const items = Array.isArray(order.items) ? order.items.map((item) => `${item.name} x${item.quantity}`).join('; ') : order.productName;
      csvRows.push([
        `"${order.orderNumber || order.id}"`,
        `"${order.createdAt || ''}"`,
        `"${String(order.customerName || '').replace(/"/g, '""')}"`,
        `"${order.customerPhone || ''}"`,
        `"${order.customerEmail || ''}"`,
        `"${String(items || '').replace(/"/g, '""')}"`,
        `"${String(order.amount || '')}"`,
        `"${order.status || ''}"`,
        `"${String(order.shippingAddress || '').replace(/"/g, '""')}"`
      ].join(','));
    });
    res.type('text/csv');
    res.send(csvRows.join('\n'));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/dashboard/customers', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const user = db.users[req.apiUserEmail];
    const store = user ? db.stores[user.storeSlug] : null;
    if (!store) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }
    res.json({ success: true, customers: Object.values(store.customers || {}) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/dashboard/system-status', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    res.json({
      success: true,
      status: getDBStatus(),
      store: {
        slug: store.slug,
        products: (store.products || []).length,
        orders: (store.orders || []).length,
        visits: store.visits || 0,
        createdAt: store.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/dashboard/analytics', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const revenue = (store.orders || []).filter((order) => ['confirmed', 'delivered'].includes(order.status)).reduce((sum, order) => sum + Number(order.amount || 0), 0);
    const breakdown = ORDER_STATUSES.reduce((acc, status) => {
      acc[status] = (store.orders || []).filter((order) => order.status === status).length;
      return acc;
    }, {});
    const last7Days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const dateStr = day.toDateString();
      const dayOrders = (store.orders || []).filter((order) => new Date(order.createdAt).toDateString() === dateStr);
      last7Days.push({
        label: day.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        orders: dayOrders.length,
        revenue: dayOrders.filter((order) => ['confirmed', 'delivered'].includes(order.status)).reduce((sum, order) => sum + Number(order.amount || 0), 0)
      });
    }
    res.json({ success: true, visits: store.visits || 0, revenue, products: (store.products || []).length, orders: (store.orders || []).length, breakdown, last7Days });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/dashboard/store/profile', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    store.name = String(req.body.name || store.name || '').trim();
    store.description = String(req.body.description || store.description || '').trim();
    store.whatsapp = sanitizePhone(req.body.whatsapp || store.whatsapp || '');
    if (['default', 'dark'].includes(String(req.body.theme || ''))) store.theme = String(req.body.theme);
    if (typeof req.body.logo === 'string') store.logo = String(req.body.logo || '').trim();
    await saveDB(db);
    res.json({ success: true, store });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/dashboard/store-settings', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    store.storeSettings = Object.assign({}, store.storeSettings || {}, req.body || {});
    await saveDB(db);
    res.json({ success: true, storeSettings: store.storeSettings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/dashboard/display-settings', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    store.themeConfig = Object.assign({}, store.themeConfig || {}, req.body || {});
    await saveDB(db);
    res.json({ success: true, themeConfig: store.themeConfig });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/dashboard/theme', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const templateId = String(req.body.template || '').trim();
    if (!templateId) return res.status(400).json({ success: false, error: 'Template required' });
    store.template = templateId;
    await saveDB(db);
    res.json({ success: true, template: templateId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/dashboard/media', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const themeConfig = store.themeConfig || {};
    const images = [
      store.logo,
      ...(store.products || []).flatMap((product) => [product.image].concat(Array.isArray(product.images) ? product.images : [])),
      ...(store.categories || []).map((category) => category.image),
      ...(Array.isArray(themeConfig.bannerImages) ? themeConfig.bannerImages : []),
      ...(Array.isArray(themeConfig.bannerImagesMobile) ? themeConfig.bannerImagesMobile : [])
    ].filter(Boolean);
    res.json({ success: true, images: Array.from(new Set(images)) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/dashboard/upload/logo', requireApiAuth, async (req, res) => {
  try {
    await runUploader(upload.single('file'), req, res);
    if (!req.file) return res.status(400).json({ success: false, error: 'Please choose a logo file' });
    const scope = await getVendorStoreOr404(req, res);
    if (!scope) return;
    const { db, store } = scope;
    const nextLogo = await saveUploadedFile(req.file, 'logo');
    await removeStoredFile(store.logo);
    store.logo = nextLogo;
    await saveDB(db);
    res.json({ success: true, url: nextLogo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/dashboard/upload/favicon', requireApiAuth, async (req, res) => {
  try {
    await runUploader(upload.single('file'), req, res);
    if (!req.file) return res.status(400).json({ success: false, error: 'Please choose a favicon file' });
    const scope = await getVendorStoreOr404(req, res);
    if (!scope) return;
    const { db, store } = scope;
    store.storeSettings = store.storeSettings && typeof store.storeSettings === 'object' ? store.storeSettings : {};
    store.storeSettings.storeDetails = store.storeSettings.storeDetails && typeof store.storeSettings.storeDetails === 'object' ? store.storeSettings.storeDetails : {};
    const nextFavicon = await saveUploadedFile(req.file, 'logo');
    await removeStoredFile(store.storeSettings.storeDetails.favicon);
    store.storeSettings.storeDetails.favicon = nextFavicon;
    await saveDB(db);
    res.json({ success: true, url: nextFavicon });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/dashboard/upload/product-image', requireApiAuth, async (req, res) => {
  try {
    await runUploader(upload.single('file'), req, res);
    if (!req.file) return res.status(400).json({ success: false, error: 'Please choose an image file' });
    const imageUrl = await saveUploadedFile(req.file, 'product');
    res.json({ success: true, url: imageUrl });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/dashboard/upload/category-image', requireApiAuth, async (req, res) => {
  try {
    await runUploader(upload.single('file'), req, res);
    if (!req.file) return res.status(400).json({ success: false, error: 'Please choose an image file' });
    const imageUrl = await saveUploadedFile(req.file, 'category');
    res.json({ success: true, url: imageUrl });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/dashboard/upload/banner', requireApiAuth, async (req, res) => {
  try {
    await runUploader(upload.single('file'), req, res);
    if (!req.file) return res.status(400).json({ success: false, error: 'Please choose a banner image' });
    const mobile = String(req.query.mobile || '').trim() === 'true';
    const scope = await getVendorStoreOr404(req, res);
    if (!scope) return;
    const { db, store } = scope;
    store.themeConfig = store.themeConfig && typeof store.themeConfig === 'object' ? store.themeConfig : {};
    const key = mobile ? 'bannerImagesMobile' : 'bannerImages';
    store.themeConfig[key] = Array.isArray(store.themeConfig[key]) ? store.themeConfig[key] : [];
    const imageUrl = await saveUploadedFile(req.file, 'banner');
    store.themeConfig[key].push(imageUrl);
    await saveDB(db);
    res.json({ success: true, url: imageUrl, images: store.themeConfig[key] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/dashboard/upload/banner/:index', requireApiAuth, async (req, res) => {
  try {
    const mobile = String(req.query.mobile || '').trim() === 'true';
    const index = Number(req.params.index);
    const scope = await getVendorStoreOr404(req, res);
    if (!scope) return;
    const { db, store } = scope;
    store.themeConfig = store.themeConfig && typeof store.themeConfig === 'object' ? store.themeConfig : {};
    const key = mobile ? 'bannerImagesMobile' : 'bannerImages';
    store.themeConfig[key] = Array.isArray(store.themeConfig[key]) ? store.themeConfig[key] : [];
    if (Number.isInteger(index) && index >= 0 && index < store.themeConfig[key].length) {
      await removeStoredFile(store.themeConfig[key][index]);
      store.themeConfig[key].splice(index, 1);
      await saveDB(db);
    }
    res.json({ success: true, images: store.themeConfig[key] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/dashboard/leads', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const leads = (store.orders || []).filter((order) => order.customerName === 'WhatsApp lead' || !order.customerPhone);
    res.json({ success: true, leads });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/dashboard/abandoned-carts', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    res.json({ success: true, abandonedCarts: Array.isArray(store.abandonedCarts) ? store.abandonedCarts : [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/dashboard/collections', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    res.json({ success: true, collections: Array.isArray(store.collections) ? store.collections : [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/dashboard/collections', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    if (name.length < 2) return res.status(400).json({ success: false, error: 'Collection name is required' });
    store.collections = Array.isArray(store.collections) ? store.collections : [];
    const collection = { id: generateId('col'), name, description, createdAt: new Date().toISOString() };
    store.collections.push(collection);
    await saveDB(db);
    res.json({ success: true, collection });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/dashboard/collections/:id', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    store.collections = Array.isArray(store.collections) ? store.collections : [];
    const index = store.collections.findIndex((entry) => entry.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Collection not found' });
    const collection = store.collections.splice(index, 1)[0];
    await saveDB(db);
    res.json({ success: true, collection });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/dashboard/categories', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    res.json({ success: true, categories: Array.isArray(store.categories) ? store.categories : [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/dashboard/categories', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    const image = String(req.body.image || '').trim();
    if (name.length < 2) return res.status(400).json({ success: false, error: 'Category name is required' });
    store.categories = Array.isArray(store.categories) ? store.categories : [];
    const category = { id: generateId('cat'), name, description, image, createdAt: new Date().toISOString() };
    store.categories.push(category);
    await saveDB(db);
    res.json({ success: true, category });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/dashboard/categories/:id', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    store.categories = Array.isArray(store.categories) ? store.categories : [];
    const index = store.categories.findIndex((entry) => entry.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Category not found' });
    const category = store.categories.splice(index, 1)[0];
    await saveDB(db);
    res.json({ success: true, category });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/dashboard/coupons', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    res.json({ success: true, discounts: Array.isArray(store.discounts) ? store.discounts : [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/dashboard/coupons', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const code = String(req.body.code || '').trim().toUpperCase();
    const value = String(req.body.value || '').trim();
    const type = String(req.body.type || 'percent').trim();
    const active = req.body.active !== false;
    if (code.length < 3) return res.status(400).json({ success: false, error: 'Discount code is required' });
    store.discounts = Array.isArray(store.discounts) ? store.discounts : [];
    const discount = { id: generateId('disc'), code, value, type, active, createdAt: new Date().toISOString() };
    store.discounts.push(discount);
    await saveDB(db);
    res.json({ success: true, discount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/dashboard/coupons/:id', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    store.discounts = Array.isArray(store.discounts) ? store.discounts : [];
    const index = store.discounts.findIndex((entry) => entry.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Coupon not found' });
    const discount = store.discounts.splice(index, 1)[0];
    await saveDB(db);
    res.json({ success: true, discount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/dashboard/shipping', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    store.shipping = { mode: String(req.body.mode || 'flat'), fee: String(req.body.fee || '').trim(), notes: String(req.body.notes || '').trim() };
    await saveDB(db);
    res.json({ success: true, shipping: store.shipping });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/dashboard/payments', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    store.paymentSettings = { mode: String(req.body.mode || 'whatsapp'), notes: String(req.body.notes || '').trim() };
    store.storeSettings = store.storeSettings && typeof store.storeSettings === 'object' ? store.storeSettings : {};
    store.storeSettings.paymentSettings = Object.assign({}, store.storeSettings.paymentSettings || {}, {
      cod: store.paymentSettings.mode === 'cod' || store.paymentSettings.mode === 'both',
      onlinePayment: store.paymentSettings.mode === 'online' || store.paymentSettings.mode === 'both',
      whatsappOrder: store.paymentSettings.mode === 'whatsapp' || store.paymentSettings.mode === 'both',
      bankDetails: store.paymentSettings.notes
    });
    await saveDB(db);
    res.json({ success: true, paymentSettings: store.paymentSettings, storeSettings: store.storeSettings.paymentSettings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/dashboard/notifications', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    store.notifications = Object.assign({}, store.notifications || {}, req.body || {});
    await saveDB(db);
    res.json({ success: true, notifications: store.notifications });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/dashboard/tax', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    store.taxSettings = { enabled: !!req.body.enabled, name: String(req.body.name || 'GST').trim(), rate: String(req.body.rate || '0').trim(), inclusive: !!req.body.inclusive };
    await saveDB(db);
    res.json({ success: true, taxSettings: store.taxSettings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/dashboard/whatsapp-marketing', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    store.whatsappMarketing = { welcome: String(req.body.welcome || '').trim(), recovery: String(req.body.recovery || '').trim(), promo: String(req.body.promo || '').trim() };
    await saveDB(db);
    res.json({ success: true, whatsappMarketing: store.whatsappMarketing });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/dashboard/tracking', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    store.tracking = { pixel: String(req.body.pixel || '').trim(), google: String(req.body.google || '').trim() };
    store.apps = normalizeStoreApps(store.apps);
    store.apps.metaPixel.pixelId = store.tracking.pixel;
    store.apps.metaPixel.installed = !!store.tracking.pixel;
    store.apps.metaPixel.configured = !!store.tracking.pixel;
    store.apps.googleAnalytics.gaId = store.tracking.google;
    store.apps.googleAnalytics.installed = !!store.tracking.google;
    store.apps.googleAnalytics.configured = !!store.tracking.google;
    await saveDB(db);
    res.json({ success: true, tracking: store.tracking });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/dashboard/apps', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    store.apps = normalizeStoreApps(store.apps);
    res.json({ success: true, catalog: getAppCatalog(), apps: store.apps, tracking: store.tracking || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/dashboard/apps/:id/toggle', requireApiAuth, async (req, res) => {
  try {
    const appId = String(req.params.id || '').trim();
    const appDefinition = getAppDefinition(appId);
    if (!appDefinition) return res.status(404).json({ success: false, error: 'App not found' });
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    store.apps = normalizeStoreApps(store.apps);
    store.apps[appId].installed = !store.apps[appId].installed;
    if (!store.apps[appId].installed) store.apps[appId].configured = false;
    await saveDB(db);
    res.json({ success: true, app: store.apps[appId] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/dashboard/apps/:id', requireApiAuth, async (req, res) => {
  try {
    const appId = String(req.params.id || '').trim();
    const appDefinition = getAppDefinition(appId);
    if (!appDefinition) return res.status(404).json({ success: false, error: 'App not found' });
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    store.apps = normalizeStoreApps(store.apps);
    const target = Object.assign({}, store.apps[appId], req.body || {});
    if (appId === 'salesPopup') {
      target.intervalSeconds = Math.max(4, Math.min(30, Number(target.intervalSeconds || 8) || 8));
      target.enabled = target.enabled === true;
      target.showHome = target.showHome !== false;
      target.showProduct = target.showProduct !== false;
    }
    if (appId === 'smtp') {
      target.port = Math.max(1, Number(target.port || 587) || 587);
      target.secure = target.secure === true;
    }
    target.installed = true;
    target.configured = appConfigured(appId, target);
    store.apps[appId] = target;
    await saveDB(db);
    res.json({ success: true, app: target });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/dashboard/domain', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    store.domain = { customDomain: String(req.body.customDomain || '').trim(), subdomain: String(req.body.subdomain || '').trim() };
    await saveDB(db);
    res.json({ success: true, domain: store.domain });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/dashboard/bulk-upload/template', requireApiAuth, async (req, res) => {
  res.type('text/csv');
  res.send('name,price,comparePrice,description,stock,image,sku,category,active\nSample Product,499,799,Demo description,10,https://example.com/sample.webp,SKU-001,General,true\n');
});

app.get('/api/dashboard/bulk-upload/export', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const rows = ['name,price,comparePrice,description,stock,image,sku,category,active'];
    (store.products || []).forEach((product) => {
      rows.push([product.name, product.price, product.comparePrice || product.mrp || '', product.description, product.stock, product.image || '', product.sku || '', product.category || '', product.active !== false].map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(','));
    });
    res.type('text/csv');
    res.send(rows.join('\n'));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/dashboard/bulk-upload/import', requireApiAuth, async (req, res) => {
  try {
    const csvText = String(req.body.csvText || '').trim();
    if (!csvText) return res.status(400).json({ success: false, error: 'CSV data required' });
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return res.status(400).json({ success: false, error: 'CSV must include header and data rows' });
    const headers = parseCsvLine(lines.shift()).map((cell) => cell.trim().toLowerCase());
    let imported = 0;
    store.products = Array.isArray(store.products) ? store.products : [];
    lines.forEach((line) => {
      const cells = parseCsvLine(line);
      const row = {};
      headers.forEach((header, index) => { row[header] = (cells[index] || '').trim(); });
      if (String(row.name || '').trim()) {
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
        imported += 1;
      }
    });
    await saveDB(db);
    res.json({ success: true, imported });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/dashboard/bulk-upload/import-file', requireApiAuth, async (req, res) => {
  try {
    await runUploader(csvUpload.single('file'), req, res);
    if (!req.file || !req.file.buffer) return res.status(400).json({ success: false, error: 'CSV file required' });
    req.body.csvText = req.file.buffer.toString('utf8');
    const db = await loadDB();
    const store = getVendorStoreFromReq(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const lines = req.body.csvText.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return res.status(400).json({ success: false, error: 'CSV must include header and data rows' });
    const headers = parseCsvLine(lines.shift()).map((cell) => cell.trim().toLowerCase());
    let imported = 0;
    store.products = Array.isArray(store.products) ? store.products : [];
    lines.forEach((line) => {
      const cells = parseCsvLine(line);
      const row = {};
      headers.forEach((header, index) => { row[header] = (cells[index] || '').trim(); });
      if (String(row.name || '').trim()) {
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
        imported += 1;
      }
    });
    await saveDB(db);
    res.json({ success: true, imported });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/store/:slug/auth/register', async (req, res) => {
  try {
    const db = await loadDB();
    const slug = String(req.params.slug || '').trim();
    const store = getApiStore(db, slug);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = sanitizePhone(req.body.phone || '');
    const password = String(req.body.password || '');
    if (!name || !validateEmail(email) || phone.length < 10 || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Please fill all fields correctly' });
    }
    store.customers = store.customers && typeof store.customers === 'object' ? store.customers : {};
    if (store.customers[email]) {
      return res.status(400).json({ success: false, error: 'Account already exists' });
    }
    const createdAt = new Date().toISOString();
    const customer = {
      id: `${slug}:${email}`,
      email,
      name,
      phone,
      passwordHash: hashPassword(password),
      orders: [],
      wishlist: [],
      createdAt,
      addresses: []
    };
    store.customers[email] = customer;
    await saveDB(db);
    res.json({ success: true, token: generateCustomerToken(customer, slug), customer: { id: customer.id, email, name, phone, createdAt } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/store/:slug/auth/login', async (req, res) => {
  try {
    const db = await loadDB();
    const slug = String(req.params.slug || '').trim();
    const store = getApiStore(db, slug);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const customer = store.customers && store.customers[email];
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Account does not exist' });
    }
    if (!verifyPassword(password, customer.passwordHash)) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }
    res.json({ success: true, token: generateCustomerToken(customer, slug), customer: { id: customer.id, email: customer.email, name: customer.name, phone: customer.phone, addresses: customer.addresses || [], wishlist: customer.wishlist || [], orders: customer.orders || [] } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/store/:slug/auth/me', requireApiCustomer, async (req, res) => {
  try {
    const db = await loadDB();
    const slug = String(req.params.slug || '').trim();
    if (req.apiCustomerStoreSlug !== slug) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const store = getApiStore(db, slug);
    const customer = store && store.customers ? store.customers[req.apiCustomerEmail] : null;
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });
    res.json({ success: true, customer: { id: customer.id, email: customer.email, name: customer.name, phone: customer.phone, addresses: customer.addresses || [], wishlist: customer.wishlist || [], orders: customer.orders || [] } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/store/:slug/account/orders', requireApiCustomer, async (req, res) => {
  try {
    const db = await loadDB();
    const slug = String(req.params.slug || '').trim();
    if (req.apiCustomerStoreSlug !== slug) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const store = getApiStore(db, slug);
    const customer = store && store.customers ? store.customers[req.apiCustomerEmail] : null;
    if (!store || !customer) return res.status(404).json({ success: false, error: 'Customer not found' });
    const orderIds = new Set(Array.isArray(customer.orders) ? customer.orders : []);
    const orders = (store.orders || []).filter((order) => order.customerEmail === customer.email || orderIds.has(order.id)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/store/:slug/account/wishlist', requireApiCustomer, async (req, res) => {
  try {
    const db = await loadDB();
    const slug = String(req.params.slug || '').trim();
    if (req.apiCustomerStoreSlug !== slug) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const store = getApiStore(db, slug);
    const customer = store && store.customers ? store.customers[req.apiCustomerEmail] : null;
    if (!store || !customer) return res.status(404).json({ success: false, error: 'Customer not found' });
    const ids = new Set(Array.isArray(customer.wishlist) ? customer.wishlist : []);
    const products = (store.products || []).filter((product) => ids.has(product.id));
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/store/:slug/wishlist/toggle/:id', requireApiCustomer, async (req, res) => {
  try {
    const db = await loadDB();
    const slug = String(req.params.slug || '').trim();
    if (req.apiCustomerStoreSlug !== slug) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const store = getApiStore(db, slug);
    const customer = store && store.customers ? store.customers[req.apiCustomerEmail] : null;
    const product = store ? (store.products || []).find((entry) => entry.id === req.params.id) : null;
    if (!store || !customer || !product) return res.status(404).json({ success: false, error: 'Resource not found' });
    customer.wishlist = Array.isArray(customer.wishlist) ? customer.wishlist : [];
    const exists = customer.wishlist.includes(product.id);
    customer.wishlist = exists ? customer.wishlist.filter((id) => id !== product.id) : customer.wishlist.concat(product.id);
    await saveDB(db);
    res.json({ success: true, wishlist: customer.wishlist, wished: !exists });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/store/:slug/product/:id/review', async (req, res) => {
  try {
    const db = await loadDB();
    const slug = String(req.params.slug || '').trim();
    const store = getApiStore(db, slug);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const product = (store.products || []).find((entry) => entry.id === req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    const name = String(req.body.reviewName || '').trim().slice(0, 60);
    const comment = String(req.body.comment || '').trim().slice(0, 500);
    const rating = Math.min(5, Math.max(1, Number(req.body.rating || 5)));
    if (!name || !comment) return res.status(400).json({ success: false, error: 'Please fill review details' });
    product.reviews = Array.isArray(product.reviews) ? product.reviews : [];
    const review = { id: generateId('rev'), customerName: name, rating, comment, createdAt: new Date().toISOString() };
    product.reviews.push(review);
    await saveDB(db);
    res.json({ success: true, review });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/store/:slug/checkout', async (req, res) => {
  try {
    const db = await loadDB();
    const slug = String(req.params.slug || '').trim();
    const store = getApiStore(db, slug);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const name = String(req.body.name || '').trim();
    const phone = sanitizePhone(req.body.phone || '');
    const email = String(req.body.email || '').trim().toLowerCase();
    const shippingAddress = String(req.body.shippingAddress || '').trim();
    const notes = String(req.body.notes || '').trim();
    const couponCode = String(req.body.couponCode || '').trim().toUpperCase();
    const paymentMethod = ['cod', 'online', 'whatsapp'].includes(String(req.body.paymentMethod || '').trim()) ? String(req.body.paymentMethod || '').trim() : 'cod';
    const unifiedPaymentSettings = Object.assign({}, (store.storeSettings && store.storeSettings.paymentSettings) || {}, store.paymentSettings || {});
    const allowedModes = [];
    if (unifiedPaymentSettings.cod || unifiedPaymentSettings.mode === 'cod' || unifiedPaymentSettings.mode === 'both') allowedModes.push('cod');
    if (unifiedPaymentSettings.onlinePayment || unifiedPaymentSettings.mode === 'online' || unifiedPaymentSettings.mode === 'both') allowedModes.push('online');
    if (unifiedPaymentSettings.whatsappOrder || unifiedPaymentSettings.mode === 'whatsapp' || unifiedPaymentSettings.mode === 'both') allowedModes.push('whatsapp');
    const effectiveAllowedModes = allowedModes.length ? Array.from(new Set(allowedModes)) : ['cod', 'online', 'whatsapp'];
    if (!effectiveAllowedModes.includes(paymentMethod)) {
      return res.status(400).json({ success: false, error: 'Selected payment method is not available' });
    }
    const lineItems = buildApiCheckoutLineItems(store, req.body.items);
    if (!name || !validateEmail(email) || phone.length < 10 || !shippingAddress || !lineItems.length) {
      return res.status(400).json({ success: false, error: 'Invalid checkout data' });
    }
    const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
    const discounts = Array.isArray(store.discounts) ? store.discounts : [];
    const coupon = couponCode ? discounts.find((entry) => entry.active !== false && String(entry.code || '').trim().toUpperCase() === couponCode) : null;
    let discountAmount = 0;
    if (coupon) {
      if (String(coupon.type || '').trim() === 'flat') {
        discountAmount = Math.min(subtotal, Number(coupon.value || 0));
      } else {
        discountAmount = Math.min(subtotal, subtotal * (Math.max(0, Number(coupon.value || 0)) / 100));
      }
    }
    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    const shippingFee = getEffectiveShippingFee(store, subtotal);
    const taxRate = store.taxSettings && store.taxSettings.enabled ? Number(store.taxSettings.rate || 0) : 0;
    const taxAmount = store.taxSettings && store.taxSettings.enabled ? discountedSubtotal * (taxRate / 100) : 0;
    const checkoutSettings = store.storeSettings && store.storeSettings.checkoutSettings ? store.storeSettings.checkoutSettings : null;
    const minimumOrderAmount = checkoutSettings ? Number(checkoutSettings.minimumOrderAmount || 0) : 0;
    if (minimumOrderAmount > 0 && discountedSubtotal < minimumOrderAmount) {
      return res.status(400).json({ success: false, error: `Minimum order amount is ${minimumOrderAmount}` });
    }
    const total = applyRoundingMode(discountedSubtotal + shippingFee + taxAmount, checkoutSettings ? checkoutSettings.roundingMode : 'none');
    const createdAt = new Date().toISOString();
    const trackingCode = generateTrackingCode();
    const order = {
      id: generateId('ord'),
      storeSlug: slug,
      vendorId: store.ownerId || '',
      orderNumber: generateOrderNumber(store),
      trackingCode,
      productId: lineItems[0].product.id,
      productName: lineItems.map((item) => item.product.name).join(', '),
      items: lineItems.map((item) => ({ productId: item.product.id, name: item.product.name, price: item.price, quantity: item.quantity, variantSummary: item.variantSummary || '', sku: item.sku || item.product.sku || '' })),
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
      shippingAddress,
      notes,
      paymentMethod,
      paymentMode: paymentMethod,
      status: paymentMethod === 'cod' ? 'confirmed' : 'pending',
      amount: String(total),
      subtotal: String(subtotal),
      discountCode: coupon ? coupon.code : '',
      discountAmount: String(discountAmount),
      shippingFee: String(shippingFee),
      taxAmount: String(taxAmount),
      createdAt,
      trackingHistory: [{ status: paymentMethod === 'cod' ? 'confirmed' : 'placed', at: createdAt }]
    };
    store.orders = Array.isArray(store.orders) ? store.orders : [];
    store.orders.push(order);
    store.customers = store.customers && typeof store.customers === 'object' ? store.customers : {};
    if (!store.customers[email]) {
      store.customers[email] = { id: `${slug}:${email}`, email, name, phone, passwordHash: '', orders: [], wishlist: [], createdAt, addresses: [shippingAddress] };
    }
    const customer = store.customers[email];
    customer.name = name;
    customer.phone = phone;
    customer.orders = Array.isArray(customer.orders) ? customer.orders : [];
    customer.orders.push(order.id);
    customer.addresses = Array.isArray(customer.addresses) ? customer.addresses : [];
    if (!customer.addresses.includes(shippingAddress)) customer.addresses.unshift(shippingAddress);
    lineItems.forEach((item) => {
      const product = (store.products || []).find((entry) => entry.id === item.product.id);
      if (product) product.stock = Math.max(0, (parseInt(product.stock, 10) || 0) - item.quantity);
    });
    if (paymentMethod === 'online') {
      const razorpayConfig = getRazorpayConfig(store);
      if (razorpayConfig) {
        const gatewayOrder = await createRazorpayOrder(store, order);
        order.gatewayOrderId = gatewayOrder.id;
        order.gatewayPayload = gatewayOrder;
      }
    }
    await saveDB(db);
    res.json({ success: true, order, token: generateCustomerToken(customer, slug), paymentRedirect: order.gatewayOrderId ? `/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(order.trackingCode)}/pay` : null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/store/:slug/order/:code', async (req, res) => {
  try {
    const db = await loadDB();
    const store = getApiStore(db, req.params.slug);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const code = String(req.params.code || '').trim();
    const order = (store.orders || []).find((item) => item.trackingCode === code || item.orderNumber === code || item.id === code);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/dashboard/products', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const user = getApiUser(db, req.apiUserEmail);
    const store = user ? getApiStore(db, user.storeSlug) : null;
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const payload = sanitizeApiProduct(req.body);
    if (!payload.name || !(payload.price > 0)) return res.status(400).json({ success: false, error: 'Invalid product data' });
    const now = new Date().toISOString();
    const product = { id: generateId('p'), ...payload, mrp: payload.comparePrice || payload.price, reviews: [], createdAt: now, updatedAt: '' };
    store.products = Array.isArray(store.products) ? store.products : [];
    store.products.push(product);
    await saveDB(db);
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/dashboard/products/:id', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const user = getApiUser(db, req.apiUserEmail);
    const store = user ? getApiStore(db, user.storeSlug) : null;
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const product = (store.products || []).find((entry) => entry.id === req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    const payload = sanitizeApiProduct(req.body);
    Object.assign(product, payload, { mrp: payload.comparePrice || payload.price, updatedAt: new Date().toISOString() });
    await saveDB(db);
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/dashboard/products/:id', requireApiAuth, async (req, res) => {
  try {
    const db = await loadDB();
    const user = getApiUser(db, req.apiUserEmail);
    const store = user ? getApiStore(db, user.storeSlug) : null;
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const index = (store.products || []).findIndex((entry) => entry.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Product not found' });
    const removed = store.products.splice(index, 1)[0];
    await saveDB(db);
    res.json({ success: true, product: removed });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/superadmin/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const db = await loadDB();
    if (!db.superAdmin || !db.superAdmin.email || !db.superAdmin.passwordHash) {
      return res.status(503).json({ success: false, error: 'Super admin is not configured on this server' });
    }
    if (!db.superAdmin || email !== String(db.superAdmin.email || '').trim().toLowerCase()) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    const valid = verifyPassword(password, db.superAdmin.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    const token = generateSuperAdminToken();
    res.json({ success: true, token });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/superadmin/dashboard', requireApiSuperAdmin, async (req, res) => {
  try {
    const db = await loadDB();
    const stores = Object.values(db.stores || {});
    const users = Object.values(db.users || {});
    const totalProducts = stores.reduce((sum, store) => sum + ((store.products || []).length), 0);
    const totalOrders = stores.reduce((sum, store) => sum + ((store.orders || []).length), 0);
    const recentStores = stores.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5).map((store) => ({
      slug: store.slug,
      name: store.name,
      ownerEmail: store.ownerId,
      createdAt: store.createdAt
    }));
    res.json({ success: true, stats: { totalStores: stores.length, totalUsers: users.length, totalProducts, totalOrders }, recentStores });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/superadmin/stores', requireApiSuperAdmin, async (req, res) => {
  try {
    const db = await loadDB();
    const stores = Object.values(db.stores || {}).map((store) => ({
      slug: store.slug,
      name: store.name,
      logo: store.logo,
      ownerId: store.ownerId,
      productsCount: (store.products || []).length,
      ordersCount: (store.orders || []).length,
      visits: store.visits,
      createdAt: store.createdAt
    }));
    res.json({ success: true, stores });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/superadmin/users', requireApiSuperAdmin, async (req, res) => {
  try {
    const db = await loadDB();
    const users = Object.values(db.users || {}).map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      storeSlug: user.storeSlug,
      createdAt: user.createdAt
    }));
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/superadmin/store/:slug', requireApiSuperAdmin, async (req, res) => {
  try {
    const db = await loadDB();
    const store = getApiStore(db, req.params.slug);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const owner = getApiUser(db, store.ownerId);
    res.json({
      success: true,
      store: {
        slug: store.slug,
        name: store.name,
        description: store.description,
        logo: store.logo,
        whatsapp: store.whatsapp,
        visits: store.visits,
        createdAt: store.createdAt,
        owner: owner ? { id: owner.id, email: owner.email, name: owner.name, phone: owner.phone } : null,
        products: store.products || [],
        orders: store.orders || []
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/migration-status', async (req, res) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      res.status(500).json({ error: 'Supabase not configured.' });
      return;
    }
    const results = {};
    for (const table of ['stores', 'users', 'products', 'orders', 'customers', 'app_config']) {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      results[table] = error ? { error: error.message || 'count_failed' } : (count || 0);
    }
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error && error.message ? error.message : 'migration_status_failed' });
  }
});

// Routes
app.use('/', require('./routes'));

app.get('/app/*', (req, res, next) => {
  const indexFile = path.join(FRONTEND_DIST_DIR, 'index.html');
  if (!fs.existsSync(indexFile)) {
    next();
    return;
  }
  res.sendFile(indexFile);
});

// 404 handler
const { renderGlobalError } = require('./views/error-views');
app.use((req, res) => {
  res.status(404).send(renderGlobalError('Page Not Found', 'The page you requested could not be found.', 404));
});

// Error handler
app.use((error, req, res, next) => {
  try {
    console.error('[ERROR]', req.method, req.originalUrl, error && error.stack ? error.stack : error);
    const message = error && error.message ? error.message : 'Unexpected server error.';
    res.status(500).send(renderGlobalError('Server Error', message, 500));
  } catch (finalError) {
    res.status(500).send('<!DOCTYPE html><html><body><h1>Server Error</h1></body></html>');
  }
});

(async () => {
  await ensureDatabaseReady();
  await migrateFromBlobToTables();
  await ensureSupabaseAuthReady();
  logStartupConfiguration();
  app.listen(PORT, () => {
    console.log(`MyShopBuilder running on port ${PORT}`);
  });
})();
