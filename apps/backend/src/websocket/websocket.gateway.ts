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
  handleJoinExecution(@ConnectedSocket() client: Socket, @MessageBody() executionId: string) {
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
  handleJoinWorkflow(@ConnectedSocket() client: Socket, @MessageBody() workflowId: string) {
    const room = `workflow:${workflowId}`;
    client.join(room);
    this.logger.debug(`Client ${client.id} joined ${room}`);
  }

  private emitToRoom(executionId: string, event: string, payload: any) {
    const room = `execution:${executionId}`;
    this.server?.to(room).emit(event, payload);
    this.server?.emit(event, payload); // broadcast for dashboard
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
}
