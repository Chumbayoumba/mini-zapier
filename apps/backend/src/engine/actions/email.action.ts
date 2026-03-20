import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { ActionHandler } from '../action-handler.interface';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Extract plain email from RFC 5322 format: "Name <email>" → "email"
function extractEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return match ? match[1].trim() : raw.trim();
}

function parseAndValidateEmails(raw: string, field: string): string[] {
  return raw.split(',').map((e: string) => {
    const email = extractEmail(e);
    if (!EMAIL_REGEX.test(email)) {
      throw new BadRequestException(`Invalid ${field} email address: '${email}'`);
    }
    return email;
  });
}

@Injectable()
export class EmailAction implements ActionHandler {
  readonly type = 'SEND_EMAIL';
  private readonly logger = new Logger(EmailAction.name);

  constructor(private configService: ConfigService) {}

  async execute(config: any): Promise<any> {
    const { to, subject, body, isHtml = false, from, cc, bcc, _context, _nodeInput } = config;

    if (!to || typeof to !== 'string') {
      throw new BadRequestException('Recipient (to) is required');
    }
    if (!subject || typeof subject !== 'string') {
      throw new BadRequestException('Subject is required');
    }

    const recipients = parseAndValidateEmails(to, 'recipient');
    const cleanTo = recipients.join(', ');

    let cleanCc: string | undefined;
    if (cc) {
      cleanCc = parseAndValidateEmails(String(cc), 'CC').join(', ');
    }

    let cleanBcc: string | undefined;
    if (bcc) {
      cleanBcc = parseAndValidateEmails(String(bcc), 'BCC').join(', ');
    }

    const transporter = this.createTransporter(config, _context);

    // Build a valid sender address — ensure it always contains @domain
    const rawFrom =
      from ||
      _context?.integrations?.email?.from ||
      this.configService.get('SMTP_USER');
    const smtpUserForFrom =
      config.smtpUser ||
      _context?.integrations?.email?.user ||
      this.configService.get('SMTP_USER');
    const smtpHostForFrom =
      config.smtpHost ||
      _context?.integrations?.email?.host ||
      this.configService.get('SMTP_HOST');

    let senderFrom = rawFrom;
    if (senderFrom && !senderFrom.includes('@') && smtpHostForFrom) {
      // Bare username like "mailuser" → "mailuser@egor-dev.ru"
      const domain = smtpHostForFrom.replace(/^mail\./, '');
      senderFrom = `${senderFrom}@${domain}`;
    } else if (!senderFrom && smtpUserForFrom && smtpHostForFrom) {
      const domain = smtpHostForFrom.replace(/^mail\./, '');
      senderFrom = `${smtpUserForFrom}@${domain}`;
    }

    this.logger.log(`Sending email to ${cleanTo}: ${subject}`);

    try {
      const mailOptions: any = {
        from: senderFrom,
        to: cleanTo,
        subject,
        [isHtml ? 'html' : 'text']: body,
      };
      if (cleanCc) mailOptions.cc = cleanCc;
      if (cleanBcc) mailOptions.bcc = cleanBcc;

      const result = await transporter.sendMail(mailOptions);

      return { messageId: result.messageId, accepted: result.accepted };
    } catch (error) {
      this.logger.error(`Failed to send email to ${cleanTo}`, error instanceof Error ? error.stack : String(error));
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

    // Derive the mail domain for EHLO and message-id
    const mailDomain = smtpHost ? smtpHost.replace(/^mail\./, '') : 'localhost';

    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false,
      name: mailDomain, // EHLO hostname & message-id domain
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }
}
