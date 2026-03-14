# 🚀 Mini-Zapier — Workflow Automation Platform

Production-ready workflow automation platform with visual drag-and-drop editor, trigger system, task queue, and real-time monitoring.

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![NestJS](https://img.shields.io/badge/NestJS-10-red)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)
![Redis](https://img.shields.io/badge/Redis-7-red)

## ✨ Features

### Workflow Engine
- **Visual Editor** — Drag-and-drop workflow builder with React Flow
- **3 Trigger Types** — Webhook, Cron Schedule, Email (IMAP)
- **5 Action Types** — HTTP Request, Send Email, Telegram, Database Query, Data Transform (JSONata)

### Execution
- **BullMQ Queue** — Redis-backed task queue with sandboxed processors
- **Retry Logic** — Exponential backoff with jitter, configurable max retries
- **Error Notifications** — Email + Telegram alerts on failure
- **Real-time Monitoring** — WebSocket updates for execution progress

### Dashboard
- **Statistics** — Total workflows, executions, success/failure rates
- **Execution History** — Filterable table with status badges
- **Step-by-step Logs** — Detailed execution timeline with input/output

### Auth & Security
- **JWT + Refresh Tokens** — Secure authentication with token rotation
- **RBAC** — Role-based access control (Admin/User)
- **Rate Limiting** — Per-IP throttling
- **Input Validation** — DTO validation with class-validator
- **Security Headers** — Helmet, CORS whitelist

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | NestJS, Prisma, PostgreSQL, BullMQ, Redis |
| **Frontend** | Next.js 15, React Flow, Tailwind CSS, shadcn/ui |
| **State** | Zustand (editor), TanStack Query (server) |
| **Queue** | BullMQ with sandboxed processors |
| **Auth** | JWT + Passport.js |
| **Real-time** | Socket.io WebSocket |
| **Monorepo** | Turborepo + pnpm |

## 🚀 Quick Start

### Prerequisites
- Node.js >= 20
- pnpm >= 9
- Docker & Docker Compose (for PostgreSQL + Redis)

### 1. Clone & Install

```bash
git clone <repo-url>
cd minizapierpraktika
pnpm install
```

### 2. Start Infrastructure

```bash
docker-compose up -d
```

This starts PostgreSQL and Redis containers.

### 3. Configure Environment

```bash
cp .env.example apps/backend/.env
# Edit apps/backend/.env with your settings
```

### 4. Database Setup

```bash
cd apps/backend
npx prisma migrate dev
npx prisma db seed
```

### 5. Start Development

```bash
# From project root
pnpm dev
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api
- **Swagger Docs**: http://localhost:3001/api/docs

### Demo Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@minizapier.com | admin123 | Admin |
| user@minizapier.com | user123 | User |

## 📁 Project Structure

```
minizapierpraktika/
├── apps/
│   ├── backend/          # NestJS API server
│   │   ├── src/
│   │   │   ├── auth/     # JWT authentication
│   │   │   ├── workflows/ # Workflow CRUD
│   │   │   ├── executions/ # Execution history
│   │   │   ├── engine/   # Workflow execution engine
│   │   │   ├── triggers/ # Webhook, Cron, Email triggers
│   │   │   ├── queue/    # BullMQ queue system
│   │   │   └── websocket/ # Real-time updates
│   │   └── prisma/       # Database schema & migrations
│   └── frontend/         # Next.js dashboard
│       └── src/
│           ├── app/      # Pages (App Router)
│           ├── components/ # UI components
│           ├── hooks/    # Custom hooks
│           └── stores/   # Zustand stores
├── packages/
│   └── shared/           # Shared types & utils
├── docker-compose.yml
└── turbo.json
```

## 📖 API Documentation

Full API documentation is available at `/api/docs` (Swagger UI) when the backend is running.

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| GET | `/api/workflows` | List workflows |
| POST | `/api/workflows` | Create workflow |
| POST | `/api/workflows/:id/execute` | Execute workflow |
| GET | `/api/executions` | Execution history |
| POST | `/api/webhooks/:id` | Webhook trigger |
| GET | `/api/health` | Health check |

## 🐳 Production Deployment

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d --build
```

The application will be available at `http://localhost:80`.

## 🧪 Testing

```bash
# Unit tests
pnpm test

# With coverage
pnpm test:cov

# E2E tests
cd apps/backend && pnpm test:e2e
```

## 📝 License

MIT
