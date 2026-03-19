import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { WorkflowValidationService } from './workflow-validation.service';

@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private validationService: WorkflowValidationService,
  ) {}

  async create(userId: string, dto: CreateWorkflowDto) {
    const workflow = await this.prisma.workflow.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        definition: dto.definition || { nodes: [], edges: [] },
      },
    });
    this.logger.log(`Workflow created: ${workflow.id}`);
    return workflow;
  }

  async findAllByUser(userId: string, page = 1, limit = 20, search?: string, statusFilter?: string) {
    const skip = (page - 1) * limit;
    const where: any = { userId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (statusFilter && statusFilter !== 'all') {
      where.status = statusFilter === 'active' ? 'ACTIVE' : statusFilter === 'inactive' ? 'DRAFT' : statusFilter.toUpperCase();
    }

    const [workflows, total] = await Promise.all([
      this.prisma.workflow.findMany({
        where,
        skip,
        take: limit,
        include: {
          trigger: true,
          _count: { select: { executions: true } },
          executions: {
            select: { id: true, status: true, createdAt: true, duration: true },
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.workflow.count({ where }),
    ]);

    const enriched = workflows.map(({ executions, ...wf }: any) => {
      const total = executions.length;
      const completed = executions.filter((e: any) => e.status === 'COMPLETED').length;
      const failed = executions.filter((e: any) => e.status === 'FAILED').length;
      const lastExecution = executions[0] || null;
      return {
        ...wf,
        executionStats: {
          total,
          completed,
          failed,
          successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        },
        lastExecution: lastExecution ? {
          id: lastExecution.id,
          status: lastExecution.status,
          createdAt: lastExecution.createdAt,
          duration: lastExecution.duration,
        } : null,
      };
    });

    return { workflows: enriched, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string, userId: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: { trigger: true, _count: { select: { executions: true } } },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    if (workflow.userId !== userId) throw new ForbiddenException('Access denied');
    return workflow;
  }

  async update(id: string, userId: string, dto: UpdateWorkflowDto) {
    const workflow = await this.findById(id, userId);

    // Create version before updating
    if (dto.definition) {
      await this.prisma.workflowVersion.create({
        data: {
          workflowId: id,
          version: workflow.version,
          definition: workflow.definition as any,
          changelog: dto.changelog || `Version ${workflow.version}`,
        },
      });
    }

    const updated = await this.prisma.workflow.update({
      where: { id },
      data: {
        ...dto,
        version: dto.definition ? { increment: 1 } : undefined,
      },
    });

    this.eventEmitter.emit('workflow.updated', { workflowId: id });
    return updated;
  }

  async delete(id: string, userId: string) {
    await this.findById(id, userId);
    await this.prisma.workflow.delete({ where: { id } });
    this.logger.log(`Workflow deleted: ${id}`);
    return { message: 'Workflow deleted' };
  }

  async activate(id: string, userId: string) {
    const workflow = await this.findById(id, userId);

    // Validate workflow before activation
    const validation = await this.validationService.validateBeforeActivation(workflow);
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Workflow validation failed',
        errors: validation.errors,
      });
    }

    const updated = await this.prisma.workflow.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
    this.eventEmitter.emit('workflow.activated', { workflowId: id });
    return updated;
  }

  async deactivate(id: string, userId: string) {
    await this.findById(id, userId);
    const updated = await this.prisma.workflow.update({
      where: { id },
      data: { status: 'PAUSED' },
    });
    this.eventEmitter.emit('workflow.deactivated', { workflowId: id });
    return updated;
  }

  async getVersions(id: string, userId: string) {
    await this.findById(id, userId);
    return this.prisma.workflowVersion.findMany({
      where: { workflowId: id },
      orderBy: { version: 'desc' },
    });
  }
}
