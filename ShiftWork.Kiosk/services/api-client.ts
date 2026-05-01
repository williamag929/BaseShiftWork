import axios from 'axios';
import { logger } from '@/utils/logger';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5182';

// The kiosk app uses only [AllowAnonymous] API endpoints.
// No auth token or Firebase credential is attached to any request.
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      logger.error('[Kiosk API] Error', error.response.status, error.config?.url);
    } else {
      logger.error('[Kiosk API] Network error', error.message);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
