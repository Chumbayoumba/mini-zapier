import { Module } from '@nestjs/common';
import { WebhookController } from './webhook/webhook.controller';
import { WebhookService } from './webhook/webhook.service';
import { CronService } from './cron/cron.service';
import { EmailTriggerService } from './email/email-trigger.service';
import { EngineModule } from '../engine/engine.module';

@Module({
  imports: [EngineModule],
  controllers: [WebhookController],
  providers: [WebhookService, CronService, EmailTriggerService],
  exports: [WebhookService, CronService],
})
export class TriggersModule {}
