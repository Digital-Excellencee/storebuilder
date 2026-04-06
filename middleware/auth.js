const { loadDB } = require('../services/db');
const { setFlash } = require('../helpers/flash');

async function requireAuth(req, res, next) {
  try {
    if (!req.session.userId) {
      setFlash(req, 'error', 'Please log in to continue.');
      res.redirect('/login');
      return;
    }
    const db = await loadDB();
    const user = db.users[req.session.userId];
    if (!user || !user.storeSlug || !db.stores[user.storeSlug]) {
      req.session.userId = null;
      setFlash(req, 'error', 'Your account session is no longer valid.');
      res.redirect('/login');
      return;
    }
    req.db = db;
    req.currentUser = user;
    req.currentStore = db.stores[user.storeSlug];
    next();
  } catch (error) {
    next(error);
  }
}

async function requireSuperAdmin(req, res, next) {
  try {
    if (req.session.superAdminId !== 'superadmin') {
      setFlash(req, 'error', 'Please log in as super admin.');
      res.redirect('/superadmin');
      return;
    }
    const db = await loadDB();
    req.db = db;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { requireAuth, requireSuperAdmin };
