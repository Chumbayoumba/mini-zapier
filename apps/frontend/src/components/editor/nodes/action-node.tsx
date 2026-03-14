'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Globe,
  Mail,
  Send,
  Database,
  Shuffle,
} from 'lucide-react';

const ACTION_ICONS: Record<string, any> = {
  HTTP_REQUEST: Globe,
  SEND_EMAIL: Mail,
  TELEGRAM: Send,
  DATABASE: Database,
  TRANSFORM: Shuffle,
};

const ACTION_COLORS: Record<string, string> = {
  HTTP_REQUEST: '#3B82F6',
  SEND_EMAIL: '#10B981',
  TELEGRAM: '#0EA5E9',
  DATABASE: '#F97316',
  TRANSFORM: '#6366F1',
};

function ActionNode({ data, selected }: NodeProps) {
  const actionType = data?.type as string || 'HTTP_REQUEST';
  const color = ACTION_COLORS[actionType] || '#3B82F6';
  const Icon = ACTION_ICONS[actionType] || Globe;
  const label = (data?.label as string) || actionType;

  return (
    <div
      className={`relative min-w-[160px] rounded-xl border-2 bg-white dark:bg-gray-900 shadow-lg transition-all ${
        selected ? 'ring-2 ring-offset-2' : ''
      }`}
      style={{
        borderColor: color,
        ...(selected ? { ringColor: color } : {}),
      }}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-white"
        style={{ background: color }}
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 rounded-t-[10px] px-3 py-2 text-white"
        style={{ background: color }}
      >
        <Icon className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-wider">Action</span>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
        {data?.description && (
          <p className="text-xs text-gray-500 mt-0.5">{data.description as string}</p>
        )}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-white !bg-gray-400"
        style={{ background: color }}
      />
    </div>
  );
}

export default memo(ActionNode);
