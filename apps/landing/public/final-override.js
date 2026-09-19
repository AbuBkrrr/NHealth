// ============================================
// FINAL OVERRIDE — runs last, wins all races
// Handles: patient + doctor + pharmacy + lab + ambulance + nurse + institution
// ============================================
(function () {
  'use strict';

  var API = 'https://n-health-backend-production.up.railway.app';

  // Which dashboard DOM id corresponds to which role
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

    // If the target screen doesn't exist, gracefully fall back
    if (!document.getElementById(target)) {
      console.warn('Target screen "' + target + '" not found, falling back to patient-home');
      if (typeof showToast === 'function') showToast('⚠️ ' + r + ' dashboard not available yet');
      target = 'patient-home';
    }
    console.log('🔍 FINAL ROUTING to:', target);
    if (typeof navigateTo === 'function') navigateTo(target);
  }

  function updateBtnText(role) {
    var btn = document.getElementById('login-btn');
    if (!btn) return;
    var r = String(role || 'PATIENT').toUpperCase();
    if (r === 'PATIENT') {
      btn.textContent = 'Sign In';
    } else {
      var label = r.charAt(0) + r.slice(1).toLowerCase();
      btn.textContent = 'Sign In as ' + label;
    }
  }

  // ================================================
  // 1. LOGIN OVERRIDE
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

    var role = (window.selectedProviderRole || 'PATIENT').toUpperCase();

    try {
      var res = await fetch(API + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password, role: role })
      });
      var data = {};
      try { data = await res.json(); } catch (e) {}
      console.log('🔍 FINAL LOGIN RESPONSE:', data);

      if (res.ok) {
        if (data.token) localStorage.setItem('token', data.token);
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
          window.currentUser = data.user;
        }
        if (typeof applyUserToUI === 'function') applyUserToUI(data.user);

        var r = String((data.user && data.user.role) || 'PATIENT').toLowerCase();
        routeToRole(r);
        if (typeof showToast === 'function') showToast('Welcome back!');
      } else {
        if (typeof showToast === 'function') showToast((data.message || data.error || 'Login failed'));
      }
    } catch (err) {
      console.error('Final login error:', err);
      if (typeof showToast === 'function') showToast('❌ Network error. Please try again.');
    } finally {
      if (btn) { btn.textContent = origText; btn.disabled = false; }
    }
  };

  // ================================================
  // 2. BUTTON BINDING (no onclick, pure listener)
  // ================================================
  function bindLoginBtn() {
    var btn = document.getElementById('login-btn');
    if (!btn) return;
    btn.removeAttribute('onclick');
    btn.onclick = function (e) { e.preventDefault(); window.login(); };
  }

  // ================================================
  // 3. PROVIDER ROLE SELECTION — update button text live
  // ================================================
  window.selectProviderRole = function (role) {
    window.selectedProviderRole = role;
    window.selectedSpecialty = '';

    // Show/hide institution form
    var instForm = document.getElementById('institution-register-form');
    if (instForm) instForm.style.display = (role === 'INSTITUTION') ? 'block' : 'none';

    // Populate/hide specialty dropdown
    var specSection = document.getElementById('specialty-section');
    if (specSection) {
      if (role === 'INSTITUTION') {
        specSection.style.display = 'none';
      } else {
        var SPECIALTIES = {
          'DOCTOR': ['Family Medicine','Internal Medicine','Pediatrics','Cardiology','Dermatology','Neurology','Psychiatry','Oncology','General Surgery','Orthopedic Surgery','Neurosurgery','Plastic Surgery','Anesthesiology','Emergency Medicine','Radiology','Pathology','Obstetrics & Gynecology (OB/GYN)','Ophthalmology','Otolaryngology (ENT)','Urology'],
          'NURSE': ['Licensed Practical/Vocational Nurse (LPN/LVN)','Registered Nurse (RN)','Nurse Practitioner (NP)','Clinical Nurse Specialist (CNS)','Certified Registered Nurse Anesthetist (CRNA)','Certified Nurse-Midwife (CNM)'],
          'PHARMACY': ['Pharmacist','Pharmacy Technician','Pharmacy Support Staff','Oncology Pharmacist','Pediatric Pharmacist','Critical Care Pharmacist','Industry Pharmacist'],
          'LAB': ['Phlebotomist','Medical Laboratory Technician (MLT)','Medical Laboratory Scientist / Technologist (MLS/MT)','Histotechnician / Histotechnologist','Cytotechnologist','Clinical Assistant',"Pathologists' Assistant"],
          'AMBULANCE': ['Emergency Care Assistant / Support Worker','Emergency Medical Technician (EMT)','Paramedic','Advanced Paramedic Practitioner / Critical Care Paramedic','Emergency Medical Dispatcher']
        };
        var list = SPECIALTIES[role] || [];
        var select = document.getElementById('specialty-select');
        var label = document.getElementById('specialty-label');
        if (select) {
          select.innerHTML = '<option value="">-- Choose your specialty --</option>';
          list.forEach(function (s) {
            var opt = document.createElement('option');
            opt.value = s; opt.textContent = s;
            select.appendChild(opt);
          });
        }
        if (label) label.textContent = role.charAt(0) + role.slice(1).toLowerCase() + ' Specialty *';
        specSection.style.display = 'block';
      }
    }
    updateBtnText(role);
  };

  // ================================================
  // 4. INIT
  // ================================================
  function install() {
    bindLoginBtn();
    updateBtnText(window.selectedProviderRole || 'PATIENT');

    // Rebind button if it ever gets recreated
    var observer = new MutationObserver(function () {
      var btn = document.getElementById('login-btn');
      if (btn && !btn._bound) {
        btn.removeAttribute('onclick');
        btn.onclick = function (e) { e.preventDefault(); window.login(); };
        btn._bound = true;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    console.log('✅ FINAL override installed (all roles)');
  }

  if (document.readyState === 'complete') {
    setTimeout(install, 100);
  } else {
    window.addEventListener('load', function () { setTimeout(install, 100); });
  }
})();