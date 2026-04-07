const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();
const { loadDB, saveDB, saveUploadedFile, runUploader, removeStoredFile, findMerchantUserByEmail, findStoreCustomerByEmail, saveMerchantAndStoreFast, saveStoreCustomerFast } = require('../services/db');
const { hashPassword, verifyPassword } = require('../services/password');
const { sendPasswordResetEmail, sendPasswordChangedEmail, sendVendorWelcomeEmail, sendCustomerWelcomeEmail, sendVerificationEmail, sendAdminNewUserAlert } = require('../services/email');
const { syncMerchantToSupabaseAuth, syncCustomerToSupabaseAuth } = require('../services/supabase-auth');
const { slugify, escapeHtml, sanitizePhone, generateId } = require('../helpers/html');
const { validateEmail } = require('../helpers/validation');
const { setFlash, renderFlashMessages } = require('../helpers/flash');
const { setLoggedCustomer } = require('../helpers/store-session');
const { renderHtmlShell } = require('../views/shell');
const { route } = require('../middleware/error');
const { upload } = require('../middleware/upload');
const { findStoreByRequestHost } = require('../middleware/subdomain');
const config = require('../config');

const { BASE_DOMAIN } = config;

function normalizeRedirectPath(value, fallback) {
  const candidate = String(value || '').trim();
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return fallback;
  return candidate;
}

function extractStoreSlugFromRedirectPath(value) {
  const match = String(value || '').trim().match(/^\/store\/([^/]+)\/account(?:\/|$)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function getSupabaseAuthStorage(req) {
  req.session.supabaseAuthStorage = req.session.supabaseAuthStorage && typeof req.session.supabaseAuthStorage === 'object'
    ? req.session.supabaseAuthStorage
    : {};
  return {
    getItem(key) {
      return Promise.resolve(Object.prototype.hasOwnProperty.call(req.session.supabaseAuthStorage, key) ? req.session.supabaseAuthStorage[key] : null);
    },
    setItem(key, value) {
      req.session.supabaseAuthStorage[key] = value;
      return Promise.resolve();
    },
    removeItem(key) {
      delete req.session.supabaseAuthStorage[key];
      return Promise.resolve();
    }
  };
}

function getSupabaseAuthClient(req) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'pkce',
      persistSession: true,
      storage: getSupabaseAuthStorage(req)
    }
  });
}

function getBaseUrl(req) {
  return process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

function getFrontendBaseUrl(req) {
  return process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
}

function getSupportPhone() {
  return String(process.env.SUPPORT_WHATSAPP || process.env.SUPPORT_PHONE || '7300628199').replace(/\D/g, '');
}

function getSupportWhatsappUrl(message) {
  const phone = getSupportPhone();
  const text = encodeURIComponent(message || 'Hi, I need help with StoreBanao.');
  return `https://wa.me/91${phone}?text=${text}`;
}

function renderGoogleButton(href) {
  return `<a href="${escapeHtml(href)}" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:12px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;color:#111827;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:16px;transition:all 0.2s;"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>Continue with Google</a>`;
}

function getPendingGoogleProfile(req) {
  if (!req.session.googleAuth || typeof req.session.googleAuth !== 'object') return null;
  const email = String(req.session.googleAuth.email || '').trim().toLowerCase();
  const name = String(req.session.googleAuth.name || '').trim();
  if (!email || !validateEmail(email)) return null;
  return { email, name: name || email };
}

function createVendorHandoffToken(user) {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  return jwt.sign({ userId: user.id, email: user.email, role: 'vendor' }, secret, { expiresIn: '10m' });
}

function createCustomerHandoffToken(customer, slug) {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  return jwt.sign({ customerId: customer.id, email: customer.email, storeSlug: slug, role: 'customer' }, secret, { expiresIn: '10m' });
}

function createEmailVerificationState(verified) {
  if (verified) {
    return { emailVerified: true, emailVerificationToken: '', emailVerificationExpiry: 0 };
  }
  return {
    emailVerified: false,
    emailVerificationToken: crypto.randomBytes(24).toString('hex'),
    emailVerificationExpiry: Date.now() + (48 * 60 * 60 * 1000)
  };
}

function buildVerificationLink(req, token) {
  return `${getBaseUrl(req)}/verify-email/${encodeURIComponent(token)}`;
}

router.get('/auth/google', route(async (req, res) => {
  const redirectTo = normalizeRedirectPath(req.query.redirect || '/dashboard', '/dashboard');
  const flow = String(req.query.flow || '').trim() === 'customer' ? 'customer' : 'vendor';
  const storeSlug = flow === 'customer'
    ? String(req.query.store || extractStoreSlugFromRedirectPath(redirectTo) || '').trim()
    : '';
  const supabase = getSupabaseAuthClient(req);
  if (!supabase) {
    setFlash(req, 'error', 'Google authentication is not configured.');
    res.redirect(flow === 'customer' && storeSlug ? `/store/${encodeURIComponent(storeSlug)}/account/login` : '/login');
    return;
  }
  req.session.oauthContext = { flow, redirectTo, storeSlug };
  const callbackUrl = `${getBaseUrl(req)}/auth/callback?redirect=${encodeURIComponent(redirectTo)}&flow=${encodeURIComponent(flow)}${storeSlug ? `&store=${encodeURIComponent(storeSlug)}` : ''}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callbackUrl, skipBrowserRedirect: true }
  });
  if (error || !data || !data.url) {
    setFlash(req, 'error', 'Unable to start Google sign-in.');
    res.redirect(flow === 'customer' && storeSlug ? `/store/${encodeURIComponent(storeSlug)}/account/login` : '/login');
    return;
  }
  res.redirect(data.url);
}));

router.get('/auth/callback', route(async (req, res) => {
  const context = req.session.oauthContext && typeof req.session.oauthContext === 'object' ? req.session.oauthContext : {};
  const redirectTo = normalizeRedirectPath(req.query.redirect || context.redirectTo || '/dashboard', '/dashboard');
  const flow = String(req.query.flow || context.flow || '').trim() === 'customer' ? 'customer' : 'vendor';
  const storeSlug = flow === 'customer'
    ? String(req.query.store || context.storeSlug || extractStoreSlugFromRedirectPath(redirectTo) || '').trim()
    : '';
  const fallbackRedirect = flow === 'customer' && storeSlug ? `/store/${encodeURIComponent(storeSlug)}/account/login` : '/login';
  const code = String(req.query.code || '').trim();
  if (!code) {
    setFlash(req, 'error', 'Google sign-in was cancelled.');
    res.redirect(fallbackRedirect);
    return;
  }
  const supabase = getSupabaseAuthClient(req);
  if (!supabase) {
    setFlash(req, 'error', 'Google authentication is not configured.');
    res.redirect(fallbackRedirect);
    return;
  }
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data || !data.user) {
    setFlash(req, 'error', 'Google authentication failed.');
    res.redirect(fallbackRedirect);
    return;
  }
  delete req.session.oauthContext;
  const email = String(data.user.email || '').trim().toLowerCase();
  const name = String((data.user.user_metadata && (data.user.user_metadata.full_name || data.user.user_metadata.name)) || email).trim() || email;
  if (!validateEmail(email)) {
    setFlash(req, 'error', 'Google account email is not valid.');
    res.redirect(fallbackRedirect);
    return;
  }

  if (flow === 'customer' && storeSlug) {
    const db = await loadDB();
    const store = db.stores[storeSlug];
    if (!store) {
      setFlash(req, 'error', 'Store not found for Google login.');
      res.redirect('/login');
      return;
    }
    store.customers = store.customers && typeof store.customers === 'object' ? store.customers : {};
    let customer = store.customers[email] || await findStoreCustomerByEmail(storeSlug, email);
    let createdCustomer = false;
    if (!customer) {
      customer = { id: `${storeSlug}:${email}`, email, name, phone: '', passwordHash: '', orders: [], wishlist: [], createdAt: new Date().toISOString(), addresses: [], authProvider: 'google', emailVerified: true };
      store.customers[email] = customer;
      await saveStoreCustomerFast(db, storeSlug, customer);
      createdCustomer = true;
    } else if (!store.customers[email]) {
      store.customers[email] = customer;
    }
    try {
      await syncCustomerToSupabaseAuth(storeSlug, customer, '');
    } catch (syncError) {
    }
    if (createdCustomer) {
      sendCustomerWelcomeEmail(customer, store).catch(console.error);
      sendAdminNewUserAlert(customer, 'customer', store).catch(console.error);
    }
    setLoggedCustomer(req, storeSlug, email);
    const handoff = createCustomerHandoffToken(customer, storeSlug);
    res.redirect(`${getFrontendBaseUrl(req)}/store/${encodeURIComponent(storeSlug)}/account/login?google=1&token=${encodeURIComponent(handoff)}`);
    return;
  }

  const db = await loadDB();
  const existingUser = db.users[email];
  if (existingUser && existingUser.storeSlug && db.stores[existingUser.storeSlug]) {
    const handoff = createVendorHandoffToken(existingUser);
    res.redirect(`${getFrontendBaseUrl(req)}/login?google=1&token=${encodeURIComponent(handoff)}`);
    return;
  }
  res.redirect(`${getFrontendBaseUrl(req)}/register?google=1&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`);
}));

router.get('/', route(async (req, res) => {
  const db = await loadDB();
  const hostStore = findStoreByRequestHost(db, req);
  if (hostStore) {
    const queryIndex = String(req.originalUrl || '').indexOf('?');
    const query = queryIndex >= 0 ? String(req.originalUrl || '').slice(queryIndex) : '';
    res.redirect(`/store/${encodeURIComponent(hostStore.slug)}${query}`);
    return;
  }
  const fs = require('fs');
  const path = require('path');
  const userCount = Object.keys(db.users).length;
  const storeCount = Object.keys(db.stores).length;
  const orderCount = Object.values(db.stores).reduce((sum, s) => sum + (s.orders ? s.orders.length : 0), 0);
  const productCount = Object.values(db.stores).reduce((sum, s) => sum + (s.products ? s.products.length : 0), 0);
  const successState = String(req.query.demo || '').trim();
  const demoAlert = successState === 'success'
    ? '<div style="margin-bottom:16px;padding:14px 16px;border-radius:14px;background:#dcfce7;border:1px solid #bbf7d0;color:#166534;font-size:13px;font-weight:700;">Thanks. Your demo request has been submitted. We will contact you shortly.</div>'
    : successState === 'error'
      ? '<div style="margin-bottom:16px;padding:14px 16px;border-radius:14px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:13px;font-weight:700;">Unable to submit your demo request right now. Please try WhatsApp instead.</div>'
      : '';
  const landingTemplatePath = path.join(config.ROOT_DIR, 'landing-page.html');
  const landingHtml = fs.readFileSync(landingTemplatePath, 'utf8')
    .replaceAll('__USER_COUNT__', escapeHtml(String(userCount)))
    .replaceAll('__STORE_COUNT__', escapeHtml(String(storeCount)))
    .replaceAll('__ORDER_COUNT__', escapeHtml(String(orderCount)))
    .replaceAll('__PRODUCT_COUNT__', escapeHtml(String(productCount)))
    .replaceAll('__DEMO_ALERT__', demoAlert)
    .replaceAll('__SUPPORT_WA_URL__', escapeHtml(getSupportWhatsappUrl('Hi StoreBanao, I need help with my online store.')))
    .replaceAll('__SUPPORT_PHONE__', escapeHtml(`+91 ${getSupportPhone()}`))
    .replaceAll('__LANDING_VERSION__', '2026-04-02-classy-motion-v4');
  res.set('X-MyShopBuilder-Landing-Version', '2026-04-02-classy-motion-v4');
  res.send(landingHtml);
}));

router.post('/demo-request', route(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const phone = sanitizePhone(req.body.phone || '');
  const category = String(req.body.category || '').trim();
  const preferredTime = String(req.body.preferredTime || '').trim();
  if (!name || phone.length < 10 || !preferredTime) {
    res.redirect('/?demo=error#demo');
    return;
  }
  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:24px;"><div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:28px;"><h2 style="margin-top:0;">New demo request</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:10px 0;color:#6b7280;width:160px;">Name</td><td style="padding:10px 0;font-weight:700;">${escapeHtml(name)}</td></tr><tr><td style="padding:10px 0;color:#6b7280;">Phone</td><td style="padding:10px 0;font-weight:700;">${escapeHtml(phone)}</td></tr><tr><td style="padding:10px 0;color:#6b7280;">What they sell</td><td style="padding:10px 0;font-weight:700;">${escapeHtml(category || '-')}</td></tr><tr><td style="padding:10px 0;color:#6b7280;">Preferred time</td><td style="padding:10px 0;font-weight:700;">${escapeHtml(preferredTime)}</td></tr><tr><td style="padding:10px 0;color:#6b7280;">Source</td><td style="padding:10px 0;font-weight:700;">Landing page demo form</td></tr></table></div></body></html>`;
  const sent = await require('../services/email').sendEmail({
    to: String(process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_USER || 'order@storebanao.com').split(',').map((value) => value.trim()).filter(Boolean),
    subject: `New demo request from ${name}`,
    html,
    replyTo: process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_USER || undefined
  });
  res.redirect(sent ? '/?demo=success#demo' : '/?demo=error#demo');
}));

router.get('/register', route(async (req, res) => {
  const db = await loadDB();
  const flash = renderFlashMessages(req);
  const templateOptions = db.templates.map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name)}</option>`).join('');
  const googleProfile = String(req.query.google || '').trim() === '1' ? getPendingGoogleProfile(req) : null;
  const googleMode = !!googleProfile;
  const googleButton = googleMode ? '' : renderGoogleButton('/auth/google?flow=vendor&redirect=%2Fdashboard');
  const heading = googleMode ? 'Complete your store setup' : 'Create your store';
  const subtitle = googleMode ? 'Google account connected. Just finish the store basics to go live.' : 'Quick setup. Fill the basics and go live.';
  const accountSummary = googleMode ? `<input type="hidden" name="googleSignup" value="1"><div class="field"><label for="googleName">Full Name</label><input id="googleName" value="${escapeHtml(googleProfile.name)}" readonly></div><div class="field"><label for="googleEmail">Email</label><input id="googleEmail" value="${escapeHtml(googleProfile.email)}" readonly></div>` : '';
  const standardFields = googleMode ? '' : `<div class="field"><label for="name">Full Name</label><input id="name" name="name" autocomplete="name" placeholder="Rahul Sharma" required></div>
            <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" placeholder="you@email.com" required></div>
            <div class="field"><label for="phone">Phone / WhatsApp</label><input id="phone" name="phone" autocomplete="tel" placeholder="9876543210" required></div>
            <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="new-password" placeholder="Minimum 8 characters" required></div>`;
  res.send(renderHtmlShell('Register - MyShopBuilder', `
      <div class="auth-wrap">
        <div class="card auth-card">
          ${flash}
          <h1 class="section-title">${escapeHtml(heading)}</h1>
          <p class="section-subtitle">${escapeHtml(subtitle)}</p>
          <form method="POST" action="/register" enctype="multipart/form-data" class="form-grid">
            ${googleButton}
            ${accountSummary}
            ${standardFields}
            <div class="field"><label for="storeName">Store Name</label><input id="storeName" name="storeName" placeholder="My Store" required></div>
            <div id="slugPreview" style="font-size:13px;color:#64748b;margin-top:-6px;margin-bottom:4px;"></div>
            <div class="field"><label for="template">Template</label><select id="template" name="template" required>${templateOptions}</select></div>
            <div class="field"><label for="description">Store Description</label><textarea id="description" name="description" maxlength="200" placeholder="Best products online" required></textarea></div>
            <div class="field"><label for="logo">Store Logo</label><input id="logo" name="logo" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" required></div>
            <div class="actions"><button class="btn" type="submit">Create Store</button><a class="btn btn-secondary" href="/login">Already have an account?</a></div>
          </form>
          <script>
          (function(){
            var el=document.getElementById('storeName'),prev=document.getElementById('slugPreview');
            if(!el||!prev)return;
            function slugify(v){return String(v||'').toLowerCase().trim().replace(/[^a-z0-9\\s-]/g,'').replace(/\\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');}
            el.addEventListener('input',function(){
              var s=slugify(el.value);
              if(!s){prev.innerHTML='';return;}
              prev.innerHTML='Your store URL: <strong>/store/'+s+'</strong>';
            });
          })();
          </script>
        </div>
      </div>
    `));
}));

router.post('/register', route(async (req, res) => {
  try {
    await runUploader(upload.single('logo'), req, res);
    const googleProfile = String(req.body.googleSignup || '').trim() === '1' ? getPendingGoogleProfile(req) : null;
    const googleMode = !!googleProfile;
    const name = googleMode ? googleProfile.name : String(req.body.name || '').trim();
    const email = googleMode ? googleProfile.email : String(req.body.email || '').trim().toLowerCase();
    const phone = googleMode ? '' : sanitizePhone(req.body.phone || '');
    const password = googleMode ? '' : String(req.body.password || '');
    const storeName = String(req.body.storeName || '').trim();
    const description = String(req.body.description || '').trim();
    const templateId = String(req.body.template || '').trim();
    const db = await loadDB();
    const templateExists = db.templates.some((item) => item.id === templateId);
    if (!name) { setFlash(req, 'error', 'Full name is required.'); res.redirect('/register'); return; }
    if (!validateEmail(email)) { setFlash(req, 'error', 'Please enter a valid email address.'); res.redirect('/register'); return; }
    if (!googleMode && phone.length < 10) { setFlash(req, 'error', 'Phone number must be at least 10 digits.'); res.redirect('/register'); return; }
    if (!googleMode && password.length < 8) { setFlash(req, 'error', 'Password must be at least 8 characters.'); res.redirect('/register'); return; }
    if (storeName.length < 3) { setFlash(req, 'error', 'Store name must be at least 3 characters.'); res.redirect('/register'); return; }
    if (!description || description.length > 200) { setFlash(req, 'error', 'Store description is required and must be at most 200 characters.'); res.redirect('/register'); return; }
    if (!templateExists) { setFlash(req, 'error', 'Please choose a valid template.'); res.redirect('/register'); return; }
    const existingUser = db.users[email];
    if (existingUser && existingUser.storeSlug && db.stores[existingUser.storeSlug]) { setFlash(req, 'error', 'Email already exists.'); res.redirect('/register'); return; }
    if (!req.file) { setFlash(req, 'error', 'Store logo is required.'); res.redirect('/register'); return; }
    if (req.file.size > 5 * 1024 * 1024) { setFlash(req, 'error', 'Logo size must be 5MB or less.'); res.redirect('/register'); return; }
    const logoPath = await saveUploadedFile(req.file, 'logo');
    let slug = slugify(storeName) || `store-${Math.floor(Math.random() * 9000 + 1000)}`;
    while (db.stores[slug]) {
      slug = `${slugify(storeName) || 'store'}-${Math.floor(Math.random() * 9000 + 1000)}`;
    }
    const createdAt = new Date().toISOString();
    const verification = createEmailVerificationState(googleMode);
    const passwordHash = googleMode ? hashPassword(crypto.randomBytes(32).toString('hex')) : hashPassword(password);
    db.users[email] = { id: email, email, name, phone, passwordHash, storeSlug: slug, createdAt: existingUser && existingUser.createdAt ? existingUser.createdAt : createdAt, authProvider: googleMode ? 'google' : 'password', updatedAt: createdAt, ...verification };
    db.stores[slug] = { slug, ownerId: email, name: storeName, description, whatsapp: phone, logo: logoPath, template: templateId, theme: 'default', subdomain: BASE_DOMAIN ? `${slug}.${BASE_DOMAIN}` : '', products: [], orders: [], customers: {}, visits: 0, createdAt };
    await saveMerchantAndStoreFast(db, db.users[email], db.stores[slug]);
    try {
      await syncMerchantToSupabaseAuth(db.users[email], password);
    } catch (syncError) {
      delete db.users[email];
      delete db.stores[slug];
      await removeStoredFile(logoPath);
      await saveDB(db);
      throw syncError;
    }
    sendVendorWelcomeEmail(db.users[email], db.stores[slug]);
    sendAdminNewUserAlert(db.users[email], 'vendor', db.stores[slug]);
    if (!googleMode && db.users[email].emailVerificationToken) {
      sendVerificationEmail(db.users[email], 'vendor', db.stores[slug], buildVerificationLink(req, db.users[email].emailVerificationToken));
    }
    delete req.session.googleAuth;
    req.session.userId = email;
    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    setFlash(req, 'success', 'Store created successfully.');
    res.redirect('/dashboard');
  } catch (error) {
    setFlash(req, 'error', error.message || 'Registration failed.');
    res.redirect('/register');
  }
}));

router.get('/login', route(async (req, res) => {
  const flash = renderFlashMessages(req);
  const googleButton = renderGoogleButton('/auth/google?flow=vendor&redirect=%2Fdashboard');
  res.send(renderHtmlShell('Login - MyShopBuilder', `
      <div class="auth-wrap">
        <div class="card auth-card">
          ${flash}
          <h1 class="section-title">User login</h1>
          <p class="section-subtitle">Use the email and password you created.</p>
          <form method="POST" action="/login" class="form-grid">
            ${googleButton}
            <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" placeholder="you@email.com" required></div>
            <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Your password" required></div>
            <div class="field" style="display:flex; align-items:center; gap:10px;">
              <input id="rememberMe" name="rememberMe" type="checkbox" style="width:18px; height:18px;">
              <label for="rememberMe" style="margin:0; font-weight:600;">Keep me logged in</label>
            </div>
            <div class="actions"><button class="btn" type="submit">Login</button><a class="btn btn-secondary" href="/register">Create account</a><a class="btn btn-secondary" href="/forgot-password">Forgot password?</a></div>
          </form>
        </div>
      </div>
    `));
}));

router.post('/login', route(async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const rememberMe = String(req.body.rememberMe || '') === 'on';
    if (!validateEmail(email)) { setFlash(req, 'error', 'Please enter a valid email address.'); res.redirect('/login'); return; }
    if (!password) { setFlash(req, 'error', 'Password is required.'); res.redirect('/login'); return; }
    const user = await findMerchantUserByEmail(email);
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

router.get('/logout', route(async (req, res) => {
  try {
    await new Promise((resolve) => req.session.destroy(() => resolve()));
    res.redirect('/login');
  } catch (error) {
    res.redirect('/login');
  }
}));

router.get('/forgot-password', route(async (req, res) => {
  const flash = renderFlashMessages(req);
  res.send(renderHtmlShell('Forgot Password - MyShopBuilder', `
      <div class="auth-wrap">
        <div class="card auth-card">
          ${flash}
          <h1 class="section-title">Forgot password?</h1>
          <p class="section-subtitle">Enter your merchant email. We will generate a reset link.</p>
          <form method="POST" action="/forgot-password" class="form-grid">
            <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
            <div class="actions"><button class="btn" type="submit">Send reset link</button><a class="btn btn-secondary" href="/login">Back to login</a></div>
          </form>
        </div>
      </div>
    `));
}));

router.post('/forgot-password', route(async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!validateEmail(email)) {
      setFlash(req, 'error', 'Please enter a valid email address.');
      res.redirect('/forgot-password');
      return;
    }
    const db = await loadDB();
    const user = db.users[email];
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiry = Date.now() + 3600000;
      user.resetToken = token;
      user.resetExpiry = expiry;
      await saveDB(db);
      const resetLink = `${process.env.BASE_URL || `${req.protocol}://${req.get('host')}`}/reset-password/${token}`;
      console.log(`[PASSWORD RESET] ${email} -> ${resetLink}`);
      await sendPasswordResetEmail(email, resetLink);
    }
    setFlash(req, 'success', 'If that email exists, a reset link has been generated.');
    res.redirect('/login');
  } catch (error) {
    setFlash(req, 'error', 'Unable to process reset request.');
    res.redirect('/forgot-password');
  }
}));

router.get('/reset-password/:token', route(async (req, res) => {
  const token = String(req.params.token || '').trim();
  const db = await loadDB();
  const user = Object.values(db.users).find((entry) => entry && entry.resetToken === token && Number(entry.resetExpiry || 0) > Date.now());
  if (!user) {
    setFlash(req, 'error', 'Reset link is invalid or expired.');
    res.redirect('/forgot-password');
    return;
  }
  const flash = renderFlashMessages(req);
  res.send(renderHtmlShell('Reset Password - MyShopBuilder', `
      <div class="auth-wrap">
        <div class="card auth-card">
          ${flash}
          <h1 class="section-title">Set a new password</h1>
          <p class="section-subtitle">Choose a strong password for your merchant account.</p>
          <form method="POST" action="/reset-password/${escapeHtml(token)}" class="form-grid">
            <div class="field"><label for="password">New Password</label><input id="password" name="password" type="password" autocomplete="new-password" required></div>
            <div class="field"><label for="confirmPassword">Confirm Password</label><input id="confirmPassword" name="confirmPassword" type="password" autocomplete="new-password" required></div>
            <div class="actions"><button class="btn" type="submit">Reset password</button><a class="btn btn-secondary" href="/login">Cancel</a></div>
          </form>
        </div>
      </div>
    `));
}));

router.get('/verify-email/:token', route(async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!token) {
    setFlash(req, 'error', 'Verification link is invalid.');
    res.redirect('/login');
    return;
  }
  const db = await loadDB();
  const vendor = Object.values(db.users || {}).find((entry) => entry && entry.emailVerificationToken === token && Number(entry.emailVerificationExpiry || 0) > Date.now());
  if (vendor) {
    vendor.emailVerified = true;
    delete vendor.emailVerificationToken;
    delete vendor.emailVerificationExpiry;
    await saveDB(db);
    setFlash(req, 'success', 'Email verified successfully.');
    res.redirect('/login');
    return;
  }
  const matchedStore = Object.values(db.stores || {}).find((store) => Object.values(store && store.customers || {}).some((customer) => customer && customer.emailVerificationToken === token && Number(customer.emailVerificationExpiry || 0) > Date.now()));
  if (matchedStore) {
    const customer = Object.values(matchedStore.customers || {}).find((entry) => entry && entry.emailVerificationToken === token && Number(entry.emailVerificationExpiry || 0) > Date.now());
    if (customer) {
      customer.emailVerified = true;
      delete customer.emailVerificationToken;
      delete customer.emailVerificationExpiry;
      await saveDB(db);
      setFlash(req, 'success', 'Email verified successfully.');
      res.redirect(`/store/${encodeURIComponent(matchedStore.slug)}/account/login`);
      return;
    }
  }
  setFlash(req, 'error', 'Verification link is invalid or expired.');
  res.redirect('/login');
}));

router.post('/reset-password/:token', route(async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    const password = String(req.body.password || '');
    const confirmPassword = String(req.body.confirmPassword || '');
    if (password.length < 8) {
      setFlash(req, 'error', 'Password must be at least 8 characters.');
      res.redirect(`/reset-password/${encodeURIComponent(token)}`);
      return;
    }
    if (password !== confirmPassword) {
      setFlash(req, 'error', 'Passwords do not match.');
      res.redirect(`/reset-password/${encodeURIComponent(token)}`);
      return;
    }
    const db = await loadDB();
    const user = Object.values(db.users).find((entry) => entry && entry.resetToken === token && Number(entry.resetExpiry || 0) > Date.now());
    if (!user) {
      setFlash(req, 'error', 'Reset link is invalid or expired.');
      res.redirect('/forgot-password');
      return;
    }
    const previousPasswordHash = user.passwordHash;
    const previousResetExpiry = user.resetExpiry;
    user.passwordHash = hashPassword(password);
    delete user.resetToken;
    delete user.resetExpiry;
    await saveDB(db);
    try {
      await syncMerchantToSupabaseAuth(user, password);
    } catch (syncError) {
      user.passwordHash = previousPasswordHash;
      user.resetToken = token;
      user.resetExpiry = previousResetExpiry;
      await saveDB(db);
      throw syncError;
    }
    sendPasswordChangedEmail(user.email, user.name);
    setFlash(req, 'success', 'Password reset successful. Please login.');
    res.redirect('/login');
  } catch (error) {
    setFlash(req, 'error', 'Unable to reset password.');
    res.redirect('/forgot-password');
  }
}));

module.exports = router;
