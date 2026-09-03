import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { Role } from '@prisma/client';

async function logAction(actorId: string, action: string, targetType: string, targetId: string, detail?: string) {
  await prisma.adminAuditLog.create({ data: { actorId, action, targetType, targetId, detail } });
}

// ---------- Dashboard ----------

export async function getStats(req: Request, res: Response) {
  const [usersByRole, pendingAppointments, pendingPayments, openEmergencies, totalDonations] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { role: true } }),
    prisma.appointment.count({ where: { status: 'PENDING' } }),
    prisma.payment.count({ where: { status: 'PENDING' } }),
    prisma.emergencyRequest.count({ where: { status: { in: ['REQUESTED', 'ACCEPTED', 'EN_ROUTE'] } } }),
    prisma.donation.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
  ]);

  res.json({
    usersByRole: Object.fromEntries(usersByRole.map((r) => [r.role, r._count.role])),
    pendingAppointments,
    pendingPayments,
    openEmergencies,
    totalDonations: Number(totalDonations._sum.amount ?? 0),
  });
}

// ---------- Users (all roles) ----------

export async function listUsers(req: Request, res: Response) {
  const { role, search, isActive, page = '1', pageSize = '25' } = req.query;
  const take = Math.min(Number(pageSize) || 25, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const where = {
    role: role ? (String(role) as Role) : undefined,
    isActive: isActive !== undefined ? isActive === 'true' : undefined,
    OR: search
      ? [
          { name: { contains: String(search), mode: 'insensitive' as const } },
          { email: { contains: String(search), mode: 'insensitive' as const } },
        ]
      : undefined,
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ users, total, page: Number(page) || 1, pageSize: take });
}

export async function getUserDetail(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      patientProfile: true,
      doctorProfile: true,
      pharmacyProfile: true,
      labProfile: true,
      ambulanceProfile: true,
      nurseProfile: true,
    },
  });
  if (!user) throw ApiError.notFound('User not found');
  const { passwordHash, ...safeUser } = user;
  res.json(safeUser);
}

const statusSchema = z.object({ isActive: z.boolean() });

export async function setUserStatus(req: Request, res: Response) {
  const data = statusSchema.parse(req.body);
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) throw ApiError.notFound('User not found');
  if (target.role === 'ADMIN') throw ApiError.badRequest('Use the admin account endpoints to manage admin accounts');

  const updated = await prisma.user.update({ where: { id: target.id }, data: { isActive: data.isActive } });
  await logAction(req.user!.userId, data.isActive ? 'REACTIVATE_USER' : 'SUSPEND_USER', 'User', target.id, target.email);

  res.json({ id: updated.id, isActive: updated.isActive });
}

// ---------- Admin accounts (super admin only) ----------

export async function listAdmins(req: Request, res: Response) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, name: true, email: true, phone: true, isActive: true, isSuperAdmin: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(admins);
}

const createAdminSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  isSuperAdmin: z.boolean().default(false),
});

export async function createAdmin(req: Request, res: Response) {
  const data = createAdminSchema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const passwordHash = await bcrypt.hash(data.password, 12);
  const admin = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      name: data.name,
      phone: data.phone,
      role: 'ADMIN',
      isSuperAdmin: data.isSuperAdmin,
    },
  });

  await logAction(req.user!.userId, 'CREATE_ADMIN', 'User', admin.id, admin.email);
  res.status(201).json({ id: admin.id, name: admin.name, email: admin.email, isSuperAdmin: admin.isSuperAdmin });
}

const updateAdminSchema = z.object({
  isActive: z.boolean().optional(),
  isSuperAdmin: z.boolean().optional(),
});

export async function updateAdmin(req: Request, res: Response) {
  const data = updateAdminSchema.parse(req.body);
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target || target.role !== 'ADMIN') throw ApiError.notFound('Admin account not found');

  if (target.id === req.user!.userId && data.isSuperAdmin === false) {
    throw ApiError.badRequest('You cannot remove your own super admin access');
  }
  if (target.id === req.user!.userId && data.isActive === false) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }

  const updated = await prisma.user.update({ where: { id: target.id }, data });
  await logAction(req.user!.userId, 'UPDATE_ADMIN', 'User', target.id, JSON.stringify(data));

  res.json({ id: updated.id, isActive: updated.isActive, isSuperAdmin: updated.isSuperAdmin });
}

export async function deleteAdmin(req: Request, res: Response) {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target || target.role !== 'ADMIN') throw ApiError.notFound('Admin account not found');
  if (target.id === req.user!.userId) throw ApiError.badRequest('You cannot delete your own account');

  await prisma.user.delete({ where: { id: target.id } });
  await logAction(req.user!.userId, 'DELETE_ADMIN', 'User', target.id, target.email);

  res.status(204).send();
}

// ---------- Audit log ----------

export async function listAuditLog(req: Request, res: Response) {
  const logs = await prisma.adminAuditLog.findMany({
    include: { actor: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(logs);
}
