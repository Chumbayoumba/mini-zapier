<div align="center">

# ⚡ FlowForge (Mini-Zapier)

### Платформа автоматизации рабочих процессов

Полнофункциональная платформа для создания и запуска автоматизаций через визуальный drag-and-drop редактор. Триггеры (Webhook, Cron, Email, Telegram), действия (HTTP, Email, Telegram, БД, Трансформации), очередь задач BullMQ, обработка ошибок с retry и мониторинг в реальном времени.

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
[Docker](#-docker) •
[Демо](#-демо)

</div>

---

## 📋 Описание проекта

**FlowForge** (Mini-Zapier) — полнофункциональная платформа для автоматизации рабочих процессов, вдохновлённая Zapier/n8n. Позволяет создавать, настраивать и запускать workflow через визуальный drag-and-drop редактор. Поддерживает 4 типа триггеров и 5 типов действий, 5 типов интеграций с внешними сервисами (Telegram, SMTP, Webhook, HTTP API, Database), систему уведомлений в реальном времени, обработку ошибок с retry и мониторинг выполнения.

### Ключевые возможности:
- 🎨 **Визуальный редактор** — создание workflow перетаскиванием узлов на canvas (React Flow)
- ⚡ **4 типа триггеров** — Webhook, Cron, Email, Telegram
- 🔌 **5 типов интеграций** — Telegram, SMTP, Webhook, HTTP API, Database
- 🤖 **Telegram-боты** — полная интеграция: создайте бота, который отвечает на команды и сообщения
- 🔔 **Уведомления** — real-time уведомления через WebSocket (колокольчик в навигации)
- 🔄 **Очередь задач** — надёжное выполнение через BullMQ с Redis
- 📊 **Dashboard** — статистика, графики и история выполнений
- 🔌 **REST API** — полная Swagger-документация на каждый эндпоинт
- 🌙 **Dark mode** — полная поддержка тёмной темы

---

## 🌐 Демо

| Ресурс | URL |
|:-------|:----|
| 🖥️ **Приложение** | [https://zapier.egor-dev.ru](https://zapier.egor-dev.ru) |
| 📖 **Swagger API Docs** | [https://zapier.egor-dev.ru/api/docs](https://zapier.egor-dev.ru/api/docs) |

### Демо-аккаунты

| Email | Пароль | Роль |
|:------|:-------|:-----|
| `admin@minizapier.com` | `admin123` | Admin |
| `user@minizapier.com` | `user123` | User |

> Вы также можете зарегистрировать собственный аккаунт через форму регистрации.

---

## 🖼️ Скриншоты

### Dashboard — главная панель со статистикой
![Dashboard](screenshots/dashboard.jpg)

### Workflow Editor — визуальный drag-and-drop редактор
![Workflow Editor](screenshots/workflow_editor.jpg)

### Схема готового Workflow
![Workflow Scheme](screenshots/ready_scheme.jpg)

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
| **nginx** | Reverse proxy, security headers, gzip |
| **PM2** | Process manager (production) |
| **Certbot / Let's Encrypt** | SSL-сертификаты |

---

## ✨ Функциональность

### 🎨 Визуальный редактор Workflow
- Drag-and-drop canvas на базе React Flow
- Добавление и соединение узлов (triggers → actions)
- Настройка параметров каждого узла через side panel в реальном времени
- Версионирование workflow (история изменений)
- Активация / деактивация workflow одним кликом

### 🔔 Триггеры (4 типа)

| Тип | Описание |
|:----|:---------|
| **Webhook** | HTTP-эндпоинт, запускающий workflow при получении POST-запроса |
| **Cron** (расписание) | Запуск по расписанию в формате cron-выражений (с timezone) |
| **Email** (IMAP) | Мониторинг входящих писем и запуск при получении нового письма |
| **Telegram** | Реакция на сообщения Telegram-бота: команды (/start, /help), любые сообщения, callback query |

### ⚙️ Действия (5 типов)

| Тип | Описание |
|:----|:---------|
| **HTTP Request** | Отправка HTTP-запросов к внешним API (GET, POST, PUT, DELETE, PATCH, HEAD) |
| **Email** | Отправка email через SMTP (HTML/текст, CC/BCC) |
| **Telegram** | Отправка сообщений через Telegram Bot API (HTML, Markdown, MarkdownV2) |
| **Database Query** | Выполнение безопасных SQL-запросов (SELECT) с фильтрацией и пагинацией |
| **Data Transform** | Трансформация данных с помощью JSONata-выражений |

### 🤖 Telegram-интеграция (полный цикл)

Платформа поддерживает полный цикл работы с Telegram-ботами:

1. **Интеграции** — добавьте Telegram-бота через токен (с верификацией имени и аватарки)
2. **Триггер** — выберите бота и тип события (команда /start, любое сообщение, callback query)
3. **Действие** — отправьте ответ пользователю (Chat ID определяется автоматически из триггера)
4. **Шаблоны** — используйте переменные `{{trigger.text}}`, `{{trigger.from.first_name}}`, `{{trigger.command}}` и др.

> **Пример:** Бот отвечает на `/start` → триггер ловит команду → action отправляет "Привет, {{trigger.from.first_name}}!"

### 🔌 Интеграции (5 типов)

Раздел **Integrations** позволяет подключать внешние сервисы. Каждая интеграция проходит верификацию при добавлении и может использоваться в любом количестве workflow.

| Тип | Описание | Верификация |
|:----|:---------|:------------|
| **Telegram** | Telegram-боты через Bot API | Проверка токена, отображение имени и аватарки бота |
| **SMTP** | Почтовые серверы для отправки email | Подключение и авторизация на SMTP-сервере |
| **Webhook** | Входящие HTTP-эндпоинты | Генерация уникального URL с секретным токеном |
| **HTTP API** | Внешние REST API с авторизацией | Тестовый запрос к указанному URL |
| **Database** | PostgreSQL / MySQL базы данных | Проверка подключения к БД |

**Особенности:**
- 🔗 Интеграции привязываются к узлам workflow — выберите нужную в настройках триггера/действия
- ✅ Каждый тип проходит верификацию при добавлении (нельзя сохранить нерабочую интеграцию)
- 🔐 Credentials хранятся в зашифрованном виде и подставляются автоматически
- 📧 SMTP-интеграции автоматически подключаются к Email-триггерам (IMAP настройки из той же интеграции)
- 🌐 Webhook-интеграции можно выбрать в WEBHOOK-триггере — URL из интеграции станет эндпоинтом триггера

### 🔔 Система уведомлений

- **Real-time уведомления** — иконка колокольчика в навигации с badge счётчиком непрочитанных
- **WebSocket** — мгновенная доставка через Socket.io (без перезагрузки страницы)
- **Типы событий:** завершение workflow (успех/ошибка), системные уведомления
- **Управление:** отметить как прочитанное, отметить все, удалить
- **Dropdown-панель** — всплывающий список уведомлений с деталями и timestamps

### 🔐 Аутентификация и безопасность
- JWT access + refresh tokens с ротацией
- Role-based access control (Admin / User)
- Rate limiting (throttling)
- Валидация входных данных (class-validator / Zod)
- Security headers (Helmet, CORS, X-Frame-Options, CSP)
- Изоляция выполнения workflow между пользователями

### 📊 Dashboard и мониторинг
- Статистика: общее количество workflow, запусков, процент успеха/ошибок
- Графики выполнений по дням (Recharts)
- Фильтруемая таблица истории выполнений (по статусу, дате, workflow)
- Real-time обновления через WebSocket (Socket.io)

### 📋 Логирование выполнений
- Пошаговые логи каждого выполнения (input → output)
- Статус каждого шага: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `SKIPPED`
- Время выполнения каждого шага
- Детали ошибок со stack trace
- Timeline визуализация

### 🔄 Обработка ошибок
- Retry с exponential backoff и jitter (настраивается)
- Уведомления об ошибках (Email + Telegram)
- Пауза workflow при критических ошибках
- Отмена / повторный запуск выполнения
- Повторный запуск с точки сбоя (retry from failed step)

### 🌙 Интерфейс
- Dark mode / Light mode (автоопределение + ручное переключение)
- Адаптивный дизайн
- Лендинг-страница

---

## 🚀 Быстрый старт

### Требования

- **Node.js** >= 20
- **pnpm** >= 9
- **Docker** и **Docker Compose** (для PostgreSQL и Redis)

### Установка

```bash
# 1. Клонировать репозиторий
git clone https://github.com/Chumbayoumba/mini-zapier.git
cd mini-zapier

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
- **nginx** — reverse proxy, gzip, security headers, WebSocket (порт 80)

---

## 📖 API Документация

Интерактивная документация (Swagger UI) доступна при запущенном backend:

**🔗 http://localhost:3001/api/docs** (локально) | **🔗 https://zapier.egor-dev.ru/api/docs** (демо)

### Полный список эндпоинтов

#### 🔐 Аутентификация

| Метод | Эндпоинт | Описание |
|:------|:---------|:---------|
| `POST` | `/api/auth/register` | Регистрация нового пользователя |
| `POST` | `/api/auth/login` | Вход (возвращает access + refresh token) |
| `POST` | `/api/auth/refresh` | Обновление access token |
| `POST` | `/api/auth/logout` | Выход из системы |
| `GET` | `/api/auth/me` | Профиль текущего пользователя |

#### 📋 Workflows

| Метод | Эндпоинт | Описание |
|:------|:---------|:---------|
| `POST` | `/api/workflows` | Создание нового workflow |
| `GET` | `/api/workflows` | Список workflow (поиск, фильтр, пагинация) |
| `GET` | `/api/workflows/:id` | Детали workflow |
| `PATCH` | `/api/workflows/:id` | Обновление workflow |
| `DELETE` | `/api/workflows/:id` | Удаление workflow |
| `POST` | `/api/workflows/:id/activate` | Активация (регистрирует триггер) |
| `POST` | `/api/workflows/:id/deactivate` | Деактивация (снимает триггер) |
| `POST` | `/api/workflows/:id/execute` | Ручной запуск |
| `GET` | `/api/workflows/:id/versions` | История версий |

#### 📊 Выполнения (Executions)

| Метод | Эндпоинт | Описание |
|:------|:---------|:---------|
| `GET` | `/api/executions` | Список выполнений (фильтр по статусу, дате, workflow) |
| `GET` | `/api/executions/stats` | Статистика (всего, успешных, ошибок, %) |
| `GET` | `/api/executions/recent` | Последние выполнения |
| `GET` | `/api/executions/chart` | Данные для графика (по дням) |
| `GET` | `/api/executions/:id` | Детали выполнения со step logs |
| `POST` | `/api/executions/:id/cancel` | Отмена выполнения |
| `POST` | `/api/executions/:id/pause` | Пауза |
| `POST` | `/api/executions/:id/resume` | Возобновление |
| `POST` | `/api/executions/:id/retry` | Повторный запуск |
| `POST` | `/api/executions/:id/retry-from-failed` | Повтор с точки сбоя |

#### 🔌 Интеграции

| Метод | Эндпоинт | Описание |
|:------|:---------|:---------|
| `GET` | `/api/integrations` | Список интеграций пользователя |
| `POST` | `/api/integrations` | Добавить интеграцию |
| `DELETE` | `/api/integrations/:id` | Удалить интеграцию |
| `POST` | `/api/integrations/telegram/verify` | Проверить токен Telegram-бота |
| `POST` | `/api/integrations/smtp/verify` | Проверить SMTP-подключение |
| `POST` | `/api/integrations/webhook/verify` | Проверить Webhook-эндпоинт |
| `POST` | `/api/integrations/http-api/verify` | Проверить HTTP API |
| `POST` | `/api/integrations/database/verify` | Проверить подключение к БД |

#### 🔔 Уведомления

| Метод | Эндпоинт | Описание |
|:------|:---------|:---------|
| `GET` | `/api/notifications` | Список уведомлений (пагинация) |
| `GET` | `/api/notifications/unread-count` | Счётчик непрочитанных |
| `PATCH` | `/api/notifications/:id/read` | Отметить как прочитанное |
| `POST` | `/api/notifications/mark-all-read` | Отметить все как прочитанные |
| `DELETE` | `/api/notifications/:id` | Удалить уведомление |

#### 👤 Пользователи (Admin)

| Метод | Эндпоинт | Описание |
|:------|:---------|:---------|
| `GET` | `/api/users` | Список всех пользователей |
| `GET` | `/api/users/:id` | Детали пользователя |
| `PATCH` | `/api/users/:id` | Обновление пользователя |
| `DELETE` | `/api/users/:id` | Удаление пользователя |

#### 🔗 Webhooks (публичные)

| Метод | Эндпоинт | Описание |
|:------|:---------|:---------|
| `POST` | `/api/webhooks/:token` | Входящий Webhook-триггер |
| `POST` | `/api/webhooks/telegram/:secret` | Входящий Telegram webhook |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/health/ready` | Readiness probe (БД + память) |

---

## 📁 Структура проекта

```
mini-zapier/
├── apps/
│   ├── backend/                  # 🔌 NestJS API-сервер
│   │   ├── src/
│   │   │   ├── auth/             # Аутентификация (JWT, Passport)
│   │   │   ├── workflows/        # CRUD workflow + активация
│   │   │   ├── executions/       # История и статистика выполнений
│   │   │   ├── engine/           # Движок выполнения workflow
│   │   │   │   └── actions/      # HTTP, Email, Telegram, DB, Transform
│   │   │   ├── triggers/         # Триггеры
│   │   │   │   ├── webhook/      # Webhook-триггер
│   │   │   │   ├── cron/         # Cron-триггер (расписание)
│   │   │   │   ├── email/        # Email-триггер (IMAP)
│   │   │   │   └── telegram/     # Telegram-триггер (webhook от бота)
│   │   │   ├── integrations/     # Управление интеграциями
│   │   │   ├── queue/            # BullMQ очередь задач
│   │   │   ├── websocket/        # Real-time WebSocket (Socket.io)
│   │   │   ├── notifications/    # Email и Telegram уведомления
│   │   │   ├── users/            # Управление пользователями
│   │   │   ├── health/           # Health / readiness check
│   │   │   ├── common/           # Guards, decorators, filters
│   │   │   ├── config/           # Конфигурация приложения
│   │   │   └── prisma/           # Prisma service
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # Схема базы данных
│   │   │   └── seed.ts           # Seed-данные
│   │   └── test/                 # E2E тесты
│   │
│   └── frontend/                 # 🖥️ Next.js Dashboard
│       └── src/
│           ├── app/
│           │   ├── (auth)/       # Login, Register
│           │   └── (dashboard)/  # Dashboard, Workflows, Executions,
│           │                     # Integrations, Settings, Editor
│           ├── components/       # UI-компоненты (shadcn/ui)
│           │   └── editor/       # Компоненты редактора workflow
│           ├── hooks/            # Custom React hooks
│           ├── stores/           # Zustand stores (editor state)
│           ├── lib/              # API client, утилиты
│           ├── providers/        # Auth, Theme, Query providers
│           └── types/            # TypeScript типы
│
├── packages/
│   ├── shared/                   # @minizapier/shared — общие типы, константы, утилиты
│   └── config/                   # @minizapier/config — ESLint, TypeScript конфиги
│
├── nginx/
│   └── nginx.conf                # Reverse proxy, gzip, security headers
│
├── screenshots/                  # Скриншоты для README
├── docker-compose.yml            # Dev: PostgreSQL + Redis
├── docker-compose.prod.yml       # Prod: полный стек (5 сервисов)
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
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота (для уведомлений) | — |
| **Frontend** | | |
| `NEXT_PUBLIC_API_URL` | URL backend API | `http://localhost:3001/api` |
| `NEXT_PUBLIC_WS_URL` | URL WebSocket-сервера | `http://localhost:3001` |

---

## 🧪 Тестирование

Проект содержит **22 тестовых файла**, покрывающих все основные модули:

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

### Покрытие тестами

| Модуль | Что тестируется |
|:-------|:----------------|
| **Engine** | Движок выполнения, action registry, шаблонизатор, credentials |
| **Actions** | HTTP Request, Email, Telegram, Database, Transform — каждый action |
| **Triggers** | Webhook (service + controller), Cron, Email |
| **Auth** | Controller + Service (JWT, регистрация, логин) |
| **Workflows** | Service (CRUD, активация) |
| **Executions** | Service (история, статистика) |
| **Users** | Service (управление пользователями) |
| **Notifications** | Service (email + telegram уведомления) |
| **WebSocket** | Gateway (real-time обновления) |

---

## 📦 Полезные команды

```bash
# Режим разработки (frontend + backend + shared)
pnpm dev

# Собрать весь проект
pnpm build

# Открыть Prisma Studio (визуальный редактор БД)
pnpm db:studio

# Создать новую миграцию
pnpm db:migrate

# Заполнить БД тестовыми данными
pnpm db:seed

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
│ role (enum)  │     │ status (enum)    │     │ triggerData (JSON)    │
│ passwordHash │     │ definition (JSON)│     │ startedAt / completedAt│
│ refreshToken │     │ version          │     │ error                 │
│              │     │ errorConfig(JSON)│     │                       │
└──────┬───────┘     └──────┬───────────┘     └───────────┬───────────┘
       │                    │                             │
       │             ┌──────▼───────────┐     ┌───────────▼───────────┐
       │             │    triggers      │     │  execution_step_logs  │
       │             │                  │     │                       │
       │             │ id               │     │ id                    │
       │             │ workflowId       │     │ executionId           │
       │             │ type (enum):     │     │ nodeId / nodeName     │
       │             │  WEBHOOK | CRON  │     │ status (enum)         │
       │             │  EMAIL|TELEGRAM  │     │ input / output (JSON) │
       │             │ config (JSON)    │     │ retryCount            │
       │             │ isActive         │     │ duration              │
       │             └──────────────────┘     │ error                 │
       │                                      └───────────────────────┘
       │             ┌──────────────────┐
       │             │ workflow_versions│
       │             │                  │
       │             │ id               │
       │             │ workflowId       │
       │             │ version          │
       │             │ definition (JSON)│
       │             │ changelog        │
       │             └──────────────────┘
       │
       └────────▶┌──────────────────┐     ┌──────────────────┐
                 │  integrations    │     │  notifications   │
                 │                  │     │                  │
                 │ id               │     │ id               │
                 │ userId           │     │ userId           │
                 │ type:            │     │ type             │
                 │  TELEGRAM | SMTP │     │ title / message  │
                 │  WEBHOOK|HTTP_API│     │ isRead           │
                 │  DATABASE        │     │ data (JSON)      │
                 │ name             │     │ createdAt        │
                 │ config (JSON)    │     └──────────────────┘
                 │ webhookSecret    │
                 └──────────────────┘
```

**Enum-типы:**
- `UserRole`: `ADMIN`, `USER`
- `WorkflowStatus`: `DRAFT`, `ACTIVE`, `PAUSED`, `ARCHIVED`
- `TriggerType`: `WEBHOOK`, `CRON`, `EMAIL`, `TELEGRAM`
- `ExecutionStatus`: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`, `PAUSED`
- `StepStatus`: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `SKIPPED`

---

## 📝 Лицензия

Этот проект распространяется под лицензией [MIT](LICENSE).

---

<div align="center">

**⚡ FlowForge** — платформа автоматизации рабочих процессов

</div>
