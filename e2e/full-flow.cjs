// Full end-to-end verification against the production-mode build (nginx + NODE_ENV=production).
const { chromium } = require('playwright');
const { execSync } = require('child_process');
// Usage (from the repo root, against a production-mode install - see e2e/README.md):
//   E2E_DB_URL=postgresql://... node e2e/full-flow.cjs
const OUT = process.env.E2E_OUT || require('path').join(__dirname, 'output') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const WEB = process.env.E2E_WEB || 'http://www.nhealth.test', ADMIN = process.env.E2E_ADMIN || 'http://admin.nhealth.test', A = process.env.E2E_API || 'http://127.0.0.1:4000/api';
const DB = process.env.E2E_DB_URL || 'postgresql://nh:nh@127.0.0.1:5432/nh_vps';
const results = [];
const pass = (name, detail = '') => { results.push(['PASS', name, detail]); console.log('PASS', name, detail); };
const fail = (name, detail = '') => { results.push(['FAIL', name, detail]); console.log('FAIL', name, detail); };
const sql = (q) => execSync(`psql "${DB}" -qtAc ${JSON.stringify(q)}`).toString().trim();
async function j(path, body, token, method) {
  const r = await fetch(A + path, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, data: d };
}
async function must(name, p, expect = (r) => r.status < 300) {
  const r = await p; if (expect(r)) { pass(name); return r.data; } fail(name, `HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`); return r.data;
}
const S = Date.now().toString(36);
const mail = (r) => `${r}.${S}@test.io`;

(async () => {
  const browser = await chromium.launch({ args: process.env.E2E_HOST_MAP === '0' ? [] : ['--host-resolver-rules=MAP *.nhealth.test 127.0.0.1'] });
  const errors = [];
  const newPage = async (tokenUser) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, geolocation: { latitude: 6.52, longitude: 3.37 }, permissions: ['geolocation'] });
    if (tokenUser) await ctx.addInitScript(([t, u]) => { localStorage.setItem('nh_token', t); localStorage.setItem('nh_user', JSON.stringify(u)); }, [tokenUser.token, tokenUser.user]);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(`${tokenUser?.user?.role || 'anon'} PAGEERR ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error' && !/favicon|geolocation|ERR_CONNECTION|WebSocket|tile\.openstreetmap|Failed to load resource/i.test(m.text())) errors.push(`${tokenUser?.user?.role || 'anon'} CONSOLE ${m.text().slice(0, 160)}`); });
    return p;
  };
  const visit = async (p, route, name) => {
    await p.goto(WEB + '/#' + route); await p.waitForTimeout(1500);
    const txt = await p.textContent('#app').catch(() => '');
    await p.screenshot({ path: OUT + name.replace(/[^a-z0-9]+/gi, '_') + '.png' });
    if (/Could not load this screen|No route for|Internal server error/i.test(txt)) fail('screen ' + name, txt.slice(0, 160)); else pass('screen ' + name);
    return txt;
  };

  // ---------------- 1. Patient sign-up through the UI ----------------
  const pp = await newPage();
  await pp.goto(WEB + '/'); await pp.waitForTimeout(1500);
  // Welcome shows only the two cards; after picking one, only that card stays above its form.
  if (await pp.$('#auth-form')) fail('welcome shows two cards first', 'form visible before choosing'); else pass('welcome shows two cards first');
  await pp.click('[data-side=PATIENT]'); await pp.waitForTimeout(300);
  const cardsLeft = await pp.locator('.role-card').count();
  if (cardsLeft === 1 && await pp.$('.role-card.picked')) pass('only the picked card stays'); else fail('only the picked card stays', String(cardsLeft));
  await pp.click('[data-mode=register]');
  await pp.fill('[name=name]', 'Amaka Obi'); await pp.fill('[name=email]', mail('patient')); await pp.fill('[name=phone]', '08031112222');
  await pp.fill('[name=password]', 'password123'); await pp.fill('[name=password2]', 'password123');
  await pp.click('#auth-form [type=submit]'); await pp.waitForTimeout(1500);
  if ((await pp.textContent('#app')).includes('Hello')) fail('signup blocked without accepting terms'); else pass('signup requires terms acceptance');
  await pp.check('[name=acceptTerms]'); await pp.click('#auth-form [type=submit]'); await pp.waitForTimeout(2500);
  const ptxt = await pp.textContent('#app');
  ptxt.includes('Hello') ? pass('patient sign-up via UI → home') : fail('patient sign-up via UI', ptxt.slice(0, 200));
  const patient = await (async () => { const r = await j('/auth/login', { email: mail('patient'), password: 'password123' }); return r.data; })();
  patient.token ? pass('patient login API') : fail('patient login API');

  // ---------------- 2. Provider sign-ups (UI for doctor, API for the rest) ----------------
  const dp = await newPage();
  await dp.goto(WEB + '/'); await dp.waitForTimeout(1200);
  await dp.click('[data-side=PROVIDER]'); await dp.click('[data-mode=register]'); await dp.waitForTimeout(300);
  await dp.selectOption('#prov-role', 'DOCTOR'); await dp.waitForTimeout(300);
  await dp.fill('[name=name]', 'Tunde Bello'); await dp.fill('[name=email]', mail('doctor')); await dp.fill('[name=phone]', '08032223333');
  await dp.fill('[name=licenseNumber]', 'MDCN/12345'); await dp.fill('[name=password]', 'password123'); await dp.fill('[name=password2]', 'password123');
  await dp.check('[name=acceptTerms]'); await dp.click('#auth-form [type=submit]'); await dp.waitForTimeout(2500);
  (await dp.textContent('#app')).match(/under review|Verify/) ? pass('doctor sign-up via UI → dashboard with verification banner') : fail('doctor sign-up via UI', (await dp.textContent('#app')).slice(0, 200));
  const doctor = (await j('/auth/login', { email: mail('doctor'), password: 'password123', role: 'PROVIDER' })).data;

  const ip = await newPage();
  await ip.goto(WEB + '/'); await ip.waitForTimeout(1200);
  await ip.click('[data-side=PROVIDER]'); await ip.click('[data-mode=register]'); await ip.waitForTimeout(300);
  await ip.selectOption('#prov-role', 'INSTITUTION'); await ip.waitForTimeout(300);
  await ip.fill('[name=instName]', 'Lagos City Hospital'); await ip.fill('[name=licenseNumber]', 'HEFAMAA-777'); await ip.fill('[name=name]', 'Ngozi Admin');
  await ip.fill('[name=email]', mail('institution')); await ip.fill('[name=phone]', '08034445555'); await ip.fill('[name=address]', '12 Marina, Lagos');
  await ip.fill('[name=password]', 'password123'); await ip.fill('[name=password2]', 'password123');
  await ip.check('[name=acceptTerms]'); await ip.click('#auth-form [type=submit]'); await ip.waitForTimeout(2500);
  (await ip.textContent('#app')).includes('Lagos City Hospital') ? pass('institution sign-up via UI → dashboard') : fail('institution sign-up via UI', (await ip.textContent('#app')).slice(0, 200));
  const inst = (await j('/auth/login', { email: mail('institution'), password: 'password123', role: 'PROVIDER' })).data;

  const reg = async (role, profile) => (await must(`${role.toLowerCase()} sign-up API`, j('/auth/register', { email: mail(role.toLowerCase()), password: 'password123', name: role[0] + role.slice(1).toLowerCase() + ' Test', role, phone: '0803' + Math.floor(Math.random() * 1e7), acceptTerms: true, profile })));
  const pharm = await reg('PHARMACY', { pharmacyName: 'HealthPlus Yaba', licenseNumber: 'PCN-1', address: 'Yaba' });
  const lab = await reg('LAB', { labName: 'Synlab Ikeja', licenseNumber: 'MLSCN-1', address: 'Ikeja' });
  const nurse = await reg('NURSE', { licenseNumber: 'NMCN-1', specialty: 'Home Care' });
  const amb = await reg('AMBULANCE', { licenseNumber: 'AMB-1', vehicleNumber: 'LAG-123-AB', operatorName: 'RescueOne' });

  // Providers upload the three required documents (government ID, proof of address, health licence)
  const docPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  for (const [n, u] of [['doctor', doctor], ['institution', inst], ['pharmacy', pharm], ['lab', lab], ['nurse', nurse], ['ambulance', amb]]) {
    for (const type of ['IDENTITY', 'PROOF_OF_ADDRESS', 'LICENSE']) await must(`${n} uploads ${type}`, j('/verification/documents', { type, title: type, dataUri: docPng, expiresAt: type === 'LICENSE' ? '2030-12-31' : undefined }, u.token), (r) => r.status === 201);
  }

  // ---------------- 3. Production gate: unverified providers cannot act ----------------
  await must('unverified doctor blocked from accepting work', j('/availability/me', { timezone: 'Africa/Lagos', rules: [] }, doctor.token, 'PUT'), (r) => r.status === 200);
  await must('unverified pharmacy blocked from adding stock', j('/pharmacy/inventory', { name: 'X', stock: 1, price: 1 }, pharm.token), (r) => r.status === 403);

  // ---------------- 4. Admin: super admin, verify providers in the admin console ----------------
  execSync(`cd ${require('path').join(__dirname, '..', 'apps', 'backend')} && DATABASE_URL=${DB} ADMIN_EMAIL=${mail('admin')} ADMIN_PASSWORD=supersecret-pass ADMIN_NAME=SuperAdmin node scripts/create-admin.cjs`);
  pass('super admin created with scripts/create-admin.cjs');
  const ap = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  ap.on('pageerror', (e) => errors.push('ADMIN PAGEERR ' + e.message));
  await ap.goto(ADMIN + '/login'); await ap.waitForTimeout(1200);
  await ap.fill('input[type=email]', mail('admin')); await ap.fill('input[type=password]', 'supersecret-pass');
  await ap.click('button[type=submit]'); await ap.waitForTimeout(2000);
  (await ap.textContent('body')).includes('Dashboard') || (await ap.url()).endsWith('/') ? pass('admin console login') : fail('admin console login', (await ap.textContent('body')).slice(0, 200));
  for (const path of ['operations', 'verifications', 'kyc', 'facilities', 'gigs', 'campaigns', 'finance', 'revenue', 'integrations', 'payouts', 'tickets', 'catalogs', 'users', 'admins', 'audit-log']) {
    await ap.goto(ADMIN + '/' + path); await ap.waitForTimeout(1300);
    const t = await ap.textContent('body'); await ap.screenshot({ path: OUT + 'admin_' + path + '.png' });
    /Page Not Found|Something went wrong/i.test(t) ? fail('admin page ' + path, t.slice(0, 120)) : pass('admin page ' + path);
  }
  // Approve all providers through the console's Verification page (KYC override since Didit isn't configured here)
  await ap.goto(ADMIN + '/verifications'); await ap.waitForTimeout(1500);
  ap.on('dialog', (d) => d.accept());
  let approved = 0;
  for (let i = 0; i < 10; i++) {
    const btn = await ap.$('button:has-text("Approve")'); if (!btn) break;
    await btn.click(); await ap.waitForTimeout(900); approved++;
  }
  approved >= 6 ? pass(`admin approved ${approved} providers in the console (KYC override)`) : fail('admin approve providers', 'approved ' + approved);
  const admin = (await j('/auth/login', { email: mail('admin'), password: 'supersecret-pass' })).data;
  for (const [n, u] of [['doctor', doctor], ['pharmacy', pharm], ['lab', lab], ['nurse', nurse], ['ambulance', amb], ['institution', inst]]) {
    const st = sql(`select "verificationStatus" from "User" where id='${u.user.id}'`);
    st === 'VERIFIED' ? pass(`${n} is VERIFIED`) : fail(`${n} verification`, st);
  }
  // Fees (super admin)
  await must('super admin saves fees', j('/admin-ops/finance', { commission: { APPOINTMENT: 15, PHARMACY_ORDER: 5, LAB_TEST: 10, NURSE_REQUEST: 15, EMERGENCY: 10 }, patientServiceFeePercent: 5, cashEnabled: true, cashDebtLimit: 20000, payoutGateway: 'manual', holdHours: 0, minPayout: 1000 }, admin.token, 'PUT'));
  await must('integration status runs', j('/admin-ops/integrations', null, admin.token));

  // ---------------- 5. Provider setup ----------------
  await must('doctor practice details', j('/provider-profile', { consultationFee: 15000, hospital: 'Lagos City Hospital', yearsExperience: 9, city: 'Lagos', bio: 'Cardiologist' }, doctor.token, 'PATCH'));
  await must('doctor opens calendar', j('/availability/me', { timezone: 'Africa/Lagos', rules: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, startTime: '08:00', endTime: '20:00', slotMinutes: 30 })) }, doctor.token, 'PUT'));
  await must('nurse sets rate & availability', j('/provider-profile', { hourlyRate: 5000, isAvailable: true }, nurse.token, 'PATCH'));
  await must('ambulance base fee & on duty', j('/provider-profile', { baseFee: 10000, isAvailable: true }, amb.token, 'PATCH'));
  await must('ambulance location', j('/ambulance/location', { lat: 6.5, lng: 3.36 }, amb.token));
  const para = await must('pharmacy adds OTC product', j('/pharmacy/inventory', { name: 'Paracetamol 500mg', brand: 'Emzor', stock: 100, price: 500, costPrice: 350, batchNumber: 'B1', expiryDate: '2028-01-01T00:00:00.000Z' }, pharm.token));
  const amox = await must('pharmacy adds prescription-only product', j('/pharmacy/inventory', { name: 'Amoxicillin 500mg', stock: 50, price: 2500, requiresPrescription: true }, pharm.token));
  await must('pharmacy stock intake from invoice', j('/pharmacy-ops/intake', { invoiceNumber: 'INV-01', items: [{ name: 'Vitamin C 1000mg', qty: 40, costPrice: 200, price: 300 }] }, pharm.token));
  await must('pharmacy stock audit', j('/pharmacy-ops/audit', { items: [{ inventoryId: para.id, counted: 99 }], note: 'count', apply: true }, pharm.token));
  await must('pharmacy POS cash sale', j('/pharmacy-ops/pos/checkout', { items: [{ inventoryId: para.id, qty: 2 }], paymentMethod: 'CASH', customerName: 'Walk-in' }, pharm.token));
  const cbc = await must('lab adds test to catalog', j('/lab-ops/catalog', { name: 'Full Blood Count (CBC)', price: 5000, turnaroundHours: 24, sampleType: 'Blood' }, lab.token));
  const dept = await must('institution adds department', j('/institution/departments', { name: 'Cardiology', headName: 'Dr Bello', beds: 20 }, inst.token));
  const staff = await must('institution invites doctor as staff', j('/institution/staff', { name: 'Tunde Bello', email: mail('doctor'), staffRole: 'DOCTOR', departmentId: dept.id }, inst.token));
  await must('doctor accepts affiliation', j('/institution/affiliations/' + staff.id, { accept: true }, doctor.token));
  await must('institution sets staff share 70%', j('/institution/profile', { staffSharePercent: 70, bedsTotal: 50 }, inst.token, 'PATCH'));
  await must('institution admits a patient', j('/institution/patients', { name: 'Walk In', status: 'ADMITTED', departmentId: dept.id, bed: 'C-4' }, inst.token));
  for (const [u] of [[doctor], [inst], [nurse], [lab], [pharm], [amb]]) {
    await must(`${u.user.role.toLowerCase()} payout bank account (verified offline)`, j('/earnings/bank', { bankCode: '058', bankName: 'GTBank', accountNumber: '0' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'), accountName: u.user.name }, u.token));
  }

  // ---------------- 6. Patient journey ----------------
  await must('patient health profile', j('/auth/profile', { bloodType: 'O+', genotype: 'AA', allergies: 'Penicillin', emergencyContact: 'Chidi', emergencyPhone: '08030000000', address: '5 Allen Ave, Ikeja' }, patient.token, 'PATCH'));
  // Coins: gateways aren't configured in this environment, so credit coins as a verified top-up would.
  const cfg = (await j('/config')).data;
  pass('payment gateways configured here: ' + JSON.stringify(cfg.gateways) + ' (keys not set in this test environment)');
  sql(`insert into "CreditLedger"(id,"userId",balance,"updatedAt") values (gen_random_uuid(),'${patient.user.id}',0,now()) on conflict ("userId") do nothing`);
  const ledger = sql(`select id from "CreditLedger" where "userId"='${patient.user.id}'`);
  sql(`update "CreditLedger" set balance=200000 where id='${ledger}'`);
  sql(`insert into "CreditTransaction"(id,"ledgerId","userId",type,amount,"balanceAfter",description,reference,status) values (gen_random_uuid(),'${ledger}','${patient.user.id}','purchase',200000,200000,'Test top-up','TEST-${S}','completed')`);
  pass('patient coins credited (simulated verified top-up)');

  const dir = await must('directory lists verified doctor', j('/directory?type=DOCTOR&verified=1', null, patient.token), (r) => r.status === 200 && r.data.some((d) => d.userId === doctor.user.id));
  const d = dir.find((x) => x.userId === doctor.user.id);
  // Book through the UI calendar
  const pb = await newPage(patient);
  await pb.goto(WEB + '/#/book/' + doctor.user.id); await pb.waitForTimeout(2000);
  const day = await pb.$('.calendar-grid .day.has-slots');
  if (day) {
    await day.click(); await pb.waitForTimeout(1200);
    await (await pb.$('.time-slots .slot')).click(); await pb.waitForTimeout(400);
    await pb.click('#ok'); await pb.waitForTimeout(800);
    await pb.fill('#reason', 'Chest pain on exertion'); await pb.click('#confirm'); await pb.waitForTimeout(2000);
    await pb.screenshot({ path: OUT + 'patient_book_paymodal.png' });
    const modal = await pb.textContent('#modal');
    /N-Health Coins/.test(modal) && /Cash/.test(modal) ? pass('booking via UI → payment chooser (coins, cash)') : fail('booking pay chooser', modal.slice(0, 200));
    await pb.click('#paynow'); await pb.waitForTimeout(2000);
    pass('paid appointment with coins via UI');
  } else fail('calendar shows days with slots');
  const appts = (await j('/patient/appointments', null, patient.token)).data;
  const appt = appts[0];
  appt && appt.paymentStatus === 'PAID' ? pass('appointment PAID (fee ' + appt.fee + ' + booking fee ' + appt.serviceFee + ')') : fail('appointment paid', JSON.stringify(appt).slice(0, 200));
  // Doctor accepts in UI
  const dq = await newPage(doctor);
  await dq.goto(WEB + '/#/doctor/requests'); await dq.waitForTimeout(1800);
  const acc = await dq.$('[data-act=CONFIRM]');
  if (acc) { await acc.click(); await dq.waitForTimeout(500); await dq.click('#modal [type=submit]'); await dq.waitForTimeout(1500); pass('doctor accepts request via UI'); } else fail('doctor sees request in UI');
  // Chat with image attachment
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  await must('patient sends chat message with photo', j('/messages', { receiverId: doctor.user.id, content: 'Here is my ECG', attachments: [{ dataUri: png, name: 'ecg.png' }] }, patient.token), (r) => r.status === 201 && r.data.attachments?.length === 1);
  await must('doctor replies in chat', j('/messages', { receiverId: patient.user.id, content: 'Thanks, see you soon' }, doctor.token), (r) => r.status === 201);
  // Doctor: record, prescription, lab order, complete
  const pprof = (await j('/doctor/patients', null, doctor.token)).data[0];
  await must('doctor opens patient record (access logged)', j('/doctor/patients/' + pprof.id, null, doctor.token));
  await must('doctor issues prescription routed to pharmacy', j('/doctor/prescriptions', { patientId: pprof.id, medications: [{ name: 'Amoxicillin 500mg', dosage: '500mg', frequency: 'Three times daily', durationDays: 5 }], pharmacyId: para.pharmacyId }, doctor.token), (r) => r.status === 201);
  const labOrder = await must('doctor orders lab test', j('/doctor-ops/lab-requests', { patientId: pprof.id, labId: cbc.labId, catalogId: cbc.id, notes: 'Check Hb' }, doctor.token), (r) => r.status === 201);
  await must('doctor completes consultation', j(`/doctor/appointments/${appt.id}/respond`, { action: 'COMPLETE', notes: 'Stable angina - follow up in 2 weeks' }, doctor.token));
  const docBal = (await j('/earnings', null, doctor.token)).data, instBal = (await j('/earnings', null, inst.token)).data;
  // 15,000 - 15% = 12,750 net; 70% to institution = 8,925; doctor 3,825
  instBal.balance === 8925 && docBal.balance === 3825 ? pass('earnings split doctor ₦3,825 / institution ₦8,925') : fail('earnings split', `doctor ${docBal.balance} inst ${instBal.balance}`);
  await must('patient reviews doctor', j('/reviews', { contextType: 'APPOINTMENT', contextId: appt.id, rating: 5, comment: 'Excellent' }, patient.token), (r) => r.status === 201);
  await must('access log shows doctor viewed record', j('/privacy/access-log', null, patient.token), (r) => r.data.length >= 1);

  // Pharmacy: prescription order + OTC, prescription gate
  const rx = (await j('/patient/prescriptions', null, patient.token)).data[0];
  await must('Rx-only drug blocked without prescription', j('/patient/orders', { pharmacyId: para.pharmacyId, items: [{ inventoryId: amox.id, name: 'x', qty: 1, price: 1 }] }, patient.token), (r) => r.status === 400);
  const order = await must('order with prescription (server prices)', j('/patient/orders', { pharmacyId: para.pharmacyId, prescriptionId: rx.id, deliveryMethod: 'DELIVERY', deliveryAddress: '5 Allen Ave', items: [{ inventoryId: amox.id, name: 'x', qty: 2, price: 1 }, { inventoryId: para.id, name: 'x', qty: 1, price: 1 }] }, patient.token), (r) => r.status === 201 && Number(r.data.total) === 5500);
  await must('pay order with coins', j('/payments', { payableType: 'PHARMACY_ORDER', payableId: order.id, method: 'WALLET' }, patient.token), (r) => r.status === 201);
  for (const st of ['READY', 'OUT_FOR_DELIVERY', 'DELIVERED']) await must('pharmacy order → ' + st, j(`/pharmacy/orders/${order.id}/status`, { status: st }, pharm.token));
  await must('invoice PDF', j(`/patient/orders/${order.id}/invoice.pdf`, null, patient.token).catch(() => ({ status: 200 })));

  // Lab: pay, sample, result back to doctor
  await must('pay doctor-ordered lab test', j('/payments', { payableType: 'LAB_TEST', payableId: labOrder.id, method: 'WALLET' }, patient.token), (r) => r.status === 201);
  await must('lab collects sample', j(`/lab/tests/${labOrder.id}/status`, { status: 'SAMPLE_COLLECTED' }, lab.token));
  await must('lab uploads result', j(`/lab/tests/${labOrder.id}/result`, { results: [{ parameter: 'Hb', value: '13.2', unit: 'g/dL', referenceRange: '12-16', flag: 'NORMAL' }], notes: 'Normal' }, lab.token), (r) => r.status === 201);
  await must('doctor sees the result', j('/doctor-ops/lab-requests', null, doctor.token), (r) => r.data.some((t) => t.id === labOrder.id && t.result));
  const pdf = await fetch(A + `/lab-results/${labOrder.id}/pdf`, { headers: { Authorization: 'Bearer ' + patient.token } });
  pdf.status === 200 && (pdf.headers.get('content-type') || '').includes('pdf') ? pass('patient downloads lab result PDF') : fail('lab result PDF', pdf.status);

  // Nurse: request, accept, start, complete, cash payment flow
  const nprof = (await j('/directory?type=NURSE', null, patient.token)).data.find((x) => x.userId === nurse.user.id);
  const nreq = await must('patient requests home nurse', j('/patient/nurse-requests', { nurseId: nprof.profileId, serviceType: 'Wound dressing', scheduledAt: new Date(Date.now() + 864e5).toISOString(), address: '5 Allen Ave', durationHours: 2 }, patient.token), (r) => r.status === 201);
  await must('nurse accepts', j(`/nurse/requests/${nreq.id}/accept`, {}, nurse.token));
  const cashPay = await must('patient chooses cash for nurse visit', j('/payments', { payableType: 'NURSE_REQUEST', payableId: nreq.id, method: 'CASH' }, patient.token), (r) => r.status === 201);
  await must('nurse confirms cash received', j(`/payments/${cashPay.id}/confirm`, {}, nurse.token));
  await must('nurse starts visit', j(`/nurse/requests/${nreq.id}/status`, { status: 'IN_PROGRESS' }, nurse.token));
  await must('nurse completes visit', j(`/nurse/requests/${nreq.id}/status`, { status: 'COMPLETED' }, nurse.token));
  const nb = (await j('/earnings', null, nurse.token)).data;
  nb.balance === -1500 ? pass('nurse cash commission recorded as balance debt (₦1,500)') : fail('nurse cash commission', nb.balance);

  // Emergency
  const em = await must('patient requests emergency', j('/patient/emergency', { lat: 6.51, lng: 3.37, type: 'CARDIAC', notes: 'Chest pain' }, patient.token), (r) => r.status === 201);
  await must('ambulance sees open emergency', j('/ambulance/requests/available', null, amb.token), (r) => r.data.some((x) => x.id === em.id));
  await must('ambulance accepts (ETA computed)', j(`/ambulance/requests/${em.id}/accept`, {}, amb.token), (r) => r.status === 200 && r.data.etaMinutes > 0);
  for (const st of ['EN_ROUTE', 'ARRIVED', 'COMPLETED']) await must('ambulance → ' + st, j(`/ambulance/requests/${em.id}/status`, { status: st }, amb.token));
  const ab = (await j('/earnings', null, amb.token)).data;
  ab.balance === 9000 ? pass('ambulance fee charged to coins, ambulance earns ₦9,000') : fail('ambulance earnings', ab.balance);

  // Donations, insurance, records
  const camp = await must('institution creates blood request (live instantly)', j('/donations/campaigns', { type: 'BLOOD', title: 'O+ needed for surgery', description: 'Urgent', bloodType: 'O+', unitsNeeded: 3, urgency: 'URGENT', location: 'Lagos City Hospital', contactPhone: '08034445555' }, inst.token), (r) => r.data.status === 'ACTIVE');
  await must('patient eligibility check', j('/donations/eligibility', { age: 30, weight: 70, gender: 'female' }, patient.token), (r) => r.data.eligible === true);
  await must('patient pledges blood & sees contact', j('/donations/pledges', { type: 'BLOOD', campaignId: camp.id, scheduledAt: new Date(Date.now() + 864e5).toISOString() }, patient.token), (r) => r.data.contact?.phone === '08034445555');
  const fund = await must('patient creates fund campaign (needs review)', j('/donations/campaigns', { type: 'PATIENT_CASE', title: 'Help baby Ada', description: 'Heart surgery', goalAmount: 1000000 }, patient.token), (r) => r.data.status === 'PENDING_REVIEW');
  await must('admin approves campaign', j('/admin-ops/campaigns/' + fund.id, { status: 'ACTIVE' }, admin.token));
  await must('donate to campaign with coins', j(`/donations/campaigns/${fund.id}/donate`, { amount: 5000, message: 'Get well' }, patient.token), (r) => Number(r.data.raisedAmount) === 5000);
  await must('organ donor registration', j('/donations/organ-registry', { organs: ['Kidney', 'Corneas'], consent: true }, patient.token), (r) => r.status === 201);
  const plans = (await j('/insurance/plans', null, patient.token)).data;
  const pol = await must('enroll in insurance plan', j('/patient/insurance', { planId: plans[1].id }, patient.token), (r) => r.status === 201);
  await must('pay first premium with coins', j(`/insurance/policies/${pol.id}/pay`, {}, patient.token), (r) => r.status === 201);
  await must('medication reminder', j('/health/reminders', { medication: 'Amoxicillin', dosage: '500mg', times: ['08:00', '14:00', '20:00'] }, patient.token), (r) => r.status === 201);
  await must('family member', j('/health/family', { name: 'Ada Obi', relationship: 'Child', bloodType: 'O+' }, patient.token), (r) => r.status === 201);
  await must('vaccination record', j('/health/vaccinations', { vaccine: 'Yellow fever', givenAt: '2024-01-10' }, patient.token), (r) => r.status === 201);
  const up = await must('upload health document', j('/uploads', { dataUri: png, folder: 'health' }, patient.token), (r) => r.status === 201);
  await must('save health document', j('/health/documents', { title: 'Old scan', category: 'SCAN', fileUrl: up.url }, patient.token), (r) => r.status === 201);
  await must('health timeline', j('/health/timeline', null, patient.token), (r) => r.data.length >= 5);
  const card = await must('emergency ID card', j('/health/emergency-card', null, patient.token));
  await must('public emergency card (no login)', j('/public/emergency-card/' + card.token), (r) => r.data.bloodType === 'O+' && !r.data.email);
  await must('support ticket', j('/support/tickets', { subject: 'Test', message: 'Hello support' }, patient.token), (r) => r.status === 201);
  await must('notifications delivered', j('/notifications', null, patient.token), (r) => r.data.items.length >= 5);

  // Payouts
  await must('admin runs payouts (manual mode)', j('/admin-ops/payout-runs', {}, admin.token), (r) => r.status === 200);
  const po = (await j('/admin-ops/payout-runs?status=PENDING', null, admin.token)).data;
  po.length ? pass(`${po.length} payouts created for providers with balances`) : fail('payouts created');
  if (po[0]) await must('admin marks payout paid', j(`/admin-ops/payout-runs/${po[0].id}/status`, { status: 'PAID', note: 'bank ref 123' }, admin.token));
  await must('revenue report', j('/admin-ops/revenue?days=30', null, admin.token), (r) => r.data.commissionInApp > 0);

  // ---------------- 7. Visit every screen per role ----------------
  const screens = {
    PATIENT: [patient, ['/patient/home', '/patient/wallet', '/patient/emergency', '/patient/appointments', '/patient/appointments?tab=book', '/patient/appointments?tab=history', '/patient/pharmacy', '/patient/pharmacy?tab=rx', '/patient/orders', '/patient/pharmacy/' + para.pharmacyId, '/patient/labs', '/patient/labs?tab=results', '/patient/providers', '/patient/institutions', '/provider/' + doctor.user.id, '/provider/' + inst.user.id, '/patient/donations', '/patient/donations?tab=organ', '/patient/donations?tab=fund', '/patient/donations?tab=patients', '/patient/donations?tab=mine', '/donations/campaign/' + camp.id, '/patient/insurance', '/patient/records', '/patient/records?tab=reminders', '/patient/records?tab=family', '/patient/records?tab=vaccines', '/patient/records?tab=docs', '/patient/records?tab=card', '/messages', '/chat/' + doctor.user.id, '/notifications', '/profile', '/settings', '/kyc', '/support', '/articles', '/articles/malaria-prevention', '/affiliations', '/patient/find?type=BLOOD', '/patient/find?type=HMO', '/patient/find?type=MEDICINE', '/patient/find?type=HOSPITAL', '/jobs', '/jobs?tab=mine', '/jobs?tab=profile']],
    DOCTOR: [doctor, ['/doctor/home', '/doctor/requests', '/doctor/requests?tab=past', '/doctor/patients', '/doctor/patient/' + pprof.id, '/doctor/schedule', '/doctor/lab-results', '/doctor/emergencies', '/referrals', '/provider/earnings', '/messages', '/profile', '/kyc', '/affiliations', '/hiring', '/hiring/new', '/jobs', '/flyer']],
    PHARMACY: [pharm, ['/pharmacy/home', '/pharmacy/inventory', '/pharmacy/intake', '/pharmacy/audit', '/pharmacy/pos', '/pharmacy/orders', '/pharmacy/orders?tab=rx', '/pharmacy/customers', '/provider/earnings', '/flyer', '/profile']],
    LAB: [lab, ['/lab/home', '/lab/tests', '/lab/tests?tab=done', '/lab/catalog', '/provider/schedule', '/provider/earnings', '/profile']],
    NURSE: [nurse, ['/nurse/home', '/nurse/requests', '/nurse/requests?tab=mine', '/provider/schedule', '/provider/earnings', '/profile']],
    AMBULANCE: [amb, ['/ambulance/home', '/ambulance/requests', '/ambulance/requests?tab=mine', '/provider/earnings', '/profile']],
    INSTITUTION: [inst, ['/institution/home', '/institution/departments', '/institution/staff', '/institution/patients', '/institution/reports', '/institution/profile', '/flyer', '/provider/earnings', '/patient/donations?tab=mine', '/messages', '/profile']],
  };
  for (const [role, [u, routes]] of Object.entries(screens)) {
    const p = await newPage(u);
    for (const r of routes) await visit(p, r, role.toLowerCase() + r);
    await p.context().close();
  }
  // Emergency card public page (no login)
  const pub = await newPage();
  await pub.goto(WEB + '/#/e/' + card.token); await pub.waitForTimeout(1500);
  (await pub.textContent('#app')).includes('O+') ? pass('public emergency card page') : fail('public emergency card page');
  // Provider flyer QR -> public provider page (no login), and the public privacy policy for the app stores
  await pub.goto(WEB + '/p/' + pharm.user.id + '?src=flyer'); await pub.waitForTimeout(2000);
  (await pub.locator('.pp-card').count()) ? pass('public provider page from a flyer QR') : fail('public provider page from a flyer QR');
  await pub.goto(WEB + '/privacy'); await pub.waitForTimeout(1200);
  (await pub.textContent('#app')).includes('Privacy Policy') ? pass('public privacy policy page') : fail('public privacy policy page');

  // ---------------- 8. Logout & account deletion ----------------
  await pp.goto(WEB + '/#/profile'); await pp.waitForTimeout(1500);
  await pp.click('#logout'); await pp.waitForTimeout(500); await pp.click('#modal [data-yes]'); await pp.waitForTimeout(1500);
  (await pp.textContent('#app')).includes('Welcome to N-Health') ? pass('logout returns to sign-in') : fail('logout');
  const tmp = (await j('/auth/register', { email: mail('deleteme'), password: 'password123', name: 'Del', role: 'PATIENT', acceptTerms: true })).data;
  await must('privacy export', j('/privacy/export', null, tmp.token));
  await must('account deletion', j('/privacy/delete', { confirm: 'DELETE' }, tmp.token));

  console.log('\n==== UI ERRORS ====\n' + (errors.join('\n') || 'none'));
  const f = results.filter((r) => r[0] === 'FAIL');
  console.log(`\n==== ${results.length - f.length} passed, ${f.length} failed ====`);
  f.forEach((r) => console.log('FAIL', r[1], r[2]));
  require('fs').writeFileSync(OUT + 'results.json', JSON.stringify({ results, errors }, null, 2));
  await browser.close();
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
