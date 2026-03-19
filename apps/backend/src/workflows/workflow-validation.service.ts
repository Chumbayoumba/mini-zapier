import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ValidationError {
  nodeId: string;
  field: string;
  message: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

@Injectable()
export class WorkflowValidationService {
  private readonly logger = new Logger(WorkflowValidationService.name);

  constructor(private prisma: PrismaService) {}

  async validateBeforeActivation(workflow: any): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const definition = workflow.definition as any;

    if (!definition || !definition.nodes || !Array.isArray(definition.nodes)) {
      errors.push({ nodeId: '', field: 'definition', message: 'Workflow definition is empty or invalid' });
      return { valid: false, errors };
    }

    const nodes = definition.nodes;
    const edges = definition.edges || [];

    if (nodes.length === 0) {
      errors.push({ nodeId: '', field: 'nodes', message: 'Workflow must have at least one node' });
      return { valid: false, errors };
    }

    // Check for trigger node
    const triggerNodes = nodes.filter(
      (n: any) => n.type === 'triggerNode' || ['WEBHOOK', 'CRON', 'EMAIL', 'TELEGRAM'].includes(n.data?.type),
    );

    if (triggerNodes.length === 0) {
      errors.push({ nodeId: '', field: 'trigger', message: 'Workflow must have at least one trigger node' });
    }

    // Check for disconnected nodes (nodes with no edges)
    const connectedNodeIds = new Set<string>();
    for (const edge of edges) {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    }
    // If more than 1 node, all should be connected
    if (nodes.length > 1) {
      for (const node of nodes) {
        if (!connectedNodeIds.has(node.id)) {
          errors.push({
            nodeId: node.id,
            field: 'connection',
            message: `Node "${node.data?.label || node.id}" is not connected to any other node`,
          });
        }
      }
    }

    // Validate each node's configuration
    for (const node of nodes) {
      const nodeType = node.data?.type as string;
      const config = node.data?.config || {};
      const nodeLabel = node.data?.label || node.id;

      switch (nodeType) {
        case 'CRON':
          this.validateCron(node.id, nodeLabel, config, errors);
          break;
        case 'EMAIL':
          if (!config.integrationId) {
            this.validateEmailTrigger(node.id, nodeLabel, config, errors);
          }
          break;
        case 'TELEGRAM':
          await this.validateTelegram(node.id, nodeLabel, config, node.type === 'triggerNode', errors);
          break;
        case 'HTTP_REQUEST':
          this.validateHttpRequest(node.id, nodeLabel, config, errors);
          break;
        case 'SEND_EMAIL':
          this.validateSendEmail(node.id, nodeLabel, config, errors);
          break;
        case 'DATABASE':
          this.validateDatabase(node.id, nodeLabel, config, errors);
          break;
        case 'TRANSFORM':
          this.validateTransform(node.id, nodeLabel, config, errors);
          break;
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private validateCron(nodeId: string, label: string, config: any, errors: ValidationError[]) {
    const expr = config.cronExpression;
    if (!expr) {
      errors.push({ nodeId, field: 'cronExpression', message: `"${label}": Cron expression is required` });
      return;
    }
    // Basic cron validation: 5 space-separated fields
    const parts = expr.trim().split(/\s+/);
    if (parts.length < 5 || parts.length > 6) {
      errors.push({ nodeId, field: 'cronExpression', message: `"${label}": Invalid cron expression (expected 5-6 fields)` });
    }
  }

  private validateEmailTrigger(nodeId: string, label: string, config: any, errors: ValidationError[]) {
    if (!config.imapHost) {
      errors.push({ nodeId, field: 'imapHost', message: `"${label}": IMAP host is required` });
    }
    if (!config.imapUser) {
      errors.push({ nodeId, field: 'imapUser', message: `"${label}": IMAP username is required` });
    }
    if (!config.imapPassword) {
      errors.push({ nodeId, field: 'imapPassword', message: `"${label}": IMAP password is required` });
    }
    if (config.imapPort) {
      const port = Number(config.imapPort);
      if (isNaN(port) || port < 1 || port > 65535) {
        errors.push({ nodeId, field: 'imapPort', message: `"${label}": IMAP port must be between 1 and 65535` });
      }
    }
  }

  private async validateTelegram(
    nodeId: string,
    label: string,
    config: any,
    isTrigger: boolean,
    errors: ValidationError[],
  ) {
    if (!config.integrationId) {
      errors.push({ nodeId, field: 'integrationId', message: `"${label}": Telegram bot must be selected` });
      return;
    }
    // Verify integration exists
    const integration = await this.prisma.integration.findUnique({
      where: { id: config.integrationId },
    });
    if (!integration) {
      errors.push({ nodeId, field: 'integrationId', message: `"${label}": Selected Telegram bot not found` });
    }
    if (isTrigger && !config.eventType) {
      errors.push({ nodeId, field: 'eventType', message: `"${label}": Event type must be selected` });
    }
    if (!isTrigger && !config.message) {
      errors.push({ nodeId, field: 'message', message: `"${label}": Message text is required` });
    }
  }

  private validateHttpRequest(nodeId: string, label: string, config: any, errors: ValidationError[]) {
    if (!config.url) {
      errors.push({ nodeId, field: 'url', message: `"${label}": URL is required` });
    } else if (!/^https?:\/\/.+/i.test(config.url) && !/^\{\{/.test(config.url)) {
      // Allow template variables like {{trigger.url}}
      errors.push({ nodeId, field: 'url', message: `"${label}": URL must start with http:// or https://` });
    }

    if (config.headers) {
      try {
        if (typeof config.headers === 'string') JSON.parse(config.headers);
      } catch {
        errors.push({ nodeId, field: 'headers', message: `"${label}": Headers must be valid JSON` });
      }
    }

    if (config.body) {
      try {
        if (typeof config.body === 'string') JSON.parse(config.body);
      } catch {
        errors.push({ nodeId, field: 'body', message: `"${label}": Body must be valid JSON` });
      }
    }

    if (config.timeout) {
      const timeout = Number(config.timeout);
      if (isNaN(timeout) || timeout < 1000 || timeout > 300000) {
        errors.push({ nodeId, field: 'timeout', message: `"${label}": Timeout must be between 1000ms and 300000ms` });
      }
    }
  }

  private validateSendEmail(nodeId: string, label: string, config: any, errors: ValidationError[]) {
    if (config.toMode !== 'auto_reply' && !config.to) {
      errors.push({ nodeId, field: 'to', message: `"${label}": Recipient email is required` });
    }
    if (config.to && !/^\{\{/.test(config.to)) {
      // Validate email format (allow comma-separated)
      const emails = config.to.split(',').map((e: string) => e.trim());
      for (const email of emails) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push({ nodeId, field: 'to', message: `"${label}": Invalid email address "${email}"` });
          break;
        }
      }
    }
    if (!config.subject) {
      errors.push({ nodeId, field: 'subject', message: `"${label}": Subject is required` });
    }
  }

  private validateDatabase(nodeId: string, label: string, config: any, errors: ValidationError[]) {
    if (!config.table) {
      errors.push({ nodeId, field: 'table', message: `"${label}": Table must be selected` });
    }
    if (config.where) {
      try {
        if (typeof config.where === 'string') JSON.parse(config.where);
      } catch {
        errors.push({ nodeId, field: 'where', message: `"${label}": Where clause must be valid JSON` });
      }
    }
    if (config.limit) {
      const limit = Number(config.limit);
      if (isNaN(limit) || limit < 1 || limit > 10000) {
        errors.push({ nodeId, field: 'limit', message: `"${label}": Limit must be between 1 and 10000` });
      }
    }
  }

  private validateTransform(nodeId: string, label: string, config: any, errors: ValidationError[]) {
    if (!config.expression) {
      errors.push({ nodeId, field: 'expression', message: `"${label}": JSONata expression is required` });
    }
  }
}
