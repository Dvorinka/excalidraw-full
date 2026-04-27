-- +goose Up
CREATE TABLE IF NOT EXISTS documents (
	id TEXT PRIMARY KEY,
	data BYTEA NOT NULL
);

CREATE TABLE IF NOT EXISTS canvases (
	id TEXT NOT NULL,
	user_id TEXT NOT NULL,
	name TEXT,
	thumbnail TEXT,
	data BYTEA,
	created_at TIMESTAMPTZ,
	updated_at TIMESTAMPTZ,
	PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS workspace_users (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	username TEXT NOT NULL UNIQUE,
	email TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	avatar_url TEXT,
	locale TEXT NOT NULL DEFAULT 'en',
	timezone TEXT NOT NULL DEFAULT 'UTC',
	created_at TIMESTAMPTZ NOT NULL,
	updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_sessions (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES workspace_users(id) ON DELETE CASCADE,
	token_hash TEXT NOT NULL UNIQUE,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_auth_identities (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES workspace_users(id) ON DELETE CASCADE,
	provider TEXT NOT NULL,
	provider_user_id TEXT NOT NULL,
	email_verified_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL,
	UNIQUE(provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS workspace_teams (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	slug TEXT NOT NULL UNIQUE,
	owner_user_id TEXT NOT NULL REFERENCES workspace_users(id),
	plan_type TEXT NOT NULL DEFAULT 'free',
	created_at TIMESTAMPTZ NOT NULL,
	updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_team_memberships (
	id TEXT PRIMARY KEY,
	team_id TEXT NOT NULL REFERENCES workspace_teams(id) ON DELETE CASCADE,
	user_id TEXT NOT NULL REFERENCES workspace_users(id) ON DELETE CASCADE,
	role TEXT NOT NULL,
	joined_at TIMESTAMPTZ NOT NULL,
	UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS workspace_team_invites (
	id TEXT PRIMARY KEY,
	team_id TEXT NOT NULL REFERENCES workspace_teams(id) ON DELETE CASCADE,
	email TEXT NOT NULL,
	role TEXT NOT NULL,
	token_hash TEXT NOT NULL UNIQUE,
	invited_by TEXT NOT NULL REFERENCES workspace_users(id),
	expires_at TIMESTAMPTZ NOT NULL,
	accepted_at TIMESTAMPTZ,
	revoked_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_team ON workspace_team_invites(team_id, created_at);

CREATE TABLE IF NOT EXISTS workspace_projects (
	id TEXT PRIMARY KEY,
	team_id TEXT NOT NULL REFERENCES workspace_teams(id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	slug TEXT NOT NULL,
	description TEXT,
	created_by TEXT NOT NULL REFERENCES workspace_users(id),
	created_at TIMESTAMPTZ NOT NULL,
	updated_at TIMESTAMPTZ NOT NULL,
	UNIQUE(team_id, slug)
);

CREATE TABLE IF NOT EXISTS workspace_folders (
	id TEXT PRIMARY KEY,
	team_id TEXT NOT NULL REFERENCES workspace_teams(id) ON DELETE CASCADE,
	project_id TEXT REFERENCES workspace_projects(id) ON DELETE SET NULL,
	parent_folder_id TEXT REFERENCES workspace_folders(id) ON DELETE SET NULL,
	name TEXT NOT NULL,
	slug TEXT NOT NULL,
	path_cache TEXT NOT NULL,
	visibility TEXT NOT NULL,
	created_by TEXT NOT NULL REFERENCES workspace_users(id),
	created_at TIMESTAMPTZ NOT NULL,
	updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_drawings (
	id TEXT PRIMARY KEY,
	team_id TEXT NOT NULL REFERENCES workspace_teams(id) ON DELETE CASCADE,
	folder_id TEXT REFERENCES workspace_folders(id) ON DELETE SET NULL,
	project_id TEXT REFERENCES workspace_projects(id) ON DELETE SET NULL,
	slug TEXT,
	title TEXT NOT NULL,
	description TEXT,
	owner_user_id TEXT NOT NULL REFERENCES workspace_users(id),
	latest_revision_id TEXT,
	visibility TEXT NOT NULL,
	is_archived BOOLEAN NOT NULL DEFAULT false,
	thumbnail_asset_id TEXT,
	created_at TIMESTAMPTZ NOT NULL,
	updated_at TIMESTAMPTZ NOT NULL,
	deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workspace_drawings_team ON workspace_drawings(team_id, updated_at);

CREATE TABLE IF NOT EXISTS workspace_drawing_revisions (
	id TEXT PRIMARY KEY,
	drawing_id TEXT NOT NULL REFERENCES workspace_drawings(id) ON DELETE CASCADE,
	revision_number INTEGER NOT NULL,
	snapshot_path TEXT NOT NULL,
	snapshot_size BIGINT NOT NULL,
	content_hash TEXT NOT NULL,
	snapshot_json BYTEA NOT NULL,
	created_by TEXT NOT NULL REFERENCES workspace_users(id),
	created_at TIMESTAMPTZ NOT NULL,
	change_summary TEXT,
	UNIQUE(drawing_id, revision_number)
);

CREATE TABLE IF NOT EXISTS workspace_drawing_assets (
	id TEXT PRIMARY KEY,
	drawing_id TEXT NOT NULL REFERENCES workspace_drawings(id) ON DELETE CASCADE,
	kind TEXT NOT NULL,
	path TEXT NOT NULL,
	mime_type TEXT NOT NULL,
	size BIGINT NOT NULL,
	width INTEGER,
	height INTEGER,
	uploaded_by TEXT NOT NULL REFERENCES workspace_users(id),
	created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_share_links (
	id TEXT PRIMARY KEY,
	resource_type TEXT NOT NULL,
	resource_id TEXT NOT NULL,
	token_hash TEXT NOT NULL UNIQUE,
	permission TEXT NOT NULL,
	expires_at TIMESTAMPTZ,
	password_hash TEXT,
	created_by TEXT NOT NULL REFERENCES workspace_users(id),
	revoked_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_share_links_resource ON workspace_share_links(resource_type, resource_id);

CREATE TABLE IF NOT EXISTS workspace_permission_grants (
	id TEXT PRIMARY KEY,
	resource_type TEXT NOT NULL,
	resource_id TEXT NOT NULL,
	subject_type TEXT NOT NULL,
	subject_id TEXT NOT NULL,
	permission TEXT NOT NULL,
	inherited_from TEXT,
	created_at TIMESTAMPTZ NOT NULL,
	UNIQUE(resource_type, resource_id, subject_type, subject_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_workspace_permission_grants_subject ON workspace_permission_grants(subject_type, subject_id);

CREATE TABLE IF NOT EXISTS workspace_embeds (
	id TEXT PRIMARY KEY,
	drawing_id TEXT NOT NULL REFERENCES workspace_drawings(id) ON DELETE CASCADE,
	source_url TEXT NOT NULL,
	canonical_url TEXT NOT NULL,
	provider TEXT NOT NULL,
	embed_type TEXT NOT NULL,
	title TEXT,
	preview_asset_id TEXT,
	safe_embed_html TEXT,
	created_by TEXT NOT NULL REFERENCES workspace_users(id),
	created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_link_references (
	id TEXT PRIMARY KEY,
	source_resource_type TEXT NOT NULL,
	source_resource_id TEXT NOT NULL,
	target_resource_type TEXT NOT NULL,
	target_resource_id TEXT NOT NULL,
	label TEXT,
	created_by TEXT NOT NULL REFERENCES workspace_users(id),
	created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_links_source ON workspace_link_references(source_resource_type, source_resource_id);

CREATE TABLE IF NOT EXISTS workspace_templates (
	id TEXT PRIMARY KEY,
	team_id TEXT REFERENCES workspace_teams(id) ON DELETE CASCADE,
	scope TEXT NOT NULL,
	type TEXT NOT NULL,
	name TEXT NOT NULL,
	description TEXT,
	snapshot_path TEXT NOT NULL,
	metadata_json TEXT NOT NULL,
	created_by TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL,
	updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_activity_events (
	id TEXT PRIMARY KEY,
	actor_user_id TEXT REFERENCES workspace_users(id) ON DELETE SET NULL,
	team_id TEXT REFERENCES workspace_teams(id) ON DELETE CASCADE,
	resource_type TEXT NOT NULL,
	resource_id TEXT NOT NULL,
	event_type TEXT NOT NULL,
	metadata_json TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_activity_team ON workspace_activity_events(team_id, created_at);

-- +goose Down
DROP TABLE IF EXISTS workspace_activity_events;
DROP TABLE IF EXISTS workspace_templates;
DROP TABLE IF EXISTS workspace_link_references;
DROP TABLE IF EXISTS workspace_embeds;
DROP TABLE IF EXISTS workspace_permission_grants;
DROP TABLE IF EXISTS workspace_share_links;
DROP TABLE IF EXISTS workspace_drawing_assets;
DROP TABLE IF EXISTS workspace_drawing_revisions;
DROP TABLE IF EXISTS workspace_drawings;
DROP TABLE IF EXISTS workspace_folders;
DROP TABLE IF EXISTS workspace_projects;
DROP TABLE IF EXISTS workspace_team_invites;
DROP TABLE IF EXISTS workspace_team_memberships;
DROP TABLE IF EXISTS workspace_teams;
DROP TABLE IF EXISTS workspace_auth_identities;
DROP TABLE IF EXISTS workspace_sessions;
DROP TABLE IF EXISTS workspace_users;
DROP TABLE IF EXISTS canvases;
DROP TABLE IF EXISTS documents;
