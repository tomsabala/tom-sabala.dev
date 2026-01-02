/**
 * Resume Repository
 * Handles all resume/CV-related API calls (public and admin)
 */
import { apiClient } from './apiClient';
import type { CVData } from '../types';

/**
 * Get CV/Resume data (public)
 */
export const getCV = async () => {
  const response = await apiClient.get('/cv');
  return response.data;
};

/**
 * Update CV/Resume data (admin - requires auth)
 */
export const updateCV = async (cvData: Partial<CVData>) => {
  const response = await apiClient.put('/cv', cvData);
  return response.data;
};
