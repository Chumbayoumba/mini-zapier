import { Injectable, Logger } from '@nestjs/common';
import * as jsonata from 'jsonata';

@Injectable()
export class TransformAction {
  private readonly logger = new Logger(TransformAction.name);

  async execute(config: any): Promise<any> {
    const { expression, data, _context } = config;

    this.logger.log(`Evaluating JSONata expression`);

    const inputData = data ?? _context ?? {};
    const expr = jsonata.default ? jsonata.default(expression) : (jsonata as any)(expression);
    const result = await expr.evaluate(inputData);

    return { result };
  }
}
