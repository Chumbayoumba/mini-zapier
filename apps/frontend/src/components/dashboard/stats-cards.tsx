'use client';

import { Card } from '@/components/ui/card';
import { Activity, CheckCircle2, XCircle, Clock, Workflow, Zap } from 'lucide-react';

interface StatsCardsProps {
  stats?: {
    totalWorkflows: number;
    activeWorkflows: number;
    totalExecutions: number;
    successRate: number;
    failedExecutions: number;
    avgDuration: number;
  };
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: 'Total Workflows',
      value: stats?.totalWorkflows ?? 0,
      icon: Workflow,
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      title: 'Active Workflows',
      value: stats?.activeWorkflows ?? 0,
      icon: Zap,
      color: 'text-green-500',
      bg: 'bg-green-50 dark:bg-green-950',
    },
    {
      title: 'Executions',
      value: stats?.totalExecutions ?? 0,
      icon: Activity,
      color: 'text-purple-500',
      bg: 'bg-purple-50 dark:bg-purple-950',
    },
    {
      title: 'Success Rate',
      value: `${(stats?.successRate ?? 0).toFixed(1)}%`,
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-950',
    },
    {
      title: 'Failed',
      value: stats?.failedExecutions ?? 0,
      icon: XCircle,
      color: 'text-red-500',
      bg: 'bg-red-50 dark:bg-red-950',
    },
    {
      title: 'Avg Duration',
      value: `${((stats?.avgDuration ?? 0) / 1000).toFixed(1)}s`,
      icon: Clock,
      color: 'text-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-950',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="p-4">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${card.bg}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{card.title}</p>
              <p className="text-lg font-bold">{card.value}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
