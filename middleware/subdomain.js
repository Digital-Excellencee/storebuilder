const config = require('../config');
const { loadDB } = require('../services/db');

const { BASE_DOMAIN, IGNORED_SUBDOMAINS } = config;

function getSubdomainFromHost(host, req) {
  if (!BASE_DOMAIN) return '';
  let clean = String(host || '').split(':')[0].toLowerCase();
  if (req && req.headers['x-forwarded-host']) {
    clean = String(req.headers['x-forwarded-host']).split(',')[0].trim().split(':')[0].toLowerCase();
  }
  if (clean === BASE_DOMAIN) return '';
  if (clean === 'localhost') return '';
  if (clean === '127.0.0.1') return '';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(clean)) return '';
  if (clean.endsWith('.' + BASE_DOMAIN)) {
    const sub = clean.replace('.' + BASE_DOMAIN, '');
    if (sub && !IGNORED_SUBDOMAINS.includes(sub)) return sub;
  }
  return '';
}

function normalizeHostValue(host) {
  let clean = String(host || '').trim().toLowerCase();
  if (!clean) return '';
  clean = clean.split(',')[0].trim();
  clean = clean.replace(/^https?:\/\//, '').split('/')[0];
  clean = clean.split(':')[0];
  return clean.replace(/\.+$/, '');
}

function findStoreByRequestHost(db, req) {
  const host = normalizeHostValue((req && req.headers && req.headers['x-forwarded-host']) || (req && req.get && req.get('host')) || '');
  if (!host || host === 'localhost' || host === '127.0.0.1' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return null;
  }
  if (BASE_DOMAIN && host === BASE_DOMAIN) {
    return null;
  }
  for (const [slug, store] of Object.entries((db && db.stores) || {})) {
    const customDomain = normalizeHostValue(store && store.domain && store.domain.customDomain);
    const savedSubdomain = normalizeHostValue((store && store.domain && store.domain.subdomain) || (store && store.subdomain) || '');
    if ((customDomain && customDomain === host) || (savedSubdomain && savedSubdomain === host)) {
      return { slug, store, host };
    }
  }
  const derivedSubdomain = getSubdomainFromHost(host, req);
  if (derivedSubdomain && db && db.stores && db.stores[derivedSubdomain]) {
    return { slug: derivedSubdomain, store: db.stores[derivedSubdomain], host };
  }
  return null;
}

function subdomainMiddleware(req, res, next) {
  const host = normalizeHostValue((req && req.headers && req.headers['x-forwarded-host']) || (req && req.get && req.get('host')) || '');
  if (!host) {
    next();
    return;
  }
  const safePath = String(req.path || req.url || '/').trim();
  const platformPrefixes = ['/api', '/app', '/dashboard', '/superadmin', '/login', '/register', '/auth', '/health', '/migration-status', '/verify-email', '/forgot-password', '/reset-password', '/public', '/logos', '/products', '/store'];
  if (platformPrefixes.some((prefix) => safePath === prefix || safePath.startsWith(`${prefix}/`))) {
    next();
    return;
  }
  loadDB().then((db) => {
    const hostStore = findStoreByRequestHost(db, req);
    if (!hostStore || !hostStore.slug) {
      next();
      return;
    }
    req.subdomainSlug = hostStore.slug;
    req.storeHost = hostStore.host;
    req.url = `/store/${encodeURIComponent(hostStore.slug)}${safePath === '/' ? '' : safePath}${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;
    next();
  }).catch((error) => {
    console.error('[SUBDOMAIN] Rewrite failed.', error && error.message ? error.message : error);
    next();
  });
}

module.exports = { getSubdomainFromHost, normalizeHostValue, findStoreByRequestHost, subdomainMiddleware };
