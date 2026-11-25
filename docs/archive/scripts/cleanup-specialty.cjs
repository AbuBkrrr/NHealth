const fs = require('fs');
const p = 'apps/backend/src/controllers/authController.ts';
let lines = fs.readFileSync(p, 'utf8').split('\n');
let removed = 0;

const kept = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Remove any line whose trimmed content starts with "specialtyId:"
  if (/^\s*specialtyId\s*:/.test(line)) {
    console.log('Line ' + (i + 1) + ': REMOVED → ' + line.trim());
    removed++;
    continue;
  }
  kept.push(line);
}

fs.writeFileSync(p, kept.join('\n'), 'utf8');
console.log('\nTotal lines removed: ' + removed);

// Verify
const v = fs.readFileSync(p, 'utf8');
console.log('\n=== VERIFICATION ===');
console.log('specialtyId occurrences remaining: ' + (v.match(/specialtyId/g) || []).length);
console.log('Emojis intact: ' + v.includes('🏥'));

if ((v.match(/specialtyId/g) || []).length === 0) {
  console.log('\n✅ ALL specialtyId REMOVED');
} else {
  console.log('\n❌ STILL PRESENT');
}