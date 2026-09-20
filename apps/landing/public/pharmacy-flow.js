// ============================================
// Pharmacy — clickable products, add-to-cart, working cart
// ============================================
(function() {
  'use strict';

  var cart = [];

  window.pharmacyCart = cart;

  function money(n) { return '₦' + Number(n).toLocaleString(); }

  window.addToCart = function(name, price) {
    var existing = cart.find(function(i) { return i.name === name; });
    if (existing) existing.qty++;
    else cart.push({ name: name, price: price, qty: 1 });
    updateCartBadge();
    if (typeof showToast === 'function') showToast('🛒 ' + name + ' added');
  };

  window.removeFromCart = function(index) {
    cart.splice(index, 1);
    updateCartBadge();
    if (typeof closeModal === 'function') closeModal();
    window.openCart();
  };

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
      var count = cart.reduce(function(s, i) { return s + i.qty; }, 0);
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
  }

  window.openCart = function() {
    if (cart.length === 0) {
      showModal('🛒 Your Cart',
        '<div style="text-align:center;padding:32px 0;">' +
          '<div style="font-size:48px;">🛒</div>' +
          '<p style="font-size:13px;color:var(--text-secondary);margin-top:8px;">Your cart is empty</p>' +
        '</div>',
        '<button class="btn btn-primary btn-block" onclick="closeModal()">Browse Products</button>');
      return;
    }

    var subtotal = cart.reduce(function(s, i) { return s + i.price * i.qty; }, 0);
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
      '<button class="btn btn-outline" onclick="closeModal()">Continue</button>' +
      '<button class="btn btn-pharmacy" onclick="window.checkoutCart()">Checkout</button>');
  };

  window.incrementCart = function(i) { cart[i].qty++; window.openCart(); updateCartBadge(); };
  window.decrementCart = function(i) { if (cart[i].qty > 1) cart[i].qty--; else cart.splice(i, 1); window.openCart(); updateCartBadge(); };

  window.checkoutCart = function() {
    var subtotal = cart.reduce(function(s, i) { return s + i.price * i.qty; }, 0);
    var total = Math.round(subtotal * 1.05);
    closeModal();
    cart.length = 0;
    updateCartBadge();
    showModal('💳 Payment',
      '<div class="payment-summary" style="padding:12px;background:var(--surface);border-radius:8px;margin-bottom:12px;">' +
        '<div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px;"><span>Total</span><span style="color:var(--primary);">' + money(total) + '</span></div>' +
      '</div>' +
      '<div class="form-group"><label>Payment Method</label><select><option>💳 Debit Card</option><option>🏦 Bank Transfer</option><option>💰 Wallet</option></select></div>',
      '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-pharmacy" onclick="closeModal();showToast(\'✅ Order placed!\');">Pay ' + money(total) + '</button>');
  };

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
        '<li><strong>Batch:</strong> B2024-001</li>' +
        '<li><strong>Expiry:</strong> Dec 2025</li>' +
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

      // Extract data
      var nameEl = card.querySelector('.product-name');
      var genericEl = card.querySelector('.product-generic');
      var priceEl = card.querySelector('.product-price');
      var name = nameEl ? nameEl.textContent.trim() : '';
      var generic = genericEl ? genericEl.textContent.trim() : '';
      var price = priceEl ? parseFloat(priceEl.textContent.replace(/[^\d]/g, '')) : 0;
      var stockBadge = card.querySelector('.badge-instock, .badge-lowstock, .badge-outofstock');
      var stock = stockBadge && stockBadge.classList.contains('badge-outofstock') ? 0 : 45;

      // Make card clickable
      card.style.cursor = 'pointer';
      card.addEventListener('click', function(e) {
        if (e.target.closest('button')) return;
        window.showProductDetail(name, generic, price, stock);
      });

      // Add "Add to Cart" button next to "View Details"
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

      // Rewire View Details
      var viewBtn = card.querySelector('button.btn-pharmacy');
      if (viewBtn) {
        viewBtn.onclick = function(e) {
          e.stopPropagation();
          window.showProductDetail(name, generic, price, stock);
        };
      }
    });
  }

  // ---- Wire cart button in app bar ----
  function wireCartButton() {
    var pharmacyScreen = document.getElementById('patient-pharmacy');
    if (!pharmacyScreen || pharmacyScreen.dataset.cartWired) return;
    pharmacyScreen.dataset.cartWired = 'true';
    var cartBtn = pharmacyScreen.querySelector('.app-bar button:last-child');
    if (cartBtn) {
      cartBtn.onclick = function(e) { e.preventDefault(); window.openCart(); };
    }
  }

  function init() {
    // Watch for pharmacy screen activation
    var observer = new MutationObserver(function() {
      var screen = document.getElementById('patient-pharmacy');
      if (screen && screen.classList.contains('active')) {
        setTimeout(function() { wireProducts(); wireCartButton(); }, 100);
      }
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    wireProducts();
    wireCartButton();
    console.log('✅ pharmacy-flow initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();