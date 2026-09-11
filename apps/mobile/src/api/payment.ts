import { api } from './client';

export type PayableType = 'APPOINTMENT' | 'PHARMACY_ORDER' | 'LAB_TEST' | 'NURSE_REQUEST' | 'DONATION' | 'INSURANCE_POLICY';
export type PaymentMethod = 'USSD' | 'TRANSFER' | 'CARD' | 'WALLET';
export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED' | 'FAILED';

export interface Payment {
  id: string;
  payerId: string;
  payableType: PayableType;
  payableId: string;
  amount: string | number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string;
  providerUserId?: string | null;
  ussdCode?: string | null;
  transferBankName?: string | null;
  transferAccountName?: string | null;
  transferAccountNumber?: string | null;
  expiresAt: string;
  confirmedAt?: string | null;
  createdAt: string;
  payer?: { name: string };
}

export const paymentApi = {
  create: (payableType: PayableType, payableId: string, method: PaymentMethod) =>
    api.post<Payment>('/payments', { payableType, payableId, method }).then((r) => r.data),
  get: (id: string) => api.get<Payment>(`/payments/${id}`).then((r) => r.data),
  listMine: () => api.get<Payment[]>('/payments/mine').then((r) => r.data),
  listIncoming: () => api.get<Payment[]>('/payments/incoming').then((r) => r.data),
  confirm: (id: string) => api.post<Payment>(`/payments/${id}/confirm`).then((r) => r.data),
  cancel: (id: string) => api.post<Payment>(`/payments/${id}/cancel`).then((r) => r.data),
};
