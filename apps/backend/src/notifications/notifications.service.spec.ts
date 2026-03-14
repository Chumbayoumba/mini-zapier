import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: Record<string, any>;
  let eventEmitter: { emit: jest.Mock };
  let configService: { get: jest.Mock };

  const mockOwner = { id: 'user-1', email: 'user@test.com', name: 'Test User' };

  const mockExecution = {
    id: 'exec-1',
    workflowId: 'wf-1',
    workflow: {
      name: 'Test Workflow',
      errorConfig: null, // Uses defaults
      user: mockOwner,
    },
  };

  beforeEach(async () => {
    prisma = {
      workflowExecution: {
        findUnique: jest.fn(),
      },
    };

    eventEmitter = { emit: jest.fn() };

    configService = {
      get: jest.fn((key: string) => {
        // Return empty for all external service configs
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleExecutionFailed', () => {
    it('should emit notification.send event for in-app notification (default config)', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue(mockExecution);

      await service.handleExecutionFailed({
        executionId: 'exec-1',
        workflowId: 'wf-1',
        error: 'Test error',
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', {
        userId: 'user-1',
        event: 'execution:failed',
        data: expect.objectContaining({
          executionId: 'exec-1',
          workflowName: 'Test Workflow',
          error: 'Test error',
        }),
      });
    });

    it('should not emit in-app notification when disabled in errorConfig', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue({
        ...mockExecution,
        workflow: {
          ...mockExecution.workflow,
          errorConfig: {
            retry: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 30000, jitter: true },
            notifications: { inApp: false, email: false },
          },
        },
      });

      await service.handleExecutionFailed({
        executionId: 'exec-1',
        workflowId: 'wf-1',
        error: 'Test error',
      });

      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        'notification.send',
        expect.anything(),
      );
    });

    it('should do nothing if execution is not found', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue(null);

      await service.handleExecutionFailed({
        executionId: 'nonexistent',
        workflowId: 'wf-1',
        error: 'Test error',
      });

      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        'notification.send',
        expect.anything(),
      );
    });

    it('should include workflowId in notification data', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue(mockExecution);

      await service.handleExecutionFailed({
        executionId: 'exec-1',
        workflowId: 'wf-1',
        error: 'Something broke',
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', {
        userId: 'user-1',
        event: 'execution:failed',
        data: expect.objectContaining({
          workflowId: 'wf-1',
        }),
      });
    });

    it('should send email to configured emailAddress when email notification is enabled', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue({
        ...mockExecution,
        workflow: {
          ...mockExecution.workflow,
          errorConfig: {
            retry: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 30000, jitter: true },
            notifications: { inApp: true, email: true, emailAddress: 'custom@test.com' },
          },
        },
      });

      // Spy on sendEmailNotification
      const emailSpy = jest.spyOn(service, 'sendEmailNotification').mockResolvedValue();

      await service.handleExecutionFailed({
        executionId: 'exec-1',
        workflowId: 'wf-1',
        error: 'Email test error',
      });

      expect(emailSpy).toHaveBeenCalledWith(
        'custom@test.com',
        expect.stringContaining('Test Workflow'),
        expect.stringContaining('Email test error'),
      );
    });

    it('should send email to owner email when no custom emailAddress', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue({
        ...mockExecution,
        workflow: {
          ...mockExecution.workflow,
          errorConfig: {
            retry: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 30000, jitter: true },
            notifications: { inApp: true, email: true },
          },
        },
      });

      const emailSpy = jest.spyOn(service, 'sendEmailNotification').mockResolvedValue();

      await service.handleExecutionFailed({
        executionId: 'exec-1',
        workflowId: 'wf-1',
        error: 'Owner email test',
      });

      expect(emailSpy).toHaveBeenCalledWith(
        'user@test.com', // owner.email
        expect.stringContaining('Test Workflow'),
        expect.stringContaining('Owner email test'),
      );
    });
  });
});
