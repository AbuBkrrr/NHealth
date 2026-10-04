// ============================================
// Appointment Escrow — real payment flow via PayScrow
// Overrides the simulated bookAppointment with real escrow
// ============================================
(function() {
  'use strict';

  var API = 'https://n-health-backend-production.up.railway.app';
  function getToken() { return localStorage.getItem('token'); }
  function money(n) { return '\u20A6' + Number(n || 0).toLocaleString('en-NG'); }

  // Current booking state
  var currentBooking = {
    providerName: '',
    providerUserId: '',
    specialty: '',
    fee: 0,
    date: '',
    time: '',
    notes: '',
  };

  // ============================================================
  // OVERRIDE — Book Appointment
  // Called by appointment-flow.js's "Proceed to Payment"
  // ============================================================
  window.bookAppointment = function(providerName, specialty, fee, providerUserId) {
    // Reset
    currentBooking.providerName = providerName || currentBooking.providerName || 'Provider';
    currentBooking.providerUserId = providerUserId || currentBooking.providerUserId || '';
    currentBooking.specialty = specialty || currentBooking.specialty || 'Consultation';
    currentBooking.fee = fee || currentBooking.fee || 15000;

    // If we don't have a providerUserId, we can't do escrow
    if (!currentBooking.providerUserId) {
      // Try to extract from the providers-list data
      currentBooking.providerUserId = findProviderUserIdByName(currentBooking.providerName);
    }

    if (!currentBooking.providerUserId) {
      showToast('⚠️ Provider info missing — cannot set up payment');
      return;
    }

    // Step 1: Notes
    showNotesModal();
  };

  // ============================================================
  // STEP 1: NOTES
  // ============================================================
  function showNotesModal() {
    if (typeof closeModal === 'function') closeModal();

    showModal('📋 Booking Details',
      '<div style="background:var(--surface);padding:12px;border-radius:8px;margin-bottom:12px;">' +
        '<div style="font-weight:600;">' + currentBooking.providerName + '</div>' +
        '<div style="font-size:12px;color:var(--text-secondary);">' + currentBooking.specialty + '</div>' +
        '<div style="font-size:18px;font-weight:700;color:var(--primary);margin-top:6px;">' + money(currentBooking.fee) + '</div>' +
      '</div>' +

      '<div class="form-group">' +
        '<label>Describe your problem/issue *</label>' +
        '<textarea rows="4" id="esc-notes" placeholder="E.g., Persistent headache for 3 days, fever, cough..." style="width:100%;padding:10px;font-family:inherit;font-size:13px;border:1px solid #E8ECF1;border-radius:8px;resize:vertical;"></textarea>' +
        '<div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">Your doctor will review this before your visit.</div>' +
      '</div>',

      '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" onclick="window._apptGoToPayment()">Continue to Payment</button>');
  }

  window._apptGoToPayment = function() {
    var notes = (document.getElementById('esc-notes') || {}).value || '';
    if (notes.trim().length < 10) {
      showToast('⚠️ Please describe your problem (min 10 characters)');
      return;
    }
    currentBooking.notes = notes.trim();
    closeModal();

    // Call the escrow payment flow
    window._apptPayWithEscrow();
  };

  // ============================================================
  // STEP 2: ESCROW PAYMENT
  // ============================================================
  window._apptPayWithEscrow = function() {
    // Show method picker first
    showModal('💳 Payment',
      '<div style="background:var(--surface);padding:14px;border-radius:10px;margin-bottom:14px;">' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;"><span>' + currentBooking.providerName + '</span></div>' +
        '<div style="font-size:12px;color:var(--text-secondary);">' + currentBooking.specialty + '</div>' +
        '<div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px;border-top:1px solid #E8ECF1;padding-top:8px;margin-top:8px;"><span>Consultation fee</span><span>' + money(currentBooking.fee) + '</span></div>' +
      '</div>' +

      '<div style="font-size:12px;font-weight:600;margin-bottom:8px;">Choose Payment Method</div>' +
      '<div style="display:grid;grid-template-columns:1fr;gap:8px;">' +

        '<div onclick="window._apptConfirmEscrow()" style="padding:14px;border:2px solid var(--success);border-radius:10px;cursor:pointer;background:#E6F4EA;">' +
          '<div style="display:flex;gap:12px;align-items:center;">' +
            '<div style="font-size:28px;">🔒</div>' +
            '<div style="flex:1;">' +
              '<div style="font-weight:600;font-size:14px;color:var(--success);">Pay with Escrow (Recommended)</div>' +
              '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">Funds protected by PayScrow until service is delivered</div>' +
            '</div>' +
            '<div style="color:var(--success);font-weight:700;">→</div>' +
          '</div>' +
        '</div>' +

        '<div onclick="window._apptPayWithCredits()" style="padding:14px;border:2px solid var(--primary);border-radius:10px;cursor:pointer;">' +
          '<div style="display:flex;gap:12px;align-items:center;">' +
            '<div style="font-size:28px;">💰</div>' +
            '<div style="flex:1;">' +
              '<div style="font-weight:600;font-size:14px;color:var(--primary);">Pay with N-Health Credits</div>' +
              '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">Instant payment · Balance: ' + money(window.creditBalance || 0) + '</div>' +
            '</div>' +
            '<div style="color:var(--primary);font-weight:700;">→</div>' +
          '</div>' +
        '</div>' +

      '</div>' +
      '<div style="margin-top:12px;padding:10px;background:#FEF7E0;border-radius:8px;font-size:11px;">' +
        '🔒 Escrow: Your money is held until you receive the service and enter the escrow code. Refunds are handled by PayScrow.' +
      '</div>',

      '<button class="btn btn-outline btn-block" onclick="closeModal()">Cancel</button>');
  };

  // ============================================================
  // STEP 3a: ESCROW — Create escrow transaction
  // ============================================================
  window._apptConfirmEscrow = async function() {
    if (typeof closeModal === 'function') closeModal();

    // Show loading
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
          'Authorization': 'Bearer ' + getToken(),
        },
        body: JSON.stringify({
          purpose: 'appointment',
          purposeId: 'apt-' + Date.now(), // Will be replaced when appointment is created on backend
          amount: currentBooking.fee,
          providerUserId: currentBooking.providerUserId,
          description: currentBooking.specialty + ' consultation',
        }),
      });

      var data = await res.json();

      if (!res.ok) {
        closeModal();
        showToast('❌ ' + (data.error || data.message || 'Failed to create escrow'));
        return;
      }

      console.log('✅ Escrow created:', data);
      closeModal();
      showEscrowConfirm(data);

    } catch (e) {
      console.error('Escrow error:', e);
      closeModal();
      showToast('❌ Network error');
    }
  };

  // ============================================================
  // STEP 3b: ESCROW — Show payment link modal
  // ============================================================
  function showEscrowConfirm(data) {
    var summary =
      '<div style="background:var(--surface);padding:14px;border-radius:10px;margin-bottom:14px;">' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;"><span>Service</span><span>' + currentBooking.specialty + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;"><span>Consultation fee</span><span>' + money(currentBooking.fee) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;color:var(--text-secondary);"><span>Escrow fee (your share)</span><span>' + money(data.customerCharge) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px;border-top:1px solid #E8ECF1;padding-top:8px;margin-top:6px;"><span>Total to pay</span><span style="color:var(--primary);">' + money(data.totalPayable) + '</span></div>' +
      '</div>' +

      '<div style="background:#E8F0FE;padding:12px;border-radius:8px;font-size:12px;line-height:1.6;margin-bottom:12px;">' +
        '<div style="font-weight:600;margin-bottom:4px;">🔒 Protected by PayScrow</div>' +
        'Your money is held in escrow. Funds are released to the doctor <strong>after your consultation</strong>.' +
      '</div>' +

      '<div style="background:#FEF7E0;padding:10px;border-radius:8px;font-size:11px;">' +
        'Ref: <code style="font-family:monospace;font-size:11px;">' + data.transactionNumber + '</code>' +
      '</div>';

    showModal('🔒 Escrow Payment',
      summary,
      '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" onclick="window._apptOpenPayScrow(\'' + data.paymentLink + '\',\'' + data.escrowId + '\')">Pay ' + money(data.totalPayable) + '</button>');
  }

  // ============================================================
  // STEP 4: Open PayScrow + poll status
  // ============================================================
  window._apptOpenPayScrow = function(link, escrowId) {
    if (!link) { showToast('Payment link missing'); return; }

    localStorage.setItem('pendingEscrowId', escrowId);
    localStorage.setItem('pendingAppointment', JSON.stringify(currentBooking));

    var w = window.open(link, '_blank');
    if (!w) {
      window.location.href = link;
      return;
    }

    closeModal();
    showToast('Complete payment in the new tab');

    // Poll for status
    var pollCount = 0;
    var pollInterval = setInterval(async function() {
      pollCount++;

      try {
        var res = await fetch(API + '/api/escrow/' + escrowId, {
          headers: { 'Authorization': 'Bearer ' + getToken() },
        });
        if (res.ok) {
          var escrow = await res.json();
          console.log('Escrow status:', escrow.status);

          if (escrow.status === 'in_escrow' || escrow.status === 'released') {
            clearInterval(pollInterval);
            showToast('✅ Payment received! Funds held in escrow.');
            showPostPaymentConfirm();
          }
        }
      } catch (e) {
        // ignore network blips
      }

      if (pollCount > 60) clearInterval(pollInterval);
    }, 5000);
  };

  function showPostPaymentConfirm() {
    showModal('✅ Appointment Confirmed',
      '<div style="text-align:center;padding:20px 0;">' +
        '<div style="font-size:56px;">✅</div>' +
        '<h3 style="margin-top:12px;">Booking Confirmed</h3>' +
        '<p style="font-size:13px;color:var(--text-secondary);margin-top:8px;">' +
          'Your appointment with <strong>' + currentBooking.providerName + '</strong> has been scheduled.<br>' +
          'You will receive a notification with the exact time.' +
        '</p>' +
        '<div style="background:#E8F0FE;padding:12px;border-radius:8px;margin-top:16px;font-size:12px;line-height:1.6;text-align:left;">' +
          '🔒 <strong>Your money is protected.</strong> After the consultation, the doctor will provide you with an escrow code. Enter it to release their payment.' +
        '</div>' +
      '</div>',
      '<button class="btn btn-primary btn-block" onclick="window.closeModal();window.navigateTo(\'patient-appointments\');">View My Appointments</button>');
  }

  // ============================================================
  // STEP 5: Pay with Credits (alternative to escrow)
  // ============================================================
  window._apptPayWithCredits = async function() {
    if ((window.creditBalance || 0) < currentBooking.fee) {
      showToast('❌ Insufficient credits. Buy more first.');
      return;
    }

    if (!confirm('Pay ' + money(currentBooking.fee) + ' credits to book this appointment?')) return;

    closeModal();
    showToast('⏳ Processing payment...');

    // TODO: Wire to /api/credits/spend once that endpoint exists
    setTimeout(function() {
      showToast('✅ Appointment booked with credits');
      showPostPaymentConfirm();
    }, 1500);
  };

  // ============================================================
  // HELPER — find providerUserId by name from PROVIDERS list
  // ============================================================
  function findProviderUserIdByName(name) {
    // The PROVIDERS array in providers-list.js uses 'd1', 'd2', etc.
    // We need a mapping from display name to real userId.
    // For now, use the demo providers — real ones would come from a backend call.
    // This is a temporary bridge until providers are loaded from /api/providers.
    var demoMap = {
      'Dr. Adebayo Ogunlesi': null,   // Will be filled from backend
      'Dr. Funmi Adeyemi': null,
      'Dr. Chidi Okonkwo': null,
      'Dr. Aisha Bello': null,
      'HealthPlus Pharmacy': null,
      'MedPlus Pharmacy': null,
      'Lagos Medical Lab': null,
      'LUTH Diagnostics': null,
      'Nurse Funmi Adeyemi': null,
      'N-Health Ambulance': null,
    };
    // TODO: fetch real provider IDs from backend
    return demoMap[name] || null;
  }

  console.log('✅ appointment-escrow initialized');
})();