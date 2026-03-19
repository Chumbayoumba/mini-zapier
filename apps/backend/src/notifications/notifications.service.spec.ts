import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: Record<string, any>;
  let eventEmitter: { emit: jest.Mock };
  let configService: { get: jest.Mock };

  const mockOwner = { id: 'user-1', email: 'user@test.com', name: 'Test User' };

  const mockNotification = {
    id: 'notif-1',
    userId: 'user-1',
    type: 'execution_completed',
    title: 'Workflow completed',
    message: 'Test workflow completed successfully',
    data: { executionId: 'exec-1' },
    isRead: false,
    createdAt: new Date('2024-01-01'),
  };

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
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      workflowExecution: {
        findUnique: jest.fn(),
      },
    };

    eventEmitter = { emit: jest.fn() };

    configService = {
      get: jest.fn((key: string) => {
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
    const mockNotif = {
      id: 'notif-1',
      userId: 'user-1',
      type: 'execution_failed',
      title: 'Workflow failed',
      message: '"Test Workflow" failed: Test error',
      data: { executionId: 'exec-1', workflowId: 'wf-1', error: 'Test error' },
      isRead: false,
      createdAt: new Date(),
    };

    beforeEach(() => {
      prisma.notification.create.mockResolvedValue(mockNotif);
    });

    it('should persist notification and emit notification:new event (default config)', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue(mockExecution);

      await service.handleExecutionFailed({
        executionId: 'exec-1',
        workflowId: 'wf-1',
        error: 'Test error',
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          type: 'execution_failed',
          title: 'Workflow failed',
        }),
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', {
        userId: 'user-1',
        event: 'notification:new',
        data: mockNotif,
      });
    });

    it('should always persist notification even when inApp is false in errorConfig', async () => {
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

      // createNotification is always called (persists + emits)
      expect(prisma.notification.create).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({ event: 'notification:new' }),
      );
    });

    it('should do nothing if execution is not found', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue(null);

      await service.handleExecutionFailed({
        executionId: 'nonexistent',
        workflowId: 'wf-1',
        error: 'Test error',
      });

      expect(prisma.notification.create).not.toHaveBeenCalled();
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

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          data: expect.objectContaining({ workflowId: 'wf-1' }),
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
        'user@test.com',
        expect.stringContaining('Test Workflow'),
        expect.stringContaining('Owner email test'),
      );
    });
  });

  // ─── CRUD Tests ────────────────────────────────────────────────

  describe('createNotification', () => {
    it('should create notification in DB and emit WebSocket event', async () => {
      prisma.notification.create.mockResolvedValue(mockNotification);

      const result = await service.createNotification(
        'user-1',
        'execution_completed',
        'Workflow completed',
        'Test workflow completed successfully',
        { executionId: 'exec-1' },
      );

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          type: 'execution_completed',
          title: 'Workflow completed',
          message: 'Test workflow completed successfully',
          data: { executionId: 'exec-1' },
        },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', {
        userId: 'user-1',
        event: 'notification:new',
        data: mockNotification,
      });
      expect(result).toEqual(mockNotification);
    });

    it('should use empty object as default data', async () => {
      prisma.notification.create.mockResolvedValue(mockNotification);

      await service.createNotification('user-1', 'info', 'Test', 'Message');

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ data: {} }),
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated notifications', async () => {
      const items = [mockNotification];
      prisma.notification.findMany.mockResolvedValue(items);
      prisma.notification.count.mockResolvedValue(1);

      const result = await service.findAll('user-1', 1, 20);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({
        items,
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should calculate skip correctly for page 2', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(25);

      const result = await service.findAll('user-1', 2, 10);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result.totalPages).toBe(3);
    });

    it('should use defaults when no page/limit provided', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.findAll('user-1');

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      prisma.notification.count.mockResolvedValue(5);

      const result = await service.getUnreadCount('user-1');

      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
      });
      expect(result).toBe(5);
    });
  });

  describe('markAsRead', () => {
    it('should mark owned notification as read', async () => {
      prisma.notification.findUnique.mockResolvedValue(mockNotification);
      prisma.notification.update.mockResolvedValue({ ...mockNotification, isRead: true });

      const result = await service.markAsRead('user-1', 'notif-1');

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { isRead: true },
      });
      expect(result.isRead).toBe(true);
    });

    it('should throw NotFoundException for non-existent notification', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      await expect(service.markAsRead('user-1', 'nope')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own notification', async () => {
      prisma.notification.findUnique.mockResolvedValue({ ...mockNotification, userId: 'other-user' });

      await expect(service.markAsRead('user-1', 'notif-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markAllAsRead', () => {
    it('should update all unread notifications for user', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.markAllAsRead('user-1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
        data: { isRead: true },
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe('remove', () => {
    it('should delete owned notification', async () => {
      prisma.notification.findUnique.mockResolvedValue(mockNotification);
      prisma.notification.delete.mockResolvedValue(mockNotification);

      const result = await service.remove('user-1', 'notif-1');

      expect(prisma.notification.delete).toHaveBeenCalledWith({ where: { id: 'notif-1' } });
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException for non-existent notification', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      await expect(service.remove('user-1', 'nope')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own notification', async () => {
      prisma.notification.findUnique.mockResolvedValue({ ...mockNotification, userId: 'other-user' });

      await expect(service.remove('user-1', 'notif-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('handleExecutionCompleted', () => {
    it('should create notification for completed execution', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue({
        id: 'exec-1',
        workflow: { userId: 'user-1', name: 'Test Workflow' },
      });
      prisma.notification.create.mockResolvedValue(mockNotification);

      await service.handleExecutionCompleted({
        executionId: 'exec-1',
        workflowId: 'wf-1',
        duration: 1500,
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          type: 'execution_completed',
          title: 'Workflow completed',
        }),
      });
    });

    it('should do nothing if execution not found', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue(null);

      await service.handleExecutionCompleted({
        executionId: 'nonexistent',
        workflowId: 'wf-1',
      });

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });
});
