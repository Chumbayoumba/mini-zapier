'use client';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import type { WorkflowExecution } from '@/types';

const STATUS_MAP: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  COMPLETED: { variant: 'default', label: 'Completed' },
  RUNNING: { variant: 'secondary', label: 'Running' },
  FAILED: { variant: 'destructive', label: 'Failed' },
  PENDING: { variant: 'outline', label: 'Pending' },
  CANCELLED: { variant: 'outline', label: 'Cancelled' },
};

interface RecentExecutionsProps {
  executions?: WorkflowExecution[];
}

export function RecentExecutions({ executions = [] }: RecentExecutionsProps) {
  if (!executions.length) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        No executions yet. Run a workflow to see results here.
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">Recent Executions</h3>
      </div>
      <div className="divide-y">
        {executions.slice(0, 10).map((exec) => {
          const s = STATUS_MAP[exec.status] || STATUS_MAP.PENDING;
          return (
            <div key={exec.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{exec.workflow?.name || exec.workflowId}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(exec.createdAt), { addSuffix: true })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {exec.duration != null && (
                  <span className="text-xs text-muted-foreground">
                    {(exec.duration / 1000).toFixed(1)}s
                  </span>
                )}
                <Badge variant={s.variant}>{s.label}</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
