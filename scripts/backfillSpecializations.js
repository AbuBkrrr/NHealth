// scripts/backfillSpecializations.js
// Idempotent backfill script to populate Specialization rows from free-text
// specialty fields on DoctorProfile and NurseProfile and set specialtyId.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Normalize a specialty name for matching
function normalizeName(s) {
  return s ? s.trim() : s;
}

async function findOrCreateSpecialization(name, type) {
  const norm = normalizeName(name);
  if (!norm) return null;

  // Try case-insensitive match first
  let spec = await prisma.specialization.findFirst({ where: { name: { equals: norm, mode: 'insensitive' }, type } });
  if (!spec) {
    // If not found, create
    spec = await prisma.specialization.create({
      data: {
        name: norm,
        desc: norm,
        category: norm,
        type
      }
    });
    console.log(`Created specialization: ${spec.id} (${spec.name})`);
  }
  return spec;
}

async function backfillDoctors() {
  const doctors = await prisma.doctorProfile.findMany({ where: { specialty: { not: null } } });
  console.log(`Found ${doctors.length} doctor profiles with specialty string`);
  for (const d of doctors) {
    if (d.specialtyId) continue; // already backfilled
    const spec = await findOrCreateSpecialization(d.specialty, 'DOCTOR');
    if (spec) {
      await prisma.doctorProfile.update({ where: { id: d.id }, data: { specialtyId: spec.id } });
      console.log(`Doctor ${d.id}: set specialtyId -> ${spec.id}`);
    }
  }
}

async function backfillNurses() {
  const nurses = await prisma.nurseProfile.findMany({ where: { specialty: { not: null } } });
  console.log(`Found ${nurses.length} nurse profiles with specialty string`);
  for (const n of nurses) {
    if (n.specialtyId) continue;
    const spec = await findOrCreateSpecialization(n.specialty, 'NURSE');
    if (spec) {
      await prisma.nurseProfile.update({ where: { id: n.id }, data: { specialtyId: spec.id } });
      console.log(`Nurse ${n.id}: set specialtyId -> ${spec.id}`);
    }
  }
}

async function main() {
  console.log('Starting Specialization backfill (DRY-RUN disabled)...');
  try {
    await backfillDoctors();
    await backfillNurses();
    console.log('Backfill complete');
  } catch (err) {
    console.error('Fatal error during backfill:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
