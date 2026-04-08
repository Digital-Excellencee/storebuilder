const { loadDB, saveDB } = require('../../services/db');
const { slugify, generateId } = require('../../helpers/html');

function getVendorStore(db, req) {
  const user = db && db.users ? db.users[String(req.apiUserEmail || '').trim().toLowerCase()] || null : null;
  return user && user.storeSlug && db && db.stores ? db.stores[user.storeSlug] || null : null;
}

async function listPages(req, res) {
  try {
    const db = await loadDB();
    const store = getVendorStore(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    res.json({ success: true, pages: Array.isArray(store.pages) ? store.pages : [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function createPage(req, res) {
  try {
    const db = await loadDB();
    const store = getVendorStore(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const title = String(req.body.title || '').trim();
    const slug = slugify(String(req.body.slug || '').trim()) || generateId('page');
    const content = String(req.body.content || '').trim();
    const active = req.body.active !== false;
    if (title.length < 2) return res.status(400).json({ success: false, error: 'Page title required' });
    store.pages = Array.isArray(store.pages) ? store.pages : [];
    const page = { id: generateId('page'), title, slug, content, active, createdAt: new Date().toISOString() };
    store.pages.push(page);
    await saveDB(db);
    res.json({ success: true, page });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function deletePage(req, res) {
  try {
    const db = await loadDB();
    const store = getVendorStore(db, req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    store.pages = Array.isArray(store.pages) ? store.pages : [];
    const index = store.pages.findIndex((entry) => entry.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Page not found' });
    const page = store.pages.splice(index, 1)[0];
    await saveDB(db);
    res.json({ success: true, page });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  listPages,
  createPage,
  deletePage
};
