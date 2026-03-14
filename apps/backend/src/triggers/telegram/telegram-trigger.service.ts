import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationsService } from '../../integrations/integrations.service';

@Injectable()
export class TelegramTriggerService {
  private readonly logger = new Logger(TelegramTriggerService.name);

  constructor(
    private prisma: PrismaService,
    private integrationsService: IntegrationsService,
  ) {}

  /**
   * Register Telegram webhook when workflow is activated
   */
  async registerWebhook(
    integrationId: string,
    baseUrl: string,
  ): Promise<boolean> {
    const integration = await this.integrationsService.findById(integrationId);
    if (!integration) {
      this.logger.error(`Integration ${integrationId} not found`);
      return false;
    }

    const config = integration.config as any;
    const botToken = config.botToken;
    if (!botToken) {
      this.logger.error('No botToken in integration config');
      return false;
    }

    const webhookUrl = `${baseUrl}/api/webhooks/telegram/${integration.webhookSecret}`;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: webhookUrl,
            allowed_updates: ['message', 'callback_query', 'edited_message'],
          }),
        },
      );
      const data = await response.json();
      if (!data.ok) {
        this.logger.error('Failed to set Telegram webhook', data);
        return false;
      }

      this.logger.log(
        `Telegram webhook registered for bot ${(integration.metadata as any)?.botUsername || integrationId}`,
      );
      return true;
    } catch (error) {
      this.logger.error('Error setting Telegram webhook', error);
      return false;
    }
  }

  /**
   * Remove Telegram webhook when workflow is deactivated
   */
  async removeWebhook(integrationId: string): Promise<boolean> {
    const integration = await this.integrationsService.findById(integrationId);
    if (!integration) return false;

    const config = integration.config as any;
    const botToken = config.botToken;
    if (!botToken) return false;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/deleteWebhook`,
      );
      const data = await response.json();
      this.logger.log(
        `Telegram webhook removed for ${(integration.metadata as any)?.botUsername || integrationId}: ${data.ok}`,
      );
      return data.ok;
    } catch (error) {
      this.logger.error('Error removing Telegram webhook', error);
      return false;
    }
  }

  /**
   * Process incoming Telegram update
   */
  async processUpdate(webhookSecret: string, update: any) {
    const integration =
      await this.integrationsService.findByWebhookSecret(webhookSecret);
    if (!integration) {
      this.logger.warn(`No integration found for webhook secret`);
      return null;
    }

    // Find active triggers that use this integration
    const triggers = await this.prisma.trigger.findMany({
      where: {
        type: 'TELEGRAM',
        isActive: true,
      },
      include: { workflow: true },
    });

    // Filter triggers matching this integration
    const matchingTriggers = triggers.filter((t) => {
      const config = t.config as any;
      return config?.integrationId === integration.id;
    });

    if (matchingTriggers.length === 0) {
      this.logger.debug('No matching triggers for Telegram update');
      return null;
    }

    const triggerData = this.extractTriggerData(update);

    // Check event type filters
    const results: Array<{ workflowId: string; triggerData: any }> = [];

    for (const trigger of matchingTriggers) {
      const config = trigger.config as any;
      const eventType = config?.eventType || 'message';

      if (this.matchesEventType(triggerData, eventType)) {
        results.push({
          workflowId: trigger.workflowId,
          triggerData: {
            ...triggerData,
            botToken: (integration.config as any).botToken,
            integrationId: integration.id,
          },
        });
      }
    }

    return results;
  }

  private extractTriggerData(update: any) {
    const message = update.message || update.edited_message;
    const callbackQuery = update.callback_query;

    if (callbackQuery) {
      return {
        type: 'callback_query',
        update_id: update.update_id,
        callback_query: callbackQuery,
        message: callbackQuery.message,
        chat: callbackQuery.message?.chat,
        from: callbackQuery.from,
        data: callbackQuery.data,
      };
    }

    if (message) {
      const isCommand =
        message.text && message.text.startsWith('/');
      const command = isCommand
        ? message.text.split(' ')[0].split('@')[0]
        : null;

      return {
        type: isCommand ? 'command' : 'message',
        update_id: update.update_id,
        message,
        chat: message.chat,
        from: message.from,
        text: message.text || '',
        command,
        commandArgs: isCommand
          ? message.text.substring(command.length).trim()
          : '',
      };
    }

    return {
      type: 'unknown',
      update_id: update.update_id,
      raw: update,
    };
  }

  private matchesEventType(triggerData: any, eventType: string): boolean {
    switch (eventType) {
      case 'message':
        return triggerData.type === 'message' || triggerData.type === 'command';
      case 'command':
        return triggerData.type === 'command';
      case 'command_start':
        return triggerData.type === 'command' && triggerData.command === '/start';
      case 'command_help':
        return triggerData.type === 'command' && triggerData.command === '/help';
      case 'callback_query':
        return triggerData.type === 'callback_query';
      case 'any':
        return true;
      default:
        return true;
    }
  }
}
