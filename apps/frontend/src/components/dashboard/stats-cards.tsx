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
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-500/15',
    },
    {
      title: 'Active',
      value: stats?.activeWorkflows ?? 0,
      icon: Zap,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-100 dark:bg-emerald-500/15',
    },
    {
      title: 'Executions',
      value: stats?.totalExecutions ?? 0,
      icon: Activity,
      iconColor: 'text-violet-600 dark:text-violet-400',
      iconBg: 'bg-violet-100 dark:bg-violet-500/15',
    },
    {
      title: 'Success Rate',
      value: `${(stats?.successRate ?? 0).toFixed(1)}%`,
      icon: CheckCircle2,
      iconColor: 'text-teal-600 dark:text-teal-400',
      iconBg: 'bg-teal-100 dark:bg-teal-500/15',
    },
    {
      title: 'Failed',
      value: stats?.failedExecutions ?? 0,
      icon: XCircle,
      iconColor: 'text-red-600 dark:text-red-400',
      iconBg: 'bg-red-100 dark:bg-red-500/15',
    },
    {
      title: 'Avg Duration',
      value: `${((stats?.avgDuration ?? 0) / 1000).toFixed(1)}s`,
      icon: Clock,
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-100 dark:bg-amber-500/15',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2.5 ${card.iconBg}`}>
                <Icon className={`h-4 w-4 ${card.iconColor}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide truncate">{card.title}</p>
                <p className="text-lg font-bold tabular-nums">{card.value}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
