import { api } from './client';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
}

export interface Stats {
  usersByRole: Record<string, number>;
  pendingAppointments: number;
  pendingPayments: number;
  openEmergencies: number;
  totalDonations: number;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  detail?: string;
  createdAt: string;
  actor: { name: string; email: string };
}

export const adminApi = {
  getStats: () => api.get<Stats>('/admin/stats').then((r) => r.data),

  listUsers: (params: { role?: string; search?: string; isActive?: string; page?: number }) =>
    api.get<{ users: AdminUser[]; total: number; page: number; pageSize: number }>('/admin/users', { params }).then((r) => r.data),
  getUserDetail: (id: string) => api.get(`/admin/users/${id}`).then((r) => r.data),
  setUserStatus: (id: string, isActive: boolean) =>
    api.patch(`/admin/users/${id}/status`, { isActive }).then((r) => r.data),

  listAdmins: () => api.get<AdminAccount[]>('/admin/admins').then((r) => r.data),
  createAdmin: (data: { name: string; email: string; password: string; phone?: string; isSuperAdmin: boolean }) =>
    api.post('/admin/admins', data).then((r) => r.data),
  updateAdmin: (id: string, data: { isActive?: boolean; isSuperAdmin?: boolean }) =>
    api.patch(`/admin/admins/${id}`, data).then((r) => r.data),
  deleteAdmin: (id: string) => api.delete(`/admin/admins/${id}`),

  listAuditLog: () => api.get<AuditLogEntry[]>('/admin/audit-log').then((r) => r.data),
};
