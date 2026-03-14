import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import * as cron from 'node-cron';
import * as cronParser from 'cron-parser';

@Injectable()
export class CronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CronService.name);
  private tasks = new Map<string, cron.ScheduledTask>();

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
  ) {}

  async onModuleInit() {
    await this.loadActiveCronTriggers();
  }

  onModuleDestroy() {
    for (const [id, task] of this.tasks) {
      task.stop();
      this.logger.log(`Stopped cron task ${id}`);
    }
    this.tasks.clear();
  }

  async loadActiveCronTriggers() {
    const triggers = await this.prisma.trigger.findMany({
      where: {
        type: 'CRON',
        isActive: true,
        workflow: { status: 'ACTIVE' },
      },
      include: { workflow: true },
    });

    for (const trigger of triggers) {
      this.scheduleCron(trigger.id, trigger.config as any, trigger.workflowId);
      await this.recoverMissedJobs(trigger as any);
    }

    this.logger.log(`Loaded ${triggers.length} cron triggers`);
  }

  scheduleCron(triggerId: string, config: any, workflowId: string) {
    const cronExpression = config?.cronExpression;
    if (!cronExpression || !cron.validate(cronExpression)) {
      this.logger.warn(`Invalid cron expression for trigger ${triggerId}: ${cronExpression}`);
      return;
    }

    if (this.tasks.has(triggerId)) {
      this.tasks.get(triggerId)!.stop();
    }

    const timezone = config.timezone || 'UTC';

    const task = cron.schedule(
      cronExpression,
      async () => {
        await this.onCronFire(triggerId, workflowId, cronExpression);
      },
      { timezone },
    );

    this.tasks.set(triggerId, task);
    this.logger.log(`Scheduled cron ${triggerId}: ${cronExpression} (tz: ${timezone})`);
  }

  stopCron(triggerId: string) {
    const task = this.tasks.get(triggerId);
    if (task) {
      task.stop();
      this.tasks.delete(triggerId);
      this.logger.log(`Stopped cron ${triggerId}`);
    }
  }

  async onCronFire(triggerId: string, workflowId: string, cronExpression: string) {
    try {
      await this.queueService.addExecution(workflowId, {
        trigger: 'cron',
        scheduledAt: new Date().toISOString(),
        cronExpression,
      });

      await this.prisma.trigger.update({
        where: { id: triggerId },
        data: { lastTriggeredAt: new Date() },
      });
    } catch (error: any) {
      this.logger.error(`Cron execution failed for ${triggerId}: ${error.message}`);
    }
  }

  async recoverMissedJobs(trigger: {
    id: string;
    workflowId: string;
    lastTriggeredAt: Date | null;
    config: any;
  }) {
    try {
      if (!trigger.lastTriggeredAt || !trigger.config?.cronExpression) {
        return;
      }

      const interval = cronParser.parseExpression(trigger.config.cronExpression, {
        currentDate: trigger.lastTriggeredAt,
      });

      const nextFire = interval.next().toDate();

      if (nextFire < new Date()) {
        await this.queueService.addExecution(trigger.workflowId, {
          trigger: 'cron',
          scheduledAt: nextFire.toISOString(),
          recovered: true,
        });

        await this.prisma.trigger.update({
          where: { id: trigger.id },
          data: { lastTriggeredAt: new Date() },
        });

        this.logger.log(`Recovered missed cron job for trigger ${trigger.id}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to recover missed jobs for trigger ${trigger.id}: ${error.message}`);
    }
  }
}
