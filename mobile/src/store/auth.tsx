import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import client, {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  setClientRefreshToken,
  setForcedLogoutHandler,
} from '../api/client';

const storage = {
  get:    (k: string) => Platform.OS === 'web' ? AsyncStorage.getItem(k)            : SecureStore.getItemAsync(k),
  set:    (k: string, v: string) => Platform.OS === 'web' ? AsyncStorage.setItem(k, v)       : SecureStore.setItemAsync(k, v),
  remove: (k: string) => Platform.OS === 'web' ? AsyncStorage.removeItem(k)         : SecureStore.deleteItemAsync(k),
};

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string | null;
  kashrutLevel?: string | null;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  setSession: (access_token: string, userData: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  refreshUser: () => Promise<void>;
  getValidToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [token, setToken]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Register forced-logout handler so the axios interceptor can trigger it
  useEffect(() => {
    setForcedLogoutHandler(() => {
      setToken(null);
      setUser(null);
    });
  }, []);

  // Restore session on app start
  useEffect(() => {
    (async () => {
      const storedAccess  = await storage.get(ACCESS_TOKEN_KEY);
      const storedRefresh = await storage.get(REFRESH_TOKEN_KEY);

      if (storedAccess) {
        setToken(storedAccess);
        setClientRefreshToken(storedRefresh ?? null);

        try {
          const res = await client.get('/users/me');
          setUser(res.data);
          void registerPushToken();
        } catch {
          // Access token expired — interceptor will auto-refresh on the /users/me call;
          // if that also fails it will have already called setForcedLogoutHandler
          await storage.remove(ACCESS_TOKEN_KEY);
          await storage.remove(REFRESH_TOKEN_KEY);
          setClientRefreshToken(null);
        }
      }

      setLoading(false);
    })();
  }, []);

  const registerPushToken = async () => {
    if (!Device.isDevice) return; // simulators don't support push
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      const finalStatus = existing === 'granted'
        ? existing
        : (await Notifications.requestPermissionsAsync()).status;
      if (finalStatus !== 'granted') return;

      const tokenData = await Notifications.getExpoPushTokenAsync();
      await client.put('/users/me/push-token', { token: tokenData.data });
    } catch {
      // push registration is best-effort — never crash the app
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const res = await client.post('/auth/login', { email, password });
      const { access_token, refresh_token, user: userData } = res.data;

      await storage.set(ACCESS_TOKEN_KEY,  access_token);
      await storage.set(REFRESH_TOKEN_KEY, refresh_token);
      setClientRefreshToken(refresh_token);
      setToken(access_token);
      setUser(userData);
      void registerPushToken();
    } catch (e: any) {
      const message = e?.response?.data?.message || e?.message || 'Login failed';
      const error   = new Error(message);
      (error as any).response = e?.response;
      throw error;
    }
  };

  const register = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      await client.post('/auth/register', { email, password, firstName, lastName });
    } catch (e: any) {
      const message = e?.response?.data?.message || e?.message || 'Registration failed';
      const error   = new Error(message);
      (error as any).response = e?.response;
      throw error;
    }
  };

  const setSession = async (access_token: string, userData: User) => {
    await storage.set(ACCESS_TOKEN_KEY, access_token);
    setToken(access_token);
    setUser(userData);
    void registerPushToken();
  };

  const logout = async () => {
    // Best-effort server-side token invalidation
    try { await client.post('/auth/logout'); } catch { /* ignore */ }

    await storage.remove(ACCESS_TOKEN_KEY);
    await storage.remove(REFRESH_TOKEN_KEY);
    setClientRefreshToken(null);
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

  // Returns a guaranteed-fresh access token.
  // Decodes the JWT to check expiry; if expired or expiring within 30 s, hits
  // /users/me so the axios interceptor refreshes it transparently, then reads
  // the new token from storage.
  const getValidToken = useCallback(async (): Promise<string | null> => {
    const stored = await storage.get(ACCESS_TOKEN_KEY);
    if (!stored) return null;

    try {
      const b64 = stored.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(b64)) as { exp?: number };
      if (payload.exp && payload.exp * 1000 - Date.now() > 30_000) {
        return stored; // still valid for > 30 s
      }
    } catch { /* malformed JWT — fall through */ }

    // Expired or unparseable: make an authenticated request so the interceptor
    // refreshes the token before we read it back from storage.
    try {
      await client.get('/users/me');
      return await storage.get(ACCESS_TOKEN_KEY);
    } catch {
      return null; // interceptor already cleared tokens + fired forced logout
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, setSession, logout, updateUser, refreshUser, getValidToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
