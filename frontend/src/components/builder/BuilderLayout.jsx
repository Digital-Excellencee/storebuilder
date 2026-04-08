import React from 'react';

export default function BuilderLayout({ sidebar, canvas, settings }) {
  return (
    <div className="builder-layout">
      <aside className="builder-column builder-column-left">{sidebar}</aside>
      <section className="builder-column builder-column-center">{canvas}</section>
      <aside className="builder-column builder-column-right">{settings}</aside>
    </div>
  );
}
