import { apiClient } from './apiClient.ts';
import type { TabConfigs } from '../types/index.ts';

const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5000/api';

/**
 * Fetch tab visibility config (public, no auth).
 * Uses plain fetch to avoid JWT interceptors on a public endpoint.
 * Falls back to empty object (all tabs visible) on failure.
 */
export async function getTabConfigs(): Promise<TabConfigs> {
  const res = await fetch(`${API_BASE}/dashboard/tabs`);
  if (!res.ok) return {};
  const data = await res.json();
  return data.success ? data.data : {};
}

/**
 * Update tab visibility config (admin only, JWT required).
 * Accepts partial updates: only supplied keys are updated.
 */
export async function updateTabConfigs(configs: TabConfigs) {
  const response = await apiClient.put('/dashboard/tabs', configs);
  return response.data;
}
