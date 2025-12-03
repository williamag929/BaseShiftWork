import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { getAuth } from 'firebase/auth';

// Resolve API base URL, rewriting localhost/0.0.0.0 to the Expo host when running on device
const resolveApiBaseUrl = () => {
  let base = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001';
  // If base points to localhost/0.0.0.0, try to replace with Expo dev host IP
  const isLocalHost = /^(https?:\/\/)?(0\.0\.0\.0|localhost)(:\d+)?/i.test(base);
  if (isLocalHost) {
    const hostUri: string | undefined =
      // SDK 49/50
      (Constants as any)?.expoConfig?.hostUri ||
      // Fallbacks for older/newer shapes
      (Constants as any)?.manifest?.hostUri ||
      (Constants as any)?.manifest2?.extra?.expoClient?.hostUri;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      const scheme = base.startsWith('https') ? 'https' : 'http';
      const portMatch = base.match(/:(\d+)(\/|$)/);
      const port = portMatch ? portMatch[1] : undefined;
      const rebuilt = `${scheme}://${host}${port ? `:${port}` : ''}`;
      // Only accept if host looks like an IP
      if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        base = rebuilt;
      }
    }
  }
  return base;
};

const API_BASE_URL = resolveApiBaseUrl();
const API_TIMEOUT = 30000;

class ApiClient {
  private client: AxiosInstance;
  private inflight: Map<string, Promise<any>> = new Map();

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Helpful during dev to verify the resolved API base
    if (__DEV__) {
      // Avoid noisy logs in production
      // eslint-disable-next-line no-console
      console.log('[API] Base URL:', this.client.defaults.baseURL);
    }

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        const auth = getAuth();
        const user = auth.currentUser;
        
        if (user) {
          const token = await user.getIdToken();
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Workaround Android RN cache rename bug: avoid shared cache entries
        // Add no-cache headers and a small cache-busting param for GETs
        if (config.method?.toLowerCase() === 'get') {
          config.headers['Cache-Control'] = 'no-cache';
          config.headers['Pragma'] = 'no-cache';
          const ts = Date.now();
          const existingParams = (config.params ?? {}) as Record<string, any>;
          const { noCacheBust, ...rest } = existingParams;
          // Only add cache buster if caller didn't explicitly opt-out
          if (!noCacheBust) {
            config.params = { ...rest, _ts: ts };
          } else {
            config.params = rest; // strip the flag from the outgoing request
          }
        }
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          // Server responded with error status
          console.error('API Error:', error.response.data);
          return Promise.reject({
            message: error.response.data.message || 'An error occurred',
            statusCode: error.response.status,
            errors: error.response.data.errors,
          });
        } else if (error.request) {
          // Request made but no response
          console.error('Network Error:', error.request);
          return Promise.reject({
            message: 'Network error. Please check your connection.',
            statusCode: 0,
          });
        } else {
          // Something else happened
          console.error('Error:', error.message);
          return Promise.reject({
            message: error.message,
            statusCode: -1,
          });
        }
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const paramsKey = JSON.stringify(config?.params ?? {});
    const key = `GET ${url}?${paramsKey}`;
    const existing = this.inflight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }
    const p = this.client
      .get<T>(url, config)
      .then((response) => {
        this.inflight.delete(key);
        return response.data;
      })
      .catch((err) => {
        this.inflight.delete(key);
        throw err;
      });
    this.inflight.set(key, p);
    return p as Promise<T>;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  // Update base URL if needed
  setBaseURL(url: string) {
    this.client.defaults.baseURL = url;
  }

  // Get the current base URL
  async getBaseURL(): Promise<string> {
    return this.client.defaults.baseURL || API_BASE_URL;
  }
}

export const apiClient = new ApiClient();
