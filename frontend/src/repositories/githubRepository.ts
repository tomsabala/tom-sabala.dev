/**
 * GitHub Repository
 * Fetches GitHub contribution stats from the backend (cached, ~1h TTL).
 *
 * Uses plain fetch — this is a public endpoint with no auth, no cookies,
 * and no CSRF. Bypasses the apiClient interceptor chain intentionally.
 */
import type { GitHubStats } from '../types/index.ts';

const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5000/api';

export async function getGitHubStats(): Promise<{ success: boolean; data?: GitHubStats; error?: string }> {
  const response = await fetch(`${API_BASE}/github-stats`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
