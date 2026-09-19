// ============================================
// Provider Flow — Restructures auth + specialty dropdown
// Loaded externally so it can never break index.html
// ============================================
(function() {
  'use strict';

  var SPECIALTIES = {
    DOCTOR: ['Family Medicine','Internal Medicine','Pediatrics','Cardiology','Dermatology','Neurology','Psychiatry','Oncology','General Surgery','Orthopedic Surgery','Neurosurgery','Plastic Surgery','Anesthesiology','Emergency Medicine','Radiology','Pathology','Obstetrics & Gynecology (OB/GYN)','Ophthalmology','Otolaryngology (ENT)','Urology'],
    NURSE: ['Licensed Practical/Vocational Nurse (LPN/LVN)','Registered Nurse (RN)','Nurse Practitioner (NP)','Clinical Nurse Specialist (CNS)','Certified Registered Nurse Anesthetist (CRNA)','Certified Nurse-Midwife (CNM)'],
    PHARMACY: ['Pharmacist','Pharmacy Technician','Pharmacy Support Staff','Oncology Pharmacist','Pediatric Pharmacist','Critical Care Pharmacist','Industry Pharmacist'],
    LAB: ['Phlebotomist','Medical Laboratory Technician (MLT)','Medical Laboratory Scientist / Technologist (MLS/MT)','Histotechnician / Histotechnologist','Cytotechnologist','Clinical Assistant',"Pathologists' Assistant"],
    AMBULANCE: ['Emergency Care Assistant / Support Worker','Emergency Medical Technician (EMT)','Paramedic','Advanced Paramedic Practitioner / Critical Care Paramedic','Emergency Medical Dispatcher']
  };

  window.selectedProviderRole = 'PATIENT';
  window.selectedSpecialty = '';

  function restructureAuthScreen() {
    var selector = document.querySelector('.auth-role-selector');
    if (!selector) return;
    if (document.getElementById('provider-role-view')) return; // already done

    var parent = selector.parentNode;

    selector.innerHTML =
      '<div class="role-card selected" id="role-patient" onclick="selectRole(\'patient\')">' +
        '<div class="icon">👤</div><div class="name">Patient</div><div class="desc">Access healthcare services</div>' +
      '</div>' +
      '<div class="role-card" id="role-providers" onclick="showProviders()">' +
        '<div class="icon">🏥</div><div class="name">Providers</div><div class="desc">Doctors, Pharmacy, Lab & more</div>' +
      '</div>';

    var pv = document.createElement('div');
    pv.id = 'provider-role-view';
    pv.className = 'auth-role-selector';
    pv.style.display = 'none';
    pv.innerHTML =
      '<div class="role-card" onclick="selectProviderRole(\'DOCTOR\')"><div class="icon">👨‍⚕️</div><div class="name">Doctor</div><div class="desc">Manage practice & patients</div></div>' +
      '<div class="role-card" onclick="selectProviderRole(\'PHARMACY\')"><div class="icon">💊</div><div class="name">Pharmacy</div><div class="desc">Inventory & POS</div></div>' +
      '<div class="role-card" onclick="selectProviderRole(\'LAB\')"><div class="icon">🔬</div><div class="name">Lab</div><div class="desc">Diagnostic services</div></div>' +
      '<div class="role-card" onclick="selectProviderRole(\'AMBULANCE\')"><div class="icon">🚑</div><div class="name">Ambulance</div><div class="desc">Emergency transport</div></div>' +
      '<div class="role-card" onclick="selectProviderRole(\'NURSE\')"><div class="icon">👩‍⚕️</div><div class="name">Nurse</div><div class="desc">Patient care</div></div>' +
      '<div class="role-card institution-card" onclick="selectProviderRole(\'INSTITUTION\')"><div class="icon">🏥</div><div class="name">Institution</div><div class="desc">Clinic/Hospital</div></div>' +
      '<button class="btn btn-outline btn-sm" style="grid-column:span 2;margin-top:4px;" onclick="showPatientView()">← Back</button>';

    parent.insertBefore(pv, selector.nextSibling);
  }

  window.showProviders = function() {
    var init = document.querySelector('.auth-role-selector');
    if (init) init.style.display = 'none';
    var pv = document.getElementById('provider-role-view');
    if (pv) pv.style.display = 'grid';
    var spec = document.getElementById('specialty-section');
    if (spec) spec.style.display = 'none';
  };

  window.showPatientView = function() {
    var pv = document.getElementById('provider-role-view');
    if (pv) pv.style.display = 'none';
    var init = document.querySelector('.auth-role-selector');
    if (init) init.style.display = 'grid';
    var spec = document.getElementById('specialty-section');
    if (spec) spec.style.display = 'none';
    var instForm = document.getElementById('institution-register-form');
    if (instForm) instForm.style.display = 'none';
    window.selectedProviderRole = 'PATIENT';
    window.selectedSpecialty = '';
  };

  window.selectProviderRole = function(role) {
    window.selectedProviderRole = role;
    window.selectedSpecialty = '';

    // Hide institution form unless this is INSTITUTION
    var instForm = document.getElementById('institution-register-form');
    if (instForm) instForm.style.display = (role === 'INSTITUTION') ? 'block' : 'none';

    // Hide specialty section for institution
    var spec = document.getElementById('specialty-section');
    if (!spec) return;

    if (role === 'INSTITUTION') {
      spec.style.display = 'none';
      return;
    }

    // Populate & show specialty dropdown
    var select = document.getElementById('specialty-select');
    var label = document.getElementById('specialty-label');
    var list = SPECIALTIES[role] || [];
    select.innerHTML = '<option value="">-- Choose your specialty --</option>';
    list.forEach(function(s) {
      var opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      select.appendChild(opt);
    });
    label.textContent = role.charAt(0) + role.slice(1).toLowerCase() + ' Specialty *';
    spec.style.display = 'block';
    spec.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  function addSpecialtySection() {
    if (document.getElementById('specialty-section')) return;
    var anchor = document.getElementById('institution-register-form');
    if (!anchor) return;

    var spec = document.createElement('div');
    spec.id = 'specialty-section';
    spec.style.display = 'none';
    spec.style.marginBottom = '12px';
    spec.innerHTML =
      '<div class="form-group">' +
        '<label id="specialty-label">Specialty <span style="color:var(--error);">*</span></label>' +
        '<select id="specialty-select" onchange="window.selectedSpecialty=this.value">' +
          '<option value="">-- Choose your specialty --</option>' +
        '</select>' +
      '</div>';

    anchor.parentNode.insertBefore(spec, anchor.nextSibling);
  }

  function init() {
    restructureAuthScreen();
    addSpecialtySection();
    var oldPT = document.getElementById('provider-type-section');
    if (oldPT) oldPT.style.display = 'none';
    console.log('✅ provider-flow initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();