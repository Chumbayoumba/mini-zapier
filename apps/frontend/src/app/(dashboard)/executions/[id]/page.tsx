'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useExecution } from '@/hooks/use-executions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EXECUTION_STATUS_VARIANTS } from '@/constants';
import { formatDate, formatDuration } from '@/lib/utils';
import { CheckCircle, XCircle, Clock, Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';

const statusIcons: Record<string, React.ReactNode> = {
  COMPLETED: <CheckCircle className="h-4 w-4 text-emerald-500" />,
  FAILED: <XCircle className="h-4 w-4 text-red-500" />,
  RUNNING: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  PENDING: <Clock className="h-4 w-4 text-gray-400" />,
  SKIPPED: <AlertTriangle className="h-4 w-4 text-amber-500" />,
};

export default function ExecutionDetailPage() {
  const params = useParams();
  const { data: execution, isLoading } = useExecution(params.id as string);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3">
        <XCircle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">Execution not found</p>
        <Link href="/executions">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Executions
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/executions" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Execution Details</h1>
            <Badge variant={EXECUTION_STATUS_VARIANTS[execution.status] || 'secondary'}>
              {execution.status}
            </Badge>
          </div>
          {execution.workflow?.name && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Workflow: <Link href={`/workflows/${execution.workflowId}`} className="hover:underline">{execution.workflow.name}</Link>
            </p>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Started</p>
            <p className="text-sm font-medium mt-0.5">{execution.startedAt ? formatDate(execution.startedAt) : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="text-sm font-medium mt-0.5">{execution.completedAt ? formatDate(execution.completedAt) : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="text-sm font-medium mt-0.5">{execution.duration != null ? formatDuration(execution.duration) : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Steps</p>
            <p className="text-sm font-medium mt-0.5">{execution.stepLogs?.length || 0} steps</p>
          </CardContent>
        </Card>
      </div>

      {/* Error */}
      {execution.error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Error</p>
                <p className="text-sm text-muted-foreground mt-1">{execution.error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step Logs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Step Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {!execution.stepLogs?.length ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Clock className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No steps recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {execution.stepLogs.map((step: Record<string, unknown>, i: number) => (
                <div key={step.id as string} className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/30">
                  <div className="mt-0.5 shrink-0">
                    {statusIcons[step.status as string] || statusIcons.PENDING}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">Step {i + 1}: {step.nodeName as string}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        {step.duration != null && (
                          <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(step.duration as number)}</span>
                        )}
                        <Badge variant="outline" className="text-[10px]">{step.nodeType as string}</Badge>
                      </div>
                    </div>
                    {step.retryCount != null && (step.retryCount as number) > 0 && (
                      <p className="text-xs text-amber-600 mt-1">Retried {step.retryCount as number} time(s)</p>
                    )}
                    {typeof step.error === 'string' && step.error && (
                      <p className="text-xs text-destructive mt-1 break-all">{step.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
