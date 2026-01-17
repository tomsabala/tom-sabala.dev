/**
 * Contact Repository
 * Handles contact form submission API calls
 */
import { apiClient } from './apiClient.ts';
import type { ContactFormData } from '../types/index.ts';

/**
 * Submit contact form (public)
 * @param data - Contact form data
 * @param csrfToken - CSRF token to send in header (for cross-site partitioned cookies)
 */
export async function submitContact(data: ContactFormData, csrfToken: string) {
  const response = await apiClient.post('/contact', data, {
    headers: {
      'X-CSRF-Token': csrfToken,
    },
  });
  return response.data;
}

/**
 * Get all contact submissions (admin - requires auth)
 */
export async function getSubmissions(
  limit: number = 50,
  offset: number = 0,
  read: 'all' | 'read' | 'unread' = 'all',
  includeArchived: boolean = false
) {
  const params = {
    limit,
    offset,
    read,
    includeArchived: includeArchived.toString()
  };
  const response = await apiClient.get('/contact/submissions', { params });
  return response.data;
}

/**
 * Get single submission by ID (admin - requires auth)
 */
export async function getSubmissionById(id: number) {
  const response = await apiClient.get(`/contact/submissions/${id}`);
  return response.data;
}

/**
 * Toggle read/unread status (admin - requires auth)
 */
export async function toggleReadStatus(id: number) {
  const response = await apiClient.patch(`/contact/submissions/${id}/read`);
  return response.data;
}

/**
 * Archive submission (admin - requires auth)
 */
export async function archiveSubmission(id: number) {
  const response = await apiClient.delete(`/contact/submissions/${id}`);
  return response.data;
}
