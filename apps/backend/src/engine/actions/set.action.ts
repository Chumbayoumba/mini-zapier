import { Injectable, Logger } from '@nestjs/common';
import { ActionHandler } from '../action-handler.interface';

@Injectable()
export class SetAction implements ActionHandler {
  readonly type = 'SET';
  private readonly logger = new Logger(SetAction.name);

  async execute(input: any): Promise<any> {
    const { mode = 'append', fields = [], _nodeInput, _context } = input;
    const data = _nodeInput ?? _context?.triggerData ?? _context ?? {};

    // Ensure we work with a plain object copy
    let result: Record<string, any>;
    if (typeof data !== 'object' || data === null) {
      result = { value: data };
    } else if (Array.isArray(data)) {
      result = { items: [...data] };
    } else {
      result = { ...data };
    }

    if (!Array.isArray(fields) || fields.length === 0) {
      this.logger.warn('SET: no fields defined, returning data unchanged');
      return result;
    }

    switch (mode) {
      case 'set': {
        // Replace: start from empty, set only specified fields
        const fresh: Record<string, any> = {};
        for (const f of fields) {
          if (f.name) this.setNestedField(fresh, f.name, f.value);
        }
        this.logger.log(`SET (mode=set): created ${fields.length} fields`);
        return fresh;
      }
      case 'append': {
        // Add/overwrite fields onto existing data
        for (const f of fields) {
          if (f.name) this.setNestedField(result, f.name, f.value);
        }
        this.logger.log(`SET (mode=append): added ${fields.length} fields`);
        return result;
      }
      case 'remove': {
        for (const f of fields) {
          if (f.name) this.removeNestedField(result, f.name);
        }
        this.logger.log(`SET (mode=remove): removed ${fields.length} fields`);
        return result;
      }
      default:
        this.logger.warn(`SET: unknown mode "${mode}", returning data unchanged`);
        return result;
    }
  }

  private setNestedField(obj: Record<string, any>, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]] === undefined || typeof current[parts[i]] !== 'object') {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }

  private removeNestedField(obj: Record<string, any>, path: string): void {
    const parts = path.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]] === undefined || typeof current[parts[i]] !== 'object') return;
      current = current[parts[i]];
    }
    delete current[parts[parts.length - 1]];
  }
}
