/**
 * Contact Repository
 * Handles contact form submission API calls
 */
import { apiClient } from './apiClient';
import type { ContactFormData } from '../types';

/**
 * Submit contact form (public)
 * @param data - Contact form data
 * @param csrfToken - CSRF token to send in header (for cross-site partitioned cookies)
 */
export const submitContact = async (data: ContactFormData, csrfToken: string) => {
  const response = await apiClient.post('/contact', data, {
    headers: {
      'X-CSRF-Token': csrfToken,
    },
  });
  return response.data;
};

/**
 * Get all contact submissions (admin - requires auth)
 */
export const getSubmissions = async (
  limit: number = 50,
  offset: number = 0,
  read: 'all' | 'read' | 'unread' = 'all',
  includeArchived: boolean = false
) => {
  const params = {
    limit,
    offset,
    read,
    includeArchived: includeArchived.toString()
  };
  const response = await apiClient.get('/contact/submissions', { params });
  return response.data;
};

/**
 * Get single submission by ID (admin - requires auth)
 */
export const getSubmissionById = async (id: number) => {
  const response = await apiClient.get(`/contact/submissions/${id}`);
  return response.data;
};

/**
 * Toggle read/unread status (admin - requires auth)
 */
export const toggleReadStatus = async (id: number) => {
  const response = await apiClient.patch(`/contact/submissions/${id}/read`);
  return response.data;
};

/**
 * Archive submission (admin - requires auth)
 */
export const archiveSubmission = async (id: number) => {
  const response = await apiClient.delete(`/contact/submissions/${id}`);
  return response.data;
};
