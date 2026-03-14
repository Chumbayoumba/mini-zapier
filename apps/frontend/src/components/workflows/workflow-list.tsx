'use client';

import { WorkflowCard } from './workflow-card';
import { CreateWorkflowDialog } from './create-workflow-dialog';
import type { Workflow } from '@/types';

interface WorkflowListProps {
  workflows: Workflow[];
  onRun?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function WorkflowList({ workflows, onRun, onDelete }: WorkflowListProps) {
  if (!workflows.length) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-muted-foreground">No workflows yet. Create your first one!</p>
        <CreateWorkflowDialog />
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
