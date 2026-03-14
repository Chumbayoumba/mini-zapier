# STATE.md — Mini-Zapier Project Memory

> Last updated: 2025-01-27

---

## Current Focus
Phase: Not started
Next action: `gsd:plan-phase 1`

## Phase Status

| Phase | Name | Status | Plans |
|-------|------|--------|-------|
| 1 | Security Hardening & Architecture Cleanup | ⬜ Not started | — |
| 2 | Engine Reliability & Error Handling | ⬜ Not started | — |
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

## Gotchas & Warnings

- **vm2 is deprecated** — don't use, switch to isolated-vm if sandbox needed
- **Prisma 6 breaking changes** — check migration guide if upgrading
- **@xyflow/react v12** — use `useReactFlow()` not deprecated `useStore()`
- **BullMQ requires Redis 6.2+** — Docker Compose already has Redis 7 ✓
- **Next.js 15 App Router** — project uses Pages Router, don't mix

## Quick Tasks Completed

| Task | Description | Date |
|------|-------------|------|
| — | — | — |
