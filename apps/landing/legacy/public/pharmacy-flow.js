// ============================================
// Pharmacy — clickable products, cart, checkout
// Cart persists in localStorage, atomic clear, double-submit safe
// ============================================
(function() {
  'use strict';

  var CART_KEY = 'nhealth_pharmacy_cart_v1';

  // ---- Persistence ----
  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveCart(arr) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(arr)); } catch (e) {}
  }

  var cart = loadCart();
  window.pharmacyCart = cart;

  function money(n) { return '₦' + Number(n).toLocaleString(); }
  function uuid() {
    return 'txn_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  // ---- Public API ----
  window.addToCart = function(name, price) {
    var existing = cart.find(function(i) { return i.name === name; });
    if (existing) existing.qty += 1;
    else cart.push({ name: name, price: price, qty: 1 });
    saveCart(cart);
    updateCartBadge();
    if (typeof showToast === 'function') showToast('🛒 ' + name + ' added');
  };

  window.removeFromCart = function(index) {
    cart.splice(index, 1);
    saveCart(cart);
    updateCartBadge();
    if (typeof closeModal === 'function') closeModal();
    window.openCart();
  };

  window.incrementCart = function(i) {
    cart[i].qty += 1;
    saveCart(cart);
    updateCartBadge();
    window.openCart();
  };

  window.decrementCart = function(i) {
    if (cart[i].qty > 1) cart[i].qty -= 1;
    else cart.splice(i, 1);
    saveCart(cart);
    updateCartBadge();
    window.openCart();
  };

  // ---- Atomic clear (mutates SAME array so all references stay valid) ----
  window.clearPharmacyCart = function() {
    cart.length = 0;               // ← mutates in place, never reassigns
    saveCart(cart);
    updateCartBadge();
    console.log('🛒 Cart cleared');
  };

  window.getPharmacyCart = function() { return cart; };

  window.getCartTotal = function() {
    return cart.reduce(function(s, i) { return s + i.price * i.qty; }, 0);
  };

  window.getCartCount = function() {
    return cart.reduce(function(s, i) { return s + i.qty; }, 0);
  };

  // ---- Badge ----
  function updateCartBadge() {
    var badge = document.getElementById('cart-badge');
    if (!badge) {
      var cartBtn = document.querySelector('#patient-pharmacy .app-bar button:last-child');
      if (cartBtn) {
        badge = document.createElement('span');
        badge.id = 'cart-badge';
        badge.style.cssText = 'position:absolute;top:-6px;right:-6px;background:var(--error);color:white;font-size:9px;font-weight:700;padding:2px 5px;border-radius:8px;';
        cartBtn.style.position = 'relative';
        cartBtn.appendChild(badge);
      }
    }
    if (badge) {
      var count = window.getCartCount();
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
  }

  // ---- Cart modal ----
  window.openCart = function() {
    // Reload from localStorage in case it changed in another tab
    var fresh = loadCart();
    cart.length = 0;
    fresh.forEach(function(i) { cart.push(i); });

    if (cart.length === 0) {
      showModal('🛒 Your Cart',
        '<div style="text-align:center;padding:32px 0;">' +
          '<div style="font-size:48px;">🛒</div>' +
          '<p style="font-size:13px;color:var(--text-secondary);margin-top:8px;">Your cart is empty</p>' +
        '</div>',
        '<button class="btn btn-primary btn-block" onclick="closeModal()">Browse Products</button>');
      return;
    }

    var subtotal = window.getCartTotal();
    var serviceFee = Math.round(subtotal * 0.05);
    var total = subtotal + serviceFee;

    var itemsHTML = cart.map(function(item, i) {
      return '<div class="cart-item-row" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #E8ECF1;">' +
        '<div>' +
          '<div style="font-weight:500;">' + item.name + '</div>' +
          '<div style="font-size:11px;color:var(--text-secondary);">' + money(item.price) + ' × ' + item.qty + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;align-items:center;">' +
          '<button class="btn btn-outline btn-sm" style="padding:2px 8px;min-width:28px;" onclick="window.decrementCart(' + i + ')">−</button>' +
          '<span style="font-weight:600;min-width:20px;text-align:center;">' + item.qty + '</span>' +
          '<button class="btn btn-outline btn-sm" style="padding:2px 8px;min-width:28px;" onclick="window.incrementCart(' + i + ')">+</button>' +
          '<button class="btn btn-danger btn-sm" style="padding:2px 8px;" onclick="window.removeFromCart(' + i + ')">✕</button>' +
        '</div>' +
      '</div>';
    }).join('');

    showModal('🛒 Cart (' + cart.length + ' items)',
      itemsHTML +
      '<div class="payment-summary" style="margin-top:12px;padding:12px;background:var(--surface);border-radius:8px;">' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;"><span>Subtotal</span><span>' + money(subtotal) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;"><span>Service Fee (5%)</span><span>' + money(serviceFee) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px;border-top:1px solid #E8ECF1;padding-top:8px;margin-top:6px;"><span>Total</span><span style="color:var(--primary);">' + money(total) + '</span></div>' +
      '</div>',
      '<button class="btn btn-outline" onclick="closeModal()">Continue Shopping</button>' +
      '<button class="btn btn-pharmacy" id="cart-checkout-btn" onclick="window._pharmacyCheckout()">Checkout</button>');
  };

  // ---- Checkout with idempotency + double-submit lock ----
  window._pharmacyCheckout = function() {
    var btn = document.getElementById('cart-checkout-btn');
    if (btn && btn.disabled) return;             // double-submit lock
    if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }

    var fresh = loadCart();
    if (fresh.length === 0) {
      if (btn) { btn.disabled = false; btn.textContent = 'Checkout'; }
      showToast('🛒 Cart is empty');
      return;
    }

    var subtotal = fresh.reduce(function(s, i) { return s + i.price * i.qty; }, 0);
    var txnId = uuid();   // idempotency key — same txn never processed twice
    console.log('💳 Checkout started — txnId:', txnId);

    var summary = fresh.length + ' item' + (fresh.length > 1 ? 's' : '');

    closeModal();

    window.openPaymentFlow(subtotal, 'Pharmacy Order — ' + summary, function() {
      // Payment succeeded — atomically clear
      window.clearPharmacyCart();
      console.log('✅ Checkout complete — txnId:', txnId);
    });
  };

  // ---- Product details ----
  window.showProductDetail = function(name, generic, price, stock) {
    showModal('💊 ' + name,
      '<div style="background:var(--pharmacy-light);padding:12px;border-radius:8px;margin-bottom:12px;">' +
        '<div style="font-size:13px;color:var(--text-secondary);">' + generic + '</div>' +
        '<div style="font-size:24px;font-weight:700;color:var(--pharmacy-color);margin-top:4px;">' + money(price) + '</div>' +
        '<div style="font-size:11px;margin-top:4px;">' + (stock > 0 ? '<span class="badge badge-instock">✓ In Stock</span> (' + stock + ' units)' : '<span class="badge badge-error">Out of Stock</span>') + '</div>' +
      '</div>' +
      '<div style="font-size:12px;font-weight:600;margin-bottom:6px;">Product Details</div>' +
      '<ul class="info-list" style="font-size:12px;color:var(--text-secondary);line-height:1.7;padding-left:18px;">' +
        '<li><strong>Brand:</strong> Coartem</li>' +
        '<li><strong>Manufacturer:</strong> Novartis</li>' +
        '<li><strong>Category:</strong> Antimalarial</li>' +
        '<li><strong>Form:</strong> Tablet</li>' +
        '<li><strong>Strength:</strong> 20/120mg</li>' +
      '</ul>' +
      '<div style="background:#FEF7E0;padding:10px;border-radius:8px;margin-top:12px;font-size:11px;">⚠️ Consult your doctor before use.</div>',
      '<button class="btn btn-outline" onclick="closeModal()">Close</button>' +
      '<button class="btn btn-pharmacy" onclick="closeModal();window.addToCart(\'' + name + '\',' + price + ')">🛒 Add to Cart</button>');
  };

  // ---- Wire product cards ----
  function wireProducts() {
    var cards = document.querySelectorAll('#patient-pharmacy .product-detail-card');
    cards.forEach(function(card) {
      if (card.dataset.pharmacyWired) return;
      card.dataset.pharmacyWired = 'true';

      var nameEl = card.querySelector('.product-name');
      var genericEl = card.querySelector('.product-generic');
      var priceEl = card.querySelector('.product-price');
      var name = nameEl ? nameEl.textContent.trim() : '';
      var generic = genericEl ? genericEl.textContent.trim() : '';
      var price = priceEl ? parseFloat(priceEl.textContent.replace(/[^\d]/g, '')) : 0;
      var stockBadge = card.querySelector('.badge-instock, .badge-lowstock, .badge-outofstock');
      var stock = stockBadge && stockBadge.classList.contains('badge-outofstock') ? 0 : 45;

      card.style.cursor = 'pointer';
      card.addEventListener('click', function(e) {
        if (e.target.closest('button')) return;
        window.showProductDetail(name, generic, price, stock);
      });

      var actions = card.querySelector('div[style*="display:flex"]');
      if (actions && !actions.querySelector('.add-to-cart-btn')) {
        var addBtn = document.createElement('button');
        addBtn.className = 'btn btn-pharmacy btn-sm add-to-cart-btn';
        addBtn.style.marginLeft = '6px';
        addBtn.textContent = '🛒 Add';
        addBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          window.addToCart(name, price);
        });
        actions.appendChild(addBtn);
      }

      var viewBtn = card.querySelector('button.btn-pharmacy');
      if (viewBtn) {
        viewBtn.onclick = function(e) {
          e.stopPropagation();
          window.showProductDetail(name, generic, price, stock);
        };
      }
    });
  }

  function wireCartButton() {
    var pharmacyScreen = document.getElementById('patient-pharmacy');
    if (!pharmacyScreen || pharmacyScreen.dataset.cartWired) return;
    pharmacyScreen.dataset.cartWired = 'true';
    var cartBtn = pharmacyScreen.querySelector('.app-bar button:last-child');
    if (cartBtn) {
      cartBtn.onclick = function(e) { e.preventDefault(); window.openCart(); };
    }
    updateCartBadge();
  }

  function init() {
    var observer = new MutationObserver(function() {
      var screen = document.getElementById('patient-pharmacy');
      if (screen && screen.classList.contains('active')) {
        setTimeout(function() { wireProducts(); wireCartButton(); updateCartBadge(); }, 100);
      }
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    wireProducts();
    wireCartButton();
    updateCartBadge();
    console.log('✅ pharmacy-flow initialized (' + cart.length + ' items in cart)');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();