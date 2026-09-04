import request from 'supertest';
import { createApp } from '../../backend/src/app';
import { prisma } from '../../backend/src/utils/prisma';

const app = createApp();

beforeAll(async () => {
  // Ensure test DB is clean for these tests. Use with a dedicated test DB.
  await prisma.user.deleteMany();
  await prisma.specialization.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Registration flows', () => {
  const base = '/api/auth';

  test('Patient signup succeeds', async () => {
    const res = await request(app)
      .post(`${base}/register`)
      .send({
        name: 'Test Patient',
        email: `patient.test+${Date.now()}@nhealth.test`,
        phone: '+2347000000001',
        password: 'PatientPass123A',
        role: 'PATIENT',
        profile: {
          dateOfBirth: '1990-01-01',
          bloodType: 'O+',
        },
      });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBeDefined();
    expect(res.body.token).toBeDefined();
  });

  test('Doctor signup with specialty string creates specialization and sets specialtyId', async () => {
    const email = `doctor.test+${Date.now()}@nhealth.test`;
    const res = await request(app)
      .post(`${base}/register`)
      .send({
        name: 'Dr Test',
        email,
        phone: `+2347000000${Math.floor(Math.random() * 9000) + 1000}`,
        password: 'DoctorPass123A',
        role: 'DOCTOR',
        specialty: 'Cardiology',
        profile: {
          licenseNumber: 'LIC-12345',
          hospital: 'Test Hospital',
        },
      });
    expect(res.status).toBe(201);

    const doctor = await prisma.user.findUnique({ where: { email } });
    expect(doctor).toBeTruthy();

    const docProfile = await prisma.doctorProfile.findFirst({ where: { userId: doctor!.id } });
    expect(docProfile).toBeTruthy();
    expect(docProfile!.specialtyId).toBeTruthy();

    const spec = await prisma.specialization.findUnique({ where: { id: docProfile!.specialtyId! } });
    expect(spec).toBeTruthy();
    expect(spec!.name.toLowerCase()).toContain('cardiology');
  });

  test('Duplicate phone is rejected', async () => {
    const phone = `+2347000000${Math.floor(Math.random() * 9000) + 2000}`;
    // First create user with phone
    const res1 = await request(app).post(`${base}/register`).send({
      name: 'User A',
      email: `user.a+${Date.now()}@nhealth.test`,
      phone,
      password: 'UserPass123A',
      role: 'PATIENT',
    });
    expect(res1.status).toBe(201);

    // Try to create another user with same phone
    const res2 = await request(app).post(`${base}/register`).send({
      name: 'User B',
      email: `user.b+${Date.now()}@nhealth.test`,
      phone,
      password: 'UserPass123A',
      role: 'PATIENT',
    });

    expect(res2.status).toBe(409);
    expect(res2.body.error.toLowerCase()).toContain('phone');
  });
});
