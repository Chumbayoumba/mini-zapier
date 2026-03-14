import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TelegramAction {
  private readonly logger = new Logger(TelegramAction.name);
  private botToken: string;

  constructor(private configService: ConfigService) {
    this.botToken = this.configService.get('TELEGRAM_BOT_TOKEN') || '';
  }

  async execute(config: any): Promise<any> {
    const { chatId, message, parseMode = 'HTML' } = config;

    this.logger.log(`Sending Telegram message to ${chatId}`);

    const response = await axios.post(
      `https://api.telegram.org/bot${this.botToken}/sendMessage`,
      {
        chat_id: chatId,
        text: message,
        parse_mode: parseMode,
      },
    );

    return { ok: response.data.ok, messageId: response.data.result?.message_id };
  }
}
