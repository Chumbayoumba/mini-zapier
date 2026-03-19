# Code Quality Analysis

**Analysis Date:** 2025-01-27
**Project:** Mini-Zapier — Workflow Automation Platform (pnpm monorepo)

---

## 1. Testing ⚠️ Needs Improvement

### Framework & Configuration

**Backend test runner:** Jest 29 + ts-jest
- Config: Inline in `apps/backend/package.json` (`jest` key)
- Test regex: `.*\.spec\.ts$` (unit), `.e2e-spec.ts$` (e2e)
- Module alias: `@/*` → `<rootDir>/$1`
- Diagnostics disabled: `{ "diagnostics": false }` in ts-jest config
- E2E config: `apps/backend/test/jest-e2e.json` (exists but no e2e test files written)

**Frontend tests:** ❌ None
- No test framework installed (`@testing-library/*`, `vitest`, `jest` all absent from `apps/frontend/package.json`)
- No `.test.ts`, `.test.tsx`, or `.spec.ts` files found in `apps/frontend/`

**Shared package tests:** ❌ None

### Backend Test Coverage

8 spec files exist, covering core business logic:

| File | What's Tested |
|------|--------------|
| `apps/backend/src/auth/auth.service.spec.ts` | Register, login, refresh tokens, logout, validate user (12 tests) |
| `apps/backend/src/auth/auth.controller.spec.ts` | Controller routing, error propagation (9 tests) |
| `apps/backend/src/workflows/workflows.service.spec.ts` | CRUD, pagination, versioning, activate/deactivate (14 tests) |
| `apps/backend/src/executions/executions.service.spec.ts` | Pagination, findById, stats, cancel, retry (16 tests) |
| `apps/backend/src/engine/engine.service.spec.ts` | Workflow execution, topological ordering, event emission, step logging, error handling (14 tests) |
| `apps/backend/src/users/users.service.spec.ts` | CRUD, findByEmail, pagination, refresh token update (13 tests) |
| `apps/backend/src/triggers/webhook/webhook.controller.spec.ts` | Webhook handling, error propagation (4 tests) |
| `apps/backend/src/triggers/webhook/webhook.service.spec.ts` | Webhook processing, token validation, inactive workflow handling (6 tests) |

**Coverage generation:** `pnpm test:cov` → stored in `apps/backend/coverage/` (lcov, clover, json formats present)

### Modules WITHOUT Tests

| Module | Files |
|--------|-------|
| Queue processing | `apps/backend/src/queue/queue.service.ts` |
| Notifications | `apps/backend/src/notifications/notifications.service.ts` |
| WebSocket gateway | `apps/backend/src/websocket/websocket.gateway.ts` |
| Cron triggers | `apps/backend/src/triggers/cron/` |
| Email triggers | `apps/backend/src/triggers/email/` |
| Telegram triggers | `apps/backend/src/triggers/telegram/` |
| All 5 action classes | `apps/backend/src/engine/actions/*.ts` |
| Health controller | `apps/backend/src/health/health.controller.ts` |
| PrismaService | `apps/backend/src/prisma/prisma.service.ts` |

### Test Patterns

**Mocking pattern (consistent):**
```typescript
// Manual mock objects rather than jest.mock() for services
const prisma = {
  workflow: { create: jest.fn(), findMany: jest.fn(), ... },
};
const eventEmitter = { emit: jest.fn() };

// NestJS Testing Module with useValue DI overrides
const module: TestingModule = await Test.createTestingModule({
  providers: [
    WorkflowsService,
    { provide: PrismaService, useValue: prisma },
    { provide: EventEmitter2, useValue: eventEmitter },
  ],
}).compile();
```

**External library mocking (bcrypt):**
```typescript
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));
```

**Test structure:** `describe` → nested `describe` per method → `it` per case. Every test suite starts with `it('should be defined')`.

**Assertion style:** Jest's `expect()` with `toEqual`, `toHaveBeenCalledWith`, `rejects.toThrow`, `expect.objectContaining`, `expect.any(Date)`.

### Run Commands

```bash
pnpm test              # All packages via Turborepo
pnpm test:cov          # With coverage via Turborepo
cd apps/backend && pnpm test         # Backend only
cd apps/backend && pnpm test:watch   # Watch mode
cd apps/backend && pnpm test:e2e     # E2E (no tests exist yet)
```

---

## 2. Linting & Formatting ⚠️ Needs Improvement

### Prettier ✅ Good

**Config:** `.prettierrc` at project root
```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "endOfLine": "lf"
}
```

**Ignore:** `.prettierignore` excludes `node_modules`, `dist`, `.next`, `coverage`, `.turbo`, `pnpm-lock.yaml`

**Run command:** `pnpm format` — applies to `**/*.{ts,tsx,js,jsx,json,css,md}`

### ESLint ❌ Missing (mostly)

- **No `.eslintrc*` or `eslint.config.*`** found at root, backend, or frontend
- `apps/frontend/package.json` has `"lint": "next lint"` — uses Next.js's built-in ESLint (zero-config), but no custom rules
- `apps/backend/package.json` has `"lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix"` — but **ESLint is not in devDependencies**; this script likely fails
- `packages/config/eslint/` directory exists but is **empty**
- `packages/config/tsconfig/` directory exists but is **empty**
- `turbo.json` defines a `lint` task, but only the frontend can actually lint

**Impact:** No consistent linting rules enforced. Backend lint script is broken. No import ordering, unused variable detection, or code style enforcement beyond Prettier.

---

## 3. Type Safety ✅ Good

### TypeScript Configuration

All three packages use `"strict": true`:

**Backend** (`apps/backend/tsconfig.json`):
- `strict: true`, `strictNullChecks: true`, `noImplicitAny: true`
- `forceConsistentCasingInFileNames: true`, `noFallthroughCasesInSwitch: true`
- Target: ES2022, Module: CommonJS
- Path alias: `@/*` → `src/*`

**Frontend** (`apps/frontend/tsconfig.json`):
- `strict: true`
- Module resolution: bundler (Next.js convention)
- Path alias: `@/*` → `./src/*`

**Shared** (`packages/shared/tsconfig.json`):
- `strict: true`, `strictNullChecks: true`, `noImplicitAny: true`
- `noUnusedLocals: true`, `noUnusedParameters: true` ← stricter than other packages
- Target: ES2022, Module: CommonJS

### Type Quality

**Strong typing observed in:**
- Frontend types: `apps/frontend/src/types/index.ts` — comprehensive type definitions with union types for statuses (`WorkflowStatus`, `ExecutionStatus`, `StepStatus`)
- Shared package: `packages/shared/src/types/` — enums for `WorkflowStatus`, `TriggerType`, `ActionType`; interfaces for nodes/edges/definitions
- Zod validation schemas: `packages/shared/src/utils/validation.ts`
- Backend DTOs: `apps/backend/src/workflows/dto/` — class-validator decorators on all fields

**Weak typing observed in:**
- Engine service uses `any` extensively: `workflow.definition as any`, `config: any`, `input: any`, `triggerData?: any` in `apps/backend/src/engine/engine.service.ts`
- Prisma JSON fields typed as `any` throughout (e.g., `definition` field cast `as any` everywhere)
- `error: any` catch clauses in `apps/backend/src/engine/engine.service.ts`, `apps/backend/src/queue/queue.service.ts`
- `CreateWorkflowDto.definition` typed as `any` in `apps/backend/src/workflows/dto/create-workflow.dto.ts`
- Frontend hooks use `res.data.data || res.data` pattern everywhere due to optional TransformInterceptor wrapping

### Type Duplication Issue

Types are duplicated between:
1. `packages/shared/src/types/` — shared enums and interfaces
2. `apps/frontend/src/types/index.ts` — separate type definitions (not importing from shared)

The shared package exports types but the frontend doesn't import from it. Backend doesn't use the shared types either. The `@minizapier/shared` package exists but appears unused.

---

## 4. CI/CD ❌ Missing

- No `.github/` directory (no GitHub Actions workflows)
- No `.gitlab-ci.yml`, `Jenkinsfile`, `bitbucket-pipelines.yml`, or any CI configuration
- No pre-commit hooks (no `husky`, `lint-staged`, or `.husky/` directory)
- Docker production setup exists: `docker-compose.prod.yml`, `apps/backend/Dockerfile`, `apps/frontend/Dockerfile`, `nginx/nginx.conf`
- No automated test execution, lint checking, or build verification on push/PR

**Impact:** All quality gates rely on developer discipline. No automated enforcement of tests passing, formatting, or type correctness.

---

## 5. Code Conventions ✅ Good (mostly consistent)

### Naming Patterns

**Files (Backend):**
- NestJS convention: `{name}.{type}.ts` — e.g., `workflows.service.ts`, `workflows.controller.ts`, `workflows.module.ts`
- Spec files co-located: `workflows.service.spec.ts` next to `workflows.service.ts`
- DTOs in `dto/` subdirectory: `create-workflow.dto.ts`, `update-workflow.dto.ts`
- Strategies in `strategies/` subdirectory: `jwt.strategy.ts`, `local.strategy.ts`

**Files (Frontend):**
- kebab-case for all files: `workflow-card.tsx`, `stats-cards.tsx`, `use-workflows.ts`
- Hooks prefixed with `use-`: `use-auth.ts`, `use-workflows.ts`, `use-websocket.ts`
- Components organized by feature: `components/dashboard/`, `components/editor/`, `components/workflows/`

**Variables/Functions:**
- camelCase consistently for variables and functions
- PascalCase for classes, components, types, interfaces, enums
- UPPER_SNAKE_CASE for constants: `EXECUTION_STATUS_COLORS`, `TRIGGER_NODE_TYPES`

**Types/Interfaces:**
- PascalCase: `WorkflowStatus`, `ExecutionContext`, `EditorState`
- No `I` prefix on interfaces (correct modern convention)

### Import Organization

**Backend pattern:**
1. NestJS/framework imports (`@nestjs/*`)
2. Third-party packages (`bcrypt`, `axios`, etc.)
3. Internal modules via relative paths or `@/` alias

**Frontend pattern:**
1. React/Next.js imports
2. Third-party packages (`@tanstack/react-query`, `@xyflow/react`, etc.)
3. Internal imports via `@/` alias (`@/components/*`, `@/lib/*`, `@/stores/*`, `@/types`)

**Path aliases:**
- Backend: `@/*` → `src/*` (in tsconfig + jest moduleNameMapper)
- Frontend: `@/*` → `./src/*` (in tsconfig, resolved by Next.js)

### Module Structure (Backend)

Every NestJS domain follows the pattern:
```
src/{domain}/
├── {domain}.module.ts      # Module definition
├── {domain}.controller.ts  # HTTP endpoints (if exposed)
├── {domain}.service.ts     # Business logic
├── {domain}.service.spec.ts # Tests (when present)
└── dto/                    # DTOs (when needed)
    ├── create-{domain}.dto.ts
    └── update-{domain}.dto.ts
```

### Frontend Hook Pattern

All data-fetching hooks follow this pattern:
```typescript
export function useXxx(params) {
  return useQuery({
    queryKey: ['key', params],
    queryFn: async () => {
      const res = await api.get(`/endpoint`);
      return res.data.data || res.data;  // Handle wrapped/unwrapped responses
    },
  });
}
```

Mutations follow:
```typescript
export function useCreateXxx() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => { ... },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xxx'] });
      toast.success('Message');
    },
  });
}
```

### Component Pattern (Frontend)

```typescript
'use client';  // All interactive components

import { /* UI components */ } from '@/components/ui/xxx';
import { /* Icons */ } from 'lucide-react';
import type { Xxx } from '@/types';

interface XxxProps { ... }

export function Xxx({ prop1, prop2 }: XxxProps) {
  return ( /* JSX with Tailwind classes */ );
}
```

---

## 6. Error Handling ✅ Good

### Backend Error Handling

**Global exception filter:** `apps/backend/src/common/filters/all-exceptions.filter.ts`
- Catches all exceptions via `@Catch()`
- Maps `HttpException` to proper status codes
- Falls back to 500 for unknown errors
- Logs error with stack trace
- Returns structured JSON: `{ statusCode, message, timestamp, path }`

**NestJS HTTP exceptions used consistently:**
- `NotFoundException` — workflow/user not found
- `ForbiddenException` — ownership mismatch
- `ConflictException` — duplicate email registration
- `UnauthorizedException` — invalid credentials/tokens
- `BadRequestException` — invalid URLs in HTTP action (SSRF protection)

**Validation pipeline:** Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true` in `apps/backend/src/main.ts`

**Engine error handling:** `apps/backend/src/engine/engine.service.ts`
- Try/catch around full workflow execution
- Try/catch around each step execution
- Failed steps update `executionStepLog.status = 'FAILED'`
- Failed workflow updates `workflowExecution.status = 'FAILED'` with error message
- Events emitted for both success and failure (`execution.completed`, `execution.failed`, `step.failed`)
- Errors re-thrown after recording (proper propagation)

**Queue retry handling:** `apps/backend/src/queue/queue.service.ts`
- BullMQ configured with `attempts: 3`, `backoff: { type: 'exponential', delay: 5000 }`

**HTTP action SSRF protection:** `apps/backend/src/engine/actions/http-request.action.ts`
- URL validation (only http/https allowed)
- Blocks localhost, private IPs (127.x, 10.x, 172.16-31.x, 192.168.x)
- DNS resolution check for hostname-based SSRF
- axios-retry with exponential backoff for transient failures

### Frontend Error Handling

**Next.js error boundaries:**
- `apps/frontend/src/app/error.tsx` — route-level error boundary with retry button
- `apps/frontend/src/app/global-error.tsx` — root error boundary for catastrophic failures
- `apps/frontend/src/app/not-found.tsx` — 404 page

**API error handling:** `apps/frontend/src/lib/api.ts`
- Axios response interceptor: auto-refreshes tokens on 401
- Redirects to `/login` on refresh failure
- Clears localStorage tokens on auth failure

**Mutation error handling:**
- `onError` callbacks with `toast.error()` for user feedback
- Error message extraction: `axiosError.response?.data?.message || 'fallback'`

**Middleware auth:** `apps/frontend/middleware.ts`
- JWT verification via `jose` library
- Redirects to `/login` on missing/invalid token
- Silent catch on verification failure (redirect, no error display)

---

## 7. Logging ⚠️ Needs Improvement

### Backend Logging

**Framework:** NestJS `Logger` class (built-in) — **not** Pino despite being listed in `package.json` dependencies

**Pattern:** Every service/gateway creates a scoped logger:
```typescript
private readonly logger = new Logger(WorkflowsService.name);
```

**Usage:**
- `this.logger.log()` — info-level operations (workflow created, execution completed)
- `this.logger.warn()` — non-critical failures (Telegram webhook registration failure)
- `this.logger.error()` — critical failures (execution failed, notification send failure)
- `this.logger.debug()` — WebSocket room join/leave

**HTTP logging:** `apps/backend/src/common/interceptors/logging.interceptor.ts`
- Logs `METHOD URL STATUS_CODE - DURATIONms` for every request
- Uses NestJS Logger with context 'HTTP'

**What's missing:**
- Pino (`pino`, `pino-http`, `pino-pretty`) is installed but not configured or used — NestJS default Logger is used everywhere instead
- No structured logging (JSON format) — all logs are string-based
- No correlation IDs / request tracing
- No log levels configured per environment

### Frontend Logging

- No logging framework
- No `console.log` statements in production code (clean)
- Errors shown to users via `sonner` toast notifications
- No error reporting service (Sentry, etc.)

---

## 8. Documentation ✅ Good

### README

`README.md` is comprehensive (440+ lines, Russian language):
- Project description with badges
- Technology stack tables (backend, frontend, infrastructure)
- Feature descriptions (triggers, actions, auth, dashboard, etc.)
- Quick start guide with step-by-step commands
- Docker setup (dev + production)
- API documentation table with endpoints
- Full project structure tree
- Environment variable reference table with defaults
- Database schema diagram (ASCII art)
- Test/lint commands

### API Documentation

- **Swagger/OpenAPI:** Auto-generated via `@nestjs/swagger` at `/api/docs`
- Controllers decorated with `@ApiTags`, `@ApiOperation`, `@ApiBearerAuth`, `@ApiResponse`, `@ApiQuery`
- DTOs decorated with `@ApiProperty`, `@ApiPropertyOptional` with examples
- Bearer auth configured in Swagger UI

### Inline Documentation

- Minimal inline comments (code is mostly self-documenting)
- No JSDoc/TSDoc on functions or interfaces
- No `README.md` files in subdirectories
- Schema file (`prisma/schema.prisma`) is well-structured but lacks comments on complex relationships

### Missing Documentation

- No `CONTRIBUTING.md`
- No `CHANGELOG.md`
- No architecture decision records (ADRs)
- No API client documentation beyond Swagger
- Shared package (`packages/shared/`) has no documentation on how to use it

---

## 9. Build Pipeline ✅ Good

### Turborepo Configuration

`turbo.json`:
```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],     // Build dependencies first
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": { "cache": false, "persistent": true },
    "test": { "dependsOn": ["^build"] },
    "test:cov": { "dependsOn": ["^build"] },
    "lint": {},
    "clean": { "cache": false }
  }
}
```

**Task dependencies:**
- `build` and `test` correctly depend on `^build` (builds dependencies first)
- `dev` marked persistent and uncached (correct for dev servers)
- `clean` uncached (correct)
- `lint` has no dependencies (runs independently)

### Build Scripts

| Package | Build Command | Output |
|---------|--------------|--------|
| Backend | `nest build` | `dist/` |
| Frontend | `next build` | `.next/` (standalone in Docker) |
| Shared | `tsc` | `dist/` |

### Root Scripts (`package.json`)

```bash
pnpm dev        # turbo run dev (starts all apps)
pnpm build      # turbo run build (builds all packages)
pnpm test       # turbo run test
pnpm test:cov   # turbo run test:cov
pnpm lint       # turbo run lint
pnpm format     # prettier --write (all files)
pnpm clean      # turbo clean + rimraf node_modules
pnpm db:migrate # prisma migrate dev (backend filter)
pnpm db:seed    # prisma db seed (backend filter)
pnpm db:studio  # prisma studio (backend filter)
```

### Docker Build

**Backend** (`apps/backend/Dockerfile`): Multi-stage build (not examined in detail but exists)
**Frontend** (`apps/frontend/Dockerfile`): Multi-stage build with `DOCKER_BUILD=1` → standalone output
**nginx** (`nginx/nginx.conf`): Reverse proxy for production

### Production Deployment

`docker-compose.prod.yml` orchestrates: PostgreSQL → Redis → Backend → Frontend → nginx

---

## Summary

| Area | Rating | Notes |
|------|--------|-------|
| **Testing** | ⚠️ | Backend has decent unit tests (8 spec files, ~88 tests). Frontend has zero tests. No E2E tests. No test for 9+ backend modules. |
| **Linting** | ❌ | Prettier configured. ESLint non-functional: backend script broken (no ESLint dep), frontend uses zero-config Next lint only. |
| **Type Safety** | ✅ | `strict: true` everywhere. Some `any` pollution in engine/Prisma JSON handling. Shared types not consumed by apps. |
| **CI/CD** | ❌ | No CI pipeline. No pre-commit hooks. No automated quality gates. |
| **Conventions** | ✅ | Consistent NestJS patterns, consistent React patterns, clear naming. |
| **Error Handling** | ✅ | Global exception filter, proper NestJS exceptions, SSRF protection, retry logic, error boundaries. |
| **Logging** | ⚠️ | NestJS Logger used consistently but Pino installed and unused. No structured logging or correlation IDs. |
| **Documentation** | ✅ | Excellent README. Swagger API docs. No inline docs or ADRs. |
| **Build Pipeline** | ✅ | Turbo properly configured. Docker production setup. Clean script organization. |

### Priority Improvements

1. **Fix ESLint:** Install ESLint + `@typescript-eslint/*` in backend devDependencies. Create shared config in `packages/config/eslint/`. Add `eslint-plugin-import` for import ordering.
2. **Add CI pipeline:** GitHub Actions with: install → lint → typecheck → test → build. Block merges on failure.
3. **Frontend tests:** Install Vitest + @testing-library/react. Start with hooks (pure logic) and critical pages.
4. **Add pre-commit hooks:** `husky` + `lint-staged` for formatting and lint on commit.
5. **Replace `any` with proper types:** Create typed interfaces for Prisma JSON fields (`definition`, `config`, `triggerData`). Import from shared package.
6. **Configure Pino or remove it:** Either set up structured JSON logging with Pino (already installed) or remove the unused dependencies.
7. **Use shared package:** Wire `@minizapier/shared` types into both frontend and backend to eliminate type duplication.
