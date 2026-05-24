import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Production server
const PRODUCTION_URL = 'http://49.12.189.108:3000';

const getBaseUrl = (): string => {
  return PRODUCTION_URL;
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
