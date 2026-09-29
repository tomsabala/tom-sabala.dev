import { describe, it, expect, vi, afterEach } from 'vitest';
import type { AxiosError, AxiosInstance } from 'axios';
import { apiClient, createAuthErrorHandler } from '../apiClient';
import { onSessionExpired } from '../authEvents';

/** The minimal shape of a failed request the 401 handler actually reads. */
function axiosErrorOf(status: number, url: string): AxiosError {
  return { config: { url, headers: {} }, response: { status } } as unknown as AxiosError;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createAuthErrorHandler', () => {
  it('rejects and announces the expiry once when the refresh also fails', async () => {
    const post = vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('401'));
    const client = vi.fn() as unknown as AxiosInstance;
    const expired = vi.fn();
    const unsubscribe = onSessionExpired(expired);

    const error = axiosErrorOf(401, '/jobs/companies');
    await expect(createAuthErrorHandler(client)(error)).rejects.toBe(error);

    expect(post).toHaveBeenCalledWith('/auth/refresh');
    expect(client).not.toHaveBeenCalled();
    expect(expired).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('retries the original request and stays silent when the refresh succeeds', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: null });
    const client = vi.fn().mockResolvedValue({ data: 'retried' }) as unknown as AxiosInstance;
    const expired = vi.fn();
    const unsubscribe = onSessionExpired(expired);

    const error = axiosErrorOf(401, '/jobs/companies');
    await expect(createAuthErrorHandler(client)(error)).resolves.toEqual({ data: 'retried' });

    expect(post).toHaveBeenCalledTimes(1);
    expect(client).toHaveBeenCalledTimes(1);
    expect(client).toHaveBeenCalledWith(error.config);
    expect(expired).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('passes a non-401 error through without refreshing', async () => {
    const post = vi.spyOn(apiClient, 'post');
    const client = vi.fn() as unknown as AxiosInstance;
    const expired = vi.fn();
    const unsubscribe = onSessionExpired(expired);

    const error = axiosErrorOf(500, '/jobs/companies');
    await expect(createAuthErrorHandler(client)(error)).rejects.toBe(error);

    expect(post).not.toHaveBeenCalled();
    expect(client).not.toHaveBeenCalled();
    expect(expired).not.toHaveBeenCalled();
    unsubscribe();
  });
});
