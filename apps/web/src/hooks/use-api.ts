'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Generic hooks for API calls with React Query

export function useApiQuery<T>(
  key: string[],
  path: string,
  params?: Record<string, any>,
  options?: { enabled?: boolean },
) {
  return useQuery<T>({
    queryKey: key,
    queryFn: () => api.get<T>(path, params),
    enabled: options?.enabled,
  });
}

export function useApiMutation<TInput, TOutput = unknown>(
  method: 'post' | 'put' | 'patch' | 'delete',
  path: string,
  options?: {
    invalidateKeys?: string[][];
    onSuccess?: (data: TOutput) => void;
  },
) {
  const queryClient = useQueryClient();

  return useMutation<TOutput, Error, TInput>({
    mutationFn: (data: TInput) => {
      switch (method) {
        case 'post':
          return api.post<TOutput>(path, data);
        case 'put':
          return api.put<TOutput>(path, data);
        case 'patch':
          return api.patch<TOutput>(path, data);
        case 'delete':
          return api.delete<TOutput>(path);
      }
    },
    onSuccess: (data) => {
      if (options?.invalidateKeys) {
        options.invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
      options?.onSuccess?.(data);
    },
  });
}

// Module-specific hooks

export function useDashboardStats() {
  return useApiQuery<any>(['dashboard', 'stats'], '/dashboard/stats');
}

export function useFindings(params?: Record<string, any>) {
  return useApiQuery<any>(['findings'], '/findings', params);
}

export function useDataSources(params?: Record<string, any>) {
  return useApiQuery<any>(['connectors'], '/connectors', params);
}

export function useAssets(params?: Record<string, any>) {
  return useApiQuery<any>(['assets'], '/discovery/assets', params);
}

export function useDsarRequests(params?: Record<string, any>) {
  return useApiQuery<any>(['dsar'], '/dsar/requests', params);
}

export function useConsentRecords(params?: Record<string, any>) {
  return useApiQuery<any>(['consent'], '/consent/records', params);
}

export function useIncidents(params?: Record<string, any>) {
  return useApiQuery<any>(['incidents'], '/incidents', params);
}

export function useVendors(params?: Record<string, any>) {
  return useApiQuery<any>(['vendors'], '/vendors', params);
}

export function useCompliance() {
  return useApiQuery<any>(['compliance', 'scorecard'], '/compliance/scorecard');
}
