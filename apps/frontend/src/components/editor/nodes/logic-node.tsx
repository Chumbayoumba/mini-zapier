'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  GitBranch,
  Route,
  Filter,
  Variable,
  Code,
  Merge,
  Timer,
  Repeat,
  ArrowRight,
  Play,
} from 'lucide-react';
import { useExecutionStore } from '@/stores/execution-store';
import { NodeExecutionBadge, getExecClassName } from '@/components/editor/node-execution-badge';

const LOGIC_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  IF: GitBranch,
  SWITCH: Route,
  FILTER: Filter,
  SET: Variable,
  CODE: Code,
  MERGE: Merge,
  WAIT: Timer,
  LOOP: Repeat,
  NOOP: ArrowRight,
  MANUAL_TRIGGER: Play,
};

const LOGIC_COLORS: Record<string, string> = {
  IF: '#EC4899',
  SWITCH: '#A855F7',
  FILTER: '#14B8A6',
  SET: '#F97316',
  CODE: '#64748B',
  MERGE: '#06B6D4',
  WAIT: '#EAB308',
  LOOP: '#84CC16',
  NOOP: '#9CA3AF',
  MANUAL_TRIGGER: '#22C55E',
};

interface HandleDef {
  id: string;
  label: string;
}

const NODE_OUTPUTS: Record<string, HandleDef[]> = {
  IF: [
    { id: 'output-0', label: 'True' },
    { id: 'output-1', label: 'False' },
  ],
  SWITCH: [
    { id: 'output-0', label: 'Case 1' },
    { id: 'output-1', label: 'Case 2' },
    { id: 'output-2', label: 'Default' },
  ],
  DEFAULT: [{ id: 'output-0', label: '' }],
};

const NODE_INPUTS: Record<string, HandleDef[]> = {
  MERGE: [
    { id: 'input-0', label: 'Input 1' },
    { id: 'input-1', label: 'Input 2' },
  ],
  MANUAL_TRIGGER: [],
  DEFAULT: [{ id: 'input-0', label: '' }],
};

function LogicNode({ data, id, selected }: NodeProps) {
  const nodeType = (data?.type as string) || 'NOOP';
  const color = LOGIC_COLORS[nodeType] || '#9CA3AF';
  const Icon = LOGIC_ICONS[nodeType] || ArrowRight;
  const label = (data?.label as string) || nodeType;
  const isDisabled = !!data?.disabled;

  const execInfo = useExecutionStore((s) => s.nodeStates[id]);
  const execState = execInfo?.state || 'idle';
  const execClass = getExecClassName(execState);

  // Support dynamic Switch outputs from config
  let outputs = NODE_OUTPUTS[nodeType] || NODE_OUTPUTS.DEFAULT;
  if (nodeType === 'SWITCH') {
    const cfg = (data?.config as Record<string, unknown>) || {};
    const count = Number(cfg.outputCount) || 3;
    outputs = Array.from({ length: count }, (_, i) => ({
      id: `output-${i}`,
      label: i === count - 1 ? 'Default' : `Case ${i + 1}`,
    }));
  }

  const inputs = NODE_INPUTS[nodeType] || NODE_INPUTS.DEFAULT;
  const groupLabel = nodeType === 'MANUAL_TRIGGER' ? 'Trigger' : 'Logic';

  return (
    <div
      className={`relative min-w-[180px] rounded-xl border-2 bg-white dark:bg-gray-900 shadow-lg transition-shadow ${
        selected ? 'ring-2 ring-offset-2' : ''
      } ${execClass} ${isDisabled ? 'opacity-40 grayscale-[50%]' : ''}`}
      style={{
        borderColor: execState === 'success' ? '#22C55E' : execState === 'error' ? '#EF4444' : color,
        ...(selected ? { ringColor: color } : {}),
      }}
    >
      <NodeExecutionBadge state={execState} duration={execInfo?.duration} error={execInfo?.error} />

      {/* Input handles */}
      {inputs.map((input, idx) => (
        <Handle
          key={input.id}
          type="target"
          position={Position.Top}
          id={input.id}
          className="!h-3 !w-3 !border-2 !border-white transition-shadow"
          style={{
            left: inputs.length > 1
              ? `${((idx + 1) / (inputs.length + 1)) * 100}%`
              : '50%',
            background: color,
          }}
        />
      ))}

      {/* Input labels */}
      {inputs.length > 1 && (
        <div className="absolute w-full" style={{ top: -18 }}>
          {inputs.map((input, idx) => (
            input.label && (
              <span
                key={`label-${input.id}`}
                className="absolute text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap"
                style={{
                  left: `${((idx + 1) / (inputs.length + 1)) * 100}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                {input.label}
              </span>
            )
          ))}
        </div>
      )}

      {/* Header */}
      <div
        className="flex items-center gap-2 rounded-t-[10px] px-3 py-2 text-white"
        style={{ background: color }}
      >
        <Icon className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-wider">{groupLabel}</span>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
        {data?.description ? (
          <p className="text-xs text-gray-500 mt-0.5">{String(data.description)}</p>
        ) : null}
      </div>

      {/* Output handles with labels */}
      <div className="relative" style={{ minHeight: outputs.length > 1 ? 20 : 0 }}>
        {outputs.map((output, idx) => (
          <Handle
            key={output.id}
            type="source"
            position={Position.Bottom}
            id={output.id}
            className="!h-3 !w-3 !border-2 !border-white transition-shadow"
            style={{
              left: outputs.length > 1
                ? `${((idx + 1) / (outputs.length + 1)) * 100}%`
                : '50%',
              background: color,
            }}
          />
        ))}
      </div>

      {/* Output labels below the node */}
      {outputs.some((o) => o.label) && outputs.length > 1 && (
        <div className="absolute w-full" style={{ bottom: -18 }}>
          {outputs.map((output, idx) => (
            output.label && (
              <span
                key={`label-${output.id}`}
                className="absolute text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap"
                style={{
                  left: `${((idx + 1) / (outputs.length + 1)) * 100}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                {output.label}
              </span>
            )
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(LogicNode);
