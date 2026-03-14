import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailAction {
  private readonly logger = new Logger(EmailAction.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT'),
      secure: false,
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASSWORD'),
      },
    });
  }

  async execute(config: any): Promise<any> {
    const { to, subject, body, isHtml = false } = config;

    this.logger.log(`Sending email to ${to}: ${subject}`);

    try {
      const result = await this.transporter.sendMail({
        from: this.configService.get('SMTP_USER'),
        to,
        subject,
        [isHtml ? 'html' : 'text']: body,
      });

      return { messageId: result.messageId, accepted: result.accepted };
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error instanceof Error ? error.stack : String(error));
      throw new Error(`Email sending failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
