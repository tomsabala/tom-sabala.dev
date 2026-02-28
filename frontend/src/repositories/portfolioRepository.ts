/**
 * Portfolio Repository
 * Handles all portfolio-related API calls (public and admin)
 */
import { apiClient, fileUploadClient } from './apiClient.ts';
import type { ProjectFormData, ProjectOrderUpdate } from '../types/index.ts';

/**
 * Get portfolio projects
 * @param includeHidden - If true, fetches all projects including hidden ones (admin only)
 */
export async function getPortfolio(includeHidden: boolean = false) {
  const params = includeHidden ? { includeHidden: 'true' } : {};
  const response = await apiClient.get('/portfolio', { params });
  return response.data;
}

/**
 * Create a new portfolio project (admin - requires auth)
 */
export async function createProject(project: ProjectFormData) {
  const response = await apiClient.post('/portfolio', project);
  return response.data;
}

/**
 * Update an existing portfolio project (admin - requires auth)
 */
export async function updateProject(id: number, project: Partial<ProjectFormData>) {
  const response = await apiClient.put(`/portfolio/${id}`, project);
  return response.data;
}

/**
 * Delete a portfolio project (admin - requires auth)
 */
export async function deleteProject(id: number) {
  const response = await apiClient.delete(`/portfolio/${id}`);
  return response.data;
}

/**
 * Toggle project visibility (admin - requires auth)
 */
export async function toggleProjectVisibility(id: number) {
  const response = await apiClient.patch(`/portfolio/${id}/visibility`);
  return response.data;
}

/**
 * Update display order for multiple projects (admin - requires auth)
 */
export async function reorderProjects(orderUpdates: ProjectOrderUpdate[]) {
  const response = await apiClient.patch('/portfolio/reorder', { orderUpdates });
  return response.data;
}

/**
 * Get a single portfolio project by ID (public)
 */
export async function getProject(id: number) {
  const response = await apiClient.get(`/portfolio/${id}`);
  return response.data;
}

/**
 * Get the deep-dive markdown for a project (public)
 */
export async function getProjectDeepDive(id: number) {
  const response = await apiClient.get(`/portfolio/${id}/deep-dive`);
  return response.data;
}

/**
 * Upload project image (admin - requires auth)
 */
export async function uploadProjectImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fileUploadClient.post('/portfolio/upload-image', formData);
  return response.data;
}
