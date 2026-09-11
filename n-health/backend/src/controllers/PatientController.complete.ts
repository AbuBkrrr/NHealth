// ==================== PATIENT CONTROLLER - PRODUCTION GRADE ====================

import { Request, Response, NextFunction } from 'express';
import PatientService from '../services/PatientService';
import { authenticateToken } from '../middleware/auth';

export class PatientController {
  private logger = {
    info: (msg: string) => console.log(`[PATIENT_CTRL] ${msg}`),
    error: (msg: string, err?: any) => console.error(`[PATIENT_CTRL] ${msg}`, err),
  };

  // ==================== PROFILE MANAGEMENT ====================

  async createProfile(req: Request, res: Response, next: NextFunction) {
    try {
      this.logger.info(`Creating profile for user ${req.user?.id}`);
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const profile = await PatientService.createProfile(userId, req.body);
      res.status(201).json({ success: true, data: profile });
    } catch (error) {
      this.logger.error('Profile creation failed', error);
      next(error);
    }
  }

  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id || req.params.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const profile = await PatientService.getProfile(userId);
      if (!profile) return res.status(404).json({ error: 'Profile not found' });

      res.json({ success: true, data: profile });
    } catch (error) {
      this.logger.error('Failed to fetch profile', error);
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const profile = await PatientService.updateProfile(userId, req.body);
      res.json({ success: true, data: profile });
    } catch (error) {
      this.logger.error('Failed to update profile', error);
      next(error);
    }
  }

  async deleteProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      await PatientService.deleteProfile(userId);
      res.json({ success: true, message: 'Profile deleted' });
    } catch (error) {
      this.logger.error('Failed to delete profile', error);
      next(error);
    }
  }

  // ==================== MEDICAL HISTORY ====================

  async updateMedicalHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { history } = req.body;

      if (!history) return res.status(400).json({ error: 'History is required' });

      await PatientService.updateMedicalHistory(userId, history);
      res.json({ success: true, message: 'Medical history updated' });
    } catch (error) {
      this.logger.error('Failed to update medical history', error);
      next(error);
    }
  }

  // ==================== ALLERGIES ====================

  async addAllergy(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { allergy } = req.body;

      if (!allergy) return res.status(400).json({ error: 'Allergy is required' });

      await PatientService.addAllergy(userId, allergy);
      res.json({ success: true, message: 'Allergy added' });
    } catch (error) {
      this.logger.error('Failed to add allergy', error);
      next(error);
    }
  }

  async removeAllergy(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { allergy } = req.params;

      await PatientService.removeAllergy(userId, allergy);
      res.json({ success: true, message: 'Allergy removed' });
    } catch (error) {
      this.logger.error('Failed to remove allergy', error);
      next(error);
    }
  }

  async getAllergies(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const allergies = await PatientService.getAllergies(userId);
      res.json({ success: true, data: allergies });
    } catch (error) {
      this.logger.error('Failed to get allergies', error);
      next(error);
    }
  }

  // ==================== MEDICATIONS ====================

  async addMedication(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const medication = req.body;
      if (!medication.name || !medication.dosage) {
        return res.status(400).json({ error: 'Name and dosage are required' });
      }

      await PatientService.addMedication(userId, medication);
      res.status(201).json({ success: true, message: 'Medication added' });
    } catch (error) {
      this.logger.error('Failed to add medication', error);
      next(error);
    }
  }

  async updateMedication(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { medicationId } = req.params;

      await PatientService.updateMedication(userId, medicationId, req.body);
      res.json({ success: true, message: 'Medication updated' });
    } catch (error) {
      this.logger.error('Failed to update medication', error);
      next(error);
    }
  }

  async removeMedication(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { medicationId } = req.params;

      await PatientService.removeMedication(userId, medicationId);
      res.json({ success: true, message: 'Medication removed' });
    } catch (error) {
      this.logger.error('Failed to remove medication', error);
      next(error);
    }
  }

  async getMedications(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const medications = await PatientService.getMedications(userId);
      res.json({ success: true, data: medications });
    } catch (error) {
      this.logger.error('Failed to get medications', error);
      next(error);
    }
  }

  async checkDrugInteractions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const medications = await PatientService.getMedications(userId);
      const interactions = await PatientService.checkDrugInteractions(medications);
      
      res.json({ success: true, data: interactions });
    } catch (error) {
      this.logger.error('Failed to check interactions', error);
      next(error);
    }
  }

  // ==================== EMERGENCY CONTACTS ====================

  async addEmergencyContact(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const contact = req.body;
      if (!contact.name || !contact.phone) {
        return res.status(400).json({ error: 'Name and phone are required' });
      }

      await PatientService.addEmergencyContact(userId, contact);
      res.status(201).json({ success: true, message: 'Emergency contact added' });
    } catch (error) {
      this.logger.error('Failed to add emergency contact', error);
      next(error);
    }
  }

  async updateEmergencyContact(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { contactId } = req.params;

      await PatientService.updateEmergencyContact(userId, contactId, req.body);
      res.json({ success: true, message: 'Emergency contact updated' });
    } catch (error) {
      this.logger.error('Failed to update emergency contact', error);
      next(error);
    }
  }

  async removeEmergencyContact(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { contactId } = req.params;

      await PatientService.removeEmergencyContact(userId, contactId);
      res.json({ success: true, message: 'Emergency contact removed' });
    } catch (error) {
      this.logger.error('Failed to remove emergency contact', error);
      next(error);
    }
  }

  async getPrimaryEmergencyContact(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const contact = await PatientService.getPrimaryEmergencyContact(userId);
      res.json({ success: true, data: contact });
    } catch (error) {
      this.logger.error('Failed to get primary emergency contact', error);
      next(error);
    }
  }

  // ==================== DEPENDENTS ====================

  async addDependent(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const dependent = req.body;
      if (!dependent.name || !dependent.relationship) {
        return res.status(400).json({ error: 'Name and relationship are required' });
      }

      await PatientService.addDependent(userId, dependent);
      res.status(201).json({ success: true, message: 'Dependent added' });
    } catch (error) {
      this.logger.error('Failed to add dependent', error);
      next(error);
    }
  }

  async updateDependent(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { dependentId } = req.params;

      await PatientService.updateDependent(userId, dependentId, req.body);
      res.json({ success: true, message: 'Dependent updated' });
    } catch (error) {
      this.logger.error('Failed to update dependent', error);
      next(error);
    }
  }

  async removeDependent(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { dependentId } = req.params;

      await PatientService.removeDependent(userId, dependentId);
      res.json({ success: true, message: 'Dependent removed' });
    } catch (error) {
      this.logger.error('Failed to remove dependent', error);
      next(error);
    }
  }

  async getDependents(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const dependents = await PatientService.getDependents(userId);
      res.json({ success: true, data: dependents });
    } catch (error) {
      this.logger.error('Failed to get dependents', error);
      next(error);
    }
  }

  // ==================== INSURANCE ====================

  async linkInsurance(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { provider, insuranceNumber, nhisNumber } = req.body;
      if (!provider || !insuranceNumber) {
        return res.status(400).json({ error: 'Provider and insurance number are required' });
      }

      await PatientService.linkInsurance(userId, provider, insuranceNumber, nhisNumber);
      res.json({ success: true, message: 'Insurance linked' });
    } catch (error) {
      this.logger.error('Failed to link insurance', error);
      next(error);
    }
  }

  async getInsuranceInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const info = await PatientService.getInsuranceInfo(userId);
      res.json({ success: true, data: info });
    } catch (error) {
      this.logger.error('Failed to get insurance info', error);
      next(error);
    }
  }

  // ==================== HEALTH RECORDS ====================

  async uploadHealthRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const record = req.body;
      if (!record.title || !record.fileUrl) {
        return res.status(400).json({ error: 'Title and file URL are required' });
      }

      const created = await PatientService.uploadHealthRecord(userId, record);
      res.status(201).json({ success: true, data: created });
    } catch (error) {
      this.logger.error('Failed to upload health record', error);
      next(error);
    }
  }

  async getHealthRecords(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { type } = req.query;

      const records = await PatientService.getHealthRecords(userId, type as string);
      res.json({ success: true, data: records });
    } catch (error) {
      this.logger.error('Failed to get health records', error);
      next(error);
    }
  }

  async deleteHealthRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { recordId } = req.params;

      await PatientService.deleteHealthRecord(userId, recordId);
      res.json({ success: true, message: 'Health record archived' });
    } catch (error) {
      this.logger.error('Failed to delete health record', error);
      next(error);
    }
  }

  // ==================== VITALS ====================

  async recordVitals(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const vitals = req.body;
      if (!vitals.weight || !vitals.bloodPressure) {
        return res.status(400).json({ error: 'Weight and blood pressure are required' });
      }

      await PatientService.recordVitals(userId, vitals);
      res.json({ success: true, message: 'Vitals recorded' });
    } catch (error) {
      this.logger.error('Failed to record vitals', error);
      next(error);
    }
  }

  async getVitalsHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { limit } = req.query;

      const history = await PatientService.getVitalsHistory(userId, parseInt(limit as string) || 10);
      res.json({ success: true, data: history });
    } catch (error) {
      this.logger.error('Failed to get vitals history', error);
      next(error);
    }
  }

  async getVitalsTrends(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const trends = await PatientService.getVitalsTrends(userId);
      res.json({ success: true, data: trends });
    } catch (error) {
      this.logger.error('Failed to get vitals trends', error);
      next(error);
    }
  }

  // ==================== APPOINTMENTS ====================

  async bookAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const appointment = { ...req.body, patientId: userId };
      if (!appointment.doctorId || !appointment.dateTime) {
        return res.status(400).json({ error: 'Doctor ID and date/time are required' });
      }

      const created = await PatientService.bookAppointment(appointment);
      res.status(201).json({ success: true, data: created });
    } catch (error) {
      this.logger.error('Failed to book appointment', error);
      next(error);
    }
  }

  async getAppointments(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { status } = req.query;

      const appointments = await PatientService.getAppointments(userId, status as string);
      res.json({ success: true, data: appointments });
    } catch (error) {
      this.logger.error('Failed to get appointments', error);
      next(error);
    }
  }

  async rescheduleAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const { appointmentId } = req.params;
      const { newDateTime } = req.body;

      if (!newDateTime) return res.status(400).json({ error: 'New date/time is required' });

      await PatientService.rescheduleAppointment(appointmentId, new Date(newDateTime));
      res.json({ success: true, message: 'Appointment rescheduled' });
    } catch (error) {
      this.logger.error('Failed to reschedule appointment', error);
      next(error);
    }
  }

  async cancelAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const { appointmentId } = req.params;
      const { reason } = req.body;

      await PatientService.cancelAppointment(appointmentId, reason);
      res.json({ success: true, message: 'Appointment cancelled' });
    } catch (error) {
      this.logger.error('Failed to cancel appointment', error);
      next(error);
    }
  }

  async getUpcomingAppointments(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const appointments = await PatientService.getUpcomingAppointments(userId);
      res.json({ success: true, data: appointments });
    } catch (error) {
      this.logger.error('Failed to get upcoming appointments', error);
      next(error);
    }
  }

  // ==================== PROVIDER FAVORITES ====================

  async addProviderFavorite(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { providerId } = req.body;

      if (!providerId) return res.status(400).json({ error: 'Provider ID is required' });

      await PatientService.addProviderFavorite(userId, providerId);
      res.json({ success: true, message: 'Provider added to favorites' });
    } catch (error) {
      this.logger.error('Failed to add provider favorite', error);
      next(error);
    }
  }

  async removeProviderFavorite(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { providerId } = req.params;

      await PatientService.removeProviderFavorite(userId, providerId);
      res.json({ success: true, message: 'Provider removed from favorites' });
    } catch (error) {
      this.logger.error('Failed to remove provider favorite', error);
      next(error);
    }
  }

  async getFavoriteProviders(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const providers = await PatientService.getFavoriteProviders(userId);
      res.json({ success: true, data: providers });
    } catch (error) {
      this.logger.error('Failed to get favorite providers', error);
      next(error);
    }
  }

  // ==================== DATA SHARING CONSENT ====================

  async grantDataSharingConsent(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { providerId, dataTypes } = req.body;
      if (!providerId || !dataTypes) {
        return res.status(400).json({ error: 'Provider ID and data types are required' });
      }

      await PatientService.grantDataSharingConsent(userId, providerId, dataTypes);
      res.json({ success: true, message: 'Consent granted' });
    } catch (error) {
      this.logger.error('Failed to grant consent', error);
      next(error);
    }
  }

  async revokeDataSharingConsent(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { consentId } = req.params;

      await PatientService.revokeDataSharingConsent(userId, consentId);
      res.json({ success: true, message: 'Consent revoked' });
    } catch (error) {
      this.logger.error('Failed to revoke consent', error);
      next(error);
    }
  }

  async getDataSharingConsents(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const consents = await PatientService.getDataSharingConsents(userId);
      res.json({ success: true, data: consents });
    } catch (error) {
      this.logger.error('Failed to get consents', error);
      next(error);
    }
  }
}

export default new PatientController();
