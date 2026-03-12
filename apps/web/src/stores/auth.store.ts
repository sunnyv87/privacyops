'use client';

import { create } from 'zustand';
import { api } from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export interface LoginResult {
  success: boolean;
  requiresMfa: boolean;
  error?: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  mfaRequired: boolean;
  mfaPendingToken: string | null;

  login: (email: string, password: string) => Promise<LoginResult>;
  loginWithMfa: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
  hasRole: (role: string) => boolean;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Register the refresh handler with the API client
  api.onTokenRefresh(async () => {
    return get().refreshAuth();
  });

  return {
    accessToken: null,
    refreshToken: null,
    user: null,
    permissions: [],
    isAuthenticated: false,
    isLoading: true,
    mfaRequired: false,
    mfaPendingToken: null,

    login: async (email: string, password: string): Promise<LoginResult> => {
      try {
        const response = await api.post<{
          accessToken: string;
          refreshToken: string;
          user: AuthUser;
          requiresMfa?: boolean;
          mfaPendingToken?: string;
        }>('/auth/login', { email, password });

        if (response.requiresMfa) {
          set({
            mfaRequired: true,
            mfaPendingToken: response.mfaPendingToken || response.accessToken,
          });
          return { success: true, requiresMfa: true };
        }

        // Full login success
        const permissions = extractPermissions(response.user);
        api.setToken(response.accessToken);
        api.setRefreshToken(response.refreshToken);

        sessionStorage.setItem('accessToken', response.accessToken);
        sessionStorage.setItem('refreshToken', response.refreshToken);
        sessionStorage.setItem('user', JSON.stringify(response.user));

        // Set cookie for middleware (Secure in production, SameSite=Strict)
        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `privacyops_token=${response.accessToken}; path=/; max-age=${60 * 15}; SameSite=Strict${secure}`;

        set({
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          user: response.user,
          permissions,
          isAuthenticated: true,
          isLoading: false,
          mfaRequired: false,
          mfaPendingToken: null,
        });

        return { success: true, requiresMfa: false };
      } catch (error: any) {
        return {
          success: false,
          requiresMfa: false,
          error: error.message || 'Login failed',
        };
      }
    },

    loginWithMfa: async (token: string): Promise<void> => {
      const { mfaPendingToken } = get();
      if (!mfaPendingToken) {
        throw new Error('No MFA session pending');
      }

      const response = await api.post<{
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
      }>('/auth/login/mfa', {
        mfaPendingToken,
        token,
      });

      const permissions = extractPermissions(response.user);
      api.setToken(response.accessToken);
      api.setRefreshToken(response.refreshToken);

      sessionStorage.setItem('accessToken', response.accessToken);
      sessionStorage.setItem('refreshToken', response.refreshToken);
      sessionStorage.setItem('user', JSON.stringify(response.user));

      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `privacyops_token=${response.accessToken}; path=/; max-age=${60 * 15}; SameSite=Strict${secure}`;

      set({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        user: response.user,
        permissions,
        isAuthenticated: true,
        isLoading: false,
        mfaRequired: false,
        mfaPendingToken: null,
      });
    },

    logout: async (): Promise<void> => {
      try {
        await api.post('/auth/logout');
      } catch {
        // Ignore errors during logout
      }

      api.setToken(null);
      api.setRefreshToken(null);

      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      sessionStorage.removeItem('user');
      document.cookie = 'privacyops_token=; path=/; max-age=0';

      set({
        accessToken: null,
        refreshToken: null,
        user: null,
        permissions: [],
        isAuthenticated: false,
        isLoading: false,
        mfaRequired: false,
        mfaPendingToken: null,
      });
    },

    refreshAuth: async (): Promise<boolean> => {
      const currentRefreshToken = get().refreshToken || sessionStorage.getItem('refreshToken');
      if (!currentRefreshToken) {
        return false;
      }

      try {
        // Direct fetch to avoid the interceptor loop
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/auth/refresh`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: currentRefreshToken }),
          },
        );

        if (!response.ok) {
          throw new Error('Refresh failed');
        }

        const data = await response.json();

        api.setToken(data.accessToken);
        api.setRefreshToken(data.refreshToken);

        sessionStorage.setItem('accessToken', data.accessToken);
        sessionStorage.setItem('refreshToken', data.refreshToken);

        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `privacyops_token=${data.accessToken}; path=/; max-age=${60 * 15}; SameSite=Strict${secure}`;

        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });

        // If user data is included in the refresh response, update it
        if (data.user) {
          const permissions = extractPermissions(data.user);
          sessionStorage.setItem('user', JSON.stringify(data.user));
          set({ user: data.user, permissions });
        }

        return true;
      } catch {
        // Refresh failed — clear auth state
        api.setToken(null);
        api.setRefreshToken(null);
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
        sessionStorage.removeItem('user');
        document.cookie = 'privacyops_token=; path=/; max-age=0';

        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          permissions: [],
          isAuthenticated: false,
          isLoading: false,
        });

        return false;
      }
    },

    hasPermission: (permission: string): boolean => {
      const { permissions } = get();
      return matchPermission(permissions, permission);
    },

    hasAnyPermission: (...requiredPermissions: string[]): boolean => {
      const { permissions } = get();
      return requiredPermissions.some((p) => matchPermission(permissions, p));
    },

    hasRole: (role: string): boolean => {
      const { user } = get();
      if (!user) return false;
      return user.roles.includes(role);
    },

    initialize: async (): Promise<void> => {
      if (typeof window === 'undefined') {
        set({ isLoading: false });
        return;
      }

      const storedToken = sessionStorage.getItem('accessToken');
      const storedRefreshToken = sessionStorage.getItem('refreshToken');
      const storedUser = sessionStorage.getItem('user');

      if (!storedToken || !storedUser) {
        set({ isLoading: false });
        return;
      }

      try {
        const user: AuthUser = JSON.parse(storedUser);
        const permissions = extractPermissions(user);

        api.setToken(storedToken);
        api.setRefreshToken(storedRefreshToken);

        set({
          accessToken: storedToken,
          refreshToken: storedRefreshToken,
          user,
          permissions,
          isAuthenticated: true,
          isLoading: false,
        });

        // Validate the token by fetching current user in background
        try {
          const response = await api.get<{ data: AuthUser }>('/users/me');
          const freshUser = response.data;
          const freshPermissions = extractPermissions(freshUser);

          sessionStorage.setItem('user', JSON.stringify(freshUser));
          set({
            user: freshUser,
            permissions: freshPermissions,
          });
        } catch {
          // Token might be expired — attempt refresh
          const refreshed = await get().refreshAuth();
          if (!refreshed) {
            set({
              accessToken: null,
              refreshToken: null,
              user: null,
              permissions: [],
              isAuthenticated: false,
              isLoading: false,
            });
          }
        }
      } catch {
        // Corrupted data in sessionStorage
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
        sessionStorage.removeItem('user');
        set({ isLoading: false });
      }
    },
  };
});

/**
 * Extract all permissions from the user object.
 * Handles both flat permissions array and role-based permissions.
 */
function extractPermissions(user: AuthUser): string[] {
  if (user.permissions && Array.isArray(user.permissions)) {
    return user.permissions;
  }
  return [];
}

/**
 * Check if a user permission matches a required permission.
 * Supports wildcard matching: 'dspm:*' matches 'dspm:findings:read'
 */
function matchPermission(
  userPermissions: string[],
  required: string,
): boolean {
  return userPermissions.some((p) => {
    if (p === required) return true;
    if (p === '*') return true;

    // Wildcard support: 'dspm:*' matches 'dspm:findings:read'
    if (p.endsWith(':*')) {
      const prefix = p.slice(0, -1); // 'dspm:'
      return required.startsWith(prefix);
    }

    return false;
  });
}
