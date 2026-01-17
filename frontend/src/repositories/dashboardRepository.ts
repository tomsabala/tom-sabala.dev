/**
 * Dashboard Repository
 * Handles admin dashboard-related API calls
 */
import { apiClient } from './apiClient.ts';
import type { DashboardStats } from '../types/index.ts';

/**
 * Get admin dashboard statistics (admin - requires auth)
 */
export async function getDashboardStats(): Promise<{ success: boolean; data: DashboardStats }> {
  const response = await apiClient.get('/dashboard/stats');
  return response.data;
}
