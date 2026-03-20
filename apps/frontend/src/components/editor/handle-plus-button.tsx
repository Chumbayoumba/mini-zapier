'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { Plus } from 'lucide-react';

interface HandlePlusButtonProps {
  isOpen: boolean;
  onOpenNodePicker: (connectFrom: { nodeId: string; handleId?: string }) => void;
}

export function HandlePlusButton({ isOpen, onOpenNodePicker }: HandlePlusButtonProps) {
  const [activeHandle, setActiveHandle] = useState<{
    nodeId: string;
    handleId: string;
    x: number;
    y: number;
  } | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { getViewport } = useReactFlow();
  const lastViewport = useRef(getViewport());

  // Hide button on viewport change (zoom/pan)
  useEffect(() => {
    const check = setInterval(() => {
      const vp = getViewport();
      if (
        vp.x !== lastViewport.current.x ||
        vp.y !== lastViewport.current.y ||
        vp.zoom !== lastViewport.current.zoom
      ) {
        setActiveHandle(null);
        lastViewport.current = vp;
      }
    }, 100);
    return () => clearInterval(check);
  }, [getViewport]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isOpen) return;

      const canvas = document.querySelector('.react-flow');
      if (!canvas) return;
      const canvasRect = canvas.getBoundingClientRect();
      if (
        e.clientX < canvasRect.left || e.clientX > canvasRect.right ||
        e.clientY < canvasRect.top || e.clientY > canvasRect.bottom
      ) {
        setActiveHandle(null);
        return;
      }

      const handles = document.querySelectorAll<HTMLElement>(
        '.react-flow__handle.react-flow__handle-bottom, .react-flow__handle[data-handlepos="bottom"]',
      );

      let closest: { el: HTMLElement; dist: number } | null = null;

      handles.forEach((handle) => {
        if (!handle.classList.contains('react-flow__handle-bottom') &&
            handle.dataset.handlepos !== 'bottom') return;
        const rect = handle.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.sqrt((e.clientX - cx) ** 2 + (e.clientY - cy) ** 2);
        if (dist < 35 && (!closest || dist < closest.dist)) {
          closest = { el: handle, dist };
        }
      });

      if (closest) {
        const el = (closest as { el: HTMLElement; dist: number }).el;
        const rect = el.getBoundingClientRect();
        const nodeEl = el.closest<HTMLElement>('[data-id]');
        const nodeId = nodeEl?.dataset.id || '';
        const handleId = el.dataset.handleid || '';

        if (hideRef.current) { clearTimeout(hideRef.current); hideRef.current = null; }

        const x = rect.left + rect.width / 2 - 12;
        const y = rect.bottom + 6;

        // Stay within canvas
        if (x < canvasRect.left || x > canvasRect.right - 24 ||
            y < canvasRect.top || y > canvasRect.bottom - 24) {
          setActiveHandle(null);
          return;
        }

        setActiveHandle({ nodeId, handleId, x, y });
      } else {
        if (!hideRef.current) {
          hideRef.current = setTimeout(() => {
            setActiveHandle(null);
            hideRef.current = null;
          }, 150);
        }
      }
    },
    [isOpen],
  );

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, [handleMouseMove]);

  if (!activeHandle || isOpen) return null;

  return (
    <button
      className="fixed z-[60] flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform animate-in fade-in zoom-in-50 duration-100"
      style={{ left: activeHandle.x, top: activeHandle.y }}
      onClick={() => {
        onOpenNodePicker({ nodeId: activeHandle.nodeId, handleId: activeHandle.handleId || undefined });
        setActiveHandle(null);
      }}
      title="Add node"
    >
      <Plus className="h-3.5 w-3.5" />
    </button>
  );
}
