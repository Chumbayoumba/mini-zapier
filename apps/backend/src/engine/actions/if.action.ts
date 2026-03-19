import { Injectable, Logger } from '@nestjs/common';
import { ActionHandler, MultiOutputResult } from '../action-handler.interface';

@Injectable()
export class IfAction implements ActionHandler {
  readonly type = 'IF';
  readonly isMultiOutput = true;
  private readonly logger = new Logger(IfAction.name);

  async execute(input: any): Promise<MultiOutputResult> {
    const { conditions = [], combinator = 'AND', _nodeInput, _context } = input;
    const data = _nodeInput ?? _context?.triggerData ?? _context ?? {};

    if (!Array.isArray(conditions) || conditions.length === 0) {
      this.logger.warn('IF node: no conditions defined, routing to false branch');
      return { outputs: [[], [data]] };
    }

    const result = this.evaluateConditions(data, conditions, combinator);
    this.logger.log(`IF node evaluated: ${result} (combinator=${combinator})`);

    return {
      outputs: [
        result ? [data] : [],
        result ? [] : [data],
      ],
    };
  }

  private evaluateConditions(data: any, conditions: any[], combinator: string): boolean {
    const results = conditions.map((c) => this.evaluateSingle(data, c));
    return combinator === 'OR' ? results.some(Boolean) : results.every(Boolean);
  }

  private evaluateSingle(data: any, condition: any): boolean {
    const { field, operator, value } = condition;
    const fieldValue = this.resolveField(data, field);

    switch (operator) {
      case 'equals':
        return String(fieldValue) === String(value);
      case 'not_equals':
        return String(fieldValue) !== String(value);
      case 'greater_than':
        return Number(fieldValue) > Number(value);
      case 'less_than':
        return Number(fieldValue) < Number(value);
      case 'greater_than_or_equal':
        return Number(fieldValue) >= Number(value);
      case 'less_than_or_equal':
        return Number(fieldValue) <= Number(value);
      case 'contains':
        return String(fieldValue).includes(String(value));
      case 'not_contains':
        return !String(fieldValue).includes(String(value));
      case 'starts_with':
        return String(fieldValue).startsWith(String(value));
      case 'ends_with':
        return String(fieldValue).endsWith(String(value));
      case 'is_empty':
        return fieldValue === undefined || fieldValue === null || fieldValue === '' ||
          (Array.isArray(fieldValue) && fieldValue.length === 0);
      case 'is_not_empty':
        return fieldValue !== undefined && fieldValue !== null && fieldValue !== '' &&
          !(Array.isArray(fieldValue) && fieldValue.length === 0);
      case 'regex_match':
        try {
          return new RegExp(String(value)).test(String(fieldValue));
        } catch {
          this.logger.warn(`Invalid regex: ${value}`);
          return false;
        }
      case 'exists':
        return fieldValue !== undefined;
      case 'not_exists':
        return fieldValue === undefined;
      default:
        this.logger.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  private resolveField(data: any, field: string): any {
    if (!field || typeof field !== 'string') return undefined;
    const segments = field.split('.');
    let current = data;
    for (const seg of segments) {
      if (current === undefined || current === null) return undefined;
      current = current[seg];
    }
    return current;
  }
}
