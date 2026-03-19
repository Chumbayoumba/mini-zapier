import { Injectable, Logger } from '@nestjs/common';
import { ActionHandler } from '../action-handler.interface';

@Injectable()
export class NoopAction implements ActionHandler {
  readonly type = 'NOOP';
  private readonly logger = new Logger(NoopAction.name);

  async execute(input: any): Promise<any> {
    const { _nodeInput, _context } = input;
    const data = _nodeInput ?? _context?.triggerData ?? _context ?? {};
    this.logger.log('NOOP: passing data through unchanged');
    return data;
  }
}
