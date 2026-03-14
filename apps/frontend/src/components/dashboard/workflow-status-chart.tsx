'use client';

import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#22c55e', '#ef4444', '#eab308', '#6366f1', '#94a3b8'];

interface WorkflowStatusChartProps {
  data?: { name: string; count: number }[];
}

export function WorkflowStatusChart({ data = [] }: WorkflowStatusChartProps) {
  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <Card className="p-6 text-center text-muted-foreground text-sm">
        No data to display yet
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="font-semibold text-sm mb-4">Workflow Status Distribution</h3>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.filter((d) => d.count > 0)}
              dataKey="count"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={70}
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
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
      <Card className="p-6 text-center text-muted-foreground text-sm">
        No execution data yet
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="font-semibold text-sm mb-4">Executions (Last 7 Days)</h3>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
            <YAxis className="text-xs" tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="success" fill="#22c55e" name="Success" radius={[2, 2, 0, 0]} />
            <Bar dataKey="failed" fill="#ef4444" name="Failed" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
