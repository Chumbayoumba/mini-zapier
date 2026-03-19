import { Injectable } from '@nestjs/common';
import { ActionHandler } from './action-handler.interface';

@Injectable()
export class ActionRegistry {
  private readonly handlers = new Map<string, ActionHandler>();

  register(handler: ActionHandler): void {
    if (this.handlers.has(handler.type)) {
      throw new Error(
        `Action handler for type '${handler.type}' already registered`,
      );
    }
    this.handlers.set(handler.type, handler);
  }

  get(type: string): ActionHandler {
    const handler = this.handlers.get(type);
    if (!handler) throw new Error(`Unknown action type: ${type}`);
    return handler;
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }

  getRegisteredTypes(): string[] {
    return [...this.handlers.keys()];
  }
}
