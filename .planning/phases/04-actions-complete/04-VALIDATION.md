# Phase 04 Validation Checklist

## Pre-Execution Baseline
- [ ] All 253 existing tests pass (17 suites)
- [ ] Frontend builds without errors
- [ ] Backend builds without errors

---

## Plan 04-01: Template Engine + Data Flow (Wave 1)

### Unit Tests
- [ ] `template-engine.spec.ts` exists and has 20+ tests
- [ ] All template engine tests pass
- [ ] `npx jest template-engine` — green

### Functionality
- [ ] `TemplateEngine.resolve("Hello {{trigger.name}}", ctx)` → `"Hello World"`
- [ ] `TemplateEngine.resolve("{{steps.node1.output.items[0].name}}", ctx)` → resolved
- [ ] `TemplateEngine.resolve("{{missing.path}}", ctx)` → `"{{missing.path}}"` (graceful)
- [ ] `TemplateEngine.resolveConfig({url: "{{trigger.url}}", timeout: 5000}, ctx)` → url resolved, timeout=5000
- [ ] EngineService resolves templates in config BEFORE passing to action handler
- [ ] `_context` still passed to actions for backward compatibility

### Regression
- [ ] All 253 existing tests pass after changes
- [ ] engine.service.spec.ts — all 26 tests pass

---

## Plan 04-02: Harden All 5 Actions + Tests (Wave 2)

### HTTP Request (ACT-01)
- [ ] Response size limit configured (maxContentLength/maxBodyLength)
- [ ] BadRequestException thrown for missing/invalid URL
- [ ] BadRequestException thrown for invalid HTTP method
- [ ] String headers parsed as JSON
- [ ] String body parsed as JSON (or kept as text)
- [ ] 12+ new tests in http-request.action.spec.ts

### Email Send (ACT-02)
- [ ] Per-workflow SMTP config supported (config.smtp → integrations → env fallback)
- [ ] CC/BCC fields supported
- [ ] Email address validation (regex)
- [ ] Subject required validation
- [ ] isHtml toggle works (html vs text)
- [ ] email.action.spec.ts exists with 15+ tests

### Telegram Send (ACT-03)
- [ ] `interpolateMessage()` private method REMOVED
- [ ] ChatId validated as numeric
- [ ] Message length validated (≤4096)
- [ ] ParseMode validated (HTML/Markdown/MarkdownV2)
- [ ] telegram.action.spec.ts exists with 15+ tests

### Database Query (ACT-04)
- [ ] Better error for missing operation
- [ ] WHERE param null/undefined validation
- [ ] DatabaseConfig exported
- [ ] 8+ new tests in database.action.spec.ts

### Data Transform (ACT-05)
- [ ] Timeout timer cleared on success (no memory leak)
- [ ] Output size limit enforced (5MB)
- [ ] Context passed correctly (steps + trigger)
- [ ] transform.action.spec.ts exists with 12+ tests

### Regression
- [ ] All pre-existing tests pass
- [ ] All new tests pass
- [ ] Total test count: 253 + ~62 new = ~315+

---

## Plan 04-03: Frontend Config Panels (Wave 2)

### UI Components
- [ ] `apps/frontend/src/components/ui/select.tsx` exists
- [ ] `apps/frontend/src/components/ui/textarea.tsx` exists

### HTTP Request Panel
- [ ] Method: `<Select>` with GET/POST/PUT/DELETE/PATCH
- [ ] Headers: `<Textarea>`
- [ ] Body: `<Textarea>`
- [ ] Timeout: `<Input type="number">`
- [ ] URL hint mentions template support

### Email Panel
- [ ] To: `<Input>` with email validation
- [ ] CC/BCC: `<Input>` fields present
- [ ] Subject: `<Input>` (required)
- [ ] Body: `<Textarea>`
- [ ] isHtml: `<Select>` with Plain Text / HTML options

### Telegram Panel
- [ ] Bot Token: `<Input type="password">` (required)
- [ ] Chat ID: `<Input>` (required)
- [ ] Message: `<Textarea>` (required)
- [ ] Parse Mode: `<Select>` with HTML/Markdown/MarkdownV2

### Database Panel
- [ ] Operation: `<Select>` locked to SELECT (disabled/readOnly)
- [ ] Table: `<Select>` with 5 allowed tables
- [ ] WHERE: `<Textarea>` for JSON
- [ ] Order By: `<Input>`
- [ ] Limit: `<Input type="number">`

### Transform Panel
- [ ] Expression: `<Textarea>` with monospace font (code style)

### Validation
- [ ] Required fields show error message when empty
- [ ] Email `to` field shows error for invalid email format
- [ ] Number fields show error for non-numeric values
- [ ] Template variable hints shown below fields
- [ ] Template variable reference box at bottom of action panels

### Regression
- [ ] Frontend builds without errors
- [ ] All 315+ backend tests pass (frontend changes don't affect backend)

---

## Final Phase 04 Sign-Off

### Coverage
- [ ] ACT-01: HTTP Request — hardened with validation, size limit ✓
- [ ] ACT-02: Email Send — per-workflow SMTP, CC/BCC, validation ✓
- [ ] ACT-03: Telegram Send — validation, no private interpolation ✓
- [ ] ACT-04: Database Query — better errors, exported types ✓
- [ ] ACT-05: Data Transform — timeout fix, output limit ✓
- [ ] ACT-06: Data flow — TemplateEngine resolves {{steps.X.output}} ✓
- [ ] ACT-07: Config panels — type-appropriate inputs, validation ✓

### Test Summary
- [ ] 3 new spec files created (email, telegram, transform)
- [ ] 2 existing spec files extended (http, database)
- [ ] 1 new spec file for template engine
- [ ] Total new tests: ~82 (20 template + 62 actions)
- [ ] Zero regressions in existing 253 tests
- [ ] Total passing tests: ~335

### Wave Execution Order
1. ✅ Wave 1: Plan 04-01 (Template Engine) — must complete first
2. ✅ Wave 2: Plan 04-02 (Actions) + Plan 04-03 (Frontend) — can run in parallel
