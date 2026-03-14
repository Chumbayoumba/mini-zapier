import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EngineService } from '../../engine/engine.service';
import * as cron from 'node-cron';

@Injectable()
export class CronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CronService.name);
  private tasks = new Map<string, cron.ScheduledTask>();

  constructor(
    private prisma: PrismaService,
    private engineService: EngineService,
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

    const task = cron.schedule(cronExpression, async () => {
      this.logger.log(`Cron trigger fired: ${triggerId}`);
      try {
        await this.engineService.executeWorkflow(workflowId, {
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
    });

    this.tasks.set(triggerId, task);
    this.logger.log(`Scheduled cron ${triggerId}: ${cronExpression}`);
  }

  stopCron(triggerId: string) {
    const task = this.tasks.get(triggerId);
    if (task) {
      task.stop();
      this.tasks.delete(triggerId);
      this.logger.log(`Stopped cron ${triggerId}`);
    }
  }
}
