import { ActionRegistry } from './action-registry';
import { ActionHandler } from './action-handler.interface';

describe('ActionRegistry', () => {
  let registry: ActionRegistry;

  const makeHandler = (type: string): ActionHandler => ({
    type,
    execute: jest.fn().mockResolvedValue({ ok: true }),
  });

  beforeEach(() => {
    registry = new ActionRegistry();
  });

  it('should register a handler and retrieve it by type', () => {
    const handler = makeHandler('HTTP_REQUEST');
    registry.register(handler);
    expect(registry.get('HTTP_REQUEST')).toBe(handler);
  });

  it('should throw if registering a duplicate type', () => {
    const handler1 = makeHandler('SEND_EMAIL');
    const handler2 = makeHandler('SEND_EMAIL');
    registry.register(handler1);
    expect(() => registry.register(handler2)).toThrow(
      "Action handler for type 'SEND_EMAIL' already registered",
    );
  });

  it('should throw for unknown action type on get()', () => {
    expect(() => registry.get('UNKNOWN_TYPE')).toThrow(
      'Unknown action type: UNKNOWN_TYPE',
    );
  });

  it('should return true for has() on registered type', () => {
    const handler = makeHandler('TELEGRAM');
    registry.register(handler);
    expect(registry.has('TELEGRAM')).toBe(true);
  });

  it('should return false for has() on unregistered type', () => {
    expect(registry.has('NON_EXISTENT')).toBe(false);
  });

  it('should return all registered type strings via getRegisteredTypes()', () => {
    registry.register(makeHandler('HTTP_REQUEST'));
    registry.register(makeHandler('SEND_EMAIL'));
    registry.register(makeHandler('TELEGRAM'));
    registry.register(makeHandler('DATABASE'));
    registry.register(makeHandler('TRANSFORM'));

    const types = registry.getRegisteredTypes();
    expect(types).toHaveLength(5);
    expect(types).toEqual(
      expect.arrayContaining([
        'HTTP_REQUEST',
        'SEND_EMAIL',
        'TELEGRAM',
        'DATABASE',
        'TRANSFORM',
      ]),
    );
  });

  it('should return empty array when no handlers registered', () => {
    expect(registry.getRegisteredTypes()).toEqual([]);
  });
});
