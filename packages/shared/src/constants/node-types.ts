import { TriggerType, ActionType } from '../types/workflow';

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
