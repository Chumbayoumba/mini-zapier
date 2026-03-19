import { Test, TestingModule } from '@nestjs/testing';
import { CronService } from './cron.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import * as cron from 'node-cron';
import * as cronParser from 'cron-parser';

jest.mock('node-cron', () => ({
  validate: jest.fn().mockReturnValue(true),
  schedule: jest.fn().mockReturnValue({ stop: jest.fn() }),
}));

jest.mock('cron-parser', () => ({
  parseExpression: jest.fn(),
}));

describe('CronService', () => {
  let service: CronService;
  let prisma: jest.Mocked<PrismaService>;
  let queueService: jest.Mocked<QueueService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CronService,
        {
          provide: PrismaService,
          useValue: {
            trigger: {
              findMany: jest.fn().mockResolvedValue([]),
              update: jest.fn().mockResolvedValue({}),
            },
          },
        },
        {
          provide: QueueService,
          useValue: {
            addExecution: jest.fn().mockResolvedValue('job-1'),
          },
        },
      ],
    }).compile();

    service = module.get<CronService>(CronService);
    prisma = module.get(PrismaService);
    queueService = module.get(QueueService);

    jest.clearAllMocks();
    (cron.validate as jest.Mock).mockReturnValue(true);
    (cron.schedule as jest.Mock).mockReturnValue({ stop: jest.fn() });
  });

  describe('scheduleCron', () => {
    it('creates task with valid expression', () => {
      service.scheduleCron('t1', { cronExpression: '* * * * *' }, 'wf1');

      expect(cron.validate).toHaveBeenCalledWith('* * * * *');
      expect(cron.schedule).toHaveBeenCalled();
      expect((service as any).tasks.has('t1')).toBe(true);
    });

    it('passes timezone to cron.schedule options', () => {
      service.scheduleCron('t1', { cronExpression: '* * * * *', timezone: 'Europe/Moscow' }, 'wf1');

      expect(cron.schedule).toHaveBeenCalledWith(
        '* * * * *',
        expect.any(Function),
        { timezone: 'Europe/Moscow' },
      );
    });

    it('defaults to UTC when no timezone', () => {
      service.scheduleCron('t1', { cronExpression: '* * * * *' }, 'wf1');

      expect(cron.schedule).toHaveBeenCalledWith(
        '* * * * *',
        expect.any(Function),
        { timezone: 'UTC' },
      );
    });

    it('logs warning and returns on invalid expression', () => {
      (cron.validate as jest.Mock).mockReturnValue(false);

      service.scheduleCron('t1', { cronExpression: 'bad' }, 'wf1');

      expect(cron.schedule).not.toHaveBeenCalled();
      expect((service as any).tasks.has('t1')).toBe(false);
    });

    it('replaces existing task (stops old, creates new)', () => {
      const oldStop = jest.fn();
      (cron.schedule as jest.Mock).mockReturnValueOnce({ stop: oldStop });
      service.scheduleCron('t1', { cronExpression: '* * * * *' }, 'wf1');

      const newStop = jest.fn();
      (cron.schedule as jest.Mock).mockReturnValueOnce({ stop: newStop });
      service.scheduleCron('t1', { cronExpression: '*/5 * * * *' }, 'wf1');

      expect(oldStop).toHaveBeenCalled();
      expect((service as any).tasks.get('t1')).toEqual({ stop: newStop });
    });
  });

  describe('stopCron', () => {
    it('stops and removes task', () => {
      const stopFn = jest.fn();
      (cron.schedule as jest.Mock).mockReturnValue({ stop: stopFn });
      service.scheduleCron('t1', { cronExpression: '* * * * *' }, 'wf1');

      service.stopCron('t1');

      expect(stopFn).toHaveBeenCalled();
      expect((service as any).tasks.has('t1')).toBe(false);
    });
  });

  describe('onCronFire', () => {
    it('calls queueService.addExecution with correct args', async () => {
      await service.onCronFire('t1', 'wf1', '* * * * *');

      expect(queueService.addExecution).toHaveBeenCalledWith('wf1', {
        trigger: 'cron',
        scheduledAt: expect.any(String),
        cronExpression: '* * * * *',
      });
    });

    it('updates lastTriggeredAt', async () => {
      await service.onCronFire('t1', 'wf1', '* * * * *');

      expect(prisma.trigger.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { lastTriggeredAt: expect.any(Date) },
      });
    });

    it('catches errors and does not throw', async () => {
      queueService.addExecution.mockRejectedValueOnce(new Error('queue down'));

      await expect(service.onCronFire('t1', 'wf1', '* * * * *')).resolves.toBeUndefined();
    });
  });

  describe('recoverMissedJobs', () => {
    it('fires catch-up when nextFire is in the past', async () => {
      const pastDate = new Date(Date.now() - 3600_000);
      const missedFire = new Date(Date.now() - 1800_000);

      (cronParser.parseExpression as jest.Mock).mockReturnValue({
        next: () => ({ toDate: () => missedFire }),
      });

      await service.recoverMissedJobs({
        id: 't1',
        workflowId: 'wf1',
        lastTriggeredAt: pastDate,
        config: { cronExpression: '*/30 * * * *' },
      });

      expect(queueService.addExecution).toHaveBeenCalledWith('wf1', {
        trigger: 'cron',
        scheduledAt: missedFire.toISOString(),
        recovered: true,
      });
      expect(prisma.trigger.update).toHaveBeenCalled();
    });

    it('does NOT fire if no lastTriggeredAt', async () => {
      await service.recoverMissedJobs({
        id: 't1',
        workflowId: 'wf1',
        lastTriggeredAt: null,
        config: { cronExpression: '* * * * *' },
      });

      expect(queueService.addExecution).not.toHaveBeenCalled();
    });

    it('does NOT fire if nextFire is in the future', async () => {
      const futureDate = new Date(Date.now() + 3600_000);

      (cronParser.parseExpression as jest.Mock).mockReturnValue({
        next: () => ({ toDate: () => futureDate }),
      });

      await service.recoverMissedJobs({
        id: 't1',
        workflowId: 'wf1',
        lastTriggeredAt: new Date(),
        config: { cronExpression: '0 * * * *' },
      });

      expect(queueService.addExecution).not.toHaveBeenCalled();
    });
  });

  describe('loadActiveCronTriggers', () => {
    it('loads triggers and schedules each', async () => {
      const triggers = [
        {
          id: 't1',
          workflowId: 'wf1',
          config: { cronExpression: '* * * * *' },
          lastTriggeredAt: null,
        },
        {
          id: 't2',
          workflowId: 'wf2',
          config: { cronExpression: '*/5 * * * *' },
          lastTriggeredAt: null,
        },
      ];
      (prisma.trigger.findMany as jest.Mock).mockResolvedValue(triggers);

      await service.loadActiveCronTriggers();

      expect(cron.schedule).toHaveBeenCalledTimes(2);
    });
  });

  describe('onModuleDestroy', () => {
    it('stops all tasks', () => {
      const stop1 = jest.fn();
      const stop2 = jest.fn();
      (cron.schedule as jest.Mock)
        .mockReturnValueOnce({ stop: stop1 })
        .mockReturnValueOnce({ stop: stop2 });

      service.scheduleCron('t1', { cronExpression: '* * * * *' }, 'wf1');
      service.scheduleCron('t2', { cronExpression: '*/5 * * * *' }, 'wf2');

      service.onModuleDestroy();

      expect(stop1).toHaveBeenCalled();
      expect(stop2).toHaveBeenCalled();
      expect((service as any).tasks.size).toBe(0);
    });
  });
});
