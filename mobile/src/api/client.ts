import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ACCESS_TOKEN_KEY  = 'token';
export const REFRESH_TOKEN_KEY = 'refresh_token';

const storage = {
  get:    (k: string) => Platform.OS === 'web' ? AsyncStorage.getItem(k)       : SecureStore.getItemAsync(k),
  set:    (k: string, v: string) => Platform.OS === 'web' ? AsyncStorage.setItem(k, v)    : SecureStore.setItemAsync(k, v),
  remove: (k: string) => Platform.OS === 'web' ? AsyncStorage.removeItem(k)    : SecureStore.deleteItemAsync(k),
};

export const API_URL = 'http://49.12.189.108:3000';

export function describeApiError(error: unknown) {
  const e = error as any;
  const status = e?.response?.status;
  const code = e?.code;
  const method = e?.config?.method?.toUpperCase?.();
  const url = e?.config?.url;
  const serverMessage = e?.response?.data?.message;
  const message = Array.isArray(serverMessage)
    ? serverMessage.join('\n')
    : serverMessage || e?.message || 'Unknown error';

  let userMessage = 'בדוק את החיבור לאינטרנט ונסה שוב';
  if (status === 401) userMessage = 'ההתחברות פגה. התחבר מחדש ונסה שוב';
  else if (status === 403) userMessage = 'אין הרשאה לבצע את הפעולה הזאת';
  else if (status === 429) userMessage = 'נשלחו יותר מדי בקשות. נסה שוב בעוד רגע';
  else if (status >= 500) userMessage = 'יש תקלה זמנית בשרת. נסה שוב בעוד רגע';
  else if (code === 'ECONNABORTED') userMessage = 'הבקשה לשרת לקחה יותר מדי זמן. נסה שוב';
  else if (message && message !== 'Network Error') userMessage = String(message);

  return { status, code, method, url, message: String(message), userMessage };
}

export function logApiError(context: string, error: unknown) {
  const info = describeApiError(error);
  console.warn(`[api] ${context}`, info);
  return info;
}

// ── Module-level refresh state ────────────────────────────────────────────────
let _refreshToken: string | null = null;
let _forcedLogout: (() => void) | null = null;
let _isRefreshing = false;
let _queue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];

/** Called by AuthProvider after login / on app start */
export function setClientRefreshToken(token: string | null) {
  _refreshToken = token;
}

/** Called by AuthProvider once on mount so the interceptor can trigger logout */
export function setForcedLogoutHandler(fn: () => void) {
  _forcedLogout = fn;
}

// ── Axios instance ────────────────────────────────────────────────────────────
const client = axios.create({ baseURL: API_URL, timeout: 10000 });

// Attach access token to every request
client.interceptors.request.use(async (config) => {
  const token = await storage.get(ACCESS_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401: attempt silent token refresh, then retry; on failure force logout
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status: number | undefined = error.response?.status;

    // Only intercept 401; never retry auth endpoints or already-retried requests
    if (status !== 401 || original._retry || (original.url as string)?.includes('/auth/')) {
      return Promise.reject(error);
    }

    // No refresh token — nothing to try, log out immediately
    if (!_refreshToken) {
      await storage.remove(ACCESS_TOKEN_KEY);
      _forcedLogout?.();
      return Promise.reject(error);
    }

    // Another request is already refreshing — queue this one
    if (_isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        _queue.push({ resolve, reject });
      }).then((newToken) => {
        original.headers.Authorization = `Bearer ${newToken}`;
        return client(original);
      });
    }

    original._retry = true;
    _isRefreshing = true;

    try {
      const { data } = await axios.post(`${API_URL}/auth/refresh`, {
        refreshToken: _refreshToken,
      });
      const newToken: string = data.access_token;

      await storage.set(ACCESS_TOKEN_KEY, newToken);

      _queue.forEach(({ resolve }) => resolve(newToken));
      _queue = [];

      original.headers.Authorization = `Bearer ${newToken}`;
      return client(original);
    } catch (refreshError) {
      _queue.forEach(({ reject }) => reject(refreshError));
      _queue = [];
      _refreshToken = null;
      await storage.remove(ACCESS_TOKEN_KEY);
      await storage.remove(REFRESH_TOKEN_KEY);
      _forcedLogout?.();
      return Promise.reject(refreshError);
    } finally {
      _isRefreshing = false;
    }
  },
);

export default client;
