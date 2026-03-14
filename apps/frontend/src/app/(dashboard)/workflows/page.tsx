'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useWorkflows, useDeleteWorkflow, useActivateWorkflow } from '@/hooks/use-workflows';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Play, Pause, Trash2, Edit } from 'lucide-react';
import { formatDate } from '@/lib/utils';

const statusColors: Record<string, any> = {
  DRAFT: 'secondary',
  ACTIVE: 'success',
  PAUSED: 'warning',
  ARCHIVED: 'outline',
};

export default function WorkflowsPage() {
  const [page] = useState(1);
  const { data, isLoading } = useWorkflows(page);
  const deleteWorkflow = useDeleteWorkflow();
  const activateWorkflow = useActivateWorkflow();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Workflows</h1>
        <Link href="/workflows/new">
          <Button><Plus className="mr-2 h-4 w-4" /> New Workflow</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader><div className="h-6 w-32 bg-muted rounded" /></CardHeader>
              <CardContent><div className="h-4 w-full bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      ) : !data?.workflows?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No workflows yet</p>
            <Link href="/workflows/new">
              <Button><Plus className="mr-2 h-4 w-4" /> Create your first workflow</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.workflows.map((wf: any) => (
            <Card key={wf.id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-lg">{wf.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{wf.description || 'No description'}</p>
                </div>
                <Badge variant={statusColors[wf.status] || 'secondary'}>{wf.status}</Badge>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{formatDate(wf.updatedAt)}</span>
                  <span>{wf._count?.executions || 0} runs</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href={`/workflows/${wf.id}/editor`}>
                    <Button size="sm" variant="outline"><Edit className="h-3 w-3 mr-1" /> Edit</Button>
                  </Link>
                  {wf.status !== 'ACTIVE' ? (
                    <Button size="sm" variant="outline" onClick={() => activateWorkflow.mutate(wf.id)}>
                      <Play className="h-3 w-3 mr-1" /> Activate
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline"><Pause className="h-3 w-3 mr-1" /> Pause</Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteWorkflow.mutate(wf.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
