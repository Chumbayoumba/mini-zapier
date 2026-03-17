'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Webhook,
  Clock,
  Mail,
  Send,
  Zap,
} from 'lucide-react';

const TRIGGER_ICONS: Record<string, any> = {
  WEBHOOK: Webhook,
  CRON: Clock,
  EMAIL: Mail,
  TELEGRAM: Send,
};

const TRIGGER_COLORS: Record<string, string> = {
  WEBHOOK: '#8B5CF6',
  CRON: '#F59E0B',
  EMAIL: '#EF4444',
  TELEGRAM: '#0EA5E9',
};

function TriggerNode({ data, selected }: NodeProps) {
  const triggerType = (data?.type as string) || 'WEBHOOK';
  const color = TRIGGER_COLORS[triggerType] || '#8B5CF6';
  const Icon = TRIGGER_ICONS[triggerType] || Zap;
  const label = (data?.label as string) || triggerType;

  return (
    <div
      className={`relative min-w-[160px] rounded-xl border-2 bg-white dark:bg-gray-900 shadow-lg transition-shadow ${
        selected ? 'ring-2 ring-offset-2' : ''
      }`}
      style={{
        borderColor: color,
        ...(selected ? { ringColor: color } : {}),
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 rounded-t-[10px] px-3 py-2 text-white"
        style={{ background: color }}
      >
        <Icon className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-wider">Trigger</span>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
        {data?.description ? (
          <p className="text-xs text-gray-500 mt-0.5">{String(data.description)}</p>
        ) : null}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-white !bg-gray-400 transition-shadow"
        style={{ background: color }}
      />
    </div>
  );
}

export default memo(TriggerNode);
