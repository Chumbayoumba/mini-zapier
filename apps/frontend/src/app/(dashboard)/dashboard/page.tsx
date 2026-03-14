'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Workflow, PlayCircle, CheckCircle, XCircle, Plus, ArrowRight, Zap } from 'lucide-react';
import { useDashboardStats, useRecentExecutions } from '@/hooks/use-executions';
import { useWorkflows } from '@/hooks/use-workflows';
import { formatDate, formatDuration } from '@/lib/utils';
import { EXECUTION_STATUS_VARIANTS } from '@/constants';
import type { WorkflowExecution, DashboardStats } from '@/types';
import { toast } from 'sonner';
import { useEffect } from 'react';
import Link from 'next/link';

interface StatsData extends DashboardStats {
  completed?: number;
  failed?: number;
  running?: number;
}

const STATUS_DOT: Record<string, string> = {
  COMPLETED: 'bg-emerald-500',
  FAILED: 'bg-red-500',
  RUNNING: 'bg-blue-500 animate-pulse',
  PENDING: 'bg-gray-400',
  CANCELLED: 'bg-gray-400',
};

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats();
  const { data: recentData, isLoading: recentLoading, error: recentError } = useRecentExecutions();
  const { data: workflowsData } = useWorkflows(1);

  useEffect(() => {
    if (statsError) toast.error('Failed to load dashboard stats');
    if (recentError) toast.error('Failed to load recent executions');
  }, [statsError, recentError]);

  const typedStats = stats as StatsData | undefined;
  const recentExecutions: WorkflowExecution[] = recentData?.executions || [];

  const statCards = [
    {
      title: 'Total Workflows',
      value: workflowsData?.total ?? typedStats?.totalWorkflows ?? 0,
      icon: Workflow,
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-500/15',
    },
    {
      title: 'Executions',
      value: typedStats?.totalExecutions ?? 0,
      icon: PlayCircle,
      iconColor: 'text-violet-600 dark:text-violet-400',
      iconBg: 'bg-violet-100 dark:bg-violet-500/15',
    },
    {
      title: 'Completed',
      value: typedStats?.completed ?? 0,
      icon: CheckCircle,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-100 dark:bg-emerald-500/15',
    },
    {
      title: 'Failed',
      value: typedStats?.failedExecutions ?? typedStats?.failed ?? 0,
      icon: XCircle,
      iconColor: 'text-red-600 dark:text-red-400',
      iconBg: 'bg-red-100 dark:bg-red-500/15',
    },
  ];

  const isLoading = statsLoading || recentLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Monitor your automations at a glance</p>
        </div>
        <Link href="/workflows/new">
          <Button className="gap-2 shadow-md shadow-primary/20">
            <Plus className="h-4 w-4" />
            Create Workflow
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="relative overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.title}</p>
                    {statsLoading ? (
                      <div className="h-9 w-16 bg-muted rounded animate-pulse mt-1" />
                    ) : (
                      <p className="text-3xl font-bold mt-1 tabular-nums">{stat.value}</p>
                    )}
                  </div>
                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${stat.iconBg}`}>
                    <Icon className={`h-5 w-5 ${stat.iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick actions */}
      <Card className="bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600 border-0 text-white">
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Ready to automate?</p>
              <p className="text-sm text-white/70">Create your first workflow or explore templates</p>
            </div>
          </div>
          <Link href="/workflows/new">
            <Button variant="secondary" className="gap-1.5 bg-white/15 backdrop-blur-sm border-white/20 text-white hover:bg-white/25">
              Get Started <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Recent executions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent Executions</CardTitle>
            <Link href="/executions" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : !recentExecutions.length ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                <PlayCircle className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-sm">No executions yet</p>
              <p className="text-muted-foreground text-xs mt-1 max-w-[240px]">
                Create and run a workflow to see execution results here.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentExecutions.map((exec) => (
                <div
                  key={exec.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[exec.status] || 'bg-gray-400'}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{exec.workflow?.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(exec.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 ml-4">
                    {exec.duration != null && (
                      <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(exec.duration)}</span>
                    )}
                    <Badge
                      variant={EXECUTION_STATUS_VARIANTS[exec.status] || 'secondary'}
                      className="text-[10px] px-2"
                    >
                      {exec.status}
                    </Badge>
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
