'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useExecutions } from '@/hooks/use-executions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatDuration } from '@/lib/utils';
import { EXECUTION_STATUS_VARIANTS } from '@/constants';
import type { WorkflowExecution } from '@/types';

export default function ExecutionsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useExecutions(page);

  const executions: WorkflowExecution[] = data?.executions || [];
  const totalPages = data?.total ? Math.ceil(data.total / (data.limit || 10)) : 1;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Executions</h1>
      <Card>
        <CardHeader>
          <CardTitle>Execution History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : !executions.length ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No executions yet</p>
          ) : (
            <div className="space-y-2">
              {executions.map((exec) => (
                <Link key={exec.id} href={`/executions/${exec.id}`}>
                  <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent transition-colors cursor-pointer">
                    <div>
                      <p className="font-medium">{exec.workflow?.name || 'Unknown Workflow'}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(exec.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {exec.duration != null && <span className="text-sm text-muted-foreground">{formatDuration(exec.duration)}</span>}
                      <Badge variant={EXECUTION_STATUS_VARIANTS[exec.status] || 'secondary'}>
                        {exec.status}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="flex items-center text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
