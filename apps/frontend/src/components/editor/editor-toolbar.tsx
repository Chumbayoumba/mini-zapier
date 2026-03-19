'use client';

import { useRouter } from 'next/navigation';
import { useReactFlow } from '@xyflow/react';
import { useStore } from 'zustand';
import { useEditorStore } from '@/stores/editor-store';
import { useActivateWorkflow, useDeactivateWorkflow } from '@/hooks/use-workflows';
import { SaveIndicator } from '@/components/editor/save-indicator';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Undo2, Redo2, Save, Play, Maximize,
  Loader2, Power, PowerOff, ZoomIn, ZoomOut,
  LayoutGrid, StickyNote, Plus, Download, Upload, Map,
} from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error-handler';

interface EditorToolbarProps {
  workflowId: string;
  workflowName?: string;
  workflowActive?: boolean;
  onSave: () => void;
  onRun: () => void;
  isSaving?: boolean;
  isRunning?: boolean;
  onAutoLayout?: () => void;
  onAddStickyNote?: () => void;
  onOpenNodePicker?: () => void;
  onToggleMinimap?: () => void;
}

export function EditorToolbar({
  workflowId,
  workflowName,
  workflowActive,
  onSave,
  onRun,
  isSaving,
  isRunning,
  onAutoLayout,
  onAddStickyNote,
  onOpenNodePicker,
  onToggleMinimap,
}: EditorToolbarProps) {
  const router = useRouter();
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  const canUndo = useStore(useEditorStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useEditorStore.temporal, (s) => s.futureStates.length > 0);

  const activateWorkflow = useActivateWorkflow();
  const deactivateWorkflow = useDeactivateWorkflow();

  const handleToggleActive = async () => {
    try {
      if (workflowActive) {
        await deactivateWorkflow.mutateAsync(workflowId);
      } else {
        await activateWorkflow.mutateAsync(workflowId);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const isToggling = activateWorkflow.isPending || deactivateWorkflow.isPending;

  const handleExport = () => {
    const { nodes, edges } = useEditorStore.getState();
    const data = JSON.stringify({ nodes, edges }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(workflowName || 'workflow').replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Workflow exported');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.nodes && Array.isArray(data.nodes)) {
          useEditorStore.getState().setNodes(data.nodes);
          useEditorStore.getState().setEdges(data.edges || []);
          toast.success('Workflow imported');
          setTimeout(() => fitView({ padding: 0.2 }), 100);
        } else {
          toast.error('Invalid workflow file');
        }
      } catch {
        toast.error('Failed to parse workflow file');
      }
    };
    input.click();
  };

  return (
    <div className="flex items-center gap-2 border-b px-3 py-2 bg-card">
      <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground mr-1" onClick={() => router.push('/workflows')}>
        <ArrowLeft className="h-3.5 w-3.5" />
        <span className="hidden sm:inline text-xs">Back</span>
      </Button>
      <div className="w-px h-5 bg-border" />

      <Button size="sm" variant="ghost" onClick={() => useEditorStore.temporal.getState().undo()} disabled={!canUndo} title="Undo (Ctrl+Z)">
        <Undo2 className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => useEditorStore.temporal.getState().redo()} disabled={!canRedo} title="Redo (Ctrl+Y)">
        <Redo2 className="h-3.5 w-3.5" />
      </Button>
      <div className="w-px h-5 bg-border" />

      <h2 className="font-semibold text-sm truncate px-1 min-w-0">
        {workflowName || 'Workflow Editor'}
      </h2>

      <SaveIndicator />
      <div className="flex-1" />

      <Button size="sm" variant="ghost" onClick={() => zoomOut()} title="Zoom Out">
        <ZoomOut className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => zoomIn()} title="Zoom In">
        <ZoomIn className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => fitView({ padding: 0.2 })} title="Fit to view">
        <Maximize className="h-3.5 w-3.5" />
      </Button>
      <div className="w-px h-5 bg-border" />

      <Button size="sm" variant="ghost" onClick={onAutoLayout} title="Tidy Up (Auto Layout)">
        <LayoutGrid className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" onClick={onAddStickyNote} title="Add Sticky Note">
        <StickyNote className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" onClick={onOpenNodePicker} title="Add Node (Ctrl+K)">
        <Plus className="h-3.5 w-3.5" />
      </Button>
      <div className="w-px h-5 bg-border" />

      <Button size="sm" variant="ghost" onClick={handleExport} title="Export JSON">
        <Download className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" onClick={handleImport} title="Import JSON">
        <Upload className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" onClick={onToggleMinimap} title="Toggle Minimap">
        <Map className="h-3.5 w-3.5" />
      </Button>
      <div className="w-px h-5 bg-border" />

      <Button
        size="sm"
        variant={workflowActive ? 'destructive' : 'outline'}
        className="gap-1.5"
        onClick={handleToggleActive}
        disabled={isToggling}
        title={workflowActive ? 'Deactivate workflow' : 'Activate workflow'}
      >
        {isToggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : workflowActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{workflowActive ? 'Deactivate' : 'Activate'}</span>
      </Button>

      <Button size="sm" variant="outline" className="gap-1.5" onClick={onSave} disabled={isSaving}>
        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Save
      </Button>
      <Button size="sm" className="gap-1.5 shadow-sm shadow-primary/20" onClick={onRun} disabled={isRunning}>
        {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        {isRunning ? 'Running...' : 'Run'}
      </Button>
    </div>
  );
}
