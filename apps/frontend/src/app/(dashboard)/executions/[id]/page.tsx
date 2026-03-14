'use client';

import { useParams } from 'next/navigation';
import { useExecution } from '@/hooks/use-executions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatDuration } from '@/lib/utils';
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';

const statusIcons: Record<string, any> = {
  COMPLETED: <CheckCircle className="h-4 w-4 text-green-500" />,
  FAILED: <XCircle className="h-4 w-4 text-red-500" />,
  RUNNING: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  PENDING: <Clock className="h-4 w-4 text-gray-500" />,
};

export default function ExecutionDetailPage() {
  const params = useParams();
  const { data: execution, isLoading } = useExecution(params.id as string);

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded" /></div>;
  if (!execution) return <p>Execution not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-bold">Execution Details</h1>
        <Badge variant={execution.status === 'COMPLETED' ? 'success' : execution.status === 'FAILED' ? 'destructive' : 'secondary'}>
          {execution.status}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Workflow</CardTitle></CardHeader>
          <CardContent><p className="font-medium">{execution.workflow?.name}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Started</CardTitle></CardHeader>
          <CardContent><p>{execution.startedAt ? formatDate(execution.startedAt) : '—'}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Duration</CardTitle></CardHeader>
          <CardContent><p>{execution.duration ? formatDuration(execution.duration) : '—'}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Step Logs</CardTitle></CardHeader>
        <CardContent>
          {!execution.stepLogs?.length ? (
            <p className="text-muted-foreground text-sm">No steps recorded</p>
          ) : (
            <div className="space-y-3">
              {execution.stepLogs.map((step: any, i: number) => (
                <div key={step.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <div className="mt-0.5">
                    {statusIcons[step.status] || statusIcons.PENDING}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">Step {i + 1}: {step.nodeName}</p>
                      <Badge variant="outline" className="text-xs">{step.nodeType}</Badge>
                    </div>
                    {step.duration && <p className="text-xs text-muted-foreground">{formatDuration(step.duration)}</p>}
                    {step.error && <p className="text-xs text-destructive mt-1">{step.error}</p>}
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
