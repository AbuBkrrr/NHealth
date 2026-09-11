// ==================== AMBULANCE MODULE - COMPLETE PRODUCTION BUILD ====================

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export interface AmbulanceProfile {
  id: string;
  userId: string;
  ambulanceNumber: string;
  registrationNumber: string;
  licenseNumber: string;
  vehicleType: 'ALS' | 'BLS' | 'ICU' | 'ventilator';
  currentLatitude: number;
  currentLongitude: number;
  isAvailable: boolean;
  yearsOfExperience: number;
  certifications: string[];
}

export interface AmbulanceRequest {
  id: string;
  patientId: string;
  ambulanceId?: string;
  pickupLocation: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationLocation: string;
  destLatitude: number;
  destLongitude: number;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  estimatedArrival?: Date;
  actualArrival?: Date;
  completionTime?: Date;
  fare: number;
  paymentStatus: string;
}

export class AmbulanceService {
  private logger = {
    info: (msg: string) => console.log(`[AMBULANCE] ${msg}`),
    error: (msg: string, err?: any) => console.error(`[AMBULANCE] ${msg}`, err),
  };

  // ==================== PROFILE MANAGEMENT ====================

  async createProfile(userId: string, data: Partial<AmbulanceProfile>): Promise<AmbulanceProfile> {
    try {
      this.logger.info(`Creating ambulance profile for ${userId}`);

      const profile = await prisma.ambulanceProfile.create({
        data: {
          id: uuidv4(),
          userId,
          ambulanceNumber: data.ambulanceNumber || '',
          registrationNumber: data.registrationNumber || '',
          licenseNumber: data.licenseNumber || '',
          vehicleType: data.vehicleType || 'BLS',
          currentLatitude: data.currentLatitude || 0,
          currentLongitude: data.currentLongitude || 0,
          isAvailable: true,
          yearsOfExperience: data.yearsOfExperience || 0,
          certifications: data.certifications || [],
        },
      });

      this.logger.info(`✅ Ambulance profile created: ${profile.id}`);
      return profile as any;
    } catch (error) {
      this.logger.error('Failed to create ambulance profile', error);
      throw error;
    }
  }

  async getProfile(userId: string): Promise<AmbulanceProfile | null> {
    try {
      const profile = await prisma.ambulanceProfile.findUnique({
        where: { userId },
      });
      return profile as any;
    } catch (error) {
      this.logger.error('Failed to fetch ambulance profile', error);
      throw error;
    }
  }

  async updateLocation(userId: string, latitude: number, longitude: number): Promise<void> {
    try {
      await prisma.ambulanceProfile.update({
        where: { userId },
        data: {
          currentLatitude: latitude,
          currentLongitude: longitude,
          lastLocationUpdate: new Date(),
        },
      });
      this.logger.info(`✅ Ambulance location updated`);
    } catch (error) {
      this.logger.error('Failed to update ambulance location', error);
      throw error;
    }
  }

  async setAvailability(userId: string, isAvailable: boolean): Promise<void> {
    try {
      await prisma.ambulanceProfile.update({
        where: { userId },
        data: { isAvailable },
      });
      this.logger.info(`✅ Ambulance availability updated: ${isAvailable ? 'Available' : 'Unavailable'}`);
    } catch (error) {
      this.logger.error('Failed to set availability', error);
      throw error;
    }
  }

  // ==================== REQUEST MANAGEMENT ====================

  async createRequest(patientId: string, data: Partial<AmbulanceRequest>): Promise<AmbulanceRequest> {
    try {
      this.logger.info(`Creating ambulance request for patient ${patientId}`);

      const distance = this.calculateDistance(
        data.pickupLatitude || 0,
        data.pickupLongitude || 0,
        data.destLatitude || 0,
        data.destLongitude || 0
      );

      const fare = this.calculateFare(distance, data.priority || 'medium');

      const request = await prisma.ambulanceRequest.create({
        data: {
          id: uuidv4(),
          patientId,
          pickupLocation: data.pickupLocation || '',
          pickupLatitude: data.pickupLatitude || 0,
          pickupLongitude: data.pickupLongitude || 0,
          destinationLocation: data.destinationLocation || '',
          destLatitude: data.destLatitude || 0,
          destLongitude: data.destLongitude || 0,
          reason: data.reason || '',
          priority: data.priority || 'medium',
          status: 'requested',
          fare,
          paymentStatus: 'unpaid',
          requestedAt: new Date(),
        },
      });

      this.logger.info(`✅ Ambulance request created: ${request.id}`);
      await this.findNearbyAmbulances(request.id, data.pickupLatitude || 0, data.pickupLongitude || 0);

      return request as any;
    } catch (error) {
      this.logger.error('Failed to create ambulance request', error);
      throw error;
    }
  }

  async getRequest(requestId: string): Promise<AmbulanceRequest | null> {
    try {
      const request = await prisma.ambulanceRequest.findUnique({
        where: { id: requestId },
      });
      return request as any;
    } catch (error) {
      this.logger.error('Failed to get ambulance request', error);
      throw error;
    }
  }

  async getPatientRequests(patientId: string): Promise<AmbulanceRequest[]> {
    try {
      const requests = await prisma.ambulanceRequest.findMany({
        where: { patientId },
        orderBy: { requestedAt: 'desc' },
      });
      return requests as any[];
    } catch (error) {
      this.logger.error('Failed to get patient requests', error);
      throw error;
    }
  }

  async getActiveRequests(status?: string): Promise<AmbulanceRequest[]> {
    try {
      let where: any = { status: { in: ['requested', 'accepted', 'enroute'] } };
      if (status) where.status = status;

      const requests = await prisma.ambulanceRequest.findMany({
        where,
        orderBy: { requestedAt: 'asc' },
      });
      return requests as any[];
    } catch (error) {
      this.logger.error('Failed to get active requests', error);
      throw error;
    }
  }

  // ==================== REQUEST ASSIGNMENT ====================

  async acceptRequest(requestId: string, ambulanceId: string): Promise<void> {
    try {
      const estimatedArrival = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await prisma.ambulanceRequest.update({
        where: { id: requestId },
        data: {
          ambulanceId,
          status: 'accepted',
          estimatedArrival,
          updatedAt: new Date(),
        },
      });

      this.logger.info(`✅ Ambulance request accepted: ${requestId}`);
    } catch (error) {
      this.logger.error('Failed to accept request', error);
      throw error;
    }
  }

  async declineRequest(requestId: string, reason: string): Promise<void> {
    try {
      await prisma.ambulanceRequest.update({
        where: { id: requestId },
        data: {
          status: 'declined',
          updatedAt: new Date(),
        },
      });

      this.logger.info(`⚠️ Ambulance request declined: ${requestId}`);
    } catch (error) {
      this.logger.error('Failed to decline request', error);
      throw error;
    }
  }

  // ==================== TRACKING ====================

  async updateRequestStatus(requestId: string, status: string, currentLat?: number, currentLng?: number): Promise<void> {
    try {
      const updateData: any = { status, updatedAt: new Date() };

      if (status === 'arrived') {
        updateData.actualArrival = new Date();
      } else if (status === 'completed') {
        updateData.completionTime = new Date();
      }

      await prisma.ambulanceRequest.update({
        where: { id: requestId },
        data: updateData,
      });

      this.logger.info(`✅ Request status updated: ${requestId} -> ${status}`);
    } catch (error) {
      this.logger.error('Failed to update request status', error);
      throw error;
    }
  }

  async getAmbulanceCurrentRequests(ambulanceUserId: string): Promise<AmbulanceRequest[]> {
    try {
      const profile = await this.getProfile(ambulanceUserId);
      if (!profile) throw new Error('Ambulance profile not found');

      const requests = await prisma.ambulanceRequest.findMany({
        where: {
          ambulanceId: profile.id,
          status: { in: ['accepted', 'enroute', 'arrived'] },
        },
      });

      return requests as any[];
    } catch (error) {
      this.logger.error('Failed to get current requests', error);
      throw error;
    }
  }

  // ==================== DISTANCE & ROUTING ====================

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private calculateFare(distance: number, priority: string): number {
    const baseFare = 5;
    const perKmFare = 2;
    const priorityMultiplier = {
      low: 1,
      medium: 1.2,
      high: 1.5,
      critical: 2,
    };

    return (baseFare + distance * perKmFare) * (priorityMultiplier[priority as keyof typeof priorityMultiplier] || 1);
  }

  private async findNearbyAmbulances(requestId: string, pickupLat: number, pickupLng: number, radius: number = 5): Promise<void> {
    try {
      const ambulances = await prisma.ambulanceProfile.findMany({
        where: { isAvailable: true },
      });

      // Filter ambulances within radius
      const nearby = ambulances.filter(amb => {
        const distance = this.calculateDistance(pickupLat, pickupLng, amb.currentLatitude, amb.currentLongitude);
        return distance <= radius;
      });

      // TODO: Send push notifications to nearby ambulances
      this.logger.info(`Found ${nearby.length} nearby ambulances`);
    } catch (error) {
      this.logger.error('Failed to find nearby ambulances', error);
    }
  }

  // ==================== STATISTICS ====================

  async getAmbulanceStats(userId: string, month: number, year: number): Promise<any> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) throw new Error('Profile not found');

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);

      const requests = await prisma.ambulanceRequest.findMany({
        where: {
          ambulanceId: profile.id,
          requestedAt: { gte: startDate, lt: endDate },
        },
      });

      const completed = requests.filter(r => r.status === 'completed').length;
      const totalRevenue = requests.reduce((sum, r) => sum + r.fare, 0);
      const avgResponseTime = this.calculateAverageResponseTime(requests);

      return {
        totalRequests: requests.length,
        completedRequests: completed,
        totalRevenue,
        averageResponseTime: avgResponseTime,
        completionRate: requests.length > 0 ? (completed / requests.length * 100).toFixed(1) : 0,
      };
    } catch (error) {
      this.logger.error('Failed to get ambulance stats', error);
      throw error;
    }
  }

  private calculateAverageResponseTime(requests: any[]): string {
    if (requests.length === 0) return 'N/A';
    
    const times = requests
      .filter(r => r.estimatedArrival && r.actualArrival)
      .map(r => {
        const diff = r.actualArrival.getTime() - r.estimatedArrival.getTime();
        return Math.abs(diff / 60000); // Convert to minutes
      });

    if (times.length === 0) return 'N/A';
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    return `${Math.round(avg)} mins`;
  }
}

export default new AmbulanceService();
