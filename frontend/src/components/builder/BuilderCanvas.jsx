import React from 'react';
import BuilderSectionCard from './BuilderSectionCard';
import EmptyState from '../common/EmptyState';

export default function BuilderCanvas({ sections, selectedId, onSelect, onMove, onDuplicate, onDelete, store, products, categories, busy }) {
  if (!sections.length) {
    return <EmptyState title="No sections yet" body="Use the section library to add your first homepage section." />;
  }
  return (
    <div className="builder-canvas-list">
      {sections.map((section, index) => (
        <BuilderSectionCard
          key={section.id}
          section={section}
          index={index}
          selected={selectedId === section.id}
          onSelect={onSelect}
          onMove={onMove}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          store={store}
          products={products}
          categories={categories}
          busy={busy}
        />
      ))}
    </div>
  );
}
