// ============================================
// Universal Payment Gateway
// Card | Transfer | Wallet — with idempotency + double-submit lock
// ============================================
(function() {
  'use strict';

  var NIGERIAN_BANKS = [
    'Access Bank', 'Zenith Bank', 'GTBank', 'UBA', 'First Bank', 'Fidelity Bank',
    'Union Bank', 'Sterling Bank', 'Stanbic IBTC', 'Wema Bank', 'Polaris Bank',
    'Kuda', 'Opay', 'Palmpay', 'Moniepoint', 'Providus Bank'
  ];

  var BUSINESS = {
    bankName: 'GTBank',
    accountName: 'N-Health Services Ltd',
    accountNumber: '0123456789',
  };

  var _submitting = false;   // global double-submit lock

  function money(n) { return '₦' + Number(n).toLocaleString(); }
  function uuid() { return 'txn_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10); }

  function getWalletBalance() {
    var b = localStorage.getItem('walletBalance');
    if (b === null) { b = '245750'; localStorage.setItem('walletBalance', b); }
    return parseFloat(b);
  }
  function setWalletBalance(n) { localStorage.setItem('walletBalance', String(n)); }

  function getSavedCards() {
    try { return JSON.parse(localStorage.getItem('savedCards') || '[]'); } catch (e) { return []; }
  }
  function saveCard(c) {
    var arr = getSavedCards();
    arr.push(c);
    localStorage.setItem('savedCards', JSON.stringify(arr));
  }

  // ================================================
  // MAIN ENTRY
  // ================================================
  window.openPaymentFlow = function(amount, description, onSuccess) {
    _submitting = false;
    var total = Math.round(Number(amount));
    var fee = Math.round(total * 0.05);
    var grandTotal = total + fee;
    var txnId = uuid();

    showModal('💳 Payment',
      '<div style="background:var(--surface);padding:12px;border-radius:8px;margin-bottom:14px;">' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;"><span>' + description + '</span><span>' + money(total) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-secondary);"><span>Service Fee (5%)</span><span>' + money(fee) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px;border-top:1px solid #E8ECF1;padding-top:8px;margin-top:6px;"><span>Total</span><span style="color:var(--primary);">' + money(grandTotal) + '</span></div>' +
        '<div style="font-size:10px;color:var(--text-light);text-align:right;margin-top:4px;">Ref: ' + txnId + '</div>' +
      '</div>' +
      '<div style="font-size:12px;font-weight:600;margin-bottom:8px;">Choose Payment Method</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">' +
        '<div class="pay-method-card" data-method="card" onclick="window._pmPick(this,\'card\')" style="padding:14px 6px;border:2px solid #E8ECF1;border-radius:10px;text-align:center;cursor:pointer;">' +
          '<div style="font-size:22px;">💳</div><div style="font-size:11px;font-weight:600;margin-top:4px;">Card</div></div>' +
        '<div class="pay-method-card" data-method="transfer" onclick="window._pmPick(this,\'transfer\')" style="padding:14px 6px;border:2px solid #E8ECF1;border-radius:10px;text-align:center;cursor:pointer;">' +
          '<div style="font-size:22px;">🏦</div><div style="font-size:11px;font-weight:600;margin-top:4px;">Transfer</div></div>' +
        '<div class="pay-method-card" data-method="wallet" onclick="window._pmPick(this,\'wallet\')" style="padding:14px 6px;border:2px solid #E8ECF1;border-radius:10px;text-align:center;cursor:pointer;">' +
          '<div style="font-size:22px;">💰</div><div style="font-size:11px;font-weight:600;margin-top:4px;">Wallet</div></div>' +
      '</div>' +
      '<div id="pay-method-detail" style="margin-top:14px;"></div>',
      '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" id="pm-submit" disabled onclick="window._pmSubmit()">Continue</button>');

    window._pendingPayment = { total: grandTotal, description: description, method: null, onSuccess: onSuccess, txnId: txnId };
  };

  // ================================================
  // METHOD PICKER
  // ================================================
  window._pmPick = function(el, method) {
    document.querySelectorAll('.pay-method-card').forEach(function(c) {
      c.style.borderColor = '#E8ECF1'; c.style.background = 'white';
    });
    el.style.borderColor = 'var(--primary)';
    el.style.background = 'var(--primary-light)';

    if (!window._pendingPayment) return;
    window._pendingPayment.method = method;

    var detail = document.getElementById('pay-method-detail');
    var submit = document.getElementById('pm-submit');
    if (!detail) return;
    detail.innerHTML = '';

    if (method === 'card') {
      var cards = getSavedCards();
      var html = '';
      if (cards.length) {
        html += '<div style="font-size:12px;font-weight:600;margin-bottom:6px;">Saved Cards</div>';
        html += cards.map(function(c, i) {
          return '<label style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #E8ECF1;border-radius:8px;margin-bottom:6px;cursor:pointer;">' +
            '<input type="radio" name="saved-card" value="' + i + '">' +
            '<div style="flex:1;"><div style="font-weight:600;">' + c.brand + ' •••• ' + c.last4 + '</div>' +
            '<div style="font-size:11px;color:var(--text-secondary);">Expires ' + c.expiry + '</div></div></label>';
        }).join('');
      }
      html += '<div class="form-group" style="margin-top:10px;">' +
        '<label style="font-size:12px;">Add New Card</label>' +
        '<input type="text" id="card-number" placeholder="Card Number (16 digits)" maxlength="19" oninput="window._pmCardFormat(this)">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">' +
          '<input type="text" id="card-expiry" placeholder="MM/YY" maxlength="5">' +
          '<input type="text" id="card-cvv" placeholder="CVV" maxlength="4">' +
        '</div>' +
        '<input type="text" id="card-name" placeholder="Name on Card" style="margin-top:8px;">' +
        '<label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-top:8px;">' +
          '<input type="checkbox" id="card-save"> Save this card for next time</label></div>';
      detail.innerHTML = html;
      submit.disabled = false;
      submit.textContent = 'Continue';
    } else if (method === 'transfer') {
      detail.innerHTML =
        '<div style="background:#E8F0FE;padding:12px;border-radius:8px;margin-bottom:10px;">' +
          '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px;">Transfer to:</div>' +
          '<div style="font-weight:600;">' + BUSINESS.bankName + '</div>' +
          '<div style="font-size:13px;">' + BUSINESS.accountName + '</div>' +
          '<div style="font-size:18px;font-weight:700;color:var(--primary);letter-spacing:1px;">' + BUSINESS.accountNumber + '</div>' +
          '<div style="font-size:12px;margin-top:6px;">Amount: <strong>' + money(window._pendingPayment.total) + '</strong></div>' +
        '</div>' +
        '<div class="form-group"><label style="font-size:12px;">Your Bank</label>' +
          '<select id="transfer-bank"><option value="">-- Select your bank --</option>' +
          NIGERIAN_BANKS.map(function(b) { return '<option>' + b + '</option>'; }).join('') +
          '</select></div>' +
        '<div class="form-group"><label style="font-size:12px;">Upload Receipt/Screenshot *</label>' +
          '<input type="file" accept="image/*" id="transfer-receipt" onchange="document.getElementById(\'receipt-preview\').style.display=\'block\'">' +
          '<div id="receipt-preview" style="font-size:11px;color:var(--success);margin-top:4px;display:none;">✓ Receipt attached</div></div>';
      submit.disabled = false;
      submit.textContent = 'I Have Sent the Transfer';
    } else if (method === 'wallet') {
      var bal = getWalletBalance();
      var ok = bal >= window._pendingPayment.total;
      detail.innerHTML =
        '<div style="background:linear-gradient(135deg,var(--primary),var(--primary-dark));padding:14px;border-radius:10px;color:white;">' +
          '<div style="font-size:11px;opacity:0.85;">Available Balance</div>' +
          '<div style="font-size:24px;font-weight:700;">' + money(bal) + '</div>' +
          '<div style="font-size:11px;opacity:0.85;margin-top:6px;">Deduction: <strong>' + money(window._pendingPayment.total) + '</strong></div>' +
          '<div style="font-size:11px;opacity:0.85;">After: <strong>' + money(Math.max(0, bal - window._pendingPayment.total)) + '</strong></div>' +
        '</div>' +
        (!ok ? '<div style="background:#FCE8E6;color:var(--error);padding:10px;border-radius:8px;margin-top:10px;font-size:12px;">⚠️ Insufficient balance.</div>' : '');
      submit.disabled = !ok;
      submit.textContent = ok ? 'Pay ' + money(window._pendingPayment.total) : 'Insufficient Funds';
    }
  };

  window._pmCardFormat = function(input) {
    var v = input.value.replace(/\s/g, '').replace(/\D/g, '').substring(0, 16);
    input.value = v.replace(/(.{4})/g, '$1 ').trim();
  };

  // ================================================
  // SUBMIT — idempotent, double-submit locked
  // ================================================
  window._pmSubmit = function() {
    if (_submitting) { console.log('⚠️ Already submitting — ignoring'); return; }
    var p = window._pendingPayment;
    if (!p || !p.method) { showToast('⚠️ Choose a payment method'); return; }

    // Validation
    if (p.method === 'card') {
      var savedRadio = document.querySelector('input[name="saved-card"]:checked');
      if (!savedRadio) {
        var num = (document.getElementById('card-number') || {}).value || '';
        var exp = (document.getElementById('card-expiry') || {}).value || '';
        var cvv = (document.getElementById('card-cvv') || {}).value || '';
        var name = (document.getElementById('card-name') || {}).value || '';
        if (num.replace(/\s/g, '').length < 16) { showToast('⚠️ Enter valid card number'); return; }
        if (!/^\d{2}\/\d{2}$/.test(exp)) { showToast('⚠️ Enter expiry as MM/YY'); return; }
        if (cvv.length < 3) { showToast('⚠️ Enter CVV'); return; }
        if (!name.trim()) { showToast('⚠️ Enter name on card'); return; }
      }
    } else if (p.method === 'transfer') {
      var bank = (document.getElementById('transfer-bank') || {}).value;
      var receipt = document.getElementById('transfer-receipt');
      if (!bank) { showToast('⚠️ Select your bank'); return; }
      if (!receipt || !receipt.files || !receipt.files[0]) { showToast('⚠️ Attach your receipt'); return; }
    } else if (p.method === 'wallet') {
      var bal = getWalletBalance();
      if (bal < p.total) { showToast('⚠️ Insufficient balance'); return; }
    }

    // Lock
    _submitting = true;
    var btn = document.getElementById('pm-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }

    // Simulate async processing (would be fetch() in real app)
    setTimeout(function() {
      try {
        // Deduct wallet after validation
        if (p.method === 'wallet') {
          setWalletBalance(getWalletBalance() - p.total);
        }
        if (p.method === 'card') {
          var save = document.getElementById('card-save');
          var savedRadio = document.querySelector('input[name="saved-card"]:checked');
          if (!savedRadio && save && save.checked) {
            var num = (document.getElementById('card-number') || {}).value || '';
            var exp = (document.getElementById('card-expiry') || {}).value || '';
            saveCard({ brand: 'Card', last4: num.replace(/\s/g, '').slice(-4), expiry: exp });
          }
        }

        console.log('✅ Payment processed — txnId:', p.txnId);
        closeModal();
        showToast('✅ Payment successful — ' + money(p.total));

        if (typeof p.onSuccess === 'function') p.onSuccess();
        window._pendingPayment = null;
      } catch (err) {
        console.error('Payment error:', err);
        showToast('❌ Payment failed');
      } finally {
        _submitting = false;
      }
    }, 600);
  };

  // ================================================
  // MODULE OVERRIDES
  // ================================================

  // Pharmacy checkout — uses atomic clear
  window.checkoutCart = function() {
    window._pharmacyCheckout();
  };

  // Appointment booking with notes
  window.bookAppointment = function(providerName, specialty, fee) {
    var amount = fee || 15000;
    var label = providerName || 'Doctor Consultation';
    var spec = specialty || '';

    closeModal();
    showModal('📋 Booking Notes',
      '<div style="background:var(--surface);padding:12px;border-radius:8px;margin-bottom:12px;">' +
        '<div style="font-weight:600;">' + label + (spec ? ' — ' + spec : '') + '</div>' +
        '<div style="font-size:18px;font-weight:700;color:var(--primary);margin-top:4px;">' + money(amount) + '</div>' +
      '</div>' +
      '<div class="form-group"><label>Describe your problem/issue *</label>' +
        '<textarea rows="4" id="bk-notes" placeholder="E.g., Persistent headache for 3 days, fever, cough..." style="width:100%;padding:8px 12px;font-family:inherit;font-size:13px;"></textarea>' +
        '<div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">Your provider will see this before your visit.</div>' +
      '</div>',
      '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" onclick="window._bookApptContinue(' + amount + ',\'' + label.replace(/'/g, '') + '\')">Continue to Payment</button>');
  };

  window._bookApptContinue = function(fee, label) {
    var notes = (document.getElementById('bk-notes') || {}).value || '';
    if (!notes.trim()) { showToast('⚠️ Please describe your problem'); return; }
    closeModal();
    window.openPaymentFlow(fee, label + ' — Consultation', function() {
      showToast('✅ Appointment booked!');
    });
  };

  window.openGenericPayment = function(amount, description) {
    window.openPaymentFlow(amount, description, function() {});
  };

  console.log('✅ payment-gateway initialized');
})();