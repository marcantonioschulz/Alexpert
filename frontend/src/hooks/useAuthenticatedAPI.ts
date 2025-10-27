import { useAuth } from '@clerk/clerk-react';
import { useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

interface RequestOptions extends RequestInit {
  organizationId?: string;
}

/**
 * Hook to make authenticated API requests
 * Automatically includes Clerk session token in Authorization header
 */
export function useAuthenticatedAPI() {
  const { getToken } = useAuth();

  /**
   * Make an authenticated API request
   */
  const request = useCallback(
    async <T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> => {
      // Get Clerk session token
      const token = await getToken();

      if (!token) {
        throw new Error('No authentication token available');
      }

      // Prepare headers
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      };

      // Add organization ID header if provided
      if (options.organizationId) {
        headers['X-Organization-ID'] = options.organizationId;
      }

      // Make the request
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
      });

      // Handle errors
      if (!response.ok) {
        const error = await response.json().catch(() => ({
          code: 'UNKNOWN_ERROR',
          message: response.statusText
        }));

        throw new Error(error.message || 'Request failed');
      }

      // Parse JSON response
      const data = await response.json();
      return data as T;
    },
    [getToken]
  );

  /**
   * GET request
   */
  const get = useCallback(
    <T = unknown>(endpoint: string, options?: RequestOptions): Promise<T> => {
      return request<T>(endpoint, {
        ...options,
        method: 'GET'
      });
    },
    [request]
  );

  /**
   * POST request
   */
  const post = useCallback(
    <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> => {
      return request<T>(endpoint, {
        ...options,
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined
      });
    },
    [request]
  );

  /**
   * PUT request
   */
  const put = useCallback(
    <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> => {
      return request<T>(endpoint, {
        ...options,
        method: 'PUT',
        body: body ? JSON.stringify(body) : undefined
      });
    },
    [request]
  );

  /**
   * PATCH request
   */
  const patch = useCallback(
    <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> => {
      return request<T>(endpoint, {
        ...options,
        method: 'PATCH',
        body: body ? JSON.stringify(body) : undefined
      });
    },
    [request]
  );

  /**
   * DELETE request
   */
  const del = useCallback(
    <T = unknown>(endpoint: string, options?: RequestOptions): Promise<T> => {
      return request<T>(endpoint, {
        ...options,
        method: 'DELETE'
      });
    },
    [request]
  );

  return {
    request,
    get,
    post,
    put,
    patch,
    delete: del
  };
}
