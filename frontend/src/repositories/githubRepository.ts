/**
 * GitHub Repository
 * Fetches GitHub contribution stats from the backend (cached, ~1h TTL).
 *
 * Uses apiClient so that JWT cookies are included — required for the tab
 * guard to recognise the admin when the github tab is hidden.
 */
import { apiClient } from './apiClient.ts';
import type { GitHubStats } from '../types/index.ts';

export async function getGitHubStats(): Promise<{ success: boolean; data?: GitHubStats; error?: string }> {
  const response = await apiClient.get('/github-stats');
  return response.data;
}

/**
 * Whether the GitHub feature is configured at all (always public, never tab-guarded).
 * The landing page uses it to decide whether to mount the activity strip.
 */
export async function getGitHubStatsEnabled(): Promise<boolean> {
  try {
    const response = await apiClient.get('/github-stats/status');
    return response.data?.enabled === true;
  } catch {
    return false;
  }
}
