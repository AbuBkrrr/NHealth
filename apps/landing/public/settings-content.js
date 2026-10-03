// ============================================
// Settings — document-level click interceptor
// Catches clicks on Terms/Help items no matter what onclick is set
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

  // Expose globally
  window.openTerms = openTerms;
  window.openSupport = openSupport;

  // ---- Document-level click interceptor ----
  // Runs in CAPTURE phase — happens BEFORE any inline onclick
  // If the click is on a settings item containing "Terms" or "Help", intercept it
  document.addEventListener('click', function(e) {
    var target = e.target;
    var item = null;

    // Walk up to find a .list-item
    while (target && target !== document.body) {
      if (target.classList && target.classList.contains('list-item')) {
        item = target;
        break;
      }
      target = target.parentNode;
    }

    if (!item) return;

    // Is it inside the settings modal?
    var inModal = item.closest('#app-modal');
    if (!inModal) return;

    // Get the item's title text
    var titleEl = item.querySelector('.title');
    if (!titleEl) return;
    var title = titleEl.textContent.trim();

    // Terms
    if (title.indexOf('Terms') === 0) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('🎯 Intercepted Terms click');
      openTerms();
      return false;
    }

    // Help & Support
    if (title.indexOf('Help') === 0 || title.indexOf('Support') === 0) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('🎯 Intercepted Help/Support click');
      openSupport();
      return false;
    }

    // Theme — re-use settings.js handler
    if (title.indexOf('Theme') === 0) {
      if (typeof window.toggleTheme === 'function') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        window.toggleTheme();
        return false;
      }
    }

    // Check for Updates — show a toast
    if (title.indexOf('Check for Updates') === 0) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (typeof showToast === 'function') showToast('✅ You are on the latest version (1.0.0)');
      return false;
    }
  }, true); // <-- TRUE = capture phase

  console.log('✅ settings-content initialized (capture-phase interceptor)');
})();