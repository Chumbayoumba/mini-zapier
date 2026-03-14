import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { EngineModule } from '../engine/engine.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'workflow-execution' }),
    EngineModule,
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
