const fs = require('fs');
const p = 'apps/landing/index.html';
let c = fs.readFileSync(p, 'utf8');

if (c.includes('openForgotPassword')) {
  console.log('OK: Forgot Password link already present');
  process.exit(0);
}

const link = '<div style="text-align:right; margin-top:-6px; margin-bottom:12px;">' +
  '<a href="#" onclick="event.preventDefault(); openForgotPassword();" ' +
  'style="font-size:12px; color:var(--primary); text-decoration:none; font-weight:600;">Forgot Password?</a></div>';

// Find the password input field and its closing </div>
const re = /(<input[^>]*type="password"[^>]*id="login-password"[^>]*>\s*<\/div>)/;

if (!re.test(c)) {
  console.log('ERROR: could not find password field');
  process.exit(1);
}

c = c.replace(re, '$1\n                    ' + link);
fs.writeFileSync(p, c, 'utf8');
console.log('OK: added Forgot Password link');

// Verify
const v = fs.readFileSync(p, 'utf8');
console.log('Contains link: ' + v.includes('openForgotPassword'));
console.log('Emoji intact: ' + v.includes('🏥'));