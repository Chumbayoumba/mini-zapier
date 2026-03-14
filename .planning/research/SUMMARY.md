# Research Summary — Mini-Zapier Platform

> Synthesized: 2025-01-27 | Sources: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Stack Verdict

**Стек полностью подходит.** NestJS 10 + Next.js 15 + BullMQ + Prisma 6 + @xyflow/react 12 — проверенная комбинация для workflow automation. Все зависимости актуальны, совместимы, actively maintained.

**Key additions needed:**
- `isolated-vm` — замена небезопасного sandbox
- `zundo` — undo/redo для React Flow
- `@bull-board/nestjs` — UI для мониторинга очереди
- `vitest` + `@testing-library/react` — frontend тесты

---

## Table Stakes (MUST have)

| Feature | Status | Priority |
|---------|--------|----------|
| Working retry (exponential backoff) | ❌ Broken | P0 |
| Working Email IMAP trigger | ❌ Broken | P0 |
| Security fixes (SSRF, SQL, JWT, creds) | ❌ Critical | P0 |
| Dashboard with charts & filtering | ⚠️ Basic | P1 |
| Error notifications to user | ⚠️ Partial | P1 |
| Execution history with filters | ⚠️ Basic | P1 |
| Workflow pause/resume | ❌ Missing | P1 |

## Differentiators (WOW factor)

| Feature | Effort | Impact |
|---------|--------|--------|
| Undo/Redo (Ctrl+Z/Y) | Medium | High |
| Workflow templates gallery | Medium | High |
| Real-time execution viz on canvas | Medium | Very High |
| Connection validation | Low | Medium |
| Keyboard shortcuts | Low | Medium |
| Dashboard analytics (Recharts) | Medium | High |

---

## Architecture Recommendations

1. **Remove dual execution path** — Delete sandboxed processor, unify through EngineService
2. **Action Registry pattern** — Strategy + DI Map instead of switch-case
3. **Single BullMQ queue** with job types & priorities
4. **WebSocket room auth** — JWT validation in gateway, per-execution rooms
5. **Credential encryption** — AES-256-GCM for stored secrets
6. **Separate DB schema** for user-space queries (Database action)

---

## Critical Pitfalls

| # | Pitfall | Severity | Phase |
|---|---------|----------|-------|
| P1 | SSRF bypass via sandboxed processor | 🔴 | 1 |
| P2 | DB action privilege escalation | 🔴 | 1 |
| P3 | Hardcoded JWT fallback secret | 🔴 | 1 |
| P4 | Credentials in docker-compose | 🔴 | 1 |
| P5 | Job loss on restart (no graceful shutdown) | 🟡 | 2 |
| P6 | Race conditions in cron trigger | 🟡 | 2 |
| P7 | WebSocket auth bypass | 🟡 | 1 |

---

## Effort Estimate

| Category | Hours |
|----------|-------|
| P0 — Fix broken + security | ~10h |
| P1 — Complete ТЗ features | ~21h |
| P2 — Polish & testing | ~17h |
| **Total** | **~48h** |

---

## Phase Mapping (Preliminary)

1. **Security Hardening** — Fix all 4 🔴 critical issues, remove dual execution path
2. **Engine Reliability** — Fix retry, email trigger, add pause/resume, graceful shutdown
3. **Dashboard & Monitoring** — Charts, filtering, execution history, real-time updates
4. **Editor UX** — Undo/redo, templates, keyboard shortcuts, validation, execution viz
5. **Testing & CI** — Backend coverage 80%+, frontend tests, ESLint fix, CI pipeline
6. **Production Polish** — Secrets management, logging (Pino), Swagger completion, Docker hardening
