/**
 * Tests for the API client.
 */
import { apiClient, ApiError } from '@/api/client';
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('ApiClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('performs a GET request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ id: '1', title: 'Doc' }]),
    } as Response);

    const result = await apiClient.get('/api/documents');
    expect(result).toEqual([{ id: '1', title: 'Doc' }]);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/documents',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('performs a POST request with body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: '2', title: 'New Doc' }),
    } as Response);

    const body = { title: 'New Doc', content: '[]' };
    const result = await apiClient.post('/api/documents', body);
    expect(result).toEqual({ id: '2', title: 'New Doc' });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/documents',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );
  });

  it('performs a PUT request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: '1', title: 'Updated' }),
    } as Response);

    const result = await apiClient.put('/api/documents/1', { title: 'Updated' });
    expect((result as { title: string }).title).toBe('Updated');
  });

  it('performs a DELETE request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: () => Promise.resolve(undefined),
    } as Response);

    const result = await apiClient.delete('/api/documents/1');
    expect(result).toBeUndefined();
  });

  it('throws ApiError on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not found'),
    } as Response);

    const promise = apiClient.get('/api/documents/999') as Promise<unknown>;
    await expect(promise).rejects.toThrow(ApiError);
  });

  it('ApiError has correct status code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not found'),
    } as Response);

    try {
      await (apiClient.get('/api/documents/999') as Promise<unknown>);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(404);
    }
  });

  it('sets custom base URL', () => {
    apiClient.setBaseUrl('https://api.example.com');
    // Check via a spy on fetch
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    } as Response);
    apiClient.get('/api/test');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/test',
      expect.anything(),
    );
    // Reset
    apiClient.setBaseUrl('http://localhost:8080');
  });
});