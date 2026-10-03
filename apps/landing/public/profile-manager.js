// ============================================
// Profile — real user data + editable form + change limits
// ============================================
(function() {
  'use strict';
  var API = 'https://n-health-backend-production.up.railway.app';

  function getToken() { return localStorage.getItem('token'); }
  function getUser() {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch (e) { return null; }
  }

  // ---- Load real profile from backend ----
  async function loadProfile() {
    var token = getToken();
    if (!token) return;
    try {
      var res = await fetch(API + '/api/auth/me', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return;
      var data = await res.json();
      console.log('🔍 Profile loaded:', data);
      localStorage.setItem('fullProfile', JSON.stringify(data));
      populateProfileUI(data);
    } catch (e) {
      console.error('Profile load error:', e);
    }
  }

  // ---- Populate the existing profile screens with real data ----
  function populateProfileUI(p) {
    var user = p || getUser() || {};

    // Patient profile screen
    var nameEl = document.getElementById('profile-name');
    var emailEl = document.getElementById('profile-email');
    if (nameEl) nameEl.textContent = user.name || 'User';
    if (emailEl) emailEl.textContent = user.email || '';

    // Patient personal info grid
    var pp = user.patientProfile || {};
    setText('profile-blood-group', pp.bloodType || 'Not set');
    setText('profile-genotype', pp.genotype || 'Not set');
    setText('profile-location', pp.address || 'Not set');
    setText('profile-nhis', pp.nhisNumber || 'Not set');
    setText('profile-height', pp.height ? pp.height + ' cm' : 'Not set');
    setText('profile-weight', pp.weight ? pp.weight + ' kg' : 'Not set');

    // Avatar
    if (user.avatarUrl) {
      var img = document.getElementById('profile-avatar-img');
      var ph = document.getElementById('profile-avatar-placeholder');
      if (img) { img.src = user.avatarUrl; img.style.display = 'block'; }
      if (ph) ph.style.display = 'none';
    }
  }

 function setText(id, text) {
  var el = document.getElementById(id);
  if (el) { el.textContent = text; return; }
  // Fallback: try to find by label in the Personal Information grid
  var labels = {
    'profile-blood-group': 'Blood Group',
    'profile-genotype': 'Genotype',
    'profile-location': 'Location',
    'profile-nhis': 'NHIS Number',
    'profile-height': 'Height',
    'profile-weight': 'Weight',
  };
  var label = labels[id];
  if (!label) return;
  var grid = document.querySelector('#patient-profile .card:last-child');
  if (!grid) return;
  var labelNodes = grid.querySelectorAll('div[style*="font-size:10px"]');
  for (var i = 0; i < labelNodes.length; i++) {
    if (labelNodes[i].textContent.trim() === label) {
      var target = labelNodes[i].nextElementSibling;
      if (target) {
        target.textContent = text;
        target.id = id;
        return;
      }
    }
  }
}

  // ---- Add "Edit Profile" button to profile screen ----
  function injectEditButton() {
    var profileScreen = document.getElementById('patient-profile');
    if (!profileScreen || profileScreen.dataset.editInjected) return;
    profileScreen.dataset.editInjected = 'true';

    // Find the app-bar action
    var appBar = profileScreen.querySelector('.app-bar');
    if (!appBar) return;

    var actionsArea = appBar.querySelector('div');
    if (!actionsArea) return;

    var editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.style.cssText = 'background:none;border:none;font-size:12px;cursor:pointer;color:var(--primary);font-weight:600;margin-right:8px;';
    editBtn.onclick = openEditProfile;
    actionsArea.insertBefore(editBtn, actionsArea.firstChild);
  }

  function openEditProfile() {
    var user = JSON.parse(localStorage.getItem('fullProfile') || '{}');
    var pp = user.patientProfile || {};

    var html = ''
      + '<div class="form-group"><label>Full Name</label><input type="text" id="ep-name" value="' + escapeAttr(user.name || '') + '"></div>'
      + '<div class="form-group"><label>Phone</label><input type="tel" id="ep-phone" value="' + escapeAttr(user.phone || '') + '"></div>'
      + '<div class="form-group"><label>Address</label><input type="text" id="ep-address" value="' + escapeAttr(pp.address || '') + '"></div>'
      + '<div class="form-group"><label>Height (cm)</label><input type="number" id="ep-height" value="' + (pp.height || '') + '"></div>'
      + '<div class="form-group"><label>Weight (kg)</label><input type="number" id="ep-weight" value="' + (pp.weight || '') + '"></div>'
      + '<div class="form-group"><label>Blood Group ('
        + (pp.bloodTypeChanges || 0) + '/2 changes used)</label>'
        + '<select id="ep-blood"' + (pp.bloodTypeChanges >= 2 ? ' disabled' : '') + '>'
        + ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(function(v) {
            return '<option value="' + v + '"' + (v === pp.bloodType ? ' selected' : '') + '>' + (v || '-- Select --') + '</option>';
          }).join('')
        + '</select>'
        + (pp.bloodTypeChanges >= 2 ? '<div style="font-size:11px;color:var(--error);margin-top:4px;">Change limit reached</div>' : '')
        + '</div>'
      + '<div class="form-group"><label>Genotype ('
        + (pp.genotypeChanges || 0) + '/2 changes used)</label>'
        + '<select id="ep-genotype"' + (pp.genotypeChanges >= 2 ? ' disabled' : '') + '>'
        + ['', 'AA', 'AS', 'SS', 'AC', 'SC'].map(function(v) {
            return '<option value="' + v + '"' + (v === pp.genotype ? ' selected' : '') + '>' + (v || '-- Select --') + '</option>';
          }).join('')
        + '</select>'
        + (pp.genotypeChanges >= 2 ? '<div style="font-size:11px;color:var(--error);margin-top:4px;">Change limit reached</div>' : '')
        + '</div>';

    showModal('Edit Profile', html,
      '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" onclick="window.saveProfile()">Save Changes</button>');
  }

  function escapeAttr(s) { return String(s || '').replace(/"/g, '&quot;'); }

  // ---- Save ----
  window.saveProfile = async function() {
    var token = getToken();
    if (!token) { showToast('Please sign in again'); return; }

    var payload = {
      name: (document.getElementById('ep-name') || {}).value,
      phone: (document.getElementById('ep-phone') || {}).value,
      address: (document.getElementById('ep-address') || {}).value,
      height: parseFloat((document.getElementById('ep-height') || {}).value) || undefined,
      weight: parseFloat((document.getElementById('ep-weight') || {}).value) || undefined,
      bloodType: (document.getElementById('ep-blood') || {}).value || undefined,
      genotype: (document.getElementById('ep-genotype') || {}).value || undefined,
    };

    try {
      var res = await fetch(API + '/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify(payload),
      });
      var data = await res.json();
      console.log('Profile update response:', data);
      if (res.ok) {
        closeModal();
        showToast('✅ Profile updated');
        loadProfile();
      } else {
        showToast(data.error || data.message || 'Failed to update');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error');
    }
  };

  // ---- Watch for profile screen activation, then inject ----
  function watch() {
    var observer = new MutationObserver(function() {
      if (document.getElementById('patient-profile').classList.contains('active')) {
        injectEditButton();
      }
    });
    var profileScreen = document.getElementById('patient-profile');
    if (profileScreen) {
      observer.observe(profileScreen, { attributes: true, attributeFilter: ['class'] });
    }
    injectEditButton();
  }

  function init() {
    setTimeout(function() {
      loadProfile();
      watch();
      console.log('✅ profile-manager initialized');
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();