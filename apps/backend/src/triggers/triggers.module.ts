import { Module } from '@nestjs/common';
import { WebhookController } from './webhook/webhook.controller';
import { WebhookService } from './webhook/webhook.service';
import { CronService } from './cron/cron.service';
import { EmailTriggerService } from './email/email-trigger.service';
import { TriggersService } from './triggers.service';
import { EngineModule } from '../engine/engine.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [EngineModule, QueueModule],
  controllers: [WebhookController],
  providers: [WebhookService, CronService, EmailTriggerService, TriggersService],
  exports: [WebhookService, CronService, TriggersService],
})
export class TriggersModule {}
