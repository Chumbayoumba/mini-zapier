import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ExecutionsService } from './executions.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Executions')
@Controller('executions')
@ApiBearerAuth()
export class ExecutionsController {
  constructor(private executionsService: ExecutionsService) {}

  @Get()
  @ApiOperation({ summary: 'List executions' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  async findAll(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.executionsService.findAllByUser(userId, page || 1, limit || 20, status);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get execution statistics' })
  async getStats(@CurrentUser('sub') userId: string) {
    return this.executionsService.getStats(userId);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent executions' })
  async getRecent(@CurrentUser('sub') userId: string) {
    return this.executionsService.getRecentExecutions(userId);
  }

  @Get('chart')
  @ApiOperation({ summary: 'Get chart data' })
  @ApiQuery({ name: 'days', required: false })
  async getChart(@CurrentUser('sub') userId: string, @Query('days') days?: number) {
    return this.executionsService.getChartData(userId, days || 7);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get execution details' })
  async findOne(@Param('id') id: string) {
    return this.executionsService.findById(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel execution' })
  async cancel(@Param('id') id: string) {
    return this.executionsService.cancel(id);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry failed execution' })
  async retry(@Param('id') id: string) {
    return this.executionsService.retry(id);
  }
}
