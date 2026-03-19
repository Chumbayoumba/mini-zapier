'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useExecutionStore } from '@/stores/execution-store';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || '';

export function useExecutionSocket(workflowId: string) {
  const socketRef = useRef<Socket | null>(null);

  const startExecution = useExecutionStore((s) => s.startExecution);
  const setNodeRunning = useExecutionStore((s) => s.setNodeRunning);
  const setNodeSuccess = useExecutionStore((s) => s.setNodeSuccess);
  const setNodeError = useExecutionStore((s) => s.setNodeError);
  const completeExecution = useExecutionStore((s) => s.completeExecution);
  const failExecution = useExecutionStore((s) => s.failExecution);

  useEffect(() => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

    const wsUrl = WS_URL ? `${WS_URL}/executions` : '/executions';
    const socket = io(wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join:workflow', workflowId);
    });

    socket.on('execution:started', (payload) => {
      if (payload.workflowId !== workflowId) return;
      const nodeIds: string[] = payload.nodeIds || [];
      startExecution(payload.executionId, nodeIds);
      socket.emit('join:execution', payload.executionId);
    });

    socket.on('step:started', (payload) => {
      setNodeRunning(payload.nodeId);
    });

    socket.on('step:completed', (payload) => {
      const duration =
        payload.duration ??
        (payload.startedAt && payload.completedAt
          ? new Date(payload.completedAt).getTime() - new Date(payload.startedAt).getTime()
          : 0);
      setNodeSuccess(payload.nodeId, payload.result ?? payload.output, duration);
    });

    socket.on('step:failed', (payload) => {
      const errorMsg =
        typeof payload.error === 'string'
          ? payload.error
          : payload.error?.message || 'Unknown error';
      setNodeError(payload.nodeId, errorMsg);
    });

    socket.on('execution:completed', (payload) => {
      if (payload.workflowId === workflowId || useExecutionStore.getState().executionId === payload.executionId) {
        completeExecution();
      }
    });

    socket.on('execution:failed', (payload) => {
      if (payload.workflowId === workflowId || useExecutionStore.getState().executionId === payload.executionId) {
        const errorMsg =
          typeof payload.error === 'string'
            ? payload.error
            : payload.error?.message || 'Execution failed';
        failExecution(errorMsg);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [workflowId, startExecution, setNodeRunning, setNodeSuccess, setNodeError, completeExecution, failExecution]);
}
