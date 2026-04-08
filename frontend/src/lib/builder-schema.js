export const SECTION_TYPES = [
  { type: 'hero', label: 'Hero', description: 'Intro banner with CTA.' },
  { type: 'banner', label: 'Banner', description: 'Promotional strip or campaign banner.' },
  { type: 'categories-grid', label: 'Categories Grid', description: 'Show product categories.' },
  { type: 'product-grid', label: 'Product Grid', description: 'Highlight products.' },
  { type: 'rich-text', label: 'Rich Text', description: 'Free text with CTA.' }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createSection(type) {
  const safeType = SECTION_TYPES.find((item) => item.type === type)?.type || 'rich-text';
  const base = { id: makeId('sec'), type: safeType, settings: {} };
  if (safeType === 'hero') {
    base.settings = {
      title: 'Welcome to our store',
      subtitle: 'Fast delivery and premium products',
      buttonText: 'Shop now',
      buttonLink: '/shop',
      image: '',
      backgroundColor: '#ffffff',
      textAlign: 'left',
      paddingTop: 48,
      paddingBottom: 48
    };
  } else if (safeType === 'banner') {
    base.settings = {
      title: 'Seasonal drop',
      subtitle: 'Promote a sale or launch here.',
      buttonText: 'Explore',
      buttonLink: '/shop',
      image: '',
      backgroundColor: '#f8fafc',
      textAlign: 'left',
      paddingTop: 32,
      paddingBottom: 32
    };
  } else if (safeType === 'categories-grid') {
    base.settings = {
      title: 'Shop by category',
      limit: 8,
      source: 'store_categories',
      subtitle: 'Help shoppers jump into the right catalog section.',
      backgroundColor: '#ffffff',
      paddingTop: 24,
      paddingBottom: 24
    };
  } else if (safeType === 'product-grid') {
    base.settings = {
      title: 'Featured products',
      source: 'featured',
      limit: 8,
      showPrice: true,
      showRating: true,
      subtitle: 'Display top products to drive clicks.',
      backgroundColor: '#ffffff',
      paddingTop: 24,
      paddingBottom: 24
    };
  } else {
    base.settings = {
      title: 'Tell your story',
      body: 'Use this block to explain why customers should buy from you.',
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

export function createDefaultHomePageSchema() {
  return {
    schemaVersion: 1,
    pageKey: 'home',
    pageType: 'builder',
    title: 'Home',
    sections: [
      createSection('hero'),
      createSection('categories-grid'),
      createSection('product-grid')
    ]
  };
}

export function normalizeSchema(schema) {
  const base = createDefaultHomePageSchema();
  const input = schema && typeof schema === 'object' ? clone(schema) : {};
  return {
    schemaVersion: 1,
    pageKey: String(input.pageKey || base.pageKey),
    pageType: 'builder',
    title: String(input.title || base.title),
    sections: Array.isArray(input.sections) ? input.sections.map((section) => {
      const defaults = createSection(section && section.type);
      return {
        ...defaults,
        ...(section || {}),
        id: String(section && section.id || defaults.id),
        type: defaults.type,
        settings: { ...defaults.settings, ...((section && section.settings) || {}) }
      };
    }) : base.sections
  };
}

export function moveItemUp(items, targetId) {
  const next = clone(items || []);
  const index = next.findIndex((item) => item.id === targetId);
  if (index > 0) {
    const [item] = next.splice(index, 1);
    next.splice(index - 1, 0, item);
  }
  return next;
}

export function moveItemDown(items, targetId) {
  const next = clone(items || []);
  const index = next.findIndex((item) => item.id === targetId);
  if (index >= 0 && index < next.length - 1) {
    const [item] = next.splice(index, 1);
    next.splice(index + 1, 0, item);
  }
  return next;
}

export function duplicateSection(sections, targetId) {
  const next = clone(sections || []);
  const index = next.findIndex((item) => item.id === targetId);
  if (index >= 0) {
    const item = clone(next[index]);
    item.id = makeId('sec');
    next.splice(index + 1, 0, item);
  }
  return next;
}

export function deleteSection(sections, targetId) {
  return (sections || []).filter((item) => item.id !== targetId);
}
