const fs = require('fs');
const p = 'apps/landing/index.html';
let c = fs.readFileSync(p, 'utf8');
let changes = 0;

// 1. Add script tags before </body> if missing
['ui-fixes.js', 'forgot-password.js', 'role-chooser.js'].forEach(function(file) {
  if (!c.includes(file)) {
    c = c.replace('</body>', '    <script src="' + file + '"></script>\n</body>');
    changes++;
    console.log('OK: added ' + file);
  } else {
    console.log('OK: ' + file + ' already loaded');
  }
});

// 2. Quote Google Client ID if unquoted
const ID = '753267520396-ucmfbovnvhu42mbc4elgdufl3k52m1fc.apps.googleusercontent.com';
if (c.includes(ID) && !c.includes("'" + ID + "'")) {
  // Replace unquoted assignment
  const re = new RegExp('=\\s*' + ID.replace(/[.]/g, '\\.'), 'g');
  c = c.replace(re, "= '" + ID + "'");
  changes++;
  console.log('OK: quoted Google Client ID');
} else {
  console.log('OK: Google Client ID already handled');
}

// 3. Add modal CSS if missing
if (!c.includes('#app-modal.modal-overlay')) {
  const css = '\n        #app-modal.modal-overlay { z-index: 3000; }\n        .modal-actions { display: flex; gap: 8px; margin-top: 16px; }\n        .modal-actions button { flex: 1; }\n        .amount-presets { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }\n        .amount-presets .preset { padding: 12px; border: 2px solid #E8ECF1; border-radius: 8px; text-align: center; cursor: pointer; font-weight: 600; font-size: 13px; }\n        .amount-presets .preset:hover, .amount-presets .preset.selected { border-color: var(--primary); background: var(--primary-light); color: var(--primary); }\n        .info-list { padding-left: 18px; font-size: 12px; color: var(--text-secondary); line-height: 1.7; }\n        .payment-summary { background: var(--surface); padding: 12px; border-radius: 8px; margin: 12px 0; }\n        .payment-summary .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }\n        .payment-summary .total { border-top: 1px solid #E8ECF1; margin-top: 6px; padding-top: 8px; font-weight: 700; font-size: 15px; }\n';
  c = c.replace('</style>', css + '</style>');
  changes++;
  console.log('OK: added modal CSS');
}

fs.writeFileSync(p, c, 'utf8');
console.log('\nTotal changes: ' + changes);

// Verify
const v = fs.readFileSync(p, 'utf8');
console.log('\n=== VERIFICATION ===');
console.log('Size: ' + v.length + ' chars');
console.log('patient-home: ' + /id="patient-home"/.test(v));
console.log('doctor-home: ' + /id="doctor-home"/.test(v));
console.log('pharmacy-home: ' + /id="pharmacy-home"/.test(v));
console.log('institution-home: ' + /id="institution-home"/.test(v));
console.log('patient-labs: ' + /id="patient-labs"/.test(v));
console.log('patient-notifications: ' + /id="patient-notifications"/.test(v));
console.log('ui-fixes.js: ' + /ui-fixes\.js/.test(v));
console.log('forgot-password.js: ' + /forgot-password\.js/.test(v));
console.log('role-chooser.js: ' + /role-chooser\.js/.test(v));
console.log('Emoji: ' + /🏥/.test(v));