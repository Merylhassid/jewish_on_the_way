import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Auto-detect the dev server host so it works on simulator, emulator, and physical device
const getBaseUrl = (): string => {
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      return `http://${host}:3001`;
    }
  }
  return 'http://localhost:3001';
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

export default client;
