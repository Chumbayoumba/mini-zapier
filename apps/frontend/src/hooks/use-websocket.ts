'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

interface UseWebSocketOptions {
  namespace?: string;
  autoConnect?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { namespace = '/executions', autoConnect = true } = options;
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!autoConnect) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

    const socket = io(`${WS_URL}${namespace}`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [namespace, autoConnect]);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current?.on(event, handler);
    return () => {
      socketRef.current?.off(event, handler);
    };
  }, []);

  const emit = useCallback((event: string, data: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  const joinExecution = useCallback((executionId: string) => {
    socketRef.current?.emit('join:execution', executionId);
  }, []);

  const leaveExecution = useCallback((executionId: string) => {
    socketRef.current?.emit('leave:execution', executionId);
  }, []);

  return { socket: socketRef.current, connected, on, emit, joinExecution, leaveExecution };
}
