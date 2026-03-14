'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ExecutionLineChartProps {
  data?: { date: string; success: number; failed: number }[];
  period: '7d' | '30d';
  onPeriodChange: (period: '7d' | '30d') => void;
  isLoading?: boolean;
}

export function ExecutionLineChart({ data = [], period, onPeriodChange, isLoading }: ExecutionLineChartProps) {
  if (isLoading) {
    return (
      <Card className="p-5">
        <div className="h-[280px] bg-muted rounded animate-pulse" />
      </Card>
    );
  }

  if (!data.length) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
            <TrendingUp className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium text-sm">No trend data</p>
          <p className="text-muted-foreground text-xs mt-1">Execution trends will appear once workflows run</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">Execution Trends</h3>
        <div className="flex gap-1">
          {(['7d', '30d'] as const).map((p) => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => onPeriodChange(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--card))',
                fontSize: 12,
              }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="success" stroke="#22c55e" name="Success" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="failed" stroke="#ef4444" name="Failed" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
