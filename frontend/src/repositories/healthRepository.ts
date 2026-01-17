/**
 * Health Repository
 * Handles API health check calls
 */
import { apiClient } from './apiClient.ts';

/**
 * Health check endpoint (public)
 */
export async function healthCheck() {
  const response = await apiClient.get('/health');
  return response.data;
}
