'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useWorkflows, useDeleteWorkflow, useActivateWorkflow } from '@/hooks/use-workflows';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Play, Pause, Trash2, Edit, Search, Workflow as WorkflowIcon, ArrowUpDown } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Workflow } from '@/types';

const statusColors: Record<string, 'secondary' | 'success' | 'warning' | 'outline'> = {
  DRAFT: 'secondary',
  ACTIVE: 'success',
  PAUSED: 'warning',
  ARCHIVED: 'outline',
};

const statusDot: Record<string, string> = {
  ACTIVE: 'bg-emerald-500',
  DRAFT: 'bg-gray-400',
  PAUSED: 'bg-yellow-500',
  ARCHIVED: 'bg-red-400',
};

type SortKey = 'name' | 'updatedAt' | 'status';

export default function WorkflowsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('updatedAt');
  const { data, isLoading } = useWorkflows(page);
  const deleteWorkflow = useDeleteWorkflow();
  const activateWorkflow = useActivateWorkflow();

  const workflows: Workflow[] = data?.workflows || [];
  const totalPages = data?.total ? Math.ceil(data.total / (data.limit || 10)) : 1;

  const filtered = useMemo(() => {
    let result = workflows;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (wf) => wf.name.toLowerCase().includes(q) || wf.description?.toLowerCase().includes(q),
      );
    }
    result = [...result].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return result;
  }, [workflows, search, sortBy]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Build, manage & monitor your automations</p>
        </div>
        <Link href="/workflows/new">
          <Button className="gap-2 shadow-md shadow-primary/20">
            <Plus className="h-4 w-4" /> New Workflow
          </Button>
        </Link>
      </div>

      {/* Search & sort */}
      {(workflows.length > 0 || search) && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search workflows..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs shrink-0"
            onClick={() =>
              setSortBy((prev) => (prev === 'updatedAt' ? 'name' : prev === 'name' ? 'status' : 'updatedAt'))
            }
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortBy === 'updatedAt' ? 'Recent' : sortBy === 'name' ? 'Name' : 'Status'}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader><div className="h-5 w-32 bg-muted rounded" /></CardHeader>
              <CardContent><div className="h-4 w-full bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <WorkflowIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-semibold text-lg">
              {search ? 'No workflows found' : 'No workflows yet'}
            </p>
            <p className="text-muted-foreground text-sm mt-1 max-w-[280px] text-center">
              {search
                ? `No workflows matching "${search}". Try a different search.`
                : 'Create your first workflow to start automating.'}
            </p>
            {!search && (
              <Link href="/workflows/new" className="mt-4">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Create your first workflow
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((wf) => (
              <Card key={wf.id} className="group hover:shadow-md transition-all hover:border-primary/20">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="min-w-0 flex-1 mr-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[wf.status] || 'bg-gray-400'}`} />
                      <CardTitle className="text-base truncate">{wf.name}</CardTitle>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 pl-4">
                      {wf.description || 'No description'}
                    </p>
                  </div>
                  <Badge variant={statusColors[wf.status] || 'secondary'} className="text-[10px] shrink-0">
                    {wf.status}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDate(wf.updatedAt)}</span>
                    <span className="tabular-nums">
                      {(wf as Workflow & { _count?: { executions?: number } })._count?.executions || 0} runs
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link href={`/workflows/${wf.id}/editor`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                        <Edit className="h-3 w-3" /> Edit
                      </Button>
                    </Link>
                    {wf.status !== 'ACTIVE' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => activateWorkflow.mutate(wf.id)}
                      >
                        <Play className="h-3 w-3" /> Activate
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                        <Pause className="h-3 w-3" /> Pause
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive hover:text-destructive ml-auto"
                      onClick={() => deleteWorkflow.mutate(wf.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="flex items-center text-sm text-muted-foreground tabular-nums">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
