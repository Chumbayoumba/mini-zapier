import { Test, TestingModule } from '@nestjs/testing';
import { TriggersService } from './triggers.service';
import { PrismaService } from '../prisma/prisma.service';
import { CronService } from './cron/cron.service';

describe('TriggersService', () => {
  let service: TriggersService;
  let prisma: any;
  let cronService: any;

  const makeWorkflow = (type: string, config: any = {}) => ({
    id: 'wf-1',
    status: 'ACTIVE',
    definition: {
      nodes: [
        { type: 'triggerNode', data: { type, config } },
        { type: 'actionNode', data: {} },
      ],
    },
  });

  const noTriggerWorkflow = {
    id: 'wf-1',
    status: 'ACTIVE',
    definition: {
      nodes: [{ type: 'actionNode', data: {} }],
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TriggersService,
        {
          provide: PrismaService,
          useValue: {
            workflow: { findUnique: jest.fn() },
            trigger: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
          },
        },
        {
          provide: CronService,
          useValue: { scheduleCron: jest.fn(), stopCron: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(TriggersService);
    prisma = module.get(PrismaService);
    cronService = module.get(CronService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleActivated', () => {
    it('should create Trigger record when workflow has trigger node', async () => {
      prisma.workflow.findUnique.mockResolvedValue(makeWorkflow('WEBHOOK'));
      prisma.trigger.upsert.mockResolvedValue({ id: 'trig-1', type: 'WEBHOOK' });

      await service.handleActivated({ workflowId: 'wf-1' });

      expect(prisma.trigger.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workflowId: 'wf-1' },
          create: expect.objectContaining({
            workflowId: 'wf-1',
            type: 'WEBHOOK',
            isActive: true,
          }),
          update: expect.objectContaining({
            type: 'WEBHOOK',
            isActive: true,
          }),
        }),
      );
    });

    it('should generate webhookToken for WEBHOOK type only', async () => {
      prisma.workflow.findUnique.mockResolvedValue(makeWorkflow('WEBHOOK'));
      prisma.trigger.upsert.mockResolvedValue({ id: 'trig-1', type: 'WEBHOOK' });

      await service.handleActivated({ workflowId: 'wf-1' });

      const call = prisma.trigger.upsert.mock.calls[0][0];
      expect(call.create.webhookToken).toEqual(expect.any(String));
      expect(call.create.webhookToken).toHaveLength(36); // UUID format
    });

    it('should NOT generate webhookToken for CRON type', async () => {
      const cronConfig = { cronExpression: '* * * * *' };
      prisma.workflow.findUnique.mockResolvedValue(makeWorkflow('CRON', cronConfig));
      prisma.trigger.upsert.mockResolvedValue({ id: 'trig-1', type: 'CRON' });

      await service.handleActivated({ workflowId: 'wf-1' });

      const call = prisma.trigger.upsert.mock.calls[0][0];
      expect(call.create.webhookToken).toBeNull();
    });

    it('should NOT generate webhookToken for EMAIL type', async () => {
      prisma.workflow.findUnique.mockResolvedValue(makeWorkflow('EMAIL'));
      prisma.trigger.upsert.mockResolvedValue({ id: 'trig-1', type: 'EMAIL' });

      await service.handleActivated({ workflowId: 'wf-1' });

      const call = prisma.trigger.upsert.mock.calls[0][0];
      expect(call.create.webhookToken).toBeNull();
    });

    it('should upsert if trigger record already exists', async () => {
      prisma.workflow.findUnique.mockResolvedValue(makeWorkflow('WEBHOOK'));
      prisma.trigger.upsert.mockResolvedValue({ id: 'trig-1', type: 'WEBHOOK' });

      await service.handleActivated({ workflowId: 'wf-1' });

      expect(prisma.trigger.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workflowId: 'wf-1' },
          update: expect.objectContaining({ type: 'WEBHOOK', isActive: true }),
        }),
      );
    });

    it('should call cronService.scheduleCron for CRON type', async () => {
      const cronConfig = { cronExpression: '0 * * * *' };
      prisma.workflow.findUnique.mockResolvedValue(makeWorkflow('CRON', cronConfig));
      prisma.trigger.upsert.mockResolvedValue({ id: 'trig-1', type: 'CRON' });

      await service.handleActivated({ workflowId: 'wf-1' });

      expect(cronService.scheduleCron).toHaveBeenCalledWith('trig-1', cronConfig, 'wf-1');
    });

    it('should skip if no trigger node in definition', async () => {
      prisma.workflow.findUnique.mockResolvedValue(noTriggerWorkflow);

      await service.handleActivated({ workflowId: 'wf-1' });

      expect(prisma.trigger.upsert).not.toHaveBeenCalled();
    });

    it('should skip if workflow not found', async () => {
      prisma.workflow.findUnique.mockResolvedValue(null);

      await service.handleActivated({ workflowId: 'wf-1' });

      expect(prisma.trigger.upsert).not.toHaveBeenCalled();
    });
  });

  describe('handleDeactivated', () => {
    it('should set isActive=false', async () => {
      prisma.trigger.findUnique.mockResolvedValue({ id: 'trig-1', type: 'WEBHOOK', workflowId: 'wf-1' });
      prisma.trigger.update.mockResolvedValue({});

      await service.handleDeactivated({ workflowId: 'wf-1' });

      expect(prisma.trigger.update).toHaveBeenCalledWith({
        where: { workflowId: 'wf-1' },
        data: { isActive: false },
      });
    });

    it('should call cronService.stopCron for CRON type', async () => {
      prisma.trigger.findUnique.mockResolvedValue({ id: 'trig-1', type: 'CRON', workflowId: 'wf-1' });
      prisma.trigger.update.mockResolvedValue({});

      await service.handleDeactivated({ workflowId: 'wf-1' });

      expect(cronService.stopCron).toHaveBeenCalledWith('trig-1');
    });

    it('should not call stopCron for non-CRON type', async () => {
      prisma.trigger.findUnique.mockResolvedValue({ id: 'trig-1', type: 'WEBHOOK', workflowId: 'wf-1' });
      prisma.trigger.update.mockResolvedValue({});

      await service.handleDeactivated({ workflowId: 'wf-1' });

      expect(cronService.stopCron).not.toHaveBeenCalled();
    });

    it('should be no-op if no trigger exists', async () => {
      prisma.trigger.findUnique.mockResolvedValue(null);

      await service.handleDeactivated({ workflowId: 'wf-1' });

      expect(prisma.trigger.update).not.toHaveBeenCalled();
      expect(cronService.stopCron).not.toHaveBeenCalled();
    });
  });

  describe('handleUpdated', () => {
    it('should re-sync config when trigger node changes', async () => {
      const newConfig = { cronExpression: '0 0 * * *' };
      prisma.workflow.findUnique.mockResolvedValue(makeWorkflow('WEBHOOK', newConfig));
      prisma.trigger.findUnique.mockResolvedValue({
        id: 'trig-1',
        type: 'WEBHOOK',
        workflowId: 'wf-1',
        isActive: true,
      });
      prisma.trigger.update.mockResolvedValue({});

      await service.handleUpdated({ workflowId: 'wf-1' });

      expect(prisma.trigger.update).toHaveBeenCalledWith({
        where: { workflowId: 'wf-1' },
        data: { type: 'WEBHOOK', config: newConfig },
      });
    });

    it('should reschedule cron (stop old, start new)', async () => {
      const newConfig = { cronExpression: '0 0 * * *' };
      prisma.workflow.findUnique.mockResolvedValue(makeWorkflow('CRON', newConfig));
      prisma.trigger.findUnique.mockResolvedValue({
        id: 'trig-1',
        type: 'CRON',
        workflowId: 'wf-1',
        isActive: true,
      });
      prisma.trigger.update.mockResolvedValue({});

      await service.handleUpdated({ workflowId: 'wf-1' });

      expect(cronService.stopCron).toHaveBeenCalledWith('trig-1');
      expect(cronService.scheduleCron).toHaveBeenCalledWith('trig-1', newConfig, 'wf-1');
    });

    it('should stop cron if type changed from CRON to WEBHOOK', async () => {
      prisma.workflow.findUnique.mockResolvedValue(makeWorkflow('WEBHOOK'));
      prisma.trigger.findUnique.mockResolvedValue({
        id: 'trig-1',
        type: 'CRON',
        workflowId: 'wf-1',
        isActive: true,
      });
      prisma.trigger.update.mockResolvedValue({});

      await service.handleUpdated({ workflowId: 'wf-1' });

      expect(cronService.stopCron).toHaveBeenCalledWith('trig-1');
      expect(cronService.scheduleCron).not.toHaveBeenCalled();
    });

    it('should skip if workflow not found', async () => {
      prisma.workflow.findUnique.mockResolvedValue(null);

      await service.handleUpdated({ workflowId: 'wf-1' });

      expect(prisma.trigger.findUnique).not.toHaveBeenCalled();
    });

    it('should skip if no trigger node in definition', async () => {
      prisma.workflow.findUnique.mockResolvedValue(noTriggerWorkflow);

      await service.handleUpdated({ workflowId: 'wf-1' });

      expect(prisma.trigger.findUnique).not.toHaveBeenCalled();
    });

    it('should skip if no trigger record exists', async () => {
      prisma.workflow.findUnique.mockResolvedValue(makeWorkflow('WEBHOOK'));
      prisma.trigger.findUnique.mockResolvedValue(null);

      await service.handleUpdated({ workflowId: 'wf-1' });

      expect(prisma.trigger.update).not.toHaveBeenCalled();
    });
  });
});
