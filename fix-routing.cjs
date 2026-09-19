const fs = require('fs');
const p = 'apps/landing/index.html';
let c = fs.readFileSync(p, 'utf8');
let changes = 0;

// 1. Ensure role-chooser.js is loaded
if (!c.includes('role-chooser.js')) {
  c = c.replace('</body>', '    <script src="role-chooser.js"></script>\n</body>');
  changes++;
  console.log('OK: added role-chooser.js script tag');
} else {
  console.log('OK: role-chooser.js already loaded');
}

// 2. Replace the login routing block
const routingRegex = /applyUserToUI\(currentUser\);[\s\S]{20,600}?showToast\('Welcome back! 👋'\);/;

const newRouting = "applyUserToUI(currentUser);\n\n" +
  "                    var userRoles = (currentUser && currentUser.roles && currentUser.roles.length) ? currentUser.roles : [(currentUser && currentUser.role) ? currentUser.role : 'PATIENT'];\n" +
  "                    console.log('User roles:', userRoles);\n" +
  "                    if (userRoles.length > 1 && typeof showRoleChooser === 'function') {\n" +
  "                        showRoleChooser(userRoles, currentUser);\n" +
  "                    } else {\n" +
  "                        var role = String(userRoles[0]).toLowerCase();\n" +
  "                        if (role === 'doctor') navigateTo('doctor-home');\n" +
  "                        else if (role === 'pharmacy') navigateTo('pharmacy-home');\n" +
  "                        else if (role === 'institution' || role === 'admin') navigateTo('institution-home');\n" +
  "                        else navigateTo('patient-home');\n" +
  "                    }\n" +
  "                    showToast('Welcome back! 👋');";

if (routingRegex.test(c)) {
  c = c.replace(routingRegex, newRouting);
  changes++;
  console.log('OK: replaced login routing');
} else {
  console.log('WARN: login routing pattern not matched');
}

// 3. Replace DOMContentLoaded routing block
const initRegex = /const role = \(\(currentUser && currentUser\.role\) \? currentUser\.role : 'patient'\)\.toLowerCase\(\);[\s\S]{50,500}?else navigateTo\('patient-home'\);/;

const newInit = "var userRoles = (currentUser && currentUser.roles && currentUser.roles.length) ? currentUser.roles : [(currentUser && currentUser.role) ? currentUser.role : 'PATIENT'];\n" +
  "                    var role = String(userRoles[0]).toLowerCase();\n" +
  "                    if (role === 'doctor') navigateTo('doctor-home');\n" +
  "                    else if (role === 'pharmacy') navigateTo('pharmacy-home');\n" +
  "                    else if (role === 'institution' || role === 'admin') navigateTo('institution-home');\n" +
  "                    else navigateTo('patient-home');";

if (initRegex.test(c)) {
  c = c.replace(initRegex, newInit);
  changes++;
  console.log('OK: replaced DOMContentLoaded routing');
} else {
  console.log('WARN: DOMContentLoaded routing pattern not matched');
}

// Save
fs.writeFileSync(p, c, 'utf8');
console.log('\nTotal changes: ' + changes);

// Verification
const v = fs.readFileSync(p, 'utf8');
console.log('\n=== VERIFICATION ===');
console.log('role-chooser.js loaded: ' + v.includes('role-chooser.js'));
console.log('Handles roles array: ' + v.includes('currentUser.roles'));
console.log('String() cast: ' + v.includes('String(userRoles[0])'));
console.log('Emoji intact: ' + v.includes('🏥'));