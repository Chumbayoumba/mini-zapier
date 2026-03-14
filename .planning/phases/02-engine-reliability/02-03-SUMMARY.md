---
phase: 02-engine-reliability
plan: "02-03"
subsystem: notifications, engine, frontend
tags: [notifications, websocket, error-display, correlation-id, structured-logging, toast]
dependency_graph:
  requires: ["02-01"]
  provides: ["per-user-notifications", "execution-failure-toast", "structured-error-display", "correlation-id-logging"]
  affects: ["notifications-service", "websocket-gateway", "engine-service", "execution-detail-page", "frontend-providers"]
tech_stack:
  added: []
  patterns: ["event-driven-notification", "user-specific-websocket-rooms", "structured-pino-logging", "collapsible-error-ui"]
key_files:
  created:
    - apps/backend/src/notifications/notifications.service.spec.ts
    - apps/frontend/src/components/execution-failure-toast.tsx
  modified:
    - apps/backend/src/notifications/notifications.service.ts
    - apps/backend/src/notifications/notifications.module.ts
    - apps/backend/src/websocket/websocket.gateway.ts
    - apps/backend/src/engine/engine.service.ts
    - apps/frontend/src/types/index.ts
    - apps/frontend/src/providers/providers.tsx
    - apps/frontend/src/app/(dashboard)/executions/[id]/page.tsx
decisions:
  - "Per-user WebSocket rooms via client.join(user:{userId}) on connection — enables targeted notifications"
  - "notification.send event bridges NotificationsService to WebSocket gateway via EventEmitter2"
  - "Structured logging with object params to NestJS Logger — Pino outputs JSON with correlationId/actionType/duration fields"
  - "ExecutionFailureToast as behavior-only component mounted in providers — no UI, just WebSocket listener"
metrics:
  completed: "2025-01-31"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 9
---

# Phase 2 Plan 02-03: Error Handling & Notifications — Per-User Alerts, Error Display, Logging Context Summary

Per-user failure notifications via WebSocket (user-specific rooms) + optional email, structured error display on execution detail page with failed node context/input/stack trace, structured logging with correlationId/actionType/duration in all engine execution logs.

## What Was Done

### Task 1: Per-user notifications + enhanced logging context (TDD)

**NotificationsService rewrite:**
- Added PrismaService and EventEmitter2 to constructor (was ConfigService-only)
- `handleExecutionFailed()` now loads workflow with owner info and errorConfig
- When `errorConfig.notifications.inApp` is true (default), emits `notification.send` event with userId, sending `execution:failed` to user-specific WebSocket room
- When `errorConfig.notifications.email` is true, sends email to configured address (or falls back to owner email)
- Global admin notifications (Telegram + email) preserved with enhanced message including owner info

**WebSocket gateway enhancements:**
- On connection, clients auto-join `user:{userId}` room
- New `emitToUser()` private method for user-targeted emissions
- New `@OnEvent('notification.send')` handler routes events to user rooms

**NotificationsModule:**
- Added PrismaModule import (PrismaService is @Global but explicit import for clarity)

**EngineService structured logging:**
- `executeWorkflow()`: logs correlationId + workflowId + executionId on start
- `executeStepWithRetry()`: logs correlationId + nodeId + actionType + executionId on step start
- On step completion: adds duration to structured log
- On step failure (all retries exhausted): logs error message + errorStack with full context

**Tests:**
- Created `notifications.service.spec.ts` with 6 tests:
  - Service instantiation
  - In-app notification emitted via notification.send event (default config)
  - In-app notification suppressed when disabled in errorConfig
  - Graceful no-op when execution not found
  - workflowId included in notification data
  - Email sent to custom address / owner email when email enabled

### Task 2: Frontend — failure toast + enhanced error display

**Types update:**
- Added `errorStack?: string` to `ExecutionStepLog` interface

**ExecutionFailureToast component:**
- Behavior-only component (renders null)
- Listens for `execution:failed` WebSocket events
- Shows Sonner toast with workflow name, error, and "View Details" action link
- 10-second duration for visibility

**Providers update:**
- Mounted `<ExecutionFailureToast />` after `<Toaster />` in providers tree

**Execution detail page enhancements:**
- Structured error display for FAILED executions:
  - Failed node name + type
  - Node ID with code styling
  - Retry attempts count
  - Collapsible input data section
  - Collapsible stack trace section
- Step log rows now show:
  - Collapsible input data
  - Collapsible output data
  - Collapsible stack trace (for failed steps)
- Properly typed step logs using `ExecutionStepLog` type (was `Record<string, unknown>`)

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

1. **Per-user WebSocket rooms via client.join** — Simplest approach: on auth, auto-join `user:{userId}` room. No room management needed.
2. **notification.send event pattern** — Decouples NotificationsService from WebSocket gateway. Service emits event, gateway handles routing.
3. **Structured logging via object params** — `this.logger.log({ msg, correlationId, ... })` works because nestjs-pino replaces NestJS Logger, outputting JSON with all fields.
4. **ExecutionFailureToast in providers** — Mounted globally so all authenticated users get failure toasts regardless of current page.

## Verification Results

- `notification.send` pattern in notifications.service.ts ✓
- `emitToUser` + `user:` room in websocket.gateway.ts ✓
- `errorStack` in frontend types/index.ts ✓
- `execution:failed` in execution-failure-toast.tsx ✓
- `ExecutionFailureToast` in providers.tsx ✓
- `correlationId` structured logging in engine.service.ts ✓

## Self-Check: PASSED

All 10 files verified to exist:
- apps/backend/src/notifications/notifications.service.ts ✓
- apps/backend/src/notifications/notifications.service.spec.ts ✓
- apps/backend/src/notifications/notifications.module.ts ✓
- apps/backend/src/websocket/websocket.gateway.ts ✓
- apps/backend/src/engine/engine.service.ts ✓
- apps/frontend/src/types/index.ts ✓
- apps/frontend/src/components/execution-failure-toast.tsx ✓
- apps/frontend/src/providers/providers.tsx ✓
- apps/frontend/src/app/(dashboard)/executions/[id]/page.tsx ✓
- .planning/phases/02-engine-reliability/02-03-SUMMARY.md ✓
