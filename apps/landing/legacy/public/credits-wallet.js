// ============================================
// N-Health Credits — wallet replacement
// ============================================
(function() {
  'use strict';

  var API = 'https://n-health-backend-production.up.railway.app';

  function getToken() { return localStorage.getItem('token'); }

  function money(n) {
    return '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  // ============================================================
  // FETCH BALANCE
  // ============================================================
  window.refreshCredits = async function() {
    var token = getToken();
    if (!token) return;

    try {
      var res = await fetch(API + '/api/credits/balance', {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      if (!res.ok) return;
      var data = await res.json();
      window.creditBalance = data.balance || 0;

      // Update UI
      var els = document.querySelectorAll('.balance-amount');
      els.forEach(function(el) {
        el.textContent = money(data.balance);
      });

      console.log('💰 Credit balance:', data.balance);
    } catch (e) {
      console.error('Balance fetch error:', e);
    }
  };

  // ============================================================
  // BUY CREDITS — payment method picker
  // ============================================================
  window.openBuyCredits = function() {
    if (typeof closeModal === 'function') closeModal();

    showModal('💰 Buy Credits',
      '<div style="background:var(--primary-light);padding:12px;border-radius:8px;margin-bottom:14px;">' +
        '<div style="font-size:12px;color:var(--text-secondary);">Current Credit Balance</div>' +
        '<div style="font-size:24px;font-weight:700;color:var(--primary);margin-top:4px;">' + money(window.creditBalance || 0) + '</div>' +
      '</div>' +

      '<div class="form-group">' +
        '<label>Amount (₦) *</label>' +
        '<input type="number" id="buy-amount" placeholder="Enter amount" min="100" step="100" oninput="window.previewBuyAmount()">' +
        '<div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">Minimum ₦100</div>' +
      '</div>' +

      '<div class="amount-presets" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">' +
        [500, 1000, 2000, 5000, 10000, 20000].map(function(a) {
          return '<div class="preset" onclick="window.pickBuyAmount(this,' + a + ')" style="padding:12px;border:2px solid #E8ECF1;border-radius:8px;text-align:center;cursor:pointer;font-weight:600;font-size:13px;transition:all 0.15s;">₦' + a.toLocaleString() + '</div>';
        }).join('') +
      '</div>' +

      '<div class="form-group" style="margin-top:16px;">' +
        '<label>Payment Method</label>' +
        '<div id="gateway-picker" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px;">' +
          '<div class="gateway-card selected" data-gw="fincra" onclick="window.pickGateway(this,\'fincra\')" style="padding:12px;border:2px solid var(--primary);border-radius:8px;text-align:center;cursor:pointer;background:var(--primary-light);">' +
            '<div style="font-size:22px;">🏦</div>' +
            '<div style="font-size:11px;font-weight:600;margin-top:4px;">Fincra</div>' +
            '<div style="font-size:9px;color:var(--text-secondary);">Card · Transfer · USSD</div>' +
          '</div>' +
          '<div class="gateway-card" data-gw="monnify" onclick="window.pickGateway(this,\'monnify\')" style="padding:12px;border:2px solid #E8ECF1;border-radius:8px;text-align:center;cursor:pointer;">' +
            '<div style="font-size:22px;">🏛️</div>' +
            '<div style="font-size:11px;font-weight:600;margin-top:4px;">Monnify</div>' +
            '<div style="font-size:9px;color:var(--text-secondary);">Virtual Account · Card</div>' +
          '</div>' +
          '<div class="gateway-card" data-gw="flutterwave" onclick="window.pickGateway(this,\'flutterwave\')" style="padding:12px;border:2px solid #E8ECF1;border-radius:8px;text-align:center;cursor:pointer;grid-column:span 2;">' +
            '<div style="font-size:22px;">🌍</div>' +
            '<div style="font-size:11px;font-weight:600;margin-top:4px;">Flutterwave</div>' +
            '<div style="font-size:9px;color:var(--text-secondary);">International cards · Multi-currency</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div id="buy-summary" style="display:none;margin-top:14px;padding:12px;background:var(--surface);border-radius:8px;font-size:13px;"></div>' +
      '<div style="margin-top:12px;padding:10px;background:#FEF7E0;border-radius:8px;font-size:11px;">' +
        'ℹ️ Credits are non-transferable and can only be used for healthcare services on N-Health.' +
      '</div>',

      '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" onclick="window.proceedToBuyCredits()" id="buy-credits-btn" disabled>Buy Credits</button>');
  };

  window.pickBuyAmount = function(el, amount) {
    document.querySelectorAll('.preset').forEach(function(p) {
      p.style.borderColor = '#E8ECF1';
      p.style.background = 'white';
      p.style.color = '';
    });
    el.style.borderColor = 'var(--primary)';
    el.style.background = 'var(--primary-light)';
    el.style.color = 'var(--primary)';
    document.getElementById('buy-amount').value = amount;
    window.previewBuyAmount();
  };

  window.previewBuyAmount = function() {
    var amount = parseFloat((document.getElementById('buy-amount') || {}).value || 0);
    var summary = document.getElementById('buy-summary');
    var btn = document.getElementById('buy-credits-btn');
    if (!summary || !btn) return;

    if (amount < 100) {
      summary.style.display = 'none';
      btn.disabled = true;
      return;
    }

    summary.style.display = 'block';
    summary.innerHTML =
      '<div style="display:flex;justify-content:space-between;"><span>Amount</span><span>' + money(amount) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-secondary);margin-top:2px;"><span>Processing fee (1.5%)</span><span>' + money(amount * 0.015) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;font-weight:700;border-top:1px solid #E8ECF1;padding-top:6px;margin-top:6px;"><span>You will receive</span><span style="color:var(--primary);">' + money(amount) + ' credits</span></div>' +
      '<div style="font-size:10px;color:var(--text-light);margin-top:4px;">Processing fee is paid to the gateway and is not deducted from your credits.</div>';

    btn.disabled = false;
  };

  window.pickGateway = function(el, gw) {
    document.querySelectorAll('.gateway-card').forEach(function(c) {
      c.style.borderColor = '#E8ECF1';
      c.style.background = 'white';
    });
    el.style.borderColor = 'var(--primary)';
    el.style.background = 'var(--primary-light)';
    window._selectedGateway = gw;
  };

  window._selectedGateway = 'fincra';

  window.proceedToBuyCredits = async function() {
    var amount = parseFloat((document.getElementById('buy-amount') || {}).value || 0);
    var gateway = window._selectedGateway || 'fincra';
    var token = getToken();

    if (amount < 100) {
      if (typeof showToast === 'function') showToast('⚠️ Minimum is ₦100');
      return;
    }

    var btn = document.getElementById('buy-credits-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }

    try {
      var res = await fetch(API + '/api/credits/purchase/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({ amount, gateway }),
      });
      var data = await res.json();

      if (!res.ok) {
        if (typeof showToast === 'function') showToast('❌ ' + (data.error || data.message || 'Failed'));
        if (btn) { btn.disabled = false; btn.textContent = 'Buy Credits'; }
        return;
      }

      console.log('💳 Credit purchase initiated:', data);

      // For now, simulate confirmation (replace with real gateway SDK)
      // In production: this would open Fincra/Monnify/Flutterwave checkout
      closeModal();

      // Simulate payment success after 2 seconds
      setTimeout(async function() {
        try {
          var confirmRes = await fetch(API + '/api/credits/purchase/confirm', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token,
            },
            body: JSON.stringify({
              internalRef: data.internalRef,
              gatewayRef: 'simulated_' + Date.now(),
            }),
          });
          var confirmData = await confirmRes.json();

          if (confirmRes.ok) {
            if (typeof showToast === 'function') showToast('✅ Credits added!');
            window.refreshCredits();
          } else {
            if (typeof showToast === 'function') showToast('❌ Confirmation failed');
          }
        } catch (e) {
          console.error('Confirm error:', e);
        }
      }, 1500);

    } catch (err) {
      console.error('Buy credits error:', err);
      if (typeof showToast === 'function') showToast('❌ Network error');
      if (btn) { btn.disabled = false; btn.textContent = 'Buy Credits'; }
    }
  };

  // ============================================================
  // CREDIT TRANSACTION HISTORY
  // ============================================================
  window.openCreditHistory = async function() {
    if (typeof closeModal === 'function') closeModal();
    var token = getToken();

    try {
      var res = await fetch(API + '/api/credits/transactions', {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      var txns = await res.json();

      var rows = (txns || []).map(function(t) {
        var isCredit = t.type === 'purchase' || t.type === 'refund';
        var amountClass = isCredit ? 'var(--success)' : 'var(--error)';
        var sign = isCredit ? '+' : '−';
        var date = new Date(t.createdAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
        return '<div style="display:flex;align-items:center;padding:10px 0;border-bottom:1px solid #E8ECF1;">' +
          '<div style="width:38px;height:38px;background:' + (isCredit ? '#E6F4EA' : '#FCE8E6') + ';color:' + amountClass + ';display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:16px;margin-right:10px;">' + (isCredit ? '📥' : '📤') + '</div>' +
          '<div style="flex:1;">' +
            '<div style="font-weight:500;font-size:13px;">' + (t.description || t.type) + '</div>' +
            '<div style="font-size:11px;color:var(--text-secondary);">' + date + '</div>' +
          '</div>' +
          '<div style="font-weight:700;color:' + amountClass + ';">' + sign + money(Math.abs(t.amount)) + '</div>' +
        '</div>';
      }).join('');

      if (!rows) rows = '<div style="text-align:center;padding:32px 0;color:var(--text-secondary);">No transactions yet</div>';

      showModal('📊 Credit History',
        '<div style="max-height:400px;overflow-y:auto;">' + rows + '</div>',
        '<button class="btn btn-primary btn-block" onclick="closeModal()">Close</button>');

    } catch (e) {
      console.error('History error:', e);
      if (typeof showToast === 'function') showToast('❌ Could not load history');
    }
  };

  // ============================================================
  // WIRE INTO EXISTING UI
  // ============================================================
  function replaceWalletText() {
    // Replace "Wallet Balance" labels
    document.querySelectorAll('.balance-label').forEach(function(el) {
      if (el.textContent.includes('Wallet')) el.textContent = 'Credit Balance';
    });

    // Wire Fund button
    document.querySelectorAll('.balance-actions button').forEach(function(btn) {
      if (btn.textContent.includes('Fund')) {
        btn.onclick = function(e) { e.preventDefault(); window.openBuyCredits(); };
        btn.textContent = '💰 Buy Credits';
      } else if (btn.textContent.includes('History')) {
        btn.onclick = function(e) { e.preventDefault(); window.openCreditHistory(); };
      }
    });
  }

  function init() {
    setTimeout(function() {
      refreshCredits();
      replaceWalletText();
      var observer = new MutationObserver(function() { replaceWalletText(); });
      observer.observe(document.body, { childList: true, subtree: true });
      console.log('✅ credits-wallet initialized');
    }, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();