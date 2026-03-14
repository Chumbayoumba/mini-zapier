import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as jsonata from 'jsonata';
import { ActionHandler } from '../action-handler.interface';

const MAX_INPUT_SIZE = 1_048_576; // 1 MB
const MAX_OUTPUT_SIZE = 5_242_880; // 5 MB
const EVALUATION_TIMEOUT = 5_000; // 5 seconds

@Injectable()
export class TransformAction implements ActionHandler {
  readonly type = 'TRANSFORM';
  private readonly logger = new Logger(TransformAction.name);

  async execute(config: any): Promise<any> {
    const { expression, data, _context } = config;

    if (!expression || typeof expression !== 'string') {
      throw new BadRequestException('JSONata expression is required');
    }

    this.logger.log(`Evaluating JSONata expression`);

    const inputData = data ?? _context ?? {};

    const serialized = JSON.stringify(inputData);
    if (serialized.length > MAX_INPUT_SIZE) {
      throw new BadRequestException(
        `Input data exceeds maximum size of ${MAX_INPUT_SIZE} bytes (got ${serialized.length})`,
      );
    }

    try {
      const expr = jsonata.default ? jsonata.default(expression) : (jsonata as any)(expression);

      let timer: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        expr.evaluate(inputData),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('JSONata evaluation timed out')), EVALUATION_TIMEOUT);
        }),
      ]);
      if (timer) clearTimeout(timer);

      // Output size limit
      const outputSerialized = JSON.stringify(result);
      if (outputSerialized && outputSerialized.length > MAX_OUTPUT_SIZE) {
        throw new Error(`Output exceeds maximum size of ${MAX_OUTPUT_SIZE} bytes (got ${outputSerialized.length})`);
      }

      return { result };
    } catch (error: any) {
      throw new BadRequestException(`Transform failed: ${error.message ?? 'unknown error'}`);
    }
  }
}
