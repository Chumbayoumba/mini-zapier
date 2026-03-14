import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CronService } from './cron/cron.service';
import { randomUUID } from 'crypto';

@Injectable()
export class TriggersService {
  private readonly logger = new Logger(TriggersService.name);

  constructor(
    private prisma: PrismaService,
    private cronService: CronService,
  ) {}

  @OnEvent('workflow.activated')
  async handleActivated({ workflowId }: { workflowId: string }) {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) return;

    const definition = workflow.definition as any;
    const nodes = definition?.nodes || [];
    const triggerNode = nodes.find((n: any) =>
      n.type === 'triggerNode' || ['WEBHOOK', 'CRON', 'EMAIL'].includes(n.data?.type),
    );
    if (!triggerNode) return;

    const triggerType = triggerNode.data?.type;
    const config = triggerNode.data?.config || {};

    const trigger = await this.prisma.trigger.upsert({
      where: { workflowId },
      create: {
        workflowId,
        type: triggerType,
        config,
        isActive: true,
        webhookToken: triggerType === 'WEBHOOK' ? randomUUID() : null,
      },
      update: {
        type: triggerType,
        config,
        isActive: true,
      },
    });

    if (triggerType === 'CRON') {
      this.cronService.scheduleCron(trigger.id, config, workflowId);
    }

    this.logger.log(`Trigger synced for workflow ${workflowId}: ${triggerType}`);
  }

  @OnEvent('workflow.deactivated')
  async handleDeactivated({ workflowId }: { workflowId: string }) {
    const trigger = await this.prisma.trigger.findUnique({ where: { workflowId } });
    if (!trigger) return;

    await this.prisma.trigger.update({
      where: { workflowId },
      data: { isActive: false },
    });

    if (trigger.type === 'CRON') {
      this.cronService.stopCron(trigger.id);
    }

    this.logger.log(`Trigger deactivated for workflow ${workflowId}`);
  }

  @OnEvent('workflow.updated')
  async handleUpdated({ workflowId }: { workflowId: string }) {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) return;

    const definition = workflow.definition as any;
    const nodes = definition?.nodes || [];
    const triggerNode = nodes.find((n: any) =>
      n.type === 'triggerNode' || ['WEBHOOK', 'CRON', 'EMAIL'].includes(n.data?.type),
    );
    if (!triggerNode) return;

    const trigger = await this.prisma.trigger.findUnique({ where: { workflowId } });
    if (!trigger) return;

    const triggerType = triggerNode.data?.type;
    const config = triggerNode.data?.config || {};

    await this.prisma.trigger.update({
      where: { workflowId },
      data: { type: triggerType, config },
    });

    if (trigger.type === 'CRON' || triggerType === 'CRON') {
      this.cronService.stopCron(trigger.id);
      if (trigger.isActive && triggerType === 'CRON') {
        this.cronService.scheduleCron(trigger.id, config, workflowId);
      }
    }

    this.logger.log(`Trigger updated for workflow ${workflowId}`);
  }
}
