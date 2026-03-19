jest.mock('imap', () => jest.fn());

import { Test, TestingModule } from '@nestjs/testing';
import { EmailTriggerService } from './email-trigger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';

const makeTrigger = (overrides: Record<string, any> = {}) => ({
  id: 'trig-1',
  type: 'EMAIL',
  isActive: true,
  workflowId: 'wf-1',
  config: {
    imapHost: 'imap.test.com',
    imapUser: 'user@test.com',
    imapPassword: 'secret',
    imapPort: 993,
  },
  workflow: { id: 'wf-1', status: 'ACTIVE' },
  ...overrides,
});

describe('EmailTriggerService', () => {
  let service: EmailTriggerService;
  let prisma: any;
  let queueService: any;

  beforeEach(async () => {
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailTriggerService,
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
          useValue: { addExecution: jest.fn().mockResolvedValue('job-1') },
        },
      ],
    }).compile();

    service = module.get(EmailTriggerService);
    prisma = module.get(PrismaService);
    queueService = module.get(QueueService);

    // Prevent actual polling in tests
    service.stopPolling();
  });

  afterEach(() => {
    service.stopPolling();
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startPolling / stopPolling', () => {
    it('startPolling sets an interval that can be cleared by stopPolling', () => {
      const spy = jest.spyOn(global, 'setInterval');
      service.startPolling(30_000);
      expect(spy).toHaveBeenCalledWith(expect.any(Function), 30_000);
      service.stopPolling();
      // calling stopPolling again should be safe
      service.stopPolling();
    });
  });

  describe('checkEmails', () => {
    it('loads active EMAIL triggers from DB', async () => {
      prisma.trigger.findMany.mockResolvedValue([]);
      await service.checkEmails();
      expect(prisma.trigger.findMany).toHaveBeenCalledWith({
        where: { type: 'EMAIL', isActive: true },
        include: { workflow: true },
      });
    });

    it('skips triggers with missing IMAP config', async () => {
      prisma.trigger.findMany.mockResolvedValue([
        makeTrigger({ config: { imapHost: 'host' } }), // missing user & password
      ]);
      const spy = jest.spyOn(service, 'fetchNewEmails');
      await service.checkEmails();
      expect(spy).not.toHaveBeenCalled();
    });

    it('skips triggers whose workflow is not ACTIVE', async () => {
      prisma.trigger.findMany.mockResolvedValue([
        makeTrigger({ workflow: { id: 'wf-1', status: 'DRAFT' } }),
      ]);
      const spy = jest.spyOn(service, 'fetchNewEmails');
      await service.checkEmails();
      expect(spy).not.toHaveBeenCalled();
    });

    it('calls queueService.addExecution for each email found', async () => {
      const trigger = makeTrigger();
      prisma.trigger.findMany.mockResolvedValue([trigger]);
      jest.spyOn(service, 'fetchNewEmails').mockResolvedValue([
        { from: 'a@b.com', subject: 'Hello', date: '2024-01-01', body: 'test' },
        { from: 'c@d.com', subject: 'World', date: '2024-01-02', body: 'test2' },
      ]);

      await service.checkEmails();

      expect(queueService.addExecution).toHaveBeenCalledTimes(2);
      expect(queueService.addExecution).toHaveBeenCalledWith('wf-1', {
        from: 'a@b.com',
        subject: 'Hello',
        date: '2024-01-01',
        body: 'test',
        trigger: 'email',
      });
    });

    it('filters emails by subject filter (case-insensitive)', async () => {
      const trigger = makeTrigger({
        config: {
          imapHost: 'imap.test.com',
          imapUser: 'user@test.com',
          imapPassword: 'secret',
          filter: 'order',
        },
      });
      prisma.trigger.findMany.mockResolvedValue([trigger]);
      jest.spyOn(service, 'fetchNewEmails').mockResolvedValue([
        { from: 'a@b.com', subject: 'Order #123', date: '2024-01-01', body: 'matched' },
        { from: 'c@d.com', subject: 'Newsletter', date: '2024-01-02', body: 'skipped' },
      ]);

      await service.checkEmails();

      expect(queueService.addExecution).toHaveBeenCalledTimes(1);
      expect(queueService.addExecution).toHaveBeenCalledWith(
        'wf-1',
        expect.objectContaining({ subject: 'Order #123' }),
      );
    });

    it('also accepts subjectFilter as alias for filter', async () => {
      const trigger = makeTrigger({
        config: {
          imapHost: 'imap.test.com',
          imapUser: 'user@test.com',
          imapPassword: 'secret',
          subjectFilter: 'alert',
        },
      });
      prisma.trigger.findMany.mockResolvedValue([trigger]);
      jest.spyOn(service, 'fetchNewEmails').mockResolvedValue([
        { from: 'a@b.com', subject: 'ALERT: server down', date: '2024-01-01', body: 'yes' },
        { from: 'c@d.com', subject: 'Hello', date: '2024-01-02', body: 'no' },
      ]);

      await service.checkEmails();
      expect(queueService.addExecution).toHaveBeenCalledTimes(1);
    });

    it('updates lastTriggeredAt after processing emails', async () => {
      prisma.trigger.findMany.mockResolvedValue([makeTrigger()]);
      jest.spyOn(service, 'fetchNewEmails').mockResolvedValue([
        { from: 'a@b.com', subject: 'Test', date: '2024-01-01', body: 'body' },
      ]);

      await service.checkEmails();

      expect(prisma.trigger.update).toHaveBeenCalledWith({
        where: { id: 'trig-1' },
        data: { lastTriggeredAt: expect.any(Date) },
      });
    });

    it('does NOT update lastTriggeredAt when no emails match', async () => {
      prisma.trigger.findMany.mockResolvedValue([
        makeTrigger({
          config: {
            imapHost: 'h',
            imapUser: 'u',
            imapPassword: 'p',
            filter: 'xyz-no-match',
          },
        }),
      ]);
      jest.spyOn(service, 'fetchNewEmails').mockResolvedValue([
        { from: 'a@b.com', subject: 'Test', date: '2024-01-01', body: 'body' },
      ]);

      await service.checkEmails();
      expect(prisma.trigger.update).not.toHaveBeenCalled();
    });

    it('catches errors per trigger without crashing the loop', async () => {
      const t1 = makeTrigger({ id: 'trig-1' });
      const t2 = makeTrigger({ id: 'trig-2', workflowId: 'wf-2' });
      prisma.trigger.findMany.mockResolvedValue([t1, t2]);

      jest
        .spyOn(service, 'fetchNewEmails')
        .mockRejectedValueOnce(new Error('IMAP connect failed'))
        .mockResolvedValueOnce([
          { from: 'ok@ok.com', subject: 'OK', date: '2024-01-01', body: 'ok' },
        ]);

      await service.checkEmails();

      // Second trigger should still have been processed
      expect(queueService.addExecution).toHaveBeenCalledTimes(1);
      expect(queueService.addExecution).toHaveBeenCalledWith(
        'wf-2',
        expect.objectContaining({ subject: 'OK' }),
      );
    });
  });
});
