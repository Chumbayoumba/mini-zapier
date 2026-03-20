'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  Pencil,
  Copy,
  Clipboard,
  CopyPlus,
  Trash2,
  EyeOff,
  Eye,
  Type,
  Play,
  PlusCircle,
} from 'lucide-react';
import type { Node } from '@xyflow/react';
import { useEditorStore } from '@/stores/editor-store';
import { toast } from 'sonner';

interface NodeContextMenuProps {
  x: number;
  y: number;
  node: Node;
  onClose: () => void;
  onEdit: (node: Node) => void;
  onDuplicate: (node: Node) => void;
  onDelete: (node: Node) => void;
  onAddNodeAfter?: (node: Node) => void;
  onExecuteFromHere?: (node: Node) => void;
}

export function NodeContextMenu({
  x,
  y,
  node,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  onAddNodeAfter,
  onExecuteFromHere,
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState((node.data?.label as string) || '');
  const renameRef = useRef<HTMLInputElement>(null);

  const isDisabled = !!node.data?.disabled;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (renaming) {
      setTimeout(() => renameRef.current?.focus(), 50);
    }
  }, [renaming]);

  const handleRenameSubmit = () => {
    if (renameValue.trim()) {
      useEditorStore.getState().updateNodeData(node.id, { label: renameValue.trim() });
      toast.success('Node renamed');
    }
    setRenaming(false);
    onClose();
  };

  const handleToggleDisable = () => {
    useEditorStore.getState().updateNodeData(node.id, { disabled: !isDisabled });
    toast.success(isDisabled ? 'Node enabled' : 'Node disabled');
    onClose();
  };

  const handleCopy = () => {
    // Select this node, then copy
    const store = useEditorStore.getState();
    store.setNodes(store.nodes.map((n) => ({ ...n, selected: n.id === node.id })));
    setTimeout(() => store.copySelectedNodes(), 0);
    toast.success('Node copied');
    onClose();
  };

  const handlePaste = () => {
    useEditorStore.getState().pasteNodes();
    onClose();
  };

  // Adjust position so menu stays within viewport
  const menuWidth = 200;
  const menuHeight = 340;
  const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x;
  const adjustedY = y + menuHeight > window.innerHeight ? y - menuHeight : y;

  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(0, adjustedX),
    top: Math.max(0, adjustedY),
    zIndex: 1000,
  };

  type MenuItem =
    | { label: string; icon: React.ComponentType<{ className?: string }>; action: () => void; shortcut?: string; danger?: boolean }
    | { divider: true };

  const items: MenuItem[] = [
    { label: 'Edit', icon: Pencil, action: () => { onEdit(node); onClose(); } },
    { label: 'Copy', icon: Copy, action: handleCopy, shortcut: 'Ctrl+C' },
    { label: 'Paste', icon: Clipboard, action: handlePaste, shortcut: 'Ctrl+V' },
    { label: 'Duplicate', icon: CopyPlus, action: () => { onDuplicate(node); onClose(); }, shortcut: 'Ctrl+D' },
    { label: 'Delete', icon: Trash2, action: () => { onDelete(node); onClose(); }, shortcut: 'Del', danger: true },
    { divider: true },
    {
      label: isDisabled ? 'Enable' : 'Disable',
      icon: isDisabled ? Eye : EyeOff,
      action: handleToggleDisable,
    },
    { label: 'Rename', icon: Type, action: () => setRenaming(true) },
    ...(onExecuteFromHere ? [{
      label: 'Execute from here',
      icon: Play,
      action: () => { onExecuteFromHere(node); onClose(); },
    } as MenuItem] : []),
    { divider: true },
    ...(onAddNodeAfter ? [{
      label: 'Add Node After',
      icon: PlusCircle,
      action: () => { onAddNodeAfter(node); onClose(); },
    } as MenuItem] : []),
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[999]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />

      {/* Menu */}
      <div
        ref={menuRef}
        style={style}
        className="min-w-[200px] rounded-lg border border-border/50 bg-background/80 backdrop-blur-xl shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
      >
        {renaming ? (
          <div className="px-3 py-2">
            <input
              ref={renameRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') { setRenaming(false); onClose(); }
                e.stopPropagation();
              }}
              onBlur={handleRenameSubmit}
              className="w-full px-2 py-1 rounded border bg-background text-sm outline-none focus:ring-1 focus:ring-primary"
              placeholder="Node name"
            />
          </div>
        ) : (
          items.map((item, i) =>
            'divider' in item ? (
              <div key={i} className="my-1 border-t" />
            ) : (
              <button
                key={i}
                onClick={item.action}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors ${
                  item.danger
                    ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30'
                    : 'hover:bg-accent'
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.shortcut && (
                  <span className="text-[10px] text-muted-foreground">{item.shortcut}</span>
                )}
              </button>
            ),
          )
        )}
      </div>
    </>
  );
}
