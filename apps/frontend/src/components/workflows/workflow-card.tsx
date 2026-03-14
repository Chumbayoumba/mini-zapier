'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Play, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import type { Workflow } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  PAUSED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  ARCHIVED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

interface WorkflowCardProps {
  workflow: Workflow;
  onRun?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function WorkflowCard({ workflow, onRun, onDelete }: WorkflowCardProps) {
  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <Link
            href={`/workflows/${workflow.id}`}
            className="text-sm font-semibold hover:underline truncate block"
          >
            {workflow.name}
          </Link>
          {workflow.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{workflow.description}</p>
          )}
        </div>
        <Badge className={STATUS_COLORS[workflow.status] || ''} variant="outline">
          {workflow.status}
        </Badge>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <span className="text-xs text-muted-foreground">v{workflow.version}</span>
        {workflow.trigger && (
          <Badge variant="secondary" className="text-xs">
            {workflow.trigger.type}
          </Badge>
        )}
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={() => onRun?.(workflow.id)}>
          <Play className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/workflows/${workflow.id}/editor`}>
            <Pencil className="h-3 w-3" />
          </Link>
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete?.(workflow.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
}
