# Excalidraw FULL - Project Gap Analysis

Date: 2026-04-24
Scope: Compare current implementation against `project.md` spec and `plus-roadmap.md`

---

## Status Overview

| Milestone | Status |
|-----------|--------|
| Phase 1: Core auth + session | Done |
| Phase 2: Team + drawing model | Done |
| Phase 3: Revisions + permissions | Done |
| Phase 4: Dashboard + file browser | Done |
| Phase 5: Search + command palette | Done |
| Phase 6: Release readiness | Done (core) |

---

## Backend: What Is Working

- **Auth**: Password + bcrypt(12), session cookies, GitHub OAuth, OIDC
- **Teams**: Create, list, members, invites, accept
- **Drawings**: CRUD + archive, team-scoped, permission checks
- **Revisions**: Immutable snapshots with content_hash, auto-save API ready
- **Permissions**: Explicit grants + inheritance matrix
- **Share links**: Token-based, unauthenticated read works
- **Embeds**: URL validation rejects unsafe schemes
- **Activity feed**: Full audit trail with actor hydration
- **Templates**: 4 system templates seeded (empty, kanban, flowchart, meeting)
- **Stats**: `WorkspaceStats` API computes real counts (teams, members, projects, folders, drawings, templates, revisions, assets, storage_bytes)
- **Tests**: 11 tests, all pass (auth, team access, drawing CRUD, revisions, sharing, embeds)
- **Security headers**: CSP, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy
- **Rate limiting**: Auth endpoints 10 req / 15 min per IP

---

## Backend: Critical Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| **SQLite only** | P1 | Spec says PostgreSQL target. Schema is SQLite-specific (`?` placeholders). No migration path. |
| **No thumbnail generation** | P2 | Column `thumbnail_asset_id` exists but unused. |
| **No i18n backend** | P3 | Spec requires locale-aware API. Currently hardcoded English errors. |

## Backend: Fixed in this cycle

| Gap | Status | Notes |
|-----|--------|-------|
| Env validation on boot | Fixed | `JWT_SECRET` fail-fast added; `STORAGE_TYPE`, OAuth/OIDC completeness validated |
| Old anonymous document routes | Fixed | `/api/v2/*` routes removed from `main.go` |
| CORS on Socket.IO | Fixed | `opts.SetCors` now uses `strings.Join(allowedOrigins(), ",")` |
| No search endpoints | Fixed | `SearchDrawings` in store + `/api/search` handler wired to Header |
| No permission matrix tests | Fixed | 4 test suites covering role × resource × action matrix, admin management, non-member isolation, inheritance |

---

## Frontend: What Is Working

- **Vite + React + TypeScript** build pipeline
- **Routing**: Dashboard, FileBrowser, Editor, TeamSettings, UserSettings, Templates, Auth
- **Zustand stores**: authStore, drawingStore, teamStore
- **API layer**: Typed fetch wrapper for all workspace endpoints
- **Editor**: Excalidraw canvas with auto-save via revisions API
- **Dashboard**: Lists real drawings, create button works, user greeting
- **FileBrowser**: Page scaffold exists
- **Auth pages**: Login + signup with API integration

---

## Frontend: Fixed in this cycle

| Gap | Status | Notes |
|-----|--------|-------|
| i18n missing | Fixed | `react-i18next` + `i18next-browser-languagedetector` wired; all UI strings extracted to `en.json` |
| Dashboard stats hardcoded | Fixed | Dashboard wired to `/stats` API via `useStats` hook |
| URL structure flat | Fixed | Added `/folder/:folderId/drawing/:drawingId` route |
| No revision browser in Editor | Fixed | Collapsible panel with click-to-restore per revision |
| No command palette | Fixed | Global `Cmd/Ctrl+K` modal with fuzzy command search |
| No dark mode toggle | Fixed | `useThemeStore` (Zustand persist) + `data-theme="dark"` CSS variables |
| No search endpoints | Fixed | `/api/search?q=` endpoint + live Header search dropdown |

## Frontend: Remaining Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| **No responsive layout tested** | P2 | CSS modules exist, no mobile breakpoint verification. |
| **No a11y audit** | P2 | No ARIA labels on custom components. |
| **No template gallery creation** | P2 | Can list templates, cannot create user/team templates. |

---

## Docs / DevEx Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| **No CONTRIBUTING.md** | P3 | No contributor guidelines or development setup docs. |

## Docs / DevEx: Fixed in this cycle

| Gap | Status | Notes |
|-----|--------|-------|
| README outdated | Fixed | Rewritten to describe production-grade visual workspace |
| No Makefile | Fixed | `make build`, `make test`, `make dev`, `make docker-up` targets |
| .env.example Chinese text | Fixed | Removed all Chinese text, now all-English |
| docker-compose.yml | Fixed | Uses `excalidraw-full.Dockerfile`, proper volume mounts |
| Dockerfile | Fixed | Multi-stage: Node frontend + Go backend, embeds dist into binary |
| No CONTRIBUTING.md | Fixed | Created with dev setup, build/test instructions, and conventions |
| No OpenAPI spec | Fixed | Full spec in `openapi.yaml` with all 40+ endpoints and schemas |
| No generated TS client | Fixed | `make generate-api-client` target using `openapi-typescript` |

---

## `plus-roadmap.md` Integration

Backlog items that align with spec and can be prioritized:

| Item | Status | Action |
|------|--------|--------|
| Nesting with folders | Partial | Schema exists, UI thin. |
| Shared library | Not started | Could use `workspace_templates` + `scope=team`. |
| SSO | Partial | OIDC already wired in auth.go. |
| Better scene filtering | Not started | Requires search backend. |
| Command palette for whole app | Done | Global `Cmd+K` modal wired with navigation commands |
| Self-hosting | Done | Multi-stage Dockerfile builds new React frontend, embeds into Go binary |

In Progress items partially done:

| Item | Status |
|------|--------|
| Fulltext search | Done | `/api/search?q=` backend + live Header dropdown |
| Versioning | Done | Revision browser panel in Editor with click-to-restore |
| Public API | Done | OpenAPI spec in `openapi.yaml`; TS client via `make generate-api-client` |

---

## Recommendations

### Immediate (this session)
1. Fix `.env.example` (remove Chinese, add all vars) — Done
2. Rewrite `README.md` to match new product vision — Done
3. Add `Makefile` with build/test/dev targets — Done
4. Fix `docker-compose.yml` to build local image — Done
5. Fix `Dockerfile` to build new React frontend — Done
6. Wire Dashboard stats to real `/stats` API — Done
7. Update routing: `/folder/:folderId/drawing/:drawingId` — Done
8. Add env validation on boot — Done
9. Remove/deprecate old anonymous document routes — Done
10. Cleanup `.gitignore` — Done

### Short term (completed)
1. Add `react-i18next` foundation, extract all hardcoded strings — Done
2. Add revision browser in Editor — Done
3. Add command palette foundation — Done
4. Add env validation for all required vars — Done
5. Dark mode toggle on app shell — Done

### Remaining for full release readiness
1. Add responsive layout verification
2. Add ARIA labels / a11y audit
3. Template gallery creation (user/team templates)
4. PostgreSQL migration (keep SQLite for dev via build tag)
5. Thumbnail generation pipeline
6. Frontend unit / E2E tests (Playwright/Vitest)

---

## Test Coverage

| Layer | Coverage | Note |
|-------|----------|------|
| workspace/http_test.go | auth, team access, drawing CRUD, revisions, templates, activity, health | 11 tests, all pass |
| workspace/oauth_test.go | OAuth identity upsert | 1 test |
| workspace/sharing_test.go | invites, grants, share links, embed URL validation, assets, links | 4 tests |
| workspace/permissions_test.go | role × resource × action matrix, admin mgmt, non-member isolation, inheritance | 4 suites |
| Frontend tests | None | No test framework configured |
| E2E tests | None | No Playwright/Cypress |

---

## Verdict

**Current milestone: ~Milestone 3.0** — Backend domain model, auth, permissions, API, and core frontend features (i18n, search, command palette, revision browser, dark mode) are production-grade. Remaining gaps: OpenAPI spec, responsive testing, a11y, template gallery, and frontend test coverage. Release-ready for self-hosting with Docker.
