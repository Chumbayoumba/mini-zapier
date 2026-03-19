import { Injectable, Logger } from '@nestjs/common';
import { ActionHandler } from '../action-handler.interface';

@Injectable()
export class FilterAction implements ActionHandler {
  readonly type = 'FILTER';
  private readonly logger = new Logger(FilterAction.name);

  async execute(input: any): Promise<any> {
    const { conditions = [], combinator = 'AND', _nodeInput, _context } = input;
    const data = _nodeInput ?? _context?.triggerData ?? _context ?? {};

    // Normalise to array for uniform processing
    const items = Array.isArray(data) ? data : [data];

    if (!Array.isArray(conditions) || conditions.length === 0) {
      this.logger.warn('FILTER: no conditions — passing all items through');
      return items;
    }

    const filtered = items.filter((item) =>
      this.evaluateConditions(item, conditions, combinator),
    );

    this.logger.log(`FILTER: ${filtered.length}/${items.length} items passed`);
    return filtered;
  }

  private evaluateConditions(item: any, conditions: any[], combinator: string): boolean {
    const results = conditions.map((c) => this.evaluateSingle(item, c));
    return combinator === 'OR' ? results.some(Boolean) : results.every(Boolean);
  }

  private evaluateSingle(item: any, condition: any): boolean {
    const { field, operator, value } = condition;
    const fieldValue = this.resolveField(item, field);

    switch (operator) {
      case 'equals':
        return String(fieldValue) === String(value);
      case 'not_equals':
        return String(fieldValue) !== String(value);
      case 'greater_than':
        return Number(fieldValue) > Number(value);
      case 'less_than':
        return Number(fieldValue) < Number(value);
      case 'contains':
        return String(fieldValue).includes(String(value));
      case 'not_contains':
        return !String(fieldValue).includes(String(value));
      case 'starts_with':
        return String(fieldValue).startsWith(String(value));
      case 'ends_with':
        return String(fieldValue).endsWith(String(value));
      case 'is_empty':
        return fieldValue === undefined || fieldValue === null || fieldValue === '';
      case 'is_not_empty':
        return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
      case 'regex_match':
        try {
          return new RegExp(String(value)).test(String(fieldValue));
        } catch {
          return false;
        }
      case 'exists':
        return fieldValue !== undefined;
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
