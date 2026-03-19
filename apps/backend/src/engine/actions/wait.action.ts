import { Injectable, Logger } from '@nestjs/common';
import { ActionHandler } from '../action-handler.interface';

const MAX_WAIT_MS = 5 * 60 * 1000; // 5 minutes max

@Injectable()
export class WaitAction implements ActionHandler {
  readonly type = 'WAIT';
  private readonly logger = new Logger(WaitAction.name);

  async execute(input: any): Promise<any> {
    const { amount = 1, unit = 'seconds', _nodeInput, _context } = input;
    const data = _nodeInput ?? _context?.triggerData ?? _context ?? {};

    const ms = this.toMilliseconds(Number(amount) || 1, unit);
    const clampedMs = Math.min(Math.max(ms, 0), MAX_WAIT_MS);

    this.logger.log(`WAIT: sleeping for ${clampedMs}ms (${amount} ${unit})`);
    await new Promise((resolve) => setTimeout(resolve, clampedMs));

    return data;
  }

  private toMilliseconds(amount: number, unit: string): number {
    switch (unit) {
      case 'milliseconds':
      case 'ms':
        return amount;
      case 'seconds':
      case 's':
        return amount * 1000;
      case 'minutes':
      case 'm':
        return amount * 60 * 1000;
      case 'hours':
      case 'h':
        return amount * 60 * 60 * 1000;
      default:
        return amount * 1000; // default to seconds
    }
  }
}
