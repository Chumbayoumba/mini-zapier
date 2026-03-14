import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
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

  async findAllByUser(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [workflows, total] = await Promise.all([
      this.prisma.workflow.findMany({
        where: { userId },
        skip,
        take: limit,
        include: { trigger: true, _count: { select: { executions: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.workflow.count({ where: { userId } }),
    ]);
    return { workflows, total, page, totalPages: Math.ceil(total / limit) };
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
    await this.findById(id, userId);
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
