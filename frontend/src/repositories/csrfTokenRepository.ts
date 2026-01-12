/**
 * CSRF Token Repository
 * Handles fetching CSRF tokens and reading them from cookies.
 */
import { apiClient } from './apiClient';

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
export const fetchCsrfToken = async (): Promise<string> => {
  const response = await apiClient.get<CsrfTokenResponse>('/contact/csrf-token');

  if (!response.data.success || !response.data.csrfToken) {
    throw new Error('Invalid CSRF token response from server');
  }

  return response.data.csrfToken;
};

/**
 * Read CSRF token from browser cookie.
 * Used to attach token to request headers.
 *
 * @returns CSRF token string or null if cookie not found
 */
export const readCsrfTokenFromCookie = (): string | null => {
  const cookieName = 'csrf_token=';
  const allCookies = decodeURIComponent(document.cookie);
  const cookieArray = allCookies.split(';');

  for (let cookie of cookieArray) {
    const trimmedCookie = cookie.trim();
    if (trimmedCookie.startsWith(cookieName)) {
      return trimmedCookie.substring(cookieName.length);
    }
  }

  return null;
};
