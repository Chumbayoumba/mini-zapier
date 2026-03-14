'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface ExecutionFilters {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  workflowId?: string;
  page?: number;
  limit?: number;
}

export function useExecutions(filtersOrPage: ExecutionFilters | number = 1, status?: string) {
  const filters: ExecutionFilters = typeof filtersOrPage === 'number'
    ? { page: filtersOrPage, status }
    : filtersOrPage;

  return useQuery({
    queryKey: ['executions', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.status) params.set('status', filters.status);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.workflowId) params.set('workflowId', filters.workflowId);
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

export function useChartData(period: '7d' | '30d' = '7d') {
  const days = period === '7d' ? 7 : 30;
  const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, ...rest } = useQuery({
    queryKey: ['chart-data', period],
    queryFn: async () => {
      const res = await api.get(`/executions?limit=500&dateFrom=${dateFrom}`);
      return res.data.data || res.data;
    },
  });

  const chartData = useMemo(() => {
    if (!data?.executions) return [];
    const grouped: Record<string, { success: number; failed: number }> = {};

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      grouped[key] = { success: 0, failed: 0 };
    }

    data.executions.forEach((exec: any) => {
      const key = new Date(exec.createdAt).toISOString().split('T')[0];
      if (grouped[key]) {
        if (exec.status === 'COMPLETED') grouped[key].success++;
        else if (exec.status === 'FAILED') grouped[key].failed++;
      }
    });

    return Object.entries(grouped).map(([date, counts]) => ({
      date: new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      success: counts.success,
      failed: counts.failed,
    }));
  }, [data, days]);

  return { data: chartData, ...rest };
}
