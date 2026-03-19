import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
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
  @ApiQuery({ name: 'dateFrom', required: false, description: 'ISO date string filter (gte)' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'ISO date string filter (lte)' })
  @ApiQuery({ name: 'workflowId', required: false, description: 'Filter by workflow ID' })
  @ApiResponse({ status: 200, description: 'Paginated list of executions' })
  async findAll(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('workflowId') workflowId?: string,
  ) {
    return this.executionsService.findAllByUser(userId, page || 1, limit || 20, status, dateFrom, dateTo, workflowId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get execution statistics' })
  @ApiResponse({ status: 200, description: 'Execution statistics for the user' })
  async getStats(@CurrentUser('sub') userId: string) {
    return this.executionsService.getStats(userId);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent executions' })
  @ApiResponse({ status: 200, description: 'List of recent executions' })
  async getRecent(@CurrentUser('sub') userId: string) {
    return this.executionsService.getRecentExecutions(userId);
  }

  @Get('chart')
  @ApiOperation({ summary: 'Get chart data' })
  @ApiQuery({ name: 'days', required: false })
  @ApiResponse({ status: 200, description: 'Execution chart data' })
  async getChart(@CurrentUser('sub') userId: string, @Query('days') days?: number) {
    return this.executionsService.getChartData(userId, days || 7);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get execution details' })
  @ApiResponse({ status: 200, description: 'Execution details' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  async findOne(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.executionsService.findById(id, userId);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel execution' })
  @ApiResponse({ status: 200, description: 'Execution cancelled' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  async cancel(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.executionsService.cancel(id, userId);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause a running execution' })
  @ApiResponse({ status: 200, description: 'Execution paused' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  async pause(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.executionsService.pause(id, userId);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a paused execution' })
  @ApiResponse({ status: 200, description: 'Execution resumed' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  async resume(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.executionsService.resume(id, userId);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry failed execution' })
  @ApiResponse({ status: 200, description: 'Execution retried' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  async retry(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.executionsService.retry(id, userId);
  }

  @Post(':id/retry-from-failed')
  @ApiOperation({ summary: 'Retry execution from the failed step' })
  @ApiResponse({ status: 200, description: 'Execution retried from failed step' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  async retryFromFailed(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.executionsService.retryFromFailed(id, userId);
  }
}
