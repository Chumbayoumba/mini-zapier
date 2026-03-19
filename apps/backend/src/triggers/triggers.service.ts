import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CronService } from './cron/cron.service';
import { TelegramTriggerService } from './telegram/telegram-trigger.service';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

@Injectable()
export class TriggersService {
  private readonly logger = new Logger(TriggersService.name);

  constructor(
    private prisma: PrismaService,
    private cronService: CronService,
    private telegramTriggerService: TelegramTriggerService,
    private configService: ConfigService,
  ) {}

  private getBaseUrl(): string {
    return (
      this.configService.get('BASE_URL') ||
      this.configService.get('FRONTEND_URL') ||
      'https://zapier.egor-dev.ru'
    );
  }

  @OnEvent('workflow.activated')
  async handleActivated({ workflowId }: { workflowId: string }) {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) return;

    const definition = workflow.definition as any;
    const nodes = definition?.nodes || [];
    const TRIGGER_TYPES = ['WEBHOOK', 'CRON', 'EMAIL', 'TELEGRAM'];
    const triggerNode = nodes.find((n: any) =>
      n.type === 'triggerNode' ||
      TRIGGER_TYPES.includes(n.data?.type) ||
      TRIGGER_TYPES.includes(n.type),
    );
    if (!triggerNode) return;

    const triggerType = triggerNode.data?.type || triggerNode.type;
    const config = triggerNode.data?.config || triggerNode.config || {};

    // For WEBHOOK triggers: use integration's webhookSecret if integrationId is set
    let webhookToken: string | null = null;
    if (triggerType === 'WEBHOOK') {
      if (config.integrationId) {
        const integration = await this.prisma.integration.findUnique({
          where: { id: config.integrationId },
        });
        webhookToken = integration?.webhookSecret || randomUUID();
      } else {
        webhookToken = randomUUID();
      }
    }

    const existingTrigger = await this.prisma.trigger.findUnique({ where: { workflowId } });

    const trigger = await this.prisma.trigger.upsert({
      where: { workflowId },
      create: {
        workflowId,
        type: triggerType,
        config,
        isActive: true,
        webhookToken,
      },
      update: {
        type: triggerType,
        config,
        isActive: true,
        // Update token only if integration changed or no token exists yet
        ...(triggerType === 'WEBHOOK' && (!existingTrigger?.webhookToken || config.integrationId)
          ? { webhookToken }
          : {}),
      },
    });

    if (triggerType === 'CRON') {
      this.cronService.scheduleCron(trigger.id, config, workflowId);
    }

    if (triggerType === 'TELEGRAM' && config.integrationId) {
      await this.telegramTriggerService.registerWebhook(
        config.integrationId,
        this.getBaseUrl(),
      );
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

    if (trigger.type === 'TELEGRAM') {
      const config = trigger.config as any;
      if (config?.integrationId) {
        await this.telegramTriggerService.removeWebhook(config.integrationId);
      }
    }

    this.logger.log(`Trigger deactivated for workflow ${workflowId}`);
  }

  @OnEvent('workflow.updated')
  async handleUpdated({ workflowId }: { workflowId: string }) {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) return;

    const definition = workflow.definition as any;
    const nodes = definition?.nodes || [];
    const TRIGGER_TYPES = ['WEBHOOK', 'CRON', 'EMAIL', 'TELEGRAM'];
    const triggerNode = nodes.find((n: any) =>
      n.type === 'triggerNode' ||
      TRIGGER_TYPES.includes(n.data?.type) ||
      TRIGGER_TYPES.includes(n.type),
    );
    if (!triggerNode) return;

    const trigger = await this.prisma.trigger.findUnique({ where: { workflowId } });
    if (!trigger) return;

    const triggerType = triggerNode.data?.type || triggerNode.type;
    const config = triggerNode.data?.config || triggerNode.config || {};

    // For WEBHOOK triggers: update token if integration changed
    const updateData: any = { type: triggerType, config };
    if (triggerType === 'WEBHOOK' && trigger.isActive) {
      const oldConfig = trigger.config as any;
      if (config.integrationId && config.integrationId !== oldConfig?.integrationId) {
        const integration = await this.prisma.integration.findUnique({
          where: { id: config.integrationId },
        });
        if (integration?.webhookSecret) {
          updateData.webhookToken = integration.webhookSecret;
        }
      } else if (!config.integrationId && oldConfig?.integrationId) {
        // Switched from integration to auto-generated
        updateData.webhookToken = randomUUID();
      }
    }

    await this.prisma.trigger.update({
      where: { workflowId },
      data: updateData,
    });

    if (trigger.type === 'CRON' || triggerType === 'CRON') {
      this.cronService.stopCron(trigger.id);
      if (trigger.isActive && triggerType === 'CRON') {
        this.cronService.scheduleCron(trigger.id, config, workflowId);
      }
    }

    // Handle Telegram webhook updates
    if (trigger.isActive) {
      if (trigger.type === 'TELEGRAM' && triggerType !== 'TELEGRAM') {
        const oldConfig = trigger.config as any;
        if (oldConfig?.integrationId) {
          await this.telegramTriggerService.removeWebhook(oldConfig.integrationId);
        }
      }
      if (triggerType === 'TELEGRAM' && config.integrationId) {
        await this.telegramTriggerService.registerWebhook(
          config.integrationId,
          this.getBaseUrl(),
        );
      }
    }

    this.logger.log(`Trigger updated for workflow ${workflowId}`);
  }
}
