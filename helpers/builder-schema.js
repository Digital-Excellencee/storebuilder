const { generateId } = require('./html');

const BUILDER_SECTION_TYPES = ['hero', 'banner', 'categories-grid', 'product-grid', 'rich-text'];
const BUILDER_SCHEMA_VERSION = 1;

function cloneBuilderValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function getStoreSeed(store) {
  const safeStore = store && typeof store === 'object' ? store : {};
  const products = Array.isArray(safeStore.products) ? safeStore.products : [];
  const categories = Array.isArray(safeStore.categories) ? safeStore.categories : [];
  const firstProduct = products.find((item) => item && item.active !== false) || products[0] || null;
  const firstCategory = categories[0] || null;
  return {
    name: String(safeStore.name || 'Your Store').trim() || 'Your Store',
    description: String(safeStore.description || 'Fast delivery and premium products').trim() || 'Fast delivery and premium products',
    firstProductImage: firstProduct && firstProduct.image ? String(firstProduct.image).trim() : '',
    firstCategoryName: firstCategory && firstCategory.name ? String(firstCategory.name).trim() : ''
  };
}

function createEmptySection(type, store) {
  const safeType = BUILDER_SECTION_TYPES.includes(String(type || '').trim()) ? String(type || '').trim() : 'rich-text';
  const seed = getStoreSeed(store);
  const base = {
    id: generateId('sec'),
    type: safeType,
    settings: {}
  };
  if (safeType === 'hero') {
    base.settings = {
      title: `Welcome to ${seed.name}`,
      subtitle: seed.description,
      buttonText: 'Shop now',
      buttonLink: '/shop',
      image: seed.firstProductImage,
      backgroundColor: '#ffffff',
      textAlign: 'left',
      paddingTop: 48,
      paddingBottom: 48
    };
  } else if (safeType === 'banner') {
    base.settings = {
      title: `Discover ${seed.name}`,
      subtitle: seed.description,
      buttonText: 'Explore',
      buttonLink: '/shop',
      image: seed.firstProductImage,
      backgroundColor: '#f8fafc',
      textAlign: 'left',
      paddingTop: 32,
      paddingBottom: 32
    };
  } else if (safeType === 'categories-grid') {
    base.settings = {
      title: 'Shop by category',
      subtitle: seed.firstCategoryName ? `Start with ${seed.firstCategoryName}` : 'Organize products by category.',
      limit: 8,
      source: 'store_categories',
      backgroundColor: '#ffffff',
      paddingTop: 24,
      paddingBottom: 24
    };
  } else if (safeType === 'product-grid') {
    base.settings = {
      title: 'Featured products',
      subtitle: 'Showcase your best sellers and new arrivals.',
      source: 'featured',
      limit: 8,
      showPrice: true,
      showRating: true,
      backgroundColor: '#ffffff',
      paddingTop: 24,
      paddingBottom: 24
    };
  } else {
    base.settings = {
      title: `Why choose ${seed.name}?`,
      body: seed.description,
      buttonText: 'Track order',
      buttonLink: '/track-order',
      textAlign: 'left',
      backgroundColor: '#ffffff',
      paddingTop: 24,
      paddingBottom: 24
    };
  }
  return base;
}

function normalizeSection(section, store) {
  const base = createEmptySection(section && section.type, store);
  const incoming = section && typeof section === 'object' ? section : {};
  base.id = String(incoming.id || base.id).trim() || base.id;
  base.type = BUILDER_SECTION_TYPES.includes(String(incoming.type || '').trim()) ? String(incoming.type).trim() : base.type;
  base.settings = Object.assign({}, base.settings, incoming.settings && typeof incoming.settings === 'object' ? incoming.settings : {});
  return base;
}

function createDefaultHomePageSchema(store) {
  return {
    schemaVersion: BUILDER_SCHEMA_VERSION,
    pageKey: 'home',
    pageType: 'builder',
    title: 'Home',
    sections: [
      createEmptySection('hero', store),
      createEmptySection('categories-grid', store),
      createEmptySection('product-grid', store)
    ]
  };
}

function normalizeBuilderSchema(schema, store) {
  const base = createDefaultHomePageSchema(store);
  const incoming = schema && typeof schema === 'object' ? cloneBuilderValue(schema) : {};
  const next = {
    schemaVersion: BUILDER_SCHEMA_VERSION,
    pageKey: String(incoming.pageKey || base.pageKey).trim() || base.pageKey,
    pageType: 'builder',
    title: String(incoming.title || base.title).trim() || base.title,
    sections: Array.isArray(incoming.sections) ? incoming.sections.map((section) => normalizeSection(section, store)) : base.sections
  };
  return next;
}

function validateBuilderSchema(schema) {
  const errors = [];
  if (!schema || typeof schema !== 'object') {
    errors.push('Schema must be an object.');
  } else {
    if (!Array.isArray(schema.sections)) errors.push('Schema sections must be an array.');
    (Array.isArray(schema.sections) ? schema.sections : []).forEach((section, index) => {
      if (!section || typeof section !== 'object') {
        errors.push(`Section ${index + 1} must be an object.`);
        return;
      }
      if (!BUILDER_SECTION_TYPES.includes(String(section.type || '').trim())) {
        errors.push(`Section ${index + 1} has invalid type.`);
      }
      if (!section.settings || typeof section.settings !== 'object') {
        errors.push(`Section ${index + 1} settings must be an object.`);
      }
    });
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  BUILDER_SECTION_TYPES,
  BUILDER_SCHEMA_VERSION,
  cloneBuilderValue,
  createEmptySection,
  createDefaultHomePageSchema,
  normalizeBuilderSchema,
  validateBuilderSchema
};
