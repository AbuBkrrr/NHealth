const fs = require('fs');
const path = 'apps/landing/index.html';
let c = fs.readFileSync(path, 'utf8');
let changed = 0;

// ============================================================
// FIX 1: Remove duplicate "Forgot Password?" link
// ============================================================
const fpPattern = /<div style="text-align:right;[^>]*>\s*<a href="#" onclick="event\.preventDefault\(\);openForgotPassword\(\);"[^>]*>Forgot Password\?<\/a>\s*<\/div>/g;
const matches = c.match(fpPattern);
console.log('Found ' + (matches ? matches.length : 0) + ' Forgot Password link(s)');

if (matches && matches.length > 1) {
  // Keep the first, remove the rest
  let first = true;
  c = c.replace(fpPattern, function(m) {
    if (first) { first = false; return m; }
    changed++;
    return '';
  });
  console.log('✅ Removed ' + (matches.length - 1) + ' duplicate(s)');
} else {
  console.log('ℹ️  No duplicates to remove');
}

// ============================================================
// FIX 2: Restructure role selection
// ============================================================

// 2a. Replace the existing auth-role-selector block with a two-view layout
const oldRoleBlockRegex = /<div class="auth-role-selector">[\s\S]*?<\/div>\s*<\/div>\s*<div id="provider-type-section"/;
const oldRoleBlock = c.match(oldRoleBlockRegex);

if (oldRoleBlock) {
  const newRoleBlock = `<div id="initial-role-view" class="auth-role-selector">
                        <div class="role-card selected" onclick="selectRole('patient')" id="role-patient">
                            <div class="icon">👤</div>
                            <div class="name">Patient</div>
                            <div class="desc">Access healthcare services</div>
                        </div>
                        <div class="role-card" onclick="showProviderSelection()" id="role-providers">
                            <div class="icon">🏥</div>
                            <div class="name">Providers</div>
                            <div class="desc">Doctors, Pharmacy, Lab & more</div>
                        </div>
                    </div>

                    <div id="provider-role-view" class="auth-role-selector" style="display:none;">
                        <div class="role-card" onclick="selectRole('doctor')" id="role-doctor">
                            <div class="icon">👨‍⚕️</div>
                            <div class="name">Doctor</div>
                            <div class="desc">Manage practice & patients</div>
                        </div>
                        <div class="role-card" onclick="selectRole('pharmacy')" id="role-pharmacy">
                            <div class="icon">💊</div>
                            <div class="name">Pharmacy</div>
                            <div class="desc">Inventory & POS management</div>
                        </div>
                        <div class="role-card" onclick="selectRole('lab')" id="role-lab">
                            <div class="icon">🔬</div>
                            <div class="name">Lab</div>
                            <div class="desc">Diagnostic services</div>
                        </div>
                        <div class="role-card" onclick="selectRole('ambulance')" id="role-ambulance">
                            <div class="icon">🚑</div>
                            <div class="name">Ambulance</div>
                            <div class="desc">Emergency transport</div>
                        </div>
                        <div class="role-card" onclick="selectRole('nurse')" id="role-nurse">
                            <div class="icon">👩‍⚕️</div>
                            <div class="name">Nurse</div>
                            <div class="desc">Patient care</div>
                        </div>
                        <div class="role-card institution-card" onclick="selectRole('institution')" id="role-institution">
                            <div class="icon">🏥</div>
                            <div class="name">Institution</div>
                            <div class="desc">Clinic/Hospital/Facility</div>
                        </div>
                        <button class="btn btn-outline btn-sm" style="grid-column: span 2; margin-top: 4px;" onclick="showInitialRoleView()">← Back</button>
                    </div>

                    <div id="provider-type-section"`;
  c = c.replace(oldRoleBlockRegex, newRoleBlock);
  changed++;
  console.log('✅ Restructured role selection');
}

// 2b. Hide provider-type-section (it's no longer needed)
c = c.replace(
  '<div id="provider-type-section" style="display:none;">',
  '<div id="provider-type-section" style="display:none !important;">'
);

// 2c. Add the show/hide functions to the script
const roleFunctions = `
        function showProviderSelection() {
            document.getElementById('initial-role-view').style.display = 'none';
            document.getElementById('provider-role-view').style.display = 'grid';
        }
        function showInitialRoleView() {
            document.getElementById('initial-role-view').style.display = 'grid';
            document.getElementById('provider-role-view').style.display = 'none';
            document.getElementById('institution-register-form').style.display = 'none';
        }
`;

// Insert before function selectRole
if (!c.includes('function showProviderSelection')) {
  c = c.replace(
    'function selectRole(role) {',
    roleFunctions + '\n        function selectRole(role) {'
  );
  changed++;
  console.log('✅ Added showProviderSelection / showInitialRoleView functions');
}

// 2d. Update selectRole to hide institution form when switching away
if (!c.includes("// Clear institution form when switching roles")) {
  c = c.replace(
    "document.getElementById('institution-register-form').style.display = role === 'institution' ? 'block' : 'none';",
    "document.getElementById('institution-register-form').style.display = role === 'institution' ? 'block' : 'none';\n            // Clear institution form when switching roles"
  );
}

// ============================================================
// FIX 3: Add Google Sign-In button + script
// ============================================================

// 3a. Insert Google button above the email input
if (!c.includes('g_id_onload') && !c.includes('btn-google-signin')) {
  const googleBtn = `
                    <div style="margin-bottom: 16px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                            <div style="flex: 1; height: 1px; background: #E8ECF1;"></div>
                            <span style="font-size: 11px; color: var(--text-light); font-weight: 500;">OR CONTINUE WITH</span>
                            <div style="flex: 1; height: 1px; background: #E8ECF1;"></div>
                        </div>
                        <button type="button" id="btn-google-signin" onclick="signInWithGoogle()" style="width: 100%; padding: 12px; background: white; border: 1px solid #DADCE0; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.2s;">
                            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                            Continue with Google
                        </button>
                    </div>
`;
  // Insert before the Email Address form group
  c = c.replace(
    '<div class="form-group" style="margin-top:12px;">\n                        <label>Email Address</label>',
    googleBtn + '\n                    <div class="form-group">\n                        <label>Email Address</label>'
  );
  changed++;
  console.log('✅ Added Google Sign-In button');
}

// 3b. Add the Google script tag before </head>
if (!c.includes('accounts.google.com/gsi/client')) {
  const googleScript = '    <script src="https://accounts.google.com/gsi/client" async defer></script>\n';
  c = c.replace('</head>', googleScript + '</head>');
  changed++;
  console.log('✅ Added Google Identity Services script');
}

// 3c. Add Google Sign-In function
const googleAuthFn = `
        // ================================================
        // GOOGLE SIGN-IN
        // ================================================
        // TODO: Replace with your actual Google Client ID from console.cloud.google.com
        const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

        function signInWithGoogle() {
            if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') {
                showToast('⚠️ Google Sign-In not configured. Add your Client ID.');
                return;
            }
            if (typeof google === 'undefined' || !google.accounts) {
                showToast('⚠️ Google Sign-In is still loading. Try again.');
                return;
            }
            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleCredential
            });
            google.accounts.id.prompt();
        }

        async function handleGoogleCredential(response) {
            if (!response.credential) {
                showToast('❌ Google Sign-In cancelled');
                return;
            }
            showToast('⏳ Verifying with Google...');

            try {
                const res = await fetch(API_BASE_URL + '/api/auth/google', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        credential: response.credential,
                        role: 'PATIENT'
                    })
                });
                const data = await res.json();
                console.log('🔍 GOOGLE AUTH RESPONSE:', data);

                if (res.ok) {
                    if (data.token) localStorage.setItem('token', data.token);
                    if (data.user) {
                        localStorage.setItem('user', JSON.stringify(data.user));
                        currentUser = data.user;
                    }
                    applyUserToUI(currentUser);
                    showToast('✅ Welcome, ' + (currentUser.name || currentUser.email) + '!');
                    const role = ((currentUser && currentUser.role) ? currentUser.role : 'patient').toLowerCase();
                    if (role === 'doctor') navigateTo('doctor-home');
                    else if (role === 'pharmacy') navigateTo('pharmacy-home');
                    else if (role === 'institution' || role === 'admin') navigateTo('institution-home');
                    else navigateTo('patient-home');
                } else {
                    showToast('❌ ' + (data.message || data.error || 'Google sign-in failed'));
                }
            } catch (err) {
                console.error('Google auth error:', err);
                showToast('❌ Network error. Try again.');
            }
        }
`;

if (!c.includes('function signInWithGoogle')) {
  c = c.replace(
    'setInterval(checkNetwork, 10000);',
    googleAuthFn + '\n        setInterval(checkNetwork, 10000);'
  );
  changed++;
  console.log('✅ Added Google Sign-In functions');
}

// Save with UTF-8
fs.writeFileSync(path, c, 'utf8');

// Verify
const v = fs.readFileSync(path, 'utf8');
console.log('\n=== VERIFICATION ===');
const checks = [
  ['Duplicate Forgot Password removed', (v.match(/Forgot Password\?/g) || []).length === 1],
  ['initial-role-view exists', v.includes('id="initial-role-view"')],
  ['provider-role-view exists', v.includes('id="provider-role-view"')],
  ['showProviderSelection defined', v.includes('function showProviderSelection')],
  ['showInitialRoleView defined', v.includes('function showInitialRoleView')],
  ['Google button added', v.includes('btn-google-signin')],
  ['Google script loaded', v.includes('accounts.google.com/gsi/client')],
  ['signInWithGoogle defined', v.includes('function signInWithGoogle')],
  ['Emojis intact 🏥', v.includes('🏥')],
];
let allPassed = true;
for (const [name, pass] of checks) {
  console.log((pass ? '✅' : '❌') + '  ' + name);
  if (!pass) allPassed = false;
}
console.log(allPassed ? '\n🎉 ALL CHECKS PASSED' : '\n⚠️  SOME CHECKS FAILED');
console.log('\n' + changed + ' changes applied');