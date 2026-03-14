# STATE.md — Mini-Zapier Project Memory

> Last updated: 2025-01-31

---

## Current Focus
Phase: 02-engine-reliability
Current Plan: 2 of 3 (02-01, 02-02 complete)
Next action: `gsd:execute-phase 2` (Execute Plan 02-03)

## Phase Status

| Phase | Name | Status | Plans |
|-------|------|--------|-------|
| 1 | Security Hardening & Architecture Cleanup | ✅ Complete | 3/3 complete |
| 2 | Engine Reliability & Error Handling | 🔄 In Progress | 2/3 complete |
| 3 | Triggers — Fix & Complete | ⬜ Not started | — |
| 4 | Actions — Complete & Harden | ⬜ Not started | — |
| 5 | Dashboard & Monitoring | ⬜ Not started | — |
| 6 | Editor UX Polish | ⬜ Not started | — |
| 7 | API Documentation & Quality | ⬜ Not started | — |
| 8 | Production Readiness | ⬜ Not started | — |

## Key Decisions

| Decision | Context | Date |
|----------|---------|------|
| Remove dual execution path | sandboxed.processor.ts is security risk + complexity | 2025-01-27 |
| Strategy + Registry for actions | Replace switch-case with ActionHandler interface + Map | 2025-01-27 |
| Single BullMQ queue with job types | Simpler than separate queues per trigger type | 2025-01-27 |
| AES-256-GCM for credentials | Encrypt SMTP/IMAP/Telegram tokens at rest | 2025-01-27 |
| Pino for structured logging | Replace default NestJS logger with correlation IDs | 2025-01-27 |
| JSONata for data transform | More powerful than simple template strings | 2025-01-27 |
| Vitest + RTL for frontend tests | Faster than Jest, better DX | 2025-01-27 |
| Recharts for dashboard charts | Lightweight, React-native, good defaults | 2025-01-27 |
| zundo for undo/redo | Zustand middleware, works with existing store | 2025-01-27 |
| ActionRegistry uses Map + OnModuleInit | O(1) lookup, NestJS lifecycle-aware registration | 2025-01-30 |
| isPrivateIp treats invalid IPs as private | Fail-closed — unparseable IPs blocked for safety | 2025-01-30 |
| DNS resolves both A+AAAA, fail-closed if both fail | Ensures IPv6 private IPs can't bypass SSRF | 2025-01-30 |
| SELECT-only database action, dead code removed | executeInsert/Update/Delete removed after guard | 2025-01-30 |
| WebSocket room-join ownership via Prisma | findFirst with workflow include for execution, compound where for workflow | 2025-01-30 |
| CredentialService iv:authTag:ciphertext format | Colon-separated base64 for human-debuggable encrypted values | 2025-01-30 |
| CREDENTIAL_ENCRYPTION_KEY optional in dev | Production-required via Joi validation, allows easy local development | 2025-01-30 |
| Types file at engine/execution-context.ts | Placed at engine root (tooling limitation — no mkdir for types/ subdir) | 2025-01-30 |
| BullMQ attempts: 1, step-level retry in 02-02 | Job-level retry re-runs entire workflow; step-level is correct approach | 2025-01-30 |
| WorkflowProcessor in EngineModule providers | Processor depends on EngineService, belongs in same module | 2025-01-30 |
| Cooperative pause via DB status flag | Engine checks between steps, not signal-based; works across BullMQ jobs | 2025-01-31 |
| Single step log per node, updated on retry | retryCount tracks attempts, errorStack stores final trace | 2025-01-31 |
| retryFromFailed bridges through PAUSED state | Cleans up failed logs, sets PAUSED, calls resumeWorkflow to reuse logic | 2025-01-31 |
| retry() enqueues via BullMQ not direct DB | Fixes dangling execution bug — fresh execution via queue | 2025-01-31 |

## Gotchas & Warnings

- **vm2 is deprecated** — don't use, switch to isolated-vm if sandbox needed
- **Prisma 6 breaking changes** — check migration guide if upgrading
- **@xyflow/react v12** — use `useReactFlow()` not deprecated `useStore()`
- **BullMQ requires Redis 6.2+** — Docker Compose already has Redis 7 ✓
- **Next.js 15 App Router** — project uses Pages Router, don't mix
- **Types path deviation** — `ExecutionContext` types at `engine/execution-context.ts` not `engine/types/execution-context.ts`

## Quick Tasks Completed

| Task | Description | Date |
|------|-------------|------|
| — | — | — |

## Last Session
- **Stopped at:** Completed 02-02-PLAN.md (Core Engine — Per-Step Retry, Pause/Resume, Manual Retry)
