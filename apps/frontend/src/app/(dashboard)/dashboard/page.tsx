'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { ExecutionLineChart } from '@/components/dashboard/execution-line-chart';
import { RecentExecutions } from '@/components/dashboard/recent-executions';
import { WorkflowStatusChart } from '@/components/dashboard/workflow-status-chart';
import { ExecutionTimeline } from '@/components/dashboard/execution-timeline';
import { Plus, Key, Workflow, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [chartPeriod, setChartPeriod] = useState<'7d' | '30d'>('7d');
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [statsRes, chartRes] = await Promise.all([
        api.get('/executions/stats'),
        api.get('/executions/chart'),
      ]);
      return { stats: statsRes.data, chart: chartRes.data };
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Overview of your automation platform</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/workflows/new">
          <Card className="hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center group-hover:bg-indigo-200 dark:group-hover:bg-indigo-500/25 transition-colors">
                <Plus className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">New Workflow</p>
                <p className="text-xs text-muted-foreground">Create an automation</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/credentials">
          <Card className="hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center group-hover:bg-emerald-200 dark:group-hover:bg-emerald-500/25 transition-colors">
                <Key className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Add Credential</p>
                <p className="text-xs text-muted-foreground">Connect a service</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/workflows">
          <Card className="hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center group-hover:bg-violet-200 dark:group-hover:bg-violet-500/25 transition-colors">
                <Workflow className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">My Workflows</p>
                <p className="text-xs text-muted-foreground">View all workflows</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </CardContent>
          </Card>
        </Link>
      </div>

      <StatsCards stats={stats?.stats} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ExecutionLineChart data={stats?.chart} period={chartPeriod} onPeriodChange={setChartPeriod} />
        <WorkflowStatusChart />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentExecutions />
        <ExecutionTimeline />
      </div>
    </div>
  );
}
