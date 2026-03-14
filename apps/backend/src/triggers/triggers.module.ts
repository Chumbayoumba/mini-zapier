import { Module } from '@nestjs/common';
import { WebhookController } from './webhook/webhook.controller';
import { WebhookService } from './webhook/webhook.service';
import { CronService } from './cron/cron.service';
import { EmailTriggerService } from './email/email-trigger.service';
import { TelegramTriggerService } from './telegram/telegram-trigger.service';
import { TelegramTriggerController } from './telegram/telegram-trigger.controller';
import { TriggersService } from './triggers.service';
import { EngineModule } from '../engine/engine.module';
import { QueueModule } from '../queue/queue.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [EngineModule, QueueModule, IntegrationsModule],
  controllers: [WebhookController, TelegramTriggerController],
  providers: [
    WebhookService,
    CronService,
    EmailTriggerService,
    TelegramTriggerService,
    TriggersService,
  ],
  exports: [WebhookService, CronService, TelegramTriggerService, TriggersService],
})
export class TriggersModule {}
