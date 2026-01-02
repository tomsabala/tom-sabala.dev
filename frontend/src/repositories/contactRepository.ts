/**
 * Contact Repository
 * Handles contact form submission API calls
 */
import { apiClient } from './apiClient';
import type { ContactFormData } from '../types';

/**
 * Submit contact form (public)
 */
export const submitContact = async (data: ContactFormData) => {
  const response = await apiClient.post('/contact', data);
  return response.data;
};
