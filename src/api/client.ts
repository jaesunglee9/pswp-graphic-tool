/**
 * API client for the PSWP Graphic Tool backend.
 *
 * Provides a centralized HTTP client with:
 * - Configurable base URL (defaults to http://localhost:8080)
 * - JSON serialization/deserialization
 * - Consistent error handling
 *
 * Usage:
 * ```ts
 * import { apiClient } from '@/api/client';
 * const docs = await apiClient.get('/api/documents');
 * ```
 */

const DEFAULT_BASE_URL = 'http://localhost:8080';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /** Sets a custom base URL (e.g., from an environment variable). */
  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  /**
   * Generic request method. All public methods delegate here.
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new ApiError(`HTTP ${response.status}: ${errorText}`, response.status);
    }

    // 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}

/** Custom error class for API errors with HTTP status code. */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const apiClient = new ApiClient();
