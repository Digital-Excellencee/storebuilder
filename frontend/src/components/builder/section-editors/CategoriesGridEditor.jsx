import React from 'react';

export default function CategoriesGridEditor({ section, onChange }) {
  const settings = section.settings || {};
  return (
    <div className="builder-form-grid two">
      <div className="builder-field"><label>Title</label><input value={settings.title || ''} onChange={(event) => onChange({ title: event.target.value })} /></div>
      <div className="builder-field"><label>Subtitle</label><input value={settings.subtitle || ''} onChange={(event) => onChange({ subtitle: event.target.value })} /></div>
      <div className="builder-field"><label>Limit</label><input type="number" min="1" max="12" value={settings.limit || 8} onChange={(event) => onChange({ limit: Number(event.target.value || 0) })} /></div>
      <div className="builder-field"><label>Source</label><select value={settings.source || 'store_categories'} onChange={(event) => onChange({ source: event.target.value })}><option value="store_categories">Store Categories</option></select></div>
      <div className="builder-field"><label>Background Color</label><input value={settings.backgroundColor || ''} onChange={(event) => onChange({ backgroundColor: event.target.value })} /></div>
      <div className="builder-field"><label>Padding Top</label><input type="number" value={settings.paddingTop || 24} onChange={(event) => onChange({ paddingTop: Number(event.target.value || 0) })} /></div>
      <div className="builder-field"><label>Padding Bottom</label><input type="number" value={settings.paddingBottom || 24} onChange={(event) => onChange({ paddingBottom: Number(event.target.value || 0) })} /></div>
    </div>
  );
}
