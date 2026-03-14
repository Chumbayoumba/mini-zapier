import { TriggerType } from './workflow';

export interface WebhookTriggerConfig {
  secret?: string;
  path?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
}

export interface CronTriggerConfig {
  expression: string;
  timezone?: string;
}

export interface EmailTriggerConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
  folder?: string;
  filter?: {
    from?: string;
    subject?: string;
  };
}

export type TriggerConfig = WebhookTriggerConfig | CronTriggerConfig | EmailTriggerConfig;

export interface TriggerDefinition {
  type: TriggerType;
  config: TriggerConfig;
}
