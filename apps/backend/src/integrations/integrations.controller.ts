import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { CreateIntegrationDto, VerifyTelegramDto } from './integrations.dto';

@ApiTags('Integrations')
@ApiBearerAuth()
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

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
}
