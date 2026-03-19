# Architecture Research

> Dimension: ARCHITECTURE | Date: 2025-01-30 | Status: Complete
> Stack: NestJS 10 + Next.js 15 + PostgreSQL 15 + Redis 7 + BullMQ

---

## System Components

### Current State

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Nginx (:80)                                  │
│  /api/* → backend:3001   /* → frontend:3000   /socket.io → ws:3001  │
└─────────┬───────────────────────────┬───────────────────────────────┘
          │                           │
    ┌─────▼──────┐              ┌─────▼──────┐
    │  NestJS    │              │  Next.js   │
    │  Backend   │◄──Socket.IO──│  Frontend  │
    │  :3001     │              │  :3000     │
    └──┬────┬────┘              └────────────┘
       │    │
  ┌────▼┐ ┌─▼─────┐
  │ PG  │ │ Redis │
  │5432 │ │ 6379  │
  └─────┘ └───────┘
```

### Recommended Target Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              Nginx (:80/:443)                            │
│  /api/* → backend    /* → frontend    /socket.io → backend (upgrade)     │
└────────┬────────────────────────────┬────────────────────────────────────┘
         │                            │
   ┌─────▼───────────────┐     ┌──────▼──────┐
   │   NestJS Backend    │     │  Next.js    │
   │                     │     │  Frontend   │
   │  ┌───────────────┐  │     │             │
   │  │ API Layer     │  │     │  Zustand    │
   │  │ (Controllers) │  │     │  + React    │
   │  ├───────────────┤  │     │  Query      │
   │  │ Service Layer │  │     │  + React    │
   │  │ (Business)    │  │     │  Flow       │
   │  ├───────────────┤  │     └─────────────┘
   │  │ Engine Core   │  │
   │  │ (DAG Runner)  │  │
   │  ├───────────────┤  │
   │  │ Action Plugins│  │
   │  │ (Sandboxed)   │  │
   │  ├───────────────┤  │
   │  │ Queue Layer   │  │
   │  │ (BullMQ)      │  │
   │  ├───────────────┤  │
   │  │ WS Gateway    │  │
   │  │ (Socket.IO)   │  │
   │  └───────────────┘  │
   └──┬──────────┬───────┘
      │          │
 ┌────▼──┐  ┌───▼────┐
 │  PG   │  │ Redis  │
 │ 5432  │  │ 6379   │
 └───────┘  └────────┘
```

**Key Change:** Eliminate the dual execution path (EngineService vs sandboxed processor). All executions flow through the queue → EngineService within the main process.

---

## Data Flow

### Execution Data Flow (Recommended)

```
[Trigger] ──→ [Queue] ──→ [Engine] ──→ [Actions] ──→ [DB + Events]

1. Trigger fires (webhook POST / cron tick / email poll / telegram update)
2. QueueService.addExecution(workflowId, triggerData) → BullMQ job
3. WorkflowProcessor.process(job) → EngineService.executeWorkflow()
4. EngineService:
   a. Create WorkflowExecution record (RUNNING)
   b. Emit 'execution.started' → WebSocket + Notifications
   c. Topological sort DAG → execution order
   d. For each node:
      - Create ExecutionStepLog (RUNNING)
      - Emit 'step.started'
      - Execute action via ActionRegistry
      - Store result in context.stepResults[nodeId]
      - Update StepLog (COMPLETED/FAILED)
      - Emit 'step.completed' / 'step.failed'
   e. Update WorkflowExecution (COMPLETED/FAILED)
   f. Emit 'execution.completed' / 'execution.failed'
5. WebSocket gateway broadcasts to rooms
6. Frontend React Query invalidates, UI updates
```

### Event Flow

```
EngineService
  ├── emit('execution.started')  → WebSocketGateway → clients
  ├── emit('step.started')       → WebSocketGateway → clients
  ├── emit('step.completed')     → WebSocketGateway → clients
  ├── emit('step.failed')        → WebSocketGateway → clients
  ├── emit('execution.completed')→ WebSocketGateway → clients
  └── emit('execution.failed')   → WebSocketGateway → clients
                                 → NotificationsService → Telegram/Email alerts
```

**Recommendation:** All trigger types MUST go through the queue. Currently webhooks and manual execute bypass the queue, causing:
- HTTP response blocked until workflow completes
- No BullMQ retry for failed executions
- Server overwhelmed under burst traffic

---

## Module Structure (Backend)

### Current Modules (Working)

```
AppModule
├── ConfigModule (global)
├── PrismaModule (global)
├── AuthModule
├── UsersModule
├── WorkflowsModule
├── ExecutionsModule
├── EngineModule
│   ├── EngineService (orchestrator)
│   ├── HttpRequestAction
│   ├── EmailAction
│   ├── TelegramAction
│   ├── DatabaseAction
│   └── TransformAction
├── TriggersModule
│   ├── WebhookController + Service
│   ├── CronService
│   ├── EmailTriggerService
│   └── TelegramTriggerController + Service
├── QueueModule
│   ├── QueueService
│   └── WorkflowProcessor
├── WebSocketModule
│   └── WebSocketGateway
├── NotificationsModule
│   └── NotificationsService
├── HealthModule
├── ThrottlerModule
├── EventEmitterModule
└── ScheduleModule
```

### Recommended Module Refactoring

```
AppModule
├── CoreModule (global)          — NEW: Config, Prisma, EventEmitter, common guards/pipes
│   ├── ConfigModule
│   ├── PrismaModule
│   └── EventEmitterModule
│
├── AuthModule                   — KEEP as-is, fix hardcoded secret fallback
│
├── UsersModule                  — KEEP as-is
│
├── WorkflowsModule              — KEEP, add workflow.activated/deactivated events
│
├── ExecutionsModule             — KEEP, fix retry to actually enqueue job
│
├── EngineModule                 — REFACTOR: single execution path
│   ├── EngineService            — Core orchestrator (only execution path)
│   ├── ActionRegistry           — NEW: Map<ActionType, ActionHandler> pattern
│   ├── actions/
│   │   ├── action.interface.ts  — NEW: { execute(config, context): Promise<ActionResult> }
│   │   ├── http-request.action.ts
│   │   ├── email.action.ts
│   │   ├── telegram.action.ts
│   │   ├── database.action.ts
│   │   └── transform.action.ts
│   └── context/
│       └── execution-context.ts — NEW: typed context with stepResults
│
├── TriggersModule               — REFACTOR: all triggers route through queue
│   ├── webhook/
│   ├── cron/                    — FIX: listen to workflow.activated/deactivated events
│   ├── email/                   — FIX: add trigger.fired event handler
│   └── telegram/
│
├── QueueModule                  — REFACTOR: remove sandboxed processor
│   ├── QueueService
│   └── WorkflowProcessor       — Simplified: just calls EngineService
│
├── WebSocketModule              — FIX: add room-join authorization
│
├── NotificationsModule          — KEEP, add success notification option
│
└── HealthModule                 — KEEP
```

### Action Registry Pattern (Recommended)

Replace the switch-case dispatch with a registry:

```typescript
// action.interface.ts
export interface ActionHandler {
  readonly type: string;
  execute(config: ActionConfig, context: ExecutionContext): Promise<ActionResult>;
}

// action-registry.ts
@Injectable()
export class ActionRegistry {
  private handlers = new Map<string, ActionHandler>();

  register(handler: ActionHandler) {
    this.handlers.set(handler.type, handler);
  }

  get(type: string): ActionHandler {
    const handler = this.handlers.get(type);
    if (!handler) throw new BadRequestException(`Unknown action type: ${type}`);
    return handler;
  }

  getAll(): Map<string, ActionHandler> {
    return this.handlers;
  }
}

// engine.module.ts — auto-register all handlers
@Module({
  providers: [
    EngineService,
    ActionRegistry,
    HttpRequestAction,
    EmailAction,
    TelegramAction,
    DatabaseAction,
    TransformAction,
  ],
})
export class EngineModule implements OnModuleInit {
  constructor(
    private registry: ActionRegistry,
    private http: HttpRequestAction,
    private email: EmailAction,
    private telegram: TelegramAction,
    private db: DatabaseAction,
    private transform: TransformAction,
  ) {}

  onModuleInit() {
    [this.http, this.email, this.telegram, this.db, this.transform]
      .forEach(h => this.registry.register(h));
  }
}
```

**Benefits:** Adding new actions requires only creating a class and adding it to providers — no switch-case changes.

---

## Workflow Execution Architecture

### DAG Execution (Current)

Current implementation uses Kahn's algorithm for topological sort, then sequential execution:

```typescript
// Current: Linear execution of topologically sorted nodes
const order = topologicalSort(nodes, edges); // Kahn's algorithm
for (const node of order) {
  await executeStep(node, context); // Sequential, fail-fast
}
```

**Limitation:** No parallel execution of independent branches. A DAG like:
```
Trigger → [A, B] → C
```
Executes A → B → C sequentially, even though A and B could run in parallel.

### Recommended Execution Model

For this project scope (тестовое задание), keep **sequential execution** but prepare the architecture for future parallelism:

```typescript
// Recommended: Keep sequential but with proper state machine
interface ExecutionContext {
  executionId: string;
  workflowId: string;
  triggerData: Record<string, unknown>;
  stepResults: Map<string, ActionResult>;
  integrations: Record<string, unknown>;
  status: ExecutionStatus;
  abortSignal: AbortSignal; // For cancellation support
}

// Step state machine
enum StepStatus {
  PENDING   → RUNNING   // Step picked up for execution
  RUNNING   → COMPLETED // Action succeeded
  RUNNING   → FAILED    // Action threw error
  PENDING   → SKIPPED   // Conditional branch not taken (future)
}

// Execution state machine
enum ExecutionStatus {
  PENDING    → RUNNING    // First step starts
  RUNNING    → COMPLETED  // All steps done
  RUNNING    → FAILED     // Step failed, no more retries
  RUNNING    → CANCELLED  // User cancelled via API
  PENDING    → CANCELLED  // Cancelled before start
}
```

### Future: Parallel Branch Execution

When needed, the architecture supports this upgrade:

```typescript
// Group nodes into levels (nodes at same topo-sort level can run in parallel)
function groupByLevel(nodes, edges): Node[][] {
  // Level 0: nodes with no incoming edges (trigger)
  // Level 1: nodes whose all predecessors are in level 0
  // Level N: nodes whose all predecessors are in levels < N
  // Nodes within same level can execute in parallel
}

// Execute levels sequentially, nodes within level in parallel
for (const level of levels) {
  await Promise.all(level.map(node => executeStep(node, context)));
}
```

### Conditional Branching (Future Enhancement)

```typescript
// Edge with condition
interface ConditionalEdge {
  id: string;
  source: string;
  target: string;
  condition?: {
    field: string;      // e.g., "stepResults.action-1.status"
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
    value: unknown;
  };
}

// In execution: evaluate edge conditions before following
function shouldFollow(edge: ConditionalEdge, context: ExecutionContext): boolean {
  if (!edge.condition) return true; // Default: always follow
  return evaluateCondition(edge.condition, context);
}
```

---

## Queue Architecture

### Current BullMQ Setup

```
Single queue: "workflow-execution"
Job type: "execute"
Payload: { workflowId, triggerData }
Retry: 3 attempts, exponential backoff (5s base)
Cleanup: keep last 100 completed, 200 failed
```

### Recommended Queue Architecture

Keep the **single queue** approach — it's appropriate for this project's scale:

```typescript
// queue.service.ts — enhanced
@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('workflow-execution')
    private executionQueue: Queue,
  ) {}

  // Primary method — all triggers call this
  async enqueue(
    workflowId: string,
    triggerData?: Record<string, unknown>,
    options?: {
      priority?: number;     // 1=highest, default=10
      delay?: number;        // ms delay before processing
      jobId?: string;        // Idempotency key (prevent duplicates)
    },
  ): Promise<string> {
    const job = await this.executionQueue.add(
      'execute',
      { workflowId, triggerData },
      {
        priority: options?.priority ?? 10,
        delay: options?.delay ?? 0,
        jobId: options?.jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 },
      },
    );
    return job.id!;
  }

  // Queue health for dashboard
  async getStats(): Promise<QueueStats> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.executionQueue.getWaitingCount(),
      this.executionQueue.getActiveCount(),
      this.executionQueue.getCompletedCount(),
      this.executionQueue.getFailedCount(),
      this.executionQueue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }
}
```

### Why Single Queue (Not Per-Trigger)

| Approach | Pros | Cons |
|----------|------|------|
| Single queue | Simple, BullMQ handles concurrency, easy monitoring | All workflows compete for workers |
| Per-trigger queue | Isolation between trigger types | Complexity explosion, harder to monitor |
| Per-workflow queue | Perfect isolation | N queues for N workflows — unmanageable |

**Decision:** Single queue with priority. Webhook triggers get priority=5 (faster response), cron gets priority=15 (background). This is sufficient for a тестовое задание scope.

### BullMQ Flow Producers (For Future DAG Parallelism)

BullMQ supports `FlowProducer` for parent-child job dependencies. This maps directly to DAG execution:

```typescript
// Future: Use FlowProducer for parallel step execution
const flowProducer = new FlowProducer({ connection: redisConnection });

const flow = await flowProducer.add({
  name: 'execution-complete',
  queueName: 'workflow-execution',
  data: { executionId },
  children: [
    { name: 'step', queueName: 'workflow-steps', data: { nodeId: 'action-1', ... } },
    { name: 'step', queueName: 'workflow-steps', data: { nodeId: 'action-2', ... } },
  ],
});
// Children execute in parallel, parent waits for all to complete
```

**Not recommended for current scope** — adds complexity without clear benefit for sequential execution.

---

## Frontend Architecture

### State Management Design

```
┌──────────────────────────────────────────────────────────────┐
│                    Frontend State Layers                       │
├──────────────┬───────────────────────────────────────────────┤
│ Server State │ React Query (@tanstack/react-query)           │
│              │ - Workflows list, detail                       │
│              │ - Executions list, detail, stats               │
│              │ - Dashboard data (stats, charts)               │
│              │ - Cache invalidation on mutations              │
│              │ - Auto-refetch for running executions (3s)     │
├──────────────┼───────────────────────────────────────────────┤
│ Client State │ Zustand stores                                 │
│              │ - AuthStore: user, tokens, isAuthenticated     │
│              │ - EditorStore: nodes, edges, selectedNode      │
├──────────────┼───────────────────────────────────────────────┤
│ Real-time    │ Socket.IO (useWebSocket hook)                  │
│              │ - execution:started/completed/failed            │
│              │ - step:started/completed/failed                 │
│              │ - Invalidates React Query on events             │
└──────────────┴───────────────────────────────────────────────┘
```

**Recommendation:** This split is correct. Keep it. No need for Redux or other state libs.

### Editor Store Improvements

Current store is functional but needs:

```typescript
// Recommended editor-store.ts shape
interface EditorStore {
  // === Canvas State ===
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  integrations: WorkflowIntegrations;

  // === UI State (NEW) ===
  isDirty: boolean;              // Unsaved changes indicator
  isExecuting: boolean;          // Execution in progress
  executionNodeStates: Map<string, StepStatus>; // Per-node execution status
  validationErrors: Map<string, string[]>;      // Per-node validation errors

  // === React Flow Callbacks ===
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // === Canvas Actions ===
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  removeNodes: (ids: string[]) => void;
  duplicateNode: (nodeId: string) => void;
  setSelectedNode: (node: Node | null) => void;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;

  // === Workflow Actions ===
  loadWorkflow: (definition: WorkflowDefinition) => void;  // NEW
  getDefinition: () => WorkflowDefinition;                  // NEW
  setIntegrations: (integrations: WorkflowIntegrations) => void;
  markClean: () => void;                                    // NEW: after save

  // === Execution Overlay (NEW) ===
  setNodeExecutionState: (nodeId: string, status: StepStatus) => void;
  clearExecutionStates: () => void;

  // === Validation (NEW) ===
  validateWorkflow: () => boolean;    // Validate all nodes
  getValidationErrors: () => Map<string, string[]>;

  reset: () => void;
}
```

### React Flow Custom Node Architecture

Current: 2 node types (triggerNode, actionNode).

**Recommended enhancement — keep 2 types but add execution state overlay:**

```typescript
// Enhanced node data type
interface WorkflowNodeData {
  type: TriggerType | ActionType;
  label: string;
  description?: string;
  config: Record<string, unknown>;

  // Execution overlay (populated during execution view)
  executionStatus?: StepStatus;     // RUNNING / COMPLETED / FAILED
  executionDuration?: number;        // ms
  executionError?: string;
}

// Node component with execution state
function ActionNode({ data, selected }: NodeProps<WorkflowNodeData>) {
  const statusColor = {
    RUNNING: 'border-blue-500 animate-pulse',
    COMPLETED: 'border-green-500',
    FAILED: 'border-red-500',
  }[data.executionStatus] ?? '';

  return (
    <div className={cn('rounded-lg border-2', statusColor, selected && 'ring-2')}>
      {/* ... node content ... */}
      {data.executionStatus === 'RUNNING' && <Spinner />}
      {data.executionStatus === 'COMPLETED' && <CheckIcon />}
      {data.executionStatus === 'FAILED' && <XIcon />}
    </div>
  );
}
```

### Next.js App Router Patterns

Current route structure is well-organized. Recommended additions:

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (dashboard)/
│   ├── layout.tsx               — Sidebar + Header shell
│   ├── dashboard/page.tsx       — Overview, stats cards, charts
│   ├── workflows/
│   │   ├── page.tsx             — Workflow list + search/filter
│   │   ├── new/page.tsx         — Create workflow form
│   │   └── [id]/
│   │       ├── page.tsx         — Workflow detail + activation controls
│   │       ├── editor/page.tsx  — React Flow visual editor ⭐
│   │       └── executions/page.tsx — NEW: per-workflow execution history
│   ├── executions/
│   │   ├── page.tsx             — Global execution history
│   │   └── [id]/page.tsx        — Execution detail + step timeline
│   └── settings/page.tsx        — User settings
└── page.tsx                     — Redirect to /dashboard
```

---

## API Design

### Current API (Working)

The existing REST API is well-designed. Key improvements needed:

### Recommended API Enhancements

```
# Authentication (KEEP)
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/me

# Workflows (KEEP + enhance)
GET    /api/workflows                    — List (paginated, ?status=, ?search=)
POST   /api/workflows                    — Create
GET    /api/workflows/:id                — Get detail + trigger info
PATCH  /api/workflows/:id                — Update (auto-creates version)
DELETE /api/workflows/:id                — Delete
POST   /api/workflows/:id/activate       — Activate (creates trigger)
POST   /api/workflows/:id/deactivate     — Deactivate (pauses trigger)
POST   /api/workflows/:id/execute        — Manual run → enqueue (NOT direct)
GET    /api/workflows/:id/versions       — Version history

# Executions (KEEP + enhance)
GET    /api/executions                   — List (paginated, ?status=, ?workflowId=)
GET    /api/executions/stats             — Aggregate counts
GET    /api/executions/recent            — Last 10
GET    /api/executions/chart             — Daily success/failure chart data
GET    /api/executions/:id               — Detail + step logs
POST   /api/executions/:id/cancel        — Cancel running execution
POST   /api/executions/:id/retry         — FIX: actually enqueue retry job

# Triggers (KEEP)
POST   /api/webhooks/:token              — Public webhook endpoint
POST   /api/telegram/webhook/:token      — Public Telegram webhook
POST   /api/telegram/validate-token      — Validate bot token

# Users (KEEP, admin-only)
GET    /api/users
GET    /api/users/:id
PATCH  /api/users/:id
DELETE /api/users/:id

# Health (KEEP)
GET    /api/health
GET    /api/health/ready
```

### Response Format (KEEP)

```json
{
  "status": "success",
  "data": { ... },
  "timestamp": "2025-01-30T12:00:00.000Z"
}
```

### Pagination Standard

```typescript
// Shared PaginationDto
class PaginationDto {
  @IsOptional() @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @IsInt() @Min(1) @Max(100)
  limit?: number = 20;
}

// Response shape
interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### WebSocket API (KEEP, add auth)

```
Namespace: /executions
Auth: JWT in handshake.auth.token

Client → Server:
  join:execution(executionId)   — Subscribe to execution updates
  leave:execution(executionId)  — Unsubscribe
  join:workflow(workflowId)     — Subscribe to workflow events

Server → Client:
  execution:started   { executionId, workflowId }
  execution:completed { executionId, workflowId, duration }
  execution:failed    { executionId, workflowId, error }
  step:started        { executionId, stepId, nodeId }
  step:completed      { executionId, stepId, nodeId, duration }
  step:failed         { executionId, stepId, nodeId, error }
```

**Fix needed:** Verify user owns the execution/workflow before allowing room join.

---

## Data Model Recommendations

### Current Prisma Schema Assessment

The existing schema is well-structured. Key improvements:

### 1. Execution State Machine (Enforce Valid Transitions)

```prisma
// Current enums are correct:
enum ExecutionStatus {
  PENDING     // Created, waiting in queue
  RUNNING     // Being executed
  COMPLETED   // All steps succeeded
  FAILED      // A step failed
  CANCELLED   // User cancelled
  PAUSED      // Future: workflow paused mid-execution
}

enum StepStatus {
  PENDING     // Not started
  RUNNING     // Executing
  COMPLETED   // Succeeded
  FAILED      // Error occurred
  SKIPPED     // Conditional branch not taken
}
```

State machine transitions should be enforced in EngineService (application layer), not DB constraints.

### 2. Step Logs as Append-Only

Current design already treats step logs as append-only (create once, update status/output). **Recommended improvement:**

```prisma
model ExecutionStepLog {
  id            String     @id @default(cuid())
  executionId   String
  nodeId        String
  nodeName      String
  nodeType      String
  status        StepStatus @default(PENDING)
  input         Json?
  output        Json?
  error         String?
  retryCount    Int        @default(0)
  startedAt     DateTime?
  completedAt   DateTime?
  duration      Int?       // ms
  stepOrder     Int        @default(0)      // NEW: execution order in DAG

  execution     WorkflowExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)

  @@index([executionId])
  @@index([executionId, stepOrder])          // NEW: ordered retrieval
  @@index([status])
  @@map("execution_step_logs")
}
```

### 3. Workflow Versioning (Already Good)

Current `WorkflowVersion` model with `@@unique([workflowId, version])` is correct.

**Recommended addition — link execution to specific version:**

```prisma
model WorkflowExecution {
  id              String          @id @default(cuid())
  workflowId      String
  workflowVersion Int?            // NEW: which version was executed
  triggerType     String?         // NEW: what triggered this execution
  triggerData     Json?
  status          ExecutionStatus @default(PENDING)
  startedAt       DateTime?
  completedAt     DateTime?
  error           String?
  duration        Int?            // ms
  createdAt       DateTime        @default(now())

  workflow    Workflow         @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  stepLogs    ExecutionStepLog[]

  @@index([workflowId])
  @@index([status])
  @@index([createdAt])
  @@index([workflowId, createdAt]) // NEW: per-workflow history queries
  @@map("workflow_executions")
}
```

### 4. Credential Storage (Future Enhancement)

For the current scope, credentials live in `Trigger.config` and `integrations` JSON. If needed later:

```prisma
model Credential {
  id           String   @id @default(cuid())
  userId       String
  name         String
  type         String   // 'telegram', 'smtp', 'api_key'
  encryptedData String  // AES-256-GCM encrypted JSON
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, name])
  @@map("credentials")
}
```

**Not needed for current scope** — keep credentials in workflow definition JSON.

---

## Security Architecture

### 1. Sandbox Isolation (Critical Fix)

**Problem:** Two execution paths — EngineService (secured) and sandboxed processor (bypasses all security).

**Solution:** Eliminate the sandboxed processor. Use single execution path through EngineService:

```typescript
// queue/workflow.processor.ts — simplified
@Processor('workflow-execution')
export class WorkflowProcessor extends WorkerHost {
  constructor(private engineService: EngineService) {
    super();
  }

  async process(job: Job<{ workflowId: string; triggerData?: any }>) {
    return this.engineService.executeWorkflow(
      job.data.workflowId,
      job.data.triggerData,
    );
  }
}
```

This ensures ALL executions pass through the same SSRF protection, input validation, and timeout limits.

**Future (if needed):** For true sandboxing, use `worker_threads` with a serialized action interface:

```typescript
// worker-sandbox.ts (future, not needed for current scope)
import { Worker } from 'worker_threads';

async function executeInSandbox(actionType: string, config: object): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./action-worker.js', {
      workerData: { actionType, config },
      resourceLimits: {
        maxOldGenerationSizeMb: 64,
        maxYoungGenerationSizeMb: 16,
        codeRangeSizeMb: 16,
      },
    });
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('Action timed out'));
    }, 30000);
    worker.on('message', (result) => { clearTimeout(timeout); resolve(result); });
    worker.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
}
```

### 2. SSRF Protection (Existing, Needs Fix)

Current `HttpRequestAction` has good SSRF protection. The fix is ensuring ALL HTTP requests go through it (no direct axios calls in processor).

Checklist:
- [x] Block private IP ranges (10.x, 172.16-31.x, 192.168.x)
- [x] Block localhost and 0.0.0.0
- [x] Block metadata endpoints (169.254.169.254)
- [x] HTTP/HTTPS only (no file://, ftp://)
- [x] DNS resolution check (prevent DNS rebinding)
- [ ] **Fix:** Disable redirects entirely OR re-validate each redirect target
- [ ] **Fix:** Add request timeout (currently 30s, good)

### 3. Database Action Security (Critical Fix)

**Problem:** `ALLOWED_TABLES` includes application tables like `users`.

**Solution:**

```typescript
// Option A: Separate schema (recommended)
// Create a 'workspace' schema in PostgreSQL for user data
// Database action queries go to 'workspace.*' tables only

// Option B: Strict allowlist (simpler)
const ALLOWED_TABLES = [
  // ONLY user-created tables, NOT application tables
  // Populated dynamically per user or empty by default
];

// Option C: Read-only connection with limited privileges
// Create a PostgreSQL role with SELECT-only access to specific tables
```

### 4. Credential Encryption

For Telegram bot tokens and other secrets stored in workflow definitions:

```typescript
// utils/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(data: string): string {
  const [ivHex, tagHex, encryptedHex] = data.split(':');
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encryptedHex, 'hex')) + decipher.final('utf8');
}
```

**Scope:** Encrypt `integrations.telegram.botToken` and SMTP credentials before storing in workflow definition JSON. Decrypt at execution time.

### 5. RBAC (Existing, Adequate)

Current: `UserRole.ADMIN` and `UserRole.USER` with `@Roles('ADMIN')` guard.

Sufficient for current scope. No multi-tenant or team features needed.

### 6. WebSocket Auth Fix

```typescript
// websocket.gateway.ts — add room-join authorization
@SubscribeMessage('join:execution')
async handleJoinExecution(client: AuthenticatedSocket, executionId: string) {
  // Verify ownership
  const execution = await this.prisma.workflowExecution.findUnique({
    where: { id: executionId },
    include: { workflow: { select: { userId: true } } },
  });

  if (!execution || execution.workflow.userId !== client.data.userId) {
    client.emit('error', { message: 'Unauthorized' });
    return;
  }

  client.join(`execution:${executionId}`);
}
```

---

## Build & Deploy

### Current Setup (Working)

```
Development:
  docker-compose up -d          → Postgres + Redis
  pnpm dev                      → Turborepo runs backend + frontend

Production:
  docker-compose -f docker-compose.prod.yml up -d
  → Builds: multi-stage Docker (Node 20 Alpine)
  → Backend: prisma migrate deploy && node dist/main
  → Frontend: Next.js standalone (node server.js)
  → Nginx: reverse proxy (:80)
```

### Recommended Improvements

1. **CI/CD Pipeline** (GitHub Actions):

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  lint-test-build:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env: { POSTGRES_DB: test, POSTGRES_PASSWORD: test }
      redis:
        image: redis:7-alpine
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

2. **Environment Validation:**
   - Remove hardcoded fallback secrets
   - Require `JWT_SECRET`, `DB_PASSWORD`, `ENCRYPTION_KEY` in production
   - Use Docker secrets or `.env` file (not in docker-compose.yml)

3. **Health Checks (Current, Good):**
   - Backend: `/api/health` (liveness) + `/api/health/ready` (DB + memory)
   - Docker: healthcheck on postgres, redis, backend
   - Nginx: depends_on with health conditions

4. **Startup Order:**
```
postgres (healthy) → redis (healthy) → backend (healthy) → frontend (started) → nginx
```

Already correctly configured in docker-compose.prod.yml.

---

## Summary of Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Execution path | Single (EngineService only) | Eliminates security bypass in sandboxed processor |
| Queue strategy | Single BullMQ queue with priority | Simple, sufficient for scope |
| All triggers → queue | Yes | Prevents HTTP blocking, enables retry |
| Action dispatch | Registry pattern | Extensible, no switch-case |
| State management | Zustand + React Query (keep) | Already working, correct split |
| DAG execution | Sequential (topo-sort) | Sufficient for scope, parallelism can be added later |
| Frontend routing | Next.js App Router (keep) | Already well-structured |
| Real-time | EventEmitter → Socket.IO (keep) | Working pattern, add auth to room joins |
| Data model | Minor additions (stepOrder, workflowVersion, indexes) | Non-breaking enhancements |
| Security | Fix SSRF bypass, encrypt credentials, auth WS rooms | Critical fixes, not refactoring |
| CI/CD | GitHub Actions (lint → test → build) | Standard, easy setup |

---

*Research completed: 2025-01-30*
