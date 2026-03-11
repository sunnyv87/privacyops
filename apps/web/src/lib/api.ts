const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

type TokenRefresher = () => Promise<boolean>;

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private refreshToken: string | null = null;
  private tokenRefresher: TokenRefresher | null = null;
  private isRefreshing = false;
  private refreshQueue: Array<{
    resolve: (value: boolean) => void;
    reject: (reason: any) => void;
  }> = [];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  setRefreshToken(token: string | null) {
    this.refreshToken = token;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  /**
   * Register a callback that performs token refresh.
   * The callback should update tokens via setToken/setRefreshToken and return true on success.
   */
  onTokenRefresh(refresher: TokenRefresher) {
    this.tokenRefresher = refresher;
  }

  private buildUrl(path: string, params?: Record<string, any>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    return url.toString();
  }

  /**
   * Wait for an in-progress refresh to complete, or start a new one.
   * Returns true if tokens were refreshed successfully.
   */
  private async waitForRefresh(): Promise<boolean> {
    if (this.isRefreshing) {
      // Another request is already refreshing — queue this one
      return new Promise<boolean>((resolve, reject) => {
        this.refreshQueue.push({ resolve, reject });
      });
    }

    if (!this.tokenRefresher) {
      return false;
    }

    this.isRefreshing = true;

    try {
      const success = await this.tokenRefresher();
      // Resolve all queued requests
      this.refreshQueue.forEach(({ resolve }) => resolve(success));
      this.refreshQueue = [];
      return success;
    } catch (error) {
      this.refreshQueue.forEach(({ reject }) => reject(error));
      this.refreshQueue = [];
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;
    const url = this.buildUrl(path, params);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    // Handle 401 — attempt token refresh and retry once
    if (response.status === 401 && this.tokenRefresher && !options.headers?.['X-No-Retry']) {
      const refreshed = await this.waitForRefresh();

      if (refreshed) {
        // Retry the original request with the new token
        const retryHeaders: Record<string, string> = {
          ...headers,
          'Authorization': `Bearer ${this.token}`,
          'X-No-Retry': '1', // Prevent infinite retry loops
        };

        const retryResponse = await fetch(url, {
          ...fetchOptions,
          headers: retryHeaders,
        });

        if (!retryResponse.ok) {
          const error = await retryResponse.json().catch(() => ({ message: 'Request failed' }));
          throw new ApiError(retryResponse.status, error.error?.message || error.message, error.error);
        }

        if (retryResponse.status === 204) {
          return undefined as T;
        }

        return retryResponse.json();
      }

      // Refresh failed — redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      throw new ApiError(401, 'Session expired');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new ApiError(response.status, error.error?.message || error.message, error.error);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  get<T>(path: string, params?: Record<string, any>) {
    return this.request<T>(path, { method: 'GET', params });
  }

  post<T>(path: string, body?: any) {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(path: string, body?: any) {
    return this.request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(path: string, body?: any) {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: any,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = new ApiClient(API_BASE);
