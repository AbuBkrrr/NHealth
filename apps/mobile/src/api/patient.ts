import { api } from './client';

export interface Appointment {
  id: string;
  scheduledAt: string;
  type: 'IN_PERSON' | 'VIDEO';
  status: string;
  reason?: string;
  doctor: { user: { name: string; avatarUrl?: string } };
}

export interface PharmacyOrder {
  id: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  status: string;
  createdAt: string;
  pharmacy: { user: { name: string } };
}

export interface LabTest {
  id: string;
  testType: string;
  status: string;
  scheduledAt?: string;
  lab: { user: { name: string } };
  result?: { resultData: unknown; uploadedAt: string } | null;
}

export interface Donation {
  id: string;
  campaign: string;
  amount: number;
  status: string;
  createdAt: string;
}

export interface InsurancePolicy {
  id: string;
  provider: string;
  policyNumber: string;
  coverageDetails?: string;
  premiumAmount?: string | number;
  status: string;
}

export const patientApi = {
  getProfile: () => api.get('/patient/profile').then((r) => r.data),
  updateProfile: (data: Record<string, unknown>) => api.patch('/patient/profile', data).then((r) => r.data),

  listAppointments: () => api.get<Appointment[]>('/patient/appointments').then((r) => r.data),
  createAppointment: (data: { doctorId: string; scheduledAt: string; type: string; reason?: string }) =>
    api.post('/patient/appointments', data).then((r) => r.data),
  cancelAppointment: (id: string) => api.post(`/patient/appointments/${id}/cancel`).then((r) => r.data),

  listOrders: () => api.get<PharmacyOrder[]>('/patient/orders').then((r) => r.data),
  createOrder: (data: { pharmacyId: string; items: { inventoryId: string; name: string; qty: number; price: number }[] }) =>
    api.post('/patient/orders', data).then((r) => r.data),

  listPrescriptions: () => api.get('/patient/prescriptions').then((r) => r.data),

  listLabTests: () => api.get<LabTest[]>('/patient/lab-tests').then((r) => r.data),
  createLabTest: (data: { labId: string; testType: string; scheduledAt?: string }) =>
    api.post('/patient/lab-tests', data).then((r) => r.data),

  listEmergencyRequests: () => api.get('/patient/emergency').then((r) => r.data),
  requestEmergency: (data: { lat: number; lng: number; notes?: string }) =>
    api.post('/patient/emergency', data).then((r) => r.data),
  cancelEmergencyRequest: (id: string) => api.post(`/patient/emergency/${id}/cancel`).then((r) => r.data),

  requestNurse: (data: { nurseId?: string; serviceType: string; scheduledAt?: string; notes?: string }) =>
    api.post('/patient/nurse-requests', data).then((r) => r.data),

  listDonations: () => api.get<Donation[]>('/patient/donations').then((r) => r.data),
  createDonation: (data: { campaign: string; amount: number }) =>
    api.post('/patient/donations', data).then((r) => r.data),

  listInsurance: () => api.get<InsurancePolicy[]>('/patient/insurance').then((r) => r.data),
  addInsurance: (data: { provider: string; policyNumber: string; coverageDetails?: string; premiumAmount?: number }) =>
    api.post('/patient/insurance', data).then((r) => r.data),
};

export const providerApi = {
  listDoctors: (specialty?: string, coords?: { lat: number; lng: number }) =>
    api.get('/providers/doctors', { params: { specialty, ...coords } }).then((r) => r.data),
  listPharmacies: (coords?: { lat: number; lng: number }) =>
    api.get('/providers/pharmacies', { params: coords }).then((r) => r.data),
  pharmacyInventory: (pharmacyId: string) => api.get(`/providers/pharmacies/${pharmacyId}/inventory`).then((r) => r.data),
  listLabs: (coords?: { lat: number; lng: number }) =>
    api.get('/providers/labs', { params: coords }).then((r) => r.data),
  listAmbulances: (coords?: { lat: number; lng: number }) =>
    api.get('/providers/ambulances', { params: coords }).then((r) => r.data),
  listNurses: () => api.get('/providers/nurses').then((r) => r.data),
};

export const messageApi = {
  listConversations: () => api.get('/messages/conversations').then((r) => r.data),
  getThread: (partnerId: string) => api.get(`/messages/conversations/${partnerId}`).then((r) => r.data),
  send: (receiverId: string, content: string) => api.post('/messages', { receiverId, content }).then((r) => r.data),
};
