import { useEffect, useCallback } from 'react';
import { useEditorStore } from '@/stores/editor-store';

interface UseEditorKeyboardShortcutsOptions {
  onSave?: () => void;
  enabled?: boolean;
}

export function useEditorKeyboardShortcuts(
  options: UseEditorKeyboardShortcutsOptions = {},
) {
  const { onSave, enabled = true } = options;

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const tag = (e.target as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      const ctrl = e.ctrlKey || e.metaKey;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        useEditorStore.getState().deleteSelectedNodes();
      }
      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useEditorStore.temporal.getState().undo();
      }
      if (
        (ctrl && e.key === 'y') ||
        (ctrl && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
      ) {
        e.preventDefault();
        useEditorStore.temporal.getState().redo();
      }
      if (ctrl && e.key === 'c') {
        e.preventDefault();
        useEditorStore.getState().copySelectedNodes();
      }
      if (ctrl && e.key === 'v') {
        e.preventDefault();
        useEditorStore.getState().pasteNodes();
      }
      if (ctrl && e.key === 'a') {
        e.preventDefault();
        useEditorStore.getState().selectAllNodes();
      }
      if (ctrl && e.key === 's') {
        e.preventDefault();
        onSave?.();
      }
      if (ctrl && e.key === 'd') {
        e.preventDefault();
        useEditorStore.getState().duplicateSelectedNodes();
      }
      if (e.key === 'Escape') {
        useEditorStore.getState().setSelectedNode(null);
        const store = useEditorStore.getState();
        store.setNodes(store.nodes.map((n) => ({ ...n, selected: false })));
      }
    },
    [enabled, onSave],
  );

  useEffect(() => {
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handler]);
}
