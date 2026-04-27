package workspace

import (
	"context"
)

func (s *Store) WorkspaceStats(ctx context.Context, userID, teamID string) (*WorkspaceStats, error) {
	if teamID != "" {
		if ok, err := s.UserCanAccessTeam(ctx, userID, teamID); err != nil || !ok {
			return nil, ErrForbidden
		}
		return s.workspaceStatsForWhere(ctx, `m.user_id = ? AND t.id = ?`, userID, teamID)
	}
	return s.workspaceStatsForWhere(ctx, `m.user_id = ?`, userID)
}

func (s *Store) workspaceStatsForWhere(ctx context.Context, membershipWhere string, args ...any) (*WorkspaceStats, error) {
	stats := &WorkspaceStats{}
	teamWhere := `id IN (SELECT t.id FROM workspace_teams t JOIN workspace_team_memberships m ON m.team_id = t.id WHERE ` + membershipWhere + `)`
	if err := s.count(ctx, &stats.Teams, `SELECT COUNT(*) FROM workspace_teams WHERE `+teamWhere, args...); err != nil {
		return nil, err
	}
	if err := s.count(ctx, &stats.Members, `SELECT COUNT(*) FROM workspace_team_memberships WHERE team_id IN (SELECT id FROM workspace_teams WHERE `+teamWhere+`)`, args...); err != nil {
		return nil, err
	}
	if err := s.count(ctx, &stats.Projects, `SELECT COUNT(*) FROM workspace_projects WHERE team_id IN (SELECT id FROM workspace_teams WHERE `+teamWhere+`)`, args...); err != nil {
		return nil, err
	}
	if err := s.count(ctx, &stats.Folders, `SELECT COUNT(*) FROM workspace_folders WHERE team_id IN (SELECT id FROM workspace_teams WHERE `+teamWhere+`)`, args...); err != nil {
		return nil, err
	}
	if err := s.count(ctx, &stats.Drawings, `SELECT COUNT(*) FROM workspace_drawings WHERE deleted_at IS NULL AND team_id IN (SELECT id FROM workspace_teams WHERE `+teamWhere+`)`, args...); err != nil {
		return nil, err
	}
	if err := s.count(ctx, &stats.Templates, `SELECT COUNT(*) FROM workspace_templates WHERE scope = 'system' OR team_id IN (SELECT id FROM workspace_teams WHERE `+teamWhere+`)`, args...); err != nil {
		return nil, err
	}
	if err := s.count(ctx, &stats.Revisions, `SELECT COUNT(*) FROM workspace_drawing_revisions WHERE drawing_id IN (SELECT id FROM workspace_drawings WHERE team_id IN (SELECT id FROM workspace_teams WHERE `+teamWhere+`))`, args...); err != nil {
		return nil, err
	}
	if err := s.count(ctx, &stats.Assets, `SELECT COUNT(*) FROM workspace_drawing_assets WHERE drawing_id IN (SELECT id FROM workspace_drawings WHERE team_id IN (SELECT id FROM workspace_teams WHERE `+teamWhere+`))`, args...); err != nil {
		return nil, err
	}
	err := s.db.QueryRowContext(ctx, `SELECT COALESCE(SUM(snapshot_size), 0) FROM workspace_drawing_revisions WHERE drawing_id IN (SELECT id FROM workspace_drawings WHERE team_id IN (SELECT id FROM workspace_teams WHERE `+teamWhere+`))`, args...).Scan(&stats.StorageBytes)
	if err != nil {
		return nil, err
	}
	return stats, nil
}

func (s *Store) count(ctx context.Context, dest *int, query string, args ...any) error {
	return s.db.QueryRowContext(ctx, query, args...).Scan(dest)
}
