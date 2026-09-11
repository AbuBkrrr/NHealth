// ==================== PATIENT MODULE - COMPLETE PRODUCTION BUILD ====================

import { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// ==================== INTERFACES ====================

export interface PatientProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'M' | 'F' | 'Other';
  bloodType: string;
  medicalHistory: string;
  allergies: string[];
  currentMedications: Medication[];
  emergencyContacts: EmergencyContact[];
  insuranceProvider: string;
  insuranceNumber: string;
  nhisNumber: string;
  dependents: Dependent[];
  familyHistory: string;
  lifestyle: Lifestyle;
  vitals: Vitals;
  createdAt: Date;
  updatedAt: Date;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: Date;
  endDate: Date | null;
  reason: string;
  prescribedBy: string;
  refillsRemaining: number;
  lastRefillDate: Date | null;
  nextRefillDate: Date | null;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  address: string;
  isPrimary: boolean;
}

export interface Dependent {
  id: string;
  name: string;
  relationship: string;
  dateOfBirth: Date;
  gender: 'M' | 'F' | 'Other';
  bloodType: string;
  insurance: string;
}

export interface Lifestyle {
  smoking: boolean;
  alcohol: boolean;
  exercise: string;
  diet: string;
  stressLevel: number;
}

export interface Vitals {
  height: number;
  weight: number;
  bloodPressure: string;
  temperature: number;
  pulse: number;
  respiratoryRate: number;
  recordedAt: Date;
}

export interface HealthRecord {
  id: string;
  userId: string;
  type: 'lab_report' | 'prescription' | 'imaging' | 'vaccination' | 'allergy_test' | 'other';
  title: string;
  description: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedDate: Date;
  issuedDate: Date;
  provider: string;
  tags: string[];
  isArchived: boolean;
}

export interface MedicalAppointment {
  id: string;
  patientId: string;
  doctorId: string;
  dateTime: Date;
  duration: number;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';
  reason: string;
  notes: string;
  prepInstructions: string;
  reminderSent: boolean;
  reminderSentAt: Date | null;
  consultationType: 'in-person' | 'video' | 'phone' | 'chat';
  videoCallLink: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrescriptionRefillReminder {
  id: string;
  medicationId: string;
  patientId: string;
  reminderDate: Date;
  sent: boolean;
  sentAt: Date | null;
  type: 'email' | 'sms' | 'push';
}

// ==================== PATIENT SERVICE - PRODUCTION GRADE ====================

export class PatientService {
  private logger = {
    info: (msg: string) => console.log(`[PATIENT] ${msg}`),
    error: (msg: string, err?: any) => console.error(`[PATIENT] ${msg}`, err),
  };

  // ==================== PROFILE MANAGEMENT ====================

  async createProfile(userId: string, data: Partial<PatientProfile>): Promise<PatientProfile> {
    try {
      this.logger.info(`Creating profile for user ${userId}`);
      
      const profile = await prisma.patientProfile.create({
        data: {
          id: uuidv4(),
          userId,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          dateOfBirth: data.dateOfBirth || new Date().toISOString(),
          gender: data.gender || 'Other',
          bloodType: data.bloodType || '',
          medicalHistory: data.medicalHistory || '',
          allergies: data.allergies || [],
          currentMedications: data.currentMedications || [],
          emergencyContacts: data.emergencyContacts || [],
          insuranceProvider: data.insuranceProvider || '',
          insuranceNumber: data.insuranceNumber || '',
          nhisNumber: data.nhisNumber || '',
          dependents: data.dependents || [],
          familyHistory: data.familyHistory || '',
          lifestyle: data.lifestyle || { smoking: false, alcohol: false, exercise: 'none', diet: 'balanced', stressLevel: 5 },
          vitals: data.vitals || { height: 0, weight: 0, bloodPressure: '', temperature: 0, pulse: 0, respiratoryRate: 0, recordedAt: new Date() },
        },
      });

      this.logger.info(`✅ Patient profile created: ${profile.id}`);
      return profile as any;
    } catch (error) {
      this.logger.error('Failed to create patient profile', error);
      throw new Error(`Profile creation failed: ${error}`);
    }
  }

  async getProfile(userId: string): Promise<PatientProfile | null> {
    try {
      const profile = await prisma.patientProfile.findUnique({
        where: { userId },
      });
      return profile as any;
    } catch (error) {
      this.logger.error('Failed to fetch patient profile', error);
      throw error;
    }
  }

  async updateProfile(userId: string, data: Partial<PatientProfile>): Promise<PatientProfile> {
    try {
      this.logger.info(`Updating profile for user ${userId}`);
      const profile = await prisma.patientProfile.update({
        where: { userId },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });
      this.logger.info(`✅ Profile updated: ${userId}`);
      return profile as any;
    } catch (error) {
      this.logger.error('Failed to update profile', error);
      throw error;
    }
  }

  async deleteProfile(userId: string): Promise<void> {
    try {
      this.logger.info(`Deleting profile for user ${userId}`);
      await prisma.patientProfile.delete({
        where: { userId },
      });
      this.logger.info(`✅ Profile deleted: ${userId}`);
    } catch (error) {
      this.logger.error('Failed to delete profile', error);
      throw error;
    }
  }

  // ==================== MEDICAL HISTORY ====================

  async updateMedicalHistory(userId: string, history: string): Promise<void> {
    try {
      await prisma.patientProfile.update({
        where: { userId },
        data: { medicalHistory: history, updatedAt: new Date() },
      });
      this.logger.info(`✅ Medical history updated for ${userId}`);
    } catch (error) {
      this.logger.error('Failed to update medical history', error);
      throw error;
    }
  }

  // ==================== ALLERGIES ====================

  async addAllergy(userId: string, allergy: string): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) throw new Error('Profile not found');
      const allergies = [...(profile.allergies || []), allergy];
      await prisma.patientProfile.update({
        where: { userId },
        data: { allergies: [...new Set(allergies)], updatedAt: new Date() },
      });
      this.logger.info(`✅ Allergy added: ${allergy}`);
    } catch (error) {
      this.logger.error('Failed to add allergy', error);
      throw error;
    }
  }

  async removeAllergy(userId: string, allergy: string): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) throw new Error('Profile not found');
      const allergies = profile.allergies?.filter(a => a !== allergy) || [];
      await prisma.patientProfile.update({
        where: { userId },
        data: { allergies, updatedAt: new Date() },
      });
      this.logger.info(`✅ Allergy removed: ${allergy}`);
    } catch (error) {
      this.logger.error('Failed to remove allergy', error);
      throw error;
    }
  }

  async getAllergies(userId: string): Promise<string[]> {
    try {
      const profile = await this.getProfile(userId);
      return profile?.allergies || [];
    } catch (error) {
      this.logger.error('Failed to get allergies', error);
      throw error;
    }
  }

  // ==================== MEDICATIONS ====================

  async addMedication(userId: string, medication: Medication): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) throw new Error('Profile not found');
      const medications = [...(profile.currentMedications || []), medication];
      await prisma.patientProfile.update({
        where: { userId },
        data: { currentMedications: medications, updatedAt: new Date() },
      });
      this.logger.info(`✅ Medication added: ${medication.name}`);

      // Create refill reminder
      if (medication.nextRefillDate) {
        await this.createRefillReminder(userId, medication.id, medication.nextRefillDate);
      }
    } catch (error) {
      this.logger.error('Failed to add medication', error);
      throw error;
    }
  }

  async updateMedication(userId: string, medicationId: string, updates: Partial<Medication>): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) throw new Error('Profile not found');
      const medications = profile.currentMedications?.map(m => 
        m.id === medicationId ? { ...m, ...updates } : m
      ) || [];
      await prisma.patientProfile.update({
        where: { userId },
        data: { currentMedications: medications, updatedAt: new Date() },
      });
      this.logger.info(`✅ Medication updated: ${medicationId}`);
    } catch (error) {
      this.logger.error('Failed to update medication', error);
      throw error;
    }
  }

  async removeMedication(userId: string, medicationId: string): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) throw new Error('Profile not found');
      const medications = profile.currentMedications?.filter(m => m.id !== medicationId) || [];
      await prisma.patientProfile.update({
        where: { userId },
        data: { currentMedications: medications, updatedAt: new Date() },
      });
      this.logger.info(`✅ Medication removed: ${medicationId}`);
    } catch (error) {
      this.logger.error('Failed to remove medication', error);
      throw error;
    }
  }

  async getMedications(userId: string): Promise<Medication[]> {
    try {
      const profile = await this.getProfile(userId);
      return profile?.currentMedications || [];
    } catch (error) {
      this.logger.error('Failed to get medications', error);
      throw error;
    }
  }

  async checkDrugInteractions(medications: Medication[]): Promise<{ hasPotentialInteraction: boolean; interactions: string[] }> {
    try {
      // TODO: Integrate with external drug interaction API (FDA, RxNorm, etc.)
      const interactions: string[] = [];
      
      // Basic local check for common interactions
      const highRiskCombos = [
        { drugs: ['warfarin', 'aspirin'], risk: 'Increased bleeding risk' },
        { drugs: ['metformin', 'contrast dye'], risk: 'Acute kidney injury' },
        { drugs: ['simvastatin', 'clarithromycin'], risk: 'Statin toxicity' },
      ];

      for (const combo of highRiskCombos) {
        const medicationNames = medications.map(m => m.name.toLowerCase());
        if (combo.drugs.every(drug => medicationNames.some(m => m.includes(drug)))) {
          interactions.push(combo.risk);
        }
      }

      return {
        hasPotentialInteraction: interactions.length > 0,
        interactions,
      };
    } catch (error) {
      this.logger.error('Failed to check drug interactions', error);
      throw error;
    }
  }

  // ==================== EMERGENCY CONTACTS ====================

  async addEmergencyContact(userId: string, contact: EmergencyContact): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) throw new Error('Profile not found');
      
      // If this is primary, make others non-primary
      let contacts = [...(profile.emergencyContacts || [])];
      if (contact.isPrimary) {
        contacts = contacts.map(c => ({ ...c, isPrimary: false }));
      }
      contacts.push({ ...contact, id: uuidv4() });

      await prisma.patientProfile.update({
        where: { userId },
        data: { emergencyContacts: contacts, updatedAt: new Date() },
      });
      this.logger.info(`✅ Emergency contact added: ${contact.name}`);
    } catch (error) {
      this.logger.error('Failed to add emergency contact', error);
      throw error;
    }
  }

  async updateEmergencyContact(userId: string, contactId: string, updates: Partial<EmergencyContact>): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) throw new Error('Profile not found');
      let contacts = profile.emergencyContacts?.map(c => 
        c.id === contactId ? { ...c, ...updates } : c
      ) || [];
      
      if (updates.isPrimary) {
        contacts = contacts.map(c => ({ ...c, isPrimary: c.id === contactId }));
      }

      await prisma.patientProfile.update({
        where: { userId },
        data: { emergencyContacts: contacts, updatedAt: new Date() },
      });
      this.logger.info(`✅ Emergency contact updated: ${contactId}`);
    } catch (error) {
      this.logger.error('Failed to update emergency contact', error);
      throw error;
    }
  }

  async removeEmergencyContact(userId: string, contactId: string): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) throw new Error('Profile not found');
      const contacts = profile.emergencyContacts?.filter(c => c.id !== contactId) || [];
      await prisma.patientProfile.update({
        where: { userId },
        data: { emergencyContacts: contacts, updatedAt: new Date() },
      });
      this.logger.info(`✅ Emergency contact removed: ${contactId}`);
    } catch (error) {
      this.logger.error('Failed to remove emergency contact', error);
      throw error;
    }
  }

  async getPrimaryEmergencyContact(userId: string): Promise<EmergencyContact | null> {
    try {
      const profile = await this.getProfile(userId);
      return profile?.emergencyContacts?.find(c => c.isPrimary) || null;
    } catch (error) {
      this.logger.error('Failed to get primary emergency contact', error);
      throw error;
    }
  }

  // ==================== DEPENDENTS ====================

  async addDependent(userId: string, dependent: Dependent): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) throw new Error('Profile not found');
      const dependents = [...(profile.dependents || []), { ...dependent, id: uuidv4() }];
      await prisma.patientProfile.update({
        where: { userId },
        data: { dependents, updatedAt: new Date() },
      });
      this.logger.info(`✅ Dependent added: ${dependent.name}`);
    } catch (error) {
      this.logger.error('Failed to add dependent', error);
      throw error;
    }
  }

  async updateDependent(userId: string, dependentId: string, updates: Partial<Dependent>): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) throw new Error('Profile not found');
      const dependents = profile.dependents?.map(d => 
        d.id === dependentId ? { ...d, ...updates } : d
      ) || [];
      await prisma.patientProfile.update({
        where: { userId },
        data: { dependents, updatedAt: new Date() },
      });
      this.logger.info(`✅ Dependent updated: ${dependentId}`);
    } catch (error) {
      this.logger.error('Failed to update dependent', error);
      throw error;
    }
  }

  async removeDependent(userId: string, dependentId: string): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) throw new Error('Profile not found');
      const dependents = profile.dependents?.filter(d => d.id !== dependentId) || [];
      await prisma.patientProfile.update({
        where: { userId },
        data: { dependents, updatedAt: new Date() },
      });
      this.logger.info(`✅ Dependent removed: ${dependentId}`);
    } catch (error) {
      this.logger.error('Failed to remove dependent', error);
      throw error;
    }
  }

  async getDependents(userId: string): Promise<Dependent[]> {
    try {
      const profile = await this.getProfile(userId);
      return profile?.dependents || [];
    } catch (error) {
      this.logger.error('Failed to get dependents', error);
      throw error;
    }
  }

  // ==================== INSURANCE ====================

  async linkInsurance(userId: string, provider: string, insuranceNumber: string, nhisNumber?: string): Promise<void> {
    try {
      await prisma.patientProfile.update({
        where: { userId },
        data: {
          insuranceProvider: provider,
          insuranceNumber,
          nhisNumber: nhisNumber || '',
          updatedAt: new Date(),
        },
      });
      this.logger.info(`✅ Insurance linked for ${userId}`);
    } catch (error) {
      this.logger.error('Failed to link insurance', error);
      throw error;
    }
  }

  async getInsuranceInfo(userId: string): Promise<{ provider: string; insuranceNumber: string; nhisNumber: string } | null> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) return null;
      return {
        provider: profile.insuranceProvider,
        insuranceNumber: profile.insuranceNumber,
        nhisNumber: profile.nhisNumber,
      };
    } catch (error) {
      this.logger.error('Failed to get insurance info', error);
      throw error;
    }
  }

  // ==================== HEALTH RECORDS ====================

  async uploadHealthRecord(userId: string, record: HealthRecord): Promise<HealthRecord> {
    try {
      this.logger.info(`Uploading health record for ${userId}: ${record.title}`);
      const created = await prisma.healthRecord.create({
        data: {
          id: uuidv4(),
          userId,
          type: record.type,
          title: record.title,
          description: record.description,
          fileUrl: record.fileUrl,
          fileName: record.fileName,
          fileSize: record.fileSize,
          mimeType: record.mimeType,
          uploadedDate: new Date(),
          issuedDate: record.issuedDate,
          provider: record.provider,
          tags: record.tags,
          isArchived: false,
        },
      });
      this.logger.info(`✅ Health record uploaded: ${created.id}`);
      return created as any;
    } catch (error) {
      this.logger.error('Failed to upload health record', error);
      throw error;
    }
  }

  async getHealthRecords(userId: string, type?: string): Promise<HealthRecord[]> {
    try {
      const records = await prisma.healthRecord.findMany({
        where: {
          userId,
          isArchived: false,
          ...(type && { type: type as any }),
        },
        orderBy: { uploadedDate: 'desc' },
      });
      return records as any[];
    } catch (error) {
      this.logger.error('Failed to get health records', error);
      throw error;
    }
  }

  async deleteHealthRecord(userId: string, recordId: string): Promise<void> {
    try {
      await prisma.healthRecord.update({
        where: { id: recordId },
        data: { isArchived: true },
      });
      this.logger.info(`✅ Health record archived: ${recordId}`);
    } catch (error) {
      this.logger.error('Failed to delete health record', error);
      throw error;
    }
  }

  // ==================== VITALS TRACKING ====================

  async recordVitals(userId: string, vitals: Vitals): Promise<void> {
    try {
      await prisma.patientProfile.update({
        where: { userId },
        data: {
          vitals: { ...vitals, recordedAt: new Date() },
          updatedAt: new Date(),
        },
      });
      this.logger.info(`✅ Vitals recorded for ${userId}`);
    } catch (error) {
      this.logger.error('Failed to record vitals', error);
      throw error;
    }
  }

  async getVitalsHistory(userId: string, limit = 10): Promise<any[]> {
    try {
      // TODO: Create separate Vitals history table for trending
      const profile = await this.getProfile(userId);
      return profile?.vitals ? [profile.vitals] : [];
    } catch (error) {
      this.logger.error('Failed to get vitals history', error);
      throw error;
    }
  }

  async getVitalsTrends(userId: string): Promise<{ weight: number[]; bloodPressure: string[]; pulse: number[] }> {
    try {
      const history = await this.getVitalsHistory(userId, 30);
      return {
        weight: history.map(v => v.weight),
        bloodPressure: history.map(v => v.bloodPressure),
        pulse: history.map(v => v.pulse),
      };
    } catch (error) {
      this.logger.error('Failed to get vitals trends', error);
      throw error;
    }
  }

  // ==================== APPOINTMENTS ====================

  async bookAppointment(appointment: MedicalAppointment): Promise<MedicalAppointment> {
    try {
      this.logger.info(`Booking appointment for patient ${appointment.patientId}`);
      const created = await prisma.medicalAppointment.create({
        data: {
          id: uuidv4(),
          ...appointment,
          status: 'scheduled',
          reminderSent: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      this.logger.info(`✅ Appointment booked: ${created.id}`);
      return created as any;
    } catch (error) {
      this.logger.error('Failed to book appointment', error);
      throw error;
    }
  }

  async getAppointments(userId: string, status?: string): Promise<MedicalAppointment[]> {
    try {
      const appointments = await prisma.medicalAppointment.findMany({
        where: {
          patientId: userId,
          ...(status && { status: status as any }),
        },
        orderBy: { dateTime: 'asc' },
      });
      return appointments as any[];
    } catch (error) {
      this.logger.error('Failed to get appointments', error);
      throw error;
    }
  }

  async rescheduleAppointment(appointmentId: string, newDateTime: Date): Promise<void> {
    try {
      await prisma.medicalAppointment.update({
        where: { id: appointmentId },
        data: {
          dateTime: newDateTime,
          status: 'rescheduled',
          updatedAt: new Date(),
        },
      });
      this.logger.info(`✅ Appointment rescheduled: ${appointmentId}`);
    } catch (error) {
      this.logger.error('Failed to reschedule appointment', error);
      throw error;
    }
  }

  async cancelAppointment(appointmentId: string, reason?: string): Promise<void> {
    try {
      await prisma.medicalAppointment.update({
        where: { id: appointmentId },
        data: {
          status: 'cancelled',
          notes: reason || '',
          updatedAt: new Date(),
        },
      });
      this.logger.info(`✅ Appointment cancelled: ${appointmentId}`);
    } catch (error) {
      this.logger.error('Failed to cancel appointment', error);
      throw error;
    }
  }

  async getUpcomingAppointments(userId: string): Promise<MedicalAppointment[]> {
    try {
      const now = new Date();
      const appointments = await prisma.medicalAppointment.findMany({
        where: {
          patientId: userId,
          dateTime: { gte: now },
          status: { in: ['scheduled', 'confirmed'] },
        },
        orderBy: { dateTime: 'asc' },
      });
      return appointments as any[];
    } catch (error) {
      this.logger.error('Failed to get upcoming appointments', error);
      throw error;
    }
  }

  // ==================== REFILL REMINDERS ====================

  async createRefillReminder(userId: string, medicationId: string, reminderDate: Date): Promise<void> {
    try {
      await prisma.prescriptionRefillReminder.create({
        data: {
          id: uuidv4(),
          patientId: userId,
          medicationId,
          reminderDate,
          sent: false,
          type: 'email',
        },
      });
      this.logger.info(`✅ Refill reminder created for ${medicationId}`);
    } catch (error) {
      this.logger.error('Failed to create refill reminder', error);
      throw error;
    }
  }

  async getPendingRefillReminders(userId: string): Promise<PrescriptionRefillReminder[]> {
    try {
      const reminders = await prisma.prescriptionRefillReminder.findMany({
        where: {
          patientId: userId,
          sent: false,
          reminderDate: { lte: new Date() },
        },
        orderBy: { reminderDate: 'asc' },
      });
      return reminders as any[];
    } catch (error) {
      this.logger.error('Failed to get pending reminders', error);
      throw error;
    }
  }

  async markReminderSent(reminderId: string): Promise<void> {
    try {
      await prisma.prescriptionRefillReminder.update({
        where: { id: reminderId },
        data: { sent: true, sentAt: new Date() },
      });
    } catch (error) {
      this.logger.error('Failed to mark reminder sent', error);
      throw error;
    }
  }

  // ==================== PROVIDER FAVORITES ====================

  async addProviderFavorite(userId: string, providerId: string): Promise<void> {
    try {
      await prisma.patientFavoriteProvider.create({
        data: {
          id: uuidv4(),
          patientId: userId,
          providerId,
        },
      });
      this.logger.info(`✅ Provider added to favorites`);
    } catch (error) {
      this.logger.error('Failed to add provider favorite', error);
      throw error;
    }
  }

  async removeProviderFavorite(userId: string, providerId: string): Promise<void> {
    try {
      await prisma.patientFavoriteProvider.deleteMany({
        where: { patientId: userId, providerId },
      });
      this.logger.info(`✅ Provider removed from favorites`);
    } catch (error) {
      this.logger.error('Failed to remove provider favorite', error);
      throw error;
    }
  }

  async getFavoriteProviders(userId: string): Promise<string[]> {
    try {
      const favorites = await prisma.patientFavoriteProvider.findMany({
        where: { patientId: userId },
      });
      return favorites.map(f => f.providerId);
    } catch (error) {
      this.logger.error('Failed to get favorite providers', error);
      throw error;
    }
  }

  // ==================== CONSENT & DATA SHARING ====================

  async grantDataSharingConsent(userId: string, providerId: string, dataTypes: string[]): Promise<void> {
    try {
      await prisma.patientDataSharingConsent.create({
        data: {
          id: uuidv4(),
          patientId: userId,
          providerId,
          dataTypes,
          grantedAt: new Date(),
          revokedAt: null,
        },
      });
      this.logger.info(`✅ Data sharing consent granted`);
    } catch (error) {
      this.logger.error('Failed to grant consent', error);
      throw error;
    }
  }

  async revokeDataSharingConsent(userId: string, consentId: string): Promise<void> {
    try {
      await prisma.patientDataSharingConsent.update({
        where: { id: consentId },
        data: { revokedAt: new Date() },
      });
      this.logger.info(`✅ Data sharing consent revoked`);
    } catch (error) {
      this.logger.error('Failed to revoke consent', error);
      throw error;
    }
  }

  async getDataSharingConsents(userId: string): Promise<any[]> {
    try {
      const consents = await prisma.patientDataSharingConsent.findMany({
        where: { patientId: userId, revokedAt: null },
      });
      return consents;
    } catch (error) {
      this.logger.error('Failed to get consents', error);
      throw error;
    }
  }
}

export default new PatientService();
