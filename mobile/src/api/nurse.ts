import { api } from './client';

export interface NurseProfile {
  id: string;
  specialty?: string | null;
  hourlyRate: string | number;
  licenseNumber: string;
  isAvailable: boolean;
  user: { id: string; name: string; email: string; phone?: string; avatarUrl?: string };
}

export type NurseRequestStatus = 'REQUESTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface NurseRequest {
  id: string;
  serviceType: string;
  scheduledAt?: string | null;
  status: NurseRequestStatus;
  notes?: string | null;
  createdAt: string;
  isPaid?: boolean;
  patient: { id: string; user: { id: string; name: string; phone?: string; avatarUrl?: string } };
}

export interface NurseStats {
  awaitingCount: number;
  activeCount: number;
  completedToday: number;
  todayRevenue: number;
}

export const nurseApi = {
  getProfile: () => api.get<NurseProfile>('/nurse/profile').then((r) => r.data),
  updateProfile: (data: Record<string, unknown>) => api.patch('/nurse/profile', data).then((r) => r.data),
  setAvailability: (isAvailable: boolean) => api.patch('/nurse/availability', { isAvailable }).then((r) => r.data),

  getStats: () => api.get<NurseStats>('/nurse/stats').then((r) => r.data),

  listAvailable: () => api.get<NurseRequest[]>('/nurse/requests/available').then((r) => r.data),
  listMine: (status?: string) => api.get<NurseRequest[]>('/nurse/requests/mine', { params: { status } }).then((r) => r.data),
  getRequestDetail: (id: string) => api.get<NurseRequest>(`/nurse/requests/${id}`).then((r) => r.data),
  acceptRequest: (id: string) => api.post(`/nurse/requests/${id}/accept`).then((r) => r.data),
  updateRequestStatus: (id: string, status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') =>
    api.post(`/nurse/requests/${id}/status`, { status }).then((r) => r.data),
};
