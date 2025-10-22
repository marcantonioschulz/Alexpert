.PHONY: help install dev test test-watch test-coverage lint build docker clean migrate health

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m # No Color

##@ General

help: ## Display this help message
	@awk 'BEGIN {FS = ":.*##"; printf "\n$(BLUE)Usage:$(NC)\n  make $(GREEN)<target>$(NC)\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(BLUE)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Setup

install: ## Run initial setup (installs deps, generates credentials, runs migrations)
	@echo "$(BLUE)Running setup...$(NC)"
	@bash scripts/setup.sh

##@ Development

dev: ## Start development servers (backend + frontend)
	@echo "$(GREEN)Starting development servers...$(NC)"
	@trap 'kill 0' INT; \
	(cd backend && npm run dev) & \
	(cd frontend && npm run dev) & \
	wait

dev-backend: ## Start only backend development server
	@echo "$(GREEN)Starting backend...$(NC)"
	@cd backend && npm run dev

dev-frontend: ## Start only frontend development server
	@echo "$(GREEN)Starting frontend...$(NC)"
	@cd frontend && npm run dev

##@ Testing

test: ## Run all tests
	@echo "$(GREEN)Running tests...$(NC)"
	@cd backend && npm test
	@cd frontend && npm test

test-watch: ## Run tests in watch mode
	@echo "$(GREEN)Running tests in watch mode...$(NC)"
	@cd backend && npm run test:watch

test-coverage: ## Run tests with coverage report
	@echo "$(GREEN)Running tests with coverage...$(NC)"
	@cd backend && npm run test:coverage
	@echo "$(YELLOW)Coverage report: backend/coverage/index.html$(NC)"

test-ui: ## Open Vitest UI
	@cd backend && npm run test:ui

##@ Quality

lint: ## Run ESLint on all files
	@echo "$(GREEN)Running ESLint...$(NC)"
	@npm run lint

lint-fix: ## Run ESLint and auto-fix issues
	@echo "$(GREEN)Running ESLint with auto-fix...$(NC)"
	@npm run lint -- --fix

format: ## Format code with Prettier
	@echo "$(GREEN)Formatting code...$(NC)"
	@npx prettier --write "**/*.{ts,tsx,js,jsx,json,md}"

##@ Build

build: ## Build backend and frontend for production
	@echo "$(GREEN)Building projects...$(NC)"
	@cd backend && npm run build
	@cd frontend && npm run build
	@echo "$(GREEN)✓ Build complete$(NC)"

##@ Docker

docker: ## Start all services with Docker Compose
	@echo "$(GREEN)Starting Docker Compose...$(NC)"
	@docker compose up -d
	@echo "$(GREEN)✓ Services started$(NC)"
	@make health

docker-build: ## Build Docker images
	@echo "$(GREEN)Building Docker images...$(NC)"
	@docker compose build

docker-logs: ## Show Docker Compose logs
	@docker compose logs -f

docker-stop: ## Stop Docker Compose services
	@echo "$(YELLOW)Stopping services...$(NC)"
	@docker compose down

docker-clean: ## Stop services and remove volumes
	@echo "$(YELLOW)Cleaning up Docker...$(NC)"
	@docker compose down -v
	@docker system prune -f

##@ Database

migrate: ## Run database migrations
	@echo "$(GREEN)Running migrations...$(NC)"
	@cd backend && npm run prisma:migrate

migrate-create: ## Create a new migration
	@read -p "Migration name: " name; \
	cd backend && npx prisma migrate dev --name "$$name"

db-studio: ## Open Prisma Studio
	@cd backend && npx prisma studio

db-seed: ## Seed the database (if seed script exists)
	@cd backend && npx prisma db seed

db-reset: ## Reset database (WARNING: deletes all data)
	@echo "$(YELLOW)⚠️  This will delete all database data!$(NC)"
	@read -p "Are you sure? (yes/no): " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		cd backend && npx prisma migrate reset --force; \
	else \
		echo "Cancelled"; \
	fi

##@ Health & Status

health: ## Check health of all services
	@echo "$(BLUE)Checking service health...$(NC)"
	@echo -n "Backend:  "
	@curl -sf http://localhost:4000/health >/dev/null && echo "$(GREEN)✓ Healthy$(NC)" || echo "$(YELLOW)✗ Not responding$(NC)"
	@echo -n "Frontend: "
	@curl -sf http://localhost:3000 >/dev/null && echo "$(GREEN)✓ Healthy$(NC)" || echo "$(YELLOW)✗ Not responding$(NC)"
	@echo -n "Database: "
	@docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1 && echo "$(GREEN)✓ Healthy$(NC)" || echo "$(YELLOW)✗ Not responding$(NC)"

ps: ## Show running processes
	@docker compose ps

##@ Cleanup

clean: ## Clean build artifacts and caches
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	@rm -rf backend/dist frontend/dist
	@rm -rf backend/coverage frontend/coverage
	@rm -rf backend/test-results frontend/test-results
	@rm -rf **/*.tsbuildinfo
	@echo "$(GREEN)✓ Cleaned$(NC)"

clean-all: clean ## Clean everything including node_modules
	@echo "$(YELLOW)Cleaning node_modules...$(NC)"
	@rm -rf node_modules backend/node_modules frontend/node_modules
	@echo "$(GREEN)✓ All clean$(NC)"

##@ Git & Release

commit: ## Interactive commit with conventional commits
	@npx git-cz

release-patch: ## Create patch release (1.0.x)
	@npm version patch -m "chore(release): %s"
	@git push --follow-tags

release-minor: ## Create minor release (1.x.0)
	@npm version minor -m "chore(release): %s"
	@git push --follow-tags

release-major: ## Create major release (x.0.0)
	@npm version major -m "chore(release): %s"
	@git push --follow-tags

##@ Utilities

check-env: ## Validate .env file
	@echo "$(BLUE)Checking environment configuration...$(NC)"
	@if [ ! -f .env ]; then \
		echo "$(YELLOW)✗ .env file not found$(NC)"; \
		echo "Run: make install"; \
		exit 1; \
	fi
	@if ! grep -q "OPENAI_API_KEY=sk-" .env; then \
		echo "$(YELLOW)⚠️  OPENAI_API_KEY not set or invalid$(NC)"; \
	else \
		echo "$(GREEN)✓ Environment configured$(NC)"; \
	fi

logs: ## Show application logs
	@docker compose logs -f backend frontend

open: ## Open application in browser
	@echo "$(GREEN)Opening application...$(NC)"
	@open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null || echo "Please open http://localhost:3000"

ci: lint test build ## Run CI pipeline locally
	@echo "$(GREEN)✓ CI pipeline complete$(NC)"
