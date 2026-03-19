# Stack Research

> **Dimension**: STACK — Best practices, proven libraries, and recommended patterns
> **Project**: Mini-Zapier Workflow Automation Platform (brownfield rebuild, ~60% done)
> **Fixed Stack**: NestJS 10 · Next.js 15 · React 19 · PostgreSQL 15 · Prisma 6 · Redis 7 · BullMQ 5 · Socket.IO 4 · @xyflow/react 12

---

## Recommended Patterns

### 1. Workflow Engine — Execution Pipeline

**Current state**: `EngineService` uses Kahn's algorithm for topological sort, executes nodes sequentially. Two execution paths exist (EngineService + sandboxed `workflow.processor.ts`) creating duplication and security gaps.

**Recommended pattern — Strategy + Registry**:

Replace the action switch-case with a **Strategy pattern** backed by a DI-powered registry:

```typescript
// action-registry.ts
@Injectable()
export class ActionRegistry {
  private readonly actions = new Map<string, ActionHandler>();

  constructor(
    private readonly moduleRef: ModuleRef,
  ) {}

  register(type: string, handler: Type<ActionHandler>) {
    this.actions.set(type, this.moduleRef.get(handler, { strict: false }));
  }

  get(type: string): ActionHandler {
    const handler = this.actions.get(type);
    if (!handler) throw new UnknownActionError(type);
    return handler;
  }
}

// action-handler.interface.ts
export interface ActionHandler {
  readonly type: string;
  execute(input: ActionInput, context: ExecutionContext): Promise<ActionOutput>;
  validate?(config: unknown): ValidationResult;
}
```

**Key benefits**:
- **Open/Closed principle** — add new actions without modifying engine
- **Testable** — each action is independently injectable and mockable
- **Discoverable** — use `DiscoveryService` from `@nestjs/core` to auto-register via decorator

**Consolidate execution paths** (CRITICAL):
- Remove the duplicated logic in `workflow.processor.ts`
- BullMQ processor should ONLY call `EngineService.executeWorkflow()` — single source of truth
- All security (SSRF protection, timeouts, input validation) lives in one place

### 2. NestJS Architecture — Event-Driven with Lightweight CQRS

**Recommendation**: Keep EventEmitter2 for in-process event bridging (it works well for this scale), but adopt CQRS *selectively* for the execution pipeline:

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ REST API     │────▶│ CommandBus   │────▶│ ExecuteWorkflow│
│ Controller   │     │ (dispatch)   │     │ Handler        │
└─────────────┘     └──────────────┘     └───────┬───────┘
                                                  │
                    ┌──────────────┐              │
                    │ EventBus     │◀─────────────┘
                    │ (publish)    │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         WebSocket    ExecutionLog   Metrics
         Gateway      Persistence   Collection
```

**When NOT to use CQRS**: Simple CRUD operations (workflow management, user settings). Keep those as standard NestJS services.

**When to use CQRS**: Workflow execution pipeline where you need:
- Audit trail of every state change
- Multiple side effects per event (logging, WebSocket, metrics)
- Ability to replay/retry from any checkpoint

### 3. BullMQ — Production-Grade Queue Patterns

**FlowProducer for multi-step workflows** (future enhancement):

```typescript
// For workflows with independent branches
const flowProducer = new FlowProducer({ connection: redisConfig });

await flowProducer.add({
  name: 'workflow-root',
  queueName: 'workflow-orchestrator',
  data: { workflowId, executionId },
  children: [
    { name: 'branch-a', queueName: 'workflow-steps', data: { ... } },
    { name: 'branch-b', queueName: 'workflow-steps', data: { ... } },
  ],
});
```

**Dead Letter Queue (DLQ) pattern** (MUST implement):

```typescript
// queue.service.ts
@Injectable()
export class QueueService {
  private dlqQueue: Queue;

  constructor() {
    this.dlqQueue = new Queue('workflow-dlq', { connection: redisConfig });
  }

  setupWorker() {
    const worker = new Worker('workflow-execution', processor, {
      connection: redisConfig,
      concurrency: 5,
    });

    worker.on('failed', async (job, error) => {
      if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
        await this.dlqQueue.add('failed-execution', {
          originalJobId: job.id,
          workflowId: job.data.workflowId,
          error: error.message,
          stackTrace: error.stack,
          attemptsMade: job.attemptsMade,
          failedAt: new Date().toISOString(),
        });
      }
    });
  }
}
```

**Recommended BullMQ configuration**:

```typescript
BullModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    connection: {
      host: config.get('REDIS_HOST'),
      port: config.get('REDIS_PORT'),
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
    },
  }),
});

// Per-queue defaults
{
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 86400, count: 1000 }, // 24h or 1000 jobs
    removeOnFail: { age: 604800, count: 5000 },     // 7 days or 5000 jobs
  },
  settings: {
    stalledInterval: 30000,    // Check stalled jobs every 30s
    maxStalledCount: 2,        // Allow 2 stall recoveries before failing
  },
}
```

### 4. @xyflow/react 12 — Editor Patterns

**Node type registry** (mirrors backend action registry):

```typescript
// node-types.ts
import { type NodeTypes } from '@xyflow/react';

export const nodeTypes: NodeTypes = {
  trigger: memo(TriggerNode),
  action: memo(ActionNode),
  condition: memo(ConditionNode),  // future
  delay: memo(DelayNode),          // future
} satisfies NodeTypes;

// CRITICAL: Define outside component to prevent re-creation on render
```

**Performance optimization** — current code is mostly correct (memo on nodes), but add:

```typescript
// Stable callback references with useCallback
const onNodesChange = useCallback((changes: NodeChange[]) => {
  setNodes((nds) => applyNodeChanges(changes, nds));
}, []);

const onEdgesChange = useCallback((changes: EdgeChange[]) => {
  setEdges((eds) => applyEdgeChanges(changes, eds));
}, []);

const onConnect = useCallback((params: Connection) => {
  setEdges((eds) => addEdge({ ...params, type: 'animated' }, eds));
}, []);
```

**v12 features to leverage**:
- `node.measured.width/height` — for layout calculations (SSR-compatible)
- `colorMode` prop — dark mode support with CSS variables
- Controlled viewport — `<ReactFlow viewport={viewport} onViewportChange={setViewport} />`
- `<MiniMap />`, `<Controls />`, `<Background />` as children of ReactFlow

**Undo/Redo pattern** (recommended for workflow editor):

```typescript
// Use zustand middleware for temporal state
import { temporal } from 'zundo';

const useEditorStore = create<EditorState>()(
  temporal(
    (set, get) => ({
      nodes: [],
      edges: [],
      // ... state
    }),
    { limit: 50 } // Keep 50 undo steps
  )
);

// Usage: useEditorStore.temporal.getState().undo()
```

### 5. Prisma — Data Access Patterns

**Append-only execution logs** (current schema is correct, optimize usage):

```typescript
// Batch insert step logs for performance
await prisma.executionStepLog.createMany({
  data: stepResults.map((step) => ({
    executionId,
    nodeId: step.nodeId,
    nodeName: step.name,
    nodeType: step.type,
    status: step.status,
    input: step.input as Prisma.JsonObject,
    output: step.output as Prisma.JsonObject,
    error: step.error,
    duration: step.duration,
    startedAt: step.startedAt,
    completedAt: step.completedAt,
  })),
});
```

**Cursor-based pagination** (for execution history):

```typescript
async getExecutions(workflowId: string, cursor?: string, take = 20) {
  return this.prisma.workflowExecution.findMany({
    where: { workflowId },
    take: take + 1, // Fetch one extra to determine hasMore
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1, // Skip the cursor itself
    }),
    orderBy: { createdAt: 'desc' },
    include: {
      stepLogs: {
        orderBy: { startedAt: 'asc' },
      },
    },
  });
}
```

**Transaction for execution state consistency**:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Update execution status
  await tx.workflowExecution.update({
    where: { id: executionId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  // 2. Batch insert step logs
  await tx.executionStepLog.createMany({ data: stepLogs });

  // 3. Update workflow stats (lastRunAt, runCount)
  await tx.workflow.update({
    where: { id: workflowId },
    data: {
      lastRunAt: new Date(),
      runCount: { increment: 1 },
    },
  });
});
```

### 6. Socket.IO — Real-time Event Architecture

**Typed events** (add type safety to current implementation):

```typescript
// packages/shared/src/events.ts
export interface ServerToClientEvents {
  'execution:started': (data: { executionId: string; workflowId: string }) => void;
  'execution:step:completed': (data: StepCompletedPayload) => void;
  'execution:completed': (data: ExecutionCompletedPayload) => void;
  'execution:failed': (data: ExecutionFailedPayload) => void;
}

export interface ClientToServerEvents {
  'subscribe:execution': (executionId: string) => void;
  'subscribe:workflow': (workflowId: string) => void;
  'unsubscribe:execution': (executionId: string) => void;
}
```

**Redis adapter for horizontal scaling** (preparation):

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

// In WebSocketGateway afterInit:
const pubClient = createClient({ url: redisUrl });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);
server.adapter(createAdapter(pubClient, subClient));
```

---

## Library Recommendations

### Must-Add Libraries

| Library | Purpose | Why |
|---------|---------|-----|
| `isolated-vm` | Secure code execution for Transform action | vm2 is DEPRECATED with critical CVEs. isolated-vm uses V8 isolates — proper sandbox boundary |
| `zundo` | Undo/redo for workflow editor | Zustand middleware, lightweight, perfect for React Flow editor state |
| `@socket.io/redis-adapter` | WebSocket horizontal scaling | Required for multi-instance deployment; already using Redis |
| `helmet` | HTTP security headers | Already standard for NestJS; missing from current setup |
| `@nestjs/throttler` | Rate limiting | Already in codebase but needs proper configuration per endpoint |
| `pino` + `nestjs-pino` | Structured logging | JSON logging with request context, log levels, performance |
| `bull-board` or `@bull-board/nestjs` | Queue monitoring dashboard | Visual monitoring of BullMQ jobs, DLQ inspection, job retry |

### Recommended Libraries (Nice-to-Have)

| Library | Purpose | Why |
|---------|---------|-----|
| `@nestjs/cqrs` | Command/Query separation | For execution pipeline only, not for simple CRUD |
| `ioredis` | Redis client (already present) | Keep for direct Redis operations (caching, distributed locks) |
| `p-limit` | Concurrency control | Limit parallel HTTP requests within an action to prevent overwhelming targets |
| `@xyflow/react` helpers (`dagre`, `elkjs`) | Auto-layout | Automatic workflow graph layout using Dagre or ELK algorithms |
| `class-transformer` + `class-validator` | DTO validation | Already in NestJS ecosystem; strengthen WebSocket payload validation |
| `ms` | Duration parsing | Human-readable durations for timeouts/delays ("5m", "1h") |

### Libraries to AVOID

| Library | Reason |
|---------|--------|
| `vm2` | DEPRECATED. Critical sandbox escape CVEs (CVE-2023-29017, CVE-2023-30547, CVE-2026-22709). No safe future |
| `node:vm` | Explicitly unsafe for untrusted code per Node.js docs |
| `safeify` | Wrapper around vm2 — inherits all its vulnerabilities |
| `@nestjs/microservices` | Over-engineering for single-service deployment; EventEmitter2 suffices |
| `graphql` / `@nestjs/graphql` | REST is fine for this project scope; adding GraphQL adds complexity without benefit |

---

## Configuration Best Practices

### Redis 7 Configuration

```typescript
// Shared Redis config (ioredis)
const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,    // BullMQ requirement
  enableReadyCheck: false,       // BullMQ requirement
  retryStrategy: (times: number) => Math.min(times * 200, 5000),
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    return err.message.includes(targetError);
  },
};
```

**Redis key namespacing**:
```
bull:workflow-execution:*     — BullMQ jobs
bull:workflow-dlq:*           — Dead letter queue
cache:workflow:{id}           — Cached workflow definitions
lock:execution:{id}           — Distributed execution locks
ws:rooms:*                    — Socket.IO adapter
```

### Prisma 6 Configuration

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearch", "metrics"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Connection pool** (production):
```
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10"
```

**Prisma best practices for this project**:
- Use `$transaction` for execution state updates (status + logs atomic)
- Use `createMany` for batch step log inserts (10x faster than individual creates)
- Use cursor pagination for execution history (stable, index-friendly)
- Index `(workflowId, createdAt)` on WorkflowExecution for fast queries
- JSON field queries: use `JsonFilter` for querying inside `definition` field
- Enable query logging in development: `prisma.$on('query', (e) => logger.debug(e))`

### BullMQ 5 Configuration

**Queue architecture**:

```
workflow-execution      — Main execution queue (concurrency: 5)
workflow-dlq            — Failed jobs after all retries
workflow-scheduled      — Cron/scheduled triggers (future)
workflow-notifications  — Email/Telegram notifications (future, separate concern)
```

**Worker configuration**:
```typescript
new Worker('workflow-execution', processor, {
  connection: redisConfig,
  concurrency: 5,                    // 5 parallel executions
  lockDuration: 300000,              // 5 min lock (for long workflows)
  lockRenewTime: 150000,             // Renew at half-lock
  stalledInterval: 30000,
  limiter: {
    max: 100,                        // Max 100 jobs per minute
    duration: 60000,
  },
});
```

### Socket.IO 4 Configuration

```typescript
@WebSocketGateway({
  namespace: '/executions',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  transports: ['websocket', 'polling'], // Prefer WebSocket, fallback to polling
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e6,              // 1MB max payload
})
```

**Client reconnection** (improve current 10-attempt limit):
```typescript
const socket = io(WS_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: Infinity,      // Never stop trying
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,         // Cap at 30s between attempts
  randomizationFactor: 0.5,           // Jitter to prevent thundering herd
  auth: { token: accessToken },
});
```

---

## Testing Strategy

### Backend Testing (NestJS + Jest)

**Unit tests** — current pattern in `engine.service.spec.ts` is good, expand to:

```typescript
// Pattern: Mock Prisma with a factory
const mockPrismaService = {
  workflowExecution: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  executionStepLog: {
    createMany: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(mockPrismaService)),
};

// Pattern: Test each action handler independently
describe('HttpRequestAction', () => {
  let action: HttpRequestAction;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        HttpRequestAction,
        { provide: HttpService, useValue: { axiosRef: { request: jest.fn() } } },
      ],
    }).compile();
    action = module.get(HttpRequestAction);
  });

  it('should make GET request with correct headers', async () => { ... });
  it('should timeout after configured duration', async () => { ... });
  it('should block SSRF to private IPs', async () => { ... });
  it('should handle non-2xx response', async () => { ... });
});
```

**Integration tests** — test engine + queue + database together:

```typescript
describe('Workflow Execution Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let queueService: QueueService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(/* external services */)
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  it('should execute workflow end-to-end and persist logs', async () => {
    // 1. Create workflow in DB
    // 2. Enqueue execution
    // 3. Wait for BullMQ processing
    // 4. Verify execution status + step logs in DB
    // 5. Verify WebSocket events emitted
  });
});
```

**BullMQ testing pattern**:
```typescript
// Use IORedis mock or testcontainers for Redis
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis-mock';

const connection = new IORedis();
const testQueue = new Queue('test', { connection });
const testWorker = new Worker('test', processor, { connection });

// Or with @testcontainers/redis for real Redis:
const redis = await new GenericContainer('redis:7-alpine')
  .withExposedPorts(6379)
  .start();
```

### Frontend Testing (Vitest + React Testing Library)

**Component tests**:

```typescript
// action-node.test.tsx
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { ActionNode } from './action-node';

const wrapper = ({ children }) => (
  <ReactFlowProvider>{children}</ReactFlowProvider>
);

describe('ActionNode', () => {
  it('renders node with correct label', () => {
    render(
      <ActionNode
        id="1"
        data={{ label: 'Send Email', type: 'email', config: {} }}
        selected={false}
      />,
      { wrapper },
    );
    expect(screen.getByText('Send Email')).toBeInTheDocument();
  });

  it('shows selected state', () => { ... });
  it('displays error indicator on failed status', () => { ... });
});
```

**Hook tests**:

```typescript
// use-websocket.test.ts
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from './use-websocket';

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    connected: true,
  })),
}));

describe('useWebSocket', () => {
  it('connects with auth token', () => { ... });
  it('subscribes to execution events', () => { ... });
  it('handles reconnection', () => { ... });
});
```

**E2E tests** (Playwright — recommended for test assignment):

```typescript
// e2e/workflow-builder.spec.ts
import { test, expect } from '@playwright/test';

test('create and execute a workflow', async ({ page }) => {
  await page.goto('/workflows/new');

  // Add trigger node
  await page.getByRole('button', { name: /webhook/i }).click();

  // Add action node
  await page.getByRole('button', { name: /http request/i }).click();

  // Connect nodes (drag from handle to handle)
  // Configure action
  // Save workflow
  // Execute workflow
  // Verify execution result appears in UI
});
```

### Test Coverage Targets

| Area | Current | Target | Priority |
|------|---------|--------|----------|
| Engine Service | ~50% (11 tests) | 90% | P0 |
| Action Handlers | 0% | 85% | P0 |
| Queue Service | 0% | 80% | P1 |
| WebSocket Gateway | 0% | 70% | P1 |
| Frontend Components | 0% | 60% | P2 |
| Frontend Hooks | 0% | 75% | P1 |
| E2E Flows | 0% | 3-5 critical paths | P2 |

---

## Key Decisions

### Decision 1: Consolidate Execution Paths (CRITICAL)

**Problem**: Two execution paths — `EngineService` (main) and `workflow.processor.ts` (sandboxed BullMQ). The processor DUPLICATES engine logic AND bypasses all security measures (no SSRF protection, no timeouts, DB action is a stub).

**Decision**: **Single execution path through EngineService**

```
API Request → QueueService.enqueue() → BullMQ Worker → EngineService.executeWorkflow()
```

- Delete the duplicated execution logic in `workflow.processor.ts`
- BullMQ processor becomes a thin wrapper that calls `EngineService`
- ALL security, validation, and timeout logic lives in EngineService and its action handlers
- This eliminates the #1 critical security vulnerability

### Decision 2: Sandboxing Strategy for Transform Action

**Problem**: Transform action uses JSONata (safe) but codebase has a sandboxed processor that was meant for arbitrary code execution. vm2 is DEPRECATED with critical CVEs.

**Decision**: **Use `isolated-vm` for any future code execution needs**

For current scope:
- **JSONata** (already in use) is safe for data transformation — runs in a restricted expression evaluator, NOT arbitrary JS
- **No arbitrary code execution** in MVP scope — all actions are predefined (HTTP, Email, Telegram, DB, Transform)
- If custom code execution is needed later: use `isolated-vm` with strict memory/time limits

```typescript
import ivm from 'isolated-vm';

async function executeUserCode(code: string, input: unknown): Promise<unknown> {
  const isolate = new ivm.Isolate({ memoryLimit: 32 }); // 32MB limit
  const context = await isolate.createContext();

  // Inject input as read-only
  await context.global.set('input', new ivm.ExternalCopy(input).copyInto());

  const script = await isolate.compileScript(code);
  const result = await script.run(context, { timeout: 5000 }); // 5s timeout

  isolate.dispose();
  return result;
}
```

### Decision 3: State Management Boundary

**Problem**: Need clear separation between server state and editor state.

**Decision**: **TanStack Query for server state, Zustand for editor state**

```
Server State (TanStack Query)     Editor State (Zustand)
├── Workflows list                ├── nodes / edges (React Flow)
├── Execution history             ├── selectedNode
├── Dashboard stats               ├── isDirty
├── User profile                  ├── viewport
└── Integrations                  ├── undoHistory (via zundo)
                                  └── clipboard
```

- Never duplicate server data in Zustand
- Zustand store handles ONLY transient editor state
- TanStack Query handles caching, refetching, optimistic updates
- Use `queryClient.invalidateQueries()` after mutations

### Decision 4: WebSocket Event Flow

**Problem**: Current implementation broadcasts globally AND to rooms, creating potential duplication.

**Decision**: **Scoped room-based events with typed contracts**

```
EventEmitter2                   Socket.IO Rooms
execution.started      ──────▶  room: execution:{id}
execution.step.started ──────▶  room: execution:{id}
execution.step.completed ────▶  room: execution:{id}
execution.completed    ──────▶  room: execution:{id} + room: workflow:{wfId}
execution.failed       ──────▶  room: execution:{id} + room: workflow:{wfId}
```

- Only `completed` and `failed` events broadcast to the workflow room (for dashboard/list updates)
- Step-level events go ONLY to the execution room (subscribers watching specific execution)
- Define shared event types in `packages/shared` for type safety across frontend/backend

### Decision 5: Error Handling Architecture

**Problem**: No consistent error handling across actions, engine, queue, and API layer.

**Decision**: **Layered error handling with domain-specific exceptions**

```typescript
// Domain errors
class WorkflowExecutionError extends Error {
  constructor(
    public readonly executionId: string,
    public readonly nodeId: string,
    public readonly cause: Error,
  ) {
    super(`Execution ${executionId} failed at node ${nodeId}: ${cause.message}`);
  }
}

class ActionTimeoutError extends WorkflowExecutionError {}
class ActionValidationError extends WorkflowExecutionError {}
class SSRFBlockedError extends WorkflowExecutionError {}
```

Error flow:
1. **Action level** — catch, wrap in domain error, log step as FAILED
2. **Engine level** — catch, determine if retryable, update execution status
3. **Queue level** — BullMQ handles retries per backoff config, DLQ on exhaustion
4. **API level** — NestJS exception filters return appropriate HTTP status
5. **WebSocket** — emit `execution:failed` event with error details

### Decision 6: Security Hardening Priority

Based on codebase audit findings, fix order:

| # | Issue | Fix | Effort |
|---|-------|-----|--------|
| 1 | Sandboxed processor bypasses security | Consolidate to single EngineService path | Medium |
| 2 | Hardcoded JWT secret in frontend middleware | Use env var, fail if not set | Low |
| 3 | DatabaseAction exposes app tables | Restrict to separate read-only schema/role or remove | Low |
| 4 | Hardcoded DB creds in docker-compose | Use `.env` file with `.env.example` template | Low |
| 5 | Token storage in localStorage | Move to httpOnly cookie or in-memory with refresh token | Medium |
| 6 | No input validation on action configs | Add Zod/class-validator schemas per action type | Medium |
| 7 | No CORS restriction | Configure `origin` from env var | Low |
| 8 | No rate limiting on execution endpoint | Configure `@nestjs/throttler` per endpoint | Low |

---

## Appendix: Version Compatibility Matrix

| Package | Current Version | Latest Stable | Notes |
|---------|----------------|---------------|-------|
| `@nestjs/core` | 10.x | 10.x | Stay on v10; v11 is breaking |
| `next` | 15.1 | 15.x | Good, App Router stable |
| `react` | 19.0 | 19.x | Good, use new features (use, Actions) |
| `@prisma/client` | 6.0 | 6.x | Good, accelerate/pulse available |
| `bullmq` | 5.25 | 5.x | Good, FlowProducer stable |
| `socket.io` | 4.8 | 4.x | Good, v5 in alpha — stay on v4 |
| `@xyflow/react` | 12.3 | 12.x | Good, v12 is latest stable |
| `zustand` | 5.0 | 5.x | Good, new API with `use()` |
| `@tanstack/react-query` | 5.60 | 5.x | Good, stable |
| `ioredis` | 5.4 | 5.x | Good, widely used |

All dependencies are on latest major versions — no urgent upgrades needed.
