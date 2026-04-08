import React from 'react';

export default function LoadingBlock({ label = 'Loading...' }) {
  return <div className="loading-block">{label}</div>;
}
