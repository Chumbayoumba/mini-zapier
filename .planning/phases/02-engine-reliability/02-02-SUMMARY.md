---
phase: 02-engine-reliability
plan: "02-02"
subsystem: engine
tags: [retry, pause, resume, exponential-backoff, workflow-control]
dependency_graph:
  requires: ["02-01"]
  provides: ["per-step-retry", "pause-resume", "retry-from-failed"]
  affects: ["executions-api", "websocket-events", "engine-service"]
tech_stack:
  added: []
  patterns: ["exponential-backoff-with-jitter", "cooperative-pause-via-db-flag", "context-rebuild-from-step-logs"]
key_files:
  created: []
  modified:
    - apps/backend/src/engine/engine.service.ts
    - apps/backend/src/engine/engine.service.spec.ts
    - apps/backend/src/executions/executions.service.ts
    - apps/backend/src/executions/executions.service.spec.ts
    - apps/backend/src/executions/executions.controller.ts
    - apps/backend/src/executions/executions.module.ts
    - apps/backend/src/websocket/websocket.gateway.ts
decisions:
  - "Cooperative pause via DB status flag — engine checks between steps, not signal-based"
  - "Single step log per node — created once, updated on retry/complete/fail"
  - "retryFromFailed uses PAUSED state as bridge to resumeWorkflow — avoids duplicating resume logic"
  - "retry() now enqueues via BullMQ instead of creating dangling DB record"
  - "Default errorConfig applied via shallow merge — DB always stores complete configs"
metrics:
  completed: "2025-01-31"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 7
---

# Phase 2 Plan 02-02: Core Engine — Per-Step Retry, Pause/Resume, Manual Retry Summary

Per-step retry with exponential backoff + jitter, cooperative pause/resume via DB flag, resumeWorkflow with context rebuild from step logs, retryFromFailed from exact failure point, BullMQ-enqueued retry replacing dangling execution bug.

## What Was Done

### Task 1: Per-Step Retry + Pause Check in EngineService

**engine.service.ts (198 → 384 lines):**

1. **`executeStepWithRetry(node, context, retryConfig)`** — New method replacing `executeStep()`. Creates a single step log, then loops up to `maxAttempts` with exponential backoff (`min(baseDelay * 2^(attempt-1), maxDelay) + jitter`). On intermediate failure, updates `retryCount` on step log. On final failure, records `errorStack` and `retryCount: maxAttempts-1`. On success, records `retryCount: attempt-1`.

2. **Pause check in `executeWorkflow()`** — Before each non-trigger step, queries `workflowExecution.findUnique` for current status. If `PAUSED`, stores `lastCompletedNodeId`, emits `execution.paused` event, and returns cleanly (no throw).

3. **`resumeWorkflow(executionId)`** — Public method for resuming paused executions:
   - Loads execution with workflow + completed step logs
   - Validates status is PAUSED
   - Rebuilds `stepResults` from completed step log outputs
   - Sets status to RUNNING, emits `execution.resumed`
   - Continues topological execution from next uncompleted step
   - Includes same pause-check logic for re-pausability

4. **ErrorConfig integration** — `executeWorkflow()` reads `workflow.errorConfig` (JSON field), falls back to `DEFAULT_ERROR_CONFIG` if null. Passes `errorConfig.retry` to `executeStepWithRetry`.

**websocket.gateway.ts:**
- Added `@OnEvent('execution.paused')` → emits `execution:paused` to room
- Added `@OnEvent('execution.resumed')` → emits `execution:resumed` to room

**engine.service.spec.ts (397 → 712 lines):**
- All 12 existing tests updated for new mock structure (`workflowExecution.findUnique` default returns `{ status: 'RUNNING' }`, `makeWorkflow` includes `errorConfig`)
- 4 new retry tests: succeed-on-2nd-attempt, exhaust-all-attempts, read-from-errorConfig, use-DEFAULT_RETRY_CONFIG
- 3 new pause tests: pause-stops-execution, stores-lastCompletedNodeId, emits-execution.paused
- 3 new resume tests: throw-if-not-found, throw-if-not-PAUSED, resume-from-next-step

### Task 2: Pause/Resume/RetryFromFailed Endpoints

**executions.service.ts (126 → 192 lines):**
- Added `EngineService` and `QueueService` as constructor dependencies
- **`pause(id, userId)`** — Validates RUNNING status, sets to PAUSED with `pausedAt` timestamp
- **`resume(id, userId)`** — Validates PAUSED status, calls `engineService.resumeWorkflow(id)`
- **`retryFromFailed(id, userId)`** — Validates FAILED, finds failed step log, deletes it and subsequent logs, sets execution to PAUSED with `lastCompletedNodeId` of last completed step, then calls `resumeWorkflow`
- **`retry(id, userId)` fixed** — Now enqueues via `queueService.addExecution()` instead of creating a dangling DB record (fixes the bug where retry created an orphan execution)

**executions.controller.ts:**
- `POST :id/pause` — Pause a running execution
- `POST :id/resume` — Resume a paused execution
- `POST :id/retry-from-failed` — Retry from the exact failed step

**executions.module.ts:**
- Added `imports: [EngineModule, QueueModule]` for dependency injection

**executions.service.spec.ts (282 → 440 lines):**
- Updated test module to include mock `EngineService` and `QueueService`
- Added `executionStepLog.deleteMany` to prisma mock
- Added `nodeId` field to mock step logs
- 3 new pause tests: pause-running, reject-non-RUNNING, reject-PAUSED
- 3 new resume tests: call-resumeWorkflow, reject-non-PAUSED, reject-COMPLETED
- 4 new retryFromFailed tests: identify-failed-step, reject-non-FAILED, reject-no-failed-step, handle-first-step-failure
- 3 new retry tests: enqueue-via-BullMQ, reject-non-failed/cancelled, handle-cancelled

## Deviations from Plan

None — plan executed exactly as written.

## Key Design Decisions

1. **Cooperative pause** — The engine checks a DB flag between steps rather than using OS signals or cancellation tokens. This is simpler and works across BullMQ job boundaries since the pause request just sets a DB field.

2. **Single step log per node** — Rather than creating a new step log per retry attempt, one log is created and updated. `retryCount` tracks attempts, `errorStack` stores the final error trace.

3. **retryFromFailed bridges through PAUSED** — Instead of duplicating resume logic, `retryFromFailed` cleans up failed step logs, sets execution to PAUSED, and calls `resumeWorkflow`. This reuses the context rebuild logic.

4. **Shallow merge for errorConfig** — `{ ...DEFAULT_ERROR_CONFIG, ...workflow.errorConfig }`. The DB schema default ensures complete configs are stored, so deep merge isn't needed.

## Verification Commands

```bash
# Engine service tests (retry, pause, resume)
cd apps/backend; npx jest --testPathPattern="engine.service" --no-coverage

# Executions service tests (pause/resume/retryFromFailed endpoints)
cd apps/backend; npx jest --testPathPattern="executions" --no-coverage

# Full test suite
cd apps/backend; npx jest --no-coverage

# Verify key patterns exist
grep -n "executeStepWithRetry" apps/backend/src/engine/engine.service.ts
grep -n "resumeWorkflow" apps/backend/src/engine/engine.service.ts
grep -n "retryFromFailed" apps/backend/src/executions/executions.service.ts
grep -n "pause" apps/backend/src/executions/executions.controller.ts
grep -n "execution.paused" apps/backend/src/websocket/websocket.gateway.ts
```

## Self-Check: PASSED

All key artifacts verified:
- ✅ `executeStepWithRetry` present in engine.service.ts (lines 84, 204, 241)
- ✅ `resumeWorkflow` present in engine.service.ts (line 124)
- ✅ `retryFromFailed` present in executions.service.ts (line 84)
- ✅ `pause`, `resume`, `retry-from-failed` endpoints in executions.controller.ts (lines 57, 63, 75)
- ✅ `execution.paused`, `execution.resumed` events in websocket.gateway.ts (lines 145, 150)
- ✅ engine.service.spec.ts contains retry/pause/resume test sections
- ✅ executions.service.spec.ts contains pause/resume/retryFromFailed/retry test sections
- ✅ 02-02-SUMMARY.md exists
- ✅ STATE.md updated
- ✅ ROADMAP.md updated
- ✅ REQUIREMENTS.md EXE-01,04,05,06,07 marked complete
