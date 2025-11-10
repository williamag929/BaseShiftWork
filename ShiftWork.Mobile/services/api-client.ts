import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { getAuth } from 'firebase/auth';

// Use environment variables or constants
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://localhost:5001';
const API_TIMEOUT = 30000;

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        const auth = getAuth();
        const user = auth.currentUser;
        
        if (user) {
          const token = await user.getIdToken();
          config.headers.Authorization = `Bearer ${token}`;
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
    const response = await this.client.get<T>(url, config);
    return response.data;
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
}

export const apiClient = new ApiClient();
