import { api } from './client';

export interface PharmacyProfile {
  id: string;
  pharmacyName: string;
  licenseNumber: string;
  address?: string;
  operatingHours?: string;
  lat?: number | null;
  lng?: number | null;
  user: { id: string; name: string; email: string; phone?: string; avatarUrl?: string };
}

export interface InventoryItem {
  id: string;
  name: string;
  category?: string;
  stock: number;
  price: string | number;
  expiryDate?: string | null;
  supplierId?: string | null;
  supplier?: { id: string; name: string } | null;
}

export interface Supplier {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  _count?: { items: number };
}

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export interface OrderItem {
  inventoryId: string;
  name: string;
  qty: number;
  price: number;
}

export interface PharmacyOrder {
  id: string;
  items: OrderItem[];
  total: string | number;
  status: OrderStatus;
  paymentStatus: string;
  createdAt: string;
  patient: { id: string; user: { id: string; name: string; avatarUrl?: string; phone?: string } };
}

export interface PharmacyStats {
  pendingOrders: number;
  lowStockCount: number;
  totalItems: number;
  todayRevenue: number;
}

export const pharmacyApi = {
  getProfile: () => api.get<PharmacyProfile>('/pharmacy/profile').then((r) => r.data),
  updateProfile: (data: Record<string, unknown>) => api.patch('/pharmacy/profile', data).then((r) => r.data),

  getStats: () => api.get<PharmacyStats>('/pharmacy/stats').then((r) => r.data),

  listInventory: () => api.get<InventoryItem[]>('/pharmacy/inventory').then((r) => r.data),
  createInventoryItem: (data: Partial<InventoryItem>) => api.post('/pharmacy/inventory', data).then((r) => r.data),
  updateInventoryItem: (id: string, data: Partial<InventoryItem>) =>
    api.patch(`/pharmacy/inventory/${id}`, data).then((r) => r.data),
  deleteInventoryItem: (id: string) => api.delete(`/pharmacy/inventory/${id}`),

  listSuppliers: () => api.get<Supplier[]>('/pharmacy/suppliers').then((r) => r.data),
  createSupplier: (data: Partial<Supplier>) => api.post('/pharmacy/suppliers', data).then((r) => r.data),
  updateSupplier: (id: string, data: Partial<Supplier>) => api.patch(`/pharmacy/suppliers/${id}`, data).then((r) => r.data),
  deleteSupplier: (id: string) => api.delete(`/pharmacy/suppliers/${id}`),

  listOrders: (status?: string) =>
    api.get<PharmacyOrder[]>('/pharmacy/orders', { params: { status } }).then((r) => r.data),
  getOrderDetail: (id: string) => api.get<PharmacyOrder>(`/pharmacy/orders/${id}`).then((r) => r.data),
  updateOrderStatus: (id: string, status: OrderStatus) =>
    api.post(`/pharmacy/orders/${id}/status`, { status }).then((r) => r.data),
};
