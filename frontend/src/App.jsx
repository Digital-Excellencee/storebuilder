import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, API_URL } from './api';
import { useAuth } from './auth';

const DASHBOARD_LINKS = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: '▦' },
  { key: 'analytics', label: 'Analytics', href: '/dashboard/analytics', icon: '⌁' },
  { key: 'system-status', label: 'System Status', href: '/dashboard/system-status', icon: '◉' },
  { key: 'products', label: 'Products', href: '/dashboard/products', icon: '◫' },
  { key: 'categories', label: 'Categories', href: '/dashboard/categories', icon: '◳' },
  { key: 'collections', label: 'Collections', href: '/dashboard/collections', icon: '◈' },
  { key: 'media', label: 'Media', href: '/dashboard/media', icon: '◴' },
  { key: 'bulk-upload', label: 'Bulk Upload', href: '/dashboard/bulk-upload', icon: '⇪' },
  { key: 'orders', label: 'Orders', href: '/dashboard/orders', icon: '⟡' },
  { key: 'customers', label: 'Customers', href: '/dashboard/customers', icon: '◔' }
  ,{ key: 'leads', label: 'Leads', href: '/dashboard/leads', icon: '◌' }
  ,{ key: 'abandoned-carts', label: 'Abandoned', href: '/dashboard/abandoned-carts', icon: '⌂' }
  ,{ key: 'coupons', label: 'Coupons', href: '/dashboard/coupons', icon: '✦' }
  ,{ key: 'shipping', label: 'Shipping', href: '/dashboard/shipping', icon: '⇄' }
  ,{ key: 'payments', label: 'Payments', href: '/dashboard/payments', icon: '₪' }
  ,{ key: 'notifications', label: 'Notifications', href: '/dashboard/notifications', icon: '🔔' }
  ,{ key: 'tax', label: 'Tax', href: '/dashboard/tax', icon: '₹' }
  ,{ key: 'whatsapp-marketing', label: 'WhatsApp', href: '/dashboard/whatsapp-marketing', icon: '◎' }
  ,{ key: 'tracking', label: 'Tracking', href: '/dashboard/tracking', icon: '▣' }
  ,{ key: 'theme', label: 'Themes', href: '/dashboard/theme', icon: '◐' }
  ,{ key: 'display-settings', label: 'Display', href: '/dashboard/display-settings', icon: '▥' }
  ,{ key: 'settings', label: 'Settings', href: '/dashboard/settings', icon: '⚙' }
  ,{ key: 'apps', label: 'Apps', href: '/dashboard/apps', icon: '◫' }
  ,{ key: 'pages', label: 'Pages', href: '/dashboard/pages', icon: '▤' }
  ,{ key: 'domain', label: 'Domain', href: '/dashboard/domain', icon: '◈' }
];

const SUPERADMIN_LINKS = [
  { key: 'dashboard', label: 'Dashboard', href: '/superadmin/dashboard', icon: '▦' },
  { key: 'stores', label: 'Stores', href: '/superadmin/stores', icon: '◫' },
  { key: 'users', label: 'Users', href: '/superadmin/users', icon: '◔' }
];

const LANDING_FEATURES = [
  ['👗', 'Product variants', 'Products', 'Size, color, material - unlimited variants with stock tracking.'],
  ['📋', 'Order management', 'Orders', 'Track orders, update status, PDF invoices, export to Excel.'],
  ['📊', 'Analytics dashboard', 'Analytics', 'Revenue charts, store visits, conversion rate, top products.'],
  ['🎟️', 'Coupon codes', 'Marketing', 'Create discount codes for festivals, loyal buyers, promotions.'],
  ['⭐', 'Product reviews', 'Trust', 'Buyers leave star ratings and build trust faster.'],
  ['👥', 'Customer CRM', 'CRM', 'Every buyer auto-saved with spend, order count, and contact details.'],
  ['💵', 'Cash on delivery', 'Payments', 'Offer COD alongside prepaid checkout.'],
  ['📱', 'WhatsApp alerts', 'Automation', 'Instant WhatsApp-style order awareness for sellers.']
];

const LANDING_STORES = [
  ['👗', "Riya's Saree Boutique", 'Clothing & Fashion', '+₹18,450 today', 'sb-o', [['Banarasi Silk', '₹2,499'], ['Cotton Kurti', '₹699'], ['Embroidered Dupatta', '₹598']]],
  ['🏠', "Anita's Home Bakery", 'Home Baker', '+12 pre-orders', 'sb-b', [['Custom Cake', '₹1,200'], ['Cupcake Box (12)', '₹450'], ['Brownies', '₹320']]],
  ['💪', 'Fitness with Rahul', 'Fitness Coach', '+5 new signups', 'sb-g', [['Monthly Program', '₹1,999'], ['Diet Plan', '₹999'], ['1:1 Session', '₹799']]],
  ['💼', 'Design by Kavya', 'Freelancer', '+7 service bookings', 'sb-p', [['Logo Design', '₹2,500'], ['Social Media Kit', '₹1,499'], ['Brand Guide', '₹4,999']]]
];

const LANDING_STEPS = [
  ['🏪', 'Step 01', 'Sign up free', 'Create your account in 2 minutes. No credit card needed.'],
  ['📸', 'Step 02', 'Add your products', 'Upload photos, names, prices, and variants from your phone.'],
  ['🚀', 'Step 03', 'Share and start selling', 'Share your store link on WhatsApp, Instagram, and Facebook.']
];

const LANDING_WHO = [
  ['👗', 'Clothing & fashion', 'Sarees, kurtis, jewellery, accessories', 'Managing orders over WhatsApp photos', 'Product catalogue, size variants, UPI checkout'],
  ['🍰', 'Home bakers & food', 'Cakes, snacks, pickles, homemade food', 'No way to show menu and take pre-orders', 'Digital menu, pre-order, COD, delivery notes'],
  ['🎓', 'Coaches & tutors', 'Yoga, fitness, academics, online courses', 'Collecting fees via Google Forms and GPay', 'Professional store where students buy directly'],
  ['💼', 'Freelancers & consultants', 'Designers, writers, CA, HR consultants', 'Clients Google you and find nothing', 'A premium store presence with paid offerings'],
  ['🏠', 'Local businesses', 'Boutiques, salons, gift shops, stores', 'No digital catalog or checkout', 'Modern online storefront with direct payments'],
  ['📦', 'Digital sellers', 'Templates, ebooks, printables, presets', 'Manual payment collection every time', 'Clean digital sales flow and order records']
];

const LANDING_PLANS = [
  ['Starter', 'Perfect to get started', '₹499', ['10 products', 'StoreBanao subdomain', 'UPI + card payments', 'Order dashboard', 'WhatsApp alerts', 'Basic analytics', '0% commission'], 'pb-default'],
  ['Growth', 'Most popular choice', '₹999', ['100 products', 'Your own custom domain', 'Everything in Starter', 'Customer CRM + broadcast', 'Coupon codes', 'Priority support', '0% commission'], 'pb-featured'],
  ['Pro', 'For serious growth', '₹2,499', ['Unlimited products', 'Custom domain included', 'Advanced analytics', 'Priority onboarding', 'Premium themes', 'App integrations', '0% commission'], 'pb-default']
];

const LANDING_TESTIMONIALS = [
  ['P', 'Priya Sharma', 'Saree seller, Delhi', 'I was managing 50+ orders on WhatsApp every day and losing track constantly. Within a week of launching my StoreBanao store, everything became organised.'],
  ['A', 'Anita Verma', 'Home baker, Mumbai', 'My customers can now see my full menu and pre-order cakes directly. No more back-and-forth on WhatsApp. My monthly revenue doubled in the first month.'],
  ['R', 'Rahul Gupta', 'Fitness coach, Bengaluru', 'I was collecting fees via Google Forms. Now I have a real store where clients buy directly. Looks very professional and saves me hours every week.'],
  ['K', 'Kavya Jain', 'Freelancer, Jaipur', 'Setting up took exactly 12 minutes. The WhatsApp notifications alone are worth it because I never miss an order now.']
];

const LANDING_FAQS = [
  ['Do I need technical knowledge to set up?', 'Not at all. If you can use WhatsApp, you can set up a StoreBanao store.'],
  ['What payment methods can my customers use?', 'UPI, GPay, PhonePe, Paytm, cards, and Cash on Delivery.'],
  ['Does StoreBanao take any commission from my sales?', 'Never. 0% commission on all plans, forever.'],
  ['Can I use my own domain like myshop.com?', 'Yes. Growth and Pro plans support custom domains.'],
  ['What happens after the 30-day free trial?', 'You choose a paid plan and continue without losing your setup or data.']
];

const DISPLAY_SETTINGS_SECTIONS = [
  { id: 'announcement', label: 'Announcement', icon: '📣' },
  { id: 'header', label: 'Header', icon: 'H' },
  { id: 'menu', label: 'Menu', icon: '≡' },
  { id: 'banner', label: 'Banner', icon: '🖼' },
  { id: 'categories', label: 'Categories', icon: '▦' },
  { id: 'products', label: 'Products', icon: '◫' },
  { id: 'footer', label: 'Footer', icon: '▭' },
  { id: 'product-card', label: 'Product Card', icon: '◨' },
  { id: 'product-page', label: 'Product Page', icon: '📄' },
  { id: 'color-font', label: 'Color & Font', icon: '🎨' },
  { id: 'custom-css', label: 'Custom CSS', icon: '</>' }
];

const STORE_SETTINGS_SECTIONS = [
  { id: 'store-details', label: 'Store Details', icon: '🏪' },
  { id: 'store-domain', label: 'Store Domain', icon: '🌐' },
  { id: 'products-settings', label: 'Products Settings', icon: '📦' },
  { id: 'checkout-settings', label: 'Checkout Settings', icon: '🛒' },
  { id: 'delivery-settings', label: 'Delivery Settings', icon: '🚚' },
  { id: 'payment-settings', label: 'Payment Settings', icon: '💳' },
  { id: 'order-settings', label: 'Order Settings', icon: '👜' },
  { id: 'return-order-settings', label: 'Return Order Settings', icon: '↺' },
  { id: 'label-settings', label: 'Label Settings', icon: '🏷' },
  { id: 'seo-settings', label: 'SEO Settings', icon: '🔎' },
  { id: 'llm-settings', label: 'LLM Settings', icon: '🤖' },
  { id: 'notifications-settings', label: 'Notifications Settings', icon: '🔔' },
  { id: 'login-settings', label: 'Login Settings', icon: '↪' },
  { id: 'url-redirects', label: 'URL Redirects', icon: '↗' },
  { id: 'robots-txt', label: 'Robots TXT', icon: '🧰' },
  { id: 'policies', label: 'Policies', icon: '📄' },
  { id: 'about-us', label: 'About Us', icon: '✉' }
];

const DEFAULT_STORE_SETTINGS = {
  storeDetails: { favicon: '', category: 'General Store', phone: '', email: '', legalName: '', businessType: 'Individual', address: '', socialLinks: { facebook: '', youtube: '', instagram: '' } },
  productSettings: { hideOutOfStock: false, displaySingleVariantDetails: false, showCartCheckoutPopup: false, productCardSalePrice: 'sale-tax', productPageSalePrice: 'sale-tax', minimumQtyIncrementRule: 'single', variantSelectorType: 'chips' },
  checkoutSettings: { roundingMode: 'none', showTaxInfo: true, minimumOrderAmount: '0', cartNote: '' },
  deliverySettings: { fee: '0', freeDeliveryAbove: '', allIndiaDelivery: true, deliveryRadius: '5', serviceType: 'delivery', addressType: 'form', nextDayTitle: 'Delivery by Tomorrow', nextDaySubtitle: 'Order will be delivered by tomorrow', normalTitle: 'Normal Delivery', normalSubtitle: 'Order will be delivered on standard delivery time' },
  paymentSettings: { cod: true, partialCod: false, onlinePayment: false, bankDetails: '', paymentModeRules: '' },
  orderSettings: { allowInvoiceDownload: true, allowOrderCancellation: true, autoConfirmPaymentMode: 'online', orderNote: 'Order received. Thank you for shopping with us!' },
  returnOrderSettings: { allowReturnRequests: false, returnWindowDays: '7', instructions: '' },
  labelSettings: { searchBoxText: 'Search for a product', selectLocationText: 'Select Your Location', categoriesHeading: 'Browse Categories', collectionsHeading: 'Our Collections', productsHeading: 'Products', addProductButton: '+ Add', productCardEnquiryButton: 'Enquiry', viewAllProductsButton: 'View All Products', bottomNavHome: 'Home', bottomNavOrders: 'Orders', bottomNavCart: 'Cart', bottomNavAccount: 'Account', signInHeading: 'Sign In', signUpHeading: 'Sign Up', requestOtpButton: 'Send SMS OTP' },
  seoSettings: { title: '', description: '', keywords: '', googleSiteVerification: '', facebookDomainVerification: '', pinterestDomainVerification: '' },
  llmSettings: { enabled: false, businessSummary: '', supportEmail: '', supportPhone: '' },
  notificationsSettings: { newOrder: true, whatsappLead: true, lowStock: false, abandonedCart: false },
  loginSettings: { allowRegistration: true, signInHeading: 'Sign In', signUpHeading: 'Sign Up', requestOtpButton: 'Send SMS OTP' },
  urlRedirects: [],
  robotsSettings: { mode: 'normal', allowAll: true, homeOnly: false, blockAll: false, customText: '' },
  policies: { terms: '', shipping: '', payment: '', returnRefund: '', privacy: '' },
  aboutUs: { title: 'About Us', content: '' },
  domain: { customDomain: '', subdomain: '' }
};

function formatMoney(value) {
  const amount = Number(value || 0);
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: amount % 1 ? 2 : 0 })}`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function slugify(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

function deepMerge(base, source) {
  if (Array.isArray(base)) return Array.isArray(source) ? source.slice() : base.slice();
  const output = { ...base };
  Object.keys(source || {}).forEach((key) => {
    const baseValue = output[key];
    const sourceValue = source[key];
    if (baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue) && sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      output[key] = deepMerge(baseValue, sourceValue);
    } else if (sourceValue !== undefined) {
      output[key] = Array.isArray(sourceValue) ? sourceValue.slice() : sourceValue;
    }
  });
  return output;
}

function getMergedStoreSettings(store) {
  return deepMerge(DEFAULT_STORE_SETTINGS, (store && store.storeSettings) || {});
}

function getMergedThemeConfig(store) {
  return deepMerge({
    announcementEnabled: true,
    topBarText: '',
    topBarMarquee: true,
    topBarBg: '',
    topBarColor: '',
    headerLayout: 'search',
    headerSticky: true,
    showSearch: true,
    showWishlistIcon: true,
    showCartIcon: true,
    menuHomeLabel: 'Home',
    menuShopLabel: 'Shop All',
    menuWishlistLabel: 'Wishlist',
    menuCartLabel: 'Cart',
    menuTrackLabel: 'Track Order',
    menuAccountLabel: 'My Account',
    showBanner: true,
    bannerTitle: '',
    bannerSubtitle: '',
    bannerCta: '',
    bannerSecondaryCta: '',
    bannerImages: [],
    bannerImagesMobile: [],
    searchPlaceholder: '',
    showCategories: true,
    categoryTitle: 'Categories',
    categoryNavLabel: 'Categories',
    categoryLayout: 'auto',
    categoryStyle: 'circle',
    productsTitle: 'All Products',
    showFlashDeals: true,
    showFooter: true,
    showPoweredBy: true,
    footerText: '',
    productCardStyle: 'style-2',
    showDiscount: true,
    showRating: true,
    showProductStock: true,
    showProductDescription: true,
    showProductPageStock: true,
    showWhatsappButton: true,
    primaryColor: '',
    secondaryColor: '',
    btnColor: '',
    bgColor: '',
    headingFont: '',
    bodyFont: '',
    borderRadius: 'rounded',
    btnStyle: 'pill',
    customCss: ''
  }, (store && store.themeConfig) || {});
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function usePersistentState(key, fallback) {
  const [value, setValue] = useState(() => readJson(key, fallback));
  useEffect(() => {
    setValue(readJson(key, fallback));
  }, [key, fallback]);
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
}

function readSessionJson(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function usePageTitle(title) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

function useStoreCart(slug) {
  return usePersistentState(`storebanao_cart_${slug}`, []);
}

function useStoreWishlist(slug) {
  return usePersistentState(`storebanao_wishlist_${slug}`, []);
}

function useApiData(load, deps, initialValue) {
  const hasInitialData = initialValue && typeof initialValue === 'object' && Object.values(initialValue).some((value) => Array.isArray(value) ? value.length > 0 : !!value);
  const [state, setState] = useState({ loading: !hasInitialData, error: '', data: initialValue });
  useEffect(() => {
    let active = true;
    setState((prev) => ({ ...prev, loading: !hasInitialData, error: '' }));
    Promise.resolve()
      .then(load)
      .then((data) => {
        if (active) setState({ loading: false, error: '', data });
      })
      .catch((error) => {
        if (active) setState({ loading: false, error: error.message || 'Unable to load data', data: initialValue });
      });
    return () => {
      active = false;
    };
  }, deps);
  return state;
}

function useCachedApiData(cacheKey, load, deps, initialValue) {
  const initial = readSessionJson(cacheKey, initialValue);
  const state = useApiData(load, deps, initial);
  useEffect(() => {
    if (!state.loading && !state.error) {
      sessionStorage.setItem(cacheKey, JSON.stringify(state.data));
    }
  }, [cacheKey, state.loading, state.error, state.data]);
  return state;
}

function useDashboardStoreData() {
  const { vendor } = useAuth();
  const token = vendor && vendor.token;
  const state = useApiData(() => api.get('/api/auth/me', token), [token], { user: null, store: {} });
  return { token, ...state };
}

function useDashboardMedia(token) {
  return useCachedApiData(`dashboard_media_${token || 'guest'}`, () => token ? api.get('/api/dashboard/media', token) : Promise.resolve({ images: [] }), [token], { images: [] });
}

function parseJsonDraft(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

async function downloadAuthorized(path, token, filename) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Download failed');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function SectionNav({ sections, activeSection, onSelect }) {
  return <aside className="osa-card osa-section-nav">{sections.map((item) => <button key={item.id} className={cn('osa-section-link-btn', activeSection === item.id && 'active')} type="button" onClick={() => onSelect(item.id)}><span className="osa-section-icon">{item.icon}</span><span>{item.label}</span></button>)}</aside>;
}

function ToggleField({ title, description, checked, onChange }) {
  return <label className="osa-toggle-row"><div className="osa-toggle-copy"><strong>{title}</strong><span>{description}</span></div><span className="osa-switch"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="osa-switch-ui" /></span></label>;
}

function MediaPicker({ images, onSelect, emptyText = 'No uploaded media yet.' }) {
  if (!images || !images.length) return <p className="osa-block-note">{emptyText}</p>;
  return <div className="media-picker-grid">{images.map((src) => <button key={src} type="button" className="media-picker-card" onClick={() => onSelect(src)}><img src={src} alt="media" /><span>Use this</span></button>)}</div>;
}

function OptionCardGroup({ value, onChange, options }) {
  return <div className="osa-option-grid">{options.map((item) => <label key={item.id} className={cn('osa-option-card', value === item.id && 'active')}><input type="radio" checked={value === item.id} onChange={() => onChange(item.id)} /><strong>{item.title}</strong><span>{item.sub}</span></label>)}</div>;
}

function BannerPreviewList({ items, mobile = false, onRemove }) {
  return items && items.length ? <div className="osa-preview-gallery">{items.map((image, index) => <div key={`${image}-${index}`} className={cn('osa-thumb', mobile && 'mobile')}><img src={image} alt={`Banner ${index + 1}`} /><button className="osa-thumb-delete" type="button" onClick={() => onRemove(index)}>×</button></div>)}</div> : <p className="osa-block-note">No {mobile ? 'mobile' : 'desktop'} banners yet.</p>;
}

function saveFileAsDraft(event, setter) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => setter(String(reader.result || ''));
  reader.readAsDataURL(file);
}

async function uploadDashboardFile(path, file, token) {
  const formData = new FormData();
  formData.append('file', file);
  return api.upload(path, formData, token);
}

function buildStoreThemeClass(store) {
  const template = String((store && store.template) || 'app-style');
  return `theme-${template.replace(/[^a-z0-9-]/gi, '-')}`;
}

function buildStoreThemeStyle(store) {
  const cfg = getMergedThemeConfig(store || {});
  return {
    '--store-primary': cfg.primaryColor || '',
    '--store-secondary': cfg.secondaryColor || '',
    '--store-button': cfg.btnColor || '',
    '--store-background': cfg.bgColor || '',
    '--store-heading-font': cfg.headingFont || '',
    '--store-body-font': cfg.bodyFont || ''
  };
}

function LoadingBlock({ label = 'Loading...' }) {
  return <div className="loading-block">{label}</div>;
}

function Alert({ type = 'info', children }) {
  if (!children) return null;
  return <div className={cn('flash', `flash-${type}`)}>{children}</div>;
}

function EmptyState({ title, body, action }) {
  return (
    <div className="store-empty">
      <h3>{title}</h3>
      <p>{body}</p>
      {action || null}
    </div>
  );
}

function VendorOnly({ children }) {
  const { vendor, bootstrapping } = useAuth();
  if (bootstrapping) return <LoadingBlock label="Loading dashboard..." />;
  if (!vendor || !vendor.token) return <Navigate to="/login" replace />;
  return children;
}

function CustomerOnly({ children, slug }) {
  const { customer, bootstrapping } = useAuth();
  if (bootstrapping) return <LoadingBlock label="Loading account..." />;
  if (!customer || !customer.token || customer.slug !== slug) return <Navigate to={`/store/${slug}/account/login`} replace />;
  return children;
}

function SuperAdminOnly({ children }) {
  const { superAdmin, bootstrapping } = useAuth();
  if (bootstrapping) return <LoadingBlock label="Loading superadmin..." />;
  if (!superAdmin || !superAdmin.token) return <Navigate to="/superadmin" replace />;
  return children;
}

function LandingPage() {
  usePageTitle('StoreBanao - Your Store. Your Domain. Your Rules.');
  const navigate = useNavigate();
  const [theme, setTheme] = useState('light');
  const [demoForm, setDemoForm] = useState({ name: '', phone: '', category: '', preferredTime: '' });
  const [demoState, setDemoState] = useState({ loading: false, error: '', success: '' });
  const [faqOpen, setFaqOpen] = useState(0);
  const { data, loading } = useApiData(() => api.get('/api/landing'), [], { stats: {}, supportWhatsappUrl: 'https://wa.me/917300628199', supportPhone: '7300628199' });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    return () => {
      document.documentElement.setAttribute('data-theme', 'light');
    };
  }, [theme]);

  async function submitDemo(event) {
    event.preventDefault();
    setDemoState({ loading: true, error: '', success: '' });
    try {
      await api.post('/api/demo-request', demoForm);
      setDemoState({ loading: false, error: '', success: 'Thanks. Your demo request has been submitted. We will contact you shortly.' });
      setDemoForm({ name: '', phone: '', category: '', preferredTime: '' });
    } catch (error) {
      setDemoState({ loading: false, error: error.message || 'Unable to submit your demo request right now.', success: '' });
    }
  }

  const stats = data.stats || {};
  const supportWhatsappUrl = data.supportWhatsappUrl || 'https://wa.me/917300628199';
  const supportPhone = data.supportPhone || '7300628199';

  return (
    <div className="landing-page-root">
      <a className="wa-float" title="Chat on WhatsApp" href={supportWhatsappUrl} target="_blank" rel="noopener noreferrer">💬</a>
      <nav className="nav">
        <Link to="/" className="nav-brand">Store<span>Banao</span></Link>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#sellers">For sellers</a>
          <a href="#demo">Book demo</a>
        </div>
        <div className="nav-right">
          <button className="theme-btn" type="button" onClick={() => setTheme((prev) => prev === 'light' ? 'dark' : 'light')}>{theme === 'light' ? '🌙' : '☀️'}</button>
          <button className="btn-ghost" type="button" onClick={() => navigate('/login')}>Sign in</button>
          <button className="btn-cta" type="button" onClick={() => navigate('/register')}>Start free →</button>
        </div>
      </nav>
      <div className="ticker-wrap" style={{ marginTop: 62 }}>
        <div className="ticker-track">
          {['0% Commission Forever', 'UPI + GPay + Cards Built In', 'WhatsApp Alert on Every Order', 'Live in 10 Minutes', 'Your Own Domain', 'Product Variants & Reviews', 'Full Analytics Dashboard', 'Cash on Delivery Support'].concat(['0% Commission Forever', 'UPI + GPay + Cards Built In', 'WhatsApp Alert on Every Order', 'Live in 10 Minutes']).map((item) => (
            <span key={item + Math.random()} className="ticker-item"><span className="ticker-dot" />{item}</span>
          ))}
        </div>
      </div>
      <section className="hero">
        <div className="hero-blob hero-blob1" />
        <div className="hero-blob hero-blob2" />
        <div className="container">
          <div className="hero-grid">
            <div>
              <div className="hero-badge"><span className="hero-badge-dot" />30-day free trial · no credit card needed</div>
              <h1 className="hero-title">Your store.<br />Your <span className="grad">domain.</span><br />Your rules.</h1>
              <p className="hero-sub">Stop taking orders on WhatsApp. Launch a professional store with UPI payments, WhatsApp alerts, and zero commission - in 10 minutes.</p>
              <div className="hero-btns">
                <button className="btn-primary" type="button" onClick={() => navigate('/register')}>🚀 Start free 30 days →</button>
                <button className="btn-outline" type="button" onClick={() => navigate('/login')}>Sign in</button>
              </div>
              <div className="hero-proof">
                {['No credit card', 'Cancel anytime', 'Setup in 10 minutes', '0% commission forever'].map((item) => <span key={item} className="proof-chip">{item}</span>)}
              </div>
            </div>
            <div className="store-card-wrap">
              <div className="float-tag ft1">🛍️ New order! ₹2,490 · UPI paid ✓</div>
              <div className="float-tag ft2">⭐ 5-star review just received!</div>
              <div className="store-card-mock">
                <div className="scm-bar"><div className="scm-dots"><div className="scm-dot" style={{ background: '#ff5f57' }} /><div className="scm-dot" style={{ background: '#febc2e' }} /><div className="scm-dot" style={{ background: '#28c840' }} /></div><span className="scm-url">sareesbyvanita.com</span><span className="scm-live">Live in 10 mins</span></div>
                <div className="scm-body">
                  <div className="scm-notif"><div className="scm-notif-icon">🛍️</div><div style={{ flex: 1 }}><div className="scm-notif-title">New order! ₹2,490</div><div className="scm-notif-sub">Banarasi Silk Saree · Priya S.</div></div><span className="scm-badge">UPI paid ✓</span></div>
                  <div className="scm-stats"><div className="scm-stat"><div className="scm-stat-lbl">Today's Sales</div><div className="scm-stat-val">₹18,450</div><div className="scm-stat-sub">+8 new paid orders</div></div><div className="scm-stat"><div className="scm-stat-lbl">This Month</div><div className="scm-stat-val">₹2.4L</div><div className="scm-stat-sub">↑ 34% vs last month</div></div></div>
                  <div className="scm-review"><div className="scm-stars">★★★★★</div><div className="scm-review-text">"Superb quality saree, will order again!" - Meena R.</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="pay-strip"><div className="container"><div className="pay-inner"><span className="pay-label">Trusted payment partners</span><span className="pay-logo">UPI</span><span className="pay-logo">GPay</span><span className="pay-logo">PhonePe</span><span className="pay-logo">Paytm</span><span className="pay-logo">Razorpay</span></div></div></div>
      <div className="stats-section"><div className="container"><div className="stats-grid"><div className="stats-item"><span className="stats-num">{loading ? '...' : `${stats.userCount || 0}+`}</span><div className="stats-lbl">Sellers using StoreBanao</div></div><div className="stats-item"><span className="stats-num">{loading ? '...' : `${stats.storeCount || 0}+`}</span><div className="stats-lbl">Active stores live</div></div><div className="stats-item"><span className="stats-num">{loading ? '...' : `${stats.orderCount || 0}+`}</span><div className="stats-lbl">Orders processed</div></div></div><div className="stats-checks"><span className="stats-check">Zero commission forever</span><span className="stats-check">UPI + GPay + Cards built in</span><span className="stats-check">Live in under 10 minutes</span></div></div></div>
      <section className="section" style={{ background: 'var(--bg)' }}><div className="container"><div className="text-center"><div className="sec-eyebrow">Sound familiar?</div><h2 className="sec-title">Every seller has the same problems.</h2><p className="sec-sub">StoreBanao fixes all of them - permanently.</p></div><div style={{ height: 36 }} /><div className="ba-grid"><div className="ba-card ba-bad"><div className="ba-accent" /><div className="ba-head">😤 Before StoreBanao</div>{['Orders buried in WhatsApp messages every day', 'Paying 2-5% commission on every single sale', 'No real website - just DM to order', 'Needing ₹50,000+ and months to hire a developer', 'No way to track inventory, orders, or customers'].map((item) => <div key={item} className="ba-item"><span className="bi-x">✗</span>{item}</div>)}</div><div className="ba-card ba-good"><div className="ba-accent" /><div className="ba-head">🚀 With StoreBanao</div>{['Professional store with UPI checkout', '0% commission always', 'Your own domain', 'Live in 10 minutes', 'Full analytics, order tracking, customer list'].map((item) => <div key={item} className="ba-item"><span className="bi-c">✓</span>{item}</div>)}</div></div></div></section>
      <section className="section" style={{ background: 'var(--section-alt)' }}><div className="container"><div className="text-center"><div className="sec-eyebrow">Everything included</div><h2 className="sec-title">All features. One flat price.</h2><p className="sec-sub">No hidden fees. No add-ons. No commission. Everything you need.</p></div><div style={{ height: 32 }} /><div className="feat-grid" id="features">{LANDING_FEATURES.map(([emoji, title, tag, text], index) => <div key={title} className="feat-card"><div className={`feat-icon fi${(index % 8) + 1}`}>{emoji}</div><div className="feat-name">{title}</div><span className={`feat-tag ft${(index % 8) + 1}`}>{tag}</span><div className="feat-desc">{text}</div></div>)}</div></div></section>
      <section className="section" style={{ background: 'var(--bg)' }}><div className="container"><div className="text-center"><div className="sec-eyebrow">Real stores</div><h2 className="sec-title">Stores built on StoreBanao</h2><p className="sec-sub">From saree sellers to fitness coaches - see what your store could look like.</p></div><div style={{ height: 32 }} /><div className="sc-grid">{LANDING_STORES.map(([emoji, name, type, badge, badgeClass, products]) => <div key={name} className="sc-card"><div className="sc-head"><span className="sc-emoji">{emoji}</span><div><div className="sc-name">{name}</div><div className="sc-type">{type}</div></div><span className={cn('sc-badge', badgeClass)}>{badge}</span></div><div className="sc-products">{products.map(([product, price]) => <div key={product} className="sc-row"><span className="sc-pname">{product}</span><span className="sc-price">{price}</span></div>)}</div><button className="sc-cta-btn" type="button" onClick={() => navigate('/register')}>View store →</button></div>)}</div></div></section>
      <section className="section" style={{ background: 'var(--section-alt)' }}><div className="container"><div className="text-center"><div className="sec-eyebrow">Simple setup</div><h2 className="sec-title">Live in 3 steps. 10 minutes total.</h2><p className="sec-sub">No technical knowledge needed. If you can use WhatsApp, you can run a StoreBanao store.</p></div><div style={{ height: 32 }} /><div className="steps-grid">{LANDING_STEPS.map(([icon, step, title, text], index) => <div key={title} className="step-card"><div className="step-bg-num">{`0${index + 1}`}</div><div className="step-icon">{icon}</div><div className="step-num-lbl">{step}</div><div className="step-title">{title}</div><div className="step-desc">{text}</div></div>)}</div><div style={{ textAlign: 'center', marginTop: 32 }}><button className="btn-primary" type="button" onClick={() => navigate('/register')}>Start my free store →</button></div></div></section>
      <section id="sellers" className="section" style={{ background: 'var(--bg)' }}><div className="container"><div className="text-center"><div className="sec-eyebrow">Built for Indian sellers</div><h2 className="sec-title">Who uses StoreBanao?</h2><p className="sec-sub">StoreBanao works for anyone selling anything in India - products, services, or digital goods.</p></div><div style={{ height: 32 }} /><div className="who-grid">{LANDING_WHO.map(([emoji, title, types, before, after]) => <div key={title} className="who-card"><div className="who-emoji">{emoji}</div><div className="who-title">{title}</div><div className="who-types">{types}</div><div className="who-item"><span className="bi-x">✗</span>{before}</div><div className="who-item"><span className="bi-c">✓</span>{after}</div></div>)}</div></div></section>
      <section id="pricing" className="section" style={{ background: 'var(--bg)' }}><div className="container"><div className="text-center"><div className="sec-eyebrow">Simple pricing</div><h2 className="sec-title">Flat monthly price. Zero surprises.</h2><p className="sec-sub">No commission. No setup cost. 30-day free trial on all plans.</p></div><div style={{ height: 32 }} /><div className="pricing-grid">{LANDING_PLANS.map(([name, tag, price, items, buttonClass], index) => <div key={name} className={cn('plan-card', index === 1 && 'featured')}>{index === 1 ? <div className="plan-popular">MOST POPULAR</div> : null}<div className="plan-name">{name}</div><div className="plan-tag">{tag}</div><div><span className="plan-price">{price}</span><span className="plan-period">/month</span></div><div className="plan-divider" />{items.map((item) => <div key={item} className="plan-item"><span className="plan-check">✓</span>{item}</div>)}<button className={cn('plan-btn', buttonClass)} type="button" onClick={() => navigate('/register')}>Start free trial →</button></div>)}</div><div className="pricing-note">30 days free trial on every plan. Cancel anytime.</div></div></section>
      <section id="demo" className="section" style={{ background: 'var(--section-alt)' }}><div className="container"><div className="demo-layout"><div><div className="sec-eyebrow">Free demo</div><h2 className="demo-title">We set it up for you.</h2>{[['⏱️', '15 minutes only', 'Quick, focused, no fluff'], ['🏪', 'Live store setup', 'We add your first products on the call'], ['❓', 'All questions answered', 'No sales pressure just honest answers'], ['📱', 'WhatsApp or Google Meet', 'Whatever is convenient for you']].map(([icon, title, text]) => <div key={title} className="demo-feat"><div className="demo-feat-icon">{icon}</div><div><div className="demo-feat-title">{title}</div><div className="demo-feat-sub">{text}</div></div></div>)}<div className="booked-row"><div className="bk-avs"><div className="bk-av" style={{ background: '#f97316' }}>R</div><div className="bk-av" style={{ background: '#8b5cf6' }}>P</div><div className="bk-av" style={{ background: '#06b6d4' }}>A</div><div className="bk-av" style={{ background: '#10b981' }}>M</div></div><div className="bk-text"><b>40+ sellers</b> booked a demo this month</div></div></div><div className="form-box">{demoState.success ? <Alert type="success">{demoState.success}</Alert> : null}{demoState.error ? <Alert type="error">{demoState.error}</Alert> : null}<h3>Book your free demo</h3><p>We call within 2 hours · No sales pressure · 100% free</p><form onSubmit={submitDemo}><div className="f-field"><label className="f-label">Your name <span>*</span></label><input className="f-input" value={demoForm.name} onChange={(event) => setDemoForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Your full name" required /></div><div className="f-field"><label className="f-label">Phone number <span>*</span></label><div className="f-phone"><span className="f-prefix">+91</span><input className="f-input" value={demoForm.phone} onChange={(event) => setDemoForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="10-digit mobile number" required /></div></div><div className="f-field"><label className="f-label">What do you sell?</label><input className="f-input" value={demoForm.category} onChange={(event) => setDemoForm((prev) => ({ ...prev, category: event.target.value }))} placeholder="Sarees, bakery, coaching, services..." /></div><div className="f-field"><label className="f-label">Preferred time <span>*</span></label><select className="f-input" value={demoForm.preferredTime} onChange={(event) => setDemoForm((prev) => ({ ...prev, preferredTime: event.target.value }))} required><option value="">Choose a time</option><option value="10 AM - 12 PM">10 AM - 12 PM</option><option value="12 PM - 2 PM">12 PM - 2 PM</option><option value="2 PM - 5 PM">2 PM - 5 PM</option><option value="5 PM - 8 PM">5 PM - 8 PM</option></select></div><button className="f-submit" type="submit" disabled={demoState.loading}>{demoState.loading ? 'Submitting...' : 'Book my demo →'}</button><div className="f-note">No credit card · No commitment · WhatsApp friendly setup</div></form></div></div></div></section>
      <section className="section" style={{ background: 'var(--bg)' }}><div className="container"><div className="text-center"><div className="sec-eyebrow">Seller stories</div><h2 className="sec-title">Real sellers. Real results.</h2></div><div style={{ height: 28 }} /><div className="test-grid">{LANDING_TESTIMONIALS.map(([letter, name, role, text], index) => <div key={name} className="test-card"><div className="test-quote-bg">"</div><div className="test-stars">★★★★★</div><div className="test-text">"{text}"</div><div className="test-author"><div className="test-av" style={{ background: index % 2 ? 'linear-gradient(135deg,#f97316,#ef4444)' : 'linear-gradient(135deg,#6c47ff,#5535e0)' }}>{letter}</div><div><div className="test-name">{name}</div><div className="test-role">{role}</div></div></div></div>)}</div></div></section>
      <section className="section" style={{ background: 'var(--section-alt)' }}><div className="container"><div className="text-center"><h2 className="sec-title">Frequently asked questions</h2><p className="sec-sub">Something we haven't answered? WhatsApp us directly.</p></div><div style={{ height: 32 }} /><div className="faq-wrap">{LANDING_FAQS.map(([question, answer], index) => <div key={question} className={cn('faq-item', faqOpen === index && 'open')}><button className="faq-btn" type="button" onClick={() => setFaqOpen((prev) => prev === index ? -1 : index)}>{question}<span className="faq-icon">+</span></button><div className="faq-body" style={{ maxHeight: faqOpen === index ? 180 : 0 }}><div className="faq-inner">{answer}</div></div></div>)}</div><div className="wa-section"><div className="wa-left"><div className="wa-icon-box">💬</div><div><div className="wa-title">Need help right now?</div><div className="wa-sub">Our team replies quickly on WhatsApp.</div><div className="wa-live-ind">Usually online</div></div></div><a className="btn-green" href={supportWhatsappUrl} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a></div></div></section>
      <section className="cta-section"><div className="cta-glow" /><div className="container" style={{ position: 'relative', zIndex: 1 }}><div className="cta-badge">✨ 30 days free · no credit card needed</div><h2 className="cta-title">Your store could be live<br /><span>by tonight.</span></h2><p className="cta-sub">Join Indian sellers who stopped losing orders on WhatsApp and started running a real online business.</p><div className="cta-btns"><button className="cta-btn1" type="button" onClick={() => navigate('/register')}>🚀 Start free — 30 days free →</button><button className="cta-btn2" type="button" onClick={() => window.location.hash = '#pricing'}>See pricing</button></div><div className="cta-note">No credit card · No commitment · Cancel anytime</div></div></section>
      <footer className="footer"><div className="container"><div className="footer-grid"><div><div className="footer-brand">Store<span>Banao</span></div><div className="footer-desc">The online store platform built for Indian small businesses. Zero commission. Instant setup. Real ownership.</div></div><div><div className="footer-col-title">Product</div><ul className="footer-links"><li><a href="#features">Features</a></li><li><a href="#pricing">Pricing</a></li><li><button className="footer-link-btn" type="button" onClick={() => navigate('/register')}>Start free trial</button></li><li><button className="footer-link-btn" type="button" onClick={() => navigate('/login')}>Sign in</button></li></ul></div><div><div className="footer-col-title">For sellers</div><ul className="footer-links"><li><a href="#sellers">Clothing & fashion</a></li><li><a href="#sellers">Home bakers & food</a></li><li><a href="#sellers">Coaches & tutors</a></li><li><a href="#sellers">Freelancers</a></li></ul></div><div><div className="footer-col-title">Contact</div><ul className="footer-links"><li><a href={supportWhatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp us</a></li><li><a href={`tel:+91${supportPhone}`}>+91 {supportPhone}</a></li></ul></div></div><div className="footer-bottom"><div className="footer-copy">© 2026 StoreBanao. All rights reserved.</div><div className="footer-copy">Made in India for Indian sellers</div></div></div></footer>
    </div>
  );
}

function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="react-auth-page">
      <div className="auth-wrap">
        <div className="card auth-card">
          <h1 className="section-title">{title}</h1>
          <p className="section-subtitle">{subtitle}</p>
          {children}
          {footer || null}
        </div>
      </div>
    </div>
  );
}

function GoogleAuthButton({ href }) {
  return <a className="google-auth-btn" href={href}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>Continue with Google</a>;
}

function OAuthCallbackRelay() {
  const location = useLocation();
  useEffect(() => {
    const query = location.search || '';
    const hasCode = new URLSearchParams(query).get('code');
    if (!hasCode) return;
    window.location.replace(`${API_URL}/auth/callback${query}`);
  }, [location]);
  return <LoadingBlock label="Completing Google sign-in..." />;
}

function VendorLoginPage() {
  usePageTitle('Vendor Login - StoreBanao');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginVendor, hydrateVendorFromToken } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [state, setState] = useState({ loading: false, error: '' });

  useEffect(() => {
    if (searchParams.get('google') !== '1') return;
    const token = searchParams.get('token');
    if (!token) {
      setState({ loading: false, error: 'Google sign-in could not be completed. Please try again.' });
      return;
    }
    let active = true;
    setState({ loading: true, error: '' });
    hydrateVendorFromToken(token).then(() => {
      if (active) navigate('/dashboard', { replace: true });
    }).catch((error) => {
      if (active) setState({ loading: false, error: error.message || 'Google sign-in failed' });
    });
    return () => {
      active = false;
    };
  }, [searchParams, hydrateVendorFromToken, navigate]);

  async function submit(event) {
    event.preventDefault();
    setState({ loading: true, error: '' });
    try {
      await loginVendor(form);
      navigate('/dashboard');
    } catch (error) {
      if (error && error.status === 404) {
        navigate('/register?error=account-not-found', { replace: true });
        return;
      }
      setState({ loading: false, error: error.message || 'Login failed' });
      return;
    }
    setState({ loading: false, error: '' });
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to manage your store, orders, and customers.">
      {state.error ? <Alert type="error">{state.error}</Alert> : null}
      <form onSubmit={submit} className="form-grid">
        <GoogleAuthButton href={`${API_URL}/auth/google?flow=vendor&redirect=%2Fdashboard`} />
        <div className="field"><label htmlFor="vendor-email">Email</label><input id="vendor-email" type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="you@email.com" required /></div>
        <div className="field"><label htmlFor="vendor-password">Password</label><input id="vendor-password" type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} placeholder="Your password" required /></div>
        <div className="actions"><button className="btn" type="submit" disabled={state.loading}>{state.loading ? 'Logging in...' : 'Login'}</button><Link className="btn btn-secondary" to="/register">Create store</Link></div>
      </form>
    </AuthShell>
  );
}

function VendorRegisterPage() {
  usePageTitle('Create Your Store - StoreBanao');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const googleMode = searchParams.get('google') === '1';
  const googleSignupToken = searchParams.get('signup') || '';
  const missingAccount = searchParams.get('error') === 'account-not-found';
  const { registerVendor, completeVendorGoogleSignup } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', storeName: '', description: '', templateId: 'app-style', plan: 'starter', currency: 'INR', orderMode: 'website', logo: '', banner: '', bannerMobile: '', city: '', state: '', address: '', whatsapp: '', instagram: '', facebook: '' });
  const [state, setState] = useState({ loading: false, error: '' });
  const { data, loading } = useApiData(() => api.get('/api/templates'), [], { templates: [] });
  const templates = data.templates || [];

  useEffect(() => {
    if (!googleMode) return;
    setForm((prev) => ({ ...prev, name: searchParams.get('name') || prev.name, email: searchParams.get('email') || prev.email, phone: '', password: '' }));
  }, [googleMode, searchParams]);

  function nextStep() {
    setStep((prev) => Math.min(5, prev + 1));
  }

  function prevStep() {
    setStep((prev) => Math.max(1, prev - 1));
  }

  function uploadDraftImage(key, event) {
    saveFileAsDraft(event, (value) => setForm((prev) => ({ ...prev, [key]: value })));
  }

  async function submit(event) {
    event.preventDefault();
    setState({ loading: true, error: '' });
    try {
      const payload = { ...form };
      if (googleMode) await completeVendorGoogleSignup({ ...payload, signupToken: googleSignupToken });
      else await registerVendor(form);
      navigate('/dashboard');
    } catch (error) {
      setState({ loading: false, error: error.message || 'Registration failed' });
      return;
    }
    setState({ loading: false, error: '' });
  }

  return (
    <div className="wizard-page">
      <div className="wizard-shell">
        <div className="wizard-icon">✦</div>
        <h1 className="wizard-title">Create Your Store</h1>
        <p className="wizard-subtitle">Set up your storefront in just a few steps</p>
        <div className="wizard-progress"><span style={{ width: `${(step / 5) * 100}%` }} /></div>
        <div className="wizard-steps">{[['Plan', 1], ['Store Info', 2], ['Location', 3], ['Contact', 4], ['Social', 5]].map(([label, number]) => <button key={label} type="button" className={cn('wizard-step-pill', step === number && 'active', step > number && 'done')} onClick={() => setStep(number)}>{step > number ? '✓' : label === 'Plan' ? '▣' : label === 'Store Info' ? '◫' : label === 'Location' ? '⌖' : label === 'Contact' ? '☏' : '◎'} <span>{label}</span></button>)}</div>
        <div className="wizard-card">
    <AuthShell title="Create your store" subtitle="Quick setup. Fill the basics and go live.">
      {missingAccount ? <Alert type="error">Register account does not exist. Please create your store first.</Alert> : null}
      {state.error ? <Alert type="error">{state.error}</Alert> : null}
      <form onSubmit={submit} className="form-grid">
        {!googleMode && step === 1 ? <GoogleAuthButton href={`${API_URL}/auth/google?flow=vendor&redirect=%2Fdashboard`} /> : null}
        {step === 1 ? <><div className="wizard-section-head"><h2>Choose Your Plan</h2><p>Select the plan that fits your business needs</p></div><div className="plan-choice-grid">{[['starter', 'Starter', '₹499', '100 Products'], ['growth', 'Growth', '₹999', 'Unlimited Products']].map(([id, title, price, line], index) => <button key={id} type="button" className={cn('plan-choice-card', form.plan === id && 'active')} onClick={() => setForm((prev) => ({ ...prev, plan: id }))}>{index === 1 ? <span className="plan-most-popular">MOST POPULAR</span> : null}<strong>{title}</strong><span className="plan-choice-price">{price}<small>/month</small></span><span>{line}</span></button>)}</div><div className="wizard-tip">You can upgrade anytime! Start with any plan and upgrade later as your business grows.</div></> : null}
        {step === 2 ? <><div className="wizard-section-head"><h2>Store Information</h2><p>Tell us about your store</p></div><div className="field"><label htmlFor="storeName">Store Name *</label><input id="storeName" value={form.storeName} onChange={(event) => setForm((prev) => ({ ...prev, storeName: event.target.value }))} placeholder="My Fashion Store" required /></div><div className="field"><label htmlFor="description">Description</label><textarea id="description" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Describe your store in a few words..." required /></div><div className="field"><label>Currency</label><select value={form.currency} onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}><option value="INR">Indian Rupee (₹)</option></select></div><div className="field"><label>How do you want to take orders?</label><div className="wizard-radio-stack">{[['whatsapp', 'WhatsApp Orders', 'Customers order via WhatsApp messages'], ['website', 'Website Orders', 'Customers checkout directly on your site'], ['both', 'Both WhatsApp & Website', 'Let customers choose their preferred way']].map(([id, title, text]) => <button key={id} type="button" className={cn('wizard-radio-card', form.orderMode === id && 'active')} onClick={() => setForm((prev) => ({ ...prev, orderMode: id }))}><strong>{title}</strong><span>{text}</span></button>)}</div></div><div className="wizard-upload-grid"><div className="field"><label>Logo</label><label className="wizard-upload-box"><input type="file" accept="image/*" onChange={(event) => uploadDraftImage('logo', event)} hidden />{form.logo ? <img src={form.logo} alt="Logo" /> : <span>Upload logo</span>}</label></div><div className="field"><label>Banner</label><label className="wizard-upload-box wide"><input type="file" accept="image/*" onChange={(event) => uploadDraftImage('banner', event)} hidden />{form.banner ? <img src={form.banner} alt="Banner" /> : <span>Upload banner</span>}</label></div><div className="field wizard-upload-full"><label>Mobile Hero Banner (optional)</label><label className="wizard-upload-box wide"><input type="file" accept="image/*" onChange={(event) => uploadDraftImage('bannerMobile', event)} hidden />{form.bannerMobile ? <img src={form.bannerMobile} alt="Mobile banner" /> : <span>Upload mobile hero image</span>}</label></div></div></> : null}
        {step === 3 ? <><div className="wizard-section-head"><h2>Location Details</h2><p>Help customers find you</p></div><div className="wizard-tip">All fields here are optional - you can skip ahead!</div><div className="form-grid two"><div className="field"><label>City</label><input value={form.city} onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))} placeholder="Mumbai" /></div><div className="field"><label>State / Region</label><input value={form.state} onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))} placeholder="Maharashtra" /></div></div><div className="field"><label>Full Address</label><textarea value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} placeholder="123 Main Street, Building A, Floor 2..." /></div><div className="wizard-tip">Stores with a location get more trust from customers and appear more professional.</div></> : null}
        {step === 4 ? <><div className="wizard-section-head"><h2>Contact Details</h2><p>How customers can reach you</p></div><div className="wizard-tip">Only email is required - WhatsApp is optional unless you choose WhatsApp orders</div><div className="field"><label>WhatsApp Number</label><input value={form.whatsapp} onChange={(event) => setForm((prev) => ({ ...prev, whatsapp: event.target.value }))} placeholder="+91 98765 43210" /></div><div className="field"><label>Your Email *</label><input type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} readOnly={googleMode} required /></div>{!googleMode ? <><div className="field"><label>Full Name</label><input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required /></div><div className="field"><label>Password</label><input type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} placeholder="Minimum 8 characters" required /></div><div className="field"><label>Phone / WhatsApp</label><input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="9876543210" required /></div></> : null}<div className="wizard-tip">{form.orderMode === 'website' ? 'Website ordering: Customers will see a Buy Now button and checkout directly on your website.' : form.orderMode === 'whatsapp' ? 'WhatsApp ordering: Customers will contact you directly on WhatsApp.' : 'Both ordering modes: Customers can choose website checkout or WhatsApp.'}</div></> : null}
        {step === 5 ? <><div className="wizard-section-head"><h2>Social Media</h2><p>Connect your social accounts</p></div><div className="wizard-tip">Both are optional - you can add them later from Settings</div><div className="field"><label>Instagram</label><input value={form.instagram} onChange={(event) => setForm((prev) => ({ ...prev, instagram: event.target.value }))} placeholder="https://instagram.com/yourstore" /></div><div className="field"><label>Facebook</label><input value={form.facebook} onChange={(event) => setForm((prev) => ({ ...prev, facebook: event.target.value }))} placeholder="https://facebook.com/yourstore" /></div><div className="wizard-summary-box"><strong>Launching with {form.plan === 'growth' ? 'Growth' : 'Starter'} plan</strong><span>{form.plan === 'growth' ? '₹999/month • Unlimited products' : '₹499/month • 100 products'}</span></div><div className="wizard-tip">You're all set! Click Launch My Store to create your store. You can always update everything later.</div></> : null}
        <div className="wizard-actions"><div className="actions">{step > 1 ? <button className="btn btn-secondary" type="button" onClick={prevStep}>Back</button> : <Link className="btn btn-secondary" to="/login">Already have an account?</Link>}</div><div className="actions">{step < 5 ? <button className="btn" type="button" onClick={nextStep}>Next</button> : <button className="btn" type="submit" disabled={state.loading}>{state.loading ? 'Launching...' : 'Launch My Store'}</button>}</div></div>
      </form>
    </AuthShell>
        </div>
      </div>
    </div>
  );
}

function DashboardFrame({ activeKey, title, subtitle, children }) {
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
        <div className="topbar-actions"><span className="topbar-pill"><span className="topbar-dot" />Live store</span><a className="btn btn-secondary" href={`/store/${store.slug}`} target="_blank" rel="noopener noreferrer">View store</a><button className="btn btn-secondary" type="button" onClick={() => { logoutVendor(); navigate('/login'); }}>Sign out</button></div>
      </div>
      <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      <nav className="sidebar">{DASHBOARD_LINKS.map((item) => <NavLink key={item.key} className={({ isActive }) => cn('nav-link', isActive && 'active')} to={item.href} onClick={() => setSidebarOpen(false)}><span className="nav-icon">{item.icon}</span><span className="nav-label">{item.label}</span></NavLink>)}</nav>
      <main className="main admin-shell"><div className="content-wrap"><div className="page-header"><div><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div></div>{children}</div></main>
      <nav className="mobile-nav">{DASHBOARD_LINKS.map((item) => <NavLink key={item.key} to={item.href} className={({ isActive }) => isActive ? 'active' : ''}><span>{item.icon}</span><span>{item.label}</span></NavLink>)}</nav>
    </div>
  );
}

function DashboardOverviewPage() {
  usePageTitle('Dashboard - StoreBanao');
  const { vendor } = useAuth();
  const token = vendor && vendor.token;
  const userSlug = vendor && vendor.user && vendor.user.storeSlug ? vendor.user.storeSlug : 'dashboard';
  const { data, loading, error } = useCachedApiData(`vendor_dashboard_${userSlug}`, () => api.get('/api/dashboard', token), [token], { stats: {}, store: {} });
  const stats = data.stats || {};
  const store = data.store || {};
  const setupItems = [
    [store.name ? 'done' : '', 'Store profile', store.name ? 'Store basics are set up.' : 'Complete your store profile.'],
    [stats.totalProducts > 0 ? 'done' : '', 'Products', stats.totalProducts > 0 ? `${stats.totalProducts} products live.` : 'Add your first product.'],
    [stats.totalOrders > 0 ? 'done' : '', 'Orders', stats.totalOrders > 0 ? `${stats.totalOrders} orders recorded.` : 'Your first order will appear here.'],
    [stats.totalCustomers > 0 ? 'done' : '', 'Customers', stats.totalCustomers > 0 ? `${stats.totalCustomers} customers saved.` : 'Customers will auto-save after checkout.']
  ];
  return (
    <VendorOnly>
      <DashboardFrame activeKey="dashboard" title="Dashboard" subtitle="See what is happening across your store today.">
        {error ? <Alert type="error">{error}</Alert> : null}
        {loading ? <LoadingBlock label="Loading dashboard..." /> : <><section className="hero-grid"><div className="card hero-card"><div className="mini-title">Store overview</div><div className="mini-number">{store.name || 'Your Store'}</div><p className="page-subtitle">Track products, revenue, and visitors from one place.</p><div className="hero-meta"><span className="topbar-pill">Visits: {store.visits || 0}</span><span className="topbar-pill">Pending: {stats.pendingOrders || 0}</span><span className="topbar-pill">Today: {stats.todayOrders || 0}</span></div></div><div className="stacked"><div className="card mini-card"><div className="mini-title">Revenue</div><div className="mini-number">{formatMoney(stats.totalRevenue || 0)}</div></div><div className="card mini-card"><div className="mini-title">Customers</div><div className="mini-number">{stats.totalCustomers || 0}</div></div></div></section><section className="mini-grid">{[['Products', stats.totalProducts || 0, '◫'], ['Orders', stats.totalOrders || 0, '⟡'], ['Today Orders', stats.todayOrders || 0, '⌁'], ['Pending', stats.pendingOrders || 0, '◌']].map(([label, value, icon]) => <div key={label} className="card metric-card"><div className="metric-icon">{icon}</div><div><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div></div>)}</section><section className="card panel"><div className="section-head"><h2 className="section-title">Store setup</h2></div><div className="setup-list">{setupItems.map(([done, title, hint]) => <div key={title} className="setup-item"><div className={cn('setup-check', done)}>✓</div><div><div className="setup-title">{title}</div><div className="setup-hint">{hint}</div></div></div>)}</div></section></>}
      </DashboardFrame>
    </VendorOnly>
  );
}

function DashboardProductsPage() {
  usePageTitle('Products - StoreBanao');
  const { vendor } = useAuth();
  const token = vendor && vendor.token;
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState({ name: '', description: '', price: '', comparePrice: '', stock: '', sku: '', image: '', category: '' });
  const [actionState, setActionState] = useState({ loading: false, error: '', success: '' });
  const [uploadingImage, setUploadingImage] = useState(false);
  const mediaState = useDashboardMedia(token);
  const { data, loading, error } = useCachedApiData(`vendor_products_${vendor && vendor.user ? vendor.user.storeSlug : 'store'}`, () => api.get('/api/dashboard/products', token), [token], { products: [] });
  const products = data.products || [];

  function startEdit(product) {
    setEditingId(product.id);
    setForm({ name: product.name || '', description: product.description || '', price: product.price || '', comparePrice: product.comparePrice || product.mrp || '', stock: product.stock || '', sku: product.sku || '', image: product.image || '', category: product.category || '' });
  }

  function resetForm() {
    setEditingId('');
    setForm({ name: '', description: '', price: '', comparePrice: '', stock: '', sku: '', image: '', category: '' });
  }

  async function submit(event) {
    event.preventDefault();
    setActionState({ loading: true, error: '', success: '' });
    try {
      if (editingId) {
        await api.put(`/api/dashboard/products/${editingId}`, form, token);
      } else {
        await api.post('/api/dashboard/products', form, token);
      }
      window.location.reload();
    } catch (actionError) {
      setActionState({ loading: false, error: actionError.message || 'Unable to save product', success: '' });
    }
  }

  async function remove(productId) {
    if (!window.confirm('Delete this product?')) return;
    await api.del(`/api/dashboard/products/${productId}`, token);
    window.location.reload();
  }

  async function uploadImage(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const data = await uploadDashboardFile('/api/dashboard/upload/product-image', file, token);
      setForm((prev) => ({ ...prev, image: data.url }));
    } catch (error) {
      setActionState({ loading: false, error: error.message || 'Unable to upload image', success: '' });
    } finally {
      setUploadingImage(false);
    }
  }

  return (
    <VendorOnly>
      <DashboardFrame activeKey="products" title="Products" subtitle="Create, update, and manage your catalog.">
        {error ? <Alert type="error">{error}</Alert> : null}
        {actionState.error ? <Alert type="error">{actionState.error}</Alert> : null}
        <section className="card panel"><div className="section-head"><h2 className="section-title">{editingId ? 'Edit product' : 'Add new product'}</h2>{editingId ? <button className="btn btn-secondary" type="button" onClick={resetForm}>Cancel</button> : null}</div><form className="form-grid" onSubmit={submit}><div className="form-grid two"><div className="field"><label>Name</label><input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required /></div><div className="field"><label>Price</label><input value={form.price} onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))} required /></div><div className="field"><label>Compare Price</label><input value={form.comparePrice} onChange={(event) => setForm((prev) => ({ ...prev, comparePrice: event.target.value }))} /></div><div className="field"><label>Stock</label><input value={form.stock} onChange={(event) => setForm((prev) => ({ ...prev, stock: event.target.value }))} /></div><div className="field"><label>SKU</label><input value={form.sku} onChange={(event) => setForm((prev) => ({ ...prev, sku: event.target.value }))} /></div><div className="field"><label>Category</label><input value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} /></div></div><div className="field"><label>Image URL</label><input value={form.image} onChange={(event) => setForm((prev) => ({ ...prev, image: event.target.value }))} /></div><div className="field"><label>Or upload image</label><input type="file" accept="image/*" onChange={uploadImage} />{uploadingImage ? <div className="section-muted">Uploading image...</div> : null}{form.image ? <img className="logo-preview" src={form.image} alt="Product preview" /> : null}</div><div className="osa-block"><h3>Choose from Media Library</h3><MediaPicker images={mediaState.data.images || []} onSelect={(src) => setForm((prev) => ({ ...prev, image: src }))} /></div><div className="field"><label>Description</label><textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} /></div><div className="actions"><button className="btn" type="submit" disabled={actionState.loading}>{actionState.loading ? 'Saving...' : editingId ? 'Update Product' : 'Create Product'}</button></div></form></section>
        <section className="card panel"><div className="section-head"><h2 className="section-title">All products</h2></div>{loading ? <LoadingBlock label="Loading products..." /> : products.length ? <div className="table-wrap"><table><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>SKU</th><th>Actions</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td>{product.name}</td><td>{formatMoney(product.price)}</td><td>{product.stock || 0}</td><td>{product.sku || '-'}</td><td><div className="actions"><button className="btn btn-secondary" type="button" onClick={() => startEdit(product)}>Edit</button><button className="btn btn-danger" type="button" onClick={() => remove(product.id)}>Delete</button></div></td></tr>)}</tbody></table></div> : <EmptyState title="No products yet" body="Add your first product to start selling." />}</section>
      </DashboardFrame>
    </VendorOnly>
  );
}

function DashboardOrdersPage() {
  usePageTitle('Orders - StoreBanao');
  const { vendor } = useAuth();
  const token = vendor && vendor.token;
  const { data, loading, error } = useCachedApiData(`vendor_orders_${vendor && vendor.user ? vendor.user.storeSlug : 'store'}`, () => api.get('/api/dashboard/orders', token), [token], { orders: [] });
  const orders = data.orders || [];

  async function updateStatus(orderId, status) {
    await api.put(`/api/dashboard/orders/${orderId}/status`, { status }, token);
    window.location.reload();
  }

  return (
    <VendorOnly>
      <DashboardFrame activeKey="orders" title="Orders" subtitle="Track customer orders and update status.">
        {error ? <Alert type="error">{error}</Alert> : null}
        <section className="card panel"><div className="section-head"><h2 className="section-title">All orders</h2><button className="btn btn-secondary" type="button" onClick={() => downloadAuthorized('/api/dashboard/orders/export', token, 'orders-export.csv')}>Export CSV</button></div>{loading ? <LoadingBlock label="Loading orders..." /> : orders.length ? <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong>{order.orderNumber || order.id}</strong><div className="section-muted">{order.productName}</div></td><td>{order.customerName}<div className="section-muted">{order.customerPhone}</div></td><td>{formatMoney(order.amount)}</td><td><select value={order.status || 'pending'} onChange={(event) => updateStatus(order.id, event.target.value)}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="processing">Processing</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select></td><td>{formatDate(order.createdAt)}</td></tr>)}</tbody></table></div> : <EmptyState title="No orders yet" body="Orders will appear here once customers checkout." />}</section>
      </DashboardFrame>
    </VendorOnly>
  );
}

function DashboardCustomersPage() {
  usePageTitle('Customers - StoreBanao');
  const { vendor } = useAuth();
  const token = vendor && vendor.token;
  const { data, loading, error } = useCachedApiData(`vendor_customers_${vendor && vendor.user ? vendor.user.storeSlug : 'store'}`, () => api.get('/api/dashboard/customers', token), [token], { customers: [] });
  const customers = data.customers || [];
  return (
    <VendorOnly>
      <DashboardFrame activeKey="customers" title="Customers" subtitle="See everyone who has shopped from your store.">
        {error ? <Alert type="error">{error}</Alert> : null}
        <section className="card panel">{loading ? <LoadingBlock label="Loading customers..." /> : customers.length ? <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Orders</th><th>Joined</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id || customer.email}><td>{customer.name || '-'}</td><td>{customer.email || '-'}</td><td>{customer.phone || '-'}</td><td>{Array.isArray(customer.orders) ? customer.orders.length : 0}</td><td>{formatDate(customer.createdAt)}</td></tr>)}</tbody></table></div> : <EmptyState title="No customers yet" body="Customers will be saved automatically after checkout." />}</section>
      </DashboardFrame>
    </VendorOnly>
  );
}

function DashboardSimpleTablePage({ activeKey, title, subtitle, load, rows, emptyTitle, emptyBody }) {
  return (
    <VendorOnly>
      <DashboardFrame activeKey={activeKey} title={title} subtitle={subtitle}>
        <DashboardTableContent load={load} rows={rows} emptyTitle={emptyTitle} emptyBody={emptyBody} />
      </DashboardFrame>
    </VendorOnly>
  );
}

function DashboardTableContent({ load, rows, emptyTitle, emptyBody }) {
  const { data, loading, error } = load();
  if (error) return <Alert type="error">{error}</Alert>;
  if (loading) return <LoadingBlock label="Loading..." />;
  return rows(data).length ? rows(data) : <EmptyState title={emptyTitle} body={emptyBody} />;
}

function DashboardAnalyticsPage() {
  usePageTitle('Analytics - StoreBanao');
  const { token } = useDashboardStoreData();
  const { data, loading, error } = useApiData(() => api.get('/api/dashboard/analytics', token), [token], { breakdown: {}, last7Days: [] });
  const breakdown = data.breakdown || {};
  return <VendorOnly><DashboardFrame activeKey="analytics" title="Analytics" subtitle="Visits, revenue, order breakdown, and 7-day trend.">{error ? <Alert type="error">{error}</Alert> : null}{loading ? <LoadingBlock label="Loading analytics..." /> : <><section className="mini-grid">{[['Visits', data.visits || 0], ['Revenue', formatMoney(data.revenue || 0)], ['Products', data.products || 0], ['Orders', data.orders || 0]].map(([label, value]) => <div key={label} className="card mini-card"><div className="mini-title">{label}</div><div className="mini-number">{value}</div></div>)}</section><section className="grid-2"><div className="card panel"><h2 className="section-title">Order breakdown</h2><div className="kpi-list">{Object.entries(breakdown).map(([key, value]) => <div key={key} className="kpi-item"><strong>{key}</strong><span>{value}</span></div>)}</div></div><div className="card panel"><h2 className="section-title">Last 7 Days</h2><div className="kpi-list">{(data.last7Days || []).map((day) => <div key={day.label} className="kpi-item"><strong>{day.label}</strong><span>{day.orders} orders · {formatMoney(day.revenue)}</span></div>)}</div></div></section></>}</DashboardFrame></VendorOnly>;
}

function DashboardSystemStatusPage() {
  usePageTitle('System Status - StoreBanao');
  const { token } = useDashboardStoreData();
  const { data, loading, error } = useApiData(() => api.get('/api/dashboard/system-status', token), [token], { status: {}, store: {} });
  const status = data.status || {};
  return <VendorOnly><DashboardFrame activeKey="system-status" title="System Status" subtitle="Check cache, DB, and environment status.">{error ? <Alert type="error">{error}</Alert> : null}{loading ? <LoadingBlock label="Loading system status..." /> : <section className="card panel"><div className="kpi-list">{Object.entries(status).map(([key, value]) => <div key={key} className="kpi-item"><strong>{key}</strong><span>{String(value)}</span></div>)}</div></section>}</DashboardFrame></VendorOnly>;
}

function DashboardSettingsPage() {
  usePageTitle('Store Settings - StoreBanao');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = searchParams.get('section') || 'store-details';
  const { token, data, loading, error } = useDashboardStoreData();
  const store = data.store || {};
  const [profile, setProfile] = useState({ name: '', description: '', whatsapp: '', theme: 'default', logo: '', favicon: '', category: '', phone: '', email: '', legalName: '', businessType: 'Individual', address: '', facebook: '', youtube: '', instagram: '' });
  const [settings, setSettings] = useState(DEFAULT_STORE_SETTINGS);
  const [redirectDraft, setRedirectDraft] = useState({ from: '', to: '' });
  const [state, setState] = useState({ loading: false, error: '', success: '' });

  useEffect(() => {
    const merged = getMergedStoreSettings(store);
    setSettings(merged);
    setProfile({
      name: store.name || '',
      description: store.description || '',
      whatsapp: store.whatsapp || '',
      theme: store.theme || 'default',
      logo: store.logo || '',
      favicon: merged.storeDetails.favicon || '',
      category: merged.storeDetails.category || '',
      phone: merged.storeDetails.phone || '',
      email: merged.storeDetails.email || '',
      legalName: merged.storeDetails.legalName || '',
      businessType: merged.storeDetails.businessType || 'Individual',
      address: merged.storeDetails.address || '',
      facebook: (merged.storeDetails.socialLinks || {}).facebook || '',
      youtube: (merged.storeDetails.socialLinks || {}).youtube || '',
      instagram: (merged.storeDetails.socialLinks || {}).instagram || ''
    });
  }, [store]);

  function updateSection(sectionKey, partial) {
    setSettings((prev) => ({ ...prev, [sectionKey]: { ...prev[sectionKey], ...partial } }));
  }

  async function saveSection(event) {
    event.preventDefault();
    setState({ loading: true, error: '', success: '' });
    try {
      const nextSettings = deepMerge(DEFAULT_STORE_SETTINGS, settings);
      if (activeSection === 'store-details') {
        nextSettings.storeDetails = {
          ...nextSettings.storeDetails,
          favicon: profile.favicon,
          category: profile.category,
          phone: profile.phone,
          email: profile.email,
          legalName: profile.legalName,
          businessType: profile.businessType,
          address: profile.address,
          socialLinks: { facebook: profile.facebook, youtube: profile.youtube, instagram: profile.instagram }
        };
        await api.put('/api/dashboard/store/profile', { name: profile.name, description: profile.description, whatsapp: profile.whatsapp, theme: profile.theme, logo: profile.logo }, token);
      }
      if (activeSection === 'store-domain') {
        await api.put('/api/dashboard/domain', nextSettings.domain, token);
      }
      if (activeSection === 'delivery-settings') {
        await api.put('/api/dashboard/shipping', { mode: nextSettings.deliverySettings.serviceType === 'pickup' ? 'pickup' : 'flat', fee: nextSettings.deliverySettings.fee, notes: nextSettings.deliverySettings.normalSubtitle }, token);
      }
      if (activeSection === 'notifications-settings') {
        await api.put('/api/dashboard/notifications', nextSettings.notificationsSettings, token);
      }
      if (activeSection === 'label-settings') {
        await api.put('/api/dashboard/display-settings', {
          categoryTitle: nextSettings.labelSettings.categoriesHeading,
          productsTitle: nextSettings.labelSettings.productsHeading,
          menuHomeLabel: nextSettings.labelSettings.bottomNavHome,
          menuCartLabel: nextSettings.labelSettings.bottomNavCart,
          menuAccountLabel: nextSettings.labelSettings.bottomNavAccount
        }, token);
      }
      if (activeSection === 'login-settings') {
        nextSettings.labelSettings.signInHeading = nextSettings.loginSettings.signInHeading;
        nextSettings.labelSettings.signUpHeading = nextSettings.loginSettings.signUpHeading;
        nextSettings.labelSettings.requestOtpButton = nextSettings.loginSettings.requestOtpButton;
      }
      await api.put('/api/dashboard/store-settings', nextSettings, token);
      setSettings(nextSettings);
      setState({ loading: false, error: '', success: `${STORE_SETTINGS_SECTIONS.find((item) => item.id === activeSection)?.label || 'Store Settings'} saved.` });
    } catch (saveError) {
      setState({ loading: false, error: saveError.message || 'Unable to save settings', success: '' });
    }
  }
  const current = settings;
  const sectionMeta = STORE_SETTINGS_SECTIONS.find((item) => item.id === activeSection) || STORE_SETTINGS_SECTIONS[0];
  const redirects = Array.isArray(current.urlRedirects) ? current.urlRedirects : [];

  function addRedirect(event) {
    event.preventDefault();
    if (!redirectDraft.from || !redirectDraft.to) return;
    setSettings((prev) => ({ ...prev, urlRedirects: (prev.urlRedirects || []).concat({ from: redirectDraft.from, to: redirectDraft.to }) }));
    setRedirectDraft({ from: '', to: '' });
  }

  function removeRedirect(index) {
    setSettings((prev) => ({ ...prev, urlRedirects: (prev.urlRedirects || []).filter((_, itemIndex) => itemIndex !== index) }));
  }

  return <VendorOnly><DashboardFrame activeKey="settings" title="Store Settings" subtitle="Everything from store details to SEO, checkout, delivery, policies, labels, and robots.txt is grouped here section by section.">{error ? <Alert type="error">{error}</Alert> : null}{state.error ? <Alert type="error">{state.error}</Alert> : null}{state.success ? <Alert type="success">{state.success}</Alert> : null}{loading ? <LoadingBlock label="Loading settings..." /> : <><div className="osa-page-head"><div><h1>Store Settings</h1><p>Everything from store details to SEO, checkout, delivery, policies, labels, and robots.txt is grouped here section by section.</p></div></div><div className="osa-settings-layout"><SectionNav sections={STORE_SETTINGS_SECTIONS} activeSection={activeSection} onSelect={(section) => setSearchParams({ section })} /><section className="osa-card osa-form-panel"><div className="osa-form-head"><h2>{sectionMeta.label}</h2><p>Each submenu is dedicated to one area so setting up the store feels simple, even for first-time users.</p></div>{activeSection === 'store-details' ? <form className="osa-form-grid" onSubmit={saveSection}><div className="osa-block"><h3>Store Logo</h3><div className="osa-form-grid two"><div>{profile.logo ? <img className="logo-preview" src={profile.logo} alt={profile.name} /> : <div className="empty">No logo uploaded</div>}<div className="osa-field" style={{ marginTop: 12 }}><label>Store logo URL</label><input value={profile.logo} onChange={(event) => setProfile((prev) => ({ ...prev, logo: event.target.value }))} /></div><div className="osa-field" style={{ marginTop: 10 }}><label>Or upload logo</label><input type="file" accept="image/*" onChange={(event) => saveFileAsDraft(event, (value) => setProfile((prev) => ({ ...prev, logo: value })))} /></div></div><div>{profile.favicon ? <img className="logo-preview" src={profile.favicon} alt="Favicon" /> : <div className="empty">No favicon uploaded</div>}<div className="osa-field" style={{ marginTop: 12 }}><label>Favicon URL</label><input value={profile.favicon} onChange={(event) => setProfile((prev) => ({ ...prev, favicon: event.target.value }))} /></div><div className="osa-field" style={{ marginTop: 10 }}><label>Or upload favicon</label><input type="file" accept="image/*" onChange={(event) => saveFileAsDraft(event, (value) => setProfile((prev) => ({ ...prev, favicon: value })))} /></div></div></div></div><div className="osa-block"><h3>Store Information</h3><div className="osa-form-grid two"><div className="osa-field"><label>Store name</label><input value={profile.name} onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))} required /></div><div className="osa-field"><label>Category</label><input value={profile.category} onChange={(event) => setProfile((prev) => ({ ...prev, category: event.target.value }))} /></div><div className="osa-field"><label>Phone number</label><input value={profile.phone} onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))} /></div><div className="osa-field"><label>Email</label><input type="email" value={profile.email} onChange={(event) => setProfile((prev) => ({ ...prev, email: event.target.value }))} /></div><div className="osa-field"><label>WhatsApp number</label><input value={profile.whatsapp} onChange={(event) => setProfile((prev) => ({ ...prev, whatsapp: event.target.value }))} /></div><div className="osa-field"><label>Theme mode</label><select value={profile.theme} onChange={(event) => setProfile((prev) => ({ ...prev, theme: event.target.value }))}><option value="default">Default</option><option value="dark">Dark</option></select></div></div><div className="osa-field"><label>Store description</label><textarea value={profile.description} onChange={(event) => setProfile((prev) => ({ ...prev, description: event.target.value }))} /></div></div><div className="osa-block"><h3>Business Information</h3><div className="osa-form-grid two"><div className="osa-field"><label>Legal name</label><input value={profile.legalName} onChange={(event) => setProfile((prev) => ({ ...prev, legalName: event.target.value }))} /></div><div className="osa-field"><label>Business type</label><select value={profile.businessType} onChange={(event) => setProfile((prev) => ({ ...prev, businessType: event.target.value }))}><option value="Individual">Individual</option><option value="Sole Proprietorship">Sole Proprietorship</option><option value="Partnership">Partnership</option><option value="Private Limited">Private Limited</option></select></div></div><div className="osa-field"><label>Address</label><textarea value={profile.address} onChange={(event) => setProfile((prev) => ({ ...prev, address: event.target.value }))} /></div><div className="osa-form-grid two"><div className="osa-field"><label>Facebook</label><input value={profile.facebook} onChange={(event) => setProfile((prev) => ({ ...prev, facebook: event.target.value }))} /></div><div className="osa-field"><label>YouTube</label><input value={profile.youtube} onChange={(event) => setProfile((prev) => ({ ...prev, youtube: event.target.value }))} /></div><div className="osa-field"><label>Instagram</label><input value={profile.instagram} onChange={(event) => setProfile((prev) => ({ ...prev, instagram: event.target.value }))} /></div></div></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>{state.loading ? 'Saving...' : 'Save'}</button></div></form> : null}{activeSection === 'store-domain' ? <form className="osa-form-grid" onSubmit={saveSection}><div className="osa-block"><div className="osa-form-grid two"><div className="osa-field"><label>Custom domain</label><input value={current.domain.customDomain} onChange={(event) => updateSection('domain', { customDomain: event.target.value })} placeholder="shop.example.com" /></div><div className="osa-field"><label>Subdomain</label><input value={current.domain.subdomain} onChange={(event) => updateSection('domain', { subdomain: event.target.value })} placeholder="mybrand.example.com" /></div></div><p className="osa-block-note">Use either a custom domain or a subdomain. These values are also used by the host-based redirect logic.</p></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'products-settings' ? <form className="osa-form-grid" onSubmit={saveSection}><ToggleField title="Hide out-of-stock products" description="When enabled, zero-stock products will not appear in the storefront grid." checked={current.productSettings.hideOutOfStock} onChange={(value) => updateSection('productSettings', { hideOutOfStock: value })} /><ToggleField title="Product card: display single variant details" description="Keep a placeholder toggle ready for products with a single variant." checked={current.productSettings.displaySingleVariantDetails} onChange={(value) => updateSection('productSettings', { displaySingleVariantDetails: value })} /><ToggleField title="Show cart checkout popup" description="After adding a product, send the customer quickly toward checkout." checked={current.productSettings.showCartCheckoutPopup} onChange={(value) => updateSection('productSettings', { showCartCheckoutPopup: value })} /><div className="osa-block"><div className="osa-form-grid two"><div className="osa-field"><label>Product card sale price</label><select value={current.productSettings.productCardSalePrice} onChange={(event) => updateSection('productSettings', { productCardSalePrice: event.target.value })}><option value="sale-tax">Sale Price with Tax Amount</option><option value="sale-only">Sale Price Only</option><option value="sale-tax-exclusive">Sale Price Tax Exclusive</option></select></div><div className="osa-field"><label>Product page sale price</label><select value={current.productSettings.productPageSalePrice} onChange={(event) => updateSection('productSettings', { productPageSalePrice: event.target.value })}><option value="sale-tax">Sale Price with Tax Amount</option><option value="sale-only">Sale Price Only</option><option value="sale-tax-exclusive">Sale Price Tax Exclusive</option></select></div><div className="osa-field"><label>Minimum quantity increment rule</label><select value={current.productSettings.minimumQtyIncrementRule} onChange={(event) => updateSection('productSettings', { minimumQtyIncrementRule: event.target.value })}><option value="single">Single</option><option value="double">Double</option><option value="custom">Custom</option></select></div><div className="osa-field"><label>Variant selector type</label><select value={current.productSettings.variantSelectorType} onChange={(event) => updateSection('productSettings', { variantSelectorType: event.target.value })}><option value="chips">Chips</option><option value="dropdown">Dropdown</option><option value="buttons">Buttons</option></select></div></div></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'checkout-settings' ? <form className="osa-form-grid" onSubmit={saveSection}><div className="osa-block"><div className="osa-form-grid two"><div className="osa-field"><label>Cart total amount rounding mode</label><select value={current.checkoutSettings.roundingMode} onChange={(event) => updateSection('checkoutSettings', { roundingMode: event.target.value })}><option value="none">No rounding</option><option value="up">Round up</option><option value="down">Round down</option><option value="nearest">Round to nearest rupee</option></select></div><div className="osa-field"><label>Minimum order amount</label><input value={current.checkoutSettings.minimumOrderAmount} onChange={(event) => updateSection('checkoutSettings', { minimumOrderAmount: event.target.value })} /></div></div></div><ToggleField title="Show tax information" description="Display tax details on cart and checkout." checked={current.checkoutSettings.showTaxInfo} onChange={(value) => updateSection('checkoutSettings', { showTaxInfo: value })} /><div className="osa-block"><div className="osa-field"><label>Cart note</label><textarea value={current.checkoutSettings.cartNote} onChange={(event) => updateSection('checkoutSettings', { cartNote: event.target.value })} /></div></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'delivery-settings' ? <form className="osa-form-grid" onSubmit={saveSection}><div className="osa-block"><div className="osa-form-grid two"><div className="osa-field"><label>Delivery fees</label><input value={current.deliverySettings.fee} onChange={(event) => updateSection('deliverySettings', { fee: event.target.value })} /></div><div className="osa-field"><label>Free delivery above</label><input value={current.deliverySettings.freeDeliveryAbove} onChange={(event) => updateSection('deliverySettings', { freeDeliveryAbove: event.target.value })} /></div><div className="osa-field"><label>Set delivery radius (KM)</label><input value={current.deliverySettings.deliveryRadius} onChange={(event) => updateSection('deliverySettings', { deliveryRadius: event.target.value })} /></div><div className="osa-field"><label>Service type</label><select value={current.deliverySettings.serviceType} onChange={(event) => updateSection('deliverySettings', { serviceType: event.target.value })}><option value="delivery">Delivery</option><option value="pickup">Store pickup</option><option value="delivery-pickup">Delivery + Store pickup</option></select></div><div className="osa-field"><label>Address type</label><select value={current.deliverySettings.addressType} onChange={(event) => updateSection('deliverySettings', { addressType: event.target.value })}><option value="map">Map</option><option value="form">Form</option><option value="map-form">Map + Form</option></select></div></div></div><ToggleField title="All India delivery" description="Allow checkout from all locations instead of only a local radius." checked={current.deliverySettings.allIndiaDelivery} onChange={(value) => updateSection('deliverySettings', { allIndiaDelivery: value })} /><div className="osa-block"><div className="osa-form-grid two"><div className="osa-field"><label>Next day delivery title</label><input value={current.deliverySettings.nextDayTitle} onChange={(event) => updateSection('deliverySettings', { nextDayTitle: event.target.value })} /></div><div className="osa-field"><label>Next day delivery subtitle</label><input value={current.deliverySettings.nextDaySubtitle} onChange={(event) => updateSection('deliverySettings', { nextDaySubtitle: event.target.value })} /></div><div className="osa-field"><label>Normal delivery title</label><input value={current.deliverySettings.normalTitle} onChange={(event) => updateSection('deliverySettings', { normalTitle: event.target.value })} /></div><div className="osa-field"><label>Normal delivery subtitle</label><input value={current.deliverySettings.normalSubtitle} onChange={(event) => updateSection('deliverySettings', { normalSubtitle: event.target.value })} /></div></div></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'payment-settings' ? <form className="osa-form-grid" onSubmit={saveSection}><ToggleField title="Cash on delivery" description="Collect cash at the time of delivery." checked={current.paymentSettings.cod} onChange={(value) => updateSection('paymentSettings', { cod: value })} /><ToggleField title="Advance partial payment" description="Collect some advance payment for COD orders." checked={current.paymentSettings.partialCod} onChange={(value) => updateSection('paymentSettings', { partialCod: value })} /><ToggleField title="Online payment" description="Enable online/manual prepaid payment option at checkout." checked={current.paymentSettings.onlinePayment} onChange={(value) => updateSection('paymentSettings', { onlinePayment: value })} /><div className="osa-block"><div className="osa-field"><label>Bank details</label><textarea value={current.paymentSettings.bankDetails} onChange={(event) => updateSection('paymentSettings', { bankDetails: event.target.value })} /></div><div className="osa-field"><label>Payment mode rules</label><textarea value={current.paymentSettings.paymentModeRules} onChange={(event) => updateSection('paymentSettings', { paymentModeRules: event.target.value })} /></div></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'order-settings' ? <form className="osa-form-grid" onSubmit={saveSection}><ToggleField title="Allow invoice download" description="Let customers download their invoice from order pages." checked={current.orderSettings.allowInvoiceDownload} onChange={(value) => updateSection('orderSettings', { allowInvoiceDownload: value })} /><ToggleField title="Allow order cancellation" description="Allow customers to cancel orders before fulfillment begins." checked={current.orderSettings.allowOrderCancellation} onChange={(value) => updateSection('orderSettings', { allowOrderCancellation: value })} /><div className="osa-block"><div className="osa-form-grid two"><div className="osa-field"><label>Auto-confirm orders based on payment mode</label><select value={current.orderSettings.autoConfirmPaymentMode} onChange={(event) => updateSection('orderSettings', { autoConfirmPaymentMode: event.target.value })}><option value="online">Online</option><option value="cod">COD</option><option value="both">Both</option><option value="manual">Manual</option></select></div></div><div className="osa-field"><label>Order note shown to customer</label><textarea value={current.orderSettings.orderNote} onChange={(event) => updateSection('orderSettings', { orderNote: event.target.value })} /></div></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'return-order-settings' ? <form className="osa-form-grid" onSubmit={saveSection}><ToggleField title="Allow return requests" description="Let customers request returns after delivery." checked={current.returnOrderSettings.allowReturnRequests} onChange={(value) => updateSection('returnOrderSettings', { allowReturnRequests: value })} /><div className="osa-block"><div className="osa-form-grid two"><div className="osa-field"><label>Return window (days)</label><input value={current.returnOrderSettings.returnWindowDays} onChange={(event) => updateSection('returnOrderSettings', { returnWindowDays: event.target.value })} /></div></div><div className="osa-field"><label>Return instructions</label><textarea value={current.returnOrderSettings.instructions} onChange={(event) => updateSection('returnOrderSettings', { instructions: event.target.value })} /></div></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'label-settings' ? <form className="osa-form-grid" onSubmit={saveSection}><div className="osa-block"><div className="osa-form-grid two">{Object.entries({ searchBoxText: 'Search box text', selectLocationText: 'Select location text', categoriesHeading: 'Categories heading', collectionsHeading: 'Collections heading', productsHeading: 'Products heading', addProductButton: 'Add product button', productCardEnquiryButton: 'Product card enquiry button', viewAllProductsButton: 'View all products button', bottomNavHome: 'Bottom navigation - Home', bottomNavOrders: 'Bottom navigation - Orders', bottomNavCart: 'Bottom navigation - Cart', bottomNavAccount: 'Bottom navigation - Account', signInHeading: 'Sign in heading', signUpHeading: 'Sign up heading', requestOtpButton: 'Request OTP button' }).map(([key, label]) => <div key={key} className="osa-field"><label>{label}</label><input value={current.labelSettings[key]} onChange={(event) => updateSection('labelSettings', { [key]: event.target.value })} /></div>)}</div></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'seo-settings' ? <form className="osa-form-grid" onSubmit={saveSection}><div className="osa-block"><div className="osa-field"><label>Title</label><input value={current.seoSettings.title} onChange={(event) => updateSection('seoSettings', { title: event.target.value })} /></div><div className="osa-field"><label>Description</label><textarea value={current.seoSettings.description} onChange={(event) => updateSection('seoSettings', { description: event.target.value })} /></div><div className="osa-field"><label>Keywords</label><input value={current.seoSettings.keywords} onChange={(event) => updateSection('seoSettings', { keywords: event.target.value })} /></div><div className="osa-form-grid two"><div className="osa-field"><label>Google site verification ID</label><input value={current.seoSettings.googleSiteVerification} onChange={(event) => updateSection('seoSettings', { googleSiteVerification: event.target.value })} /></div><div className="osa-field"><label>Facebook domain verification ID</label><input value={current.seoSettings.facebookDomainVerification} onChange={(event) => updateSection('seoSettings', { facebookDomainVerification: event.target.value })} /></div><div className="osa-field"><label>Pinterest domain verification ID</label><input value={current.seoSettings.pinterestDomainVerification} onChange={(event) => updateSection('seoSettings', { pinterestDomainVerification: event.target.value })} /></div></div></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'llm-settings' ? <form className="osa-form-grid" onSubmit={saveSection}><ToggleField title="Enable llms.txt output" description="Generate a simple llms.txt summary for AI tools." checked={current.llmSettings.enabled} onChange={(value) => updateSection('llmSettings', { enabled: value })} /><div className="osa-block"><div className="osa-field"><label>Business summary</label><textarea value={current.llmSettings.businessSummary} onChange={(event) => updateSection('llmSettings', { businessSummary: event.target.value })} /></div><div className="osa-form-grid two"><div className="osa-field"><label>Support email</label><input value={current.llmSettings.supportEmail} onChange={(event) => updateSection('llmSettings', { supportEmail: event.target.value })} /></div><div className="osa-field"><label>Support phone</label><input value={current.llmSettings.supportPhone} onChange={(event) => updateSection('llmSettings', { supportPhone: event.target.value })} /></div></div></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'notifications-settings' ? <form className="osa-form-grid" onSubmit={saveSection}><ToggleField title="New order notifications" description="Get notified whenever a new order arrives." checked={current.notificationsSettings.newOrder} onChange={(value) => updateSection('notificationsSettings', { newOrder: value })} /><ToggleField title="WhatsApp lead notifications" description="Get notified about incoming WhatsApp leads." checked={current.notificationsSettings.whatsappLead} onChange={(value) => updateSection('notificationsSettings', { whatsappLead: value })} /><ToggleField title="Low stock notifications" description="Get notified when stock gets low." checked={current.notificationsSettings.lowStock} onChange={(value) => updateSection('notificationsSettings', { lowStock: value })} /><ToggleField title="Abandoned cart notifications" description="Get notified when customers leave items in the cart." checked={current.notificationsSettings.abandonedCart} onChange={(value) => updateSection('notificationsSettings', { abandonedCart: value })} /><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'login-settings' ? <form className="osa-form-grid" onSubmit={saveSection}><ToggleField title="Allow registration" description="Let customers create accounts from the storefront." checked={current.loginSettings.allowRegistration} onChange={(value) => updateSection('loginSettings', { allowRegistration: value })} /><div className="osa-block"><div className="osa-form-grid two"><div className="osa-field"><label>Sign in heading</label><input value={current.loginSettings.signInHeading} onChange={(event) => updateSection('loginSettings', { signInHeading: event.target.value })} /></div><div className="osa-field"><label>Sign up heading</label><input value={current.loginSettings.signUpHeading} onChange={(event) => updateSection('loginSettings', { signUpHeading: event.target.value })} /></div><div className="osa-field"><label>Request OTP button</label><input value={current.loginSettings.requestOtpButton} onChange={(event) => updateSection('loginSettings', { requestOtpButton: event.target.value })} /></div></div></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'url-redirects' ? <><form className="osa-form-grid" onSubmit={addRedirect}><div className="osa-block"><div className="osa-form-grid two"><div className="osa-field"><label>From path</label><input value={redirectDraft.from} onChange={(event) => setRedirectDraft((prev) => ({ ...prev, from: event.target.value }))} placeholder="/old-page" /></div><div className="osa-field"><label>To path / URL</label><input value={redirectDraft.to} onChange={(event) => setRedirectDraft((prev) => ({ ...prev, to: event.target.value }))} placeholder="/new-page or https://..." /></div></div><p className="osa-block-note">Redirects work inside your store path and also accept full URLs.</p></div><div className="osa-actions"><button className="osa-btn" type="submit">Add redirect</button><button className="osa-btn secondary" type="button" onClick={saveSection} disabled={state.loading}>Save list</button></div></form>{redirects.length ? <div className="osa-block">{redirects.map((item, index) => <div key={`${item.from}-${index}`} className="osa-toggle-row" style={{ alignItems: 'center' }}><div className="osa-toggle-copy"><strong>{item.from}</strong><span>{item.to}</span></div><button className="osa-btn secondary" type="button" onClick={() => removeRedirect(index)}>Delete</button></div>)}</div> : <p className="osa-block-note">No redirect rules added yet.</p>}</> : null}{activeSection === 'robots-txt' ? <form className="osa-form-grid" onSubmit={saveSection}><div className="osa-block"><div className="osa-field"><label>Configuration mode</label><select value={current.robotsSettings.mode} onChange={(event) => updateSection('robotsSettings', { mode: event.target.value })}><option value="normal">Normal</option><option value="advanced">Advanced</option></select></div></div><ToggleField title="Allow crawling (Default)" description="Allow all search engines and bots to crawl your site." checked={current.robotsSettings.allowAll} onChange={(value) => updateSection('robotsSettings', { allowAll: value })} /><ToggleField title="Allow home page only" description="Allow crawling of home page only, block all other pages." checked={current.robotsSettings.homeOnly} onChange={(value) => updateSection('robotsSettings', { homeOnly: value })} /><ToggleField title="Block crawling" description="Prevent all bots and crawlers from accessing your site." checked={current.robotsSettings.blockAll} onChange={(value) => updateSection('robotsSettings', { blockAll: value })} /><div className="osa-block"><div className="osa-field"><label>Custom robots.txt</label><textarea value={current.robotsSettings.customText} onChange={(event) => updateSection('robotsSettings', { customText: event.target.value })} /></div></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'policies' ? <form className="osa-form-grid" onSubmit={saveSection}><div className="osa-block"><div className="osa-field"><label>Terms and conditions</label><textarea value={current.policies.terms} onChange={(event) => updateSection('policies', { terms: event.target.value })} /></div><div className="osa-field"><label>Shipping policy</label><textarea value={current.policies.shipping} onChange={(event) => updateSection('policies', { shipping: event.target.value })} /></div><div className="osa-field"><label>Payment policy</label><textarea value={current.policies.payment} onChange={(event) => updateSection('policies', { payment: event.target.value })} /></div><div className="osa-field"><label>Return and refund policy</label><textarea value={current.policies.returnRefund} onChange={(event) => updateSection('policies', { returnRefund: event.target.value })} /></div><div className="osa-field"><label>Privacy policy</label><textarea value={current.policies.privacy} onChange={(event) => updateSection('policies', { privacy: event.target.value })} /></div></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'about-us' ? <form className="osa-form-grid" onSubmit={saveSection}><div className="osa-block"><div className="osa-field"><label>About Us title</label><input value={current.aboutUs.title} onChange={(event) => updateSection('aboutUs', { title: event.target.value })} /></div><div className="osa-field"><label>About Us content</label><textarea value={current.aboutUs.content} onChange={(event) => updateSection('aboutUs', { content: event.target.value })} /></div></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}</section></div></>}</DashboardFrame></VendorOnly>;
}

function DashboardDisplaySettingsPage() {
  usePageTitle('Display Settings - StoreBanao');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = searchParams.get('section') || 'announcement';
  const { token, data, loading, error } = useDashboardStoreData();
  const store = data.store || {};
  const [cfg, setCfg] = useState(getMergedThemeConfig(store));
  const [desktopBannerUrl, setDesktopBannerUrl] = useState('');
  const [mobileBannerUrl, setMobileBannerUrl] = useState('');
  const mediaState = useDashboardMedia(token);
  const [state, setState] = useState({ loading: false, error: '', success: '' });
  useEffect(() => {
    setCfg(getMergedThemeConfig(store));
  }, [store]);

  function updateCfg(partial) {
    setCfg((prev) => ({ ...prev, ...partial }));
  }

  async function save(event) {
    event.preventDefault();
    setState({ loading: true, error: '', success: '' });
    try {
      await api.put('/api/dashboard/display-settings', cfg, token);
      setState({ loading: false, error: '', success: `${DISPLAY_SETTINGS_SECTIONS.find((item) => item.id === activeSection)?.label || 'Display Settings'} saved.` });
    } catch (saveError) {
      setState({ loading: false, error: saveError.message || 'Unable to save display settings', success: '' });
    }
  }
  const sectionMeta = DISPLAY_SETTINGS_SECTIONS.find((item) => item.id === activeSection) || DISPLAY_SETTINGS_SECTIONS[0];

  return <VendorOnly><DashboardFrame activeKey="display-settings" title="Display Settings" subtitle="Every important storefront element has its own section. Open one section, change one thing, save, and check the live preview.">{error ? <Alert type="error">{error}</Alert> : null}{state.error ? <Alert type="error">{state.error}</Alert> : null}{state.success ? <Alert type="success">{state.success}</Alert> : null}{loading ? <LoadingBlock label="Loading display settings..." /> : <><div className="osa-page-head"><div><h1>Display Settings</h1><p>Every important storefront element has its own section. Open one section, change one thing, save, and check the live preview.</p></div></div><div className="osa-settings-layout"><SectionNav sections={DISPLAY_SETTINGS_SECTIONS} activeSection={activeSection} onSelect={(section) => setSearchParams({ section })} /><section className="osa-card osa-form-panel"><div className="osa-form-head"><h2>{sectionMeta.label}</h2><p>Dedicated controls for this section. Keep things simple and change only what you need.</p></div>{activeSection === 'announcement' ? <form className="osa-form-grid" onSubmit={save}><ToggleField title="Enable announcement bar" description="Show updates, offers, and shipping messages at the very top." checked={cfg.announcementEnabled !== false} onChange={(value) => updateCfg({ announcementEnabled: value })} /><div className="osa-block"><div className="osa-form-grid two"><div className="osa-field"><label>Announcement text</label><input value={cfg.topBarText || ''} onChange={(event) => updateCfg({ topBarText: event.target.value })} placeholder="Free shipping on orders above Rs 499" /></div><div className="osa-field"><label>Animation</label><select value={cfg.topBarMarquee === false ? 'false' : 'true'} onChange={(event) => updateCfg({ topBarMarquee: event.target.value !== 'false' })}><option value="true">Moving text</option><option value="false">Static text</option></select></div><div className="osa-field"><label>Bar color</label><input value={cfg.topBarBg || ''} onChange={(event) => updateCfg({ topBarBg: event.target.value })} placeholder="#1f4ff0" /></div><div className="osa-field"><label>Text color</label><input value={cfg.topBarColor || ''} onChange={(event) => updateCfg({ topBarColor: event.target.value })} placeholder="#ffffff" /></div></div></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'header' ? <form className="osa-form-grid" onSubmit={save}><div className="osa-block"><h3>Header layout</h3><OptionCardGroup value={cfg.headerLayout || 'search'} onChange={(value) => updateCfg({ headerLayout: value })} options={[{ id: 'search', title: 'Search first', sub: 'Large search in header' }, { id: 'center', title: 'Centered brand', sub: 'Brand name in center' }, { id: 'left', title: 'Left brand', sub: 'Brand aligned to the left' }]} /></div><ToggleField title="Sticky header" description="Keep the header visible while scrolling." checked={cfg.headerSticky !== false} onChange={(value) => updateCfg({ headerSticky: value })} /><ToggleField title="Show search bar" description="Let customers search directly from the storefront header." checked={cfg.showSearch !== false} onChange={(value) => updateCfg({ showSearch: value })} /><ToggleField title="Show wishlist icon" description="Display the wishlist shortcut in the header." checked={cfg.showWishlistIcon !== false} onChange={(value) => updateCfg({ showWishlistIcon: value })} /><ToggleField title="Show cart icon" description="Display the cart shortcut in the header." checked={cfg.showCartIcon !== false} onChange={(value) => updateCfg({ showCartIcon: value })} /><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'menu' ? <form className="osa-form-grid" onSubmit={save}><div className="osa-block"><h3>Menu labels</h3><div className="osa-form-grid two"><div className="osa-field"><label>Home label</label><input value={cfg.menuHomeLabel || 'Home'} onChange={(event) => updateCfg({ menuHomeLabel: event.target.value })} /></div><div className="osa-field"><label>Shop label</label><input value={cfg.menuShopLabel || 'Shop All'} onChange={(event) => updateCfg({ menuShopLabel: event.target.value })} /></div><div className="osa-field"><label>Wishlist label</label><input value={cfg.menuWishlistLabel || 'Wishlist'} onChange={(event) => updateCfg({ menuWishlistLabel: event.target.value })} /></div><div className="osa-field"><label>Cart label</label><input value={cfg.menuCartLabel || 'Cart'} onChange={(event) => updateCfg({ menuCartLabel: event.target.value })} /></div><div className="osa-field"><label>Track order label</label><input value={cfg.menuTrackLabel || 'Track Order'} onChange={(event) => updateCfg({ menuTrackLabel: event.target.value })} /></div><div className="osa-field"><label>Account label</label><input value={cfg.menuAccountLabel || 'My Account'} onChange={(event) => updateCfg({ menuAccountLabel: event.target.value })} /></div></div><p className="osa-block-note">Use simple words so even first-time users understand the menu instantly.</p></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'banner' ? <form className="osa-form-grid" onSubmit={save}><ToggleField title="Enable banner / hero section" description="Show the large top banner on the storefront home page." checked={cfg.showBanner !== false} onChange={(value) => updateCfg({ showBanner: value })} /><div className="osa-block"><div className="osa-form-grid two"><div className="osa-field"><label>Banner title</label><input value={cfg.bannerTitle || ''} onChange={(event) => updateCfg({ bannerTitle: event.target.value })} placeholder="Big sale is live" /></div><div className="osa-field"><label>Button text</label><input value={cfg.bannerCta || ''} onChange={(event) => updateCfg({ bannerCta: event.target.value })} placeholder="Shop now" /></div></div><div className="osa-field"><label>Banner subtitle</label><textarea value={cfg.bannerSubtitle || ''} onChange={(event) => updateCfg({ bannerSubtitle: event.target.value })} /></div></div><div className="osa-block"><h3>Desktop banners</h3><BannerPreviewList items={cfg.bannerImages || []} onRemove={(index) => updateCfg({ bannerImages: (cfg.bannerImages || []).filter((_, itemIndex) => itemIndex !== index) })} /><div className="osa-form-grid two" style={{ marginTop: 14 }}><div className="osa-field"><label>Add desktop banner URL</label><input value={desktopBannerUrl} onChange={(event) => setDesktopBannerUrl(event.target.value)} /></div><div className="osa-field"><label>Or upload desktop banner</label><input type="file" accept="image/*" onChange={(event) => saveFileAsDraft(event, (value) => updateCfg({ bannerImages: (cfg.bannerImages || []).concat(value) }))} /></div></div><div className="osa-actions"><button className="osa-btn secondary" type="button" onClick={() => { if (desktopBannerUrl) { updateCfg({ bannerImages: (cfg.bannerImages || []).concat(desktopBannerUrl) }); setDesktopBannerUrl(''); } }}>Add desktop banner</button></div></div><div className="osa-block"><h3>Mobile banners</h3><BannerPreviewList items={cfg.bannerImagesMobile || []} mobile onRemove={(index) => updateCfg({ bannerImagesMobile: (cfg.bannerImagesMobile || []).filter((_, itemIndex) => itemIndex !== index) })} /><div className="osa-form-grid two" style={{ marginTop: 14 }}><div className="osa-field"><label>Add mobile banner URL</label><input value={mobileBannerUrl} onChange={(event) => setMobileBannerUrl(event.target.value)} /></div><div className="osa-field"><label>Or upload mobile banner</label><input type="file" accept="image/*" onChange={(event) => saveFileAsDraft(event, (value) => updateCfg({ bannerImagesMobile: (cfg.bannerImagesMobile || []).concat(value) }))} /></div></div><div className="osa-actions"><button className="osa-btn secondary" type="button" onClick={() => { if (mobileBannerUrl) { updateCfg({ bannerImagesMobile: (cfg.bannerImagesMobile || []).concat(mobileBannerUrl) }); setMobileBannerUrl(''); } }}>Add mobile banner</button></div></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save content</button></div></form> : null}{activeSection === 'categories' ? <form className="osa-form-grid" onSubmit={save}><ToggleField title="Show categories section" description="Display product categories on the home page." checked={cfg.showCategories !== false} onChange={(value) => updateCfg({ showCategories: value })} /><div className="osa-block"><div className="osa-form-grid two"><div className="osa-field"><label>Section title</label><input value={cfg.categoryTitle || 'Categories'} onChange={(event) => updateCfg({ categoryTitle: event.target.value })} /></div><div className="osa-field"><label>Layout behavior</label><select value={cfg.categoryLayout || 'auto'} onChange={(event) => updateCfg({ categoryLayout: event.target.value })}><option value="auto">Auto</option><option value="carousel">Always carousel</option><option value="grid">Always grid</option></select></div></div><OptionCardGroup value={cfg.categoryStyle || 'circle'} onChange={(value) => updateCfg({ categoryStyle: value })} options={[{ id: 'circle', title: 'Circle carousel', sub: 'Rounded icons in a slider' }, { id: 'square', title: 'Square carousel', sub: 'Modern square category icons' }, { id: 'grid', title: 'Grid', sub: 'Balanced square category grid' }, { id: 'pill', title: 'Tag pills', sub: 'Simple chip-like category list' }]} /></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'products' ? <form className="osa-form-grid" onSubmit={save}><div className="osa-block"><div className="osa-field"><label>Products section title</label><input value={cfg.productsTitle || 'All Products'} onChange={(event) => updateCfg({ productsTitle: event.target.value })} placeholder="Best sellers" /></div></div><ToggleField title="Show flash deals section" description="Highlight a few products above the main product grid." checked={cfg.showFlashDeals !== false} onChange={(value) => updateCfg({ showFlashDeals: value })} /><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'footer' ? <form className="osa-form-grid" onSubmit={save}><ToggleField title="Show footer" description="Display the footer at the bottom of the store." checked={cfg.showFooter !== false} onChange={(value) => updateCfg({ showFooter: value })} /><ToggleField title="Show Powered by StoreBanao" description="Keep the platform credit visible in the footer." checked={cfg.showPoweredBy !== false} onChange={(value) => updateCfg({ showPoweredBy: value })} /><div className="osa-block"><div className="osa-field"><label>Footer text</label><input value={cfg.footerText || ''} onChange={(event) => updateCfg({ footerText: event.target.value })} /></div></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'product-card' ? <form className="osa-form-grid" onSubmit={save}><div className="osa-block"><h3>Card style</h3><OptionCardGroup value={cfg.productCardStyle || 'style-2'} onChange={(value) => updateCfg({ productCardStyle: value })} options={[{ id: 'style-1', title: 'Minimal', sub: 'Very clean card layout' }, { id: 'style-2', title: 'Sale badge', sub: 'Discount-first layout' }, { id: 'style-3', title: 'Bold', sub: 'Dark premium card style' }, { id: 'style-4', title: 'List', sub: 'Compact mobile-friendly layout' }]} /></div><ToggleField title="Show discount badge" description="Display discount percentage when MRP is higher than price." checked={cfg.showDiscount !== false} onChange={(value) => updateCfg({ showDiscount: value })} /><ToggleField title="Show rating" description="Display a clean rating line on product cards." checked={cfg.showRating !== false} onChange={(value) => updateCfg({ showRating: value })} /><ToggleField title="Show stock on cards" description="Display remaining stock directly on product cards." checked={cfg.showProductStock !== false} onChange={(value) => updateCfg({ showProductStock: value })} /><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'product-page' ? <form className="osa-form-grid" onSubmit={save}><ToggleField title="Show product description" description="Display the product description on the detail page and related cards." checked={cfg.showProductDescription !== false} onChange={(value) => updateCfg({ showProductDescription: value })} /><ToggleField title="Show stock on product page" description="Show the stock pill on the product detail page." checked={cfg.showProductPageStock !== false} onChange={(value) => updateCfg({ showProductPageStock: value })} /><ToggleField title="Show WhatsApp button" description="Add a direct WhatsApp CTA on the product page." checked={cfg.showWhatsappButton !== false} onChange={(value) => updateCfg({ showWhatsappButton: value })} /><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'color-font' ? <form className="osa-form-grid" onSubmit={save}><div className="osa-block"><div className="osa-form-grid two"><div className="osa-field"><label>Primary color</label><input value={cfg.primaryColor || ''} onChange={(event) => updateCfg({ primaryColor: event.target.value })} placeholder="#1f4ff0" /></div><div className="osa-field"><label>Secondary color</label><input value={cfg.secondaryColor || ''} onChange={(event) => updateCfg({ secondaryColor: event.target.value })} placeholder="#06b6d4" /></div><div className="osa-field"><label>Button color</label><input value={cfg.btnColor || ''} onChange={(event) => updateCfg({ btnColor: event.target.value })} placeholder="#1f4ff0" /></div><div className="osa-field"><label>Background color</label><input value={cfg.bgColor || ''} onChange={(event) => updateCfg({ bgColor: event.target.value })} placeholder="#f8fafc" /></div><div className="osa-field"><label>Heading font</label><select value={cfg.headingFont || ''} onChange={(event) => updateCfg({ headingFont: event.target.value })}><option value="">Default</option><option value="Inter">Inter</option><option value="DM Sans">DM Sans</option><option value="Poppins">Poppins</option><option value="Alegreya SC">Alegreya SC</option></select></div><div className="osa-field"><label>Body font</label><select value={cfg.bodyFont || ''} onChange={(event) => updateCfg({ bodyFont: event.target.value })}><option value="">Default</option><option value="Inter">Inter</option><option value="DM Sans">DM Sans</option><option value="Poppins">Poppins</option></select></div><div className="osa-field"><label>Border radius</label><select value={cfg.borderRadius || 'rounded'} onChange={(event) => updateCfg({ borderRadius: event.target.value })}><option value="sharp">Sharp</option><option value="rounded">Rounded</option><option value="pill">Pill</option></select></div><div className="osa-field"><label>Button style</label><select value={cfg.btnStyle || 'pill'} onChange={(event) => updateCfg({ btnStyle: event.target.value })}><option value="sharp">Sharp</option><option value="rounded">Rounded</option><option value="pill">Pill</option></select></div></div></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}{activeSection === 'custom-css' ? <form className="osa-form-grid" onSubmit={save}><div className="osa-block"><div className="osa-field"><label>Custom CSS</label><textarea className="json-editor" value={cfg.customCss || ''} onChange={(event) => updateCfg({ customCss: event.target.value })} placeholder=".store-footer { display:none; }" /></div><p className="osa-block-note">Use this only for advanced tweaks after the simple controls above are not enough.</p></div><div className="osa-actions"><button className="osa-btn" type="submit" disabled={state.loading}>Save</button></div></form> : null}</section></div></>}</DashboardFrame></VendorOnly>;
}

function DashboardThemePage() {
  usePageTitle('Themes - StoreBanao');
  const { token, data, loading, error } = useDashboardStoreData();
  const store = data.store || {};
  const templatesState = useApiData(() => api.get('/api/templates'), [], { templates: [] });
  const [actionState, setActionState] = useState({ loading: '', error: '', success: '' });
  async function applyTemplate(templateId) {
    setActionState({ loading: templateId, error: '', success: '' });
    try {
      await api.put('/api/dashboard/theme', { template: templateId }, token);
      setActionState({ loading: '', error: '', success: 'Theme applied successfully.' });
      window.location.reload();
    } catch (applyError) {
      setActionState({ loading: '', error: applyError.message || 'Unable to apply theme', success: '' });
    }
  }
  return <VendorOnly><DashboardFrame activeKey="theme" title="Themes" subtitle="Pick the storefront style first, then fine-tune every section from Display Settings. Preview each theme before applying it.">{error ? <Alert type="error">{error}</Alert> : null}{actionState.error ? <Alert type="error">{actionState.error}</Alert> : null}{actionState.success ? <Alert type="success">{actionState.success}</Alert> : null}{loading || templatesState.loading ? <LoadingBlock label="Loading themes..." /> : <><div className="osa-page-head"><div><h1>Themes</h1><p>Pick the storefront style first, then fine-tune every section from Display Settings. Preview each theme before applying it.</p></div><div className="osa-actions" style={{ marginTop: 0 }}><Link className="osa-btn secondary" to="/dashboard/display-settings">Open display settings</Link><a className="osa-btn" href={`/store/${store.slug}`} target="_blank" rel="noopener noreferrer">Preview current theme</a></div></div><section className="osa-card osa-page-card"><div className="osa-theme-grid">{(templatesState.data.templates || []).map((template) => <article key={template.id} className={cn('osa-card osa-theme-card', store.template === template.id && 'active')}>{store.template === template.id ? <div className="osa-theme-check">✓</div> : null}<div className="osa-theme-media"><iframe className="osa-theme-iframe" src={`/store/${store.slug}?previewTheme=${encodeURIComponent(template.id)}`} title={`${template.name} preview`} /></div><div><h3>{template.name}</h3><p>{template.description || ''}</p></div><div className="osa-theme-meta"><span className="osa-chip">{template.layout === 'minimal' ? 'Basic' : 'Business'}</span><div className="osa-actions" style={{ marginTop: 0 }}>{store.template === template.id ? <span className="osa-btn secondary" style={{ cursor: 'default' }}>Selected</span> : <button className="osa-btn" type="button" disabled={!!actionState.loading} onClick={() => applyTemplate(template.id)}>{actionState.loading === template.id ? 'Applying...' : 'Apply'}</button>}<a className="osa-btn secondary" href={`/store/${store.slug}?previewTheme=${encodeURIComponent(template.id)}`} target="_blank" rel="noopener noreferrer">Preview</a></div></div></article>)}</div></section><section className="osa-card osa-page-card"><div className="osa-form-head"><h2>Live preview</h2><p>Check the exact storefront output with your current store data.</p></div><div className="osa-iframe-wrap" style={{ marginTop: 18 }}><div className="osa-iframe-bar"><span /><span /><span /><b>/{store.slug}</b></div><iframe className="osa-iframe" src={`/store/${store.slug}`} title="Store preview" /></div></section></>}</DashboardFrame></VendorOnly>;
}

function DashboardMediaPage() {
  usePageTitle('Media Library - StoreBanao');
  const { token } = useDashboardStoreData();
  const { data, loading, error } = useApiData(() => api.get('/api/dashboard/media', token), [token], { images: [] });
  return <VendorOnly><DashboardFrame activeKey="media" title="Media Library" subtitle="Uploaded logos, product images, categories, and banners.">{error ? <Alert type="error">{error}</Alert> : null}{loading ? <LoadingBlock label="Loading media..." /> : data.images.length ? <div className="media-grid">{data.images.map((src) => <div key={src} className="card template-card"><img className="media-thumb" src={src} alt="media" /></div>)}</div> : <EmptyState title="No media uploaded yet" body="Images will appear here as you add products and visuals." />}</DashboardFrame></VendorOnly>;
}

function DashboardCollectionsPage() {
  usePageTitle('Collections - StoreBanao');
  const { token } = useDashboardStoreData();
  const [form, setForm] = useState({ name: '', description: '' });
  const { data, loading, error } = useApiData(() => api.get('/api/dashboard/collections', token), [token], { collections: [] });
  async function add(event) { event.preventDefault(); await api.post('/api/dashboard/collections', form, token); window.location.reload(); }
  async function remove(id) { await api.del(`/api/dashboard/collections/${id}`, token); window.location.reload(); }
  return <VendorOnly><DashboardFrame activeKey="collections" title="Collections" subtitle="Organize products into groups like Shopify collections.">{error ? <Alert type="error">{error}</Alert> : null}<section className="card panel"><form className="form-grid" onSubmit={add}><div className="form-grid two"><div className="field"><label>Collection name</label><input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required /></div><div className="field"><label>Description</label><input value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} /></div></div><button className="btn" type="submit">Add collection</button></form></section><section className="card panel">{loading ? <LoadingBlock label="Loading collections..." /> : data.collections.length ? <div className="table-wrap"><table><thead><tr><th>Collection</th><th>Description</th><th>Delete</th></tr></thead><tbody>{data.collections.map((collection) => <tr key={collection.id}><td>{collection.name}</td><td>{collection.description || '-'}</td><td><button className="btn btn-danger" type="button" onClick={() => remove(collection.id)}>Delete</button></td></tr>)}</tbody></table></div> : <EmptyState title="No collections yet" body="Add your first collection to group products." />}</section></DashboardFrame></VendorOnly>;
}

function DashboardCategoriesPage() {
  usePageTitle('Categories - StoreBanao');
  const { token } = useDashboardStoreData();
  const [form, setForm] = useState({ name: '', description: '', image: '' });
  const [uploadingImage, setUploadingImage] = useState(false);
  const mediaState = useDashboardMedia(token);
  const { data, loading, error } = useApiData(() => api.get('/api/dashboard/categories', token), [token], { categories: [] });
  async function add(event) { event.preventDefault(); await api.post('/api/dashboard/categories', form, token); window.location.reload(); }
  async function remove(id) { await api.del(`/api/dashboard/categories/${id}`, token); window.location.reload(); }
  async function uploadImage(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const result = await uploadDashboardFile('/api/dashboard/upload/category-image', file, token);
      setForm((prev) => ({ ...prev, image: result.url }));
    } finally {
      setUploadingImage(false);
    }
  }
  return <VendorOnly><DashboardFrame activeKey="categories" title="Categories" subtitle="Manage categories with images. They auto-arrange on your store.">{error ? <Alert type="error">{error}</Alert> : null}<section className="card panel"><form className="form-grid" onSubmit={add}><div className="form-grid two"><div className="field"><label>Category name</label><input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required /></div><div className="field"><label>Description</label><input value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} /></div></div><div className="field"><label>Image URL</label><input value={form.image} onChange={(event) => setForm((prev) => ({ ...prev, image: event.target.value }))} /></div><div className="field"><label>Or upload image</label><input type="file" accept="image/*" onChange={uploadImage} />{uploadingImage ? <div className="section-muted">Uploading image...</div> : null}{form.image ? <img className="logo-preview" src={form.image} alt="Category preview" /> : null}</div><div className="osa-block"><h3>Choose from Media Library</h3><MediaPicker images={mediaState.data.images || []} onSelect={(src) => setForm((prev) => ({ ...prev, image: src }))} /></div><button className="btn" type="submit">Add Category</button></form></section><section className="card panel">{loading ? <LoadingBlock label="Loading categories..." /> : data.categories.length ? <div className="preview-grid">{data.categories.map((category) => <article key={category.id} className="preview-tile">{category.image ? <img className="media-thumb" src={category.image} alt={category.name} /> : <div className="preview-placeholder">No image</div>}<div className="preview-body"><strong>{category.name}</strong><span>{category.description || 'Category'}</span></div><button className="btn btn-danger" type="button" onClick={() => remove(category.id)}>Delete</button></article>)}</div> : <EmptyState title="No categories yet" body="Add categories to structure your catalog." />}</section></DashboardFrame></VendorOnly>;
}

function DashboardBulkUploadPage() {
  usePageTitle('Bulk Upload - StoreBanao');
  const { token, data } = useDashboardStoreData();
  const [file, setFile] = useState(null);
  const [state, setState] = useState({ loading: false, error: '', success: '' });
  async function importCsv() {
    if (!file) return;
    setState({ loading: true, error: '', success: '' });
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api.upload('/api/dashboard/bulk-upload/import-file', formData, token);
      setState({ loading: false, error: '', success: `Imported ${result.imported} products successfully.` });
      setFile(null);
    } catch (error) {
      setState({ loading: false, error: error.message || 'Unable to import CSV', success: '' });
    }
  }
  return <VendorOnly><DashboardFrame activeKey="bulk-upload" title="Import Products (CSV)" subtitle="Upload a CSV file and products will appear on your store automatically.">{state.error ? <Alert type="error">{state.error}</Alert> : null}{state.success ? <Alert type="success">{state.success}</Alert> : null}<div className="grid-2"><section className="card panel"><h2 className="section-title">Import Products</h2><p className="section-subtitle">Upload a CSV file with columns: name, price, comparePrice, description, stock, image, sku, category, active.</p><div className="field"><label>Choose CSV file</label><input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files && event.target.files[0] ? event.target.files[0] : null)} /></div><div className="actions"><button className="btn" type="button" onClick={importCsv} disabled={!file || state.loading}>{state.loading ? 'Importing...' : 'Import CSV'}</button>{file ? <span className="section-muted">{file.name}</span> : null}</div></section><section className="card panel"><h2 className="section-title">Export & Template</h2><div className="actions"><button className="btn" type="button" onClick={() => downloadAuthorized('/api/dashboard/bulk-upload/export', token, 'products-export.csv')}>Download Export</button><button className="btn btn-secondary" type="button" onClick={() => downloadAuthorized('/api/dashboard/bulk-upload/template', token, 'products-template.csv')}>Download Template</button></div><div className="summary-box"><div className="summary-row"><span>Current Products</span><strong>{(data.store && data.store.products || []).length}</strong></div></div></section></div></DashboardFrame></VendorOnly>;
}

function DashboardLeadsPage() {
  usePageTitle('Leads - StoreBanao');
  const { token } = useDashboardStoreData();
  const { data, loading, error } = useApiData(() => api.get('/api/dashboard/leads', token), [token], { leads: [] });
  return <VendorOnly><DashboardFrame activeKey="leads" title="Customer Leads" subtitle="People who ordered via WhatsApp or incomplete contact flow.">{error ? <Alert type="error">{error}</Alert> : null}{loading ? <LoadingBlock label="Loading leads..." /> : data.leads.length ? <section className="card panel"><div className="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Product</th><th>Status</th><th>Date</th></tr></thead><tbody>{data.leads.map((lead) => <tr key={lead.id}><td>{lead.customerName || 'Lead'}</td><td>{lead.customerPhone || '-'}</td><td>{lead.productName}</td><td>{lead.status}</td><td>{formatDate(lead.createdAt)}</td></tr>)}</tbody></table></div></section> : <EmptyState title="No leads yet" body="Leads will appear here when customers use WhatsApp-style ordering." />}</DashboardFrame></VendorOnly>;
}

function DashboardCouponsPage() {
  usePageTitle('Coupons - StoreBanao');
  const { token } = useDashboardStoreData();
  const [form, setForm] = useState({ code: '', value: '', type: 'percent', active: true });
  const { data, loading, error } = useApiData(() => api.get('/api/dashboard/coupons', token), [token], { discounts: [] });
  async function add(event) { event.preventDefault(); await api.post('/api/dashboard/coupons', form, token); window.location.reload(); }
  async function remove(id) { await api.del(`/api/dashboard/coupons/${id}`, token); window.location.reload(); }
  return <VendorOnly><DashboardFrame activeKey="coupons" title="Coupons" subtitle="Create and manage discount coupons.">{error ? <Alert type="error">{error}</Alert> : null}<section className="card panel"><form className="form-grid" onSubmit={add}><div className="form-grid two"><div className="field"><label>Code</label><input value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} required /></div><div className="field"><label>Value</label><input value={form.value} onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))} required /></div><div className="field"><label>Type</label><select value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}><option value="percent">Percent</option><option value="flat">Flat</option></select></div><div className="field"><label>Status</label><select value={form.active ? 'yes' : 'no'} onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.value === 'yes' }))}><option value="yes">Active</option><option value="no">Inactive</option></select></div></div><button className="btn" type="submit">Create Coupon</button></form></section><section className="card panel">{loading ? <LoadingBlock label="Loading coupons..." /> : data.discounts.length ? <div className="table-wrap"><table><thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Status</th><th>Delete</th></tr></thead><tbody>{data.discounts.map((discount) => <tr key={discount.id}><td>{discount.code}</td><td>{discount.type}</td><td>{discount.value}</td><td>{discount.active ? 'Active' : 'Inactive'}</td><td><button className="btn btn-danger" type="button" onClick={() => remove(discount.id)}>Delete</button></td></tr>)}</tbody></table></div> : <EmptyState title="No coupons yet" body="Create discount codes for promotions and offers." />}</section></DashboardFrame></VendorOnly>;
}

function DashboardSimpleFormPage({ activeKey, title, subtitle, initialState, endpoint, fields }) {
  const { token, data, loading, error } = useDashboardStoreData();
  const [form, setForm] = useState(initialState);
  const [state, setState] = useState({ loading: false, error: '', success: '' });
  useEffect(() => {
    if (loading) return;
    setForm((prev) => Object.assign({}, prev, fields.reduce((acc, field) => {
      acc[field.name] = field.read(data.store || {});
      return acc;
    }, {})));
  }, [loading, data.store]);
  async function submit(event) {
    event.preventDefault();
    setState({ loading: true, error: '', success: '' });
    try {
      await api.put(endpoint, form, token);
      setState({ loading: false, error: '', success: 'Saved successfully.' });
    } catch (saveError) {
      setState({ loading: false, error: saveError.message || 'Unable to save', success: '' });
    }
  }
  return <VendorOnly><DashboardFrame activeKey={activeKey} title={title} subtitle={subtitle}>{error ? <Alert type="error">{error}</Alert> : null}{state.error ? <Alert type="error">{state.error}</Alert> : null}{state.success ? <Alert type="success">{state.success}</Alert> : null}{loading ? <LoadingBlock label="Loading..." /> : <section className="card panel"><form className="form-grid" onSubmit={submit}>{fields.map((field) => <div key={field.name} className="field"><label>{field.label}</label>{field.type === 'textarea' ? <textarea value={form[field.name] || ''} onChange={(event) => setForm((prev) => ({ ...prev, [field.name]: event.target.value }))} /> : field.type === 'select' ? <select value={String(form[field.name])} onChange={(event) => setForm((prev) => ({ ...prev, [field.name]: field.coerce ? field.coerce(event.target.value) : event.target.value }))}>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input value={form[field.name] || ''} onChange={(event) => setForm((prev) => ({ ...prev, [field.name]: event.target.value }))} />}</div>)}<button className="btn" type="submit" disabled={state.loading}>{state.loading ? 'Saving...' : 'Save'}</button></form></section>}</DashboardFrame></VendorOnly>;
}

function DashboardShippingPage() { usePageTitle('Shipping - StoreBanao'); return <DashboardSimpleFormPage activeKey="shipping" title="Shipping" subtitle="Set a basic shipping fee and notes for your store." initialState={{ mode: 'flat', fee: '', notes: '' }} endpoint="/api/dashboard/shipping" fields={[{ name: 'mode', label: 'Mode', type: 'select', options: [{ value: 'flat', label: 'Flat' }, { value: 'free', label: 'Free' }], read: (store) => (store.shipping || {}).mode || 'flat' }, { name: 'fee', label: 'Fee', read: (store) => (store.shipping || {}).fee || '' }, { name: 'notes', label: 'Notes', type: 'textarea', read: (store) => (store.shipping || {}).notes || '' }]} />; }
function DashboardPaymentsPage() { usePageTitle('Payments - StoreBanao'); return <DashboardSimpleFormPage activeKey="payments" title="Payments" subtitle="Choose exactly which payment flows customers can use on checkout." initialState={{ mode: 'both', notes: '' }} endpoint="/api/dashboard/payments" fields={[{ name: 'mode', label: 'Payment mode', type: 'select', options: [{ value: 'whatsapp', label: 'WhatsApp only' }, { value: 'cod', label: 'Cash on Delivery' }, { value: 'online', label: 'Online only' }, { value: 'both', label: 'COD + Online' }], read: (store) => (store.paymentSettings || {}).mode || 'both' }, { name: 'notes', label: 'Payment notes / bank details', type: 'textarea', read: (store) => (store.paymentSettings || {}).notes || '' }]} />; }
function DashboardNotificationsPage() { usePageTitle('Notifications - StoreBanao'); return <DashboardSimpleFormPage activeKey="notifications" title="Notifications" subtitle="Control basic store notifications." initialState={{ newOrder: true, whatsappLead: true, lowStock: false, abandonedCart: false }} endpoint="/api/dashboard/notifications" fields={[{ name: 'newOrder', label: 'New order alert', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], coerce: (value) => value === 'true', read: (store) => !!((store.notifications || {}).newOrder) }, { name: 'whatsappLead', label: 'WhatsApp lead alert', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], coerce: (value) => value === 'true', read: (store) => (store.notifications || {}).whatsappLead !== false }, { name: 'lowStock', label: 'Low stock alert', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], coerce: (value) => value === 'true', read: (store) => !!((store.notifications || {}).lowStock) }, { name: 'abandonedCart', label: 'Abandoned cart alert', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], coerce: (value) => value === 'true', read: (store) => !!((store.notifications || {}).abandonedCart) }]} />; }
function DashboardTaxPage() { usePageTitle('Tax - StoreBanao'); return <DashboardSimpleFormPage activeKey="tax" title="Tax / GST Settings" subtitle="Configure tax for your store orders." initialState={{ enabled: false, name: 'GST', rate: '0', inclusive: false }} endpoint="/api/dashboard/tax" fields={[{ name: 'enabled', label: 'Enable tax', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], coerce: (value) => value === 'true', read: (store) => !!((store.taxSettings || {}).enabled) }, { name: 'name', label: 'Tax Name', read: (store) => (store.taxSettings || {}).name || 'GST' }, { name: 'rate', label: 'Tax Rate (%)', read: (store) => (store.taxSettings || {}).rate || '0' }, { name: 'inclusive', label: 'Prices are tax-inclusive', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], coerce: (value) => value === 'true', read: (store) => !!((store.taxSettings || {}).inclusive) }]} />; }
function DashboardWhatsappMarketingPage() { usePageTitle('WhatsApp Marketing - StoreBanao'); return <DashboardSimpleFormPage activeKey="whatsapp-marketing" title="WhatsApp Marketing" subtitle="Create message templates for leads and promotions." initialState={{ welcome: '', recovery: '', promo: '' }} endpoint="/api/dashboard/whatsapp-marketing" fields={[{ name: 'welcome', label: 'Welcome message', type: 'textarea', read: (store) => (store.whatsappMarketing || {}).welcome || '' }, { name: 'recovery', label: 'Recovery message', type: 'textarea', read: (store) => (store.whatsappMarketing || {}).recovery || '' }, { name: 'promo', label: 'Promo message', type: 'textarea', read: (store) => (store.whatsappMarketing || {}).promo || '' }]} />; }
function DashboardTrackingPage() { usePageTitle('Tracking - StoreBanao'); return <DashboardSimpleFormPage activeKey="tracking" title="Tracking & Analytics" subtitle="Add tracking codes for your store." initialState={{ pixel: '', google: '' }} endpoint="/api/dashboard/tracking" fields={[{ name: 'pixel', label: 'Meta Pixel', read: (store) => (store.tracking || {}).pixel || '' }, { name: 'google', label: 'Google Analytics', read: (store) => (store.tracking || {}).google || '' }]} />; }
function DashboardDomainPage() { usePageTitle('Domain - StoreBanao'); return <DashboardSimpleFormPage activeKey="domain" title="Domain" subtitle="Connect your own domain and manage subdomain values." initialState={{ customDomain: '', subdomain: '' }} endpoint="/api/dashboard/domain" fields={[{ name: 'customDomain', label: 'Custom domain', read: (store) => ((store.domain || {}).customDomain || '') }, { name: 'subdomain', label: 'Subdomain', read: (store) => ((store.domain || {}).subdomain || '') }]} />; }

function DashboardAbandonedCartsPage() {
  usePageTitle('Abandoned Carts - StoreBanao');
  const { token } = useDashboardStoreData();
  const { data, loading, error } = useApiData(() => api.get('/api/dashboard/abandoned-carts', token), [token], { abandonedCarts: [] });
  return <VendorOnly><DashboardFrame activeKey="abandoned-carts" title="Abandoned carts" subtitle="Customers who started checkout but did not complete the order.">{error ? <Alert type="error">{error}</Alert> : null}{loading ? <LoadingBlock label="Loading abandoned carts..." /> : data.abandonedCarts.length ? <section className="card panel"><div className="table-wrap"><table><thead><tr><th>Session</th><th>Items</th><th>Started At</th><th>Customer</th></tr></thead><tbody>{data.abandonedCarts.map((cart) => <tr key={cart.sessionId}><td>{cart.sessionId ? `${cart.sessionId.slice(0, 8)}...` : '-'}</td><td>{Array.isArray(cart.cart) ? cart.cart.length : 0} items</td><td>{formatDate(cart.startedAt)}</td><td>{cart.customerName || 'Anonymous'}</td></tr>)}</tbody></table></div></section> : <EmptyState title="No abandoned carts tracked yet" body="Abandoned checkouts will appear here." />}</DashboardFrame></VendorOnly>;
}

function DashboardAppsPage() {
  usePageTitle('App Store - StoreBanao');
  const [searchParams, setSearchParams] = useSearchParams();
  const { token } = useDashboardStoreData();
  const { data, loading, error } = useApiData(() => api.get('/api/dashboard/apps', token), [token], { catalog: [], apps: {} });
  const activeAppId = searchParams.get('app') || ((data.catalog || [])[0] && data.catalog[0].id) || '';
  const selectedApp = (data.catalog || []).find((app) => app.id === activeAppId);
  const selectedConfig = selectedApp ? (data.apps || {})[selectedApp.id] : null;
  async function toggle(appId) { await api.post(`/api/dashboard/apps/${appId}/toggle`, {}, token); window.location.reload(); }
  async function save(appId, payload) { await api.put(`/api/dashboard/apps/${appId}`, payload, token); window.location.reload(); }
  return <VendorOnly><DashboardFrame activeKey="apps" title="App Store" subtitle="Install apps and connect external services to each merchant store.">{error ? <Alert type="error">{error}</Alert> : null}{loading ? <LoadingBlock label="Loading apps..." /> : <><section className="osa-card osa-page-card"><div className="osa-option-grid">{(data.catalog || []).map((app) => { const state = (data.apps || {})[app.id] || {}; return <article key={app.id} className={cn('osa-option-card', activeAppId === app.id && 'active')}><strong>{app.name}</strong><span>{app.description}</span><div className="osa-actions"><button className={cn('osa-btn', state.installed && 'secondary')} type="button" onClick={() => toggle(app.id)}>{state.installed ? 'Uninstall' : 'Install'}</button><button className="osa-btn secondary" type="button" onClick={() => setSearchParams({ app: app.id })}>{state.configured ? 'Configure' : 'Setup'}</button></div><div className="section-muted">Status: <strong>{state.installed ? (state.configured ? 'Installed' : 'Installed · Setup needed') : 'Not installed'}</strong></div></article>; })}</div></section>{selectedApp ? <DashboardAppConfigCard app={selectedApp} config={selectedConfig} onSave={save} /> : null}</>}</DashboardFrame></VendorOnly>;
}

function DashboardAppConfigCard({ app, config, onSave }) {
  const [form, setForm] = useState(config || {});
  useEffect(() => { setForm(config || {}); }, [config]);
  if (!config || !config.installed) return <section className="osa-card osa-page-card"><EmptyState title="Install this app first" body="Install the app before configuring it." /></section>;
  const fieldNames = Object.keys(form).filter((key) => !['installed', 'configured'].includes(key));
  return <section className="osa-card osa-form-panel"><div className="osa-form-head"><h2>{app.name}</h2><p>{app.description}</p></div><form className="osa-form-grid" onSubmit={(event) => { event.preventDefault(); onSave(app.id, form); }}>{fieldNames.map((key) => <div key={key} className="osa-field"><label>{String(key).replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())}</label><input value={typeof form[key] === 'boolean' ? String(form[key]) : String(form[key] || '')} onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value === 'true' ? true : event.target.value === 'false' ? false : event.target.value }))} /></div>)}<div className="osa-actions"><button className="osa-btn" type="submit">Save App</button></div></form></section>;
}

function DashboardPagesPage() {
  usePageTitle('Pages - StoreBanao');
  const { token, data: dashboardData } = useDashboardStoreData();
  const storeSlug = dashboardData && dashboardData.store ? dashboardData.store.slug : '';
  const [form, setForm] = useState({ title: '', slug: '', content: '', active: true });
  const { data, loading, error } = useApiData(() => api.get('/api/dashboard/pages', token), [token], { pages: [] });
  async function add(event) { event.preventDefault(); await api.post('/api/dashboard/pages', form, token); window.location.reload(); }
  async function remove(id) { await api.del(`/api/dashboard/pages/${id}`, token); window.location.reload(); }
  return <VendorOnly><DashboardFrame activeKey="pages" title="Store Pages" subtitle="Create simple extra pages like About Us, Contact, Shipping Policy, or Return Policy.">{error ? <Alert type="error">{error}</Alert> : null}<div className="osa-page-head"><div><h1>Store Pages</h1><p>Create simple extra pages like About Us, Contact, Shipping Policy, or Return Policy.</p></div></div><section className="osa-card osa-page-card"><form className="osa-form-grid" onSubmit={add}><div className="osa-form-grid two"><div className="osa-field"><label>Page title</label><input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} required /></div><div className="osa-field"><label>Page slug</label><input value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))} required /></div><div className="osa-field"><label>Content</label><textarea value={form.content} onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))} /></div><div className="osa-field"><label>Publish</label><select value={form.active ? 'yes' : 'no'} onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.value === 'yes' }))}><option value="yes">Yes</option><option value="no">No</option></select></div></div><div className="osa-actions"><button className="osa-btn" type="submit">Add page</button></div></form>{loading ? <LoadingBlock label="Loading pages..." /> : data.pages.length ? <div className="table-wrap" style={{ marginTop: 18 }}><table><thead><tr><th>Page</th><th>Slug</th><th>Status</th><th>Preview</th><th>Delete</th></tr></thead><tbody>{data.pages.map((page) => <tr key={page.id}><td>{page.title}</td><td>{page.slug}</td><td>{page.active ? 'Published' : 'Draft'}</td><td>{page.active && storeSlug ? <a className="btn btn-secondary" href={`/store/${storeSlug}/page/${page.slug}`}>Preview</a> : '-'}</td><td><button className="btn btn-danger" type="button" onClick={() => remove(page.id)}>Delete</button></td></tr>)}</tbody></table></div> : <EmptyState title="No pages yet" body="Create extra content pages for your storefront." />}</section></DashboardFrame></VendorOnly>;
}

function DashboardOrdersExportRoute() {
  const navigate = useNavigate();
  const { vendor } = useAuth();
  useEffect(() => {
    if (vendor && vendor.token) {
      downloadAuthorized('/api/dashboard/orders/export', vendor.token, 'orders-export.csv').finally(() => navigate('/dashboard/orders', { replace: true }));
    }
  }, [vendor, navigate]);
  return <LoadingBlock label="Preparing export..." />;
}

function DashboardThemePreviewRoute() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { vendor } = useAuth();
  useEffect(() => {
    if (!vendor || !vendor.store || !vendor.store.slug) return;
    navigate(`/store/${vendor.store.slug}?previewTheme=${encodeURIComponent(id || '')}`, { replace: true });
  }, [navigate, vendor, id]);
  return <LoadingBlock label="Opening theme preview..." />;
}

function StoreHeader({ store, slug, cartCount, wishlistCount, isThemeOne, onMenuToggle, themeConfig }) {
  const { customer } = useAuth();
  if (isThemeOne) {
    const marqueeItems = String(themeConfig.topBarText || 'Secure Payments | Cash On Delivery | Premium Quality')
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
    return (
      <header className="app-header app-style-header">
        <div className="app-style-top-strip">
          <div className={cn('app-style-top-track', themeConfig.topBarMarquee !== false && 'marquee')}>
            {marqueeItems.concat(marqueeItems).map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
          </div>
        </div>
        <div className="app-style-brand-row">
          <button className="app-style-menu-btn" type="button" aria-label="Menu" onClick={onMenuToggle}><span /><span /><span /></button>
          <Link className="app-style-brand-center" to={`/store/${slug}`}>
            {store.logo ? <img className="app-style-brand-logo" src={store.logo} alt={store.name} /> : <div className="app-logo-ph">{(store.name || 'S').charAt(0)}</div>}
            <strong>{store.name}</strong>
          </Link>
          <div className="app-style-header-actions">
            <Link className="app-style-icon-link" to={customer && customer.slug === slug ? `/store/${slug}/account` : `/store/${slug}/account/login`} title="Account"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></Link>
            <Link className="app-style-icon-link" to={`/store/${slug}/cart`} title="Cart"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>{cartCount ? <span className="app-badge">{cartCount}</span> : null}</Link>
          </div>
        </div>
      </header>
    );
  }
  return (
    <header className="app-header"><div className="app-header-premium"><Link className="app-brand-lockup" to={`/store/${slug}`}>{store.logo ? <img className="app-logo" src={store.logo} alt={store.name} /> : <div className="app-logo-ph">{(store.name || 'S').charAt(0)}</div>}<span>{store.name}</span></Link><div className="app-actions"><Link className="app-icon-btn" to={`/store/${slug}/track-order`} title="Track">⌁</Link><Link className="app-icon-btn" to={`/store/${slug}/wishlist`} title="Wishlist">♡{wishlistCount ? <span className="app-badge">{wishlistCount}</span> : null}</Link><Link className="app-icon-btn" to={`/store/${slug}/cart`} title="Cart">🛒{cartCount ? <span className="app-badge">{cartCount}</span> : null}</Link><Link className="app-icon-btn" to={customer && customer.slug === slug ? `/store/${slug}/account` : `/store/${slug}/account/login`} title="Account">☺</Link></div></div></header>
  );
}

function ProductCard({ slug, product, wished, onToggleWishlist, onAddToCart, isThemeOne, themeConfig }) {
  const compareAt = Number(product.comparePrice || product.mrp || 0) > Number(product.price || 0) ? Number(product.comparePrice || product.mrp || 0) : 0;
  const offPercent = compareAt ? Math.max(1, Math.round(((compareAt - Number(product.price || 0)) / compareAt) * 100)) : 0;
  const rating = Number(product.rating || (Array.isArray(product.reviews) && product.reviews.length ? (product.reviews.reduce((sum, item) => sum + Number(item.rating || 5), 0) / product.reviews.length) : 4.7));
  if (isThemeOne) {
    return (
      <div className="app-card app-style-product-card">
        <Link className={cn('app-card-figure', themeConfig && themeConfig.productCardStyle ? `card-${themeConfig.productCardStyle}` : '')} to={`/store/${slug}/product/${product.id}`}>{themeConfig && themeConfig.showDiscount !== false && offPercent ? <span className="app-sale-badge">-{offPercent}%</span> : null}<span className="app-card-fit-pill">FIT</span><button className={cn('app-theme-heart', wished && 'wishlist-active')} type="button" onClick={(event) => { event.preventDefault(); onToggleWishlist(product.id); }}>{wished ? '♥' : '♡'}</button>{product.image ? <img className="app-card-img" src={product.image} alt={product.name} /> : <div className="app-card-img app-card-empty">No image</div>}</Link>
        <div className="app-card-body">{themeConfig && themeConfig.showRating !== false ? <div className="app-card-rating">★ {rating.toFixed(1)}</div> : null}<h3>{product.name}</h3><div className="app-card-price"><span className="price">{formatMoney(product.price)}</span>{compareAt ? <span className="old-price">{formatMoney(compareAt)}</span> : null}{themeConfig && themeConfig.showDiscount !== false && offPercent ? <span className="app-off-pill">{offPercent}% OFF</span> : null}</div>{themeConfig && themeConfig.showProductStock !== false ? <span className="stock">{product.stock || 0} in stock</span> : null}</div>
        <div className="app-card-actions"><button className="primary-btn app-theme-one-btn" type="button" onClick={() => onAddToCart(product)}>Add to Cart</button></div>
      </div>
    );
  }
  return (
    <div className="app-card">
      <Link className="app-card-figure" to={`/store/${slug}/product/${product.id}`}>{compareAt ? <span className="app-sale-badge">Sale</span> : null}{product.image ? <img className="app-card-img" src={product.image} alt={product.name} /> : <div className="app-card-img app-card-empty">No image</div>}</Link>
      <div className="app-card-body"><h3>{product.name}</h3><div className="app-card-price"><span className="price">{formatMoney(product.price)}</span>{compareAt ? <span className="old-price">{formatMoney(compareAt)}</span> : null}</div><span className="stock">{product.stock || 0} in stock</span></div>
      <div className="app-card-actions"><button className="primary-btn" type="button" onClick={() => onAddToCart(product)}>Add to Cart</button><button className={cn('app-mini-icon', wished && 'wishlist-active')} type="button" onClick={() => onToggleWishlist(product.id)}>{wished ? '♥' : '♡'}</button></div>
    </div>
  );
}

function useStoreShellData(slug) {
  const storeCacheKey = `storebanao_store_${slug}`;
  const state = useApiData(() => api.get(`/api/store/${slug}`), [slug], readSessionJson(storeCacheKey, { store: {} }));
  useEffect(() => {
    if (!state.loading && !state.error) {
      sessionStorage.setItem(storeCacheKey, JSON.stringify(state.data));
    }
  }, [storeCacheKey, state.loading, state.error, state.data]);
  return state;
}

function ThemeOneStoreScaffold({ slug, cartCount, wishlistCount, children }) {
  const { customer } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const storeState = useStoreShellData(slug);
  const store = storeState.data.store || {};
  const previewTheme = searchParams.get('previewTheme') || '';
  const effectiveStore = previewTheme ? { ...store, template: previewTheme } : store;
  const themeConfig = effectiveStore.themeConfig || {};
  const labelSettings = (store.storeSettings && store.storeSettings.labelSettings) || {};
  const isThemeOne = String(effectiveStore.template || 'app-style') === 'app-style';
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!isThemeOne) return children(store);

  const marqueeItems = String(themeConfig.topBarText || 'Secure Payments | Cash On Delivery | Premium Quality')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div className={cn('store-page', buildStoreThemeClass(effectiveStore))} style={buildStoreThemeStyle(effectiveStore)}>
      {themeConfig.customCss ? <style>{themeConfig.customCss}</style> : null}
      <div className={cn('app-style-drawer-shell', drawerOpen && 'open')}><div className="app-style-drawer-backdrop" onClick={() => setDrawerOpen(false)} /><aside className="app-style-drawer"><div className="app-style-drawer-head"><strong>{store.name || 'Menu'}</strong><button type="button" onClick={() => setDrawerOpen(false)}>×</button></div><nav className="app-style-drawer-links"><Link to={`/store/${slug}`} onClick={() => setDrawerOpen(false)}><span>🏠</span>{themeConfig.menuHomeLabel || labelSettings.bottomNavHome || 'Home'}</Link><Link to={`/store/${slug}?view=shop`} onClick={() => setDrawerOpen(false)}><span>🛍️</span>{themeConfig.menuShopLabel || 'Shop All'}</Link><Link to={`/store/${slug}/wishlist`} onClick={() => setDrawerOpen(false)}><span>♡</span>{themeConfig.menuWishlistLabel || 'Wishlist'}</Link><Link to={`/store/${slug}/track-order`} onClick={() => setDrawerOpen(false)}><span>📦</span>{themeConfig.menuTrackLabel || labelSettings.bottomNavOrders || 'Track Order'}</Link><Link to={customer && customer.slug === slug ? `/store/${slug}/account` : `/store/${slug}/account/login`} onClick={() => setDrawerOpen(false)}><span>👤</span>{themeConfig.menuAccountLabel || labelSettings.bottomNavAccount || 'My Account'}</Link></nav>{Array.isArray(store.categories) && store.categories.length ? <div className="app-style-drawer-cats"><h4>{themeConfig.categoryTitle || labelSettings.categoriesHeading || 'Browse Categories'}</h4>{store.categories.map((category) => <Link key={category.id || category.name} to={`/store/${slug}?category=${encodeURIComponent(category.name || '')}`} onClick={() => setDrawerOpen(false)}>{category.name}</Link>)}</div> : null}</aside></div>
      <header className={cn('app-header app-style-header', themeConfig.headerSticky === false && 'non-sticky')}><div className="app-style-top-strip" style={{ display: themeConfig.announcementEnabled === false ? 'none' : undefined, background: themeConfig.topBarBg || undefined, color: themeConfig.topBarColor || undefined }}><div className={cn('app-style-top-track', themeConfig.topBarMarquee !== false && 'marquee')}>{marqueeItems.concat(marqueeItems).map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}</div></div><div className="app-style-brand-row"><button className="app-style-menu-btn" type="button" aria-label="Menu" onClick={() => setDrawerOpen(true)}><span /><span /><span /></button><Link className="app-style-brand-center" to={`/store/${slug}`}>{store.logo ? <img className="app-style-brand-logo" src={store.logo} alt={store.name} /> : <div className="app-logo-ph">{(store.name || 'S').charAt(0)}</div>}<strong>{store.name}</strong></Link><div className="app-style-header-actions">{themeConfig.showWishlistIcon !== false ? <Link className="app-style-icon-link" to={customer && customer.slug === slug ? `/store/${slug}/account` : `/store/${slug}/account/login`} title="Account">◔</Link> : null}{themeConfig.showCartIcon !== false ? <Link className="app-style-icon-link" to={`/store/${slug}/cart`} title="Cart">🛒{cartCount ? <span className="app-badge">{cartCount}</span> : null}</Link> : null}</div></div></header>
      {children(store, { themeConfig, labelSettings, isThemeOne, loading: storeState.loading, path: location.pathname, previewTheme })}
      <nav className="app-bottom-nav app-style-bottom-nav"><NavLink end to={`/store/${slug}`}><span className="app-nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/></svg></span><span>{themeConfig.menuHomeLabel || labelSettings.bottomNavHome || 'Home'}</span></NavLink><NavLink to={`/store/${slug}?view=shop`}><span className="app-nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 8h6"/></svg></span><span>{themeConfig.menuShopLabel || 'Shop All'}</span></NavLink><NavLink to={`/store/${slug}?view=categories`}><span className="app-nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg></span><span>{themeConfig.categoryNavLabel || 'Categories'}</span></NavLink><NavLink to={`/store/${slug}/wishlist`}><span className="app-nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 20-1.3-1.2C5.2 13.8 2 10.9 2 7.3 2 4.4 4.2 2 7 2c1.7 0 3.4.8 4.5 2.1C12.6 2.8 14.3 2 16 2c2.8 0 5 2.4 5 5.3 0 3.6-3.2 6.5-8.7 11.5L12 20z"/></svg></span><span>{themeConfig.menuWishlistLabel || 'Wishlist'}</span></NavLink><NavLink to={customer && customer.slug === slug ? `/store/${slug}/account` : `/store/${slug}/account/login`}><span className="app-nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 8h6M9 12h6M9 16h6"/></svg></span><span>{themeConfig.menuAccountLabel || labelSettings.bottomNavAccount || 'Account'}</span></NavLink></nav>
    </div>
  );
}

function useStoreProducts(slug, search, sort, category, initialProducts) {
  const cacheKey = `storebanao_products_${slug}_${search || ''}_${sort || ''}_${category || ''}`;
  const baseInitial = (!search && !sort && !category && Array.isArray(initialProducts) && initialProducts.length)
    ? { products: initialProducts }
    : { products: [] };
  const initial = readSessionJson(cacheKey, baseInitial);
  const state = useApiData(() => api.get(`/api/store/${slug}/products?search=${encodeURIComponent(search || '')}&sort=${encodeURIComponent(sort || '')}&category=${encodeURIComponent(category || '')}`), [slug, search, sort, category], initial);
  useEffect(() => {
    if (!state.loading && !state.error) {
      sessionStorage.setItem(cacheKey, JSON.stringify(state.data));
    }
  }, [cacheKey, state.loading, state.error, state.data]);
  return state;
}

function StorePage() {
  const { slug } = useParams();
  usePageTitle(`Store - ${slug}`);
  const [searchParams, setSearchParams] = useSearchParams();
  const [cart, setCart] = useStoreCart(slug);
  const [wishlist, setWishlist] = useStoreWishlist(slug);
  const { customer } = useAuth();
  const storeState = useStoreShellData(slug);
  const store = storeState.data.store || {};
  const productState = useStoreProducts(slug, searchParams.get('search') || '', searchParams.get('sort') || '', searchParams.get('category') || '', store.initialProducts || []);
  const products = productState.data.products || [];
  const themeConfig = store.themeConfig || {};
  const labelSettings = (store.storeSettings && store.storeSettings.labelSettings) || {};
  const desktopBanner = (Array.isArray(themeConfig.bannerImages) && themeConfig.bannerImages[0]) || themeConfig.bannerImage || '';
  const mobileBanner = (Array.isArray(themeConfig.bannerImagesMobile) && themeConfig.bannerImagesMobile[0]) || desktopBanner;
  const isThemeOne = String(store.template || 'app-style') === 'app-style';
  const isThemeTwo = String(store.template || '') === 'minimal';
  const [themeTwoDrawerOpen, setThemeTwoDrawerOpen] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroSlides = (Array.isArray(themeConfig.bannerImages) && themeConfig.bannerImages.length ? themeConfig.bannerImages : desktopBanner ? [desktopBanner] : []).slice(0, 4);

  useEffect(() => {
    if (!isThemeTwo || heroSlides.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [isThemeTwo, heroSlides.length]);

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) return prev.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return prev.concat({ productId: product.id, quantity: 1, price: product.price, variantSummary: '', sku: product.sku || '' });
    });
  }

  async function toggleWishlist(productId) {
    const next = wishlist.includes(productId) ? wishlist.filter((id) => id !== productId) : wishlist.concat(productId);
    setWishlist(next);
    if (customer && customer.slug === slug) {
      try {
        await api.post(`/api/store/${slug}/wishlist/toggle/${productId}`, {}, customer.token);
      } catch (error) {
      }
    }
  }

  function renderHero() {
    if (isThemeOne) {
      const slides = (Array.isArray(themeConfig.bannerImages) && themeConfig.bannerImages.length ? themeConfig.bannerImages : desktopBanner ? [desktopBanner] : []);
      return <div className="store-wrap-hero"><section className="app-feature-hero app-style-hero app-style-hero-carousel"><div className="app-style-hero-track" style={{ transform: `translateX(-${heroIndex * 100}%)` }}>{slides.length ? slides.map((image, index) => <div key={`${image}-${index}`} className="app-style-hero-slide"><picture>{mobileBanner ? <source media="(max-width: 640px)" srcSet={mobileBanner} /> : null}<img src={image} alt={`${store.name} banner ${index + 1}`} /></picture></div>) : <div className="app-card-empty" style={{ minHeight: 420 }}>{store.name}</div>}</div>{slides.length > 1 ? <div className="app-style-hero-dots">{slides.map((_, index) => <button key={index} type="button" className={cn('dot', heroIndex === index && 'active')} onClick={() => setHeroIndex(index)} />)}</div> : null}</section></div>;
    }
    return <section className={cn('app-feature-hero', isThemeOne && 'app-style-hero')}><div className="app-feature-media">{desktopBanner ? <picture>{mobileBanner ? <source media="(max-width: 640px)" srcSet={mobileBanner} /> : null}<img src={desktopBanner} alt={store.name} /></picture> : <div className="app-card-empty" style={{ minHeight: 420 }}>{store.name}</div>}</div><div className={cn('app-feature-overlay', isThemeOne && 'app-style-overlay')}><span className="app-eyebrow">Featured Store</span><h1>{(themeConfig.bannerTitle || store.name || '').toUpperCase()}</h1><p>{themeConfig.bannerSubtitle || store.description || 'A beautiful storefront built for mobile shoppers, fast checkout, and repeat customers.'}</p><div className="app-feature-actions"><Link className="btn" to={`/store/${slug}/cart`}>{themeConfig.bannerCta || labelSettings.addProductButton || 'Open cart'}</Link><Link className="btn btn-secondary" to={`/store/${slug}/track-order`}>{themeConfig.bannerSecondaryCta || labelSettings.bottomNavOrders || 'Track order'}</Link></div></div></section>;
  }

  function renderSearchAndCategories() {
    return <>{themeConfig.showSearch !== false ? <div className="app-style-search-row"><div className="app-search-form"><span className="app-search-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9b92c4" strokeWidth="2.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span><input placeholder={themeConfig.searchPlaceholder || labelSettings.searchBoxText || 'Search for a product...'} value={searchParams.get('search') || ''} onChange={(event) => setSearchParams((prev) => { const next = new URLSearchParams(prev); if (event.target.value) next.set('search', event.target.value); else next.delete('search'); return next; })} /></div><button className="app-style-filter-btn" type="button" aria-label="Filters">☷</button></div> : null}{themeConfig.showCategories !== false && isThemeOne && Array.isArray(store.categories) && store.categories.length ? <div className="app-style-categories"><div className="app-category-strip">{store.categories.map((category) => <button key={category.id || category.name} type="button" className={cn('app-category-chip', (searchParams.get('category') || '') === category.name && 'active')} onClick={() => setSearchParams((prev) => { const next = new URLSearchParams(prev); if ((searchParams.get('category') || '') === category.name) next.delete('category'); else if (category.name) next.set('category', category.name); return next; })}>{category.image ? <img className="app-category-chip-img" src={category.image} alt={category.name} /> : <span className="app-category-chip-ph">{String(category.name || 'C').charAt(0)}</span>}<b>{category.name}</b></button>)}</div></div> : null}</>;
  }

  function renderThemeOneBestSelling() {
    const bestSelling = products.slice(0, 3);
    if (!bestSelling.length) return null;
    return <div className="app-section"><div className="app-rail-head"><div className="section-label-row"><span className="section-flame">🔥</span><h2 className="app-section-title">Best Selling</h2></div><a href={`/store/${slug}?view=shop`}>View All ›</a></div><div className="app-horizontal-cards">{bestSelling.map((product) => <div key={product.id} className="app-card horizontal-card"><div className="app-card-figure"><img className="app-card-img" src={product.image} alt={product.name} />{Number(product.comparePrice || product.mrp || 0) > Number(product.price || 0) ? <div className="app-sale-badge red">SALE</div> : null}<button className="app-theme-heart" type="button" onClick={() => toggleWishlist(product.id)}>{wishlist.includes(product.id) ? '♥' : '♡'}</button></div><div className="app-card-body"><h3>{product.name}</h3><div className="app-card-price"><span className="price">{formatMoney(product.price)}</span>{Number(product.comparePrice || product.mrp || 0) > Number(product.price || 0) ? <span className="old-price">{formatMoney(product.comparePrice || product.mrp)}</span> : null}</div><div className="app-card-price"><span className="stock">● {product.stock || 'In'} left</span><span className="app-card-rating">★ 4.8</span></div></div><div className="app-card-actions"><button className="app-theme-one-btn" type="button" onClick={() => addToCart(product)}>+ ADD TO CART</button></div></div>)}</div></div>;
  }

  function renderThemeOnePopular() {
    if (!products.length) return null;
    return <div className="app-section" style={{ marginTop: 8 }}><div className="app-rail-head"><div className="section-label-row"><span className="section-flame">⭐</span><h2 className="app-section-title">Popular Products</h2></div><a href={`/store/${slug}?view=shop`}>View All ›</a></div><div className="app-grid">{products.slice(0, 8).map((product) => <div key={product.id} className="app-card"><div className="app-card-figure">{product.image ? <img className="app-card-img" src={product.image} alt={product.name} /> : <div className="app-card-empty">👕</div>}{Number(product.comparePrice || product.mrp || 0) > Number(product.price || 0) ? <div className={cn('app-sale-badge', 'red')}>SALE</div> : null}<button className="app-theme-heart" type="button" onClick={() => toggleWishlist(product.id)}>{wishlist.includes(product.id) ? '♥' : '♡'}</button></div><div className="app-card-body"><h3>{product.name}</h3><div className="app-card-price"><span className="price">{formatMoney(product.price)}</span>{Number(product.comparePrice || product.mrp || 0) > Number(product.price || 0) ? <span className="old-price">{formatMoney(product.comparePrice || product.mrp)}</span> : null}</div>{Number(product.comparePrice || product.mrp || 0) > Number(product.price || 0) ? <div className="app-card-price"><span className="app-off-pill">{Math.max(1, Math.round(((Number(product.comparePrice || product.mrp) - Number(product.price || 0)) / Number(product.comparePrice || product.mrp)) * 100))}% OFF</span></div> : null}</div><div className="app-card-actions"><button className="app-theme-one-btn" type="button" onClick={() => addToCart(product)}>+ ADD TO CART</button></div></div>)}</div><div className="view-all-wrap"><button className="view-all-btn" type="button" onClick={() => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('view', 'shop'); return next; })}>View All Products →</button></div></div>;
  }

  function renderThemeOneTrust() {
    return <div className="trust-grid"><div className="trust-card"><div className="trust-icon">🚚</div><strong>Free Shipping</strong><span>Free shipping on orders above ₹999</span></div><div className="trust-card"><div className="trust-icon">↩️</div><strong>Easy Returns</strong><span>Hassle-free 7-day return policy</span></div><div className="trust-card"><div className="trust-icon">💬</div><strong>Online Support</strong><span>24 hours a day, 7 days a week</span></div><div className="trust-card"><div className="trust-icon">🔒</div><strong>Secure Payment</strong><span>Your money is 100% protected</span></div></div>;
  }

  function renderThemeOneInstagram() {
    const instagramImages = products.slice(0, 6).map((product) => product.image).filter(Boolean);
    return <div className="insta-section"><div className="insta-head"><div className="insta-icon">📷</div><div><strong>Follow Us on Instagram</strong><div style={{ fontSize: 12, color: '#64748b' }}>@{store.slug}</div></div></div><div className="insta-grid">{instagramImages.map((src, index) => <img key={`${src}-${index}`} className="insta-img" src={src} alt="Instagram" />)}</div><button className="insta-btn" type="button">Follow on Instagram</button></div>;
  }

  function renderThemeOneFooter() {
    return <div className="store-footer"><div className="footer-brand-row">{store.logo ? <img className="app-style-brand-logo" src={store.logo} alt={store.name} /> : <div className="footer-logo-ph">{(store.name || 'S').charAt(0)}</div>}<span className="footer-brand-name">{store.name}</span></div><p className="footer-desc">{store.description || 'Premium shopping experience for your customers.'}</p><div className="footer-cols"><div className="footer-col"><h4>Quick Links</h4><ul><li><a href={`/store/${slug}`}>Home</a></li><li><a href={`/store/${slug}?view=shop`}>Shop All</a></li><li><a href={`/store/${slug}/page/contact-us`}>Contact Us</a></li><li><a href={`/store/${slug}/page/return-policy`}>Return Policy</a></li><li><a href={`/store/${slug}/page/shipping-policy`}>Shipping Policy</a></li><li><a href={`/store/${slug}/track-order`}>Track Order</a></li><li><a href={`/store/${slug}/page/privacy-policy`}>Privacy Policy</a></li></ul></div><div className="footer-col"><h4>Contact</h4><ul><li><a href={`https://wa.me/${(store.whatsapp || '').replace(/\D/g, '')}`}>📱 WhatsApp</a></li><li><a href="#">📘 Facebook</a></li><li><a href="#">📷 Instagram</a></li></ul></div></div><div className="footer-bottom"><span>© 2025 {store.name}. All rights reserved.</span><span style={{ color: '#444', fontSize: 10 }}>Powered by StoreBanao</span></div></div>;
  }

  function renderCollections() {
    if (!Array.isArray(store.collections) || !store.collections.length) return null;
    return <section className="app-section"><div className="app-rail-head"><div><span className="app-eyebrow">Collections</span><h2 className="app-section-title">{labelSettings.collectionsHeading || 'Our Collections'}</h2></div></div><div className="app-collection-strip">{store.collections.map((collection) => <article key={collection.id} className="app-collection-card"><strong>{collection.name}</strong><span>{collection.description || 'Handpicked collection'}</span></article>)}</div></section>;
  }

  function renderThemeTwoHome() {
    const marqueeItems = String(themeConfig.topBarText || 'FREE DELIVERY ON ORDERS ABOVE ₹999 | COD AVAILABLE | 50K+ HAPPY CUSTOMERS')
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
    const bestSelling = products.slice(0, 8);
    const instagramImages = products.slice(0, 6).map((product) => product.image).filter(Boolean);
    const activeHero = heroSlides[heroIndex] || desktopBanner;
    return <div className="store-page theme-two-page"><div className={cn('theme-two-drawer-shell', themeTwoDrawerOpen && 'open')}><div className="theme-two-drawer-backdrop" onClick={() => setThemeTwoDrawerOpen(false)} /><aside className="theme-two-drawer"><div className="theme-two-drawer-head"><strong>{store.name || 'Menu'}</strong><button type="button" onClick={() => setThemeTwoDrawerOpen(false)}>×</button></div><nav className="theme-two-drawer-links"><Link to={`/store/${slug}`} onClick={() => setThemeTwoDrawerOpen(false)}>Home</Link><Link to={`/store/${slug}?view=shop`} onClick={() => setThemeTwoDrawerOpen(false)}>All Products</Link>{(store.categories || []).map((category) => <Link key={category.id || category.name} to={`/store/${slug}?category=${encodeURIComponent(category.name || '')}`} onClick={() => setThemeTwoDrawerOpen(false)}>{category.name} →</Link>)}<a className="theme-two-whatsapp-link" href={`https://wa.me/${(store.whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Hi! I want to order from ${store.name}. Please help me.`)}`}>WhatsApp Support</a></nav></aside></div><div className="theme-two-top-strip"><div className="theme-two-top-track">{marqueeItems.concat(marqueeItems).map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}</div></div><header className="theme-two-header"><button className="theme-two-icon-btn" type="button" onClick={() => setThemeTwoDrawerOpen(true)}>☰</button><Link className="theme-two-logo-wrap" to={`/store/${slug}`}>{store.logo ? <img src={store.logo} alt={store.name} /> : <div className="app-logo-ph">{(store.name || 'S').charAt(0)}</div>}</Link><div className="theme-two-actions"><Link className="theme-two-icon-btn" to={customer && customer.slug === slug ? `/store/${slug}/account` : `/store/${slug}/account/login`}>◔</Link><Link className="theme-two-icon-btn" to={`/store/${slug}/cart`}>🛒{cart.length ? <span className="app-badge">{cart.length}</span> : null}</Link></div></header><div className="store-wrap theme-two-wrap"><section className="theme-two-search-row"><div className="theme-two-search-pill"><span>⌕</span><input placeholder={themeConfig.searchPlaceholder || 'Search sneakers, sizes...'} value={searchParams.get('search') || ''} onChange={(event) => setSearchParams((prev) => { const next = new URLSearchParams(prev); if (event.target.value) next.set('search', event.target.value); else next.delete('search'); return next; })} /></div><button className="theme-two-filter-btn" type="button">☷</button></section>{Array.isArray(store.categories) && store.categories.length ? <section className="theme-two-category-row">{store.categories.map((category) => <button key={category.id || category.name} type="button" className="theme-two-category-item" onClick={() => setSearchParams((prev) => { const next = new URLSearchParams(prev); if (category.name) next.set('category', category.name); return next; })}>{category.image ? <img src={category.image} alt={category.name} loading="lazy" /> : <span>{String(category.name || 'C').charAt(0)}</span>}<b>{category.name}</b></button>)}</section> : null}<section className="theme-two-hero"><div className="theme-two-hero-slider" style={{ transform: `translateX(-${heroIndex * 100}%)` }}>{heroSlides.map((image, index) => <article key={`${image}-${index}`} className="theme-two-hero-slide">{image ? <img src={image} alt={`${store.name} banner ${index + 1}`} fetchPriority={index === 0 ? 'high' : 'auto'} /> : <div className="theme-two-hero-placeholder" />}</article>)}</div>{heroSlides.length > 1 ? <div className="theme-two-hero-dots">{heroSlides.map((_, index) => <button key={index} type="button" className={cn('dot', heroIndex === index && 'active')} onClick={() => setHeroIndex(index)} />)}</div> : null}</section><section className="theme-two-section dark"><div className="theme-two-section-head"><h2>🔥 BEST SELLING</h2><Link to={`/store/${slug}?view=shop`}>View All →</Link></div><div className="theme-two-horizontal-grid">{bestSelling.map((product) => <ProductCard key={product.id} slug={slug} product={product} wished={wishlist.includes(product.id)} onAddToCart={addToCart} onToggleWishlist={toggleWishlist} isThemeOne themeConfig={{ ...themeConfig, showProductStock: false }} />)}</div></section><section className="theme-two-section light"><div className="theme-two-section-head"><h2>{themeConfig.productsTitle || labelSettings.productsHeading || 'Popular Products'}</h2><Link to={`/store/${slug}?view=shop`}>View All →</Link></div><div className="app-grid">{products.map((product) => <ProductCard key={product.id} slug={slug} product={product} wished={wishlist.includes(product.id)} onAddToCart={addToCart} onToggleWishlist={toggleWishlist} isThemeOne={false} />)}</div><Link className="theme-two-view-all-btn" to={`/store/${slug}?view=shop`}>View All Products</Link></section><section className="theme-two-trust-grid"><article><strong>🚚 Free Shipping</strong><span>Orders ₹4999+</span></article><article><strong>🔄 Easy Returns</strong><span>Hassle Free</span></article><article><strong>💬 Online Support</strong><span>24/7</span></article><article><strong>💳 Flexible Pay</strong><span>Multiple modes</span></article></section><section className="theme-two-instagram"><div className="theme-two-section-head"><h2>Follow Us on Instagram</h2><a href={store.socialLinks && store.socialLinks.instagram ? store.socialLinks.instagram : '#'} target="_blank" rel="noopener noreferrer">@{store.slug}</a></div><div className="theme-two-insta-grid">{instagramImages.map((src, index) => <img key={`${src}-${index}`} src={src} alt="Instagram preview" loading="lazy" />)}</div><a className="theme-two-insta-btn" href={store.socialLinks && store.socialLinks.instagram ? store.socialLinks.instagram : '#'} target="_blank" rel="noopener noreferrer">Follow</a></section><footer className="theme-two-footer"><div className="theme-two-footer-brand">{store.logo ? <img src={store.logo} alt={store.name} /> : null}<p>{store.description || 'Premium shopping experience for your customers.'}</p></div><div className="theme-two-footer-cols"><div><h4>Quick Links</h4><a href={`/store/${slug}`}>Home</a><a href={`/store/${slug}/page/about-us`}>About Us</a><a href={`/store/${slug}/page/contact-us`}>Contact Us</a><a href={`/store/${slug}/page/shipping-policy`}>Shipping Policy</a><a href={`/store/${slug}/page/privacy-policy`}>Privacy Policy</a></div><div><h4>Contact</h4><a href={`https://wa.me/${(store.whatsapp || '').replace(/\D/g, '')}`}>WhatsApp</a><a href={store.socialLinks && store.socialLinks.instagram ? store.socialLinks.instagram : '#'}>Instagram</a></div></div><div className="theme-two-footer-copy">© 2024 {store.name}. All rights reserved.</div></footer></div><a className="theme-two-wa-float" href={`https://wa.me/${(store.whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Hi! I want to order from ${store.name}. Please help me.`)}`}>🟢</a></div>;
  }

  return (
    isThemeTwo ? renderThemeTwoHome() : <ThemeOneStoreScaffold slug={slug} cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)} wishlistCount={wishlist.length}>{() => <>{renderSearchAndCategories()}{themeConfig.showBanner !== false ? renderHero() : null}<div className="store-wrap">{storeState.loading ? <LoadingBlock label="Loading store..." /> : <>{renderThemeOneBestSelling()}{renderThemeOnePopular()}{renderThemeOneTrust()}{renderThemeOneInstagram()}{renderThemeOneFooter()}</>}</div></>}</ThemeOneStoreScaffold>
  );
}

function ProductPage() {
  const { slug, id } = useParams();
  const [cart, setCart] = useStoreCart(slug);
  const [wishlist, setWishlist] = useStoreWishlist(slug);
  const [reviewForm, setReviewForm] = useState({ reviewName: '', rating: '5', comment: '' });
  const [reviewState, setReviewState] = useState({ loading: false, error: '' });
  const { data, loading, error } = useCachedApiData(`store_product_${slug}_${id}`, () => api.get(`/api/store/${slug}/product/${id}`), [slug, id], { product: null, related: [] });
  const product = data.product;
  const related = data.related || [];
  usePageTitle(product ? `${product.name} - StoreBanao` : 'Product - StoreBanao');

  if (loading) return <div className="store-page"><LoadingBlock label="Loading product..." /></div>;
  if (error || !product) return <div className="store-page"><EmptyState title="Product not found" body={error || 'This product could not be loaded.'} /></div>;

  async function submitReview(event) {
    event.preventDefault();
    setReviewState({ loading: true, error: '' });
    try {
      await api.post(`/api/store/${slug}/product/${id}/review`, reviewForm);
      window.location.reload();
    } catch (reviewError) {
      setReviewState({ loading: false, error: reviewError.message || 'Unable to submit review' });
    }
  }

  return <ThemeOneStoreScaffold slug={slug} cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)} wishlistCount={wishlist.length}>{(store, shell) => <div className="store-wrap"><section className="app-product-page"><div className="app-product-gallery"><div className="app-product-media">{product.image ? <img src={product.image} alt={product.name} /> : <div className="app-product-placeholder">No image</div>}</div></div><div className="app-product-copy"><div className="app-product-meta-row"><span className="app-rating-pill">SKU {product.sku || 'N/A'}</span>{shell.themeConfig.showProductPageStock !== false ? <span className="app-rating-pill success">{product.stock || 0} left</span> : null}</div><h1 className="app-product-title">{product.name}</h1><div className="app-product-price-row"><div><div className="app-product-price">{formatMoney(product.price)}</div>{product.comparePrice || product.mrp ? <div className="app-product-compare">{formatMoney(product.comparePrice || product.mrp)}</div> : null}</div></div>{shell.themeConfig.showProductDescription !== false ? <p className="app-product-subcopy">{product.description || 'Designed for mobile-first shopping and fast checkout.'}</p> : null}<div className="app-product-actions"><button className="btn app-cta-btn" type="button" onClick={() => setCart((prev) => prev.concat({ productId: product.id, quantity: 1, price: product.price, variantSummary: '', sku: product.sku || '' }))}>Add to Cart</button><Link className="btn btn-secondary app-cta-btn" to={`/store/${slug}/checkout`}>Buy Now</Link>{shell.themeConfig.showWhatsappButton !== false ? <button className={cn('app-circle-ghost', wishlist.includes(product.id) && 'wishlist-active')} type="button" onClick={() => setWishlist((prev) => prev.includes(product.id) ? prev.filter((entry) => entry !== product.id) : prev.concat(product.id))}>{wishlist.includes(product.id) ? '♥' : '♡'}</button> : null}</div></div></section><section className="app-section"><div className="app-rail-head"><div><span className="app-eyebrow">Customer feedback</span><h2 className="app-section-title">Reviews ({Array.isArray(product.reviews) ? product.reviews.length : 0})</h2></div></div><div className="app-review-shell">{Array.isArray(product.reviews) && product.reviews.length ? product.reviews.slice().reverse().map((review) => <article key={review.id} className="app-review-card"><div className="app-review-head"><strong>{review.customerName}</strong><span>{'★'.repeat(Math.max(1, Math.min(5, Number(review.rating || 5))))}</span></div><p>{review.comment}</p><small>{formatDate(review.createdAt)}</small></article>) : <EmptyState title="No reviews yet" body="Be the first to review this product." />}</div>{reviewState.error ? <Alert type="error">{reviewState.error}</Alert> : null}<form className="app-review-form" onSubmit={submitReview}><input value={reviewForm.reviewName} onChange={(event) => setReviewForm((prev) => ({ ...prev, reviewName: event.target.value }))} placeholder="Your name" required /><select value={reviewForm.rating} onChange={(event) => setReviewForm((prev) => ({ ...prev, rating: event.target.value }))}><option value="5">★★★★★ (5 - Excellent)</option><option value="4">★★★★☆ (4 - Good)</option><option value="3">★★★☆☆ (3 - Average)</option><option value="2">★★☆☆☆ (2 - Poor)</option><option value="1">★☆☆☆☆ (1 - Terrible)</option></select><textarea value={reviewForm.comment} onChange={(event) => setReviewForm((prev) => ({ ...prev, comment: event.target.value }))} placeholder="Share your experience..." required /><button className="btn" type="submit" disabled={reviewState.loading}>{reviewState.loading ? 'Submitting...' : 'Submit Review'}</button></form></section><section className="app-section"><div className="app-rail-head"><div><span className="app-eyebrow">Complete the look</span><h2 className="app-section-title">You may also like</h2></div></div><div className="app-grid">{related.map((entry) => <ProductCard key={entry.id} slug={slug} product={entry} wished={wishlist.includes(entry.id)} onAddToCart={(nextProduct) => setCart((prev) => prev.concat({ productId: nextProduct.id, quantity: 1, price: nextProduct.price, variantSummary: '', sku: nextProduct.sku || '' }))} onToggleWishlist={(productId) => setWishlist((prev) => prev.includes(productId) ? prev.filter((entryId) => entryId !== productId) : prev.concat(productId))} isThemeOne={shell.isThemeOne} themeConfig={shell.themeConfig} />)}</div></section></div>}</ThemeOneStoreScaffold>;
}

function CartPage() {
  const { slug } = useParams();
  const [cart, setCart] = useStoreCart(slug);
  const [items, setItems] = useState([]);
  usePageTitle('Cart - StoreBanao');

  useEffect(() => {
    let active = true;
    Promise.all(cart.map((item) => api.get(`/api/store/${slug}/product/${item.productId}`).then((data) => ({ ...item, product: data.product })))).then((rows) => {
      if (active) setItems(rows.filter((row) => row.product));
    }).catch(() => {
      if (active) setItems([]);
    });
    return () => {
      active = false;
    };
  }, [slug, cart]);

  const total = items.reduce((sum, item) => sum + Number(item.product.price || item.price || 0) * Number(item.quantity || 1), 0);

  return <ThemeOneStoreScaffold slug={slug} cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)} wishlistCount={0}>{() => <div className="store-wrap"><section className="card panel cart-page"><div className="section-head"><h1 className="section-title">Your cart</h1><Link className="btn btn-secondary" to={`/store/${slug}`}>Continue shopping</Link></div>{items.length ? items.map((item) => <div key={item.productId} className="checkout-item"><div><strong>{item.product.name}</strong><small>{formatMoney(item.product.price)} each</small></div><div className="cart-inline-actions"><input type="number" min="1" value={item.quantity} onChange={(event) => setCart((prev) => prev.map((entry) => entry.productId === item.productId ? { ...entry, quantity: Math.max(1, Number(event.target.value || 1)) } : entry))} /><button className="btn btn-secondary" type="button" onClick={() => setCart((prev) => prev.filter((entry) => entry.productId !== item.productId))}>Remove</button></div></div>) : <EmptyState title="Your cart is empty" body="Add products from the store to see them here." action={<Link className="btn btn-secondary" to={`/store/${slug}`}>Browse products</Link>} />}{items.length ? <div className="summary-box"><div className="summary-row"><span>Total</span><strong>{formatMoney(total)}</strong></div><Link className="btn" to={`/store/${slug}/checkout`}>Proceed to checkout</Link></div> : null}</section></div>}</ThemeOneStoreScaffold>;
}

function CheckoutPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { customer } = useAuth();
  const storeState = useStoreShellData(slug);
  const store = storeState.data.store || {};
  const paymentConfig = Object.assign({}, (store.storeSettings && store.storeSettings.paymentSettings) || {}, store.paymentSettings || {});
  const allowedPaymentModes = [];
  if (paymentConfig.cod || paymentConfig.mode === 'cod' || paymentConfig.mode === 'both') allowedPaymentModes.push('cod');
  if (paymentConfig.onlinePayment || paymentConfig.mode === 'online' || paymentConfig.mode === 'both') allowedPaymentModes.push('online');
  if (paymentConfig.whatsappOrder || paymentConfig.mode === 'whatsapp' || paymentConfig.mode === 'both') allowedPaymentModes.push('whatsapp');
  const paymentOptions = (allowedPaymentModes.length ? Array.from(new Set(allowedPaymentModes)) : ['cod', 'online', 'whatsapp']);
  const [cart, setCart] = useStoreCart(slug);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: customer && customer.slug === slug ? customer.customer.name || '' : '', phone: customer && customer.slug === slug ? customer.customer.phone || '' : '', email: customer && customer.slug === slug ? customer.customer.email || '' : '', shippingAddress: '', notes: '', paymentMethod: 'cod', couponCode: '' });
  const [state, setState] = useState({ loading: false, error: '' });
  usePageTitle('Checkout - StoreBanao');

  useEffect(() => {
    let active = true;
    Promise.all(cart.map((item) => api.get(`/api/store/${slug}/product/${item.productId}`).then((data) => ({ ...item, product: data.product })))).then((rows) => {
      if (active) setItems(rows.filter((row) => row.product).map((row) => ({ ...row, subtotal: Number(row.product.price || row.price || 0) * Number(row.quantity || 1) })));
    }).catch(() => {
      if (active) setItems([]);
    });
    return () => {
      active = false;
    };
  }, [slug, cart]);

  useEffect(() => {
    if (!paymentOptions.includes(form.paymentMethod)) {
      setForm((prev) => ({ ...prev, paymentMethod: paymentOptions[0] || 'cod' }));
    }
  }, [paymentOptions, form.paymentMethod]);

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  async function submit(event) {
    event.preventDefault();
    setState({ loading: true, error: '' });
    try {
      const data = await api.post(`/api/store/${slug}/checkout`, { ...form, items: items.map((item) => ({ productId: item.productId, quantity: item.quantity, price: item.product.price, variantSummary: item.variantSummary || '', sku: item.sku || '' })) });
      setCart([]);
      if (data.paymentRedirect) {
        window.location.href = `${API_URL}${data.paymentRedirect}`;
        return;
      }
      navigate(`/store/${slug}/order/${data.order.trackingCode}`);
    } catch (checkoutError) {
      setState({ loading: false, error: checkoutError.message || 'Unable to place order' });
    }
  }

  return <ThemeOneStoreScaffold slug={slug} cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)} wishlistCount={0}>{() => <div className="store-wrap"><div className="checkout-layout"><section className="card panel checkout-page"><div className="checkout-steps"><div className="checkout-step active"><strong>Contact</strong><span>Your details</span></div><div className="checkout-step active"><strong>Shipping</strong><span>Delivery address</span></div><div className="checkout-step active"><strong>Payment</strong><span>Confirm order</span></div></div>{state.error ? <Alert type="error">{state.error}</Alert> : null}<form className="checkout-form form-grid" onSubmit={submit}><div className="form-grid two"><div className="field"><label>Name</label><input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required /></div><div className="field"><label>Phone</label><input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} required /></div><div className="field"><label>Email</label><input type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} required /></div><div className="field"><label>Payment</label><select value={form.paymentMethod} onChange={(event) => setForm((prev) => ({ ...prev, paymentMethod: event.target.value }))}>{paymentOptions.includes('cod') ? <option value="cod">Cash on Delivery</option> : null}{paymentOptions.includes('online') ? <option value="online">Online Payment</option> : null}{paymentOptions.includes('whatsapp') ? <option value="whatsapp">WhatsApp Order</option> : null}</select></div></div><div className="field"><label>Coupon code</label><input value={form.couponCode} onChange={(event) => setForm((prev) => ({ ...prev, couponCode: event.target.value.toUpperCase() }))} placeholder="DISCOUNT10" /></div><div className="field"><label>Shipping address</label><textarea value={form.shippingAddress} onChange={(event) => setForm((prev) => ({ ...prev, shippingAddress: event.target.value }))} required /></div><div className="field"><label>Order notes</label><textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} /></div><button className="btn" type="submit" disabled={state.loading || !items.length}>{state.loading ? 'Placing order...' : 'Place Order'}</button></form></section><aside className="checkout-panel"><div className="summary-box"><h3>Order summary</h3><div className="checkout-review">{items.map((item) => <div key={item.productId} className="checkout-item"><div><strong>{item.product.name}</strong><small>{item.quantity} x {formatMoney(item.product.price)}</small></div><strong>{formatMoney(item.subtotal)}</strong></div>)}</div><div className="summary-row"><span>Subtotal</span><strong>{formatMoney(subtotal)}</strong></div>{form.couponCode ? <div className="summary-row"><span>Coupon</span><strong>{form.couponCode}</strong></div> : null}<div className="summary-row"><span>Shipping + tax</span><strong>Calculated by API</strong></div></div></aside></div></div>}</ThemeOneStoreScaffold>;
}

function StoreContentPage() {
  const { slug, pageSlug } = useParams();
  const [cart] = useStoreCart(slug);
  const [wishlist] = useStoreWishlist(slug);
  const { data, loading, error } = useCachedApiData(`store_page_${slug}_${pageSlug}`, () => api.get(`/api/store/${slug}/page/${pageSlug}`), [slug, pageSlug], { page: null });
  const page = data.page;
  usePageTitle(page ? `${page.title} - StoreBanao` : 'Store Page - StoreBanao');
  return <ThemeOneStoreScaffold slug={slug} cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)} wishlistCount={wishlist.length}>{() => <div className="store-wrap"><section className="card panel"><h1 className="section-title">{page ? page.title : 'Page'}</h1>{loading ? <LoadingBlock label="Loading page..." /> : error ? <Alert type="error">{error}</Alert> : <div className="section-subtitle" style={{ whiteSpace: 'pre-wrap' }}>{page && page.content ? page.content : 'No content available.'}</div>}</section></div>}</ThemeOneStoreScaffold>;
}

function TrackOrderPage() {
  const { slug, code } = useParams();
  const [input, setInput] = useState(code || '');
  const [queryCode, setQueryCode] = useState(code || '');
  const { data, loading, error } = useCachedApiData(`store_order_${slug}_${queryCode || 'empty'}`, () => queryCode ? api.get(`/api/store/${slug}/order/${queryCode}`) : Promise.resolve({ order: null }), [slug, queryCode], { order: null });
  const order = data.order;
  usePageTitle('Track Order - StoreBanao');
  return <ThemeOneStoreScaffold slug={slug} cartCount={0} wishlistCount={0}>{() => <div className="store-wrap"><section className="card panel tracking-page"><h1 className="section-title">Track your order</h1><p className="section-subtitle">Enter your tracking code, order number, or order id.</p><form className="form-grid two track-form" onSubmit={(event) => { event.preventDefault(); setQueryCode(input); }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Tracking code" /><button className="btn" type="submit">Track order</button></form>{loading ? <LoadingBlock label="Looking up order..." /> : null}{error ? <Alert type="error">{error}</Alert> : null}{order ? <div className="card panel"><div className="title-row"><div><h2 className="section-title" style={{ fontSize: 20, margin: 0 }}>{order.orderNumber}</h2><p className="section-subtitle">{order.productName}</p></div><span className="topbar-pill">{order.status}</span></div><div className="kpi-list"><div className="kpi-item"><strong>Customer</strong><span>{order.customerName}</span></div><div className="kpi-item"><strong>Phone</strong><span>{order.customerPhone}</span></div><div className="kpi-item"><strong>Total</strong><span>{formatMoney(order.amount)}</span></div><div className="kpi-item"><strong>Tracking Code</strong><span>{order.trackingCode}</span></div></div></div> : !loading && queryCode ? <EmptyState title="Order not found" body="Check the code and try again." /> : null}</section></div>}</ThemeOneStoreScaffold>;
}

function CustomerLoginPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginCustomer, hydrateCustomerFromToken } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [state, setState] = useState({ loading: false, error: '' });
  usePageTitle('Customer Login - StoreBanao');
  useEffect(() => {
    if (searchParams.get('google') !== '1') return;
    const token = searchParams.get('token');
    if (!token) {
      setState({ loading: false, error: 'Google sign-in could not be completed. Please try again.' });
      return;
    }
    let active = true;
    setState({ loading: true, error: '' });
    hydrateCustomerFromToken(slug, token).then(() => {
      if (active) navigate(`/store/${slug}/account`, { replace: true });
    }).catch((error) => {
      if (active) setState({ loading: false, error: error.message || 'Google login failed' });
    });
    return () => {
      active = false;
    };
  }, [searchParams, hydrateCustomerFromToken, slug, navigate]);
  async function submit(event) {
    event.preventDefault();
    setState({ loading: true, error: '' });
    try {
      await loginCustomer(slug, form);
      navigate(`/store/${slug}/account`);
    } catch (error) {
      if (error && error.status === 404) {
        navigate(`/store/${slug}/account/register?error=account-not-found`, { replace: true });
        return;
      }
      setState({ loading: false, error: error.message || 'Login failed' });
      return;
    }
    setState({ loading: false, error: '' });
  }
  return <AuthShell title="Customer login" subtitle="Log in to view orders, wishlist, and saved details.">{state.error ? <Alert type="error">{state.error}</Alert> : null}<form className="form-grid" onSubmit={submit}><GoogleAuthButton href={`${API_URL}/auth/google?flow=customer&store=${encodeURIComponent(slug)}&redirect=${encodeURIComponent(`/store/${slug}/account`)}`} /><div className="field"><label>Email</label><input type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} required /></div><div className="field"><label>Password</label><input type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} required /></div><div className="actions"><button className="btn" type="submit" disabled={state.loading}>{state.loading ? 'Logging in...' : 'Login'}</button><Link className="btn btn-secondary" to={`/store/${slug}/account/register`}>Create account</Link></div></form></AuthShell>;
}

function CustomerRegisterPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const missingAccount = searchParams.get('error') === 'account-not-found';
  const { registerCustomer } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [state, setState] = useState({ loading: false, error: '' });
  usePageTitle('Customer Register - StoreBanao');
  async function submit(event) {
    event.preventDefault();
    setState({ loading: true, error: '' });
    try {
      await registerCustomer(slug, form);
      navigate(`/store/${slug}/account`);
    } catch (error) {
      setState({ loading: false, error: error.message || 'Registration failed' });
      return;
    }
    setState({ loading: false, error: '' });
  }
  return <AuthShell title="Create customer account" subtitle="Save your details, wishlist, and order history.">{missingAccount ? <Alert type="error">Register account does not exist. Please create your account first.</Alert> : null}{state.error ? <Alert type="error">{state.error}</Alert> : null}<form className="form-grid" onSubmit={submit}><GoogleAuthButton href={`${API_URL}/auth/google?flow=customer&store=${encodeURIComponent(slug)}&redirect=${encodeURIComponent(`/store/${slug}/account`)}`} /><div className="field"><label>Name</label><input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required /></div><div className="field"><label>Email</label><input type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} required /></div><div className="field"><label>Phone</label><input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} required /></div><div className="field"><label>Password</label><input type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} required /></div><div className="actions"><button className="btn" type="submit" disabled={state.loading}>{state.loading ? 'Creating...' : 'Create account'}</button><Link className="btn btn-secondary" to={`/store/${slug}/account/login`}>Already have an account?</Link></div></form></AuthShell>;
}

function CustomerAccountPage() {
  const { slug } = useParams();
  const { customer, logoutCustomer } = useAuth();
  const auth = customer && customer.slug === slug ? customer : null;
  const ordersState = useCachedApiData(`customer_orders_${slug}_${auth && auth.customer ? auth.customer.email : 'anon'}`, () => auth ? api.get(`/api/store/${slug}/account/orders`, auth.token) : Promise.resolve({ orders: [] }), [auth && auth.token, slug], { orders: [] });
  const wishlistState = useCachedApiData(`customer_wishlist_${slug}_${auth && auth.customer ? auth.customer.email : 'anon'}`, () => auth ? api.get(`/api/store/${slug}/account/wishlist`, auth.token) : Promise.resolve({ products: [] }), [auth && auth.token, slug], { products: [] });
  usePageTitle('My Account - StoreBanao');
  return <CustomerOnly slug={slug}><ThemeOneStoreScaffold slug={slug} cartCount={0} wishlistCount={wishlistState.data.products.length}>{(store, shell) => <div className="store-wrap"><section className="card panel account-page"><div className="section-head"><div><h1 className="section-title">My account</h1><p className="section-subtitle">Manage orders, saved products, and profile details.</p></div><button className="btn btn-secondary" type="button" onClick={() => logoutCustomer()}>Logout</button></div><div className="app-account-card"><strong>{auth.customer.name}</strong><span>{auth.customer.email}</span><span>{auth.customer.phone}</span></div><section className="card panel"><h2 className="section-title" style={{ fontSize: 22 }}>My Orders</h2>{ordersState.loading ? <LoadingBlock label="Loading orders..." /> : ordersState.data.orders.length ? <div className="table-wrap"><table><thead><tr><th>Order</th><th>Status</th><th>Amount</th><th>Date</th></tr></thead><tbody>{ordersState.data.orders.map((order) => <tr key={order.id}><td><Link to={`/store/${slug}/order/${order.trackingCode}`}>{order.orderNumber}</Link></td><td>{order.status}</td><td>{formatMoney(order.amount)}</td><td>{formatDate(order.createdAt)}</td></tr>)}</tbody></table></div> : <EmptyState title="No orders yet" body="Your future orders will appear here." />}</section><section className="card panel"><h2 className="section-title" style={{ fontSize: 22 }}>Wishlist</h2>{wishlistState.loading ? <LoadingBlock label="Loading wishlist..." /> : wishlistState.data.products.length ? <div className="app-grid">{wishlistState.data.products.map((product) => <ProductCard key={product.id} slug={slug} product={product} wished onAddToCart={() => {}} onToggleWishlist={() => {}} isThemeOne={shell.isThemeOne} />)}</div> : <EmptyState title="Wishlist is empty" body="Save products you want to come back to." />}</section></section></div>}</ThemeOneStoreScaffold></CustomerOnly>;
}

function SuperAdminLoginPage() {
  const navigate = useNavigate();
  const { loginSuperAdmin } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [state, setState] = useState({ loading: false, error: '' });
  usePageTitle('Super Admin Login - StoreBanao');
  async function submit(event) {
    event.preventDefault();
    setState({ loading: true, error: '' });
    try {
      await loginSuperAdmin(form);
      navigate('/superadmin/dashboard');
    } catch (error) {
      setState({ loading: false, error: error.message || 'Login failed' });
      return;
    }
    setState({ loading: false, error: '' });
  }
  return <AuthShell title="Super admin login" subtitle="Access platform-wide stores, users, and system stats.">{state.error ? <Alert type="error">{state.error}</Alert> : null}<form className="form-grid" onSubmit={submit}><div className="field"><label>Email</label><input type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} required /></div><div className="field"><label>Password</label><input type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} required /></div><div className="actions"><button className="btn" type="submit" disabled={state.loading}>{state.loading ? 'Logging in...' : 'Login'}</button><Link className="btn btn-secondary" to="/">Back to home</Link></div></form></AuthShell>;
}

function SuperAdminFrame({ activeKey, title, subtitle, children }) {
  const { logoutSuperAdmin } = useAuth();
  const navigate = useNavigate();
  return <div className="dashboard-page"><div className="topbar"><div className="topbar-left"><div className="brand"><strong>Store</strong>Banao</div><div className="topbar-store"><div className="topbar-name">Super Admin</div><div className="topbar-sub">Platform control center</div></div></div><div className="topbar-actions"><button className="btn btn-secondary" type="button" onClick={() => { logoutSuperAdmin(); navigate('/superadmin'); }}>Sign out</button></div></div><nav className="sidebar">{SUPERADMIN_LINKS.map((item) => <NavLink key={item.key} className={({ isActive }) => cn('nav-link', isActive && 'active')} to={item.href}><span className="nav-icon">{item.icon}</span><span className="nav-label">{item.label}</span></NavLink>)}</nav><main className="main admin-shell"><div className="content-wrap"><div className="page-header"><div><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div></div>{children}</div></main></div>;
}

function SuperAdminDashboardPage() {
  const { superAdmin } = useAuth();
  const token = superAdmin && superAdmin.token;
  const { data, loading, error } = useApiData(() => api.get('/api/superadmin/dashboard', token), [token], { stats: {}, recentStores: [] });
  const stats = data.stats || {};
  return <SuperAdminOnly><SuperAdminFrame activeKey="dashboard" title="Super Admin Dashboard" subtitle="Platform-wide visibility across all stores and users.">{error ? <Alert type="error">{error}</Alert> : null}{loading ? <LoadingBlock label="Loading platform stats..." /> : <><section className="mini-grid">{[['Total Stores', stats.totalStores || 0], ['Total Users', stats.totalUsers || 0], ['Total Products', stats.totalProducts || 0], ['Total Orders', stats.totalOrders || 0]].map(([label, value]) => <div key={label} className="card mini-card"><div className="mini-title">{label}</div><div className="mini-number">{value}</div></div>)}</section><section className="card panel"><h2 className="section-title">Recent Stores</h2>{data.recentStores.length ? <div className="table-wrap"><table><thead><tr><th>Store</th><th>Owner</th><th>Created</th></tr></thead><tbody>{data.recentStores.map((store) => <tr key={store.slug}><td><Link to={`/superadmin/store/${store.slug}`}>{store.name}</Link></td><td>{store.ownerEmail || '-'}</td><td>{formatDate(store.createdAt)}</td></tr>)}</tbody></table></div> : <EmptyState title="No stores yet" body="New stores will appear here." />}</section></>}</SuperAdminFrame></SuperAdminOnly>;
}

function SuperAdminStoresPage() {
  const { superAdmin } = useAuth();
  const token = superAdmin && superAdmin.token;
  const { data, loading, error } = useApiData(() => api.get('/api/superadmin/stores', token), [token], { stores: [] });
  return <SuperAdminOnly><SuperAdminFrame activeKey="stores" title="Stores" subtitle="Review every tenant store on the platform.">{error ? <Alert type="error">{error}</Alert> : null}{loading ? <LoadingBlock label="Loading stores..." /> : <section className="card panel">{data.stores.length ? <div className="table-wrap"><table><thead><tr><th>Store</th><th>Slug</th><th>Products</th><th>Orders</th><th>Visits</th><th>Created</th></tr></thead><tbody>{data.stores.map((store) => <tr key={store.slug}><td><Link to={`/superadmin/store/${store.slug}`}>{store.name}</Link></td><td>{store.slug}</td><td>{store.productsCount}</td><td>{store.ordersCount}</td><td>{store.visits || 0}</td><td>{formatDate(store.createdAt)}</td></tr>)}</tbody></table></div> : <EmptyState title="No stores found" body="Stores will appear here once vendors register." />}</section>}</SuperAdminFrame></SuperAdminOnly>;
}

function SuperAdminUsersPage() {
  const { superAdmin } = useAuth();
  const token = superAdmin && superAdmin.token;
  const { data, loading, error } = useApiData(() => api.get('/api/superadmin/users', token), [token], { users: [] });
  return <SuperAdminOnly><SuperAdminFrame activeKey="users" title="Users" subtitle="Manage registered store owners across the platform.">{error ? <Alert type="error">{error}</Alert> : null}{loading ? <LoadingBlock label="Loading users..." /> : <section className="card panel">{data.users.length ? <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Store</th><th>Joined</th></tr></thead><tbody>{data.users.map((user) => <tr key={user.id}><td>{user.name || '-'}</td><td>{user.email}</td><td>{user.phone || '-'}</td><td>{user.storeSlug || '-'}</td><td>{formatDate(user.createdAt)}</td></tr>)}</tbody></table></div> : <EmptyState title="No users found" body="Users will appear here once they sign up." />}</section>}</SuperAdminFrame></SuperAdminOnly>;
}

function SuperAdminStoreManagePage() {
  const { slug } = useParams();
  const { superAdmin } = useAuth();
  const token = superAdmin && superAdmin.token;
  const { data, loading, error } = useApiData(() => api.get(`/api/superadmin/store/${slug}`, token), [slug, token], { store: null });
  const store = data.store;
  return <SuperAdminOnly><SuperAdminFrame activeKey="stores" title={store ? store.name : 'Store details'} subtitle="Inspect owner, products, and orders for this store.">{error ? <Alert type="error">{error}</Alert> : null}{loading ? <LoadingBlock label="Loading store details..." /> : store ? <><section className="grid-2"><div className="card panel"><h2 className="section-title">Store details</h2><div className="kpi-list"><div className="kpi-item"><strong>Slug</strong><span>{store.slug}</span></div><div className="kpi-item"><strong>Owner</strong><span>{store.owner && store.owner.email ? store.owner.email : '-'}</span></div><div className="kpi-item"><strong>WhatsApp</strong><span>{store.whatsapp || '-'}</span></div><div className="kpi-item"><strong>Visits</strong><span>{store.visits || 0}</span></div><div className="kpi-item"><strong>Created</strong><span>{formatDate(store.createdAt)}</span></div></div></div><div className="card panel"><h2 className="section-title">Description</h2><p className="section-subtitle">{store.description || 'No description set.'}</p>{store.logo ? <img className="logo-preview" src={store.logo} alt={store.name} /> : null}</div></section><section className="card panel"><h2 className="section-title">Products</h2>{store.products.length ? <div className="table-wrap"><table><thead><tr><th>Name</th><th>Price</th><th>Stock</th></tr></thead><tbody>{store.products.map((product) => <tr key={product.id}><td>{product.name}</td><td>{formatMoney(product.price)}</td><td>{product.stock || 0}</td></tr>)}</tbody></table></div> : <EmptyState title="No products" body="This store has no products yet." />}</section><section className="card panel"><h2 className="section-title">Orders</h2>{store.orders.length ? <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Amount</th></tr></thead><tbody>{store.orders.map((order) => <tr key={order.id}><td>{order.orderNumber}</td><td>{order.customerName || '-'}</td><td>{order.status}</td><td>{formatMoney(order.amount)}</td></tr>)}</tbody></table></div> : <EmptyState title="No orders" body="This store has no orders yet." />}</section></> : <EmptyState title="Store not found" body="This store could not be loaded." />}</SuperAdminFrame></SuperAdminOnly>;
}

export default function App() {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('code')) {
      return <OAuthCallbackRelay />;
    }
  }
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<VendorLoginPage />} />
      <Route path="/register" element={<VendorRegisterPage />} />
      <Route path="/dashboard" element={<DashboardOverviewPage />} />
      <Route path="/dashboard/getting-started" element={<DashboardOverviewPage />} />
      <Route path="/dashboard/analytics" element={<DashboardAnalyticsPage />} />
      <Route path="/dashboard/system-status" element={<DashboardSystemStatusPage />} />
      <Route path="/dashboard/products" element={<DashboardProductsPage />} />
      <Route path="/dashboard/products/edit/:id" element={<DashboardProductsPage />} />
      <Route path="/dashboard/orders" element={<DashboardOrdersPage />} />
      <Route path="/dashboard/orders/export" element={<DashboardOrdersExportRoute />} />
      <Route path="/dashboard/customers" element={<DashboardCustomersPage />} />
      <Route path="/dashboard/settings" element={<DashboardSettingsPage />} />
      <Route path="/dashboard/display-settings" element={<DashboardDisplaySettingsPage />} />
      <Route path="/dashboard/theme" element={<DashboardThemePage />} />
      <Route path="/dashboard/theme/preview/:id" element={<DashboardThemePreviewRoute />} />
      <Route path="/dashboard/media" element={<DashboardMediaPage />} />
      <Route path="/dashboard/collections" element={<DashboardCollectionsPage />} />
      <Route path="/dashboard/categories" element={<DashboardCategoriesPage />} />
      <Route path="/dashboard/bulk-upload" element={<DashboardBulkUploadPage />} />
      <Route path="/dashboard/leads" element={<DashboardLeadsPage />} />
      <Route path="/dashboard/coupons" element={<DashboardCouponsPage />} />
      <Route path="/dashboard/discounts" element={<DashboardCouponsPage />} />
      <Route path="/dashboard/shipping" element={<DashboardShippingPage />} />
      <Route path="/dashboard/payments" element={<DashboardPaymentsPage />} />
      <Route path="/dashboard/notifications" element={<DashboardNotificationsPage />} />
      <Route path="/dashboard/abandoned-carts" element={<DashboardAbandonedCartsPage />} />
      <Route path="/dashboard/tax" element={<DashboardTaxPage />} />
      <Route path="/dashboard/whatsapp-marketing" element={<DashboardWhatsappMarketingPage />} />
      <Route path="/dashboard/tracking" element={<DashboardTrackingPage />} />
      <Route path="/dashboard/apps" element={<DashboardAppsPage />} />
      <Route path="/dashboard/pages" element={<DashboardPagesPage />} />
      <Route path="/dashboard/domain" element={<DashboardDomainPage />} />
      <Route path="/store/:slug" element={<StorePage />} />
      <Route path="/store/:slug/page/:pageSlug" element={<StoreContentPage />} />
      <Route path="/store/:slug/product/:id" element={<ProductPage />} />
      <Route path="/store/:slug/cart" element={<CartPage />} />
      <Route path="/store/:slug/wishlist" element={<CustomerAccountPage />} />
      <Route path="/store/:slug/checkout" element={<CheckoutPage />} />
      <Route path="/store/:slug/track-order" element={<TrackOrderPage />} />
      <Route path="/store/:slug/order/:code" element={<TrackOrderPage />} />
      <Route path="/store/:slug/account/login" element={<CustomerLoginPage />} />
      <Route path="/store/:slug/account/register" element={<CustomerRegisterPage />} />
      <Route path="/store/:slug/account" element={<CustomerAccountPage />} />
      <Route path="/superadmin" element={<SuperAdminLoginPage />} />
      <Route path="/superadmin/dashboard" element={<SuperAdminDashboardPage />} />
      <Route path="/superadmin/stores" element={<SuperAdminStoresPage />} />
      <Route path="/superadmin/store/:slug" element={<SuperAdminStoreManagePage />} />
      <Route path="/superadmin/users" element={<SuperAdminUsersPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
