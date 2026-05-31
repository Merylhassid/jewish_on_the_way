import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Production server
const PRODUCTION_URL = 'http://49.12.189.108:3000';

const getBaseUrl = (): string => {
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      return `http://${host}:3500`;
    }
  }
  return 'http://localhost:3500';
};

export const API_URL = getBaseUrl();

const client = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Attach JWT token to every request
client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401 (token expired)
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
      // Trigger re-render by clearing storage — AuthProvider will detect and redirect to login
    }
    return Promise.reject(error);
  }
);

export default client;
