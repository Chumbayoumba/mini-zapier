# Phase 03: Triggers — Fix & Complete — Validation

## Phase Gate Criteria

All must pass before phase is marked complete.

### Automated Tests

```bash
# All trigger unit tests pass (TriggersService, Webhook, Cron, Email)
cd apps/backend && npx jest --testPathPattern=triggers --no-coverage

# Full backend suite — no regressions
cd apps/backend && npx jest --no-coverage

# Frontend compiles without errors
cd apps/frontend && npx tsc --noEmit
```

### Requirement Verification

| REQ | Verification | Command/Steps |
|-----|-------------|---------------|
| TRG-01 | Webhook queues execution via BullMQ | `npx jest webhook.service.spec.ts` — asserts `queueService.addExecution` called |
| TRG-01 | Trigger record created on workflow activation | `npx jest triggers.service.spec.ts` — asserts `prisma.trigger.upsert` with webhookToken |
| TRG-02 | Cron schedules with timezone | `npx jest cron.service.spec.ts` — asserts `cron.schedule` receives timezone option |
| TRG-02 | Missed-job recovery | `npx jest cron.service.spec.ts` — asserts catch-up execution queued when lastTriggeredAt is stale |
| TRG-03 | Email per-trigger IMAP credentials | `npx jest email-trigger.service.spec.ts` — asserts Imap constructor receives trigger config values |
| TRG-03 | Email executes via QueueService | `npx jest email-trigger.service.spec.ts` — asserts `queueService.addExecution` (not `eventEmitter.emit`) |
| TRG-04 | Config key alignment | `grep -n 'cronExpression' apps/frontend/src/components/editor/node-config-panel.tsx` — must find `cronExpression` not `expression` |
| TRG-04 | Webhook URL display | `grep -n 'webhookToken\|Webhook URL' apps/frontend/src/components/editor/node-config-panel.tsx` — finds webhook URL section |
| TRG-04 | Email IMAP fields | `grep -n 'imapUser\|imapPassword' apps/frontend/src/components/editor/node-config-panel.tsx` — finds both credential fields |

### Architectural Verification

```bash
# No trigger service calls EngineService directly (all should use QueueService)
grep -rn "engineService.executeWorkflow" apps/backend/src/triggers/
# Expected: 0 matches

# QueueService used in all trigger services
grep -rn "queueService.addExecution" apps/backend/src/triggers/
# Expected: matches in webhook.service.ts, cron.service.ts, email-trigger.service.ts

# No orphan trigger.fired event emission
grep -rn "trigger.fired" apps/backend/src/triggers/
# Expected: 0 matches

# No global IMAP env vars in email service
grep -rn "IMAP_HOST\|IMAP_USER\|IMAP_PASSWORD\|IMAP_PORT" apps/backend/src/triggers/email/
# Expected: 0 matches (per-trigger config only)

# Frontend sends cronExpression (not expression)
grep -n "'expression'" apps/frontend/src/components/editor/node-config-panel.tsx
# Expected: only for TRANSFORM action (JSONata), NOT for CRON trigger
```

### Files Created/Modified

| Plan | File | Action |
|------|------|--------|
| 03-01 | `apps/backend/src/triggers/triggers.service.ts` | Created |
| 03-01 | `apps/backend/src/triggers/triggers.service.spec.ts` | Created |
| 03-01 | `apps/backend/src/triggers/triggers.module.ts` | Modified |
| 03-01 | `apps/backend/src/triggers/webhook/webhook.service.ts` | Modified |
| 03-01 | `apps/backend/src/triggers/webhook/webhook.service.spec.ts` | Modified |
| 03-02 | `apps/backend/src/triggers/cron/cron.service.ts` | Modified |
| 03-02 | `apps/backend/src/triggers/cron/cron.service.spec.ts` | Created |
| 03-03 | `apps/backend/src/triggers/email/email-trigger.service.ts` | Modified |
| 03-03 | `apps/backend/src/triggers/email/email-trigger.service.spec.ts` | Created |
| 03-03 | `apps/frontend/src/components/editor/node-config-panel.tsx` | Modified |
