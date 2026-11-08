import crypto from 'crypto';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { getOrCreateLedger, purchaseCredits } from '../src/services/creditsService';
import { saveFinance } from '../src/services/settings';
import { balanceOf, markPayout } from '../src/services/earnings';

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
