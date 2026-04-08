import React from 'react';

function formatMoney(value) {
  const amount = Number(value || 0);
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: amount % 1 ? 2 : 0 })}`;
}

export default function SectionPreviewRenderer({ section, store, products, categories }) {
  const settings = section.settings || {};
  if (section.type === 'hero') {
    return (
      <div className="builder-preview-box builder-preview-hero" style={{ background: settings.backgroundColor || '#fff' }}>
        <div className="builder-preview-copy" style={{ textAlign: settings.textAlign || 'left' }}>
          <span className="builder-preview-eyebrow">Hero</span>
          <h3>{settings.title || store.name}</h3>
          <p>{settings.subtitle || store.description}</p>
          <div className="builder-preview-actions"><span>{settings.buttonText || 'Shop now'}</span></div>
        </div>
        <div className="builder-preview-media">{settings.image ? <img src={settings.image} alt={settings.title || store.name} /> : <div className="builder-preview-placeholder">Image</div>}</div>
      </div>
    );
  }
  if (section.type === 'banner') {
    return (
      <div className="builder-preview-box" style={{ background: settings.backgroundColor || '#f8fafc' }}>
        <span className="builder-preview-eyebrow">Banner</span>
        <h3>{settings.title || 'Banner title'}</h3>
        <p>{settings.subtitle || 'Banner subtitle'}</p>
      </div>
    );
  }
  if (section.type === 'categories-grid') {
    return (
      <div className="builder-preview-box" style={{ background: settings.backgroundColor || '#fff' }}>
        <span className="builder-preview-eyebrow">Categories</span>
        <h3>{settings.title || 'Shop by category'}</h3>
        <div className="builder-preview-grid small">{(categories || []).slice(0, Number(settings.limit || 4)).map((category) => <div key={category.id || category.name} className="builder-preview-chip">{category.name}</div>)}</div>
      </div>
    );
  }
  if (section.type === 'product-grid') {
    return (
      <div className="builder-preview-box" style={{ background: settings.backgroundColor || '#fff' }}>
        <span className="builder-preview-eyebrow">Products</span>
        <h3>{settings.title || 'Featured products'}</h3>
        <div className="builder-preview-grid">{(products || []).slice(0, Number(settings.limit || 4)).map((product) => <div key={product.id} className="builder-preview-product"><div className="builder-preview-product-media">{product.image ? <img src={product.image} alt={product.name} /> : <div className="builder-preview-placeholder">Image</div>}</div><strong>{product.name}</strong><span>{formatMoney(product.price)}</span></div>)}</div>
      </div>
    );
  }
  return (
    <div className="builder-preview-box" style={{ background: settings.backgroundColor || '#fff', textAlign: settings.textAlign || 'left' }}>
      <span className="builder-preview-eyebrow">Rich Text</span>
      <h3>{settings.title || 'Content section'}</h3>
      <p>{settings.body || 'Add store story, trust, or delivery notes here.'}</p>
    </div>
  );
}
