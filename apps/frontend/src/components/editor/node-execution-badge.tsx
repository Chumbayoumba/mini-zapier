'use client';

import { type NodeExecutionState } from '@/stores/execution-store';
import { CheckCircle, XCircle, Loader2, SkipForward, Clock } from 'lucide-react';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

interface NodeExecutionBadgeProps {
  state: NodeExecutionState;
  duration?: number;
  error?: string;
}

export function NodeExecutionBadge({ state, duration, error }: NodeExecutionBadgeProps) {
  if (state === 'idle') return null;

  return (
    <>
      {/* Status icon badge */}
      {state === 'running' && (
        <div className="absolute -top-2 -right-2 z-10 rounded-full bg-blue-500 p-0.5 shadow-md">
          <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
        </div>
      )}
      {state === 'success' && (
        <div className="absolute -top-2 -right-2 z-10 rounded-full bg-green-500 p-0.5 shadow-md">
          <CheckCircle className="h-3.5 w-3.5 text-white" />
        </div>
      )}
      {state === 'error' && (
        <div className="absolute -top-2 -right-2 z-10 rounded-full bg-red-500 p-0.5 shadow-md" title={error}>
          <XCircle className="h-3.5 w-3.5 text-white" />
        </div>
      )}
      {state === 'waiting' && (
        <div className="absolute -top-2 -right-2 z-10 rounded-full bg-gray-400 p-0.5 shadow-md">
          <Clock className="h-3.5 w-3.5 text-white" />
        </div>
      )}
      {state === 'skipped' && (
        <div className="absolute -top-2 -right-2 z-10 rounded-full bg-gray-400 p-0.5 shadow-md">
          <SkipForward className="h-3.5 w-3.5 text-white" />
        </div>
      )}

      {/* Duration label below node */}
      {state === 'success' && duration !== undefined && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap">
          <span className="text-[10px] font-medium text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">
            {formatDuration(duration)}
          </span>
        </div>
      )}
      {state === 'error' && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap">
          <span className="text-[10px] font-medium text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">
            Failed
          </span>
        </div>
      )}
    </>
  );
}

export function getExecClassName(state: NodeExecutionState): string {
  switch (state) {
    case 'running':
      return 'node-running-anim';
    case 'success':
      return 'node-success-flash-anim';
    case 'error':
      return 'node-error-shake-anim';
    case 'waiting':
      return 'node-waiting-anim';
    case 'skipped':
      return 'opacity-50';
    default:
      return '';
  }
}
