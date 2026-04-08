import React from 'react';
import SectionPreviewRenderer from './SectionPreviewRenderer';

export default function BuilderSectionCard({ section, index, selected, onSelect, onMove, onDuplicate, onDelete, store, products, categories, busy }) {
  return (
    <article className={`builder-section-card${selected ? ' active' : ''}`}>
      <div className="builder-section-card-head">
        <div>
          <span className="builder-section-step">Section {index + 1}</span>
          <strong>{section.type}</strong>
        </div>
        <button className="builder-link-btn" type="button" onClick={() => onSelect(section.id)}>Edit</button>
      </div>
      <SectionPreviewRenderer section={section} store={store} products={products} categories={categories} />
      <div className="builder-section-actions">
        <button type="button" onClick={() => onMove(section.id, 'up')} disabled={busy}>Move Up</button>
        <button type="button" onClick={() => onMove(section.id, 'down')} disabled={busy}>Move Down</button>
        <button type="button" onClick={() => onDuplicate(section.id)} disabled={busy}>Duplicate</button>
        <button type="button" className="danger" onClick={() => onDelete(section.id)} disabled={busy}>Delete</button>
      </div>
    </article>
  );
}
