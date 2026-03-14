# Codebase Map — minizapierpraktika

> Generated: 2026-03-14 | GSD v1.22.4

## 🎯 Project Overview

**Mini-Zapier** — платформа автоматизации рабочих процессов (workflow automation), аналог Zapier/n8n. Позволяет создавать цепочки действий (workflows) с триггерами и экшенами.

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces + Turborepo |
| Backend | NestJS 10 (TypeScript) |
| Frontend | Next.js 15 + React 19 |
| Database | PostgreSQL 15 (Prisma 6 ORM) |
| Cache/Queue | Redis 7 + BullMQ |
| WebSockets | Socket.IO |
| Auth | JWT (Passport.js) |
| Infra | Docker Compose + Nginx |
| Shared | Zod-based validation package |

---

## 🏗️ Architecture

```
minizapierpraktika/
├── apps/
│   ├── backend/     # NestJS API (REST + WebSocket)
│   └── frontend/    # Next.js App Router
├── packages/
│   └── shared/      # Zod schemas, types, constants
├── nginx/           # Reverse proxy config
├── docker-compose.yml       # Dev environment
└── docker-compose.prod.yml  # Production
```

**Workflow Engine:** DAG-based execution с 5 типами экшенов (HTTP, Email, DB Query, Transform, Delay) и 4 типами триггеров (Webhook, Schedule/Cron, Email, Manual).

---

## ✅ Code Quality Summary

| Область | Статус | Детали |
|---------|--------|--------|
| Backend тесты | ⚠️ | 8 spec-файлов (~88 тестов), 9+ модулей без тестов |
| Frontend тесты | ❌ | Ноль тестов |
| ESLint | ❌ | Сломан (нет в зависимостях backend) |
| Prettier | ✅ | Настроен корректно |
| TypeScript strict | ✅ | Включён везде |
| CI/CD | ❌ | Нет pipeline |
| Swagger docs | ✅ | Настроен |
| README | ✅ | Качественный |
| Error handling | ✅ | Global filters + SSRF protection |
| Logging | ⚠️ | Pino установлен, но не используется |

---

## 🚨 Critical Concerns (Top 4)

| # | Проблема | Риск |
|---|----------|------|
| 🔴 1 | SSRF bypass в sandboxed processor | Security — обход sandbox |
| 🔴 2 | Hardcoded JWT fallback secret | Security — предсказуемый токен |
| 🔴 3 | DB action privilege escalation | Security — SQL без ограничений |
| 🔴 4 | Hardcoded prod DB passwords | Security — утечка credentials |

**Итого:** 4 🔴 Critical, 19 🟡 Important, 7 🟢 Nice-to-have

---

## 📂 Detailed Reports

- [01-tech-stack.md](01-tech-stack.md) — полный стек технологий (268 строк)
- [02-architecture.md](02-architecture.md) — архитектура и паттерны (435 строк)
- [03-code-quality.md](03-code-quality.md) — качество кода (365 строк)
- [04-concerns.md](04-concerns.md) — проблемы и риски (291 строк)

---

## 🔜 Recommended Next Steps

1. `gsd:new-project` — спланировать устранение critical issues
2. `gsd:new-milestone` — добавить milestone по тестированию
3. `gsd:quick` — быстро пофиксить конкретную проблему
