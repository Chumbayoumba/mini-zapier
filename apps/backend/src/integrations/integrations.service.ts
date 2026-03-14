import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIntegrationDto } from './integrations.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    const integrations = await this.prisma.integration.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    // Strip sensitive data from config
    return integrations.map((i) => ({
      ...i,
      config: this.sanitizeConfig(i.config as any),
    }));
  }

  async create(userId: string, dto: CreateIntegrationDto) {
    const webhookSecret = randomBytes(32).toString('hex');

    const integration = await this.prisma.integration.create({
      data: {
        userId,
        type: dto.type,
        name: dto.name,
        config: dto.config as any,
        metadata: (dto.metadata || {}) as any,
        webhookSecret,
      },
    });

    return {
      ...integration,
      config: this.sanitizeConfig(integration.config as any),
    };
  }

  async remove(userId: string, id: string) {
    const integration = await this.prisma.integration.findUnique({ where: { id } });
    if (!integration) throw new NotFoundException('Integration not found');
    if (integration.userId !== userId) throw new ForbiddenException();

    await this.prisma.integration.delete({ where: { id } });
    return { success: true };
  }

  async findById(id: string) {
    return this.prisma.integration.findUnique({ where: { id } });
  }

  async findByWebhookSecret(secret: string) {
    return this.prisma.integration.findUnique({ where: { webhookSecret: secret } });
  }

  async verifyTelegramBot(botToken: string): Promise<{
    ok: boolean;
    botId: number;
    botName: string;
    botUsername: string;
    photoUrl?: string;
  }> {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getMe`,
      );
      const data = await response.json();

      if (!data.ok) {
        return { ok: false, botId: 0, botName: '', botUsername: '' };
      }

      const bot = data.result;
      let photoUrl: string | undefined;

      // Try to get bot avatar
      try {
        const photosRes = await fetch(
          `https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${bot.id}&limit=1`,
        );
        const photosData = await photosRes.json();
        if (photosData.ok && photosData.result.total_count > 0) {
          const fileId = photosData.result.photos[0][0].file_id;
          const fileRes = await fetch(
            `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`,
          );
          const fileData = await fileRes.json();
          if (fileData.ok) {
            photoUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
          }
        }
      } catch {
        // Avatar is optional
      }

      return {
        ok: true,
        botId: bot.id,
        botName: bot.first_name,
        botUsername: bot.username,
        photoUrl,
      };
    } catch (error) {
      this.logger.error('Telegram verify failed', error);
      return { ok: false, botId: 0, botName: '', botUsername: '' };
    }
  }

  private sanitizeConfig(config: Record<string, any>): Record<string, any> {
    if (!config) return {};
    const sanitized = { ...config };
    if (sanitized.botToken) {
      const token = sanitized.botToken as string;
      sanitized.botToken = token.slice(0, 8) + '...' + token.slice(-4);
    }
    return sanitized;
  }
}
