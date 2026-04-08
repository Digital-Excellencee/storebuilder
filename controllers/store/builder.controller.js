const { loadDB, getPublishedStoreBuilderPage } = require('../../services/db');

async function getPublishedHomePage(req, res) {
  try {
    const slug = String(req.params.slug || '').trim();
    const db = await loadDB();
    const store = db && db.stores ? db.stores[slug] || null : null;
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const published = await getPublishedStoreBuilderPage(slug, 'home');
    if (!published) {
      return res.status(404).json({ success: false, error: 'Published home page not found' });
    }
    const featuredProducts = (Array.isArray(store.products) ? store.products : []).filter((product) => product.active !== false).slice(0, 8);
    res.json({
      success: true,
      page: published.page,
      snapshot: published.snapshot,
      store: {
        slug: store.slug,
        name: store.name,
        description: store.description,
        logo: store.logo,
        template: store.template,
        theme: store.theme,
        themeConfig: store.themeConfig || {}
      },
      categories: Array.isArray(store.categories) ? store.categories : [],
      featuredProducts
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getPublishedHomePage
};
