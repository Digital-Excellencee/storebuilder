import React from 'react';

export default function RichTextSectionEditor({ section, onChange }) {
  const settings = section.settings || {};
  return (
    <div className="builder-form-grid two">
      <div className="builder-field"><label>Title</label><input value={settings.title || ''} onChange={(event) => onChange({ title: event.target.value })} /></div>
      <div className="builder-field"><label>Body</label><textarea value={settings.body || ''} onChange={(event) => onChange({ body: event.target.value })} /></div>
      <div className="builder-field"><label>Button Text</label><input value={settings.buttonText || ''} onChange={(event) => onChange({ buttonText: event.target.value })} /></div>
      <div className="builder-field"><label>Button Link</label><input value={settings.buttonLink || ''} onChange={(event) => onChange({ buttonLink: event.target.value })} /></div>
      <div className="builder-field"><label>Text Align</label><select value={settings.textAlign || 'left'} onChange={(event) => onChange({ textAlign: event.target.value })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></div>
      <div className="builder-field"><label>Background Color</label><input value={settings.backgroundColor || ''} onChange={(event) => onChange({ backgroundColor: event.target.value })} /></div>
      <div className="builder-field"><label>Padding Top</label><input type="number" value={settings.paddingTop || 24} onChange={(event) => onChange({ paddingTop: Number(event.target.value || 0) })} /></div>
      <div className="builder-field"><label>Padding Bottom</label><input type="number" value={settings.paddingBottom || 24} onChange={(event) => onChange({ paddingBottom: Number(event.target.value || 0) })} /></div>
    </div>
  );
}
