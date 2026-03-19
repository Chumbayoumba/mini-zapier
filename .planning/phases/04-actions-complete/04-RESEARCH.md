# Phase 04 Research: Actions — Complete & Harden

## Current State Summary

**What works well:**
- All 5 action handlers exist and implement the `ActionHandler` interface correctly
- Actions are registered via `EngineModule.onModuleInit()` — clean DI-based lifecycle
- `ActionRegistry` is solid: Map-based O(1) lookup with duplicate protection
- `EngineService` executes DAG topologically with retry, pause/resume, and step logging
- `CredentialService` has production-grade AES-256-GCM encryption with proper IV/authTag
- HTTP Request has excellent SSRF protection (DNS rebind, IPv4/IPv6, fail-closed)
- Database action is properly restricted to SELECT-only on allowlisted tables
- Transform uses JSONata with timeout (5s) and size limit (1MB)
- Test coverage: 79 tests across 5 spec files (http: 16, db: 12, registry: 7, creds: 18, engine: 26)

**What's broken or missing:**
- **No template interpolation engine** — `{{steps.prev.output}}` syntax exists ONLY in TelegramAction's private `interpolateMessage()`. Other actions and the engine itself have NO data flow templating.
- **Email uses global env vars** — hardcoded `SMTP_*` from ConfigService, never reads from CredentialService or per-workflow integrations
- **Telegram doesn't use CredentialService** — bot token passed in plaintext config or `_context.integrations`
- **No input validation** on most actions (email missing `to` validation, telegram doesn't validate chatId format)
- **Frontend config panels are primitive** — all actions share one generic Input-based panel, no dropdowns, no textareas, no validation, no preview
- **No email/telegram/transform test files** — 3 of 5 actions have zero unit tests
- **CredentialService is injected into EngineModule but never used by any action**

---

## Action-by-Action Analysis

### HTTP Request (ACT-01)
**File:** `apps/backend/src/engine/actions/http-request.action.ts`
**Status:** ✅ Working — most complete action

**What works:**
- All HTTP methods supported (GET/POST/PUT/DELETE via axios)
- Configurable timeout (default 30s)
- Configurable retries with exponential backoff via `axios-retry`
- SSRF protection: validates URL, blocks private IPs (IPv4, IPv6, mapped), DNS rebind protection, fail-closed
- Protocol enforcement (http/https only)
- Returns structured `{ status, statusText, headers, data }`
- `maxRedirects: 0` prevents redirect-based SSRF

**What's missing:**
- No response size limit — could OOM on large responses
- No `Content-Type` auto-detection for body serialization
- No template interpolation in URL/headers/body (`{{steps.X.output}}` not supported)
- Config doesn't support `auth` field (Basic/Bearer from CredentialService)
- No request/response logging to step log (only logs URL to console)

**Issues:**
- Uses `any` type for `config` parameter — no runtime validation
- No input validation: `url` could be undefined (throws generic error, not user-friendly)

### Email Send (ACT-02)
**File:** `apps/backend/src/engine/actions/email.action.ts`
**Status:** ⚠️ Partial — works but hardcoded to global SMTP config

**What works:**
- Uses `nodemailer` correctly
- Supports `to`, `subject`, `body`, `isHtml` fields
- Error handling wraps nodemailer errors with clean message
- Returns `{ messageId, accepted }`

**What's missing:**
- **SMTP credentials hardcoded from env** — uses `ConfigService.get('SMTP_*')`, not per-workflow credentials
- **Does not use CredentialService** — SMTP password stored in env vars, not encrypted per-integration
- No CC/BCC support
- No attachments support
- No template interpolation in subject/body
- No email address validation (no regex, no DNS MX check)
- No `from` address override — always uses `SMTP_USER`
- **No unit tests** — `email.action.spec.ts` doesn't exist
- Transporter created once in constructor — can't switch SMTP servers per workflow

**Issues:**
- `secure: false` hardcoded — no TLS/STARTTLS option
- If env vars are missing, transporter is created with `undefined` values — fails silently at runtime

### Telegram Send (ACT-03)
**File:** `apps/backend/src/engine/actions/telegram.action.ts`
**Status:** ⚠️ Partial — works but has security/feature gaps

**What works:**
- Sends via Telegram Bot API `sendMessage`
- Token resolution chain: node config → integrations → triggerData
- Chat ID resolution: config → triggerData (auto-reply to sender)
- `interpolateMessage()` — basic `{{path.to.value}}` template engine on `_context`
- `parseMode` support (default: HTML)
- Error handling with clean messages
- Returns `{ ok, messageId, chatId }`

**What's missing:**
- **Does not use CredentialService** — bot token in plaintext in config/integrations
- No support for `sendPhoto`, `sendDocument`, `sendLocation` — only `sendMessage`
- No message length validation (Telegram limit: 4096 chars)
- No retry on Telegram rate limits (HTTP 429)
- No inline keyboard / reply markup support
- **No unit tests** — `telegram.action.spec.ts` doesn't exist

**Issues:**
- `interpolateMessage()` is a private method duplicating functionality that should be a shared utility
- Template syntax `{{key}}` works only on flat `_context` object, doesn't support `{{steps.nodeId.output.field}}` because context is flattened
- Token is sent in URL path (`/bot${token}/sendMessage`) — logged in clear text

### Database Query (ACT-04)
**File:** `apps/backend/src/engine/actions/database.action.ts`
**Status:** ✅ Working — well-secured

**What works:**
- Only SELECT allowed — INSERT/UPDATE/DELETE/RAW all rejected
- Table allowlist: `workflows`, `workflow_versions`, `triggers`, `workflow_executions`, `execution_step_logs`
- Column name validation via `SAFE_IDENTIFIER` regex
- Parameterized WHERE clause (uses `$1, $2...` placeholders)
- LIMIT and ORDER BY support
- Returns `{ rows, rowCount }`
- Good test coverage (12 tests)

**What's missing:**
- No `fields` parameter for SELECT (always `SELECT *`)
- No JOIN support
- No aggregate functions (COUNT, SUM, etc.)
- No pagination (OFFSET)
- No template interpolation in WHERE values
- Config type interface exists (`DatabaseConfig`) but not exported/shared with frontend

**Issues:**
- Uses `prisma.$queryRawUnsafe()` — correct for dynamic SQL but requires vigilance
- `ALLOWED_TABLES` is hardcoded — should be configurable per deployment
- `users` table excluded but `credentials` table is also sensitive — needs review of what tables exist

### Data Transform (ACT-05)
**File:** `apps/backend/src/engine/actions/transform.action.ts`
**Status:** ✅ Working — good safety measures

**What works:**
- JSONata evaluation with proper import handling (`jsonata.default` fallback)
- 5-second evaluation timeout via `Promise.race`
- 1MB input size limit
- Expression validation (must be non-empty string)
- Accepts data from config or `_context`
- Returns `{ result }`

**What's missing:**
- **No preview/dry-run endpoint** — ACT-05 requires "preview" functionality, but there's no API route to test expressions without executing a full workflow
- No JSONata function whitelist — user can call any built-in function including `$eval`
- No output size limit (evaluation could produce huge results)
- No `outputVariable` handling — frontend has this field but backend ignores it
- **No unit tests** — `transform.action.spec.ts` doesn't exist

**Issues:**
- `jsonata.default ? jsonata.default(expression) : (jsonata as any)(expression)` — fragile import handling, should be pinned to one pattern
- Timeout uses `setTimeout` in `Promise.race` — timer is never cleared on success (minor memory leak)

---

## Data Flow Analysis (ACT-06)

### How engine passes data between steps

In `engine.service.ts`, line 287-295:
```typescript
const input = {
  ...node.data.config,
  _context: {
    ...context.stepResults,        // all previous step outputs, keyed by nodeId
    triggerData: context.triggerData,
    integrations: context.integrations,
  },
};
const result = await this.executeAction(node.data.type, input);
context.stepResults[node.id] = result;
```

**Mechanism:** Each action receives a `_context` object containing ALL previous step results. Step results are stored in `context.stepResults[node.id]` after execution.

### Template syntax status: ❌ NOT IMPLEMENTED

There is **no generic template interpolation engine** in the core. The only interpolation exists in `TelegramAction.interpolateMessage()` (private method) which handles `{{key.path}}` on `_context`.

**What's needed:**
1. A shared `TemplateEngine` utility that resolves `{{steps.nodeId.output.field}}` expressions
2. Applied in `EngineService.executeStepWithRetry()` BEFORE passing config to the action handler
3. Should also resolve `{{trigger.field}}` for trigger data access
4. Must handle nested paths, arrays, and missing values gracefully

**Current workaround:** Actions can manually dig into `_context` (e.g., `config._context.triggerData.field`), but this is action-implementation-specific and not user-configurable from the frontend.

---

## Frontend Config Panels (ACT-07)

**File:** `apps/frontend/src/components/editor/node-config-panel.tsx`

### Status: ⚠️ Basic — functional but primitive

**Architecture:** Single `NodeConfigPanel` component with `ACTION_FIELDS` and `TRIGGER_FIELDS` lookup tables. All fields render as `<Input>` elements.

### Per-action panel status:

| Action | Fields | Issues |
|--------|--------|--------|
| HTTP_REQUEST | url, method, headers, body | Method should be dropdown (GET/POST/PUT/DELETE). Headers/body should be textarea or JSON editor. No timeout field. |
| SEND_EMAIL | to, subject, body | Body should be textarea. Missing CC/BCC. No HTML toggle (isHtml). |
| TELEGRAM | chatId, message | Message should be textarea. Missing botToken field (required!). Missing parseMode dropdown. |
| DATABASE | operation, table, query | Operation should be locked to "SELECT" or hidden. Table should be dropdown of allowed tables. WHERE/LIMIT fields missing. |
| TRANSFORM | expression, outputVariable | Expression should be textarea/code editor. No preview button. outputVariable not used by backend. |

### Critical frontend gaps:
1. **No validation** — required fields show red border when empty but no error messages, no prevent-save
2. **No type-appropriate inputs** — everything is `<Input>`, no `<Select>`, no `<Textarea>`, no code editors
3. **No template variable picker** — users can't browse available `{{steps.X.output}}` variables
4. **No test/preview buttons** — can't test HTTP request, preview transform, or send test email
5. **No credential integration** — panels don't reference stored credentials for email SMTP or telegram token

---

## ActionRegistry & Interface

### Interface (`action-handler.interface.ts`)
```typescript
export interface ActionHandler {
  readonly type: string;
  execute(input: any, context?: any): Promise<any>;
}
```

**Issues:**
- `context` parameter is optional but never used — engine passes everything via `input._context`
- No `validate(config: any): ValidationResult` method — validation is ad-hoc per action
- No `getSchema(): JSONSchema` method — frontend has no way to discover action capabilities
- `input: any` — no type safety, each action re-parses config differently

### Registration (`engine.module.ts`)
```typescript
onModuleInit() {
  [httpAction, emailAction, telegramAction, dbAction, transformAction]
    .forEach(handler => this.registry.register(handler));
}
```

**Works well:** Clean DI-based registration in module lifecycle. New actions just need to be added to providers and the array.

### Registry (`action-registry.ts`)
- Map-based O(1) lookup
- Duplicate registration throws (prevents bugs)
- `has()`, `get()`, `getRegisteredTypes()` — complete API
- 7 tests covering all paths

---

## Test Coverage

| File | Tests | Coverage Notes |
|------|-------|---------------|
| `http-request.action.spec.ts` | 16 | SSRF protection only. No tests for: successful request, timeout handling, retry behavior, body serialization |
| `database.action.spec.ts` | 12 | Good coverage: allowed tables, blocked operations, table validation, SQL injection prevention |
| `action-registry.spec.ts` | 7 | Complete: register, get, has, duplicates, types |
| `credential.service.spec.ts` | 18 | Excellent: constructor validation, encrypt/decrypt roundtrip, tampering, wrong key |
| `engine.service.spec.ts` | 26 | Good: workflow execution, step logging, events, retry, pause/resume, topological order |
| `email.action.spec.ts` | ❌ 0 | **MISSING** — no test file exists |
| `telegram.action.spec.ts` | ❌ 0 | **MISSING** — no test file exists |
| `transform.action.spec.ts` | ❌ 0 | **MISSING** — no test file exists |

**Total: 79 tests, 3 critical actions untested**

---

## Critical Findings

1. **No shared template engine** — `{{steps.X.output.field}}` interpolation doesn't exist at the engine level. Only TelegramAction has a private, limited version. This blocks ACT-06 entirely.

2. **CredentialService unused** — Injected into EngineModule but no action reads encrypted credentials. Email and Telegram pass secrets in plaintext config.

3. **Email hardcoded to global SMTP** — Can't use per-workflow SMTP credentials. `secure: false` hardcoded. No TLS option.

4. **3 of 5 actions have zero tests** — Email, Telegram, Transform have no spec files. Existing HTTP tests cover only SSRF, not happy-path request execution.

5. **Frontend panels are generic Input-only** — No dropdowns, textareas, code editors, or validation. Telegram panel missing botToken field. No test/preview capabilities.

6. **No action config validation** — `ActionHandler` interface has no `validate()` method. Each action silently fails or throws generic errors on bad input.

7. **No response size limits on HTTP action** — Large responses could OOM the worker process.

8. **Transform `outputVariable` disconnected** — Frontend has this field, backend ignores it. Dead config.

9. **Template engine in TelegramAction is private and limited** — Only works on flat `_context`, not on `{{steps.nodeId.output.path}}` syntax. Should be extracted to shared utility.

10. **No preview/dry-run for Transform** — ACT-05 requires preview, but there's no API endpoint for testing JSONata expressions without full workflow execution.

---

## Recommendations

### Suggested Plan Structure (5 tasks)

**Task 1: Shared Template Engine + Data Flow (ACT-06)**
- Create `apps/backend/src/engine/template-engine.ts` with `{{steps.nodeId.output.path}}` and `{{trigger.path}}` resolution
- Integrate into `EngineService.executeStepWithRetry()` — interpolate ALL config values before passing to handler
- Extract TelegramAction's `interpolateMessage()` into this shared utility
- Unit tests for template engine

**Task 2: Harden Actions — Email + Telegram + Credentials (ACT-02, ACT-03)**
- Email: support per-workflow SMTP via `_context.integrations` + CredentialService decrypt
- Email: add CC/BCC, isHtml toggle, `secure` TLS option, email validation
- Telegram: use CredentialService for bot token decryption
- Telegram: add message length validation, rate limit handling
- Both: input validation with clear error messages

**Task 3: Harden Actions — HTTP + Database + Transform (ACT-01, ACT-04, ACT-05)**
- HTTP: response size limit, auth header from CredentialService, Content-Type handling
- Database: SELECT field list, OFFSET/pagination, export DatabaseConfig type
- Transform: preview/dry-run API endpoint, output size limit, clear timeout timer
- Transform: remove or implement `outputVariable`

**Task 4: Frontend Config Panels (ACT-07)**
- HTTP: method dropdown, headers/body textarea, timeout input
- Email: body textarea, CC/BCC fields, HTML toggle
- Telegram: botToken field (with credential selector), message textarea, parseMode dropdown
- Database: table dropdown (from allowed list), WHERE builder, limit input
- Transform: expression code editor (monospace textarea), preview button
- All: proper validation with error messages

**Task 5: Missing Tests**
- `email.action.spec.ts` — sendMail mock, error handling, field validation
- `telegram.action.spec.ts` — sendMessage mock, token resolution, interpolation, error handling
- `transform.action.spec.ts` — JSONata evaluation, timeout, size limit, error cases
- `http-request.action.spec.ts` — extend with happy-path, timeout, retry, body tests
- Template engine tests
