// ============================================
// Settings — theme, updates, terms, help & support with FAQs and in-app messaging
// Single source of truth. Complete rewrite.
// ============================================
(function() {
  'use strict';

  // ============================================================
  // FAQ DATA
  // ============================================================
  var FAQ = [
    { q: 'How do I book an appointment with a doctor?', a: 'Open the Appointments tab. Tap "+ New", select a provider, choose date and time, describe your problem in the notes, and confirm payment. You will be notified once the doctor accepts.' },
    { q: 'How do I use in-app vouchers?', a: 'Vouchers sit in your N-Health wallet. At checkout, select "Wallet" as payment method. Vouchers are non-transferable and cannot be withdrawn as cash.' },
    { q: 'How do I order medicine from a pharmacy?', a: 'Open the Pharmacy tab, browse or search, tap "Add" on any item, then tap the cart icon. Review, tap Checkout, and complete payment.' },
    { q: 'How do I request emergency help?', a: 'Tap the red Emergency button. Select the type of emergency and confirm your location. An ambulance plus up to two emergency doctors will be dispatched. Minimum wallet balance ₦5,000 required.' },
    { q: 'Where can I see my lab test results?', a: 'Results appear in your Labs tab within the timeframe shown when you booked. You will get a notification when ready. Tap to view or download the PDF report.' },
    { q: 'How do I update my profile information?', a: 'Profile tab > tap "Edit" > update any field > Save. Blood group and genotype can only be changed twice for medical accuracy.' },
    { q: 'How do I register as a provider?', a: 'On sign-in, tap "Sign Up" > Providers. Choose your provider type and specialty, then fill in your details including your medical license number.' },
    { q: 'How do I link my NHIS account?', a: 'Profile > Edit > enter your NHIS number > Save. Status will show "Pending Verification" until our team confirms with the scheme (1-3 business days).' },
    { q: 'What if I need to cancel an appointment?', a: 'Appointments tab > find the appointment > "Cancel". You will be asked for a reason. Cancelled appointments are not eligible for refunds — please reschedule instead.' },
    { q: 'Is my medical data secure?', a: 'Yes. Data is encrypted in transit and at rest. We never sell your data. Medical info is shared only with providers you engage for a specific service.' },
    { q: 'How do I contact a provider directly?', a: 'Providers tab > tap a provider card > "Book Now" (Doctor/Nurse/Ambulance) or "Explore" (Pharmacy). Or use Messages once you have an active booking.' },
    { q: 'What payment methods are accepted?', a: 'Debit Card (Visa, Mastercard, Verve), Bank Transfer, and Wallet balance (in-app vouchers). All payments are PCI-compliant.' },
  ];

  // ============================================================
  // STORAGE
  // ============================================================
  function loadTickets() {
    try { return JSON.parse(localStorage.getItem('nhealth_support_tickets_v1') || '[]'); } catch (e) { return []; }
  }
  function saveTickets(arr) {
    try { localStorage.setItem('nhealth_support_tickets_v1', JSON.stringify(arr)); } catch (e) {}
  }
  function uuid() {
    return 'tkt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function escapeHTML(s) {
    return String(s || '').replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg) {
    if (typeof showToast === 'function') showToast(msg);
    else console.log('[toast]', msg);
  }

  // ============================================================
  // THEME
  // ============================================================
  window.toggleTheme = function() {
    var current = localStorage.getItem('theme') || 'light';
    var next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    if (next === 'dark') {
      document.body.style.background = '#121212';
      document.querySelectorAll('.phone-frame').forEach(function(el) { el.style.background = '#1a1a1a'; el.style.color = '#e8e8e8'; });
      document.querySelectorAll('.card, .app-bar, .status-bar, .bottom-nav').forEach(function(el) { el.style.background = '#242424'; el.style.color = '#e8e8e8'; });
    } else {
      document.body.style.background = '';
      document.querySelectorAll('.phone-frame, .card, .app-bar, .status-bar, .bottom-nav').forEach(function(el) { el.style.background = ''; el.style.color = ''; });
    }
    toast(next === 'dark' ? '🌙 Dark mode on' : '☀️ Light mode on');
    setTimeout(window.openSettings, 150);
  };

  window.checkUpdates = function() { toast('✅ You are on the latest version (1.0.0)'); };

  // ============================================================
  // SETTINGS MODAL
  // ============================================================
  window.openSettings = function() {
    if (typeof closeModal === 'function') closeModal();
    var currentTheme = localStorage.getItem('theme') || 'light';
    var html = ''
      + '<div class="list-item" style="cursor:pointer;border-bottom:1px solid #E8ECF1;" onclick="window.toggleTheme()">'
      +   '<div class="avatar">' + (currentTheme === 'dark' ? '🌙' : '☀️') + '</div>'
      +   '<div class="content"><div class="title">Theme</div><div class="subtitle">' + (currentTheme === 'dark' ? 'Dark mode' : 'Light mode') + '</div></div>'
      +   '<div class="trailing">→</div>'
      + '</div>'
      + '<div class="list-item" style="cursor:pointer;border-bottom:1px solid #E8ECF1;" onclick="window.checkUpdates()">'
      +   '<div class="avatar">🔄</div>'
      +   '<div class="content"><div class="title">Check for Updates</div><div class="subtitle">Version 1.0.0</div></div>'
      +   '<div class="trailing">→</div>'
      + '</div>'
      + '<div class="list-item" style="cursor:pointer;border-bottom:1px solid #E8ECF1;" onclick="window.openTermsPage()">'
      +   '<div class="avatar">📄</div>'
      +   '<div class="content"><div class="title">Terms &amp; Privacy</div><div class="subtitle">Read our policies</div></div>'
      +   '<div class="trailing">→</div>'
      + '</div>'
      + '<div class="list-item" style="cursor:pointer;" onclick="window.openSupportPage()">'
      +   '<div class="avatar">🆘</div>'
      +   '<div class="content"><div class="title">Help &amp; Support</div><div class="subtitle">FAQs, messaging &amp; contact</div></div>'
      +   '<div class="trailing">→</div>'
      + '</div>';
    showModal('⚙️ Settings', html,
      '<button class="btn btn-primary btn-block" onclick="closeModal()">Close</button>');
  };

  // ============================================================
  // TERMS PAGE (inline modal)
  // ============================================================
  window.openTermsPage = function() {
    if (typeof closeModal === 'function') closeModal();
    showModal('📄 Terms & Privacy',
      '<div style="font-size:13px;line-height:1.7;max-height:400px;overflow-y:auto;">'
      + '<h4>1. Acceptance of Terms</h4><p>By using N-Health you agree to these terms. N-Health is a platform that connects patients with healthcare providers. We do not provide medical care directly.</p>'
      + '<h4>2. User Responsibilities</h4><p>You are responsible for the accuracy of information you provide.</p>'
      + '<h4>3. Privacy</h4><p>We do not sell your data. Medical info is shared only with providers you engage.</p>'
      + '<h4>4. Vouchers &amp; Payments</h4><p>In-app vouchers are non-transferable and usable only on N-Health.</p>'
      + '<h4>5. Limitation of Liability</h4><p>N-Health is not liable for third-party care quality.</p>'
      + '<h4>6. Changes</h4><p>We may update these terms. Continued use means acceptance.</p>'
      + '<p style="color:var(--text-secondary);font-size:11px;margin-top:16px;">Last updated: October 2026</p>'
      + '</div>',
      '<button class="btn btn-primary btn-block" onclick="window.openSettings()">Back</button>');
  };

  // ============================================================
  // HELP & SUPPORT
  // ============================================================
  window.openSupportPage = function() {
    if (typeof closeModal === 'function') closeModal();
    var tickets = loadTickets();

    var html =
      '<div style="font-size:13px;">'

      + '<div style="font-weight:600;margin-bottom:8px;">Contact Us</div>'

      + '<button type="button" onclick="window.supportEmail()" style="width:100%;background:none;border:none;text-align:left;padding:0;cursor:pointer;font-family:inherit;">'
      +   '<div class="list-item" style="border-bottom:1px solid #E8ECF1;">'
      +     '<div class="avatar">📧</div>'
      +     '<div class="content"><div class="title">Email Support</div><div class="subtitle">support@nhealth.com.ng</div></div>'
      +     '<div class="trailing">→</div>'
      +   '</div>'
      + '</button>'

      + '<button type="button" onclick="window.supportCall()" style="width:100%;background:none;border:none;text-align:left;padding:0;cursor:pointer;font-family:inherit;">'
      +   '<div class="list-item" style="border-bottom:1px solid #E8ECF1;">'
      +     '<div class="avatar">📞</div>'
      +     '<div class="content"><div class="title">Call Support</div><div class="subtitle">+234 800 000 0000</div></div>'
      +     '<div class="trailing">→</div>'
      +   '</div>'
      + '</button>'

      + '<button type="button" onclick="window.supportWhatsApp()" style="width:100%;background:none;border:none;text-align:left;padding:0;cursor:pointer;font-family:inherit;">'
      +   '<div class="list-item" style="border-bottom:1px solid #E8ECF1;">'
      +     '<div class="avatar">💬</div>'
      +     '<div class="content"><div class="title">WhatsApp</div><div class="subtitle">Chat with us</div></div>'
      +     '<div class="trailing">→</div>'
      +   '</div>'
      + '</button>'

      + '<div style="font-weight:600;margin:16px 0 8px 0;">Send a Message</div>'

      + '<button type="button" onclick="window.openSupportComposer()" style="width:100%;background:var(--primary-light);border:none;text-align:left;padding:14px;border-radius:10px;cursor:pointer;font-family:inherit;">'
      +   '<div style="display:flex;align-items:center;gap:12px;">'
      +     '<div style="font-size:26px;">✉️</div>'
      +     '<div style="flex:1;">'
      +       '<div style="font-weight:600;font-size:14px;color:var(--primary);">Send us a message</div>'
      +       '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">We usually reply within 24 hours</div>'
      +     '</div>'
      +     '<div style="color:var(--primary);font-weight:700;">→</div>'
      +   '</div>'
      + '</button>'

      + '<button type="button" onclick="window.openFAQPage()" style="width:100%;background:#E8F5E9;border:none;text-align:left;padding:14px;border-radius:10px;cursor:pointer;font-family:inherit;margin-top:8px;">'
      +   '<div style="display:flex;align-items:center;gap:12px;">'
      +     '<div style="font-size:26px;">❓</div>'
      +     '<div style="flex:1;">'
      +       '<div style="font-weight:600;font-size:14px;color:#2E7D32;">Browse FAQs</div>'
      +       '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">' + FAQ.length + ' answers to common questions</div>'
      +     '</div>'
      +     '<div style="color:#2E7D32;font-weight:700;">→</div>'
      +   '</div>'
      + '</button>'

      + (tickets.length > 0
          ? '<div style="font-weight:600;margin:16px 0 8px 0;">My Messages</div>'
            + '<button type="button" onclick="window.openSupportInbox()" style="width:100%;background:none;border:none;text-align:left;padding:0;cursor:pointer;font-family:inherit;">'
            +   '<div class="list-item">'
            +     '<div class="avatar">📨</div>'
            +     '<div class="content"><div class="title">View my messages</div><div class="subtitle">' + tickets.length + ' ticket' + (tickets.length > 1 ? 's' : '') + '</div></div>'
            +     '<div class="trailing">→</div>'
            +   '</div>'
            + '</button>'
          : '')

      + '<div style="margin-top:16px;padding:12px;background:var(--surface);border-radius:8px;font-size:12px;color:var(--text-secondary);text-align:center;">🕐 Mon–Fri, 8am–8pm WAT</div>'
      + '</div>';

    showModal('🆘 Help & Support', html,
      '<button class="btn btn-outline" onclick="window.openSettings()">Back</button>' +
      '<button class="btn btn-primary" onclick="closeModal()">Close</button>');
  };

  // ============================================================
  // FAQ PAGE
  // ============================================================
  window.openFAQPage = function() {
    if (typeof closeModal === 'function') closeModal();
    var html = '<div style="max-height:450px;overflow-y:auto;padding-right:4px;">'
      + FAQ.map(function(item, i) {
          return '<div style="border:1px solid #E8ECF1;border-radius:8px;margin-bottom:8px;overflow:hidden;">'
            + '<button type="button" onclick="window.toggleFAQ(' + i + ')" style="width:100%;background:white;border:none;text-align:left;padding:12px;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:10px;">'
            +   '<div style="flex:1;font-weight:600;font-size:13px;">' + escapeHTML(item.q) + '</div>'
            +   '<div id="faq-icon-' + i + '" style="font-size:14px;color:var(--primary);">+</div>'
            + '</button>'
            + '<div id="faq-answer-' + i + '" style="display:none;padding:0 12px 12px 12px;font-size:12px;line-height:1.7;color:var(--text-secondary);">' + escapeHTML(item.a) + '</div>'
            + '</div>';
        }).join('')
      + '</div>';
    showModal('❓ FAQs', html,
      '<button class="btn btn-outline" onclick="window.openSupportPage()">Back</button>'
      + '<button class="btn btn-primary" onclick="window.openSupportComposer()">Still Need Help?</button>');
  };

  window.toggleFAQ = function(i) {
    var a = document.getElementById('faq-answer-' + i);
    var ic = document.getElementById('faq-icon-' + i);
    if (!a || !ic) return;
    if (a.style.display === 'none' || !a.style.display) { a.style.display = 'block'; ic.textContent = '−'; }
    else { a.style.display = 'none'; ic.textContent = '+'; }
  };

  // ============================================================
  // CONTACT ACTIONS
  // ============================================================
  window.supportEmail = function() {
    window.location.href = 'mailto:support@nhealth.com.ng?subject=' + encodeURIComponent('N-Health Support');
    toast('📧 Opening email app...');
  };
  window.supportCall = function() {
    window.location.href = 'tel:+2348000000000';
    toast('📞 Opening dialer...');
  };
  window.supportWhatsApp = function() {
    window.open('https://wa.me/2348000000000', '_blank');
    toast('💬 Opening WhatsApp...');
  };

  // ============================================================
  // COMPOSER
  // ============================================================
  window.openSupportComposer = function() {
    if (typeof closeModal === 'function') closeModal();
    showModal('✉️ New Message',
      '<div class="form-group"><label>Subject *</label><input type="text" id="tkt-subject" placeholder="E.g., Appointment issue" maxlength="80"></div>'
      + '<div class="form-group"><label>Category</label><select id="tkt-category">'
      + '<option>General Inquiry</option><option>Appointment Issue</option><option>Pharmacy / Order</option>'
      + '<option>Lab Test</option><option>Payment / Voucher</option><option>Account &amp; Profile</option>'
      + '<option>Technical Problem</option><option>Other</option></select></div>'
      + '<div class="form-group"><label>Message *</label>'
      + '<textarea id="tkt-message" rows="5" maxlength="1000" placeholder="Describe your issue in detail..." style="width:100%;padding:8px 12px;font-family:inherit;font-size:13px;border:1px solid #E8ECF1;border-radius:8px;resize:vertical;"></textarea></div>'
      + '<div class="form-group"><label>Priority</label><select id="tkt-priority">'
      + '<option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>',
      '<button class="btn btn-outline" onclick="window.openSupportPage()">Back</button>'
      + '<button class="btn btn-primary" onclick="window.submitSupportTicket()">📤 Send</button>');
  };

  window.submitSupportTicket = function() {
    var subject = (document.getElementById('tkt-subject') || {}).value || '';
    var category = (document.getElementById('tkt-category') || {}).value || '';
    var message = (document.getElementById('tkt-message') || {}).value || '';
    var priority = (document.getElementById('tkt-priority') || {}).value || 'normal';

    if (subject.trim().length < 3) { toast('⚠️ Subject must be at least 3 characters'); return; }
    if (message.trim().length < 10) { toast('⚠️ Message must be at least 10 characters'); return; }

    var user = {};
    try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch (e) {}

    var ticket = {
      id: uuid(),
      subject: subject.trim(),
      category: category,
      message: message.trim(),
      priority: priority,
      status: 'open',
      createdAt: new Date().toISOString(),
      userEmail: user.email || 'unknown',
      userName: user.name || 'Anonymous',
      replies: [],
    };

    var tickets = loadTickets();
    tickets.unshift(ticket);
    saveTickets(tickets);
    console.log('📨 Support ticket created:', ticket.id);

    try {
      fetch('https://n-health-backend-production.up.railway.app/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticket),
      }).catch(function() {});
    } catch (e) {}

    if (typeof closeModal === 'function') closeModal();
    toast('✅ Message sent! We will reply within 24 hours.');
    setTimeout(function() { window.openSupportTicketDetail(ticket.id); }, 500);
  };

  // ============================================================
  // INBOX
  // ============================================================
  window.openSupportInbox = function() {
    var tickets = loadTickets();
    if (!tickets.length) { toast('📭 No messages yet'); return; }
    var rows = tickets.map(function(t) {
      var date = new Date(t.createdAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
      var statusLabel = t.status === 'closed' ? 'Closed' : (t.status === 'answered' ? '✓ Answered' : '⏳ Open');
      var statusColor = t.status === 'closed' ? 'var(--text-light)' : (t.status === 'answered' ? 'var(--success)' : 'var(--primary)');
      return '<div class="list-item" style="cursor:pointer;border-bottom:1px solid #E8ECF1;" onclick="window.openSupportTicketDetail(\'' + t.id + '\')">'
        + '<div class="avatar" style="background:' + statusColor + '22;color:' + statusColor + ';">📨</div>'
        + '<div class="content"><div class="title">' + escapeHTML(t.subject) + '</div>'
        + '<div class="subtitle">' + escapeHTML(t.category) + ' • ' + date + '</div></div>'
        + '<div class="trailing" style="font-size:10px;color:' + statusColor + ';font-weight:600;">' + statusLabel + '</div></div>';
    }).join('');
    if (typeof closeModal === 'function') closeModal();
    showModal('📨 My Messages', rows,
      '<button class="btn btn-outline" onclick="window.openSupportPage()">Back</button>'
      + '<button class="btn btn-primary" onclick="window.openSupportComposer()">+ New</button>');
  };

  window.openSupportTicketDetail = function(id) {
    var t = loadTickets().find(function(x) { return x.id === id; });
    if (!t) { toast('⚠️ Ticket not found'); return; }
    var date = new Date(t.createdAt).toLocaleString('en-NG');
    var replies = (t.replies || []).map(function(r) {
      return '<div style="padding:10px;margin-top:8px;border-radius:8px;background:' + (r.from === 'admin' ? 'var(--primary-light)' : 'var(--surface)') + ';">'
        + '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">' + (r.from === 'admin' ? '👤 Support' : '🫵 You') + '</div>'
        + '<div style="font-size:13px;">' + escapeHTML(r.message) + '</div></div>';
    }).join('');
    if (typeof closeModal === 'function') closeModal();
    showModal('📩 ' + t.subject,
      '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">' + escapeHTML(t.category) + ' • ' + t.priority + ' • ' + date + '</div>'
      + '<div style="padding:12px;background:var(--surface);border-radius:8px;font-size:13px;line-height:1.6;">' + escapeHTML(t.message) + '</div>'
      + (replies || '<div style="margin-top:12px;padding:10px;background:#FEF7E0;border-radius:8px;font-size:12px;color:var(--text-secondary);">⏳ Awaiting response</div>'),
      '<button class="btn btn-outline" onclick="window.openSupportInbox()">Back</button>'
      + (t.status !== 'closed' ? '<button class="btn btn-danger" onclick="window.closeSupportTicket(\'' + t.id + '\')">Close</button>' : ''));
  };

  window.closeSupportTicket = function(id) {
    var ts = loadTickets();
    var i = ts.findIndex(function(x) { return x.id === id; });
    if (i === -1) return;
    ts[i].status = 'closed';
    saveTickets(ts);
    toast('✅ Ticket closed');
    window.openSupportInbox();
  };

  // ============================================================
  // INJECT SETTINGS COG INTO PROFILE SCREENS
  // ============================================================
  function injectCog() {
    ['patient-profile', 'doctor-profile', 'pharmacy-profile', 'institution-profile'].forEach(function(id) {
      var s = document.getElementById(id);
      if (!s || s.dataset.settingsInjected) return;
      var bar = s.querySelector('.app-bar');
      if (!bar) return;
      var area = bar.querySelector('div');
      if (!area) return;
      var btn = document.createElement('button');
      btn.textContent = '⚙️';
      btn.style.cssText = 'background:none;border:none;font-size:16px;cursor:pointer;color:var(--text-secondary);margin-right:6px;';
      btn.onclick = window.openSettings;
      area.insertBefore(btn, area.firstChild);
      s.dataset.settingsInjected = 'true';
    });
  }

  function init() {
    var t = localStorage.getItem('theme');
    if (t === 'dark') {
      document.body.style.background = '#121212';
      document.querySelectorAll('.phone-frame').forEach(function(el) { el.style.background = '#1a1a1a'; el.style.color = '#e8e8e8'; });
    }
    setTimeout(injectCog, 400);
    setInterval(injectCog, 2000);
    console.log('✅ settings.js v2 initialized (FAQs: ' + FAQ.length + ')');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
