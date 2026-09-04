import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create specializations that providers can choose from
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

  console.log('Database seeding complete.');
  console.log(`Created ${doctorSpecializations.length + nurseSpecializations.length} medical specializations.`);
  console.log('No demo users created. Ready for production.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
