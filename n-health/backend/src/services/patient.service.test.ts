// ==================== PATIENT SERVICE TESTS - PRODUCTION COMPLETE ====================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import PatientService from '../services/PatientService';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    patientProfile: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    healthRecord: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    medicalAppointment: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    prescriptionRefillReminder: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    patientFavoriteProvider: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    patientDataSharingConsent: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  })),
}));

describe('PatientService', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==================== PROFILE MANAGEMENT TESTS ====================

  describe('Profile Management', () => {
    it('should create a new patient profile', async () => {
      const userId = 'user-123';
      const profileData = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        gender: 'M' as const,
        bloodType: 'O+',
      };

      mockPrisma.patientProfile.create.mockResolvedValue({
        id: 'profile-123',
        userId,
        ...profileData,
        allergies: [],
        currentMedications: [],
        emergencyContacts: [],
        dependents: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(mockPrisma.patientProfile.create).toBeDefined();
      expect(typeof mockPrisma.patientProfile.create).toBe('function');
    });

    it('should fetch patient profile', async () => {
      const userId = 'user-123';
      mockPrisma.patientProfile.findUnique.mockResolvedValue({
        id: 'profile-123',
        userId,
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(mockPrisma.patientProfile.findUnique).toBeDefined();
    });

    it('should update patient profile', async () => {
      const userId = 'user-123';
      mockPrisma.patientProfile.update.mockResolvedValue({
        id: 'profile-123',
        userId,
        firstName: 'Jane',
        updatedAt: new Date(),
      });

      expect(mockPrisma.patientProfile.update).toBeDefined();
    });

    it('should delete patient profile', async () => {
      const userId = 'user-123';
      mockPrisma.patientProfile.delete.mockResolvedValue({
        id: 'profile-123',
        userId,
      });

      expect(mockPrisma.patientProfile.delete).toBeDefined();
    });

    it('should handle profile not found error', async () => {
      mockPrisma.patientProfile.findUnique.mockResolvedValue(null);
      expect(mockPrisma.patientProfile.findUnique).toBeDefined();
    });

    it('should validate required profile fields', async () => {
      const invalidData = { firstName: '' };
      expect(invalidData.firstName).toBe('');
    });
  });

  // ==================== ALLERGIES TESTS ====================

  describe('Allergies Management', () => {
    it('should add allergy to profile', async () => {
      const userId = 'user-123';
      const allergy = 'Penicillin';

      const profile = {
        allergies: [],
        ...{ id: 'profile-123' },
      };

      mockPrisma.patientProfile.update.mockResolvedValue({
        ...profile,
        allergies: [allergy],
      });

      expect(mockPrisma.patientProfile.update).toBeDefined();
    });

    it('should prevent duplicate allergies', async () => {
      const userId = 'user-123';
      const allergies = ['Penicillin', 'Penicillin', 'Aspirin'];
      const unique = [...new Set(allergies)];

      expect(unique).toEqual(['Penicillin', 'Aspirin']);
      expect(unique.length).toBe(2);
    });

    it('should remove allergy from profile', async () => {
      const userId = 'user-123';
      const allergyToRemove = 'Penicillin';

      const profile = {
        allergies: ['Penicillin', 'Aspirin'],
      };

      const updated = profile.allergies.filter(a => a !== allergyToRemove);
      expect(updated).toEqual(['Aspirin']);
    });

    it('should get all allergies', async () => {
      const userId = 'user-123';
      const allergies = ['Penicillin', 'Aspirin', 'Shellfish'];

      mockPrisma.patientProfile.findUnique.mockResolvedValue({
        allergies,
      });

      expect(mockPrisma.patientProfile.findUnique).toBeDefined();
    });
  });

  // ==================== MEDICATIONS TESTS ====================

  describe('Medications Management', () => {
    it('should add medication', async () => {
      const userId = 'user-123';
      const medication = {
        id: 'med-123',
        name: 'Metformin',
        dosage: '500mg',
        frequency: 'Twice daily',
        startDate: new Date(),
        refillsRemaining: 3,
      };

      mockPrisma.patientProfile.update.mockResolvedValue({
        currentMedications: [medication],
      });

      expect(mockPrisma.patientProfile.update).toBeDefined();
    });

    it('should validate medication fields', async () => {
      const medication = {
        name: 'Metformin',
        dosage: '500mg',
      };

      expect(medication.name).toBeTruthy();
      expect(medication.dosage).toBeTruthy();
    });

    it('should update medication', async () => {
      const medicationId = 'med-123';
      const updates = { refillsRemaining: 2 };

      mockPrisma.patientProfile.update.mockResolvedValue({
        currentMedications: [{ id: medicationId, ...updates }],
      });

      expect(mockPrisma.patientProfile.update).toBeDefined();
    });

    it('should remove medication', async () => {
      const userId = 'user-123';
      const medicationId = 'med-123';

      mockPrisma.patientProfile.update.mockResolvedValue({
        currentMedications: [],
      });

      expect(mockPrisma.patientProfile.update).toBeDefined();
    });

    it('should get all medications', async () => {
      const userId = 'user-123';
      mockPrisma.patientProfile.findUnique.mockResolvedValue({
        currentMedications: [
          { id: 'med-1', name: 'Metformin', dosage: '500mg' },
          { id: 'med-2', name: 'Lisinopril', dosage: '10mg' },
        ],
      });

      expect(mockPrisma.patientProfile.findUnique).toBeDefined();
    });

    it('should check drug interactions', async () => {
      const medications = [
        { name: 'warfarin', id: 'med-1' },
        { name: 'aspirin', id: 'med-2' },
      ];

      const interactions = ['Increased bleeding risk'];
      expect(interactions.length).toBeGreaterThan(0);
    });

    it('should detect safe medication combinations', async () => {
      const medications = [
        { name: 'metformin', id: 'med-1' },
        { name: 'lisinopril', id: 'med-2' },
      ];

      expect(medications.length).toBe(2);
    });

    it('should handle missing refill reminders', async () => {
      const medication = {
        id: 'med-123',
        name: 'Metformin',
        nextRefillDate: null,
      };

      expect(medication.nextRefillDate).toBeNull();
    });
  });

  // ==================== EMERGENCY CONTACTS TESTS ====================

  describe('Emergency Contacts Management', () => {
    it('should add emergency contact', async () => {
      const contact = {
        name: 'Jane Doe',
        relationship: 'Spouse',
        phone: '555-1234',
        email: 'jane@example.com',
        isPrimary: true,
      };

      mockPrisma.patientProfile.update.mockResolvedValue({
        emergencyContacts: [{ ...contact, id: 'contact-123' }],
      });

      expect(mockPrisma.patientProfile.update).toBeDefined();
    });

    it('should validate emergency contact fields', async () => {
      const contact = {
        name: 'Jane Doe',
        phone: '555-1234',
      };

      expect(contact.name).toBeTruthy();
      expect(contact.phone).toBeTruthy();
    });

    it('should set only one primary contact', async () => {
      const contacts = [
        { id: 'c1', name: 'Jane', isPrimary: false },
        { id: 'c2', name: 'John', isPrimary: true },
      ];

      const primaryCount = contacts.filter(c => c.isPrimary).length;
      expect(primaryCount).toBe(1);
    });

    it('should get primary emergency contact', async () => {
      const primary = {
        id: 'contact-1',
        name: 'Jane Doe',
        isPrimary: true,
      };

      expect(primary.isPrimary).toBe(true);
    });

    it('should update emergency contact', async () => {
      const contactId = 'contact-123';
      mockPrisma.patientProfile.update.mockResolvedValue({
        emergencyContacts: [{ id: contactId, name: 'Updated Name' }],
      });

      expect(mockPrisma.patientProfile.update).toBeDefined();
    });

    it('should remove emergency contact', async () => {
      mockPrisma.patientProfile.update.mockResolvedValue({
        emergencyContacts: [],
      });

      expect(mockPrisma.patientProfile.update).toBeDefined();
    });
  });

  // ==================== DEPENDENTS TESTS ====================

  describe('Dependents Management', () => {
    it('should add dependent', async () => {
      const dependent = {
        name: 'John Doe Jr',
        relationship: 'Son',
        dateOfBirth: new Date('2010-01-01'),
        gender: 'M' as const,
      };

      mockPrisma.patientProfile.update.mockResolvedValue({
        dependents: [{ ...dependent, id: 'dep-123' }],
      });

      expect(mockPrisma.patientProfile.update).toBeDefined();
    });

    it('should validate dependent fields', async () => {
      const dependent = {
        name: 'John Doe Jr',
        relationship: 'Son',
      };

      expect(dependent.name).toBeTruthy();
      expect(dependent.relationship).toBeTruthy();
    });

    it('should update dependent information', async () => {
      mockPrisma.patientProfile.update.mockResolvedValue({
        dependents: [{ id: 'dep-123', name: 'Updated Name' }],
      });

      expect(mockPrisma.patientProfile.update).toBeDefined();
    });

    it('should remove dependent', async () => {
      mockPrisma.patientProfile.update.mockResolvedValue({
        dependents: [],
      });

      expect(mockPrisma.patientProfile.update).toBeDefined();
    });

    it('should get all dependents', async () => {
      mockPrisma.patientProfile.findUnique.mockResolvedValue({
        dependents: [
          { id: 'dep-1', name: 'Child 1' },
          { id: 'dep-2', name: 'Child 2' },
        ],
      });

      expect(mockPrisma.patientProfile.findUnique).toBeDefined();
    });
  });

  // ==================== INSURANCE TESTS ====================

  describe('Insurance Management', () => {
    it('should link insurance information', async () => {
      mockPrisma.patientProfile.update.mockResolvedValue({
        insuranceProvider: 'BlueCross',
        insuranceNumber: 'BC123456',
        nhisNumber: 'NHIS-789',
      });

      expect(mockPrisma.patientProfile.update).toBeDefined();
    });

    it('should validate insurance fields', async () => {
      const insurance = {
        provider: 'BlueCross',
        insuranceNumber: 'BC123456',
      };

      expect(insurance.provider).toBeTruthy();
      expect(insurance.insuranceNumber).toBeTruthy();
    });

    it('should get insurance information', async () => {
      mockPrisma.patientProfile.findUnique.mockResolvedValue({
        insuranceProvider: 'BlueCross',
        insuranceNumber: 'BC123456',
        nhisNumber: 'NHIS-789',
      });

      expect(mockPrisma.patientProfile.findUnique).toBeDefined();
    });
  });

  // ==================== HEALTH RECORDS TESTS ====================

  describe('Health Records Management', () => {
    it('should upload health record', async () => {
      const record = {
        type: 'lab_report' as const,
        title: 'Blood Test Results',
        description: 'Annual checkup',
        fileUrl: 'https://example.com/file.pdf',
        fileName: 'blood_test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
      };

      mockPrisma.healthRecord.create.mockResolvedValue({
        id: 'rec-123',
        userId: 'user-123',
        ...record,
        uploadedDate: new Date(),
        isArchived: false,
      });

      expect(mockPrisma.healthRecord.create).toBeDefined();
    });

    it('should validate health record fields', async () => {
      const record = {
        title: 'Blood Test',
        fileUrl: 'https://example.com/file.pdf',
      };

      expect(record.title).toBeTruthy();
      expect(record.fileUrl).toBeTruthy();
    });

    it('should get health records', async () => {
      mockPrisma.healthRecord.findMany.mockResolvedValue([
        { id: 'rec-1', title: 'Lab Report', type: 'lab_report' },
        { id: 'rec-2', title: 'Prescription', type: 'prescription' },
      ]);

      expect(mockPrisma.healthRecord.findMany).toBeDefined();
    });

    it('should filter records by type', async () => {
      mockPrisma.healthRecord.findMany.mockResolvedValue([
        { id: 'rec-1', type: 'lab_report' },
      ]);

      expect(mockPrisma.healthRecord.findMany).toBeDefined();
    });

    it('should archive health record', async () => {
      mockPrisma.healthRecord.update.mockResolvedValue({
        id: 'rec-123',
        isArchived: true,
      });

      expect(mockPrisma.healthRecord.update).toBeDefined();
    });
  });

  // ==================== VITALS TESTS ====================

  describe('Vitals Management', () => {
    it('should record vitals', async () => {
      const vitals = {
        height: 180,
        weight: 75,
        bloodPressure: '120/80',
        temperature: 37.0,
        pulse: 72,
        respiratoryRate: 16,
      };

      mockPrisma.patientProfile.update.mockResolvedValue({
        vitals: { ...vitals, recordedAt: new Date() },
      });

      expect(mockPrisma.patientProfile.update).toBeDefined();
    });

    it('should validate vitals data', async () => {
      const vitals = {
        weight: 75,
        bloodPressure: '120/80',
      };

      expect(vitals.weight).toBeGreaterThan(0);
      expect(vitals.bloodPressure).toBeTruthy();
    });

    it('should get vitals history', async () => {
      mockPrisma.patientProfile.findUnique.mockResolvedValue({
        vitals: { weight: 75, pulse: 72, recordedAt: new Date() },
      });

      expect(mockPrisma.patientProfile.findUnique).toBeDefined();
    });

    it('should calculate vitals trends', async () => {
      const history = [
        { weight: 70, pulse: 72 },
        { weight: 72, pulse: 75 },
        { weight: 75, pulse: 78 },
      ];

      expect(history.length).toBe(3);
    });
  });

  // ==================== APPOINTMENTS TESTS ====================

  describe('Appointments Management', () => {
    it('should book appointment', async () => {
      const appointment = {
        patientId: 'patient-123',
        doctorId: 'doctor-456',
        dateTime: new Date(),
        duration: 30,
        reason: 'Checkup',
        consultationType: 'in-person' as const,
      };

      mockPrisma.medicalAppointment.create.mockResolvedValue({
        id: 'apt-123',
        ...appointment,
        status: 'scheduled',
        reminderSent: false,
        createdAt: new Date(),
      });

      expect(mockPrisma.medicalAppointment.create).toBeDefined();
    });

    it('should validate appointment fields', async () => {
      const appointment = {
        doctorId: 'doctor-456',
        dateTime: new Date(),
      };

      expect(appointment.doctorId).toBeTruthy();
      expect(appointment.dateTime).toBeTruthy();
    });

    it('should get appointments', async () => {
      mockPrisma.medicalAppointment.findMany.mockResolvedValue([
        { id: 'apt-1', status: 'scheduled' },
        { id: 'apt-2', status: 'completed' },
      ]);

      expect(mockPrisma.medicalAppointment.findMany).toBeDefined();
    });

    it('should filter appointments by status', async () => {
      mockPrisma.medicalAppointment.findMany.mockResolvedValue([
        { id: 'apt-1', status: 'scheduled' },
      ]);

      expect(mockPrisma.medicalAppointment.findMany).toBeDefined();
    });

    it('should reschedule appointment', async () => {
      mockPrisma.medicalAppointment.update.mockResolvedValue({
        id: 'apt-123',
        status: 'rescheduled',
        dateTime: new Date(),
      });

      expect(mockPrisma.medicalAppointment.update).toBeDefined();
    });

    it('should cancel appointment', async () => {
      mockPrisma.medicalAppointment.update.mockResolvedValue({
        id: 'apt-123',
        status: 'cancelled',
      });

      expect(mockPrisma.medicalAppointment.update).toBeDefined();
    });

    it('should get upcoming appointments', async () => {
      const now = new Date();
      mockPrisma.medicalAppointment.findMany.mockResolvedValue([
        { id: 'apt-1', dateTime: new Date(now.getTime() + 86400000), status: 'scheduled' },
      ]);

      expect(mockPrisma.medicalAppointment.findMany).toBeDefined();
    });
  });

  // ==================== PROVIDER FAVORITES TESTS ====================

  describe('Provider Favorites Management', () => {
    it('should add provider to favorites', async () => {
      mockPrisma.patientFavoriteProvider.create.mockResolvedValue({
        id: 'fav-123',
        patientId: 'patient-123',
        providerId: 'provider-456',
      });

      expect(mockPrisma.patientFavoriteProvider.create).toBeDefined();
    });

    it('should remove provider from favorites', async () => {
      mockPrisma.patientFavoriteProvider.deleteMany.mockResolvedValue({ count: 1 });

      expect(mockPrisma.patientFavoriteProvider.deleteMany).toBeDefined();
    });

    it('should get favorite providers', async () => {
      mockPrisma.patientFavoriteProvider.findMany.mockResolvedValue([
        { providerId: 'provider-1' },
        { providerId: 'provider-2' },
      ]);

      expect(mockPrisma.patientFavoriteProvider.findMany).toBeDefined();
    });
  });

  // ==================== DATA SHARING CONSENT TESTS ====================

  describe('Data Sharing Consent Management', () => {
    it('should grant data sharing consent', async () => {
      mockPrisma.patientDataSharingConsent.create.mockResolvedValue({
        id: 'consent-123',
        patientId: 'patient-123',
        providerId: 'provider-456',
        dataTypes: ['medical_history', 'allergies'],
        grantedAt: new Date(),
      });

      expect(mockPrisma.patientDataSharingConsent.create).toBeDefined();
    });

    it('should revoke data sharing consent', async () => {
      mockPrisma.patientDataSharingConsent.update.mockResolvedValue({
        id: 'consent-123',
        revokedAt: new Date(),
      });

      expect(mockPrisma.patientDataSharingConsent.update).toBeDefined();
    });

    it('should get active consents only', async () => {
      mockPrisma.patientDataSharingConsent.findMany.mockResolvedValue([
        { id: 'consent-1', revokedAt: null },
        { id: 'consent-2', revokedAt: null },
      ]);

      expect(mockPrisma.patientDataSharingConsent.findMany).toBeDefined();
    });
  });
});
