# Phase 2: Engine Reliability & Error Handling - Research

**Researched:** 2025-01-30
**Domain:** BullMQ workflow execution engine, retry/pause/resume, Pino structured logging, error notifications
**Confidence:** HIGH

## Summary

Phase 2 transforms the existing EngineService from a synchronous fire-and-forget executor into a robust, pausable, retryable workflow engine with structured logging and error notifications. The current codebase has a solid foundation: topological sort works, step logging creates records, WebSocket gateway emits events, and BullMQ is wired up. However, critical gaps exist: retry logic at the step level is nonexistent (BullMQ retries the entire job, not individual steps), pause/resume has zero implementation, Pino is installed but never wired into NestJS, the notification service only sends to global admin channels (not per-user/per-workflow), and the processor was gutted in Phase 1.

The WorkflowProcessor in `queue.service.ts` needs to be rebuilt as a proper BullMQ Worker with pause-awareness and graceful shutdown. The EngineService needs per-step retry with exponential backoff. The Prisma schema needs new fields for pause state tracking (last completed step index, retry configuration). Frontend needs WebSocket-driven toast notifications for failures.

**Primary recommendation:** Build incrementally — (1) wire Pino logger first (cross-cutting, everything depends on it), (2) rebuild the BullMQ processor with graceful shutdown, (3) add per-step retry with exponential backoff in EngineService, (4) implement pause/resume with DB state tracking, (5) enhance notifications for per-user in-app + email, (6) add error display context on frontend.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXE-01 | DAG topological execution via BullMQ | Topological sort already works (engine.service.ts L174-204). Processor is gutted (workflow.processor.ts). Need to rebuild processor that delegates to EngineService. |
| EXE-02 | Step logging (status, I/O, duration, errors) | Already partially implemented (engine.service.ts L101-167). ExecutionStepLog model has all fields. Need to add correlation IDs and richer error context. |
| EXE-04 | Workflow pause (suspend after current step) | No implementation exists. Need: pause flag check in step loop, PAUSED status update, store `lastCompletedStepIndex` or `lastCompletedNodeId` in execution record. Schema needs new fields. |
| EXE-05 | Resume paused workflow | No implementation exists. Need: endpoint to resume, load execution state, rebuild context from completed step logs, continue from next step. |
| EXE-06 | Exponential backoff retry (configurable) | BullMQ job-level retry exists (queue.service.ts L20-21) but per-step retry is absent. Need step-level retry loop in EngineService.executeStep with configurable maxAttempts/baseDelay/jitter. |
| EXE-07 | Manual retry from failed step | ExecutionsService.retry() exists (L57-72) but creates new execution from scratch. Need: identify failed step, rebuild context from completed steps, re-execute from failure point. |
| EXE-08 | Graceful shutdown for workers | No implementation — no enableShutdownHooks, no SIGTERM handling. Need: app.enableShutdownHooks() in main.ts, BullMQ Worker connection.close() on module destroy. |
| ERR-01 | Fail notifications (in-app + email) | NotificationsService exists but sends to global admin (env vars). Need: per-user WebSocket toast notification, user-configured email notification. |
| ERR-02 | Per-workflow error config | No implementation. Need: add `errorConfig` JSON field to Workflow model, UI for configuration, EngineService reads config before retry/notification. |
| ERR-03 | Clear error display with context | Execution detail page shows error string. Need: structured error with failed node ID, input that caused failure, stack trace, step context. |
| ERR-04 | Structured logging (Pino) | Pino v9.5 installed but not wired. NestJS Logger used everywhere. Need nestjs-pino or manual BufferLogger replacement. |
| INF-01 | Pino logger with correlation IDs | Need: install nestjs-pino, configure in AppModule, replace Logger imports, add executionId/stepId/actionType to log context. |
</phase_requirements>

## File-by-File Analysis

### 1. `apps/backend/src/engine/engine.service.ts` (205 lines)

**Current State: Working DAG execution, NO retry/pause/resume**

**What works:**
- **L24-98**: `executeWorkflow()` — creates execution record, calls `getExecutionOrder()`, iterates nodes sequentially, updates status to COMPLETED or FAILED, emits events via EventEmitter2.
- **L101-167**: `executeStep()` — creates `ExecutionStepLog`, calls action handler, updates step log with result or error, emits step events.
- **L174-204**: `getExecutionOrder()` — **correct Kahn's algorithm** topological sort using BFS. Builds adjacency list, computes in-degree, processes queue. This is solid.

**What's missing/broken:**
- **No pause check** in the step iteration loop (L55-63). Need to check a pause flag between steps.
- **No per-step retry** — if `executeStep()` throws, the entire workflow fails. Need a retry loop wrapping the action call at L124.
- **No resume capability** — can't reconstruct `context.stepResults` from previously completed steps.
- **No correlation ID** — the logger uses `new Logger(EngineService.name)` (NestJS default), not Pino with context.
- **L37**: `definition` is cast to `any` — no type safety for workflow structure.
- **L6-12**: `ExecutionContext` interface is inline — should be in a shared types file.

**Key code (topological sort — working correctly):**
```typescript
// L174-204: Kahn's algorithm BFS topological sort
private getExecutionOrder(nodes: any[], edges: any[]): any[] {
  const adjacency: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};
  for (const node of nodes) {
    adjacency[node.id] = [];
    inDegree[node.id] = 0;
  }
  for (const edge of edges) {
    adjacency[edge.source].push(edge.target);
    inDegree[edge.target] = (inDegree[edge.target] || 0) + 1;
  }
  const queue = nodes.filter((n) => inDegree[n.id] === 0);
  const result: any[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    for (const neighbor of adjacency[node.id]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        const neighborNode = nodes.find((n) => n.id === neighbor);
        if (neighborNode) queue.push(neighborNode);
      }
    }
  }
  return result;
}
```

### 2. `apps/backend/src/queue/queue.service.ts` (66 lines)

**Current State: BullMQ wired but processor needs rebuilding**

- **L7-29**: `QueueService` — `addExecution()` adds job to `workflow-execution` queue with:
  - `attempts: 3` (BullMQ job-level retry)
  - `backoff: { type: 'exponential', delay: 5000 }` (job-level backoff)
  - `removeOnComplete: 100`, `removeOnFail: 200`
- **L44-66**: `WorkflowProcessor extends WorkerHost` — calls `engineService.executeWorkflow()` in `process()`. This is currently functional but:
  - **No graceful shutdown** — no `onModuleDestroy()` or connection cleanup
  - **Retries entire workflow** on failure (BullMQ re-queues the job) — this is wrong for step-level retry
  - **No pause awareness** — can't check if execution was paused mid-flight

**Critical issue:** The `QueueService` and `WorkflowProcessor` are **in the same file**. The processor should be separate for clarity and to manage its own lifecycle.

### 3. `apps/backend/src/engine/engine.module.ts` (45 lines)

**Current State: Clean module, missing BullMQ integration**

- Imports only `ConfigModule`, provides `EngineService`, `ActionRegistry`, `CredentialService`, and all 5 action handlers.
- **Does NOT import `BullModule`** — the BullMQ integration lives in `QueueModule` separately.
- Action registration happens in `onModuleInit()` (L36-43) — correct pattern.

### 4. `apps/backend/prisma/schema.prisma` (153 lines)

**Current State: Good base schema, needs extensions for pause/resume/retry config**

**Existing models that matter:**

```prisma
enum ExecutionStatus {
  PENDING | RUNNING | COMPLETED | FAILED | CANCELLED | PAUSED  // ✅ PAUSED already exists!
}

enum StepStatus {
  PENDING | RUNNING | COMPLETED | FAILED | SKIPPED  // ✅ Has SKIPPED
}

model WorkflowExecution {
  id, workflowId, triggerData (Json?), status, startedAt, completedAt, error (String?), duration (Int?), createdAt
  // Missing: lastCompletedNodeId, retryCount, pausedAt, correlationId
}

model ExecutionStepLog {
  id, executionId, nodeId, nodeName, nodeType, status, input (Json?), output (Json?), error (String?),
  retryCount (Int @default(0)),  // ✅ Already has retryCount!
  startedAt, completedAt, duration (Int?)
  // Missing: errorStack, attemptNumber
}
```

**Schema additions needed:**
1. `WorkflowExecution`: Add `lastCompletedNodeId String?`, `pausedAt DateTime?`, `resumedAt DateTime?`, `correlationId String?` (for Pino).
2. `Workflow`: Add `errorConfig Json?` (for ERR-02: per-workflow retry count, notification preferences).
3. `ExecutionStepLog`: Add `errorStack String?` (for ERR-03: full stack trace, separate from short error message).

**Important:** `ExecutionStatus.PAUSED` enum value already exists! No schema migration needed for that.

### 5. `apps/backend/src/websocket/websocket.gateway.ts` (144 lines)

**Current State: Fully functional gateway with JWT auth and room-based events**

- **L41-63**: `handleConnection()` — validates JWT, sets `client.data.userId`, disconnects on failure.
- **L69-84**: `handleJoinExecution()` — ownership check via Prisma, joins `execution:{id}` room.
- **L109-113**: `emitToRoom()` — emits to specific room AND broadcasts globally (for dashboard).
- **L115-143**: Event handlers for `execution.started/completed/failed`, `step.started/completed/failed`.

**What's needed for ERR-01 (in-app notifications):**
- The gateway already handles `execution.failed` events (L127-129). The problem is on the **frontend side** — no toast notification when `execution:failed` is received via WebSocket.
- Need to add a `notification:failure` event type that targets the user specifically (not just room subscribers).
- Could emit to a user-specific room `user:{userId}` that the frontend auto-joins on connect.

### 6. `apps/backend/src/executions/executions.service.ts` (126 lines)

**Current State: CRUD works, retry creates NEW execution (not from failed step)**

- **L57-72**: `retry()` — creates a brand new execution with `status: PENDING`. Does NOT:
  - Identify the failed step
  - Reconstruct step context from completed steps
  - Resume from the failure point
  - Trigger the execution through BullMQ (just creates DB record, nothing picks it up!)

**This is a critical bug:** `retry()` creates a PENDING execution but never enqueues it in BullMQ. The execution will sit forever.

- **L46-55**: `cancel()` — just updates DB status to CANCELLED. Doesn't actually signal the running worker.

### 7. `apps/backend/src/notifications/notifications.service.ts` (107 lines)

**Current State: Global admin notifications only, no per-user/per-workflow**

- **L42-73**: `handleExecutionFailed()` — sends Telegram + email to **globally configured** recipients (env vars `TELEGRAM_ALERT_CHAT_ID`, `ALERT_EMAIL`).
- **No per-user notification** — doesn't look up workflow owner or their notification preferences.
- **No in-app notification** — no WebSocket toast event, no notification table.

**Needed for ERR-01/ERR-02:**
- Lookup workflow owner when execution fails
- Check workflow's `errorConfig` for notification preferences
- Emit WebSocket event to user-specific room for in-app toast
- Optionally send email to the workflow owner's email address

### 8. `apps/backend/src/main.ts` (46 lines)

**Current State: No shutdown hooks, no Pino**

- Uses `NestFactory.create(AppModule)` with default logger
- **No `app.enableShutdownHooks()`** — needed for EXE-08
- **No Pino integration** — uses default NestJS Logger
- Need to add: `enableShutdownHooks()`, Pino logger configuration

### 9. Frontend Execution Views

**Execution list page** (`apps/frontend/src/app/(dashboard)/executions/page.tsx`, 73 lines):
- Basic list with pagination, status badges, links to detail page.
- No filtering by status (UI has no status filter dropdown).
- No pause/resume/retry buttons.

**Execution detail page** (`apps/frontend/src/app/(dashboard)/executions/[id]/page.tsx`, 155 lines):
- Shows execution metadata (started, completed, duration, step count).
- Shows error card with error string (L98-110).
- Shows step logs with status icons, duration, retry count, error.
- **Missing:** No retry/pause/resume buttons, no I/O data expansion, no stack trace display.
- **Polls via refetchInterval: 3000** (use-executions.ts L26) — but should use WebSocket for real-time.

**WebSocket hook** (`apps/frontend/src/hooks/use-websocket.ts`, 62 lines):
- Connects to `/executions` namespace with JWT auth.
- Has `joinExecution`/`leaveExecution` helpers.
- **Not used on execution detail page** — it just polls.

**Toast system:** Sonner is installed and Toaster is in providers.tsx (L6, L23). `toast` from 'sonner' is already used in dashboard page.

**Types** (`apps/frontend/src/types/index.ts`):
- `ExecutionStatus` includes `'PAUSED'` — already typed.
- `ExecutionStepLog` has `retryCount` — already typed.

### 10. Dependencies Analysis

**Already installed (backend):**
| Package | Version | Status |
|---------|---------|--------|
| `bullmq` | ^5.25.0 | ✅ Installed |
| `@nestjs/bullmq` | ^10.2.0 | ✅ Installed |
| `ioredis` | ^5.4.0 | ✅ Installed |
| `pino` | ^9.5.0 | ✅ Installed but NOT wired |
| `pino-http` | ^10.3.0 | ✅ Installed but NOT wired |
| `pino-pretty` | ^13.0.0 | ✅ Installed (dev formatter) |
| `@nestjs/event-emitter` | ^2.1.0 | ✅ Used for execution events |
| `socket.io` | ^4.8.0 | ✅ Used in WebSocket gateway |
| `nodemailer` | ^6.9.0 | ✅ Used in notifications |
| `axios-retry` | ^4.4.0 | ✅ Used in HTTP action only |

**Need to install:**
| Package | Version | Purpose |
|---------|---------|---------|
| `nestjs-pino` | ^4.x | NestJS Pino integration (LoggerModule, PinoLogger) — replaces default logger globally |

**Frontend already has:** `sonner` (toast), `socket.io-client`, all needed types.

## Architecture Patterns

### Recommended Project Structure Changes

```
apps/backend/src/
├── engine/
│   ├── engine.service.ts          # Core execution with retry + pause
│   ├── engine.module.ts           # Add BullMQ import
│   ├── action-registry.ts         # Unchanged
│   ├── action-handler.interface.ts # Unchanged
│   ├── processors/
│   │   └── workflow.processor.ts  # Rebuilt: proper Worker with graceful shutdown
│   ├── actions/                   # Unchanged
│   └── types/
│       └── execution-context.ts   # Extract ExecutionContext + RetryConfig types
├── queue/
│   ├── queue.module.ts            # Keep BullModule registration
│   └── queue.service.ts           # Remove WorkflowProcessor (moved to engine/processors)
├── notifications/
│   ├── notifications.module.ts    # Import WebsocketModule
│   └── notifications.service.ts   # Add per-user notifications, WebSocket toast
├── logger/
│   └── logger.module.ts           # New: nestjs-pino LoggerModule configuration
```

### Pattern 1: Per-Step Retry with Exponential Backoff

**What:** Wrap the action handler call in a retry loop inside `executeStep()`, not at the BullMQ job level.

**Why:** BullMQ job-level retry re-executes the ENTIRE workflow (all steps from scratch), which is wrong. We need per-step retry that only retries the failed action.

```typescript
// In engine.service.ts executeStep()
private async executeStepWithRetry(
  node: any, 
  context: ExecutionContext, 
  retryConfig: RetryConfig
): Promise<any> {
  const { maxAttempts = 3, baseDelay = 1000, jitter = true } = retryConfig;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await this.executeAction(node.data.type, input);
      return result;
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      
      // Exponential backoff: baseDelay * 2^(attempt-1) + optional jitter
      const delay = baseDelay * Math.pow(2, attempt - 1);
      const jitterMs = jitter ? Math.random() * delay * 0.1 : 0;
      await new Promise(r => setTimeout(r, delay + jitterMs));
      
      // Update step log retry count
      await this.prisma.executionStepLog.update({
        where: { id: stepLog.id },
        data: { retryCount: attempt },
      });
    }
  }
}
```

### Pattern 2: Pause/Resume via DB Flag Check

**What:** Before each step execution, check if a pause has been requested. Store enough state to resume.

```typescript
// In executeWorkflow() loop
for (const node of executionOrder) {
  // Check pause flag before each step
  const execution = await this.prisma.workflowExecution.findUnique({
    where: { id: context.executionId },
    select: { status: true },
  });
  
  if (execution?.status === 'PAUSED') {
    await this.prisma.workflowExecution.update({
      where: { id: context.executionId },
      data: { lastCompletedNodeId: context.lastCompletedNodeId },
    });
    this.eventEmitter.emit('execution.paused', { executionId: context.executionId });
    return; // Exit cleanly, don't throw
  }
  
  // ... execute step
  context.lastCompletedNodeId = node.id;
}
```

**Resume flow:**
1. Load execution record (status must be PAUSED)
2. Load all completed step logs for this execution
3. Rebuild `stepResults` from step log outputs
4. Find the next node after `lastCompletedNodeId` in topological order
5. Continue the loop from that node

### Pattern 3: Graceful Shutdown

**What:** Ensure in-progress BullMQ jobs complete before the Node.js process exits.

```typescript
// In main.ts
app.enableShutdownHooks();

// In WorkflowProcessor (or a module destroy hook)
async onModuleDestroy() {
  // BullMQ WorkerHost handles this when NestJS calls shutdown
  // The @nestjs/bullmq WorkerHost will call worker.close() 
  // which waits for the current job to complete
  this.logger.log('Worker shutting down, waiting for current job...');
}
```

**Important:** `@nestjs/bullmq` `WorkerHost` already handles graceful shutdown when `app.enableShutdownHooks()` is called. The `WorkerHost.onApplicationShutdown()` method calls `this.worker.close()` which waits for the currently running job. So the main work is adding `enableShutdownHooks()` to `main.ts`.

### Pattern 4: Pino Logger with Correlation IDs

```typescript
// logger setup via nestjs-pino
import { LoggerModule } from 'nestjs-pino';

LoggerModule.forRoot({
  pinoHttp: {
    transport: process.env.NODE_ENV !== 'production' 
      ? { target: 'pino-pretty', options: { colorize: true } } 
      : undefined,
    level: process.env.LOG_LEVEL || 'info',
    genReqId: (req) => req.headers['x-correlation-id'] || randomUUID(),
  },
})
```

For execution-specific correlation, use Pino child loggers:
```typescript
const logger = this.pinoLogger.logger.child({
  correlationId: execution.id,
  workflowId,
  actionType: node.data.type,
});
```

### Anti-Patterns to Avoid

- **Don't retry at BullMQ job level for step failures** — this re-executes all steps. Set `attempts: 1` on BullMQ job, handle retry in EngineService.
- **Don't use in-memory flags for pause** — if the process restarts, the flag is lost. Use database status check.
- **Don't create a separate "pause queue"** — just check execution status from DB between steps.
- **Don't replace ALL Logger imports at once** — use `nestjs-pino` which auto-replaces the NestJS Logger globally, then incrementally add structured context fields.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NestJS Pino integration | Custom logger adapter | `nestjs-pino` ^4.x | Handles request context, auto-replacement of NestJS Logger, pino-http middleware |
| BullMQ Worker lifecycle | Custom process signal handling | `@nestjs/bullmq` WorkerHost + `enableShutdownHooks()` | Already handles `worker.close()` on SIGTERM |
| Exponential backoff calculation | Custom delay formula | Simple `baseDelay * 2^attempt + jitter` | Formula is trivial, no library needed, but don't try to handle circuit breaking |
| Toast notifications | Custom notification system | Sonner (already installed) + WebSocket events | Already wired in providers.tsx |

## Common Pitfalls

### Pitfall 1: BullMQ Job Retry vs Step Retry Confusion
**What goes wrong:** Using BullMQ's built-in `attempts` config retries the entire workflow from step 1, causing completed steps to run again (duplicate emails, double API calls).
**Why it happens:** BullMQ treats the entire `process()` function as the retryable unit.
**How to avoid:** Set `attempts: 1` on BullMQ jobs. Implement retry logic INSIDE `executeStep()` in EngineService.
**Warning signs:** Step logs show completed steps being re-created during a "retry".

### Pitfall 2: Resume Context Reconstruction
**What goes wrong:** When resuming a paused execution, the `stepResults` map is empty because it was in-memory during the original run.
**Why it happens:** `ExecutionContext.stepResults` is a runtime object, not persisted.
**How to avoid:** On resume, query all `ExecutionStepLog` records with `status: COMPLETED` for this execution, rebuild `stepResults` from their `output` field: `stepResults[log.nodeId] = log.output`.
**Warning signs:** Steps after resume fail because `_context` references to previous step outputs are undefined.

### Pitfall 3: Race Condition in Pause Check
**What goes wrong:** User clicks pause, but the check happens AFTER the next step started.
**Why it happens:** The pause check and step execution aren't atomic.
**How to avoid:** Check pause status from DB before EACH step. If paused, exit cleanly. The "current step" completes (as documented in EXE-04 spec), and the next step doesn't start.
**Warning signs:** An extra step executes after the user clicks pause.

### Pitfall 4: Forgetting to Emit Pause/Resume Events via WebSocket
**What goes wrong:** Frontend doesn't know the execution is paused/resumed.
**Why it happens:** Only `execution.started/completed/failed` events are emitted currently.
**How to avoid:** Add `execution.paused` and `execution.resumed` events in EngineService, add corresponding `@OnEvent` handlers in WebsocketGateway.

### Pitfall 5: Retry Creating New Execution vs Resuming From Failed Step
**What goes wrong:** EXE-07 says "manual retry from failed step" but current `retry()` creates a whole new execution.
**Why it happens:** Two different concepts: (a) "retry this execution from the failed step" and (b) "re-run the entire workflow".
**How to avoid:** For EXE-07: find the failed step, load completed step outputs into context, re-execute from that step forward. Keep the SAME execution ID. For general retry: use the existing "re-run" approach.

### Pitfall 6: nestjs-pino BufferLogger in Testing
**What goes wrong:** Tests fail because nestjs-pino's BufferLogger interferes with NestJS test module.
**Why it happens:** LoggerModule is imported globally.
**How to avoid:** In test modules, override LoggerModule or provide a mock PinoLogger.

## Code Examples

### Example 1: Retry Configuration Interface

```typescript
// apps/backend/src/engine/types/retry-config.ts
export interface RetryConfig {
  maxAttempts: number;    // default: 3
  baseDelayMs: number;    // default: 1000
  maxDelayMs: number;     // default: 30000
  jitter: boolean;        // default: true
}

export interface WorkflowErrorConfig {
  retry: RetryConfig;
  notifications: {
    inApp: boolean;       // default: true
    email: boolean;       // default: false
    emailAddress?: string;
  };
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitter: true,
};
```

### Example 2: Pause Endpoint

```typescript
// In executions.controller.ts
@Post(':id/pause')
@ApiOperation({ summary: 'Pause a running execution' })
async pause(@CurrentUser('sub') userId: string, @Param('id') id: string) {
  return this.executionsService.pause(id, userId);
}

@Post(':id/resume')
@ApiOperation({ summary: 'Resume a paused execution' })
async resume(@CurrentUser('sub') userId: string, @Param('id') id: string) {
  return this.executionsService.resume(id, userId);
}
```

### Example 3: nestjs-pino Setup

```typescript
// Install: pnpm --filter backend add nestjs-pino
// In app.module.ts
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
          : undefined,
        autoLogging: true,
        serializers: {
          req: (req) => ({ method: req.method, url: req.url }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
      },
    }),
    // ... other imports
  ],
})

// In main.ts
import { Logger } from 'nestjs-pino';
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
app.enableShutdownHooks();
```

### Example 4: Structured Error for ERR-03

```typescript
// Enhanced error structure for step failures
interface StepError {
  message: string;
  stack?: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  input: any;
  attemptNumber: number;
  maxAttempts: number;
  timestamp: string;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BullMQ job-level retry | Step-level retry in app code | Common pattern in workflow engines | Prevents duplicate step execution |
| Console.log / NestJS Logger | Pino structured JSON logging | Pino v9 (2024) | Machine-parseable, correlation IDs, 5x faster |
| Polling for execution status | WebSocket real-time events | Already implemented in gateway | Frontend just needs to USE the existing WebSocket |
| Global notification config | Per-workflow notification config | Phase 2 requirement | Users control their own notification preferences |

**Deprecated/outdated:**
- `nestjs-pino` v3 used `forRootAsync` with different options — v4 simplified the API
- BullMQ v4 → v5 changed Worker options slightly — project uses v5 already

## Open Questions

1. **Resume: Same execution ID or new?**
   - What we know: EXE-05 says "resume from where it stopped", implying same execution
   - What's unclear: Should we update the same execution record or create a continuation?
   - Recommendation: **Use same execution ID** — update status from PAUSED→RUNNING, load step results from existing logs, continue. This preserves the execution timeline.

2. **ERR-02 scope: Phase 2 or Phase 8?**
   - ROADMAP.md assigns ERR-02 to Phase 8, but it's listed in Phase 2 requirements
   - Recommendation: Add the `errorConfig` JSON field to Workflow model in Phase 2, build a minimal default config. Full UI configuration can be Phase 8.

3. **Per-step retry or per-action retry?**
   - The HTTP action already has its own retry via `axios-retry` (http-request.action.ts L20-26)
   - Should the engine ALSO retry? Yes — engine-level retry handles ALL action types uniformly
   - Recommendation: Keep action-internal retry for transient HTTP errors, add engine-level retry for all action types. Engine retry wraps the action call.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 + ts-jest |
| Config file | `apps/backend/package.json` → `jest` key (inline config) |
| Quick run command | `cd apps/backend && npx jest --testPathPattern="engine\|executions\|queue\|notifications" --no-coverage` |
| Full suite command | `cd apps/backend && npx jest --no-coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXE-01 | DAG topological execution | unit | `npx jest engine.service.spec.ts -x` | ✅ Exists (covers topo sort + step execution) |
| EXE-02 | Step logging with I/O, duration, errors | unit | `npx jest engine.service.spec.ts -x` | ✅ Exists (covers step log creation) |
| EXE-04 | Pause execution after current step | unit | `npx jest engine.service.spec.ts -x` | ❌ Need new tests |
| EXE-05 | Resume paused execution | unit | `npx jest engine.service.spec.ts -x` | ❌ Need new tests |
| EXE-06 | Exponential backoff retry | unit | `npx jest engine.service.spec.ts -x` | ❌ Need new tests |
| EXE-07 | Manual retry from failed step | unit | `npx jest executions.service.spec.ts -x` | ⚠️ Exists but tests wrong behavior (full re-run) |
| EXE-08 | Graceful shutdown | integration | Manual: send SIGTERM to running worker | ❌ Need new test |
| ERR-01 | Fail notifications (in-app + email) | unit | `npx jest notifications.service.spec.ts -x` | ❌ File doesn't exist |
| ERR-02 | Per-workflow error config | unit | `npx jest workflows.service.spec.ts -x` | ⚠️ Exists but no error config tests |
| ERR-03 | Clear error display with context | unit | `npx jest engine.service.spec.ts -x` | ❌ Need enhanced error structure tests |
| ERR-04 | Structured Pino logging | integration | Manual: verify log output format | ❌ Need new tests |
| INF-01 | Pino with correlation IDs | integration | Manual: verify log correlation | ❌ Need new tests |

### Sampling Rate
- **Per task commit:** `cd apps/backend && npx jest --testPathPattern="engine|executions|queue|notifications" --no-coverage`
- **Per wave merge:** `cd apps/backend && npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/backend/src/notifications/notifications.service.spec.ts` — covers ERR-01
- [ ] New test cases in `engine.service.spec.ts` for pause/resume/retry
- [ ] New test cases in `executions.service.spec.ts` for retry-from-failed-step and pause/resume endpoints

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** — all files read directly with line numbers
- `apps/backend/package.json` — dependency versions verified
- `apps/backend/prisma/schema.prisma` — model structure verified
- `apps/backend/src/engine/engine.service.ts` — full 205-line analysis
- `apps/backend/src/queue/queue.service.ts` — full 66-line analysis
- `apps/backend/src/notifications/notifications.service.ts` — full 107-line analysis

### Secondary (MEDIUM confidence)
- BullMQ graceful shutdown via `@nestjs/bullmq` WorkerHost — based on NestJS docs pattern, `WorkerHost` implements `OnApplicationShutdown`
- `nestjs-pino` v4 API — based on package documentation patterns

### Tertiary (LOW confidence)
- None — all findings verified against actual codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified in package.json
- Architecture: HIGH — full file-level analysis with line numbers
- Pitfalls: HIGH — identified from actual code gaps and common BullMQ patterns
- Retry/Pause patterns: MEDIUM — patterns are well-established but implementation details need validation during coding

**Research date:** 2025-01-30
**Valid until:** 2025-03-01 (stable stack, no version changes expected)
