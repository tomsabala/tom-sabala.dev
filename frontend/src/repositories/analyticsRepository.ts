/**
 * Analytics Repository
 * Admin-only read of first-party traffic. The write side has no repository on
 * purpose — beacons go out through `analytics/track.ts` with `sendBeacon`, not
 * axios, because a page being unloaded cannot wait for a promise.
 */
import { apiClient } from './apiClient.ts';
import type { TrafficOverview, TrafficQuery } from '../types/index.ts';

export async function getOverview(
  query: TrafficQuery,
): Promise<{ success: boolean; data: TrafficOverview }> {
  const response = await apiClient.get('/analytics/overview', {
    params: {
      days: query.days,
      site: query.site,
      identity: query.identity,
      ...(query.includeBots ? { bots: '1' } : {}),
    },
  });
  return response.data;
}
