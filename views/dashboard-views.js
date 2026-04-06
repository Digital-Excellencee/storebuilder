const { escapeHtml } = require('../helpers/html');
const { renderFlashMessages } = require('../helpers/flash');
const { ensureStoreSettings } = require('../services/db');
const { renderHtmlShell } = require('./shell');

const DISPLAY_SETTINGS_SECTIONS = [
  { id: 'announcement', label: 'Announcement', icon: '📣' },
  { id: 'header', label: 'Header', icon: 'H' },
  { id: 'menu', label: 'Menu', icon: '≡' },
  { id: 'banner', label: 'Banner', icon: '🖼' },
  { id: 'categories', label: 'Categories', icon: '▦' },
  { id: 'products', label: 'Products', icon: '◫' },
  { id: 'footer', label: 'Footer', icon: '▭' },
  { id: 'product-card', label: 'Product Card', icon: '◨' },
  { id: 'product-page', label: 'Product Page', icon: '📄' },
  { id: 'color-font', label: 'Color & Font', icon: '🎨' },
  { id: 'custom-css', label: 'Custom CSS', icon: '</>' }
];

const STORE_SETTINGS_SECTIONS = [
  { id: 'store-details', label: 'Store Details', icon: '🏪' },
  { id: 'store-domain', label: 'Store Domain', icon: '🌐' },
  { id: 'products-settings', label: 'Products Settings', icon: '📦' },
  { id: 'checkout-settings', label: 'Checkout Settings', icon: '🛒' },
  { id: 'delivery-settings', label: 'Delivery Settings', icon: '🚚' },
  { id: 'payment-settings', label: 'Payment Settings', icon: '💳' },
  { id: 'order-settings', label: 'Order Settings', icon: '👜' },
  { id: 'return-order-settings', label: 'Return Order Settings', icon: '↺' },
  { id: 'label-settings', label: 'Label Settings', icon: '🏷' },
  { id: 'seo-settings', label: 'SEO Settings', icon: '🔎' },
  { id: 'llm-settings', label: 'LLM Settings', icon: '🤖' },
  { id: 'notifications-settings', label: 'Notifications Settings', icon: '🔔' },
  { id: 'login-settings', label: 'Login Settings', icon: '↪' },
  { id: 'url-redirects', label: 'URL Redirects', icon: '↗' },
  { id: 'robots-txt', label: 'Robots TXT', icon: '🧰' },
  { id: 'policies', label: 'Policies', icon: '📄' },
  { id: 'about-us', label: 'About Us', icon: '✉' }
];

function sanitizeThemeField(value, maxLen) {
  const limit = Number(maxLen || 0) || 200;
  return String(value || '').trim().slice(0, limit);
}

function checkboxValue(req, key) {
  return req.body[key] === 'on' || req.body[key] === 'true';
}

function pickDisplaySection(section) {
  const safe = String(section || '').trim().toLowerCase();
  return DISPLAY_SETTINGS_SECTIONS.some((item) => item.id === safe) ? safe : 'announcement';
}

function pickStoreSettingsSection(section) {
  const safe = String(section || '').trim().toLowerCase();
  return STORE_SETTINGS_SECTIONS.some((item) => item.id === safe) ? safe : 'store-details';
}

function getDashboardReturnTo(req, fallback) {
  const raw = String((req.body && req.body.returnTo) || req.query.returnTo || req.get('referer') || '').trim();
  return raw.startsWith('/dashboard') ? raw : fallback;
}

function renderDisplayToggle(name, title, description, checked) {
  return `<label class="osa-toggle-row"><div class="osa-toggle-copy"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span></div><span class="osa-switch"><input type="checkbox" name="${escapeHtml(name)}" ${checked ? 'checked' : ''}><span class="osa-switch-ui"></span></span></label>`;
}

function renderDisplaySectionNav(activeSection) {
  return `<aside class="osa-card osa-section-nav">${DISPLAY_SETTINGS_SECTIONS.map((item) => `<a class="osa-section-link ${activeSection === item.id ? 'active' : ''}" href="/dashboard/display-settings?section=${encodeURIComponent(item.id)}"><span class="osa-section-icon">${escapeHtml(item.icon)}</span><span>${escapeHtml(item.label)}</span></a>`).join('')}</aside>`;
}

function renderStoreSettingsSectionNav(activeSection) {
  return `<aside class="osa-card osa-section-nav">${STORE_SETTINGS_SECTIONS.map((item) => `<a class="osa-section-link ${activeSection === item.id ? 'active' : ''}" href="/dashboard/settings?section=${encodeURIComponent(item.id)}"><span class="osa-section-icon">${escapeHtml(item.icon)}</span><span>${escapeHtml(item.label)}</span></a>`).join('')}</aside>`;
}

module.exports = {
  DISPLAY_SETTINGS_SECTIONS,
  STORE_SETTINGS_SECTIONS,
  sanitizeThemeField,
  checkboxValue,
  pickDisplaySection,
  pickStoreSettingsSection,
  getDashboardReturnTo,
  renderDisplayToggle,
  renderDisplaySectionNav,
  renderStoreSettingsSectionNav
};
