/**
 * Auth Repository
 * Handles all authentication-related API calls
 */
import { apiClient } from './apiClient';
import type { AuthResponse } from '../types';

/**
 * Google OAuth login - verify Google ID token and set JWT cookies
 */
export const googleLogin = async (credential: string): Promise<AuthResponse> => {
  const response = await apiClient.post('/auth/google', { credential });
  return response.data;
};

/**
 * Logout user and clear JWT cookies
 */
export const logout = async (): Promise<AuthResponse> => {
  const response = await apiClient.post('/auth/logout');
  return response.data;
};

/**
 * Refresh access token using refresh token
 */
export const refreshToken = async (): Promise<AuthResponse> => {
  const response = await apiClient.post('/auth/refresh');
  return response.data;
};

/**
 * Get current authenticated user info
 */
export const getMe = async (): Promise<AuthResponse> => {
  const response = await apiClient.get('/auth/me');
  return response.data;
};

/**
 * Check authentication status
 */
export const checkAuth = async (): Promise<AuthResponse> => {
  const response = await apiClient.get('/auth/check');
  return response.data;
};
