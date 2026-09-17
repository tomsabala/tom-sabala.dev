import { apiClient } from './apiClient.ts';

export async function getProfile() {
  const response = await apiClient.get('/jobs/agent/profile');
  return response.data;
}

export async function startRun(data: { interests: string; min_score: number }) {
  const response = await apiClient.post('/jobs/agent/runs', data);
  return response.data;
}

export async function getRuns(limit = 20) {
  const response = await apiClient.get('/jobs/agent/runs', { params: { limit } });
  return response.data;
}

export async function getRun(id: number) {
  const response = await apiClient.get(`/jobs/agent/runs/${id}`);
  return response.data;
}

export async function getFindings(runId: number) {
  const response = await apiClient.get(`/jobs/agent/runs/${runId}/findings`);
  return response.data;
}

export async function cancelRun(id: number) {
  const response = await apiClient.post(`/jobs/agent/runs/${id}/cancel`);
  return response.data;
}

export async function dismissPosting(postingId: number) {
  const response = await apiClient.post(`/jobs/agent/postings/${postingId}/dismiss`);
  return response.data;
}

export async function bookmarkPosting(postingId: number) {
  const response = await apiClient.post(`/jobs/agent/postings/${postingId}/bookmark`);
  return response.data;
}
