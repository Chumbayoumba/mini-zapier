import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EngineService } from '../engine/engine.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class ExecutionsService {
  private readonly logger = new Logger(ExecutionsService.name);

  constructor(
    private prisma: PrismaService,
    private engineService: EngineService,
    private queueService: QueueService,
  ) {}

  async findAllByUser(userId: string, page = 1, limit = 20, status?: string, dateFrom?: string, dateTo?: string, workflowId?: string) {
    const skip = (page - 1) * limit;
    const where: any = { workflow: { userId } };
    if (status) where.status = status;
    if (workflowId) where.workflowId = workflowId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [executions, total] = await Promise.all([
      this.prisma.workflowExecution.findMany({
        where,
        skip,
        take: limit,
        include: {
          workflow: { select: { id: true, name: true } },
          _count: { select: { stepLogs: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workflowExecution.count({ where }),
    ]);
    return { executions, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string, userId?: string) {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id },
      include: {
        workflow: { select: { id: true, name: true, definition: true, userId: true } },
        stepLogs: { orderBy: { startedAt: 'asc' } },
      },
    });
    if (!execution) throw new NotFoundException('Execution not found');
    if (userId && execution.workflow.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return execution;
  }

  async cancel(id: string, userId?: string) {
    const execution = await this.findById(id, userId);
    if (execution.status !== 'RUNNING' && execution.status !== 'PENDING') {
      throw new Error('Can only cancel running or pending executions');
    }
    return this.prisma.workflowExecution.update({
      where: { id },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
  }

  async pause(id: string, userId?: string) {
    const execution = await this.findById(id, userId);
    if (execution.status !== 'RUNNING') {
      throw new Error('Can only pause running executions');
    }
    // Set status to PAUSED — the EngineService step loop will detect this
    return this.prisma.workflowExecution.update({
      where: { id },
      data: { status: 'PAUSED', pausedAt: new Date() },
    });
  }

  async resume(id: string, userId?: string) {
    const execution = await this.findById(id, userId);
    if (execution.status !== 'PAUSED') {
      throw new Error('Can only resume paused executions');
    }
    // Directly call engineService.resumeWorkflow which handles state reconstruction
    return this.engineService.resumeWorkflow(id);
  }

  async retryFromFailed(id: string, userId?: string) {
    const execution = await this.findById(id, userId);
    if (execution.status !== 'FAILED') {
      throw new Error('Can only retry failed executions');
    }

    // Find the failed step
    const failedStep = execution.stepLogs?.find((s: any) => s.status === 'FAILED');
    if (!failedStep) {
      throw new Error('No failed step found in execution');
    }

    // Sort step logs by startedAt to get execution order
    const executionOrder = [...(execution.stepLogs || [])].sort(
      (a: any, b: any) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    );

    const failedIndex = executionOrder.findIndex((s: any) => s.id === failedStep.id);
    const stepsToDelete = executionOrder.slice(failedIndex).map((s: any) => s.id);

    // Delete the failed step and any subsequent step logs
    await this.prisma.executionStepLog.deleteMany({
      where: { id: { in: stepsToDelete } },
    });

    // Update execution to PAUSED state so resumeWorkflow can pick it up
    const lastCompletedNode = failedIndex > 0 ? executionOrder[failedIndex - 1].nodeId : null;

    await this.prisma.workflowExecution.update({
      where: { id },
      data: {
        status: 'PAUSED',
        lastCompletedNodeId: lastCompletedNode,
        error: null,
        completedAt: null,
      },
    });

    // Resume from the failed step
    return this.engineService.resumeWorkflow(id);
  }

  async retry(id: string, userId?: string) {
    const execution = await this.findById(id, userId);
    if (execution.status !== 'FAILED' && execution.status !== 'CANCELLED') {
      throw new Error('Can only retry failed or cancelled executions');
    }
    // Enqueue a fresh execution via BullMQ (fixes the dangling execution bug)
    const jobId = await this.queueService.addExecution(
      execution.workflowId,
      execution.triggerData ?? undefined,
    );
    this.logger.log(`Retry: enqueued job ${jobId} for workflow ${execution.workflowId} from ${id}`);
    return { jobId, workflowId: execution.workflowId };
  }

  async getStats(userId: string) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [total, completed, failed, running] = await Promise.all([
      this.prisma.workflowExecution.count({ where: { workflow: { userId } } }),
      this.prisma.workflowExecution.count({ where: { workflow: { userId }, status: 'COMPLETED' } }),
      this.prisma.workflowExecution.count({ where: { workflow: { userId }, status: 'FAILED' } }),
      this.prisma.workflowExecution.count({ where: { workflow: { userId }, status: 'RUNNING' } }),
    ]);

    const [totalWorkflows, activeWorkflows, executions24h, avgResult] = await Promise.all([
      this.prisma.workflow.count({ where: { userId } }),
      this.prisma.workflow.count({ where: { userId, status: 'ACTIVE' } }),
      this.prisma.workflowExecution.count({
        where: { workflow: { userId }, createdAt: { gte: twentyFourHoursAgo } },
      }),
      this.prisma.workflowExecution.aggregate({
        where: { workflow: { userId }, status: 'COMPLETED', duration: { not: null } },
        _avg: { duration: true },
      }),
    ]);

    return {
      totalExecutions: total,
      completed,
      failed,
      running,
      totalWorkflows,
      activeWorkflows,
      executions24h,
      successRate: Math.round((completed / Math.max(total, 1)) * 100 * 10) / 10,
      avgDuration: Math.round(avgResult._avg.duration || 0),
    };
  }

  async getRecentExecutions(userId: string, limit = 10) {
    return this.prisma.workflowExecution.findMany({
      where: { workflow: { userId } },
      include: { workflow: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getChartData(userId: string, days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const executions = await this.prisma.workflowExecution.findMany({
      where: { workflow: { userId }, createdAt: { gte: since } },
      select: { status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const chartData: Record<string, { date: string; completed: number; failed: number; total: number }> = {};
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      chartData[key] = { date: key, completed: 0, failed: 0, total: 0 };
    }

    for (const exec of executions) {
      const key = exec.createdAt.toISOString().split('T')[0];
      if (chartData[key]) {
        chartData[key].total++;
        if (exec.status === 'COMPLETED') chartData[key].completed++;
        if (exec.status === 'FAILED') chartData[key].failed++;
      }
    }

    return Object.values(chartData).reverse();
  }
}
