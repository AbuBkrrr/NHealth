import crypto from 'crypto';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { getOrCreateLedger, purchaseCredits } from '../src/services/creditsService';
import { saveFinance } from '../src/services/settings';
import { balanceOf, markPayout } from '../src/services/earnings';
import { planFor } from '../src/services/splits';

const app = createApp();
const uniq = () => crypto.randomBytes(4).toString('hex');

async function register(role: string, profile: Record<string, unknown> = {}) {
  const email = `${role.toLowerCase()}-${uniq()}@test.io`;
  const r = await request(app).post('/api/auth/register').send({ email, password: 'password123', name: role + ' Tester', role, profile, acceptTerms: true, dataConsent: true, providerTerms: true });
  expect(r.status).toBe(201);
  return { token: r.body.token as string, user: r.body.user, email };
}
const auth = (t: string) => ({ Authorization: 'Bearer ' + t });

beforeAll(async () => {
  await prisma.$queryRawUnsafe('SELECT 1');
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('auth & security', () => {
  it('rejects requests without a token and enforces roles', async () => {
    expect((await request(app).get('/api/patient/appointments')).status).toBe(401);
    const p = await register('PATIENT');
    expect((await request(app).get('/api/doctor/appointments').set(auth(p.token))).status).toBe(403);
  });

  it('locks the account after repeated wrong passwords', async () => {
    const p = await register('PATIENT');
    for (let i = 0; i < 5; i++) await request(app).post('/api/auth/login').send({ email: p.email, password: 'wrong-password' });
    const r = await request(app).post('/api/auth/login').send({ email: p.email, password: 'password123' });
    expect(r.status).toBe(403);
  });

  it('revokes old tokens on logout-all', async () => {
    const p = await register('PATIENT');
    expect((await request(app).post('/api/auth/logout-all').set(auth(p.token))).status).toBe(200);
    await new Promise((r) => setTimeout(r, 10));
    expect((await request(app).get('/api/auth/me').set(auth(p.token))).status).toBe(401);
  });

  it('password reset requires a valid, hashed, single-use code', async () => {
    const p = await register('PATIENT');
    await request(app).post('/api/auth/forgot-password').send({ email: p.email });
    const bad = await request(app).post('/api/auth/reset-password').send({ email: p.email, code: '000000', password: 'newpassword1' });
    expect(bad.status).toBe(400);
    const rec = await prisma.otpCode.findFirst({ where: { target: p.email, purpose: 'password_reset' } });
    expect(rec?.codeHash).toHaveLength(64); // stored hashed, never plain
  });
});

describe('payments', () => {
  it('cannot grant itself coins without gateway confirmation', async () => {
    const p = await register('PATIENT');
    const ref = 'CR-TEST-' + uniq();
    await prisma.paymentGatewayLog.create({ data: { userId: p.user.id, gateway: 'paystack', internalRef: ref, gatewayRef: 'pending', amount: 5000, status: 'pending', purpose: 'credit_purchase' } });
    // Gateway is unreachable/unpaid in tests -> must NOT credit.
    const r = await request(app).post('/api/credits/purchase/confirm').set(auth(p.token)).send({ internalRef: ref });
    expect(r.status).toBe(402);
    const bal = await request(app).get('/api/credits/balance').set(auth(p.token));
    expect(bal.body.balance).toBe(0);
  });

  it('accepts only correctly signed Paystack webhooks and credits exactly once', async () => {
    const p = await register('PATIENT');
    const ref = 'CR-WH-' + uniq();
    await prisma.paymentGatewayLog.create({ data: { userId: p.user.id, gateway: 'paystack', internalRef: ref, gatewayRef: 'pending', amount: 2500, status: 'pending', purpose: 'credit_purchase' } });
    const body = JSON.stringify({ event: 'charge.success', data: { status: 'success', reference: ref, amount: 250000, currency: 'NGN', id: 99 } });
    const forged = await request(app).post('/api/webhooks/paystack').set('Content-Type', 'application/json').set('x-paystack-signature', 'nope').send(body);
    expect(forged.status).toBe(401);
    const sig = crypto.createHmac('sha512', 'sk_test_dummy').update(body).digest('hex');
    for (let i = 0; i < 2; i++) {
      const ok = await request(app).post('/api/webhooks/paystack').set('Content-Type', 'application/json').set('x-paystack-signature', sig).send(body);
      expect(ok.status).toBe(200);
    }
    const bal = await request(app).get('/api/credits/balance').set(auth(p.token));
    expect(bal.body.balance).toBe(2500);
  });

  it('rejects an underpaid webhook', async () => {
    const p = await register('PATIENT');
    const ref = 'CR-UP-' + uniq();
    await prisma.paymentGatewayLog.create({ data: { userId: p.user.id, gateway: 'paystack', internalRef: ref, gatewayRef: 'pending', amount: 10000, status: 'pending', purpose: 'credit_purchase' } });
    const body = JSON.stringify({ event: 'charge.success', data: { status: 'success', reference: ref, amount: 100, currency: 'NGN', id: 1 } });
    const sig = crypto.createHmac('sha512', 'sk_test_dummy').update(body).digest('hex');
    await request(app).post('/api/webhooks/paystack').set('Content-Type', 'application/json').set('x-paystack-signature', sig).send(body);
    const bal = await request(app).get('/api/credits/balance').set(auth(p.token));
    expect(bal.body.balance).toBe(0);
  });
});

describe('care flows', () => {
  it('books only open slots, prices server-side and pays with coins', async () => {
    const doc = await register('DOCTOR', { specialty: 'Cardiology', licenseNumber: 'MDCN-T', consultationFee: 10000 });
    const pat = await register('PATIENT');
    await request(app).put('/api/availability/me').set(auth(doc.token)).send({ timezone: 'Africa/Lagos', rules: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, startTime: '09:00', endTime: '12:00', slotMinutes: 30 })) });
    const day = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
    const slots = await request(app).get(`/api/availability/${doc.user.id}/slots?date=${day}`).set(auth(pat.token));
    expect(slots.body.slots.length).toBe(6);
    const dprof = await prisma.doctorProfile.findUnique({ where: { userId: doc.user.id } });
    const off = await request(app).post('/api/patient/appointments').set(auth(pat.token)).send({ doctorId: dprof!.id, scheduledAt: `${day}T03:00:00.000Z` });
    expect(off.status).toBe(409);
    const ok = await request(app).post('/api/patient/appointments').set(auth(pat.token)).send({ doctorId: dprof!.id, scheduledAt: slots.body.slots[0].start });
    expect(ok.status).toBe(201);
    expect(Number(ok.body.serviceFee)).toBe(500);
    const dup = await request(app).post('/api/patient/appointments').set(auth(pat.token)).send({ doctorId: dprof!.id, scheduledAt: slots.body.slots[0].start });
    expect(dup.status).toBe(409);
    const broke = await request(app).post('/api/payments').set(auth(pat.token)).send({ payableType: 'APPOINTMENT', payableId: ok.body.id, method: 'WALLET' });
    expect(broke.status).toBe(400);
    await getOrCreateLedger(pat.user.id);
    await purchaseCredits(pat.user.id, 20000, 'TEST-' + uniq(), 'test top-up');
    const paid = await request(app).post('/api/payments').set(auth(pat.token)).send({ payableType: 'APPOINTMENT', payableId: ok.body.id, method: 'WALLET' });
    expect(paid.status).toBe(201);
    expect((await request(app).get('/api/credits/balance').set(auth(pat.token))).body.balance).toBe(9500);
    // Doctor declines -> automatic refund
    await request(app).post(`/api/doctor/appointments/${ok.body.id}/respond`).set(auth(doc.token)).send({ action: 'CANCEL', notes: 'Unavailable' });
    expect((await request(app).get('/api/credits/balance').set(auth(pat.token))).body.balance).toBe(20000);
  });

  it('ignores client prices and blocks prescription-only drugs without a prescription', async () => {
    const ph = await register('PHARMACY', { pharmacyName: 'Test Pharm', licenseNumber: 'PCN-T' });
    const pat = await register('PATIENT');
    const otc = await request(app).post('/api/pharmacy/inventory').set(auth(ph.token)).send({ name: 'Paracetamol', stock: 10, price: 500 });
    const pom = await request(app).post('/api/pharmacy/inventory').set(auth(ph.token)).send({ name: 'Amoxicillin', stock: 10, price: 1500, requiresPrescription: true });
    const pid = (await prisma.pharmacyProfile.findUnique({ where: { userId: ph.user.id } }))!.id;
    const o = await request(app).post('/api/patient/orders').set(auth(pat.token)).send({ pharmacyId: pid, items: [{ inventoryId: otc.body.id, name: 'x', qty: 2, price: 1 }] });
    expect(o.status).toBe(201);
    expect(Number(o.body.total)).toBe(1000);
    const rx = await request(app).post('/api/patient/orders').set(auth(pat.token)).send({ pharmacyId: pid, items: [{ inventoryId: pom.body.id, name: 'x', qty: 1, price: 1 }] });
    expect(rx.status).toBe(400);
  });

  it('POS checkout deducts stock and applies tax', async () => {
    const ph = await register('PHARMACY', { pharmacyName: 'POS Pharm', licenseNumber: 'PCN-P' });
    const item = await request(app).post('/api/pharmacy/inventory').set(auth(ph.token)).send({ name: 'Vitamin C', stock: 5, price: 1000 });
    const sale = await request(app).post('/api/pharmacy-ops/pos/checkout').set(auth(ph.token)).send({ items: [{ inventoryId: item.body.id, qty: 2 }], paymentMethod: 'CASH' });
    expect(sale.status).toBe(201);
    expect(Number(sale.body.total)).toBe(2100);
    const inv = await prisma.inventory.findUnique({ where: { id: item.body.id } });
    expect(inv!.stock).toBe(3);
    const over = await request(app).post('/api/pharmacy-ops/pos/checkout').set(auth(ph.token)).send({ items: [{ inventoryId: item.body.id, qty: 9 }], paymentMethod: 'CASH' });
    expect(over.status).toBe(409);
  });
});

describe('identity, privacy & emergency card', () => {
  it('applies a signed Didit decision and rejects unsigned ones', async () => {
    const p = await register('PATIENT');
    const sessionId = 'sess-' + uniq();
    await prisma.kycVerification.create({ data: { userId: p.user.id, sessionId, status: 'In Progress' } });
    const body = JSON.stringify({ session_id: sessionId, status: 'Approved', vendor_data: p.user.id, decision: { id_verification: { document_type: 'Passport', document_number: 'A12345678', full_name: 'Test User' } } });
    const bad = await request(app).post('/api/webhooks/didit').set('Content-Type', 'application/json').set('x-signature', 'x').send(body);
    expect(bad.status).toBe(401);
    const sig = crypto.createHmac('sha256', 'didit_test_secret').update(body).digest('hex');
    const ok = await request(app).post('/api/webhooks/didit').set('Content-Type', 'application/json').set('x-signature', sig).set('x-timestamp', String(Math.floor(Date.now() / 1000))).send(body);
    expect(ok.status).toBe(200);
    const u = await prisma.user.findUnique({ where: { id: p.user.id } });
    expect(u!.kycStatus).toBe('APPROVED');
    const k = await prisma.kycVerification.findUnique({ where: { sessionId } });
    expect(k!.documentLast4).toBe('5678');
  });

  it('accepts Didit v3 X-Signature-V2 (canonical sorted JSON)', async () => {
    const p = await register('PATIENT');
    const sessionId = 'sess3-' + uniq();
    await prisma.kycVerification.create({ data: { userId: p.user.id, sessionId, status: 'In Progress' } });
    const payload = { status: 'Declined', session_id: sessionId, vendor_data: p.user.id, decision: { id_verifications: [{ document_type: 'Identity Card', document_number: 'NIN99887766', score: 1.0 }] } };
    const sortKeys = (v: any): any => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o: any, k) => ((o[k] = sortKeys(v[k])), o), {}) : v);
    const sig = crypto.createHmac('sha256', 'didit_test_secret').update(JSON.stringify(sortKeys(payload))).digest('hex');
    const r = await request(app).post('/api/webhooks/didit').set('Content-Type', 'application/json').set('x-signature-v2', sig).set('x-timestamp', String(Math.floor(Date.now() / 1000))).send(JSON.stringify(payload, null, 2));
    expect(r.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: p.user.id } }))!.kycStatus).toBe('DECLINED');
    expect((await prisma.kycVerification.findUnique({ where: { sessionId } }))!.documentLast4).toBe('7766');
  });

  it('serves a minimal public emergency card and supports account deletion', async () => {
    const p = await register('PATIENT');
    await request(app).patch('/api/auth/profile').set(auth(p.token)).send({ bloodType: 'O+', allergies: 'Penicillin' });
    const card = await request(app).get('/api/health/emergency-card').set(auth(p.token));
    const pub = await request(app).get('/api/public/emergency-card/' + card.body.token);
    expect(pub.status).toBe(200);
    expect(pub.body.bloodType).toBe('O+');
    expect(pub.body.email).toBeUndefined();
    const exp = await request(app).get('/api/privacy/export').set(auth(p.token));
    expect(exp.status).toBe(200);
    expect(exp.body.user.passwordHash).toBeUndefined();
    const del = await request(app).post('/api/privacy/delete').set(auth(p.token)).send({ confirm: 'DELETE' });
    expect(del.status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ email: p.email, password: 'password123' })).status).toBe(401);
  });
});

describe('provider earnings & payouts (Bolt-style)', () => {
  async function setup() {
    const admin = await prisma.user.create({ data: { email: `admin-${uniq()}@test.io`, name: 'Admin', passwordHash: 'x', role: 'ADMIN', isSuperAdmin: true } });
    await saveFinance({ commission: { APPOINTMENT: 20 }, holdHours: 0, minPayout: 1000, payoutGateway: 'manual', cashEnabled: true, cashDebtLimit: 4000 }, admin.id);
    const doc = await register('DOCTOR', { specialty: 'GP', licenseNumber: 'MDCN-E', consultationFee: 10000 });
    const pat = await register('PATIENT');
    await request(app).put('/api/availability/me').set(auth(doc.token)).send({ timezone: 'Africa/Lagos', rules: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, startTime: '08:00', endTime: '18:00', slotMinutes: 30 })) });
    const dprof = await prisma.doctorProfile.findUnique({ where: { userId: doc.user.id } });
    const book = async (n: number) => {
      const day = new Date(Date.now() + (2 + n) * 864e5).toISOString().slice(0, 10);
      const slots = await request(app).get(`/api/availability/${doc.user.id}/slots?date=${day}`).set(auth(pat.token));
      return (await request(app).post('/api/patient/appointments').set(auth(pat.token)).send({ doctorId: dprof!.id, scheduledAt: slots.body.slots[0].start })).body;
    };
    return { admin, doc, pat, book };
  }

  it('in-app: provider earns fee minus commission on completion; payout debits the balance', async () => {
    const { doc, pat, book } = await setup();
    const a = await book(1);
    await getOrCreateLedger(pat.user.id);
    await purchaseCredits(pat.user.id, 50000, 'TEST-' + uniq(), 'top-up');
    await request(app).post('/api/payments').set(auth(pat.token)).send({ payableType: 'APPOINTMENT', payableId: a.id, method: 'WALLET' });
    expect((await balanceOf(doc.user.id)).balance).toBe(0); // nothing until the service is delivered
    await request(app).post(`/api/doctor/appointments/${a.id}/respond`).set(auth(doc.token)).send({ action: 'COMPLETE' });
    await request(app).post(`/api/doctor/appointments/${a.id}/respond`).set(auth(doc.token)).send({ action: 'COMPLETE' }); // idempotent
    expect((await balanceOf(doc.user.id)).balance).toBe(8000); // 10,000 - 20%
    await prisma.bankAccount.create({ data: { userId: doc.user.id, bankCode: '058', bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Doc', isPrimary: true } });
    const earn = await request(app).get('/api/earnings').set(auth(doc.token));
    expect(earn.body.available).toBe(8000);
    const out = await request(app).post('/api/earnings/cash-out').set(auth(doc.token));
    expect(out.status).toBe(200);
    expect(out.body.status).toBe('PENDING'); // manual gateway → admin marks paid
    expect((await balanceOf(doc.user.id)).balance).toBe(0);
    await markPayout(out.body.reference, 'FAILED', 'test');
    expect((await balanceOf(doc.user.id)).balance).toBe(8000); // failed payout returned to balance
  });

  it('cash: provider confirms receipt, commission becomes a debt, cash blocked past the limit', async () => {
    const { doc, pat, book } = await setup();
    for (let i = 0; i < 4; i++) {
      const a = await book(10 + i);
      const p = await request(app).post('/api/payments').set(auth(pat.token)).send({ payableType: 'APPOINTMENT', payableId: a.id, method: 'CASH' });
      if (i === 2) { expect(p.status).toBe(400); break; } // owes 5,000 after two jobs > 4,000 limit, so the third cash job is refused
      expect(p.status).toBe(201);
      await request(app).post(`/api/payments/${p.body.id}/confirm`).set(auth(doc.token));
      await request(app).post(`/api/doctor/appointments/${a.id}/respond`).set(auth(doc.token)).send({ action: 'COMPLETE' });
    }
    const b = await balanceOf(doc.user.id);
    // per job: 20% of 10,000 commission + 500 patient booking fee the doctor collected in cash
    expect(b.balance).toBe(-5000);
    expect(b.owed).toBe(5000);
  });

  it('only super admins can change fees', async () => {
    const plainAdmin = await prisma.user.create({ data: { email: `ad-${uniq()}@test.io`, name: 'A', passwordHash: 'x', role: 'ADMIN' } });
    const { signToken } = await import('../src/utils/jwt');
    const t = signToken({ userId: plainAdmin.id, role: 'ADMIN' as any, isSuperAdmin: false, tv: 0 } as any, process.env.JWT_SECRET!, '1h');
    const r = await request(app).put('/api/admin-ops/finance').set(auth(t)).send({ commission: { APPOINTMENT: 50 } });
    expect(r.status).toBe(403);
  });
});

describe('direct split payments & institution routing', () => {
  async function world(sharePct: number) {
    const admin = await prisma.user.create({ data: { email: `adm-${uniq()}@test.io`, name: 'Admin', passwordHash: 'x', role: 'ADMIN', isSuperAdmin: true } });
    await saveFinance({ commission: { APPOINTMENT: 20 }, holdHours: 0, patientServiceFeePercent: 5 }, admin.id);
    const inst = await register('INSTITUTION', { name: 'City Hospital', type: 'HOSPITAL', licenseNumber: 'H-9' });
    const doc = await register('DOCTOR', { specialty: 'GP', licenseNumber: 'MDCN-S', consultationFee: 10000 });
    const pat = await register('PATIENT');
    const ip = await prisma.institutionProfile.findUnique({ where: { userId: inst.user.id } });
    await prisma.institutionProfile.update({ where: { id: ip!.id }, data: { staffSharePercent: sharePct } });
    await prisma.institutionStaff.create({ data: { institutionId: ip!.id, userId: doc.user.id, name: 'Doc', email: doc.email, staffRole: 'DOCTOR', status: 'ACTIVE', joinedAt: new Date() } });
    await request(app).put('/api/availability/me').set(auth(doc.token)).send({ timezone: 'Africa/Lagos', rules: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, startTime: '08:00', endTime: '18:00', slotMinutes: 30 })) });
    const dprof = await prisma.doctorProfile.findUnique({ where: { userId: doc.user.id } });
    const day = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
    const slots = await request(app).get(`/api/availability/${doc.user.id}/slots?date=${day}`).set(auth(pat.token));
    const appt = (await request(app).post('/api/patient/appointments').set(auth(pat.token)).send({ doctorId: dprof!.id, scheduledAt: slots.body.slots[0].start })).body;
    return { inst, doc, pat, appt };
  }

  it('splits an affiliated doctor\'s coin earnings with the institution', async () => {
    const { inst, doc, pat, appt } = await world(60);
    await getOrCreateLedger(pat.user.id);
    await purchaseCredits(pat.user.id, 20000, 'TEST-' + uniq(), 'top-up');
    await request(app).post('/api/payments').set(auth(pat.token)).send({ payableType: 'APPOINTMENT', payableId: appt.id, method: 'WALLET' });
    await request(app).post(`/api/doctor/appointments/${appt.id}/respond`).set(auth(doc.token)).send({ action: 'COMPLETE' });
    // 10,000 fee - 20% = 8,000 net → 60% (4,800) institution, 3,200 doctor
    expect((await balanceOf(inst.user.id)).balance).toBe(4800);
    expect((await balanceOf(doc.user.id)).balance).toBe(3200);
  });

  it('settles a split card payment directly, and claws back shares on refund', async () => {
    const { inst, doc, pat, appt } = await world(100);
    // Institution has a split subaccount; the doctor has none (but all of the net goes to the institution anyway).
    await prisma.bankAccount.create({ data: { userId: inst.user.id, bankCode: '058', bankName: 'GTBank', accountNumber: '0011223344', accountName: 'City Hospital', isPrimary: true, isVerified: true, paystackSubaccount: 'ACCT_test' } });
    const plan = await planFor('APPOINTMENT', appt.id, pat.user.id);
    expect(plan.total).toBe(10500);
    expect(plan.payees).toEqual([expect.objectContaining({ userId: inst.user.id, role: 'INSTITUTION', amount: 8000 })]);
    expect(plan.platformAmount).toBe(2500); // 2,000 commission + 500 booking fee
    const ref = 'PY-T-' + uniq();
    await prisma.paymentGatewayLog.create({ data: { userId: pat.user.id, gateway: 'paystack', internalRef: ref, gatewayRef: 'pending', amount: plan.total, status: 'pending', purpose: 'direct_payment', requestPayload: { payableType: 'APPOINTMENT', payableId: appt.id, plan, settled: { [inst.user.id]: true } } as any } });
    const body = JSON.stringify({ event: 'charge.success', data: { status: 'success', reference: ref, amount: plan.total * 100, currency: 'NGN', id: 777 } });
    const sig = crypto.createHmac('sha512', 'sk_test_dummy').update(body).digest('hex');
    expect((await request(app).post('/api/webhooks/paystack').set('Content-Type', 'application/json').set('x-paystack-signature', sig).send(body)).status).toBe(200);
    const pay = await prisma.payment.findFirst({ where: { payableId: appt.id, status: 'CONFIRMED' } });
    expect(pay?.method).toBe('CARD');
    expect((await prisma.appointment.findUnique({ where: { id: appt.id } }))!.paymentStatus).toBe('PAID');
    expect(await prisma.providerLedgerEntry.count({ where: { providerUserId: inst.user.id, type: 'DIRECT_SETTLED', sourceId: appt.id } })).toBe(1);
    expect((await balanceOf(inst.user.id)).balance).toBe(0); // money already in their bank
    // Doctor declines: patient refunded by the gateway, institution's settled share recovered from future earnings.
    await request(app).post(`/api/doctor/appointments/${appt.id}/respond`).set(auth(doc.token)).send({ action: 'CANCEL', notes: 'Away' });
    expect((await prisma.payment.findUnique({ where: { id: pay!.id } }))!.status).toBe('CANCELLED');
    expect((await balanceOf(inst.user.id)).balance).toBe(-8000);
  });
});

describe('marketing links', () => {
  it('tells repeat opens on one device apart from a shared link, and attributes the signup', async () => {
    const { signToken } = await import('../src/utils/jwt');
    const boss = await prisma.user.create({ data: { email: `mk-${uniq()}@test.io`, name: 'Boss', passwordHash: 'x', role: 'ADMIN', isSuperAdmin: true } });
    const plain = await prisma.user.create({ data: { email: `mk-${uniq()}@test.io`, name: 'Ops', passwordHash: 'x', role: 'ADMIN', isSuperAdmin: false } });
    const t = signToken({ userId: boss.id, role: 'ADMIN' as any, isSuperAdmin: true, tv: 0 } as any, process.env.JWT_SECRET!, '1h');
    const t2 = signToken({ userId: plain.id, role: 'ADMIN' as any, isSuperAdmin: false, tv: 0 } as any, process.env.JWT_SECRET!, '1h');
    expect((await request(app).get('/api/admin-ops/marketing/overview').set(auth(t2))).status).toBe(403);

    const created = await request(app).post('/api/admin-ops/marketing/links').set(auth(t)).send({ label: 'Flyers ' + uniq(), channel: 'qr' });
    const link = created.body;
    expect(created.status).toBe(201);
    expect(link.url).toContain('/go/' + link.slug);
    const phoneA = crypto.randomUUID(), phoneB = crypto.randomUUID();
    const open = (deviceId: string, ua: string) => request(app).post('/api/mkt/open').set('User-Agent', ua).set('cf-ipcountry', 'NG').set('cf-ipcity', 'Lagos').send({ slug: link.slug, deviceId });
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 Version/17.1 Mobile/15E148 Safari/604.1';
    const r1 = await open(phoneA, iphone); const r2 = await open(phoneA, iphone); const r3 = await open(phoneA, iphone);
    expect([r1.body.openNo, r2.body.openNo, r3.body.openNo]).toEqual([1, 2, 3]);
    expect(r3.body.deviceNo).toBe(1);
    let ov = (await request(app).get('/api/admin-ops/marketing/overview?linkId=' + link.id).set(auth(t))).body;
    expect(ov.perLink[0].verdict).toBe('1 device, opened 3×');

    const r4 = await open(phoneB, 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 WhatsApp/2.24');
    expect(r4.body).toMatchObject({ deviceNo: 2, openNo: 1, newDevice: true });
    await request(app).post('/api/mkt/lead').send({ slug: link.slug, deviceId: phoneB, name: 'Bola', phone: '+2348030000000', consent: true }).expect(201);
    const email = `mk-${uniq()}@test.io`;
    await request(app).post('/api/auth/register').send({ email, password: 'password123', name: 'Bola', role: 'PATIENT', acceptTerms: true, dataConsent: true, providerTerms: true, mkt: { deviceKey: 'd:' + phoneB } }).expect(201);

    ov = (await request(app).get('/api/admin-ops/marketing/overview?linkId=' + link.id).set(auth(t))).body;
    const l = ov.perLink[0];
    expect(l).toMatchObject({ opens: 4, devices: 2, repeatOpens: 2, verdict: 'Shared · 2 devices', signups: 1, leads: 1 });
    expect(ov.leads[0].opensBefore).toBe(1);
    const pixel = ov.recentOpens.find((o: any) => o.deviceNo === 2);
    expect(pixel).toMatchObject({ inApp: 'WhatsApp', model: 'Pixel 7', registered: true });
    const qr = await request(app).get(`/api/admin-ops/marketing/links/${link.id}/qr.svg`).set(auth(t));
    expect(qr.status).toBe(200);
    expect(qr.headers['content-type']).toContain('image/svg+xml');
    // Super admins are told about every enquiry, and the console counts the ones nobody has handled.
    const sum = (await request(app).get('/api/admin-ops/marketing/leads/summary').set(auth(t))).body;
    expect(sum.newCount).toBeGreaterThanOrEqual(1);
    expect((await request(app).get('/api/admin-ops/marketing/leads/summary').set(auth(t2))).status).toBe(403);
    await new Promise((r) => setTimeout(r, 300));
    expect(await prisma.notification.count({ where: { userId: boss.id, type: 'lead' } })).toBeGreaterThanOrEqual(1);
  });
});

describe('provider verification documents', () => {
  it('cannot approve a provider until ID, proof of address and licence are uploaded', async () => {
    const { signToken } = await import('../src/utils/jwt');
    const boss = await prisma.user.create({ data: { email: `v-${uniq()}@test.io`, name: 'Boss', passwordHash: 'x', role: 'ADMIN', isSuperAdmin: true } });
    const t = signToken({ userId: boss.id, role: 'ADMIN' as any, isSuperAdmin: true, tv: 0 } as any, process.env.JWT_SECRET!, '1h');
    const doc = await register('DOCTOR', { licenseNumber: 'MDCN-' + uniq() });
    const approve = () => request(app).post('/api/admin-ops/verifications/' + doc.user.id).set(auth(t)).send({ decision: 'VERIFIED', overrideKyc: true });
    let r = await approve();
    expect(r.status).toBe(400);
    expect(r.body.error).toContain('Government-issued ID');
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    for (const type of ['IDENTITY', 'PROOF_OF_ADDRESS']) await request(app).post('/api/verification/documents').set(auth(doc.token)).send({ type, dataUri: png }).expect(201);
    // An expired licence does not count
    await request(app).post('/api/verification/documents').set(auth(doc.token)).send({ type: 'LICENSE', dataUri: png, expiresAt: '2020-01-01' }).expect(201);
    r = await approve();
    expect(r.status).toBe(400);
    expect(r.body.error).toContain('licence');
    const q = await request(app).get('/api/admin-ops/verifications?status=PENDING').set(auth(t));
    expect(q.body.find((u: any) => u.id === doc.user.id).missingDocuments).toEqual(['Health / practising licence']);
    await request(app).post('/api/verification/documents').set(auth(doc.token)).send({ type: 'LICENSE', dataUri: png, expiresAt: '2030-01-01' }).expect(201);
    expect((await approve()).status).toBe(200);
  });
});

describe('marketing precise location', () => {
  it('stores a position only from the device that made the open', async () => {
    const dev = crypto.randomUUID(), other = crypto.randomUUID();
    const open = await request(app).post('/api/mkt/open').send({ deviceId: dev }).expect(200);
    await request(app).post('/api/mkt/locate').send({ visitId: open.body.visitId, deviceId: other, lat: 6.45, lng: 3.39, accuracy: 7 }).expect(404);
    await request(app).post('/api/mkt/locate').send({ visitId: open.body.visitId, deviceId: dev, lat: 6.4541237, lng: 3.3947112, accuracy: 7.24 }).expect(200);
    const v = await prisma.marketingVisit.findUnique({ where: { id: open.body.visitId } });
    expect(v).toMatchObject({ lat: 6.454124, lng: 3.394711, accuracyM: 7.2 });
  });
});

describe('emergency: going to a hospital yourself', () => {
  it('lists open hospitals near the patient, alerts the chosen one, and tells the patient when it is ready', async () => {
    const o = Math.round(Math.random() * 3000) / 1000 + 1; // degrees east, unique per run
    const inst = await register('INSTITUTION', { name: 'ER Hospital ' + uniq(), type: 'HOSPITAL', licenseNumber: 'H-' + uniq() });
    const closed = await register('INSTITUTION', { name: 'Closed Hospital ' + uniq(), type: 'HOSPITAL', licenseNumber: 'H-' + uniq() });
    await prisma.user.updateMany({ where: { id: { in: [inst.user.id, closed.user.id] } }, data: { verificationStatus: 'VERIFIED' } });
    // Hospital sets its emergency board
    await prisma.institutionProfile.update({ where: { userId: inst.user.id }, data: { lat: 6.5158, lng: 3.3898 + o } });
    await prisma.institutionProfile.update({ where: { userId: closed.user.id }, data: { lat: 6.5100, lng: 3.3700 + o, emergencyCare: true, erOpen: false } });
    const board = await request(app).patch('/api/institution/er').set(auth(inst.token)).send({ emergencyCare: true, erOpen: true, erDoctorsOnDuty: 2, erNursesOnDuty: 3, erServices: ['Trauma / accidents', 'Not a real service'] });
    expect(board.status).toBe(200);
    expect(board.body.erServices).toEqual(['Trauma / accidents']);

    const pat = await register('PATIENT');
    const other = await register('PATIENT');
    expect((await request(app).get('/api/er/hospitals').set(auth(pat.token))).status).toBe(400); // location needed
    const near = await request(app).get(`/api/er/hospitals?lat=6.4990&lng=${3.355 + o}&type=ACCIDENT`).set(auth(pat.token));
    expect(near.status).toBe(200);
    const mine = near.body.find((h: any) => h.userId === inst.user.id);
    expect(mine).toMatchObject({ erOpen: true, erDoctorsOnDuty: 2, handlesType: true });
    expect(near.body.findIndex((h: any) => h.userId === inst.user.id)).toBeLessThan(near.body.findIndex((h: any) => h.userId === closed.user.id)); // open first
    expect((await request(app).get('/api/er/hospitals?lat=6.5&lng=3.36').set(auth(inst.token))).status).toBe(403); // patients only

    const closedProfile = await prisma.institutionProfile.findUnique({ where: { userId: closed.user.id } });
    expect((await request(app).post('/api/er/arrivals').set(auth(pat.token)).send({ institutionId: closedProfile!.id, lat: 6.499, lng: 3.355 + o })).status).toBe(409);
    const a = await request(app).post('/api/er/arrivals').set(auth(pat.token)).send({ institutionId: mine.id, type: 'ACCIDENT', transport: 'TAXI', notes: 'deep cut', lat: 6.499, lng: 3.355 + o });
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ status: 'REQUESTED', type: 'ACCIDENT', transport: 'TAXI' });
    expect(a.body.etaMinutes).toBeGreaterThan(0);
    expect(await prisma.notification.count({ where: { userId: inst.user.id, type: 'emergency' } })).toBeGreaterThanOrEqual(1);

    // Hospital sees it with the patient's medical summary; another patient cannot touch it
    const b = await request(app).get('/api/institution/er').set(auth(inst.token));
    const incoming = b.body.arrivals.find((x: any) => x.id === a.body.id);
    expect(incoming.patient.name).toBe('PATIENT Tester');
    expect((await request(app).post(`/api/er/arrivals/${a.body.id}/cancel`).set(auth(other.token))).status).toBe(404);
    expect((await request(app).post(`/api/institution/er/${a.body.id}/respond`).set(auth(closed.token)).send({ accept: true })).status).toBe(404);

    // Position on the way updates the arrival time; hospital accepts with a note for the patient
    const loc = await request(app).post(`/api/er/arrivals/${a.body.id}/location`).set(auth(pat.token)).send({ lat: 6.512, lng: 3.385 + o });
    expect(loc.body.etaMinutes).toBeLessThan(a.body.etaMinutes);
    const acc = await request(app).post(`/api/institution/er/${a.body.id}/respond`).set(auth(inst.token)).send({ accept: true, readyNote: 'Use the Emergency gate' });
    expect(acc.body).toMatchObject({ status: 'ACCEPTED', readyNote: 'Use the Emergency gate' });
    expect(await prisma.notification.count({ where: { userId: pat.user.id, type: 'emergency' } })).toBeGreaterThanOrEqual(1);
    const trips = await request(app).get('/api/er/arrivals').set(auth(pat.token));
    expect(trips.body[0]).toMatchObject({ id: a.body.id, status: 'ACCEPTED' });
    expect(trips.body[0].institution.name).toContain('ER Hospital');

    expect((await request(app).post(`/api/er/arrivals/${a.body.id}/arrived`).set(auth(pat.token))).status).toBe(200);
    expect((await request(app).post(`/api/institution/er/${a.body.id}/status`).set(auth(inst.token)).send({ status: 'COMPLETED' })).body.status).toBe('COMPLETED');
    expect((await request(app).post(`/api/er/arrivals/${a.body.id}/cancel`).set(auth(pat.token))).status).toBe(409);

    // A hospital that cannot take the patient says why
    const a2 = await request(app).post('/api/er/arrivals').set(auth(pat.token)).send({ institutionId: mine.id, lat: 6.499, lng: 3.355 + o });
    const dec = await request(app).post(`/api/institution/er/${a2.body.id}/respond`).set(auth(inst.token)).send({ accept: false, reason: 'The emergency unit is full right now' });
    expect(dec.body).toMatchObject({ status: 'DECLINED', declineReason: 'The emergency unit is full right now' });
  });
});

describe('facility directory (listed before they join)', () => {
  it('finds listed facilities, lets the right account claim one once, and reports coverage to admins', async () => {
    const tag = uniq();
    const o = Math.round(Math.random() * 3000) / 1000 + 1;
    const [hosp, pharm, hmo] = await Promise.all([
      prisma.facilityListing.create({ data: { source: 'GRID3', sourceId: 'T-' + tag, name: `Zeta Teaching Hospital ${tag}`, category: 'TEACHING_HOSPITAL', state: 'Lagos', lga: 'Surulere', lat: 6.5158, lng: 3.3898 } }),
      prisma.facilityListing.create({ data: { source: 'OSM', sourceId: 'P-' + tag, name: `Zeta Pharmacy ${tag}`, category: 'PHARMACY', state: 'Lagos', lat: 6.52, lng: 3.39 } }),
      prisma.facilityListing.create({ data: { source: 'NHIA', sourceId: 'HMO-' + tag, name: `Zeta Health HMO ${tag}`, category: 'HMO', state: 'FCT', phone: '08000000000' } }),
    ]);
    expect((await request(app).get('/api/facilities/search')).status).toBe(400); // needs a name or a location
    const s = await request(app).get(`/api/facilities/search?q=zeta%20teaching%20${tag}`);
    expect(s.status).toBe(200);
    expect(s.body[0]).toMatchObject({ id: hosp.id, categoryLabel: 'Teaching hospital', onNhealth: false });
    const hmos = await request(app).get('/api/facilities/search?category=HMO&limit=150');
    expect(hmos.body.some((x: any) => x.id === hmo.id)).toBe(true);

    // A pharmacy account cannot claim a hospital; a hospital account can, once
    const ph = await register('PHARMACY', { pharmacyName: 'P ' + tag, licenseNumber: 'PCN-' + tag, address: 'x' });
    expect((await request(app).post(`/api/facilities/${hosp.id}/claim`).set(auth(ph.token))).status).toBe(400);
    expect((await request(app).post(`/api/facilities/${pharm.id}/claim`).set(auth(ph.token))).status).toBe(200);
    const h1 = await register('INSTITUTION', { name: 'H1 ' + tag, type: 'HOSPITAL', licenseNumber: 'H1-' + tag });
    const h2 = await register('INSTITUTION', { name: 'H2 ' + tag, type: 'HOSPITAL', licenseNumber: 'H2-' + tag });
    const c = await request(app).post(`/api/facilities/${hosp.id}/claim`).set(auth(h1.token));
    expect(c.body).toMatchObject({ onNhealth: true, userId: h1.user.id });
    expect((await request(app).post(`/api/facilities/${hosp.id}/claim`).set(auth(h2.token))).status).toBe(409);
    const ip = await prisma.institutionProfile.findUnique({ where: { userId: h1.user.id } });
    expect(ip).toMatchObject({ lat: 6.5158, lng: 3.3898, state: 'Lagos' }); // filled in from the listing
    expect((await request(app).get(`/api/facilities/search?claimable=1&q=zeta%20teaching%20${tag}`)).body).toHaveLength(0);

    // Patients see nearby hospitals not on N-Health in an emergency (claimed ones are on N-Health already)
    const pat = await register('PATIENT');
    await prisma.facilityListing.create({ data: { source: 'GRID3', sourceId: 'G-' + tag, name: `Zeta General Hospital ${tag}`, category: 'GENERAL_HOSPITAL', state: 'Lagos', lat: 6.50, lng: 3.36 + o } });
    const un = await request(app).get(`/api/er/unlisted?lat=6.499&lng=${3.355 + o}`).set(auth(pat.token));
    expect(un.body.some((x: any) => x.name === `Zeta General Hospital ${tag}`)).toBe(true);
    expect(un.body.some((x: any) => x.id === hosp.id)).toBe(false);

    // Admin: coverage, add a missing facility, fix a listing
    const boss = await prisma.user.create({ data: { email: `f-${tag}@test.io`, name: 'Boss', passwordHash: 'x', role: 'ADMIN', isSuperAdmin: true } });
    const { signToken } = await import('../src/utils/jwt');
    const t = signToken({ userId: boss.id, role: 'ADMIN' as any, isSuperAdmin: true, tv: 0 } as any, process.env.JWT_SECRET!, '1h');
    expect((await request(app).get('/api/admin-ops/facilities/coverage').set(auth(pat.token))).status).toBe(403);
    const cov = await request(app).get('/api/admin-ops/facilities/coverage').set(auth(t));
    expect(cov.body.total).toBeGreaterThanOrEqual(4);
    expect(cov.body.categories.find((x: any) => x.key === 'HMO').count).toBeGreaterThanOrEqual(1);
    const add = await request(app).post('/api/admin-ops/facilities').set(auth(t)).send({ name: `Zeta Blood Bank ${tag}`, category: 'BLOOD_BANK', state: 'Kano' });
    expect(add.status).toBe(201);
    expect((await request(app).post('/api/admin-ops/facilities').set(auth(t)).send({ name: `Zeta Blood Bank ${tag}`, category: 'BLOOD_BANK', state: 'Kano' })).status).toBe(409);
    const fix = await request(app).patch(`/api/admin-ops/facilities/${pharm.id}`).set(auth(t)).send({ phone: '0801 234 5678', hidden: true });
    expect(fix.body).toMatchObject({ phone: '0801 234 5678', hidden: true, addedById: boss.id });
  });
});

describe('invite reward (coins)', () => {
  it('gives the inviter 1 coin once, after the invited person confirms their email or phone', async () => {
    const { rewardInviter, COIN_VALUE_NGN } = await import('../src/services/coins');
    const inviter = await register('PATIENT');
    const code = (await prisma.user.findUnique({ where: { id: inviter.user.id } }))!.referralCode!;
    const email = `inv-${uniq()}@test.io`;
    const r = await request(app).post('/api/auth/register').send({ email, password: 'password123', name: 'Ada Friend', role: 'PATIENT', acceptTerms: true, dataConsent: true, providerTerms: true, referralCode: code });
    expect(r.status).toBe(201);
    const friendId = r.body.user.id;
    const bal = async () => Number((await prisma.creditLedger.findUnique({ where: { userId: inviter.user.id } }))?.balance || 0);
    const before = await bal();
    await rewardInviter(friendId); // not confirmed yet: nothing
    expect(await bal()).toBe(before);
    await prisma.user.update({ where: { id: friendId }, data: { emailVerifiedAt: new Date() } });
    await rewardInviter(friendId);
    await rewardInviter(friendId); // only once
    expect(await bal()).toBe(before + 1 * COIN_VALUE_NGN); // 1 coin, kept as ₦10 inside
    const s = await request(app).get('/api/invites/summary').set(auth(inviter.token));
    expect(s.body).toMatchObject({ joined: 1, confirmed: 1, coinsEarned: 1, rewardCoins: 1 });
    const cfg = await request(app).get('/api/config');
    expect(cfg.body).toMatchObject({ coinValue: 10, inviteRewardCoins: 1 });
  });
});

describe('health jobs (gigs)', () => {
  it('lets a verified pharmacy recruit a pharmacist, alerts matching workers, and runs applications to hire', async () => {
    const tag = uniq();
    const ph = await register('PHARMACY', { pharmacyName: 'Gig Pharmacy ' + tag, licenseNumber: 'PCN-G' + tag, address: 'Yaba' });
    await prisma.user.update({ where: { id: ph.user.id }, data: { verificationStatus: 'VERIFIED' } });
    await prisma.pharmacyProfile.update({ where: { userId: ph.user.id }, data: { state: 'Lagos', city: 'Yaba' } });
    const worker = await register('PATIENT');
    const other = await register('PATIENT');
    // The worker sets up a work profile and wants alerts in Lagos
    expect((await request(app).post('/api/gigs/x/apply').set(auth(worker.token))).status).toBe(404);
    const wp = await request(app).put('/api/work-profile').set(auth(worker.token)).send({ profession: 'PHARMACIST', licenseNumber: 'PCN-123', yearsExperience: 4, states: ['Lagos'], cvUrl: 'https://files.example/cv.pdf' });
    expect(wp.body).toMatchObject({ profession: 'PHARMACIST', licenseBody: 'PCN', openToWork: true });

    // A pharmacy cannot recruit doctors; a patient cannot post
    const base = { profession: 'PHARMACIST', positions: 2, experience: 'MID', employmentType: 'PART_TIME', shifts: ['NIGHT', 'WEEKEND'], payMin: 150000, payMax: 250000, payPeriod: 'MONTH', benefits: ['Meals', 'Not real'], description: 'Night and weekend pharmacist for a busy community pharmacy in Yaba.' };
    expect((await request(app).post('/api/gigs').set(auth(ph.token)).send({ ...base, profession: 'DOCTOR' })).status).toBe(400);
    expect((await request(app).post('/api/gigs').set(auth(worker.token)).send(base)).status).toBe(403);
    expect((await request(app).post('/api/gigs').set(auth(ph.token)).send({ ...base, payMin: 300000 })).status).toBe(400); // max < min
    const g = await request(app).post('/api/gigs').set(auth(ph.token)).send(base);
    expect(g.status).toBe(201);
    expect(g.body).toMatchObject({ orgName: 'Gig Pharmacy ' + tag, orgType: 'PHARMACY', state: 'Lagos', positions: 2, benefits: ['Meals'] });
    expect(g.body.alerted).toBeGreaterThanOrEqual(1); // other test runs may have left matching workers
    expect(await prisma.notification.count({ where: { userId: worker.user.id, type: 'gig' } })).toBe(1);

    // Workers find and apply; one application per person; no profile, no application
    const list = await request(app).get('/api/gigs?profession=PHARMACIST&state=Lagos').set(auth(worker.token));
    expect(list.body.some((x: any) => x.id === g.body.id && x.typeLabel === 'Part-time')).toBe(true);
    expect((await request(app).post(`/api/gigs/${g.body.id}/apply`).set(auth(other.token)).send({})).status).toBe(400);
    expect((await request(app).post(`/api/gigs/${g.body.id}/apply`).set(auth(ph.token)).send({})).status).toBe(400); // own job
    const a = await request(app).post(`/api/gigs/${g.body.id}/apply`).set(auth(worker.token)).send({ coverNote: 'I am available nights', expectedPay: 200000 });
    expect(a.status).toBe(201);
    expect((await request(app).post(`/api/gigs/${g.body.id}/apply`).set(auth(worker.token)).send({})).status).toBe(409);

    // Employer sees the applicant; contact details only after shortlisting; others cannot see
    expect((await request(app).get(`/api/gigs/${g.body.id}/applicants`).set(auth(worker.token))).status).toBe(404);
    let ap = (await request(app).get(`/api/gigs/${g.body.id}/applicants`).set(auth(ph.token))).body[0];
    expect(ap.profile).toMatchObject({ professionLabel: 'Pharmacist', yearsExperience: 4, cvUrl: 'https://files.example/cv.pdf' });
    expect(ap.applicant.email).toBeUndefined();
    await request(app).patch(`/api/gigs/applications/${a.body.id}`).set(auth(ph.token)).send({ status: 'SHORTLISTED', employerNote: 'Interview Monday 10am' }).expect(200);
    ap = (await request(app).get(`/api/gigs/${g.body.id}/applicants`).set(auth(ph.token))).body[0];
    expect(ap.applicant.email).toBeDefined();
    const mine = await request(app).get('/api/gigs/applications/mine').set(auth(worker.token));
    expect(mine.body[0]).toMatchObject({ status: 'SHORTLISTED', employerNote: 'Interview Monday 10am' });
    await request(app).patch(`/api/gigs/applications/${a.body.id}`).set(auth(ph.token)).send({ status: 'HIRED' }).expect(200);
    const posted = await request(app).get('/api/gigs/mine/posted').set(auth(ph.token));
    expect(posted.body[0]).toMatchObject({ applicants: 1, hired: 1, status: 'OPEN' }); // 2 positions, 1 hired

    // Reports pause a job after 5; closing tells waiting applicants
    for (let i = 0; i < 5; i++) await request(app).post(`/api/gigs/${g.body.id}/report`).set(auth(other.token)).send({ reason: 'asks for money' });
    expect((await prisma.gig.findUnique({ where: { id: g.body.id } }))!.status).toBe('PAUSED');
    expect((await request(app).patch(`/api/gigs/${g.body.id}`).set(auth(ph.token)).send({ status: 'OPEN' })).status).toBe(403);
  });
});

describe('identity form, role changes, blood banks and medicines', () => {
  it('reviews an in-app identity submission, lets only super admins change roles, and finds blood and medicines', async () => {
    const tag = uniq();
    const { signToken } = await import('../src/utils/jwt');
    const boss = await prisma.user.create({ data: { email: `sa-${tag}@test.io`, name: 'Boss', passwordHash: 'x', role: 'ADMIN', isSuperAdmin: true } });
    const plainAdmin = await prisma.user.create({ data: { email: `ad-${tag}@test.io`, name: 'Admin', passwordHash: 'x', role: 'ADMIN', isSuperAdmin: false } });
    const t = signToken({ userId: boss.id, role: 'ADMIN' as any, isSuperAdmin: true, tv: 0 } as any, process.env.JWT_SECRET!, '1h');
    const t2 = signToken({ userId: plainAdmin.id, role: 'ADMIN' as any, isSuperAdmin: false, tv: 0 } as any, process.env.JWT_SECRET!, '1h');
    const pat = await register('PATIENT');

    // KYC form: all details and documents required; NIN has 11 digits; then an admin approves
    expect((await request(app).post('/api/kyc/manual').set(auth(pat.token)).send({ fullName: 'Ada Obi' })).status).toBe(400);
    const form = { fullName: 'Ada Obi', dateOfBirth: '1990-04-02', address: '12 Marina', state: 'Lagos', idType: 'NIN', idNumber: '1234', idFront: 'https://f.test/a.jpg', selfie: 'https://f.test/b.jpg', proofOfAddress: 'https://f.test/c.pdf' };
    expect((await request(app).post('/api/kyc/manual').set(auth(pat.token)).send(form)).status).toBe(400);
    const sub = await request(app).post('/api/kyc/manual').set(auth(pat.token)).send({ ...form, idNumber: '12345678901' });
    expect(sub.body.status).toBe('IN_REVIEW');
    expect((await prisma.user.findUnique({ where: { id: pat.user.id } }))!.kycStatus).toBe('IN_REVIEW');
    const d = await request(app).get('/api/admin-ops/kyc/' + sub.body.id).set(auth(t2));
    expect(d.body.form).toMatchObject({ fullName: 'Ada Obi', idNumber: '12345678901', files: { idFront: 'https://f.test/a.jpg' } });
    expect((await request(app).post(`/api/admin-ops/kyc/${sub.body.id}/decide`).set(auth(t2)).send({ decision: 'APPROVED' })).status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: pat.user.id } }))!.kycStatus).toBe('APPROVED');
    expect((await request(app).post(`/api/admin-ops/kyc/${sub.body.id}/decide`).set(auth(t2)).send({ decision: 'DECLINED' })).status).toBe(409);

    // Role change: super admin only; creates the profile; new provider goes to verification
    expect((await request(app).patch(`/api/admin/users/${pat.user.id}/role`).set(auth(t2)).send({ role: 'NURSE' })).status).toBe(403);
    const ch = await request(app).patch(`/api/admin/users/${pat.user.id}/role`).set(auth(t)).send({ role: 'NURSE' });
    expect(ch.body).toMatchObject({ role: 'NURSE', verificationStatus: 'PENDING' });
    expect(await prisma.nurseProfile.findUnique({ where: { userId: pat.user.id } })).not.toBeNull();
    expect((await request(app).get('/api/auth/me').set(auth(pat.token))).status).toBe(401); // signed out to apply it
    expect((await request(app).patch(`/api/admin/users/${boss.id}/role`).set(auth(t)).send({ role: 'PATIENT' })).status).toBe(400);

    // Blood: blood banks and hospitals that run one (e.g. Kano); medicines in stock at pharmacies
    const viewer = await register('PATIENT');
    await prisma.facilityListing.createMany({ data: [
      { source: 'GRID3', sourceId: 'K1-' + tag, name: `Kano Teaching Hospital ${tag}`, category: 'TEACHING_HOSPITAL', state: 'Kano', lat: 12.0, lng: 8.52 },
      { source: 'NBSA', sourceId: 'K2-' + tag, name: `Kano Blood Centre ${tag}`, category: 'BLOOD_BANK', state: 'Kano', lat: 12.01, lng: 8.53 },
      { source: 'GRID3', sourceId: 'K3-' + tag, name: `Kano Clinic ${tag}`, category: 'CLINIC', state: 'Kano', lat: 12.0, lng: 8.5 },
    ] });
    const blood = await request(app).get(`/api/facilities/search?category=BLOOD&state=Kano&q=${tag}`);
    const names = blood.body.map((x: any) => x.name);
    expect(names).toContain(`Kano Teaching Hospital ${tag}`);
    expect(names).toContain(`Kano Blood Centre ${tag}`);
    expect(names).not.toContain(`Kano Clinic ${tag}`);
    expect(blood.body.find((x: any) => x.name.startsWith('Kano Teaching')).bloodService).toBe('HOSPITAL');
    const ph = await register('PHARMACY', { pharmacyName: 'Med ' + tag, licenseNumber: 'M-' + tag, address: 'x' });
    const pp = await prisma.pharmacyProfile.findUnique({ where: { userId: ph.user.id } });
    await prisma.inventory.createMany({ data: [
      { pharmacyId: pp!.id, name: `Amoxitag${tag} 500mg`, stock: 10, price: 1500, requiresPrescription: true },
      { pharmacyId: pp!.id, name: `Amoxitag${tag} syrup`, stock: 0, price: 900 },
    ] });
    const meds = await request(app).get(`/api/medicines/search?q=amoxitag${tag}`).set(auth(viewer.token));
    expect(meds.body).toHaveLength(1); // out-of-stock hidden
    expect(meds.body[0]).toMatchObject({ price: 1500, requiresPrescription: true, pharmacy: { name: 'Med ' + tag } });
  });
});

describe('provider flyers and public pages', () => {
  it('shows a public page without sign-in, counts flyer scans once per device, and reports them to the provider', async () => {
    const tag = uniq();
    const ph = await register('PHARMACY', { pharmacyName: 'Flyer Pharmacy ' + tag, licenseNumber: 'PCN-F' + tag, address: '1 Ring Road' });
    const pub = await request(app).get(`/api/public/providers/${ph.user.id}`);
    expect(pub.status).toBe(200);
    expect(pub.body).toMatchObject({ id: ph.user.id, role: 'PHARMACY', name: 'Flyer Pharmacy ' + tag, action: 'Order medicines' });
    expect(pub.body.referralCode).toBeUndefined();
    expect(pub.body.email).toBeUndefined();
    expect(pub.body.phone).toBeUndefined();
    // Patients have no public page
    const pat = await register('PATIENT');
    expect((await request(app).get(`/api/public/providers/${pat.user.id}`)).status).toBe(404);
    const visit = (deviceId: string, source = 'flyer') => request(app).post(`/api/public/providers/${ph.user.id}/visit`).send({ deviceId, source });
    await visit('dev-a-' + tag); await visit('dev-a-' + tag); await visit('dev-b-' + tag); await visit('dev-c-' + tag, 'link');
    const me = await request(app).get('/api/flyer/me').set(auth(ph.token));
    expect(me.status).toBe(200);
    expect(me.body.stats).toMatchObject({ scans: 2, last30: 2, people: 3, joined: 0 });
    expect(me.body.referralCode).toBeTruthy();
    expect((await request(app).get('/api/flyer/me').set(auth(pat.token))).status).toBe(403);
  });
});

describe('no licence needed: rewards-only coins, direct payments, NGO donations, HMO enrolment, no SMS', () => {
  it('never sells coins, needs no balance for an emergency, and takes card payments only when the money goes straight to the provider', async () => {
    const pat = await register('PATIENT');
    const buy = await request(app).post('/api/credits/purchase/initiate').set(auth(pat.token)).send({ amount: 5000, gateway: 'paystack' });
    expect(buy.status).toBe(403);
    const cfg = await request(app).get('/api/config');
    expect(cfg.body.coinSales).toBe(false);
    expect(cfg.body.company).toMatchObject({ dpoEmail: expect.any(String) });
    const em = await request(app).post('/api/patient/emergency').set(auth(pat.token)).send({ lat: 6.5 + Math.random() / 100, lng: 3.3, notes: 'chest pain' });
    expect(em.status).toBe(201);
    await request(app).post(`/api/patient/emergency/${em.body.id}/cancel`).set(auth(pat.token)).send({});
    // A doctor with no bank subaccount: card is refused (N-Health would otherwise hold their money), cash still works.
    const doc = await register('DOCTOR', { specialty: 'GP', licenseNumber: 'MDCN-D' + uniq(), consultationFee: 8000 });
    await prisma.user.update({ where: { id: doc.user.id }, data: { verificationStatus: 'VERIFIED' } });
    await request(app).put('/api/availability/me').set(auth(doc.token)).send({ timezone: 'Africa/Lagos', rules: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, startTime: '08:00', endTime: '18:00', slotMinutes: 30 })) });
    const dprof = await prisma.doctorProfile.findUnique({ where: { userId: doc.user.id } });
    const day = new Date(Date.now() + 6 * 864e5).toISOString().slice(0, 10);
    const slots = await request(app).get(`/api/availability/${doc.user.id}/slots?date=${day}`).set(auth(pat.token));
    const appt = (await request(app).post('/api/patient/appointments').set(auth(pat.token)).send({ doctorId: dprof!.id, scheduledAt: slots.body.slots[0].start })).body;
    const card = await request(app).post('/api/payments/card').set(auth(pat.token)).send({ payableType: 'APPOINTMENT', payableId: appt.id });
    expect(card.status).toBe(409);
    expect(card.body.error).toMatch(/cash/i);
    const cash = await request(app).post('/api/payments').set(auth(pat.token)).send({ payableType: 'APPOINTMENT', payableId: appt.id, method: 'CASH' });
    expect(cash.status).toBe(201);
  });

  it('pays donations straight to the hospital or the partner NGO, never through N-Health', async () => {
    const admin = await prisma.user.create({ data: { email: `adm-${uniq()}@test.io`, name: 'Admin', passwordHash: 'x', role: 'ADMIN', isSuperAdmin: true } });
    const adminTok = (await import('../src/utils/jwt')).signToken({ userId: admin.id, role: 'ADMIN' as any, isSuperAdmin: true, tv: 0 } as any, process.env.JWT_SECRET!, '1h');
    const hosp = await register('INSTITUTION', { name: 'Hope Hospital ' + uniq(), type: 'HOSPITAL', licenseNumber: 'H-' + uniq() });
    await prisma.user.update({ where: { id: hosp.user.id }, data: { verificationStatus: 'VERIFIED' } });
    const ip = await prisma.institutionProfile.findUnique({ where: { userId: hosp.user.id } });
    await prisma.bankAccount.create({ data: { userId: hosp.user.id, bankCode: '058', bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Hope Hospital', isPrimary: true, isVerified: true, paystackSubaccount: 'ACCT_hope' } });
    const org = await register('PATIENT');
    const donor = await register('PATIENT');
    // A patient's fundraiser must name the treating hospital (no NGO partner yet).
    expect((await request(app).post('/api/donations/campaigns').set(auth(org.token)).send({ type: 'PATIENT_CASE', title: 'Surgery for Ada', description: 'Heart surgery', goalAmount: 500000 })).status).toBe(400);
    const c = (await request(app).post('/api/donations/campaigns').set(auth(org.token)).send({ type: 'PATIENT_CASE', title: 'Surgery for Ada', description: 'Heart surgery', goalAmount: 500000, hospitalId: ip!.id })).body;
    expect(c.status).toBe('PENDING_REVIEW');
    await prisma.donationCampaign.update({ where: { id: c.id }, data: { status: 'ACTIVE' } });
    const d1 = await request(app).post(`/api/donations/campaigns/${c.id}/donate`).set(auth(donor.token)).send({ amount: 5000 });
    expect(d1.status).toBe(201);
    expect(d1.body).toMatchObject({ receiver: { kind: 'HOSPITAL' }, card: true, bank: { accountNumber: '0123456789' } });
    const plan = await planFor('DONATION', d1.body.donationId, donor.user.id);
    expect(plan).toMatchObject({ total: 5000, commission: 0, platformAmount: 0 });
    expect(plan.payees).toEqual([expect.objectContaining({ userId: hosp.user.id, amount: 5000 })]);
    // Coins can't be given away as donations.
    expect((await request(app).post('/api/payments').set(auth(donor.token)).send({ payableType: 'DONATION', payableId: d1.body.donationId, method: 'WALLET' })).status).toBe(400);
    // Bank transfer: the hospital confirms it reached its account.
    expect((await request(app).post(`/api/donations/${d1.body.donationId}/received`).set(auth(hosp.token))).status).toBe(200);
    expect(Number((await prisma.donationCampaign.findUnique({ where: { id: c.id } }))!.raisedAmount)).toBe(5000);

    // With the partner NGO switched on, donations go into the NGO's account and N-Health staff confirm transfers.
    const { saveDonationPartner } = await import('../src/services/settings');
    await saveDonationPartner({ enabled: true, name: 'Care Foundation', regNumber: 'IT-12345', bankName: 'Access Bank', accountNumber: '0099887766', accountName: 'Care Foundation', paystackSubaccount: 'ACCT_ngo' }, admin.id);
    try {
      const d2 = await request(app).post(`/api/donations/campaigns/${c.id}/donate`).set(auth(donor.token)).send({ amount: 2000 });
      expect(d2.body).toMatchObject({ receiver: { kind: 'NGO', name: 'Care Foundation', regNumber: 'IT-12345' }, card: true, bank: { accountNumber: '0099887766' } });
      const plan2 = await planFor('DONATION', d2.body.donationId, donor.user.id);
      expect(plan2.payees[0]).toMatchObject({ userId: '', amount: 2000, bank: expect.objectContaining({ paystackSubaccount: 'ACCT_ngo' }) });
      expect((await request(app).post(`/api/donations/${d2.body.donationId}/received`).set(auth(hosp.token))).status).toBe(403);
      expect((await request(app).post(`/api/donations/${d2.body.donationId}/received`).set(auth(adminTok))).status).toBe(200);
      // Fundraisers no longer need a hospital: the NGO receives the money.
      expect((await request(app).post('/api/donations/campaigns').set(auth(org.token)).send({ type: 'FUND', title: 'Dialysis fund', description: 'For patients', goalAmount: 100000 })).status).toBe(201);
    } finally {
      await saveDonationPartner({ enabled: false }, admin.id);
    }
  });

  it('passes insurance enrolment to the HMO, and sends codes on WhatsApp or email (never SMS)', async () => {
    const pat = await register('PATIENT');
    const plan = await prisma.insurancePlan.create({ data: { name: 'Family Basic ' + uniq(), provider: 'Test HMO', type: 'HMO', monthlyPremium: 3500, coverage: ['Outpatient'] } });
    const r = await request(app).post(`/api/insurance/plans/${plan.id}/enrol`).set(auth(pat.token)).send({ memberCount: 3 });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ status: 'REQUESTED', provider: 'Test HMO', memberCount: 3 });
    expect((await request(app).post(`/api/insurance/policies/${r.body.id}/pay`).set(auth(pat.token))).status).toBe(400);
    await prisma.user.update({ where: { id: pat.user.id }, data: { phone: '+23480' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0') } });
    const v = await request(app).post('/api/auth/verify-phone/send').set(auth(pat.token));
    expect(v.status).toBe(200);
    expect(v.body.channel).toBe('email'); // WhatsApp isn't configured in tests
  });
});

describe('health quests and coin donations (Muslim Pro-style rewards)', () => {
  it('earns coins for real health actions once per period, within a daily cap, and donates coins to the NGO', async () => {
    const pat = await register('PATIENT');
    const claim = (k: string) => request(app).post(`/api/quests/${k}/claim`).set(auth(pat.token));
    const board = await request(app).get('/api/quests').set(auth(pat.token));
    expect(board.body.quests.find((q: any) => q.key === 'checkin')).toMatchObject({ claimable: true, coins: 1 });
    expect((await claim('checkin')).body).toMatchObject({ coins: 1, streak: 1 });
    expect((await claim('checkin')).status).toBe(409); // once a day
    expect((await claim('profile')).status).toBe(400); // not done yet
    await request(app).patch('/api/auth/profile').set(auth(pat.token)).send({ bloodType: 'O+', genotype: 'AA', emergencyPhone: '08030000000' });
    expect((await claim('profile')).body.coins).toBe(5);
    expect((await claim('nonsense')).status).toBe(404);
    const after = await request(app).get('/api/quests').set(auth(pat.token));
    expect(after.body).toMatchObject({ earnedToday: 6, streak: 1 });
    expect(after.body.quests.find((q: any) => q.key === 'profile')).toMatchObject({ done: true, claimable: false });
    // Daily cap
    const admin = await prisma.user.create({ data: { email: `adq-${uniq()}@test.io`, name: 'Admin', passwordHash: 'x', role: 'ADMIN', isSuperAdmin: true } });
    const { saveQuestSettings } = await import('../src/services/quests');
    await saveQuestSettings({ dailyCap: 7 }, admin.id);
    try {
      await prisma.medicationReminder.create({ data: { userId: pat.user.id, medication: 'Vitamin C', times: ['08:00'] } });
      expect((await claim('reminder')).body.coins).toBe(1); // only 1 left under the cap of 7
      await prisma.vaccination.create({ data: { userId: pat.user.id, vaccine: 'Hepatitis B', givenAt: new Date() } });
      expect((await claim('vaccine')).status).toBe(429);
    } finally { await saveQuestSettings({ dailyCap: 20 }, admin.id); }
    // Donating coins needs the partner NGO; N-Health owes the NGO their value
    expect((await request(app).post('/api/coins/donate').set(auth(pat.token)).send({ coins: 3 })).status).toBe(400);
    const { saveDonationPartner } = await import('../src/services/settings');
    await saveDonationPartner({ enabled: true, name: 'Care Foundation', accountNumber: '0099887766' }, admin.id);
    try {
      expect((await request(app).post('/api/coins/donate').set(auth(pat.token)).send({ coins: 3 })).status).toBe(201);
      expect((await request(app).post('/api/coins/donate').set(auth(pat.token)).send({ coins: 500 })).status).toBe(400);
      const bal = await request(app).get('/api/credits/balance').set(auth(pat.token));
      expect(Number(bal.body.balance)).toBe((7 - 3) * 10);
    } finally { await saveDonationPartner({ enabled: false }, admin.id); }
  });
});

describe('reward coins on part of a bill', () => {
  async function booking(fee = 10000) {
    const doc = await register('DOCTOR', { specialty: 'GP', licenseNumber: 'MDCN-P' + uniq(), consultationFee: fee });
    const pat = await register('PATIENT');
    await request(app).put('/api/availability/me').set(auth(doc.token)).send({ timezone: 'Africa/Lagos', rules: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, startTime: '08:00', endTime: '18:00', slotMinutes: 30 })) });
    const dprof = await prisma.doctorProfile.findUnique({ where: { userId: doc.user.id } });
    const day = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const slots = await request(app).get(`/api/availability/${doc.user.id}/slots?date=${day}`).set(auth(pat.token));
    const appt = (await request(app).post('/api/patient/appointments').set(auth(pat.token)).send({ doctorId: dprof!.id, scheduledAt: slots.body.slots[0].start })).body;
    const { grantRewardCoins } = await import('../src/services/coins');
    await grantRewardCoins(pat.user.id, 300, 'TEST-PART-' + uniq(), 'test coins');
    const coins = async () => Number((await request(app).get('/api/credits/balance').set(auth(pat.token))).body.balance) / 10;
    return { doc, pat, appt, coins };
  }
  const getFinance = async () => (await import('../src/services/settings')).getFinance();

  it('cash: coins cover part, the provider collects the rest and N-Health pays the coin part', async () => {
    const { doc, pat, appt, coins } = await booking();
    const total = Number(appt.fee) + Number(appt.serviceFee);
    const body = { payableType: 'APPOINTMENT', payableId: appt.id };
    expect((await request(app).post('/api/coins/bill').set(auth(pat.token)).send({ ...body, coins: total / 10 })).status).toBe(400); // whole bill: use "pay with coins"
    expect((await request(app).post('/api/coins/bill').set(auth(pat.token)).send({ ...body, coins: 900 })).status).toBe(400); // more than they have
    const ap = await request(app).post('/api/coins/bill').set(auth(pat.token)).send({ ...body, coins: 300 });
    expect(ap.body).toMatchObject({ coins: 300, amount: 3000, remaining: total - 3000 });
    expect(await coins()).toBe(0);
    expect((await request(app).post('/api/coins/bill').set(auth(pat.token)).send({ ...body, coins: 1 })).status).toBe(409);
    const st = await request(app).get(`/api/coins/bill?payableType=APPOINTMENT&payableId=${appt.id}`).set(auth(pat.token));
    expect(st.body).toMatchObject({ total, applied: 3000, appliedCoins: 300, remaining: total - 3000 });
    // Taking the coins back, then applying again
    expect((await request(app).delete('/api/coins/bill').set(auth(pat.token)).send(body)).status).toBe(200);
    expect(await coins()).toBe(300);
    await request(app).post('/api/coins/bill').set(auth(pat.token)).send({ ...body, coins: 300 });
    const cash = await request(app).post('/api/payments').set(auth(pat.token)).send({ ...body, method: 'CASH' });
    expect(cash.status).toBe(201);
    expect(Number(cash.body.amount)).toBe(total - 3000);
    expect((await request(app).delete('/api/coins/bill').set(auth(pat.token)).send(body)).status).toBe(409); // already being paid
    await request(app).post(`/api/payments/${cash.body.id}/confirm`).set(auth(doc.token));
    await request(app).post(`/api/doctor/appointments/${appt.id}/respond`).set(auth(doc.token)).send({ action: 'CONFIRM' });
    await request(app).post(`/api/doctor/appointments/${appt.id}/respond`).set(auth(doc.token)).send({ action: 'COMPLETE' });
    const rate = (await getFinance()).commission.APPOINTMENT;
    const commission = (Number(appt.fee) * rate) / 100;
    // Provider holds the cash; their balance gets +coin part - commission - booking fee. Total = fee - commission.
    const b = (await balanceOf(doc.user.id)).balance;
    expect(b).toBeCloseTo(3000 - commission - (total - Number(appt.fee)), 2);
    expect(total - 3000 + b).toBeCloseTo(Number(appt.fee) - commission, 2);
  });

  it('card: the gateway charges only the rest, the provider share shrinks by the coin part and N-Health credits it; a cancellation returns the coins', async () => {
    const { doc, pat, appt, coins } = await booking();
    await prisma.bankAccount.create({ data: { userId: doc.user.id, bankCode: '058', bankName: 'GTBank', accountNumber: '01' + String(Date.now()).slice(-8), accountName: 'Dr P', isPrimary: true, isVerified: true, paystackSubaccount: 'ACCT_p' + uniq() } });
    const full = await planFor('APPOINTMENT', appt.id, pat.user.id);
    await request(app).post('/api/coins/bill').set(auth(pat.token)).send({ payableType: 'APPOINTMENT', payableId: appt.id, coins: 200 });
    const plan = await planFor('APPOINTMENT', appt.id, pat.user.id);
    expect(plan.total).toBe(full.total - 2000);
    expect(plan.payees[0].amount).toBe(full.payees[0].amount - 2000);
    expect(plan.platformAmount).toBe(full.platformAmount); // N-Health still collects its commission and booking fee
    const ref = 'PY-CP-' + uniq();
    await prisma.paymentGatewayLog.create({ data: { userId: pat.user.id, gateway: 'paystack', internalRef: ref, gatewayRef: 'pending', amount: plan.total, status: 'pending', purpose: 'direct_payment', requestPayload: { payableType: 'APPOINTMENT', payableId: appt.id, plan, settled: { [doc.user.id]: true } } as any } });
    const wb = JSON.stringify({ event: 'charge.success', data: { status: 'success', reference: ref, amount: plan.total * 100, currency: 'NGN', id: 778 } });
    const sig = crypto.createHmac('sha512', 'sk_test_dummy').update(wb).digest('hex');
    expect((await request(app).post('/api/webhooks/paystack').set('Content-Type', 'application/json').set('x-paystack-signature', sig).send(wb)).status).toBe(200);
    expect((await balanceOf(doc.user.id)).balance).toBe(2000); // the coin part, paid by N-Health
    expect(await coins()).toBe(100);
    // Doctor declines: card part refunded by the gateway, coins back to the patient, coin credit reversed.
    await request(app).post(`/api/doctor/appointments/${appt.id}/respond`).set(auth(doc.token)).send({ action: 'CANCEL', notes: 'Away' });
    expect(await coins()).toBe(300);
    expect((await balanceOf(doc.user.id)).balance).toBe(-(full.payees[0].amount - 2000)); // only the settled card share is recovered
  });

  it('coins for the rest of a bill: paying the remainder with coins earns the provider the full fee', async () => {
    const { doc, pat, appt } = await booking(2000);
    const total = Number(appt.fee) + Number(appt.serviceFee);
    await request(app).post('/api/coins/bill').set(auth(pat.token)).send({ payableType: 'APPOINTMENT', payableId: appt.id, coins: 100 });
    const pay = await request(app).post('/api/payments').set(auth(pat.token)).send({ payableType: 'APPOINTMENT', payableId: appt.id, method: 'WALLET' });
    expect(pay.status).toBe(201);
    expect(Number(pay.body.amount)).toBe(total - 1000);
    await request(app).post(`/api/doctor/appointments/${appt.id}/respond`).set(auth(doc.token)).send({ action: 'CONFIRM' });
    await request(app).post(`/api/doctor/appointments/${appt.id}/respond`).set(auth(doc.token)).send({ action: 'COMPLETE' });
    const rate = (await getFinance()).commission.APPOINTMENT;
    expect((await balanceOf(doc.user.id)).balance).toBeCloseTo(Number(appt.fee) * (1 - rate / 100), 2);
  });
});

describe('pharmacy delivery fee and coins (no regulatory issue)', () => {
  it('adds the delivery fee, lets coins pay delivery and over-the-counter items but not prescription-only medicines, and needs the patient\'s code at the counter', async () => {
    const ph = await register('PHARMACY', { pharmacyName: 'Del Pharm ' + uniq(), licenseNumber: 'PCN-D' + uniq() });
    await request(app).patch('/api/provider-profile').set(auth(ph.token)).send({ homeDelivery: true, deliveryFee: 1500 });
    const pat = await register('PATIENT');
    const { grantRewardCoins } = await import('../src/services/coins');
    await grantRewardCoins(pat.user.id, 1000, 'TEST-DEL-' + uniq(), 'test coins');
    const otc = await request(app).post('/api/pharmacy/inventory').set(auth(ph.token)).send({ name: 'Paracetamol', stock: 20, price: 500 });
    const pom = await request(app).post('/api/pharmacy/inventory').set(auth(ph.token)).send({ name: 'Amoxicillin', stock: 20, price: 3000, requiresPrescription: true });
    const pid = (await prisma.pharmacyProfile.findUnique({ where: { userId: ph.user.id } }))!.id;
    // Delivery order: fee added to the total; pickup: no fee
    const del = await request(app).post('/api/patient/orders').set(auth(pat.token)).send({ pharmacyId: pid, deliveryMethod: 'DELIVERY', deliveryAddress: '5 Allen Ave', items: [{ inventoryId: otc.body.id, name: 'x', qty: 2, price: 1 }] });
    expect(Number(del.body.total)).toBe(2500);
    expect(Number(del.body.deliveryFee)).toBe(1500);
    const pick = await request(app).post('/api/patient/orders').set(auth(pat.token)).send({ pharmacyId: pid, items: [{ inventoryId: otc.body.id, name: 'x', qty: 1, price: 1 }] });
    expect(Number(pick.body.total)).toBe(500);
    // Over-the-counter order with delivery: coins may pay all of it
    expect((await request(app).post('/api/payments').set(auth(pat.token)).send({ payableType: 'PHARMACY_ORDER', payableId: del.body.id, method: 'WALLET' })).status).toBe(201);
    // Order with a prescription-only medicine (prescription checked) + delivery: coins only for delivery + OTC
    const pp = await prisma.patientProfile.findUnique({ where: { userId: pat.user.id } });
    const mixed = await prisma.pharmacyOrder.create({ data: { patientId: pp!.id, pharmacyId: pid, items: [{ inventoryId: otc.body.id, name: 'Paracetamol', qty: 1, price: 500 }, { inventoryId: pom.body.id, name: 'Amoxicillin', qty: 1, price: 3000 }], total: 5000, deliveryFee: 1500, deliveryMethod: 'DELIVERY' } });
    const bill = await request(app).get(`/api/coins/bill?payableType=PHARMACY_ORDER&payableId=${mixed.id}`).set(auth(pat.token));
    expect(bill.body).toMatchObject({ total: 5000, maxCoins: 200, coinNote: expect.stringMatching(/prescription/) });
    expect((await request(app).post('/api/payments').set(auth(pat.token)).send({ payableType: 'PHARMACY_ORDER', payableId: mixed.id, method: 'WALLET' })).status).toBe(400);
    expect((await request(app).post('/api/coins/bill').set(auth(pat.token)).send({ payableType: 'PHARMACY_ORDER', payableId: mixed.id, coins: 201 })).status).toBe(400);
    const part = await request(app).post('/api/coins/bill').set(auth(pat.token)).send({ payableType: 'PHARMACY_ORDER', payableId: mixed.id, coins: 150 }); // the delivery fee
    expect(part.body).toMatchObject({ amount: 1500, remaining: 3500 });
    // Pharmacy counter: coins need the patient's one-time code, and never pay prescription-only medicines
    const sell = (inventoryId: string, extra: any) => request(app).post('/api/pharmacy-ops/pos/checkout').set(auth(ph.token)).send({ items: [{ inventoryId, qty: 1 }], paymentMethod: 'CREDITS', patientEmail: pat.email, ...extra });
    expect((await sell(otc.body.id, {})).status).toBe(400);
    expect((await sell(otc.body.id, { patientCode: '123456' })).status).toBe(400);
    const code = (await request(app).post('/api/coins/pos-code').set(auth(pat.token))).body.code;
    expect((await sell(pom.body.id, { patientCode: code, prescriptionChecked: true })).status).toBe(400);
    expect((await sell(otc.body.id, { patientCode: code })).status).toBe(201); // the code wasn't used up by the refused sale
  });
});

describe('help someone pay for care with your coins (no transfer between balances)', () => {
  it('finds and confirms the recipient, applies the offer to their own bill, never credits their balance, and returns unused coins', async () => {
    const { grantRewardCoins } = await import('../src/services/coins');
    const sender = await register('PATIENT');
    const friend = await register('PATIENT');
    await grantRewardCoins(sender.user.id, 400, 'TEST-HELP-' + uniq(), 'test coins');
    const bal = async (t: string) => Number((await request(app).get('/api/credits/balance').set(auth(t))).body.balance) / 10;
    const friendPhone = '080' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
    await prisma.user.update({ where: { id: friend.user.id }, data: { phone: friendPhone } });
    // Find by phone (any format), email or N-Health ID; the profile is masked for confirmation
    const byPhone = await request(app).get('/api/coins/help/find?q=' + encodeURIComponent('+234' + friendPhone.slice(1))).set(auth(sender.token));
    expect(byPhone.status).toBe(200);
    expect(byPhone.body).toMatchObject({ id: friend.user.id, name: 'PATIENT Tester' });
    expect(byPhone.body.phone).toContain('•••');
    expect(byPhone.body.email).not.toContain(friend.email.split('@')[0]);
    expect((await request(app).get('/api/coins/help/find?q=' + friend.email).set(auth(sender.token))).body.id).toBe(friend.user.id);
    expect((await request(app).get('/api/coins/help/find?q=' + sender.email).set(auth(sender.token))).status).toBe(400); // yourself
    // The recipient must have confirmed their email or phone
    expect((await request(app).post('/api/coins/help').set(auth(sender.token)).send({ toUserId: friend.user.id, coins: 100 })).status).toBe(400);
    await prisma.user.update({ where: { id: friend.user.id }, data: { emailVerifiedAt: new Date() } });
    expect((await request(app).post('/api/coins/help').set(auth(sender.token)).send({ toUserId: friend.user.id, coins: 999 })).status).toBe(400); // more than they have
    const offer = await request(app).post('/api/coins/help').set(auth(sender.token)).send({ toUserId: friend.user.id, coins: 300, note: 'Get well' });
    expect(offer.status).toBe(201);
    expect(await bal(sender.token)).toBe(100);
    expect(await bal(friend.token)).toBe(0); // nothing lands in the friend's balance
    // The friend applies it to their own pharmacy order (delivery + OTC = 2,500, so 250 coins used, 50 returned)
    const ph = await register('PHARMACY', { pharmacyName: 'Help Pharm ' + uniq(), licenseNumber: 'PCN-H' + uniq() });
    await request(app).patch('/api/provider-profile').set(auth(ph.token)).send({ homeDelivery: true, deliveryFee: 1500 });
    const otc = await request(app).post('/api/pharmacy/inventory').set(auth(ph.token)).send({ name: 'ORS', stock: 10, price: 500 });
    const pid = (await prisma.pharmacyProfile.findUnique({ where: { userId: ph.user.id } }))!.id;
    const order = await request(app).post('/api/patient/orders').set(auth(friend.token)).send({ pharmacyId: pid, deliveryMethod: 'DELIVERY', deliveryAddress: 'Kano', items: [{ inventoryId: otc.body.id, name: 'x', qty: 2, price: 1 }] });
    const bills = await request(app).get(`/api/coins/help/${offer.body.id}/bills`).set(auth(friend.token));
    expect(bills.body.some((b: any) => b.payableId === order.body.id)).toBe(true);
    expect((await request(app).get(`/api/coins/help/${offer.body.id}/bills`).set(auth(sender.token))).status).toBe(404); // only the recipient
    const used = await request(app).post(`/api/coins/help/${offer.body.id}/use`).set(auth(friend.token)).send({ payableType: 'PHARMACY_ORDER', payableId: order.body.id });
    expect(used.body).toMatchObject({ usedCoins: 250, paidInFull: true, remaining: 0 });
    expect(await bal(sender.token)).toBe(150); // 50 unused coins came back
    expect(await bal(friend.token)).toBe(0);
    expect((await prisma.pharmacyOrder.findUnique({ where: { id: order.body.id } }))!.paymentStatus).toBe('PAID');
    expect((await request(app).post(`/api/coins/help/${offer.body.id}/use`).set(auth(friend.token)).send({ payableType: 'PHARMACY_ORDER', payableId: order.body.id })).status).toBe(409);
    // Pharmacy declines the order: coins go back to the SENDER, never to the friend
    await request(app).post(`/api/pharmacy/orders/${order.body.id}/status`).set(auth(ph.token)).send({ status: 'CANCELLED', reason: 'Out of stock' });
    expect(await bal(sender.token)).toBe(400);
    expect(await bal(friend.token)).toBe(0);
    // Decline and cancel return coins to the sender too
    const o2 = await request(app).post('/api/coins/help').set(auth(sender.token)).send({ toUserId: friend.user.id, coins: 100 });
    expect((await request(app).post(`/api/coins/help/${o2.body.id}/decline`).set(auth(friend.token))).status).toBe(200);
    const o3 = await request(app).post('/api/coins/help').set(auth(sender.token)).send({ toUserId: friend.user.id, coins: 50 });
    expect((await request(app).post(`/api/coins/help/${o3.body.id}/cancel`).set(auth(sender.token))).status).toBe(200);
    expect(await bal(sender.token)).toBe(400);
    const list = await request(app).get('/api/coins/help').set(auth(friend.token));
    expect(list.body.map((x: any) => x.status).sort()).toEqual(['CANCELLED', 'DECLINED', 'USED']);
    // Daily limit
    await grantRewardCoins(sender.user.id, 1000, 'TEST-HELP2-' + uniq(), 'more');
    expect((await request(app).post('/api/coins/help').set(auth(sender.token)).send({ toUserId: friend.user.id, coins: 400 })).status).toBe(400);
  });
});

describe('consents, support chat, enquiry replies, invite tracking, in-person only, broker', () => {
  it('needs data-use consent for every new account and provider terms for providers, and records them', async () => {
    const base = { password: 'password123', name: 'Consent Test', acceptTerms: true };
    const r1 = await request(app).post('/api/auth/register').send({ ...base, email: `c1-${uniq()}@test.io`, role: 'PATIENT' });
    expect(r1.status).toBe(400);
    expect(r1.body.error).toMatch(/health data/i);
    const r2 = await request(app).post('/api/auth/register').send({ ...base, email: `c2-${uniq()}@test.io`, role: 'DOCTOR', dataConsent: true, profile: { specialty: 'GP', licenseNumber: 'MDCN-C' + uniq() } });
    expect(r2.status).toBe(400);
    expect(r2.body.error).toMatch(/provider terms/i);
    const ok = await request(app).post('/api/auth/register').send({ ...base, email: `c3-${uniq()}@test.io`, role: 'DOCTOR', dataConsent: true, providerTerms: true, profile: { specialty: 'GP', licenseNumber: 'MDCN-C' + uniq() } });
    expect(ok.status).toBe(201);
    expect(ok.body.user).toMatchObject({ dataConsent: true, providerTerms: true });
    const u = await prisma.user.findUnique({ where: { id: ok.body.user.id } });
    expect(u?.providerTermsVersion).toBe('PT-2026-11');
    // Existing accounts accept later
    const old = await register('PATIENT');
    await prisma.user.update({ where: { id: old.user.id }, data: { dataConsentAt: null } });
    expect((await request(app).post('/api/auth/consents').set(auth(old.token)).send({ providerTerms: true })).status).toBe(400);
    expect((await request(app).post('/api/auth/consents').set(auth(old.token)).send({ dataConsent: true })).body).toMatchObject({ dataConsent: true });
  });

  it('runs a live chat from the help bubble for visitors and members, with staff replies', async () => {
    const admin = await prisma.user.create({ data: { email: `sa-${uniq()}@test.io`, name: 'Support', passwordHash: 'x', role: 'ADMIN', isSuperAdmin: true } });
    const adminTok = (await import('../src/utils/jwt')).signToken({ userId: admin.id, role: 'ADMIN' as any, isSuperAdmin: true, tv: 0 } as any, process.env.JWT_SECRET!, '1h');
    // Visitor
    expect((await request(app).post('/api/support/chat').send({ message: 'Hello' })).status).toBe(400); // needs name + email
    const v1 = await request(app).post('/api/support/chat').send({ message: 'Do you deliver in Kano?', name: 'Musa', email: `musa-${uniq()}@test.io` });
    expect(v1.status).toBe(201);
    expect(v1.body.token).toBeTruthy();
    const v2 = await request(app).post('/api/support/chat').send({ message: 'Also Kaduna?', token: v1.body.token });
    expect(v2.body.messages.map((m: any) => m.body)).toEqual(['Do you deliver in Kano?', 'Also Kaduna?']);
    expect((await request(app).post(`/api/admin-ops/tickets/${v1.body.id}/reply`).set(auth(adminTok)).send({ reply: 'Yes, both!' })).status).toBe(200);
    const seen = await request(app).get('/api/support/chat?token=' + v1.body.token);
    expect(seen.body.messages.at(-1)).toMatchObject({ fromStaff: true, body: 'Yes, both!' });
    expect((await request(app).get('/api/support/chat?token=wrong')).body.messages).toEqual([]);
    // Member
    const pat = await register('PATIENT');
    const m1 = await request(app).post('/api/support/chat').set(auth(pat.token)).send({ message: 'My order is late' });
    const m2 = await request(app).post('/api/support/chat').set(auth(pat.token)).send({ message: 'Order 123' });
    expect(m2.body.id).toBe(m1.body.id);
    const th = await request(app).get(`/api/admin-ops/tickets/${m1.body.id}/messages`).set(auth(adminTok));
    expect(th.body.messages).toHaveLength(2);
    expect(th.body.guestToken).toBeUndefined();
  });

  it('replies to enquiries and tracks each member\'s invite link like a campaign', async () => {
    const admin = await prisma.user.create({ data: { email: `sb-${uniq()}@test.io`, name: 'Mkt', passwordHash: 'x', role: 'ADMIN', isSuperAdmin: true } });
    const adminTok = (await import('../src/utils/jwt')).signToken({ userId: admin.id, role: 'ADMIN' as any, isSuperAdmin: true, tv: 0 } as any, process.env.JWT_SECRET!, '1h');
    const lead = await prisma.marketingLead.create({ data: { name: 'Abubakar Lead', email: `lead-${uniq()}@test.io`, phone: '+2348030000000', message: 'i am testing' } });
    const r = await request(app).post(`/api/admin-ops/marketing/leads/${lead.id}/reply`).set(auth(adminTok)).send({ body: 'Thanks! How can we help?', channel: 'email' });
    expect(r.status).toBe(201);
    expect((await prisma.marketingLead.findUnique({ where: { id: lead.id } }))!.status).toBe('CONTACTED');
    const t = await request(app).get(`/api/admin-ops/marketing/leads/${lead.id}/messages`).set(auth(adminTok));
    expect(t.body.messages.map((m: any) => m.body)).toEqual(['i am testing', 'Thanks! How can we help?']);
    // Invite link: opened on two phones (shared), one signs up through it
    const inviter = await register('PATIENT');
    const code = (await prisma.user.findUnique({ where: { id: inviter.user.id } }))!.referralCode!;
    const open = (deviceId: string, utm?: string) => request(app).post('/api/mkt/open').send({ slug: 'inv-' + code.toLowerCase(), deviceId, utm: utm ? { source: utm } : {} });
    const o1 = await open('dev-inv-a-' + uniq(), 'whatsapp');
    expect(o1.body.link).toBeTruthy();
    const devB = 'dev-inv-b-' + uniq();
    await open(devB, 'whatsapp'); await open(devB);
    const friend = await request(app).post('/api/auth/register').send({ email: `invf-${uniq()}@test.io`, password: 'password123', name: 'Invited Friend', role: 'PATIENT', acceptTerms: true, dataConsent: true, referralCode: code, mkt: { deviceKey: 'd:' + devB } });
    expect(friend.status).toBe(201);
    const rep = await request(app).get('/api/admin-ops/marketing/invites?days=7').set(auth(adminTok));
    const row = rep.body.rows.find((x: any) => x.inviter?.id === inviter.user.id);
    expect(row).toMatchObject({ opens: 3, devices: 2, repeatOpens: 1, verdict: 'Shared · 2 devices', signups: 1, slug: 'inv-' + code });
    expect(row.channels.whatsapp).toBe(2);
    // Personal invite links don't crowd the campaign link list
    const links = await request(app).get('/api/admin-ops/marketing/links').set(auth(adminTok));
    expect(links.body.some((l: any) => l.slug === 'inv-' + code)).toBe(false);
  });

  it('books in-person visits only and sends insurance requests to the broker partner', async () => {
    const doc = await register('DOCTOR', { specialty: 'GP', licenseNumber: 'MDCN-V' + uniq(), consultationFee: 5000 });
    const pat = await register('PATIENT');
    await request(app).put('/api/availability/me').set(auth(doc.token)).send({ timezone: 'Africa/Lagos', rules: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, startTime: '08:00', endTime: '18:00', slotMinutes: 30 })) });
    const dprof = await prisma.doctorProfile.findUnique({ where: { userId: doc.user.id } });
    const day = new Date(Date.now() + 8 * 864e5).toISOString().slice(0, 10);
    const slots = await request(app).get(`/api/availability/${doc.user.id}/slots?date=${day}`).set(auth(pat.token));
    expect((await request(app).post('/api/patient/appointments').set(auth(pat.token)).send({ doctorId: dprof!.id, scheduledAt: slots.body.slots[0].start, type: 'VIDEO' })).status).toBe(400);
    const ok = await request(app).post('/api/patient/appointments').set(auth(pat.token)).send({ doctorId: dprof!.id, scheduledAt: slots.body.slots[0].start });
    expect(ok.status).toBe(201);
    const admin = await prisma.user.create({ data: { email: `ib-${uniq()}@test.io`, name: 'Admin', passwordHash: 'x', role: 'ADMIN', isSuperAdmin: true } });
    const { saveInsuranceBroker } = await import('../src/services/settings');
    await expect(saveInsuranceBroker({ enabled: true, name: 'X' }, admin.id)).rejects.toThrow();
    await saveInsuranceBroker({ enabled: true, name: 'SafeCover Brokers', email: 'leads@safecover.test', licence: 'NAICOM/BR/001' }, admin.id);
    try {
      expect((await request(app).get('/api/config')).body.insuranceBroker).toMatchObject({ name: 'SafeCover Brokers' });
      const plan = await prisma.insurancePlan.create({ data: { name: 'Basic ' + uniq(), provider: 'Some HMO', type: 'HMO', monthlyPremium: 2000, coverage: ['Outpatient'] } });
      expect((await request(app).post(`/api/insurance/plans/${plan.id}/enrol`).set(auth(pat.token)).send({})).status).toBe(201);
      const n = await prisma.notification.findFirst({ where: { userId: pat.user.id, type: 'insurance' }, orderBy: { createdAt: 'desc' } });
      expect(n?.body).toMatch(/SafeCover Brokers/);
    } finally { await saveInsuranceBroker({ enabled: false }, admin.id); }
  });
});
