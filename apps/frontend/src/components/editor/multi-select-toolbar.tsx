'use client';

import { useEditorStore } from '@/stores/editor-store';
import { Button } from '@/components/ui/button';
import { Trash2, Copy } from 'lucide-react';

export function MultiSelectToolbar() {
  const nodes = useEditorStore((s) => s.nodes);
  const selectedCount = nodes.filter((n) => n.selected).length;

  if (selectedCount < 2) return null;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-card border rounded-lg shadow-lg px-3 py-1.5 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
      <span className="text-xs font-medium text-muted-foreground">
        {selectedCount} selected
      </span>
      <div className="w-px h-4 bg-border" />
      <Button
        size="sm"
        variant="ghost"
        className="h-7 gap-1 text-xs"
        onClick={() => useEditorStore.getState().duplicateSelectedNodes()}
      >
        <Copy className="h-3 w-3" /> Duplicate
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
        onClick={() => useEditorStore.getState().deleteSelectedNodes()}
      >
        <Trash2 className="h-3 w-3" /> Delete
      </Button>
    </div>
  );
}
