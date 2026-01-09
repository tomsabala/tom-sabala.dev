/**
 * Portfolio Repository
 * Handles all portfolio-related API calls (public and admin)
 */
import { apiClient, fileUploadClient } from './apiClient';
import type { ProjectFormData, ProjectOrderUpdate } from '../types';

/**
 * Get portfolio projects
 * @param includeHidden - If true, fetches all projects including hidden ones (admin only)
 */
export const getPortfolio = async (includeHidden: boolean = false) => {
  const params = includeHidden ? { includeHidden: 'true' } : {};
  const response = await apiClient.get('/portfolio', { params });
  return response.data;
};

/**
 * Create a new portfolio project (admin - requires auth)
 */
export const createProject = async (project: ProjectFormData) => {
  const response = await apiClient.post('/portfolio', project);
  return response.data;
};

/**
 * Update an existing portfolio project (admin - requires auth)
 */
export const updateProject = async (id: number, project: Partial<ProjectFormData>) => {
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

/**
 * Toggle project visibility (admin - requires auth)
 */
export const toggleProjectVisibility = async (id: number) => {
  const response = await apiClient.patch(`/portfolio/${id}/visibility`);
  return response.data;
};

/**
 * Update display order for multiple projects (admin - requires auth)
 */
export const reorderProjects = async (orderUpdates: ProjectOrderUpdate[]) => {
  const response = await apiClient.patch('/portfolio/reorder', { orderUpdates });
  return response.data;
};

/**
 * Upload project image (admin - requires auth)
 */
export const uploadProjectImage = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fileUploadClient.post('/portfolio/upload-image', formData);
  return response.data;
};
