# Phase 2: Engine Reliability & Error Handling — Validation Criteria

## Success Criteria (from ROADMAP.md)

1. **Retry with exponential backoff** — test with failing HTTP endpoint
2. **Paused workflow resumes** from correct step with preserved data
3. **Worker completes in-progress job** before shutting down (SIGTERM test)
4. **Failed execution sends toast** notification to connected user
5. **All execution logs have** correlationId, actionType, duration

## Plan Coverage Matrix

| Criterion | Plan | How Validated |
|-----------|------|--------------|
| Exponential backoff retry | 02-02 | Unit test: mock action fails N times, succeeds on N+1, verify delay pattern |
| Pause/resume from correct step | 02-02 | Unit test: pause mid-execution, verify lastCompletedNodeId, resume picks up from next step |
| Graceful shutdown | 02-01 | Integration: enableShutdownHooks(), Worker.close() on SIGTERM |
| Toast notification on failure | 02-03 | Unit test: mock execution failure → verify WebSocket emit to user room |
| Structured logs with correlation | 02-01 + 02-03 | Verify Pino output includes executionId, actionType, duration fields |

## Requirement Traceability

| REQ | Plan | Status |
|-----|------|--------|
| EXE-01 | 02-02 | Pending |
| EXE-02 | 02-01 + 02-03 | Pending |
| EXE-04 | 02-02 | Pending |
| EXE-05 | 02-02 | Pending |
| EXE-06 | 02-02 | Pending |
| EXE-07 | 02-02 | Pending |
| EXE-08 | 02-01 | Pending |
| ERR-01 | 02-03 | Pending |
| ERR-02 | 02-01 | Pending |
| ERR-03 | 02-03 | Pending |
| ERR-04 | 02-01 | Pending |
| INF-01 | 02-01 | Pending |
