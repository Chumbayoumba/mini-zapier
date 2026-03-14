import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreateWorkflowDto) {
    return this.workflowsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List user workflows' })
  async findAll(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.workflowsService.findAllByUser(userId, page || 1, limit || 20);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow by ID' })
  async findOne(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.workflowsService.findById(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update workflow' })
  async update(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.workflowsService.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete workflow' })
  async remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.workflowsService.delete(id, userId);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate workflow' })
  async activate(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.workflowsService.activate(id, userId);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate workflow' })
  async deactivate(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.workflowsService.deactivate(id, userId);
  }

  @Post(':id/execute')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually execute a workflow' })
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
  async getVersions(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.workflowsService.getVersions(id, userId);
  }
}
