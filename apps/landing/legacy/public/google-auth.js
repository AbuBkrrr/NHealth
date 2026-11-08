// ================================================
// N-Health Google Sign-In (external module)
// Supports all roles: patient, doctor, pharmacy, lab, ambulance, nurse, institution
// ================================================
var GOOGLE_CLIENT_ID = '753267520396-ucmfbovnvhu42mbc4elgdufl3k52m1fc.apps.googleusercontent.com';

// ================================================
// SHARED ROUTING HELPER
// ================================================
function routeToDashboard(role) {
  var r = String(role || 'PATIENT').toLowerCase();
  console.log('🔍 GOOGLE ROUTING to:', r);
  if (r === 'doctor') navigateTo('doctor-home');
  else if (r === 'pharmacy') navigateTo('pharmacy-home');
  else if (r === 'lab') navigateTo('lab-home');
  else if (r === 'ambulance') navigateTo('ambulance-home');
  else if (r === 'nurse') navigateTo('nurse-home');
  else if (r === 'institution' || r === 'admin') navigateTo('institution-home');
  else navigateTo('patient-home');
}

// ================================================
// Called when user clicks the fallback Google button
// ================================================
function signInWithGoogleFallback() {
  if (typeof google === 'undefined' || !google.accounts) {
    showToast('Google is still loading. Please try again.');
    return;
  }

  var requestedRole = (window.selectedProviderRole || 'PATIENT').toUpperCase();

  // Try One Tap prompt first
  try {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    google.accounts.id.prompt();
    return;
  } catch (err) {
    console.log('One Tap failed, trying OAuth2 flow:', err);
  }

  // Fallback: OAuth2 token client
  try {
    var client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: function(tokenResponse) {
        if (!tokenResponse || !tokenResponse.access_token) {
          showToast('Google Sign-In cancelled');
          return;
        }
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: 'Bearer ' + tokenResponse.access_token }
        })
        .then(function(r) { return r.json(); })
        .then(function(userInfo) {
          console.log('Google user info:', userInfo);
          return fetch(API_BASE_URL + '/api/auth/google-userinfo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: userInfo.email,
              name: userInfo.name,
              picture: userInfo.picture,
              role: (window.selectedProviderRole || 'PATIENT').toUpperCase()
            })
          });
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          console.log('Backend response:', data);
          if (data && data.token) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            currentUser = data.user;
            if (typeof applyUserToUI === 'function') applyUserToUI(currentUser);
            showToast('Welcome, ' + (data.user.name || data.user.email) + '!');
            routeToDashboard(data.user.role);
          } else {
            showToast((data && (data.message || data.error)) || 'Google sign-in failed');
          }
        })
        .catch(function(e) {
          console.error('Google auth error:', e);
          showToast('Network error');
        });
      }
    });
    client.requestToken();
  } catch (err) {
    console.error('Google fallback error:', err);
    showToast('Google Sign-In unavailable');
  }
}

// ================================================
// Handles the credential from Google's renderButton (primary path)
// ================================================
async function handleGoogleCredential(response) {
  if (!response || !response.credential) {
    showToast('Google Sign-In cancelled');
    return;
  }
  showToast('Verifying with Google...');
  try {
    var requestedRole = (window.selectedProviderRole || 'PATIENT').toUpperCase();
    var res = await fetch(API_BASE_URL + '/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential, role: requestedRole })
    });
    var data = await res.json();
    console.log('GOOGLE AUTH RESPONSE:', data);
    if (res.ok) {
      if (data.token) localStorage.setItem('token', data.token);
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        currentUser = data.user;
      }
      if (typeof applyUserToUI === 'function') applyUserToUI(currentUser);
      showToast('Welcome, ' + (currentUser.name || currentUser.email) + '!');
      routeToDashboard(currentUser.role);
    } else {
      showToast(data.message || data.error || 'Google sign-in failed');
    }
  } catch (err) {
    console.error('Google auth error:', err);
    showToast('Network error. Please try again.');
  }
}

// ================================================
// Auto-render Google button in the container when page loads
// ================================================
function initGoogleSignIn() {
  if (typeof google === 'undefined' || !google.accounts) {
    setTimeout(initGoogleSignIn, 500);
    return;
  }
  var container = document.getElementById('google-btn-container');
  if (!container) return;
  try {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: 340,
    });
    console.log('✅ Google Sign-In button rendered');
    var fb = document.getElementById('btn-google-fallback');
    if (fb) fb.style.display = 'none';
  } catch (err) {
    console.error('Google init error:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { setTimeout(initGoogleSignIn, 200); });
} else {
  setTimeout(initGoogleSignIn, 200);
}