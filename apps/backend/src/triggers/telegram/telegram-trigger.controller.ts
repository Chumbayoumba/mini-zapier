import { Controller, Post, Param, Body, HttpCode, Logger } from '@nestjs/common';
import { ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { TelegramTriggerService } from './telegram-trigger.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@ApiTags('Webhooks')
@Controller('webhooks/telegram')
export class TelegramTriggerController {
  private readonly logger = new Logger(TelegramTriggerController.name);

  constructor(
    private telegramTriggerService: TelegramTriggerService,
    @InjectQueue('workflow-execution') private executionQueue: Queue,
  ) {}

  @Public()
  @Post(':webhookSecret')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handleUpdate(
    @Param('webhookSecret') webhookSecret: string,
    @Body() update: any,
  ) {
    this.logger.debug(`Telegram update received for webhook ${webhookSecret.substring(0, 8)}...`);

    try {
      const results =
        await this.telegramTriggerService.processUpdate(webhookSecret, update);

      if (!results || results.length === 0) {
        return { ok: true };
      }

      // Queue workflow execution for each matched trigger
      for (const result of results) {
        await this.executionQueue.add('execute', {
          workflowId: result.workflowId,
          triggerData: result.triggerData,
        });
        this.logger.log(
          `Queued workflow ${result.workflowId} from Telegram trigger`,
        );
      }

      return { ok: true };
    } catch (error) {
      this.logger.error('Error processing Telegram update', error);
      // Always return 200 to Telegram to prevent retries
      return { ok: true };
    }
  }
}
