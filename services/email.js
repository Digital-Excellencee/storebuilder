const fs = require('fs');
const path = require('path');
const config = require('../config');
const { getEmailTemplate } = require('./email-templates');

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (error) {
  console.warn('[EMAIL] nodemailer not installed. Run: npm install nodemailer');
}

const EMAIL_LOG_PATH = path.join(config.ROOT_DIR, 'email-events.log');
const EMAIL_RETRY_ATTEMPTS = Math.max(1, Number(process.env.EMAIL_RETRY_ATTEMPTS || 3));
const EMAIL_RETRY_DELAY_MS = Math.max(500, Number(process.env.EMAIL_RETRY_DELAY_MS || 2000));

function getFixedFromEmail() {
  const smtpFrom = String(process.env.SMTP_FROM || '').trim();
  const emailMatch = smtpFrom.match(/<([^>]+)>/);
  const explicit = emailMatch ? emailMatch[1].trim() : smtpFrom;
  return explicit || 'orders@storebanao.com';
}

function getStoreSupportEmail(store) {
  const smtp = resolveStoreSmtp(store);
  const storeDetails = store && store.storeSettings && store.storeSettings.storeDetails && typeof store.storeSettings.storeDetails === 'object'
    ? store.storeSettings.storeDetails
    : {};
  return String(
    (smtp && (smtp.replyTo || smtp.from)) ||
    storeDetails.supportEmail ||
    storeDetails.email ||
    process.env.ADMIN_ALERT_EMAIL ||
    process.env.SMTP_USER ||
    ''
  ).trim();
}

function getStoreDisplayName(store) {
  return String(store && store.name || '').trim() || 'StoreBanao';
}

function resolveStoreSmtp(store) {
  const smtp = store && store.apps && store.apps.smtp && store.apps.smtp.installed && store.apps.smtp.configured ? store.apps.smtp : null;
  if (!smtp || !smtp.host || !smtp.user || !smtp.pass) return null;
  return {
    host: smtp.host,
    port: Number(smtp.port) || 587,
    secure: smtp.secure === true || Number(smtp.port) === 465,
    auth: { user: smtp.user, pass: smtp.pass },
    from: smtp.fromEmail || smtp.user,
    replyTo: smtp.replyTo || smtp.fromEmail || smtp.user,
    fromName: smtp.fromName || (store && store.name) || ''
  };
}

function createTransporter(store) {
  if (!nodemailer) return null;
  const custom = resolveStoreSmtp(store);
  const host = custom ? custom.host : process.env.SMTP_HOST;
  const port = custom ? custom.port : (Number(process.env.SMTP_PORT) || 587);
  const user = custom ? custom.auth.user : process.env.SMTP_USER;
  const pass = custom ? custom.auth.pass : process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    console.warn('[EMAIL] SMTP not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS to env.');
    return null;
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: custom ? custom.secure : port === 465,
    auth: { user, pass }
  });
}

function getSender(store, from, replyTo) {
  const sender = from || `${getStoreDisplayName(store)} <${getFixedFromEmail()}>`;
  return {
    from: sender,
    replyTo: replyTo || getStoreSupportEmail(store) || undefined
  };
}

async function resolveStoreFromPayload(payload) {
  if (payload && payload.store) return payload.store;
  const order = payload && payload.order ? payload.order : null;
  if (!order) return null;
  const storeIdentifiers = [order.storeSlug, order.store_slug, order.storeId, order.store_id].map((value) => String(value || '').trim()).filter(Boolean);
  const vendorIdentifiers = [order.vendorId, order.vendor_id, order.ownerId, order.owner_id].map((value) => String(value || '').trim()).filter(Boolean);
  try {
    const { loadDB } = require('./db');
    const db = await loadDB();
    if (!db || !db.stores) return null;
    for (const slug of storeIdentifiers) {
      if (db.stores[slug]) return db.stores[slug];
    }
    if (vendorIdentifiers.length) {
      return Object.values(db.stores).find((store) => vendorIdentifiers.includes(String(store && store.ownerId || '').trim())) || null;
    }
    return null;
  } catch (error) {
    return null;
  }
}

function getAdminRecipients() {
  return String(process.env.ADMIN_ALERT_EMAIL || process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function logEmailEvent(event) {
  const line = JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n';
  try {
    fs.appendFileSync(EMAIL_LOG_PATH, line, 'utf8');
  } catch (error) {
    console.error('[EMAIL] Unable to write email log.', error && error.message ? error.message : error);
  }
}

async function buildTypedEmail(type, payload) {
  const store = await resolveStoreFromPayload(payload || {});
  const enrichedPayload = Object.assign({}, payload || {}, { store: store || (payload && payload.store) || null });
  const spec = getEmailTemplate(type, enrichedPayload);
  let to = [];
  if (type === 'email_verification') to = [enrichedPayload.user && enrichedPayload.user.email];
  else if (type === 'password_reset' || type === 'password_changed') to = [enrichedPayload.email];
  else if (type === 'vendor_welcome') to = [enrichedPayload.user && enrichedPayload.user.email];
  else if (type === 'customer_welcome') to = [enrichedPayload.customer && enrichedPayload.customer.email];
  else if (type === 'order_placed_customer' || type === 'payment_success_customer' || type === 'payment_failure_customer' || type === 'order_shipped_customer' || type === 'order_delivered_customer') to = [enrichedPayload.order && enrichedPayload.order.customerEmail];
  else if (type === 'vendor_new_order' || type === 'vendor_order_status_update' || type === 'vendor_payout') to = [enrichedPayload.vendorEmail || (store && store.ownerId)];
  else if (type === 'admin_new_user' || type === 'admin_new_order' || type === 'critical_alert') to = getAdminRecipients();
  return {
    to: to.filter(Boolean),
    subject: spec.subject,
    html: spec.html,
    store,
    type,
    replyTo: getStoreSupportEmail(store) || undefined
  };
}

async function sendRawEmail(message, meta) {
  const transporter = createTransporter(message.store);
  if (!transporter) {
    logEmailEvent({ type: meta.type || 'raw', status: 'skipped', to: message.to, subject: message.subject, reason: 'smtp_not_configured' });
    return false;
  }
  const sender = getSender(message.store, message.from, message.replyTo);
  await transporter.sendMail({
    from: sender.from,
    to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
    subject: message.subject,
    html: message.html,
    replyTo: sender.replyTo
  });
  logEmailEvent({ type: meta.type || 'raw', status: 'sent', to: message.to, subject: message.subject, attempt: meta.attempt || 1 });
  return true;
}

async function sendTypedEmail(type, payload, options) {
  const message = await buildTypedEmail(type, payload);
  if (!message.to.length) {
    logEmailEvent({ type, status: 'skipped', subject: message.subject, reason: 'missing_recipient' });
    return false;
  }
  try {
    return await sendRawEmail(message, { type, attempt: options && options.attempt || 1 });
  } catch (error) {
    logEmailEvent({ type, status: 'failed', to: message.to, subject: message.subject, attempt: options && options.attempt || 1, error: error && error.message ? error.message : String(error) });
    throw error;
  }
}

function queueEmail(type, payload, options) {
  const attempt = Number(options && options.attempt || 1);
  const delayMs = Number(options && options.delayMs || 0);
  const timer = setTimeout(async () => {
    try {
      await sendTypedEmail(type, payload, { attempt });
    } catch (error) {
      if (attempt < EMAIL_RETRY_ATTEMPTS) {
        queueEmail(type, payload, { attempt: attempt + 1, delayMs: EMAIL_RETRY_DELAY_MS * attempt });
      }
    }
  }, delayMs);
  if (timer && typeof timer.unref === 'function') timer.unref();
  return Promise.resolve(true);
}

async function sendEmail(typeOrMessage, payload) {
  if (typeOrMessage && typeof typeOrMessage === 'object' && typeOrMessage.to) {
    try {
      return await sendRawEmail(typeOrMessage, { type: 'raw', attempt: 1 });
    } catch (error) {
      logEmailEvent({ type: 'raw', status: 'failed', to: typeOrMessage.to, subject: typeOrMessage.subject, error: error && error.message ? error.message : String(error) });
      return false;
    }
  }
  try {
    return await sendTypedEmail(typeOrMessage, payload, { attempt: 1 });
  } catch (error) {
    return false;
  }
}

function sendPasswordResetEmail(email, resetLink) {
  return sendEmail('password_reset', { email, resetLink });
}

function sendPasswordChangedEmail(email, name) {
  return queueEmail('password_changed', { email, name });
}

function sendOrderConfirmation(order, store) {
  return queueEmail('order_placed_customer', { order, store });
}

function sendMerchantNewOrderAlert(order, store, vendorEmail) {
  return queueEmail('vendor_new_order', { order, store, vendorEmail });
}

function sendVendorWelcomeEmail(user, store) {
  return queueEmail('vendor_welcome', { user, store });
}

function sendCustomerWelcomeEmail(customer, store) {
  return queueEmail('customer_welcome', { customer, store });
}

function sendVerificationEmail(user, role, store, verifyUrl) {
  return queueEmail('email_verification', { user, role, store, verifyUrl });
}

function sendPaymentSuccessEmail(order, store) {
  return queueEmail('payment_success_customer', { order, store });
}

function sendPaymentFailureEmail(order, store) {
  return queueEmail('payment_failure_customer', { order, store });
}

function sendOrderShippedEmail(order, store) {
  return queueEmail('order_shipped_customer', { order, store });
}

function sendOrderDeliveredEmail(order, store) {
  return queueEmail('order_delivered_customer', { order, store });
}

function sendVendorOrderStatusUpdate(order, store, vendorEmail) {
  return queueEmail('vendor_order_status_update', { order, store, vendorEmail });
}

function sendAdminNewUserAlert(user, role, store) {
  return queueEmail('admin_new_user', { user, role, store });
}

function sendAdminNewOrderAlert(order, store) {
  return queueEmail('admin_new_order', { order, store });
}

function sendCriticalAlert(title, message, context) {
  return queueEmail('critical_alert', { title, message, context });
}

module.exports = {
  sendEmail,
  queueEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendOrderConfirmation,
  sendMerchantNewOrderAlert,
  sendVendorWelcomeEmail,
  sendCustomerWelcomeEmail,
  sendVerificationEmail,
  sendPaymentSuccessEmail,
  sendPaymentFailureEmail,
  sendOrderShippedEmail,
  sendOrderDeliveredEmail,
  sendVendorOrderStatusUpdate,
  sendAdminNewUserAlert,
  sendAdminNewOrderAlert,
  sendCriticalAlert
};
