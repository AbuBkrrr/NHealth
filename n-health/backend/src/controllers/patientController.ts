import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { startDocument, drawField, drawTable, drawTotal, drawFooterNote, finishDocument, formatNaira } from '../utils/pdf';

/** Looks up the PatientProfile row for the logged-in user, or throws. */
async function getPatientProfile(userId: string) {
  const profile = await prisma.patientProfile.findUnique({ where: { userId } });
  if (!profile) throw ApiError.notFound('Patient profile not found');
  return profile;
}

// ---------- Profile ----------

export async function getProfile(req: Request, res: Response) {
  const profile = await prisma.patientProfile.findUnique({
    where: { userId: req.user!.userId },
    include: { user: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } } },
  });
  if (!profile) throw ApiError.notFound('Patient profile not found');
  res.json(profile);
}

const updateProfileSchema = z.object({
  dateOfBirth: z.string().datetime().optional(),
  bloodType: z.string().optional(),
  genotype: z.string().optional(),
  nhisNumber: z.string().optional(),
  allergies: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
});

export async function updateProfile(req: Request, res: Response) {
  const data = updateProfileSchema.parse(req.body);
  const patient = await getPatientProfile(req.user!.userId);
  const updated = await prisma.patientProfile.update({
    where: { id: patient.id },
    data: { ...data, dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined },
  });
  res.json(updated);
}

// ---------- Appointments ----------

const createAppointmentSchema = z.object({
  doctorId: z.string(),
  scheduledAt: z.string().datetime(),
  type: z.enum(['IN_PERSON', 'VIDEO']).default('IN_PERSON'),
  reason: z.string().optional(),
});

export async function listAppointments(req: Request, res: Response) {
  const patient = await getPatientProfile(req.user!.userId);
  const appointments = await prisma.appointment.findMany({
    where: { patientId: patient.id },
    include: { doctor: { include: { user: { select: { name: true, avatarUrl: true } } } } },
    orderBy: { scheduledAt: 'desc' },
  });
  res.json(appointments);
}

export async function createAppointment(req: Request, res: Response) {
  const data = createAppointmentSchema.parse(req.body);
  const patient = await getPatientProfile(req.user!.userId);
  const appointment = await prisma.appointment.create({
    data: {
      patientId: patient.id,
      doctorId: data.doctorId,
      scheduledAt: new Date(data.scheduledAt),
      type: data.type,
      reason: data.reason,
    },
  });
  res.status(201).json(appointment);
}

export async function cancelAppointment(req: Request, res: Response) {
  const patient = await getPatientProfile(req.user!.userId);
  const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!appointment || appointment.patientId !== patient.id) throw ApiError.notFound('Appointment not found');
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: 'CANCELLED' },
  });
  res.json(updated);
}

// ---------- Pharmacy orders ----------

interface OrderItem {
  inventoryId: string;
  name: string;
  qty: number;
  price: number;
}

const createOrderSchema = z.object({
  pharmacyId: z.string(),
  prescriptionId: z.string().optional(),
  items: z.array(z.object({ inventoryId: z.string(), name: z.string(), qty: z.number().min(1), price: z.number() })),
});

export async function listOrders(req: Request, res: Response) {
  const patient = await getPatientProfile(req.user!.userId);
  const orders = await prisma.pharmacyOrder.findMany({
    where: { patientId: patient.id },
    include: { pharmacy: { include: { user: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders);
}

export async function createOrder(req: Request, res: Response) {
  const data = createOrderSchema.parse(req.body);
  const patient = await getPatientProfile(req.user!.userId);
  const total = data.items.reduce((sum, i) => sum + i.qty * i.price, 0);

  // Decrement stock and create the order atomically so two patients can't both
  // "buy" the last unit of something out from under each other.
  const order = await prisma.$transaction(async (tx) => {
    for (const item of data.items) {
      const updated = await tx.inventory.updateMany({
        where: { id: item.inventoryId, stock: { gte: item.qty } },
        data: { stock: { decrement: item.qty } },
      });
      if (updated.count === 0) {
        throw ApiError.conflict(`Not enough stock for ${item.name}`);
      }
    }
    return tx.pharmacyOrder.create({
      data: {
        patientId: patient.id,
        pharmacyId: data.pharmacyId,
        prescriptionId: data.prescriptionId,
        items: data.items as any,
        total,
      },
    });
  });

  res.status(201).json(order);
}

export async function getOrderInvoicePdf(req: Request, res: Response) {
  const patient = await getPatientProfile(req.user!.userId);
  const order = await prisma.pharmacyOrder.findUnique({
    where: { id: req.params.id },
    include: { pharmacy: { select: { pharmacyName: true } }, patient: { include: { user: { select: { name: true } } } } },
  });
  if (!order || order.patientId !== patient.id) throw ApiError.notFound('Order not found');

  const items = order.items as unknown as OrderItem[];

  const h = await startDocument('Invoice', `Order #${order.id.slice(0, 8)}`);
  drawField(h, 'Patient', order.patient.user.name);
  drawField(h, 'Pharmacy', order.pharmacy.pharmacyName);
  drawField(h, 'Date', order.createdAt.toLocaleString());
  drawField(h, 'Status', order.status.replace(/_/g, ' '));
  drawTable(
    h,
    items.map((i) => ({ name: i.name, qty: String(i.qty), amount: formatNaira(i.qty * i.price) }))
  );
  drawTotal(h, 'Total', formatNaira(Number(order.total)));
  drawFooterNote(h, 'This invoice was generated by N-Health for a pharmacy order.');

  const pdf = await finishDocument(h);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.id.slice(0, 8)}.pdf"`);
  res.send(pdf);
}

// ---------- Prescriptions (read-only for patient) ----------

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  durationDays: number;
}

export async function listPrescriptions(req: Request, res: Response) {
  const patient = await getPatientProfile(req.user!.userId);
  const prescriptions = await prisma.prescription.findMany({
    where: { patientId: patient.id },
    include: { doctor: { include: { user: { select: { name: true } } } } },
    orderBy: { issuedAt: 'desc' },
  });
  res.json(prescriptions);
}

export async function getPrescriptionPdf(req: Request, res: Response) {
  const patient = await getPatientProfile(req.user!.userId);
  const prescription = await prisma.prescription.findUnique({
    where: { id: req.params.id },
    include: {
      doctor: { include: { user: { select: { name: true } } } },
      patient: { include: { user: { select: { name: true } } } },
    },
  });
  if (!prescription || prescription.patientId !== patient.id) throw ApiError.notFound('Prescription not found');

  const meds = prescription.medications as unknown as Medication[];

  const h = await startDocument('Prescription', `Issued ${prescription.issuedAt.toLocaleDateString()}`);
  drawField(h, 'Patient', prescription.patient.user.name);
  drawField(h, 'Prescribed by', `Dr. ${prescription.doctor.user.name}`);
  drawTable(
    h,
    meds.map((m) => ({ name: m.name, qty: m.dosage, amount: `${m.frequency}, ${m.durationDays}d` })),
    { name: 'MEDICATION', qty: 'DOSAGE', amount: 'SCHEDULE' }
  );
  drawFooterNote(h, 'This prescription was issued via N-Health. Present it at any partner pharmacy.');

  const pdf = await finishDocument(h);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="prescription-${prescription.id.slice(0, 8)}.pdf"`);
  res.send(pdf);
}

// ---------- Lab tests ----------

const createLabTestSchema = z.object({
  labId: z.string(),
  testType: z.string(),
  scheduledAt: z.string().datetime().optional(),
});

export async function listLabTests(req: Request, res: Response) {
  const patient = await getPatientProfile(req.user!.userId);
  const tests = await prisma.labTest.findMany({
    where: { patientId: patient.id },
    include: { lab: { include: { user: { select: { name: true } } } }, result: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tests);
}

export async function createLabTest(req: Request, res: Response) {
  const data = createLabTestSchema.parse(req.body);
  const patient = await getPatientProfile(req.user!.userId);
  const test = await prisma.labTest.create({
    data: {
      patientId: patient.id,
      labId: data.labId,
      testType: data.testType,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
    },
  });
  res.status(201).json(test);
}

// ---------- Emergency ----------

const emergencyRequestSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  notes: z.string().optional(),
});

export async function requestEmergency(req: Request, res: Response) {
  const data = emergencyRequestSchema.parse(req.body);
  const patient = await getPatientProfile(req.user!.userId);
  const request = await prisma.emergencyRequest.create({
    data: { patientId: patient.id, lat: data.lat, lng: data.lng, notes: data.notes },
  });

  // Notify all connected ambulance dashboards in real time.
  req.app.get('io')?.to('role:AMBULANCE').emit('emergency:new', request);

  res.status(201).json(request);
}

export async function listEmergencyRequests(req: Request, res: Response) {
  const patient = await getPatientProfile(req.user!.userId);
  const requests = await prisma.emergencyRequest.findMany({
    where: { patientId: patient.id },
    orderBy: { requestedAt: 'desc' },
  });
  res.json(requests);
}

export async function cancelEmergencyRequest(req: Request, res: Response) {
  const patient = await getPatientProfile(req.user!.userId);
  const request = await prisma.emergencyRequest.findUnique({ where: { id: req.params.id } });
  if (!request || request.patientId !== patient.id) throw ApiError.notFound('Emergency request not found');
  if (request.status === 'COMPLETED' || request.status === 'CANCELLED') {
    throw ApiError.conflict(`This request is already ${request.status.toLowerCase()}`);
  }

  const updated = await prisma.emergencyRequest.update({ where: { id: request.id }, data: { status: 'CANCELLED' } });

  // If an ambulance had already been dispatched, let them know it's been called off.
  if (request.ambulanceId) {
    const ambulance = await prisma.ambulanceProfile.findUnique({ where: { id: request.ambulanceId }, select: { userId: true } });
    if (ambulance) req.app.get('io')?.to(`user:${ambulance.userId}`).emit('emergency:cancelled', { id: updated.id });
  } else {
    // Otherwise it was still an open broadcast - tell every ambulance dashboard to drop it.
    req.app.get('io')?.to('role:AMBULANCE').emit('emergency:claimed', { id: updated.id });
  }

  res.json(updated);
}

// ---------- Nurse requests ----------

const nurseRequestSchema = z.object({
  nurseId: z.string().optional(),
  serviceType: z.string(),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export async function requestNurse(req: Request, res: Response) {
  const data = nurseRequestSchema.parse(req.body);
  const patient = await getPatientProfile(req.user!.userId);
  const request = await prisma.nurseRequest.create({
    data: {
      patientId: patient.id,
      nurseId: data.nurseId,
      serviceType: data.serviceType,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      notes: data.notes,
    },
  });
  // Targeted request (a specific nurse was picked) still notifies that nurse's
  // personal room; an untargeted request falls back to broadcasting to all nurses.
  const io = req.app.get('io');
  if (data.nurseId) {
    const nurse = await prisma.nurseProfile.findUnique({ where: { id: data.nurseId }, select: { userId: true } });
    if (nurse) io?.to(`user:${nurse.userId}`).emit('nurse:new', request);
  } else {
    io?.to('role:NURSE').emit('nurse:new', request);
  }
  res.status(201).json(request);
}

// ---------- Donations ----------

const donationSchema = z.object({
  campaign: z.string(),
  amount: z.number().min(1),
});

export async function listDonations(req: Request, res: Response) {
  const patient = await getPatientProfile(req.user!.userId);
  const donations = await prisma.donation.findMany({
    where: { patientId: patient.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(donations);
}

export async function createDonation(req: Request, res: Response) {
  const data = donationSchema.parse(req.body);
  const patient = await getPatientProfile(req.user!.userId);
  const donation = await prisma.donation.create({
    data: { patientId: patient.id, campaign: data.campaign, amount: data.amount, status: 'PENDING' },
  });
  res.status(201).json(donation);
}

// ---------- Insurance ----------

const insuranceSchema = z.object({
  provider: z.string(),
  policyNumber: z.string(),
  coverageDetails: z.string().optional(),
  premiumAmount: z.number().min(0).optional(),
  expiresAt: z.string().datetime().optional(),
});

export async function listInsurance(req: Request, res: Response) {
  const patient = await getPatientProfile(req.user!.userId);
  const policies = await prisma.insurancePolicy.findMany({ where: { patientId: patient.id } });
  res.json(policies);
}

export async function addInsurance(req: Request, res: Response) {
  const data = insuranceSchema.parse(req.body);
  const patient = await getPatientProfile(req.user!.userId);
  const policy = await prisma.insurancePolicy.create({
    data: {
      patientId: patient.id,
      provider: data.provider,
      policyNumber: data.policyNumber,
      coverageDetails: data.coverageDetails,
      premiumAmount: data.premiumAmount,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    },
  });
  res.status(201).json(policy);
}
