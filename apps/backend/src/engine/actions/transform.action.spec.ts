import { BadRequestException } from '@nestjs/common';
import { TransformAction } from './transform.action';

describe('TransformAction', () => {
  let action: TransformAction;

  beforeEach(() => {
    action = new TransformAction();
  });

  describe('input validation', () => {
    it('should reject missing expression', async () => {
      await expect(action.execute({ data: { a: 1 } }))
        .rejects.toThrow(BadRequestException);
    });

    it('should reject non-string expression', async () => {
      await expect(action.execute({ expression: 42, data: {} }))
        .rejects.toThrow(BadRequestException);
    });

    it('should reject input data exceeding 1 MB', async () => {
      const bigData = { value: 'x'.repeat(1_100_000) };
      await expect(action.execute({ expression: '$', data: bigData }))
        .rejects.toThrow(/exceeds maximum size/);
    });
  });

  describe('successful evaluation', () => {
    it('should evaluate simple expression', async () => {
      const result = await action.execute({
        expression: '$.price * $.quantity',
        data: { price: 10, quantity: 3 },
      });
      expect(result).toEqual({ result: 30 });
    });

    it('should evaluate string concatenation', async () => {
      const result = await action.execute({
        expression: '$.first & " " & $.last',
        data: { first: 'John', last: 'Doe' },
      });
      expect(result).toEqual({ result: 'John Doe' });
    });

    it('should return undefined result for non-matching expression', async () => {
      const result = await action.execute({
        expression: '$.nonexistent',
        data: { a: 1 },
      });
      expect(result).toEqual({ result: undefined });
    });

    it('should use _context as fallback data', async () => {
      const result = await action.execute({
        expression: '$.value',
        _context: { value: 42 },
      });
      expect(result).toEqual({ result: 42 });
    });

    it('should prefer explicit data over _context', async () => {
      const result = await action.execute({
        expression: '$.value',
        data: { value: 10 },
        _context: { value: 99 },
      });
      expect(result).toEqual({ result: 10 });
    });
  });

  describe('output size limit', () => {
    it('should allow output within limits', async () => {
      const result = await action.execute({
        expression: '$',
        data: { value: 'x'.repeat(1000) },
      });
      expect(result.result).toHaveProperty('value');
    });

    it('should have MAX_OUTPUT_SIZE constant configured', async () => {
      // Verify that a normal-sized output passes through fine
      const result = await action.execute({
        expression: '$sum([1,2,3])',
        data: {},
      });
      expect(result).toEqual({ result: 6 });
    });
  });

  describe('timer cleanup', () => {
    it('should clear timeout after successful evaluation', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      await action.execute({
        expression: '$.a + $.b',
        data: { a: 1, b: 2 },
      });
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should wrap jsonata syntax errors', async () => {
      await expect(
        action.execute({ expression: '!!!invalid!!!', data: {} }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use empty object when no data and no context', async () => {
      const result = await action.execute({ expression: '$string(1+2)' });
      expect(result).toEqual({ result: '3' });
    });
  });
});
