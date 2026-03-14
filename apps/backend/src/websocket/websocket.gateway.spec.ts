import { Test, TestingModule } from '@nestjs/testing';
import { WebsocketGateway } from './websocket.gateway';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

describe('WebsocketGateway', () => {
  let gateway: WebsocketGateway;
  let prisma: {
    workflowExecution: { findFirst: jest.Mock };
    workflow: { findFirst: jest.Mock };
  };
  let jwtService: { verifyAsync: jest.Mock };

  const createMockSocket = (
    opts: { id?: string; userId?: string; token?: string } = {},
  ) => ({
    id: opts.id ?? 'client-1',
    data: opts.userId !== undefined ? { userId: opts.userId } : ({} as any),
    handshake: {
      auth: opts.token !== undefined ? { token: opts.token } : {},
      headers: {} as any,
    },
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    disconnect: jest.fn(),
  });

  beforeEach(async () => {
    prisma = {
      workflowExecution: { findFirst: jest.fn() },
      workflow: { findFirst: jest.fn() },
    };

    jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebsocketGateway,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') return 'test-jwt-secret-long-enough-32chars!';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    gateway = module.get<WebsocketGateway>(WebsocketGateway);
  });

  describe('handleConnection (auth)', () => {
    it('should disconnect client with no token', async () => {
      const client = createMockSocket();
      await gateway.handleConnection(client as any);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should disconnect client with invalid token', async () => {
      jwtService.verifyAsync.mockRejectedValueOnce(new Error('invalid'));
      const client = createMockSocket({ token: 'bad-token' });
      await gateway.handleConnection(client as any);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should accept client with valid token and set userId', async () => {
      const client = createMockSocket({ token: 'valid-token' });
      await gateway.handleConnection(client as any);
      expect(client.data.userId).toBe('user-1');
      expect(client.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('handleJoinExecution', () => {
    it('should join room when user owns the execution workflow', async () => {
      prisma.workflowExecution.findFirst.mockResolvedValue({
        id: 'exec-1',
        workflow: { userId: 'user-1' },
      });

      const client = createMockSocket({ userId: 'user-1' });
      await gateway.handleJoinExecution(client as any, 'exec-1');

      expect(prisma.workflowExecution.findFirst).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        include: { workflow: { select: { userId: true } } },
      });
      expect(client.join).toHaveBeenCalledWith('execution:exec-1');
      expect(client.emit).not.toHaveBeenCalled();
    });

    it('should emit error and NOT join when user does not own execution', async () => {
      prisma.workflowExecution.findFirst.mockResolvedValue({
        id: 'exec-1',
        workflow: { userId: 'other-user' },
      });

      const client = createMockSocket({ userId: 'user-1' });
      await gateway.handleJoinExecution(client as any, 'exec-1');

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Access denied' });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('should emit error when execution does not exist', async () => {
      prisma.workflowExecution.findFirst.mockResolvedValue(null);

      const client = createMockSocket({ userId: 'user-1' });
      await gateway.handleJoinExecution(client as any, 'non-existent');

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Access denied' });
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('handleJoinWorkflow', () => {
    it('should join room when user owns the workflow', async () => {
      prisma.workflow.findFirst.mockResolvedValue({
        id: 'wf-1',
        userId: 'user-1',
      });

      const client = createMockSocket({ userId: 'user-1' });
      await gateway.handleJoinWorkflow(client as any, 'wf-1');

      expect(prisma.workflow.findFirst).toHaveBeenCalledWith({
        where: { id: 'wf-1', userId: 'user-1' },
      });
      expect(client.join).toHaveBeenCalledWith('workflow:wf-1');
      expect(client.emit).not.toHaveBeenCalled();
    });

    it('should emit error and NOT join when user does not own workflow', async () => {
      prisma.workflow.findFirst.mockResolvedValue(null);

      const client = createMockSocket({ userId: 'user-1' });
      await gateway.handleJoinWorkflow(client as any, 'wf-1');

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Access denied' });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('should emit error when workflow does not exist', async () => {
      prisma.workflow.findFirst.mockResolvedValue(null);

      const client = createMockSocket({ userId: 'user-1' });
      await gateway.handleJoinWorkflow(client as any, 'non-existent');

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Access denied' });
      expect(client.join).not.toHaveBeenCalled();
    });
  });
});
