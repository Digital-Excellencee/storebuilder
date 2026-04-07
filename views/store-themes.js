const { escapeHtml, formatMoney, formatDate } = require('../helpers/html');
const { ensureStoreSettings } = require('../services/db');
const { getProductDisplayRating } = require('../helpers/store');
const { renderTopBar, renderCategorySection, renderBannerCarousel, renderStoreFooterBlock } = require('./store-components');

function renderStoreByTheme(template, store, slug, data) {
  const layout = template && template.layout ? template.layout : 'app';
  if (layout === 'app') return renderAppStyleStore(store, slug, data);
  if (layout === 'minimal') return renderMinimalStore(store, slug, data);
  if (layout === 'bold') return renderBoldFashionStore(store, slug, data);
  return renderAppStyleStore(store, slug, data);
}

function renderAppStyleStore(store, slug, data) {
  const {
    products,
    categories,
    cartCount,
    wishlistCount,
    wishlist,
    search,
    currentTemplate,
    customer,
    cfg,
    isDark,
    sortOptions,
    paginationHtml,
    storeBase,
    cartDetails,
    wishlistItems,
    featuredProduct
  } = data;
  const base = storeBase !== undefined ? storeBase : '/store/' + encodeURIComponent(slug);
  const labels = ensureStoreSettings(store).labelSettings;
  const catScroll = renderCategorySection(categories, slug, cfg);
  const carousel = renderBannerCarousel(cfg, slug);
  const topBar = renderTopBar(cfg);
  const productCardStyle = cfg.productCardStyle || 'style-2';
  const productsTitle = cfg.productsTitle || labels.productsHeading || 'All Products';
  const hero = carousel || renderAppFeaturedHero(store, slug, base, featuredProduct || products[0], cfg);
  const productCards = products.map((product) => renderAppProductCard(product, {
    base,
    wished: wishlist.includes(product.id),
    cfg,
    labels,
    compact: false
  })).join('');
  const flashDeals = cfg.showFlashDeals !== false && products.slice(0, 4).length ? `
    <section class="app-section">
      <div class="app-rail-head">
        <div class="section-label-row"><span class="section-flame">🔥</span><h2 class="app-section-title">Best Selling</h2></div>
        <a href="${base || '/'}?sort=newest">View All</a>
      </div>
      <div class="app-horizontal-cards">${products.slice(0, 4).map((product) => renderAppProductCard(product, {
        base,
        wished: wishlist.includes(product.id),
        cfg,
        labels,
        compact: true
      })).join('')}</div>
    </section>` : '';
  const content = `
    ${catScroll}
    ${hero}
    ${flashDeals}
    <section class="app-section">
      <div class="app-rail-head">
        <div class="section-label-row"><span class="section-flame">⭐</span><h2 class="app-section-title">${escapeHtml(productsTitle || 'Popular Products')}</h2></div>
        <a href="${base || '/'}?sort=newest">View All</a>
      </div>
      ${sortOptions || ''}
      <div class="app-grid ${productCardStyle === 'style-4' ? 'list-layout' : ''}">${productCards || '<div class="store-empty">No products yet.</div>'}</div>
      ${paginationHtml || ''}
      <div class="view-all-wrap"><a class="view-all-btn" href="${base || '/'}?sort=newest">View All Products →</a></div>
    </section>
    ${renderAppSupportSections(store, cfg)}
    ${renderAppThemeFooter(store, base, cfg)}`;
  return renderAppThemeScaffold(store, slug, {
    base,
    cfg,
    customer,
    cartCount,
    wishlistCount,
    cartDetails,
    wishlistItems,
    categories,
    labels,
    search,
    activeNav: 'home',
    content,
    floatingWhatsapp: true
  });
}

function renderAppSupportSections(store, cfg) {
  if (cfg.showTrustSection === false) return '';
  return `
    <section class="trust-grid">
      <div class="trust-card"><div class="trust-icon">🚚</div><strong>Free Shipping</strong><span>Free shipping on selected orders</span></div>
      <div class="trust-card"><div class="trust-icon">↩️</div><strong>Easy Returns</strong><span>Simple return policy support</span></div>
      <div class="trust-card"><div class="trust-icon">💬</div><strong>Online Support</strong><span>Fast support on chat and WhatsApp</span></div>
      <div class="trust-card"><div class="trust-icon">🔒</div><strong>Secure Payment</strong><span>Protected checkout and trusted gateways</span></div>
    </section>
    <section class="insta-section">
      <div class="insta-head"><div class="insta-icon">📷</div><div><strong>Follow Us on Instagram</strong><div style="font-size:12px;color:#64748b;">${escapeHtml(String(cfg.instagramHandle || `@${store.slug || 'store'}`))}</div></div></div>
      <div class="insta-grid">
        <div class="insta-ph">📸</div><div class="insta-ph">📸</div><div class="insta-ph">📸</div><div class="insta-ph">📸</div><div class="insta-ph">📸</div><div class="insta-ph">📸</div>
      </div>
      <a class="insta-btn" href="${store.whatsapp ? `https://wa.me/${encodeURIComponent(store.whatsapp)}` : '#'}"${store.whatsapp ? ' target="_blank" rel="noopener"' : ''}>Connect With Us</a>
    </section>`;
}

function renderAppThemeFooter(store, base, cfg) {
  if (cfg.showFooter === false) return '';
  return `
    <footer class="store-footer app-theme-footer">
      <div class="footer-brand-row">
        <div class="footer-logo-ph">${escapeHtml(store.name.charAt(0).toUpperCase())}</div>
        <span class="footer-brand-name">${escapeHtml(store.name)}</span>
      </div>
      <p class="footer-desc">${escapeHtml(store.description || 'Premium products with smooth shopping experience.')}</p>
      <div class="footer-cols">
        <div class="footer-col">
          <h4>Quick Links</h4>
          <ul>
            <li><a href="${base || '/'}">Home</a></li>
            <li><a href="${base || '/'}?category=all">Shop All</a></li>
            <li><a href="${base}/track-order">Track Order</a></li>
            <li><a href="${base}/account">My Account</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Support</h4>
          <ul>
            <li><a href="${store.whatsapp ? `https://wa.me/${encodeURIComponent(store.whatsapp)}` : '#'}"${store.whatsapp ? ' target="_blank" rel="noopener"' : ''}>WhatsApp</a></li>
            <li><a href="${base}/cart">Cart</a></li>
            <li><a href="${base}/wishlist">Wishlist</a></li>
            <li><a href="${base}/checkout?mode=cart">Checkout</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom"><span>© ${new Date().getFullYear()} ${escapeHtml(store.name)}. All rights reserved.</span><span>Powered by MyShopBuilder</span></div>
    </footer>`;
}

function renderAppProductPage(store, slug, data) {
  const {
    product,
    related,
    wishlist,
    customer,
    cfg,
    currentTemplate,
    cartCount,
    wishlistCount,
    cartDetails,
    wishlistItems,
    storeBase
  } = data;
  const base = storeBase !== undefined ? storeBase : '/store/' + encodeURIComponent(slug);
  const ss = ensureStoreSettings(store);
  const inWishlist = wishlist.includes(product.id);
  const compareAt = Number(product.comparePrice || product.mrp || 0) > Number(product.price || 0) ? Number(product.comparePrice || product.mrp || 0) : 0;
  const savings = compareAt ? Math.max(0, compareAt - Number(product.price || 0)) : 0;
  const discount = compareAt ? Math.max(0, Math.round((1 - Number(product.price || 0) / compareAt) * 100)) : 0;
  const rating = getProductDisplayRating(product);
  const stock = Math.max(0, Number(product.stock || 0));
  const gallery = Array.isArray(product.images) && product.images.length ? product.images : [product.image].filter(Boolean);
  const reviews = Array.isArray(product.reviews) ? product.reviews.slice().reverse() : [];
  const variantSelectors = Array.isArray(product.variants) && product.variants.length ? product.variants.map((variant) => `<div class="app-variant-group"><label class="app-variant-label">${escapeHtml(variant.name)}</label><div class="app-variant-options">${variant.options.map((option, index) => `<label class="app-variant-option"><input type="radio" name="variant_${escapeHtml(variant.id)}" value="${escapeHtml(option.label)}" ${index === 0 ? 'checked' : ''}><span class="variant-chip" data-stock="${escapeHtml(String(option.stock || 0))}" data-price="${escapeHtml(String(option.price || 0))}">${escapeHtml(option.label)}</span></label>`).join('')}</div></div>`).join('') : '';
  const accordions = [
    {
      title: 'Product Description',
      body: product.description || 'Product details will be updated soon.'
    },
    {
      title: 'Shipping Information',
      body: [ss.deliverySettings.nextDayTitle, ss.deliverySettings.nextDaySubtitle, ss.deliverySettings.normalTitle, ss.deliverySettings.normalSubtitle].filter(Boolean).join(' · ') || 'Fast dispatch, secure packaging, and reliable delivery across supported areas.'
    },
    {
      title: 'Returns & Exchange',
      body: ss.returnOrderSettings.instructions || 'Easy return support available as per store policy.'
    }
  ];
  const badges = [
    'Guaranteed safe checkout',
    ss.paymentSettings.cod !== false ? 'Cash on delivery available' : 'Prepaid checkout enabled',
    stock > 0 ? `${stock} pieces left in stock` : 'Currently out of stock'
  ];
  const serviceChips = [
    { title: 'Free shipping', text: 'On selected orders' },
    { title: 'Easy return', text: 'Policy based support' },
    { title: 'Download invoice', text: 'After order placement' }
  ];
  const relatedHtml = related.length ? related.map((item) => renderAppProductCard(item, {
    base,
    wished: wishlist.includes(item.id),
    cfg,
    labels: ss.labelSettings,
    compact: true
  })).join('') : '<div class="store-empty">No related products yet.</div>';
  const content = `
    <section class="app-product-page">
      <div class="app-product-gallery">
        <div class="app-product-media">
          ${discount ? `<span class="app-product-badge">-${escapeHtml(String(discount))}%</span>` : ''}
          ${product.image ? `<img id="appMainProductImg" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : '<div class="app-product-placeholder">No image</div>'}
          <button class="app-circle-ghost app-share-btn" type="button" onclick="if(navigator.share){navigator.share({title:document.title,url:location.href}).catch(function(){})}else{navigator.clipboard&&navigator.clipboard.writeText(location.href)}">↗</button>
        </div>
        ${gallery.length > 1 ? `<div class="app-product-thumbs">${gallery.map((image) => `<button type="button" class="app-thumb-btn" data-product-thumb="${escapeHtml(image)}"><img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}"></button>`).join('')}</div>` : ''}
      </div>
      <div class="app-product-copy">
        <div class="app-product-meta-row">
          <span class="app-rating-pill">★ ${escapeHtml(String(rating))}</span>
          ${product.sku ? `<span class="app-rating-pill">SKU ${escapeHtml(product.sku)}</span>` : ''}
          ${stock ? `<span class="app-rating-pill success">${escapeHtml(String(stock))} left</span>` : '<span class="app-rating-pill danger">Sold out</span>'}
        </div>
        <h1 class="app-product-title">${escapeHtml(product.name)}</h1>
        <div class="app-product-price-row">
          <div>
            <div class="app-product-price">${escapeHtml(formatMoney(product.price))}</div>
            ${compareAt ? `<div class="app-product-compare">${escapeHtml(formatMoney(compareAt))}</div>` : ''}
          </div>
          ${savings ? `<div class="app-save-pill">Save ${escapeHtml(formatMoney(savings))}</div>` : ''}
        </div>
        ${cfg.showProductDescription !== false ? `<p class="app-product-subcopy">${escapeHtml(product.description || 'Designed for mobile-first shopping, fast checkout, and high-conversion browsing.')}</p>` : ''}
        <div class="app-badge-stack">${badges.map((badge) => `<span class="app-inline-badge">${escapeHtml(badge)}</span>`).join('')}</div>
        ${variantSelectors}
        <div class="app-qty-card">
          <div>
            <strong>Quantity</strong>
            <span>Adjust before checkout</span>
          </div>
          <div class="app-qty-stepper" data-qty-root>
            <button type="button" data-qty-btn="minus">-</button>
            <input type="number" value="1" min="1" max="${escapeHtml(String(Math.max(1, stock || 1)))}" data-qty-input>
            <button type="button" data-qty-btn="plus">+</button>
          </div>
        </div>
        <div class="app-product-actions">
          <form method="POST" action="${base}/cart/add/${encodeURIComponent(product.id)}" class="app-grow-form">
            <input type="hidden" name="quantity" value="1" data-linked-qty>
            <div data-linked-variants></div>
            <button class="primary-btn app-cta-btn" type="submit" ${stock <= 0 ? 'disabled' : ''}>Add to Cart</button>
          </form>
          <a class="btn btn-secondary app-cta-btn" href="${base}/buy/${encodeURIComponent(product.id)}?quantity=1" data-buy-now-link>Buy Now</a>
          <form method="POST" action="${base}/wishlist/toggle/${encodeURIComponent(product.id)}">
            <button class="app-circle-ghost ${inWishlist ? 'wishlist-active' : ''}" type="submit">${inWishlist ? '♥' : '♡'}</button>
          </form>
        </div>
        <div class="app-checkout-strip">
          <strong>Guaranteed safe checkout</strong>
          <div class="app-payment-mini">Visa · Mastercard · UPI · COD</div>
        </div>
      <div class="app-service-grid">${serviceChips.map((chip) => `<div class="app-service-chip"><strong>${escapeHtml(chip.title)}</strong><span>${escapeHtml(chip.text)}</span></div>`).join('')}</div>
      <div class="app-accordion-list">${accordions.map((item, index) => `<details class="app-accordion"${index === 0 ? ' open' : ''}><summary>${escapeHtml(item.title)}</summary><div>${escapeHtml(item.body)}</div></details>`).join('')}</div>
    </div>
    </section>
    <section class="app-section">
      <div class="app-rail-head"><div><span class="app-eyebrow">Customer feedback</span><h2 class="app-section-title">Reviews (${escapeHtml(String(reviews.length))})</h2></div></div>
      <div class="app-review-shell">${reviews.length ? reviews.map((review) => `<article class="app-review-card"><div class="app-review-head"><strong>${escapeHtml(review.customerName)}</strong><span>${escapeHtml('★'.repeat(Math.max(1, Math.min(5, Number(review.rating || 5)))))}</span></div><p>${escapeHtml(review.comment)}</p><small>${escapeHtml(formatDate(review.createdAt || ''))}</small></article>`).join('') : '<div class="store-empty">No reviews yet. Be the first one.</div>'}</div>
      <form method="POST" action="${base}/product/${encodeURIComponent(product.id)}/review" class="app-review-form">
        <input name="reviewName" placeholder="Your name" required>
        <select name="rating"><option value="5">★★★★★ (5 - Excellent)</option><option value="4">★★★★☆ (4 - Good)</option><option value="3">★★★☆☆ (3 - Average)</option><option value="2">★★☆☆☆ (2 - Poor)</option><option value="1">★☆☆☆☆ (1 - Terrible)</option></select>
        <textarea name="comment" placeholder="Share your experience..." required></textarea>
        <button class="btn" type="submit">Submit Review</button>
      </form>
    </section>
    <section class="app-section">
      <div class="app-rail-head">
        <div><span class="app-eyebrow">Complete the look</span><h2 class="app-section-title">You may also like</h2></div>
      </div>
      <div class="app-horizontal-cards app-related-grid">${relatedHtml}</div>
    </section>
    <div class="app-sticky-buybar">
      <div>
        <small>Starting from</small>
        <strong>${escapeHtml(formatMoney(product.price))}</strong>
      </div>
      <form method="POST" action="${base}/cart/add/${encodeURIComponent(product.id)}">
        <input type="hidden" name="quantity" value="1" data-linked-qty>
        <div data-linked-variants></div>
        <button class="primary-btn" type="submit" ${stock <= 0 ? 'disabled' : ''}>Add to Cart</button>
      </form>
      <a class="btn btn-secondary" href="${base}/buy/${encodeURIComponent(product.id)}?quantity=1" data-buy-now-link>Buy Now</a>
    </div>`;
  return renderAppThemeScaffold(store, slug, {
    base,
    cfg,
    customer,
    cartCount,
    wishlistCount,
    cartDetails,
    wishlistItems,
    categories: [],
    labels: ss.labelSettings,
    search: '',
    activeNav: 'shop',
    content,
    floatingWhatsapp: cfg.showWhatsappButton !== false,
    showSearch: false
  });
}

function renderAppFeaturedHero(store, slug, base, product, cfg) {
  if (!product) {
    return `<section class="app-section"><div class="app-empty-hero"><span class="app-eyebrow">New storefront</span><h2>Start adding products to shape this theme.</h2><p>Once products or banners are added, this hero turns into a premium landing section.</p></div></section>`;
  }
  return `
    <section class="app-feature-hero">
      <div class="app-feature-media">${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : '<div class="app-product-placeholder">No image</div>'}</div>
      <div class="app-feature-overlay">
        <span class="app-eyebrow">Featured drop</span>
        <h1>${escapeHtml(product.name)}</h1>
        <p>${escapeHtml(product.description || 'Designed to convert better on mobile with strong imagery and direct purchase actions.')}</p>
        <div class="app-feature-actions">
          <a class="btn" href="${base}/product/${encodeURIComponent(product.id)}">Shop now</a>
          <form method="POST" action="${base}/cart/add/${encodeURIComponent(product.id)}"><button class="btn btn-secondary" type="submit">Quick add</button></form>
        </div>
      </div>
    </section>`;
}

function renderAppThemeScaffold(store, slug, options) {
  const {
    base,
    cfg,
    customer,
    cartCount,
    wishlistCount,
    cartDetails = [],
    wishlistItems = [],
    categories = [],
    labels,
    search,
    activeNav,
    content,
    floatingWhatsapp,
    showSearch = true
  } = options;
  const topBar = renderTopBar(cfg);
  const logoBlock = store.logo ? `<img class="app-logo" src="${escapeHtml(store.logo)}" alt="${escapeHtml(store.name)}">` : `<div class="app-logo-ph">${escapeHtml(store.name.charAt(0).toUpperCase())}</div>`;
  const cartTotal = cartDetails.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const menuLinks = [
    { href: base || '/', label: cfg.menuHomeLabel || 'Home' },
    { href: `${base || '/'}?category=all`, label: cfg.menuShopLabel || 'Shop' },
    { href: `${base}/track-order`, label: cfg.menuTrackLabel || 'Track Order' },
    { href: customer ? `${base}/account/orders` : `${base}/account/login`, label: 'Orders' },
    { href: `${base}/checkout?mode=cart`, label: 'Checkout' }
  ];
  const menuPanel = `
    <aside class="app-side-panel app-side-panel-left" data-panel="menu">
      <div class="app-panel-head"><strong>Menu</strong><button type="button" class="app-panel-close" data-panel-close>×</button></div>
      <div class="app-panel-scroll">
        <div class="app-panel-brand">${logoBlock}<div><strong>${escapeHtml(store.name)}</strong><span>${escapeHtml(store.description || 'Mobile-optimised storefront')}</span></div></div>
        <nav class="app-panel-nav">${menuLinks.map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join('')}</nav>
        ${categories.length ? `<div class="app-panel-section"><span class="app-panel-label">Shop by category</span><div class="app-panel-tags">${categories.slice(0, 12).map((category) => `<a href="${base}?category=${encodeURIComponent(category.name)}">${escapeHtml(category.name)}</a>`).join('')}</div></div>` : ''}
      </div>
    </aside>`;
  const cartPanel = `
    <aside class="app-side-panel app-side-panel-right" data-panel="cart">
      <div class="app-panel-head"><strong>Cart (${escapeHtml(String(cartCount))})</strong><button type="button" class="app-panel-close" data-panel-close>×</button></div>
      <div class="app-panel-scroll">
        ${cartDetails.length ? cartDetails.map((item) => `<div class="app-mini-line"><div>${item.product.image ? `<img src="${escapeHtml(item.product.image)}" alt="${escapeHtml(item.product.name)}">` : '<div class="app-mini-thumb"></div>'}</div><div><strong>${escapeHtml(item.product.name)}</strong><span>${escapeHtml(String(item.quantity))} x ${escapeHtml(formatMoney(item.price != null ? item.price : item.product.price))}</span>${item.variantSummary ? `<span>${escapeHtml(item.variantSummary)}</span>` : ''}</div><div><strong>${escapeHtml(formatMoney(item.subtotal))}</strong></div></div>`).join('') : '<div class="app-panel-empty"><div class="app-panel-empty-icon">🛒</div><h3>Your cart is empty</h3><p>Add products to get started.</p><a class="btn btn-secondary" href="' + (base || '/') + '">Continue Shopping</a></div>'}
      </div>
      ${cartDetails.length ? `<div class="app-panel-foot"><div class="app-panel-total"><span>Total</span><strong>${escapeHtml(formatMoney(cartTotal))}</strong></div><div class="app-panel-actions"><a class="btn btn-secondary" href="${base}/cart">View Cart</a><a class="btn" href="${base}/checkout?mode=cart">Checkout</a></div></div>` : ''}
    </aside>`;
  const wishlistPanel = `
    <aside class="app-side-panel app-side-panel-right" data-panel="wishlist">
      <div class="app-panel-head"><strong>Wishlist (${escapeHtml(String(wishlistCount))})</strong><button type="button" class="app-panel-close" data-panel-close>×</button></div>
      <div class="app-panel-scroll">
        ${wishlistItems.length ? wishlistItems.slice(0, 8).map((item) => `<a class="app-mini-card" href="${base}/product/${encodeURIComponent(item.id)}">${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">` : '<div class="app-mini-thumb"></div>'}<div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(formatMoney(item.price))}</span></div></a>`).join('') : '<div class="app-panel-empty"><div class="app-panel-empty-icon">♡</div><h3>No saved items yet</h3><p>Tap the heart on products you want to revisit.</p></div>'}
      </div>
      <div class="app-panel-foot"><a class="btn btn-secondary" href="${base}/wishlist">Open Wishlist</a></div>
    </aside>`;
  const accountPanel = `
    <aside class="app-side-panel app-side-panel-right" data-panel="account">
      <div class="app-panel-head"><strong>${customer ? 'My Account' : 'Account'}</strong><button type="button" class="app-panel-close" data-panel-close>×</button></div>
      <div class="app-panel-scroll">
        ${customer ? `<div class="app-account-card"><strong>${escapeHtml(customer.name)}</strong><span>${escapeHtml(customer.email)}</span></div><div class="app-panel-nav"><a href="${base}/account">Profile</a><a href="${base}/account/orders">Orders</a><a href="${base}/account/wishlist">Saved Wishlist</a><a href="${base}/account/logout">Logout</a></div>` : `<div class="app-panel-empty"><div class="app-panel-empty-icon">👤</div><h3>Login for faster checkout</h3><p>Save orders, addresses, and wishlist across visits.</p><div class="app-panel-actions"><a class="btn" href="${base}/account/login">Login</a><a class="btn btn-secondary" href="${base}/account/register">Create Account</a></div></div>`}
      </div>
    </aside>`;
  const headerHtml = `
    <header class="app-header app-header-premium">
      <button class="app-icon-btn ghost" type="button" data-panel-open="menu">☰</button>
      <a class="app-brand-lockup" href="${base || '/'}">${logoBlock}<span>${escapeHtml(store.name)}</span></a>
      <div class="app-actions">
        <button class="app-icon-btn" type="button" data-panel-open="account">👤</button>
        <button class="app-icon-btn" type="button" data-panel-open="cart">🛒${cartCount ? `<span class="app-badge">${cartCount}</span>` : ''}</button>
      </div>
    </header>`;
  const searchBar = showSearch ? `
    <section class="app-section app-search-section">
      <div class="app-search-shell">
        <form method="GET" action="${base || '/'}" class="app-search-form">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.35-4.35"></path></svg>
          <input name="search" value="${escapeHtml(search || '')}" placeholder="${escapeHtml((labels && labels.searchBoxText) || 'Search products...')}">
        </form>
        <button class="app-filter-btn" type="button" data-panel-open="menu">☷</button>
      </div>
    </section>` : '';
  const waLink = floatingWhatsapp && store.whatsapp ? `<a class="app-float-wa" href="https://wa.me/${encodeURIComponent(store.whatsapp)}" target="_blank" rel="noopener">💬</a>` : '';
  const bottomNav = `
    <nav class="app-bottom-nav nav-modern">
      <a href="${base || '/'}" class="${activeNav === 'home' ? 'active' : ''}"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg><span>Home</span></a>
      <a href="${base || '/'}?category=all" class="${activeNav === 'shop' ? 'active' : ''}"><svg viewBox="0 0 24 24"><path d="M6 2l3 7h10l3-7"></path><path d="M3 10h18l-2 10H5L3 10z"></path></svg><span>Shop</span></a>
      <button type="button" class="${activeNav === 'categories' ? 'active' : ''}" data-panel-open="menu"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg><span>Categories</span></button>
      <button type="button" class="${activeNav === 'wishlist' ? 'active' : ''}" data-panel-open="wishlist"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg><span>Wishlist</span></button>
      <button type="button" class="${activeNav === 'account' ? 'active' : ''}" data-panel-open="account"><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg><span>My Account</span></button>
    </nav>`;
  return `<div class="app-shell app-shell-premium">
    <div class="app-page-overlay" data-panel-overlay></div>
    ${menuPanel}
    ${cartPanel}
    ${wishlistPanel}
    ${accountPanel}
    ${topBar}
    ${headerHtml}
    ${searchBar}
    ${content}
    ${waLink}
    ${bottomNav}
    <script>
    (function(){
      var root=document.querySelector('.app-shell-premium');
      if(!root)return;
      var overlay=root.querySelector('[data-panel-overlay]');
      function closePanels(){root.querySelectorAll('.app-side-panel').forEach(function(panel){panel.classList.remove('is-open');});root.classList.remove('panel-open');}
      function openPanel(name){closePanels();var panel=root.querySelector('[data-panel="'+name+'"]');if(panel){panel.classList.add('is-open');root.classList.add('panel-open');}}
      root.querySelectorAll('[data-panel-open]').forEach(function(btn){btn.addEventListener('click',function(){openPanel(btn.getAttribute('data-panel-open'));});});
      root.querySelectorAll('[data-panel-close]').forEach(function(btn){btn.addEventListener('click',closePanels);});
      if(overlay)overlay.addEventListener('click',closePanels);
      document.addEventListener('keydown',function(e){if(e.key==='Escape')closePanels();});
      root.querySelectorAll('[data-qty-root]').forEach(function(group){
        var input=group.querySelector('[data-qty-input]');
        var linked=root.querySelectorAll('[data-linked-qty]');
        var buy=root.querySelectorAll('[data-buy-now-link]');
        var linkedVariantRoots=root.querySelectorAll('[data-linked-variants]');
        var variantInputs=root.querySelectorAll('input[name^="variant_"]');
        function syncVariants(){
          linkedVariantRoots.forEach(function(host){
            host.innerHTML='';
            variantInputs.forEach(function(input){
              if(!input.checked)return;
              var hidden=document.createElement('input');
              hidden.type='hidden';
              hidden.name=input.name;
              hidden.value=input.value;
              host.appendChild(hidden);
            });
          });
        }
        function sync(){
          var min=parseInt(input.min||'1',10); var max=parseInt(input.max||'999',10); var value=parseInt(input.value||min,10);
          if(isNaN(value)) value=min; if(value<min) value=min; if(value>max) value=max; input.value=value;
          linked.forEach(function(field){field.value=String(value);});
          syncVariants();
          buy.forEach(function(link){
            try {
              var url=new URL(link.getAttribute('href'), window.location.origin);
              url.searchParams.set('quantity', String(value));
              variantInputs.forEach(function(input){
                if(input.checked) url.searchParams.set(input.name, input.value); else url.searchParams.delete(input.name);
              });
              link.setAttribute('href', url.pathname + url.search);
            } catch (err) {}
          });
        }
        sync();
        group.querySelectorAll('[data-qty-btn]').forEach(function(btn){btn.addEventListener('click',function(){input.value=String((parseInt(input.value||'1',10)||1)+(btn.getAttribute('data-qty-btn')==='plus'?1:-1));sync();});});
        input.addEventListener('input', sync);
        variantInputs.forEach(function(input){input.addEventListener('change', sync);});
      });
      root.querySelectorAll('[data-product-thumb]').forEach(function(btn){btn.addEventListener('click',function(){var main=root.querySelector('#appMainProductImg');if(main){main.src=btn.getAttribute('data-product-thumb');}});});
    })();
    </script>
  </div>`;
}

function renderAppProductCard(product, options) {
  const { base, wished, cfg, labels, compact } = options;
  const compareAt = Number(product.comparePrice || product.mrp || 0) > Number(product.price || 0) ? Number(product.comparePrice || product.mrp || 0) : 0;
  const discount = compareAt ? Math.max(0, Math.round((1 - Number(product.price || 0) / compareAt) * 100)) : 0;
  const stock = Math.max(0, Number(product.stock || 0));
  return `<article class="app-card product-style-${escapeHtml(cfg.productCardStyle || 'style-2')} ${compact ? 'compact' : ''}">
    <div class="app-card-figure">
      ${discount ? `<div class="app-sale-badge">-${escapeHtml(String(discount))}%</div>` : ''}
      <form method="POST" action="${base}/wishlist/toggle/${encodeURIComponent(product.id)}"><button class="app-theme-heart ${wished ? 'wishlist-active' : ''}" type="submit">${wished ? '♥' : '♡'}</button></form>
      <a href="${base}/product/${encodeURIComponent(product.id)}">${product.image ? `<img class="app-card-img" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : `<div class="app-card-img app-card-empty">No image</div>`}</a>
    </div>
    <div class="app-card-body">
      <h3>${escapeHtml(product.name)}</h3>
      <div class="app-card-price">
        <span class="price">${escapeHtml(formatMoney(product.price))}</span>
        ${compareAt ? `<span class="old-price">${escapeHtml(formatMoney(compareAt))}</span>` : ''}
        ${discount ? `<span class="app-off-pill">${escapeHtml(String(discount))}% OFF</span>` : ''}
      </div>
      ${cfg.showProductStock !== false ? `<div class="app-card-price"><span class="stock">● ${stock ? `${escapeHtml(String(stock))} left` : 'Sold out'}</span><span class="app-card-rating">★ ${escapeHtml(String(getProductDisplayRating(product)))}</span></div>` : ''}
    </div>
    <div class="app-card-actions">
      <form method="POST" action="${base}/cart/add/${encodeURIComponent(product.id)}"><button class="primary-btn app-theme-one-btn" type="submit">${escapeHtml((labels && labels.addProductButton) || '+ Add to Cart')}</button></form>
    </div>
  </article>`;
}

function renderMinimalStore(store, slug, data) {
  const { products, categories, cartCount, wishlist, search, selectedCategory, currentTemplate, customer, cfg, storeBase } = data;
  const base = storeBase !== undefined ? storeBase : '/store/' + encodeURIComponent(slug);
  const primary = cfg.primaryColor || currentTemplate.colors.primary;
  const labels = ensureStoreSettings(store).labelSettings;
  const carousel = renderBannerCarousel(cfg, slug);
  const topBar = renderTopBar(cfg);
  const productsTitle = cfg.productsTitle || 'All Products';
  const catPills = cfg.showCategories !== false && categories.length ? `<div class="store-nav">${categories.map((cat) => {
    const img = cat.image ? `<img src="${escapeHtml(cat.image)}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;margin-right:6px;vertical-align:middle;">` : '';
    return `<a href="${base || '/'}?category=${encodeURIComponent(cat.name)}" class="${selectedCategory === cat.name ? 'active' : ''}">${img}${escapeHtml(cat.name)}</a>`;
  }).join('')}</div>` : '';
  const searchHtml = cfg.showSearch !== false ? `<form method="GET" action="${base || '/'}" class="store-nav" style="justify-content:center;"><input name="search" value="${escapeHtml(search)}" placeholder="${escapeHtml(labels.searchBoxText || 'Search products...')}" style="padding:10px 14px;border-radius:999px;border:1px solid #e2e8f0;width:min(400px,100%);font-size:14px;outline:none;"><button class="btn" type="submit" style="padding:10px 20px;border-radius:999px;">Search</button></form>` : '';
  const productCards = products.map((p) => {
    const wished = wishlist.includes(p.id);
    const description = cfg.showProductDescription !== false ? `<p>${escapeHtml(p.description)}</p>` : '';
    const stock = cfg.showProductStock !== false ? `<span class="stock-tag">${escapeHtml(p.stock || '0')} in stock</span>` : '';
    const rating = cfg.showRating !== false ? `<div style="margin-bottom:8px;color:${escapeHtml(primary)};font-size:12px;font-weight:800;">★ ${escapeHtml(getProductDisplayRating(p))}</div>` : '';
    return `<div class="store-card"><a href="${base}/product/${encodeURIComponent(p.id)}" style="text-decoration:none;color:inherit;">${p.image ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}">` : `<div style="width:100%;aspect-ratio:1/1;background:#f8fafc;display:grid;place-items:center;color:#94a3b8;font-size:13px;">No image</div>`}</a><div class="store-card-body"><h3>${escapeHtml(p.name)}</h3>${rating}${description}<div class="price-row"><span class="price-tag">${escapeHtml(formatMoney(p.price))}</span>${stock}</div></div><div class="store-card-actions"><form method="POST" action="${base}/cart/add/${encodeURIComponent(p.id)}"><button type="submit">${escapeHtml(labels.addProductButton || '+ Add')}</button></form><form method="POST" action="${base}/wishlist/toggle/${encodeURIComponent(p.id)}"><button class="btn-outline ${wished ? 'wishlist-active' : ''}" type="submit" style="padding:10px;border-radius:14px;font-size:13px;font-weight:700;cursor:pointer;">${wished ? '♥' : '♡'}</button></form></div></div>`;
  }).join('');
  return `${topBar}${carousel}<div class="store-header">${store.logo ? `<img class="store-logo" src="${escapeHtml(store.logo)}" alt="${escapeHtml(store.name)}">` : `<div class="store-logo-ph">${escapeHtml(store.name.charAt(0).toUpperCase())}</div>`}<h1 class="store-title">${escapeHtml(store.name)}</h1><p class="store-desc">${escapeHtml(store.description)}</p><div class="store-meta"><span class="store-badge">Products ${escapeHtml(String(products.length))}</span><span class="store-badge">Visits ${escapeHtml(String(store.visits))}</span></div><div class="store-hero-actions"><span class="store-pill">Cart ${escapeHtml(String(cartCount))}</span><a class="btn btn-secondary" href="${base}/cart">Cart</a><a class="btn btn-secondary" href="${base}/wishlist">Wishlist</a><a class="btn btn-secondary" href="${base}/track-order">Track</a>${customer ? `<a class="btn btn-secondary" href="${base}/account">Account</a>` : `<a class="btn btn-secondary" href="${base}/account/login">Login</a>`}</div></div>${searchHtml}${catPills}<div class="app-section-head" style="padding:0 0 14px;"><h2 class="app-section-title">${escapeHtml(productsTitle)}</h2></div><div class="store-grid">${productCards || '<div class="store-empty">No products yet.</div>'}</div>${renderStoreFooterBlock(store, cfg)}`;
}

function renderBoldFashionStore(store, slug, data) {
  const { products, categories, cartCount, wishlistCount, wishlist, currentTemplate, customer, cfg, storeBase } = data;
  const base = storeBase !== undefined ? storeBase : '/store/' + encodeURIComponent(slug);
  const primary = cfg.primaryColor || currentTemplate.colors.primary;
  const carousel = renderBannerCarousel(cfg, slug);
  const topBar = renderTopBar(cfg);
  const productsTitle = cfg.productsTitle || 'New Arrivals';
  const nav = `<nav class="bold-nav"><div><strong style="font-size:18px;font-weight:900;letter-spacing:-.02em;">${escapeHtml(store.name)}</strong></div><div class="bold-nav-links"><a href="${base}/cart">Cart (${escapeHtml(String(cartCount))})</a><a href="${base}/wishlist">Wishlist</a><a href="${base}/track-order">Track</a>${customer ? `<a href="${base}/account">Account</a>` : `<a href="${base}/account/login">Login</a>`}</div></nav>`;
  const catPills = cfg.showCategories !== false && categories.length ? `<div class="store-nav">${categories.map((cat) => {
    const img = cat.image ? `<img src="${escapeHtml(cat.image)}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;margin-right:4px;vertical-align:middle;">` : '';
    return `<a href="${base || '/'}?category=${encodeURIComponent(cat.name)}">${img}${escapeHtml(cat.name)}</a>`;
  }).join('')}</div>` : '';
  const productCards = products.map((p) => {
    const wished = wishlist.includes(p.id);
    const rating = cfg.showRating !== false ? `<div style="margin-top:8px;color:${escapeHtml(primary)};font-size:12px;font-weight:800;">★ ${escapeHtml(getProductDisplayRating(p))}</div>` : '';
    return `<div class="bold-card">${p.image ? `<a href="${base}/product/${encodeURIComponent(p.id)}"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}"></a>` : `<div style="width:100%;aspect-ratio:3/4;background:#f0f0f0;display:grid;place-items:center;color:#999;font-size:14px;">No image</div>`}<div class="bold-card-body"><h3>${escapeHtml(p.name)}</h3><div><span class="price">${escapeHtml(formatMoney(p.price))}</span></div>${rating}</div><div class="bold-card-actions"><form method="POST" action="${base}/cart/add/${encodeURIComponent(p.id)}"><button class="primary-btn" type="submit">Add to Cart</button></form><form method="POST" action="${base}/wishlist/toggle/${encodeURIComponent(p.id)}"><button type="submit">${wished ? '♥ Saved' : '♡ Save'}</button></form></div></div>`;
  }).join('');
  const productsSection = `<div class="bold-section"><h2 class="bold-section-title">${escapeHtml(productsTitle)}</h2><p class="bold-section-sub">Discover our latest collection</p><div class="bold-grid">${productCards || '<div class="store-empty">No products yet.</div>'}</div></div>`;
  const footer = cfg.showFooter === false ? '' : `<footer class="bold-footer"><p>${escapeHtml((cfg.footerText || '').trim() || store.name)}${cfg.showPoweredBy !== false ? ' · Powered by MyShopBuilder' : ''}</p></footer>`;
  return `${topBar}${nav}${carousel}${catPills}${productsSection}${footer}`;
}

module.exports = {
  renderStoreByTheme,
  renderAppThemeScaffold,
  renderAppProductPage,
  renderAppStyleStore,
  renderMinimalStore,
  renderBoldFashionStore
};
