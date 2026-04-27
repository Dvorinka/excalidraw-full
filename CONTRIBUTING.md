# Contributing to Excalidraw FULL

## Development Setup

### Prerequisites

- Go 1.26.2+
- Node.js 20+
- npm or pnpm
- Docker (optional, for containerized builds)

### Quick Start

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd excalidraw-full

# 2. Copy environment file
cp .env.example .env
# Edit .env and set JWT_SECRET (required)

# 3. Install frontend dependencies and start dev servers
cd frontend && npm ci

# Terminal 1 — Go backend
go run .

# Terminal 2 — Vite frontend
cd frontend && npm run dev

# Or use Docker for a one-command setup:
make docker-up
```

### Build & Test

```bash
# Build everything (frontend + Go binary)
make build

# Run all tests
make test

# Docker build
make docker-up
```

## Project Structure

```
.
├── main.go                 # Go server entrypoint
├── workspace/              # Core domain: models, store, HTTP handlers, tests
│   ├── models.go
│   ├── store.go
│   ├── http.go
│   └── *_test.go
├── middleware/             # Auth, security headers, rate limiting
├── frontend/               # React + Vite frontend
│   ├── src/
│   │   ├── pages/          # Dashboard, Editor, Auth, Settings, etc.
│   │   ├── components/     # Reusable UI (Button, Card, Input, etc.)
│   │   ├── stores/         # Zustand state management
│   │   ├── services/       # API client
│   │   ├── i18n/           # Translation files
│   │   └── styles/         # Global SCSS + CSS variables
│   └── package.json
├── excalidraw-full.Dockerfile  # Multi-stage production build
├── docker-compose.yml
└── Makefile
```

## Adding a New API Endpoint

1. Define the request/response structs in `workspace/models.go`.
2. Add the store method in `workspace/store.go`.
3. Add the HTTP handler in `workspace/http.go`.
4. Wire the route in `main.go` under the `/api` router.
5. Add tests in `workspace/http_test.go`.

## Frontend Conventions

- **Styling**: SCSS modules + CSS custom properties (`variables.scss`).
- **State**: Zustand with `persist` middleware for cross-session state.
- **Icons**: Lucide React.
- **i18n**: All user-facing strings must use `react-i18next` (`t('key')`). Add new keys to `frontend/src/i18n/locales/en.json`.

## Testing

- **Backend**: `go test ./...` (all tests run against an in-memory SQLite database).
- **Frontend**: `cd frontend && npm test` runs Vitest. Playwright E2E tests can be added with `npm init playwright@latest`.

## Code Style

- Go: `gofmt` + standard library first.
- TypeScript: Strict mode enabled. Prefer explicit types over `any`.

## Security

- Never hardcode secrets. Use environment variables.
- Auth changes must not weaken the permission matrix (see `workspace/permissions_test.go`).
- CORS origins must be explicit — wildcard (`*`) with credentials is forbidden.

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add fulltext search endpoints
fix: correct CORS origin wildcard on Socket.IO
docs: update README with Docker instructions
```
