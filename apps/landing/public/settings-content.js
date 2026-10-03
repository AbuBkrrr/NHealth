// ============================================
// Settings content — bulletproof rebind
// Watches for settings modal and rebinds buttons
// ============================================
(function() {
  'use strict';

  // ---- Terms & Privacy modal ----
  function openTerms() {
    if (typeof closeModal === 'function') closeModal();
    showModal('📄 Terms & Privacy',
      '<div style="font-size:13px;line-height:1.7;max-height:400px;overflow-y:auto;">' +
        '<h4 style="margin-top:0;">1. Acceptance of Terms</h4>' +
        '<p>By using N-Health, you agree to these terms. N-Health is a platform that connects patients with healthcare providers. We do not provide medical care directly.</p>' +
        '<h4>2. User Responsibilities</h4>' +
        '<p>You are responsible for the accuracy of information you provide.</p>' +
        '<h4>3. Privacy</h4>' +
        '<p>We do not sell your data. Medical information is shared only with providers you choose to engage.</p>' +
        '<h4>4. Vouchers &amp; Payments</h4>' +
        '<p>In-app vouchers are non-transferable and usable only on the N-Health platform.</p>' +
        '<h4>5. Limitation of Liability</h4>' +
        '<p>N-Health is not liable for the quality of care provided by third-party providers.</p>' +
        '<h4>6. Changes</h4>' +
        '<p>We may update these terms. Continued use constitutes acceptance.</p>' +
        '<p style="color:var(--text-secondary);font-size:11px;margin-top:16px;">Last updated: October 2026</p>' +
      '</div>',
      '<button class="btn btn-primary btn-block" onclick="closeModal()">Close</button>');
  }

  // ---- Help & Support modal ----
  function openSupport() {
    if (typeof closeModal === 'function') closeModal();
    showModal('🆘 Help &amp; Support',
      '<div style="font-size:13px;">' +
        '<a href="mailto:support@nhealth.com.ng" style="text-decoration:none;color:inherit;display:block;">' +
          '<div class="list-item" style="border-bottom:1px solid #E8ECF1;">' +
            '<div class="avatar">📧</div>' +
            '<div class="content"><div class="title">Email Support</div><div class="subtitle">support@nhealth.com.ng</div></div>' +
            '<div class="trailing">→</div>' +
          '</div>' +
        '</a>' +
        '<a href="tel:+2348000000000" style="text-decoration:none;color:inherit;display:block;">' +
          '<div class="list-item" style="border-bottom:1px solid #E8ECF1;">' +
            '<div class="avatar">📞</div>' +
            '<div class="content"><div class="title">Call Support</div><div class="subtitle">+234 800 000 0000</div></div>' +
            '<div class="trailing">→</div>' +
          '</div>' +
        '</a>' +
        '<div class="list-item" style="cursor:pointer;" onclick="closeModal();showToast(\'❓ FAQ opening soon\')">' +
          '<div class="avatar">❓</div>' +
          '<div class="content"><div class="title">FAQ</div><div class="subtitle">Common questions answered</div></div>' +
          '<div class="trailing">→</div>' +
        '</div>' +
        '<div style="margin-top:16px;padding:12px;background:var(--surface);border-radius:8px;font-size:12px;color:var(--text-secondary);">' +
          '🕐 Support hours: Mon–Fri, 8am–8pm WAT' +
        '</div>' +
      '</div>',
      '<button class="btn btn-primary btn-block" onclick="closeModal()">Close</button>');
  }

  // ---- Rebind the settings modal buttons ----
  function rebindSettingsModal() {
    var modal = document.getElementById('app-modal');
    if (!modal) return;
    if (modal.dataset.settingsRebound === 'true') return;

    // Find items by their title text
    var items = modal.querySelectorAll('.list-item');
    var rebound = 0;

    items.forEach(function(item) {
      var titleEl = item.querySelector('.title');
      if (!titleEl) return;
      var title = titleEl.textContent.trim();

      if (title.indexOf('Terms') === 0 || title.indexOf('Terms &') === 0) {
        item.onclick = function(e) { e.preventDefault(); e.stopPropagation(); openTerms(); return false; };
        item.style.cursor = 'pointer';
        item.removeAttribute('onclick');
        rebound++;
      }

      if (title.indexOf('Help &') === 0 || title.indexOf('Help') === 0) {
        item.onclick = function(e) { e.preventDefault(); e.stopPropagation(); openSupport(); return false; };
        item.style.cursor = 'pointer';
        item.removeAttribute('onclick');
        rebound++;
      }
    });

    if (rebound > 0) {
      modal.dataset.settingsRebound = 'true';
      console.log('✅ Rebound ' + rebound + ' settings items');
    }
  }

  // ---- Expose globally too ----
  window.openTerms = openTerms;
  window.openSupport = openSupport;
  window._rebindSettings = rebindSettingsModal;

  // ---- Watch for the settings modal appearing ----
  var observer = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      for (var j = 0; j < m.addedNodes.length; j++) {
        var node = m.addedNodes[j];
        if (node.nodeType === 1) {
          if (node.id === 'app-modal') {
            // Modal was just added — rebind after a tick
            setTimeout(rebindSettingsModal, 30);
          }
          // Also check if it contains the modal
          if (node.querySelector && node.querySelector('#app-modal')) {
            setTimeout(rebindSettingsModal, 30);
          }
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  console.log('✅ settings-content initialized (observer active)');
})();