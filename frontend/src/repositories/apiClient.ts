/**
 * Shared API client configuration
 * Used by all repositories for consistent HTTP configuration
 */
import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { readCsrfTokenFromCookie } from './csrfTokenRepository';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Add CSRF token to mutating requests (POST, PUT, DELETE, PATCH)
 * Excludes auth endpoints which have separate CSRF handling
 */
function addCsrfToken(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const method = config.method?.toLowerCase();
  const isMutating = method && ['post', 'put', 'delete', 'patch'].includes(method);
  const isAuthEndpoint = config.url?.includes('/auth/');

  if (isMutating && !isAuthEndpoint) {
    const csrfToken = readCsrfTokenFromCookie();
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    } else {
      console.warn('CSRF token not found in cookies');
    }
  }
  return config;
}

/**
 * Handle 401 errors by attempting token refresh
 */
function createAuthErrorHandler(client: AxiosInstance) {
  return async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;
      try {
        await apiClient.post('/auth/refresh');
        return client(originalRequest);
      } catch {
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  };
}

/**
 * Apply standard interceptors to an axios client
 */
function applyInterceptors(client: AxiosInstance): void {
  client.interceptors.request.use(addCsrfToken, (e) => Promise.reject(e));
  client.interceptors.response.use((r) => r, createAuthErrorHandler(client));
}

/**
 * Base API client with HttpOnly cookie support
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

/**
 * File upload API client for multipart/form-data
 */
export const fileUploadClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'multipart/form-data' },
  withCredentials: true,
});

applyInterceptors(apiClient);
applyInterceptors(fileUploadClient);

export default apiClient;
