(function() {
  'use strict';
  function byId(id) { return document.getElementById(id); }
  function setDisplay(el, d) { if (el) el.style.display = d; }
  var signupMode = false;

  // ---- 1. Confirm password injector ----
  function addConfirmPassword() {
    var rf = byId('registerForm');
    if (!rf || byId('reg-password2')) return;
    var pwInputs = rf.querySelectorAll('input[type="password"]');
    var lastPw = pwInputs[pwInputs.length - 1];
    if (!lastPw) return;
    var grp = document.createElement('div');
    grp.className = 'form-group';
    grp.innerHTML = '<label>Confirm Password <span style="color:var(--error);">*</span></label>' +
      '<input type="password" placeholder="Re-enter password" id="reg-password2">';
    lastPw.closest('.form-group').insertAdjacentElement('afterend', grp);
  }

  // ---- 2. Mode switching ----
  function setSignupMode(on) {
    signupMode = on;
    var roleSelector = document.querySelector('.auth-role-selector');
    var providerView = byId('provider-role-view');
    var instForm = byId('institution-register-form');
    var specSection = byId('specialty-section');
    var registerForm = byId('registerForm');
    var loginEmail = byId('login-email');
    var loginPass = byId('login-password');
    var loginBtn = byId('login-btn');
    var googleContainer = byId('google-btn-container');
    var googleFallbackParent = byId('btn-google-fallback') ? byId('btn-google-fallback').parentElement : null;
    var backBtn = byId('signup-back-btn');

    if (on) {
      setDisplay(roleSelector, 'grid');
      setDisplay(registerForm, 'block');
      setDisplay(loginEmail && loginEmail.closest('.form-group'), 'none');
      setDisplay(loginPass && loginPass.closest('.form-group'), 'none');
      setDisplay(loginBtn, 'none');
      setDisplay(googleContainer, 'none');
      setDisplay(googleFallbackParent, 'none');
      var forgotLink = document.querySelector('a[onclick*="openForgotPassword"]');
      if (forgotLink) setDisplay(forgotLink.closest('div'), 'none');
      if (!backBtn) addBackButton();
    } else {
      setDisplay(roleSelector, 'none');
      setDisplay(providerView, 'none');
      setDisplay(instForm, 'none');
      setDisplay(specSection, 'none');
      setDisplay(registerForm, 'none');
      setDisplay(loginEmail && loginEmail.closest('.form-group'), 'block');
      setDisplay(loginPass && loginPass.closest('.form-group'), 'block');
      setDisplay(loginBtn, 'inline-flex');
      setDisplay(googleContainer, 'flex');
      setDisplay(googleFallbackParent, 'block');
      var forgotLink = document.querySelector('a[onclick*="openForgotPassword"]');
      if (forgotLink) setDisplay(forgotLink.closest('div'), 'block');
      if (backBtn) backBtn.remove();
      window.selectedProviderRole = 'PATIENT';
      window.selectedSpecialty = '';
    }
  }

  function addBackButton() {
    var rf = byId('registerForm');
    if (!rf) return;
    var btn = document.createElement('button');
    btn.id = 'signup-back-btn';
    btn.type = 'button';
    btn.className = 'btn btn-outline btn-block';
    btn.style.marginTop = '12px';
    btn.textContent = '← Back to Sign In';
    btn.onclick = function() { setSignupMode(false); };
    rf.appendChild(btn);
  }

  // ---- 3. Update the login button text dynamically ----
  function updateLoginBtn(role) {
    var btn = byId('login-btn');
    if (!btn) return;
    if (!role || role === 'PATIENT' || role === 'patient') {
      btn.textContent = 'Sign In';
    } else {
      var label = String(role).charAt(0).toUpperCase() + String(role).slice(1).toLowerCase();
      btn.textContent = 'Sign In as ' + label;
    }
  }

  // ---- 4. Wrap showRegister ----
  var origShowRegister = window.showRegister;
  window.showRegister = function() {
    if (typeof origShowRegister === 'function') origShowRegister.apply(this, arguments);
    setSignupMode(true);
  };

  // ---- 5. Wrap selectProviderRole to update login button ----
  var origSelProv = window.selectProviderRole;
  window.selectProviderRole = function(role) {
    if (typeof origSelProv === 'function') origSelProv.apply(this, arguments);
    updateLoginBtn(role);
  };
  var origSelRole = window.selectRole;
  window.selectRole = function(role) {
    if (typeof origSelRole === 'function') origSelRole.apply(this, arguments);
    updateLoginBtn(role);
  };

  // ---- 6. Override registerUser to include confirm password + role + specialty ----
  window.registerUser = async function() {
    var name = (byId('reg-name') || {}).value;
    var email = (byId('reg-email') || {}).value;
    var phone = (byId('reg-phone') || {}).value;
    var password = (byId('reg-password') || {}).value;
    var password2 = (byId('reg-password2') || {}).value;

    if (!name || !email || !password) { if (typeof showToast === 'function') showToast('⚠️ Please fill in all required fields'); return; }
    if (password.length < 8) { showToast('⚠️ Password must be at least 8 characters'); return; }
    if (password !== password2) { showToast('⚠️ Passwords do not match'); return; }

    var role = (window.selectedProviderRole || 'PATIENT').toUpperCase();
    var profile = window.selectedSpecialty ? { specialty: window.selectedSpecialty } : undefined;

    try {
      var res = await fetch(API_BASE_URL + '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password, role, profile })
      });
      var data = {};
      try { data = await res.json(); } catch (e) {}
      console.log('REGISTER RESPONSE:', data);
      if (res.ok) {
        showToast('✅ Account created! Please sign in.');
        setSignupMode(false);
        var le = byId('login-email');
        if (le) le.value = email;
        ['reg-name','reg-email','reg-phone','reg-password','reg-password2'].forEach(function(id) {
          var el = byId(id);
          if (el) el.value = '';
        });
      } else {
        showToast('❌ ' + (data.message || data.error || 'Registration failed.'));
      }
    } catch (err) {
      console.error('Registration error:', err);
      showToast('❌ Network error. Please try again.');
    }
  };

  // ---- Init ----
  function init() {
    addConfirmPassword();
    setTimeout(function() {
      updateLoginBtn('PATIENT');
      setSignupMode(false);
      console.log('✅ auth-clean initialized');
    }, 100);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();