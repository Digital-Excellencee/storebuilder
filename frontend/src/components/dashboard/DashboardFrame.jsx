import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth';
import { DASHBOARD_NAV_SECTIONS, DASHBOARD_MOBILE_LINKS } from '../../lib/dashboard-nav';

function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default function DashboardFrame({ activeKey, title, subtitle, children, actions }) {
  const { vendor, logoutVendor } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const store = vendor && vendor.store ? vendor.store : { name: 'Store', slug: '' };
  const user = vendor && vendor.user ? vendor.user : { email: '' };
  const initials = useMemo(() => {
    const words = String(store.name || user.email || 'SB').trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join('') || 'SB';
  }, [store.name, user.email]);

  useEffect(() => {
    function onWindowClick(event) {
      if (!event.target.closest('[data-dash-account]')) {
        setAccountOpen(false);
      }
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setAccountOpen(false);
      }
    }
    window.addEventListener('click', onWindowClick);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('click', onWindowClick);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div className={cn('dash-shell', sidebarOpen && 'sidebar-open')}>
      <div className="dash-topbar">
        <div className="dash-topbar-left">
          <button className="dash-hamburger" type="button" onClick={() => setSidebarOpen((prev) => !prev)} aria-label="Menu"><span /><span /><span /></button>
          <div className="dash-brand-block">
            <div className="dash-brand-mark">S</div>
            <div className="dash-brand-copy"><strong>StoreBanao</strong><span>Merchant Dashboard</span></div>
          </div>
        </div>
        <div className="dash-topbar-center">
          <div className="dash-store-chip">
            <span className="dash-store-icon">🏪</span>
            <div className="dash-store-copy"><strong>{store.name}</strong><span>/{store.slug}</span></div>
          </div>
        </div>
        <div className="dash-topbar-actions">
          <span className="dash-live-pill"><span className="dash-live-dot" />Live</span>
          <a className="dash-outline-btn" href={`/store/${store.slug}`} target="_blank" rel="noopener noreferrer">View Store</a>
          {actions || null}
          <div className="dash-account" data-dash-account>
            <button className="dash-account-trigger" type="button" onClick={(event) => { event.stopPropagation(); setAccountOpen((prev) => !prev); }}>{initials}</button>
            <div className={cn('dash-account-menu', accountOpen && 'open')}>
              <div className="dash-account-email">{user.email}</div>
              <NavLink className="dash-account-link" to="/dashboard/builder/home">Website Builder</NavLink>
              <NavLink className="dash-account-link" to="/dashboard/settings">Store Settings</NavLink>
              <a className="dash-account-link" href="mailto:support@storebanao.com?subject=Help%20with%20dashboard">Help &amp; Support</a>
              <div className="dash-account-divider" />
              <button className="dash-account-link danger" type="button" onClick={() => { logoutVendor(); navigate('/login'); }}>Sign out</button>
            </div>
          </div>
        </div>
      </div>
      <div className="dash-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      <nav className="dash-sidebar">
        {DASHBOARD_NAV_SECTIONS.map((section) => (
          <div key={section.title} className="dash-nav-group">
            <div className="dash-nav-title">{section.title}</div>
            <div className="dash-nav-list">
              {section.items.map((item) => (
                <NavLink key={item.key} className={({ isActive }) => cn('dash-nav-link', isActive && 'active')} to={item.href} onClick={() => setSidebarOpen(false)}>
                  <span className="dash-nav-icon">{item.icon}</span>
                  <span className="dash-nav-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <main className="dash-main admin-shell">
        <div className="dash-content-wrap">
          <div className="dash-page-header"><div><h1 className="dash-page-title">{title}</h1><p className="dash-page-subtitle">{subtitle}</p></div></div>
          {children}
        </div>
      </main>
      <nav className="dash-mobile-nav">
        {DASHBOARD_MOBILE_LINKS.map((item) => (
          <NavLink key={item.key} to={item.href} className={({ isActive }) => isActive ? 'active' : ''}>
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
