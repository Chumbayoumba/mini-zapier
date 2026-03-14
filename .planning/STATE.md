# STATE.md — Mini-Zapier Project Memory

> Last updated: 2026-03-14

---

## Current Focus
Phase: 07-api-docs-quality
Current Plan: —
Next action: `gsd:plan-phase 7` (API Documentation & Quality)

## Phase Status

| Phase | Name | Status | Plans |
|-------|------|--------|-------|
| 1 | Security Hardening & Architecture Cleanup | ✅ Complete | 3/3 complete |
| 2 | Engine Reliability & Error Handling | ✅ Complete | 3/3 complete |
| 3 | Triggers — Fix & Complete | ✅ Complete | 3/3 complete |
| 4 | Actions — Complete & Harden | ✅ Complete | 3/3 complete |
| 5 | Dashboard & Monitoring | ✅ Complete | 3/3 complete |
| 6 | Editor UX Polish | ✅ Complete | 3/3 complete |
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
| Per-user WebSocket rooms via client.join | Auto-join user:{userId} on connection for targeted notifications | 2025-01-31 |
| notification.send event bridges Service→Gateway | Decouples NotificationsService from WebSocket gateway via EventEmitter2 | 2025-01-31 |
| Structured logging with object params | this.logger.log({ msg, correlationId }) → Pino outputs JSON with all fields | 2025-01-31 |
| ExecutionFailureToast in global providers | Mounted globally so all authenticated users get failure toasts | 2025-01-31 |

| TemplateEngine as static utility, no DI | Pure function, no module registration needed | 2025-01-31 |
| Remove Telegram interpolateMessage | Shared TemplateEngine in EngineService replaces private method | 2025-01-31 |
| Per-execution SMTP in email action | Step config → context.integrations → global env fallback chain | 2025-01-31 |
| Select/Textarea components for frontend panels | Native HTML wrapped in shadcn styling, no new dependencies | 2025-01-31 |

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
- **Stopped at:** Phase 6 complete, ready for Phase 7
- **Phase 6 complete:** All 3 plans (06-01, 06-02, 06-03) finished — undo/redo, validation, auto-save, toolbar, polish
- **Test baseline:** 21 suites, 356 tests — ALL PASS
