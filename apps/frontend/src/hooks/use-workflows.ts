'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';

export function useWorkflows(page = 1) {
  return useQuery({
    queryKey: ['workflows', page],
    queryFn: async () => {
      const res = await api.get(`/workflows?page=${page}`);
      return res.data.data || res.data;
    },
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: ['workflow', id],
    queryFn: async () => {
      const res = await api.get(`/workflows/${id}`);
      return res.data.data || res.data;
    },
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await api.post('/workflows', data);
      return res.data.data || res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow created');
    },
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const res = await api.patch(`/workflows/${id}`, data);
      return res.data.data || res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow updated');
    },
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/workflows/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow deleted');
    },
  });
}

export function useActivateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/workflows/${id}/activate`);
      return res.data.data || res.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow activated');
    },
  });
}

export function useDeactivateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/workflows/${id}/deactivate`);
      return res.data.data || res.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow paused');
    },
  });
}

export function useExecuteWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data?: Record<string, unknown> }) => {
      const res = await api.post(`/workflows/${id}/execute`, data || {});
      return res.data.data || res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      toast.success('Workflow execution started');
    },
  });
}
