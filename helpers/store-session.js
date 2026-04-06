const { loadDB, saveDB } = require('../services/db');

function normalizeVariantSelections(value) {
  if (!value || typeof value !== 'object') return {};
  return Object.keys(value).reduce((acc, key) => {
    const selected = String(value[key] || '').trim();
    if (selected) acc[key] = selected;
    return acc;
  }, {});
}

function resolveVariantSelectionState(product, rawSelections) {
  const selections = normalizeVariantSelections(rawSelections);
  let price = Number(product && product.price || 0);
  let stock = Math.max(0, Number(product && product.stock || 0));
  let sku = String(product && product.sku || '').trim();
  let sawVariantStock = false;
  const summary = [];
  (Array.isArray(product && product.variants) ? product.variants : []).forEach((variant) => {
    const selectedLabel = selections[variant.id];
    if (!selectedLabel) return;
    const option = (Array.isArray(variant.options) ? variant.options : []).find((entry) => entry.label === selectedLabel);
    if (!option) return;
    summary.push(`${variant.name}: ${option.label}`);
    if (Number(option.price || 0) > 0) {
      price = Number(option.price || 0);
    }
    if (Number.isFinite(Number(option.stock))) {
      stock = sawVariantStock ? Math.min(stock, Math.max(0, Number(option.stock || 0))) : Math.max(0, Number(option.stock || 0));
      sawVariantStock = true;
    }
    if (option.sku) {
      sku = String(option.sku).trim();
    }
  });
  return {
    selections,
    summary: summary.join(' | '),
    price,
    stock,
    sku
  };
}

function getSessionStoreObject(req, key) {
  if (!req.session[key] || typeof req.session[key] !== 'object') {
    req.session[key] = {};
  }
  return req.session[key];
}

function getCheckoutDraft(req, slug) {
  const drafts = getSessionStoreObject(req, 'checkoutDrafts');
  if (!drafts[slug] || typeof drafts[slug] !== 'object') {
    drafts[slug] = { mode: 'cart', step: 'contact' };
  } else {
    drafts[slug].mode = drafts[slug].mode === 'buy-now' ? 'buy-now' : 'cart';
    drafts[slug].step = ['contact', 'shipping', 'payment'].includes(drafts[slug].step) ? drafts[slug].step : 'contact';
  }
  return drafts[slug];
}

function saveCheckoutDraft(req, slug, draft) {
  const drafts = getSessionStoreObject(req, 'checkoutDrafts');
  drafts[slug] = draft;
}

function clearCheckoutDraft(req, slug) {
  const drafts = getSessionStoreObject(req, 'checkoutDrafts');
  delete drafts[slug];
}

function normalizeCheckoutMode(value) {
  return String(value || '').trim() === 'buy-now' ? 'buy-now' : 'cart';
}

function normalizeCheckoutStep(value) {
  return ['contact', 'shipping', 'payment'].includes(String(value || '').trim()) ? String(value || '').trim() : 'contact';
}

function getCheckoutLineItems(store, draft, cartDetails) {
  if (draft.mode === 'buy-now' && Array.isArray(draft.items) && draft.items.length) {
    return draft.items.map((item) => {
      const product = store.products.find((entry) => entry.id === item.productId);
      if (!product) {
        return null;
      }
      const quantity = Math.max(1, Number(item.quantity || 1));
      const variantState = resolveVariantSelectionState(product, item.variantSelections || {});
      const price = Number(item.price != null ? item.price : variantState.price);
      return {
        product,
        quantity,
        price,
        variantSelections: item.variantSelections || {},
        variantSummary: item.variantSummary || variantState.summary || '',
        sku: item.sku || variantState.sku || product.sku || '',
        subtotal: price * quantity
      };
    }).filter(Boolean);
  }
  return cartDetails;
}

function getStoreCart(req, slug) {
  const carts = getSessionStoreObject(req, 'carts');
  if (!Array.isArray(carts[slug])) {
    carts[slug] = [];
  }
  return carts[slug];
}

function saveStoreCart(req, slug, cart) {
  const carts = getSessionStoreObject(req, 'carts');
  carts[slug] = cart;
}

function getStoreWishlist(req, slug) {
  const wishlists = getSessionStoreObject(req, 'wishlists');
  if (!Array.isArray(wishlists[slug])) {
    wishlists[slug] = [];
  }
  return wishlists[slug];
}

function saveStoreWishlist(req, slug, wishlist) {
  const wishlists = getSessionStoreObject(req, 'wishlists');
  wishlists[slug] = wishlist;
}

async function getLoggedCustomer(req, slug) {
  const customerSession = req.session.customerSession;
  if (!customerSession || customerSession.storeSlug !== slug || !customerSession.email) {
    return null;
  }
  const db = await loadDB();
  const store = db.stores[slug];
  if (!store || !store.customers) {
    return null;
  }
  const customer = store.customers[customerSession.email];
  return customer || null;
}

function setLoggedCustomer(req, slug, email) {
  req.session.customerSession = { storeSlug: slug, email };
  req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
}

function clearLoggedCustomer(req) {
  delete req.session.customerSession;
}

async function addProductToCart(req, slug, productId, quantity, variantSelections) {
  const db = await loadDB();
  const store = db.stores[slug];
  if (!store) {
    return { ok: false, message: 'Store not found.' };
  }
  const product = store.products.find((item) => item.id === productId);
  if (!product) {
    return { ok: false, message: 'Product not found.' };
  }
  const variantState = resolveVariantSelectionState(product, variantSelections);
  const availableStock = Math.max(0, Number(variantState.stock || product.stock || 0));
  if (availableStock <= 0) {
    return { ok: false, message: 'This product is out of stock.' };
  }
  const cart = getStoreCart(req, slug);
  const qty = Math.max(1, Number(quantity || 1));
  const selectionKey = JSON.stringify(variantState.selections || {});
  const existing = cart.find((item) => item.productId === productId && JSON.stringify(item.variantSelections || {}) === selectionKey);
  const nextQty = (existing ? existing.quantity : 0) + qty;
  if (nextQty > availableStock) {
    return { ok: false, message: 'Requested quantity is not available.' };
  }
  if (existing) {
    existing.quantity += qty;
    existing.price = variantState.price;
    existing.variantSummary = variantState.summary;
    existing.variantSelections = variantState.selections;
    existing.sku = variantState.sku;
  } else {
    cart.push({ productId, quantity: qty, price: variantState.price, variantSelections: variantState.selections, variantSummary: variantState.summary, sku: variantState.sku });
  }
  saveStoreCart(req, slug, cart);
  return { ok: true, product, price: variantState.price, variantSummary: variantState.summary };
}

function removeProductFromCart(req, slug, productId) {
  const cart = getStoreCart(req, slug).filter((item) => item.productId !== productId);
  saveStoreCart(req, slug, cart);
}

async function toggleWishlistProduct(req, slug, productId) {
  const wishlist = getStoreWishlist(req, slug);
  const index = wishlist.indexOf(productId);
  const db = await loadDB();
  const store = db.stores[slug];
  const loggedCustomer = await getLoggedCustomer(req, slug);
  if (index >= 0) {
    wishlist.splice(index, 1);
    saveStoreWishlist(req, slug, wishlist);
    if (store && loggedCustomer) {
      store.customers = store.customers && typeof store.customers === 'object' ? store.customers : {};
      const customer = store.customers[loggedCustomer.email];
      if (customer) {
        customer.wishlist = Array.isArray(customer.wishlist) ? customer.wishlist.filter((item) => item !== productId) : [];
        await saveDB(db);
      }
    }
    return false;
  }
  wishlist.push(productId);
  saveStoreWishlist(req, slug, wishlist);
  if (store && loggedCustomer) {
    store.customers = store.customers && typeof store.customers === 'object' ? store.customers : {};
    const customer = store.customers[loggedCustomer.email];
    if (customer) {
      customer.wishlist = Array.isArray(customer.wishlist) ? customer.wishlist : [];
      if (!customer.wishlist.includes(productId)) {
        customer.wishlist.push(productId);
      }
      await saveDB(db);
    }
  }
  return true;
}

function getCartDetails(store, cart) {
  return cart.map((item) => {
    const product = store.products.find((p) => p.id === item.productId);
    const quantity = Math.max(1, Number(item.quantity || 1));
    const price = Number(item && item.price != null ? item.price : (product ? product.price : 0));
    return {
      product,
      quantity,
      price,
      variantSelections: item && item.variantSelections ? item.variantSelections : {},
      variantSummary: item && item.variantSummary ? item.variantSummary : '',
      sku: item && item.sku ? item.sku : (product && product.sku ? product.sku : ''),
      subtotal: price * quantity
    };
  }).filter((item) => item.product);
}

module.exports = {
  getSessionStoreObject,
  getCheckoutDraft,
  saveCheckoutDraft,
  clearCheckoutDraft,
  normalizeCheckoutMode,
  normalizeCheckoutStep,
  getCheckoutLineItems,
  getStoreCart,
  saveStoreCart,
  getStoreWishlist,
  saveStoreWishlist,
  getLoggedCustomer,
  setLoggedCustomer,
  clearLoggedCustomer,
  normalizeVariantSelections,
  resolveVariantSelectionState,
  addProductToCart,
  removeProductFromCart,
  toggleWishlistProduct,
  getCartDetails
};
