const fs = require('fs');
const path = require('path');
const config = require('../config');

const AUDIT_LOG_PATH = process.env.AUDIT_LOG_PATH
  ? path.resolve(process.env.AUDIT_LOG_PATH)
  : path.join(config.STORAGE_ROOT, 'audit.log');

function getRequestMeta(req) {
  return {
    ip: String((req.headers['x-forwarded-for'] || req.ip || '')).split(',')[0].trim(),
    method: String(req.method || '').toUpperCase(),
    path: String(req.originalUrl || req.url || '').trim(),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 300)
  };
}

function appendAuditLog(entry) {
  const line = `${JSON.stringify(entry)}\n`;
  try {
    fs.mkdirSync(path.dirname(AUDIT_LOG_PATH), { recursive: true });
    fs.appendFileSync(AUDIT_LOG_PATH, line, 'utf8');
  } catch (error) {
    console.error('[AUDIT] Failed to persist audit entry.', error && error.message ? error.message : error);
  }
}

function writeAuditLog(req, action, details) {
  const entry = {
    at: new Date().toISOString(),
    actor: req && req.session && req.session.superAdminId ? 'superadmin' : (req && req.session && req.session.userId ? 'vendor' : 'guest'),
    actorId: req && req.session ? (req.session.superAdminId || req.session.userId || '') : '',
    action: String(action || '').trim(),
    details: details && typeof details === 'object' ? details : {},
    request: getRequestMeta(req || { headers: {} })
  };
  appendAuditLog(entry);
}

module.exports = {
  writeAuditLog,
  AUDIT_LOG_PATH
};
