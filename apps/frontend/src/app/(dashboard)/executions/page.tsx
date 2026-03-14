'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useExecutions } from '@/hooks/use-executions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatDuration } from '@/lib/utils';

export default function ExecutionsPage() {
  const [page] = useState(1);
  const { data, isLoading } = useExecutions(page);

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
          ) : !data?.executions?.length ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No executions yet</p>
          ) : (
            <div className="space-y-2">
              {data.executions.map((exec: any) => (
                <Link key={exec.id} href={`/executions/${exec.id}`}>
                  <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent transition-colors cursor-pointer">
                    <div>
                      <p className="font-medium">{exec.workflow?.name || 'Unknown Workflow'}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(exec.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {exec.duration && <span className="text-sm text-muted-foreground">{formatDuration(exec.duration)}</span>}
                      <Badge variant={exec.status === 'COMPLETED' ? 'success' : exec.status === 'FAILED' ? 'destructive' : 'secondary'}>
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
    </div>
  );
}
