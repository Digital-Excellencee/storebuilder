const express = require('express');
const router = express.Router();
const { loadDB, saveDB, ensureDirectories, ensureStoreSettings, removeStoredFile } = require('../services/db');
const { hashPassword, verifyPassword } = require('../services/password');
const { escapeHtml, formatDate, formatMoney } = require('../helpers/html');
const { validateEmail } = require('../helpers/validation');
const { setFlash, renderFlashMessages } = require('../helpers/flash');
const { getStatusBadge, getStoreOwner, getPlatformStartedAt } = require('../helpers/store');
const { renderHtmlShell } = require('../views/shell');
const { renderGlobalError } = require('../views/error-views');
const { requireSuperAdmin } = require('../middleware/auth');
const { route } = require('../middleware/error');
const { renderSuperAdminLayout } = require('../views/admin');

router.get('/superadmin', route(async (req, res) => {
  if (req.session.superAdminId === 'superadmin') {
    res.redirect('/superadmin/dashboard');
    return;
  }
  const flash = renderFlashMessages(req);
  res.send(renderHtmlShell('Super Admin Login', `
      <div class="auth-wrap"><div class="card auth-card">${flash}<h1 class="section-title">Super admin login</h1><form method="POST" action="/superadmin/login" class="form-grid"><div class="field"><label for="email">Email</label><input id="email" name="email" type="email" required></div><div class="field"><label for="password">Password</label><input id="password" name="password" type="password" required></div><div class="actions"><button class="btn" type="submit">Login</button><a class="btn btn-secondary" href="/">Back to Home</a></div></form></div></div>
    `));
}));

router.post('/superadmin/login', route(async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!validateEmail(email)) { setFlash(req, 'error', 'Please enter a valid email address.'); res.redirect('/superadmin'); return; }
    if (!password) { setFlash(req, 'error', 'Password is required.'); res.redirect('/superadmin'); return; }
    const db = await loadDB();
    const superAdmin = db && db.superAdmin ? db.superAdmin : null;
    if (!superAdmin || email !== String(superAdmin.email || '').trim().toLowerCase()) { setFlash(req, 'error', 'Invalid super admin credentials.'); res.redirect('/superadmin'); return; }
    const valid = verifyPassword(password, db.superAdmin.passwordHash);
    if (!valid) { setFlash(req, 'error', 'Invalid super admin credentials.'); res.redirect('/superadmin'); return; }
    req.session.superAdminId = 'superadmin';
    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    setFlash(req, 'success', 'Super admin login successful.');
    res.redirect('/superadmin/dashboard');
  } catch (error) {
    setFlash(req, 'error', 'Super admin login failed.');
    res.redirect('/superadmin');
  }
}));

router.get('/superadmin/dashboard', requireSuperAdmin, route(async (req, res) => {
  const db = req.db;
  const stores = Object.values(db.stores);
  const users = Object.values(db.users);
  const totalProducts = stores.reduce((sum, store) => sum + store.products.length, 0);
  const totalOrders = stores.reduce((sum, store) => sum + store.orders.length, 0);
  const recentStores = [...stores].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const flash = renderFlashMessages(req);
  res.send(renderSuperAdminLayout(req, 'Super Admin Dashboard', 'dashboard', `
      ${flash}
      <section class="stat-grid">
        <div class="card stat-card"><div class="stat-label">Total Stores</div><div class="stat-value">${escapeHtml(String(stores.length))}</div></div>
        <div class="card stat-card"><div class="stat-label">Total Users</div><div class="stat-value">${escapeHtml(String(users.length))}</div></div>
        <div class="card stat-card"><div class="stat-label">Total Products</div><div class="stat-value">${escapeHtml(String(totalProducts))}</div></div>
        <div class="card stat-card"><div class="stat-label">Total Orders</div><div class="stat-value">${escapeHtml(String(totalOrders))}</div></div>
      </section>
      <section class="grid-2" style="margin-top:20px;">
        <div class="card panel"><h2 class="section-title" style="font-size:24px;">Platform started</h2><p class="section-subtitle">${escapeHtml(formatDate(getPlatformStartedAt()))}</p>
          <!-- Subdomain migration disabled -->
        </div>
        <div class="card panel"><h2 class="section-title" style="font-size:24px;">Recent stores</h2>${recentStores.length ? `<div class="table-wrap"><table><thead><tr><th>Store</th><th>Owner</th><th>Created</th></tr></thead><tbody>${recentStores.map((store) => { const owner = getStoreOwner(db, store); return `<tr><td><a href="/superadmin/store/${encodeURIComponent(store.slug)}">${escapeHtml(store.name)}</a></td><td>${escapeHtml(owner ? owner.email : '-')}</td><td>${escapeHtml(formatDate(store.createdAt))}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">No stores yet.</div>'}</div>
      </section>
    `));
}));

router.post('/superadmin/migrate-subdomains', requireSuperAdmin, route(async (req, res) => {
  // Subdomain migration disabled - using /store/:slug
  setFlash(req, 'error', 'Subdomain migration is disabled. Using /store/:slug instead.');
  res.redirect('/superadmin/dashboard');
}));

router.get('/superadmin/stores', requireSuperAdmin, route(async (req, res) => {
  const db = req.db;
  const stores = [...Object.values(db.stores)].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const html = stores.length ? `<div class="table-wrap"><table><thead><tr><th>Store</th><th>Slug</th><th>Owner</th><th>Products</th><th>Orders</th><th>Revenue</th><th>Created</th><th>Actions</th></tr></thead><tbody>${stores.map((store) => { const owner = getStoreOwner(db, store); const revenue = (store.orders || []).reduce((sum, o) => sum + (Number(o.amount) || 0), 0); return `<tr><td><a href="/superadmin/store/${encodeURIComponent(store.slug)}">${escapeHtml(store.name)}</a></td><td>${escapeHtml(store.slug)}</td><td>${escapeHtml(owner ? owner.email : '-')}</td><td>${escapeHtml(String(store.products.length))}</td><td>${escapeHtml(String(store.orders.length))}</td><td>${escapeHtml(formatMoney(revenue))}</td><td>${escapeHtml(formatDate(store.createdAt))}</td><td><div class="actions"><a class="btn btn-secondary" href="/store/${encodeURIComponent(store.slug)}" target="_blank" rel="noopener noreferrer">View</a><a class="btn btn-secondary" href="/superadmin/store/${encodeURIComponent(store.slug)}">Manage</a>${owner ? `<a class="btn" href="/superadmin/login-as-vendor/${encodeURIComponent(owner.id)}">Login</a>` : ''}<form method="POST" action="/superadmin/store/${encodeURIComponent(store.slug)}/delete" onsubmit="return confirm('Delete this store and owner account?');"><button class="btn btn-danger" type="submit">Delete</button></form></div></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">No stores found.</div>';
  res.send(renderSuperAdminLayout(req, 'Stores', 'stores', `<section class="card panel"><h1 class="section-title">All stores</h1><p class="section-subtitle">Review every tenant store on the platform.</p>${html}</section>`));
}));

router.get('/superadmin/store/:slug', requireSuperAdmin, route(async (req, res) => {
  const db = req.db;
  const store = db.stores[req.params.slug];
  if (!store) { setFlash(req, 'error', 'Store not found.'); res.redirect('/superadmin/stores'); return; }
  const owner = getStoreOwner(db, store);
  const productsHtml = store.products.length ? `<div class="table-wrap"><table><thead><tr><th>Image</th><th>Name</th><th>Price</th><th>Stock</th><th>Active</th><th>Delete</th></tr></thead><tbody>${store.products.map((product) => `<tr><td>${product.image ? `<img class="product-thumb" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" style="width:50px;height:50px;object-fit:cover;border-radius:8px;">` : '-'}</td><td>${escapeHtml(product.name)}</td><td>${escapeHtml(formatMoney(product.price))}</td><td>${escapeHtml(product.stock)}</td><td>${product.active !== false ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-secondary">Inactive</span>'}</td><td><form method="POST" action="/superadmin/products/${encodeURIComponent(store.slug)}/delete/${encodeURIComponent(product.id)}" onsubmit="return confirm('Delete this product?');"><button class="btn btn-danger" type="submit">Delete</button></form></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No products found.</div>';
  const ordersHtml = store.orders.length ? `<div class="table-wrap"><table><thead><tr><th>Order</th><th>Product</th><th>Customer</th><th>Status</th><th>Amount</th><th>Date</th></tr></thead><tbody>${store.orders.map((order) => `<tr><td>${escapeHtml(order.id)}</td><td>${escapeHtml(order.productName)}</td><td>${escapeHtml(order.customerName || 'WhatsApp lead')}</td><td>${getStatusBadge(order.status)}</td><td>${escapeHtml(formatMoney(order.amount))}</td><td>${escapeHtml(formatDate(order.createdAt))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No orders found.</div>';
  const revenue = (store.orders || []).reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  res.send(renderSuperAdminLayout(req, `Manage ${store.name}`, 'stores', `
      <section class="grid-2">
        <div class="card panel">
          <h1 class="section-title">${escapeHtml(store.name)}</h1>
          <div class="kpi-list">
            <div class="kpi-item"><strong>Slug</strong><span>${escapeHtml(store.slug)}</span></div>
            <div class="kpi-item"><strong>Owner</strong><span>${escapeHtml(owner ? owner.email : '-')}</span></div>
            <div class="kpi-item"><strong>WhatsApp</strong><span>${escapeHtml(store.whatsapp || '-')}</span></div>
            <div class="kpi-item"><strong>Visits</strong><span>${escapeHtml(String(store.visits))}</span></div>
            <div class="kpi-item"><strong>Products</strong><span>${store.products.length}</span></div>
            <div class="kpi-item"><strong>Orders</strong><span>${store.orders.length}</span></div>
            <div class="kpi-item"><strong>Revenue</strong><span>${formatMoney(revenue)}</span></div>
            <div class="kpi-item"><strong>Created</strong><span>${escapeHtml(formatDate(store.createdAt))}</span></div>
          </div>
          <div style="height:16px;"></div>
          ${owner ? `<a class="btn" href="/superadmin/login-as-vendor/${encodeURIComponent(owner.id)}" style="margin-bottom:8px;display:inline-block;">🚀 Login as Vendor</a><br>` : ''}
          <form method="POST" action="/superadmin/store/${encodeURIComponent(store.slug)}/delete" onsubmit="return confirm('Delete this store and owner account?');"><button class="btn btn-danger" type="submit">Delete Store</button></form>
        </div>
        <div class="card panel">
          <h2 class="section-title" style="font-size:24px;">Store logo</h2>${store.logo ? `<img class="logo-preview" src="${escapeHtml(store.logo)}" alt="${escapeHtml(store.name)}">` : '<div class="empty">No logo uploaded</div>'}<div style="height:16px;"></div><p class="muted">${escapeHtml(store.description)}</p>
          <div style="height:12px;"></div>
          <a class="btn btn-secondary" href="/store/${encodeURIComponent(store.slug)}" target="_blank" rel="noopener noreferrer">View Storefront</a>
        </div>
      </section>
      <section class="card panel"><h2 class="section-title" style="font-size:24px;">Products (${store.products.length})</h2>${productsHtml}</section>
      <section class="card panel"><h2 class="section-title" style="font-size:24px;">Orders (${store.orders.length})</h2>${ordersHtml}</section>
    `));
}));

router.post('/superadmin/store/:slug/delete', requireSuperAdmin, route(async (req, res) => {
  try {
    const db = await loadDB();
    const slug = String(req.params.slug || '').trim();
    const store = db.stores[slug];
    if (!store) { setFlash(req, 'error', 'Store not found.'); res.redirect('/superadmin/stores'); return; }
    if (store.logo) await removeStoredFile(store.logo);
    await Promise.all(store.products.flatMap((product) => (Array.isArray(product.images) ? product.images : [product.image])).filter(Boolean).map((image) => removeStoredFile(image)));
    if (store.ownerId && db.users[store.ownerId]) delete db.users[store.ownerId];
    delete db.stores[slug];
    await saveDB(db);
    // Subdomain deletion disabled - using /store/:slug
    setFlash(req, 'success', 'Store and owner account deleted successfully.');
    res.redirect('/superadmin/stores');
  } catch (error) {
    setFlash(req, 'error', 'Unable to delete store.');
    res.redirect('/superadmin/stores');
  }
}));

router.get('/superadmin/users', requireSuperAdmin, route(async (req, res) => {
  const db = req.db;
  const users = [...Object.values(db.users)].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const html = users.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Store</th><th>Products</th><th>Orders</th><th>Revenue</th><th>Joined</th><th>Actions</th></tr></thead><tbody>${users.map((user) => { const store = db.stores[user.storeSlug]; const revenue = (store ? store.orders : []).reduce((sum, o) => sum + (Number(o.amount) || 0), 0); return `<tr><td>${escapeHtml(user.name)}</td><td>${escapeHtml(user.email)}</td><td>${escapeHtml(user.phone || '-')}</td><td><a href="/superadmin/vendor/${encodeURIComponent(user.id)}">${escapeHtml(store ? store.name : '-')}</a></td><td>${escapeHtml(String(store ? store.products.length : 0))}</td><td>${escapeHtml(String(store ? store.orders.length : 0))}</td><td>${escapeHtml(formatMoney(revenue))}</td><td>${escapeHtml(formatDate(user.createdAt))}</td><td><div class="actions"><a class="btn btn-secondary" href="/superadmin/vendor/${encodeURIComponent(user.id)}/orders">Orders</a><a class="btn btn-secondary" href="/superadmin/vendor/${encodeURIComponent(user.id)}/products">Products</a><a class="btn" href="/superadmin/login-as-vendor/${encodeURIComponent(user.id)}">Login</a><form method="POST" action="/superadmin/user/${encodeURIComponent(user.id)}/delete" onsubmit="return confirm('Delete this user and store?');"><button class="btn btn-danger" type="submit">Delete</button></form></div></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">No users found.</div>';
  res.send(renderSuperAdminLayout(req, 'Users', 'users', `<section class="card panel"><h1 class="section-title">All users</h1><p class="section-subtitle">Manage registered store owners across the platform.</p>${html}</section>`));
}));

router.post('/superadmin/user/:id/delete', requireSuperAdmin, route(async (req, res) => {
  try {
    const db = await loadDB();
    const userId = String(req.params.id || '').trim();
    const user = db.users[userId];
    if (!user) { setFlash(req, 'error', 'User not found.'); res.redirect('/superadmin/users'); return; }
    const store = db.stores[user.storeSlug];
    if (store) {
        if (store.logo) await removeStoredFile(store.logo);
        await Promise.all(store.products.flatMap((product) => (Array.isArray(product.images) ? product.images : [product.image])).filter(Boolean).map((image) => removeStoredFile(image)));
      delete db.stores[user.storeSlug];
      // Subdomain deletion disabled - using /store/:slug
    }
    delete db.users[userId];
    await saveDB(db);
    setFlash(req, 'success', 'User and store deleted successfully.');
    res.redirect('/superadmin/users');
  } catch (error) {
    setFlash(req, 'error', 'Unable to delete user.');
    res.redirect('/superadmin/users');
  }
}));

router.post('/superadmin/products/:slug/delete/:id', requireSuperAdmin, route(async (req, res) => {
  try {
    const db = await loadDB();
    const slug = String(req.params.slug || '').trim();
    const productId = String(req.params.id || '').trim();
    const store = db.stores[slug];
    if (!store) { setFlash(req, 'error', 'Store not found.'); res.redirect('/superadmin/stores'); return; }
    const productIndex = store.products.findIndex((product) => product.id === productId);
    if (productIndex === -1) { setFlash(req, 'error', 'Product not found.'); res.redirect(`/superadmin/store/${encodeURIComponent(slug)}`); return; }
    const removed = store.products.splice(productIndex, 1)[0];
    await Promise.all((Array.isArray(removed.images) ? removed.images : [removed.image]).filter(Boolean).map((image) => removeStoredFile(image)));
    await saveDB(db);
    setFlash(req, 'success', 'Product deleted successfully.');
    res.redirect(`/superadmin/store/${encodeURIComponent(slug)}`);
  } catch (error) {
    setFlash(req, 'error', 'Unable to delete product.');
    res.redirect(`/superadmin/store/${encodeURIComponent(req.params.slug)}`);
  }
}));

router.post('/superadmin/subdomain/create/:slug', requireSuperAdmin, route(async (req, res) => {
  // Subdomain creation disabled - using /store/:slug
  setFlash(req, 'error', 'Subdomain creation is disabled. Using /store/:slug instead.');
  res.redirect('/superadmin/stores');
}));

router.get('/superadmin/logout', route(async (req, res) => {
  try {
    await new Promise((resolve) => req.session.destroy(() => resolve()));
    res.redirect('/superadmin');
  } catch (error) {
    res.redirect('/superadmin');
  }
}));

router.get('/superadmin/login-as-vendor/:userId', requireSuperAdmin, route(async (req, res) => {
  const db = req.db;
  const user = db.users[req.params.userId];
  if (!user || !user.storeSlug) {
    setFlash(req, 'error', 'User not found.');
    res.redirect('/superadmin/users');
    return;
  }
  req.session.userId = user.id;
  req.session.storeSlug = user.storeSlug;
  req.session.fromSuperAdmin = true;
  res.redirect('/dashboard');
}));

router.get('/superadmin/return-from-vendor', route(async (req, res) => {
  if (!req.session.superAdminId) {
    setFlash(req, 'error', 'Super admin session not found.');
    res.redirect('/superadmin');
    return;
  }
  req.session.userId = null;
  req.session.storeSlug = null;
  req.session.fromSuperAdmin = null;
  setFlash(req, 'success', 'Returned to Super Admin panel.');
  res.redirect('/superadmin/dashboard');
}));

router.get('/superadmin/vendor/:userId/orders', requireSuperAdmin, route(async (req, res) => {
  const db = req.db;
  const user = db.users[req.params.userId];
  if (!user || !user.storeSlug) {
    setFlash(req, 'error', 'User not found.');
    res.redirect('/superadmin/users');
    return;
  }
  const store = db.stores[user.storeSlug];
  if (!store) {
    setFlash(req, 'error', 'Store not found.');
    res.redirect('/superadmin/users');
    return;
  }
  const orders = store.orders || [];
  const ordersHtml = orders.length ? `<div class="table-wrap"><table><thead><tr><th>Order ID</th><th>Customer</th><th>Product</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>${orders.map((order) => `<tr><td>${escapeHtml(order.id || '-')}</td><td>${escapeHtml(order.customerName || 'N/A')}</td><td>${escapeHtml(order.productName || 'N/A')}</td><td>${escapeHtml(formatMoney(order.amount))}</td><td>${getStatusBadge(order.status)}</td><td>${escapeHtml(formatDate(order.createdAt))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No orders found.</div>';
  const flash = renderFlashMessages(req);
  res.send(renderSuperAdminLayout(req, `Orders - ${store.name}`, 'vendors', `
      ${flash}
      <section class="card panel">
        <div class="page-header">
          <div>
            <h1 class="section-title">Orders: ${escapeHtml(store.name)}</h1>
            <p class="section-subtitle">Total ${orders.length} orders</p>
          </div>
          <div class="action-bar">
            <a class="btn btn-secondary" href="/superadmin/vendor/${encodeURIComponent(user.id)}">← Back to Store</a>
            <a class="btn" href="/superadmin/login-as-vendor/${encodeURIComponent(user.id)}">Login as Vendor</a>
          </div>
        </div>
        ${ordersHtml}
      </section>
    `));
}));

router.get('/superadmin/vendor/:userId/products', requireSuperAdmin, route(async (req, res) => {
  const db = req.db;
  const user = db.users[req.params.userId];
  if (!user || !user.storeSlug) {
    setFlash(req, 'error', 'User not found.');
    res.redirect('/superadmin/users');
    return;
  }
  const store = db.stores[user.storeSlug];
  if (!store) {
    setFlash(req, 'error', 'Store not found.');
    res.redirect('/superadmin/users');
    return;
  }
  const products = store.products || [];
  const productsHtml = products.length ? `<div class="table-wrap"><table><thead><tr><th>Image</th><th>Name</th><th>Price</th><th>Compare Price</th><th>Stock</th><th>Active</th></tr></thead><tbody>${products.map((product) => `<tr><td>${product.image ? `<img class="product-thumb" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" style="width:50px;height:50px;object-fit:cover;border-radius:8px;">` : '-'}</td><td>${escapeHtml(product.name || '-')}</td><td>${escapeHtml(formatMoney(product.price))}</td><td>${product.comparePrice ? escapeHtml(formatMoney(product.comparePrice)) : '-'}</td><td>${escapeHtml(String(product.stock || 0))}</td><td>${product.active !== false ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-secondary">Inactive</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No products found.</div>';
  const flash = renderFlashMessages(req);
  res.send(renderSuperAdminLayout(req, `Products - ${store.name}`, 'vendors', `
      ${flash}
      <section class="card panel">
        <div class="page-header">
          <div>
            <h1 class="section-title">Products: ${escapeHtml(store.name)}</h1>
            <p class="section-subtitle">Total ${products.length} products</p>
          </div>
          <div class="action-bar">
            <a class="btn btn-secondary" href="/superadmin/vendor/${encodeURIComponent(user.id)}">← Back to Store</a>
            <a class="btn" href="/superadmin/login-as-vendor/${encodeURIComponent(user.id)}">Login as Vendor</a>
          </div>
        </div>
        ${productsHtml}
      </section>
    `));
}));

router.get('/superadmin/vendor/:userId/customers', requireSuperAdmin, route(async (req, res) => {
  const db = req.db;
  const user = db.users[req.params.userId];
  if (!user || !user.storeSlug) {
    setFlash(req, 'error', 'User not found.');
    res.redirect('/superadmin/users');
    return;
  }
  const store = db.stores[user.storeSlug];
  if (!store) {
    setFlash(req, 'error', 'Store not found.');
    res.redirect('/superadmin/users');
    return;
  }
  const customers = Object.values(db.customers || {}).filter((c) => c.storeSlug === user.storeSlug);
  const customersHtml = customers.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Orders</th><th>Joined</th></tr></thead><tbody>${customers.map((customer) => `<tr><td>${escapeHtml(customer.name || '-')}</td><td>${escapeHtml(customer.email || '-')}</td><td>${escapeHtml(customer.phone || '-')}</td><td>${escapeHtml(String((customer.orderIds || []).length))}</td><td>${escapeHtml(formatDate(customer.createdAt))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No customers found.</div>';
  const flash = renderFlashMessages(req);
  res.send(renderSuperAdminLayout(req, `Customers - ${store.name}`, 'vendors', `
      ${flash}
      <section class="card panel">
        <div class="page-header">
          <div>
            <h1 class="section-title">Customers: ${escapeHtml(store.name)}</h1>
            <p class="section-subtitle">Total ${customers.length} customers</p>
          </div>
          <div class="action-bar">
            <a class="btn btn-secondary" href="/superadmin/vendor/${encodeURIComponent(user.id)}">← Back to Store</a>
            <a class="btn" href="/superadmin/login-as-vendor/${encodeURIComponent(user.id)}">Login as Vendor</a>
          </div>
        </div>
        ${customersHtml}
      </section>
    `));
}));

router.get('/superadmin/vendor/:userId', requireSuperAdmin, route(async (req, res) => {
  const db = req.db;
  const user = db.users[req.params.userId];
  if (!user || !user.storeSlug) {
    setFlash(req, 'error', 'User not found.');
    res.redirect('/superadmin/users');
    return;
  }
  const store = db.stores[user.storeSlug];
  if (!store) {
    setFlash(req, 'error', 'Store not found.');
    res.redirect('/superadmin/users');
    return;
  }
  const flash = renderFlashMessages(req);
  const pendingOrders = (store.orders || []).filter((o) => o.status === 'pending').length;
  const totalRevenue = (store.orders || []).reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  res.send(renderSuperAdminLayout(req, `Manage: ${store.name}`, 'vendors', `
      ${flash}
      <section class="grid-2">
        <div class="card panel">
          <h1 class="section-title">${escapeHtml(store.name)}</h1>
          <div class="kpi-list">
            <div class="kpi-item"><strong>Owner</strong><span>${escapeHtml(user.name || '-')}</span></div>
            <div class="kpi-item"><strong>Email</strong><span>${escapeHtml(user.email || '-')}</span></div>
            <div class="kpi-item"><strong>Phone</strong><span>${escapeHtml(user.phone || '-')}</span></div>
            <div class="kpi-item"><strong>Store Slug</strong><span>${escapeHtml(store.slug)}</span></div>
            <div class="kpi-item"><strong>Created</strong><span>${escapeHtml(formatDate(store.createdAt))}</span></div>
          </div>
        </div>
        <div class="card panel">
          <h2 class="section-title" style="font-size:24px;">Quick Stats</h2>
          <div class="kpi-list">
            <div class="kpi-item"><strong>Products</strong><span>${store.products.length}</span></div>
            <div class="kpi-item"><strong>Orders</strong><span>${store.orders.length}</span></div>
            <div class="kpi-item"><strong>Pending Orders</strong><span>${pendingOrders}</span></div>
            <div class="kpi-item"><strong>Revenue</strong><span>${formatMoney(totalRevenue)}</span></div>
          </div>
        </div>
      </section>
      <section class="card panel">
        <h2 class="section-title" style="font-size:24px;">A-Z Management</h2>
        <div class="option-grid" style="margin-top:16px;">
          <a class="option-card" href="/superadmin/vendor/${encodeURIComponent(user.id)}/orders">
            <div style="font-size:28px;">📦</div>
            <div class="option-card-title">Orders</div>
            <div class="option-card-sub">${store.orders.length} orders</div>
          </a>
          <a class="option-card" href="/superadmin/vendor/${encodeURIComponent(user.id)}/products">
            <div style="font-size:28px;">🏷️</div>
            <div class="option-card-title">Products</div>
            <div class="option-card-sub">${store.products.length} products</div>
          </a>
          <a class="option-card" href="/superadmin/vendor/${encodeURIComponent(user.id)}/customers">
            <div style="font-size:28px;">👥</div>
            <div class="option-card-title">Customers</div>
            <div class="option-card-sub">View all customers</div>
          </a>
          <a class="option-card" href="/dashboard/settings?section=store-details&asVendorId=${encodeURIComponent(user.id)}" target="_blank">
            <div style="font-size:28px;">⚙️</div>
            <div class="option-card-title">Settings</div>
            <div class="option-card-sub">Store configuration</div>
          </a>
          <a class="option-card" href="/dashboard/theme?asVendorId=${encodeURIComponent(user.id)}" target="_blank">
            <div style="font-size:28px;">🎨</div>
            <div class="option-card-title">Theme</div>
            <div class="option-card-sub">Customize appearance</div>
          </a>
          <a class="option-card" href="/store/${encodeURIComponent(store.slug)}" target="_blank">
            <div style="font-size:28px;">🛒</div>
            <div class="option-card-title">View Store</div>
            <div class="option-card-sub">Open storefront</div>
          </a>
        </div>
      </section>
      <section class="card panel">
        <h2 class="section-title" style="font-size:24px;">Actions</h2>
        <div class="action-bar" style="margin-top:16px;">
          <a class="btn" href="/superadmin/login-as-vendor/${encodeURIComponent(user.id)}">🚀 Login as Vendor</a>
          <a class="btn btn-secondary" href="/superadmin/stores">← Back to Stores</a>
          <a class="btn btn-secondary" href="/superadmin/users">← Back to Users</a>
        </div>
      </section>
    `));
}));

router.get('/superadmin/vendors', requireSuperAdmin, route(async (req, res) => {
  const db = req.db;
  const users = Object.values(db.users).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const html = users.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Store</th><th>Products</th><th>Orders</th><th>Revenue</th><th>Actions</th></tr></thead><tbody>${users.map((user) => { const store = db.stores[user.storeSlug]; const orders = store ? store.orders : []; const revenue = orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0); return `<tr><td>${escapeHtml(user.name || '-')}</td><td>${escapeHtml(user.email || '-')}</td><td>${escapeHtml(user.phone || '-')}</td><td><a href="/superadmin/vendor/${encodeURIComponent(user.id)}">${escapeHtml(store ? store.name : '-')}</a></td><td>${escapeHtml(String(store ? store.products.length : 0))}</td><td>${escapeHtml(String(orders.length))}</td><td>${escapeHtml(formatMoney(revenue))}</td><td><div class="actions"><a class="btn btn-secondary" href="/superadmin/vendor/${encodeURIComponent(user.id)}/orders">Orders</a><a class="btn btn-secondary" href="/superadmin/vendor/${encodeURIComponent(user.id)}/products">Products</a><a class="btn btn-secondary" href="/superadmin/vendor/${encodeURIComponent(user.id)}">Manage</a><a class="btn" href="/superadmin/login-as-vendor/${encodeURIComponent(user.id)}">Login</a></div></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">No vendors found.</div>';
  const flash = renderFlashMessages(req);
  res.send(renderSuperAdminLayout(req, 'Vendors', 'vendors', `
      ${flash}
      <section class="card panel">
        <h1 class="section-title">All Vendors</h1>
        <p class="section-subtitle">Manage all vendor stores, login as vendor, view orders, products and more.</p>
        ${html}
      </section>
    `));
}));

module.exports = router;
