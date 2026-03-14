import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EngineService } from '../../engine/engine.service';

describe('WebhookService', () => {
  let service: WebhookService;
  let prisma: Record<string, any>;
  let engineService: jest.Mocked<Pick<EngineService, 'executeWorkflow'>>;

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

    engineService = {
      executeWorkflow: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: PrismaService, useValue: prisma },
        { provide: EngineService, useValue: engineService },
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
      engineService.executeWorkflow.mockResolvedValue('exec-1');
      prisma.trigger.update.mockResolvedValue({});

      const result = await service.processWebhook('valid-token', body, headers);

      expect(result).toEqual({ executionId: 'exec-1', status: 'triggered' });
      expect(prisma.trigger.findUnique).toHaveBeenCalledWith({
        where: { webhookToken: 'valid-token' },
        include: { workflow: true },
      });
      expect(engineService.executeWorkflow).toHaveBeenCalledWith('wf-1', {
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

    it('should pass body and headers to engine service', async () => {
      prisma.trigger.findUnique.mockResolvedValue(mockTrigger);
      engineService.executeWorkflow.mockResolvedValue('exec-2');
      prisma.trigger.update.mockResolvedValue({});

      const customBody = { data: [1, 2, 3] };
      const customHeaders = { authorization: 'Bearer xyz' };

      await service.processWebhook('valid-token', customBody, customHeaders);

      expect(engineService.executeWorkflow).toHaveBeenCalledWith('wf-1', {
        body: customBody,
        headers: customHeaders,
        receivedAt: expect.any(String),
      });
    });

    it('should update lastTriggeredAt after successful execution', async () => {
      prisma.trigger.findUnique.mockResolvedValue(mockTrigger);
      engineService.executeWorkflow.mockResolvedValue('exec-3');
      prisma.trigger.update.mockResolvedValue({});

      await service.processWebhook('valid-token', body, headers);

      expect(prisma.trigger.update).toHaveBeenCalledWith({
        where: { id: 'trigger-1' },
        data: { lastTriggeredAt: expect.any(Date) },
      });
    });
  });
});
