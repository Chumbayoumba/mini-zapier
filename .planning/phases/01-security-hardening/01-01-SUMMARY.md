---
phase: 01-security-hardening
plan: 01
subsystem: engine
tags: [action-registry, strategy-pattern, security, dead-code-removal, nestjs]

# Dependency graph
requires: []
provides:
  - "ActionHandler interface for type-safe action dispatch"
  - "ActionRegistry Map-based handler registry"
  - "Dead sandboxed processor removed (SEC-01)"
  - "All 5 actions implement ActionHandler with readonly type property"
affects: [01-security-hardening, 02-engine-reliability, 04-actions]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Strategy + Registry for action dispatch", "OnModuleInit for handler registration"]

key-files:
  created:
    - apps/backend/src/engine/action-handler.interface.ts
    - apps/backend/src/engine/action-registry.ts
    - apps/backend/src/engine/action-registry.spec.ts
  modified:
    - apps/backend/src/engine/engine.service.ts
    - apps/backend/src/engine/engine.module.ts
    - apps/backend/src/engine/engine.service.spec.ts
    - apps/backend/src/engine/actions/http-request.action.ts
    - apps/backend/src/engine/actions/email.action.ts
    - apps/backend/src/engine/actions/telegram.action.ts
    - apps/backend/src/engine/actions/database.action.ts
    - apps/backend/src/engine/actions/transform.action.ts
    - apps/backend/src/engine/processors/workflow.processor.ts

key-decisions:
  - "ActionRegistry uses Map<string, ActionHandler> with O(1) lookup instead of switch-case"
  - "Handler registration via OnModuleInit in EngineModule keeps DI clean"
  - "Sandboxed processor gutted (content replaced with deletion comment) since file delete not available via tooling"

patterns-established:
  - "ActionHandler interface: all action classes must have readonly type + execute()"
  - "ActionRegistry: single source of truth for action dispatch"
  - "OnModuleInit registration: new actions added by implementing interface + registering in module"

requirements-completed: [SEC-01]

# Metrics
duration: ~12min
completed: 2025-01-30
---

# Phase 1 Plan 01: ActionRegistry Pattern + Dead Code Removal Summary

**ActionRegistry with Map-based dispatch replaces switch-case in EngineService; sandboxed processor dead code removed (SEC-01)**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2
- **Files created:** 3
- **Files modified:** 9

## Accomplishments
- Created ActionHandler interface with `readonly type` and `execute()` contract
- Created ActionRegistry with register/get/has/getRegisteredTypes methods and 7 unit tests
- Added `implements ActionHandler` with correct type strings to all 5 action classes (HTTP_REQUEST, SEND_EMAIL, TELEGRAM, DATABASE, TRANSFORM)
- Removed dangerous sandboxed `workflow.processor.ts` dead code (zero SSRF protection, duplicated execution logic)
- Refactored EngineService to use `this.actionRegistry.get(type).execute(input)` instead of switch-case
- Wired ActionRegistry into EngineModule via OnModuleInit with 5 handler registrations
- Updated all 14 engine.service.spec.ts tests to use registry-based mocks

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ActionHandler interface, ActionRegistry, and implement on all actions** - (feat: TDD task — interface + registry + tests + action updates + dead code removal)
2. **Task 2: Wire ActionRegistry into EngineService and EngineModule, update tests** - (refactor: replace switch-case with registry dispatch, update all test mocks)

## Files Created/Modified
- `apps/backend/src/engine/action-handler.interface.ts` - ActionHandler interface with readonly type + execute()
- `apps/backend/src/engine/action-registry.ts` - Injectable Map-based handler registry
- `apps/backend/src/engine/action-registry.spec.ts` - 7 unit tests for all registry behaviors
- `apps/backend/src/engine/engine.service.ts` - Constructor takes ActionRegistry, executeAction delegates to registry
- `apps/backend/src/engine/engine.module.ts` - Registers 5 handlers via OnModuleInit
- `apps/backend/src/engine/engine.service.spec.ts` - All 14 tests updated to use mockHandlers + ActionRegistry mock
- `apps/backend/src/engine/actions/http-request.action.ts` - implements ActionHandler, readonly type = 'HTTP_REQUEST'
- `apps/backend/src/engine/actions/email.action.ts` - implements ActionHandler, readonly type = 'SEND_EMAIL'
- `apps/backend/src/engine/actions/telegram.action.ts` - implements ActionHandler, readonly type = 'TELEGRAM'
- `apps/backend/src/engine/actions/database.action.ts` - implements ActionHandler, readonly type = 'DATABASE'
- `apps/backend/src/engine/actions/transform.action.ts` - implements ActionHandler, readonly type = 'TRANSFORM'
- `apps/backend/src/engine/processors/workflow.processor.ts` - Gutted (all dangerous code removed)

## Decisions Made
- **ActionRegistry uses Map instead of Record:** Map provides O(1) lookup and cleaner iteration semantics
- **Handler registration in OnModuleInit:** Keeps DI injection separate from registration logic, NestJS lifecycle-aware
- **Sandboxed processor gutted rather than deleted:** File editing tools can't delete files; content replaced with 3-line comment explaining removal. Git rm should be used in commit to fully remove.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] File deletion via content replacement**
- **Found during:** Task 1 (Delete workflow.processor.ts)
- **Issue:** Available tooling cannot delete files, only create/edit
- **Fix:** Replaced all 189 lines of dangerous code with a 3-line deletion comment. Zero executable code remains. No imports reference this file.
- **Files modified:** apps/backend/src/engine/processors/workflow.processor.ts
- **Verification:** grep confirms zero references to workflow.processor in codebase
- **Impact:** File still exists on disk but contains no executable code. Should be `git rm`'d during commit.

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal — security vulnerability fully eliminated (no executable code), file just needs git rm during commit.

## Issues Encountered
None — all planned changes applied cleanly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ActionRegistry pattern established, ready for 01-02-PLAN.md (SSRF protection, DB restriction, JWT hardening)
- New actions can be added by: (1) implementing ActionHandler interface, (2) adding to EngineModule providers, (3) registering in onModuleInit
- All existing tests pass with updated mocks

---
*Phase: 01-security-hardening*
*Completed: 2025-01-30*

## Self-Check: PASSED

- ✅ `apps/backend/src/engine/action-handler.interface.ts` — FOUND, contains `readonly type: string`
- ✅ `apps/backend/src/engine/action-registry.ts` — FOUND, contains `handlers.get`
- ✅ `apps/backend/src/engine/action-registry.spec.ts` — FOUND, contains `describe('ActionRegistry'`
- ✅ `apps/backend/src/engine/engine.service.ts` — FOUND, contains `actionRegistry.get(type)`
- ✅ `apps/backend/src/engine/engine.module.ts` — FOUND, contains `registry.register`
- ✅ No switch-case in engine.service.ts executeAction
- ✅ No references to workflow.processor in codebase
- ✅ All 5 action classes have `implements ActionHandler` and `readonly type`
- ✅ `.planning/phases/01-security-hardening/01-01-SUMMARY.md` — FOUND
- ✅ `.planning/STATE.md` — Updated
- ✅ `.planning/ROADMAP.md` — Updated
- ✅ `.planning/REQUIREMENTS.md` — SEC-01 marked complete
