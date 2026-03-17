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

  async verifySMTP(config: { host: string; port: number; user: string; password: string; secure?: boolean }): Promise<{
    ok: boolean;
    message: string;
  }> {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure ?? config.port === 465,
        auth: { user: config.user, pass: config.password },
        connectionTimeout: 10000,
      });
      await transporter.verify();
      return { ok: true, message: `SMTP connection to ${config.host}:${config.port} verified` };
    } catch (error: any) {
      this.logger.error('SMTP verify failed', error);
      return { ok: false, message: error.message || 'SMTP connection failed' };
    }
  }

  async verifyWebhook(config: { name: string; url?: string }): Promise<{
    ok: boolean;
    webhookUrl: string;
    secret: string;
  }> {
    const secret = randomBytes(32).toString('hex');
    const baseUrl = process.env.WEBHOOK_BASE_URL || 'https://flowforge.app';
    const webhookUrl = config.url || `${baseUrl}/api/webhooks/${secret}`;
    return { ok: true, webhookUrl, secret };
  }

  async verifyHTTPApi(config: { baseUrl: string; headers?: Record<string, string> }): Promise<{
    ok: boolean;
    statusCode: number;
    message: string;
  }> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(config.baseUrl, {
        method: 'GET',
        headers: config.headers || {},
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return {
        ok: response.ok,
        statusCode: response.status,
        message: response.ok ? `API responded with ${response.status}` : `API returned ${response.status}`,
      };
    } catch (error: any) {
      this.logger.error('HTTP API verify failed', error);
      return { ok: false, statusCode: 0, message: error.message || 'Connection failed' };
    }
  }

  async verifyDatabase(config: { connectionString: string }): Promise<{
    ok: boolean;
    message: string;
  }> {
    try {
      const url = new URL(config.connectionString);
      const protocol = url.protocol.replace(':', '');

      if (['postgresql', 'postgres'].includes(protocol)) {
        const { Client } = await import('pg');
        const client = new Client({ connectionString: config.connectionString });
        await client.connect();
        await client.query('SELECT 1');
        await client.end();
        return { ok: true, message: `PostgreSQL connection verified (${url.hostname})` };
      }

      if (protocol === 'mysql') {
        return { ok: true, message: `MySQL connection format verified (${url.hostname})` };
      }

      return { ok: true, message: `Database connection format verified (${protocol}://${url.hostname})` };
    } catch (error: any) {
      this.logger.error('Database verify failed', error);
      return { ok: false, message: error.message || 'Database connection failed' };
    }
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
    const sensitiveKeys = ['botToken', 'password', 'secret', 'connectionString', 'apiKey', 'token', 'Authorization'];
    for (const key of sensitiveKeys) {
      if (sanitized[key] && typeof sanitized[key] === 'string') {
        const val = sanitized[key] as string;
        sanitized[key] = val.length > 12 ? val.slice(0, 4) + '••••' + val.slice(-4) : '••••••••';
      }
    }
    // Sanitize header values (may contain API keys)
    if (sanitized.headers && typeof sanitized.headers === 'object') {
      const maskedHeaders: Record<string, string> = {};
      for (const [hKey, hVal] of Object.entries(sanitized.headers)) {
        if (typeof hVal === 'string' && hVal.length > 0) {
          maskedHeaders[hKey] = hVal.length > 12
            ? hVal.slice(0, 4) + '••••' + hVal.slice(-4)
            : '••••••••';
        } else {
          maskedHeaders[hKey] = '••••••••';
        }
      }
      sanitized.headers = maskedHeaders;
    }
    return sanitized;
  }
}
