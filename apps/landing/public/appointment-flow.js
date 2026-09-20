// ============================================
// Appointments — reschedule, cancel reasons, pre-payment notes
// ============================================
(function() {
  'use strict';

  window.rescheduleAppointment = function(providerName, oldDate, oldTime) {
    var html = ''
      + '<div style="background:var(--surface);padding:12px;border-radius:8px;margin-bottom:12px;">'
      +   '<div style="font-weight:600;">' + providerName + '</div>'
      +   '<div style="font-size:12px;color:var(--text-secondary);">Current: ' + oldDate + ' at ' + oldTime + '</div>'
      + '</div>'
      + '<div class="form-group"><label>New Date</label><input type="date" id="rs-date"></div>'
      + '<div class="form-group"><label>New Time</label><select id="rs-time">'
      +   '<option>09:00 AM</option><option>10:00 AM</option><option>11:00 AM</option>'
      +   '<option>02:00 PM</option><option>03:00 PM</option><option>04:00 PM</option>'
      + '</select></div>'
      + '<div class="form-group"><label>Reason for Reschedule (optional)</label>'
      +   '<textarea rows="2" id="rs-reason" style="padding:8px 12px;font-size:13px;font-family:inherit;width:100%;" placeholder="e.g., Conflict with work"></textarea></div>';

    showModal('📅 Reschedule Appointment', html,
      '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" onclick="window.confirmReschedule(\'' + providerName + '\')">Confirm</button>');
  };

  window.confirmReschedule = function(providerName) {
    var d = (document.getElementById('rs-date') || {}).value;
    var t = (document.getElementById('rs-time') || {}).value;
    if (!d) { showToast('⚠️ Please pick a new date'); return; }
    closeModal();
    showToast('✅ Rescheduled with ' + providerName + ' to ' + d + ' at ' + t);
  };

  window.cancelAppointment = function(providerName) {
    var html = ''
      + '<div style="background:#FFF5F5;border:1px solid var(--error);padding:10px;border-radius:8px;margin-bottom:12px;">'
      +   '<div style="font-weight:600;font-size:13px;color:var(--error);">⚠️ No Refunds</div>'
      +   '<div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">Cancelled appointments will not receive a refund.</div>'
      + '</div>'
      + '<div class="form-group"><label>Cancellation Reason *</label>'
      +   '<select id="cn-reason">'
      +     '<option value="">-- Select a reason --</option>'
      +     '<option>Schedule conflict</option>'
      +     '<option>Feeling better</option>'
      +     '<option>Found another doctor</option>'
      +     '<option>Financial reasons</option>'
      +     '<option>Emergency elsewhere</option>'
      +     '<option>Other</option>'
      +   '</select></div>'
      + '<div class="form-group"><label>Additional Comments</label>'
      +   '<textarea rows="2" id="cn-comment" style="padding:8px 12px;font-size:13px;font-family:inherit;width:100%;" placeholder="Optional details..."></textarea></div>';

    showModal('❌ Cancel Appointment', html,
      '<button class="btn btn-outline" onclick="closeModal()">Keep</button>' +
      '<button class="btn btn-danger" onclick="window.confirmCancel(\'' + providerName + '\')">Confirm Cancellation</button>');
  };

  window.confirmCancel = function(providerName) {
    var reason = (document.getElementById('cn-reason') || {}).value;
    if (!reason) { showToast('⚠️ Please select a reason'); return; }
    closeModal();
    showToast('Appointment cancelled (No refund)');
    setTimeout(function() {
      var homeBtn = document.querySelector('#patient-nav button[data-screen="patient-home"]');
      if (homeBtn) homeBtn.click();
    }, 900);
  };

  function enhanceAppointments() {
    document.querySelectorAll('#p-upcoming .card').forEach(function(card) {
      if (card.dataset.enhanced) return;
      card.dataset.enhanced = 'true';
      var providerName = (card.querySelector('.title') || {}).textContent || 'Provider';

      var actions = card.querySelector('div[style*="display:flex"]');
      if (!actions) return;

      var acceptBtn = actions.querySelector('.btn-success');
      if (acceptBtn) {
        acceptBtn.onclick = function() {
          showToast('✅ Appointment accepted!');
          setTimeout(function() {
            var homeBtn = document.querySelector('#patient-nav button[data-screen="patient-home"]');
            if (homeBtn) homeBtn.click();
          }, 900);
        };
      }

      var cancelBtn = actions.querySelector('.btn-danger');
      if (cancelBtn) {
        cancelBtn.onclick = function() { window.cancelAppointment(providerName); };
      }

      if (!actions.querySelector('.reschedule-btn')) {
        var rsBtn = document.createElement('button');
        rsBtn.className = 'btn btn-primary btn-sm reschedule-btn';
        rsBtn.textContent = '📅 Reschedule';
        rsBtn.onclick = function() { window.rescheduleAppointment(providerName, 'Today', '10:00 AM'); };
        actions.appendChild(rsBtn);
      }
    });
  }

  function init() {
    var observer = new MutationObserver(function() {
      var screen = document.getElementById('patient-appointments');
      if (screen && screen.classList.contains('active')) {
        setTimeout(enhanceAppointments, 100);
      }
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    enhanceAppointments();
    console.log('✅ appointment-flow initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();