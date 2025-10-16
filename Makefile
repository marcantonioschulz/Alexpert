SHELL := /bin/bash
PROJECT_ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
DOCKER_COMPOSE := docker compose

.PHONY: codex-setup install compose-up compose-down compose-logs backend-logs frontend-logs db-logs backend-dev frontend-dev prisma-generate prisma-migrate prisma-studio

codex-setup:
	./scripts/codex/setup.sh

install: codex-setup

compose-up:
	$(DOCKER_COMPOSE) up -d db backend frontend

compose-down:
	$(DOCKER_COMPOSE) down

compose-logs:
	$(DOCKER_COMPOSE) logs -f

backend-logs:
	$(DOCKER_COMPOSE) logs -f backend

frontend-logs:
	$(DOCKER_COMPOSE) logs -f frontend

db-logs:
	$(DOCKER_COMPOSE) logs -f db

backend-dev:
	cd backend && npm run dev

frontend-dev:
	cd frontend && npm run dev

prisma-generate:
	cd backend && npx prisma generate

prisma-migrate:
	$(DOCKER_COMPOSE) exec backend npx prisma migrate deploy

prisma-studio:
	$(DOCKER_COMPOSE) exec backend npx prisma studio
