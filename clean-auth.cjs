const fs = require('fs');
const p = 'apps/landing/index.html';
let c = fs.readFileSync(p, 'utf8');
let changes = 0;

// ============================================================
// FIX 1: Remove ALL "Forgot Password?" links
// ============================================================
const fpRegex = /<div[^>]*style="[^"]*text-align:\s*right[^"]*"[^>]*>\s*<a[^>]*onclick="event\.preventDefault\(\);\s*openForgotPassword\(\);"[^>]*>Forgot Password\?<\/a>\s*<\/div>/g;
const allFp = c.match(fpRegex) || [];
console.log('Found ' + allFp.length + ' Forgot Password block(s)');

if (allFp.length > 0) {
  // Remove all of them
  c = c.replace(fpRegex, '');
  changes++;
  console.log('OK: removed all Forgot Password blocks');
}

// Re-add ONE clean forgot password link right after the password field
const passwordFieldRegex = /(<div class="form-group">\s*<label>Password<\/label>\s*<input type="password"[^>]*id="login-password">\s*<\/div>)/;
const passwordFieldMatch = c.match(passwordFieldRegex);

if (passwordFieldMatch) {
  const cleanLink = '\n                    <div style="text-align:right; margin-top:-6px; margin-bottom:12px;"><a href="#" onclick="event.preventDefault(); openForgotPassword();" style="font-size:12px; color:var(--primary); text-decoration:none; font-weight:600;">Forgot Password?</a></div>';
  c = c.replace(passwordFieldMatch[1], passwordFieldMatch[1] + cleanLink);
  changes++;
  console.log('OK: added single clean Forgot Password link');
} else {
  console.log('WARN: could not find password field to attach link');
}

// ============================================================
// FIX 2: Add Google Sign-In button (if missing)
// ============================================================
if (!c.includes('btn-google-signin') && !c.includes('signInWithGoogle')) {
  const googleBtn = `
                    <div style="margin-bottom: 16px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                            <div style="flex: 1; height: 1px; background: #E8ECF1;"></div>
                            <span style="font-size: 11px; color: var(--text-light); font-weight: 500;">OR CONTINUE WITH</span>
                            <div style="flex: 1; height: 1px; background: #E8ECF1;"></div>
                        </div>
                        <button type="button" id="btn-google-signin" onclick="signInWithGoogle()" style="width: 100%; padding: 12px; background: white; border: 1px solid #DADCE0; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                            Continue with Google
                        </button>
                    </div>
`;
  // Insert before the Email Address form group
  const emailGroupRegex = /<div class="form-group"[^>]*>\s*<label>Email Address<\/label>/;
  if (emailGroupRegex.test(c)) {
    c = c.replace(emailGroupRegex, googleBtn + '\n                    <div class="form-group">\n                        <label>Email Address</label>');
    changes++;
    console.log('OK: added Google Sign-In button');
  } else {
    console.log('WARN: could not find email field');
  }
} else {
  console.log('OK: Google button already present');
}

// ============================================================
// FIX 3: Add Google Client ID (replace placeholder)
// ============================================================
if (c.includes('YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com')) {
  c = c.replace(/YOUR_GOOGLE_CLIENT_ID\.apps\.googleusercontent\.com/g, '753267520396-ucmfbovnvhu42mbc4elgdufl3k52m1fc.apps.googleusercontent.com');
  changes++;
  console.log('OK: set Google Client ID');
} else if (c.includes('753267520396-ucmfbovnvhu42mbc4elgdufl3k52m1fc')) {
  console.log('OK: Google Client ID already set');
} else {
  console.log('WARN: could not find Google Client ID placeholder');
}

// ============================================================
// Save
// ============================================================
fs.writeFileSync(p, c, 'utf8');
console.log('\nTotal changes: ' + changes);

// ============================================================
// VERIFY
// ============================================================
console.log('\n=== VERIFICATION ===');
const v = fs.readFileSync(p, 'utf8');
const checks = [
  ['Forgot Password count is 1', (v.match(/Forgot Password\?/g) || []).length === 1],
  ['Google button present', v.includes('btn-google-signin')],
  ['signInWithGoogle function present', v.includes('function signInWithGoogle')],
  ['Google Client ID set', v.includes('753267520396-ucmfbovnvhu42mbc4elgdufl3k52m1fc')],
  ['Emojis intact', v.includes('🏥')],
];
let allPassed = true;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name);
  if (!pass) allPassed = false;
}
console.log(allPassed ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');