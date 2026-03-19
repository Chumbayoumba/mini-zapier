import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

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
        attempts: 1,
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
