export const DASHBOARD_NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: '▦' },
      { key: 'analytics', label: 'Analytics', href: '/dashboard/analytics', icon: '⌁' },
      { key: 'system-status', label: 'System Status', href: '/dashboard/system-status', icon: '◉' }
    ]
  },
  {
    title: 'Catalog',
    items: [
      { key: 'products', label: 'Products', href: '/dashboard/products', icon: '◫' },
      { key: 'categories', label: 'Categories', href: '/dashboard/categories', icon: '◳' },
      { key: 'collections', label: 'Collections', href: '/dashboard/collections', icon: '◈' },
      { key: 'media', label: 'Media', href: '/dashboard/media', icon: '◴' },
      { key: 'bulk-upload', label: 'Bulk Upload', href: '/dashboard/bulk-upload', icon: '⇪' }
    ]
  },
  {
    title: 'Sales',
    items: [
      { key: 'orders', label: 'Orders', href: '/dashboard/orders', icon: '⟡' },
      { key: 'customers', label: 'Customers', href: '/dashboard/customers', icon: '◔' },
      { key: 'leads', label: 'Leads', href: '/dashboard/leads', icon: '◌' },
      { key: 'abandoned-carts', label: 'Abandoned', href: '/dashboard/abandoned-carts', icon: '⌂' },
      { key: 'coupons', label: 'Coupons', href: '/dashboard/coupons', icon: '✦' }
    ]
  },
  {
    title: 'Storefront',
    items: [
      { key: 'builder', label: 'Website Builder', href: '/dashboard/builder/home', icon: '🧱' },
      { key: 'theme', label: 'Themes', href: '/dashboard/theme', icon: '◐' },
      { key: 'display-settings', label: 'Display', href: '/dashboard/display-settings', icon: '▥' },
      { key: 'pages', label: 'Pages', href: '/dashboard/pages', icon: '▤' },
      { key: 'domain', label: 'Domain', href: '/dashboard/domain', icon: '◉' }
    ]
  },
  {
    title: 'Operations',
    items: [
      { key: 'payments', label: 'Payments', href: '/dashboard/payments', icon: '₪' },
      { key: 'shipping', label: 'Shipping', href: '/dashboard/shipping', icon: '⇄' },
      { key: 'tax', label: 'Tax', href: '/dashboard/tax', icon: '₹' },
      { key: 'notifications', label: 'Notifications', href: '/dashboard/notifications', icon: '🔔' },
      { key: 'whatsapp-marketing', label: 'WhatsApp', href: '/dashboard/whatsapp-marketing', icon: '◎' },
      { key: 'tracking', label: 'Tracking', href: '/dashboard/tracking', icon: '▣' }
    ]
  },
  {
    title: 'Advanced',
    items: [
      { key: 'apps', label: 'Apps', href: '/dashboard/apps', icon: '◫' },
      { key: 'settings', label: 'Settings', href: '/dashboard/settings', icon: '⚙' }
    ]
  }
];

export const DASHBOARD_LINKS = DASHBOARD_NAV_SECTIONS.flatMap((section) => section.items);

export const DASHBOARD_MOBILE_LINKS = [
  DASHBOARD_LINKS.find((item) => item.key === 'dashboard'),
  DASHBOARD_LINKS.find((item) => item.key === 'products'),
  DASHBOARD_LINKS.find((item) => item.key === 'orders'),
  DASHBOARD_LINKS.find((item) => item.key === 'builder'),
  DASHBOARD_LINKS.find((item) => item.key === 'settings')
].filter(Boolean);
