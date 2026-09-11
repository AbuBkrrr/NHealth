import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { startDocument, drawField, drawTable, drawFooterNote, finishDocument } from '../utils/pdf';

/** Looks up the LabProfile row for the logged-in user, or throws. */
async function getLabProfile(userId: string) {
  const profile = await prisma.labProfile.findUnique({ where: { userId } });
  if (!profile) throw ApiError.notFound('Lab profile not found');
  return profile;
}

// ---------- Profile ----------

export async function getProfile(req: Request, res: Response) {
  const profile = await prisma.labProfile.findUnique({
    where: { userId: req.user!.userId },
    include: { user: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } } },
  });
  if (!profile) throw ApiError.notFound('Lab profile not found');
  res.json(profile);
}

const updateProfileSchema = z.object({
  labName: z.string().min(1).optional(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export async function updateProfile(req: Request, res: Response) {
  const data = updateProfileSchema.parse(req.body);
  const lab = await getLabProfile(req.user!.userId);
  const updated = await prisma.labProfile.update({ where: { id: lab.id }, data });
  res.json(updated);
}

// ---------- Dashboard stats ----------

export async function getStats(req: Request, res: Response) {
  const lab = await getLabProfile(req.user!.userId);

  const [awaitingSample, inProgress, completedTests] = await Promise.all([
    prisma.labTest.count({ where: { labId: lab.id, status: 'REQUESTED' } }),
    prisma.labTest.count({ where: { labId: lab.id, status: { in: ['SAMPLE_COLLECTED', 'PROCESSING'] } } }),
    prisma.labTest.findMany({ where: { labId: lab.id, status: 'COMPLETED' }, select: { fee: true, createdAt: true } }),
  ]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayRevenue = completedTests
    .filter((t: { createdAt: Date }) => t.createdAt >= startOfToday)
    .reduce((sum: number, t: { fee: unknown }) => sum + Number(t.fee), 0);

  res.json({ awaitingSample, inProgress, completedCount: completedTests.length, todayRevenue });
}

// ---------- Tests ----------

export async function listTests(req: Request, res: Response) {
  const lab = await getLabProfile(req.user!.userId);
  const { status } = req.query;
  const tests = await prisma.labTest.findMany({
    where: { labId: lab.id, status: status ? (String(status) as any) : undefined },
    include: {
      patient: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      result: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Payment isn't denormalized onto LabTest, so look it up alongside each test
  // to tell the lab whether they're clear to collect a sample yet.
  const payments = await prisma.payment.findMany({
    where: { payableType: 'LAB_TEST', payableId: { in: tests.map((t: { id: string }) => t.id) }, status: 'CONFIRMED' },
    select: { payableId: true },
  });
  const paidIds = new Set(payments.map((p: { payableId: string }) => p.payableId));

  res.json(tests.map((t: { id: string }) => ({ ...t, isPaid: paidIds.has(t.id) })));
}

export async function getTestDetail(req: Request, res: Response) {
  const lab = await getLabProfile(req.user!.userId);
  const test = await prisma.labTest.findUnique({
    where: { id: req.params.id },
    include: {
      patient: { include: { user: { select: { id: true, name: true, avatarUrl: true, phone: true } } } },
      result: true,
    },
  });
  if (!test || test.labId !== lab.id) throw ApiError.notFound('Test not found');

  const payment = await prisma.payment.findFirst({
    where: { payableType: 'LAB_TEST', payableId: test.id, status: 'CONFIRMED' },
  });
  res.json({ ...test, isPaid: Boolean(payment) });
}

const NEXT_STATUS: Record<string, string[]> = {
  REQUESTED: ['SAMPLE_COLLECTED', 'CANCELLED'],
  SAMPLE_COLLECTED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['CANCELLED'], // COMPLETED only happens via uploadResult, below
};

const statusSchema = z.object({ status: z.enum(['SAMPLE_COLLECTED', 'PROCESSING', 'CANCELLED']) });

export async function updateTestStatus(req: Request, res: Response) {
  const data = statusSchema.parse(req.body);
  const lab = await getLabProfile(req.user!.userId);
  const test = await prisma.labTest.findUnique({ where: { id: req.params.id } });
  if (!test || test.labId !== lab.id) throw ApiError.notFound('Test not found');

  const allowed = NEXT_STATUS[test.status] ?? [];
  if (!allowed.includes(data.status)) {
    throw ApiError.conflict(`Cannot move a test from ${test.status} to ${data.status}`);
  }

  if (data.status === 'SAMPLE_COLLECTED') {
    const payment = await prisma.payment.findFirst({
      where: { payableType: 'LAB_TEST', payableId: test.id, status: 'CONFIRMED' },
    });
    if (!payment) throw ApiError.conflict('Cannot collect a sample before payment is confirmed');
  }

  const updated = await prisma.labTest.update({ where: { id: test.id }, data: { status: data.status } });

  const patient = await prisma.patientProfile.findUnique({ where: { id: test.patientId }, select: { userId: true } });
  if (patient) req.app.get('io')?.to(`user:${patient.userId}`).emit('labtest:updated', updated);

  res.json(updated);
}

// ---------- Results ----------

const resultRowSchema = z.object({
  parameter: z.string(),
  value: z.string(),
  unit: z.string().optional(),
  referenceRange: z.string().optional(),
  flag: z.enum(['NORMAL', 'LOW', 'HIGH']).optional(),
});

const uploadResultSchema = z.object({
  results: z.array(resultRowSchema).min(1),
  notes: z.string().optional(),
});

export async function uploadResult(req: Request, res: Response) {
  const data = uploadResultSchema.parse(req.body);
  const lab = await getLabProfile(req.user!.userId);
  const test = await prisma.labTest.findUnique({ where: { id: req.params.id }, include: { result: true } });
  if (!test || test.labId !== lab.id) throw ApiError.notFound('Test not found');
  if (test.status === 'CANCELLED') throw ApiError.conflict('Cannot upload a result for a cancelled test');
  if (test.result) throw ApiError.conflict('A result has already been uploaded for this test');

  const [result] = await prisma.$transaction([
    prisma.labResult.create({
      data: { labTestId: test.id, resultData: { results: data.results, notes: data.notes ?? null } },
    }),
    prisma.labTest.update({ where: { id: test.id }, data: { status: 'COMPLETED' } }),
  ]);

  const patient = await prisma.patientProfile.findUnique({ where: { id: test.patientId }, select: { userId: true } });
  if (patient) req.app.get('io')?.to(`user:${patient.userId}`).emit('labresult:new', result);

  res.status(201).json(result);
}

export async function getResultPdf(req: Request, res: Response) {
  const lab = await getLabProfile(req.user!.userId);
  const test = await prisma.labTest.findUnique({
    where: { id: req.params.id },
    include: {
      patient: { include: { user: { select: { name: true } } } },
      result: true,
    },
  });
  if (!test || test.labId !== lab.id) throw ApiError.notFound('Test not found');
  if (!test.result) throw ApiError.notFound('No result has been uploaded for this test yet');

  const resultData = test.result.resultData as { results: { parameter: string; value: string; unit?: string; referenceRange?: string }[] };

  const h = await startDocument('Lab Result', `${test.testType} · ${test.result.uploadedAt.toLocaleDateString()}`);
  drawField(h, 'Patient', test.patient.user.name);
  drawField(h, 'Test type', test.testType);
  drawTable(
    h,
    resultData.results.map((r) => ({
      name: r.parameter,
      qty: r.unit ?? '',
      amount: `${r.value}${r.referenceRange ? ` (ref: ${r.referenceRange})` : ''}`,
    })),
    { name: 'PARAMETER', qty: 'UNIT', amount: 'VALUE' }
  );
  drawFooterNote(h, 'This result was generated via N-Health. Discuss findings with your doctor.');

  const pdf = await finishDocument(h);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="lab-result-${test.id.slice(0, 8)}.pdf"`);
  res.send(pdf);
}
