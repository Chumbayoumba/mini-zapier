import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { ActionHandler } from '../action-handler.interface';

const ALLOWED_PARSE_MODES = ['HTML', 'Markdown', 'MarkdownV2'];
const MAX_MESSAGE_LENGTH = 4096;

@Injectable()
export class TelegramAction implements ActionHandler {
  readonly type = 'TELEGRAM';
  private readonly logger = new Logger(TelegramAction.name);

  async execute(config: any): Promise<any> {
    const { botToken, chatId, message, parseMode = 'HTML', _context, _nodeInput } = config;

    // Bot token priority: node config → workflow integrations → trigger data
    const token = botToken
      || _context?.integrations?.telegram?.botToken
      || _context?.triggerData?.botToken;
    const targetChatId = chatId
      || _context?.triggerData?.chat?.id
      || _context?.triggerData?.message?.chat?.id
      || _context?.triggerData?.chatId;
    // Message: configured -> previous node output -> default
    let text = message;
    if (!text || text.includes('{{')) {
      let prev = _nodeInput;
      while (Array.isArray(prev)) prev = prev[0];
      if (prev) {
        text = typeof prev === 'string' ? prev : prev.content || prev.text || prev.message || JSON.stringify(prev);
      }
    }
    if (!text) text = 'Hello!';

    if (!token) {
      throw new BadRequestException('Telegram bot token is required. Configure it in the node settings.');
    }
    if (!targetChatId || targetChatId === '0' || targetChatId === 0) {
      return { success: true, testMode: true, message: text, note: 'No chat ID. In production, Telegram trigger provides it automatically.' };
    }

    // chatId must be numeric (can be negative for groups)
    const chatIdNum = Number(targetChatId);
    if (!Number.isFinite(chatIdNum)) {
      throw new BadRequestException(`Invalid chat ID '${targetChatId}': must be a numeric value`);
    }

    if (typeof text === 'string' && text.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `Message exceeds Telegram limit of ${MAX_MESSAGE_LENGTH} characters (got ${text.length})`,
      );
    }

    if (!ALLOWED_PARSE_MODES.includes(parseMode)) {
      throw new BadRequestException(
        `Invalid parseMode '${parseMode}'. Allowed: ${ALLOWED_PARSE_MODES.join(', ')}`,
      );
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
}
