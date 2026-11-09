import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { notify } from '../services/notify';
import { accrueForSource } from '../services/earnings';
import { refundCoinPayment } from '../services/checkout';

/** Looks up the PharmacyProfile row for the logged-in user, or throws. */
async function getPharmacyProfile(userId: string) {
  const profile = await prisma.pharmacyProfile.findUnique({ where: { userId } });
  if (!profile) throw ApiError.notFound('Pharmacy profile not found');
  return profile;
}

// ---------- Profile ----------

export async function getProfile(req: Request, res: Response) {
  const profile = await prisma.pharmacyProfile.findUnique({
    where: { userId: req.user!.userId },
    include: { user: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } } },
  });
  if (!profile) throw ApiError.notFound('Pharmacy profile not found');
  res.json(profile);
}

const updateProfileSchema = z.object({
  pharmacyName: z.string().min(1).optional(),
  address: z.string().optional(),
  operatingHours: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export async function updateProfile(req: Request, res: Response) {
  const data = updateProfileSchema.parse(req.body);
  const pharmacy = await getPharmacyProfile(req.user!.userId);
  const updated = await prisma.pharmacyProfile.update({ where: { id: pharmacy.id }, data });
  res.json(updated);
}

// ---------- Dashboard stats ----------

export async function getStats(req: Request, res: Response) {
  const pharmacy = await getPharmacyProfile(req.user!.userId);

  const [pendingOrders, lowStockCount, totalItems, orders] = await Promise.all([
    prisma.pharmacyOrder.count({ where: { pharmacyId: pharmacy.id, status: 'PENDING' } }),
    prisma.inventory.count({ where: { pharmacyId: pharmacy.id, stock: { lte: 10 } } }),
    prisma.inventory.count({ where: { pharmacyId: pharmacy.id } }),
    prisma.pharmacyOrder.findMany({
      where: { pharmacyId: pharmacy.id, paymentStatus: 'PAID' },
      select: { total: true, createdAt: true },
    }),
  ]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayRevenue = orders
    .filter((o: { createdAt: Date }) => o.createdAt >= startOfToday)
    .reduce((sum: number, o: { total: unknown }) => sum + Number(o.total), 0);

  res.json({ pendingOrders, lowStockCount, totalItems, todayRevenue });
}

// ---------- Inventory ----------

export async function listInventory(req: Request, res: Response) {
  const pharmacy = await getPharmacyProfile(req.user!.userId);
  const items = await prisma.inventory.findMany({
    where: { pharmacyId: pharmacy.id },
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(items);
}

const inventorySchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  stock: z.number().int().min(0),
  price: z.number().min(0),
  expiryDate: z.string().datetime().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  brand: z.string().max(120).optional().nullable(),
  manufacturer: z.string().max(120).optional().nullable(),
  batchNumber: z.string().max(60).optional().nullable(),
  barcode: z.string().max(60).optional().nullable(),
  unit: z.string().max(30).optional().nullable(),
  costPrice: z.number().min(0).optional().nullable(),
  reorderLevel: z.number().int().min(0).optional(),
  requiresPrescription: z.boolean().optional(),
  description: z.string().max(1000).optional().nullable(),
});

export async function createInventoryItem(req: Request, res: Response) {
  const data = inventorySchema.parse(req.body);
  const pharmacy = await getPharmacyProfile(req.user!.userId);
  const item = await prisma.inventory.create({
    data: {
      pharmacyId: pharmacy.id,
      name: data.name,
      category: data.category,
      stock: data.stock,
      price: data.price,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      supplierId: data.supplierId ?? null,
      brand: data.brand, manufacturer: data.manufacturer, batchNumber: data.batchNumber, barcode: data.barcode, unit: data.unit,
      costPrice: data.costPrice ?? undefined, reorderLevel: data.reorderLevel, requiresPrescription: data.requiresPrescription, description: data.description,
    },
  });
  res.status(201).json(item);
}

const inventoryUpdateSchema = inventorySchema.partial();

export async function updateInventoryItem(req: Request, res: Response) {
  const data = inventoryUpdateSchema.parse(req.body);
  const pharmacy = await getPharmacyProfile(req.user!.userId);
  const existing = await prisma.inventory.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.pharmacyId !== pharmacy.id) throw ApiError.notFound('Inventory item not found');

  const updated = await prisma.inventory.update({
    where: { id: existing.id },
    data: {
      ...data,
      expiryDate: data.expiryDate === undefined ? undefined : data.expiryDate ? new Date(data.expiryDate) : null,
    },
  });
  res.json(updated);
}

export async function deleteInventoryItem(req: Request, res: Response) {
  const pharmacy = await getPharmacyProfile(req.user!.userId);
  const existing = await prisma.inventory.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.pharmacyId !== pharmacy.id) throw ApiError.notFound('Inventory item not found');

  await prisma.inventory.delete({ where: { id: existing.id } });
  res.status(204).send();
}

// ---------- Suppliers ----------

export async function listSuppliers(req: Request, res: Response) {
  const pharmacy = await getPharmacyProfile(req.user!.userId);
  const suppliers = await prisma.supplier.findMany({
    where: { pharmacyId: pharmacy.id },
    include: { _count: { select: { items: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(suppliers);
}

const supplierSchema = z.object({
  name: z.string().min(1),
  contact: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
});

export async function createSupplier(req: Request, res: Response) {
  const data = supplierSchema.parse(req.body);
  const pharmacy = await getPharmacyProfile(req.user!.userId);
  const supplier = await prisma.supplier.create({
    data: { pharmacyId: pharmacy.id, name: data.name, contact: data.contact, email: data.email || undefined },
  });
  res.status(201).json(supplier);
}

export async function updateSupplier(req: Request, res: Response) {
  const data = supplierSchema.partial().parse(req.body);
  const pharmacy = await getPharmacyProfile(req.user!.userId);
  const existing = await prisma.supplier.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.pharmacyId !== pharmacy.id) throw ApiError.notFound('Supplier not found');

  const updated = await prisma.supplier.update({ where: { id: existing.id }, data });
  res.json(updated);
}

export async function deleteSupplier(req: Request, res: Response) {
  const pharmacy = await getPharmacyProfile(req.user!.userId);
  const existing = await prisma.supplier.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.pharmacyId !== pharmacy.id) throw ApiError.notFound('Supplier not found');

  await prisma.supplier.delete({ where: { id: existing.id } });
  res.status(204).send();
}

// ---------- Orders ----------

export async function listOrders(req: Request, res: Response) {
  const pharmacy = await getPharmacyProfile(req.user!.userId);
  const { status } = req.query;
  const orders = await prisma.pharmacyOrder.findMany({
    where: { pharmacyId: pharmacy.id, status: status ? (String(status) as any) : undefined },
    include: { patient: { include: { user: { select: { id: true, name: true, avatarUrl: true, phone: true } } } }, prescription: { include: { doctor: { include: { user: { select: { name: true } } } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders);
}

export async function getOrderDetail(req: Request, res: Response) {
  const pharmacy = await getPharmacyProfile(req.user!.userId);
  const order = await prisma.pharmacyOrder.findUnique({
    where: { id: req.params.id },
    include: { patient: { include: { user: { select: { id: true, name: true, avatarUrl: true, phone: true } } } } },
  });
  if (!order || order.pharmacyId !== pharmacy.id) throw ApiError.notFound('Order not found');
  res.json(order);
}

// Valid forward transitions a pharmacy can push an order through once it's paid for.
const NEXT_STATUS: Record<string, string[]> = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
};

const statusSchema = z.object({
  status: z.enum(['PROCESSING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']),
});

export async function updateOrderStatus(req: Request, res: Response) {
  const data = statusSchema.parse(req.body);
  const pharmacy = await getPharmacyProfile(req.user!.userId);
  const order = await prisma.pharmacyOrder.findUnique({ where: { id: req.params.id } });
  if (!order || order.pharmacyId !== pharmacy.id) throw ApiError.notFound('Order not found');

  const allowed = NEXT_STATUS[order.status] ?? [];
  if (!allowed.includes(data.status)) {
    throw ApiError.conflict(`Cannot move an order from ${order.status} to ${data.status}`);
  }

  const updated = await prisma.pharmacyOrder.update({ where: { id: order.id }, data: { status: data.status, declineReason: data.status === 'CANCELLED' ? (req.body as any).reason || null : undefined } });
  if (data.status === 'CANCELLED') await refundCoinPayment('PHARMACY_ORDER', order.id, 'order declined by pharmacy');
  if (data.status === 'DELIVERED') await accrueForSource('PHARMACY_ORDER', order.id);

  // Restock items if the order is cancelled after stock was already deducted.
  if (data.status === 'CANCELLED') {
    const items = order.items as { inventoryId: string; qty: number }[];
    await Promise.all(
      items.map((item) =>
        prisma.inventory.updateMany({ where: { id: item.inventoryId }, data: { stock: { increment: item.qty } } })
      )
    );
  }

  const patient = await prisma.patientProfile.findUnique({ where: { id: order.patientId }, select: { userId: true } });
  if (patient) {
    req.app.get('io')?.to(`user:${patient.userId}`).emit('order:updated', updated);
    const txt: Record<string, string> = { PROCESSING: 'is being prepared', READY: 'is ready for pickup', OUT_FOR_DELIVERY: 'is on its way 🛵', DELIVERED: 'was delivered', CANCELLED: 'was declined' };
    await notify(patient.userId, 'order', 'Order update', `Your pharmacy order ${txt[updated.status] || updated.status}.`, { sms: updated.status === 'READY', data: { orderId: order.id } });
  }

  res.json(updated);
}
