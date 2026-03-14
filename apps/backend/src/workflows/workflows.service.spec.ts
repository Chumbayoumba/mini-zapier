import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowsService } from './workflows.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('WorkflowsService', () => {
  let service: WorkflowsService;
  let prisma: Record<string, any>;
  let eventEmitter: jest.Mocked<Pick<EventEmitter2, 'emit'>>;

  const userId = 'user-1';

  const mockWorkflow = {
    id: 'wf-1',
    userId,
    name: 'Test Workflow',
    description: 'A test workflow',
    definition: { nodes: [], edges: [] },
    status: 'DRAFT',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    trigger: null,
    _count: { executions: 0 },
  };

  beforeEach(async () => {
    prisma = {
      workflow: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      workflowVersion: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    eventEmitter = {
      emit: jest.fn() as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<WorkflowsService>(WorkflowsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a workflow', async () => {
      prisma.workflow.create.mockResolvedValue(mockWorkflow);

      const result = await service.create(userId, {
        name: 'Test Workflow',
        description: 'A test workflow',
      });

      expect(result).toEqual(mockWorkflow);
      expect(prisma.workflow.create).toHaveBeenCalledWith({
        data: {
          userId,
          name: 'Test Workflow',
          description: 'A test workflow',
          definition: { nodes: [], edges: [] },
        },
      });
    });

    it('should use provided definition', async () => {
      const definition = { nodes: [{ id: 'n1' }], edges: [] };
      prisma.workflow.create.mockResolvedValue({ ...mockWorkflow, definition });

      await service.create(userId, {
        name: 'Test',
        definition,
      });

      expect(prisma.workflow.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ definition }),
      });
    });
  });

  describe('findAllByUser', () => {
    it('should return paginated workflows', async () => {
      prisma.workflow.findMany.mockResolvedValue([mockWorkflow]);
      prisma.workflow.count.mockResolvedValue(1);

      const result = await service.findAllByUser(userId, 1, 20);

      expect(result).toEqual({
        workflows: [mockWorkflow],
        total: 1,
        page: 1,
        totalPages: 1,
      });
      expect(prisma.workflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should handle page 2', async () => {
      prisma.workflow.findMany.mockResolvedValue([]);
      prisma.workflow.count.mockResolvedValue(25);

      const result = await service.findAllByUser(userId, 2, 20);

      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(prisma.workflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
    });
  });

  describe('findById', () => {
    it('should return workflow if found and user matches', async () => {
      prisma.workflow.findUnique.mockResolvedValue(mockWorkflow);

      const result = await service.findById('wf-1', userId);

      expect(result).toEqual(mockWorkflow);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.workflow.findUnique.mockResolvedValue(null);

      await expect(service.findById('wf-999', userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if userId does not match', async () => {
      prisma.workflow.findUnique.mockResolvedValue(mockWorkflow);

      await expect(service.findById('wf-1', 'other-user')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update workflow without version bump when no definition change', async () => {
      prisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      prisma.workflow.update.mockResolvedValue({ ...mockWorkflow, name: 'Updated' });

      const result = await service.update('wf-1', userId, { name: 'Updated' });

      expect(result.name).toBe('Updated');
      expect(prisma.workflowVersion.create).not.toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('workflow.updated', { workflowId: 'wf-1' });
    });

    it('should create version and increment when definition changes', async () => {
      prisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      prisma.workflowVersion.create.mockResolvedValue({});
      const newDef = { nodes: [{ id: 'n1' }], edges: [] };
      prisma.workflow.update.mockResolvedValue({
        ...mockWorkflow,
        definition: newDef,
        version: 2,
      });

      await service.update('wf-1', userId, { definition: newDef });

      expect(prisma.workflowVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workflowId: 'wf-1',
          version: 1,
        }),
      });
      expect(prisma.workflow.update).toHaveBeenCalledWith({
        where: { id: 'wf-1' },
        data: expect.objectContaining({
          version: { increment: 1 },
        }),
      });
    });
  });

  describe('delete', () => {
    it('should delete workflow', async () => {
      prisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      prisma.workflow.delete.mockResolvedValue(mockWorkflow);

      const result = await service.delete('wf-1', userId);

      expect(result).toEqual({ message: 'Workflow deleted' });
      expect(prisma.workflow.delete).toHaveBeenCalledWith({ where: { id: 'wf-1' } });
    });

    it('should throw if workflow not found', async () => {
      prisma.workflow.findUnique.mockResolvedValue(null);

      await expect(service.delete('wf-999', userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('activate', () => {
    it('should set status to ACTIVE', async () => {
      prisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      prisma.workflow.update.mockResolvedValue({ ...mockWorkflow, status: 'ACTIVE' });

      const result = await service.activate('wf-1', userId);

      expect(result.status).toBe('ACTIVE');
      expect(prisma.workflow.update).toHaveBeenCalledWith({
        where: { id: 'wf-1' },
        data: { status: 'ACTIVE' },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('workflow.activated', { workflowId: 'wf-1' });
    });

    it('should throw ForbiddenException for wrong user', async () => {
      prisma.workflow.findUnique.mockResolvedValue(mockWorkflow);

      await expect(service.activate('wf-1', 'other-user')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deactivate', () => {
    it('should set status to PAUSED', async () => {
      prisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      prisma.workflow.update.mockResolvedValue({ ...mockWorkflow, status: 'PAUSED' });

      const result = await service.deactivate('wf-1', userId);

      expect(result.status).toBe('PAUSED');
      expect(prisma.workflow.update).toHaveBeenCalledWith({
        where: { id: 'wf-1' },
        data: { status: 'PAUSED' },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('workflow.deactivated', {
        workflowId: 'wf-1',
      });
    });
  });

  describe('getVersions', () => {
    it('should return versions for workflow', async () => {
      prisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      const versions = [{ id: 'v1', version: 1 }];
      prisma.workflowVersion.findMany.mockResolvedValue(versions);

      const result = await service.getVersions('wf-1', userId);

      expect(result).toEqual(versions);
      expect(prisma.workflowVersion.findMany).toHaveBeenCalledWith({
        where: { workflowId: 'wf-1' },
        orderBy: { version: 'desc' },
      });
    });
  });
});
