'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useWebSocket } from '@/hooks/use-websocket';

export function ExecutionFailureToast() {
  const { on, connected } = useWebSocket();

  useEffect(() => {
    if (!connected) return;

    const cleanup = on('execution:failed', (data: {
      executionId: string;
      workflowId: string;
      workflowName?: string;
      error?: string;
    }) => {
      toast.error(`Workflow failed: ${data.workflowName || 'Unknown'}`, {
        description: data.error || 'An error occurred during execution',
        action: {
          label: 'View Details',
          onClick: () => {
            window.location.href = `/executions/${data.executionId}`;
          },
        },
        duration: 10000,
      });
    });

    return cleanup;
  }, [on, connected]);

  return null; // This is a behavior-only component, no UI
}
