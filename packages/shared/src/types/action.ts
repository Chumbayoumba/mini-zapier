import { ActionType } from './workflow';

export interface HttpRequestActionConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retries?: number;
}

export interface SendEmailActionConfig {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
}

export interface TelegramActionConfig {
  chatId: string;
  message: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}

export interface DatabaseActionConfig {
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
  fields?: string[];
  limit?: number;
}

export interface TransformActionConfig {
  expression: string;
  inputMapping?: Record<string, string>;
}

export type ActionConfig =
  | HttpRequestActionConfig
  | SendEmailActionConfig
  | TelegramActionConfig
  | DatabaseActionConfig
  | TransformActionConfig;

export interface ActionDefinition {
  type: ActionType;
  config: ActionConfig;
}
