import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowValidationService } from '../src/workflows/workflow-validation.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * E2E tests for workflow validation — ensures all node types validate correctly
 * before activation.
 */
describe('Workflow Validation (e2e)', () => {
  let validator: WorkflowValidationService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowValidationService,
        {
          provide: PrismaService,
          useValue: {
            integration: { findUnique: jest.fn().mockResolvedValue({ id: 'int-1', type: 'TELEGRAM' }) },
          },
        },
      ],
    }).compile();

    validator = module.get(WorkflowValidationService);
  });

  it('should reject empty workflow', async () => {
    const result = await validator.validateBeforeActivation({ definition: { nodes: [], edges: [] } });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('at least one node'))).toBe(true);
  });

  it('should reject workflow without trigger', async () => {
    const result = await validator.validateBeforeActivation({
      definition: {
        nodes: [{ id: 'a1', type: 'actionNode', data: { type: 'HTTP_REQUEST', label: 'HTTP', config: { url: 'https://example.com' } } }],
        edges: [],
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('trigger'))).toBe(true);
  });

  it('should validate CRON trigger — missing expression', async () => {
    const result = await validator.validateBeforeActivation({
      definition: {
        nodes: [{ id: 't1', type: 'triggerNode', data: { type: 'CRON', label: 'Cron', config: {} } }],
        edges: [],
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'cronExpression')).toBe(true);
  });

  it('should validate HTTP_REQUEST — missing URL', async () => {
    const result = await validator.validateBeforeActivation({
      definition: {
        nodes: [
          { id: 't1', type: 'triggerNode', data: { type: 'WEBHOOK', label: 'WH', config: {} } },
          { id: 'a1', type: 'actionNode', data: { type: 'HTTP_REQUEST', label: 'HTTP', config: {} } },
        ],
        edges: [{ source: 't1', target: 'a1' }],
      },
    });
    expect(result.errors.some((e) => e.field === 'url')).toBe(true);
  });

  it('should validate HTTP_REQUEST — invalid URL', async () => {
    const result = await validator.validateBeforeActivation({
      definition: {
        nodes: [
          { id: 't1', type: 'triggerNode', data: { type: 'WEBHOOK', label: 'WH', config: {} } },
          { id: 'a1', type: 'actionNode', data: { type: 'HTTP_REQUEST', label: 'HTTP', config: { url: 'not-a-url' } } },
        ],
        edges: [{ source: 't1', target: 'a1' }],
      },
    });
    expect(result.errors.some((e) => e.field === 'url')).toBe(true);
  });

  it('should allow template variables in URL', async () => {
    const result = await validator.validateBeforeActivation({
      definition: {
        nodes: [
          { id: 't1', type: 'triggerNode', data: { type: 'WEBHOOK', label: 'WH', config: {} } },
          { id: 'a1', type: 'actionNode', data: { type: 'HTTP_REQUEST', label: 'HTTP', config: { url: '{{trigger.url}}' } } },
        ],
        edges: [{ source: 't1', target: 'a1' }],
      },
    });
    expect(result.errors.filter((e) => e.field === 'url')).toHaveLength(0);
  });

  it('should validate SEND_EMAIL — missing recipient', async () => {
    const result = await validator.validateBeforeActivation({
      definition: {
        nodes: [
          { id: 't1', type: 'triggerNode', data: { type: 'WEBHOOK', label: 'WH', config: {} } },
          { id: 'a1', type: 'actionNode', data: { type: 'SEND_EMAIL', label: 'Email', config: { subject: 'Hi' } } },
        ],
        edges: [{ source: 't1', target: 'a1' }],
      },
    });
    expect(result.errors.some((e) => e.field === 'to')).toBe(true);
  });

  it('should validate AI nodes — missing API key', async () => {
    for (const aiType of ['OPENAI', 'ANTHROPIC', 'MISTRAL', 'OPENROUTER']) {
      const result = await validator.validateBeforeActivation({
        definition: {
          nodes: [
            { id: 't1', type: 'triggerNode', data: { type: 'WEBHOOK', label: 'WH', config: {} } },
            { id: 'a1', type: 'actionNode', data: { type: aiType, label: aiType, config: {} } },
          ],
          edges: [{ source: 't1', target: 'a1' }],
        },
      });
      expect(result.errors.some((e) => e.field === 'apiKey')).toBe(true);
    }
  });

  it('should validate AI nodes — missing userPrompt', async () => {
    const result = await validator.validateBeforeActivation({
      definition: {
        nodes: [
          { id: 't1', type: 'triggerNode', data: { type: 'WEBHOOK', label: 'WH', config: {} } },
          { id: 'a1', type: 'actionNode', data: { type: 'OPENAI', label: 'AI', config: { apiKey: 'sk-test' } } },
        ],
        edges: [{ source: 't1', target: 'a1' }],
      },
    });
    expect(result.errors.some((e) => e.field === 'userPrompt')).toBe(true);
  });

  it('should pass valid workflow', async () => {
    const result = await validator.validateBeforeActivation({
      definition: {
        nodes: [
          { id: 't1', type: 'triggerNode', data: { type: 'WEBHOOK', label: 'WH', config: {} } },
          { id: 'a1', type: 'actionNode', data: { type: 'HTTP_REQUEST', label: 'HTTP', config: { url: 'https://api.example.com' } } },
        ],
        edges: [{ source: 't1', target: 'a1' }],
      },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect disconnected nodes', async () => {
    const result = await validator.validateBeforeActivation({
      definition: {
        nodes: [
          { id: 't1', type: 'triggerNode', data: { type: 'WEBHOOK', label: 'WH', config: {} } },
          { id: 'a1', type: 'actionNode', data: { type: 'HTTP_REQUEST', label: 'HTTP', config: { url: 'https://x.com' } } },
          { id: 'a2', type: 'actionNode', data: { type: 'TRANSFORM', label: 'TF', config: { expression: '$.x' } } },
        ],
        edges: [{ source: 't1', target: 'a1' }],
      },
    });
    expect(result.errors.some((e) => e.field === 'connection')).toBe(true);
  });
});
