'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useExecutions } from '@/hooks/use-executions';
import { useWorkflows } from '@/hooks/use-workflows';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExecutionFilters } from '@/components/executions/execution-filters';
import { formatDate, formatDuration } from '@/lib/utils';
import { EXECUTION_STATUS_VARIANTS } from '@/constants';
import type { WorkflowExecution } from '@/types';

export default function ExecutionsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [workflowId, setWorkflowId] = useState('');

  const { data, isLoading } = useExecutions({
    page,
    status: status || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    workflowId: workflowId || undefined,
  });

  const { data: workflowsData } = useWorkflows(1);
  const workflows =
    workflowsData?.workflows?.map((wf: any) => ({ id: wf.id, name: wf.name })) || [];

  const executions: WorkflowExecution[] = data?.executions || [];
  const totalPages = data?.totalPages || (data?.total ? Math.ceil(data.total / (data.limit || 10)) : 1);

  const clearFilters = () => {
    setStatus('');
    setDateFrom('');
    setDateTo('');
    setWorkflowId('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Execution History</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Monitor and filter your workflow executions
        </p>
      </div>

      <ExecutionFilters
        status={status}
        dateFrom={dateFrom}
        dateTo={dateTo}
        workflowId={workflowId}
        workflows={workflows}
        onStatusChange={(s) => { setStatus(s); setPage(1); }}
        onDateFromChange={(d) => { setDateFrom(d); setPage(1); }}
        onDateToChange={(d) => { setDateTo(d); setPage(1); }}
        onWorkflowIdChange={(id) => { setWorkflowId(id); setPage(1); }}
        onClear={clearFilters}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : !executions.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="font-medium">No executions found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {status || dateFrom || dateTo || workflowId
                  ? 'Try adjusting your filters'
                  : 'Run a workflow to see execution history'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {executions.map((exec) => (
                <Link key={exec.id} href={`/executions/${exec.id}`}>
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {exec.workflow?.name || 'Unknown Workflow'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(exec.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {exec.duration != null && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatDuration(exec.duration)}
                        </span>
                      )}
                      <Badge
                        variant={EXECUTION_STATUS_VARIANTS[exec.status] || 'secondary'}
                        className="text-[10px] px-2"
                      >
                        {exec.status}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="flex items-center text-sm text-muted-foreground px-2">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
