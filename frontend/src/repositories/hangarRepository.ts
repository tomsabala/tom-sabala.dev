/**
 * Hangar Repository
 *
 * Live instance status for apps.tom-sabala.dev. The browser cannot reach the gateway
 * broker directly (different origin, deliberately absent from CORS_ORIGINS, admin cookie
 * is SameSite=Lax), so this goes through the backend's server-to-server proxy.
 *
 * The proxy answers 503 whenever the broker is unreachable or unconfigured, which is the
 * normal state until the VPS runs a broker with /instances — callers render a dash row.
 */
import { apiClient } from './apiClient.ts';
import type { HangarStatus } from '../types/index.ts';

export async function getInstances(): Promise<HangarStatus> {
  const response = await apiClient.get('/hangar/instances');
  if (!response.data?.success) throw new Error('Hangar status unavailable');
  const data = response.data.data as HangarStatus;
  return {
    instances: Array.isArray(data?.instances) ? data.instances : [],
    caps: data?.caps ?? { total: 0, anon: 0, admin: 0 },
  };
}
