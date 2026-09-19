const fs = require('fs');
const p = 'apps/landing/index.html';
let c = fs.readFileSync(p, 'utf8');
let changes = 0;

// ============================================================
// 1. Replace provider-type-section with a specialty dropdown
// ============================================================
const oldSectionRegex = /<div id="provider-type-section"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;
const oldMatch = c.match(oldSectionRegex);
if (!oldMatch) {
  console.error('ERROR: could not find provider-type-section');
  process.exit(1);
}

const newSection = `<div id="provider-type-section" style="display:none;">
                        <div class="form-group">
                            <label id="specialty-label">Select Specialty <span style="color:var(--error);">*</span></label>
                            <select id="specialty-select" onchange="onSpecialtyChange(this.value)">
                                <option value="">-- Choose your specialty --</option>
                            </select>
                        </div>
                    </div>`;

c = c.replace(oldSectionRegex, newSection);
changes++;
console.log('OK: replaced provider-type-section with specialty dropdown');

// ============================================================
// 2. Inject SPECIALTIES map + specialty logic into the script
// ============================================================
const specialtiesCode = `
        // ================================================
        // PROVIDER SPECIALTIES
        // ================================================
        const SPECIALTIES = {
            doctor: [
                'Family Medicine', 'Internal Medicine', 'Pediatrics',
                'Allergy & Immunology', 'Cardiology', 'Dermatology', 'Neurology', 'Psychiatry', 'Oncology',
                'General Surgery', 'Orthopedic Surgery', 'Neurosurgery', 'Plastic Surgery',
                'Anesthesiology', 'Emergency Medicine', 'Radiology', 'Pathology',
                'Obstetrics & Gynecology (OB/GYN)', 'Ophthalmology', 'Otolaryngology (ENT)', 'Urology'
            ],
            nurse: [
                'Licensed Practical/Vocational Nurse (LPN/LVN)',
                'Registered Nurse (RN)',
                'Nurse Practitioner (NP)',
                'Clinical Nurse Specialist (CNS)',
                'Certified Registered Nurse Anesthetist (CRNA)',
                'Certified Nurse-Midwife (CNM)'
            ],
            pharmacy: [
                'Pharmacist',
                'Pharmacy Technician',
                'Pharmacy Support Staff',
                'Oncology Pharmacist',
                'Pediatric Pharmacist',
                'Critical Care Pharmacist',
                'Industry Pharmacist'
            ],
            lab: [
                'Phlebotomist',
                'Medical Laboratory Technician (MLT)',
                'Medical Laboratory Scientist / Technologist (MLS/MT)',
                'Histotechnician / Histotechnologist',
                'Cytotechnologist',
                'Clinical Assistant',
                "Pathologists' Assistant"
            ],
            ambulance: [
                'Emergency Care Assistant / Support Worker',
                'Emergency Medical Technician (EMT)',
                'Paramedic',
                'Advanced Paramedic Practitioner / Critical Care Paramedic',
                'Emergency Medical Dispatcher'
            ]
        };

        let selectedSpecialty = '';

        function populateSpecialties(role) {
            const select = document.getElementById('specialty-select');
            const label = document.getElementById('specialty-label');
            const section = document.getElementById('provider-type-section');
            if (!select || !label || !section) return;

            const list = SPECIALTIES[role];
            if (!list) {
                section.style.display = 'none';
                return;
            }

            // Reset options
            select.innerHTML = '<option value="">-- Choose your specialty --</option>';
            list.forEach(function(s) {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                select.appendChild(opt);
            });

            // Set label to role name
            const roleName = role.charAt(0).toUpperCase() + role.slice(1);
            label.innerHTML = 'Select ' + roleName + ' Specialty <span style="color:var(--error);">*</span>';
            section.style.display = 'block';
        }

        function onSpecialtyChange(value) {
            selectedSpecialty = value;
        }
`;

// Insert before "function selectRole(role)"
if (!c.includes('const SPECIALTIES =')) {
  c = c.replace('function selectRole(role) {', specialtiesCode + '\n        function selectRole(role) {');
  changes++;
  console.log('OK: injected SPECIALTIES map and handlers');
} else {
  console.log('OK: SPECIALTIES already present');
}

// ============================================================
// 3. Update selectRole to populate specialties
// ============================================================
const oldSelectRoleLine = "document.getElementById('provider-type-section').style.display = providerTypes.includes(role) ? 'block' : 'none';";
const newSelectRoleLine = `if (providerTypes.includes(role)) { populateSpecialties(role); } else { const s = document.getElementById('provider-type-section'); if (s) s.style.display = 'none'; }`;

if (c.includes(oldSelectRoleLine)) {
  c = c.replace(oldSelectRoleLine, newSelectRoleLine);
  changes++;
  console.log('OK: updated selectRole to use specialty dropdown');
} else {
  console.log('WARN: selectRole provider-type line not found — checking alternate pattern');
  // Try alternate
  const altLine = "document.getElementById('provider-type-section').style.display = providerTypes.includes(role) ? 'block' : 'none';";
  if (c.includes(altLine)) {
    c = c.replace(altLine, newSelectRoleLine);
    changes++;
    console.log('OK: updated selectRole (alternate)');
  }
}

// ============================================================
// 4. Add specialty to registration payload
// ============================================================
const oldPayload = "body: JSON.stringify({ name, email, phone, password, role: 'PATIENT' })";
const newPayload = "body: JSON.stringify({ name, email, phone, password, role: (providerType ? providerType.toUpperCase() : 'PATIENT'), profile: selectedSpecialty ? { specialty: selectedSpecialty } : undefined })";

if (c.includes(oldPayload)) {
  c = c.replace(oldPayload, newPayload);
  changes++;
  console.log('OK: registration now sends specialty');
} else {
  console.log('WARN: could not find registration payload');
}

// ============================================================
// 5. Reset specialty when switching roles
// ============================================================
const resetCode = `
            selectedSpecialty = '';
            const selectEl = document.getElementById('specialty-select');
            if (selectEl) selectEl.value = '';
`;
if (!c.includes('selectedSpecialty = ' + "'';")) {
  // Insert at end of selectRole function — find the closing brace of the button assignment block
  const btnEndPattern = /(btn\.className = 'btn btn-primary btn-block';\s*\n\s*\})/;
  if (btnEndPattern.test(c)) {
    c = c.replace(btnEndPattern, "$1\n" + resetCode);
    changes++;
    console.log('OK: added specialty reset in selectRole');
  }
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
  ['SPECIALTIES map defined', v.includes('const SPECIALTIES =')],
  ['Doctor specialties present', v.includes("'Cardiology'")],
  ['Nurse specialties present', v.includes("'Nurse Practitioner (NP)'")],
  ['Pharmacy specialties present', v.includes("'Pharmacy Technician'")],
  ['Lab specialties present', v.includes("'Phlebotomist'")],
  ['Ambulance specialties present', v.includes("'Paramedic'")],
  ['populateSpecialties function', v.includes('function populateSpecialties')],
  ['specialty-select dropdown in HTML', v.includes('id="specialty-select"')],
  ['Registration sends specialty', v.includes('profile: selectedSpecialty')],
  ['Emojis intact', v.includes('🏥')],
];
let allPassed = true;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name);
  if (!pass) allPassed = false;
}
console.log(allPassed ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');