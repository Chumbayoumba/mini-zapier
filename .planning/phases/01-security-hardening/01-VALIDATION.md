# Phase 1: Security Hardening — Validation Strategy

**Created:** 2025-01-30
**Source:** Extracted from 01-RESEARCH.md §Validation Architecture

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7 + ts-jest 29.2 |
| Config file | `apps/backend/package.json` (jest section) |
| Quick run | `cd apps/backend && npx jest --testPathPattern="engine" --no-coverage` |
| Full suite | `cd apps/backend && npx jest --no-coverage` |

## Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | ActionRegistry dispatches to correct handlers | unit | `npx jest --testPathPattern="action-registry" -x` | ❌ Wave 0 |
| SEC-01 | EngineService uses registry instead of switch-case | unit | `npx jest --testPathPattern="engine.service" -x` | ✅ (needs update) |
| SEC-01 | Sandboxed processor deleted, no references | manual | Verify file doesn't exist + grep | N/A |
| SEC-02 | HttpRequestAction blocks private IPv4 ranges | unit | `npx jest --testPathPattern="http-request" -x` | ❌ Wave 0 |
| SEC-02 | HttpRequestAction blocks IPv6 loopback (::1) | unit | `npx jest --testPathPattern="http-request" -x` | ❌ Wave 0 |
| SEC-02 | HttpRequestAction blocks metadata endpoint | unit | `npx jest --testPathPattern="http-request" -x` | ❌ Wave 0 |
| SEC-03 | DatabaseAction rejects queries on `users` table | unit | `npx jest --testPathPattern="database" -x` | ❌ Wave 0 |
| SEC-03 | DatabaseAction restricts to SELECT only | unit | `npx jest --testPathPattern="database" -x` | ❌ Wave 0 |
| SEC-04 | Frontend rejects tokens when JWT_SECRET is absent | manual | Verify middleware.ts has no fallback | N/A |
| SEC-04 | Backend fails startup without JWT_SECRET | integration | Joi schema rejects missing JWT_SECRET | ✅ (implicit) |
| SEC-05 | docker-compose.prod.yml has no default passwords | manual | `grep ":-" docker-compose.prod.yml` returns 0 | N/A |
| SEC-06 | WebSocket rejects unauthenticated connections | unit | `npx jest --testPathPattern="websocket" -x` | ❌ Wave 0 |
| SEC-06 | WebSocket room-join verifies ownership | unit | `npx jest --testPathPattern="websocket" -x` | ❌ Wave 0 |
| SEC-07 | CredentialService encrypts and decrypts correctly | unit | `npx jest --testPathPattern="credential" -x` | ❌ Wave 0 |
| SEC-07 | Encrypted values !== plaintext input | unit | `npx jest --testPathPattern="credential" -x` | ❌ Wave 0 |

## Sampling Rate

- **Per task commit:** `cd apps/backend && npx jest --no-coverage`
- **Per wave merge:** `cd apps/backend && npx jest --coverage`
- **Phase gate:** Full suite green before `gsd:verify-work 1`

## Wave 0 Gaps (tests created within tasks)

- [ ] `action-registry.spec.ts` — SEC-01 (ActionRegistry unit tests)
- [ ] `http-request.action.spec.ts` — SEC-02 (SSRF tests)
- [ ] `database.action.spec.ts` — SEC-03 (DB restriction tests)
- [ ] `websocket.gateway.spec.ts` — SEC-06 (WS auth tests)
- [ ] `credential.service.spec.ts` — SEC-07 (encryption tests)
- [ ] Update `engine.service.spec.ts` — update mocks for ActionRegistry

## Nyquist Compliance

| Wave | Tasks | Automated Verify | Gap? |
|------|-------|-----------------|------|
| 1 | 01:T1, 01:T2 | jest action-registry, jest engine | ✅ No gap |
| 2 | 02:T1, 02:T2, 03:T1, 03:T2 | jest http-request, jest database, jest websocket, jest credential | ✅ No gap |

**Feedback latency:** All unit tests (fast, <10s each). No E2E suites needed for security validation.
**Max consecutive untested tasks:** 0 — all tasks have automated verification.
