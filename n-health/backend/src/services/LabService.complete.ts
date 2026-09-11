// ==================== LAB MODULE - COMPLETE PRODUCTION BUILD ====================

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export interface LabProfile {
  id: string;
  userId: string;
  labName: string;
  licenseNumber: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
  certifications: string[];
  homeCollectionAvailable: boolean;
  turnaroundTime: string;
}

export interface LabTest {
  id: string;
  name: string;
  testCode: string;
  category: string;
  normalRange: string;
  unit: string;
  specimen: string;
  homeCollectionAllowed: boolean;
  price: number;
  turnaroundHours: number;
}

export interface LabOrder {
  id: string;
  patientId: string;
  labId: string;
  testIds: string[];
  status: string;
  sampleCollectionDate?: Date;
  sampleCollectionLocation?: string;
  reportUrl?: string;
  reportGenerated?: Date;
  totalCost: number;
  paymentStatus: string;
}

export class LabService {
  private logger = {
    info: (msg: string) => console.log(`[LAB] ${msg}`),
    error: (msg: string, err?: any) => console.error(`[LAB] ${msg}`, err),
  };

  // ==================== PROFILE MANAGEMENT ====================

  async createProfile(userId: string, data: Partial<LabProfile>): Promise<LabProfile> {
    try {
      this.logger.info(`Creating lab profile for ${userId}`);

      const profile = await prisma.labProfile.create({
        data: {
          id: uuidv4(),
          userId,
          labName: data.labName || '',
          licenseNumber: data.licenseNumber || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          zipCode: data.zipCode || '',
          phone: data.phone || '',
          email: data.email || '',
          certifications: data.certifications || [],
          homeCollectionAvailable: data.homeCollectionAvailable || true,
          turnaroundTime: data.turnaroundTime || '24 hours',
        },
      });

      this.logger.info(`✅ Lab profile created: ${profile.id}`);
      return profile as any;
    } catch (error) {
      this.logger.error('Failed to create lab profile', error);
      throw error;
    }
  }

  async getProfile(userId: string): Promise<LabProfile | null> {
    try {
      const profile = await prisma.labProfile.findUnique({
        where: { userId },
      });
      return profile as any;
    } catch (error) {
      this.logger.error('Failed to fetch lab profile', error);
      throw error;
    }
  }

  // ==================== TEST MANAGEMENT ====================

  async createTest(data: Partial<LabTest>): Promise<LabTest> {
    try {
      this.logger.info(`Creating lab test: ${data.name}`);

      const test = await prisma.labTest.create({
        data: {
          id: uuidv4(),
          name: data.name || '',
          testCode: data.testCode || uuidv4(),
          category: data.category || 'other',
          normalRange: data.normalRange || '',
          unit: data.unit || '',
          specimen: data.specimen || '',
          homeCollectionAllowed: data.homeCollectionAllowed || false,
          price: data.price || 0,
          turnaroundHours: data.turnaroundHours || 24,
        },
      });

      this.logger.info(`✅ Test created: ${test.id}`);
      return test as any;
    } catch (error) {
      this.logger.error('Failed to create test', error);
      throw error;
    }
  }

  async getTests(category?: string): Promise<LabTest[]> {
    try {
      const where = category ? { category } : {};
      const tests = await prisma.labTest.findMany({
        where,
        orderBy: { name: 'asc' },
      });
      return tests as any[];
    } catch (error) {
      this.logger.error('Failed to get tests', error);
      throw error;
    }
  }

  async searchTests(query: string): Promise<LabTest[]> {
    try {
      const tests = await prisma.labTest.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { testCode: { contains: query, mode: 'insensitive' } },
            { category: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 20,
      });
      return tests as any[];
    } catch (error) {
      this.logger.error('Failed to search tests', error);
      throw error;
    }
  }

  async getTestDetails(testId: string): Promise<LabTest | null> {
    try {
      const test = await prisma.labTest.findUnique({
        where: { id: testId },
      });
      return test as any;
    } catch (error) {
      this.logger.error('Failed to get test details', error);
      throw error;
    }
  }

  // ==================== ORDERS ====================

  async createOrder(patientId: string, labId: string, testIds: string[], collectionType: 'home' | 'lab'): Promise<LabOrder> {
    try {
      this.logger.info(`Creating lab order for patient ${patientId}`);

      const tests = await prisma.labTest.findMany({
        where: { id: { in: testIds } },
      });

      const totalCost = tests.reduce((sum, test) => sum + test.price, 0);

      const order = await prisma.labOrder.create({
        data: {
          id: uuidv4(),
          patientId,
          labId,
          testIds,
          status: 'pending',
          totalCost,
          paymentStatus: 'unpaid',
          orderedDate: new Date(),
        },
      });

      this.logger.info(`✅ Lab order created: ${order.id}`);
      return order as any;
    } catch (error) {
      this.logger.error('Failed to create lab order', error);
      throw error;
    }
  }

  async getOrders(labId: string, status?: string): Promise<LabOrder[]> {
    try {
      let where: any = { labId };
      if (status) where.status = status;

      const orders = await prisma.labOrder.findMany({
        where,
        orderBy: { orderedDate: 'desc' },
      });
      return orders as any[];
    } catch (error) {
      this.logger.error('Failed to get lab orders', error);
      throw error;
    }
  }

  async getPatientOrders(patientId: string): Promise<LabOrder[]> {
    try {
      const orders = await prisma.labOrder.findMany({
        where: { patientId },
        orderBy: { orderedDate: 'desc' },
      });
      return orders as any[];
    } catch (error) {
      this.logger.error('Failed to get patient lab orders', error);
      throw error;
    }
  }

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    try {
      await prisma.labOrder.update({
        where: { id: orderId },
        data: { status, updatedAt: new Date() },
      });
      this.logger.info(`✅ Lab order status updated: ${orderId} -> ${status}`);
    } catch (error) {
      this.logger.error('Failed to update lab order status', error);
      throw error;
    }
  }

  // ==================== SAMPLE COLLECTION ====================

  async recordSampleCollection(orderId: string, collectionDate: Date, collectionLocation: string): Promise<void> {
    try {
      await prisma.labOrder.update({
        where: { id: orderId },
        data: {
          status: 'sample_collected',
          sampleCollectionDate: collectionDate,
          sampleCollectionLocation: collectionLocation,
          updatedAt: new Date(),
        },
      });
      this.logger.info(`✅ Sample collected for order ${orderId}`);
    } catch (error) {
      this.logger.error('Failed to record sample collection', error);
      throw error;
    }
  }

  async getSamplesForCollection(labId: string): Promise<LabOrder[]> {
    try {
      const orders = await prisma.labOrder.findMany({
        where: {
          labId,
          status: 'pending',
        },
        orderBy: { orderedDate: 'asc' },
      });
      return orders as any[];
    } catch (error) {
      this.logger.error('Failed to get pending samples', error);
      throw error;
    }
  }

  // ==================== RESULTS MANAGEMENT ====================

  async uploadResults(orderId: string, reportUrl: string, results: any): Promise<void> {
    try {
      await prisma.labOrder.update({
        where: { id: orderId },
        data: {
          status: 'completed',
          reportUrl,
          reportGenerated: new Date(),
          normalValues: JSON.stringify(results),
          updatedAt: new Date(),
        },
      });
      this.logger.info(`✅ Results uploaded for order ${orderId}`);
    } catch (error) {
      this.logger.error('Failed to upload results', error);
      throw error;
    }
  }

  async getResults(orderId: string): Promise<any> {
    try {
      const order = await prisma.labOrder.findUnique({
        where: { id: orderId },
      });

      if (!order || !order.reportUrl) throw new Error('Results not found');

      return {
        reportUrl: order.reportUrl,
        generatedDate: order.reportGenerated,
        results: JSON.parse(order.normalValues || '{}'),
      };
    } catch (error) {
      this.logger.error('Failed to get results', error);
      throw error;
    }
  }

  async flagAbnormalResult(orderId: string, findings: string[]): Promise<void> {
    try {
      await prisma.labOrder.update({
        where: { id: orderId },
        data: {
          abnormalFindings: findings,
          updatedAt: new Date(),
        },
      });
      this.logger.info(`⚠️ Abnormal findings flagged for order ${orderId}`);
    } catch (error) {
      this.logger.error('Failed to flag abnormal result', error);
      throw error;
    }
  }

  // ==================== ANALYTICS ====================

  async getMonthlyStats(labId: string, month: number, year: number): Promise<any> {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);

      const orders = await prisma.labOrder.findMany({
        where: {
          labId,
          orderedDate: { gte: startDate, lt: endDate },
        },
      });

      const completed = orders.filter(o => o.status === 'completed').length;
      const totalRevenue = orders.reduce((sum, o) => sum + o.totalCost, 0);

      return {
        totalOrders: orders.length,
        completedOrders: completed,
        totalRevenue,
        averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
        averageTurnaroundTime: '24 hours', // TODO: Calculate actual
      };
    } catch (error) {
      this.logger.error('Failed to get monthly stats', error);
      throw error;
    }
  }

  async getMostOrderedTests(labId: string, limit: number = 10): Promise<any[]> {
    try {
      // TODO: Calculate from orders
      return [];
    } catch (error) {
      this.logger.error('Failed to get most ordered tests', error);
      throw error;
    }
  }

  // ==================== HOME COLLECTION ====================

  async scheduleHomeCollection(orderId: string, collectionDate: Date, address: string): Promise<void> {
    try {
      const order = await prisma.labOrder.findUnique({
        where: { id: orderId },
      });

      if (!order) throw new Error('Order not found');

      await prisma.labOrder.update({
        where: { id: orderId },
        data: {
          status: 'pending',
          sampleCollectionLocation: address,
          sampleCollectionDate: collectionDate,
          updatedAt: new Date(),
        },
      });

      this.logger.info(`✅ Home collection scheduled for order ${orderId}`);
    } catch (error) {
      this.logger.error('Failed to schedule home collection', error);
      throw error;
    }
  }

  async getScheduledCollections(labId: string): Promise<LabOrder[]> {
    try {
      const orders = await prisma.labOrder.findMany({
        where: {
          labId,
          status: { in: ['pending', 'sample_collected'] },
          sampleCollectionLocation: { not: null },
        },
        orderBy: { sampleCollectionDate: 'asc' },
      });
      return orders as any[];
    } catch (error) {
      this.logger.error('Failed to get scheduled collections', error);
      throw error;
    }
  }
}

export default new LabService();
