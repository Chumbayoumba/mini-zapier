import { Test, TestingModule } from '@nestjs/testing';
import { ActionRegistry } from '../src/engine/action-registry';
import { EngineModule } from '../src/engine/engine.module';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../src/prisma/prisma.module';

/**
 * E2E tests for AI nodes and engine action registry.
 * Verifies all node types are registered and AI actions validate inputs.
 */
describe('AI Nodes & Action Registry (e2e)', () => {
  let registry: ActionRegistry;

  beforeAll(async () => {
    // Set required env var for CredentialService
    process.env.CREDENTIAL_ENCRYPTION_KEY = Buffer.from('a'.repeat(32)).toString('base64');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot(),
        BullModule.forRoot({ connection: { host: 'localhost', port: 6379 } }),
        BullModule.registerQueue({ name: 'workflow-execution' }),
        PrismaModule,
        EngineModule,
      ],
    }).compile();

    // Trigger onModuleInit to register all handlers
    const engineModule = moduleFixture.get(EngineModule);
    engineModule.onModuleInit();

    registry = moduleFixture.get(ActionRegistry);
  }, 15000);

  describe('Action Registry', () => {
    const expectedTypes = [
      'HTTP_REQUEST', 'SEND_EMAIL', 'TELEGRAM', 'DATABASE', 'TRANSFORM',
      'IF', 'SWITCH', 'FILTER', 'SET', 'CODE', 'WAIT', 'NOOP', 'MANUAL_TRIGGER', 'LOOP', 'MERGE',
      'OPENAI', 'ANTHROPIC', 'MISTRAL', 'OPENROUTER',
    ];

    it('should have all expected action types registered', () => {
      const registered = registry.getRegisteredTypes();
      for (const type of expectedTypes) {
        expect(registered).toContain(type);
      }
    });

    it('should return correct handler for each type', () => {
      for (const type of expectedTypes) {
        expect(registry.has(type)).toBe(true);
        const handler = registry.get(type);
        expect(handler.type).toBe(type);
        expect(typeof handler.execute).toBe('function');
      }
    });
  });

  describe('OpenAI Action', () => {
    it('should reject missing API key', async () => {
      const handler = registry.get('OPENAI');
      await expect(handler.execute({ userPrompt: 'test' }))
        .rejects.toThrow('OpenAI API key is required');
    });
  });

  describe('Anthropic Action', () => {
    it('should reject missing API key', async () => {
      const handler = registry.get('ANTHROPIC');
      await expect(handler.execute({ userPrompt: 'test' }))
        .rejects.toThrow('Anthropic API key is required');
    });
  });

  describe('Mistral Action', () => {
    it('should reject missing API key', async () => {
      const handler = registry.get('MISTRAL');
      await expect(handler.execute({ userPrompt: 'test' }))
        .rejects.toThrow('Mistral API key is required');
    });
  });

  describe('OpenRouter Action', () => {
    it('should reject missing API key', async () => {
      const handler = registry.get('OPENROUTER');
      await expect(handler.execute({ userPrompt: 'test' }))
        .rejects.toThrow('OpenRouter API key is required');
    });
  });

  describe('Merge Action', () => {
    it('should append items by default', async () => {
      const handler = registry.get('MERGE');
      const result = await handler.execute({
        items: [{ id: 1 }],
        secondaryItems: [{ id: 2 }],
      });
      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('should merge by key', async () => {
      const handler = registry.get('MERGE');
      const result = await handler.execute({
        mode: 'mergeByKey',
        joinField: 'id',
        items: [{ id: 1, name: 'a' }],
        secondaryItems: [{ id: 1, extra: 'b' }],
      });
      expect(result).toEqual([{ id: 1, name: 'a', extra: 'b' }]);
    });
  });

  describe('Logic Actions', () => {
    it('IF — should evaluate condition', async () => {
      const handler = registry.get('IF');
      const result = await handler.execute({
        field: 'active',
        operator: 'equals',
        value: 'true',
        items: { active: 'true' },
      });
      expect(result).toBeDefined();
    });

    it('SET — should set fields', async () => {
      const handler = registry.get('SET');
      const result = await handler.execute({
        mode: 'set',
        fields: [{ name: 'key', value: 'val' }],
        items: {},
      });
      expect(result).toBeDefined();
    });

    it('NOOP — should pass through', async () => {
      const handler = registry.get('NOOP');
      const result = await handler.execute({ data: 'test' });
      expect(result).toBeDefined();
    });

    it('WAIT — should resolve after delay', async () => {
      const handler = registry.get('WAIT');
      const result = await handler.execute({ amount: 0.01, unit: 'seconds' });
      expect(result).toBeDefined();
    }, 5000);
  });
});
