'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useExecution } from '@/hooks/use-executions';
import { useWebSocket } from '@/hooks/use-websocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExecutionTimeline } from '@/components/dashboard/execution-timeline';
import { EXECUTION_STATUS_VARIANTS } from '@/constants';
import { formatDate, formatDuration } from '@/lib/utils';
import { CheckCircle, XCircle, Clock, Loader2, ArrowLeft, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import type { ExecutionStepLog } from '@/types';

const statusIcons: Record<string, React.ReactNode> = {
  COMPLETED: <CheckCircle className="h-4 w-4 text-emerald-500" />,
  FAILED: <XCircle className="h-4 w-4 text-red-500" />,
  RUNNING: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  PENDING: <Clock className="h-4 w-4 text-gray-400" />,
  SKIPPED: <AlertTriangle className="h-4 w-4 text-amber-500" />,
};

export default function ExecutionDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const { data: execution, isLoading } = useExecution(params.id as string);
  const { on, joinExecution, leaveExecution, connected } = useWebSocket();

  // WebSocket: live updates for running executions
  useEffect(() => {
    if (!connected || !params.id) return;
    const execId = params.id as string;
    joinExecution(execId);

    const unsubs = [
      on('step:update', () => {
        queryClient.invalidateQueries({ queryKey: ['execution', execId] });
      }),
      on('execution:completed', () => {
        queryClient.invalidateQueries({ queryKey: ['execution', execId] });
      }),
      on('execution:failed', () => {
        queryClient.invalidateQueries({ queryKey: ['execution', execId] });
      }),
    ];

    return () => {
      leaveExecution(execId);
      unsubs.forEach((unsub) => unsub?.());
    };
  }, [connected, params.id, on, joinExecution, leaveExecution, queryClient]);

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
            {execution.status === 'RUNNING' && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {connected ? (
                  <><Wifi className="h-3 w-3 text-emerald-500" /> Live</>
                ) : (
                  <><WifiOff className="h-3 w-3 text-gray-400" /> Offline</>
                )}
              </span>
            )}
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

      {/* Execution Timeline — visual step progress */}
      <ExecutionTimeline steps={execution.stepLogs} />

      {/* Error — Enhanced structured error display */}
      {execution.status === 'FAILED' && execution.error && (() => {
        const failedStep = execution.stepLogs?.find(
          (s: ExecutionStepLog) => s.status === 'FAILED'
        );

        return (
          <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <h3 className="font-semibold text-red-800 dark:text-red-300">Execution Failed</h3>
            </div>

            {/* Error message */}
            <p className="text-red-700 dark:text-red-300 text-sm">{execution.error}</p>

            {/* Failed step context */}
            {failedStep && (
              <div className="space-y-2 mt-3">
                <div className="text-sm">
                  <span className="font-medium text-red-800 dark:text-red-300">Failed Node:</span>{' '}
                  <span className="text-red-700 dark:text-red-400">{failedStep.nodeName} ({failedStep.nodeType})</span>
                </div>

                <div className="text-sm">
                  <span className="font-medium text-red-800 dark:text-red-300">Node ID:</span>{' '}
                  <code className="text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-1 rounded">{failedStep.nodeId}</code>
                </div>

                {failedStep.retryCount != null && failedStep.retryCount > 0 && (
                  <div className="text-sm">
                    <span className="font-medium text-red-800 dark:text-red-300">Retry Attempts:</span>{' '}
                    <span className="text-red-700 dark:text-red-400">{failedStep.retryCount}</span>
                  </div>
                )}

                {/* Input that caused the failure */}
                {failedStep.input && (
                  <details className="mt-2">
                    <summary className="text-sm font-medium text-red-800 dark:text-red-300 cursor-pointer">
                      Input Data
                    </summary>
                    <pre className="mt-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200 p-2 rounded overflow-auto max-h-48">
                      {JSON.stringify(failedStep.input, null, 2)}
                    </pre>
                  </details>
                )}

                {/* Stack trace */}
                {failedStep.errorStack && (
                  <details className="mt-2">
                    <summary className="text-sm font-medium text-red-800 dark:text-red-300 cursor-pointer">
                      Stack Trace
                    </summary>
                    <pre className="mt-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200 p-2 rounded overflow-auto max-h-48 whitespace-pre-wrap">
                      {failedStep.errorStack}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        );
      })()}
      {execution.error && execution.status !== 'FAILED' && (
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
              {execution.stepLogs.map((step: ExecutionStepLog, i: number) => (
                <div key={step.id} className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/30">
                  <div className="mt-0.5 shrink-0">
                    {statusIcons[step.status] || statusIcons.PENDING}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">Step {i + 1}: {step.nodeName}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        {step.duration != null && (
                          <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(step.duration)}</span>
                        )}
                        <Badge variant="outline" className="text-[10px]">{step.nodeType}</Badge>
                      </div>
                    </div>
                    {step.retryCount != null && step.retryCount > 0 && (
                      <p className="text-xs text-amber-600 mt-1">Retried {step.retryCount} time(s)</p>
                    )}
                    {typeof step.error === 'string' && step.error && (
                      <p className="text-xs text-destructive mt-1 break-all">{step.error}</p>
                    )}
                    {step.input && (
                      <details className="mt-1">
                        <summary className="text-xs text-muted-foreground cursor-pointer">Input</summary>
                        <pre className="text-xs bg-muted/50 text-foreground p-1 rounded mt-1 overflow-auto max-h-32">
                          {JSON.stringify(step.input, null, 2)}
                        </pre>
                      </details>
                    )}
                    {step.output && (
                      <details className="mt-1">
                        <summary className="text-xs text-muted-foreground cursor-pointer">Output</summary>
                        <pre className="text-xs bg-muted/50 text-foreground p-1 rounded mt-1 overflow-auto max-h-32">
                          {JSON.stringify(step.output, null, 2)}
                        </pre>
                      </details>
                    )}
                    {step.errorStack && (
                      <details className="mt-1">
                        <summary className="text-xs text-red-500 dark:text-red-400 cursor-pointer">Stack Trace</summary>
                        <pre className="text-xs bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200 p-1 rounded mt-1 overflow-auto max-h-32 whitespace-pre-wrap">
                          {step.errorStack}
                        </pre>
                      </details>
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
