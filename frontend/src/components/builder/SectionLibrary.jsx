import React from 'react';
import { SECTION_TYPES } from '../../lib/builder-schema';

export default function SectionLibrary({ onAdd, disabled }) {
  return (
    <section className="builder-panel builder-panel-sticky">
      <div className="builder-panel-head">
        <h2>Section Library</h2>
        <p>Add homepage sections without touching code.</p>
      </div>
      <div className="builder-library-list">
        {SECTION_TYPES.map((item) => (
          <button key={item.type} className="builder-library-item" type="button" onClick={() => onAdd(item.type)} disabled={disabled}>
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
