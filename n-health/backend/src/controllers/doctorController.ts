import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { startDocument, drawField, drawTable, drawFooterNote, finishDocument } from '../utils/pdf';

/** Looks up the DoctorProfile row for the logged-in user, or throws. */
async function getDoctorProfile(userId: string) {
  const profile = await prisma.doctorProfile.findUnique({ where: { userId } });
  if (!profile) throw ApiError.notFound('Doctor profile not found');
  return profile;
}

/** Confirms this doctor has (or has had) an appointment with the given patient -
 * used to gate access to that patient's record and to prescribing for them. */
async function assertDoctorTreatsPatient(doctorId: string, patientId: string) {
  const appointment = await prisma.appointment.findFirst({ where: { doctorId, patientId } });
  if (!appointment) throw ApiError.forbidden('You have no appointment history with this patient');
}

// ---------- Profile ----------

export async function getProfile(req: Request, res: Response) {
  const profile = await prisma.doctorProfile.findUnique({
    where: { userId: req.user!.userId },
    include: { user: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } } },
  });
  if (!profile) throw ApiError.notFound('Doctor profile not found');
  res.json(profile);
}

const updateProfileSchema = z.object({
  specialty: z.string().optional(),
  hospital: z.string().optional(),
  bio: z.string().optional(),
  consultationFee: z.number().min(0).optional(),
  yearsExperience: z.number().int().min(0).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export async function updateProfile(req: Request, res: Response) {
  const data = updateProfileSchema.parse(req.body);
  const doctor = await getDoctorProfile(req.user!.userId);
  const updated = await prisma.doctorProfile.update({ where: { id: doctor.id }, data });
  res.json(updated);
}

// ---------- Appointments ----------

export async function listAppointments(req: Request, res: Response) {
  const doctor = await getDoctorProfile(req.user!.userId);
  const { status } = req.query;
  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId: doctor.id,
      status: status ? (String(status) as any) : undefined,
    },
    include: { patient: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } } },
    orderBy: { scheduledAt: 'asc' },
  });
  res.json(appointments);
}

const respondSchema = z.object({
  action: z.enum(['CONFIRM', 'CANCEL', 'COMPLETE']),
  notes: z.string().optional(),
});

const ACTION_TO_STATUS = {
  CONFIRM: 'CONFIRMED',
  CANCEL: 'CANCELLED',
  COMPLETE: 'COMPLETED',
} as const;

export async function respondToAppointment(req: Request, res: Response) {
  const data = respondSchema.parse(req.body);
  const doctor = await getDoctorProfile(req.user!.userId);
  const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!appointment || appointment.doctorId !== doctor.id) throw ApiError.notFound('Appointment not found');

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: ACTION_TO_STATUS[data.action], notes: data.notes ?? appointment.notes },
  });

  // Let the patient know their request was actioned in real time.
  const patient = await prisma.patientProfile.findUnique({ where: { id: appointment.patientId }, select: { userId: true } });
  if (patient) {
    req.app.get('io')?.to(`user:${patient.userId}`).emit('appointment:updated', updated);
  }

  res.json(updated);
}

// ---------- Patients ----------

export async function listPatients(req: Request, res: Response) {
  const doctor = await getDoctorProfile(req.user!.userId);
  const appointments = await prisma.appointment.findMany({
    where: { doctorId: doctor.id },
    select: { patientId: true },
    distinct: ['patientId'],
  });
  const patientIds = appointments.map((a) => a.patientId);
  const patients = await prisma.patientProfile.findMany({
    where: { id: { in: patientIds } },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  res.json(patients);
}

export async function getPatientDetail(req: Request, res: Response) {
  const doctor = await getDoctorProfile(req.user!.userId);
  const patientId = req.params.patientId;
  await assertDoctorTreatsPatient(doctor.id, patientId);

  const patient = await prisma.patientProfile.findUnique({
    where: { id: patientId },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  if (!patient) throw ApiError.notFound('Patient not found');

  const appointments = await prisma.appointment.findMany({
    where: { doctorId: doctor.id, patientId },
    orderBy: { scheduledAt: 'desc' },
  });
  const prescriptions = await prisma.prescription.findMany({
    where: { doctorId: doctor.id, patientId },
    orderBy: { issuedAt: 'desc' },
  });

  res.json({ patient, appointments, prescriptions });
}

// ---------- Prescriptions ----------

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  durationDays: number;
}

const medicationSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.string().min(1),
  durationDays: z.number().int().min(1),
});

const createPrescriptionSchema = z.object({
  patientId: z.string(),
  medications: z.array(medicationSchema).min(1),
});

export async function createPrescription(req: Request, res: Response) {
  const data = createPrescriptionSchema.parse(req.body);
  const doctor = await getDoctorProfile(req.user!.userId);
  await assertDoctorTreatsPatient(doctor.id, data.patientId);

  const prescription = await prisma.prescription.create({
    data: { patientId: data.patientId, doctorId: doctor.id, medications: data.medications as any },
  });

  const patient = await prisma.patientProfile.findUnique({ where: { id: data.patientId }, select: { userId: true } });
  if (patient) {
    req.app.get('io')?.to(`user:${patient.userId}`).emit('prescription:new', prescription);
  }

  res.status(201).json(prescription);
}

export async function listPrescriptionsIssued(req: Request, res: Response) {
  const doctor = await getDoctorProfile(req.user!.userId);
  const { patientId } = req.query;
  const prescriptions = await prisma.prescription.findMany({
    where: { doctorId: doctor.id, patientId: patientId ? String(patientId) : undefined },
    orderBy: { issuedAt: 'desc' },
  });
  res.json(prescriptions);
}

export async function getPrescriptionPdf(req: Request, res: Response) {
  const doctor = await getDoctorProfile(req.user!.userId);
  const prescription = await prisma.prescription.findUnique({
    where: { id: req.params.id },
    include: {
      doctor: { include: { user: { select: { name: true } } } },
      patient: { include: { user: { select: { name: true } } } },
    },
  });
  if (!prescription || prescription.doctorId !== doctor.id) throw ApiError.notFound('Prescription not found');

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
