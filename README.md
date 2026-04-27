# Excalidraw FULL

A self-hosted visual workspace for drawing, planning, mapping, charting, and lightweight project management built around a fast collaborative canvas.

## What It Is

Excalidraw FULL is a production-grade visual workspace platform. It is no longer a simple drawing wrapper — it is a full product with backend-owned persistence, team collaboration, permissions, and structured file management.

- **Visual canvas first** — freeform drawing remains central
- **Backend-owned persistence only** — no browser/local save modes
- **Team collaboration native** — real-time editing with presence
- **File/folder/project management built in** — hierarchical organization via `/folder/:folderId/drawing/:drawingId`
- **Secure sharing and permissioning** — explicit grants with inheritance
- **Activity history and auditability** — every action is tracked
- **Templates and structured productivity** — system + team + personal templates
- **Rich linking between canvases** — embeds, references, knowledge graph
- **AI chat integration** — OpenAI proxy for diagram generation assistance
- **Command palette** — global `Cmd/Ctrl+K` for power users
- **Fulltext search** — find drawings from anywhere
- **Revision browser** — time-travel through drawing history with one-click restore
- **Dark mode** — persistent theme preference across sessions
- **Presenter notes** — add notes to any drawing for presentations
- **Responsive layout** — mobile sidebar toggle, adaptive grids
- **Accessibility** — ARIA labels, roles, keyboard navigation
- **Self-hosting** — single Docker image, healthchecks, volume mounts

## Quick Start

```bash
git clone https://github.com/BetterAndBetterII/excalidraw-full.git
cd excalidraw-full
cp .env.example .env
# Edit .env and set JWT_SECRET (required)
# openssl rand -base64 32
make build     # Build frontend + Go binary
make test      # Run all tests
make docker-up # Or run via Docker Compose
```

The application will be available at `http://localhost:3002`.

## Requirements

- Go 1.26.2+
- Node.js 20+ (for frontend build)
- Make (optional, for convenience commands)
- Docker (optional, for containerized deployment)

## Configuration

All configuration is via environment variables. See `.env.example` for the full reference.

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Secure random string for session signing (min 32 chars) |
| `STORAGE_TYPE` | No | `postgres` (default), `memory`, `filesystem`, `s3` |
| `DATABASE_URL` | Yes for Postgres | PostgreSQL connection string |
| `GITHUB_CLIENT_ID` | No* | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | No* | GitHub OAuth app client secret |
| `OIDC_ISSUER_URL` | No* | Generic OIDC issuer for SSO |
| `OIDC_CLIENT_ID` | No* | OIDC client ID |
| `OIDC_CLIENT_SECRET` | No* | OIDC client secret |
| `OPENAI_API_KEY` | No | Enables AI chat/completion proxy |
| `OPENAI_BASE_URL` | No | OpenAI-compatible API base URL |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |
| `LISTEN_ADDR` | No | Server bind address (default `:3002`) |

\* At least one external auth provider (GitHub OAuth or OIDC) OR use built-in password authentication. Password auth works out of the box.

## Architecture

- **Backend**: Go 1.26.2, Chi router, PostgreSQL (pgx)
- **Frontend**: React 18, Vite, TypeScript, Zustand, react-router-dom, react-i18next
- **Real-time**: Socket.IO for collaborative canvas sync
- **Auth**: Session cookies (httpOnly, SameSite=Lax) + bcrypt password hashing + OAuth/OIDC
- **Storage**: PostgreSQL default, with legacy filesystem/S3 options for canvas storage
- **API spec**: OpenAPI 3.0 in `api/openapi.yaml`; TypeScript client via `make generate-api-client`

## API

The workspace API is mounted at `/api` and requires session authentication. Key endpoints:

- `POST /api/auth/signup` / `POST /api/auth/login` / `POST /api/auth/logout`
- `GET /api/auth/me` — current user
- `GET /api/teams`, `POST /api/teams`, `GET /api/teams/:id/members`
- `GET /api/drawings`, `POST /api/drawings`, `GET /api/drawings/:id`
- `PATCH /api/drawings/:id`, `DELETE /api/drawings/:id`
- `GET /api/drawings/:id/revisions`, `POST /api/drawings/:id/revisions`
- `GET /api/drawings/:id/permissions`, `POST /api/drawings/:id/permissions`
- `GET /api/drawings/:id/share-links`, `POST /api/drawings/:id/share-links`
- `GET /api/search?q=` — fulltext search
- `GET /api/folders`, `POST /api/folders`
- `GET /api/projects`, `POST /api/projects`
- `GET /api/templates` — system, team, and personal templates
- `GET /api/activity` — audit trail with actor hydration
- `GET /api/stats` — workspace statistics (counts + storage)
- `GET /api/health` — readiness probe

## Development

```bash
# Terminal 1: Go backend with auto-reload (requires air)
make dev-backend

# Terminal 2: Vite dev server
make dev-frontend

# Or run both manually:
go run main.go                  # backend on :3002
cd frontend && npm run dev      # frontend on :5173
```

## Building

```bash
make build              # Full production build (frontend + Go binary)
make build-frontend     # React build only
make build-backend      # Go binary only
make build-docker       # Docker image locally
make test               # Run Go + frontend tests
make test-backend       # Go unit tests
make test-frontend      # Vitest unit tests
make test-e2e           # Playwright E2E tests
make lint               # Run all linters
make fmt                # Format all code
make generate-api-client # TS client from openapi.yaml
make clean              # Remove build artifacts
make docker-up          # Docker Compose local run
make docker-down        # Stop Docker Compose
make docker-logs        # Tail Docker logs
make help               # Show all targets
```

## Project Structure

```
.
├── main.go                     # Go server entrypoint
├── workspace/                  # Core domain: models, store, HTTP handlers, tests
│   ├── models.go
│   ├── store.go                # PostgreSQL persistence + migrations
│   ├── store_sharing.go        # Permissions, share links, embeds
│   ├── http.go                 # API route handlers
│   ├── http_extra.go           # Search, stats, activity
│   ├── stats.go                # Workspace statistics
│   ├── rate_limiter.go         # Auth endpoint rate limiting
│   └── *_test.go               # Go unit tests
├── middleware/                 # Auth, security headers
├── handlers/                   # Legacy firebase, kv, openai, auth
├── frontend/                   # React + Vite frontend
│   ├── src/
│   │   ├── pages/              # Dashboard, Editor, Auth, Settings, etc.
│   │   ├── components/         # Reusable UI (Button, Card, CommandPalette, etc.)
│   │   ├── stores/             # Zustand state management
│   │   ├── services/           # API client + OpenAI proxy
│   │   ├── i18n/               # Translation files (en.json)
│   │   └── styles/             # Global SCSS + CSS variables
│   └── package.json
├── api/
│   └── openapi.yaml            # Full OpenAPI 3.0 spec
├── excalidraw-full.Dockerfile  # Multi-stage production build
├── docker-compose.yml          # Local Docker Compose
├── Makefile                    # Build, test, dev automation
└── .env.example                # Environment reference
```

## Security

- bcrypt(cost=12) password hashing
- httpOnly, SameSite=Lax session cookies
- CSRF-like same-origin mutation checks on state-changing requests
- URL sanitization for embeds (blocks file://, javascript:, private IPs)
- Content-Security-Policy headers with strict defaults
- Rate limiting on auth endpoints (10 req / 15 min per IP)
- Permission matrix with explicit grants + inheritance
- All mutations require authenticated session

## Internationalization

Frontend uses `react-i18next` with `i18next-browser-languagedetector`. All UI strings are externalized to `frontend/src/i18n/locales/en.json`. Add new keys there and reference via `t('key')`.

## Roadmap

See `plus-roadmap.md` for upcoming features. Shipped highlights:

- Archive (trash) instead of delete
- Activity feed with full audit trail
- Command palette for whole app (`Cmd/Ctrl+K`)
- Fulltext search
- Versioning with revision browser
- Public API (OpenAPI + TS client generation)
- Self-hosting via Docker
- Presenter notes
- Scene filtering and sorting
- Template gallery with apply flow
- Dark mode sync with canvas
- Mobile-responsive navigation

## License

MIT
