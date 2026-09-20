// ============================================
// Settings — dark/light mode, app info, updates
// ============================================
(function() {
  'use strict';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.body.style.background = '#121212';
      document.querySelectorAll('.phone-frame').forEach(function(el) {
        el.style.background = '#1a1a1a';
        el.style.color = '#e8e8e8';
      });
      document.querySelectorAll('.card, .app-bar, .status-bar, .bottom-nav').forEach(function(el) {
        el.style.background = '#242424';
        el.style.color = '#e8e8e8';
      });
    } else {
      document.body.style.background = '';
      document.querySelectorAll('.phone-frame').forEach(function(el) {
        el.style.background = '';
        el.style.color = '';
      });
      document.querySelectorAll('.card, .app-bar, .status-bar, .bottom-nav').forEach(function(el) {
        el.style.background = '';
        el.style.color = '';
      });
    }
    localStorage.setItem('theme', theme);
    showToast(theme === 'dark' ? 'Dark mode on' : 'Light mode on');
  }

  function openSettings() {
    var currentTheme = localStorage.getItem('theme') || 'light';

    var html = ''
      + '<div class="list-item" onclick="window.toggleTheme()">'
      +   '<div class="avatar">' + (currentTheme === 'dark' ? '🌙' : '☀️') + '</div>'
      +   '<div class="content"><div class="title">Theme</div><div class="subtitle" id="theme-label">' + (currentTheme === 'dark' ? 'Dark mode' : 'Light mode') + '</div></div>'
      +   '<div class="trailing">→</div>'
      + '</div>'
      + '<div class="list-item" onclick="window.checkUpdates()">'
      +   '<div class="avatar">🔄</div>'
      +   '<div class="content"><div class="title">Check for Updates</div><div class="subtitle">Version 1.0.0</div></div>'
      +   '<div class="trailing">→</div>'
      + '</div>'
      + '<div class="list-item" onclick="showToast(\'Terms: nhealth.com.ng/terms\')">'
      +   '<div class="avatar">📄</div>'
      +   '<div class="content"><div class="title">Terms & Privacy</div><div class="subtitle">Read our policies</div></div>'
      +   '<div class="trailing">→</div>'
      + '</div>'
      + '<div class="list-item" onclick="showToast(\'Support: support@nhealth.com.ng\')">'
      +   '<div class="avatar">🆘</div>'
      +   '<div class="content"><div class="title">Help & Support</div><div class="subtitle">Contact us</div></div>'
      +   '<div class="trailing">→</div>'
      + '</div>';

    showModal('⚙️ Settings', html,
      '<button class="btn btn-primary btn-block" onclick="closeModal()">Close</button>');
  }

  window.toggleTheme = function() {
    var current = localStorage.getItem('theme') || 'light';
    var next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    var label = document.getElementById('theme-label');
    if (label) label.textContent = next === 'dark' ? 'Dark mode' : 'Light mode';
    closeModal();
    setTimeout(openSettings, 200);
  };

  window.checkUpdates = function() {
    showToast('✅ You are on the latest version (1.0.0)');
  };

  // ---- Inject settings cog into profile screens ----
  function injectCog() {
    var profileIds = ['patient-profile', 'doctor-profile', 'pharmacy-profile', 'institution-profile'];
    profileIds.forEach(function(id) {
      var screen = document.getElementById(id);
      if (!screen || screen.dataset.settingsInjected) return;
      var appBar = screen.querySelector('.app-bar');
      if (!appBar) return;
      var area = appBar.querySelector('div');
      if (!area) return;

      var btn = document.createElement('button');
      btn.textContent = '⚙️';
      btn.style.cssText = 'background:none;border:none;font-size:16px;cursor:pointer;color:var(--text-secondary);margin-right:6px;';
      btn.onclick = openSettings;
      area.insertBefore(btn, area.firstChild);
      screen.dataset.settingsInjected = 'true';
    });
  }

  function init() {
    var savedTheme = localStorage.getItem('theme');
    if (savedTheme) applyTheme(savedTheme);
    setTimeout(injectCog, 400);
    console.log('✅ settings initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();