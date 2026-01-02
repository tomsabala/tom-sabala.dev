/**
 * Portfolio Repository
 * Handles all portfolio-related API calls (public and admin)
 */
import { apiClient } from './apiClient';
import type { PortfolioItem } from '../types';

/**
 * Get all portfolio projects (public)
 */
export const getPortfolio = async () => {
  const response = await apiClient.get('/portfolio');
  return response.data;
};

/**
 * Create a new portfolio project (admin - requires auth)
 */
export const createProject = async (project: Omit<PortfolioItem, 'id'>) => {
  const response = await apiClient.post('/portfolio', project);
  return response.data;
};

/**
 * Update an existing portfolio project (admin - requires auth)
 */
export const updateProject = async (id: number, project: Partial<PortfolioItem>) => {
  const response = await apiClient.put(`/portfolio/${id}`, project);
  return response.data;
};

/**
 * Delete a portfolio project (admin - requires auth)
 */
export const deleteProject = async (id: number) => {
  const response = await apiClient.delete(`/portfolio/${id}`);
  return response.data;
};
