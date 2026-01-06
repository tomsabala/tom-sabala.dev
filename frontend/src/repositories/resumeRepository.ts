/**
 * Resume Repository
 * Handles all resume/CV-related API calls (public and admin)
 */
import { apiClient, fileUploadClient } from './apiClient';
import type { CVData, PdfUploadResponse } from '../types';

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

// ========================================
// PDF RESUME FUNCTIONS
// ========================================

/**
 * Get active PDF metadata (public)
 */
export const getActivePdf = async () => {
  const response = await apiClient.get('/cv/pdf');
  return response.data;
};

/**
 * Get PDF file URL for viewing/downloading (public)
 * Frontend controls whether to view inline or download via HTML attributes
 */
export const getPdfFileUrl = () => {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  return `${baseUrl}/cv/pdf/file`;
};

/**
 * Upload new PDF resume (admin - requires auth)
 */
export const uploadPdf = async (file: File): Promise<PdfUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fileUploadClient.post('/cv/pdf/upload', formData);
  return response.data;
};

/**
 * Get PDF version history (admin - requires auth)
 */
export const getPdfHistory = async (includeDeleted = false) => {
  const response = await apiClient.get('/cv/pdf/history', {
    params: { includeDeleted }
  });
  return response.data;
};

/**
 * Activate a specific PDF version - restore from history (admin - requires auth)
 */
export const activatePdfVersion = async (versionId: number) => {
  const response = await apiClient.put(`/cv/pdf/${versionId}/activate`);
  return response.data;
};

/**
 * Soft delete a PDF version (admin - requires auth)
 */
export const deletePdfVersion = async (versionId: number) => {
  const response = await apiClient.delete(`/cv/pdf/${versionId}`);
  return response.data;
};
