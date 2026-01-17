/**
 * About Repository
 * Handles all about-related API calls (public and admin)
 */
import { apiClient, fileUploadClient } from './apiClient.ts';
import type { AboutFormData } from '../types/index.ts';

/**
 * Get about content (public)
 */
export async function getAbout() {
  const response = await apiClient.get('/about');
  return response.data;
}

/**
 * Update about content (admin - requires auth)
 */
export async function updateAbout(data: AboutFormData) {
  const response = await apiClient.put('/about', data);
  return response.data;
}

/**
 * Upload profile photo (admin - requires auth)
 */
export async function uploadProfilePhoto(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fileUploadClient.post('/about/upload-profile-photo', formData);
  return response.data;
}
