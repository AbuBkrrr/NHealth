/**
 * N-Health 100-user simulation / load test.
 *
 * Registers 100 real users spread across every role, then drives them all
 * concurrently through the app's core features against a REAL running
 * backend (local or deployed) - registration, appointments, pharmacy
 * orders, lab tests, emergency/nurse requests, donations, insurance,
 * messaging, and payments - followed by a dedicated race-condition stress
 * test of the three places this app uses an atomic guard against concurrent
 * writes (ambulance claim, nurse claim, pharmacy stock decrement).
 *
 * Requires Node 18+ (uses the built-in `fetch`). No npm install needed.
 *
 * Usage:
 *   node simulate.js
 *   BASE_URL=https://your-backend.onrender.com/api node simulate.js
 *
 * This does NOT modify your database schema or seed data - it only
 * registers fresh accounts (emails suffixed with a run timestamp) and
 * exercises real endpoints. Safe to run against a throwaway/dev database;
 * do not point this at a production database you care about, since it will
 * create ~100 real accounts and dozens of real records.
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4000/api';
const ROOT_URL = BASE_URL.replace(/\/api\/?$/, '');
const RUN_ID = Date.now();

// ---------- Config: role distribution across the 100 simulated users ----------
const COUNTS = { PATIENT: 70, DOCTOR: 8, PHARMACY: 5, LAB: 5, AMBULANCE: 6, NURSE: 6 };

// ---------- Tiny concurrency limiter (no dependency needed) ----------
function pLimit(concurrency) {
  const queue = [];
  let active = 0;
  const next = () => {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => {
      active--;
      next();
    });
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    next();
  });
}
const limit = pLimit(25); // 25 concurrent requests at a time for the bulk phases

// ---------- Metrics ----------
const metrics = { total: 0, ok: 0, failed: 0, byLabel: {} };
function record(label, ok, ms) {
  metrics.total++;
  ok ? metrics.ok++ : metrics.failed++;
  const l = (metrics.byLabel[label] ??= { ok: 0, failed: 0, totalMs: 0, maxMs: 0 });
  ok ? l.ok++ : l.failed++;
  l.totalMs += ms;
  l.maxMs = Math.max(l.maxMs, ms);
}

async function call(label, path, { method = 'GET', token, body } = {}) {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const ms = Date.now() - start;
    const data = await res.json().catch(() => null);
    record(label, res.ok, ms);
    return { ok: res.ok, status: res.status, data, ms };
  } catch (err) {
    record(label, false, Date.now() - start);
    return { ok: false, status: 0, data: { error: String(err) }, ms: Date.now() - start };
  }
}

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const futureISO = (daysAhead) => new Date(Date.now() + daysAhead * 86400000).toISOString();

// ---------- Phase 1: register all 100 users ----------
async function registerAll() {
  const specialties = ['Cardiology', 'Pediatrics', 'Dermatology', 'General Practice', 'Neurology'];
  const jobs = [];
  const users = { PATIENT: [], DOCTOR: [], PHARMACY: [], LAB: [], AMBULANCE: [], NURSE: [] };

  for (const [role, count] of Object.entries(COUNTS)) {
    for (let i = 0; i < count; i++) {
      const email = `${role.toLowerCase()}${i}.${RUN_ID}@loadtest.local`;
      const profile =
        role === 'DOCTOR' ? { specialty: rand(specialties), consultationFee: 5000 + i * 500, yearsExperience: i } :
        role === 'PHARMACY' ? { pharmacyName: `LoadTest Pharmacy ${i}`, address: 'Lagos' } :
        role === 'LAB' ? { labName: `LoadTest Lab ${i}`, address: 'Lagos' } :
        role === 'NURSE' ? { specialty: 'Home Care', hourlyRate: 4000 } :
        undefined;

      jobs.push(limit(async () => {
        const reg = await call('register', '/auth/register', {
          method: 'POST',
          body: { name: `LoadTest ${role} ${i}`, email, password: 'password123', role, phone: undefined, profile },
        });
        if (reg.ok) {
          users[role].push({ token: reg.data.token, userId: reg.data.user.id, email });
        }
      }));
    }
  }
  await Promise.all(jobs);
  return users;
}

// ---------- Phase 2: providers set up (pharmacies stock inventory) ----------
async function seedPharmacyInventory(pharmacies) {
  const items = [
    { name: 'Paracetamol 500mg', category: 'Pain Relief', stock: 500, price: 500 },
    { name: 'Amoxicillin 250mg', category: 'Antibiotic', stock: 300, price: 1500 },
    { name: 'Vitamin C 1000mg', category: 'Supplement', stock: 400, price: 800 },
  ];
  await Promise.all(pharmacies.map((p) => limit(async () => {
    for (const item of items) {
      await call('pharmacy:create-inventory', '/pharmacy/inventory', { method: 'POST', token: p.token, body: item });
    }
  })));
}

// ---------- Phase 3: patients discover providers ----------
async function discoverProviders(anyToken) {
  const [doctors, pharmacies, labs, nurses] = await Promise.all([
    call('discover:doctors', '/providers/doctors', { token: anyToken }),
    call('discover:pharmacies', '/providers/pharmacies', { token: anyToken }),
    call('discover:labs', '/providers/labs', { token: anyToken }),
    call('discover:nurses', '/providers/nurses', { token: anyToken }),
  ]);
  return {
    doctors: doctors.data ?? [],
    pharmacies: pharmacies.data ?? [],
    labs: labs.data ?? [],
    nurses: nurses.data ?? [],
  };
}

// ---------- Phase 4: every patient concurrently exercises the core features ----------
async function patientsGoWild(patients, directory) {
  const { doctors, pharmacies, labs, nurses } = directory;
  const payables = []; // track {payableType, payableId, providerToken} for the payment phase

  await Promise.all(patients.map((patient, idx) => limit(async () => {
    // Book an appointment
    if (doctors.length) {
      const doctor = rand(doctors);
      const res = await call('patient:book-appointment', '/patient/appointments', {
        method: 'POST', token: patient.token,
        body: { doctorId: doctor.id, scheduledAt: futureISO(2 + (idx % 10)), type: 'IN_PERSON', reason: 'Load test checkup' },
      });
      if (res.ok) payables.push({ payableType: 'APPOINTMENT', payableId: res.data.id, providerToken: doctor._providerToken });

      // Send the doctor a message while we're at it
      await call('patient:send-message', '/messages', {
        method: 'POST', token: patient.token,
        body: { receiverId: doctor.user.id, content: 'Hi doctor, looking forward to the appointment.' },
      });
    }

    // Place a pharmacy order
    if (pharmacies.length) {
      const pharmacy = rand(pharmacies);
      const invRes = await call('patient:list-inventory', `/providers/pharmacies/${pharmacy.id}/inventory`, { token: patient.token });
      const item = invRes.data?.[0];
      if (item) {
        const res = await call('patient:place-order', '/patient/orders', {
          method: 'POST', token: patient.token,
          body: { pharmacyId: pharmacy.id, items: [{ inventoryId: item.id, name: item.name, qty: 1, price: Number(item.price) }] },
        });
        if (res.ok) payables.push({ payableType: 'PHARMACY_ORDER', payableId: res.data.id, providerToken: pharmacy._providerToken });
      }
    }

    // Request a lab test
    if (labs.length) {
      const lab = rand(labs);
      const res = await call('patient:request-lab-test', '/patient/lab-tests', {
        method: 'POST', token: patient.token,
        body: { labId: lab.id, testType: 'Full Blood Count', scheduledAt: futureISO(1 + (idx % 5)) },
      });
      if (res.ok) payables.push({ payableType: 'LAB_TEST', payableId: res.data.id, providerToken: lab._providerToken });
    }

    // Request a nurse - alternate between targeted and broadcast
    if (nurses.length) {
      const targeted = idx % 2 === 0;
      const body = targeted
        ? { nurseId: rand(nurses).id, serviceType: 'Home Care' }
        : { serviceType: 'General Care' }; // broadcast - any available nurse can claim it
      const res = await call('patient:request-nurse', '/patient/nurse-requests', { method: 'POST', token: patient.token, body });
      if (res.ok) payables.push({ payableType: 'NURSE_REQUEST', payableId: res.data.id, providerToken: null });
    }

    // Every 5th patient also triggers an emergency request
    if (idx % 5 === 0) {
      await call('patient:request-emergency', '/patient/emergency', {
        method: 'POST', token: patient.token,
        body: { lat: 6.5244 + Math.random() * 0.05, lng: 3.3792 + Math.random() * 0.05, notes: 'Load test emergency' },
      });
    }

    // Donation + insurance
    await call('patient:donate', '/patient/donations', {
      method: 'POST', token: patient.token, body: { campaign: 'General Fund', amount: 1000 + idx },
    });
    await call('patient:add-insurance', '/patient/insurance', {
      method: 'POST', token: patient.token,
      body: { provider: 'LoadTest Health Insurance', policyNumber: `POL-${RUN_ID}-${idx}`, premiumAmount: 5000 },
    });
  })));

  return payables;
}

// ---------- Phase 5: pay for everything created, and have the owning provider confirm ----------
async function processPayments(payables, patients) {
  await Promise.all(payables.map((p, i) => limit(async () => {
    const patient = patients[i % patients.length];
    const pay = await call('payment:create', '/payments', {
      method: 'POST', token: patient.token,
      body: { payableType: p.payableType, payableId: p.payableId, method: rand(['USSD', 'TRANSFER', 'CARD']) },
    });
    if (pay.ok && pay.data.status === 'PENDING' && p.providerToken) {
      await call('payment:confirm', `/payments/${pay.data.id}/confirm`, { method: 'POST', token: p.providerToken });
    }
  })));
}

// ---------- Phase 6: providers act on what patients created ----------
async function providersRespond(doctors) {
  await Promise.all(doctors.map((d) => limit(async () => {
    const res = await call('doctor:list-appointments', '/doctor/appointments', { token: d.token });
    const pending = (res.data ?? []).filter((a) => a.status === 'PENDING');
    for (const appt of pending) {
      await call('doctor:confirm-appointment', `/doctor/appointments/${appt.id}/respond`, {
        method: 'POST', token: d.token, body: { action: 'CONFIRM' },
      });
    }
  })));
}

// ---------- Phase 7: race-condition stress tests (the real point of this simulation) ----------
async function raceConditionTests(patients, ambulances, nurses, pharmacies) {
  const results = {};

  // --- Test A: N ambulances race to accept ONE broadcast emergency request ---
  if (ambulances.length >= 2 && patients.length) {
    const req = await call('race:create-emergency', '/patient/emergency', {
      method: 'POST', token: rand(patients).token, body: { lat: 6.52, lng: 3.37, notes: 'RACE TEST' },
    });
    if (req.ok) {
      const attempts = await Promise.all(
        ambulances.map((a) => call('race:ambulance-accept', `/ambulance/requests/${req.data.id}/accept`, { method: 'POST', token: a.token }))
      );
      const wins = attempts.filter((r) => r.ok).length;
      const conflicts = attempts.filter((r) => r.status === 409).length;
      results.ambulanceRace = { participants: ambulances.length, wins, conflicts, passed: wins === 1 };
    }
  }

  // --- Test B: N nurses race to accept ONE broadcast nurse request ---
  if (nurses.length >= 2 && patients.length) {
    const req = await call('race:create-nurse-request', '/patient/nurse-requests', {
      method: 'POST', token: rand(patients).token, body: { serviceType: 'RACE TEST' },
    });
    if (req.ok) {
      const attempts = await Promise.all(
        nurses.map((n) => call('race:nurse-accept', `/nurse/requests/${req.data.id}/accept`, { method: 'POST', token: n.token }))
      );
      const wins = attempts.filter((r) => r.ok).length;
      const conflicts = attempts.filter((r) => r.status === 409).length;
      results.nurseRace = { participants: nurses.length, wins, conflicts, passed: wins === 1 };
    }
  }

  // --- Test C: N patients race to buy the LAST unit of a single inventory item ---
  if (pharmacies.length && patients.length >= 5) {
    const pharmacy = pharmacies[0];
    const item = await call('race:create-scarce-item', '/pharmacy/inventory', {
      method: 'POST', token: pharmacy.token, body: { name: 'RACE TEST ITEM', category: 'Test', stock: 1, price: 100 },
    });
    if (item.ok) {
      const racers = patients.slice(0, 10);
      const attempts = await Promise.all(
        racers.map((p) => call('race:buy-scarce-item', '/patient/orders', {
          method: 'POST', token: p.token,
          body: { pharmacyId: pharmacy.id, items: [{ inventoryId: item.data.id, name: 'RACE TEST ITEM', qty: 1, price: 100 }] },
        }))
      );
      const wins = attempts.filter((r) => r.ok).length;
      const conflicts = attempts.filter((r) => r.status === 409).length;
      results.stockRace = { participants: racers.length, wins, conflicts, passed: wins === 1 };
    }
  }

  return results;
}

// ---------- Main ----------
async function main() {
  console.log(`\nN-Health load test - target: ${BASE_URL}\n`);

  const healthCheck = await fetch(`${ROOT_URL}/health`).catch(() => null);
  if (!healthCheck || !healthCheck.ok) {
    console.error(`Could not reach ${ROOT_URL}/health - is the backend running?`);
    process.exit(1);
  }
  console.log('Backend is reachable. Starting simulation...\n');

  console.log('Phase 1/7: registering 100 users across all roles...');
  const users = await registerAll();
  const totalRegistered = Object.values(users).reduce((s, arr) => s + arr.length, 0);
  console.log(`  -> ${totalRegistered}/100 registered successfully.`);
  if (users.PATIENT.length === 0) {
    console.error('No patients registered successfully - cannot continue (every later phase needs at least one).');
    process.exit(1);
  }

  console.log('Phase 2/7: pharmacies stocking inventory...');
  await seedPharmacyInventory(users.PHARMACY);

  console.log('Phase 3/7: patients discovering providers...');
  const directory = await discoverProviders(rand(users.PATIENT).token);
  // Tag each provider listing with its own auth token so later phases (payment
  // confirmation) know which account to act as, without a second lookup.
  const tagWithToken = (list, pool) => list.map((item) => {
    const match = pool.find((u) => u.userId === item.user.id);
    return { ...item, _providerToken: match?.token };
  });
  directory.doctors = tagWithToken(directory.doctors, users.DOCTOR);
  directory.pharmacies = tagWithToken(directory.pharmacies, users.PHARMACY);
  directory.labs = tagWithToken(directory.labs, users.LAB);
  console.log(`  -> found ${directory.doctors.length} doctors, ${directory.pharmacies.length} pharmacies, ${directory.labs.length} labs, ${directory.nurses.length} nurses.`);

  console.log('Phase 4/7: all patients concurrently booking, ordering, requesting, messaging...');
  const payables = await patientsGoWild(users.PATIENT, directory);
  console.log(`  -> ${payables.length} payable items created across all patients.`);

  console.log('Phase 5/7: creating and confirming payments...');
  await processPayments(payables, users.PATIENT);

  console.log('Phase 6/7: doctors responding to appointment requests...');
  await providersRespond(directory.doctors);

  console.log('Phase 7/7: race-condition stress tests (the real point of this run)...');
  const race = await raceConditionTests(users.PATIENT, users.AMBULANCE, users.NURSE, users.PHARMACY);

  // ---------- Report ----------
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  console.log(`Total requests: ${metrics.total}  |  OK: ${metrics.ok}  |  Failed: ${metrics.failed}`);
  console.log(`Overall success rate: ${((metrics.ok / metrics.total) * 100).toFixed(1)}%\n`);

  console.log('By endpoint:');
  for (const [label, l] of Object.entries(metrics.byLabel).sort()) {
    const avg = (l.totalMs / (l.ok + l.failed)).toFixed(0);
    console.log(`  ${label.padEnd(30)} ok=${l.ok}  failed=${l.failed}  avg=${avg}ms  max=${l.maxMs}ms`);
  }

  console.log('\nRace-condition stress tests (expect exactly 1 winner, rest 409 conflict):');
  for (const [name, r] of Object.entries(race)) {
    const verdict = r.passed ? 'PASS' : 'FAIL - investigate immediately';
    console.log(`  ${name}: ${r.participants} racers -> ${r.wins} won, ${r.conflicts} correctly rejected  [${verdict}]`);
  }
  if (Object.values(race).some((r) => !r.passed)) {
    console.log('\n  A race test showing more than 1 winner means two users could');
    console.log('  double-book the same resource under real concurrent load.');
  }
  console.log('\n' + '='.repeat(60) + '\n');
}

main().catch((err) => {
  console.error('Simulation crashed:', err);
  process.exit(1);
});
