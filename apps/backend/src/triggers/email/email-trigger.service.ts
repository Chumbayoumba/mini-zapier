import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';

@Injectable()
export class EmailTriggerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailTriggerService.name);
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
  ) {}

  onModuleInit() {
    this.startPolling();
  }

  onModuleDestroy() {
    this.stopPolling();
  }

  startPolling(intervalMs = 60_000) {
    this.pollInterval = setInterval(() => this.checkEmails(), intervalMs);
    this.logger.log(`Email trigger polling started (${intervalMs / 1000}s interval)`);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async checkEmails(): Promise<void> {
    const triggers = await this.prisma.trigger.findMany({
      where: { type: 'EMAIL', isActive: true },
      include: { workflow: true },
    });

    for (const trigger of triggers) {
      if (trigger.workflow.status !== 'ACTIVE') continue;

      let config = { ...(trigger.config as Record<string, any>) };

      // Resolve IMAP credentials from integration if integrationId is set
      if (config.integrationId && !config.imapHost) {
        try {
          const integration = await this.prisma.integration.findUnique({
            where: { id: config.integrationId },
          });
          if (integration) {
            const ic = integration.config as Record<string, any>;
            config.imapHost = ic.imapHost || ic.host;
            config.imapPort = ic.imapPort || 993;
            config.imapUser = ic.imapUser || ic.user;
            config.imapPassword = ic.imapPassword || ic.password;
          }
        } catch (e: any) {
          this.logger.error(`Failed to resolve integration for trigger ${trigger.id}: ${e.message}`);
        }
      }

      if (!config.imapHost || !config.imapUser || !config.imapPassword) {
        this.logger.warn(`Trigger ${trigger.id} missing IMAP config, skipping`);
        continue;
      }

      try {
        const emails = await this.fetchNewEmails(config);

        // Filter out system/bounce emails (MAILER-DAEMON, postmaster, etc.)
        const nonSystem = emails.filter((e) => !this.isSystemEmail(e));

        const filter = config.filter || config.subjectFilter;
        const filtered = filter
          ? nonSystem.filter((e) => e.subject?.toLowerCase().includes(filter.toLowerCase()))
          : nonSystem;

        for (const email of filtered) {
          await this.queueService.addExecution(trigger.workflowId, {
            from: email.from,
            subject: email.subject,
            date: email.date,
            body: email.body,
            trigger: 'email',
          });
        }

        if (filtered.length > 0) {
          await this.prisma.trigger.update({
            where: { id: trigger.id },
            data: { lastTriggeredAt: new Date() },
          });
        }
      } catch (err: any) {
        this.logger.error(`Email check failed for trigger ${trigger.id}: ${err.message}`);
      }
    }
  }

  async fetchNewEmails(
    config: Record<string, any>,
  ): Promise<Array<{ from: string; subject: string; date: string; body: string }>> {
    const Imap = require('imap');

    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: config.imapUser,
        password: config.imapPassword,
        host: config.imapHost,
        port: Number(config.imapPort || 993),
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
      });

      const emails: Array<{ from: string; subject: string; date: string; body: string }> = [];

      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err: any) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          imap.search(['UNSEEN'], (err: any, uids: number[]) => {
            if (err) {
              imap.end();
              return reject(err);
            }
            if (!uids || uids.length === 0) {
              imap.end();
              return resolve([]);
            }

            const fetchUids = uids.slice(0, 10);
            const f = imap.fetch(fetchUids, { bodies: '', markSeen: true });

            f.on('message', (msg: any) => {
              let buffer = '';
              msg.on('body', (stream: any) => {
                stream.on('data', (chunk: Buffer) => {
                  buffer += chunk.toString('utf8');
                });
              });
              msg.once('end', () => {
                const fromMatch = buffer.match(/^From:\s*(.+)$/mi);
                const subjectMatch = buffer.match(/^Subject:\s*(.+)$/mi);
                const dateMatch = buffer.match(/^Date:\s*(.+)$/mi);
                emails.push({
                  from: fromMatch?.[1]?.trim() || '',
                  subject: subjectMatch?.[1]?.trim() || '',
                  date: dateMatch?.[1]?.trim() || new Date().toISOString(),
                  body: buffer.substring(buffer.indexOf('\r\n\r\n') + 4).substring(0, 1000),
                });
              });
            });

            f.once('end', () => {
              imap.end();
              resolve(emails);
            });
            f.once('error', (err: any) => {
              imap.end();
              reject(err);
            });
          });
        });
      });

      imap.once('error', (err: any) => reject(err));
      imap.connect();
    });
  }

  private isSystemEmail(email: { from: string; subject: string }): boolean {
    const from = (email.from || '').toLowerCase();
    const subject = (email.subject || '').toLowerCase();

    const systemSenders = [
      'mailer-daemon',
      'postmaster',
      'mail delivery',
      'mail transport',
    ];
    if (systemSenders.some((s) => from.includes(s))) return true;

    const bounceSubjects = [
      'undeliverable',
      'delivery failed',
      'mail delivery failed',
      'non-delivery',
      'delivery failure',
      'returned mail',
      'delivery status notification',
    ];
    if (bounceSubjects.some((p) => subject.includes(p))) return true;

    return false;
  }
}
