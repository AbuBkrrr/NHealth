import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';

/** Looks up the NurseProfile row for the logged-in user, or throws. */
async function getNurseProfile(userId: string) {
  const profile = await prisma.nurseProfile.findUnique({ where: { userId } });
  if (!profile) throw ApiError.notFound('Nurse profile not found');
  return profile;
}

// ---------- Profile ----------

export async function getProfile(req: Request, res: Response) {
  const profile = await prisma.nurseProfile.findUnique({
    where: { userId: req.user!.userId },
    include: { user: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } } },
  });
  if (!profile) throw ApiError.notFound('Nurse profile not found');
  res.json(profile);
}

const updateProfileSchema = z.object({
  specialty: z.string().optional(),
  hourlyRate: z.number().min(0).optional(),
});

export async function updateProfile(req: Request, res: Response) {
  const data = updateProfileSchema.parse(req.body);
  const nurse = await getNurseProfile(req.user!.userId);
  const updated = await prisma.nurseProfile.update({ where: { id: nurse.id }, data });
  res.json(updated);
}

const availabilitySchema = z.object({ isAvailable: z.boolean() });

export async function setAvailability(req: Request, res: Response) {
  const data = availabilitySchema.parse(req.body);
  const nurse = await getNurseProfile(req.user!.userId);
  const updated = await prisma.nurseProfile.update({ where: { id: nurse.id }, data: { isAvailable: data.isAvailable } });
  res.json(updated);
}

// ---------- Dashboard stats ----------

export async function getStats(req: Request, res: Response) {
  const nurse = await getNurseProfile(req.user!.userId);

  const [awaitingCount, activeCount, completedRequests] = await Promise.all([
    prisma.nurseRequest.count({
      where: { status: 'REQUESTED', OR: [{ nurseId: null }, { nurseId: nurse.id }] },
    }),
    prisma.nurseRequest.count({ where: { nurseId: nurse.id, status: 'IN_PROGRESS' } }),
    prisma.nurseRequest.findMany({ where: { nurseId: nurse.id, status: 'COMPLETED' }, select: { createdAt: true } }),
  ]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const completedToday = completedRequests.filter((r: { createdAt: Date }) => r.createdAt >= startOfToday).length;
  const todayRevenue = completedToday * Number(nurse.hourlyRate);

  res.json({ awaitingCount, activeCount, completedToday, todayRevenue });
}

// ---------- Requests ----------

export async function listAvailableRequests(req: Request, res: Response) {
  const nurse = await getNurseProfile(req.user!.userId);
  // Requests that need this nurse's action: broadcast (unclaimed) requests,
  // plus any request a patient specifically targeted at this nurse.
  const requests = await prisma.nurseRequest.findMany({
    where: { status: 'REQUESTED', OR: [{ nurseId: null }, { nurseId: nurse.id }] },
    include: { patient: { include: { user: { select: { id: true, name: true, phone: true, avatarUrl: true } } } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json(requests);
}

export async function listMyRequests(req: Request, res: Response) {
  const nurse = await getNurseProfile(req.user!.userId);
  const { status } = req.query;
  const requests = await prisma.nurseRequest.findMany({
    where: {
      nurseId: nurse.id,
      status: status ? (String(status) as any) : { not: 'REQUESTED' }, // REQUESTED-but-mine already lives in "available"
    },
    include: { patient: { include: { user: { select: { id: true, name: true, phone: true, avatarUrl: true } } } } },
    orderBy: { createdAt: 'desc' },
  });

  const payments = await prisma.payment.findMany({
    where: { payableType: 'NURSE_REQUEST', payableId: { in: requests.map((r: { id: string }) => r.id) }, status: 'CONFIRMED' },
    select: { payableId: true },
  });
  const paidIds = new Set(payments.map((p: { payableId: string }) => p.payableId));

  res.json(requests.map((r: { id: string }) => ({ ...r, isPaid: paidIds.has(r.id) })));
}

export async function getRequestDetail(req: Request, res: Response) {
  const nurse = await getNurseProfile(req.user!.userId);
  const request = await prisma.nurseRequest.findUnique({
    where: { id: req.params.id },
    include: { patient: { include: { user: { select: { id: true, name: true, phone: true, avatarUrl: true } } } } },
  });
  if (!request) throw ApiError.notFound('Request not found');
  if (request.nurseId && request.nurseId !== nurse.id) throw ApiError.forbidden('This request belongs to another nurse');
  res.json(request);
}

/**
 * Accepts a request. Two cases: a broadcast request with no assigned nurse
 * yet (claimed via a conditional update, so two nurses can't both grab it),
 * or a request the patient already targeted at this nurse specifically
 * (just needs this nurse to confirm they'll take it).
 */
export async function acceptRequest(req: Request, res: Response) {
  const nurse = await getNurseProfile(req.user!.userId);
  const request = await prisma.nurseRequest.findUnique({ where: { id: req.params.id } });
  if (!request) throw ApiError.notFound('Request not found');
  if (request.status !== 'REQUESTED') throw ApiError.conflict(`This request is already ${request.status.toLowerCase()}`);

  if (request.nurseId && request.nurseId !== nurse.id) {
    throw ApiError.forbidden('This request was sent to another nurse');
  }

  if (request.nurseId === nurse.id) {
    // Already targeted at this nurse - just confirm.
    const updated = await prisma.nurseRequest.update({ where: { id: request.id }, data: { status: 'ACCEPTED' } });
    await notifyPatient(req, updated.patientId, 'nurse:accepted', updated);
    return res.json(updated);
  }

  const { count } = await prisma.nurseRequest.updateMany({
    where: { id: request.id, nurseId: null, status: 'REQUESTED' },
    data: { nurseId: nurse.id, status: 'ACCEPTED' },
  });
  if (count === 0) throw ApiError.conflict('This request has already been accepted by another nurse');

  const updated = await prisma.nurseRequest.findUnique({ where: { id: request.id } });
  await notifyPatient(req, request.patientId, 'nurse:accepted', updated);
  req.app.get('io')?.to('role:NURSE').emit('nurse:claimed', { id: request.id });

  res.json(updated);
}

const NEXT_STATUS: Record<string, string[]> = {
  ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
};

const statusSchema = z.object({ status: z.enum(['IN_PROGRESS', 'COMPLETED', 'CANCELLED']) });

export async function updateRequestStatus(req: Request, res: Response) {
  const data = statusSchema.parse(req.body);
  const nurse = await getNurseProfile(req.user!.userId);
  const request = await prisma.nurseRequest.findUnique({ where: { id: req.params.id } });
  if (!request || request.nurseId !== nurse.id) throw ApiError.notFound('Request not found');

  const allowed = NEXT_STATUS[request.status] ?? [];
  if (!allowed.includes(data.status)) {
    throw ApiError.conflict(`Cannot move a request from ${request.status} to ${data.status}`);
  }

  if (data.status === 'IN_PROGRESS') {
    const payment = await prisma.payment.findFirst({
      where: { payableType: 'NURSE_REQUEST', payableId: request.id, status: 'CONFIRMED' },
    });
    if (!payment) throw ApiError.conflict('Cannot start the visit before payment is confirmed');
  }

  const updated = await prisma.nurseRequest.update({ where: { id: request.id }, data: { status: data.status } });
  await notifyPatient(req, request.patientId, 'nurse:status', { id: updated.id, status: updated.status });

  res.json(updated);
}

async function notifyPatient(req: Request, patientId: string, event: string, payload: unknown) {
  const patient = await prisma.patientProfile.findUnique({ where: { id: patientId }, select: { userId: true } });
  if (patient) req.app.get('io')?.to(`user:${patient.userId}`).emit(event, payload);
}
