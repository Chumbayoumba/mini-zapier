import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: Record<string, jest.Mock>;

  const mockReq = { user: { sub: 'user-1' } };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      getUnreadCount: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: service },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call service with parsed page and limit', () => {
      service.findAll.mockResolvedValue({ items: [], total: 0, page: 2, limit: 10, totalPages: 0 });

      controller.findAll(mockReq, '2', '10');

      expect(service.findAll).toHaveBeenCalledWith('user-1', 2, 10);
    });

    it('should use defaults when no query params', () => {
      service.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });

      controller.findAll(mockReq, undefined, undefined);

      expect(service.findAll).toHaveBeenCalledWith('user-1', 1, 20);
    });
  });

  describe('getUnreadCount', () => {
    it('should return count object', async () => {
      service.getUnreadCount.mockResolvedValue(5);

      const result = await controller.getUnreadCount(mockReq);

      expect(service.getUnreadCount).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ count: 5 });
    });
  });

  describe('markAsRead', () => {
    it('should call service with userId and id', () => {
      service.markAsRead.mockResolvedValue({ id: 'n-1', isRead: true });

      controller.markAsRead(mockReq, 'n-1');

      expect(service.markAsRead).toHaveBeenCalledWith('user-1', 'n-1');
    });
  });

  describe('markAllAsRead', () => {
    it('should call service with userId', () => {
      service.markAllAsRead.mockResolvedValue({ success: true });

      controller.markAllAsRead(mockReq);

      expect(service.markAllAsRead).toHaveBeenCalledWith('user-1');
    });
  });

  describe('remove', () => {
    it('should call service with userId and id', () => {
      service.remove.mockResolvedValue({ success: true });

      controller.remove(mockReq, 'n-1');

      expect(service.remove).toHaveBeenCalledWith('user-1', 'n-1');
    });
  });

  describe('route ordering', () => {
    it('read-all endpoint should exist and be distinct from :id/read', () => {
      // This verifies the controller compiles with both routes
      expect(controller.markAllAsRead).toBeDefined();
      expect(controller.markAsRead).toBeDefined();
    });
  });
});
