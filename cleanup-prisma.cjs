const fs = require('fs');
const p = 'apps/backend/prisma/schema.prisma';
let lines = fs.readFileSync(p, 'utf8').split('\n');
let removed = 0;

// Patterns to remove (whole lines):
const removePatterns = [
  /^\s*specialty_rel\s+Specialization\?/,
  /^\s*specialtyId\s+String\?/,
  /^\s*doctors\s+DoctorProfile\[\]\s+@relation\("DoctorSpecialty"\)/,
  /^\s*nurses\s+NurseProfile\[\]\s+@relation\("NurseSpecialty"\)/,
];

const kept = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const shouldRemove = removePatterns.some(re => re.test(line));
  if (shouldRemove) {
    console.log('Line ' + (i + 1) + ': REMOVED → ' + line.trim());
    removed++;
  } else {
    kept.push(line);
  }
}

fs.writeFileSync(p, kept.join('\n'), 'utf8');
console.log('\nTotal lines removed: ' + removed);

// Verify
const v = fs.readFileSync(p, 'utf8');
const checks = [
  ['No specialtyId', !/specialtyId/.test(v)],
  ['No specialty_rel', !/specialty_rel/.test(v)],
  ['No DoctorSpecialty relation', !/DoctorSpecialty/.test(v)],
  ['No NurseSpecialty relation', !/NurseSpecialty/.test(v)],
];
console.log('\n=== VERIFICATION ===');
let allPassed = true;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name);
  if (!pass) allPassed = false;
}
console.log(allPassed ? '\n✅ ALL CLEAN' : '\n❌ SOMETHING STILL PRESENT');