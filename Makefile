# ===================================================================
# Excalidraw FULL - Build, Test & Dev Automation
# ===================================================================

.PHONY: all install dev build test clean docker-up docker-down docker-clean docker-up-postgres docker-down-postgres lint fmt generate-api-client help

# -------------------------------------------------------------------
# Defaults
# -------------------------------------------------------------------
FRONTEND_DIR := frontend
BACKEND_DIR  := .

# -------------------------------------------------------------------
# Dev
# -------------------------------------------------------------------
dev: ## Run frontend Vite dev server + Go backend (requires tmux or two terminals)
	@echo "Start backend: make dev-backend"
	@echo "Start frontend: make dev-frontend"

install: ## Install frontend dependencies
	cd $(FRONTEND_DIR) && npm ci

dev-backend: ## Run Go backend with auto-reload (requires air)
	air -c .air.toml

dev-frontend: ## Run Vite dev server
	cd $(FRONTEND_DIR) && npm run dev

# -------------------------------------------------------------------
# Build
# -------------------------------------------------------------------
build: build-frontend build-backend ## Full production build (frontend + backend)

build-frontend: ## Build React frontend into frontend/dist
	cd $(FRONTEND_DIR) && npm ci && npm run build

build-backend: ## Build Go binary with embedded frontend/dist
	cd $(BACKEND_DIR) && go build -ldflags="-s -w" -o excalidraw-full .

build-docker: ## Build Docker image locally
	docker build -f excalidraw-full.Dockerfile -t excalidraw-full:latest .

# -------------------------------------------------------------------
# Test
# -------------------------------------------------------------------
test: test-backend test-frontend ## Run all tests

test-backend: ## Run Go unit tests
	cd $(BACKEND_DIR) && go test ./... -v -count=1

test-frontend: ## Run frontend tests (Vitest)
	cd $(FRONTEND_DIR) && npm test -- --run

test-e2e: ## Run Playwright E2E tests (requires install first)
	cd $(FRONTEND_DIR) && npx playwright test

# -------------------------------------------------------------------
# Lint / Format
# -------------------------------------------------------------------
lint: lint-backend lint-frontend ## Run all linters

lint-backend: ## Run go vet + staticcheck
	cd $(BACKEND_DIR) && go vet ./...
	cd $(BACKEND_DIR) && staticcheck ./...

lint-frontend: ## Run ESLint
	cd $(FRONTEND_DIR) && npm run lint

fmt: fmt-backend fmt-frontend ## Format all code

fmt-backend: ## Run gofmt
	cd $(BACKEND_DIR) && gofmt -w .

fmt-frontend: ## Run prettier
	cd $(FRONTEND_DIR) && npx prettier --write "src/**/*.{ts,tsx,scss,css}"

# -------------------------------------------------------------------
# Docker
# -------------------------------------------------------------------
docker-up: ## Start with Docker Compose (builds local image)
	docker compose -f docker-compose.yml up --build -d

docker-down: ## Stop Docker Compose
	docker compose -f docker-compose.yml down

docker-up-postgres: ## Start with PostgreSQL Docker Compose (compat target)
	docker compose -f docker-compose.postgres.yml up --build -d

docker-down-postgres: ## Stop PostgreSQL Docker Compose (compat target)
	docker compose -f docker-compose.postgres.yml down

docker-clean: ## Stop and remove Docker volumes/images
	docker compose -f docker-compose.yml down -v --rmi local
	docker system prune -f

docker-logs: ## Tail Docker logs
	docker compose -f docker-compose.yml logs -f

docker-build-push: ## Build and tag for registry (set IMAGE_TAG)
	docker build -f excalidraw-full.Dockerfile -t $(IMAGE_TAG) .

# -------------------------------------------------------------------
# Database
# -------------------------------------------------------------------
db-migrate: ## Run database migrations (placeholder)
	@echo "Migrations: embedded goose migrations run automatically on boot."

db-seed: ## Seed system templates (placeholder)
	@echo "Seeding: system templates seed automatically on boot."

# -------------------------------------------------------------------
# Clean
# -------------------------------------------------------------------
clean: ## Remove build artifacts and cached test data
	cd $(FRONTEND_DIR) && rm -rf dist node_modules/.vite
	cd $(BACKEND_DIR) && rm -f excalidraw-full excalidraw-complete *.db *.db-journal
	cd $(BACKEND_DIR) && go clean -cache

# -------------------------------------------------------------------
# API / Client
# -------------------------------------------------------------------
generate-api-client: ## Generate TypeScript API client from openapi.yaml
	npx --yes openapi-typescript@latest openapi.yaml -o $(FRONTEND_DIR)/src/services/api-client.ts

# -------------------------------------------------------------------
# Help
# -------------------------------------------------------------------
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

IMAGE_TAG ?= excalidraw-full:latest
