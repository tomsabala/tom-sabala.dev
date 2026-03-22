import { apiClient } from './apiClient.ts';
import type { IdeaFormData } from '../types/index.ts';

export async function getIdeas() {
  const response = await apiClient.get('/ideas');
  return response.data;
}

export async function createIdea(idea: IdeaFormData) {
  const response = await apiClient.post('/ideas', idea);
  return response.data;
}

export async function updateIdea(id: number, idea: Partial<IdeaFormData>) {
  const response = await apiClient.put(`/ideas/${id}`, idea);
  return response.data;
}

export async function deleteIdea(id: number) {
  const response = await apiClient.delete(`/ideas/${id}`);
  return response.data;
}
