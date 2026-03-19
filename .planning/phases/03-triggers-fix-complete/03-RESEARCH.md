# Phase 3: Triggers — Fix & Complete - Research

**Researched:** 2025-01-31
**Domain:** Workflow triggers (Webhook, Cron, Email IMAP) — backend services + frontend configuration UI
**Confidence:** HIGH — based on direct code analysis of all relevant files

## Summary

Phase 3 addresses a system where **trigger execution partially works but trigger management is fundamentally broken**. The codebase has three trigger services (Webhook, Cron, Email) with varying levels of functionality, but they all share a critical gap: **there is no API to create, update, or delete Trigger database records**. The WorkflowsController has no trigger management endpoints, and the activate/deactivate flow doesn't sync triggers to the database. This means even working trigger code (Webhook, Cron) can never fire because no Trigger records are created.

The Webhook trigger is the most complete — the service and controller work correctly if a Trigger record exists. The Cron trigger works for scheduling but lacks timezone support and missed-job recovery. The Email trigger is fundamentally broken — it uses an outdated `imap` library, reads credentials from global env vars (not per-trigger), and emits a `trigger.fired` event that **nothing listens to**, so email triggers never start workflow execution.

**Primary recommendation:** Build trigger CRUD API + lifecycle sync first (the foundation), then fix each trigger type, then enhance the frontend panels. All triggers should execute workflows through QueueService (BullMQ) instead of calling EngineService directly.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TRG-01 | Webhook trigger with payload forwarding | Webhook service works if Trigger record exists. Need: trigger CRUD API, auto-generate webhookToken, route execution through QueueService |
| TRG-02 | Cron trigger with timezone, missed job recovery | CronService exists but lacks timezone param, missed-job recovery, and event-based sync. Need: timezone in schedule(), cron-parser for missed job detection, @OnEvent handlers |
| TRG-03 | Email IMAP trigger with filtering | EmailTriggerService is broken — uses global env IMAP, emits event nobody listens to, crude email parsing. Need: per-trigger credentials, proper IMAP polling, actual workflow execution on match |
| TRG-04 | Trigger configuration panels in editor | NodeConfigPanel exists with basic fields but no validation, mismatched config keys, no connection test. Need: field alignment, Zod validation, cron validator, webhook URL display, IMAP test |
</phase_requirements>

## File-by-File Analysis

### Backend Trigger Services

#### `apps/backend/src/triggers/triggers.module.ts`
**Status:** Exists, basic wiring
- Imports EngineModule, registers WebhookController, WebhookService, CronService, EmailTriggerService
- Exports WebhookService and CronService (but NOT EmailTriggerService)
- **Missing:** No trigger CRUD controller, no event listeners for workflow lifecycle

#### `apps/backend/src/triggers/webhook/webhook.controller.ts`
**Status:** ✅ Working
- POST `/webhooks/:token` — receives webhook, marked @Public() (no JWT required)
- Delegates to WebhookService.processWebhook()
- Has Swagger decorators
- **No issues found**

#### `apps/backend/src/triggers/webhook/webhook.service.ts`
**Status:** ⚠️ Mostly working, architectural issue
- Looks up Trigger by unique `webhookToken`, checks workflow is ACTIVE
- Calls `engineService.executeWorkflow()` **directly** — bypasses BullMQ queue
- Updates `lastTriggeredAt` on trigger record
- **Issue:** Should use QueueService.addExecution() for durability and async response
- **Has tests:** webhook.controller.spec.ts and webhook.service.spec.ts (comprehensive)

#### `apps/backend/src/triggers/cron/cron.service.ts`
**Status:** ⚠️ Partially working, needs hardening
- Uses `node-cron` (v3.0.3) for scheduling
- `onModuleInit()` loads all active CRON triggers from DB
- `scheduleCron()` validates expression via `cron.validate()`, creates scheduled task
- `stopCron()` and `onModuleDestroy()` properly clean up
- **Issues:**
  1. **No timezone support** — `cron.schedule()` accepts `timezone` option but it's not passed from config
  2. **No missed-job recovery** — server restart loses all pending fires
  3. **Config key mismatch** — backend reads `config.cronExpression`, frontend sends `config.expression`
  4. **Calls engineService.executeWorkflow() directly** — should use QueueService
  5. **No event listeners** for `workflow.activated`/`workflow.deactivated`/`workflow.updated` — cron jobs aren't synced on lifecycle changes
- **No tests exist**

#### `apps/backend/src/triggers/email/email-trigger.service.ts`
**Status:** ❌ Fundamentally broken
- **Problem 1:** Uses global env vars (`IMAP_HOST`, `IMAP_USER`, etc.) for ALL email triggers — no per-trigger credentials
- **Problem 2:** Emits `trigger.fired` event on line 73 but **NO @OnEvent handler exists anywhere** — emails are detected but never start workflow execution
- **Problem 3:** Uses raw `imap` (v0.8.19) library — last published 2017, callback-based API
- **Problem 4:** Email body parsing is crude — regex on raw headers, body = first 500 chars of raw header text
- **Problem 5:** `tlsOptions: { rejectUnauthorized: false }` — accepts any certificate
- **Problem 6:** Single IMAP connection per poll cycle — creates/destroys connection every 60 seconds
- **Problem 7:** Only processes first 10 UNSEEN messages per cycle
- **Problem 8:** Constructor calls `startPolling()` unconditionally on config presence
- **Not exported** from TriggersModule
- **No tests exist**

### Backend Supporting Services

#### `apps/backend/src/engine/engine.service.ts`
- `executeWorkflow()` creates execution record, runs nodes in topological order
- Identifies trigger nodes via `node.type === 'triggerNode'`, `node.id?.startsWith('trigger-')`, or `TRIGGER_ONLY_TYPES.includes(node.data.type)`
- Stores triggerData as output of trigger nodes in stepResults

#### `apps/backend/src/queue/queue.service.ts`
- `addExecution()` queues jobs to BullMQ `workflow-execution` queue
- WorkflowProcessor picks up jobs and calls `engineService.executeWorkflow()`
- **Currently not used by any trigger** — triggers call EngineService directly

#### `apps/backend/src/workflows/workflows.service.ts`
- `activate()` sets status to ACTIVE, emits `workflow.activated` — **but nobody listens for triggers**
- `deactivate()` sets status to PAUSED, emits `workflow.deactivated` — **no trigger cleanup**
- `update()` emits `workflow.updated` — **no trigger config re-sync**
- **No trigger CRUD operations anywhere**

### Database Schema — Trigger Model

```prisma
model Trigger {
  id              String      @id @default(cuid())
  workflowId      String      @unique  // 1:1 with Workflow
  type            TriggerType // WEBHOOK | CRON | EMAIL
  config          Json        @default("{}")
  isActive        Boolean     @default(true)
  webhookToken    String?     @unique
  lastTriggeredAt DateTime?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}
```
Schema is **adequate** for all three trigger types. No migration needed.

### Frontend Components

#### `apps/frontend/src/app/(dashboard)/workflows/[id]/editor/page.tsx`
**Status:** Working editor with drag-and-drop
- Defines TRIGGER_TYPES (WEBHOOK, CRON, EMAIL) in sidebar palette
- Creates nodes: `id: trigger-${Date.now()}`, `type: 'triggerNode'`, `data: { label, type, config: {} }`
- Saves via `updateWorkflow.mutateAsync({ id, definition: { nodes, edges } })`
- **Missing:** No trigger sync on save — just saves definition JSON

#### `apps/frontend/src/components/editor/node-config-panel.tsx`
**Status:** ⚠️ Basic fields, no validation, key mismatches
- TRIGGER_FIELDS:
  - WEBHOOK: `path` (❌ should show webhook URL), `secret`
  - CRON: `expression` (❌ backend expects `cronExpression`), `timezone`
  - EMAIL: `imapHost`, `imapPort`, `filter`
- All fields are plain `<Input>` — **no validation whatsoever**
- **Missing:** Cron validator, webhook URL display/copy, IMAP connection test

#### `apps/frontend/src/components/editor/nodes/trigger-node.tsx`
**Status:** ✅ Working — proper rendering with icons, colors, source handle

#### `apps/frontend/src/stores/editor-store.ts`
**Status:** ✅ Working — Zustand store, no trigger-specific changes needed

#### `apps/frontend/src/types/index.ts`
**Status:** ✅ Adequate — `TriggerType`, `Trigger` interface, `Workflow.trigger?` all defined

## Gap Analysis

### Critical Gaps (Must Fix)

| Gap | Impact | Affected |
|-----|--------|----------|
| **No Trigger CRUD API** | Users can't create trigger records — no trigger can ever fire | ALL triggers |
| **No trigger lifecycle sync** | Activating/deactivating workflow doesn't start/stop triggers | Cron, Email |
| **Email `trigger.fired` has no listener** | Emails detected but never start execution | TRG-03 |
| **Config key mismatches** | Frontend saves different keys than backend reads | TRG-02, TRG-04 |
| **Triggers bypass BullMQ queue** | No job durability, synchronous execution blocks trigger handler | TRG-01, TRG-02 |

### Moderate Gaps (Should Fix)

| Gap | Impact | Affected |
|-----|--------|----------|
| No timezone in cron scheduling | Cron fires in server timezone only | TRG-02 |
| No missed-job recovery | Server restart = missed cron fires | TRG-02 |
| Global IMAP credentials | All email triggers use same mailbox | TRG-03 |
| No config validation (frontend) | Invalid expressions silently saved | TRG-04 |
| No webhook URL display | Users can't see/copy webhook endpoint | TRG-04 |

## Architecture Patterns

### Current Flow (BROKEN)

```
1. User drags trigger node → saved in workflow.definition JSON only
2. User activates workflow → status = ACTIVE, events emitted but nobody syncs triggers
3. Trigger records never created in DB → triggers can never fire
```

### Recommended Flow

```
1. User drags trigger node, configures in panel → saved in workflow.definition JSON
2. User saves workflow → PATCH /workflows/:id (definition saved)
3. User activates workflow → POST /workflows/:id/activate
   → WorkflowsService.activate() emits 'workflow.activated'
   → TriggersService @OnEvent('workflow.activated'):
     a. Reads trigger node from definition
     b. Upserts Trigger DB record (generates webhookToken for WEBHOOK type)
     c. CRON → CronService.scheduleCron()
     d. EMAIL → picked up by EmailTriggerService polling (isActive=true)
4. Trigger fires → QueueService.addExecution() → BullMQ → WorkflowProcessor → EngineService
5. User deactivates → @OnEvent('workflow.deactivated'):
   → Trigger.isActive = false, CronService.stopCron()
```

### Recommended File Structure Changes

```
apps/backend/src/triggers/
├── triggers.module.ts          # UPDATE: add TriggersService, QueueModule import
├── triggers.service.ts         # NEW: lifecycle sync, @OnEvent handlers, trigger sync from definition
├── triggers.service.spec.ts    # NEW: tests
├── webhook/
│   ├── webhook.controller.ts   # KEEP as-is
│   ├── webhook.service.ts      # UPDATE: use QueueService instead of EngineService
│   └── *.spec.ts               # UPDATE: reflect QueueService change
├── cron/
│   ├── cron.service.ts         # UPDATE: timezone, missed jobs, use QueueService
│   └── cron.service.spec.ts    # NEW
└── email/
    ├── email-trigger.service.ts # MAJOR REWRITE: per-trigger config, proper execution
    └── email-trigger.service.spec.ts # NEW
```

### Anti-Patterns to Avoid
- **Don't call EngineService directly from triggers** — always use QueueService for durability
- **Don't store trigger config in two places** — definition JSON = editor config, Trigger DB record = operational state
- **Don't replace `imap` library** — focus on wiring correctly, the library is functional
- **Don't create separate trigger save UX** — sync automatically on activation

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron validation | Custom regex | `cron-parser` (in deps, unused) | Validates + computes next run times |
| Cron scheduling | setInterval | `node-cron` (in use) | Handles DST, proper cron semantics |
| UUID tokens | Random strings | `crypto.randomUUID()` (Node built-in) | Cryptographic randomness |
| Timezone list | Hardcoded array | `Intl.supportedValuesOf('timeZone')` | Browser API, always current |

## Implementation Recommendations

### TRG-01: Webhook Trigger — Complexity: LOW
1. Create TriggersService with `syncTriggerFromDefinition(workflowId)` — upserts Trigger record, auto-generates `webhookToken`
2. Wire @OnEvent('workflow.activated') → sync trigger
3. Update WebhookService to inject QueueService, call `addExecution()` instead of `executeWorkflow()`
4. Return webhook URL in trigger response: `${BACKEND_URL}/webhooks/${webhookToken}`

### TRG-02: Cron Trigger — Complexity: MEDIUM
1. Fix config key: align frontend to send `cronExpression` (or read both keys in backend)
2. Pass `timezone` option to `cron.schedule()` third argument
3. Missed-job recovery: on `onModuleInit()`, use `cron-parser` to check if fire was missed since `lastTriggeredAt` — fire at most 1 catch-up
4. Add @OnEvent handlers: `workflow.activated` → schedule, `workflow.deactivated` → stop, `workflow.updated` → reschedule
5. Route through QueueService

### TRG-03: Email IMAP Trigger — Complexity: HIGH
1. **Remove global env dependency** — read IMAP credentials from each trigger's `config` JSON
2. **Fix execution path** — replace `trigger.fired` event emission with `QueueService.addExecution()` call
3. Support CredentialService encryption for IMAP passwords
4. Track last-seen UID per trigger to avoid re-processing
5. Improve email parsing: at minimum handle From/Subject/Date properly; consider `mailparser` if body parsing quality matters
6. Add connection validation endpoint for IMAP test from UI

### TRG-04: Trigger Config Panels — Complexity: MEDIUM
1. **Align config keys**: `expression` → `cronExpression` throughout frontend
2. **WEBHOOK panel**: read-only webhook URL display with copy button (URL available after activation)
3. **CRON panel**: add expression validation feedback, optional "Next 5 runs" preview using `cron-parser`
4. **EMAIL panel**: add IMAP credential fields (user, password), "Test Connection" button
5. **All panels**: add Zod validation for required fields

## Risk / Complexity Assessment

| Requirement | Risk | Complexity | Rationale |
|-------------|------|------------|-----------|
| TRG-01 (Webhook) | LOW | LOW | Working code, needs queue routing + trigger sync |
| TRG-02 (Cron) | MEDIUM | MEDIUM | Working scheduler, timezone/missed-job/event-sync needs care |
| TRG-03 (Email) | HIGH | HIGH | Fundamentally broken, major rework of credential flow + execution wiring |
| TRG-04 (UI Panels) | LOW | MEDIUM | Existing panels need validation + key alignment + webhook URL display |
| Trigger CRUD/sync | LOW | MEDIUM | Standard NestJS pattern, critical dependency for everything |

**Overall phase risk: MEDIUM-HIGH** — Email trigger is the main risk factor.

## Common Pitfalls

### Pitfall 1: Trigger Record Not Created on Activation
**What goes wrong:** User activates workflow, expects triggers to work, nothing happens
**Why it happens:** No code syncs definition JSON trigger node to Trigger DB record
**How to avoid:** Add trigger sync in @OnEvent('workflow.activated')
**Warning signs:** Webhook returns 404, cron never fires

### Pitfall 2: Config Key Mismatch Frontend ↔ Backend
**What goes wrong:** Frontend saves `expression`, backend reads `cronExpression` — cron never schedules
**Why it happens:** No shared contract between frontend panel fields and backend config shape
**How to avoid:** Standardize on one key naming, document the contract
**Warning signs:** Config fields appear empty in backend logs

### Pitfall 3: Synchronous Trigger Execution
**What goes wrong:** Webhook blocks until entire workflow completes; long workflows cause HTTP timeout
**Why it happens:** Direct EngineService call instead of QueueService
**How to avoid:** Always route through QueueService.addExecution()
**Warning signs:** Webhook callers get timeout errors

### Pitfall 4: Cron Jobs Not Synced on Lifecycle Changes
**What goes wrong:** User changes cron expression or deactivates workflow, old schedule continues
**Why it happens:** CronService only loads on startup, doesn't listen for events
**How to avoid:** @OnEvent listeners for activated/deactivated/updated
**Warning signs:** Cron fires at old schedule after config change

### Pitfall 5: node-cron Timezone Silently Ignored
**What goes wrong:** Cron fires at wrong time, no error thrown
**Why it happens:** node-cron accepts invalid timezone strings, falls back to system default
**How to avoid:** Validate timezone before passing to cron.schedule()
**Warning signs:** Unexpected fire times for non-UTC users

## Code Examples

### Trigger Sync from Definition (Core Pattern)
```typescript
// apps/backend/src/triggers/triggers.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CronService } from './cron/cron.service';
import { randomUUID } from 'crypto';

@Injectable()
export class TriggersService {
  private readonly logger = new Logger(TriggersService.name);

  constructor(
    private prisma: PrismaService,
    private cronService: CronService,
  ) {}

  @OnEvent('workflow.activated')
  async handleActivated({ workflowId }: { workflowId: string }) {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) return;

    const definition = workflow.definition as { nodes: any[] };
    const triggerNode = definition.nodes?.find(
      (n) => n.type === 'triggerNode' || ['WEBHOOK', 'CRON', 'EMAIL'].includes(n.data?.type),
    );
    if (!triggerNode) return;

    const triggerType = triggerNode.data.type;
    const config = triggerNode.data.config || {};

    const trigger = await this.prisma.trigger.upsert({
      where: { workflowId },
      create: {
        workflowId,
        type: triggerType,
        config,
        isActive: true,
        webhookToken: triggerType === 'WEBHOOK' ? randomUUID() : null,
      },
      update: { type: triggerType, config, isActive: true },
    });

    if (triggerType === 'CRON') {
      this.cronService.scheduleCron(trigger.id, config, workflowId);
    }

    this.logger.log(`Trigger synced for workflow ${workflowId}: ${triggerType}`);
  }

  @OnEvent('workflow.deactivated')
  async handleDeactivated({ workflowId }: { workflowId: string }) {
    const trigger = await this.prisma.trigger.findUnique({ where: { workflowId } });
    if (!trigger) return;

    await this.prisma.trigger.update({ where: { id: trigger.id }, data: { isActive: false } });

    if (trigger.type === 'CRON') {
      this.cronService.stopCron(trigger.id);
    }
  }
}
```

### Webhook via Queue
```typescript
// Updated WebhookService — key change
async processWebhook(token: string, body: any, headers: Record<string, string>) {
  const trigger = await this.prisma.trigger.findUnique({
    where: { webhookToken: token },
    include: { workflow: true },
  });
  if (!trigger || trigger.workflow.status !== 'ACTIVE') {
    throw new NotFoundException('Invalid or inactive webhook');
  }

  const jobId = await this.queueService.addExecution(trigger.workflowId, {
    body,
    headers,
    receivedAt: new Date().toISOString(),
  });

  await this.prisma.trigger.update({
    where: { id: trigger.id },
    data: { lastTriggeredAt: new Date() },
  });

  return { jobId, status: 'triggered' };
}
```

### Cron with Timezone
```typescript
// node-cron schedule with timezone option
const task = cron.schedule(cronExpression, callback, {
  timezone: config.timezone || 'UTC',
});
```

### Missed Job Recovery
```typescript
import * as cronParser from 'cron-parser';

async recoverMissedJobs(trigger: any) {
  const { cronExpression } = trigger.config;
  if (!trigger.lastTriggeredAt || !cronExpression) return;

  try {
    const interval = cronParser.parseExpression(cronExpression, {
      currentDate: trigger.lastTriggeredAt,
    });
    const nextFire = interval.next().toDate();

    if (nextFire < new Date()) {
      this.logger.warn(`Recovering missed cron for trigger ${trigger.id}`);
      await this.queueService.addExecution(trigger.workflowId, {
        trigger: 'cron',
        scheduledAt: nextFire.toISOString(),
        recovered: true,
      });
    }
  } catch (err) {
    this.logger.error(`Failed to check missed jobs for ${trigger.id}: ${err}`);
  }
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29 + ts-jest |
| Config file | `apps/backend/package.json` (jest section) |
| Quick run command | `cd apps/backend && npx jest --testPathPattern=triggers --no-coverage` |
| Full suite command | `cd apps/backend && npx jest --no-coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRG-01 | Webhook queues execution via QueueService | unit | `npx jest webhook.service.spec.ts -x` | ✅ (needs update) |
| TRG-01 | Webhook controller routes POST to service | unit | `npx jest webhook.controller.spec.ts -x` | ✅ |
| TRG-02 | Cron schedules with timezone | unit | `npx jest cron.service.spec.ts -x` | ❌ Wave 0 |
| TRG-02 | Missed job recovery fires catch-up | unit | `npx jest cron.service.spec.ts -x` | ❌ Wave 0 |
| TRG-03 | Email detects new email, queues execution | unit | `npx jest email-trigger.service.spec.ts -x` | ❌ Wave 0 |
| TRG-04 | Trigger sync on workflow activation | unit | `npx jest triggers.service.spec.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/backend && npx jest --testPathPattern=triggers --no-coverage`
- **Per wave merge:** `cd apps/backend && npx jest --no-coverage`
- **Phase gate:** Full suite green

### Wave 0 Gaps
- [ ] `apps/backend/src/triggers/cron/cron.service.spec.ts` — covers TRG-02
- [ ] `apps/backend/src/triggers/email/email-trigger.service.spec.ts` — covers TRG-03
- [ ] `apps/backend/src/triggers/triggers.service.spec.ts` — covers trigger lifecycle sync
- [ ] Update `webhook.service.spec.ts` — reflect QueueService routing change

## Open Questions

1. **Per-trigger vs global IMAP credentials?**
   - Recommendation: Per-trigger credentials via CredentialService — more flexible, aligns with multi-workflow use

2. **How many missed cron jobs to recover?**
   - Recommendation: At most 1 — the most recent missed fire. Prevents execution storm after long downtime.

3. **Email polling interval configurable?**
   - Recommendation: Start with 60s global default, defer per-trigger config to future enhancement.

## Sources

### Primary (HIGH confidence)
- Direct code analysis of all trigger files, engine service, queue service, workflow service
- Prisma schema review
- Frontend editor and config panel code review
- package.json dependency verification

## Metadata

**Confidence breakdown:**
- File analysis & gaps: HIGH — every relevant file reviewed line by line
- Architecture patterns: HIGH — follows existing NestJS/EventEmitter patterns in codebase
- Pitfalls: HIGH — derived from actual bugs found during analysis
- Email trigger rework: MEDIUM — imap library is functional but old
- Frontend validation: HIGH — Zod already available

**Research date:** 2025-01-31
**Valid until:** 2025-03-01
