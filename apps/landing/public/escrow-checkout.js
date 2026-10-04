// ============================================
// Escrow Checkout — replaces simulated payment for bookings
// Uses PayScrow payment links for real escrow protection
// ============================================
(function() {
  'use strict';

  var API = 'https://n-health-backend-production.up.railway.app';
  function getToken() { return localStorage.getItem('token'); }
  function money(n) { return '\u20A6' + Number(n || 0).toLocaleString('en-NG'); }

  // ============================================================
  // INITIATE ESCROW PAYMENT
  // Called by: appointments, pharmacy, labs, emergency
  // ============================================================
  window.initiateEscrowPayment = async function(opts) {
    // opts: { purpose, purposeId, amount, providerUserId, description, onSuccess }
    var token = getToken();
    if (!token) { showToast('Please sign in'); return; }

    if (!opts.providerUserId) {
      showToast('Provider information missing');
      return;
    }

    // Show loading state
    showModal('Setting up escrow...',
      '<div style="text-align:center;padding:40px 0;">' +
        '<div style="font-size:48px;">🔒</div>' +
        '<p style="font-size:13px;color:var(--text-secondary);margin-top:12px;">Contacting PayScrow...</p>' +
      '</div>',
      '');

    try {
      var res = await fetch(API + '/api/escrow/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({
          purpose: opts.purpose,
          purposeId: opts.purposeId,
          amount: opts.amount,
          providerUserId: opts.providerUserId,
          description: opts.description || 'N-Health ' + opts.purpose,
        }),
      });
      var data = await res.json();

      if (!res.ok) {
        closeModal();
        showToast('❌ ' + (data.error || data.message || 'Failed to set up escrow'));
        return;
      }

      console.log('✅ Escrow created:', data);
      closeModal();

      // Show escrow summary modal with payment link
      showEscrowConfirm(data, opts);

    } catch (e) {
      console.error('Escrow initiate error:', e);
      closeModal();
      showToast('❌ Network error');
    }
  };

  // ============================================================
  // ESCROW CONFIRMATION MODAL
  // ============================================================
  function showEscrowConfirm(data, opts) {
    var summary =
      '<div style="background:var(--surface);padding:14px;border-radius:10px;margin-bottom:14px;">' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;"><span>Service</span><span>' + opts.description + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;"><span>Amount</span><span>' + money(opts.amount) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;color:var(--text-secondary);"><span>Escrow fee (your share)</span><span>' + money(data.customerCharge) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px;border-top:1px solid #E8ECF1;padding-top:8px;margin-top:6px;"><span>Total to pay</span><span style="color:var(--primary);">' + money(data.totalPayable) + '</span></div>' +
      '</div>' +

      '<div style="background:#E8F0FE;padding:12px;border-radius:8px;font-size:12px;line-height:1.6;margin-bottom:12px;">' +
        '<div style="font-weight:600;margin-bottom:4px;">🔒 Protected by PayScrow</div>' +
        'Your money is held securely in escrow. Funds are only released to the provider <strong>after you receive the service</strong> and enter the escrow code.' +
      '</div>' +

      '<div style="background:#FEF7E0;padding:10px;border-radius:8px;font-size:11px;">' +
        'Ref: <code style="font-family:monospace;">' + data.transactionNumber + '</code>' +
      '</div>';

    showModal('🔒 Escrow Payment',
      summary,
      '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" onclick="window.openPayScrowLink(\'' + data.paymentLink + '\',\'' + data.escrowId + '\')">Pay ' + money(data.totalPayable) + '</button>');
  }

  // ============================================================
  // OPEN PAYSCROW PAYMENT PAGE
  // ============================================================
  window.openPayScrowLink = function(link, escrowId) {
    if (!link) { showToast('Payment link missing'); return; }

    // Store escrow ID to check on return
    localStorage.setItem('pendingEscrowId', escrowId);

    // Open in new tab
    var w = window.open(link, '_blank');
    if (!w) {
      // Popup blocked — fallback to same tab
      window.location.href = link;
      return;
    }

    closeModal();
    showToast('Complete payment in the new tab');

    // Poll for payment status every 5 seconds
    var pollCount = 0;
    var pollInterval = setInterval(async function() {
      pollCount++;
      var status = await checkEscrowStatus(escrowId);
      if (status === 'in_escrow' || status === 'released') {
        clearInterval(pollInterval);
        showToast('✅ Payment received! Funds held in escrow.');
        if (window.refreshCredits) window.refreshCredits();
      } else if (pollCount > 60) {
        // Stop after 5 minutes
        clearInterval(pollInterval);
      }
    }, 5000);
  };

  // ============================================================
  // CHECK ESCROW STATUS
  // ============================================================
  async function checkEscrowStatus(escrowId) {
    try {
      var res = await fetch(API + '/api/escrow/' + escrowId, {
        headers: { 'Authorization': 'Bearer ' + getToken() },
      });
      if (!res.ok) return null;
      var data = await res.json();
      return data.status;
    } catch (e) {
      return null;
    }
  }
  window.checkEscrowStatus = checkEscrowStatus;

  // ============================================================
  // RELEASE FUNDS (provider enters code from customer)
  // ============================================================
  window.releaseEscrowFunds = function(escrowId) {
    showModal('Release Escrow Funds',
      '<div style="background:#E8F0FE;padding:12px;border-radius:8px;margin-bottom:12px;font-size:12px;line-height:1.6;">' +
        'The customer has received your service and should provide you with a 6-character <strong>escrow code</strong>. Enter it below to release your payment.' +
      '</div>' +
      '<div class="form-group">' +
        '<label>Escrow Code</label>' +
        '<input type="text" id="escrow-code-input" placeholder="Enter code from customer" maxlength="10" style="text-transform:uppercase;font-family:monospace;font-size:18px;letter-spacing:3px;text-align:center;">' +
      '</div>',
      '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" onclick="window.submitEscrowCode(\'' + escrowId + '\')">Release Funds</button>');
  };

  window.submitEscrowCode = async function(escrowId) {
    var code = (document.getElementById('escrow-code-input') || {}).value || '';
    if (!code || code.length < 4) { showToast('Enter the escrow code'); return; }

    try {
      var res = await fetch(API + '/api/escrow/' + escrowId + '/release', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + getToken(),
        },
        body: JSON.stringify({ code: code.trim() }),
      });
      var data = await res.json();
      closeModal();
      if (res.ok) {
        showToast('✅ Funds released to your account');
      } else {
        showToast('❌ ' + (data.error || data.message || 'Invalid code'));
      }
    } catch (e) {
      showToast('Network error');
    }
  };

  console.log('✅ escrow-checkout initialized');
})();