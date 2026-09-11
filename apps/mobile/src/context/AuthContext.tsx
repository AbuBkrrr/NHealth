import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setUnauthorizedHandler } from '../api/client';

export type Role = 'PATIENT' | 'DOCTOR' | 'PHARMACY' | 'LAB' | 'AMBULANCE' | 'NURSE';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl?: string | null;
  phone?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    role: Role;
    profile?: Record<string, unknown>;
  }) => Promise<void>;
  logout: () => Promise<void>;
  /** Patches the locally cached user (e.g. after uploading a new avatar) without a round trip through login/register. */
  updateUser: (patch: Partial<AuthUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove(['token', 'user']);
    setToken(null);
    setUser(null);
  }, []);

  // Restore a saved session on cold start.
  useEffect(() => {
    (async () => {
      const [savedToken, savedUser] = await AsyncStorage.multiGet(['token', 'user']);
      if (savedToken[1] && savedUser[1]) {
        setToken(savedToken[1]);
        setUser(JSON.parse(savedUser[1]));
      }
      setIsLoading(false);
    })();
    // If any request comes back 401, drop the session so the user re-authenticates.
    setUnauthorizedHandler(() => logout());
  }, [logout]);

  const persistSession = async (newToken: string, newUser: AuthUser) => {
    await AsyncStorage.multiSet([['token', newToken], ['user', JSON.stringify(newUser)]]);
    setToken(newToken);
    setUser(newUser);
  };

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    await persistSession(data.token, data.user);
  };

  const register: AuthContextValue['register'] = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    await persistSession(data.token, data.user);
  };

  const updateUser: AuthContextValue['updateUser'] = async (patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      AsyncStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
