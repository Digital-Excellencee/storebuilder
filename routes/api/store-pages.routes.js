const express = require('express');
const router = express.Router();
const { loadDB } = require('../../services/db');

router.get('/:slug/page/:pageSlug', async (req, res) => {
  try {
    const db = await loadDB();
    const store = db && db.stores ? db.stores[String(req.params.slug || '').trim()] || null : null;
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const pageSlug = String(req.params.pageSlug || '').trim();
    const page = (store.pages || []).find((entry) => entry.active !== false && String(entry.slug || '').trim() === pageSlug);
    if (!page) return res.status(404).json({ success: false, error: 'Page not found' });
    res.json({ success: true, page });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
