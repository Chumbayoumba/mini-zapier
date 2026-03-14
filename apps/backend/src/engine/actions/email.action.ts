import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { ActionHandler } from '../action-handler.interface';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class EmailAction implements ActionHandler {
  readonly type = 'SEND_EMAIL';
  private readonly logger = new Logger(EmailAction.name);

  constructor(private configService: ConfigService) {}

  async execute(config: any): Promise<any> {
    const { to, subject, body, isHtml = false, from, cc, bcc, _context } = config;

    if (!to || typeof to !== 'string') {
      throw new BadRequestException('Recipient (to) is required');
    }
    if (!subject || typeof subject !== 'string') {
      throw new BadRequestException('Subject is required');
    }

    const recipients = to.split(',').map((e: string) => e.trim());
    for (const email of recipients) {
      if (!EMAIL_REGEX.test(email)) {
        throw new BadRequestException(`Invalid email address: '${email}'`);
      }
    }

    if (cc) {
      const ccList = String(cc).split(',').map((e: string) => e.trim());
      for (const email of ccList) {
        if (!EMAIL_REGEX.test(email)) {
          throw new BadRequestException(`Invalid CC email address: '${email}'`);
        }
      }
    }

    if (bcc) {
      const bccList = String(bcc).split(',').map((e: string) => e.trim());
      for (const email of bccList) {
        if (!EMAIL_REGEX.test(email)) {
          throw new BadRequestException(`Invalid BCC email address: '${email}'`);
        }
      }
    }

    const transporter = this.createTransporter(config, _context);

    const senderFrom =
      from ||
      _context?.integrations?.email?.from ||
      this.configService.get('SMTP_USER');

    this.logger.log(`Sending email to ${to}: ${subject}`);

    try {
      const mailOptions: any = {
        from: senderFrom,
        to,
        subject,
        [isHtml ? 'html' : 'text']: body,
      };
      if (cc) mailOptions.cc = cc;
      if (bcc) mailOptions.bcc = bcc;

      const result = await transporter.sendMail(mailOptions);

      return { messageId: result.messageId, accepted: result.accepted };
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error instanceof Error ? error.stack : String(error));
      throw new Error(`Email sending failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private createTransporter(config: any, _context?: any): nodemailer.Transporter {
    // Priority: per-step SMTP config → _context.integrations.email → global env vars
    const smtpHost =
      config.smtpHost ||
      _context?.integrations?.email?.host ||
      this.configService.get('SMTP_HOST');
    const smtpPort =
      config.smtpPort ||
      _context?.integrations?.email?.port ||
      this.configService.get('SMTP_PORT');
    const smtpUser =
      config.smtpUser ||
      _context?.integrations?.email?.user ||
      this.configService.get('SMTP_USER');
    const smtpPass =
      config.smtpPassword ||
      _context?.integrations?.email?.password ||
      this.configService.get('SMTP_PASSWORD');

    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }
}
