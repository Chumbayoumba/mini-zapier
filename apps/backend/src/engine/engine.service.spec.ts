import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EngineService } from './engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActionRegistry } from './action-registry';

describe('EngineService', () => {
  let service: EngineService;
  let prisma: Record<string, any>;
  let eventEmitter: jest.Mocked<Pick<EventEmitter2, 'emit'>>;
  let actionRegistry: { get: jest.Mock };
  let mockHandlers: Record<string, { execute: jest.Mock }>;

  const mockExecution = {
    id: 'exec-1',
    workflowId: 'wf-1',
    status: 'RUNNING',
    triggerData: null,
    startedAt: new Date('2024-01-01T00:00:00Z'),
    completedAt: null,
    duration: null,
    error: null,
  };

  // Default errorConfig uses fast delays and single attempt for test speed.
  // Override per-test to test retry behavior.
  const FAST_NO_RETRY = { retry: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 10, jitter: false } };

  const makeWorkflow = (nodes: any[], edges: any[], errorConfig?: any) => ({
    id: 'wf-1',
    name: 'Test Workflow',
    definition: { nodes, edges },
    errorConfig: errorConfig === undefined ? FAST_NO_RETRY : errorConfig,
    userId: 'user-1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    prisma = {
      workflow: { findUnique: jest.fn() },
      workflowExecution: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ status: 'RUNNING' }),
      },
      executionStepLog: { create: jest.fn(), update: jest.fn() },
    };

    eventEmitter = { emit: jest.fn() };

    mockHandlers = {
      HTTP_REQUEST: { execute: jest.fn() },
      SEND_EMAIL: { execute: jest.fn() },
      TELEGRAM: { execute: jest.fn() },
      DATABASE: { execute: jest.fn() },
      TRANSFORM: { execute: jest.fn() },
    };

    actionRegistry = {
      get: jest.fn((type: string) => {
        const handler = mockHandlers[type];
        if (!handler) throw new Error(`Unknown action type: ${type}`);
        return handler;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EngineService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ActionRegistry, useValue: actionRegistry },
      ],
    }).compile();

    service = module.get<EngineService>(EngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('executeWorkflow', () => {
    it('should throw if workflow not found', async () => {
      prisma.workflow.findUnique.mockResolvedValue(null);

      await expect(service.executeWorkflow('wf-missing')).rejects.toThrow(
        'Workflow wf-missing not found',
      );
    });

    it('should create execution record and return execution id', async () => {
      const workflow = makeWorkflow(
        [{ id: 'n1', data: { type: 'WEBHOOK', label: 'Trigger' } }],
        [],
      );
      prisma.workflow.findUnique.mockResolvedValue(workflow);
      prisma.workflowExecution.create.mockResolvedValue(mockExecution);
      prisma.workflowExecution.update.mockResolvedValue({ ...mockExecution, status: 'COMPLETED' });

      const result = await service.executeWorkflow('wf-1', { foo: 'bar' });

      expect(result).toBe('exec-1');
      expect(prisma.workflowExecution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workflowId: 'wf-1',
          triggerData: { foo: 'bar' },
          status: 'RUNNING',
          startedAt: expect.any(Date),
        }),
      });
    });

    it('should pass triggerData into execution context for trigger nodes', async () => {
      const triggerData = { webhookPayload: 'data' };
      const workflow = makeWorkflow(
        [{ id: 'trigger', data: { type: 'WEBHOOK', label: 'Webhook' } }],
        [],
      );
      prisma.workflow.findUnique.mockResolvedValue(workflow);
      prisma.workflowExecution.create.mockResolvedValue(mockExecution);
      prisma.workflowExecution.update.mockResolvedValue({});

      await service.executeWorkflow('wf-1', triggerData);

      // Trigger nodes don't call any action — they set stepResults directly
      expect(mockHandlers.HTTP_REQUEST.execute).not.toHaveBeenCalled();
    });

    it('should emit execution.started event', async () => {
      const workflow = makeWorkflow(
        [{ id: 'n1', data: { type: 'CRON', label: 'Cron' } }],
        [],
      );
      prisma.workflow.findUnique.mockResolvedValue(workflow);
      prisma.workflowExecution.create.mockResolvedValue(mockExecution);
      prisma.workflowExecution.update.mockResolvedValue({});

      await service.executeWorkflow('wf-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith('execution.started', {
        executionId: 'exec-1',
        workflowId: 'wf-1',
      });
    });

    it('should emit execution.completed event on success', async () => {
      const workflow = makeWorkflow(
        [{ id: 'n1', data: { type: 'WEBHOOK', label: 'Trigger' } }],
        [],
      );
      prisma.workflow.findUnique.mockResolvedValue(workflow);
      prisma.workflowExecution.create.mockResolvedValue(mockExecution);
      prisma.workflowExecution.update.mockResolvedValue({});

      await service.executeWorkflow('wf-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith('execution.completed', {
        executionId: 'exec-1',
        workflowId: 'wf-1',
      });
    });

    it('should update execution to COMPLETED on success', async () => {
      const workflow = makeWorkflow(
        [{ id: 'n1', data: { type: 'EMAIL', label: 'Email Trigger' } }],
        [],
      );
      prisma.workflow.findUnique.mockResolvedValue(workflow);
      prisma.workflowExecution.create.mockResolvedValue(mockExecution);
      prisma.workflowExecution.update.mockResolvedValue({});

      await service.executeWorkflow('wf-1');

      expect(prisma.workflowExecution.update).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          completedAt: expect.any(Date),
          duration: expect.any(Number),
        }),
      });
    });

    it('should execute HTTP_REQUEST action for action nodes', async () => {
      const workflow = makeWorkflow(
        [
          { id: 'trigger', data: { type: 'WEBHOOK', label: 'Trigger' } },
          { id: 'http', data: { type: 'HTTP_REQUEST', label: 'Call API', config: { url: 'https://api.test' } } },
        ],
        [{ source: 'trigger', target: 'http' }],
      );
      prisma.workflow.findUnique.mockResolvedValue(workflow);
      prisma.workflowExecution.create.mockResolvedValue(mockExecution);
      prisma.workflowExecution.update.mockResolvedValue({});
      prisma.executionStepLog.create.mockResolvedValue({ id: 'step-1' });
      prisma.executionStepLog.update.mockResolvedValue({});
      mockHandlers.HTTP_REQUEST.execute.mockResolvedValue({ status: 200, body: 'ok' });

      await service.executeWorkflow('wf-1', { some: 'data' });

      expect(mockHandlers.HTTP_REQUEST.execute).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://api.test' }),
      );
    });

    it('should execute TRANSFORM action node', async () => {
      const workflow = makeWorkflow(
        [
          { id: 'trigger', data: { type: 'CRON', label: 'Cron' } },
          { id: 'transform', data: { type: 'TRANSFORM', label: 'Map', config: { expression: '$.x' } } },
        ],
        [{ source: 'trigger', target: 'transform' }],
      );
      prisma.workflow.findUnique.mockResolvedValue(workflow);
      prisma.workflowExecution.create.mockResolvedValue(mockExecution);
      prisma.workflowExecution.update.mockResolvedValue({});
      prisma.executionStepLog.create.mockResolvedValue({ id: 'step-1' });
      prisma.executionStepLog.update.mockResolvedValue({});
      mockHandlers.TRANSFORM.execute.mockResolvedValue({ result: 42 });

      await service.executeWorkflow('wf-1');

      expect(mockHandlers.TRANSFORM.execute).toHaveBeenCalled();
    });

    it('should create step log for each action node', async () => {
      const workflow = makeWorkflow(
        [
          { id: 'trigger', data: { type: 'WEBHOOK', label: 'Trigger' } },
          { id: 'http', data: { type: 'HTTP_REQUEST', label: 'API Call', config: { url: 'http://x' } } },
        ],
        [{ source: 'trigger', target: 'http' }],
      );
      prisma.workflow.findUnique.mockResolvedValue(workflow);
      prisma.workflowExecution.create.mockResolvedValue(mockExecution);
      prisma.workflowExecution.update.mockResolvedValue({});
      prisma.executionStepLog.create.mockResolvedValue({ id: 'step-1' });
      prisma.executionStepLog.update.mockResolvedValue({});
      mockHandlers.HTTP_REQUEST.execute.mockResolvedValue({});

      await service.executeWorkflow('wf-1');

      expect(prisma.executionStepLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          executionId: 'exec-1',
          nodeId: 'http',
          nodeName: 'API Call',
          nodeType: 'HTTP_REQUEST',
          status: 'RUNNING',
          input: { url: 'http://x' },
          startedAt: expect.any(Date),
        }),
      });
    });

    it('should emit step.started and step.completed events', async () => {
      const workflow = makeWorkflow(
        [
          { id: 'trigger', data: { type: 'WEBHOOK', label: 'Trigger' } },
          { id: 'email', data: { type: 'SEND_EMAIL', label: 'Send', config: { to: 'a@b.com' } } },
        ],
        [{ source: 'trigger', target: 'email' }],
      );
      prisma.workflow.findUnique.mockResolvedValue(workflow);
      prisma.workflowExecution.create.mockResolvedValue(mockExecution);
      prisma.workflowExecution.update.mockResolvedValue({});
      prisma.executionStepLog.create.mockResolvedValue({ id: 'step-1' });
      prisma.executionStepLog.update.mockResolvedValue({});
      mockHandlers.SEND_EMAIL.execute.mockResolvedValue({ sent: true });

      await service.executeWorkflow('wf-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith('step.started', {
        executionId: 'exec-1',
        stepId: 'step-1',
        nodeId: 'email',
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('step.completed', {
        executionId: 'exec-1',
        stepId: 'step-1',
        nodeId: 'email',
        result: { sent: true },
      });
    });

    it('should mark execution as FAILED when a step throws', async () => {
      const workflow = makeWorkflow(
        [
          { id: 'trigger', data: { type: 'WEBHOOK', label: 'Trigger' } },
          { id: 'http', data: { type: 'HTTP_REQUEST', label: 'Fail', config: {} } },
        ],
        [{ source: 'trigger', target: 'http' }],
      );
      prisma.workflow.findUnique.mockResolvedValue(workflow);
      prisma.workflowExecution.create.mockResolvedValue(mockExecution);
      prisma.workflowExecution.update.mockResolvedValue({});
      prisma.executionStepLog.create.mockResolvedValue({ id: 'step-1' });
      prisma.executionStepLog.update.mockResolvedValue({});
      mockHandlers.HTTP_REQUEST.execute.mockRejectedValue(new Error('Network error'));

      await expect(service.executeWorkflow('wf-1')).rejects.toThrow('Network error');

      expect(prisma.workflowExecution.update).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          error: 'Network error',
        }),
      });
    });

    it('should emit execution.failed event on error', async () => {
      const workflow = makeWorkflow(
        [
          { id: 'trigger', data: { type: 'WEBHOOK', label: 'Trigger' } },
          { id: 'tg', data: { type: 'TELEGRAM', label: 'TG', config: {} } },
        ],
        [{ source: 'trigger', target: 'tg' }],
      );
      prisma.workflow.findUnique.mockResolvedValue(workflow);
      prisma.workflowExecution.create.mockResolvedValue(mockExecution);
      prisma.workflowExecution.update.mockResolvedValue({});
      prisma.executionStepLog.create.mockResolvedValue({ id: 'step-1' });
      prisma.executionStepLog.update.mockResolvedValue({});
      mockHandlers.TELEGRAM.execute.mockRejectedValue(new Error('TG API down'));

      await expect(service.executeWorkflow('wf-1')).rejects.toThrow('TG API down');

      expect(eventEmitter.emit).toHaveBeenCalledWith('execution.failed', {
        executionId: 'exec-1',
        workflowId: 'wf-1',
        error: 'TG API down',
      });
    });

    it('should throw for unknown action type', async () => {
      const workflow = makeWorkflow(
        [{ id: 'n1', data: { type: 'UNKNOWN_TYPE', label: 'Bad', config: {} } }],
        [],
      );
      prisma.workflow.findUnique.mockResolvedValue(workflow);
      prisma.workflowExecution.create.mockResolvedValue(mockExecution);
      prisma.workflowExecution.update.mockResolvedValue({});
      prisma.executionStepLog.create.mockResolvedValue({ id: 'step-1' });
      prisma.executionStepLog.update.mockResolvedValue({});

      await expect(service.executeWorkflow('wf-1')).rejects.toThrow(
        'Unknown action type: UNKNOWN_TYPE',
      );
    });

    it('should execute nodes in topological order across edges', async () => {
      const callOrder: string[] = [];
      const workflow = makeWorkflow(
        [
          { id: 'trigger', data: { type: 'WEBHOOK', label: 'Trigger' } },
          { id: 'step-a', data: { type: 'HTTP_REQUEST', label: 'A', config: { step: 'a' } } },
          { id: 'step-b', data: { type: 'TRANSFORM', label: 'B', config: { step: 'b' } } },
        ],
        [
          { source: 'trigger', target: 'step-a' },
          { source: 'step-a', target: 'step-b' },
        ],
      );

      prisma.workflow.findUnique.mockResolvedValue(workflow);
      prisma.workflowExecution.create.mockResolvedValue(mockExecution);
      prisma.workflowExecution.update.mockResolvedValue({});
      prisma.executionStepLog.create.mockResolvedValue({ id: 'step-log-1' });
      prisma.executionStepLog.update.mockResolvedValue({});

      mockHandlers.HTTP_REQUEST.execute.mockImplementation(async () => {
        callOrder.push('HTTP_REQUEST');
        return { ok: true };
      });
      mockHandlers.TRANSFORM.execute.mockImplementation(async () => {
        callOrder.push('TRANSFORM');
        return { transformed: true };
      });

      await service.executeWorkflow('wf-1', {});

      expect(callOrder).toEqual(['HTTP_REQUEST', 'TRANSFORM']);
    });

    it('should handle workflow with no triggerData (undefined)', async () => {
      const workflow = makeWorkflow(
        [{ id: 'n1', data: { type: 'WEBHOOK', label: 'Trigger' } }],
        [],
      );
      prisma.workflow.findUnique.mockResolvedValue(workflow);
      prisma.workflowExecution.create.mockResolvedValue(mockExecution);
      prisma.workflowExecution.update.mockResolvedValue({});

      const result = await service.executeWorkflow('wf-1');

      expect(result).toBe('exec-1');
      expect(prisma.workflowExecution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ triggerData: undefined }),
      });
    });
  });

  describe('per-step retry with exponential backoff', () => {
    it('should succeed on 2nd attempt with retryCount=1 in step log', async () => {
      const workflow = makeWorkflow(
        [
          { id: 'trigger', data: { type: 'WEBHOOK', label: 'Trigger' } },
          { id: 'http', data: { type: 'HTTP_REQUEST', label: 'API', config: { url: 'http://x' } } },
        ],
        [{ source: 'trigger', target: 'http' }],
        { retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10, jitter: false } },
      );
      prisma.workflow.findUnique.mockResolvedValue(workflow);
      prisma.workflowExecution.create.mockResolvedValue(mockExecution);
      prisma.workflowExecution.update.mockResolvedValue({});
      prisma.executionStepLog.create.mockResolvedValue({ id: 'step-1' });
      prisma.executionStepLog.update.mockResolvedValue({});

      mockHandlers.HTTP_REQUEST.execute
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockResolvedValueOnce({ ok: true });

      await service.executeWorkflow('wf-1');

      // Step log updated with retryCount: 1 on success (2nd attempt)
      expect(prisma.executionStepLog.update).toHaveBeenCalledWith({
        where: { id: 'step-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          retryCount: 1,
        }),
      });
      // Workflow completed, not failed
      expect(prisma.workflowExecution.update).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      });
    });

    it('should fail after all retry attempts are exhausted', async () => {
      const workflow = makeWorkflow(
        [
          { id: 'trigger', data: { type: 'WEBHOOK', label: 'Trigger' } },
          { id: 'http', data: { type: 'HTTP_REQUEST', label: 'API', config: {} } },
        ],
        [{ source: 'trigger', target: 'http' }],
        { retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10, jitter: false } },
      );
      prisma.workflow.findUnique.mockResolvedValue(workflow);
      prisma.workflowExecution.create.mockResolvedValue(mockExecution);
      prisma.workflowExecution.update.mockResolvedValue({});
      prisma.executionStepLog.create.mockResolvedValue({ id: 'step-1' });
      prisma.executionStepLog.update.mockResolvedValue({});

      const err = new Error('Persistent failure');
      err.stack = 'Error: Persistent failure\n    at Test';
      mockHandlers.HTTP_REQUEST.execute.mockRejectedValue(err);

      await expect(service.executeWorkflow('wf-1')).rejects.toThrow('Persistent failure');

      // Step log updated with FAILED status, errorStack, and retryCount=2 (3 attempts - 1)
      expect(prisma.executionStepLog.update).toHaveBeenCalledWith({
        where: { id: 'step-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          error: 'Persistent failure',
          errorStack: expect.stringContaining('Persistent failure'),
          retryCount: 2,
        }),
      });
      // Action called 3 times
      expect(mockHandlers.HTTP_REQUEST.execute).toHaveBeenCalledTimes(3);
    });

    it('should read RetryConfig from workflow.errorConfig', async () => {
      const workflow = makeWorkflow(
        [
          { id: 'trigger', data: { type: 'WEBHOOK', label: 'Trigger' } },
          { id: 'http', data: { type: 'HTTP_REQUEST', label: 'API', config: {} } },
        ],
        [{ source: 'trigger', target: 'http' }],
        // maxAttempts: 1 means no retry
        { retry: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 10, jitter: false } },
      );
      prisma.workflow.findUnique.mockResolvedValue(workflow);
      prisma.workflowExecution.create.mockResolvedValue(mockExecution);
      prisma.workflowExecution.update.mockResolvedValue({});
      prisma.executionStepLog.create.mockResolvedValue({ id: 'step-1' });
      prisma.executionStepLog.update.mockResolvedValue({});

      mockHandlers.HTTP_REQUEST.execute.mockRejectedValue(new Error('Fail'));

      await expect(service.executeWorkflow('wf-1')).rejects.toThrow('Fail');

      // Action called only once (maxAttempts: 1 = no retry)
      expect(mockHandlers.HTTP_REQUEST.execute).toHaveBeenCalledTimes(1);
    });

    it('should use DEFAULT_RETRY_CONFIG when workflow has no errorConfig', async () => {
      const workflow = makeWorkflow(
        [
          { id: 'trigger', data: { type: 'WEBHOOK', label: 'Trigger' } },
          { id: 'http', data: { type: 'HTTP_REQUEST', label: 'API', config: {} } },
        ],
        [{ source: 'trigger', target: 'http' }],
        null, // null = no errorConfig, triggers DEFAULT_ERROR_CONFIG (maxAttempts: 3)
      );
      prisma.workflow.findUnique.mockResolvedValue(workflow);
      prisma.workflowExecution.create.mockResolvedValue(mockExecution);
      prisma.workflowExecution.update.mockResolvedValue({});
      prisma.executionStepLog.create.mockResolvedValue({ id: 'step-1' });
      prisma.executionStepLog.update.mockResolvedValue({});

      // Fail then succeed — default has maxAttempts: 3 so should succeed on 2nd
      mockHandlers.HTTP_REQUEST.execute
        .mockRejectedValueOnce(new Error('Temp'))
        .mockResolvedValueOnce({ ok: true });

      await service.executeWorkflow('wf-1');

      // Called twice: 1st fails, 2nd succeeds
      expect(mockHandlers.HTTP_REQUEST.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe('pause check between steps', () => {
    it('should pause execution when status is PAUSED in DB', async () => {
      const workflow = makeWorkflow(
        [
          { id: 'trigger', data: { type: 'WEBHOOK', label: 'Trigger' } },
          { id: 'step-a', data: { type: 'HTTP_REQUEST', label: 'A', config: {} } },
          { id: 'step-b', data: { type: 'TRANSFORM', label: 'B', config: {} } },
        ],
        [
          { source: 'trigger', target: 'step-a' },
          { source: 'step-a', target: 'step-b' },
        ],
      );

      prisma.workflow.findUnique.mockResolvedValue(workflow);
      prisma.workflowExecution.create.mockResolvedValue(mockExecution);
      prisma.workflowExecution.update.mockResolvedValue({});
      prisma.executionStepLog.create.mockResolvedValue({ id: 'step-log-1' });
      prisma.executionStepLog.update.mockResolvedValue({});

      mockHandlers.HTTP_REQUEST.execute.mockResolvedValue({ ok: true });
      mockHandlers.TRANSFORM.execute.mockResolvedValue({ result: 1 });

      // First pause check returns RUNNING (step-a executes),
      // second pause check returns PAUSED (step-b skipped)
      prisma.workflowExecution.findUnique
        .mockResolvedValueOnce({ status: 'RUNNING' })
        .mockResolvedValueOnce({ status: 'PAUSED' });

      const result = await service.executeWorkflow('wf-1');

      expect(result).toBe('exec-1');
      // Only step-a should have executed, step-b should not
      expect(mockHandlers.HTTP_REQUEST.execute).toHaveBeenCalledTimes(1);
      expect(mockHandlers.TRANSFORM.execute).not.toHaveBeenCalled();
    });

    it('should store lastCompletedNodeId when pausing', async () => {
      const workflow = makeWorkflow(
        [
          { id: 'trigger', data: { type: 'WEBHOOK', label: 'Trigger' } },
          { id: 'step-a', data: { type: 'HTTP_REQUEST', label: 'A', config: {} } },
          { id: 'step-b', data: { type: 'TRANSFORM', label: 'B', config: {} } },
        ],
        [
          { source: 'trigger', target: 'step-a' },
          { source: 'step-a', target: 'step-b' },
        ],
      );

      prisma.workflow.findUnique.mockResolvedValue(workflow);
      prisma.workflowExecution.create.mockResolvedValue(mockExecution);
      prisma.workflowExecution.update.mockResolvedValue({});
      prisma.executionStepLog.create.mockResolvedValue({ id: 'step-log-1' });
      prisma.executionStepLog.update.mockResolvedValue({});
      mockHandlers.HTTP_REQUEST.execute.mockResolvedValue({ ok: true });

      // RUNNING for step-a, PAUSED before step-b
      prisma.workflowExecution.findUnique
        .mockResolvedValueOnce({ status: 'RUNNING' })
        .mockResolvedValueOnce({ status: 'PAUSED' });

      await service.executeWorkflow('wf-1');

      // Should update with lastCompletedNodeId = 'step-a'
      expect(prisma.workflowExecution.update).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        data: { lastCompletedNodeId: 'step-a' },
      });
    });

    it('should emit execution.paused event when pausing', async () => {
      const workflow = makeWorkflow(
        [
          { id: 'trigger', data: { type: 'WEBHOOK', label: 'Trigger' } },
          { id: 'step-a', data: { type: 'HTTP_REQUEST', label: 'A', config: {} } },
          { id: 'step-b', data: { type: 'TRANSFORM', label: 'B', config: {} } },
        ],
        [
          { source: 'trigger', target: 'step-a' },
          { source: 'step-a', target: 'step-b' },
        ],
      );

      prisma.workflow.findUnique.mockResolvedValue(workflow);
      prisma.workflowExecution.create.mockResolvedValue(mockExecution);
      prisma.workflowExecution.update.mockResolvedValue({});
      prisma.executionStepLog.create.mockResolvedValue({ id: 'step-log-1' });
      prisma.executionStepLog.update.mockResolvedValue({});
      mockHandlers.HTTP_REQUEST.execute.mockResolvedValue({ ok: true });

      prisma.workflowExecution.findUnique
        .mockResolvedValueOnce({ status: 'RUNNING' })
        .mockResolvedValueOnce({ status: 'PAUSED' });

      await service.executeWorkflow('wf-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith('execution.paused', {
        executionId: 'exec-1',
        workflowId: 'wf-1',
      });
    });
  });

  describe('resumeWorkflow', () => {
    it('should throw if execution not found', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue(null);

      await expect(service.resumeWorkflow('exec-missing')).rejects.toThrow(
        'Execution exec-missing not found',
      );
    });

    it('should throw if execution is not PAUSED', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue({
        id: 'exec-1',
        status: 'RUNNING',
        workflow: { definition: { nodes: [], edges: [] } },
        stepLogs: [],
      });

      await expect(service.resumeWorkflow('exec-1')).rejects.toThrow(
        'Can only resume paused executions',
      );
    });

    it('should resume from next step after lastCompletedNodeId', async () => {
      const nodes = [
        { id: 'trigger', data: { type: 'WEBHOOK', label: 'Trigger' } },
        { id: 'step-a', data: { type: 'HTTP_REQUEST', label: 'A', config: {} } },
        { id: 'step-b', data: { type: 'TRANSFORM', label: 'B', config: {} } },
      ];
      const edges = [
        { source: 'trigger', target: 'step-a' },
        { source: 'step-a', target: 'step-b' },
      ];

      // First call: the resume lookup (include workflow + stepLogs)
      prisma.workflowExecution.findUnique.mockResolvedValueOnce({
        id: 'exec-1',
        workflowId: 'wf-1',
        status: 'PAUSED',
        triggerData: { data: 'test' },
        lastCompletedNodeId: 'step-a',
        correlationId: null,
        startedAt: new Date('2024-01-01T00:00:00Z'),
        workflow: {
          id: 'wf-1',
          definition: { nodes, edges },
          errorConfig: null,
        },
        stepLogs: [
          { nodeId: 'step-a', output: { ok: true }, status: 'COMPLETED' },
        ],
      });

      // Pause check during resume loop — return RUNNING
      prisma.workflowExecution.findUnique.mockResolvedValue({ status: 'RUNNING' });

      prisma.workflowExecution.update.mockResolvedValue({});
      prisma.executionStepLog.create.mockResolvedValue({ id: 'step-log-2' });
      prisma.executionStepLog.update.mockResolvedValue({});
      mockHandlers.TRANSFORM.execute.mockResolvedValue({ result: 42 });

      const result = await service.resumeWorkflow('exec-1');

      expect(result).toBe('exec-1');
      // step-a was already completed, only step-b should execute
      expect(mockHandlers.HTTP_REQUEST.execute).not.toHaveBeenCalled();
      expect(mockHandlers.TRANSFORM.execute).toHaveBeenCalledTimes(1);
      // Status set to RUNNING during resume
      expect(prisma.workflowExecution.update).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        data: { status: 'RUNNING', resumedAt: expect.any(Date) },
      });
      // execution.resumed event emitted
      expect(eventEmitter.emit).toHaveBeenCalledWith('execution.resumed', {
        executionId: 'exec-1',
        workflowId: 'wf-1',
      });
    });
  });
});
