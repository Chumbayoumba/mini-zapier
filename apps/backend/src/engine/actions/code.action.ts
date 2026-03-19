import { Injectable, Logger } from '@nestjs/common';
import { ActionHandler } from '../action-handler.interface';
import * as vm from 'vm';

const CODE_TIMEOUT_MS = 10_000;

// Allowed globals whitelist — no process, require, import, fs, etc.
const BLOCKED_GLOBALS = [
  'process', 'require', 'module', 'exports', '__filename', '__dirname',
  'globalThis', 'global', 'Buffer', 'setImmediate', 'clearImmediate',
];

@Injectable()
export class CodeAction implements ActionHandler {
  readonly type = 'CODE';
  private readonly logger = new Logger(CodeAction.name);

  async execute(input: any): Promise<any> {
    const { code, _nodeInput, _context } = input;

    if (!code || typeof code !== 'string') {
      throw new Error('CODE node: "code" parameter is required and must be a string');
    }

    const data = _nodeInput ?? _context?.triggerData ?? _context ?? {};

    // Build a restricted sandbox
    const sandbox: Record<string, any> = {
      $input: data,
      $context: _context ?? {},
      console: {
        log: (...args: any[]) => this.logger.log(`[CODE] ${args.join(' ')}`),
        warn: (...args: any[]) => this.logger.warn(`[CODE] ${args.join(' ')}`),
        error: (...args: any[]) => this.logger.error(`[CODE] ${args.join(' ')}`),
      },
      JSON,
      Math,
      Date,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      String,
      Number,
      Boolean,
      Array,
      Object,
      RegExp,
      Map,
      Set,
      Promise,
      Error,
      TypeError,
      RangeError,
    };

    // Block dangerous globals
    for (const name of BLOCKED_GLOBALS) {
      sandbox[name] = undefined;
    }

    const context = vm.createContext(sandbox);

    // Wrap user code in an async IIFE so they can use `return` and `await`
    const wrappedCode = `
      (async () => {
        ${code}
      })();
    `;

    try {
      const script = new vm.Script(wrappedCode, { filename: 'user-code.js' });
      const result = await script.runInContext(context, { timeout: CODE_TIMEOUT_MS });
      this.logger.log('CODE node executed successfully');
      return result;
    } catch (error: any) {
      this.logger.error(`CODE node error: ${error.message}`);
      throw new Error(`Code execution failed: ${error.message}`);
    }
  }
}
