import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  namespace: '/executions',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class WebsocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WebsocketGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} rejected: no token`);
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      client.data.userId = payload.sub;
      client.join(`user:${payload.sub}`);
      this.logger.log(`Client connected: ${client.id} (user: ${payload.sub})`);
    } catch {
      this.logger.warn(`Client ${client.id} rejected: invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:execution')
  async handleJoinExecution(@ConnectedSocket() client: Socket, @MessageBody() executionId: string) {
    const execution = await this.prisma.workflowExecution.findFirst({
      where: { id: executionId },
      include: { workflow: { select: { userId: true } } },
    });

    if (!execution || execution.workflow.userId !== client.data.userId) {
      client.emit('error', { message: 'Access denied' });
      return;
    }

    const room = `execution:${executionId}`;
    client.join(room);
    this.logger.debug(`Client ${client.id} joined ${room}`);
  }

  @SubscribeMessage('leave:execution')
  handleLeaveExecution(@ConnectedSocket() client: Socket, @MessageBody() executionId: string) {
    const room = `execution:${executionId}`;
    client.leave(room);
    this.logger.debug(`Client ${client.id} left ${room}`);
  }

  @SubscribeMessage('join:workflow')
  async handleJoinWorkflow(@ConnectedSocket() client: Socket, @MessageBody() workflowId: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, userId: client.data.userId },
    });

    if (!workflow) {
      client.emit('error', { message: 'Access denied' });
      return;
    }

    const room = `workflow:${workflowId}`;
    client.join(room);
    this.logger.debug(`Client ${client.id} joined ${room}`);
  }

  private emitToRoom(executionId: string, event: string, payload: any) {
    const room = `execution:${executionId}`;
    this.server?.to(room).emit(event, payload);
    this.server?.emit(event, payload); // broadcast for dashboard
  }

  private emitToUser(userId: string, event: string, payload: any) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  @OnEvent('notification.send')
  handleNotificationSend(payload: { userId: string; event: string; data: any }) {
    this.emitToUser(payload.userId, payload.event, payload.data);
  }

  @OnEvent('execution.started')
  handleExecutionStarted(payload: any) {
    this.emitToRoom(payload.executionId, 'execution:started', payload);
  }

  @OnEvent('execution.completed')
  handleExecutionCompleted(payload: any) {
    this.emitToRoom(payload.executionId, 'execution:completed', payload);
  }

  @OnEvent('execution.failed')
  handleExecutionFailed(payload: any) {
    this.emitToRoom(payload.executionId, 'execution:failed', payload);
  }

  @OnEvent('step.started')
  handleStepStarted(payload: any) {
    this.emitToRoom(payload.executionId, 'step:started', payload);
  }

  @OnEvent('step.completed')
  handleStepCompleted(payload: any) {
    this.emitToRoom(payload.executionId, 'step:completed', payload);
  }

  @OnEvent('step.failed')
  handleStepFailed(payload: any) {
    this.emitToRoom(payload.executionId, 'step:failed', payload);
  }

  @OnEvent('execution.paused')
  handleExecutionPaused(payload: any) {
    this.emitToRoom(payload.executionId, 'execution:paused', payload);
  }

  @OnEvent('execution.resumed')
  handleExecutionResumed(payload: any) {
    this.emitToRoom(payload.executionId, 'execution:resumed', payload);
  }
}
