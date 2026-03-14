<div align="center">

# ⚡ Mini-Zapier

### Платформа автоматизации рабочих процессов

Визуальный конструктор workflow с drag-and-drop редактором, системой триггеров, очередью задач и мониторингом в реальном времени.

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-✓-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

[Быстрый старт](#-быстрый-старт) •
[Функциональность](#-функциональность) •
[Технологии](#-технологический-стек) •
[API Docs](#-api-документация) •
[Docker](#-docker)

</div>

---

## 📋 Описание проекта

**Mini-Zapier** — полнофункциональная платформа для автоматизации рабочих процессов, вдохновлённая Zapier. Позволяет создавать, настраивать и запускать workflow через визуальный drag-and-drop редактор. Поддерживает различные типы триггеров и действий, обработку ошибок с retry, уведомления и мониторинг выполнения в реальном времени.

### Ключевые возможности:
- 🎨 **Визуальный редактор** — создание workflow перетаскиванием узлов на canvas
- ⚡ **Триггеры** — автоматический запуск по Webhook, расписанию (Cron) или входящему Email
- 🔄 **Очередь задач** — надёжное выполнение через BullMQ с Redis
- 📊 **Dashboard** — статистика, графики и история выполнений
- 🌙 **Dark mode** — полная поддержка тёмной темы

---

## 🖼️ Скриншоты

<details>
<summary><b>📸 Нажмите, чтобы развернуть скриншоты</b></summary>

<br>

> **Dashboard** — главная панель со статистикой
>
> `screenshots/dashboard.png`

> **Workflow Editor** — визуальный drag-and-drop редактор
>
> `screenshots/editor.png`

> **Execution Logs** — детальные логи выполнения
>
> `screenshots/logs.png`

> **Dark Mode** — тёмная тема
>
> `screenshots/dark-mode.png`

</details>

---

## 🛠 Технологический стек

### Backend

| Технология | Версия | Назначение |
|:-----------|:------:|:-----------|
| **NestJS** | 10 | Фреймворк API-сервера |
| **Prisma** | 6 | ORM и миграции базы данных |
| **PostgreSQL** | 15 | Реляционная база данных |
| **BullMQ** | 5 | Очередь задач на Redis |
| **Redis** | 7 | Кэш, очереди, pub/sub |
| **Passport.js** | 0.7 | JWT-аутентификация |
| **Socket.io** | 4.8 | WebSocket для real-time обновлений |
| **Swagger** | 7.4 | Автодокументация REST API |
| **JSONata** | 2.0 | Трансформация данных |
| **Pino** | 9.5 | Structured logging |

### Frontend

| Технология | Версия | Назначение |
|:-----------|:------:|:-----------|
| **Next.js** | 15 | React-фреймворк (App Router) |
| **React** | 19 | UI-библиотека |
| **React Flow** (@xyflow/react) | 12 | Визуальный редактор workflow |
| **Zustand** | 5 | State management (editor) |
| **TanStack Query** | 5 | Server state и кэширование |
| **Tailwind CSS** | 3.4 | Utility-first CSS |
| **shadcn/ui** | — | Компоненты (Radix UI) |
| **Recharts** | 2.15 | Графики и диаграммы |
| **React Hook Form** + **Zod** | — | Формы и валидация |
| **Lucide React** | — | Иконки |

### Инфраструктура

| Технология | Назначение |
|:-----------|:-----------|
| **Turborepo** | Monorepo-сборка и кэширование |
| **pnpm** | Быстрый package manager |
| **Docker** + **Docker Compose** | Контейнеризация |
| **nginx** | Reverse proxy (production) |

---

## ✨ Функциональность

### 🎨 Визуальный редактор Workflow
- Drag-and-drop canvas на базе React Flow
- Добавление и соединение узлов (triggers → actions)
- Настройка параметров каждого узла через side panel
- Версионирование workflow

### 🔔 Триггеры (3 типа)

| Тип | Описание |
|:----|:---------|
| **Webhook** | HTTP-эндпоинт, запускающий workflow при получении запроса |
| **Cron** (расписание) | Запуск по расписанию в формате cron-выражений |
| **Email** (IMAP) | Мониторинг входящих писем и запуск при получении |

### ⚙️ Действия (5 типов)

| Тип | Описание |
|:----|:---------|
| **HTTP Request** | Отправка HTTP-запросов к внешним API |
| **Email** | Отправка email через SMTP |
| **Telegram** | Отправка сообщений через Telegram Bot API |
| **Database Query** | Выполнение SQL-запросов |
| **Data Transform** | Трансформация данных с помощью JSONata-выражений |

### 🔐 Аутентификация и безопасность
- JWT access + refresh tokens с ротацией
- Role-based access control (Admin / User)
- Rate limiting (throttling)
- Валидация входных данных (class-validator / Zod)
- Security headers (Helmet, CORS)

### 📊 Dashboard и мониторинг
- Статистика: общее количество workflow, запусков, процент успеха/ошибок
- Графики на Recharts
- Фильтруемая таблица истории выполнений
- Real-time обновления через WebSocket (Socket.io)

### 📋 Логирование выполнений
- Пошаговые логи каждого выполнения (input → output)
- Статус каждого шага: pending, running, completed, failed, skipped
- Время выполнения каждого шага
- Детали ошибок с трейсами

### 🔄 Обработка ошибок
- Retry с exponential backoff и jitter
- Уведомления об ошибках (Email + Telegram)
- Пауза workflow при критических ошибках
- Отмена выполнения

### 🌙 Интерфейс
- Dark mode / Light mode
- Адаптивный дизайн
- REST API с полной Swagger-документацией

---

## 🚀 Быстрый старт

### Требования

- **Node.js** >= 20
- **pnpm** >= 9
- **Docker** и **Docker Compose** (для PostgreSQL и Redis)

### Установка

```bash
# 1. Клонировать репозиторий
git clone <repo-url>
cd minizapierpraktika

# 2. Скопировать переменные окружения
cp .env.example apps/backend/.env

# 3. Запустить PostgreSQL и Redis
docker-compose up -d

# 4. Установить зависимости
pnpm install

# 5. Применить миграции и заполнить БД тестовыми данными
cd apps/backend
npx prisma migrate dev
npx prisma db seed
cd ../..

# 6. Запустить проект в режиме разработки
pnpm dev
```

После запуска:

| Сервис | URL |
|:-------|:----|
| 🖥️ **Frontend** | http://localhost:3000 |
| 🔌 **Backend API** | http://localhost:3001/api |
| 📖 **Swagger Docs** | http://localhost:3001/api/docs |

### Демо-аккаунты

| Email | Пароль | Роль |
|:------|:-------|:-----|
| `admin@minizapier.com` | `admin123` | Admin |
| `user@minizapier.com` | `user123` | User |

---

## 🐳 Docker

### Разработка (только инфраструктура)

```bash
# Запускает PostgreSQL 15 + Redis 7
docker-compose up -d
```

### Production (полный стек)

```bash
# Собирает и запускает все сервисы: postgres, redis, backend, frontend, nginx
docker-compose -f docker-compose.prod.yml up -d --build
```

Приложение будет доступно по адресу: **http://localhost**

Production-стек включает:
- **PostgreSQL 15** — база данных
- **Redis 7** — очереди и кэш
- **Backend** — NestJS API (внутренний порт 3001)
- **Frontend** — Next.js SSR (внутренний порт 3000)
- **nginx** — reverse proxy, маршрутизация (порт 80)

---

## 📖 API Документация

Интерактивная документация (Swagger UI) доступна при запущенном backend:

**🔗 http://localhost:3001/api/docs**

### Основные эндпоинты

| Метод | Эндпоинт | Описание |
|:------|:---------|:---------|
| `POST` | `/api/auth/register` | Регистрация пользователя |
| `POST` | `/api/auth/login` | Вход в систему |
| `POST` | `/api/auth/refresh` | Обновление access token |
| `GET` | `/api/workflows` | Список workflow |
| `POST` | `/api/workflows` | Создание workflow |
| `PUT` | `/api/workflows/:id` | Обновление workflow |
| `POST` | `/api/workflows/:id/execute` | Запуск workflow |
| `GET` | `/api/executions` | История выполнений |
| `GET` | `/api/executions/:id` | Детали выполнения |
| `POST` | `/api/webhooks/:id` | Вызов Webhook-триггера |
| `GET` | `/api/health` | Health check |

---

## 📁 Структура проекта

```
minizapierpraktika/
├── apps/
│   ├── backend/                  # 🔌 NestJS API-сервер
│   │   ├── src/
│   │   │   ├── auth/             # Аутентификация (JWT, Passport)
│   │   │   ├── workflows/        # CRUD workflow
│   │   │   ├── executions/       # История выполнений
│   │   │   ├── engine/           # Движок выполнения workflow
│   │   │   ├── triggers/         # Webhook, Cron, Email триггеры
│   │   │   ├── queue/            # BullMQ очередь задач
│   │   │   ├── websocket/        # Real-time WebSocket
│   │   │   ├── notifications/    # Email и Telegram уведомления
│   │   │   ├── users/            # Управление пользователями
│   │   │   ├── health/           # Health check эндпоинт
│   │   │   ├── common/           # Guards, decorators, filters
│   │   │   ├── config/           # Конфигурация приложения
│   │   │   └── prisma/           # Prisma service
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # Схема базы данных
│   │   │   └── seed.ts           # Тестовые данные
│   │   └── test/                 # E2E тесты
│   │
│   └── frontend/                 # 🖥️ Next.js Dashboard
│       └── src/
│           ├── app/              # Страницы (App Router)
│           ├── components/       # UI-компоненты
│           ├── hooks/            # Custom React hooks
│           ├── stores/           # Zustand stores
│           ├── lib/              # Утилиты и API client
│           ├── providers/        # Context providers
│           └── types/            # TypeScript типы
│
├── packages/
│   ├── shared/                   # Общие типы и утилиты
│   └── config/                   # Общие конфигурации
│
├── nginx/
│   └── nginx.conf                # Конфигурация reverse proxy
│
├── docker-compose.yml            # Dev: PostgreSQL + Redis
├── docker-compose.prod.yml       # Prod: полный стек
├── turbo.json                    # Turborepo конфигурация
├── pnpm-workspace.yaml           # pnpm workspace
└── package.json                  # Root scripts
```

---

## 🔐 Переменные окружения

Скопируйте `.env.example` в `apps/backend/.env` и настройте:

| Переменная | Описание | По умолчанию |
|:-----------|:---------|:-------------|
| `NODE_ENV` | Окружение (`development` / `production`) | `development` |
| `PORT` | Порт backend-сервера | `3001` |
| **База данных** | | |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://minizapier:minizapier123@localhost:5432/minizapier` |
| **Redis** | | |
| `REDIS_HOST` | Хост Redis-сервера | `localhost` |
| `REDIS_PORT` | Порт Redis-сервера | `6379` |
| **JWT** | | |
| `JWT_SECRET` | Секретный ключ для access token | — |
| `JWT_EXPIRES_IN` | Время жизни access token | `15m` |
| `JWT_REFRESH_SECRET` | Секретный ключ для refresh token | — |
| `JWT_REFRESH_EXPIRES_IN` | Время жизни refresh token | `7d` |
| **Email (SMTP)** | | |
| `SMTP_HOST` | SMTP-сервер | `smtp.gmail.com` |
| `SMTP_PORT` | Порт SMTP | `587` |
| `SMTP_USER` | Email отправителя | — |
| `SMTP_PASSWORD` | Пароль / app password | — |
| **Email Trigger (IMAP)** | | |
| `IMAP_HOST` | IMAP-сервер | `imap.gmail.com` |
| `IMAP_PORT` | Порт IMAP | `993` |
| `IMAP_USER` | Email для мониторинга | — |
| `IMAP_PASSWORD` | Пароль / app password | — |
| **Telegram** | | |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота | — |
| **Frontend** | | |
| `NEXT_PUBLIC_API_URL` | URL backend API | `http://localhost:3001/api` |
| `NEXT_PUBLIC_WS_URL` | URL WebSocket-сервера | `http://localhost:3001` |

---

## 🧪 Тестирование

```bash
# Unit-тесты (все пакеты)
pnpm test

# Тесты с покрытием
pnpm test:cov

# E2E тесты (backend)
cd apps/backend && pnpm test:e2e

# Линтинг
pnpm lint

# Форматирование
pnpm format
```

---

## 📦 Полезные команды

```bash
# Открыть Prisma Studio (визуальный редактор БД)
pnpm db:studio

# Создать новую миграцию
pnpm db:migrate

# Заполнить БД тестовыми данными
pnpm db:seed

# Собрать проект
pnpm build

# Очистить все артефакты сборки
pnpm clean
```

---

## 🗃️ Схема базы данных

```
┌──────────────┐     ┌──────────────────┐     ┌───────────────────────┐
│    users     │────▶│    workflows      │────▶│  workflow_executions   │
│              │     │                  │     │                       │
│ id           │     │ id               │     │ id                    │
│ email        │     │ userId           │     │ workflowId            │
│ name         │     │ name             │     │ status                │
│ role         │     │ status           │     │ triggerData           │
│ passwordHash │     │ definition (JSON)│     │ startedAt / completedAt│
│ refreshToken │     │ version          │     │ error                 │
└──────────────┘     └──────┬───────────┘     └───────────┬───────────┘
                            │                             │
                     ┌──────▼───────────┐     ┌───────────▼───────────┐
                     │    triggers      │     │  execution_step_logs  │
                     │                  │     │                       │
                     │ id               │     │ id                    │
                     │ workflowId       │     │ executionId           │
                     │ type (enum)      │     │ nodeId / nodeName     │
                     │ config (JSON)    │     │ status                │
                     │ isActive         │     │ input / output (JSON) │
                     └──────────────────┘     │ retryCount            │
                                              │ duration              │
                     ┌──────────────────┐     └───────────────────────┘
                     │ workflow_versions│
                     │                  │
                     │ id               │
                     │ workflowId       │
                     │ version          │
                     │ definition (JSON)│
                     │ changelog        │
                     └──────────────────┘
```

---

## 📝 Лицензия

Этот проект распространяется под лицензией [MIT](LICENSE).

---

<div align="center">

**⚡ Mini-Zapier** — создано с 💙 для автоматизации

</div>
