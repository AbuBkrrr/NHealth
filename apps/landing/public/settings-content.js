// ============================================
// Settings content — real Terms and Support modals
// Overrides the settings modal with working handlers
// ============================================
(function() {
  'use strict';

  // ---- Terms & Privacy ----
  window.openTerms = function() {
    if (typeof closeModal === 'function') closeModal();
    showModal('📄 Terms & Privacy',
      '<div style="font-size:13px;line-height:1.7;max-height:400px;overflow-y:auto;">' +
        '<h4 style="margin-top:0;">1. Acceptance of Terms</h4>' +
        '<p>By using N-Health, you agree to these terms. N-Health is a platform that connects patients with healthcare providers. We do not provide medical care directly.</p>' +
        '<h4>2. User Responsibilities</h4>' +
        '<p>You are responsible for the accuracy of information you provide. You agree not to misuse the platform.</p>' +
        '<h4>3. Privacy</h4>' +
        '<p>We collect and store data you provide to connect you with providers. We do not sell your data to third parties. Your medical information is shared only with providers you choose to engage.</p>' +
        '<h4>4. Vouchers & Payments</h4>' +
        '<p>In-app vouchers are non-transferable and usable only on the N-Health platform. They cannot be withdrawn as cash. Refunds are subject to specific provider policies.</p>' +
        '<h4>5. Limitation of Liability</h4>' +
        '<p>N-Health is not liable for the quality of care provided by third-party providers. Disputes should be resolved directly with the provider.</p>' +
        '<h4>6. Changes</h4>' +
        '<p>We may update these terms. Continued use constitutes acceptance.</p>' +
        '<p style="color:var(--text-secondary);font-size:11px;margin-top:16px;">Last updated: October 2026</p>' +
      '</div>',
      '<button class="btn btn-primary btn-block" onclick="closeModal()">Close</button>');
  };

  // ---- Help & Support ----
  window.openSupport = function() {
    if (typeof closeModal === 'function') closeModal();
    showModal('🆘 Help & Support',
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
  };

  // ---- Override openSettings with the correct handlers ----
  window.openSettings = function() {
    var currentTheme = localStorage.getItem('theme') || 'light';

    var html = ''
      + '<div class="list-item" style="cursor:pointer;border-bottom:1px solid #E8ECF1;" onclick="window.toggleTheme()">'
      +   '<div class="avatar">' + (currentTheme === 'dark' ? '🌙' : '☀️') + '</div>'
      +   '<div class="content"><div class="title">Theme</div><div class="subtitle" id="theme-label">' + (currentTheme === 'dark' ? 'Dark mode' : 'Light mode') + '</div></div>'
      +   '<div class="trailing">→</div>'
      + '</div>'
      + '<div class="list-item" style="cursor:pointer;border-bottom:1px solid #E8ECF1;" onclick="window.checkUpdates()">'
      +   '<div class="avatar">🔄</div>'
      +   '<div class="content"><div class="title">Check for Updates</div><div class="subtitle">Version 1.0.0</div></div>'
      +   '<div class="trailing">→</div>'
      + '</div>'
      + '<div class="list-item" style="cursor:pointer;border-bottom:1px solid #E8ECF1;" onclick="window.openTerms()">'
      +   '<div class="avatar">📄</div>'
      +   '<div class="content"><div class="title">Terms &amp; Privacy</div><div class="subtitle">Read our policies</div></div>'
      +   '<div class="trailing">→</div>'
      + '</div>'
      + '<div class="list-item" style="cursor:pointer;" onclick="window.openSupport()">'
      +   '<div class="avatar">🆘</div>'
      +   '<div class="content"><div class="title">Help &amp; Support</div><div class="subtitle">Contact us</div></div>'
      +   '<div class="trailing">→</div>'
      + '</div>';

    showModal('⚙️ Settings', html,
      '<button class="btn btn-primary btn-block" onclick="closeModal()">Close</button>');
  };

  console.log('✅ settings-content initialized');
})();