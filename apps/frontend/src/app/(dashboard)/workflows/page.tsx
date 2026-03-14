'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useWorkflows, useDeleteWorkflow, useActivateWorkflow, useDeactivateWorkflow } from '@/hooks/use-workflows';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Plus, Play, Pause, Trash2, Edit, Search,
  Workflow as WorkflowIcon, ArrowUpDown, Activity, CheckCircle2, Clock,
} from 'lucide-react';
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

const WORKFLOW_STATUSES = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'ARCHIVED', label: 'Archived' },
];

type SortKey = 'name' | 'updatedAt' | 'status';

export default function WorkflowsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('updatedAt');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useWorkflows({
    page,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
  });
  const deleteWorkflow = useDeleteWorkflow();
  const activateWorkflow = useActivateWorkflow();
  const deactivateWorkflow = useDeactivateWorkflow();

  const workflows: Workflow[] = data?.workflows || [];
  const totalPages = data?.totalPages || (data?.total ? Math.ceil(data.total / (data.limit || 10)) : 1);

  // Client-side sort (server handles search + status filter)
  const sorted = useMemo(() => {
    return [...workflows].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [workflows, sortBy]);

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

      {/* Search, status filter & sort */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 flex-wrap">
          {WORKFLOW_STATUSES.map((s) => (
            <Button
              key={s.value}
              variant={statusFilter === s.value ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => { setStatusFilter(s.value); setPage(1); }}
            >
              {s.value && (
                <span className={`w-1.5 h-1.5 rounded-full ${statusDot[s.value] || 'bg-gray-400'}`} />
              )}
              {s.label}
            </Button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs shrink-0 h-8"
          onClick={() =>
            setSortBy((prev) => (prev === 'updatedAt' ? 'name' : prev === 'name' ? 'status' : 'updatedAt'))
          }
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sortBy === 'updatedAt' ? 'Recent' : sortBy === 'name' ? 'Name' : 'Status'}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader><div className="h-5 w-32 bg-muted rounded" /></CardHeader>
              <CardContent><div className="h-4 w-full bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      ) : !sorted.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <WorkflowIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-semibold text-lg">
              {debouncedSearch || statusFilter ? 'No workflows found' : 'No workflows yet'}
            </p>
            <p className="text-muted-foreground text-sm mt-1 max-w-[280px] text-center">
              {debouncedSearch || statusFilter
                ? 'Try adjusting your search or filters.'
                : 'Create your first workflow to start automating.'}
            </p>
            {!debouncedSearch && !statusFilter && (
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
            {sorted.map((wf) => {
              const stats = (wf as any)._stats || {};
              const execCount = (wf as any)._count?.executions ?? stats.totalExecutions ?? 0;
              const successRate = stats.successRate;
              const lastRun = stats.lastExecution;

              return (
                <Card key={wf.id} className="group hover:shadow-md transition-all hover:border-primary/20">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="min-w-0 flex-1 mr-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[wf.status] || 'bg-gray-400'}`} />
                        <Link href={`/workflows/${wf.id}`} className="hover:underline">
                          <CardTitle className="text-base truncate">{wf.name}</CardTitle>
                        </Link>
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
                    {/* Execution stats */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1 tabular-nums">
                        <Activity className="h-3 w-3" /> {execCount} runs
                      </span>
                      {successRate != null && (
                        <span className="flex items-center gap-1 tabular-nums">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" /> {Math.round(successRate)}%
                        </span>
                      )}
                      {lastRun && (
                        <span className="flex items-center gap-1 truncate">
                          <Clock className="h-3 w-3" /> {formatDate(lastRun)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Updated {formatDate(wf.updatedAt)}</span>
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => deactivateWorkflow.mutate(wf.id)}
                        >
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
              );
            })}
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
