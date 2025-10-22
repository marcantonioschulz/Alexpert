# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Alexpert is an AI-powered sales training platform featuring real-time voice interactions with intelligent agents. The system uses OpenAI's Realtime API for bidirectional audio streaming and provides comprehensive analytics dashboards for performance tracking.

**Key Technologies:**
- Frontend: React 18 + TypeScript + Vite + WebRTC + Recharts
- Backend: Fastify + Prisma + PostgreSQL + JWT Auth
- AI: OpenAI Realtime API (GPT-4o for audio, configurable models for responses)
- Deployment: Docker Compose + GitHub Actions CI/CD
- Monitoring: Prometheus + Grafana + Alertmanager (optional)

## Development Commands

### Initial Setup
```bash
# Use Node 20 (via .nvmrc)
nvm use

# Install all dependencies (runs parallel install for backend/frontend)
make codex-setup

# Alternative: manual installation
npm install
cd backend && npm install
cd ../frontend && npm install
```

### Running Locally

```bash
# With Docker (recommended - includes hot reload)
docker compose up -d

# Without Docker (requires PostgreSQL running separately)
make backend-dev   # Terminal 1: Backend on port 4000
make frontend-dev  # Terminal 2: Frontend on port 3000
```

### Testing

```bash
# Backend tests (requires Docker for Testcontainers)
cd backend
npm test                    # Run all tests
npm run test:watch         # Watch mode for development
npm run test:coverage      # Generate coverage report (enforces 80% threshold)

# Frontend tests
cd frontend
npm test                    # Unit tests (Vitest + React Testing Library)
npm run test:coverage      # Coverage report (enforces 80% threshold)
npm run test:e2e          # Playwright E2E tests (requires dev server running)

# Run single test file
cd backend
npm test -- session.test.ts
```

### Linting & Building

```bash
# Lint entire monorepo (from root)
npm run lint
npm run lint:fix

# Build for production
cd backend && npm run build
cd frontend && npm run build
```

### Database Migrations

```bash
cd backend

# Create new migration (development)
npx prisma migrate dev --name <description>

# Apply migrations (production/CI)
npx prisma migrate deploy

# Generate Prisma Client after schema changes
npx prisma generate

# Open Prisma Studio (database GUI)
npx prisma studio
```

### Versioning (Maintainers Only)

```bash
# From root - updates all package.json files and creates git tag
npm run version:patch   # 1.0.0 → 1.0.1 (bugfixes)
npm run version:minor   # 1.0.0 → 1.1.0 (new features)
npm run version:major   # 1.0.0 → 2.0.0 (breaking changes)
```

## Architecture

### Monorepo Structure

```
Alexpert/
├── backend/          # Fastify API server
│   ├── src/
│   │   ├── routes/       # 8 route modules (conversations, sessions, auth, etc.)
│   │   ├── services/     # Business logic (12+ services)
│   │   ├── lib/          # Utilities and helpers
│   │   ├── plugins/      # Fastify plugins (error handling, CORS)
│   │   └── server.ts     # Main server setup
│   └── prisma/
│       └── schema.prisma # Database schema (User, Conversation, Session, etc.)
├── frontend/         # React SPA
│   └── src/
│       ├── components/   # Reusable UI components
│       ├── features/     # Feature-specific components (Dashboard, Session, etc.)
│       └── App.tsx       # Root component
├── monitoring/       # Prometheus/Grafana configs
├── scripts/          # Setup and automation scripts
└── docs/            # Additional documentation
```

### Key Architectural Patterns

**1. Service Layer Separation**
- Routes in `backend/src/routes/` handle HTTP concerns (validation, serialization)
- Services in `backend/src/services/` contain business logic
- Never put business logic directly in route handlers

**2. Event-Driven Session Management**
- `realtimeSessionManager.ts` implements in-memory pub-sub for WebSocket events
- Events: `item_created`, `response_done`, `transcript_update`, `error`
- Sessions are isolated - no cross-session interference

**3. OpenAI Realtime API Integration**
- `realtimeClient.ts` manages WebSocket connection to OpenAI
- `audioManager.ts` handles audio chunking and streaming
- PCM16 24kHz mono audio format (specified in `backend/src/config/realtime.ts`)
- Bidirectional: client audio → OpenAI → server audio → client

**4. Type-Safe Validation**
- Zod schemas for all API requests (`backend/src/lib/validation.ts`)
- `fastify-type-provider-zod` for automatic type inference
- Environment validation in `backend/src/lib/env.ts`

**5. Database Design**
- User (email, password hash) → Conversation → Session → Message/Metric
- Timestamps tracked at all levels for analytics
- Prisma relations ensure referential integrity

### Critical Files & Their Responsibilities

- `backend/src/server.ts` - Fastify initialization, plugin registration, error handling
- `backend/src/services/realtimeSessionManager.ts` - Core session orchestration and event bus
- `backend/src/services/realtimeClient.ts` - OpenAI WebSocket client wrapper
- `backend/src/routes/sessions.ts` - Session lifecycle endpoints (create, start, stop)
- `backend/src/routes/realtime.ts` - WebSocket endpoint for audio streaming
- `frontend/src/features/Session/SessionPanel.tsx` - Main UI for active conversations
- `frontend/src/features/Dashboard/ConversationDetail.tsx` - Analytics visualization
- `backend/prisma/schema.prisma` - Single source of truth for database schema

## Environment Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and customize.

**Critical Variables:**
- `APP_ENV` - Set to `dev` for development (relaxed CORS), `prod` for production
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - Required for AI functionality
- `API_KEY` - Shared secret for admin authentication
- `CORS_ORIGIN` - Comma-separated list of allowed origins (or `*` in dev)
- `VITE_BACKEND_URL` - Frontend needs to know backend location
- `REALTIME_MODEL` - OpenAI model for audio (default: `gpt-4o-realtime-preview-2024-12-17`)
- `RESPONSES_MODEL` - Model for text responses (default: `gpt-4o`)

**Development defaults:** `APP_ENV=dev` enables CORS `*` and relaxed validation.

## Testing Philosophy

**Coverage Requirements:**
- Minimum 80% coverage enforced via `vitest.config.ts` thresholds
- 100% coverage expected for critical business logic (authentication, session management)
- CI fails if coverage drops below threshold

**Backend Testing Strategy:**
- **Integration tests** use Testcontainers to spin up isolated PostgreSQL
- **Unit tests** mock external dependencies (OpenAI, database)
- Test files mirror source structure: `src/services/foo.ts` → `test/unit/services/foo.test.ts`

**Frontend Testing Strategy:**
- **Component tests** use Vitest + React Testing Library
- **E2E tests** use Playwright (test user flows, not individual components)
- Mock API responses in component tests, use real API in E2E

**What to test:**
- API endpoints (happy path + error cases)
- Business logic in services
- Error handling and validation
- State management and side effects
- User interactions (clicks, form submissions)

**What NOT to test:**
- Third-party library internals
- Trivial getters/setters
- Type definitions alone

## Design Decisions

**Why Fastify over Express?**
- Built-in TypeScript support
- Schema-based validation
- Better performance for WebSocket-heavy workloads

**Why In-Memory Event Bus?**
- Sessions are ephemeral (not persisted during conversation)
- Pub-sub allows multiple listeners (metrics, logging, UI updates)
- Simplifies state management (no shared mutable state)

**Why Testcontainers?**
- Integration tests run against real PostgreSQL
- Isolated environment prevents test pollution
- CI can run identical setup to local development

**Why Monorepo?**
- Shared ESLint config and tooling
- Coordinated releases (semantic versioning)
- Frontend/backend changes can be atomic

## CI/CD Pipeline

**GitHub Actions Workflow:** `.github/workflows/ci.yml`

**Jobs:**
1. **Lint** - ESLint on entire monorepo (runs from root)
2. **Build** - TypeScript compilation for backend + frontend (parallel)
3. **Test** - Matrix execution (backend Vitest + frontend Vitest + Playwright)
4. **Docker** - Build and push images to GHCR (only on `main` branch)
5. **Deploy** - SSH deployment to server (optional, requires secrets)

**Docker Images:**
- `ghcr.io/marcantonioschulz/web-app-agents-sdk-backend:main`
- `ghcr.io/marcantonioschulz/web-app-agents-sdk-frontend:main`
- Tagged with git SHA for reproducibility

**Deployment:**
```bash
# On production server
docker compose pull
docker compose up -d
```

## Common Development Tasks

### Adding a New API Endpoint

1. Define Zod schema in `backend/src/lib/validation.ts`
2. Create route handler in appropriate file under `backend/src/routes/`
3. Add business logic to service in `backend/src/services/`
4. Write integration test in `backend/test/integration/routes/`
5. Update OpenAPI docs if using swagger plugin

### Adding a New Database Model

1. Update `backend/prisma/schema.prisma`
2. Run `npx prisma migrate dev --name <description>`
3. Run `npx prisma generate` to update Prisma Client
4. Update TypeScript types if needed
5. Add tests for new model relationships

### Debugging WebSocket Issues

1. Check `backend/src/services/realtimeSessionManager.ts` event logs
2. Verify OpenAI WebSocket connection in `realtimeClient.ts`
3. Inspect browser DevTools → Network → WS tab for client-side messages
4. Enable debug logging: `DEBUG=* npm run dev` (if implemented)

### Adding a New Metric

1. Define metric calculation in `backend/src/services/metrics.ts`
2. Update `Metric` table in Prisma schema if persisting
3. Emit metric event in `realtimeSessionManager.ts`
4. Add visualization in `frontend/src/features/Dashboard/`
5. Write tests for metric calculation accuracy

## Troubleshooting

**"Testcontainers failed to start"**
- Ensure Docker is running and accessible
- Check Docker socket permissions: `docker ps` should work without sudo
- Set `TESTCONTAINERS_RYUK_DISABLED=true` if Ryuk container fails

**"Migration failed: Database is locked"**
- Another process has an open connection to the database
- Stop all running instances: `docker compose down`
- Restart database: `docker compose up -d db`

**"CORS error in browser"**
- Set `APP_ENV=dev` for local development (allows CORS `*`)
- Or add your frontend URL to `CORS_ORIGIN` in `.env`
- Ensure `VITE_BACKEND_URL` matches actual backend location

**"OpenAI WebSocket connection refused"**
- Verify `OPENAI_API_KEY` is valid
- Check OpenAI API status: https://status.openai.com/
- Ensure model name in `REALTIME_MODEL` is correct

**"Frontend build fails with TypeScript errors"**
- Run `cd frontend && npm run build` to see full errors
- Check that all imports have proper type definitions
- Verify `tsconfig.json` paths are correct

## Additional Documentation

- **Architecture Deep Dive:** `docs/AI-Developer-Brief.md`
- **Monitoring Setup:** `docs/monitoring.md`
- **Contributing Guidelines:** `CONTRIBUTING.md`
- **Security Policy:** `SECURITY.md`
- **Changelog:** `CHANGELOG.md`

## Licensing Note

This is a proprietary project. Source code is viewable and contributions are welcome, but commercial use requires a separate license. See `LICENSE` for details. By contributing, you grant the maintainer commercial usage rights while retaining copyright of your work.
