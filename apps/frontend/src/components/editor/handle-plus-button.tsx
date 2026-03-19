'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';

interface HandlePlusButtonProps {
  isOpen: boolean;
  onOpenNodePicker: (connectFrom: { nodeId: string; handleId?: string }) => void;
}

/**
 * Renders (+) buttons near output handles of all nodes when hovered.
 * Uses a global mousemove listener to detect proximity to handles.
 */
export function HandlePlusButton({ isOpen, onOpenNodePicker }: HandlePlusButtonProps) {
  const [activeHandle, setActiveHandle] = useState<{
    nodeId: string;
    handleId: string;
    rect: DOMRect;
  } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isOpen) return;

      // Find nearest source handle
      const handles = document.querySelectorAll<HTMLElement>(
        '.react-flow__handle.react-flow__handle-bottom, .react-flow__handle[data-handlepos="bottom"]',
      );

      let closest: { el: HTMLElement; dist: number } | null = null;

      handles.forEach((handle) => {
        // Only source handles
        if (!handle.classList.contains('react-flow__handle-bottom') &&
            handle.dataset.handlepos !== 'bottom') return;

        const rect = handle.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.sqrt((e.clientX - cx) ** 2 + (e.clientY - cy) ** 2);

        if (dist < 40 && (!closest || dist < closest.dist)) {
          closest = { el: handle, dist };
        }
      });

      if (closest) {
        const el = (closest as { el: HTMLElement; dist: number }).el;
        const rect = el.getBoundingClientRect();
        // Find node id from parent
        const nodeEl = el.closest<HTMLElement>('[data-id]');
        const nodeId = nodeEl?.dataset.id || '';
        const handleId = el.dataset.handleid || '';

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setActiveHandle({ nodeId, handleId, rect });
      } else {
        if (!timeoutRef.current) {
          timeoutRef.current = setTimeout(() => {
            setActiveHandle(null);
            timeoutRef.current = null;
          }, 300);
        }
      }
    },
    [isOpen],
  );

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [handleMouseMove]);

  if (!activeHandle || isOpen) return null;

  const { rect, nodeId, handleId } = activeHandle;

  return (
    <button
      className="fixed z-[60] flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform animate-in fade-in zoom-in-50 duration-100"
      style={{
        left: rect.left + rect.width / 2 - 12,
        top: rect.bottom + 6,
      }}
      onClick={() => {
        onOpenNodePicker({ nodeId, handleId: handleId || undefined });
        setActiveHandle(null);
      }}
      title="Add node"
    >
      <Plus className="h-3.5 w-3.5" />
    </button>
  );
}
