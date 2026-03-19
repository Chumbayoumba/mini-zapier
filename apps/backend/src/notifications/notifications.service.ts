import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_ERROR_CONFIG, WorkflowErrorConfig } from '../engine/execution-context';

interface ExecutionPayload {
  executionId: string;
  workflowId: string;
  workflowName?: string;
  error?: string;
  duration?: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private telegramBotToken: string;
  private emailTransporter: nodemailer.Transporter | null = null;
  private alertChatId: string;
  private alertEmail: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {
    this.telegramBotToken = this.configService.get('TELEGRAM_BOT_TOKEN') || '';
    this.alertChatId = this.configService.get('TELEGRAM_ALERT_CHAT_ID') || '';
    this.alertEmail = this.configService.get('ALERT_EMAIL') || '';

    const smtpHost = this.configService.get('SMTP_HOST');
    if (smtpHost) {
      this.emailTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(this.configService.get('SMTP_PORT') || 587),
        secure: false,
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASSWORD'),
        },
      });
    }
  }

  // ─── CRUD ────────────────────────────────────────────────────────

  async createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    data: Record<string, any> = {},
  ) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, message, data },
    });

    // Real-time push via WebSocket
    this.eventEmitter.emit('notification.send', {
      userId,
      event: 'notification:new',
      data: notification,
    });

    return notification;
  }

  async findAll(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markAsRead(userId: string, id: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n) throw new NotFoundException('Notification not found');
    if (n.userId !== userId) throw new ForbiddenException();
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }

  async remove(userId: string, id: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n) throw new NotFoundException('Notification not found');
    if (n.userId !== userId) throw new ForbiddenException();
    await this.prisma.notification.delete({ where: { id } });
    return { success: true };
  }

  // ─── Event handlers ──────────────────────────────────────────────

  @OnEvent('execution.completed')
  async handleExecutionCompleted(payload: ExecutionPayload) {
    this.logger.log(`Execution completed: ${payload.executionId} (${payload.duration || 0}ms)`);

    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: payload.executionId },
      include: { workflow: { select: { userId: true, name: true } } },
    });
    if (!execution) return;

    await this.createNotification(
      execution.workflow.userId,
      'execution_completed',
      'Workflow completed',
      `"${execution.workflow.name}" completed successfully in ${payload.duration || 0}ms`,
      { executionId: payload.executionId, workflowId: payload.workflowId },
    );
  }

  @OnEvent('execution.failed')
  async handleExecutionFailed(payload: ExecutionPayload) {
    this.logger.warn(`Execution failed: ${payload.executionId} — ${payload.error}`);

    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: payload.executionId },
      include: {
        workflow: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });

    if (!execution) return;

    const errorConfig: WorkflowErrorConfig =
      (execution.workflow.errorConfig as any) || DEFAULT_ERROR_CONFIG;
    const owner = execution.workflow.user;
    const workflowName = execution.workflow.name;

    // Persist in-app notification
    await this.createNotification(
      owner.id,
      'execution_failed',
      'Workflow failed',
      `"${workflowName}" failed: ${payload.error || 'Unknown error'}`,
      { executionId: payload.executionId, workflowId: payload.workflowId, error: payload.error },
    );

    // Email to workflow owner (if configured)
    if (errorConfig.notifications.email) {
      const emailTo = errorConfig.notifications.emailAddress || owner.email;
      const subject = `[MiniZapier] Workflow Failed: ${workflowName}`;
      const body = `Workflow "${workflowName}" execution ${payload.executionId} failed.\n\nError: ${payload.error || 'Unknown error'}`;
      await this.sendEmailNotification(emailTo, subject, body);
    }

    // Global admin notifications
    const message = `🚨 <b>Workflow Failed</b>\n\n`
      + `<b>Workflow:</b> ${workflowName || payload.workflowId}\n`
      + `<b>Owner:</b> ${owner.name} (${owner.email})\n`
      + `<b>Execution:</b> ${payload.executionId}\n`
      + `<b>Error:</b> ${payload.error || 'Unknown error'}`;

    const promises: Promise<void>[] = [];

    if (this.alertChatId) {
      promises.push(this.sendTelegramNotification(this.alertChatId, message));
    }

    if (this.alertEmail && this.emailTransporter) {
      promises.push(
        this.sendEmailNotification(
          this.alertEmail,
          `[MiniZapier] Workflow Failed: ${workflowName}`,
          message.replace(/<[^>]+>/g, ''),
        ),
      );
    }

    await Promise.allSettled(promises);
  }

  // ─── External channels ───────────────────────────────────────────

  async sendTelegramNotification(chatId: string, message: string) {
    if (!this.telegramBotToken) {
      this.logger.warn('Telegram bot token not configured');
      return;
    }
    try {
      await axios.post(`https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      });
    } catch (error: any) {
      this.logger.error(`Failed to send Telegram notification: ${error.message}`);
    }
  }

  async sendEmailNotification(to: string, subject: string, body: string) {
    if (!this.emailTransporter) {
      this.logger.warn('Email transport not configured');
      return;
    }
    try {
      await this.emailTransporter.sendMail({
        from: this.configService.get('SMTP_USER'),
        to,
        subject,
        text: body,
      });
    } catch (error: any) {
      this.logger.error(`Failed to send email notification: ${error.message}`);
    }
  }
}
