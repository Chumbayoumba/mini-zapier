'use client';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PlayCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { WorkflowExecution } from '@/types';

const STATUS_MAP: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; dot: string }> = {
  COMPLETED: { variant: 'default', label: 'Completed', dot: 'bg-emerald-500' },
  RUNNING: { variant: 'secondary', label: 'Running', dot: 'bg-blue-500 animate-pulse' },
  FAILED: { variant: 'destructive', label: 'Failed', dot: 'bg-red-500' },
  PENDING: { variant: 'outline', label: 'Pending', dot: 'bg-gray-400' },
  CANCELLED: { variant: 'outline', label: 'Cancelled', dot: 'bg-gray-400' },
};

interface RecentExecutionsProps {
  executions?: WorkflowExecution[];
}

export function RecentExecutions({ executions = [] }: RecentExecutionsProps) {
  if (!executions.length) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
            <PlayCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium text-sm">No executions yet</p>
          <p className="text-muted-foreground text-xs mt-1">Run a workflow to see results here.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="px-4 py-3 border-b">
        <h3 className="font-semibold text-sm">Recent Executions</h3>
      </div>
      <div className="divide-y">
        {executions.slice(0, 10).map((exec) => {
          const s = STATUS_MAP[exec.status] || STATUS_MAP.PENDING;
          return (
            <div key={exec.id} className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                <div className="min-w-0">
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-sm font-medium truncate">{exec.workflow?.name || exec.workflowId}</p>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>{exec.workflow?.name || exec.workflowId}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(exec.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {exec.duration != null && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {(exec.duration / 1000).toFixed(1)}s
                  </span>
                )}
                <Badge variant={s.variant} className="text-[10px] px-2">{s.label}</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
