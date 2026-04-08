import React from 'react';

function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default function Alert({ type = 'info', children }) {
  if (!children) return null;
  return <div className={cn('flash', `flash-${type}`)}>{children}</div>;
}
