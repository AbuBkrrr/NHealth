import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Point this at your machine's LAN IP when testing on a physical device
// (localhost won't resolve from the phone) - e.g. http://192.168.1.20:4000/api
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Centralized 401 handling: consumers can subscribe via setUnauthorizedHandler
// (wired up in AuthContext) so an expired token bounces the user to login.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);
