const fs = require('fs');
const path = require('path');

const landingDir = __dirname;
const indexPath = path.join(landingDir, 'index.html');

let c = fs.readFileSync(indexPath, 'utf8');

// 1. Add script tag
if (!c.includes('ui-fixes.js')) {
  c = c.replace('</body>', '    <script src="ui-fixes.js"></script>\n</body>');
  console.log('OK: script tag added');
}

// 2. Add CSS
const cssBlock = '\n        #app-modal.modal-overlay { z-index: 3000; }\n        #app-modal .modal-content { animation: slideUp 0.3s ease; }\n        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }\n        .modal-actions { display: flex; gap: 8px; margin-top: 16px; }\n        .modal-actions button { flex: 1; }\n        .amount-presets { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }\n        .amount-presets .preset { padding: 12px; border: 2px solid #E8ECF1; border-radius: 8px; text-align: center; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.2s; }\n        .amount-presets .preset:hover, .amount-presets .preset.selected { border-color: var(--primary); background: var(--primary-light); color: var(--primary); }\n        .info-list { padding-left: 18px; font-size: 12px; color: var(--text-secondary); line-height: 1.7; }\n        .info-list li { margin-bottom: 4px; }\n        .cart-item-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #E8ECF1; font-size: 13px; }\n        .cart-item-row:last-child { border-bottom: none; }\n        .payment-summary { background: var(--surface); padding: 12px; border-radius: 8px; margin: 12px 0; }\n        .payment-summary .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }\n        .payment-summary .total { border-top: 1px solid #E8ECF1; margin-top: 6px; padding-top: 8px; font-weight: 700; font-size: 15px; }\n';

if (!c.includes('#app-modal.modal-overlay')) {
  c = c.replace('</style>', cssBlock + '    </style>');
  console.log('OK: modal CSS added');
}

// 3. Rewire buttons (regex without emojis)
const replacements = [
  [/onclick="showToast\([^"]*New message composer opened[^"]*\)"/g, 'onclick="openNewMessage()"'],
  [/onclick="viewInsuranceClaims\(\)"/g, 'onclick="openInsuranceClaims()"'],
  [/onclick="showToast\([^"]*Enrollment started[^"]*\)"/g, 'onclick="enrollInsurance(\'Lagos State Health Scheme\', 15000, \'500,000\')"'],
  [/onclick="showToast\([^"]*Patient sponsorship form opened[^"]*\)"/g, 'onclick="sponsorPatient()"'],
  [/onclick="showToast\([^"]*Organ donation form opened[^"]*\)"/g, 'onclick="registerOrganDonor()"'],
  [/onclick="showToast\([^"]*Donation options opened[^"]*\)"/g, 'onclick="openDonateModal(\'Sickle Cell Treatment Fund\')"'],
  [/onclick="showToast\([^"]*Cart opened[^"]*\)"/g, 'onclick="openCart()"'],
];

let rewired = 0;
for (const [regex, replacement] of replacements) {
  const before = c.length;
  c = c.replace(regex, replacement);
  if (c.length !== before) {
    console.log('OK: rewired - ' + replacement.substring(0, 60) + '...');
    rewired++;
  }
}
console.log('Total rewired: ' + rewired);

fs.writeFileSync(indexPath, c, 'utf8');

// Verify
const verify = fs.readFileSync(indexPath, 'utf8');
const checks = [
  ['ui-fixes.js loaded', verify.includes('ui-fixes.js')],
  ['Modal CSS present', verify.includes('#app-modal.modal-overlay')],
  ['openNewMessage wired', verify.includes('openNewMessage()')],
  ['enrollInsurance wired', verify.includes('enrollInsurance(')],
  ['sponsorPatient wired', verify.includes('sponsorPatient()')],
  ['registerOrganDonor wired', verify.includes('registerOrganDonor()')],
  ['openDonateModal wired', verify.includes('openDonateModal(')],
  ['openCart wired', verify.includes('openCart()')],
  ['Emojis intact', verify.includes('🏥')],
];

console.log('\n=== VERIFICATION ===');
let allPassed = true;
for (const [name, passed] of checks) {
  console.log((passed ? 'PASS' : 'FAIL') + '  ' + name);
  if (!passed) allPassed = false;
}
console.log(allPassed ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');