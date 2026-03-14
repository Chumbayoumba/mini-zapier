'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import type { Workflow } from '@/types';

const STATUS_BADGE: Record<string, 'success' | 'secondary' | 'warning' | 'outline'> = {
  ACTIVE: 'success',
  DRAFT: 'secondary',
  PAUSED: 'warning',
  ARCHIVED: 'outline',
};

const STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-emerald-500',
  DRAFT: 'bg-gray-400',
  PAUSED: 'bg-yellow-500',
  ARCHIVED: 'bg-red-400',
};

interface WorkflowCardProps {
  workflow: Workflow;
  onRun?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function WorkflowCard({ workflow, onRun, onDelete }: WorkflowCardProps) {
  return (
    <Card className="p-4 hover:shadow-md transition-all hover:border-primary/20">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[workflow.status] || 'bg-gray-400'}`} />
            <Link
              href={`/workflows/${workflow.id}`}
              className="text-sm font-semibold hover:underline truncate block"
            >
              {workflow.name}
            </Link>
          </div>
          {workflow.description && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 pl-4">{workflow.description}</p>
          )}
        </div>
        <Badge variant={STATUS_BADGE[workflow.status] || 'secondary'} className="text-[10px] shrink-0">
          {workflow.status}
        </Badge>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t">
        <span className="text-[11px] text-muted-foreground">v{workflow.version}</span>
        {workflow.trigger && (
          <Badge variant="secondary" className="text-[10px] px-1.5">
            {workflow.trigger.type}
          </Badge>
        )}
        <div className="flex-1" />
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onRun?.(workflow.id)} title="Run">
          <Play className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild title="Edit">
          <Link href={`/workflows/${workflow.id}/editor`}>
            <Pencil className="h-3 w-3" />
          </Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          onClick={() => onDelete?.(workflow.id)}
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
}
