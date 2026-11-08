import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import { notify } from '../services/notify';
import { isBookable } from '../services/availability';
import { refundCoinPayment } from '../services/checkout';
import { getBalance } from '../services/creditsService';
import { distanceKm } from '../utils/geo';
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
  const doctor = await prisma.doctorProfile.findUnique({ where: { id: data.doctorId }, include: { user: { select: { id: true, name: true, verificationStatus: true, isActive: true } } } });
  if (!doctor || !doctor.user.isActive) throw ApiError.notFound('Doctor not found');
  if (doctor.user.verificationStatus !== 'VERIFIED' && env.nodeEnv === 'production') throw ApiError.badRequest('This doctor is not yet verified');
  const at = new Date(data.scheduledAt);
  if (!(await isBookable(doctor.user.id, at))) throw ApiError.conflict('That time slot is no longer available - please pick another');
  const fee = Number(doctor.consultationFee);
  const serviceFee = Math.round(fee * env.raw.SERVICE_FEE_PERCENT) / 100;
  const appointment = await prisma.appointment.create({
    data: {
      patientId: patient.id, doctorId: data.doctorId, scheduledAt: at, type: data.type, reason: data.reason,
      durationMin: doctor.slotMinutes || 30, fee, serviceFee, currency: 'NGN', institutionId: doctor.institutionId ?? undefined,
    },
  });
  const me = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true } });
  await notify(doctor.user.id, 'appointment', 'New appointment request 📅', `${me?.name || 'A patient'} requested ${at.toISOString()}${data.reason ? ' - ' + data.reason : ''}.`, { email: true, data: { appointmentId: appointment.id } });
  req.app.get('io')?.to(`user:${doctor.user.id}`).emit('appointment:new', appointment);
  res.status(201).json(appointment);
}

/** Reschedule to a new free slot (only before the visit starts). */
export async function rescheduleAppointment(req: Request, res: Response) {
  const patient = await getPatientProfile(req.user!.userId);
  const appt = await prisma.appointment.findUnique({ where: { id: req.params.id }, include: { doctor: { select: { userId: true } } } });
  if (!appt || appt.patientId !== patient.id) throw ApiError.notFound('Appointment not found');
  if (!['PENDING', 'CONFIRMED'].includes(appt.status)) throw ApiError.conflict('This appointment can no longer be rescheduled');
  const at = new Date(String(req.body.scheduledAt));
  if (isNaN(at.getTime())) throw ApiError.badRequest('Invalid date');
  if (!(await isBookable(appt.doctor.userId, at))) throw ApiError.conflict('That time slot is not available');
  const updated = await prisma.appointment.update({ where: { id: appt.id }, data: { scheduledAt: at, status: 'PENDING', reminderSentAt: null, rescheduledFromId: appt.id } });
  await notify(appt.doctor.userId, 'appointment', 'Appointment rescheduled', `A patient moved their appointment to ${at.toISOString()}.`, { data: { appointmentId: appt.id } });
  res.json(updated);
}

export async function cancelAppointment(req: Request, res: Response) {
  const patient = await getPatientProfile(req.user!.userId);
  const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!appointment || appointment.patientId !== patient.id) throw ApiError.notFound('Appointment not found');
  if (['COMPLETED', 'CANCELLED'].includes(appointment.status)) throw ApiError.conflict(`Appointment is already ${appointment.status.toLowerCase()}`);
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: 'CANCELLED', cancelReason: req.body?.reason ? String(req.body.reason).slice(0, 300) : undefined, cancelledBy: 'PATIENT' },
  });
  // Full refund if cancelled 12h+ before the visit; otherwise the provider keeps the fee (policy shown in-app).
  if (appointment.scheduledAt.getTime() - Date.now() > 12 * 3600_000 || appointment.status === 'PENDING') {
    await refundCoinPayment('APPOINTMENT', appointment.id, 'appointment cancelled');
  }
  const doc = await prisma.doctorProfile.findUnique({ where: { id: appointment.doctorId }, select: { userId: true } });
  if (doc) await notify(doc.userId, 'appointment', 'Appointment cancelled', `A patient cancelled their appointment${req.body?.reason ? ': ' + req.body.reason : ''}.`, { data: { appointmentId: appointment.id } });
  res.json(updated);
}

// ---------- Pharmacy orders ----------

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
  const pharmacy = await prisma.pharmacyProfile.findUnique({ where: { id: data.pharmacyId }, select: { id: true, userId: true, pharmacyName: true } });
  if (!pharmacy) throw ApiError.notFound('Pharmacy not found');
  let rx: any = null;
  if (data.prescriptionId) {
    rx = await prisma.prescription.findUnique({ where: { id: data.prescriptionId } });
    if (!rx || rx.patientId !== patient.id) throw ApiError.notFound('Prescription not found');
  }
  const deliveryMethod = req.body.deliveryMethod === 'DELIVERY' ? 'DELIVERY' : 'PICKUP';

  // Prices always come from the pharmacy's inventory - never from the client.
  const order = await prisma.$transaction(async (tx) => {
    const lines: any[] = [];
    for (const item of data.items) {
      const inv = await tx.inventory.findUnique({ where: { id: item.inventoryId } });
      if (!inv || inv.pharmacyId !== pharmacy.id) throw ApiError.badRequest(`${item.name} is not sold by this pharmacy`);
      if (inv.expiryDate && inv.expiryDate < new Date()) throw ApiError.conflict(`${inv.name} is expired and cannot be sold`);
      if (inv.requiresPrescription && !rx) throw ApiError.badRequest(`${inv.name} requires a prescription from a doctor`);
      const updated = await tx.inventory.updateMany({ where: { id: inv.id, stock: { gte: item.qty } }, data: { stock: { decrement: item.qty } } });
      if (updated.count === 0) throw ApiError.conflict(`Not enough stock for ${inv.name}`);
      lines.push({ inventoryId: inv.id, name: inv.name, qty: item.qty, price: Number(inv.price) });
    }
    const total = lines.reduce((sum, i) => sum + i.qty * i.price, 0);
    return tx.pharmacyOrder.create({
      data: { patientId: patient.id, pharmacyId: pharmacy.id, prescriptionId: data.prescriptionId, items: lines, total,
        deliveryMethod, deliveryAddress: deliveryMethod === 'DELIVERY' ? String(req.body.deliveryAddress || patient.address || '') : null },
    });
  });
  await notify(pharmacy.userId, 'order', 'New order 🛒', `New ${rx ? 'prescription ' : ''}order worth ${Number(order.total).toLocaleString()}.`, { data: { orderId: order.id } });
  req.app.get('io')?.to(`user:${pharmacy.userId}`).emit('order:new', order);
  res.status(201).json(order);
}

export async function getOrderInvoicePdf(req: Request, res: Response) {
  const patient = await getPatientProfile(req.user!.userId);
  const order = await prisma.pharmacyOrder.findUnique({
    where: { id: req.params.id },
    include: { pharmacy: { select: { pharmacyName: true } }, patient: { include: { user: { select: { name: true } } } } },
  });
  if (!order || order.patientId !== patient.id) throw ApiError.notFound('Order not found');

  const items = order.items as { name: string; qty: number; price: number }[];

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

export async function listPrescriptions(req: Request, res: Response) {
  const patient = await getPatientProfile(req.user!.userId);
  const prescriptions = await prisma.prescription.findMany({
    where: { patientId: patient.id },
    include: { doctor: { include: { user: { select: { name: true } } } } },
    orderBy: { issuedAt: 'desc' },
  });
  res.json(prescriptions);
}

interface Medication { name: string; dosage: string; frequency: string; durationDays: number }

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

  // Prisma types this as Prisma.JsonValue, which doesn't narrow directly to
  // Medication[] with a single assertion - safe here since we know the shape
  // was validated on the way in by createPrescription's own zod schema.
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
  const lab = await prisma.labProfile.findUnique({ where: { id: data.labId }, select: { id: true, userId: true } });
  if (!lab) throw ApiError.notFound('Lab not found');
  const cat = req.body.catalogId ? await prisma.labTestCatalog.findUnique({ where: { id: String(req.body.catalogId) } }) : null;
  if (cat && cat.labId !== lab.id) throw ApiError.badRequest('That test is not offered by this lab');
  const test = await prisma.labTest.create({
    data: {
      patientId: patient.id, labId: lab.id, testType: cat?.name ?? data.testType, catalogId: cat?.id,
      fee: cat ? cat.price : undefined, scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      homeCollection: !!req.body.homeCollection, address: req.body.address ? String(req.body.address) : undefined,
      notes: req.body.notes ? String(req.body.notes) : undefined,
    },
  });
  await notify(lab.userId, 'lab', 'New test booking 🔬', `${test.testType} booked${test.homeCollection ? ' (home collection)' : ''}.`, { data: { labTestId: test.id } });
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
  const open = await prisma.emergencyRequest.findFirst({ where: { patientId: patient.id, status: { in: ['REQUESTED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED'] } } });
  if (open) return res.status(200).json(open);
  // Minimum coin balance guarantees ambulance operators get paid; life-threatening cases should still dial 112/767.
  const bal = await getBalance(req.user!.userId);
  if (bal < env.raw.EMERGENCY_MIN_BALANCE && !req.body.overrideBalance) {
    throw ApiError.badRequest(`A minimum balance of ${env.raw.EMERGENCY_MIN_BALANCE.toLocaleString()} coins is required. Top up, or call 112 / 767 now.`);
  }
  const request = await prisma.emergencyRequest.create({
    data: { patientId: patient.id, lat: data.lat, lng: data.lng, notes: data.notes, type: req.body.type ? String(req.body.type) : 'MEDICAL',
      contactPhone: req.body.contactPhone ? String(req.body.contactPhone) : undefined, address: req.body.address ? String(req.body.address) : undefined },
  });
  const io = req.app.get('io');
  // Alert the nearest available ambulances first (all if no locations known), plus available doctors.
  const ambulances = await prisma.ambulanceProfile.findMany({ where: { isAvailable: true }, select: { userId: true, currentLat: true, currentLng: true } });
  const ranked = ambulances.map((a) => ({ ...a, d: a.currentLat != null && a.currentLng != null ? distanceKm(data.lat, data.lng, a.currentLat, a.currentLng) : 9999 }))
    .sort((a, b) => a.d - b.d).slice(0, 15);
  for (const a of ranked) {
    io?.to(`user:${a.userId}`).emit('emergency:new', { ...request, distanceKm: a.d === 9999 ? null : Math.round(a.d * 10) / 10 });
    await notify(a.userId, 'emergency', '🚨 Emergency nearby', `Emergency request ${a.d < 9999 ? Math.round(a.d * 10) / 10 + ' km away' : ''}. Open the app to accept.`, { sms: true, data: { requestId: request.id } });
  }
  io?.to('role:AMBULANCE').emit('emergency:new', request);
  io?.to('role:DOCTOR').emit('emergency:alert', { id: request.id, lat: data.lat, lng: data.lng, notes: data.notes });
  if (patient.emergencyPhone) {
    const u = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true } });
    const { sendSms } = await import('../services/sms');
    await sendSms(patient.emergencyPhone, `N-Health alert: ${u?.name || 'Your contact'} requested emergency help at https://maps.google.com/?q=${data.lat},${data.lng}`);
  }
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
      address: req.body.address ? String(req.body.address) : undefined,
      durationHours: Number(req.body.durationHours) > 0 ? Math.min(24, Number(req.body.durationHours)) : 1,
    },
  });
  // Targeted request (a specific nurse was picked) still notifies that nurse's
  // personal room; an untargeted request falls back to broadcasting to all nurses.
  const io = req.app.get('io');
  if (data.nurseId) {
    const nurse = await prisma.nurseProfile.findUnique({ where: { id: data.nurseId }, select: { userId: true } });
    if (nurse) {
      io?.to(`user:${nurse.userId}`).emit('nurse:new', request);
      await notify(nurse.userId, 'appointment', 'New home-care request 🩺', `${data.serviceType} requested.`, { data: { requestId: request.id } });
    }
  } else {
    io?.to('role:NURSE').emit('nurse:new', request);
  }
  res.status(201).json(request);
}

// ---------- Donations ----------

const donationSchema = z.object({
  campaign: z.string().optional(),
  campaignId: z.string().optional(),
  amount: z.number().min(100),
  anonymous: z.boolean().optional(),
  message: z.string().max(300).optional(),
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
  const camp = data.campaignId ? await prisma.donationCampaign.findUnique({ where: { id: data.campaignId } }) : null;
  if (data.campaignId && (!camp || camp.status !== 'ACTIVE')) throw ApiError.badRequest('This campaign is not accepting donations');
  const donation = await prisma.donation.create({
    data: { patientId: patient.id, campaign: camp?.title ?? data.campaign ?? 'General Fund', campaignId: camp?.id, amount: data.amount,
      anonymous: !!data.anonymous, message: data.message, status: 'PENDING', currency: camp?.currency ?? 'NGN' },
  });
  // Pay immediately with coins when requested (the usual path from the app).
  if (req.body.payWith === 'COINS') {
    const { payWithCoins } = await import('../services/checkout');
    await payWithCoins(req.user!.userId, 'DONATION', donation.id);
    return res.status(201).json(await prisma.donation.findUnique({ where: { id: donation.id } }));
  }
  res.status(201).json(donation);
}

// ---------- Insurance ----------

const insuranceSchema = z.object({
  provider: z.string().optional(),
  policyNumber: z.string().optional(),
  planId: z.string().optional(),
  memberCount: z.number().int().min(1).max(20).optional(),
  coverageDetails: z.string().optional(),
  premiumAmount: z.number().min(0).optional(),
  expiresAt: z.string().datetime().optional(),
});

export async function listInsurance(req: Request, res: Response) {
  const patient = await getPatientProfile(req.user!.userId);
  const policies = await prisma.insurancePolicy.findMany({ where: { patientId: patient.id }, include: { plan: true }, orderBy: { createdAt: 'desc' } });
  res.json(policies);
}

export async function addInsurance(req: Request, res: Response) {
  const data = insuranceSchema.parse(req.body);
  const patient = await getPatientProfile(req.user!.userId);
  const plan = data.planId ? await prisma.insurancePlan.findUnique({ where: { id: data.planId } }) : null;
  if (data.planId && !plan) throw ApiError.notFound('Plan not found');
  if (!plan && (!data.provider || !data.policyNumber)) throw ApiError.badRequest('Provide your insurer and policy number, or choose a plan');
  const policy = await prisma.insurancePolicy.create({
    data: {
      patientId: patient.id,
      planId: plan?.id,
      memberCount: data.memberCount ?? 1,
      status: plan ? 'PENDING' : 'ACTIVE',
      provider: plan?.provider ?? data.provider!,
      policyNumber: data.policyNumber ?? 'APP-' + Date.now().toString(36).toUpperCase(),
      coverageDetails: data.coverageDetails,
      premiumAmount: plan ? Number(plan.monthlyPremium) * (data.memberCount ?? 1) : data.premiumAmount,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    },
  });
  res.status(201).json(policy);
}
