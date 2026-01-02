/**
 * Dashboard Repository
 * Handles admin dashboard-related API calls
 */
import { apiClient } from './apiClient';
import type { DashboardStats } from '../types';

/**
 * Get admin dashboard statistics (admin - requires auth)
 */
export const getDashboardStats = async (): Promise<{ success: boolean; data: DashboardStats }> => {
  const response = await apiClient.get('/dashboard/stats');
  return response.data;
};
