import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { EngineService } from '../engine/engine.service';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('workflow-execution') private executionQueue: Queue,
  ) {}

  async addExecution(workflowId: string, triggerData?: any, delay = 0) {
    const job = await this.executionQueue.add(
      'execute',
      { workflowId, triggerData },
      {
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );

    this.logger.log(`Queued execution for workflow ${workflowId}, job ${job.id}`);
    return job.id;
  }

  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.executionQueue.getWaitingCount(),
      this.executionQueue.getActiveCount(),
      this.executionQueue.getCompletedCount(),
      this.executionQueue.getFailedCount(),
      this.executionQueue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }
}

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
}
