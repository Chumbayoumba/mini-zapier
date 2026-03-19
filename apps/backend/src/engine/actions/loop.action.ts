import { Injectable, Logger } from '@nestjs/common';
import { ActionHandler } from '../action-handler.interface';

@Injectable()
export class LoopAction implements ActionHandler {
  readonly type = 'LOOP';
  private readonly logger = new Logger(LoopAction.name);

  async execute(input: any): Promise<any> {
    const { batchSize = 1, _nodeInput, _context } = input;
    const data = _nodeInput ?? _context?.triggerData ?? _context ?? {};

    // If data is not an array, wrap it
    const items = Array.isArray(data) ? data : [data];
    const size = Math.max(1, Math.floor(Number(batchSize) || 1));

    const batches: any[][] = [];
    for (let i = 0; i < items.length; i += size) {
      batches.push(items.slice(i, i + size));
    }

    this.logger.log(`LOOP: split ${items.length} items into ${batches.length} batches of ${size}`);
    return batches;
  }
}
