// Workflow Definition Types
export enum WorkflowStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ARCHIVED = 'ARCHIVED',
}

export enum TriggerType {
  WEBHOOK = 'WEBHOOK',
  CRON = 'CRON',
  EMAIL = 'EMAIL',
  TELEGRAM = 'TELEGRAM',
}

export enum ActionType {
  HTTP_REQUEST = 'HTTP_REQUEST',
  SEND_EMAIL = 'SEND_EMAIL',
  TELEGRAM = 'TELEGRAM',
  DATABASE = 'DATABASE',
  TRANSFORM = 'TRANSFORM',
}

export enum LogicType {
  IF = 'IF',
  SWITCH = 'SWITCH',
  FILTER = 'FILTER',
  SET = 'SET',
  CODE = 'CODE',
  MERGE = 'MERGE',
  WAIT = 'WAIT',
  LOOP = 'LOOP',
  NOOP = 'NOOP',
  MANUAL_TRIGGER = 'MANUAL_TRIGGER',
}

export type NodeType = TriggerType | ActionType | LogicType;

export interface WorkflowNodePosition {
  x: number;
  y: number;
}

export interface WorkflowNodeData {
  label: string;
  type: NodeType;
  config: Record<string, unknown>;
}

export interface WorkflowNode {
  id: string;
  type: string;
  position: WorkflowNodePosition;
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
