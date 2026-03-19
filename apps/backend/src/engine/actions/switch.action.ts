import { Injectable, Logger } from '@nestjs/common';
import { ActionHandler, MultiOutputResult } from '../action-handler.interface';

@Injectable()
export class SwitchAction implements ActionHandler {
  readonly type = 'SWITCH';
  readonly isMultiOutput = true;
  private readonly logger = new Logger(SwitchAction.name);

  async execute(input: any): Promise<MultiOutputResult> {
    const { field, rules = [], fallbackOutput = -1, _nodeInput, _context } = input;
    const data = _nodeInput ?? _context?.triggerData ?? _context ?? {};

    const fieldValue = this.resolveField(data, field);
    this.logger.log(`SWITCH: field="${field}" value="${fieldValue}"`);

    // rules: [{ value: 'X', operator?: 'equals' }, ...] — one per output port
    const outputCount = rules.length + 1; // +1 for fallback
    const outputs: Array<any[]> = Array.from({ length: outputCount }, () => []);

    let matched = false;
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (this.matchRule(fieldValue, rule)) {
        outputs[i].push(data);
        matched = true;
        break; // First match wins
      }
    }

    // Fallback: last output or specific index
    if (!matched) {
      const fbIndex = fallbackOutput >= 0 ? fallbackOutput : outputs.length - 1;
      if (fbIndex < outputs.length) {
        outputs[fbIndex].push(data);
      }
    }

    return { outputs };
  }

  private matchRule(fieldValue: any, rule: any): boolean {
    const operator = rule.operator || 'equals';
    const ruleValue = rule.value;

    switch (operator) {
      case 'equals':
        return String(fieldValue) === String(ruleValue);
      case 'not_equals':
        return String(fieldValue) !== String(ruleValue);
      case 'contains':
        return String(fieldValue).includes(String(ruleValue));
      case 'regex_match':
        try {
          return new RegExp(String(ruleValue)).test(String(fieldValue));
        } catch {
          return false;
        }
      case 'greater_than':
        return Number(fieldValue) > Number(ruleValue);
      case 'less_than':
        return Number(fieldValue) < Number(ruleValue);
      default:
        return String(fieldValue) === String(ruleValue);
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
