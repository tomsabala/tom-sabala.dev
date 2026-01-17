/**
 * CSRF Token Repository
 * Handles fetching CSRF tokens and reading them from cookies.
 */
import { apiClient } from './apiClient.ts';

interface CsrfTokenResponse {
  success: boolean;
  csrfToken: string;
}

/**
 * Fetch fresh CSRF token from backend endpoint.
 * Token is automatically set as cookie by backend.
 *
 * @returns Promise resolving to CSRF token string
 * @throws Error if fetch fails or response is invalid
 */
export async function fetchCsrfToken(): Promise<string> {
  const response = await apiClient.get<CsrfTokenResponse>('/contact/csrf-token');

  if (!response.data.success || !response.data.csrfToken) {
    throw new Error('Invalid CSRF token response from server');
  }

  return response.data.csrfToken;
}

/**
 * Read CSRF token from browser cookie.
 * Used to attach token to request headers.
 *
 * @returns CSRF token string or null if cookie not found
 */
export function readCsrfTokenFromCookie(): string | null {
  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrf_token='));

  return match ? decodeURIComponent(match.split('=')[1]) : null;
}
