# Alexpert

[![CI/CD](https://github.com/marcantonioschulz/Alexpert/actions/workflows/ci.yml/badge.svg)](https://github.com/marcantonioschulz/Alexpert/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/marcantonioschulz/Alexpert/branch/main/graph/badge.svg)](https://codecov.io/gh/marcantonioschulz/Alexpert)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](./LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://hub.docker.com/)
[![Security: Trivy](https://img.shields.io/badge/Security-Trivy-green?logo=aqua)](https://github.com/marcantonioschulz/Alexpert/security)
[![Commercial License Available](https://img.shields.io/badge/Commercial_License-Available-green.svg)](./LICENSE)

> Alexpert - Die intelligente Sales-Training-Plattform mit KI-gestützten Voice Agents und Echtzeit-Analytics, entwickelt mit React, Fastify und OpenAI's Realtime API.

## Über Alexpert

Alexpert ist eine moderne KI-gestützte Sales-Training-Plattform. Das System ermöglicht realistische Verkaufsgespräche mit intelligenten KI-Agenten, erfasst detaillierte Metriken und visualisiert Performance-Daten in Echtzeit.

### Kernfeatures

- **🎤 Voice-First Interface**: Natürliche Sprachinteraktion mit OpenAI's Realtime API
- **📊 Analytics Dashboard**: Echtzeit-Visualisierung von Gesprächsmetriken und Performance
- **🔐 Sichere Authentifizierung**: JWT-basierte Admin-Authentifizierung mit bcrypt
- **🐳 Container-Ready**: Vollständig containerisiert mit Docker Compose
- **🧪 Hochqualität**: 80%+ Testabdeckung mit Vitest und Playwright
- **📈 Production-Ready**: Monitoring mit Prometheus, Grafana und Alertmanager

### Tech Stack

| Bereich | Technologien |
| --- | --- |
| **Frontend** | React 18, TypeScript, Vite, WebRTC, Recharts |
| **Backend** | Fastify, Node.js 20, Prisma ORM, JWT |
| **Datenbank** | PostgreSQL 16, Redis |
| **KI** | OpenAI Realtime API, GPT-4o |
| **DevOps** | Docker, GitHub Actions, GHCR |
| **Monitoring** | Prometheus, Grafana, Alertmanager |

---

## 🚀 Quick Start (Installation in 2 Minuten!)

```bash
# 1. Repository klonen
git clone https://github.com/marcantonioschulz/Alexpert.git
cd Alexpert

# 2. Automatisches Setup (installiert alles, generiert Credentials, migriert DB)
make install

# 3. OpenAI API Key in .env hinzufügen
# OPENAI_API_KEY=sk-your-actual-key

# 4. Development Server starten
make dev
```

**Das war's!** 🎉 Öffne http://localhost:3000

### Was `make install` automatisch macht:

- ✅ Prüft Prerequisites (Node.js, Docker, Git)
- ✅ Generiert sichere `API_KEY` und `JWT_SECRET`
- ✅ Installiert alle Dependencies
- ✅ Generiert Prisma Client
- ✅ Startet PostgreSQL Datenbank
- ✅ Führt Migrationen aus
- ✅ Baut Projekte
- ✅ Führt Tests aus

**Keine manuelle Konfiguration nötig!** Alle Credentials werden automatisch generiert.

### Wichtigste Make-Commands:

```bash
# Entwicklung
make dev              # Backend + Frontend starten
make test             # Alle Tests ausführen
make test-coverage    # Tests mit Coverage Report
make lint             # Code-Qualität prüfen

# Docker
make docker           # Mit Docker Compose starten
make docker-logs      # Logs anzeigen

# Datenbank
make migrate          # Migrationen ausführen
make db-studio        # Prisma Studio öffnen

# Status & Cleanup
make health           # Service-Status prüfen
make clean            # Build-Artefakte löschen
```

Alle Commands: `make help`

---

## Codex Development Setup – Schneller Start

1. **Node-Version setzen:** `nvm use` liest automatisch die bereitgestellte [.nvmrc](./.nvmrc) und stellt Node.js 20 bereit. Andere Runtimes wie Rust, Go oder Ruby werden nicht geladen.
2. **Automatisches Setup:** Codex führt dank [.codexconfig](./.codexconfig) automatisch [`./scripts/codex/setup.sh`](./scripts/codex/setup.sh) aus. Manuell genügt `make codex-setup`, falls du außerhalb von Codex arbeitest.
3. **Schnelle Abhängigkeiten:** Das Setup cached npm unter `~/.cache/codex/npm`, läuft parallel für Backend/Frontend und nutzt `npm ci`, sobald ein Lockfile existiert. Bereits vorhandene `node_modules` werden übersprungen, sodass der Start unter 10 s bleibt.
4. **Python optional:** Sobald eine `requirements.txt` vorhanden ist, legt das Skript automatisch ein lokales `.venv` an. Aktuell sind keine Python-Abhängigkeiten erforderlich.
5. **Saubere Arbeitsfläche:** [.codexignore](./.codexignore) blendet Build-Artefakte, Caches und VCS-Daten für Codex aus.

Mit `docker compose up -d` (plus der neuen [docker-compose.override.yml](./docker-compose.override.yml)) laufen Backend und Frontend im Hot-Reload-Modus. Alternativ kannst du lokal `make backend-dev` bzw. `make frontend-dev` nutzen.

## Environment Setup

Die Anwendung wird vollständig über Umgebungsvariablen gesteuert. Alle relevanten Variablen findest du in [.env.example](./.env.example). Kopiere sie nach Bedarf in eine lokale `.env` und passe die Werte pro Umgebung an.

### Kernvariablen

| Bereich | Variablen | Beschreibung |
| --- | --- | --- |
| Allgemein | `APP_ENV`, `NODE_ENV` | Steuert dev/prod-spezifisches Verhalten. `APP_ENV=dev` aktiviert großzügige Defaults (z. B. CORS `*`). |
| Backend | `PORT`, `CORS_ORIGIN`, `DATABASE_URL`, `API_KEY`, `OPENAI_API_KEY`, `REALTIME_MODEL`, `RESPONSES_MODEL` | Netzwerk, Sicherheit und AI-Konfiguration für Fastify. Mehrere CORS-Quellen werden per Komma getrennt. |
| Frontend | `VITE_PORT`, `VITE_HOST`, `VITE_ALLOWED_HOSTS`, `VITE_BACKEND_URL`, `VITE_API_KEY` | Steuern Host/Port, Proxy-Ziel und API-Key für das React-Frontend. |
| Compose | `POSTGRES_PORT`, `VITE_*`, `PORT` | Werden direkt an die Container weitergereicht, damit keine festen Ports im Compose-File verbleiben. |
| Proxy (optional) | `NPM_BASE_URL`, `NPM_EMAIL`, `NPM_PASSWORD`, `NPM_TOKEN`, `NPM_CERTIFICATE_ID`, `NPM_LETSENCRYPT_EMAIL`, `NPM_FORCE_SSL` | Zugangsdaten für die optionale Automatisierung des Nginx Proxy Managers. |

### Beispielkonfigurationen

**Lokale Entwicklung (`.env.local`):**

```
APP_ENV=dev
NODE_ENV=development
PORT=4000
VITE_PORT=3000
VITE_HOST=0.0.0.0
VITE_ALLOWED_HOSTS=localhost
VITE_BACKEND_URL=http://localhost:4000
CORS_ORIGIN=http://localhost:3000
API_KEY=local-demo-key
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sales_simulation
```

**Staging (`.env.staging`):**

```
APP_ENV=prod
PORT=4000
VITE_PORT=3000
VITE_ALLOWED_HOSTS=staging.example.com
VITE_BACKEND_URL=https://api.staging.example.com
CORS_ORIGIN=https://staging.example.com
API_KEY=staging-shared-key
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://staging_user:secret@staging-db:5432/sales_simulation
```

**Production (`.env.prod`):**

```
APP_ENV=prod
PORT=443
VITE_PORT=443
VITE_ALLOWED_HOSTS=app.example.com
VITE_BACKEND_URL=https://api.example.com
CORS_ORIGIN=https://app.example.com
API_KEY=prod-shared-key
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://prod_user:secret@prod-db:5432/sales_simulation
```

Starte eine Umgebung, indem du die gewünschte Datei in `.env` kopierst (oder entsprechende Variablen im Deployment setzt) und anschließend `docker compose up -d` ausführst. Die Services lesen alle Werte zur Laufzeit ein – ein Austausch der `.env` genügt.

### Datenbankmigrationen

Für lokale Entwicklungen erzeugst du neue Migrationen mit `npx prisma migrate dev --name <beschreibung>` direkt im Ordner [`backend/`](./backend). In produktiven Setups muss vor jedem Release `npx prisma migrate deploy` ausgeführt werden, damit alle ausstehenden Migrationen gegen die Datenbank laufen. Unser [`docker-compose.yml`](./docker-compose.yml) erledigt diesen Schritt beim Containerstart automatisch; übertrage denselben Befehl in deine CI/CD-Pipeline bzw. das verwendete Deployment-Skript.


## Tests & Qualitätsmetriken

### Backend (Fastify + Prisma)

```bash
cd backend
# führt alle Unit- und Integrationstests aus
npm run test

# interaktiver Watch-Modus während der Entwicklung
npm run test:watch

# Coverage-Report (schlägt fehl, sobald < 80 % erreicht werden)
npm run test:coverage
```

Die Integrationstests starten automatisch eine isolierte PostgreSQL-Instanz per [Testcontainers](https://testcontainers.com/). Stelle sicher, dass Docker innerhalb der CI-Laufumgebung verfügbar ist. Die in `vitest.config.ts` hinterlegten Thresholds erzwingen die 80 %-Coverage-Grenze (`lines`, `functions`, `branches`, `statements`).

### Frontend (React + Vite)

```bash
cd frontend
# React-Komponententests (Vitest + Testing Library)
npm run test

# Coverage-Report inklusive Threshold-Prüfung (80 %)
npm run test:coverage

# End-to-End-Tests (Playwright) – erwartet einen laufenden Dev-Server
npm run test:e2e
```

Setze im CI zwei Schritte auf: `npm run test:coverage` für Backend und Frontend (idealerweise in separaten Jobs) sowie `npm run test:e2e` für Playwright. Die Coverage-Gates schlagen automatisch fehl, wenn die 80 %-Grenze unterschritten wird; zusätzliche `coverage-summary.json` Artefakte stehen für Upload/Analyse bereit.

### Reverse-Proxy-Automatisierung

Mit [`scripts/setup-proxy.sh`](./scripts/setup-proxy.sh) kannst du den Nginx Proxy Manager API-gesteuert konfigurieren:

```
./scripts/setup-proxy.sh sales.cloud-schulz.de https://backend.internal:4000
```

Das Skript liest automatisch `.env`, authentifiziert sich via `NPM_TOKEN` oder `NPM_EMAIL`/`NPM_PASSWORD` und erzeugt bzw. aktualisiert den entsprechenden Proxy Host. Über Variablen wie `NPM_CERTIFICATE_ID` und `NPM_FORCE_SSL` kannst du SSL-Erzwingung oder bestehende Zertifikate steuern.

## CI/CD & Container Registry

### Warum Docker Images?

Das Projekt baut automatisch Docker Images für Backend und Frontend bei jedem Push auf `main`. Diese Images werden im GitHub Container Registry (GHCR) gespeichert und ermöglichen:

1. **Reproduzierbare Deployments**: Jedes Image ist mit einem Git-SHA getaggt und enthält exakt den gleichen Code
2. **Schnelle Rollbacks**: Bei Problemen kann sofort auf ein älteres Image zurückgegriffen werden
3. **Einfaches Deployment**: Pull & Run auf jedem Server mit Docker
4. **Versionierung**: Images sind unter `ghcr.io/marcantonioschulz/web-app-agents-sdk-backend:main` und `ghcr.io/marcantonioschulz/web-app-agents-sdk-frontend:main` verfügbar

### CI/CD Pipeline

Die GitHub Actions Workflow führt bei jedem Push/PR folgende Schritte aus:

```
┌─────────┐    ┌───────┐    ┌──────┐    ┌────────────┐    ┌────────┐
│  Lint   │───▶│ Build │───▶│ Test │───▶│   Docker   │───▶│ Deploy │
│ ESLint  │    │  TS   │    │Vitest│    │Build+Push  │    │  SSH   │
└─────────┘    └───────┘    └──────┘    └────────────┘    └────────┘
```

**Jobs:**
- **Lint**: Code-Qualität mit ESLint
- **Build**: TypeScript Kompilierung für Backend & Frontend
- **Test**: Unit & Integration Tests (80% Coverage-Threshold)
- **Docker**: Baut & pusht Images zu GHCR (nur auf `main`)
- **Deploy**: SSH-basiertes Deployment auf Server (optional, wenn Secrets konfiguriert)

### Deployment verwenden

```bash
# Images pullen
docker pull ghcr.io/marcantonioschulz/web-app-agents-sdk-backend:main
docker pull ghcr.io/marcantonioschulz/web-app-agents-sdk-frontend:main

# Mit docker-compose
docker compose pull
docker compose up -d
```

## Monitoring & Observability

Die Datei [`docker-compose.yml`](./docker-compose.yml) enthält jetzt optional aktivierbare Services für Prometheus, Alertmanager, Grafana und node-exporter. Alle Konfigurationsdateien sowie vorprovisionierte Dashboards liegen im Ordner [`monitoring/`](./monitoring). Eine ausführliche Anleitung inklusive Alert-Routing nach Slack/Discord findest du in [`docs/monitoring.md`](./docs/monitoring.md).

## Versioning

Dieses Projekt nutzt [Semantic Versioning](https://semver.org/):
- **MAJOR** (X.0.0): Breaking Changes, inkompatible API-Änderungen
- **MINOR** (0.X.0): Neue Features, rückwärtskompatibel
- **PATCH** (0.0.X): Bugfixes, rückwärtskompatibel

### Aktuelle Version: v1.0.0

Siehe [CHANGELOG.md](CHANGELOG.md) für alle Änderungen und Release-Notes.

### Version Updates (für Maintainer)

```bash
# Patch Release (1.0.0 → 1.0.1) - Bugfixes
npm run version:patch

# Minor Release (1.0.0 → 1.1.0) - Neue Features
npm run version:minor

# Major Release (1.0.0 → 2.0.0) - Breaking Changes
npm run version:major
```

Diese Befehle aktualisieren automatisch alle package.json Dateien und erstellen einen Git-Tag.

## Contributing

Wir freuen uns über Beiträge zur Verbesserung des Projekts! Bevor du startest:

1. **Lies die [Contributing Guidelines](CONTRIBUTING.md)** für detaillierte Informationen zum Entwicklungsprozess
2. **Beachte den [Code of Conduct](CODE_OF_CONDUCT.md)** - wir pflegen eine freundliche und inklusive Community
3. **Prüfe [offene Issues](https://github.com/marcantonioschulz/Web-App-Agents-SDK/issues)** oder erstelle ein neues Issue für deine Idee
4. **Sicherheitslücken?** Bitte folge unserer [Security Policy](SECURITY.md)

### Schnellstart für Contributors

```bash
# Repository forken und klonen
git clone https://github.com/YOUR_USERNAME/Web-App-Agents-SDK.git
cd Web-App-Agents-SDK

# Dependencies installieren
make codex-setup

# Branch erstellen
git checkout -b feature/deine-feature-name

# Entwicklungsumgebung starten
docker compose up -d

# Tests ausführen
cd backend && npm test
cd frontend && npm test
```

Weitere Details findest du in [CONTRIBUTING.md](CONTRIBUTING.md).

## License & Commercial Use

### 📜 Proprietary License

**Dieser Code ist urheberrechtlich geschützt und steht unter einer proprietären Lizenz.**

#### Erlaubte Nutzung (kostenlos):
- ✅ Ansehen und Studieren des Quellcodes
- ✅ Beiträge via Pull Requests
- ✅ Lokales Testen und Entwicklung
- ✅ Bildungszwecke und Lernen

#### Nicht erlaubt ohne kommerzielle Lizenz:
- ❌ Kommerzielle Nutzung
- ❌ Weiterverkauf oder Distribution
- ❌ Hosting als Service für Dritte
- ❌ Kommerzielle Derivate

### 💼 Kommerzielle Lizenz erforderlich?

Wenn du diese Software verwenden möchtest für:
- Kommerzielle Projekte
- Software-as-a-Service (SaaS)
- Geschäftsanwendungen
- Kundenimplementierungen

**Kontaktiere mich für eine kommerzielle Lizenz:**
- 📧 Email: mas@endlichzuhause.com
- 🌐 Website: [endlichzuhause.com](https://endlichzuhause.com)
- 💬 GitHub: [@marcantonioschulz](https://github.com/marcantonioschulz)

### 🤝 Beiträge

Community-Beiträge sind willkommen! Durch deine Beiträge:
- Behältst du das Copyright deiner Arbeit
- Gewährst du mir das Recht, deinen Beitrag auch kommerziell zu nutzen
- Hilfst du, das Projekt für alle zu verbessern

Siehe [LICENSE](LICENSE) für vollständige Details.

## Support & Community

- 💬 **Diskussionen**: [GitHub Discussions](https://github.com/marcantonioschulz/Web-App-Agents-SDK/discussions)
- 🐛 **Bug Reports**: [Issue Tracker](https://github.com/marcantonioschulz/Web-App-Agents-SDK/issues)
- 📖 **Dokumentation**: [GitHub Wiki](https://github.com/marcantonioschulz/Web-App-Agents-SDK/wiki)
- 🔒 **Security**: [Security Policy](SECURITY.md)

## Acknowledgments

Entwickelt mit ❤️ von [Marc Antonio Schulz](https://github.com/marcantonioschulz)

Powered by:
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)
- [Fastify](https://www.fastify.io/)
- [React](https://react.dev/)
- [Prisma](https://www.prisma.io/)
