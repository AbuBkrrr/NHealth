import { api } from './client';

export interface AmbulanceProfile {
  id: string;
  vehicleNumber: string;
  licenseNumber: string;
  currentLat?: number | null;
  currentLng?: number | null;
  isAvailable: boolean;
  user: { id: string; name: string; email: string; phone?: string; avatarUrl?: string };
}

export type EmergencyStatus = 'REQUESTED' | 'ACCEPTED' | 'EN_ROUTE' | 'ARRIVED' | 'COMPLETED' | 'CANCELLED';

export interface EmergencyRequest {
  id: string;
  lat: number;
  lng: number;
  notes?: string | null;
  status: EmergencyStatus;
  requestedAt: string;
  completedAt?: string | null;
  patient: { id: string; user: { id: string; name: string; phone?: string; avatarUrl?: string } };
}

export interface AmbulanceStats {
  availableCount: number;
  activeCount: number;
  completedToday: number;
  completedTotal: number;
}

export const ambulanceApi = {
  getProfile: () => api.get<AmbulanceProfile>('/ambulance/profile').then((r) => r.data),
  updateProfile: (data: Record<string, unknown>) => api.patch('/ambulance/profile', data).then((r) => r.data),
  setAvailability: (isAvailable: boolean) => api.patch('/ambulance/availability', { isAvailable }).then((r) => r.data),
  updateLocation: (lat: number, lng: number) => api.post('/ambulance/location', { lat, lng }).then((r) => r.data),

  getStats: () => api.get<AmbulanceStats>('/ambulance/stats').then((r) => r.data),

  listAvailable: () => api.get<EmergencyRequest[]>('/ambulance/requests/available').then((r) => r.data),
  listMine: (status?: string) =>
    api.get<EmergencyRequest[]>('/ambulance/requests/mine', { params: { status } }).then((r) => r.data),
  getRequestDetail: (id: string) => api.get<EmergencyRequest>(`/ambulance/requests/${id}`).then((r) => r.data),
  acceptRequest: (id: string) => api.post(`/ambulance/requests/${id}/accept`).then((r) => r.data),
  updateRequestStatus: (id: string, status: 'EN_ROUTE' | 'ARRIVED' | 'COMPLETED' | 'CANCELLED') =>
    api.post(`/ambulance/requests/${id}/status`, { status }).then((r) => r.data),
};
