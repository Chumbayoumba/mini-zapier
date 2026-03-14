import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EngineService } from '../engine.service';

@Processor('workflow-execution')
export class WorkflowProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowProcessor.name);

  constructor(private engineService: EngineService) {
    super();
  }

  async process(job: Job<{ workflowId: string; triggerData?: any }>) {
    this.logger.log(`Processing job ${job.id} for workflow ${job.data.workflowId}`);

    try {
      const executionId = await this.engineService.executeWorkflow(
        job.data.workflowId,
        job.data.triggerData,
      );
      return { executionId };
    } catch (error: any) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.log('WorkflowProcessor shutting down, waiting for current job to complete...');
    // WorkerHost.onApplicationShutdown() calls worker.close() automatically
    // which waits for the current job to complete before stopping
  }
}
