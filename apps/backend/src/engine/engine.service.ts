import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpRequestAction } from './actions/http-request.action';
import { EmailAction } from './actions/email.action';
import { TelegramAction } from './actions/telegram.action';
import { DatabaseAction } from './actions/database.action';
import { TransformAction } from './actions/transform.action';

export interface ExecutionContext {
  executionId: string;
  workflowId: string;
  triggerData: any;
  stepResults: Record<string, any>;
}

@Injectable()
export class EngineService {
  private readonly logger = new Logger(EngineService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private httpAction: HttpRequestAction,
    private emailAction: EmailAction,
    private telegramAction: TelegramAction,
    private dbAction: DatabaseAction,
    private transformAction: TransformAction,
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

    const context: ExecutionContext = {
      executionId: execution.id,
      workflowId,
      triggerData,
      stepResults: {},
    };

    this.eventEmitter.emit('execution.started', { executionId: execution.id, workflowId });

    try {
      const definition = workflow.definition as any;
      const { nodes, edges } = definition;

      // Build execution order (topological sort based on edges)
      const executionOrder = this.getExecutionOrder(nodes, edges);

      for (const node of executionOrder) {
        if (node.data.type === 'WEBHOOK' || node.data.type === 'CRON' || node.data.type === 'EMAIL') {
          context.stepResults[node.id] = triggerData;
          continue;
        }

        await this.executeStep(node, context);
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

  private async executeStep(node: any, context: ExecutionContext) {
    const startedAt = new Date();

    const stepLog = await this.prisma.executionStepLog.create({
      data: {
        executionId: context.executionId,
        nodeId: node.id,
        nodeName: node.data.label,
        nodeType: node.data.type,
        status: 'RUNNING',
        input: node.data.config,
        startedAt,
      },
    });

    this.eventEmitter.emit('step.started', {
      executionId: context.executionId,
      stepId: stepLog.id,
      nodeId: node.id,
    });

    try {
      const input = { ...node.data.config, _context: context.stepResults };
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
        },
      });

      this.eventEmitter.emit('step.completed', {
        executionId: context.executionId,
        stepId: stepLog.id,
        nodeId: node.id,
        result,
      });

      return result;
    } catch (error: any) {
      await this.prisma.executionStepLog.update({
        where: { id: stepLog.id },
        data: {
          status: 'FAILED',
          error: error.message,
          completedAt: new Date(),
          duration: new Date().getTime() - startedAt.getTime(),
        },
      });

      this.eventEmitter.emit('step.failed', {
        executionId: context.executionId,
        stepId: stepLog.id,
        nodeId: node.id,
        error: error.message,
      });

      throw error;
    }
  }

  private async executeAction(type: string, input: any): Promise<any> {
    switch (type) {
      case 'HTTP_REQUEST':
        return this.httpAction.execute(input);
      case 'SEND_EMAIL':
        return this.emailAction.execute(input);
      case 'TELEGRAM':
        return this.telegramAction.execute(input);
      case 'DATABASE':
        return this.dbAction.execute(input);
      case 'TRANSFORM':
        return this.transformAction.execute(input);
      default:
        throw new Error(`Unknown action type: ${type}`);
    }
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
