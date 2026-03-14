import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActionRegistry } from './action-registry';
import {
  ExecutionContext,
  RetryConfig,
  WorkflowErrorConfig,
  DEFAULT_ERROR_CONFIG,
} from './execution-context';
import { TemplateEngine, TemplateContext } from './template-engine';

@Injectable()
export class EngineService {
  private readonly logger = new Logger(EngineService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private actionRegistry: ActionRegistry,
  ) {}

  async executeWorkflow(workflowId: string, triggerData?: any) {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    const execution = await this.prisma.workflowExecution.create({
      data: {
        workflowId,
        triggerData,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    const definition = workflow.definition as any;
    const { nodes, edges, integrations } = definition;
    const errorConfig: WorkflowErrorConfig =
      (workflow as any).errorConfig
        ? { ...DEFAULT_ERROR_CONFIG, ...((workflow as any).errorConfig as any) }
        : DEFAULT_ERROR_CONFIG;

    const context: ExecutionContext = {
      executionId: execution.id,
      workflowId,
      triggerData,
      stepResults: {},
      integrations,
    };

    this.logger.log({
      msg: 'Starting workflow execution',
      correlationId: (execution as any).correlationId || undefined,
      workflowId,
      executionId: execution.id,
    });

    this.eventEmitter.emit('execution.started', { executionId: execution.id, workflowId });

    try {
      const executionOrder = this.getExecutionOrder(nodes, edges);

      const TRIGGER_ONLY_TYPES = ['WEBHOOK', 'CRON', 'EMAIL', 'TELEGRAM'];
      for (const node of executionOrder) {
        const isTriggerNode =
          node.type === 'triggerNode' ||
          node.id?.startsWith('trigger-') ||
          TRIGGER_ONLY_TYPES.includes(node.data.type);
        if (isTriggerNode) {
          context.stepResults[node.id] = triggerData;
          continue;
        }

        // Pause check before each step
        const execCheck = await this.prisma.workflowExecution.findUnique({
          where: { id: context.executionId },
          select: { status: true },
        });

        if (execCheck?.status === 'PAUSED') {
          await this.prisma.workflowExecution.update({
            where: { id: context.executionId },
            data: { lastCompletedNodeId: context.lastCompletedNodeId || null },
          });
          this.eventEmitter.emit('execution.paused', {
            executionId: context.executionId,
            workflowId: context.workflowId,
          });
          return context.executionId;
        }

        await this.executeStepWithRetry(node, context, errorConfig.retry);
        context.lastCompletedNodeId = node.id;
      }

      const endTime = new Date();
      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'COMPLETED',
          completedAt: endTime,
          duration: endTime.getTime() - execution.startedAt!.getTime(),
        },
      });

      this.eventEmitter.emit('execution.completed', { executionId: execution.id, workflowId });
      this.logger.log(`Workflow ${workflowId} execution ${execution.id} completed`);

      return execution.id;
    } catch (error: any) {
      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          error: error.message,
          completedAt: new Date(),
          duration: new Date().getTime() - execution.startedAt!.getTime(),
        },
      });

      this.eventEmitter.emit('execution.failed', {
        executionId: execution.id,
        workflowId,
        error: error.message,
      });

      this.logger.error(`Workflow ${workflowId} execution failed: ${error.message}`);
      throw error;
    }
  }

  async resumeWorkflow(executionId: string): Promise<string> {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: {
        workflow: true,
        stepLogs: { where: { status: 'COMPLETED' }, orderBy: { startedAt: 'asc' } },
      },
    });

    if (!execution) throw new Error(`Execution ${executionId} not found`);
    if (execution.status !== 'PAUSED') throw new Error('Can only resume paused executions');

    const definition = execution.workflow.definition as any;
    const { nodes, edges, integrations } = definition;
    const errorConfig: WorkflowErrorConfig =
      (execution.workflow as any).errorConfig
        ? { ...DEFAULT_ERROR_CONFIG, ...((execution.workflow as any).errorConfig as any) }
        : DEFAULT_ERROR_CONFIG;

    const context: ExecutionContext = {
      executionId,
      workflowId: execution.workflowId,
      triggerData: execution.triggerData as any,
      stepResults: {},
      integrations,
      lastCompletedNodeId: execution.lastCompletedNodeId || undefined,
      correlationId: execution.correlationId || undefined,
    };

    // Rebuild stepResults from completed step logs
    for (const log of execution.stepLogs) {
      context.stepResults[log.nodeId] = log.output;
    }

    // Update execution status
    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: 'RUNNING', resumedAt: new Date() },
    });

    this.eventEmitter.emit('execution.resumed', {
      executionId,
      workflowId: execution.workflowId,
    });

    const executionOrder = this.getExecutionOrder(nodes, edges);
    const completedNodeIds = new Set(execution.stepLogs.map((l) => l.nodeId));

    try {
      const TRIGGER_ONLY_TYPES = ['WEBHOOK', 'CRON', 'EMAIL', 'TELEGRAM'];
      for (const node of executionOrder) {
        // Skip completed steps
        if (completedNodeIds.has(node.id)) continue;

        const isTriggerNode =
          node.type === 'triggerNode' ||
          node.id?.startsWith('trigger-') ||
          TRIGGER_ONLY_TYPES.includes(node.data.type);
        if (isTriggerNode) {
          context.stepResults[node.id] = context.triggerData;
          continue;
        }

        // Pause check
        const execCheck = await this.prisma.workflowExecution.findUnique({
          where: { id: executionId },
          select: { status: true },
        });
        if (execCheck?.status === 'PAUSED') {
          await this.prisma.workflowExecution.update({
            where: { id: executionId },
            data: { lastCompletedNodeId: context.lastCompletedNodeId || null },
          });
          this.eventEmitter.emit('execution.paused', {
            executionId,
            workflowId: execution.workflowId,
          });
          return executionId;
        }

        await this.executeStepWithRetry(node, context, errorConfig.retry);
        context.lastCompletedNodeId = node.id;
      }

      const endTime = new Date();
      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'COMPLETED',
          completedAt: endTime,
          duration: endTime.getTime() - (execution.startedAt?.getTime() || Date.now()),
        },
      });

      this.eventEmitter.emit('execution.completed', {
        executionId,
        workflowId: execution.workflowId,
      });
      return executionId;
    } catch (error: any) {
      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'FAILED',
          error: error.message,
          completedAt: new Date(),
        },
      });
      this.eventEmitter.emit('execution.failed', {
        executionId,
        workflowId: execution.workflowId,
        error: error.message,
      });
      throw error;
    }
  }

  private async executeStepWithRetry(
    node: any,
    context: ExecutionContext,
    retryConfig: RetryConfig,
  ): Promise<any> {
    const startedAt = new Date();

    // Build template context from execution state
    const templateContext: TemplateContext = {
      steps: context.stepResults,
      trigger: context.triggerData || {},
    };
    // Resolve {{...}} expressions in all config string values
    const resolvedConfig = TemplateEngine.resolveConfig(
      node.data.config || {},
      templateContext,
    );

    // Resolve integrationId → real credentials for Telegram actions
    if (node.data.type === 'TELEGRAM' && resolvedConfig.integrationId) {
      try {
        const integration = await this.prisma.integration.findUnique({
          where: { id: resolvedConfig.integrationId },
        });
        if (integration?.config) {
          const cfg = integration.config as any;
          if (cfg.botToken && !resolvedConfig.botToken) {
            resolvedConfig.botToken = cfg.botToken;
          }
        }
      } catch (e) {
        this.logger.warn(`Failed to resolve integration ${resolvedConfig.integrationId}: ${e}`);
      }
    }

    // Create step log once (log resolved config for debugging)
    const stepLog = await this.prisma.executionStepLog.create({
      data: {
        executionId: context.executionId,
        nodeId: node.id,
        nodeName: node.data.label,
        nodeType: node.data.type,
        status: 'RUNNING',
        input: resolvedConfig,
        startedAt,
      },
    });

    this.eventEmitter.emit('step.started', {
      executionId: context.executionId,
      stepId: stepLog.id,
      nodeId: node.id,
    });

    this.logger.log({
      msg: `Executing step ${node.id}`,
      correlationId: context.correlationId,
      nodeId: node.id,
      actionType: node.data.type,
      executionId: context.executionId,
    });

    const { maxAttempts, baseDelayMs, maxDelayMs, jitter } = retryConfig;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const input = {
          ...resolvedConfig,
          _context: {
            ...context.stepResults,
            triggerData: context.triggerData,
            integrations: context.integrations,
          },
        };
        const result = await this.executeAction(node.data.type, input);

        context.stepResults[node.id] = result;

        const completedAt = new Date();
        await this.prisma.executionStepLog.update({
          where: { id: stepLog.id },
          data: {
            status: 'COMPLETED',
            output: result as any,
            completedAt,
            duration: completedAt.getTime() - startedAt.getTime(),
            retryCount: attempt - 1,
          },
        });

        this.eventEmitter.emit('step.completed', {
          executionId: context.executionId,
          stepId: stepLog.id,
          nodeId: node.id,
          result,
        });

        this.logger.log({
          msg: `Step ${node.id} completed`,
          correlationId: context.correlationId,
          nodeId: node.id,
          actionType: node.data.type,
          executionId: context.executionId,
          duration: completedAt.getTime() - startedAt.getTime(),
        });

        return result;
      } catch (error: any) {
        lastError = error;
        if (attempt < maxAttempts) {
          const expDelay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
          const jitterMs = jitter ? Math.random() * expDelay * 0.1 : 0;
          await new Promise((r) => setTimeout(r, expDelay + jitterMs));

          // Update retry count on intermediate failure
          await this.prisma.executionStepLog.update({
            where: { id: stepLog.id },
            data: { retryCount: attempt },
          });

          this.logger.warn(
            `Step ${node.id} attempt ${attempt}/${maxAttempts} failed: ${error.message}. Retrying...`,
          );
        }
      }
    }

    // All attempts exhausted
    const completedAt = new Date();
    await this.prisma.executionStepLog.update({
      where: { id: stepLog.id },
      data: {
        status: 'FAILED',
        error: lastError!.message,
        errorStack: lastError!.stack,
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        retryCount: maxAttempts - 1,
      },
    });

    this.eventEmitter.emit('step.failed', {
      executionId: context.executionId,
      stepId: stepLog.id,
      nodeId: node.id,
      error: lastError!.message,
    });

    this.logger.error({
      msg: `Step ${node.id} failed after ${maxAttempts} attempts`,
      correlationId: context.correlationId,
      nodeId: node.id,
      actionType: node.data.type,
      executionId: context.executionId,
      error: lastError!.message,
      errorStack: lastError!.stack,
    });

    throw lastError!;
  }

  private async executeAction(type: string, input: any): Promise<any> {
    const handler = this.actionRegistry.get(type);
    return handler.execute(input);
  }

  private getExecutionOrder(nodes: any[], edges: any[]): any[] {
    const adjacency: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};

    for (const node of nodes) {
      adjacency[node.id] = [];
      inDegree[node.id] = 0;
    }

    for (const edge of edges) {
      adjacency[edge.source].push(edge.target);
      inDegree[edge.target] = (inDegree[edge.target] || 0) + 1;
    }

    const queue = nodes.filter((n) => inDegree[n.id] === 0);
    const result: any[] = [];

    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);
      for (const neighbor of adjacency[node.id]) {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          const neighborNode = nodes.find((n) => n.id === neighbor);
          if (neighborNode) queue.push(neighborNode);
        }
      }
    }

    return result;
  }
}
