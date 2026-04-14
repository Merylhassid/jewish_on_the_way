import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string | null;
  kashrutLevel?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session on app start
    AsyncStorage.getItem('token').then((stored) => {
      if (stored) {
        setToken(stored);
        client.get('/users/me').then((res) => setUser(res.data)).catch(() => {
          AsyncStorage.removeItem('token');
        });
      }
      setLoading(false);
    });
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await client.post('/auth/login', { email, password });
      const { access_token, user: userData } = res.data;
      await AsyncStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData);
    } catch (e: any) {
      // Re-throw with clearer error message
      const message = e?.response?.data?.message || e?.message || 'Login failed';
      const error = new Error(message);
      (error as any).response = e?.response; // Keep original response for caller
      throw error;
    }
  };

  const register = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      await client.post('/auth/register', { email, password, firstName, lastName });
      await login(email, password);
    } catch (e: any) {
      // Re-throw with clearer error message
      const message = e?.response?.data?.message || e?.message || 'Registration failed';
      const error = new Error(message);
      (error as any).response = e?.response;
      throw error;
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const updateUser = (updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const refreshUser = async () => {
    const res = await client.get('/users/me');
    setUser(res.data);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
