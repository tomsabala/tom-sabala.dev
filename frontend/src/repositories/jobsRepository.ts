import { apiClient } from './apiClient.ts';

export async function getCompanies() {
  const response = await apiClient.get('/jobs/companies');
  return response.data;
}

export async function createCompany(data: { name: string; url?: string; notes?: string; categories?: string[] }) {
  const response = await apiClient.post('/jobs/companies', data);
  return response.data;
}

export async function updateCompany(id: number, data: { name?: string; url?: string; notes?: string; categories?: string[] }) {
  const response = await apiClient.put(`/jobs/companies/${id}`, data);
  return response.data;
}

export async function suggestCategories(data: { name: string; url?: string; notes?: string }) {
  const response = await apiClient.post('/jobs/companies/suggest-categories', data);
  return response.data;
}

export async function deleteCompany(id: number) {
  const response = await apiClient.delete(`/jobs/companies/${id}`);
  return response.data;
}

export async function getApplications(status?: string) {
  const params = status ? { status } : {};
  const response = await apiClient.get('/jobs/applications', { params });
  return response.data;
}

export async function createApplication(data: object) {
  const response = await apiClient.post('/jobs/applications', data);
  return response.data;
}

export async function updateApplication(id: number, data: object) {
  const response = await apiClient.put(`/jobs/applications/${id}`, data);
  return response.data;
}

export async function updateApplicationStatus(id: number, status: string) {
  const response = await apiClient.patch(`/jobs/applications/${id}/status`, { status });
  return response.data;
}

export async function deleteApplication(id: number) {
  const response = await apiClient.delete(`/jobs/applications/${id}`);
  return response.data;
}
