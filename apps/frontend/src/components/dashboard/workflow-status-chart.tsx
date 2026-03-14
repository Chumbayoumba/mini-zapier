'use client';

import { Card } from '@/components/ui/card';
import { BarChart3, PieChart as PieIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#22c55e', '#ef4444', '#eab308', '#6366f1', '#94a3b8'];

interface WorkflowStatusChartProps {
  data?: { name: string; count: number }[];
}

export function WorkflowStatusChart({ data = [] }: WorkflowStatusChartProps) {
  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
            <PieIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium text-sm">No data yet</p>
          <p className="text-muted-foreground text-xs mt-1">Status distribution will appear here</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-sm mb-4">Status Distribution</h3>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.filter((d) => d.count > 0)}
              dataKey="count"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              strokeWidth={2}
              stroke="hsl(var(--card))"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--card))',
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

interface ExecutionBarChartProps {
  data?: { date: string; success: number; failed: number }[];
}

export function ExecutionBarChart({ data = [] }: ExecutionBarChartProps) {
  if (!data.length) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
            <BarChart3 className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium text-sm">No execution data</p>
          <p className="text-muted-foreground text-xs mt-1">Bar chart will appear once workflows run</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-sm mb-4">Executions (Last 7 Days)</h3>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis className="text-xs" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--card))',
                fontSize: 12,
              }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="success" fill="#22c55e" name="Success" radius={[4, 4, 0, 0]} />
            <Bar dataKey="failed" fill="#ef4444" name="Failed" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
