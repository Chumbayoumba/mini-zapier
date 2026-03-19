import { Controller, Post, Param, Body, Headers, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint, ApiResponse } from '@nestjs/swagger';
import { WebhookService } from './webhook.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private webhookService: WebhookService) {}

  @Post(':token')
  @Public()
  @ApiOperation({ summary: 'Webhook trigger endpoint' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 404, description: 'Invalid webhook token' })
  async handleWebhook(
    @Param('token') token: string,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ) {
    this.logger.log(`Webhook received: ${token}`);
    return this.webhookService.processWebhook(token, body, headers);
  }
}
