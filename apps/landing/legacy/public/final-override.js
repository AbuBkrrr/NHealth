// ============================================
// FINAL OVERRIDE — Sign-in role selector + role routing
// Sign-in shows 2 cards: Patient | Provider
// Backend resolves PROVIDER to actual role
// ============================================
(function () {
  'use strict';

  var API = 'https://n-health-backend-production.up.railway.app';

  var ROLE_SCREEN = {
    'patient':     'patient-home',
    'doctor':      'doctor-home',
    'pharmacy':    'pharmacy-home',
    'lab':         'lab-home',
    'ambulance':   'ambulance-home',
    'nurse':       'nurse-home',
    'institution': 'institution-home',
    'admin':       'institution-home'
  };

  function routeToRole(role) {
    var r = String(role || 'PATIENT').toLowerCase();
    var target = ROLE_SCREEN[r] || 'patient-home';
    if (!document.getElementById(target)) {
      console.warn('Screen "' + target + '" missing, falling back to patient-home');
      if (typeof showToast === 'function') showToast('⚠️ ' + r + ' dashboard coming soon');
      target = 'patient-home';
    }
    console.log('🔍 FINAL ROUTING to:', target);
    if (typeof navigateTo === 'function') navigateTo(target);
  }

  // ================================================
  // 1. INSERT SIGN-IN ROLE SELECTOR (2 cards)
  // ================================================
  function installSigninSelector() {
    if (document.getElementById('signin-role-selector')) return;

    var selector = document.createElement('div');
    selector.id = 'signin-role-selector';
    selector.className = 'auth-role-selector';
    selector.style.marginBottom = '12px';
    selector.innerHTML =
      '<div class="role-card selected" data-signin-role="PATIENT" onclick="window.selectSigninRole(\'PATIENT\')">' +
        '<div class="icon">👤</div><div class="name">Patient</div><div class="desc">Access healthcare services</div>' +
      '</div>' +
      '<div class="role-card" data-signin-role="PROVIDER" onclick="window.selectSigninRole(\'PROVIDER\')">' +
        '<div class="icon">🏥</div><div class="name">Provider</div><div class="desc">Doctor, Pharmacy, Lab & more</div>' +
      '</div>';

    // Insert right before the Google button container's parent
    var googleContainer = document.getElementById('google-btn-container');
    var googleWrapper = googleContainer ? (googleContainer.closest('div[style*="margin-bottom"]') || googleContainer.parentElement) : null;
    if (googleWrapper && googleWrapper.parentNode) {
      googleWrapper.parentNode.insertBefore(selector, googleWrapper);
      console.log('✅ Sign-in role selector inserted');
    } else {
      // Fallback: insert before login-email's form-group
      var emailInput = document.getElementById('login-email');
      var emailGroup = emailInput ? emailInput.closest('.form-group') : null;
      if (emailGroup && emailGroup.parentNode) {
        emailGroup.parentNode.insertBefore(selector, emailGroup);
        console.log('✅ Sign-in role selector inserted (fallback)');
      }
    }
  }

  // ================================================
  // 2. HANDLE SELECTION
  // ================================================
  window.selectSigninRole = function (role) {
    window.selectedProviderRole = role;
    document.querySelectorAll('#signin-role-selector .role-card').forEach(function (c) {
      c.classList.remove('selected');
    });
    var card = document.querySelector('#signin-role-selector [data-signin-role="' + role + '"]');
    if (card) card.classList.add('selected');

    var btn = document.getElementById('login-btn');
    if (btn) {
      btn.textContent = (role === 'PATIENT') ? 'Sign In as Patient' : 'Sign In as Provider';
    }
  };

  // ================================================
  // 3. LOGIN OVERRIDE
  // ================================================
  window.login = async function () {
    var email = (document.getElementById('login-email') || {}).value;
    var password = (document.getElementById('login-password') || {}).value;

    if (!email || !password) {
      if (typeof showToast === 'function') showToast('⚠️ Please enter your email and password');
      return;
    }

    var btn = document.getElementById('login-btn');
    var origText = btn ? btn.textContent : 'Sign In';
    if (btn) { btn.textContent = 'Signing in...'; btn.disabled = true; }

    // Send PATIENT or PROVIDER (backend resolves PROVIDER → actual role)
    var role = (window.selectedProviderRole || 'PATIENT').toUpperCase();

    try {
      var res = await fetch(API + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password, role: role })
      });
      var data = {};
      try { data = await res.json(); } catch (e) {}
      console.log('🔍 LOGIN RESPONSE:', data);

      if (res.ok) {
        if (data.token) localStorage.setItem('token', data.token);
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
          window.currentUser = data.user;
        }
        if (typeof applyUserToUI === 'function') applyUserToUI(data.user);

        routeToRole(data.user.role);
        if (typeof showToast === 'function') showToast('Welcome back!');
      } else {
        if (typeof showToast === 'function') showToast((data.message || data.error || 'Login failed'));
      }
    } catch (err) {
      console.error('Login error:', err);
      if (typeof showToast === 'function') showToast('❌ Network error. Please try again.');
    } finally {
      if (btn) { btn.textContent = origText; btn.disabled = false; }
    }
  };

  // ================================================
  // 4. BIND BUTTON
  // ================================================
  function bindLoginBtn() {
    var btn = document.getElementById('login-btn');
    if (!btn) return;
    btn.removeAttribute('onclick');
    btn.onclick = function (e) { e.preventDefault(); window.login(); };
  }

  // ================================================
  // 5. INIT
  // ================================================
  function install() {
    installSigninSelector();
    bindLoginBtn();
    window.selectedProviderRole = window.selectedProviderRole || 'PATIENT';
    var btn = document.getElementById('login-btn');
    if (btn) btn.textContent = 'Sign In as Patient';

    // Rebind if recreated
    var observer = new MutationObserver(function () {
      var b = document.getElementById('login-btn');
      if (b && !b._finalBound) {
        b.removeAttribute('onclick');
        b.onclick = function (e) { e.preventDefault(); window.login(); };
        b._finalBound = true;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    console.log('✅ FINAL override installed (2-card sign-in)');
  }

  if (document.readyState === 'complete') {
    setTimeout(install, 150);
  } else {
    window.addEventListener('load', function () { setTimeout(install, 150); });
  }
})();