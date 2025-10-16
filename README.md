# Web App Agents SDK

Dieses Repository enthält die Referenzimplementierung für das Sales Simulation Projekt (Frontend, Backend und begleitende Tools).

## Codex Development Setup – Schneller Start

1. **Node-Version setzen:** `nvm use` liest automatisch die bereitgestellte [.nvmrc](./.nvmrc) und stellt Node.js 20 bereit. Andere Runtimes wie Rust, Go oder Ruby werden nicht geladen.
2. **Automatisches Setup:** Codex führt dank [.codexconfig](./.codexconfig) automatisch [`./scripts/codex/setup.sh`](./scripts/codex/setup.sh) aus. Manuell genügt `make codex-setup`, falls du außerhalb von Codex arbeitest.
3. **Schnelle Abhängigkeiten:** Das Setup cached npm unter `~/.cache/codex/npm`, läuft parallel für Backend/Frontend und nutzt `npm ci`, sobald ein Lockfile existiert. Bereits vorhandene `node_modules` werden übersprungen, sodass der Start unter 10 s bleibt.
4. **Python optional:** Sobald eine `requirements.txt` vorhanden ist, legt das Skript automatisch ein lokales `.venv` an. Aktuell sind keine Python-Abhängigkeiten erforderlich.
5. **Saubere Arbeitsfläche:** [.codexignore](./.codexignore) blendet Build-Artefakte, Caches und VCS-Daten für Codex aus.

Mit `docker compose up -d` (plus der neuen [docker-compose.override.yml](./docker-compose.override.yml)) laufen Backend und Frontend im Hot-Reload-Modus. Alternativ kannst du lokal `make backend-dev` bzw. `make frontend-dev` nutzen.
