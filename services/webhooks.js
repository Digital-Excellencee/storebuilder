async function postWebhook(url, payload) {
  if (!url) return false;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      console.error(`[WEBHOOK ERROR] ${url} -> ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[WEBHOOK ERROR] ${url} -> ${error.message}`);
    return false;
  }
}

async function triggerOrderCreatedWebhooks(store, order) {
  const app = store && store.apps && store.apps.webhooks;
  if (!app || !app.installed || !app.configured || !app.orderCreatedUrl) return false;
  return postWebhook(app.orderCreatedUrl, { event: 'order.created', storeSlug: store.slug, order });
}

module.exports = {
  triggerOrderCreatedWebhooks
};
