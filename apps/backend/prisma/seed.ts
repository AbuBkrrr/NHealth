import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password123', 12);

  // ========== SEED SPECIALIZATIONS FIRST ==========
  const doctorSpecializations = [
    // Cardiology
    { name: 'Cardiologist', desc: 'Heart and cardiovascular specialist', category: 'Cardiology', type: 'DOCTOR' as const },
    { name: 'Cardiac Surgeon', desc: 'Surgical heart procedures', category: 'Cardiology', type: 'DOCTOR' as const },
    // General Medicine
    { name: 'General Practitioner (GP)', desc: 'Primary healthcare provider', category: 'General Medicine', type: 'DOCTOR' as const },
    { name: 'Internal Medicine Specialist', desc: 'Adult disease specialist', category: 'General Medicine', type: 'DOCTOR' as const },
    // Surgery
    { name: 'General Surgeon', desc: 'General surgical procedures', category: 'Surgery', type: 'DOCTOR' as const },
    { name: 'Orthopaedic Surgeon', desc: 'Bone and joint specialist', category: 'Surgery', type: 'DOCTOR' as const },
    { name: 'Neurosurgeon', desc: 'Brain and nervous system surgery', category: 'Surgery', type: 'DOCTOR' as const },
    // Pediatrics
    { name: 'Pediatrician', desc: 'Children\'s health specialist', category: 'Pediatrics', type: 'DOCTOR' as const },
    // Obstetrics & Gynaecology
    { name: 'Obstetrician/Gynaecologist', desc: 'Pregnancy and women\'s health', category: 'Obstetrics & Gynaecology', type: 'DOCTOR' as const },
    // Psychiatry
    { name: 'Psychiatrist', desc: 'Mental health specialist', category: 'Psychiatry', type: 'DOCTOR' as const },
    // Dermatology
    { name: 'Dermatologist', desc: 'Skin disease specialist', category: 'Dermatology', type: 'DOCTOR' as const },
    // Neurology
    { name: 'Neurologist', desc: 'Nervous system specialist', category: 'Neurology', type: 'DOCTOR' as const },
    // Pulmonology
    { name: 'Pulmonologist', desc: 'Lung and respiratory specialist', category: 'Pulmonology', type: 'DOCTOR' as const },
    // Gastroenterology
    { name: 'Gastroenterologist', desc: 'Digestive system specialist', category: 'Gastroenterology', type: 'DOCTOR' as const },
    // Oncology
    { name: 'Medical Oncologist', desc: 'Cancer treatment specialist', category: 'Oncology', type: 'DOCTOR' as const },
    // Endocrinology
    { name: 'Endocrinologist', desc: 'Hormone specialist', category: 'Endocrinology', type: 'DOCTOR' as const },
    // Emergency Medicine
    { name: 'Emergency Medicine Doctor', desc: 'Emergency care specialist', category: 'Emergency Medicine', type: 'DOCTOR' as const },
  ];

  const nurseSpecializations = [
    // General Nursing
    { name: 'Registered Nurse (RN)', desc: 'General nursing care', category: 'General Nursing', type: 'NURSE' as const },
    { name: 'Licensed Practical Nurse (LPN)', desc: 'Practical nursing care', category: 'General Nursing', type: 'NURSE' as const },
    // Specialty Nursing
    { name: 'Intensive Care Nurse (ICU)', desc: 'Critical care nursing', category: 'Specialty Nursing', type: 'NURSE' as const },
    { name: 'Emergency Room Nurse (ER)', desc: 'Emergency nursing care', category: 'Specialty Nursing', type: 'NURSE' as const },
    { name: 'Operating Room Nurse (OR)', desc: 'Surgical nursing care', category: 'Specialty Nursing', type: 'NURSE' as const },
    // Pediatric & Maternal Nursing
    { name: 'Pediatric Nurse', desc: 'Children\'s nursing care', category: 'Pediatric Nursing', type: 'NURSE' as const },
    { name: 'Maternity Nurse', desc: 'Pregnancy and delivery nursing', category: 'Maternal Nursing', type: 'NURSE' as const },
    // Community & Home Health Nursing
    { name: 'Community Health Nurse', desc: 'Community health services', category: 'Community Nursing', type: 'NURSE' as const },
    { name: 'Home Health Nurse', desc: 'Home-based patient care', category: 'Community Nursing', type: 'NURSE' as const },
    // Mental Health
    { name: 'Psychiatric Nurse', desc: 'Mental health nursing', category: 'Mental Health Nursing', type: 'NURSE' as const },
  ];

  // Create all specializations
  for (const spec of [...doctorSpecializations, ...nurseSpecializations]) {
    await prisma.specialization.upsert({
      where: { name: spec.name },
      update: {},
      create: spec,
    });
  }

  const cardiologistSpec = await prisma.specialization.findUnique({ where: { name: 'Cardiologist' } });
  const generalNurseSpec = await prisma.specialization.findUnique({ where: { name: 'Registered Nurse (RN)' } });

  // ========== SEED USERS ==========

  const patientUser = await prisma.user.create({
    data: {
      email: 'patient@demo.com',
      passwordHash: password,
      name: 'Amara Okafor',
      role: 'PATIENT',
      patientProfile: {
        create: { bloodType: 'O+', genotype: 'AA', nhisNumber: 'NHIS-88213-LG', allergies: 'Penicillin', address: 'Lagos, Nigeria' },
      },
    },
    include: { patientProfile: true },
  });

  const doctorUser = await prisma.user.create({
    data: {
      email: 'doctor@demo.com',
      passwordHash: password,
      name: 'Dr. Chidi Nwosu',
      role: 'DOCTOR',
      doctorProfile: {
        create: {
          specialty: 'Cardiology',
          specialtyId: cardiologistSpec?.id,
          licenseNumber: 'DOC-10293',
          hospital: 'Lagos General Hospital',
          consultationFee: 15000,
          yearsExperience: 9,
          rating: 4.8,
          lat: 6.6018,
          lng: 3.3515,
        },
      },
    },
    include: { doctorProfile: true },
  });

  const pharmacyUser = await prisma.user.create({
    data: {
      email: 'pharmacy@demo.com',
      passwordHash: password,
      name: 'MedPlus Pharmacy',
      role: 'PHARMACY',
      pharmacyProfile: {
        create: {
          pharmacyName: 'MedPlus Pharmacy',
          licenseNumber: 'PH-5521',
          address: 'Victoria Island, Lagos',
          operatingHours: '8:00 AM - 10:00 PM',
          lat: 6.4281,
          lng: 3.4219,
        },
      },
    },
    include: { pharmacyProfile: true },
  });

  const supplier = await prisma.supplier.create({
    data: {
      pharmacyId: pharmacyUser.pharmacyProfile!.id,
      name: 'PharmaDist Nigeria Ltd',
      contact: '+234 802 555 0199',
      email: 'orders@pharmadist.ng',
    },
  });

  const paracetamol = await prisma.inventory.create({
    data: {
      pharmacyId: pharmacyUser.pharmacyProfile!.id,
      name: 'Paracetamol 500mg',
      category: 'Pain Relief',
      stock: 200,
      price: 500,
      supplierId: supplier.id,
    },
  });
  await prisma.inventory.createMany({
    data: [
      { pharmacyId: pharmacyUser.pharmacyProfile!.id, name: 'Amoxicillin 250mg', category: 'Antibiotic', stock: 120, price: 1500, supplierId: supplier.id },
      { pharmacyId: pharmacyUser.pharmacyProfile!.id, name: 'Vitamin C 1000mg', category: 'Supplement', stock: 300, price: 800 },
      { pharmacyId: pharmacyUser.pharmacyProfile!.id, name: 'ORS Sachets', category: 'Rehydration', stock: 4, price: 350 },
    ],
  });

  const demoOrder = await prisma.pharmacyOrder.create({
    data: {
      patientId: patientUser.patientProfile!.id,
      pharmacyId: pharmacyUser.pharmacyProfile!.id,
      items: [{ inventoryId: paracetamol.id, name: paracetamol.name, qty: 2, price: 500 }],
      total: 1000,
      status: 'PENDING',
      paymentStatus: 'PENDING',
    },
  });
  await prisma.payment.create({
    data: {
      payerId: patientUser.id,
      payableType: 'PHARMACY_ORDER',
      payableId: demoOrder.id,
      amount: 1000,
      method: 'TRANSFER',
      providerUserId: pharmacyUser.id,
      reference: 'NH-SEED-0001',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      status: 'PENDING',
      transferBankName: 'N-Health Demo Bank',
      transferAccountName: 'N-Health Ltd',
      transferAccountNumber: '0123456789',
    },
  });

  const labUser = await prisma.user.create({
    data: {
      email: 'lab@demo.com',
      passwordHash: password,
      name: 'Synlab Diagnostics',
      role: 'LAB',
      labProfile: { create: { labName: 'Synlab Diagnostics', licenseNumber: 'LAB-7781', address: 'Ikeja, Lagos', lat: 6.6059, lng: 3.3491 } },
    },
    include: { labProfile: true },
  });

  const pendingTest = await prisma.labTest.create({
    data: {
      patientId: patientUser.patientProfile!.id,
      labId: labUser.labProfile!.id,
      testType: 'Full Blood Count',
      status: 'REQUESTED',
      fee: 5000,
    },
  });
  await prisma.payment.create({
    data: {
      payerId: patientUser.id,
      payableType: 'LAB_TEST',
      payableId: pendingTest.id,
      amount: 5000,
      method: 'USSD',
      providerUserId: labUser.id,
      reference: 'NH-SEED-0002',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      status: 'PENDING',
      ussdCode: '*737*50*5000#',
    },
  });

  const completedTest = await prisma.labTest.create({
    data: {
      patientId: patientUser.patientProfile!.id,
      labId: labUser.labProfile!.id,
      testType: 'Malaria Parasite Test',
      status: 'COMPLETED',
      fee: 3000,
    },
  });
  await prisma.labResult.create({
    data: {
      labTestId: completedTest.id,
      resultData: {
        results: [
          { parameter: 'Plasmodium species', value: 'Not detected', unit: '', referenceRange: 'Negative' },
        ],
        notes: 'No parasites seen on thick and thin films.',
      },
    },
  });

  const ambulanceUser = await prisma.user.create({
    data: {
      email: 'ambulance@demo.com',
      passwordHash: password,
      name: 'Rapid Response EMS',
      role: 'AMBULANCE',
      ambulanceProfile: { create: { vehicleNumber: 'LAG-EMS-04', licenseNumber: 'AMB-3391' } },
    },
  });

  await prisma.emergencyRequest.create({
    data: {
      patientId: patientUser.patientProfile!.id,
      lat: 6.5244,
      lng: 3.3792,
      notes: 'Severe chest pain, difficulty breathing.',
      status: 'REQUESTED',
    },
  });

  const nurseUser = await prisma.user.create({
    data: {
      email: 'nurse@demo.com',
      passwordHash: password,
      name: 'Nurse Blessing Eze',
      role: 'NURSE',
      nurseProfile: { create: { licenseNumber: 'NUR-2210', specialty: 'Home Care', specialtyId: generalNurseSpec?.id, hourlyRate: 5000 } },
    },
    include: { nurseProfile: true },
  });

  await prisma.nurseRequest.create({
    data: {
      patientId: patientUser.patientProfile!.id,
      serviceType: 'Post-surgery wound dressing',
      notes: 'Dressing needs changing daily for the next 5 days.',
      status: 'REQUESTED',
    },
  });
  await prisma.nurseRequest.create({
    data: {
      patientId: patientUser.patientProfile!.id,
      nurseId: nurseUser.nurseProfile!.id,
      serviceType: 'Blood pressure monitoring',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'REQUESTED',
    },
  });

  const superAdmin = await prisma.user.create({
    data: {
      email: 'superadmin@demo.com',
      passwordHash: password,
      name: 'N-Health Super Admin',
      role: 'ADMIN',
      isSuperAdmin: true,
    },
  });

  console.log('Seed complete. Demo login for every role: <role>@demo.com / password123');
  console.log('Pharmacy demo data: 1 supplier, 4 inventory items, 1 pending order awaiting payment confirmation.');
  console.log('Lab demo data: 1 pending test awaiting payment, 1 completed test with a result.');
  console.log('Ambulance demo data: 1 unclaimed emergency request waiting to be accepted.');
  console.log('Nurse demo data: 1 broadcast request, 1 request targeted directly at the demo nurse.');
  console.log('Medical Specializations: ' + (doctorSpecializations.length + nurseSpecializations.length) + ' total');
  console.log({
    patient: patientUser.email,
    doctor: doctorUser.email,
    pharmacy: pharmacyUser.email,
    lab: labUser.email,
    ambulance: ambulanceUser.email,
    nurse: nurseUser.email,
    superAdmin: superAdmin.email,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
