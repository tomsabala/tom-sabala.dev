/**
 * Shared API client configuration
 * Used by all repositories for consistent HTTP configuration
 */
import axios from 'axios';
import { readCsrfTokenFromCookie } from './csrfTokenRepository';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Base API client with HttpOnly cookie support
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // CRITICAL: Enables HttpOnly cookies for JWT auth
});

/**
 * Request interceptor: Automatically attach CSRF token to mutating requests.
 * Token is read from cookie and sent in X-CSRF-Token header.
 *
 * Applied to: POST, PUT, DELETE, PATCH methods
 * Excluded: Auth endpoints (different CSRF handling)
 */
apiClient.interceptors.request.use(
  (config) => {
    // Only add CSRF token to mutating requests (not GET/HEAD/OPTIONS)
    const requestMethod = config.method?.toLowerCase();
    const isMutatingRequest = requestMethod && ['post', 'put', 'delete', 'patch'].includes(requestMethod);

    if (isMutatingRequest) {
      // Exclude auth endpoints (they have their own security)
      const isAuthEndpoint = config.url?.includes('/auth/');

      if (!isAuthEndpoint) {
        const csrfToken = readCsrfTokenFromCookie();

        if (csrfToken) {
          config.headers['X-CSRF-Token'] = csrfToken;
        } else {
          console.warn('CSRF token not found in cookies for mutating request');
        }
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * 401 Response Interceptor - Automatic token refresh
 * Catches unauthorized errors and attempts to refresh the access token
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't retry if:
    // 1. Already retried
    // 2. The request itself was to /auth/refresh (prevent infinite loop)
    // 3. Not a 401 error
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;

      try {
        // Attempt to refresh the token
        await apiClient.post('/auth/refresh');

        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed - user can re-login via hidden trigger
        // Don't redirect since there's no /login page
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * File upload API client for multipart/form-data
 * Used for PDF uploads and other file operations
 */
export const fileUploadClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'multipart/form-data',
  },
  withCredentials: true, // CRITICAL: Enables HttpOnly cookies for JWT auth
});

/**
 * Apply same CSRF request interceptor to file upload client
 * Ensures file uploads also include CSRF tokens
 */
fileUploadClient.interceptors.request.use(
  (config) => {
    // Only add CSRF token to mutating requests (not GET/HEAD/OPTIONS)
    const requestMethod = config.method?.toLowerCase();
    const isMutatingRequest = requestMethod && ['post', 'put', 'delete', 'patch'].includes(requestMethod);

    if (isMutatingRequest) {
      // Exclude auth endpoints (they have their own security)
      const isAuthEndpoint = config.url?.includes('/auth/');

      if (!isAuthEndpoint) {
        const csrfToken = readCsrfTokenFromCookie();

        if (csrfToken) {
          config.headers['X-CSRF-Token'] = csrfToken;
        } else {
          console.warn('CSRF token not found in cookies for file upload request');
        }
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Apply same 401 interceptor to file upload client
 * Ensures file uploads can also refresh tokens automatically
 */
fileUploadClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;

      try {
        // Attempt to refresh the token using main apiClient
        await apiClient.post('/auth/refresh');

        // Retry the original file upload request
        return fileUploadClient(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
