export interface TemplateContext {
  steps: Record<string, any>;
  trigger: any;
  env?: Record<string, string>;
}

const TEMPLATE_RE = /\{\{(.+?)\}\}/g;

export class TemplateEngine {
  /**
   * Resolve all {{...}} expressions in a single string.
   * If the entire string is one expression, returns the raw value (object/array).
   * Otherwise returns an interpolated string.
   */
  static resolve(template: string, context: TemplateContext): any {
    if (!template || !template.includes('{{')) return template;

    // Check if entire string is a single expression
    const trimmed = template.trim();
    const singleMatch = /^\{\{([^{}]+)\}\}$/.exec(trimmed);
    if (singleMatch && trimmed === template) {
      const value = TemplateEngine.resolveValue(singleMatch[1].trim(), context);
      return value === undefined ? template : value;
    }

    return template.replace(TEMPLATE_RE, (original, path) => {
      const value = TemplateEngine.resolveValue(path.trim(), context);
      if (value === undefined || value === null) return original;
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    });
  }

  /**
   * Deep-walk a config object, resolving all string values.
   * Preserves non-string values (numbers, booleans).
   */
  static resolveConfig(
    config: Record<string, any>,
    context: TemplateContext,
  ): Record<string, any> {
    return TemplateEngine.deepResolve(config, context) as Record<string, any>;
  }

  /**
   * Resolve a dot-path like "steps.node1.output.data.name" against context.
   * Supports array bracket notation: items[0].
   * Returns undefined when path cannot be resolved.
   */
  static resolveValue(path: string, context: TemplateContext): any {
    const segments = TemplateEngine.parsePath(path);
    let current: any = context;

    for (const segment of segments) {
      if (current === undefined || current === null) return undefined;

      if (typeof segment === 'number') {
        if (!Array.isArray(current)) return undefined;
        current = current[segment];
      } else {
        current = current[segment];
      }
    }

    return current;
  }

  private static deepResolve(value: any, context: TemplateContext): any {
    if (typeof value === 'string') {
      return TemplateEngine.resolve(value, context);
    }
    if (Array.isArray(value)) {
      return value.map((item) => TemplateEngine.deepResolve(item, context));
    }
    if (value !== null && typeof value === 'object') {
      const result: Record<string, any> = {};
      for (const key of Object.keys(value)) {
        result[key] = TemplateEngine.deepResolve(value[key], context);
      }
      return result;
    }
    return value;
  }

  /**
   * Parse a dot-path into segments, handling array bracket notation.
   * "steps.node1.output.items[0].name" → ["steps","node1","output","items",0,"name"]
   */
  private static parsePath(path: string): (string | number)[] {
    const segments: (string | number)[] = [];
    const parts = path.split('.');

    for (const part of parts) {
      const bracketMatch = /^([^[]*)\[(\d+)\]$/.exec(part);
      if (bracketMatch) {
        if (bracketMatch[1]) segments.push(bracketMatch[1]);
        segments.push(parseInt(bracketMatch[2], 10));
      } else {
        segments.push(part);
      }
    }

    return segments;
  }
}
