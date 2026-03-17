'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Pencil, Copy, Trash2 } from 'lucide-react';
import type { Node } from '@xyflow/react';

interface NodeContextMenuProps {
  x: number;
  y: number;
  node: Node;
  onClose: () => void;
  onEdit: (node: Node) => void;
  onDuplicate: (node: Node) => void;
  onDelete: (node: Node) => void;
}

export function NodeContextMenu({
  x,
  y,
  node,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Adjust position so menu stays within viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 1000,
  };

  const items = [
    {
      label: 'Edit',
      icon: Pencil,
      action: () => { onEdit(node); onClose(); },
    },
    {
      label: 'Duplicate',
      icon: Copy,
      action: () => { onDuplicate(node); onClose(); },
    },
    { divider: true },
    {
      label: 'Delete',
      icon: Trash2,
      action: () => { onDelete(node); onClose(); },
      danger: true,
    },
  ] as const;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[999]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />

      {/* Menu */}
      <div
        ref={menuRef}
        style={style}
        className="min-w-[160px] rounded-lg border bg-popover shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
      >
        {items.map((item, i) =>
          'divider' in item ? (
            <div key={i} className="my-1 border-t" />
          ) : (
            <button
              key={i}
              onClick={item.action}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors ${
                'danger' in item && item.danger
                  ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30'
                  : 'hover:bg-accent'
              }`}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          ),
        )}
      </div>
    </>
  );
}
