/**
 * Health Repository
 * Handles API health check calls
 */
import { apiClient } from './apiClient';

/**
 * Health check endpoint (public)
 */
export const healthCheck = async () => {
  const response = await apiClient.get('/health');
  return response.data;
};
