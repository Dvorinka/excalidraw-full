# Postgres Migration Design

Date: 2026-04-26
Owner: TDvorak

## Goal

Migrate Excalidraw FULL persistence from SQLite to PostgreSQL as the production and runtime database. SQLite is removed from runtime configuration and dependencies.

## Architecture

PostgreSQL is the single relational backend. The application reads `DATABASE_URL` at boot and fails fast when it is missing. `STORAGE_TYPE=postgres` is the database-backed mode for the legacy canvas/document API. Non-database object stores such as filesystem and S3 can remain available for legacy canvas flows, but the workspace product path uses PostgreSQL only.

Schema changes are versioned with embedded goose migrations. The app applies migrations at startup before stores are used.

## Schema

The migration creates the existing document, canvas, and workspace tables in PostgreSQL:

- `BLOB` becomes `BYTEA`.
- `DATETIME` becomes `TIMESTAMPTZ`.
- SQLite boolean defaults become PostgreSQL booleans.
- Existing text JSON fields remain `TEXT`; drawing snapshots remain `BYTEA` to preserve current model behavior.
- Existing uniqueness constraints and indexes are preserved.

## Code Changes

The Go backend uses `pgx` through `database/sql`. The SQLite store package is replaced by a Postgres store package. Workspace store initialization opens Postgres, applies goose migrations, seeds system templates, and uses connection pool limits suitable for the app.

All SQL placeholders use PostgreSQL `$1` form. SQLite-only boot validation, env names, and docs are removed or replaced with `DATABASE_URL`.

## Docker

`docker-compose.yml` and `docker-compose.postgres.yml` run Postgres 16 and the app. The app waits for Postgres health and receives:

- `DATABASE_URL=postgres://excalidraw:excalidraw@postgres:5432/excalidraw?sslmode=disable`
- `STORAGE_TYPE=postgres`

## Tests

Workspace tests run against PostgreSQL via `TEST_DATABASE_URL` or `DATABASE_URL`. Each test suite uses an isolated temporary schema and drops it during cleanup. When no test database URL exists, DB-dependent workspace tests skip with a clear message.

## Verification

Run:

- `go test ./...`
- `docker compose -f docker-compose.postgres.yml up --build`
- `/api/health`
- signup, drawing create, revision create, invite, sharing, and stats flows
