import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { PrismaService } from '../prisma/prisma.service';

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let prisma: Record<string, any>;

  const mockIntegration = {
    id: 'int-1',
    userId: 'user-1',
    type: 'TELEGRAM',
    name: 'My Bot',
    config: { botToken: 'abc123456789xyz' },
    metadata: {},
    webhookSecret: 'secret-hex-value',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    prisma = {
      integration: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<IntegrationsService>(IntegrationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── CRUD ─────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return integrations with sanitized config', async () => {
      prisma.integration.findMany.mockResolvedValue([mockIntegration]);

      const result = await service.findAll('user-1');

      expect(prisma.integration.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
      // botToken should be masked
      expect(result[0].config.botToken).not.toBe('abc123456789xyz');
      expect(result[0].config.botToken).toContain('••••');
    });

    it('should return empty array when no integrations', async () => {
      prisma.integration.findMany.mockResolvedValue([]);

      const result = await service.findAll('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create integration with webhook secret', async () => {
      prisma.integration.create.mockResolvedValue(mockIntegration);

      const result = await service.create('user-1', {
        type: 'TELEGRAM',
        name: 'My Bot',
        config: { botToken: 'abc123456789xyz' },
      });

      expect(prisma.integration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          type: 'TELEGRAM',
          name: 'My Bot',
          webhookSecret: expect.any(String),
        }),
      });
      // Config should be sanitized in response
      expect(result.config.botToken).toContain('••••');
    });
  });

  describe('remove', () => {
    it('should delete owned integration', async () => {
      prisma.integration.findUnique.mockResolvedValue(mockIntegration);
      prisma.integration.delete.mockResolvedValue(mockIntegration);

      const result = await service.remove('user-1', 'int-1');

      expect(prisma.integration.delete).toHaveBeenCalledWith({ where: { id: 'int-1' } });
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException when integration not found', async () => {
      prisma.integration.findUnique.mockResolvedValue(null);

      await expect(service.remove('user-1', 'nope')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own integration', async () => {
      prisma.integration.findUnique.mockResolvedValue({
        ...mockIntegration,
        userId: 'other-user',
      });

      await expect(service.remove('user-1', 'int-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findById', () => {
    it('should return integration by id', async () => {
      prisma.integration.findUnique.mockResolvedValue(mockIntegration);

      const result = await service.findById('int-1');

      expect(prisma.integration.findUnique).toHaveBeenCalledWith({ where: { id: 'int-1' } });
      expect(result).toEqual(mockIntegration);
    });

    it('should return null for non-existent id', async () => {
      prisma.integration.findUnique.mockResolvedValue(null);

      const result = await service.findById('nope');

      expect(result).toBeNull();
    });
  });

  describe('findByWebhookSecret', () => {
    it('should return integration by webhook secret', async () => {
      prisma.integration.findUnique.mockResolvedValue(mockIntegration);

      const result = await service.findByWebhookSecret('secret-hex-value');

      expect(prisma.integration.findUnique).toHaveBeenCalledWith({
        where: { webhookSecret: 'secret-hex-value' },
      });
      expect(result).toEqual(mockIntegration);
    });
  });

  // ─── Verify Methods ───────────────────────────────────────────

  describe('verifyWebhook', () => {
    it('should generate webhook URL and secret', async () => {
      const result = await service.verifyWebhook({ name: 'My Webhook' });

      expect(result.ok).toBe(true);
      expect(result.webhookUrl).toContain('/api/webhooks/');
      expect(result.secret).toHaveLength(64); // 32 bytes hex
    });

    it('should use provided URL if given', async () => {
      const result = await service.verifyWebhook({
        name: 'My Webhook',
        url: 'https://example.com/hook',
      });

      expect(result.ok).toBe(true);
      expect(result.webhookUrl).toBe('https://example.com/hook');
    });
  });

  // ─── sanitizeConfig ───────────────────────────────────────────

  describe('sanitizeConfig (via findAll)', () => {
    it('should mask botToken', async () => {
      prisma.integration.findMany.mockResolvedValue([{
        ...mockIntegration,
        config: { botToken: '1234567890:ABCdefGHIjklMNOpqrSTU' },
      }]);

      const result = await service.findAll('user-1');

      expect(result[0].config.botToken).toBe('1234••••rSTU');
    });

    it('should mask password', async () => {
      prisma.integration.findMany.mockResolvedValue([{
        ...mockIntegration,
        config: { password: 'supersecretpassword123' },
      }]);

      const result = await service.findAll('user-1');

      expect(result[0].config.password).toBe('supe••••d123');
    });

    it('should mask connectionString', async () => {
      prisma.integration.findMany.mockResolvedValue([{
        ...mockIntegration,
        config: { connectionString: 'postgresql://user:pass@host:5432/db' },
      }]);

      const result = await service.findAll('user-1');

      expect(result[0].config.connectionString).toContain('••••');
    });

    it('should mask short secrets completely', async () => {
      prisma.integration.findMany.mockResolvedValue([{
        ...mockIntegration,
        config: { apiKey: 'short' },
      }]);

      const result = await service.findAll('user-1');

      expect(result[0].config.apiKey).toBe('••••••••');
    });

    it('should mask header values for HTTP_API type', async () => {
      prisma.integration.findMany.mockResolvedValue([{
        ...mockIntegration,
        config: {
          baseUrl: 'https://api.example.com',
          headers: {
            Authorization: 'Bearer sk-1234567890abcdef',
            'X-API-Key': 'my-secret-api-key-value',
          },
        },
      }]);

      const result = await service.findAll('user-1');

      expect(result[0].config.headers.Authorization).toContain('••••');
      expect(result[0].config.headers['X-API-Key']).toContain('••••');
      expect(result[0].config.headers.Authorization).not.toBe('Bearer sk-1234567890abcdef');
    });

    it('should handle null config', async () => {
      prisma.integration.findMany.mockResolvedValue([{
        ...mockIntegration,
        config: null,
      }]);

      const result = await service.findAll('user-1');

      expect(result[0].config).toEqual({});
    });

    it('should not modify non-sensitive keys', async () => {
      prisma.integration.findMany.mockResolvedValue([{
        ...mockIntegration,
        config: { host: 'smtp.gmail.com', port: 587 },
      }]);

      const result = await service.findAll('user-1');

      expect(result[0].config.host).toBe('smtp.gmail.com');
      expect(result[0].config.port).toBe(587);
    });
  });
});
