import { Injectable, Logger } from '@nestjs/common';
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

  @OnEvent('execution.completed')
  async handleExecutionCompleted(payload: ExecutionPayload) {
    this.logger.log(`Execution completed: ${payload.executionId} (${payload.duration || 0}ms)`);
  }

  @OnEvent('execution.failed')
  async handleExecutionFailed(payload: ExecutionPayload) {
    this.logger.warn(`Execution failed: ${payload.executionId} — ${payload.error}`);

    // Load workflow with owner info and error config
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

    // 1. In-app notification via WebSocket (default: true)
    if (errorConfig.notifications.inApp) {
      this.eventEmitter.emit('notification.send', {
        userId: owner.id,
        event: 'execution:failed',
        data: {
          executionId: payload.executionId,
          workflowId: payload.workflowId,
          workflowName,
          error: payload.error,
        },
      });
    }

    // 2. Email to workflow owner (if configured)
    if (errorConfig.notifications.email) {
      const emailTo = errorConfig.notifications.emailAddress || owner.email;
      const subject = `[MiniZapier] Workflow Failed: ${workflowName}`;
      const body = `Workflow "${workflowName}" execution ${payload.executionId} failed.\n\nError: ${payload.error || 'Unknown error'}`;
      await this.sendEmailNotification(emailTo, subject, body);
    }

    // 3. Global admin notifications (Telegram + email to admin — keep existing behavior)
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
