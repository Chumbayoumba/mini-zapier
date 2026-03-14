import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { WorkflowsService } from './workflows.service';
import { EngineService } from '../engine/engine.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Workflows')
@Controller('workflows')
@ApiBearerAuth()
export class WorkflowsController {
  constructor(
    private workflowsService: WorkflowsService,
    private engineService: EngineService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workflow' })
  @ApiResponse({ status: 201, description: 'Workflow created successfully' })
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreateWorkflowDto) {
    return this.workflowsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List user workflows' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name or description' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive', 'all'] })
  @ApiResponse({ status: 200, description: 'List of workflows' })
  async findAll(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.workflowsService.findAllByUser(userId, page || 1, limit || 20, search, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow by ID' })
  @ApiResponse({ status: 200, description: 'Workflow details' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async findOne(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.workflowsService.findById(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update workflow' })
  @ApiResponse({ status: 200, description: 'Workflow updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async update(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.workflowsService.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete workflow' })
  @ApiResponse({ status: 200, description: 'Workflow deleted successfully' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.workflowsService.delete(id, userId);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate workflow' })
  @ApiResponse({ status: 200, description: 'Workflow activated' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async activate(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.workflowsService.activate(id, userId);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate workflow' })
  @ApiResponse({ status: 200, description: 'Workflow deactivated' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async deactivate(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.workflowsService.deactivate(id, userId);
  }

  @Post(':id/execute')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually execute a workflow' })
  @ApiResponse({ status: 200, description: 'Workflow execution started, returns execution ID' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async execute(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() body: Record<string, any>,
  ) {
    await this.workflowsService.findById(id, userId);
    const executionId = await this.engineService.executeWorkflow(id, body || {});
    return { executionId };
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Get workflow versions' })
  @ApiResponse({ status: 200, description: 'List of workflow versions' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async getVersions(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.workflowsService.getVersions(id, userId);
  }
}
