import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

describe('WebhookController', () => {
  let controller: WebhookController;
  let webhookService: jest.Mocked<Pick<WebhookService, 'processWebhook'>>;

  beforeEach(async () => {
    webhookService = {
      processWebhook: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [{ provide: WebhookService, useValue: webhookService }],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleWebhook', () => {
    it('should call processWebhook with token, body and headers', async () => {
      const token = 'abc-123';
      const body = { event: 'push', data: { id: 1 } };
      const headers = { 'content-type': 'application/json', 'x-custom': 'value' };
      const expected = { executionId: 'exec-1', status: 'triggered' };

      webhookService.processWebhook.mockResolvedValue(expected);

      const result = await controller.handleWebhook(token, body, headers);

      expect(result).toEqual(expected);
      expect(webhookService.processWebhook).toHaveBeenCalledWith(token, body, headers);
    });

    it('should pass empty body correctly', async () => {
      webhookService.processWebhook.mockResolvedValue({
        executionId: 'exec-2',
        status: 'triggered',
      });

      await controller.handleWebhook('token-1', {}, {});

      expect(webhookService.processWebhook).toHaveBeenCalledWith('token-1', {}, {});
    });

    it('should propagate service errors', async () => {
      webhookService.processWebhook.mockRejectedValue(new Error('Not found'));

      await expect(
        controller.handleWebhook('bad-token', {}, {}),
      ).rejects.toThrow('Not found');
    });

    it('should pass complex body with nested data', async () => {
      const complexBody = {
        action: 'created',
        payload: { items: [{ id: 1 }, { id: 2 }] },
        metadata: { source: 'github' },
      };
      webhookService.processWebhook.mockResolvedValue({
        executionId: 'exec-3',
        status: 'triggered',
      });

      await controller.handleWebhook('token-2', complexBody, { host: 'localhost' });

      expect(webhookService.processWebhook).toHaveBeenCalledWith(
        'token-2',
        complexBody,
        { host: 'localhost' },
      );
    });
  });
});
