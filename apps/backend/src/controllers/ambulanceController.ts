import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';

/** Looks up the AmbulanceProfile row for the logged-in user, or throws. */
async function getAmbulanceProfile(userId: string) {
  const profile = await prisma.ambulanceProfile.findUnique({ where: { userId } });
  if (!profile) throw ApiError.notFound('Ambulance profile not found');
  return profile;
}

// ---------- Profile ----------

export async function getProfile(req: Request, res: Response) {
  const profile = await prisma.ambulanceProfile.findUnique({
    where: { userId: req.user!.userId },
    include: { user: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } } },
  });
  if (!profile) throw ApiError.notFound('Ambulance profile not found');
  res.json(profile);
}

const updateProfileSchema = z.object({
  vehicleNumber: z.string().min(1).optional(),
});

export async function updateProfile(req: Request, res: Response) {
  const data = updateProfileSchema.parse(req.body);
  const ambulance = await getAmbulanceProfile(req.user!.userId);
  const updated = await prisma.ambulanceProfile.update({ where: { id: ambulance.id }, data });
  res.json(updated);
}

const availabilitySchema = z.object({ isAvailable: z.boolean() });

export async function setAvailability(req: Request, res: Response) {
  const data = availabilitySchema.parse(req.body);
  const ambulance = await getAmbulanceProfile(req.user!.userId);
  const updated = await prisma.ambulanceProfile.update({ where: { id: ambulance.id }, data: { isAvailable: data.isAvailable } });
  res.json(updated);
}

const locationSchema = z.object({ lat: z.number(), lng: z.number() });

export async function updateLocation(req: Request, res: Response) {
  const data = locationSchema.parse(req.body);
  const ambulance = await getAmbulanceProfile(req.user!.userId);
  const updated = await prisma.ambulanceProfile.update({
    where: { id: ambulance.id },
    data: { currentLat: data.lat, currentLng: data.lng },
  });

  // Only the patient(s) this ambulance is actively responding to need this
  // ping - broadcasting it to every connected socket would leak every
  // ambulance's live position to every other user for no reason.
  const activeRequests = await prisma.emergencyRequest.findMany({
    where: { ambulanceId: ambulance.id, status: { in: ['ACCEPTED', 'EN_ROUTE', 'ARRIVED'] } },
    select: { patientId: true },
  });
  const patients = await prisma.patientProfile.findMany({
    where: { id: { in: activeRequests.map((r: { patientId: string }) => r.patientId) } },
    select: { userId: true },
  });
  for (const patient of patients) {
    req.app.get('io')?.to(`user:${patient.userId}`).emit('ambulance:location', { lat: data.lat, lng: data.lng });
  }

  res.json(updated);
}

// ---------- Dashboard stats ----------

export async function getStats(req: Request, res: Response) {
  const ambulance = await getAmbulanceProfile(req.user!.userId);

  const [availableCount, activeCount, completedRequests] = await Promise.all([
    prisma.emergencyRequest.count({ where: { ambulanceId: null, status: 'REQUESTED' } }),
    prisma.emergencyRequest.count({ where: { ambulanceId: ambulance.id, status: { in: ['ACCEPTED', 'EN_ROUTE', 'ARRIVED'] } } }),
    prisma.emergencyRequest.findMany({ where: { ambulanceId: ambulance.id, status: 'COMPLETED' }, select: { completedAt: true } }),
  ]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const completedToday = completedRequests.filter(
    (r: { completedAt: Date | null }) => r.completedAt && r.completedAt >= startOfToday
  ).length;

  res.json({ availableCount, activeCount, completedToday, completedTotal: completedRequests.length });
}

// ---------- Requests ----------

export async function listAvailableRequests(req: Request, res: Response) {
  const requests = await prisma.emergencyRequest.findMany({
    where: { ambulanceId: null, status: 'REQUESTED' },
    include: { patient: { include: { user: { select: { id: true, name: true, phone: true, avatarUrl: true } } } } },
    orderBy: { requestedAt: 'asc' },
  });
  res.json(requests);
}

export async function listMyRequests(req: Request, res: Response) {
  const ambulance = await getAmbulanceProfile(req.user!.userId);
  const { status } = req.query;
  const requests = await prisma.emergencyRequest.findMany({
    where: { ambulanceId: ambulance.id, status: status ? (String(status) as any) : undefined },
    include: { patient: { include: { user: { select: { id: true, name: true, phone: true, avatarUrl: true } } } } },
    orderBy: { requestedAt: 'desc' },
  });
  res.json(requests);
}

export async function getRequestDetail(req: Request, res: Response) {
  const ambulance = await getAmbulanceProfile(req.user!.userId);
  const request = await prisma.emergencyRequest.findUnique({
    where: { id: req.params.id },
    include: { patient: { include: { user: { select: { id: true, name: true, phone: true, avatarUrl: true } } } } },
  });
  if (!request) throw ApiError.notFound('Request not found');
  // Anyone can view an unclaimed request (to decide whether to accept it);
  // once claimed, only the assigned ambulance can see the detail view.
  if (request.ambulanceId && request.ambulanceId !== ambulance.id) throw ApiError.forbidden('This request belongs to another ambulance');
  res.json(request);
}

/** First ambulance to accept an unclaimed request claims it - guarded by a conditional update so two ambulances can't both grab the same call. */
export async function acceptRequest(req: Request, res: Response) {
  const ambulance = await getAmbulanceProfile(req.user!.userId);
  const request = await prisma.emergencyRequest.findUnique({ where: { id: req.params.id } });
  if (!request) throw ApiError.notFound('Request not found');
  if (request.ambulanceId) throw ApiError.conflict('This request has already been accepted by another ambulance');

  const { count } = await prisma.emergencyRequest.updateMany({
    where: { id: request.id, ambulanceId: null },
    data: { ambulanceId: ambulance.id, status: 'ACCEPTED' },
  });
  if (count === 0) throw ApiError.conflict('This request has already been accepted by another ambulance');

  const updated = await prisma.emergencyRequest.findUnique({ where: { id: request.id } });
  const patient = await prisma.patientProfile.findUnique({ where: { id: request.patientId }, select: { userId: true } });
  if (patient) req.app.get('io')?.to(`user:${patient.userId}`).emit('emergency:accepted', updated);
  // Tell every other ambulance dashboard this call is no longer up for grabs.
  req.app.get('io')?.to('role:AMBULANCE').emit('emergency:claimed', { id: request.id });

  res.json(updated);
}

const NEXT_STATUS: Record<string, string[]> = {
  ACCEPTED: ['EN_ROUTE', 'CANCELLED'],
  EN_ROUTE: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['COMPLETED', 'CANCELLED'],
};

const statusSchema = z.object({ status: z.enum(['EN_ROUTE', 'ARRIVED', 'COMPLETED', 'CANCELLED']) });

export async function updateRequestStatus(req: Request, res: Response) {
  const data = statusSchema.parse(req.body);
  const ambulance = await getAmbulanceProfile(req.user!.userId);
  const request = await prisma.emergencyRequest.findUnique({ where: { id: req.params.id } });
  if (!request || request.ambulanceId !== ambulance.id) throw ApiError.notFound('Request not found');

  const allowed = NEXT_STATUS[request.status] ?? [];
  if (!allowed.includes(data.status)) {
    throw ApiError.conflict(`Cannot move a request from ${request.status} to ${data.status}`);
  }

  const updated = await prisma.emergencyRequest.update({
    where: { id: request.id },
    data: {
      status: data.status,
      completedAt: data.status === 'COMPLETED' ? new Date() : undefined,
    },
  });

  const patient = await prisma.patientProfile.findUnique({ where: { id: request.patientId }, select: { userId: true } });
  if (patient) req.app.get('io')?.to(`user:${patient.userId}`).emit('emergency:status', { status: updated.status, id: updated.id });

  res.json(updated);
}
