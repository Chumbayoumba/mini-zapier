'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function WebSocketProvider({ children }: { children: ReactNode }) {
  // WebSocket connection is managed at the hook level (useWebSocket)
  // This provider can be extended for global WS context if needed
  return <>{children}</>;
}
