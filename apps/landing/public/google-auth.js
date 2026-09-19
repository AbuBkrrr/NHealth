// ================================================
// N-Health Google Sign-In (external module)
// ================================================
var GOOGLE_CLIENT_ID = '753267520396-ucmfbovnvhu42mbc4elgdufl3k52m1fc.apps.googleusercontent.com';

// Called when user clicks "Continue with Google"
function signInWithGoogleFallback() {
  if (typeof google === 'undefined' || !google.accounts) {
    showToast('Google is still loading. Please try again.');
    return;
  }

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
          // Send userInfo to backend
          return fetch(API_BASE_URL + '/api/auth/google-userinfo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: userInfo.email,
              name: userInfo.name,
              picture: userInfo.picture,
              role: 'PATIENT'
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
            var role = ((data.user && data.user.role) ? data.user.role : 'PATIENT').toLowerCase();
            if (role === 'doctor') navigateTo('doctor-home');
            else if (role === 'pharmacy') navigateTo('pharmacy-home');
            else if (role === 'institution' || role === 'admin') navigateTo('institution-home');
            else navigateTo('patient-home');
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
    client.requestAccessToken();
  } catch (err) {
    console.error('Google fallback error:', err);
    showToast('Google Sign-In unavailable');
  }
}

// Handles the credential from One Tap
async function handleGoogleCredential(response) {
  if (!response || !response.credential) {
    showToast('Google Sign-In cancelled');
    return;
  }
  showToast('Verifying with Google...');
  try {
    var res = await fetch(API_BASE_URL + '/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential, role: 'PATIENT' })
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
      var role = ((currentUser && currentUser.role) ? currentUser.role : 'PATIENT').toLowerCase();
      if (role === 'doctor') navigateTo('doctor-home');
      else if (role === 'pharmacy') navigateTo('pharmacy-home');
      else if (role === 'institution' || role === 'admin') navigateTo('institution-home');
      else navigateTo('patient-home');
    } else {
      showToast(data.message || data.error || 'Google sign-in failed');
    }
  } catch (err) {
    console.error('Google auth error:', err);
    showToast('Network error. Please try again.');
  }
}

// Auto-render Google button in the container when page loads
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
    // Hide the fallback button since Google's button is now in place
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