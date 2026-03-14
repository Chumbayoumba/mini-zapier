import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExecutionsService {
  private readonly logger = new Logger(ExecutionsService.name);

  constructor(private prisma: PrismaService) {}

  async findAllByUser(userId: string, page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where: any = { workflow: { userId } };
    if (status) where.status = status;

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

  async findById(id: string) {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id },
      include: {
        workflow: { select: { id: true, name: true, definition: true } },
        stepLogs: { orderBy: { startedAt: 'asc' } },
      },
    });
    if (!execution) throw new NotFoundException('Execution not found');
    return execution;
  }

  async cancel(id: string) {
    const execution = await this.findById(id);
    if (execution.status !== 'RUNNING' && execution.status !== 'PENDING') {
      throw new Error('Can only cancel running or pending executions');
    }
    return this.prisma.workflowExecution.update({
      where: { id },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
  }

  async retry(id: string) {
    const execution = await this.findById(id);
    if (execution.status !== 'FAILED' && execution.status !== 'CANCELLED') {
      throw new Error('Can only retry failed or cancelled executions');
    }
    // Create a new execution with the same trigger data
    const newExecution = await this.prisma.workflowExecution.create({
      data: {
        workflowId: execution.workflowId,
        triggerData: execution.triggerData,
        status: 'PENDING',
      },
    });
    this.logger.log(`Retry: created execution ${newExecution.id} from ${id}`);
    return newExecution;
  }

  async getStats(userId: string) {
    const [total, completed, failed, running] = await Promise.all([
      this.prisma.workflowExecution.count({ where: { workflow: { userId } } }),
      this.prisma.workflowExecution.count({ where: { workflow: { userId }, status: 'COMPLETED' } }),
      this.prisma.workflowExecution.count({ where: { workflow: { userId }, status: 'FAILED' } }),
      this.prisma.workflowExecution.count({ where: { workflow: { userId }, status: 'RUNNING' } }),
    ]);

    const totalWorkflows = await this.prisma.workflow.count({ where: { userId } });
    const activeWorkflows = await this.prisma.workflow.count({ where: { userId, status: 'ACTIVE' } });

    return { totalExecutions: total, completed, failed, running, totalWorkflows, activeWorkflows };
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
