# AI-Developer Brief

## Kontext

- **Projekt**: Sales Simulation (AI-gestütztes Verkaufstraining mit Realtime Audio)
- **Laufumgebung**: Docker Compose unter `/opt/sales-simulation`
- **Reverse Proxy**: Nginx Proxy Manager (NPM) über `sales.cloud-schulz.de`
- **Netzwerke**:
  - `frontend` (external `172.18.0.0/16`) für Webzugang
  - `backend` (external `172.21.0.0/16`) für DB/Interne Services
- **Auth/Keys**: `X-API-Key` Header für Backend-Endpunkte. OpenAI API Key im Backend.

## Architektur

### Frontend

- Vite + React + TypeScript
- Port `3000`
- Dev Server im Container (Vite)
- Allowed Hosts: `sales.cloud-schulz.de`, `localhost`, `.cloud-schulz.de`
- Proxy zu Backend: `/api` → `http://sales-simulation-backend:4000`
- Environment Variable: `VITE_API_KEY` für `X-API-Key`

### Backend

- Fastify + TypeScript + Prisma
- Port `4000`
- Endpunkte:
  - `POST /api/start` → `{ conversationId }`
  - `POST /api/token` → `{ token, expires_in }`
  - `POST /api/realtime/session` → `{ sdp }` (WebRTC an OpenAI Realtime)
  - `POST /api/score` → `{ conversationId, score, feedback }`
  - `POST /api/conversation/:id/transcript`
  - `GET /api/conversation/:id`
- Security: validiert `X-API-Key` für alle `/api`-Requests
- Environment Variablen: `API_KEY`, `OPENAI_API_KEY`, `DATABASE_URL`, `REALTIME_MODEL`, `RESPONSES_MODEL`
- Start: `npx prisma migrate deploy && node dist/server.js`

### Datenbank

- Postgres 16 (Service: `db`)
- Prisma Schema enthält Tabelle `Conversation` (`id`, `userId`, `transcript`, `score`, `feedback`, `createdAt`)

## Wichtige Pfade

- `docker-compose.yml`
- Frontend: `/opt/sales-simulation/frontend`
- Backend: `/opt/sales-simulation/backend`
- Prisma: `schema.prisma`

## Build/Run (Compose)

```bash
docker compose build
docker compose up -d
```

- Frontend läuft via NPM unter `https://sales.cloud-schulz.de`
- Interne Ports:
  - Frontend: `3000/tcp`
  - Backend: `4000/tcp`
  - DB: `5432/tcp`

## Konfigurationsdetails

- Vite Config erlaubt `sales.cloud-schulz.de` (allowedHosts); `server.host=0.0.0.0`; `/api`-Proxy zur Backend-URL.
- Backend validiert `X-API-Key` im `onRequest` Hook, wenn URL mit `/api` beginnt.
- Realtime & Token Routen rufen OpenAI API an (Headers: `Authorization: Bearer`, `OpenAI-Beta: realtime=v1`).
- Score-Route ruft OpenAI Responses API und extrahiert JSON `{score, feedback}` aus der Antwort (Fallback: JSON im Text via RegEx).
- Prisma verbindet via `DATABASE_URL` (Env).

## Erwartete Änderungen/Erweiterungen

### Frontend UX

- UI verbessern (Status, Recording-Hinweise, Error-States, Ladeindikatoren).

### Robustheit

- Fehlerhandling bei OpenAI Down/Timeout.
- Klare Fehlermeldungen im UI.

### Settings Panel

- Auswahl Modellvarianten (Realtime, Responses).
- API-Key Eingabe (ggf. via Backend wird nur ein ephemeral Token genutzt).

### Persistenz

- Liste der letzten Konversationen.
- Anzeige historischer Scores.
- Paging.

### Tests

- Backend: Unit- und API-Tests (z. B. Vitest + supertest/undici).
- Frontend: Component Tests (React Testing Library), E2E (Playwright).

### Telemetrie/Logging

- Klare Logs im Backend (pino).
- Frontend Error Boundary + Sentry (optional).

### Infra

- CI (GitHub Actions) für Lint, Test, Build; optional Container Publish.

### Dev-Qualität

- Typen für API DTOs frontendseitig.
- OpenAPI/ts-rest/Zod-Contracts zur Vermeidung von Drift.

## Akzeptanzkriterien

- Start/Stop/Score Flows funktionieren stabil über NPM-Domain.
- Keine „Blocked host“-Fehler; alle `/api`-Calls laufen via Proxy.
- Frontend zeigt verständliche Statusmeldungen, Handling für Fehler/Timeouts.
- Mindestens 1–2 Tests pro kritischer Route und Hook.
- README: Setup/Run/Env/Debug Anweisungen.

## Constraints

- App muss im bestehenden Compose-Setup laufen.
- Netzwerke dürfen bleiben.
- Nur OpenAI APIs wie im Code referenziert nutzen.
- Keine Geheimnisse ins Repo; Env über `.env`/`.env.example`.

## Lieferobjekte

- PR mit Code-Änderungen.
- Aktualisierte READMEs (Root, Frontend, Backend).
- Migrations (Prisma), falls Schema erweitert.
- Basic Tests und CI Workflow Datei.

## Entwickeln & Testen

### Backend

- `npm run build && node dist/server.js`
- (oder Dev via `tsx watch`).

### Frontend

- `npm run dev` (im Container).

### Compose

- `docker compose up -d backend frontend db`

### Zugriff

- `https://sales.cloud-schulz.de`

## Kontaktpunkte

- Bei Proxy/Netzwerkproblemen: `allowedHosts` in `vite.config.ts`, Proxy in Compose/Vite Config prüfen.
- Für Authentik/OIDC: aktuell nicht integriert; nur API Key.

## Schneller Dev-Workflow (ohne neue Skriptdateien)

### Minimal-Kommandos für Update & Restart

#### Frontend-Only Update

1. Git Pull im Repo-Verzeichnis `/opt/sales-simulation`:
   ```bash
   git -C /opt/sales-simulation pull origin main
   ```
2. Rebuild nur betroffene Services:
   ```bash
   docker compose build frontend
   docker compose up -d frontend
   ```

#### Backend Analog

```bash
docker compose build backend
docker compose up -d backend
```

#### DB Migrations

```bash
docker compose exec backend npx prisma migrate deploy
```

### Logs Schnell Prüfen

```bash
docker compose logs -f frontend
docker compose logs -f backend
```

## Häufige Fehler

- Vite `allowedHosts` fehlt: in `vite.config.ts` `"sales.cloud-schulz.de"` hinzufügen.
- Proxy falsch: Vite Proxy → `sales-simulation-backend:4000`.
- `X-API-Key` fehlt im Frontend: `VITE_API_KEY` Env setzen, damit Header mitgeschickt wird.

## Upgrades für besseren Dev-Flow

- DevContainer (VS Code): `.devcontainer` mit Node 20 + Docker-in-Docker.
- Makefile Targets (`make pull`, `make build-frontend`, `make up-frontend`, `make logs-frontend`, `make migrate`, `make test`).
- Hot-Reload Backend: Compose Dev Service `backend-dev` mit `tsx watch` und gemountetem Code (Volumes) für sofortiges Reloading.
- Bind Mounts in Dev: `docker-compose.override.yml` mit `volumes: - ./frontend:/app`, `- ./backend:/app` → `npm ci` und Dev-Mode im Container.
- Env-Management: `.env` (root) mit `API_KEY`, `OPENAI_API_KEY` etc.; `.env.example` aktuell halten.
- Database Convenience: Prisma Studio hinter Auth (optional); Seed Skript `npm run prisma:seed`.
- CI/CD: GitHub Actions – Lint + Build + Test bei PR; optional Docker Images build/push bei `main`.
- Observability: Backend Pino-Logger mit Level konfigurierbar via ENV; Request-Logging und Error-Stacks.
- API Spezifikation: Zod-Schemas vorhanden; optional OpenAPI-Generierung via `zod-to-openapi`; Client-Typen im Frontend generieren.

## Priorisierte Backlog-Liste

### Stabilität & UX

- Besseres Fehlerhandling im Frontend (Timeouts, API Errors, Hinweise).
- Ladeindikatoren + Retry Buttons.
- Audio-Geräteauswahl und Mute/Unmute.

### Features

- Konversationsliste + Detailansicht.
- Export von Transkript/Score (PDF/Markdown).
- Settings Panel: Modelle/Parameter (temporär in LocalStorage, langfristig via Backend).

### Qualität

- Tests: Backend (Tests für `/api/start`, `/api/score`, `/api/token` mit Mock OpenAI); Frontend (Tests für `useSimulation` Hook, App-Komponenten).
- Typ-Shared: DTO-Typen (Zod inferred) vom Backend ins Frontend (shared package oder OpenAPI-Client).

### Dev-Infra

- Dev `docker-compose.override.yml` mit Mounts, `tsx`, Vite HMR.
- Makefile + Scripts.
- GitHub Actions (Lint, Build, Test).

### Security/Hardening

- Rate Limiting `/api`.
- Eingabesanitisierung (Zod prüfen).
- CORS präziser konfigurieren (statt `origin: true`).
