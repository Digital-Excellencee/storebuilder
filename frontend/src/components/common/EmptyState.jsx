import React from 'react';

export default function EmptyState({ title, body, action }) {
  return (
    <div className="store-empty">
      <h3>{title}</h3>
      <p>{body}</p>
      {action || null}
    </div>
  );
}
