import { useEffect, useCallback } from 'react';
import { useEditorStore } from '@/stores/editor-store';

interface UseKeyboardShortcutsOptions {
  onSave?: () => void;
  onRun?: () => void;
  onOpenNodePicker?: () => void;
  enabled?: boolean;
}

/**
 * Extended keyboard shortcuts for the workflow editor canvas.
 * This supplements the base shortcuts in use-editor-keyboard-shortcuts.
 */
export function useKeyboardShortcuts(
  options: UseKeyboardShortcutsOptions = {},
) {
  const { onSave, onRun, onOpenNodePicker, enabled = true } = options;

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const tag = (e.target as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+S — Save
      if (ctrl && e.key === 's') {
        e.preventDefault();
        onSave?.();
        return;
      }

      // Ctrl+Z — Undo
      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useEditorStore.temporal.getState().undo();
        return;
      }

      // Ctrl+Shift+Z / Ctrl+Y — Redo
      if (
        (ctrl && e.key === 'y') ||
        (ctrl && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
      ) {
        e.preventDefault();
        useEditorStore.temporal.getState().redo();
        return;
      }

      // Delete / Backspace — Delete selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        useEditorStore.getState().deleteSelectedNodes();
        return;
      }

      // Escape — Deselect all / close panels
      if (e.key === 'Escape') {
        useEditorStore.getState().setSelectedNode(null);
        const store = useEditorStore.getState();
        store.setNodes(store.nodes.map((n) => ({ ...n, selected: false })));
        return;
      }

      // Ctrl+A — Select all nodes
      if (ctrl && e.key === 'a') {
        e.preventDefault();
        useEditorStore.getState().selectAllNodes();
        return;
      }

      // Ctrl+D — Duplicate selected
      if (ctrl && e.key === 'd') {
        e.preventDefault();
        useEditorStore.getState().duplicateSelectedNodes();
        return;
      }

      // Ctrl+C — Copy
      if (ctrl && e.key === 'c') {
        e.preventDefault();
        useEditorStore.getState().copySelectedNodes();
        return;
      }

      // Ctrl+V — Paste
      if (ctrl && e.key === 'v') {
        e.preventDefault();
        useEditorStore.getState().pasteNodes();
        return;
      }

      // Ctrl+K — Open Node Picker
      if (ctrl && e.key === 'k') {
        e.preventDefault();
        onOpenNodePicker?.();
        return;
      }

      // Ctrl+Enter — Run workflow
      if (ctrl && e.key === 'Enter') {
        e.preventDefault();
        onRun?.();
        return;
      }
    },
    [enabled, onSave, onRun, onOpenNodePicker],
  );

  useEffect(() => {
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handler]);
}
