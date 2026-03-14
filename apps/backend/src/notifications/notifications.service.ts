import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as nodemailer from 'nodemailer';

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

  constructor(private configService: ConfigService) {
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

    const message = `🚨 <b>Workflow Failed</b>\n\n`
      + `<b>Workflow:</b> ${payload.workflowName || payload.workflowId}\n`
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
          `[MiniZapier] Workflow Failed: ${payload.workflowName || payload.workflowId}`,
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
