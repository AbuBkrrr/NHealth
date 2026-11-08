import crypto from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { spendCredits, getOrCreateLedger } from '../../services/creditsService';
import { notify } from '../../services/notify';
import { uid, str, num, date } from './util';

async function pharm(req: Request) {
  const p = await prisma.pharmacyProfile.findUnique({ where: { userId: uid(req) } });
  if (!p) throw ApiError.notFound('Pharmacy profile not found');
  return p;
}

/** GET /api/pharmacy-ops/alerts - low stock, expiring within 90 days, expired. */
export async function stockAlerts(req: Request, res: Response) {
  const p = await pharm(req);
  const items = await prisma.inventory.findMany({ where: { pharmacyId: p.id } });
  const now = Date.now(), soon = now + 90 * 86400_000;
  res.json({
    lowStock: items.filter((i) => i.stock <= i.reorderLevel),
    expiring: items.filter((i) => i.expiryDate && i.expiryDate.getTime() > now && i.expiryDate.getTime() < soon),
    expired: items.filter((i) => i.expiryDate && i.expiryDate.getTime() <= now),
    stockValue: items.reduce((s, i) => s + i.stock * Number(i.costPrice ?? i.price), 0),
    retailValue: items.reduce((s, i) => s + i.stock * Number(i.price), 0),
  });
}

/**
 * POST /api/pharmacy-ops/intake { supplierId?, invoiceNumber?, fileUrl?, items:[{name,brand,manufacturer,batchNumber,qty,costPrice,price,expiryDate,category,barcode,requiresPrescription}] }
 * Receives stock from an invoice/receipt: matches existing items by barcode, or name+batch, else creates them.
 */
export async function stockIntake(req: Request, res: Response) {
  const p = await pharm(req);
  const items = Array.isArray(req.body.items) ? req.body.items.slice(0, 500) : [];
  if (!items.length) throw ApiError.badRequest('Add at least one line item');
  const result = await prisma.$transaction(async (tx) => {
    const lines: any[] = [];
    for (const raw of items) {
      const name = str(raw.name, 160); const qty = Math.round(num(raw.qty) || 0);
      if (!name || qty <= 0) throw ApiError.badRequest('Each line needs a product name and a quantity');
      const price = num(raw.price), cost = num(raw.costPrice);
      const barcode = str(raw.barcode, 60), batch = str(raw.batchNumber, 60);
      let inv = barcode ? await tx.inventory.findFirst({ where: { pharmacyId: p.id, barcode } }) : null;
      if (!inv) inv = await tx.inventory.findFirst({ where: { pharmacyId: p.id, name: { equals: name, mode: 'insensitive' }, batchNumber: batch ?? null } });
      if (inv) {
        inv = await tx.inventory.update({ where: { id: inv.id }, data: { stock: { increment: qty }, price: price ?? undefined, costPrice: cost ?? undefined, expiryDate: date(raw.expiryDate) ?? undefined, supplierId: str(req.body.supplierId) ?? undefined } });
      } else {
        if (price === undefined) throw ApiError.badRequest(`Set a selling price for new product ${name}`);
        inv = await tx.inventory.create({ data: { pharmacyId: p.id, name, stock: qty, price, costPrice: cost, brand: str(raw.brand, 120), manufacturer: str(raw.manufacturer, 120), batchNumber: batch, barcode,
          category: str(raw.category, 60), unit: str(raw.unit, 30), expiryDate: date(raw.expiryDate), requiresPrescription: !!raw.requiresPrescription, supplierId: str(req.body.supplierId) } });
      }
      lines.push({ inventoryId: inv.id, name, qty, costPrice: cost ?? null, price: Number(inv.price), batchNumber: batch ?? null, expiryDate: inv.expiryDate });
    }
    const totalCost = lines.reduce((s, l) => s + (l.costPrice || 0) * l.qty, 0);
    return tx.stockIntake.create({ data: { pharmacyId: p.id, supplierId: str(req.body.supplierId), invoiceNumber: str(req.body.invoiceNumber, 60), fileUrl: str(req.body.fileUrl, 2000), items: lines, totalCost, createdById: uid(req) } });
  });
  res.status(201).json(result);
}
export async function listIntakes(req: Request, res: Response) {
  const p = await pharm(req);
  res.json(await prisma.stockIntake.findMany({ where: { pharmacyId: p.id }, orderBy: { createdAt: 'desc' }, take: 100 }));
}

/** POST /api/pharmacy-ops/audit { items:[{inventoryId, counted}], note, apply } - stock count; `apply` corrects stock to the counted values. */
export async function stockAudit(req: Request, res: Response) {
  const p = await pharm(req);
  const rows = Array.isArray(req.body.items) ? req.body.items : [];
  const inv = await prisma.inventory.findMany({ where: { pharmacyId: p.id, id: { in: rows.map((r: any) => String(r.inventoryId)) } } });
  const map = Object.fromEntries(inv.map((i) => [i.id, i]));
  const lines = rows.filter((r: any) => map[r.inventoryId]).map((r: any) => {
    const i = map[r.inventoryId]; const counted = Math.max(0, Math.round(Number(r.counted) || 0));
    return { inventoryId: i.id, name: i.name, expected: i.stock, counted, variance: counted - i.stock, value: (counted - i.stock) * Number(i.costPrice ?? i.price) };
  });
  if (!lines.length) throw ApiError.badRequest('Count at least one product');
  const audit = await prisma.$transaction(async (tx) => {
    if (req.body.apply) for (const l of lines) await tx.inventory.update({ where: { id: l.inventoryId }, data: { stock: l.counted } });
    return tx.stockAudit.create({ data: { pharmacyId: p.id, items: lines, varianceValue: lines.reduce((s: number, l: any) => s + l.value, 0), note: str(req.body.note, 1000), createdById: uid(req) } });
  });
  res.status(201).json(audit);
}
export async function listAudits(req: Request, res: Response) {
  const p = await pharm(req);
  res.json(await prisma.stockAudit.findMany({ where: { pharmacyId: p.id }, orderBy: { createdAt: 'desc' }, take: 50 }));
}

/**
 * POST /api/pharmacy-ops/pos/checkout { items:[{inventoryId, qty}], paymentMethod, discount, customerName, customerPhone, patientEmail, prescriptionId }
 * Point-of-sale: prices from inventory, tax applied, stock deducted atomically. CREDITS charges the patient's coins.
 */
export async function posCheckout(req: Request, res: Response) {
  const p = await pharm(req);
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) throw ApiError.badRequest('Cart is empty');
  const method = ['CASH', 'CARD', 'TRANSFER', 'CREDITS'].includes(req.body.paymentMethod) ? req.body.paymentMethod : 'CASH';
  const patient = req.body.patientEmail ? await prisma.user.findUnique({ where: { email: String(req.body.patientEmail).toLowerCase() } }) : null;
  if (method === 'CREDITS' && !patient) throw ApiError.badRequest('Enter the patient\'s N-Health email to charge coins');
  const receiptNo = 'RCP-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const sale = await prisma.$transaction(async (tx) => {
    const lines: any[] = [];
    for (const it of items) {
      const inv = await tx.inventory.findUnique({ where: { id: String(it.inventoryId) } });
      const qty = Math.max(1, Math.round(Number(it.qty) || 1));
      if (!inv || inv.pharmacyId !== p.id) throw ApiError.badRequest('Unknown product in cart');
      if (inv.expiryDate && inv.expiryDate < new Date()) throw ApiError.conflict(`${inv.name} is expired`);
      if (inv.requiresPrescription && !req.body.prescriptionId && !req.body.prescriptionChecked) throw ApiError.badRequest(`${inv.name} is prescription-only - attach or confirm a prescription`);
      const ok = await tx.inventory.updateMany({ where: { id: inv.id, stock: { gte: qty } }, data: { stock: { decrement: qty } } });
      if (!ok.count) throw ApiError.conflict(`Only ${inv.stock} ${inv.name} left`);
      lines.push({ inventoryId: inv.id, name: inv.name, qty, price: Number(inv.price) });
    }
    const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
    const discount = Math.min(subtotal, Math.max(0, num(req.body.discount) || 0));
    const tax = Math.round((subtotal - discount) * env.raw.POS_TAX_PERCENT) / 100;
    const total = subtotal - discount + tax;
    return tx.posSale.create({ data: { pharmacyId: p.id, cashierId: uid(req), receiptNo, items: lines, subtotal, tax, discount, total, paymentMethod: method,
      customerName: str(req.body.customerName, 120) || patient?.name, customerPhone: str(req.body.customerPhone, 30) || patient?.phone, patientUserId: patient?.id, prescriptionId: str(req.body.prescriptionId) } });
  });
  if (method === 'CREDITS' && patient) {
    try {
      await getOrCreateLedger(patient.id);
      await spendCredits(patient.id, Number(sale.total), 'POS-' + sale.receiptNo, `Pharmacy purchase at ${p.pharmacyName}`, { saleId: sale.id });
    } catch (e) {
      // Roll the sale back if the patient can't pay.
      for (const l of sale.items as any[]) await prisma.inventory.update({ where: { id: l.inventoryId }, data: { stock: { increment: l.qty } } });
      await prisma.posSale.delete({ where: { id: sale.id } });
      throw ApiError.badRequest('Patient has insufficient coins');
    }
    await notify(patient.id, 'payment', 'Pharmacy purchase', `${Number(sale.total).toLocaleString()} coins paid at ${p.pharmacyName}. Receipt ${sale.receiptNo}.`);
  }
  const low = await prisma.inventory.findMany({ where: { pharmacyId: p.id, id: { in: (sale.items as any[]).map((l) => l.inventoryId) } } });
  const alerts = low.filter((i) => i.stock <= i.reorderLevel);
  if (alerts.length) await notify(uid(req), 'order', '📦 Low stock alert', alerts.map((a) => `${a.name} (${a.stock} left)`).join(', '));
  res.status(201).json(sale);
}
export async function listSales(req: Request, res: Response) {
  const p = await pharm(req);
  const since = date(req.query.from) || new Date(Date.now() - 30 * 86400_000);
  const sales = await prisma.posSale.findMany({ where: { pharmacyId: p.id, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 500 });
  res.json({ sales, total: sales.reduce((s, x) => s + Number(x.total), 0), count: sales.length });
}
/** GET /api/pharmacy-ops/customers - unique customers from orders and POS sales. */
export async function customers(req: Request, res: Response) {
  const p = await pharm(req);
  const [orders, sales] = await Promise.all([
    prisma.pharmacyOrder.findMany({ where: { pharmacyId: p.id }, include: { patient: { include: { user: { select: { id: true, name: true, phone: true, email: true } } } } } }),
    prisma.posSale.findMany({ where: { pharmacyId: p.id } }),
  ]);
  const m = new Map<string, any>();
  orders.forEach((o) => { const u = o.patient.user; const c = m.get(u.id) || { userId: u.id, name: u.name, phone: u.phone, email: u.email, orders: 0, spent: 0, last: o.createdAt }; c.orders++; c.spent += Number(o.total); if (o.createdAt > c.last) c.last = o.createdAt; m.set(u.id, c); });
  sales.forEach((s) => { const k = s.patientUserId || 'walkin:' + (s.customerPhone || s.customerName || s.id); const c = m.get(k) || { userId: s.patientUserId, name: s.customerName || 'Walk-in customer', phone: s.customerPhone, orders: 0, spent: 0, last: s.createdAt }; c.orders++; c.spent += Number(s.total); if (s.createdAt > c.last) c.last = s.createdAt; m.set(k, c); });
  res.json([...m.values()].sort((a, b) => b.spent - a.spent));
}
/** GET /api/pharmacy-ops/prescriptions - prescriptions routed to this pharmacy. */
export async function routedPrescriptions(req: Request, res: Response) {
  const p = await pharm(req);
  res.json(await prisma.prescription.findMany({ where: { pharmacyId: p.id }, orderBy: { issuedAt: 'desc' }, take: 100,
    include: { doctor: { include: { user: { select: { name: true } } } }, patient: { include: { user: { select: { id: true, name: true, phone: true } } } } } }));
}
