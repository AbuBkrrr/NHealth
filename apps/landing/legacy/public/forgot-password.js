// ============================================
// Forgot Password / Password Reset Flow
// ============================================

var resetEmail = '';
var resetOtp = '';

// Step 1: Enter email
function openForgotPassword() {
  resetEmail = '';
  resetOtp = '';
  showModal('\u{1F510} Reset Password',
    '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Enter your email and we will send you a verification code.</p>' +
    '<div class="form-group"><label>Email Address</label><input type="email" id="fp-email" placeholder="you@example.com"></div>' +
    '<div style="font-size:11px;color:var(--text-secondary);margin-top:8px;">If you do not receive the email within 5 minutes, check your spam folder.</div>',
    '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-primary" onclick="sendResetCode()">Send Code</button>');
}

// Step 2: Send OTP
async function sendResetCode() {
  const email = document.getElementById('fp-email').value.trim();
  if (!email || !email.includes('@')) {
    showToast('\u26A0 Please enter a valid email');
    return;
  }
  resetEmail = email;
  const btn = document.querySelector('#app-modal .btn-primary');
  if (btn) { btn.textContent = 'Sending...'; btn.disabled = true; }

  try {
    const response = await fetch(API_BASE_URL + '/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    let data = {};
    try { data = await response.json(); } catch (e) {}
    console.log('\u{1F50D} FORGOT-PASSWORD RESPONSE:', data);

    if (response.ok) {
      closeModal();
      openOtpStep();
    } else {
      // Even if user not found, we still show the OTP screen for security
      // (backend should return 200 either way to prevent user enumeration)
      if (response.status === 404 || response.status === 400) {
        closeModal();
        openOtpStep();
      } else {
        showToast('\u274C ' + (data.message || data.error || 'Failed to send code'));
        if (btn) { btn.textContent = 'Send Code'; btn.disabled = false; }
      }
    }
  } catch (err) {
    console.error('Forgot password error:', err);
    showToast('\u274C Network error. Please try again.');
    if (btn) { btn.textContent = 'Send Code'; btn.disabled = false; }
  }
}

// Step 3: Enter OTP
function openOtpStep() {
  showModal('\u{1F4E7} Enter Verification Code',
    '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">We sent a 6-digit code to <strong>' + resetEmail + '</strong>. It expires in 10 minutes.</p>' +
    '<div class="form-group"><label>Verification Code</label>' +
    '<input type="text" id="fp-otp" placeholder="000000" maxlength="6" style="text-align:center;font-size:20px;letter-spacing:8px;font-weight:600;"></div>' +
    '<div style="text-align:center;margin-top:12px;">' +
      '<a href="#" onclick="event.preventDefault();sendResetCode();" style="font-size:12px;color:var(--primary);text-decoration:none;">Resend code</a>' +
    '</div>',
    '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-primary" onclick="verifyResetCode()">Verify</button>');
}

// Step 4: Verify OTP
async function verifyResetCode() {
  const otp = document.getElementById('fp-otp').value.trim();
  if (!otp || otp.length !== 6) {
    showToast('\u26A0 Please enter the 6-digit code');
    return;
  }
  const btn = document.querySelector('#app-modal .btn-primary');
  if (btn) { btn.textContent = 'Verifying...'; btn.disabled = true; }

  try {
    const response = await fetch(API_BASE_URL + '/api/auth/verify-reset-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: resetEmail, code: otp })
    });
    let data = {};
    try { data = await response.json(); } catch (e) {}
    console.log('\u{1F50D} VERIFY-CODE RESPONSE:', data);

    if (response.ok) {
      resetOtp = otp;
      closeModal();
      openNewPasswordStep();
    } else {
      showToast('\u274C ' + (data.message || data.error || 'Invalid or expired code'));
      if (btn) { btn.textContent = 'Verify'; btn.disabled = false; }
    }
  } catch (err) {
    console.error('Verify code error:', err);
    showToast('\u274C Network error. Please try again.');
    if (btn) { btn.textContent = 'Verify'; btn.disabled = false; }
  }
}

// Step 5: Set new password
function openNewPasswordStep() {
  showModal('\u{1F510} Set New Password',
    '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Choose a strong password for <strong>' + resetEmail + '</strong>.</p>' +
    '<div class="form-group"><label>New Password</label><input type="password" id="fp-password" placeholder="Min 8 characters"></div>' +
    '<div class="form-group"><label>Confirm New Password</label><input type="password" id="fp-password2" placeholder="Re-enter password"></div>' +
    '<ul class="info-list" style="margin-top:8px;">' +
      '<li>At least 8 characters</li>' +
      '<li>Mix of letters and numbers recommended</li>' +
    '</ul>',
    '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-primary" onclick="submitNewPassword()">Reset Password</button>');
}

// Step 6: Submit new password
async function submitNewPassword() {
  const password = document.getElementById('fp-password').value;
  const password2 = document.getElementById('fp-password2').value;

  if (!password || password.length < 8) {
    showToast('\u26A0 Password must be at least 8 characters');
    return;
  }
  if (password !== password2) {
    showToast('\u26A0 Passwords do not match');
    return;
  }

  const btn = document.querySelector('#app-modal .btn-primary');
  if (btn) { btn.textContent = 'Resetting...'; btn.disabled = true; }

  try {
    const response = await fetch(API_BASE_URL + '/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: resetEmail, code: resetOtp, password })
    });
    let data = {};
    try { data = await response.json(); } catch (e) {}
    console.log('\u{1F50D} RESET-PASSWORD RESPONSE:', data);

    if (response.ok) {
      closeModal();
      showToast('\u2705 Password reset! You can now sign in.');
      // Pre-fill login email
      const loginEmail = document.getElementById('login-email');
      const loginPassword = document.getElementById('login-password');
      if (loginEmail) loginEmail.value = resetEmail;
      if (loginPassword) loginPassword.value = '';
      resetEmail = '';
      resetOtp = '';
    } else {
      showToast('\u274C ' + (data.message || data.error || 'Failed to reset password'));
      if (btn) { btn.textContent = 'Reset Password'; btn.disabled = false; }
    }
  } catch (err) {
    console.error('Reset password error:', err);
    showToast('\u274C Network error. Please try again.');
    if (btn) { btn.textContent = 'Reset Password'; btn.disabled = false; }
  }
}