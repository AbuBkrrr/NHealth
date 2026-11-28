import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setUnauthorizedHandler } from '../api/client';

export interface AdminSessionUser {
  id: string;
  name: string;
  email: string;
  role: 'PATIENT' | 'DOCTOR' | 'NURSE' | 'PHARMACY' | 'LAB' | 'AMBULANCE' | 'ADMIN';
  isSuperAdmin: boolean;
  twoFactor?: string | null;
  mustSetup2fa?: boolean;
}
export interface TwoFactorStep { challenge: string; method: 'totp' | 'email'; sentTo?: string }

interface AuthContextValue {
  user: AdminSessionUser | null;
  isLoading: boolean;
  /** Returns the second step when the account has two-step verification on. */
  login: (email: string, password: string) => Promise<TwoFactorStep | void>;
  verify2fa: (challenge: string, code: string) => Promise<void>;
  /** After security changes: store a new token (if any) and merge user fields. */
  refreshSession: (token: string | null, patch: Partial<AdminSessionUser>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminSessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setUser(null);
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('admin_user');
    if (savedUser) setUser(JSON.parse(savedUser));
    setIsLoading(false);
    setUnauthorizedHandler(logout);
  }, [logout]);

  const store = (data: any) => {
    localStorage.setItem('admin_token', data.token);
    localStorage.setItem('admin_user', JSON.stringify(data.user));
    setUser(data.user);
  };
  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.twoFactorRequired) return { challenge: data.challenge, method: data.method, sentTo: data.sentTo } as TwoFactorStep;
    store(data);
  };
  const verify2fa = async (challenge: string, code: string) => { store((await api.post('/auth/2fa/verify', { challenge, code })).data); };
  const refreshSession = (token: string | null, patch: Partial<AdminSessionUser>) => {
    if (token) localStorage.setItem('admin_token', token);
    setUser((u) => { const next = u ? { ...u, ...patch } : u; if (next) localStorage.setItem('admin_user', JSON.stringify(next)); return next; });
  };

  return <AuthContext.Provider value={{ user, isLoading, login, verify2fa, refreshSession, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
