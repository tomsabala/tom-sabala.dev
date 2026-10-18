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
 * Set read status explicitly (admin - requires auth).
 * The console always states the value it wants; the backend still toggles on an empty body.
 */
export async function setReadStatus(id: number, read: boolean) {
  const response = await apiClient.patch(`/contact/submissions/${id}/read`, { read });
  return response.data;
}

/**
 * Mark every unarchived unread submission as read (admin - requires auth).
 */
export async function markAllRead() {
  const response = await apiClient.post('/contact/submissions/read-all');
  return response.data;
}

/**
 * Archive submission (admin - requires auth)
 */
export async function archiveSubmission(id: number) {
  const response = await apiClient.delete(`/contact/submissions/${id}`);
  return response.data;
}
