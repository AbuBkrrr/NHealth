/**
 * Screen Aggregation Service
 * Reduces API calls by combining multiple related data points into single responses
 * This follows Facebook Lite's pattern of pre-assembled screens from the server
 */

import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';

export interface PatientHomeScreen {
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
    phone: string | null;
  };
  profile: {
    bloodType: string | null;
    nhisNumber: string | null;
    genotype: string | null;
  };
  stats: {
    pendingAppointments: number;
    activeOrders: number;
    unreadMessages: number;
    completedTests: number;
  };
  upcomingAppointment: {
    id: string;
    doctorName: string;
    doctorSpecialty: string;
    scheduledFor: Date;
    status: string;
  } | null;
  activeOrders: Array<{
    id: string;
    pharmacy: string;
    itemCount: number;
    total: number;
    status: string;
  }>;
  recentPrescriptions: Array<{
    id: string;
    doctorName: string;
    medications: Array<any>;
    issuedAt: Date;
  }>;
  notifications: {
    hasUnread: boolean;
    count: number;
  };
}

export class ScreenAggregationService {
  /**
   * Get complete patient home screen in a single call
   * Replaces 6+ individual API calls with 1
   * @param patientId - Patient user ID
   * @param lastSync - Optional timestamp for delta sync
   */
  static async getPatientHomeScreen(
    patientId: string,
    lastSync?: Date
  ): Promise<PatientHomeScreen> {
    try {
      // Fetch all data in parallel
      const [user, profile, appointments, orders, prescriptions, messages] =
        await Promise.all([
          prisma.user.findUnique({
            where: { id: patientId },
            select: { id: true, name: true, avatarUrl: true, phone: true }
          }),
          prisma.patientProfile.findUnique({
            where: { userId: patientId },
            select: { bloodType: true, nhisNumber: true, genotype: true }
          }),
          prisma.appointment.findMany({
            where: { patientId },
            orderBy: { scheduledFor: 'asc' },
            take: 5,
            include: {
              doctor: { select: { name: true, specialty: true } }
            }
          }),
          prisma.pharmacyOrder.findMany({
            where: { patientId, status: { not: 'DELIVERED' } },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              items: true,
              pharmacy: { select: { name: true } }
            }
          }),
          prisma.prescription.findMany({
            where: { patientId },
            orderBy: { issuedAt: 'desc' },
            take: 3,
            include: {
              doctor: { select: { name: true } }
            }
          }),
          prisma.message.findMany({
            where: {
              OR: [
                { senderId: patientId, readAt: null },
                { recipientId: patientId, readAt: null }
              ]
            },
            take: 1
          })
        ]);

      if (!user) {
        throw new ApiError('Patient not found', 404);
      }

      // Build aggregated response
      const upcomingAppointment = appointments[0]
        ? {
            id: appointments[0].id,
            doctorName: appointments[0].doctor.name,
            doctorSpecialty: appointments[0].doctor.specialty,
            scheduledFor: appointments[0].scheduledFor,
            status: appointments[0].status
          }
        : null;

      const activeOrdersList = orders.map(order => ({
        id: order.id,
        pharmacy: order.pharmacy.name,
        itemCount: order.items.length,
        total: Number(order.total),
        status: order.status
      }));

      const recentPrescriptionsList = prescriptions.map(rx => ({
        id: rx.id,
        doctorName: rx.doctor.name,
        medications: rx.medications || [],
        issuedAt: rx.issuedAt
      }));

      return {
        user: {
          id: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl,
          phone: user.phone
        },
        profile: {
          bloodType: profile?.bloodType || null,
          nhisNumber: profile?.nhisNumber || null,
          genotype: profile?.genotype || null
        },
        stats: {
          pendingAppointments: appointments.filter(
            a => a.status === 'CONFIRMED'
          ).length,
          activeOrders: orders.length,
          unreadMessages: messages.length,
          completedTests: 0 // Would fetch from labTests
        },
        upcomingAppointment,
        activeOrders: activeOrdersList,
        recentPrescriptions: recentPrescriptionsList,
        notifications: {
          hasUnread: messages.length > 0,
          count: messages.length
        }
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch home screen', 500);
    }
  }

  /**
   * Get complete doctor dashboard screen
   */
  static async getDoctorDashboardScreen(doctorId: string) {
    try {
      const [user, profile, appointments, patients, pendingPayments] =
        await Promise.all([
          prisma.user.findUnique({
            where: { id: doctorId },
            select: { id: true, name: true, avatarUrl: true }
          }),
          prisma.doctorProfile.findUnique({
            where: { userId: doctorId }
          }),
          prisma.appointment.findMany({
            where: {
              doctorId,
              status: { in: ['CONFIRMED', 'COMPLETED'] }
            },
            orderBy: { scheduledFor: 'desc' },
            take: 10
          }),
          prisma.appointment.findMany({
            where: { doctorId },
            distinct: ['patientId'],
            select: { patient: { select: { id: true, name: true } } }
          }),
          prisma.payment.findMany({
            where: {
              providerId: doctorId,
              status: 'PENDING'
            },
            take: 5
          })
        ]);

      if (!user) {
        throw new ApiError('Doctor not found', 404);
      }

      return {
        user,
        profile,
        stats: {
          totalAppointments: appointments.length,
          uniquePatients: patients.length,
          pendingPayments: pendingPayments.length,
          todayRevenue: pendingPayments.reduce(
            (sum, p) => sum + Number(p.amount),
            0
          )
        },
        recentAppointments: appointments,
        pendingPayments
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch doctor dashboard', 500);
    }
  }

  /**
   * Get complete pharmacy dashboard screen
   */
  static async getPharmacyDashboardScreen(pharmacyId: string) {
    try {
      const [profile, pendingOrders, lowStockItems, todayRevenue] =
        await Promise.all([
          prisma.pharmacyProfile.findUnique({
            where: { userId: pharmacyId }
          }),
          prisma.pharmacyOrder.findMany({
            where: {
              pharmacyId,
              status: { in: ['PENDING', 'PROCESSING'] }
            },
            take: 10,
            include: { items: true }
          }),
          prisma.inventoryItem.findMany({
            where: {
              pharmacyId,
              quantity: { lte: 5 } // Low stock threshold
            },
            take: 5
          }),
          prisma.payment.findMany({
            where: {
              providerId: pharmacyId,
              status: 'CONFIRMED',
              createdAt: {
                gte: new Date(new Date().setHours(0, 0, 0, 0))
              }
            }
          })
        ]);

      return {
        profile,
        stats: {
          pendingOrders: pendingOrders.length,
          lowStockCount: lowStockItems.length,
          todayRevenue: todayRevenue.reduce(
            (sum, p) => sum + Number(p.amount),
            0
          )
        },
        pendingOrders,
        lowStockItems,
        alerts: {
          lowStock: lowStockItems.length > 0,
          pendingOrders: pendingOrders.length > 0
        }
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch pharmacy dashboard', 500);
    }
  }

  /**
   * Get complete lab dashboard screen
   */
  static async getLabDashboardScreen(labId: string) {
    try {
      const [profile, pendingTests, inProgressTests, completedToday] =
        await Promise.all([
          prisma.labProfile.findUnique({
            where: { userId: labId }
          }),
          prisma.labTest.findMany({
            where: {
              labId,
              status: 'REQUESTED'
            },
            include: { patient: { select: { name: true } } },
            take: 10
          }),
          prisma.labTest.findMany({
            where: {
              labId,
              status: 'PROCESSING'
            },
            take: 10
          }),
          prisma.labTest.findMany({
            where: {
              labId,
              status: 'COMPLETED',
              updatedAt: {
                gte: new Date(new Date().setHours(0, 0, 0, 0))
              }
            }
          })
        ]);

      return {
        profile,
        stats: {
          awaitingCollection: pendingTests.length,
          inProgress: inProgressTests.length,
          completedToday: completedToday.length
        },
        pendingTests,
        inProgressTests,
        alerts: {
          awaitingCollection: pendingTests.length > 0
        }
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch lab dashboard', 500);
    }
  }
}

export default ScreenAggregationService;
