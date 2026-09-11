import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ==================== PATIENT SERVICE ====================

export interface PatientProfile {
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: 'M' | 'F' | 'Other';
  bloodType?: string;
  medicalHistory?: string;
  allergies: string[];
  currentMedications: Medication[];
  emergencyContacts: EmergencyContact[];
  insuranceProvider?: string;
  insuranceNumber?: string;
  nhisNumber?: string;
  dependents: Dependent[];
  familyHistory?: string;
  lifestyle?: {
    smoking: boolean;
    alcohol: boolean;
    exercise: string;
  };
  vitals?: {
    height?: number;
    weight?: number;
    bloodPressure?: string;
    temperature?: number;
    pulse?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: Date;
  endDate?: Date;
  reason: string;
  prescribedBy?: string;
  refillsRemaining?: number;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  address?: string;
  isPrimary: boolean;
}

export interface Dependent {
  id: string;
  name: string;
  relationship: string;
  dateOfBirth: Date;
  gender: 'M' | 'F' | 'Other';
  bloodType?: string;
  insurance?: string;
}

export interface HealthRecord {
  id: string;
  userId: string;
  type: 'lab_report' | 'prescription' | 'imaging' | 'other';
  title: string;
  description?: string;
  fileUrl: string;
  fileName: string;
  uploadedDate: Date;
  issuedDate?: Date;
  provider?: string;
  tags: string[];
}

export interface MedicalAppointment {
  id: string;
  patientId: string;
  doctorId: string;
  dateTime: Date;
  duration: number; // minutes
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  reason: string;
  notes?: string;
  prepInstructions?: string;
  reminderSent: boolean;
}

export class PatientService {
  // ==================== PROFILE MANAGEMENT ====================

  async createProfile(userId: string, data: Partial<PatientProfile>): Promise<PatientProfile> {
    try {
      const profile = await prisma.patientProfile.create({
        data: {
          userId,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          medicalHistory: data.medicalHistory,
          allergies: data.allergies || [],
          currentMedications: data.currentMedications || [],
          emergencyContacts: data.emergencyContacts || [],
        },
      });

      console.log(`✅ Patient profile created for ${userId}`);
      return profile as PatientProfile;
    } catch (error) {
      console.error('Failed to create patient profile:', error);
      throw error;
    }
  }

  async getProfile(userId: string): Promise<PatientProfile | null> {
    try {
      const profile = await prisma.patientProfile.findUnique({
        where: { userId },
      });
      return profile as PatientProfile | null;
    } catch (error) {
      console.error('Failed to get patient profile:', error);
      throw error;
    }
  }

  async updateProfile(userId: string, data: Partial<PatientProfile>): Promise<PatientProfile> {
    try {
      const profile = await prisma.patientProfile.update({
        where: { userId },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });

      console.log(`✅ Patient profile updated for ${userId}`);
      return profile as PatientProfile;
    } catch (error) {
      console.error('Failed to update patient profile:', error);
      throw error;
    }
  }

  // ==================== MEDICAL HISTORY ====================

  async updateMedicalHistory(userId: string, history: string): Promise<void> {
    try {
      await prisma.patientProfile.update({
        where: { userId },
        data: { medicalHistory: history },
      });
    } catch (error) {
      console.error('Failed to update medical history:', error);
      throw error;
    }
  }

  async addAllergy(userId: string, allergy: string): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) throw new Error('Profile not found');

      const allergies = [...(profile.allergies || []), allergy];
      await prisma.patientProfile.update({
        where: { userId },
        data: { allergies: [...new Set(allergies)] }, // Remove duplicates
      });
    } catch (error) {
      console.error('Failed to add allergy:', error);
      throw error;
    }
  }

  async removeAllergy(userId: string, allergy: string): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) throw new Error('Profile not found');

      const allergies = profile.allergies?.filter((a) => a !== allergy) || [];
      await prisma.patientProfile.update({
        where: { userId },
        data: { allergies },
      });
    } catch (error) {
      console.error('Failed to remove allergy:', error);
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
        data: { currentMedications: medications },
      });

      console.log(`✅ Medication added: ${medication.name}`);
    } catch (error) {
      console.error('Failed to add medication:', error);
      throw error;
    }
  }

  async updateMedication(userId: string, medicationId: string, updates: Partial<Medication>): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) throw new Error('Profile not found');

      const medications = profile.currentMedications?.map((m) =>
        m.id === medicationId ? { ...m, ...updates } : m
      ) || [];

      await prisma.patientProfile.update({
        where: { userId },
        data: { currentMedications: medications },
      });
    } catch (error) {
      console.error('Failed to update medication:', error);
      throw error;
    }
  }

  async removeMedication(userId: string, medicationId: string): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) throw new Error('Profile not found');

      const medications = profile.currentMedications?.filter((m) => m.id !== medicationId) || [];
      await prisma.patientProfile.update({
        where: { userId },
        data: { currentMedications: medications },
      });
    } catch (error) {
      console.error('Failed to remove medication:', error);
      throw error;
    }
  }

  // ==================== EMERGENCY CONTACTS ====================

  async addEmergencyContact(userId: string, contact: EmergencyContact): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) throw new Error('Profile not found');

      const contacts = [...(profile.emergencyContacts || []), contact];
      await prisma.patientProfile.update({
        where: { userId },
        data: { emergencyContacts: contacts },
      });

      console.log(`✅ Emergency contact added: ${contact.name}`);
    } catch (error) {
      console.error('Failed to add emergency contact:', error);
      throw error;
    }
  }

  async updateEmergencyContact(userId: string, contactId: string, updates: Partial<EmergencyContact>): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) throw new Error('Profile not found');

      const contacts = profile.emergencyContacts?.map((c) =>
        c.id === contactId ? { ...c, ...updates } : c
      ) || [];

      await prisma.patientProfile.update({
        where: { userId },
        data: { emergencyContacts: contacts },
      });
    } catch (error) {
      console.error('Failed to update emergency contact:', error);
      throw error;
    }
  }

  // ==================== DEPENDENTS ====================

  async addDependent(userId: string, dependent: Dependent): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) throw new Error('Profile not found');

      const dependents = [...(profile.dependents || []), dependent];
      await prisma.patientProfile.update({
        where: { userId },
        data: { dependents },
      });

      console.log(`✅ Dependent added: ${dependent.name}`);
    } catch (error) {
      console.error('Failed to add dependent:', error);
      throw error;
    }
  }

  async removeDependent(userId: string, dependentId: string): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) throw new Error('Profile not found');

      const dependents = profile.dependents?.filter((d) => d.id !== dependentId) || [];
      await prisma.patientProfile.update({
        where: { userId },
        data: { dependents },
      });
    } catch (error) {
      console.error('Failed to remove dependent:', error);
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
          nhisNumber,
        },
      });

      console.log(`✅ Insurance linked for ${userId}`);
    } catch (error) {
      console.error('Failed to link insurance:', error);
      throw error;
    }
  }

  async getInsuranceInfo(userId: string): Promise<{ provider?: string; insuranceNumber?: string; nhisNumber?: string } | null> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) return null;

      return {
        provider: profile.insuranceProvider,
        insuranceNumber: profile.insuranceNumber,
        nhisNumber: profile.nhisNumber,
      };
    } catch (error) {
      console.error('Failed to get insurance info:', error);
      throw error;
    }
  }

  // ==================== HEALTH RECORDS ====================

  async uploadHealthRecord(userId: string, record: HealthRecord): Promise<HealthRecord> {
    try {
      const created = await prisma.healthRecord.create({
        data: {
          userId,
          type: record.type,
          title: record.title,
          description: record.description,
          fileUrl: record.fileUrl,
          fileName: record.fileName,
          uploadedDate: new Date(),
          issuedDate: record.issuedDate,
          provider: record.provider,
          tags: record.tags,
        },
      });

      console.log(`✅ Health record uploaded: ${record.title}`);
      return created as HealthRecord;
    } catch (error) {
      console.error('Failed to upload health record:', error);
      throw error;
    }
  }

  async getHealthRecords(userId: string, type?: string): Promise<HealthRecord[]> {
    try {
      const records = await prisma.healthRecord.findMany({
        where: {
          userId,
          ...(type && { type: type as any }),
        },
        orderBy: { uploadedDate: 'desc' },
      });

      return records as HealthRecord[];
    } catch (error) {
      console.error('Failed to get health records:', error);
      throw error;
    }
  }

  async deleteHealthRecord(recordId: string): Promise<void> {
    try {
      await prisma.healthRecord.delete({
        where: { id: recordId },
      });

      console.log(`✅ Health record deleted: ${recordId}`);
    } catch (error) {
      console.error('Failed to delete health record:', error);
      throw error;
    }
  }

  // ==================== VITALS TRACKING ====================

  async recordVitals(userId: string, vitals: any): Promise<void> {
    try {
      await prisma.patientProfile.update({
        where: { userId },
        data: {
          vitals,
        },
      });

      console.log(`✅ Vitals recorded for ${userId}`);
    } catch (error) {
      console.error('Failed to record vitals:', error);
      throw error;
    }
  }

  async getVitalsHistory(userId: string, limit = 20): Promise<any[]> {
    try {
      // This would need a separate Vitals table in production
      const profile = await this.getProfile(userId);
      return profile?.vitals ? [profile.vitals] : [];
    } catch (error) {
      console.error('Failed to get vitals history:', error);
      throw error;
    }
  }

  // ==================== APPOINTMENTS ====================

  async getAppointments(userId: string, status?: string): Promise<MedicalAppointment[]> {
    try {
      const appointments = await prisma.medicalAppointment.findMany({
        where: {
          patientId: userId,
          ...(status && { status: status as any }),
        },
        orderBy: { dateTime: 'asc' },
      });

      return appointments as MedicalAppointment[];
    } catch (error) {
      console.error('Failed to get appointments:', error);
      throw error;
    }
  }

  async bookAppointment(appointment: MedicalAppointment): Promise<MedicalAppointment> {
    try {
      const created = await prisma.medicalAppointment.create({
        data: {
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          dateTime: appointment.dateTime,
          duration: appointment.duration,
          status: 'scheduled',
          reason: appointment.reason,
          notes: appointment.notes,
          prepInstructions: appointment.prepInstructions,
          reminderSent: false,
        },
      });

      console.log(`✅ Appointment booked: ${created.id}`);
      return created as MedicalAppointment;
    } catch (error) {
      console.error('Failed to book appointment:', error);
      throw error;
    }
  }

  async rescheduleAppointment(appointmentId: string, newDateTime: Date): Promise<void> {
    try {
      await prisma.medicalAppointment.update({
        where: { id: appointmentId },
        data: { dateTime: newDateTime },
      });

      console.log(`✅ Appointment rescheduled: ${appointmentId}`);
    } catch (error) {
      console.error('Failed to reschedule appointment:', error);
      throw error;
    }
  }

  async cancelAppointment(appointmentId: string, reason?: string): Promise<void> {
    try {
      await prisma.medicalAppointment.update({
        where: { id: appointmentId },
        data: { status: 'cancelled' },
      });

      console.log(`✅ Appointment cancelled: ${appointmentId}`);
    } catch (error) {
      console.error('Failed to cancel appointment:', error);
      throw error;
    }
  }

  // ==================== WAITLIST ====================

  async joinWaitlist(appointmentSlotId: string, patientId: string): Promise<void> {
    try {
      // Add to waitlist (would need separate table)
      console.log(`✅ Patient added to waitlist: ${patientId}`);
    } catch (error) {
      console.error('Failed to join waitlist:', error);
      throw error;
    }
  }

  // ==================== PROVIDER FAVORITES ====================

  async addProviderFavorite(userId: string, providerId: string): Promise<void> {
    try {
      await prisma.patientFavoriteProvider.create({
        data: {
          patientId: userId,
          providerId,
        },
      });

      console.log(`✅ Provider added to favorites`);
    } catch (error) {
      console.error('Failed to add provider favorite:', error);
      throw error;
    }
  }

  async removeProviderFavorite(userId: string, providerId: string): Promise<void> {
    try {
      await prisma.patientFavoriteProvider.deleteMany({
        where: {
          patientId: userId,
          providerId,
        },
      });
    } catch (error) {
      console.error('Failed to remove provider favorite:', error);
      throw error;
    }
  }

  async getFavoriteProviders(userId: string): Promise<any[]> {
    try {
      const favorites = await prisma.patientFavoriteProvider.findMany({
        where: { patientId: userId },
      });

      return favorites;
    } catch (error) {
      console.error('Failed to get favorite providers:', error);
      throw error;
    }
  }
}

export default new PatientService();
