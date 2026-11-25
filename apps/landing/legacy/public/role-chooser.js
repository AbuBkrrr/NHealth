// ============================================
// Role Chooser — shown after login if user has 2+ roles
// ============================================

function routeToDashboard(role) {
  const r = (role || 'PATIENT').toLowerCase();
  if (r === 'patient') navigateTo('patient-home');
  else if (r === 'doctor') navigateTo('doctor-home');
  else if (r === 'pharmacy') navigateTo('pharmacy-home');
  else if (r === 'institution' || r === 'admin') navigateTo('institution-home');
  else navigateTo('patient-home');
}

function showRoleChooser(roles, user) {
  const roleLabels = {
    PATIENT: { icon: '👤', label: 'Patient', desc: 'Access healthcare services', color: 'var(--primary)' },
    DOCTOR: { icon: '👨‍⚕️', label: 'Doctor', desc: 'Manage practice & patients', color: 'var(--doctor-color)' },
    PHARMACY: { icon: '💊', label: 'Pharmacy', desc: 'Inventory & POS', color: 'var(--pharmacy-color)' },
    LAB: { icon: '🔬', label: 'Lab', desc: 'Diagnostic services', color: 'var(--lab-color)' },
    AMBULANCE: { icon: '🚑', label: 'Ambulance', desc: 'Emergency transport', color: 'var(--ambulance-color)' },
    NURSE: { icon: '👩‍⚕️', label: 'Nurse', desc: 'Patient care', color: 'var(--nurse-color)' },
    ADMIN: { icon: '🏥', label: 'Institution', desc: 'Clinic/Hospital', color: 'var(--institution-color)' },
  };

  const cardsHTML = roles.map(function(r) {
    const meta = roleLabels[r] || { icon: '👤', label: r, desc: '', color: 'var(--primary)' };
    return '<div class="role-card" style="cursor:pointer; padding:16px; border:2px solid #E8ECF1; border-radius:12px; text-align:center; margin-bottom:8px;" ' +
      'onclick="pickDashboard(\'' + r + '\')">' +
      '<div style="font-size:28px;">' + meta.icon + '</div>' +
      '<div style="font-weight:600; font-size:14px; margin-top:4px;">' + meta.label + '</div>' +
      '<div style="font-size:11px; color:var(--text-secondary);">' + meta.desc + '</div>' +
      '</div>';
  }).join('');

  showModal('👋 Welcome, ' + (user.name || user.email),
    '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">You have multiple accounts. Which dashboard would you like to open?</p>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' + cardsHTML + '</div>',
    ''
  );
}

async function pickDashboard(role) {
  closeModal();
  // Get a role-scoped token from backend
  const currentToken = localStorage.getItem('token');
  try {
    const res = await fetch(API_BASE_URL + '/api/auth/switch-role', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + currentToken,
      },
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      currentUser = data.user;
      applyUserToUI(currentUser);
      routeToDashboard(role);
      showToast('✅ Switched to ' + role.toLowerCase() + ' dashboard');
    } else {
      routeToDashboard(role);
    }
  } catch (e) {
    console.error('Switch-role error:', e);
    routeToDashboard(role);
  }
}

// Global "Switch Dashboard" button for authenticated users
function openSwitchDashboard() {
  let user = null;
  try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch (e) {}
  const roles = (user && user.roles && user.roles.length) ? user.roles : [user && user.role ? user.role : 'PATIENT'];
  if (roles.length < 2) {
    showToast('ℹ️ You only have one account role.');
    return;
  }
  showRoleChooser(roles, user);
}