import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionsService } from './executions.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('ExecutionsService', () => {
  let service: ExecutionsService;
  let prisma: Record<string, any>;

  const userId = 'user-1';

  const mockExecution = {
    id: 'exec-1',
    workflowId: 'wf-1',
    status: 'COMPLETED',
    triggerData: { key: 'value' },
    createdAt: new Date(),
    completedAt: new Date(),
    workflow: { id: 'wf-1', name: 'Test Workflow' },
    _count: { stepLogs: 3 },
  };

  const mockExecutionWithLogs = {
    ...mockExecution,
    workflow: { id: 'wf-1', name: 'Test Workflow', definition: { nodes: [], edges: [] } },
    stepLogs: [
      { id: 'log-1', stepName: 'Step 1', status: 'COMPLETED', startedAt: new Date() },
      { id: 'log-2', stepName: 'Step 2', status: 'COMPLETED', startedAt: new Date() },
    ],
  };

  beforeEach(async () => {
    prisma = {
      workflowExecution: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      workflow: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ExecutionsService>(ExecutionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllByUser', () => {
    it('should return paginated executions', async () => {
      prisma.workflowExecution.findMany.mockResolvedValue([mockExecution]);
      prisma.workflowExecution.count.mockResolvedValue(1);

      const result = await service.findAllByUser(userId, 1, 20);

      expect(result).toEqual({
        executions: [mockExecution],
        total: 1,
        page: 1,
        totalPages: 1,
      });
      expect(prisma.workflowExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workflow: { userId } },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should handle page 2', async () => {
      prisma.workflowExecution.findMany.mockResolvedValue([]);
      prisma.workflowExecution.count.mockResolvedValue(25);

      const result = await service.findAllByUser(userId, 2, 20);

      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(prisma.workflowExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
    });

    it('should filter by status', async () => {
      prisma.workflowExecution.findMany.mockResolvedValue([]);
      prisma.workflowExecution.count.mockResolvedValue(0);

      await service.findAllByUser(userId, 1, 20, 'FAILED');

      expect(prisma.workflowExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workflow: { userId }, status: 'FAILED' },
        }),
      );
      expect(prisma.workflowExecution.count).toHaveBeenCalledWith({
        where: { workflow: { userId }, status: 'FAILED' },
      });
    });

    it('should use userId in where clause', async () => {
      prisma.workflowExecution.findMany.mockResolvedValue([]);
      prisma.workflowExecution.count.mockResolvedValue(0);

      await service.findAllByUser('other-user');

      expect(prisma.workflowExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ workflow: { userId: 'other-user' } }),
        }),
      );
    });

    it('should include workflow and stepLogs count', async () => {
      prisma.workflowExecution.findMany.mockResolvedValue([]);
      prisma.workflowExecution.count.mockResolvedValue(0);

      await service.findAllByUser(userId);

      expect(prisma.workflowExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            workflow: { select: { id: true, name: true } },
            _count: { select: { stepLogs: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should calculate totalPages correctly', async () => {
      prisma.workflowExecution.findMany.mockResolvedValue([]);
      prisma.workflowExecution.count.mockResolvedValue(50);

      const result = await service.findAllByUser(userId, 1, 15);

      expect(result.totalPages).toBe(4); // ceil(50/15)
    });
  });

  describe('findById', () => {
    it('should return execution with step logs', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue(mockExecutionWithLogs);

      const result = await service.findById('exec-1');

      expect(result).toEqual(mockExecutionWithLogs);
      expect(prisma.workflowExecution.findUnique).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        include: {
          workflow: { select: { id: true, name: true, definition: true } },
          stepLogs: { orderBy: { startedAt: 'asc' } },
        },
      });
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue(null);

      await expect(service.findById('exec-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('should return correct counts', async () => {
      prisma.workflowExecution.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80)  // completed
        .mockResolvedValueOnce(15)  // failed
        .mockResolvedValueOnce(5);  // running
      prisma.workflow.count
        .mockResolvedValueOnce(10)  // totalWorkflows
        .mockResolvedValueOnce(7);  // activeWorkflows

      const result = await service.getStats(userId);

      expect(result).toEqual({
        totalExecutions: 100,
        completed: 80,
        failed: 15,
        running: 5,
        totalWorkflows: 10,
        activeWorkflows: 7,
      });
    });

    it('should use userId for all queries', async () => {
      prisma.workflowExecution.count.mockResolvedValue(0);
      prisma.workflow.count.mockResolvedValue(0);

      await service.getStats('specific-user');

      for (const call of prisma.workflowExecution.count.mock.calls) {
        expect(call[0].where.workflow.userId).toBe('specific-user');
      }
      for (const call of prisma.workflow.count.mock.calls) {
        expect(call[0].where.userId).toBe('specific-user');
      }
    });

    it('should return zeros when no data', async () => {
      prisma.workflowExecution.count.mockResolvedValue(0);
      prisma.workflow.count.mockResolvedValue(0);

      const result = await service.getStats(userId);

      expect(result).toEqual({
        totalExecutions: 0,
        completed: 0,
        failed: 0,
        running: 0,
        totalWorkflows: 0,
        activeWorkflows: 0,
      });
    });
  });

  describe('cancel', () => {
    it('should cancel a running execution', async () => {
      const running = { ...mockExecutionWithLogs, status: 'RUNNING' };
      prisma.workflowExecution.findUnique.mockResolvedValue(running);
      prisma.workflowExecution.update.mockResolvedValue({ ...running, status: 'CANCELLED' });

      const result = await service.cancel('exec-1');

      expect(result.status).toBe('CANCELLED');
      expect(prisma.workflowExecution.update).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        data: { status: 'CANCELLED', completedAt: expect.any(Date) },
      });
    });

    it('should throw if execution is already completed', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue(mockExecutionWithLogs);

      await expect(service.cancel('exec-1')).rejects.toThrow(
        'Can only cancel running or pending executions',
      );
    });
  });

  describe('retry', () => {
    it('should create new execution from a failed one', async () => {
      const failed = { ...mockExecutionWithLogs, status: 'FAILED' };
      prisma.workflowExecution.findUnique.mockResolvedValue(failed);
      prisma.workflowExecution.create.mockResolvedValue({
        id: 'exec-2',
        workflowId: 'wf-1',
        status: 'PENDING',
      });

      const result = await service.retry('exec-1');

      expect(result.status).toBe('PENDING');
      expect(prisma.workflowExecution.create).toHaveBeenCalledWith({
        data: {
          workflowId: 'wf-1',
          triggerData: { key: 'value' },
          status: 'PENDING',
        },
      });
    });

    it('should throw if execution is not failed or cancelled', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue(mockExecutionWithLogs);

      await expect(service.retry('exec-1')).rejects.toThrow(
        'Can only retry failed or cancelled executions',
      );
    });
  });
});
