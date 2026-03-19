---
phase: 02-engine-reliability
plan: "02-01"
title: "Foundation — Pino Logging, Schema Migration, Graceful Shutdown"
subsystem: engine
tags: [logging, schema, shutdown, types, bullmq]
dependency_graph:
  requires: []
  provides: [pino-logging, schema-pause-resume, execution-context-types, graceful-shutdown]
  affects: [02-02, 02-03]
tech_stack:
  added: [nestjs-pino]
  patterns: [structured-logging, shared-types, processor-separation]
key_files:
  created:
    - apps/backend/src/engine/execution-context.ts
  modified:
    - apps/backend/src/app.module.ts
    - apps/backend/src/main.ts
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/engine/engine.service.ts
    - apps/backend/src/engine/engine.module.ts
    - apps/backend/src/engine/processors/workflow.processor.ts
    - apps/backend/src/queue/queue.service.ts
    - apps/backend/src/queue/queue.module.ts
    - apps/backend/package.json
decisions:
  - "Types file placed at engine/execution-context.ts instead of engine/types/execution-context.ts (tooling limitation — no mkdir available; functionally identical)"
  - "WorkflowProcessor moved from queue.service.ts to engine/processors/ where it belongs (closer to EngineService dependency)"
  - "BullMQ job attempts: 1 — step-level retry will be handled in Plan 02-02"
metrics:
  completed: "2025-01-30"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 02 Plan 01: Foundation — Pino Logging, Schema Migration, Graceful Shutdown Summary

**One-liner:** Structured Pino logging via nestjs-pino, Prisma schema extensions for pause/resume/retry/correlation, shared ExecutionContext types, BullMQ single-attempt fix, and WorkflowProcessor separation with graceful shutdown.

## What Was Done

### Task 1: Pino Logging + Graceful Shutdown
- Added `nestjs-pino` (^4.0.0) to backend dependencies
- Wired `LoggerModule.forRoot()` as first import in `app.module.ts` with:
  - Production: `info` level, plain JSON output
  - Development: `debug` level, pino-pretty with colorize + singleLine
  - Request serializers for method/url/id and response statusCode
- Updated `main.ts` bootstrap:
  - `bufferLogs: true` on NestFactory.create for ordered startup logs
  - `app.useLogger(app.get(Logger))` to wire Pino as global logger
  - `app.enableShutdownHooks()` for graceful SIGTERM handling
  - All existing `new Logger()` usages across codebase auto-replaced by nestjs-pino

### Task 2: Schema + Types + BullMQ Fix + Processor Separation
- **Prisma Schema Extensions:**
  - `Workflow.errorConfig` (Json?, default with retry config and notification settings)
  - `WorkflowExecution.lastCompletedNodeId` (String?, for resume-from-checkpoint)
  - `WorkflowExecution.pausedAt` / `resumedAt` (DateTime?, for pause/resume tracking)
  - `WorkflowExecution.correlationId` (String?, @default(cuid()), for log correlation)
  - `ExecutionStepLog.errorStack` (String?, for full error stack traces)
- **Shared Types (execution-context.ts):**
  - `ExecutionContext` interface (extended with lastCompletedNodeId, correlationId)
  - `RetryConfig` interface (maxAttempts, baseDelayMs, maxDelayMs, jitter)
  - `WorkflowErrorConfig` interface (retry + notifications)
  - `DEFAULT_RETRY_CONFIG` and `DEFAULT_ERROR_CONFIG` constants
- **Engine Service:** Removed inline ExecutionContext interface, imports from shared types
- **BullMQ Fix:** Changed `attempts: 3` → `attempts: 1`, removed exponential backoff config (step-level retry will be in Plan 02-02, not BullMQ job-level)
- **WorkflowProcessor Separation:**
  - Moved from `queue.service.ts` to `engine/processors/workflow.processor.ts`
  - Added `onModuleDestroy()` for shutdown awareness logging
  - Registered in `EngineModule` providers (where EngineService dependency lives)
  - Added `BullModule.registerQueue({ name: 'workflow-execution' })` to EngineModule
  - Removed `EngineModule` import from `QueueModule` (no longer needed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Types file placement**
- **Found during:** Task 2, Step 3
- **Issue:** Could not create `apps/backend/src/engine/types/` subdirectory (no mkdir tool available)
- **Fix:** Placed types file at `apps/backend/src/engine/execution-context.ts` (engine root) instead of `apps/backend/src/engine/types/execution-context.ts`
- **Impact:** Import path is `'./execution-context'` from engine files instead of `'./types/execution-context'`. Functionally identical. Future plans (02-02, 02-03) should import from `'./execution-context'` or `'../engine/execution-context'`.
- **Files modified:** `apps/backend/src/engine/execution-context.ts`, `apps/backend/src/engine/engine.service.ts`

**2. [Rule 3 - Blocking] WorkflowProcessor was never in queue.module providers**
- **Found during:** Task 2, Step 6
- **Issue:** WorkflowProcessor class existed in `queue.service.ts` but was NOT listed in `QueueModule.providers` — it was effectively dead code (NestJS requires explicit provider registration)
- **Fix:** Moved to `engine/processors/workflow.processor.ts` and properly registered in `EngineModule.providers`
- **Files modified:** `apps/backend/src/queue/queue.service.ts`, `apps/backend/src/engine/processors/workflow.processor.ts`, `apps/backend/src/engine/engine.module.ts`

## Verification

### Required Commands (run after file changes)
```powershell
# 1. Install new dependency
cd F:\Razrabotka\minizapierpraktika\apps\backend; pnpm install

# 2. Push schema changes to database + regenerate client
cd F:\Razrabotka\minizapierpraktika\apps\backend; npx prisma db push --accept-data-loss; npx prisma generate

# 3. TypeScript compilation check
cd F:\Razrabotka\minizapierpraktika\apps\backend; npx tsc --noEmit

# 4. Run tests
cd F:\Razrabotka\minizapierpraktika\apps\backend; npx jest --no-coverage
```

### Verification Patterns
```powershell
# Verify key patterns exist in modified files
Select-String -Path "apps/backend/src/app.module.ts" -Pattern "LoggerModule"
Select-String -Path "apps/backend/src/main.ts" -Pattern "bufferLogs"
Select-String -Path "apps/backend/src/main.ts" -Pattern "enableShutdownHooks"
Select-String -Path "apps/backend/prisma/schema.prisma" -Pattern "lastCompletedNodeId"
Select-String -Path "apps/backend/prisma/schema.prisma" -Pattern "errorConfig"
Select-String -Path "apps/backend/src/queue/queue.service.ts" -Pattern "attempts: 1"
Select-String -Path "apps/backend/src/engine/execution-context.ts" -Pattern "DEFAULT_RETRY_CONFIG"
```

## Files Changed Summary

| File | Change |
|------|--------|
| `apps/backend/package.json` | Added `nestjs-pino: ^4.0.0` dependency |
| `apps/backend/src/app.module.ts` | Added LoggerModule.forRoot() with Pino config |
| `apps/backend/src/main.ts` | Pino logger bootstrap, bufferLogs, enableShutdownHooks |
| `apps/backend/prisma/schema.prisma` | Added errorConfig, lastCompletedNodeId, pausedAt, resumedAt, correlationId, errorStack |
| `apps/backend/src/engine/execution-context.ts` | **NEW** — ExecutionContext, RetryConfig, WorkflowErrorConfig types + defaults |
| `apps/backend/src/engine/engine.service.ts` | Removed inline interface, imports from shared types |
| `apps/backend/src/engine/engine.module.ts` | Added WorkflowProcessor provider + BullModule.registerQueue |
| `apps/backend/src/engine/processors/workflow.processor.ts` | **REPLACED** dead placeholder with actual WorkflowProcessor + onModuleDestroy |
| `apps/backend/src/queue/queue.service.ts` | Removed WorkflowProcessor class, fixed attempts: 1, removed backoff |
| `apps/backend/src/queue/queue.module.ts` | Removed EngineModule import (processor moved out) |

## Self-Check: PASSED

All files verified:
- ✅ `apps/backend/src/app.module.ts` — contains `LoggerModule.forRoot`
- ✅ `apps/backend/src/main.ts` — contains `bufferLogs`, `useLogger`, `enableShutdownHooks`
- ✅ `apps/backend/prisma/schema.prisma` — contains `errorConfig`, `lastCompletedNodeId`, `pausedAt`, `resumedAt`, `correlationId`, `errorStack`
- ✅ `apps/backend/src/engine/execution-context.ts` — exports `DEFAULT_RETRY_CONFIG`, `DEFAULT_ERROR_CONFIG`, `RetryConfig`, `WorkflowErrorConfig`
- ✅ `apps/backend/src/queue/queue.service.ts` — contains `attempts: 1`
- ✅ `apps/backend/src/engine/processors/workflow.processor.ts` — contains `@Processor`, `onModuleDestroy`
- ✅ `apps/backend/src/engine/engine.module.ts` — contains `WorkflowProcessor`, `BullModule.registerQueue`
- ✅ `apps/backend/src/queue/queue.module.ts` — no EngineModule import
- ✅ `apps/backend/package.json` — contains `nestjs-pino`
- ✅ `.planning/phases/02-engine-reliability/02-01-SUMMARY.md` — exists
