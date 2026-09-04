import { api } from './client';

export interface DoctorAppointment {
  id: string;
  scheduledAt: string;
  type: 'IN_PERSON' | 'VIDEO';
  status: string;
  reason?: string;
  notes?: string;
  patient: { id: string; user: { id: string; name: string; avatarUrl?: string } };
}

export interface DoctorPatient {
  id: string;
  bloodType?: string;
  allergies?: string;
  user: { id: string; name: string; avatarUrl?: string };
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  durationDays: number;
}

export interface Prescription {
  id: string;
  medications: Medication[];
  status: string;
  issuedAt: string;
}

export interface PatientDetail {
  patient: DoctorPatient & { address?: string; emergencyContact?: string; emergencyPhone?: string };
  appointments: DoctorAppointment[];
  prescriptions: Prescription[];
}

export const doctorApi = {
  getProfile: () => api.get('/doctor/profile').then((r) => r.data),
  updateProfile: (data: Record<string, unknown>) => api.patch('/doctor/profile', data).then((r) => r.data),

  listAppointments: (status?: string) =>
    api.get<DoctorAppointment[]>('/doctor/appointments', { params: { status } }).then((r) => r.data),
  respondToAppointment: (id: string, action: 'CONFIRM' | 'CANCEL' | 'COMPLETE', notes?: string) =>
    api.post(`/doctor/appointments/${id}/respond`, { action, notes }).then((r) => r.data),

  listPatients: () => api.get<DoctorPatient[]>('/doctor/patients').then((r) => r.data),
  getPatientDetail: (patientId: string) => api.get<PatientDetail>(`/doctor/patients/${patientId}`).then((r) => r.data),

  createPrescription: (patientId: string, medications: Medication[]) =>
    api.post('/doctor/prescriptions', { patientId, medications }).then((r) => r.data),
  listPrescriptions: (patientId?: string) =>
    api.get<Prescription[]>('/doctor/prescriptions', { params: { patientId } }).then((r) => r.data),
};
