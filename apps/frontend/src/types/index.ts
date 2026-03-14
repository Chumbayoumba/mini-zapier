export type { Node as FlowNode, Edge as FlowEdge } from '@xyflow/react';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER';
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Workflow {
  id: string;
  userId: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  version: number;
  definition: WorkflowDefinition;
  createdAt: string;
  updatedAt: string;
  trigger?: Trigger;
}

export type WorkflowStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type TriggerType = 'WEBHOOK' | 'CRON' | 'EMAIL' | 'TELEGRAM';
export type ActionType = 'HTTP_REQUEST' | 'SEND_EMAIL' | 'TELEGRAM' | 'DATABASE' | 'TRANSFORM';
export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PAUSED';
export type StepStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    type: string;
    config?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface Trigger {
  id: string;
  workflowId: string;
  type: TriggerType;
  config: Record<string, any>;
  isActive: boolean;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  triggerData?: Record<string, any>;
  status: ExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  duration?: number;
  createdAt: string;
  workflow?: { name: string };
  stepLogs?: ExecutionStepLog[];
}

export interface ExecutionStepLog {
  id: string;
  executionId: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: StepStatus;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  errorStack?: string;
  retryCount: number;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
}

export interface DashboardStats {
  totalWorkflows: number;
  activeWorkflows: number;
  totalExecutions: number;
  successRate: number;
  failedExecutions: number;
  avgDuration: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T;
  timestamp: string;
}
