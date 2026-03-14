'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { ExecutionBarChart, WorkflowStatusChart } from '@/components/dashboard/workflow-status-chart';
import { ExecutionLineChart } from '@/components/dashboard/execution-line-chart';
import { RecentExecutions } from '@/components/dashboard/recent-executions';
import { useDashboardStats, useRecentExecutions, useChartData } from '@/hooks/use-executions';
import { useDashboardLive } from '@/hooks/use-websocket';
import { Plus, ArrowRight, Zap } from 'lucide-react';
import { toast } from 'sonner';
import type { WorkflowExecution } from '@/types';

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats();
  const { data: recentData, isLoading: recentLoading, error: recentError } = useRecentExecutions();
  const [chartPeriod, setChartPeriod] = useState<'7d' | '30d'>('7d');
  const { data: chartData, isLoading: chartLoading } = useChartData(chartPeriod);

  useDashboardLive();

  useEffect(() => {
    if (statsError) toast.error('Failed to load dashboard stats');
    if (recentError) toast.error('Failed to load recent executions');
  }, [statsError, recentError]);

  const recentExecutions: WorkflowExecution[] = recentData?.executions || [];

  const statusDistribution = stats ? [
    { name: 'Completed', count: stats.completed || 0 },
    { name: 'Failed', count: stats.failed || 0 },
    { name: 'Running', count: stats.running || 0 },
  ].filter(d => d.count > 0) : [];

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

      {/* Stats Cards */}
      <StatsCards stats={stats} />

      {/* Quick Action */}
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExecutionBarChart data={chartData} />
        <WorkflowStatusChart data={statusDistribution} />
      </div>

      {/* Line Chart + Recent Executions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExecutionLineChart
          data={chartData}
          period={chartPeriod}
          onPeriodChange={setChartPeriod}
          isLoading={chartLoading}
        />
        <RecentExecutions executions={recentExecutions} />
      </div>
    </div>
  );
}
