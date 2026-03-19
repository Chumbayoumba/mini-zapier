import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionsService } from './executions.service';
import { PrismaService } from '../prisma/prisma.service';
import { EngineService } from '../engine/engine.service';
import { QueueService } from '../queue/queue.service';
import { NotFoundException } from '@nestjs/common';

describe('ExecutionsService', () => {
  let service: ExecutionsService;
  let prisma: Record<string, any>;
  let engineService: { resumeWorkflow: jest.Mock };
  let queueService: { addExecution: jest.Mock };

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
    workflow: { id: 'wf-1', name: 'Test Workflow', definition: { nodes: [], edges: [] }, userId: 'user-1' },
    stepLogs: [
      { id: 'log-1', nodeId: 'step-a', stepName: 'Step 1', status: 'COMPLETED', startedAt: new Date('2024-01-01T00:00:00Z') },
      { id: 'log-2', nodeId: 'step-b', stepName: 'Step 2', status: 'COMPLETED', startedAt: new Date('2024-01-01T00:01:00Z') },
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
        aggregate: jest.fn(),
      },
      executionStepLog: {
        deleteMany: jest.fn(),
      },
      workflow: {
        count: jest.fn(),
      },
    };

    engineService = { resumeWorkflow: jest.fn() };
    queueService = { addExecution: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EngineService, useValue: engineService },
        { provide: QueueService, useValue: queueService },
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

    it('should filter by dateFrom and dateTo', async () => {
      prisma.workflowExecution.findMany.mockResolvedValue([]);
      prisma.workflowExecution.count.mockResolvedValue(0);

      await service.findAllByUser(userId, 1, 20, undefined, '2024-01-01', '2024-01-31');

      expect(prisma.workflowExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workflow: { userId },
            createdAt: {
              gte: new Date('2024-01-01'),
              lte: new Date('2024-01-31'),
            },
          },
        }),
      );
    });

    it('should filter by workflowId', async () => {
      prisma.workflowExecution.findMany.mockResolvedValue([]);
      prisma.workflowExecution.count.mockResolvedValue(0);

      await service.findAllByUser(userId, 1, 20, undefined, undefined, undefined, 'wf-123');

      expect(prisma.workflowExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workflow: { userId },
            workflowId: 'wf-123',
          },
        }),
      );
    });

    it('should combine status and date filters', async () => {
      prisma.workflowExecution.findMany.mockResolvedValue([]);
      prisma.workflowExecution.count.mockResolvedValue(0);

      await service.findAllByUser(userId, 1, 20, 'FAILED', '2024-01-01', undefined);

      expect(prisma.workflowExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workflow: { userId },
            status: 'FAILED',
            createdAt: { gte: new Date('2024-01-01') },
          },
        }),
      );
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
          workflow: { select: { id: true, name: true, definition: true, userId: true } },
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
    it('should return correct counts with new fields', async () => {
      prisma.workflowExecution.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80)  // completed
        .mockResolvedValueOnce(15)  // failed
        .mockResolvedValueOnce(5)   // running
        .mockResolvedValueOnce(12); // executions24h
      prisma.workflow.count
        .mockResolvedValueOnce(10)  // totalWorkflows
        .mockResolvedValueOnce(7);  // activeWorkflows
      prisma.workflowExecution.aggregate.mockResolvedValue({ _avg: { duration: 1500.5 } });

      const result = await service.getStats(userId);

      expect(result).toEqual({
        totalExecutions: 100,
        completed: 80,
        failed: 15,
        running: 5,
        totalWorkflows: 10,
        activeWorkflows: 7,
        executions24h: 12,
        successRate: 80,
        avgDuration: 1501,
      });
    });

    it('should use userId for all queries', async () => {
      prisma.workflowExecution.count.mockResolvedValue(0);
      prisma.workflow.count.mockResolvedValue(0);
      prisma.workflowExecution.aggregate.mockResolvedValue({ _avg: { duration: null } });

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
      prisma.workflowExecution.aggregate.mockResolvedValue({ _avg: { duration: null } });

      const result = await service.getStats(userId);

      expect(result).toEqual({
        totalExecutions: 0,
        completed: 0,
        failed: 0,
        running: 0,
        totalWorkflows: 0,
        activeWorkflows: 0,
        executions24h: 0,
        successRate: 0,
        avgDuration: 0,
      });
    });

    it('should compute successRate correctly', async () => {
      prisma.workflowExecution.count
        .mockResolvedValueOnce(3)  // total
        .mockResolvedValueOnce(1)  // completed
        .mockResolvedValueOnce(2)  // failed
        .mockResolvedValueOnce(0)  // running
        .mockResolvedValueOnce(3); // executions24h
      prisma.workflow.count.mockResolvedValue(1);
      prisma.workflowExecution.aggregate.mockResolvedValue({ _avg: { duration: 200 } });

      const result = await service.getStats(userId);

      expect(result.successRate).toBe(33.3);
      expect(result.avgDuration).toBe(200);
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

  describe('pause', () => {
    it('should pause a running execution', async () => {
      const running = { ...mockExecutionWithLogs, status: 'RUNNING' };
      prisma.workflowExecution.findUnique.mockResolvedValue(running);
      prisma.workflowExecution.update.mockResolvedValue({ ...running, status: 'PAUSED' });

      const result = await service.pause('exec-1');

      expect(result.status).toBe('PAUSED');
      expect(prisma.workflowExecution.update).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        data: { status: 'PAUSED', pausedAt: expect.any(Date) },
      });
    });

    it('should throw if execution is not RUNNING', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue(mockExecutionWithLogs);

      await expect(service.pause('exec-1')).rejects.toThrow(
        'Can only pause running executions',
      );
    });

    it('should throw if execution is PAUSED', async () => {
      const paused = { ...mockExecutionWithLogs, status: 'PAUSED' };
      prisma.workflowExecution.findUnique.mockResolvedValue(paused);

      await expect(service.pause('exec-1')).rejects.toThrow(
        'Can only pause running executions',
      );
    });
  });

  describe('resume', () => {
    it('should call engineService.resumeWorkflow for a paused execution', async () => {
      const paused = { ...mockExecutionWithLogs, status: 'PAUSED' };
      prisma.workflowExecution.findUnique.mockResolvedValue(paused);
      engineService.resumeWorkflow.mockResolvedValue('exec-1');

      const result = await service.resume('exec-1');

      expect(result).toBe('exec-1');
      expect(engineService.resumeWorkflow).toHaveBeenCalledWith('exec-1');
    });

    it('should throw if execution is not PAUSED', async () => {
      const running = { ...mockExecutionWithLogs, status: 'RUNNING' };
      prisma.workflowExecution.findUnique.mockResolvedValue(running);

      await expect(service.resume('exec-1')).rejects.toThrow(
        'Can only resume paused executions',
      );
    });

    it('should throw if execution is COMPLETED', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue(mockExecutionWithLogs);

      await expect(service.resume('exec-1')).rejects.toThrow(
        'Can only resume paused executions',
      );
    });
  });

  describe('retryFromFailed', () => {
    it('should identify failed step, cleanup logs, and call resumeWorkflow', async () => {
      const failedExec = {
        ...mockExecutionWithLogs,
        status: 'FAILED',
        stepLogs: [
          { id: 'log-1', nodeId: 'step-a', status: 'COMPLETED', startedAt: new Date('2024-01-01T00:00:00Z') },
          { id: 'log-2', nodeId: 'step-b', status: 'FAILED', startedAt: new Date('2024-01-01T00:01:00Z') },
        ],
      };
      prisma.workflowExecution.findUnique.mockResolvedValue(failedExec);
      prisma.executionStepLog.deleteMany.mockResolvedValue({ count: 1 });
      prisma.workflowExecution.update.mockResolvedValue({});
      engineService.resumeWorkflow.mockResolvedValue('exec-1');

      await service.retryFromFailed('exec-1');

      // Should delete the failed step log (and any after it)
      expect(prisma.executionStepLog.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['log-2'] } },
      });
      // Should update execution to PAUSED with lastCompletedNodeId of step before failure
      expect(prisma.workflowExecution.update).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        data: {
          status: 'PAUSED',
          lastCompletedNodeId: 'step-a',
          error: null,
          completedAt: null,
        },
      });
      // Should call resumeWorkflow
      expect(engineService.resumeWorkflow).toHaveBeenCalledWith('exec-1');
    });

    it('should throw if execution is not FAILED', async () => {
      const running = { ...mockExecutionWithLogs, status: 'RUNNING' };
      prisma.workflowExecution.findUnique.mockResolvedValue(running);

      await expect(service.retryFromFailed('exec-1')).rejects.toThrow(
        'Can only retry failed executions',
      );
    });

    it('should throw if no failed step found', async () => {
      const failedExec = {
        ...mockExecutionWithLogs,
        status: 'FAILED',
        stepLogs: [
          { id: 'log-1', nodeId: 'step-a', status: 'COMPLETED', startedAt: new Date() },
        ],
      };
      prisma.workflowExecution.findUnique.mockResolvedValue(failedExec);

      await expect(service.retryFromFailed('exec-1')).rejects.toThrow(
        'No failed step found in execution',
      );
    });

    it('should set lastCompletedNodeId to null if first step failed', async () => {
      const failedExec = {
        ...mockExecutionWithLogs,
        status: 'FAILED',
        stepLogs: [
          { id: 'log-1', nodeId: 'step-a', status: 'FAILED', startedAt: new Date('2024-01-01T00:00:00Z') },
        ],
      };
      prisma.workflowExecution.findUnique.mockResolvedValue(failedExec);
      prisma.executionStepLog.deleteMany.mockResolvedValue({ count: 1 });
      prisma.workflowExecution.update.mockResolvedValue({});
      engineService.resumeWorkflow.mockResolvedValue('exec-1');

      await service.retryFromFailed('exec-1');

      expect(prisma.workflowExecution.update).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        data: expect.objectContaining({
          lastCompletedNodeId: null,
        }),
      });
    });
  });

  describe('retry', () => {
    it('should enqueue via BullMQ for a failed execution', async () => {
      const failed = { ...mockExecutionWithLogs, status: 'FAILED' };
      prisma.workflowExecution.findUnique.mockResolvedValue(failed);
      queueService.addExecution.mockResolvedValue('job-123');

      const result = await service.retry('exec-1');

      expect(result).toEqual({ jobId: 'job-123', workflowId: 'wf-1' });
      expect(queueService.addExecution).toHaveBeenCalledWith('wf-1', { key: 'value' });
    });

    it('should throw if execution is not failed or cancelled', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue(mockExecutionWithLogs);

      await expect(service.retry('exec-1')).rejects.toThrow(
        'Can only retry failed or cancelled executions',
      );
    });

    it('should enqueue for cancelled executions too', async () => {
      const cancelled = { ...mockExecutionWithLogs, status: 'CANCELLED' };
      prisma.workflowExecution.findUnique.mockResolvedValue(cancelled);
      queueService.addExecution.mockResolvedValue('job-456');

      const result = await service.retry('exec-1');

      expect(result).toEqual({ jobId: 'job-456', workflowId: 'wf-1' });
    });
  });
});
