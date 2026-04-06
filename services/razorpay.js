const crypto = require('crypto');

function getRazorpayConfig(store) {
  const app = store && store.apps && store.apps.razorpay;
  if (!app || !app.installed || !app.configured || !app.keyId || !app.keySecret) {
    return null;
  }
  return app;
}

async function createRazorpayOrder(store, order) {
  const app = getRazorpayConfig(store);
  if (!app) return null;
  const auth = Buffer.from(`${app.keyId}:${app.keySecret}`).toString('base64');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: Math.round(Number(order.amount || 0) * 100),
      currency: 'INR',
      receipt: order.orderNumber,
      notes: { trackingCode: order.trackingCode, storeSlug: store.slug }
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Razorpay order creation failed: ${text}`);
  }
  return response.json();
}

function verifyRazorpaySignature(store, gatewayOrderId, paymentId, signature) {
  const app = getRazorpayConfig(store);
  if (!app) return false;
  const expected = crypto.createHmac('sha256', app.keySecret).update(`${gatewayOrderId}|${paymentId}`).digest('hex');
  return expected === signature;
}

module.exports = {
  getRazorpayConfig,
  createRazorpayOrder,
  verifyRazorpaySignature
};
