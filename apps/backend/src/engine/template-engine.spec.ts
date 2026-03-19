import { TemplateEngine, TemplateContext } from './template-engine';

describe('TemplateEngine', () => {
  const ctx: TemplateContext = {
    steps: {
      http1: { output: { data: { id: 42, name: 'Test' } } },
      node1: {
        output: {
          items: [
            { name: 'first', value: 10 },
            { name: 'second', value: 20 },
          ],
          token: 'abc-xyz',
          nested: { deep: { value: 'deep-val' } },
        },
      },
      auth: { output: { token: 'jwt-token-123' } },
    },
    trigger: {
      name: 'World',
      first: 'John',
      last: 'Doe',
      url: 'https://api.example.com',
      email: 'user@test.com',
      count: 0,
      active: false,
      body: { deeply: { nested: { value: 'found-it' } } },
    },
  };

  // ─── resolve() — basic interpolation ───

  describe('resolve() — basic interpolation', () => {
    it('should resolve trigger field', () => {
      expect(TemplateEngine.resolve('Hello {{trigger.name}}', ctx)).toBe('Hello World');
    });

    it('should resolve step output field', () => {
      expect(TemplateEngine.resolve('{{steps.http1.output.data.id}}', ctx)).toBe(42);
    });

    it('should resolve multiple expressions in one string', () => {
      expect(TemplateEngine.resolve('{{trigger.first}} {{trigger.last}}', ctx)).toBe('John Doe');
    });

    it('should return plain text as-is', () => {
      expect(TemplateEngine.resolve('plain text', ctx)).toBe('plain text');
    });

    it('should return empty string as-is', () => {
      expect(TemplateEngine.resolve('', ctx)).toBe('');
    });
  });

  // ─── resolve() — nested paths ───

  describe('resolve() — nested paths', () => {
    it('should resolve array index access', () => {
      expect(TemplateEngine.resolve('{{steps.node1.output.items[0].name}}', ctx)).toBe('first');
    });

    it('should resolve deeply nested trigger path', () => {
      expect(TemplateEngine.resolve('{{trigger.body.deeply.nested.value}}', ctx)).toBe('found-it');
    });

    it('should resolve second array element', () => {
      expect(TemplateEngine.resolve('{{steps.node1.output.items[1].value}}', ctx)).toBe(20);
    });
  });

  // ─── resolve() — graceful fallback ───

  describe('resolve() — graceful fallback', () => {
    it('should keep expression for missing step', () => {
      expect(TemplateEngine.resolve('{{steps.missing.output}}', ctx)).toBe(
        '{{steps.missing.output}}',
      );
    });

    it('should keep expression for partial path', () => {
      expect(
        TemplateEngine.resolve('{{steps.node1.output.nonexistent.deep}}', ctx),
      ).toBe('{{steps.node1.output.nonexistent.deep}}');
    });

    it('should keep expression for missing trigger field', () => {
      expect(TemplateEngine.resolve('{{trigger.missing}}', ctx)).toBe('{{trigger.missing}}');
    });

    it('should keep expression when trigger is undefined', () => {
      const emptyCtx: TemplateContext = { steps: {}, trigger: undefined };
      expect(TemplateEngine.resolve('{{trigger.field}}', emptyCtx)).toBe('{{trigger.field}}');
    });
  });

  // ─── resolve() — edge cases ───

  describe('resolve() — edge cases', () => {
    it('should handle falsy value 0', () => {
      expect(TemplateEngine.resolve('count: {{trigger.count}}', ctx)).toBe('count: 0');
    });

    it('should handle falsy value false', () => {
      expect(TemplateEngine.resolve('active: {{trigger.active}}', ctx)).toBe('active: false');
    });

    it('should stringify object in mixed string', () => {
      const result = TemplateEngine.resolve('data: {{steps.http1.output.data}}', ctx);
      expect(result).toBe('data: {"id":42,"name":"Test"}');
    });

    it('should return raw object for single expression', () => {
      const result = TemplateEngine.resolve('{{steps.http1.output.data}}', ctx);
      expect(result).toEqual({ id: 42, name: 'Test' });
    });

    it('should return raw array for single expression', () => {
      const result = TemplateEngine.resolve('{{steps.node1.output.items}}', ctx);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it('should leave malformed expression untouched', () => {
      expect(TemplateEngine.resolve('{{broken', ctx)).toBe('{{broken');
    });

    it('should handle expression with spaces around path', () => {
      expect(TemplateEngine.resolve('{{ trigger.name }}', ctx)).toBe('World');
    });
  });

  // ─── resolveConfig() — deep object walk ───

  describe('resolveConfig() — deep object walk', () => {
    it('should resolve flat config', () => {
      const config = { url: '{{trigger.url}}', method: 'GET' };
      const result = TemplateEngine.resolveConfig(config, ctx);
      expect(result).toEqual({ url: 'https://api.example.com', method: 'GET' });
    });

    it('should resolve nested config', () => {
      const config = {
        headers: { Authorization: 'Bearer {{steps.auth.output.token}}' },
      };
      const result = TemplateEngine.resolveConfig(config, ctx);
      expect(result).toEqual({ headers: { Authorization: 'Bearer jwt-token-123' } });
    });

    it('should resolve arrays in config', () => {
      const config = { recipients: ['{{trigger.email}}', 'admin@test.com'] };
      const result = TemplateEngine.resolveConfig(config, ctx);
      expect(result).toEqual({ recipients: ['user@test.com', 'admin@test.com'] });
    });

    it('should preserve non-string values', () => {
      const config = { timeout: 5000, retries: 3, enabled: true };
      const result = TemplateEngine.resolveConfig(config, ctx);
      expect(result).toEqual({ timeout: 5000, retries: 3, enabled: true });
    });

    it('should handle mixed string and non-string values', () => {
      const config = { body: { name: '{{trigger.name}}', count: 42 } };
      const result = TemplateEngine.resolveConfig(config, ctx);
      expect(result).toEqual({ body: { name: 'World', count: 42 } });
    });

    it('should not mutate original config', () => {
      const config = { url: '{{trigger.url}}' };
      const original = { ...config };
      TemplateEngine.resolveConfig(config, ctx);
      expect(config).toEqual(original);
    });
  });

  // ─── resolveValue() — path resolution ───

  describe('resolveValue() — path resolution', () => {
    it('should resolve simple trigger path', () => {
      expect(TemplateEngine.resolveValue('trigger.name', ctx)).toBe('World');
    });

    it('should resolve array index', () => {
      expect(TemplateEngine.resolveValue('steps.node1.output.items[0]', ctx)).toEqual({
        name: 'first',
        value: 10,
      });
    });

    it('should return undefined for out-of-bounds array', () => {
      expect(TemplateEngine.resolveValue('steps.node1.output.items[99]', ctx)).toBeUndefined();
    });

    it('should return undefined for path through null', () => {
      const nullCtx: TemplateContext = {
        steps: { node1: { output: null } },
        trigger: {},
      };
      expect(TemplateEngine.resolveValue('steps.node1.output.field', nullCtx)).toBeUndefined();
    });

    it('should return whole object at path', () => {
      expect(TemplateEngine.resolveValue('steps.http1.output.data', ctx)).toEqual({
        id: 42,
        name: 'Test',
      });
    });
  });
});
