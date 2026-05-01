-- +goose Up
CREATE TABLE IF NOT EXISTS workspace_notifications (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES workspace_users(id) ON DELETE CASCADE,
	type TEXT NOT NULL,
	title TEXT NOT NULL,
	description TEXT NOT NULL,
	resource_type TEXT,
	resource_id TEXT,
	read BOOLEAN NOT NULL DEFAULT FALSE,
	metadata_json TEXT NOT NULL DEFAULT '{}',
	created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_notifications_user ON workspace_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_notifications_unread ON workspace_notifications(user_id, read);

-- +goose Down
DROP TABLE IF EXISTS workspace_notifications;
