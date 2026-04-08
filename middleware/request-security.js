const { setFlash } = require('../helpers/flash');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const PLATFORM_PREFIXES = ['/api', '/app'];

function normalizeOriginLike(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch (error) {
    return '';
  }
}

function getExpectedOrigin(req) {
  const proto = String((req.headers['x-forwarded-proto'] || req.protocol || 'http')).split(',')[0].trim();
  const host = String((req.headers['x-forwarded-host'] || (req.get && req.get('host')) || '')).split(',')[0].trim();
  if (!proto || !host) return '';
  return `${proto}://${host}`.toLowerCase();
}

function isPlatformPath(pathname) {
  const safePath = String(pathname || '').trim().toLowerCase();
  return PLATFORM_PREFIXES.some((prefix) => safePath === prefix || safePath.startsWith(`${prefix}/`));
}

function isTrustedNavigation(req) {
  const secFetchSite = String(req.headers['sec-fetch-site'] || '').trim().toLowerCase();
  if (secFetchSite && !['same-origin', 'same-site', 'none'].includes(secFetchSite)) {
    return false;
  }
  const expectedOrigin = getExpectedOrigin(req);
  if (!expectedOrigin) return true;
  const candidates = [req.headers.origin, req.headers.referer]
    .map(normalizeOriginLike)
    .filter(Boolean);
  if (!candidates.length) return true;
  return candidates.some((origin) => origin === expectedOrigin);
}

function sameOriginGuard(req, res, next) {
  if (SAFE_METHODS.has(String(req.method || '').toUpperCase())) {
    next();
    return;
  }
  if (isPlatformPath(req.path)) {
    next();
    return;
  }
  if (isTrustedNavigation(req)) {
    next();
    return;
  }
  console.warn(`[SECURITY] Blocked cross-site request ${req.method} ${req.originalUrl}`);
  setFlash(req, 'error', 'Security validation failed. Please try again from inside the website.');
  res.status(403);
  if (req.headers.referer) {
    res.redirect(req.headers.referer);
    return;
  }
  res.redirect('/');
}

module.exports = {
  sameOriginGuard,
  isTrustedNavigation,
  normalizeOriginLike,
  getExpectedOrigin
};
