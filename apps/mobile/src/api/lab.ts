import { api } from './client';

export interface LabProfile {
  id: string;
  labName: string;
  licenseNumber: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  user: { id: string; name: string; email: string; phone?: string; avatarUrl?: string };
}

export type LabTestStatus = 'REQUESTED' | 'SAMPLE_COLLECTED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';

export interface LabResultRow {
  parameter: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  flag?: 'NORMAL' | 'LOW' | 'HIGH';
}

export interface LabResult {
  id: string;
  resultData: { results: LabResultRow[]; notes: string | null };
  uploadedAt: string;
}

export interface LabTest {
  id: string;
  testType: string;
  status: LabTestStatus;
  scheduledAt?: string | null;
  fee: string | number;
  createdAt: string;
  isPaid: boolean;
  result?: LabResult | null;
  patient: { id: string; user: { id: string; name: string; avatarUrl?: string; phone?: string } };
}

export interface LabStats {
  awaitingSample: number;
  inProgress: number;
  completedCount: number;
  todayRevenue: number;
}

export const labApi = {
  getProfile: () => api.get<LabProfile>('/lab/profile').then((r) => r.data),
  updateProfile: (data: Record<string, unknown>) => api.patch('/lab/profile', data).then((r) => r.data),

  getStats: () => api.get<LabStats>('/lab/stats').then((r) => r.data),

  listTests: (status?: string) => api.get<LabTest[]>('/lab/tests', { params: { status } }).then((r) => r.data),
  getTestDetail: (id: string) => api.get<LabTest>(`/lab/tests/${id}`).then((r) => r.data),
  updateTestStatus: (id: string, status: 'SAMPLE_COLLECTED' | 'PROCESSING' | 'CANCELLED') =>
    api.post(`/lab/tests/${id}/status`, { status }).then((r) => r.data),
  uploadResult: (id: string, results: LabResultRow[], notes?: string) =>
    api.post(`/lab/tests/${id}/result`, { results, notes }).then((r) => r.data),
};
