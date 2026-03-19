import { Module } from '@nestjs/common';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { WorkflowValidationService } from './workflow-validation.service';
import { EngineModule } from '../engine/engine.module';

@Module({
  imports: [EngineModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, WorkflowValidationService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
