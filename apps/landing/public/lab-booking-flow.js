// ============================================
// Lab Booking Flow
// ============================================
(function() {
  'use strict';

  var LAB_SERVICES = [
    { name: 'Complete Blood Count (CBC)', price: 5000, duration: '4 hrs' },
    { name: 'Malaria Parasite Test', price: 2500, duration: '1 hr' },
    { name: 'Lipid Profile', price: 8000, duration: '6 hrs' },
    { name: 'Liver Function Test', price: 12000, duration: '8 hrs' },
    { name: 'Kidney Function Test', price: 10000, duration: '6 hrs' },
    { name: 'Blood Sugar (Fasting)', price: 1500, duration: '1 hr' },
    { name: 'Urinalysis', price: 2000, duration: '2 hrs' },
    { name: 'HIV Screening', price: 3000, duration: '1 hr' },
    { name: 'Hepatitis B Surface Antigen', price: 4000, duration: '2 hrs' },
    { name: 'Thyroid Function Test', price: 15000, duration: '12 hrs' },
  ];

  window.openLabBooking = function(lab) {
    var servicesHTML = LAB_SERVICES.map(function(s, i) {
      return '<label style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #E8ECF1;border-radius:8px;margin-bottom:6px;cursor:pointer;">' +
        '<input type="checkbox" class="lab-svc" data-index="' + i + '">' +
        '<div style="flex:1;">' +
          '<div style="font-weight:600;font-size:13px;">' + s.name + '</div>' +
          '<div style="font-size:11px;color:var(--text-secondary);">⏱️ ' + s.duration + '</div>' +
        '</div>' +
        '<div style="font-weight:700;color:var(--lab-color);font-size:13px;">₦' + s.price.toLocaleString() + '</div>' +
      '</label>';
    }).join('');

    showModal('🔬 ' + lab.name + ' — Book Test',
      '<div style="background:var(--lab-light);padding:10px;border-radius:8px;margin-bottom:12px;">' +
        '<div style="font-size:12px;color:var(--text-secondary);">📍 ' + lab.location + '</div>' +
        '<div style="font-size:12px;">⭐ ' + lab.rating + ' • 🎓 ' + lab.experience + ' years</div>' +
      '</div>' +
      '<div class="form-group"><label style="font-size:12px;font-weight:600;">Select Tests *</label>' +
        '<div style="max-height:280px;overflow-y:auto;">' + servicesHTML + '</div>' +
      '</div>' +
      '<div class="form-group"><label style="font-size:12px;">Preferred Date</label>' +
        '<input type="date" id="lab-date"></div>' +
      '<div class="form-group"><label style="font-size:12px;">Preferred Time</label>' +
        '<select id="lab-time"><option>09:00 AM</option><option>11:00 AM</option><option>02:00 PM</option><option>04:00 PM</option></select></div>' +
      '<div id="lab-total" style="text-align:right;font-size:14px;font-weight:700;color:var(--lab-color);">Total: ₦0</div>',
      '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-lab" onclick="window._labCheckout()">Continue to Payment</button>');

    // Wire checkboxes to update total
    setTimeout(function() {
      document.querySelectorAll('.lab-svc').forEach(function(cb) {
        cb.addEventListener('change', updateTotal);
      });
    }, 50);
  };

  function updateTotal() {
    var total = 0;
    document.querySelectorAll('.lab-svc:checked').forEach(function(cb) {
      var i = parseInt(cb.dataset.index, 10);
      total += LAB_SERVICES[i].price;
    });
    var el = document.getElementById('lab-total');
    if (el) el.textContent = 'Total: ₦' + total.toLocaleString();
    return total;
  }

  window._labCheckout = function() {
    var total = updateTotal();
    if (total === 0) { showToast('⚠️ Pick at least one test'); return; }
    var date = (document.getElementById('lab-date') || {}).value;
    if (!date) { showToast('⚠️ Pick a date'); return; }
    var count = document.querySelectorAll('.lab-svc:checked').length;
    closeModal();
    window.openPaymentFlow(total, 'Lab Tests (' + count + ')', function() {
      showToast('✅ Lab appointment booked!');
    });
  };

  console.log('✅ lab-booking-flow initialized');
})();