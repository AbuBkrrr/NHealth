// ==================== DOCTOR MODULE - COMPLETE PRODUCTION BUILD ====================

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export interface DoctorProfile {
  id: string;
  userId: string;
  licenseNumber: string;
  specialization: string;
  licenseIssueDate: Date;
  licenseExpiryDate: Date;
  hospitalAffiliations: string[];
  educationQualifications: string[];
  yearsOfExperience: number;
  languages: string[];
  consultationFee: number;
  availableDays: string[];
  availableHours: { start: string; end: string };
  bio: string;
  profileImage: string | null;
  rating: number;
  totalReviews: number;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface Appointment {
  id: string;
  doctorId: string;
  patientId: string;
  dateTime: Date;
  duration: number;
  status: string;
  reason: string;
  notes: string;
  consultationType: string;
  videoCallLink?: string;
  prescription: string;
  diagnosis: string;
  followUpRequired: boolean;
  followUpDate?: Date;
}

export interface Review {
  id: string;
  doctorId: string;
  patientId: string;
  rating: number;
  title: string;
  content: string;
  verified: boolean;
  helpful: number;
  unhelpful: number;
  createdAt: Date;
}

export class DoctorService {
  private logger = {
    info: (msg: string) => console.log(`[DOCTOR] ${msg}`),
    error: (msg: string, err?: any) => console.error(`[DOCTOR] ${msg}`, err),
  };

  // ==================== PROFILE MANAGEMENT ====================

  async createProfile(userId: string, data: Partial<DoctorProfile>): Promise<DoctorProfile> {
    try {
      this.logger.info(`Creating doctor profile for user ${userId}`);

      const profile = await prisma.doctorProfile.create({
        data: {
          id: uuidv4(),
          userId,
          licenseNumber: data.licenseNumber || '',
          specialization: data.specialization || '',
          licenseIssueDate: data.licenseIssueDate || new Date(),
          licenseExpiryDate: data.licenseExpiryDate || new Date(),
          hospitalAffiliations: data.hospitalAffiliations || [],
          educationQualifications: data.educationQualifications || [],
          yearsOfExperience: data.yearsOfExperience || 0,
          languages: data.languages || [],
          consultationFee: data.consultationFee || 0,
          availableDays: data.availableDays || [],
          availableHours: JSON.stringify(data.availableHours || { start: '09:00', end: '17:00' }),
          bio: data.bio || '',
          profileImage: data.profileImage,
          rating: 0,
          totalReviews: 0,
          verificationStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      this.logger.info(`✅ Doctor profile created: ${profile.id}`);
      return profile as any;
    } catch (error) {
      this.logger.error('Failed to create doctor profile', error);
      throw error;
    }
  }

  async getProfile(userId: string): Promise<DoctorProfile | null> {
    try {
      const profile = await prisma.doctorProfile.findUnique({
        where: { userId },
      });
      return profile as any;
    } catch (error) {
      this.logger.error('Failed to fetch doctor profile', error);
      throw error;
    }
  }

  async updateProfile(userId: string, data: Partial<DoctorProfile>): Promise<DoctorProfile> {
    try {
      this.logger.info(`Updating profile for doctor ${userId}`);
      const profile = await prisma.doctorProfile.update({
        where: { userId },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });
      this.logger.info(`✅ Doctor profile updated: ${userId}`);
      return profile as any;
    } catch (error) {
      this.logger.error('Failed to update doctor profile', error);
      throw error;
    }
  }

  async verifyDoctor(userId: string): Promise<void> {
    try {
      await prisma.doctorProfile.update({
        where: { userId },
        data: { verificationStatus: 'verified', updatedAt: new Date() },
      });
      this.logger.info(`✅ Doctor verified: ${userId}`);
    } catch (error) {
      this.logger.error('Failed to verify doctor', error);
      throw error;
    }
  }

  async rejectDoctorVerification(userId: string, reason?: string): Promise<void> {
    try {
      await prisma.doctorProfile.update({
        where: { userId },
        data: { verificationStatus: 'rejected', updatedAt: new Date() },
      });
      this.logger.info(`⚠️ Doctor verification rejected: ${userId}`);
    } catch (error) {
      this.logger.error('Failed to reject doctor', error);
      throw error;
    }
  }

  // ==================== APPOINTMENTS ====================

  async getAppointments(doctorId: string, status?: string, date?: string): Promise<Appointment[]> {
    try {
      let where: any = { doctorId };
      if (status) where.status = status;
      if (date) {
        const startOfDay = new Date(date);
        const endOfDay = new Date(date);
        endOfDay.setDate(endOfDay.getDate() + 1);
        where.dateTime = { gte: startOfDay, lt: endOfDay };
      }

      const appointments = await prisma.medicalAppointment.findMany({
        where,
        orderBy: { dateTime: 'asc' },
      });
      return appointments as any[];
    } catch (error) {
      this.logger.error('Failed to get appointments', error);
      throw error;
    }
  }

  async getAppointmentDetails(appointmentId: string): Promise<Appointment | null> {
    try {
      const appointment = await prisma.medicalAppointment.findUnique({
        where: { id: appointmentId },
      });
      return appointment as any;
    } catch (error) {
      this.logger.error('Failed to get appointment details', error);
      throw error;
    }
  }

  async confirmAppointment(appointmentId: string): Promise<void> {
    try {
      await prisma.medicalAppointment.update({
        where: { id: appointmentId },
        data: { status: 'confirmed', updatedAt: new Date() },
      });
      this.logger.info(`✅ Appointment confirmed: ${appointmentId}`);
    } catch (error) {
      this.logger.error('Failed to confirm appointment', error);
      throw error;
    }
  }

  async completeAppointment(appointmentId: string, diagnosis: string, prescription: string, followUpRequired: boolean = false, followUpDate?: Date): Promise<void> {
    try {
      await prisma.medicalAppointment.update({
        where: { id: appointmentId },
        data: {
          status: 'completed',
          diagnosis,
          prescription,
          followUpRequired,
          followUpDate,
          updatedAt: new Date(),
        },
      });
      this.logger.info(`✅ Appointment completed: ${appointmentId}`);
    } catch (error) {
      this.logger.error('Failed to complete appointment', error);
      throw error;
    }
  }

  async getDailySchedule(doctorId: string, date: string): Promise<Appointment[]> {
    try {
      const startOfDay = new Date(date);
      const endOfDay = new Date(date);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const appointments = await prisma.medicalAppointment.findMany({
        where: {
          doctorId,
          dateTime: { gte: startOfDay, lt: endOfDay },
        },
        orderBy: { dateTime: 'asc' },
      });
      return appointments as any[];
    } catch (error) {
      this.logger.error('Failed to get daily schedule', error);
      throw error;
    }
  }

  async getWeeklySchedule(doctorId: string, startDate: string): Promise<Appointment[]> {
    try {
      const start = new Date(startDate);
      const end = new Date(startDate);
      end.setDate(end.getDate() + 7);

      const appointments = await prisma.medicalAppointment.findMany({
        where: {
          doctorId,
          dateTime: { gte: start, lt: end },
        },
        orderBy: { dateTime: 'asc' },
      });
      return appointments as any[];
    } catch (error) {
      this.logger.error('Failed to get weekly schedule', error);
      throw error;
    }
  }

  // ==================== AVAILABILITY ====================

  async setAvailability(doctorId: string, availableDays: string[], availableHours: { start: string; end: string }): Promise<void> {
    try {
      await prisma.doctorProfile.update({
        where: { userId: doctorId },
        data: {
          availableDays,
          availableHours: JSON.stringify(availableHours),
          updatedAt: new Date(),
        },
      });
      this.logger.info(`✅ Availability updated for ${doctorId}`);
    } catch (error) {
      this.logger.error('Failed to set availability', error);
      throw error;
    }
  }

  async getAvailableSlots(doctorId: string, date: string): Promise<string[]> {
    try {
      const profile = await this.getProfile(doctorId);
      if (!profile) throw new Error('Doctor profile not found');

      const appointments = await this.getDailySchedule(doctorId, date);
      const hours = JSON.parse(profile.availableHours);
      const slots = this.generateTimeSlots(hours.start, hours.end);
      const bookedSlots = appointments.map(apt => apt.dateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));

      return slots.filter(slot => !bookedSlots.includes(slot));
    } catch (error) {
      this.logger.error('Failed to get available slots', error);
      throw error;
    }
  }

  private generateTimeSlots(start: string, end: string, interval: number = 30): string[] {
    const slots = [];
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    let current = new Date();
    current.setHours(startHour, startMin, 0);
    const endTime = new Date();
    endTime.setHours(endHour, endMin, 0);

    while (current <= endTime) {
      slots.push(current.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
      current.setMinutes(current.getMinutes() + interval);
    }

    return slots;
  }

  // ==================== PRESCRIPTIONS ====================

  async createPrescription(appointmentId: string, medications: any[], instructions: string): Promise<void> {
    try {
      const appointment = await this.getAppointmentDetails(appointmentId);
      if (!appointment) throw new Error('Appointment not found');

      await prisma.prescription.create({
        data: {
          id: uuidv4(),
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          appointmentId,
          medications: JSON.stringify(medications),
          instructions,
          issueDate: new Date(),
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          status: 'active',
          refillsAllowed: 3,
          refillsUsed: 0,
        },
      });

      this.logger.info(`✅ Prescription created for appointment ${appointmentId}`);
    } catch (error) {
      this.logger.error('Failed to create prescription', error);
      throw error;
    }
  }

  // ==================== REVIEWS & RATINGS ====================

  async getReviews(doctorId: string, limit: number = 10): Promise<Review[]> {
    try {
      const reviews = await prisma.review.findMany({
        where: { revieweeId: doctorId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return reviews as any[];
    } catch (error) {
      this.logger.error('Failed to get reviews', error);
      throw error;
    }
  }

  async getAverageRating(doctorId: string): Promise<number> {
    try {
      const reviews = await prisma.review.findMany({
        where: { revieweeId: doctorId },
      });

      if (reviews.length === 0) return 0;
      const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      return Math.round(average * 10) / 10;
    } catch (error) {
      this.logger.error('Failed to calculate rating', error);
      throw error;
    }
  }

  async updateRating(doctorId: string): Promise<void> {
    try {
      const reviews = await prisma.review.findMany({
        where: { revieweeId: doctorId },
      });

      const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

      await prisma.doctorProfile.update({
        where: { userId: doctorId },
        data: {
          rating: avgRating,
          totalReviews: reviews.length,
          updatedAt: new Date(),
        },
      });

      this.logger.info(`✅ Rating updated for ${doctorId}: ${avgRating.toFixed(1)}`);
    } catch (error) {
      this.logger.error('Failed to update rating', error);
      throw error;
    }
  }

  // ==================== PATIENT RECORDS ====================

  async getPatientHistory(doctorId: string, patientId: string): Promise<any> {
    try {
      const appointments = await prisma.medicalAppointment.findMany({
        where: { doctorId, patientId },
        orderBy: { dateTime: 'desc' },
      });

      const prescriptions = await prisma.prescription.findMany({
        where: { doctorId, patientId },
        orderBy: { issueDate: 'desc' },
      });

      return { appointments, prescriptions };
    } catch (error) {
      this.logger.error('Failed to get patient history', error);
      throw error;
    }
  }

  async updatePatientNotes(appointmentId: string, notes: string): Promise<void> {
    try {
      await prisma.medicalAppointment.update({
        where: { id: appointmentId },
        data: { notes, updatedAt: new Date() },
      });
      this.logger.info(`✅ Patient notes updated for appointment ${appointmentId}`);
    } catch (error) {
      this.logger.error('Failed to update patient notes', error);
      throw error;
    }
  }

  // ==================== PRACTICE MANAGEMENT ====================

  async getMonthlyStats(doctorId: string, month: number, year: number): Promise<any> {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);

      const appointments = await prisma.medicalAppointment.findMany({
        where: {
          doctorId,
          dateTime: { gte: startDate, lt: endDate },
        },
      });

      const completed = appointments.filter(a => a.status === 'completed').length;
      const cancelled = appointments.filter(a => a.status === 'cancelled').length;
      const noShow = appointments.filter(a => a.status === 'no_show').length;

      return {
        totalAppointments: appointments.length,
        completedAppointments: completed,
        cancelledAppointments: cancelled,
        noShowAppointments: noShow,
        completionRate: (completed / appointments.length * 100).toFixed(1),
      };
    } catch (error) {
      this.logger.error('Failed to get monthly stats', error);
      throw error;
    }
  }

  async getYearlyStats(doctorId: string, year: number): Promise<any> {
    try {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year + 1, 0, 1);

      const appointments = await prisma.medicalAppointment.findMany({
        where: {
          doctorId,
          dateTime: { gte: startDate, lt: endDate },
        },
      });

      const completed = appointments.filter(a => a.status === 'completed').length;
      const revenue = completed * 50; // Placeholder fee

      return {
        totalAppointments: appointments.length,
        completedAppointments: completed,
        estimatedRevenue: revenue,
        averagePatientRating: await this.getAverageRating(doctorId),
      };
    } catch (error) {
      this.logger.error('Failed to get yearly stats', error);
      throw error;
    }
  }
}

export default new DoctorService();
