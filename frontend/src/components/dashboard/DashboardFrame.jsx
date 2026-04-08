import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth';
import { DASHBOARD_LINKS } from '../../lib/dashboard-nav';

function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default function DashboardFrame({ activeKey, title, subtitle, children, actions }) {
  const { vendor, logoutVendor } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const store = vendor && vendor.store ? vendor.store : { name: 'Store', slug: '' };
  const user = vendor && vendor.user ? vendor.user : { email: '' };

  return (
    <div className={cn('dashboard-page', sidebarOpen && 'sidebar-open')}>
      <div className="topbar">
        <div className="topbar-left">
          <button className="hamburger" type="button" onClick={() => setSidebarOpen((prev) => !prev)} aria-label="Menu"><span /><span /><span /></button>
          <div className="brand"><strong>Store</strong>Banao</div>
          <div className="topbar-store"><div className="topbar-name">{store.name}</div><div className="topbar-sub">/{store.slug} · {user.email}</div></div>
        </div>
        <div className="topbar-actions">
          <span className="topbar-pill"><span className="topbar-dot" />Live store</span>
          <a className="btn btn-secondary" href={`/store/${store.slug}`} target="_blank" rel="noopener noreferrer">View store</a>
          {actions || null}
          <button className="btn btn-secondary" type="button" onClick={() => { logoutVendor(); navigate('/login'); }}>Sign out</button>
        </div>
      </div>
      <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      <nav className="sidebar">
        {DASHBOARD_LINKS.map((item) => (
          <NavLink key={item.key} className={({ isActive }) => cn('nav-link', isActive && 'active')} to={item.href} onClick={() => setSidebarOpen(false)}>
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="main admin-shell">
        <div className="content-wrap">
          <div className="page-header"><div><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div></div>
          {children}
        </div>
      </main>
      <nav className="mobile-nav">
        {DASHBOARD_LINKS.slice(0, 5).map((item) => (
          <NavLink key={item.key} to={item.href} className={({ isActive }) => isActive ? 'active' : ''}>
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
