import { api } from './client';

export type PayableType = 'APPOINTMENT' | 'PHARMACY_ORDER' | 'LAB_TEST' | 'NURSE_REQUEST' | 'DONATION' | 'INSURANCE_POLICY';
export type PaymentMethod = 'USSD' | 'TRANSFER' | 'CARD' | 'WALLET' | 'CASH';
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
  /** N-Health coins balance. */
  balance: () => api.get<{ balance: number }>('/credits/balance').then((r) => Number(r.data.balance) || 0),
  /** Public runtime config: which payment options are live. */
  config: () => api.get<{ cashEnabled?: boolean; escrow?: boolean; gateways?: string[] }>('/config').then((r) => r.data),
  /** Card/transfer/USSD checkout that pays the provider (or their institution) directly, minus N-Health fees. */
  card: (payableType: PayableType, payableId: string) =>
    api.post<{ checkoutUrl?: string; internalRef: string }>('/payments/card', { payableType, payableId }).then((r) => r.data),
  /** Starts a PayScrow escrow checkout; amount is computed by the server. */
  escrow: (purpose: string, purposeId: string, description: string) =>
    api.post<{ paymentLink?: string; escrowId: string }>('/escrow/initiate', { purpose, purposeId, description }).then((r) => r.data),
};

/** Web app URL - used for coin top-ups (card/transfer/USSD via Paystack or Flutterwave) and features not yet native. */
export const WEB_APP_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.nhealth.com.ng').replace(/\/$/, '');
