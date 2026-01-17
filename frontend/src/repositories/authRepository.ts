/**
 * Auth Repository
 * Handles all authentication-related API calls
 */
import { apiClient } from './apiClient.ts';
import type { AuthResponse } from '../types/index.ts';

/**
 * Google OAuth login - verify Google ID token and set JWT cookies
 */
export async function googleLogin(credential: string): Promise<AuthResponse> {
  const response = await apiClient.post('/auth/google', { credential });
  return response.data;
}

/**
 * Logout user and clear JWT cookies
 */
export async function logout(): Promise<AuthResponse> {
  const response = await apiClient.post('/auth/logout');
  return response.data;
}

/**
 * Refresh access token using refresh token
 */
export async function refreshToken(): Promise<AuthResponse> {
  const response = await apiClient.post('/auth/refresh');
  return response.data;
}

/**
 * Get current authenticated user info
 */
export async function getMe(): Promise<AuthResponse> {
  const response = await apiClient.get('/auth/me');
  return response.data;
}

/**
 * Check authentication status
 */
export async function checkAuth(): Promise<AuthResponse> {
  const response = await apiClient.get('/auth/check');
  return response.data;
}
