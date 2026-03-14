'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { X } from 'lucide-react';

const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'PAUSED', label: 'Paused' },
];

const STATUS_DOTS: Record<string, string> = {
  COMPLETED: 'bg-emerald-500',
  FAILED: 'bg-red-500',
  RUNNING: 'bg-blue-500',
  PENDING: 'bg-gray-400',
  CANCELLED: 'bg-gray-400',
  PAUSED: 'bg-yellow-500',
};

interface ExecutionFiltersProps {
  status: string;
  dateFrom: string;
  dateTo: string;
  workflowId: string;
  workflows?: { id: string; name: string }[];
  onStatusChange: (status: string) => void;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onWorkflowIdChange: (id: string) => void;
  onClear: () => void;
}

export function ExecutionFilters({
  status,
  dateFrom,
  dateTo,
  workflowId,
  workflows = [],
  onStatusChange,
  onDateFromChange,
  onDateToChange,
  onWorkflowIdChange,
  onClear,
}: ExecutionFiltersProps) {
  const hasFilters = status || dateFrom || dateTo || workflowId;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUSES.map((s) => (
          <Button
            key={s.value}
            variant={status === s.value ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => onStatusChange(s.value)}
          >
            {s.value && (
              <span
                className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[s.value] || 'bg-gray-400'}`}
              />
            )}
            {s.label}
          </Button>
        ))}
      </div>

      {/* Date filters */}
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="h-8 w-36 text-xs"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="h-8 w-36 text-xs"
        />
      </div>

      {/* Workflow filter */}
      {workflows.length > 0 && (
        <Select
          value={workflowId}
          onChange={(e) => onWorkflowIdChange(e.target.value)}
          className="h-8 w-48 text-xs"
          options={[
            { value: '', label: 'All workflows' },
            ...workflows.map((wf) => ({ value: wf.id, label: wf.name })),
          ]}
        />
      )}

      {/* Clear button */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={onClear}
        >
          <X className="h-3 w-3" /> Clear
        </Button>
      )}
    </div>
  );
}
