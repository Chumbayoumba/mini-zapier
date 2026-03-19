import { TriggerType, ActionType, LogicType } from '../types/workflow';

export const TRIGGER_NODE_TYPES = {
  [TriggerType.WEBHOOK]: {
    label: 'Webhook',
    description: 'Triggered by HTTP request',
    color: '#8B5CF6',
    icon: 'webhook',
  },
  [TriggerType.CRON]: {
    label: 'Schedule',
    description: 'Triggered on a schedule',
    color: '#F59E0B',
    icon: 'clock',
  },
  [TriggerType.EMAIL]: {
    label: 'Email',
    description: 'Triggered by incoming email',
    color: '#EF4444',
    icon: 'mail',
  },
  [TriggerType.TELEGRAM]: {
    label: 'Telegram',
    description: 'Triggered by Telegram message',
    color: '#0EA5E9',
    icon: 'send',
  },
} as const;

export const ACTION_NODE_TYPES = {
  [ActionType.HTTP_REQUEST]: {
    label: 'HTTP Request',
    description: 'Make an HTTP request',
    color: '#3B82F6',
    icon: 'globe',
  },
  [ActionType.SEND_EMAIL]: {
    label: 'Send Email',
    description: 'Send an email message',
    color: '#10B981',
    icon: 'send',
  },
  [ActionType.TELEGRAM]: {
    label: 'Telegram',
    description: 'Send Telegram message',
    color: '#0EA5E9',
    icon: 'message-circle',
  },
  [ActionType.DATABASE]: {
    label: 'Database',
    description: 'Execute database query',
    color: '#F97316',
    icon: 'database',
  },
  [ActionType.TRANSFORM]: {
    label: 'Transform',
    description: 'Transform data with JSONata',
    color: '#6366F1',
    icon: 'shuffle',
  },
} as const;

export const LOGIC_NODE_TYPES = {
  [LogicType.IF]: {
    label: 'If',
    description: 'Route items based on conditions',
    color: '#EC4899',
    icon: 'git-branch',
  },
  [LogicType.SWITCH]: {
    label: 'Switch',
    description: 'Route items to different outputs based on value',
    color: '#A855F7',
    icon: 'route',
  },
  [LogicType.FILTER]: {
    label: 'Filter',
    description: 'Filter items based on conditions',
    color: '#14B8A6',
    icon: 'filter',
  },
} as const;

export const UTILITY_NODE_TYPES = {
  [LogicType.SET]: {
    label: 'Set',
    description: 'Set, modify or remove item fields',
    color: '#F97316',
    icon: 'variable',
  },
  [LogicType.CODE]: {
    label: 'Code',
    description: 'Run custom JavaScript code',
    color: '#64748B',
    icon: 'code',
  },
  [LogicType.MERGE]: {
    label: 'Merge',
    description: 'Merge data from two inputs',
    color: '#06B6D4',
    icon: 'merge',
  },
  [LogicType.WAIT]: {
    label: 'Wait',
    description: 'Pause execution for a specified time',
    color: '#EAB308',
    icon: 'timer',
  },
  [LogicType.LOOP]: {
    label: 'Loop',
    description: 'Iterate over items in batches',
    color: '#84CC16',
    icon: 'repeat',
  },
  [LogicType.NOOP]: {
    label: 'No Operation',
    description: 'Pass-through node',
    color: '#9CA3AF',
    icon: 'arrow-right',
  },
  [LogicType.MANUAL_TRIGGER]: {
    label: 'Manual Trigger',
    description: 'Start workflow manually',
    color: '#22C55E',
    icon: 'play',
  },
} as const;
