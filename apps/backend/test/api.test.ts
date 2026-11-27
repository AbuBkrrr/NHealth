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
  const r = await request(app).post('/api/auth/register').send({ email, password: 'password123', name: role + ' Tester', role, profile, acceptTerms: true });
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
    await request(app).post('/api/auth/register').send({ email, password: 'password123', name: 'Bola', role: 'PATIENT', acceptTerms: true, mkt: { deviceKey: 'd:' + phoneB } }).expect(201);

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
    const inst = await register('INSTITUTION', { name: 'ER Hospital ' + uniq(), type: 'HOSPITAL', licenseNumber: 'H-' + uniq() });
    const closed = await register('INSTITUTION', { name: 'Closed Hospital ' + uniq(), type: 'HOSPITAL', licenseNumber: 'H-' + uniq() });
    await prisma.user.updateMany({ where: { id: { in: [inst.user.id, closed.user.id] } }, data: { verificationStatus: 'VERIFIED' } });
    // Hospital sets its emergency board
    await prisma.institutionProfile.update({ where: { userId: inst.user.id }, data: { lat: 6.5158, lng: 3.3898 } });
    await prisma.institutionProfile.update({ where: { userId: closed.user.id }, data: { lat: 6.5100, lng: 3.3700, emergencyCare: true, erOpen: false } });
    const board = await request(app).patch('/api/institution/er').set(auth(inst.token)).send({ emergencyCare: true, erOpen: true, erDoctorsOnDuty: 2, erNursesOnDuty: 3, erServices: ['Trauma / accidents', 'Not a real service'] });
    expect(board.status).toBe(200);
    expect(board.body.erServices).toEqual(['Trauma / accidents']);

    const pat = await register('PATIENT');
    const other = await register('PATIENT');
    expect((await request(app).get('/api/er/hospitals').set(auth(pat.token))).status).toBe(400); // location needed
    const near = await request(app).get('/api/er/hospitals?lat=6.4990&lng=3.3550&type=ACCIDENT').set(auth(pat.token));
    expect(near.status).toBe(200);
    const mine = near.body.find((h: any) => h.userId === inst.user.id);
    expect(mine).toMatchObject({ erOpen: true, erDoctorsOnDuty: 2, handlesType: true });
    expect(near.body.findIndex((h: any) => h.userId === inst.user.id)).toBeLessThan(near.body.findIndex((h: any) => h.userId === closed.user.id)); // open first
    expect((await request(app).get('/api/er/hospitals?lat=6.5&lng=3.36').set(auth(inst.token))).status).toBe(403); // patients only

    const closedProfile = await prisma.institutionProfile.findUnique({ where: { userId: closed.user.id } });
    expect((await request(app).post('/api/er/arrivals').set(auth(pat.token)).send({ institutionId: closedProfile!.id, lat: 6.499, lng: 3.355 })).status).toBe(409);
    const a = await request(app).post('/api/er/arrivals').set(auth(pat.token)).send({ institutionId: mine.id, type: 'ACCIDENT', transport: 'TAXI', notes: 'deep cut', lat: 6.499, lng: 3.355 });
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
    const loc = await request(app).post(`/api/er/arrivals/${a.body.id}/location`).set(auth(pat.token)).send({ lat: 6.512, lng: 3.385 });
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
    const a2 = await request(app).post('/api/er/arrivals').set(auth(pat.token)).send({ institutionId: mine.id, lat: 6.499, lng: 3.355 });
    const dec = await request(app).post(`/api/institution/er/${a2.body.id}/respond`).set(auth(inst.token)).send({ accept: false, reason: 'The emergency unit is full right now' });
    expect(dec.body).toMatchObject({ status: 'DECLINED', declineReason: 'The emergency unit is full right now' });
  });
});

describe('facility directory (listed before they join)', () => {
  it('finds listed facilities, lets the right account claim one once, and reports coverage to admins', async () => {
    const tag = uniq();
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
    await prisma.facilityListing.create({ data: { source: 'GRID3', sourceId: 'G-' + tag, name: `Zeta General Hospital ${tag}`, category: 'GENERAL_HOSPITAL', state: 'Lagos', lat: 6.50, lng: 3.36 } });
    const un = await request(app).get('/api/er/unlisted?lat=6.499&lng=3.355').set(auth(pat.token));
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
    const r = await request(app).post('/api/auth/register').send({ email, password: 'password123', name: 'Ada Friend', role: 'PATIENT', acceptTerms: true, referralCode: code });
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
