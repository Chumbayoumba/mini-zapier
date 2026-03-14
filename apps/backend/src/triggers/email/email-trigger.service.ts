import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as Imap from 'imap';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EmailTriggerService implements OnModuleDestroy {
  private readonly logger = new Logger(EmailTriggerService.name);
  private imapConnection: any = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private isConfigured = false;

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
    private prisma: PrismaService,
  ) {
    const host = this.configService.get('IMAP_HOST');
    this.isConfigured = !!host;
    if (this.isConfigured) {
      this.startPolling();
    } else {
      this.logger.warn('IMAP not configured — email triggers disabled');
    }
  }

  onModuleDestroy() {
    this.stopPolling();
  }

  private startPolling() {
    const intervalMs = 60_000; // poll every 60 seconds
    this.logger.log(`Starting email polling every ${intervalMs / 1000}s`);
    this.pollInterval = setInterval(() => this.checkEmails(), intervalMs);
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.imapConnection) {
      try {
        this.imapConnection.end();
      } catch {}
    }
  }

  async checkEmails(): Promise<void> {
    if (!this.isConfigured) return;

    try {
      const triggers = await this.prisma.trigger.findMany({
        where: { type: 'EMAIL', isActive: true },
        include: { workflow: true },
      });

      if (triggers.length === 0) return;

      const emails = await this.fetchNewEmails();

      for (const trigger of triggers) {
        const config = trigger.config as Record<string, any>;
        const filter = config.filter || config.subjectFilter;
        const matching = filter
          ? emails.filter((e) => e.subject?.includes(filter))
          : emails;

        for (const email of matching) {
          this.eventEmitter.emit('trigger.fired', {
            triggerId: trigger.id,
            workflowId: trigger.workflowId,
            data: { from: email.from, subject: email.subject, date: email.date, body: email.body },
          });
        }
      }
    } catch (error: any) {
      this.logger.error(`Email polling failed: ${error.message}`);
    }
  }

  private async fetchNewEmails(): Promise<
    { from: string; subject: string; date: string; body: string }[]
  > {
    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: this.configService.get('IMAP_USER') || '',
        password: this.configService.get('IMAP_PASSWORD') || '',
        host: this.configService.get('IMAP_HOST') || '',
        port: Number(this.configService.get('IMAP_PORT') || 993),
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
      });

      const emails: { from: string; subject: string; date: string; body: string }[] = [];

      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          imap.search(['UNSEEN'], (err, uids) => {
            if (err || !uids?.length) {
              imap.end();
              return resolve([]);
            }

            const fetch = imap.fetch(uids.slice(0, 10), { bodies: '', markSeen: true });

            fetch.on('message', (msg) => {
              let header = '';
              msg.on('body', (stream) => {
                stream.on('data', (chunk: Buffer) => {
                  header += chunk.toString('utf8');
                });
              });
              msg.once('end', () => {
                const fromMatch = header.match(/^From: (.+)$/m);
                const subjectMatch = header.match(/^Subject: (.+)$/m);
                const dateMatch = header.match(/^Date: (.+)$/m);
                emails.push({
                  from: fromMatch?.[1] || '',
                  subject: subjectMatch?.[1] || '',
                  date: dateMatch?.[1] || '',
                  body: header.substring(0, 500),
                });
              });
            });

            fetch.once('end', () => {
              imap.end();
              resolve(emails);
            });
          });
        });
      });

      imap.once('error', (err: Error) => {
        this.logger.error(`IMAP error: ${err.message}`);
        resolve([]);
      });

      imap.connect();
    });
  }
}
