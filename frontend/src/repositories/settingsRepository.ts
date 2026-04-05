import { apiClient } from './apiClient.ts';
import type { TabConfigs } from '../types/index.ts';

const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5000/api';

/**
 * Fetch visible tab keys (public, no auth).
 * Returns a Set of tab keys that should be shown in the nav.
 * Hidden tabs are omitted from the response entirely — no info leak.
 * Falls back to null (show all tabs) on failure.
 */
export async function getVisibleTabs(): Promise<Set<string> | null> {
  try {
    const res = await fetch(`${API_BASE}/dashboard/tabs`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success || !Array.isArray(data.data)) return null;
    return new Set<string>(data.data);
  } catch {
    return null;
  }
}

/**
 * Fetch full tab config including hidden tabs (admin only, JWT required).
 */
export async function getAdminTabConfigs(): Promise<TabConfigs> {
  const response = await apiClient.get('/dashboard/tabs/admin');
  return response.data.success ? response.data.data : {};
}

/**
 * Update tab visibility config (admin only, JWT required).
 * Accepts partial updates: only supplied keys are updated.
 * Returns full config including hidden tabs.
 */
export async function updateTabConfigs(configs: TabConfigs) {
  const response = await apiClient.put('/dashboard/tabs', configs);
  return response.data;
}
