# Web App Agents SDK

Dieses Repository enthält die Referenzimplementierung für das Sales Simulation Projekt (Frontend, Backend und begleitende Tools).

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

### Reverse-Proxy-Automatisierung

Mit [`scripts/setup-proxy.sh`](./scripts/setup-proxy.sh) kannst du den Nginx Proxy Manager API-gesteuert konfigurieren:

```
./scripts/setup-proxy.sh sales.cloud-schulz.de https://backend.internal:4000
```

Das Skript liest automatisch `.env`, authentifiziert sich via `NPM_TOKEN` oder `NPM_EMAIL`/`NPM_PASSWORD` und erzeugt bzw. aktualisiert den entsprechenden Proxy Host. Über Variablen wie `NPM_CERTIFICATE_ID` und `NPM_FORCE_SSL` kannst du SSL-Erzwingung oder bestehende Zertifikate steuern.