/**
 * GitHub Repository
 * Fetches GitHub contribution stats from the backend (cached, ~1h TTL).
 */
import { apiClient } from './apiClient.ts';
import type { GitHubStats } from '../types/index.ts';

export async function getGitHubStats(): Promise<{ success: boolean; data?: GitHubStats; error?: string }> {
  const response = await apiClient.get('/github-stats');
  return response.data;
}
