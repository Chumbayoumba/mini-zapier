import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';

describe('WebhookService', () => {
  let service: WebhookService;
  let prisma: Record<string, any>;
  let queueService: jest.Mocked<Pick<QueueService, 'addExecution'>>;

  const mockTrigger = {
    id: 'trigger-1',
    workflowId: 'wf-1',
    webhookToken: 'valid-token',
    lastTriggeredAt: null,
    workflow: {
      id: 'wf-1',
      status: 'ACTIVE',
      name: 'Test Workflow',
    },
  };

  beforeEach(async () => {
    prisma = {
      trigger: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    queueService = {
      addExecution: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: PrismaService, useValue: prisma },
        { provide: QueueService, useValue: queueService },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processWebhook', () => {
    const body = { key: 'value' };
    const headers = { 'content-type': 'application/json' };

    it('should process webhook with valid token and active workflow', async () => {
      prisma.trigger.findUnique.mockResolvedValue(mockTrigger);
      queueService.addExecution.mockResolvedValue('job-1');
      prisma.trigger.update.mockResolvedValue({});

      const result = await service.processWebhook('valid-token', body, headers);

      expect(result).toEqual({ jobId: 'job-1', status: 'triggered' });
      expect(prisma.trigger.findUnique).toHaveBeenCalledWith({
        where: { webhookToken: 'valid-token' },
        include: { workflow: true },
      });
      expect(queueService.addExecution).toHaveBeenCalledWith('wf-1', {
        body,
        headers,
        receivedAt: expect.any(String),
      });
      expect(prisma.trigger.update).toHaveBeenCalledWith({
        where: { id: 'trigger-1' },
        data: { lastTriggeredAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException for invalid token', async () => {
      prisma.trigger.findUnique.mockResolvedValue(null);

      await expect(
        service.processWebhook('invalid-token', body, headers),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for inactive workflow', async () => {
      const inactiveTrigger = {
        ...mockTrigger,
        workflow: { ...mockTrigger.workflow, status: 'DRAFT' },
      };
      prisma.trigger.findUnique.mockResolvedValue(inactiveTrigger);

      await expect(
        service.processWebhook('valid-token', body, headers),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for paused workflow', async () => {
      const pausedTrigger = {
        ...mockTrigger,
        workflow: { ...mockTrigger.workflow, status: 'PAUSED' },
      };
      prisma.trigger.findUnique.mockResolvedValue(pausedTrigger);

      await expect(
        service.processWebhook('valid-token', body, headers),
      ).rejects.toThrow(NotFoundException);
    });

    it('should pass body and headers to queue service', async () => {
      prisma.trigger.findUnique.mockResolvedValue(mockTrigger);
      queueService.addExecution.mockResolvedValue('job-2');
      prisma.trigger.update.mockResolvedValue({});

      const customBody = { data: [1, 2, 3] };
      const customHeaders = { authorization: 'Bearer xyz' };

      await service.processWebhook('valid-token', customBody, customHeaders);

      expect(queueService.addExecution).toHaveBeenCalledWith('wf-1', {
        body: customBody,
        headers: customHeaders,
        receivedAt: expect.any(String),
      });
    });

    it('should update lastTriggeredAt after successful execution', async () => {
      prisma.trigger.findUnique.mockResolvedValue(mockTrigger);
      queueService.addExecution.mockResolvedValue('job-3');
      prisma.trigger.update.mockResolvedValue({});

      await service.processWebhook('valid-token', body, headers);

      expect(prisma.trigger.update).toHaveBeenCalledWith({
        where: { id: 'trigger-1' },
        data: { lastTriggeredAt: expect.any(Date) },
      });
    });
  });
});
