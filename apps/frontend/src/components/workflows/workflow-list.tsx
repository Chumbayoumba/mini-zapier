'use client';

import { WorkflowCard } from './workflow-card';
import { CreateWorkflowDialog } from './create-workflow-dialog';
import { Workflow as WorkflowIcon } from 'lucide-react';
import type { Workflow } from '@/types';

interface WorkflowListProps {
  workflows: Workflow[];
  onRun?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function WorkflowList({ workflows, onRun, onDelete }: WorkflowListProps) {
  if (!workflows.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <WorkflowIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="font-semibold text-lg">No workflows yet</p>
        <p className="text-muted-foreground text-sm mt-1 max-w-[280px]">
          Create your first workflow to start automating tasks.
        </p>
        <div className="mt-4">
          <CreateWorkflowDialog />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {workflows.map((wf) => (
        <WorkflowCard key={wf.id} workflow={wf} onRun={onRun} onDelete={onDelete} />
      ))}
    </div>
  );
}
