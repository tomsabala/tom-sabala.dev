/**
 * Pulls the backend's `{ "error": "..." }` string out of a rejected request without
 * asserting a shape onto an unknown value. Every failure path in the UI words itself from
 * this, so a thrown string, an axios error and a network blip all read the same.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object' || !('response' in error)) return fallback;
  const response = error.response;
  if (!response || typeof response !== 'object' || !('data' in response)) return fallback;
  const data = response.data;
  if (!data || typeof data !== 'object' || !('error' in data)) return fallback;
  return typeof data.error === 'string' && data.error ? data.error : fallback;
}
