const crypto = require('crypto');

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

function generateTrackingCode() {
  return `trk_${generateId('o').split('_')[1].slice(0, 8)}`;
}

function generateOrderNumber(store) {
  const count = (store.orders || []).length + 1001;
  return `#${count}`;
}

const config = require('../config');
function getBaseUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']).split(',')[0].trim() : req.protocol;
  const host = req.get('host') || `localhost:${config.PORT}`;
  return `${protocol}://${host}`;
}

module.exports = {
  slugify,
  escapeHtml,
  sanitizeInput,
  parsePrice,
  sanitizeTrackingCode,
  INPUT_LIMITS,
  generateId,
  formatDate,
  sanitizePhone,
  formatMoney,
  generateTrackingCode,
  generateOrderNumber,
  getBaseUrl
};
