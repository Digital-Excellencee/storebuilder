const { formatMoney, formatDate } = require('../helpers/html');

function safe(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function absoluteUrl(pathname) {
  const base = String(process.env.BASE_URL || '').trim().replace(/\/$/, '');
  const path = String(pathname || '').trim();
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) return path;
  if (!base) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function getStoreName(store) {
  return safe(store && store.name ? store.name : 'StoreBanao');
}

function getBrandColor(store) {
  const themeConfig = store && store.themeConfig && typeof store.themeConfig === 'object' ? store.themeConfig : {};
  return safe(themeConfig.primaryColor || '#111827');
}

function getStoreLogo(store) {
  return store && store.logo ? String(store.logo).trim() : '';
}

function renderButton(label, href) {
  if (!label || !href) return '';
  return `<div style="margin:24px 0;"><a href="${safe(href)}" style="display:inline-block;padding:12px 22px;border-radius:12px;background:#111827;color:#ffffff;text-decoration:none;font-weight:700;">${safe(label)}</a></div>`;
}

function renderKeyValue(label, value) {
  return `<tr><td style="padding:10px 0;color:#6b7280;width:160px;vertical-align:top;">${safe(label)}</td><td style="padding:10px 0;color:#111827;font-weight:600;">${safe(value || '-')}</td></tr>`;
}

function renderOrderItems(order) {
  const items = Array.isArray(order && order.items) && order.items.length
    ? order.items
    : [{ name: order && order.productName || 'Order item', quantity: 1, price: order && order.amount || 0, variantSummary: '' }];
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
    <thead>
      <tr style="background:#f8fafc;">
        <th align="left" style="padding:12px;border-bottom:1px solid #e5e7eb;color:#475569;font-size:12px;text-transform:uppercase;">Product</th>
        <th align="left" style="padding:12px;border-bottom:1px solid #e5e7eb;color:#475569;font-size:12px;text-transform:uppercase;">Qty</th>
        <th align="left" style="padding:12px;border-bottom:1px solid #e5e7eb;color:#475569;font-size:12px;text-transform:uppercase;">Price</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item) => `<tr>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;">
          <div style="font-weight:700;color:#111827;">${safe(item.name || item.productName || 'Item')}</div>
          ${item.variantSummary ? `<div style="color:#64748b;font-size:12px;margin-top:4px;">${safe(item.variantSummary)}</div>` : ''}
        </td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#111827;">${safe(String(item.quantity || 1))}</td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#111827;">${safe(formatMoney(item.price || 0))}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function renderShell({ preheader, eyebrow, title, intro, sections, ctaLabel, ctaUrl, footerTitle, footerText, store }) {
  const brandColor = getBrandColor(store);
  const logo = getStoreLogo(store);
  const brandName = getStoreName(store);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safe(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Inter,Arial,sans-serif;color:#111827;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${safe(preheader || intro || title)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:28px 28px 20px;background:linear-gradient(135deg,${brandColor},#1f2937);color:#ffffff;">
              ${logo ? `<div style="margin-bottom:16px;"><img src="${safe(logo)}" alt="${brandName}" style="max-width:140px;max-height:52px;display:block;background:#fff;padding:8px;border-radius:12px;"></div>` : `<div style="display:inline-block;margin-bottom:14px;padding:8px 12px;border:1px solid rgba(255,255,255,.18);border-radius:12px;background:rgba(255,255,255,.08);font-size:15px;font-weight:800;">${brandName}</div>`}
              <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;opacity:.72;">${safe(eyebrow || 'StoreBanao')}</div>
              <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">${safe(title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              ${intro ? `<p style="margin:0 0 18px;color:#4b5563;font-size:15px;line-height:1.7;">${safe(intro)}</p>` : ''}
              ${(sections || []).join('')}
              ${renderButton(ctaLabel, ctaUrl)}
              <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;line-height:1.7;">
                <strong style="display:block;color:#111827;margin-bottom:6px;">${safe(footerTitle || 'Need help?')}</strong>
                ${safe(footerText || 'Reply to this email if you need support.')}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildVerificationSpec(payload) {
  const user = payload.user || {};
  const store = payload.store || null;
  const verifyUrl = absoluteUrl(payload.verifyUrl || '/login');
  const isVendor = payload.role === 'vendor';
  return {
    subject: `${isVendor ? 'Verify your StoreBanao admin email' : 'Verify your account email'}${store ? ` - ${getStoreName(store)}` : ''}`,
    html: renderShell({
      preheader: 'Confirm your email address.',
      eyebrow: isVendor ? 'Vendor Verification' : 'Customer Verification',
      title: 'Verify your email',
      intro: `Hi ${user.name || user.email || 'there'}, please confirm this email address so future account and order emails reach you reliably.`,
      sections: [
        '<p style="margin:0;color:#4b5563;font-size:15px;line-height:1.7;">This verification link is time-sensitive. If you did not create this account, you can ignore this email.</p>'
      ],
      ctaLabel: 'Verify Email',
      ctaUrl: verifyUrl,
      footerTitle: store ? `${getStoreName(store)} Support` : 'StoreBanao Support',
      footerText: store ? `This verification helps ${getStoreName(store)} keep customer communication accurate.` : 'This helps keep your StoreBanao account secure.',
      store
    })
  };
}

function buildPasswordResetSpec(payload) {
  return {
    subject: 'Reset your password',
    html: renderShell({
      preheader: 'Use this secure link to reset your password.',
      eyebrow: 'Account Security',
      title: 'Reset your password',
      intro: 'We received a request to reset your password. Use the secure button below to choose a new one.',
      sections: [
        '<p style="margin:0;color:#4b5563;font-size:15px;line-height:1.7;">This link expires in 1 hour. If you did not request a reset, you can safely ignore this email.</p>'
      ],
      ctaLabel: 'Reset Password',
      ctaUrl: payload.resetLink,
      footerText: 'For security reasons, never share password reset links.',
      store: payload.store || null
    })
  };
}

function buildPasswordChangedSpec(payload) {
  return {
    subject: 'Your password was changed',
    html: renderShell({
      preheader: 'Your account password has been updated.',
      eyebrow: 'Account Security',
      title: 'Password updated successfully',
      intro: `Hi ${payload.name || payload.email || 'there'}, this is a confirmation that your password was changed successfully.`,
      sections: [
        `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${renderKeyValue('Changed at', formatDate(new Date().toISOString()))}</table>`
      ],
      footerText: 'If this was not you, reset your password immediately and review account access.',
      store: payload.store || null
    })
  };
}

function buildVendorWelcomeSpec(payload) {
  const user = payload.user || {};
  const store = payload.store || {};
  return {
    subject: `Welcome to StoreBanao, ${user.name || user.email}`,
    html: renderShell({
      preheader: 'Your store is ready for setup.',
      eyebrow: 'Vendor Welcome',
      title: `Your store ${store.name ? `${store.name} is live` : 'setup is ready'}`,
      intro: `Hi ${user.name || user.email || 'there'}, welcome aboard. Your store dashboard is ready, and you can start adding products, connecting payments, and sharing your storefront.`,
      sections: [
        `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${renderKeyValue('Store', store.name || '-')}${renderKeyValue('Store URL', absoluteUrl(`/store/${store.slug || ''}`))}${renderKeyValue('Login email', user.email || '-')}</table>`
      ],
      ctaLabel: 'Open Dashboard',
      ctaUrl: absoluteUrl('/dashboard'),
      footerTitle: 'Next best step',
      footerText: 'Add your first product, connect payments, and complete the launch checklist.',
      store
    })
  };
}

function buildCustomerWelcomeSpec(payload) {
  const customer = payload.customer || {};
  const store = payload.store || {};
  return {
    subject: `Welcome to ${getStoreName(store)}`,
    html: renderShell({
      preheader: 'Your customer account is ready.',
      eyebrow: 'Customer Welcome',
      title: `Welcome to ${getStoreName(store)}`,
      intro: `Hi ${customer.name || customer.email || 'there'}, your account is ready. You can now track orders, save addresses, and checkout faster next time.`,
      sections: [
        `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${renderKeyValue('Store', store.name || '-')}${renderKeyValue('Account email', customer.email || '-')}</table>`
      ],
      ctaLabel: 'Open My Account',
      ctaUrl: absoluteUrl(`/store/${store.slug || ''}/account`),
      footerTitle: `${getStoreName(store)} Support`,
      footerText: 'Keep this email for future order and account updates.',
      store
    })
  };
}

function buildOrderPlacedSpec(payload) {
  const order = payload.order || {};
  const store = payload.store || {};
  return {
    subject: `Order placed: ${order.orderNumber || order.id} | ${getStoreName(store)}`,
    html: renderShell({
      preheader: 'Your order has been received.',
      eyebrow: 'Order Confirmation',
      title: 'Your order has been placed',
      intro: `Thanks ${order.customerName || 'for shopping with us'}. We have received your order and will keep you updated.`,
      sections: [
        renderOrderItems(order),
        `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;">${renderKeyValue('Order ID', order.orderNumber || order.id)}${renderKeyValue('Tracking ID', order.trackingCode || '-')}${renderKeyValue('Payment method', order.paymentMethod || order.paymentMode || '-')}${renderKeyValue('Shipping address', order.shippingAddress || '-')}${renderKeyValue('Total', formatMoney(order.amount || 0))}</table>`
      ],
      ctaLabel: 'Track Order',
      ctaUrl: absoluteUrl(`/store/${store.slug || ''}/order/${order.trackingCode || order.id}`),
      footerTitle: `${getStoreName(store)} Support`,
      footerText: 'Reply to this email if you need any help with your order.',
      store
    })
  };
}

function buildPaymentResultSpec(payload, success) {
  const order = payload.order || {};
  const store = payload.store || {};
  return {
    subject: `${success ? 'Payment successful' : 'Payment failed'}: ${order.orderNumber || order.id}`,
    html: renderShell({
      preheader: success ? 'Your payment has been confirmed.' : 'Your payment could not be completed.',
      eyebrow: success ? 'Payment Success' : 'Payment Failed',
      title: success ? 'Payment received successfully' : 'Payment could not be verified',
      intro: success
        ? `We have received your payment for order ${order.orderNumber || order.id}.`
        : `We could not confirm payment for order ${order.orderNumber || order.id}. You can retry from your order page if needed.`,
      sections: [
        `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${renderKeyValue('Order ID', order.orderNumber || order.id)}${renderKeyValue('Tracking ID', order.trackingCode || '-')}${renderKeyValue('Amount', formatMoney(order.amount || 0))}</table>`
      ],
      ctaLabel: success ? 'View Order' : 'Retry Payment',
      ctaUrl: absoluteUrl(`/store/${store.slug || ''}/order/${order.trackingCode || order.id}`),
      footerText: success ? 'You will receive separate shipping and delivery updates.' : 'If money was deducted but the payment failed, contact support with your order ID.',
      store
    })
  };
}

function buildOrderStatusSpec(payload, mode) {
  const order = payload.order || {};
  const store = payload.store || {};
  const isShipped = mode === 'shipped';
  const title = isShipped ? 'Your order is on the way' : 'Your order has been delivered';
  const intro = isShipped
    ? `Good news. Order ${order.orderNumber || order.id} has been shipped.`
    : `Order ${order.orderNumber || order.id} has been delivered. Thank you for shopping with ${getStoreName(store)}.`;
  const footerText = isShipped ? 'Keep your tracking ID handy while checking updates.' : 'We would love to serve you again soon.';
  return {
    subject: `${title} | ${order.orderNumber || order.id}`,
    html: renderShell({
      preheader: title,
      eyebrow: isShipped ? 'Order Shipped' : 'Order Delivered',
      title,
      intro,
      sections: [
        `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${renderKeyValue('Order ID', order.orderNumber || order.id)}${renderKeyValue('Tracking ID', order.trackingCode || '-')}${renderKeyValue('Courier', order.shippingProvider || (order.shippingResponse && order.shippingResponse.courier_name) || '-')}${renderKeyValue('Status', order.status || (isShipped ? 'shipped' : 'delivered'))}</table>`
      ],
      ctaLabel: 'Track Order',
      ctaUrl: absoluteUrl(`/store/${store.slug || ''}/order/${order.trackingCode || order.id}`),
      footerText,
      store
    })
  };
}

function buildVendorNewOrderSpec(payload) {
  const order = payload.order || {};
  const store = payload.store || {};
  return {
    subject: `New order received: ${order.orderNumber || order.id}`,
    html: renderShell({
      preheader: 'A new order has been placed on your store.',
      eyebrow: 'Vendor Alert',
      title: 'You received a new order',
      intro: `A customer just placed an order on ${getStoreName(store)}.`,
      sections: [
        renderOrderItems(order),
        `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;">${renderKeyValue('Order ID', order.orderNumber || order.id)}${renderKeyValue('Customer', order.customerName || '-')}${renderKeyValue('Phone', order.customerPhone || '-')}${renderKeyValue('Amount', formatMoney(order.amount || 0))}${renderKeyValue('Payment method', order.paymentMethod || '-')}</table>`
      ],
      ctaLabel: 'Open Orders',
      ctaUrl: absoluteUrl('/dashboard/orders'),
      footerText: 'Process the order quickly to keep customer trust high.',
      store
    })
  };
}

function buildVendorOrderStatusSpec(payload) {
  const order = payload.order || {};
  const store = payload.store || {};
  return {
    subject: `Order status updated: ${order.orderNumber || order.id}`,
    html: renderShell({
      preheader: 'An order status was changed from the dashboard.',
      eyebrow: 'Vendor Update',
      title: `Order is now ${order.status || 'updated'}`,
      intro: `Order ${order.orderNumber || order.id} was updated in your dashboard.`,
      sections: [
        `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${renderKeyValue('Order ID', order.orderNumber || order.id)}${renderKeyValue('Customer', order.customerName || '-')}${renderKeyValue('Status', order.status || '-')}${renderKeyValue('Tracking ID', order.trackingCode || '-')}</table>`
      ],
      ctaLabel: 'Review Order',
      ctaUrl: absoluteUrl('/dashboard/orders'),
      footerText: 'This notification helps you audit order changes made by your team.',
      store
    })
  };
}

function buildAdminUserSpec(payload) {
  const user = payload.user || {};
  const store = payload.store || {};
  return {
    subject: `New ${payload.role === 'customer' ? 'customer' : 'vendor'} registered`,
    html: renderShell({
      preheader: 'A new account was created on the platform.',
      eyebrow: 'Admin Alert',
      title: 'New user registered',
      intro: `${user.name || user.email || 'A user'} just created an account.`,
      sections: [
        `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${renderKeyValue('Role', payload.role || 'user')}${renderKeyValue('Email', user.email || '-')}${renderKeyValue('Store', store.name || store.slug || '-')}</table>`
      ],
      footerText: 'This alert is generated for administrative visibility.',
      store
    })
  };
}

function buildAdminOrderSpec(payload) {
  const order = payload.order || {};
  const store = payload.store || {};
  return {
    subject: `Admin alert: new order ${order.orderNumber || order.id}`,
    html: renderShell({
      preheader: 'A new order was placed on the platform.',
      eyebrow: 'Admin Alert',
      title: 'New order placed',
      intro: `An order was placed on ${getStoreName(store)}.`,
      sections: [
        `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${renderKeyValue('Store', store.name || store.slug || '-')}${renderKeyValue('Order ID', order.orderNumber || order.id)}${renderKeyValue('Customer', order.customerName || '-')}${renderKeyValue('Amount', formatMoney(order.amount || 0))}</table>`
      ],
      footerText: 'Use this alert for platform-level monitoring.',
      store
    })
  };
}

function buildCriticalAlertSpec(payload) {
  return {
    subject: `Critical alert: ${payload.title || 'System event'}`,
    html: renderShell({
      preheader: payload.title || 'Critical platform alert',
      eyebrow: 'Critical Alert',
      title: payload.title || 'Critical platform alert',
      intro: payload.message || 'A critical event was reported by the platform.',
      sections: [
        `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${renderKeyValue('Context', payload.context || '-')}${renderKeyValue('Time', formatDate(new Date().toISOString()))}</table>`
      ],
      footerText: 'Review server logs and health endpoints for more details.',
      store: payload.store || null
    })
  };
}

function buildPayoutSpec(payload) {
  const payout = payload.payout || {};
  return {
    subject: `Payout update${payout.reference ? `: ${payout.reference}` : ''}`,
    html: renderShell({
      preheader: 'Your earnings payout update.',
      eyebrow: 'Payout Update',
      title: 'Your payout summary',
      intro: 'A payout event was recorded for your account.',
      sections: [
        `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${renderKeyValue('Reference', payout.reference || '-')}${renderKeyValue('Amount', formatMoney(payout.amount || 0))}${renderKeyValue('Status', payout.status || '-')}</table>`
      ],
      footerText: 'This template is ready for future payout automation.',
      store: payload.store || null
    })
  };
}

function getEmailTemplate(type, payload) {
  if (type === 'email_verification') return buildVerificationSpec(payload);
  if (type === 'password_reset') return buildPasswordResetSpec(payload);
  if (type === 'password_changed') return buildPasswordChangedSpec(payload);
  if (type === 'vendor_welcome') return buildVendorWelcomeSpec(payload);
  if (type === 'customer_welcome') return buildCustomerWelcomeSpec(payload);
  if (type === 'order_placed_customer') return buildOrderPlacedSpec(payload);
  if (type === 'payment_success_customer') return buildPaymentResultSpec(payload, true);
  if (type === 'payment_failure_customer') return buildPaymentResultSpec(payload, false);
  if (type === 'order_shipped_customer') return buildOrderStatusSpec(payload, 'shipped');
  if (type === 'order_delivered_customer') return buildOrderStatusSpec(payload, 'delivered');
  if (type === 'vendor_new_order') return buildVendorNewOrderSpec(payload);
  if (type === 'vendor_order_status_update') return buildVendorOrderStatusSpec(payload);
  if (type === 'admin_new_user') return buildAdminUserSpec(payload);
  if (type === 'admin_new_order') return buildAdminOrderSpec(payload);
  if (type === 'critical_alert') return buildCriticalAlertSpec(payload);
  if (type === 'vendor_payout') return buildPayoutSpec(payload);
  return {
      subject: payload && payload.subject ? String(payload.subject) : 'Notification',
      html: renderShell({
        title: payload && payload.title ? payload.title : 'Notification',
        intro: payload && payload.message ? payload.message : 'A new notification is available.',
        store: payload && payload.store ? payload.store : null
      })
    };
}

module.exports = {
  absoluteUrl,
  getEmailTemplate,
  safe
};
