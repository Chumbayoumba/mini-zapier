export const EXECUTION_STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  COMPLETED: 'default',
  RUNNING: 'secondary',
  FAILED: 'destructive',
  PENDING: 'outline',
  CANCELLED: 'outline',
};

export const EXECUTION_STATUS_COLORS: Record<string, { color: string; label: string }> = {
  COMPLETED: { color: 'text-green-600', label: 'Completed' },
  RUNNING: { color: 'text-blue-600', label: 'Running' },
  FAILED: { color: 'text-red-600', label: 'Failed' },
  PENDING: { color: 'text-yellow-600', label: 'Pending' },
  CANCELLED: { color: 'text-gray-600', label: 'Cancelled' },
  PAUSED: { color: 'text-orange-600', label: 'Paused' },
};

export const TRIGGER_COLORS: Record<string, string> = {
  WEBHOOK: '#8B5CF6',
  CRON: '#F59E0B',
  EMAIL: '#EF4444',
};

export const ACTION_COLORS: Record<string, string> = {
  HTTP_REQUEST: '#3B82F6',
  SEND_EMAIL: '#10B981',
  TELEGRAM: '#0EA5E9',
  DATABASE: '#F97316',
  TRANSFORM: '#6366F1',
};
