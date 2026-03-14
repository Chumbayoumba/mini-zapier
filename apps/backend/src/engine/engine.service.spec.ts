import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EngineService } from './engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { HttpRequestAction } from './actions/http-request.action';
import { EmailAction } from './actions/email.action';
import { TelegramAction } from './actions/telegram.action';
import { DatabaseAction } from './actions/database.action';
import { TransformAction } from './actions/transform.action';

describe('EngineService', () => {
  let service: EngineService;
  let prisma: Record<string, any>;
  let eventEmitter: jest.Mocked<Pick<EventEmitter2, 'emit'>>;
  let httpAction: jest.Mocked<Pick<HttpRequestAction, 'execute'>>;
  let emailAction: jest.Mocked<Pick<EmailAction, 'execute'>>;
  let telegramAction: jest.Mocked<Pick<TelegramAction, 'execute'>>;
  let dbAction: jest.Mocked<Pick<DatabaseAction, 'execute'>>;
  let transformAction: jest.Mocked<Pick<TransformAction, 'execute'>>;

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

  const makeWorkflow = (nodes: any[], edges: any[]) => ({
    id: 'wf-1',
    name: 'Test Workflow',
    definition: { nodes, edges },
    userId: 'user-1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    prisma = {
      workflow: { findUnique: jest.fn() },
      workflowExecution: { create: jest.fn(), update: jest.fn() },
      executionStepLog: { create: jest.fn(), update: jest.fn() },
    };

    eventEmitter = { emit: jest.fn() };
    httpAction = { execute: jest.fn() };
    emailAction = { execute: jest.fn() };
    telegramAction = { execute: jest.fn() };
    dbAction = { execute: jest.fn() };
    transformAction = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EngineService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: HttpRequestAction, useValue: httpAction },
        { provide: EmailAction, useValue: emailAction },
        { provide: TelegramAction, useValue: telegramAction },
        { provide: DatabaseAction, useValue: dbAction },
        { provide: TransformAction, useValue: transformAction },
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
      expect(httpAction.execute).not.toHaveBeenCalled();
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
      httpAction.execute.mockResolvedValue({ status: 200, body: 'ok' });

      await service.executeWorkflow('wf-1', { some: 'data' });

      expect(httpAction.execute).toHaveBeenCalledWith(
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
      transformAction.execute.mockResolvedValue({ result: 42 });

      await service.executeWorkflow('wf-1');

      expect(transformAction.execute).toHaveBeenCalled();
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
      httpAction.execute.mockResolvedValue({});

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
      emailAction.execute.mockResolvedValue({ sent: true });

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
      httpAction.execute.mockRejectedValue(new Error('Network error'));

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
      telegramAction.execute.mockRejectedValue(new Error('TG API down'));

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

      httpAction.execute.mockImplementation(async () => {
        callOrder.push('HTTP_REQUEST');
        return { ok: true };
      });
      transformAction.execute.mockImplementation(async () => {
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
});
