# PROJECT.md — Mini-Zapier Workflow Automation Platform

> GSD Project Context | Created: 2025-01-27 | Type: Brownfield Rebuild

## Vision

Платформа автоматизации рабочих процессов (мини-Zapier) для создания визуальных workflow с триггерами и действиями. Пользователь собирает цепочки автоматизаций через drag-and-drop редактор, а система исполняет их надёжно с retry, логированием и мониторингом.

## Core Value

**Визуальное создание и надёжное выполнение workflow-автоматизаций** — пользователь без кода создаёт цепочки "триггер → действия", а платформа гарантирует их выполнение с обработкой ошибок.

## Problem Statement

Существующий проект реализует ~60% функциональности ТЗ, но имеет:
- 4 критические уязвимости безопасности (SSRF bypass, hardcoded secrets, SQL injection, credentials в docker-compose)
- Сломанные фичи (Email trigger, retry logic, ESLint)
- Отсутствующий функционал (Telegram trigger полноценный, pause workflow, полноценный дашборд)
- Нет тестов фронтенда, слабое покрытие бэкенда
- Нет CI/CD pipeline
- UX требует серьёзной доработки (интуитивность, полировка)

## Target State

Полностью рабочая платформа, соответствующая ТЗ:
1. Интуитивный визуальный редактор workflow (drag-and-drop, React Flow)
2. 3 типа триггеров: Webhook ✓, Cron ✓, Email ✗(сломан)
3. 5 типов действий: HTTP ✓, Email ✓, Telegram ✓, DB ✓(уязвим), Transform ✓
4. Полное логирование шагов выполнения
5. Обработка ошибок: retry ✗(сломан), уведомления, пауза ✗(нет)
6. Дашборд: список workflows, история выполнений, статистика
7. Очередь задач BullMQ ✓
8. Изоляция выполнения workflows ✗(SSRF bypass)
9. REST API + Swagger ✓

## Tech Stack (Validated)

| Layer | Technology | Status |
|-------|-----------|--------|
| Monorepo | pnpm + Turborepo | ✅ Working |
| Backend | NestJS 10 (TypeScript) | ✅ Working |
| Frontend | Next.js 15 + React 19 | ✅ Working |
| Database | PostgreSQL 15 (Prisma 6) | ✅ Working |
| Queue | Redis 7 + BullMQ | ✅ Working |
| WebSockets | Socket.IO | ⚠️ Auth gaps |
| Auth | JWT + Passport | ⚠️ Hardcoded fallback |
| Workflow Editor | @xyflow/react 12 | ⚠️ Needs UX polish |
| UI Components | Radix UI + shadcn/ui pattern | ✅ Working |
| State | TanStack Query + Zustand | ✅ Working |
| Charts | Recharts | ✅ Working |
| Infra | Docker Compose + Nginx | ⚠️ Hardcoded passwords |

## Constraints

- **Тестовое задание** — должно быть завершённым и впечатляющим
- **Существующий код** — рефакторинг, не переписывание с нуля
- **Все ТЗ требования** должны быть реализованы
- **Security first** — все 4 критических уязвимости должны быть закрыты
- **Стек зафиксирован** — NestJS + Next.js + PostgreSQL + Redis + BullMQ

## Brownfield Assessment

### Validated (Working in Code)
- JWT auth flow (login, register, refresh tokens)
- Workflow CRUD (create, read, update, delete)
- Workflow version management
- Webhook trigger (receive and execute)
- Cron/Schedule trigger
- HTTP Request action
- Email Send action
- Telegram Send action
- Database Query action
- Data Transform action (JSONata)
- BullMQ job queue integration
- React Flow workflow editor (basic)
- Real-time execution updates (Socket.IO)
- Prisma schema with proper relations
- Docker dev + prod setup
- Swagger API documentation
- Rate limiting (Throttler)
- Health checks (Terminus)

### Broken (Needs Fix)
- Email IMAP trigger — `imap` package issues, не работает
- Retry logic — код есть, но сломан
- ESLint — нет в зависимостях backend
- Pino logging — установлен, но не подключён (используется NestJS Logger)
- WebSocket auth — нет проверки JWT в gateway
- SSRF protection — bypass через DNS rebinding

### Missing (Not Implemented)
- Workflow pause/resume
- Execution error notifications (email/telegram alerts)
- Dashboard statistics (charts, metrics)
- Workflow execution history with filtering
- Frontend tests (zero)
- CI/CD pipeline
- Proper sandbox isolation
- Database action SQL restrictions (whitelist)
- Production secrets management
- Workflow templates/examples

## Success Metrics

1. Все ТЗ требования реализованы и работают
2. Zero критических уязвимостей
3. Backend test coverage > 80%
4. Frontend имеет базовые тесты
5. UX интуитивно понятный (визуальный редактор, дашборд)
6. Docker prod deployment работает
7. Swagger документация полная и актуальная
