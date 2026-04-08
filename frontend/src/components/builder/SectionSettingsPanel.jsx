import React from 'react';
import HeroSectionEditor from './section-editors/HeroSectionEditor';
import BannerSectionEditor from './section-editors/BannerSectionEditor';
import CategoriesGridEditor from './section-editors/CategoriesGridEditor';
import ProductGridEditor from './section-editors/ProductGridEditor';
import RichTextSectionEditor from './section-editors/RichTextSectionEditor';
import EmptyState from '../common/EmptyState';

export default function SectionSettingsPanel({ section, onChange, onSave, saveState }) {
  if (!section) {
    return <EmptyState title="Select a section" body="Pick a section from the canvas to edit its settings." />;
  }

  let editor = <RichTextSectionEditor section={section} onChange={onChange} />;
  if (section.type === 'hero') editor = <HeroSectionEditor section={section} onChange={onChange} />;
  else if (section.type === 'banner') editor = <BannerSectionEditor section={section} onChange={onChange} />;
  else if (section.type === 'categories-grid') editor = <CategoriesGridEditor section={section} onChange={onChange} />;
  else if (section.type === 'product-grid') editor = <ProductGridEditor section={section} onChange={onChange} />;

  return (
    <section className="builder-panel builder-panel-sticky">
      <div className="builder-panel-head">
        <h2>Section Settings</h2>
        <p>Editing <strong>{section.type}</strong></p>
      </div>
      {editor}
      <div className="builder-actions-row">
        <button className="btn" type="button" onClick={onSave} disabled={saveState.loading}>{saveState.loading ? 'Saving...' : 'Save Draft'}</button>
        {saveState.saved ? <span className="builder-inline-note success">Saved</span> : null}
      </div>
    </section>
  );
}
