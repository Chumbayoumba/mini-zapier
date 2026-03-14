'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { ExecutionStepLog } from '@/types';

const STEP_STATUS: Record<string, { color: string; ring: string; label: string }> = {
  COMPLETED: { color: 'bg-emerald-500', ring: 'ring-emerald-500/20', label: 'Done' },
  RUNNING: { color: 'bg-blue-500 animate-pulse', ring: 'ring-blue-500/20', label: 'Running' },
  FAILED: { color: 'bg-red-500', ring: 'ring-red-500/20', label: 'Failed' },
  PENDING: { color: 'bg-gray-400', ring: 'ring-gray-400/20', label: 'Pending' },
  SKIPPED: { color: 'bg-yellow-400', ring: 'ring-yellow-400/20', label: 'Skipped' },
};

interface ExecutionTimelineProps {
  steps?: ExecutionStepLog[];
}

export function ExecutionTimeline({ steps = [] }: ExecutionTimelineProps) {
  if (!steps.length) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
            <Clock className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium text-sm">No steps recorded</p>
          <p className="text-muted-foreground text-xs mt-1">Execution details will appear here</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-sm mb-4">Execution Timeline</h3>
      <div className="space-y-0">
        {steps.map((step, i) => {
          const s = STEP_STATUS[step.status] || STEP_STATUS.PENDING;
          return (
            <div key={step.id} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ring-4 ${s.color} ${s.ring}`} />
                {i < steps.length - 1 && <div className="w-0.5 flex-1 min-h-[2rem] bg-border" />}
              </div>
              <div className="flex-1 min-w-0 pb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{step.nodeName}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5">{step.nodeType}</Badge>
                  <Badge variant={step.status === 'FAILED' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5">
                    {s.label}
                  </Badge>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                  {step.duration != null && <span className="tabular-nums">{(step.duration / 1000).toFixed(2)}s</span>}
                  {step.retryCount > 0 && <span>Retries: {step.retryCount}</span>}
                  {step.startedAt && (
                    <span>{formatDistanceToNow(new Date(step.startedAt), { addSuffix: true })}</span>
                  )}
                </div>
                {step.error && (
                  <p className="text-xs text-destructive mt-1.5 bg-destructive/5 rounded px-2 py-1 truncate">{step.error}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
