import { Injectable, Logger } from '@nestjs/common';
import { ActionHandler } from '../action-handler.interface';

@Injectable()
export class ManualTriggerAction implements ActionHandler {
  readonly type = 'MANUAL_TRIGGER';
  private readonly logger = new Logger(ManualTriggerAction.name);

  async execute(input: any): Promise<any> {
    const { testData, _nodeInput, _context } = input;

    if (testData !== undefined && testData !== null) {
      this.logger.log('MANUAL_TRIGGER: returning provided testData');
      return testData;
    }

    if (_nodeInput !== undefined && _nodeInput !== null) {
      this.logger.log('MANUAL_TRIGGER: returning nodeInput');
      return _nodeInput;
    }

    this.logger.log('MANUAL_TRIGGER: no testData, returning empty object');
    return {};
  }
}
