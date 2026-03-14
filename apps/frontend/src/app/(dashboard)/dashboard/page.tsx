'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Workflow, PlayCircle, CheckCircle, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/utils';

export default function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      try {
        const res = await api.get('/executions');
        const data = res.data.data || res.data;
        return {
          totalWorkflows: data.total || 0,
          activeWorkflows: 0,
          totalExecutions: data.total || 0,
          completed: 0,
          failed: 0,
          running: 0,
        };
      } catch {
        return { totalWorkflows: 0, activeWorkflows: 0, totalExecutions: 0, completed: 0, failed: 0, running: 0 };
      }
    },
  });

  const { data: recentData } = useQuery({
    queryKey: ['recent-executions'],
    queryFn: async () => {
      try {
        const res = await api.get('/executions?limit=5');
        return (res.data.data || res.data)?.executions || [];
      } catch {
        return [];
      }
    },
  });

  const statCards = [
    { title: 'Total Workflows', value: stats?.totalWorkflows || 0, icon: Workflow, color: 'text-blue-500' },
    { title: 'Executions', value: stats?.totalExecutions || 0, icon: PlayCircle, color: 'text-purple-500' },
    { title: 'Completed', value: stats?.completed || 0, icon: CheckCircle, color: 'text-green-500' },
    { title: 'Failed', value: stats?.failed || 0, icon: XCircle, color: 'text-red-500' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Executions</CardTitle>
        </CardHeader>
        <CardContent>
          {!recentData?.length ? (
            <p className="text-muted-foreground text-sm">No executions yet. Create and run a workflow to get started.</p>
          ) : (
            <div className="space-y-3">
              {recentData.map((exec: any) => (
                <div key={exec.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{exec.workflow?.name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(exec.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {exec.duration && <span className="text-sm text-muted-foreground">{formatDuration(exec.duration)}</span>}
                    <Badge variant={exec.status === 'COMPLETED' ? 'success' : exec.status === 'FAILED' ? 'destructive' : 'secondary'}>
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
