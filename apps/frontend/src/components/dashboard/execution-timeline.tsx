'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import type { ExecutionStepLog } from '@/types';

const STEP_STATUS: Record<string, { color: string; label: string }> = {
  COMPLETED: { color: 'bg-green-500', label: 'Done' },
  RUNNING: { color: 'bg-blue-500 animate-pulse', label: 'Running' },
  FAILED: { color: 'bg-red-500', label: 'Failed' },
  PENDING: { color: 'bg-gray-400', label: 'Pending' },
  SKIPPED: { color: 'bg-yellow-400', label: 'Skipped' },
};

interface ExecutionTimelineProps {
  steps?: ExecutionStepLog[];
}

export function ExecutionTimeline({ steps = [] }: ExecutionTimelineProps) {
  if (!steps.length) {
    return (
      <Card className="p-6 text-center text-muted-foreground text-sm">
        No steps recorded for this execution
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="font-semibold text-sm mb-4">Execution Timeline</h3>
      <div className="space-y-3">
        {steps.map((step, i) => {
          const s = STEP_STATUS[step.status] || STEP_STATUS.PENDING;
          return (
            <div key={step.id} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${s.color}`} />
                {i < steps.length - 1 && <div className="w-0.5 h-8 bg-border" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{step.nodeName}</span>
                  <Badge variant="outline" className="text-xs">{step.nodeType}</Badge>
                  <Badge variant={step.status === 'FAILED' ? 'destructive' : 'secondary'} className="text-xs">
                    {s.label}
                  </Badge>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                  {step.duration != null && <span>{(step.duration / 1000).toFixed(2)}s</span>}
                  {step.retryCount > 0 && <span>Retries: {step.retryCount}</span>}
                  {step.startedAt && (
                    <span>{formatDistanceToNow(new Date(step.startedAt), { addSuffix: true })}</span>
                  )}
                </div>
                {step.error && (
                  <p className="text-xs text-destructive mt-1 truncate">{step.error}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
