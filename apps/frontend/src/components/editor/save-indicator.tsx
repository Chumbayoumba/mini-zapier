'use client';

import { useEditorStore } from '@/stores/editor-store';
import { Cloud, CloudOff, Loader2, Check } from 'lucide-react';

export function SaveIndicator() {
  const isSaving = useEditorStore((s) => s.isSaving);
  const isDirty = useEditorStore((s) => s.isDirty);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);

  if (isSaving) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving...
      </div>
    );
  }

  if (isDirty) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-500">
        <CloudOff className="h-3 w-3" />
        Unsaved
      </div>
    );
  }

  if (lastSavedAt) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-500">
        <Check className="h-3 w-3" />
        Saved
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Cloud className="h-3 w-3" />
      Draft
    </div>
  );
}
