/**
 * Resume Repository
 * Handles all resume/CV-related API calls (public and admin)
 */
import { apiClient, fileUploadClient } from './apiClient.ts';
import type { CVData, PdfUploadResponse } from '../types/index.ts';

/**
 * Get CV/Resume data (public)
 */
export async function getCV() {
  const response = await apiClient.get('/cv');
  return response.data;
}

/**
 * Update CV/Resume data (admin - requires auth)
 */
export async function updateCV(cvData: Partial<CVData>) {
  const response = await apiClient.put('/cv', cvData);
  return response.data;
}

// ========================================
// PDF RESUME FUNCTIONS
// ========================================

/**
 * Get active PDF metadata (public)
 */
export async function getActivePdf() {
  const response = await apiClient.get('/cv/pdf');
  return response.data;
}

/**
 * Get PDF file URL for inline viewing (public)
 */
export function getPdfFileUrl(): string {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  return `${baseUrl}/cv/pdf/file`;
}

/**
 * Get PDF file URL for forced download (public)
 * Uses download query parameter to force browser download
 */
export function getPdfDownloadUrl(): string {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  return `${baseUrl}/cv/pdf/file?download=true`;
}

/**
 * Upload new PDF resume (admin - requires auth)
 */
export async function uploadPdf(file: File): Promise<PdfUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fileUploadClient.post('/cv/pdf/upload', formData);
  return response.data;
}

/**
 * Get PDF version history (admin - requires auth)
 */
export async function getPdfHistory(includeDeleted = false) {
  const response = await apiClient.get('/cv/pdf/history', {
    params: { includeDeleted }
  });
  return response.data;
}

/**
 * Activate a specific PDF version - restore from history (admin - requires auth)
 */
export async function activatePdfVersion(versionId: number) {
  const response = await apiClient.put(`/cv/pdf/${versionId}/activate`);
  return response.data;
}

/**
 * Soft delete a PDF version (admin - requires auth)
 */
export async function deletePdfVersion(versionId: number) {
  const response = await apiClient.delete(`/cv/pdf/${versionId}`);
  return response.data;
}
