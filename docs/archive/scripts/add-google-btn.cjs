const fs = require('fs');
const p = 'apps/landing/index.html';
let c = fs.readFileSync(p, 'utf8');

if (c.includes('btn-google-signin')) {
  console.log('OK: Google button already present — nothing to do');
  process.exit(0);
}

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

// Insert before Email Address form group
const emailRegex = /<div class="form-group"[^>]*>\s*<label>Email Address<\/label>/;
if (!emailRegex.test(c)) {
  console.error('ERROR: could not find Email Address field to insert before');
  process.exit(1);
}

c = c.replace(emailRegex, googleBtn + '\n                    <div class="form-group">\n                        <label>Email Address</label>');

fs.writeFileSync(p, c, 'utf8');
console.log('OK: Google button inserted');

// Verify
const v = fs.readFileSync(p, 'utf8');
console.log('\n=== VERIFICATION ===');
const checks = [
  ['Google button present', v.includes('btn-google-signin')],
  ['signInWithGoogle handler wired', /onclick="signInWithGoogle\(\)"/.test(v)],
  ['Forgot Password count is 1', (v.match(/Forgot Password\?/g) || []).length === 1],
  ['Emojis intact', v.includes('🏥')],
];
let allPassed = true;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name);
  if (!pass) allPassed = false;
}
console.log(allPassed ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');