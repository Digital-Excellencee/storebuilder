const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

let _supabaseAdmin = null;
let _authIndexCache = null;
let _authIndexTime = 0;
const AUTH_INDEX_TTL = 60000;

function getSupabaseAuthAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) return null;
  _supabaseAdmin = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  return _supabaseAdmin;
}

function normalizeEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  return value || '';
}

function isOtpPlaceholderEmail(email) {
  return /@otp\.customer$/i.test(String(email || '').trim());
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits || '';
}

function normalizeAuthPhone(phone) {
  const digits = normalizePhone(phone);
  if (!digits) return '';
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return '';
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)));
}

function mergeStrings() {
  return uniqueStrings(Array.prototype.concat.apply([], Array.from(arguments)));
}

function buildTempPassword() {
  return `${crypto.randomBytes(24).toString('hex')}Aa1!`;
}

async function listAllAuthUsers(admin) {
  const users = [];
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const batch = data && Array.isArray(data.users) ? data.users : [];
    users.push(...batch);
    if (batch.length < 1000) break;
    page += 1;
  }
  return users;
}

function buildAuthIndex(users) {
  const byEmail = new Map();
  const byPhone = new Map();
  (Array.isArray(users) ? users : []).forEach((user) => {
    const email = normalizeEmail(user && user.email);
    const phone = normalizeAuthPhone(user && user.phone);
    if (email) byEmail.set(email, user);
    if (phone) byPhone.set(phone, user);
  });
  return { byEmail, byPhone };
}

async function getAuthIndex(admin, forceRefresh) {
  const now = Date.now();
  if (!forceRefresh && _authIndexCache && (now - _authIndexTime) < AUTH_INDEX_TTL) {
    return _authIndexCache;
  }
  _authIndexCache = buildAuthIndex(await listAllAuthUsers(admin));
  _authIndexTime = now;
  return _authIndexCache;
}

function shouldRetryAuthSync(error) {
  const message = String(error && error.message || '').toLowerCase();
  return message.includes('already') || message.includes('exists') || message.includes('registered') || message.includes('duplicate');
}

async function syncIdentity(admin, identity) {
  let index = await getAuthIndex(admin, false);
  try {
    return await syncIdentityWithIndex(admin, index, identity);
  } catch (error) {
    if (!shouldRetryAuthSync(error)) throw error;
    index = await getAuthIndex(admin, true);
    return syncIdentityWithIndex(admin, index, identity);
  }
}

function buildUserMetadata(existing, identity, migrationPendingReset) {
  const base = existing && typeof existing === 'object' ? existing : {};
  const merchantStoreSlugs = mergeStrings(base.merchantStoreSlugs, identity.role === 'merchant' ? [identity.storeSlug] : []);
  const customerStoreSlugs = mergeStrings(base.customerStoreSlugs, identity.role === 'customer' ? [identity.storeSlug] : []);
  const legacyRefs = mergeStrings(base.legacyRefs, identity.legacyRef ? [identity.legacyRef] : []);
  const roles = mergeStrings(base.roles, [identity.role]);
  return {
    ...base,
    name: identity.name || base.name || '',
    full_name: identity.name || base.full_name || base.name || '',
    phone: identity.rawPhone || base.phone || '',
    roles,
    merchantStoreSlugs,
    customerStoreSlugs,
    legacyRefs,
    migration_source: 'app_data',
    migration_pending_reset: migrationPendingReset === true,
    last_synced_at: new Date().toISOString()
  };
}

function buildAppMetadata(existing, identity, migrationPendingReset) {
  const base = existing && typeof existing === 'object' ? existing : {};
  const current = base.myshopbuilder && typeof base.myshopbuilder === 'object' ? base.myshopbuilder : {};
  return {
    ...base,
    myshopbuilder: {
      source: 'app_data',
      roles: mergeStrings(current.roles, [identity.role]),
      merchantStoreSlugs: mergeStrings(current.merchantStoreSlugs, identity.role === 'merchant' ? [identity.storeSlug] : []),
      customerStoreSlugs: mergeStrings(current.customerStoreSlugs, identity.role === 'customer' ? [identity.storeSlug] : []),
      legacyRefs: mergeStrings(current.legacyRefs, identity.legacyRef ? [identity.legacyRef] : []),
      migrationPendingReset: migrationPendingReset === true,
      syncedAt: new Date().toISOString()
    }
  };
}

function updateAuthIndex(index, user) {
  if (!index || !user) return;
  const email = normalizeEmail(user.email);
  const phone = normalizeAuthPhone(user.phone);
  if (email) index.byEmail.set(email, user);
  if (phone) index.byPhone.set(phone, user);
}

async function syncIdentityWithIndex(admin, index, identity) {
  const email = normalizeEmail(identity.email);
  const authPhone = normalizeAuthPhone(identity.phone);
  const rawPhone = normalizePhone(identity.phone);
  const emailUser = email ? index.byEmail.get(email) : null;
  const phoneUser = authPhone ? index.byPhone.get(authPhone) : null;
  const user = emailUser || (!email ? phoneUser : (phoneUser && normalizeEmail(phoneUser.email) === email ? phoneUser : null)) || null;
  const canAttachPhone = !!(authPhone && (!phoneUser || (user && phoneUser.id === user.id)));
  const migrationPendingReset = identity.migrationPendingReset === true;
  const userMetadata = buildUserMetadata(user && user.user_metadata, { ...identity, rawPhone }, migrationPendingReset);
  const appMetadata = buildAppMetadata(user && user.app_metadata, identity, migrationPendingReset);

  if (!user) {
    const attributes = {
      password: identity.password || buildTempPassword(),
      user_metadata: userMetadata,
      app_metadata: appMetadata
    };
    if (email) {
      attributes.email = email;
      attributes.email_confirm = true;
    }
    if (canAttachPhone) {
      attributes.phone = authPhone;
      attributes.phone_confirm = true;
    }
    if (!attributes.email && !attributes.phone) {
      return { status: 'skipped', reason: 'missing_identity' };
    }
    const { data, error } = await admin.auth.admin.createUser(attributes);
    if (error) throw error;
    updateAuthIndex(index, data.user);
    return { status: 'created', user: data.user };
  }

  const attributes = {
    user_metadata: userMetadata,
    app_metadata: appMetadata
  };
  if (identity.password) {
    attributes.password = identity.password;
  }
  if (email && !normalizeEmail(user.email)) {
    attributes.email = email;
    attributes.email_confirm = true;
  }
  if (canAttachPhone && !String(user.phone || '').trim()) {
    attributes.phone = authPhone;
    attributes.phone_confirm = true;
  }
  const { data, error } = await admin.auth.admin.updateUserById(user.id, attributes);
  if (error) throw error;
  updateAuthIndex(index, data.user || user);
  return { status: 'updated', user: data.user || user };
}

function buildMerchantIdentity(user, password) {
  return {
    role: 'merchant',
    email: user && user.email,
    phone: user && user.phone,
    name: user && user.name,
    storeSlug: user && user.storeSlug,
    legacyRef: user && user.id ? `merchant:${user.id}` : '',
    password: password || '',
    migrationPendingReset: !password
  };
}

function buildCustomerIdentity(storeSlug, customer, password) {
  const safeEmail = customer && !isOtpPlaceholderEmail(customer.email) ? customer.email : '';
  const hasPassword = !!(password || (customer && customer.passwordHash));
  return {
    role: 'customer',
    email: safeEmail,
    phone: customer && customer.phone,
    name: customer && customer.name,
    storeSlug,
    legacyRef: customer && customer.id ? `customer:${storeSlug}:${customer.id}` : `customer:${storeSlug}`,
    password: password || '',
    migrationPendingReset: !!(hasPassword && !password)
  };
}

async function syncMerchantToSupabaseAuth(user, password) {
  const admin = getSupabaseAuthAdmin();
  if (!admin || !user) return { status: 'skipped', reason: 'supabase_auth_unavailable' };
  return syncIdentity(admin, buildMerchantIdentity(user, password));
}

async function syncCustomerToSupabaseAuth(storeSlug, customer, password) {
  const admin = getSupabaseAuthAdmin();
  if (!admin || !customer) return { status: 'skipped', reason: 'supabase_auth_unavailable' };
  return syncIdentity(admin, buildCustomerIdentity(storeSlug, customer, password));
}

async function syncLegacyUsersToSupabaseAuth(db) {
  const admin = getSupabaseAuthAdmin();
  if (!admin) return { enabled: false, created: 0, updated: 0, skipped: 0 };
  const index = await getAuthIndex(admin, true);
  const summary = { enabled: true, created: 0, updated: 0, skipped: 0, merchants: 0, customers: 0 };
  const users = db && db.users && typeof db.users === 'object' ? Object.values(db.users) : [];
  const stores = db && db.stores && typeof db.stores === 'object' ? Object.entries(db.stores) : [];

  for (const user of users) {
    const result = await syncIdentityWithIndex(admin, index, buildMerchantIdentity(user, ''));
    summary.merchants += 1;
    summary[result.status] = (summary[result.status] || 0) + 1;
  }

  for (const [storeSlug, store] of stores) {
    const customers = store && store.customers && typeof store.customers === 'object' ? Object.values(store.customers) : [];
    for (const customer of customers) {
      const result = await syncIdentityWithIndex(admin, index, buildCustomerIdentity(storeSlug, customer, ''));
      summary.customers += 1;
      summary[result.status] = (summary[result.status] || 0) + 1;
    }
  }

  return summary;
}

module.exports = {
  getSupabaseAuthAdmin,
  syncMerchantToSupabaseAuth,
  syncCustomerToSupabaseAuth,
  syncLegacyUsersToSupabaseAuth
};
