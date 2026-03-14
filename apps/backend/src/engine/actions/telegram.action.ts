import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ActionHandler } from '../action-handler.interface';

@Injectable()
export class TelegramAction implements ActionHandler {
  readonly type = 'TELEGRAM';
  private readonly logger = new Logger(TelegramAction.name);

  async execute(config: any): Promise<any> {
    const { botToken, chatId, message, parseMode = 'HTML', _context } = config;

    // Bot token priority: node config → workflow integrations → trigger data
    const token = botToken
      || _context?.integrations?.telegram?.botToken
      || _context?.triggerData?.botToken;
    const targetChatId = chatId
      || _context?.triggerData?.chat?.id
      || _context?.triggerData?.message?.chat?.id;
    const text = this.interpolateMessage(message || 'Hello!', _context);

    if (!token) {
      throw new Error('Telegram bot token is required. Configure it in the node settings.');
    }
    if (!targetChatId) {
      throw new Error('Chat ID is required. Configure it in the node settings or use a Telegram trigger.');
    }

    this.logger.log(`Sending Telegram message to chat ${targetChatId}`);

    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          chat_id: targetChatId,
          text,
          parse_mode: parseMode,
        },
      );

      return {
        ok: response.data.ok,
        messageId: response.data.result?.message_id,
        chatId: targetChatId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send Telegram message to ${targetChatId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new Error(
        `Telegram sending failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private interpolateMessage(template: string, context: any): string {
    if (!context) return template;
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path: string) => {
      const parts = path.split('.');
      let value: any = context;
      for (const part of parts) {
        value = value?.[part];
      }
      return value !== undefined && value !== null ? String(value) : `{{${path}}}`;
    });
  }
}
