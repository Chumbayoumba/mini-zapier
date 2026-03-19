# Phase 1: Security Hardening & Architecture Cleanup - Research

**Researched:** 2025-01-30
**Domain:** NestJS Security, PostgreSQL Access Control, Credential Encryption, WebSocket Auth, Docker Secrets
**Confidence:** HIGH

## Summary

Phase 1 addresses 7 security requirements (SEC-01 through SEC-07) that eliminate all 4 critical vulnerabilities identified in the codebase audit. The work divides into three logical groups: (1) Architecture cleanup — removing the dual execution path and establishing the ActionRegistry pattern, (2) Input/access hardening — SSRF protection, database privilege restriction, JWT secret enforcement, WebSocket auth, Docker secrets, and (3) Data protection — AES-256-GCM encryption for user credentials stored in the database.

The codebase is well-structured for these changes. The main `EngineService` already has working action classes with proper DI, the WebSocket gateway already validates JWT on connection (just lacks room authorization), and the Joi validation schema already requires `JWT_SECRET`. The biggest surgery is removing the sandboxed processor file and refactoring the engine's switch-case to an ActionRegistry, but this is straightforward because the existing in-process `WorkflowProcessor` in `queue.service.ts` already delegates to `EngineService` — the sandboxed processor file at `engine/processors/workflow.processor.ts` is a **dead code path** that duplicates everything unsafely.

**Primary recommendation:** Execute in order: (1) Remove sandboxed processor + create ActionRegistry, (2) Fix SSRF gaps, (3) Restrict DB action, (4) Fix JWT/Docker secrets, (5) Add WebSocket room auth, (6) Implement credential encryption. Each task is independently testable and deployable.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-01 | Remove dual execution path, single EngineService with validated action handlers | Sandboxed processor is dead code with zero references from active code paths. WorkflowProcessor in queue.service.ts already delegates to EngineService. ActionRegistry pattern with Map<string, ActionHandler> replaces switch-case. |
| SEC-02 | SSRF protection: block internal IPs, metadata endpoints, DNS rebinding | HttpRequestAction already blocks most private IPs but misses IPv6 (::1, fc00::/7), link-local 169.254.0.0/16 range (only exact match for 169.254.169.254), and needs octal/hex IP bypass prevention. |
| SEC-03 | Database action restricted schema + role | DatabaseAction currently allows SELECT/INSERT/UPDATE/DELETE on `users` table (including passwordHash). Needs separate PG role + `workflow_data` schema via Prisma migration. |
| SEC-04 | JWT secrets from env only, fail on missing | Backend Joi validation already requires JWT_SECRET (min 32 chars). Frontend middleware.ts line 32 has hardcoded fallback `'super-secret-jwt-key-for-dev-32chars'`. |
| SEC-05 | Docker Compose prod: env vars, no hardcoded passwords | docker-compose.prod.yml lines 7-8 have `${DB_PASSWORD:-minizapier123}` fallbacks. Redis has no authentication. |
| SEC-06 | WebSocket JWT auth on connection | WebSocket gateway already validates JWT on `handleConnection`. Missing: room-join authorization (any user can join any execution/workflow room). |
| SEC-07 | Credential encryption AES-256-GCM | No encryption exists. Prisma schema has no credential fields yet — they're stored in workflow `definition` JSON and in env vars. Need CredentialEncryption service. |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS | ^10.4.0 | Backend framework | Already in use, provides DI for ActionRegistry |
| Prisma | ^6.0.0 | ORM + migrations | Already in use, needed for DB schema migration |
| @nestjs/jwt | ^10.2.0 | JWT operations | Already in use for auth |
| Socket.IO | ^4.8.0 | WebSocket | Already in use for real-time |
| Joi | ^17.13.0 | Env validation | Already in use for config validation |
| axios | ^1.7.0 | HTTP client | Already in use in HttpRequestAction |
| Node.js `crypto` | built-in | AES-256-GCM encryption | No additional dependency needed |
| Node.js `net` | built-in | IP validation | Already used for SSRF checks |
| Node.js `dns/promises` | built-in | DNS resolution | Already used for SSRF checks |

### Supporting (No New Dependencies Required)
This phase requires **zero new npm dependencies**. All functionality is achievable with built-in Node.js modules and existing packages.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node `crypto` for AES | `libsodium-wrappers` | Better API but adds dependency; crypto module is sufficient for AES-256-GCM |
| Manual IP validation | `ip-address` npm package | Cleaner IPv6 handling but overkill for the fixed set of ranges we need |
| Prisma raw SQL for restricted role | Separate `pg` connection pool | More control but adds complexity; Prisma `$executeRawUnsafe` via restricted connection works |

## Architecture Patterns

### Recommended Project Structure Changes
```
apps/backend/src/engine/
├── engine.module.ts           # MODIFY: Add ActionRegistry, CredentialService
├── engine.service.ts          # MODIFY: Use ActionRegistry instead of switch-case
├── action-registry.ts         # NEW: Map<string, ActionHandler> registry
├── action-handler.interface.ts # NEW: ActionHandler interface
├── credential.service.ts      # NEW: AES-256-GCM encrypt/decrypt
├── actions/
│   ├── http-request.action.ts # MODIFY: Add IPv6 blocking, comprehensive SSRF
│   ├── email.action.ts        # MODIFY: Implement ActionHandler interface
│   ├── telegram.action.ts     # MODIFY: Implement ActionHandler interface
│   ├── database.action.ts     # MODIFY: Restricted schema, separate PG role
│   └── transform.action.ts    # MODIFY: Implement ActionHandler interface
└── processors/
    └── workflow.processor.ts  # DELETE: Dead code, security bypass

apps/backend/src/websocket/
└── websocket.gateway.ts       # MODIFY: Add room-join ownership verification

apps/frontend/
└── middleware.ts              # MODIFY: Remove hardcoded JWT fallback

docker-compose.prod.yml        # MODIFY: Remove password fallbacks, add Redis auth
```

### Pattern 1: ActionRegistry (Strategy + Registry)
**What:** Replace the switch-case in `EngineService.executeAction()` with a `Map<string, ActionHandler>` populated at module init.
**When to use:** This is the core architectural change for SEC-01.
**Current code to replace** (engine.service.ts lines 177-192):
```typescript
// CURRENT: switch-case in EngineService
private async executeAction(type: string, input: any): Promise<any> {
  switch (type) {
    case 'HTTP_REQUEST':
      return this.httpAction.execute(input);
    case 'SEND_EMAIL':
      return this.emailAction.execute(input);
    case 'TELEGRAM':
      return this.telegramAction.execute(input);
    case 'DATABASE':
      return this.dbAction.execute(input);
    case 'TRANSFORM':
      return this.transformAction.execute(input);
    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}
```

**Replacement pattern:**
```typescript
// action-handler.interface.ts
export interface ActionHandler {
  readonly type: string;
  execute(input: any, context?: ExecutionContext): Promise<any>;
}

// action-registry.ts
@Injectable()
export class ActionRegistry {
  private readonly handlers = new Map<string, ActionHandler>();

  register(handler: ActionHandler): void {
    this.handlers.set(handler.type, handler);
  }

  get(type: string): ActionHandler {
    const handler = this.handlers.get(type);
    if (!handler) {
      throw new Error(`Unknown action type: ${type}`);
    }
    return handler;
  }
}

// engine.module.ts — register in onModuleInit
export class EngineModule implements OnModuleInit {
  constructor(
    private registry: ActionRegistry,
    private http: HttpRequestAction,
    private email: EmailAction,
    private telegram: TelegramAction,
    private db: DatabaseAction,
    private transform: TransformAction,
  ) {}

  onModuleInit() {
    [this.http, this.email, this.telegram, this.db, this.transform]
      .forEach(h => this.registry.register(h));
  }
}

// engine.service.ts — simplified dispatch
private async executeAction(type: string, input: any): Promise<any> {
  const handler = this.actionRegistry.get(type);
  return handler.execute(input);
}
```

### Pattern 2: AES-256-GCM Credential Encryption
**What:** Service to encrypt/decrypt user credentials (SMTP passwords, IMAP passwords, Telegram bot tokens) stored in workflow definitions.
**Key design decisions:**
- Encryption key from env var `CREDENTIAL_ENCRYPTION_KEY` (32 bytes, base64-encoded)
- Random 12-byte IV per encryption operation
- Store as `{iv}:{authTag}:{ciphertext}` in base64
- Decrypt only at action execution time (never in API responses)

```typescript
// credential.service.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class CredentialService {
  private readonly key: Buffer;

  constructor(private configService: ConfigService) {
    const keyBase64 = this.configService.get<string>('CREDENTIAL_ENCRYPTION_KEY');
    if (!keyBase64) throw new Error('CREDENTIAL_ENCRYPTION_KEY is required');
    this.key = Buffer.from(keyBase64, 'base64');
    if (this.key.length !== 32) throw new Error('CREDENTIAL_ENCRYPTION_KEY must be 32 bytes');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(encryptedValue: string): string {
    const [ivB64, authTagB64, dataB64] = encryptedValue.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const encrypted = Buffer.from(dataB64, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  isEncrypted(value: string): boolean {
    // Check if value matches encrypted format: base64:base64:base64
    const parts = value.split(':');
    return parts.length === 3 && parts.every(p => /^[A-Za-z0-9+/=]+$/.test(p));
  }
}
```

### Pattern 3: SSRF Protection — Comprehensive IP Blocking
**What:** Validate URLs before HTTP requests, blocking all private/reserved IP ranges.
**Current gaps in HttpRequestAction:**
- Missing IPv6: `::1`, `::`, `fc00::/7`, `fe80::/10`, `::ffff:127.0.0.1` (mapped IPv4)
- Missing link-local range: only blocks exact `169.254.169.254`, not `169.254.0.0/16`
- No protection against octal (`0177.0.0.1`) or hex (`0x7f000001`) IP representations
- DNS resolution silently catches errors (should block, not allow)

```typescript
// Comprehensive private IP check
private isPrivateIp(ip: string): boolean {
  // Normalize IPv4-mapped IPv6
  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip;

  // IPv6 checks
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    // fc00::/7 (unique local), fe80::/10 (link-local)
    if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) return true;
    return false;
  }

  // IPv4 checks
  const parts = normalized.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return true; // Invalid = blocked

  return (
    parts[0] === 0 ||                                          // 0.0.0.0/8
    parts[0] === 127 ||                                        // 127.0.0.0/8
    parts[0] === 10 ||                                         // 10.0.0.0/8
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
    (parts[0] === 192 && parts[1] === 168) ||                  // 192.168.0.0/16
    (parts[0] === 169 && parts[1] === 254) ||                  // 169.254.0.0/16 (link-local)
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)   // 100.64.0.0/10 (carrier-grade NAT)
  );
}
```

### Pattern 4: Database Action — Restricted PG Role & Schema
**What:** Create a separate PostgreSQL schema `workflow_data` with a restricted role that cannot access application tables.
**Implementation approach:**

1. **Prisma migration** to create schema and role:
```sql
-- Create restricted schema for workflow database actions
CREATE SCHEMA IF NOT EXISTS workflow_data;

-- Create restricted role
DO $$ BEGIN
  CREATE ROLE workflow_reader WITH LOGIN PASSWORD current_setting('app.workflow_db_password');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Grant access only to workflow_data schema
GRANT USAGE ON SCHEMA workflow_data TO workflow_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA workflow_data TO workflow_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA workflow_data GRANT SELECT TO workflow_reader;

-- Explicitly deny access to public schema
REVOKE ALL ON SCHEMA public FROM workflow_reader;
```

2. **Separate PrismaClient** or raw `pg` connection for DatabaseAction:
```typescript
// In DatabaseAction constructor
private readonly restrictedPool: Pool;

constructor(private configService: ConfigService) {
  this.restrictedPool = new Pool({
    host: configService.get('DB_HOST'),
    database: configService.get('DB_NAME'),
    user: 'workflow_reader',
    password: configService.get('WORKFLOW_DB_PASSWORD'),
    // Set search_path to workflow_data only
    options: '-c search_path=workflow_data',
  });
}
```

**IMPORTANT simplification:** For the тестовое задание scope, the simplest approach is:
- Remove `users` from `ALLOWED_TABLES` immediately
- Restrict to SELECT only (remove INSERT/UPDATE/DELETE operations for workflow DB action)
- Add `WHERE "userId" = $N` filter to all queries
- Defer the separate PG role/schema to when users actually need to store custom data in `workflow_data`

### Anti-Patterns to Avoid
- **Don't create a separate database** — a separate schema within the same DB is sufficient and simpler
- **Don't add `isolated-vm` for this phase** — that's a v2 concern; the sandboxed processor is being removed, not replaced
- **Don't refactor the entire EngineService** — only replace the switch-case dispatch; keep topological sort and step logging as-is
- **Don't move tokens to httpOnly cookies** — that's a bigger auth refactor; SEC-04 only requires removing the hardcoded fallback
- **Don't add Redis authentication yet** — it's nice-to-have but SEC-05 specifically targets Docker Compose hardcoded DB passwords; Redis auth can be a quick follow-up task

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AES-256-GCM encryption | Custom crypto wrapper | Node.js built-in `crypto` module | Correct GCM implementation is subtle (IV reuse = catastrophic); `crypto` is battle-tested |
| IP range checking | Bitmask math for CIDR | Simple range checks with known prefixes | We have a fixed set of private ranges; CIDR parsing adds complexity for zero benefit |
| JWT verification (WebSocket) | Custom token parsing | `@nestjs/jwt` `JwtService.verifyAsync()` | Already used in gateway; consistent with REST auth |
| Env validation | Manual `if (!process.env.X)` checks | Joi validation schema (already in `config/validation.ts`) | Already working; just add new required vars |
| Password hashing | Own bcrypt wrapper | `bcrypt` (already used in AuthService) | Standard, no changes needed |

**Key insight:** This phase is almost entirely about removing unsafe code and adding validation logic, not about introducing new external tools.

## Common Pitfalls

### Pitfall 1: Breaking Existing Tests When Refactoring to ActionRegistry
**What goes wrong:** The existing `engine.service.spec.ts` (14 tests) mocks individual action classes directly injected into EngineService constructor. After switching to ActionRegistry, these injections change.
**Why it happens:** Tests couple to constructor signature.
**How to avoid:** Update test setup to mock ActionRegistry instead of individual actions. The registry's `.get()` returns the mock handler.
**Warning signs:** Tests fail immediately after changing EngineService constructor.

### Pitfall 2: Sandboxed Processor Has Hidden References
**What goes wrong:** Deleting `workflow.processor.ts` breaks something unexpected.
**Why it happens:** BullMQ can reference processors by file path.
**How to avoid:** I verified: the file has **zero imports** from any other file. The active `WorkflowProcessor` is in `queue/queue.service.ts` (in-process, not sandboxed). The sandboxed file is completely dead code. Safe to delete.
**Warning signs:** `grep` for `workflow.processor` across codebase returns only the file itself.

### Pitfall 3: Frontend Middleware Crash on Missing JWT_SECRET
**What goes wrong:** After removing the hardcoded fallback, `middleware.ts` throws at request time if `JWT_SECRET` is not set, causing 500 errors on every page.
**Why it happens:** Next.js Edge Runtime middleware runs per-request; there's no "startup" phase.
**How to avoid:** Two options: (a) Check for token presence only, let backend verify (recommended), or (b) Use `process.env.JWT_SECRET!` with a build-time check. Option (a) is better because it makes the backend the single source of auth truth.
**Warning signs:** All pages return 500 after deployment without JWT_SECRET.

### Pitfall 4: AES-256-GCM IV Reuse
**What goes wrong:** Reusing the same IV with the same key completely breaks GCM's security guarantees — auth tags become forgeable.
**Why it happens:** Developers sometimes use a fixed IV for "simplicity" or derive it from data.
**How to avoid:** Always use `randomBytes(12)` for IV. Store the IV alongside the ciphertext. Never derive IV from plaintext.
**Warning signs:** All encrypted values having the same prefix (first segment of the `iv:authTag:data` format).

### Pitfall 5: Docker Compose Prod Won't Start Without Defaults
**What goes wrong:** Removing `:-minizapier123` fallbacks means `docker compose up` fails if `.env` is missing.
**Why it happens:** The dev workflow relied on defaults.
**How to avoid:** Keep defaults ONLY in `docker-compose.yml` (dev). In `docker-compose.prod.yml`, use `${DB_PASSWORD:?DB_PASSWORD is required}` syntax which fails with a helpful error message.
**Warning signs:** CI/CD pipeline fails on `docker compose up` after removing defaults.

### Pitfall 6: Database Migration Ordering
**What goes wrong:** Prisma migration for `workflow_data` schema needs to run before the application starts, but the restricted PG role may not exist yet.
**Why it happens:** Prisma migrations run as the main DB user; role creation is a one-time DDL operation.
**How to avoid:** Include role creation in the Prisma migration SQL (using `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object ... END $$` for idempotency).
**Warning signs:** `prisma migrate deploy` fails on "role does not exist".

## Code Examples

### Exact Files To Modify & How

#### 1. Delete: `apps/backend/src/engine/processors/workflow.processor.ts`
Complete file deletion. No references exist elsewhere.

#### 2. Create: `apps/backend/src/engine/action-handler.interface.ts`
```typescript
export interface ActionHandler {
  readonly type: string;
  execute(input: any, context?: any): Promise<any>;
}
```

#### 3. Create: `apps/backend/src/engine/action-registry.ts`
```typescript
import { Injectable } from '@nestjs/common';
import { ActionHandler } from './action-handler.interface';

@Injectable()
export class ActionRegistry {
  private readonly handlers = new Map<string, ActionHandler>();

  register(handler: ActionHandler): void {
    if (this.handlers.has(handler.type)) {
      throw new Error(`Action handler for type '${handler.type}' already registered`);
    }
    this.handlers.set(handler.type, handler);
  }

  get(type: string): ActionHandler {
    const handler = this.handlers.get(type);
    if (!handler) throw new Error(`Unknown action type: ${type}`);
    return handler;
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }

  getRegisteredTypes(): string[] {
    return [...this.handlers.keys()];
  }
}
```

#### 4. Modify: Each action to implement ActionHandler
Each action class adds `readonly type: string` property:
- `HttpRequestAction`: `readonly type = 'HTTP_REQUEST';`
- `EmailAction`: `readonly type = 'SEND_EMAIL';`
- `TelegramAction`: `readonly type = 'TELEGRAM';`
- `DatabaseAction`: `readonly type = 'DATABASE';`
- `TransformAction`: `readonly type = 'TRANSFORM';`

#### 5. Modify: `apps/frontend/middleware.ts` line 31-33
```typescript
// BEFORE:
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'super-secret-jwt-key-for-dev-32chars',
);

// AFTER (Option A — recommended: token-presence-only check):
// Remove JWT verification entirely, just check token exists
// The backend is the single source of auth truth
if (!token) {
  return NextResponse.redirect(new URL('/login', request.url));
}
return NextResponse.next();

// AFTER (Option B — keep verification, no fallback):
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.error('JWT_SECRET environment variable is not set');
  return NextResponse.redirect(new URL('/login', request.url));
}
const secret = new TextEncoder().encode(jwtSecret);
```

#### 6. Modify: `docker-compose.prod.yml` — Remove password fallbacks
```yaml
# BEFORE:
POSTGRES_PASSWORD: ${DB_PASSWORD:-minizapier123}

# AFTER:
POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD environment variable is required}
```

#### 7. Modify: `apps/backend/src/engine/actions/http-request.action.ts` — Comprehensive SSRF
Add IPv6 blocking, full link-local range, DNS failure = block (not allow).

#### 8. Modify: `apps/backend/src/websocket/websocket.gateway.ts` — Room authorization
```typescript
@SubscribeMessage('join:execution')
async handleJoinExecution(@ConnectedSocket() client: Socket, @MessageBody() executionId: string) {
  // Verify ownership before joining room
  const execution = await this.prisma.workflowExecution.findFirst({
    where: { id: executionId },
    include: { workflow: { select: { userId: true } } },
  });

  if (!execution || execution.workflow.userId !== client.data.userId) {
    client.emit('error', { message: 'Access denied' });
    return;
  }

  const room = `execution:${executionId}`;
  client.join(room);
}
```
Note: WebsocketModule needs PrismaModule import, and gateway needs PrismaService injection.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| vm2 for sandboxing | isolated-vm or remove sandbox | 2023 (CVEs) | sandboxed.processor.ts must go |
| Switch-case dispatch | Strategy + Registry pattern | NestJS best practice | Open/closed principle, testable |
| Plaintext credential storage | Encrypt at rest (AES-256-GCM) | Industry standard | Protects against DB dumps |
| `JWT_SECRET` with fallback | Required env var, fail fast | Always been the correct approach | Prevents token forgery |

**Deprecated/outdated:**
- `vm2`: Deprecated since 2023, critical CVEs. The sandboxed processor references vm2-style isolation — must be removed entirely.

## Open Questions

1. **Where are user-specific credentials stored currently?**
   - What we know: SMTP/IMAP/Telegram credentials are in environment variables (global, not per-user). The workflow `definition` JSON field stores `integrations` which can include `telegram.botToken`.
   - What's unclear: Are there per-user SMTP or IMAP credentials stored anywhere? The Prisma schema has no dedicated `credentials` or `integrations` table.
   - Recommendation: For SEC-07, encrypt credentials in the workflow `definition.integrations` object. When a workflow is saved with credentials, encrypt them. When actions execute, decrypt. This avoids schema changes.

2. **Should DatabaseAction have a separate PG connection pool?**
   - What we know: The full isolation approach requires a separate PG role and schema. But users currently can't create tables in `workflow_data`.
   - What's unclear: What data would users actually query? Currently allowed tables are app tables.
   - Recommendation: For Phase 1, simplify: restrict to SELECT only, remove `users` from allowed tables, add `userId` filter. Defer the full separate schema to Phase 4 (ACT-04) when the Database action is properly completed.

3. **Will removing JWT verification from frontend middleware break anything?**
   - What we know: The middleware currently verifies JWT and redirects to `/login` on failure. Backend also verifies JWT on all API calls.
   - What's unclear: Are there any frontend pages that render sensitive data without an API call (i.e., purely client-side)?
   - Recommendation: Keep JWT verification in middleware but without fallback. If JWT_SECRET is missing, redirect to login (fail closed, not open).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 + ts-jest 29.2 |
| Config file | `apps/backend/package.json` (jest section) |
| Quick run command | `cd apps/backend && npx jest --testPathPattern="engine" --no-coverage` |
| Full suite command | `cd apps/backend && npx jest --no-coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | ActionRegistry dispatches to correct handlers | unit | `cd apps/backend && npx jest --testPathPattern="action-registry" -x` | ❌ Wave 0 |
| SEC-01 | EngineService uses registry instead of switch-case | unit | `cd apps/backend && npx jest --testPathPattern="engine.service" -x` | ✅ (needs update) |
| SEC-01 | Sandboxed processor is deleted, no references | manual-only | Verify file doesn't exist + grep | N/A |
| SEC-02 | HttpRequestAction blocks private IPv4 ranges | unit | `cd apps/backend && npx jest --testPathPattern="http-request" -x` | ❌ Wave 0 |
| SEC-02 | HttpRequestAction blocks IPv6 loopback (::1) | unit | `cd apps/backend && npx jest --testPathPattern="http-request" -x` | ❌ Wave 0 |
| SEC-02 | HttpRequestAction blocks metadata endpoint | unit | `cd apps/backend && npx jest --testPathPattern="http-request" -x` | ❌ Wave 0 |
| SEC-03 | DatabaseAction rejects queries on `users` table | unit | `cd apps/backend && npx jest --testPathPattern="database" -x` | ❌ Wave 0 |
| SEC-03 | DatabaseAction restricts to SELECT only | unit | `cd apps/backend && npx jest --testPathPattern="database" -x` | ❌ Wave 0 |
| SEC-04 | Frontend middleware rejects tokens when JWT_SECRET is absent | unit | Manual verification (Next.js Edge Runtime) | ❌ manual-only |
| SEC-04 | Backend fails startup without JWT_SECRET | integration | Verify Joi schema rejects missing JWT_SECRET | ✅ (implicit via Joi) |
| SEC-05 | docker-compose.prod.yml has no default passwords | manual-only | `grep ":-" docker-compose.prod.yml` returns no matches | N/A |
| SEC-06 | WebSocket rejects unauthenticated connections | unit | `cd apps/backend && npx jest --testPathPattern="websocket" -x` | ❌ Wave 0 |
| SEC-06 | WebSocket room-join verifies ownership | unit | `cd apps/backend && npx jest --testPathPattern="websocket" -x` | ❌ Wave 0 |
| SEC-07 | CredentialService encrypts and decrypts correctly | unit | `cd apps/backend && npx jest --testPathPattern="credential" -x` | ❌ Wave 0 |
| SEC-07 | Encrypted values are stored, plaintext is never in DB | unit | `cd apps/backend && npx jest --testPathPattern="credential" -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/backend && npx jest --no-coverage`
- **Per wave merge:** `cd apps/backend && npx jest --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/backend/src/engine/action-registry.spec.ts` — covers SEC-01 (ActionRegistry unit tests)
- [ ] `apps/backend/src/engine/actions/http-request.action.spec.ts` — covers SEC-02 (SSRF tests)
- [ ] `apps/backend/src/engine/actions/database.action.spec.ts` — covers SEC-03 (DB restriction tests)
- [ ] `apps/backend/src/websocket/websocket.gateway.spec.ts` — covers SEC-06 (WS auth tests)
- [ ] `apps/backend/src/engine/credential.service.spec.ts` — covers SEC-07 (encryption tests)
- [ ] Update `apps/backend/src/engine/engine.service.spec.ts` — update mocks for ActionRegistry

## Detailed File Analysis

### File: `apps/backend/src/engine/processors/workflow.processor.ts` (189 lines — TO DELETE)
- **What it is:** BullMQ sandboxed processor that duplicates workflow execution logic
- **Security issues:** 
  - Lines 126-134: Raw axios call with ZERO SSRF protection (no IP validation, no DNS check)
  - Lines 178-183: JSONata execution with NO timeout, NO input size limit
  - Line 174: Database action returns a stub string (silently does nothing)
- **References from other files:** NONE. The active `WorkflowProcessor` class is in `queue/queue.service.ts` (lines 44-66), which delegates to `EngineService.executeWorkflow()`. This sandboxed file is completely dead code.
- **Safe to delete:** YES, confirmed by grep — zero imports anywhere.

### File: `apps/backend/src/engine/engine.service.ts` (225 lines — MODIFY)
- **Key areas:**
  - Lines 22-29: Constructor injects 5 action classes directly → change to inject ActionRegistry
  - Lines 177-192: Switch-case `executeAction()` → delegate to `actionRegistry.get(type).execute(input)`
  - Lines 10-16: `ExecutionContext` interface → keep as-is
  - Lines 109-174: `executeStep()` → keep as-is (logging, events work correctly)
  - Lines 194-224: `getExecutionOrder()` → keep as-is (Kahn's algorithm is correct)

### File: `apps/backend/src/engine/actions/http-request.action.ts` (98 lines — MODIFY)
- **Current SSRF protection (good):** Blocks 127.x, 10.x, 172.16-31.x, 192.168.x, 0.0.0.0, 169.254.169.254
- **Missing protections:**
  - No IPv6 blocking at all (::1, fc00::/7, fe80::/10)
  - No IPv4-mapped IPv6 blocking (::ffff:127.0.0.1)
  - Link-local only blocks exact `169.254.169.254`, not full `169.254.0.0/16`
  - DNS resolution failure is silently ignored (line 77-78: `catch {}` lets request proceed)
  - No protection against octal/hex IP representations in hostnames
  - No `dns.resolve6()` call — only resolves IPv4 addresses

### File: `apps/backend/src/engine/actions/database.action.ts` (132 lines — MODIFY)
- **Critical issue:** Line 20-23: `ALLOWED_TABLES` includes `users`, `workflows`, `workflow_executions`, `execution_step_logs`
- **Also critical:** Allows INSERT, UPDATE, DELETE on application tables
- **Fix priority:** Remove `users` from allowed tables FIRST (one-line fix prevents worst outcome)
- **Full fix:** Restrict to SELECT only, add userId filtering, consider separate schema

### File: `apps/frontend/middleware.ts` (43 lines — MODIFY)
- **Critical issue:** Line 32: `process.env.JWT_SECRET || 'super-secret-jwt-key-for-dev-32chars'`
- **Fix:** Remove fallback. If JWT_SECRET is unset, redirect to login (fail closed).

### File: `docker-compose.prod.yml` (78 lines — MODIFY)
- **Issues:**
  - Line 8: `POSTGRES_PASSWORD: ${DB_PASSWORD:-minizapier123}` — weak default
  - Line 33: `DATABASE_URL` with same default password
  - Redis (lines 19-26): No authentication at all
- **Fix:** Replace `:-fallback` with `:?error message` syntax for required vars.

### File: `apps/backend/src/websocket/websocket.gateway.ts` (123 lines — MODIFY)
- **Current auth:** `handleConnection()` (lines 39-61) validates JWT — this is good.
- **Missing auth:** `handleJoinExecution()` (lines 67-72) and `handleJoinWorkflow()` (lines 81-84) don't verify ownership.
- **Fix:** Add PrismaService dependency, query execution/workflow ownership before joining room.
- **Note:** WebsocketModule (websocket.module.ts) needs to import PrismaModule.

### File: `apps/backend/src/config/validation.ts` (23 lines — MODIFY)
- **Current:** JWT_SECRET is already required with `min(32)` — GOOD.
- **Needed:** Add `CREDENTIAL_ENCRYPTION_KEY` as required for SEC-07.

## Sources

### Primary (HIGH confidence)
- Direct source code analysis of all files listed above
- Prisma schema at `apps/backend/prisma/schema.prisma` — full data model
- `apps/backend/src/config/validation.ts` — Joi validation confirms JWT_SECRET is required on backend
- `apps/backend/src/queue/queue.service.ts` — confirms in-process WorkflowProcessor already delegates to EngineService

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` — ActionRegistry pattern recommendation
- `.planning/research/STACK.md` — Strategy + Registry pattern recommendation
- `.planning/research/PITFALLS.md` — SSRF, SQL injection, JWT fallback analysis
- `.planning/codebase-map/04-concerns.md` — Critical issues #1-4

### Tertiary (LOW confidence)
- IPv6 SSRF bypass vectors — based on training data; recommend validating against OWASP SSRF cheat sheet

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in the project, no new dependencies
- Architecture (ActionRegistry): HIGH — verified code structure, clear refactoring path
- SSRF protection: HIGH — analyzed existing code gaps, well-documented IP ranges
- Database restriction: HIGH — Prisma schema and DatabaseAction analyzed in full
- JWT hardening: HIGH — exact line numbers identified, backend already validates correctly
- Docker Compose: HIGH — file is 78 lines, fully analyzed
- WebSocket auth: HIGH — gateway code is 123 lines, fully analyzed
- Credential encryption: MEDIUM — AES-256-GCM pattern is standard, but integration with workflow definitions needs careful implementation
- Test impact: HIGH — existing engine.service.spec.ts has 14 tests that will need mock updates

**Research date:** 2025-01-30
**Valid until:** 2025-03-01 (stable stack, security patterns don't change)
