import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) onUnauthorized?.();
    return Promise.reject(error);
  }
);

export function getErrorMessage(err: unknown, fallback = 'Please try again.'): string {
  const anyErr = err as any;
  if (anyErr?.response?.data?.error) return anyErr.response.data.error as string;
  if (anyErr?.message === 'Network Error') return "Can't reach the server. Check your connection.";
  return fallback;
}
