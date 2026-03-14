'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export function useExecutions(page = 1, status?: string) {
  return useQuery({
    queryKey: ['executions', page, status],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page) });
      if (status) params.set('status', status);
      const res = await api.get(`/executions?${params}`);
      return res.data.data || res.data;
    },
  });
}

export function useExecution(id: string) {
  return useQuery({
    queryKey: ['execution', id],
    queryFn: async () => {
      const res = await api.get(`/executions/${id}`);
      return res.data.data || res.data;
    },
    enabled: !!id,
    refetchInterval: 3000,
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await api.get('/executions/stats');
      return res.data.data || res.data;
    },
  });
}

export function useRecentExecutions() {
  return useQuery({
    queryKey: ['recent-executions'],
    queryFn: async () => {
      const res = await api.get('/executions?limit=10');
      return res.data.data || res.data;
    },
  });
}
