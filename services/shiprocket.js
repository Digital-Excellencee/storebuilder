function parseIndianAddress(address) {
  const text = String(address || '').trim();
  const pinMatch = text.match(/(\d{6})/);
  const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
  return {
    address: text || 'Address',
    pincode: pinMatch ? pinMatch[1] : '000000',
    city: parts.length >= 2 ? parts[parts.length - 2] : 'NA',
    state: parts.length >= 3 ? parts[parts.length - 1].replace(/\d{6}/, '').trim() || 'NA' : 'NA'
  };
}

async function getShiprocketToken(store) {
  const app = store && store.apps && store.apps.shiprocket;
  if (!app || !app.installed || !app.configured || !app.email || !app.password) {
    return '';
  }
  try {
    const response = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: app.email, password: app.password })
    });
    if (!response.ok) {
      console.error('[SHIPROCKET] auth failed', response.status);
      return '';
    }
    const data = await response.json();
    return data && data.token ? data.token : '';
  } catch (error) {
    console.error('[SHIPROCKET] auth error', error.message);
    return '';
  }
}

async function createShiprocketOrder(store, order) {
  const token = await getShiprocketToken(store);
  if (!token) return null;
  const address = parseIndianAddress(order.shippingAddress);
  const payload = {
    order_id: order.orderNumber,
    order_date: order.createdAt,
    pickup_location: store.apps.shiprocket.pickupLocation || 'Primary',
    billing_customer_name: order.customerName,
    billing_last_name: '',
    billing_address: address.address,
    billing_city: address.city,
    billing_pincode: address.pincode,
    billing_state: address.state,
    billing_country: 'India',
    billing_email: order.customerEmail || `${order.customerPhone || 'customer'}@example.com`,
    billing_phone: order.customerPhone || '9999999999',
    shipping_is_billing: true,
    order_items: Array.isArray(order.items) ? order.items.map((item) => ({
      name: item.name,
      sku: item.sku || item.productId || 'SKU',
      units: item.quantity || 1,
      selling_price: item.price || 0
    })) : [],
    payment_method: order.paymentMode === 'online' ? 'Prepaid' : 'COD',
    sub_total: Number(order.subtotal || order.amount || 0),
    length: 10,
    breadth: 10,
    height: 10,
    weight: 0.5
  };
  try {
    const response = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[SHIPROCKET] create order failed', response.status, data);
      return null;
    }
    console.log(`[SHIPROCKET] Order pushed ${order.orderNumber}`);
    return data;
  } catch (error) {
    console.error('[SHIPROCKET] create order error', error.message);
    return null;
  }
}

module.exports = {
  createShiprocketOrder
};
