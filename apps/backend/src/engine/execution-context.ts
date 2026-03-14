export interface ExecutionContext {
  executionId: string;
  workflowId: string;
  triggerData: any;
  stepResults: Record<string, any>;
  integrations?: any;
  lastCompletedNodeId?: string;
  correlationId?: string;
}

export interface RetryConfig {
  maxAttempts: number;   // default: 3
  baseDelayMs: number;   // default: 1000
  maxDelayMs: number;    // default: 30000
  jitter: boolean;       // default: true
}

export interface WorkflowErrorConfig {
  retry: RetryConfig;
  notifications: {
    inApp: boolean;      // default: true
    email: boolean;      // default: false
    emailAddress?: string;
  };
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitter: true,
};

export const DEFAULT_ERROR_CONFIG: WorkflowErrorConfig = {
  retry: DEFAULT_RETRY_CONFIG,
  notifications: {
    inApp: true,
    email: false,
  },
};
