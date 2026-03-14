'use client';

import { getBezierPath, type EdgeProps } from '@xyflow/react';

export function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        style={{ ...style, strokeWidth: selected ? 3 : 2 }}
        className={`react-flow__edge-path ${selected ? 'stroke-indigo-500 dark:stroke-indigo-400' : 'stroke-gray-400 dark:stroke-gray-500'}`}
        d={edgePath}
        markerEnd={markerEnd}
      />
      <circle r="4" fill={selected ? '#818CF8' : '#6366F1'} className="animate-pulse">
        <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
      </circle>
    </>
  );
}
