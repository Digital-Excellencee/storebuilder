const fs = require('fs');
const path = require('path');

function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
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

const ROOT_DIR = path.join(__dirname, '..');
const STORAGE_ROOT = process.env.STORAGE_ROOT
  ? path.resolve(process.env.STORAGE_ROOT)
  : ROOT_DIR;

const config = {
  PORT: Number(process.env.PORT) || 3000,
  ROOT_DIR,
  STORAGE_ROOT,
  DB_PATH: process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(STORAGE_ROOT, 'database.json'),
  SESSION_PATH: process.env.SESSION_PATH ? path.resolve(process.env.SESSION_PATH) : path.join(STORAGE_ROOT, 'sessions.json'),
  PUBLIC_DIR: process.env.PUBLIC_DIR ? path.resolve(process.env.PUBLIC_DIR) : path.join(STORAGE_ROOT, 'public'),
  LOGOS_DIR: process.env.LOGOS_DIR ? path.resolve(process.env.LOGOS_DIR) : path.join(process.env.PUBLIC_DIR ? path.resolve(process.env.PUBLIC_DIR) : path.join(STORAGE_ROOT, 'public'), 'logos'),
  PRODUCTS_DIR: process.env.PRODUCTS_DIR ? path.resolve(process.env.PRODUCTS_DIR) : path.join(STORAGE_ROOT, 'products'),
  ALLOWED_MIMES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  ORDER_STATUSES: ['pending', 'confirmed', 'shipped', 'cancelled', 'delivered'],
  BASE_DOMAIN: (process.env.BASE_DOMAIN || '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
  IGNORED_SUBDOMAINS: ['www', 'mail', 'ftp', 'api', 'admin', 'cdn', 'static', 'assets'],
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || '',
  CLOUDFLARE_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID || '',
  get SESSION_SECRET() {
    if (!process.env.SESSION_SECRET) {
      console.error('[FATAL] SESSION_SECRET environment variable is required.');
      process.exit(1);
    }
    return process.env.SESSION_SECRET;
  }
};

if (!process.env.BASE_DOMAIN) {
  console.warn('[WARN] BASE_DOMAIN not set in .env — subdomain routing disabled.');
}

module.exports = config;
