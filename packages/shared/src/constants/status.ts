export const EXECUTION_STATUS_LABELS = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  PAUSED: 'Paused',
} as const;

export const WORKFLOW_STATUS_LABELS = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  ARCHIVED: 'Archived',
} as const;

export const EXECUTION_STATUS_COLORS = {
  PENDING: 'gray',
  RUNNING: 'blue',
  COMPLETED: 'green',
  FAILED: 'red',
  CANCELLED: 'orange',
  PAUSED: 'yellow',
} as const;

export const WORKFLOW_STATUS_COLORS = {
  DRAFT: 'gray',
  ACTIVE: 'green',
  PAUSED: 'yellow',
  ARCHIVED: 'slate',
} as const;
