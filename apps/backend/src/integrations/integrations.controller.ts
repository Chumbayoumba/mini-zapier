import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import {
  CreateIntegrationDto,
  VerifyTelegramDto,
  VerifySMTPDto,
  VerifyWebhookDto,
  VerifyHTTPApiDto,
  VerifyDatabaseDto,
} from './integrations.dto';
import { OpenRouterAction } from '../engine/actions/openrouter.action';

@ApiTags('Integrations')
@ApiBearerAuth()
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly openRouterAction: OpenRouterAction,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List user integrations' })
  findAll(@Request() req: any) {
    return this.integrationsService.findAll(req.user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create integration' })
  create(@Request() req: any, @Body() dto: CreateIntegrationDto) {
    return this.integrationsService.create(req.user.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete integration' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.integrationsService.remove(req.user.sub, id);
  }

  @Post('telegram/verify')
  @ApiOperation({ summary: 'Verify Telegram bot token' })
  verifyTelegram(@Body() dto: VerifyTelegramDto) {
    return this.integrationsService.verifyTelegramBot(dto.botToken);
  }

  @Post('smtp/verify')
  @ApiOperation({ summary: 'Verify SMTP connection' })
  verifySMTP(@Body() dto: VerifySMTPDto) {
    return this.integrationsService.verifySMTP(dto);
  }

  @Post('webhook/verify')
  @ApiOperation({ summary: 'Generate webhook URL' })
  verifyWebhook(@Body() dto: VerifyWebhookDto) {
    return this.integrationsService.verifyWebhook(dto);
  }

  @Post('http-api/verify')
  @ApiOperation({ summary: 'Verify HTTP API endpoint' })
  verifyHTTPApi(@Body() dto: VerifyHTTPApiDto) {
    return this.integrationsService.verifyHTTPApi(dto);
  }

  @Post('database/verify')
  @ApiOperation({ summary: 'Verify database connection' })
  verifyDatabase(@Body() dto: VerifyDatabaseDto) {
    return this.integrationsService.verifyDatabase(dto);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test saved integration connection' })
  testIntegration(@Request() req: any, @Param('id') id: string) {
    return this.integrationsService.testIntegration(id, req.user.sub);
  }

  @Get('openrouter/models')
  @ApiOperation({ summary: 'Get available OpenRouter models' })
  async getOpenRouterModels(@Query('apiKey') apiKey: string) {
    if (!apiKey) throw new BadRequestException('apiKey query parameter is required');
    return this.openRouterAction.getModels(apiKey);
  }
}
