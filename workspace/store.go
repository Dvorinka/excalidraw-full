package workspace

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	dbpostgres "excalidraw-complete/internal/postgres"
	"fmt"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"github.com/oklog/ulid/v2"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrConflict  = errors.New("resource already exists")
	ErrForbidden = errors.New("access denied")
	ErrNotFound  = errors.New("resource not found")
)

type Store struct {
	db *dbpostgres.DB
}

type CreateDrawingRequest struct {
	TeamID      *string         `json:"team_id"`
	FolderID    *string         `json:"folder_id"`
	ProjectID   *string         `json:"project_id"`
	Title       string          `json:"title"`
	Description *string         `json:"description"`
	Visibility  string          `json:"visibility"`
	Snapshot    json.RawMessage `json:"snapshot"`
}

type UpdateDrawingRequest struct {
	FolderID    *string `json:"folder_id"`
	ProjectID   *string `json:"project_id"`
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Visibility  *string `json:"visibility"`
}

type CreateRevisionRequest struct {
	Snapshot      json.RawMessage `json:"snapshot"`
	ChangeSummary *string         `json:"change_summary"`
}

type CreateFolderRequest struct {
	TeamID         string  `json:"team_id"`
	ProjectID      *string `json:"project_id"`
	ParentFolderID *string `json:"parent_folder_id"`
	Name           string  `json:"name"`
	Visibility     string  `json:"visibility"`
}

type CreateProjectRequest struct {
	TeamID      string  `json:"team_id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
}

func NewStore(databaseURL string) (*Store, error) {
	db, err := dbpostgres.Open(databaseURL)
	if err != nil {
		return nil, err
	}
	store := &Store{db: db}
	if err := dbpostgres.Migrate(context.Background(), db.DB); err != nil {
		db.Close()
		return nil, err
	}
	if err := store.seedTemplates(context.Background()); err != nil {
		db.Close()
		return nil, err
	}
	return store, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) Ping(ctx context.Context) error {
	return s.db.PingContext(ctx)
}

func (s *Store) seedTemplates(ctx context.Context) error {
	var count int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM workspace_templates WHERE scope = 'system'`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	now := time.Now().UTC()
	templates := []Template{
		{ID: newID(), Scope: "system", Type: "empty", Name: "Empty Canvas", Description: ptr("Start from a clean workspace."), SnapshotPath: "system/templates/empty.json", MetadataJSON: map[string]any{"category": "starter"}, CreatedBy: "system", CreatedAt: now, UpdatedAt: now},
		{ID: newID(), Scope: "system", Type: "kanban", Name: "Kanban Board", Description: ptr("Plan work across simple status lanes."), SnapshotPath: "system/templates/kanban.json", MetadataJSON: map[string]any{"category": "planning"}, CreatedBy: "system", CreatedAt: now, UpdatedAt: now},
		{ID: newID(), Scope: "system", Type: "flowchart", Name: "Flowchart", Description: ptr("Map decisions and process steps."), SnapshotPath: "system/templates/flowchart.json", MetadataJSON: map[string]any{"category": "diagram"}, CreatedBy: "system", CreatedAt: now, UpdatedAt: now},
		{ID: newID(), Scope: "system", Type: "meeting-notes", Name: "Meeting Notes", Description: ptr("Capture decisions, actions, and follow-ups."), SnapshotPath: "system/templates/meeting-notes.json", MetadataJSON: map[string]any{"category": "meeting"}, CreatedBy: "system", CreatedAt: now, UpdatedAt: now},
	}
	for _, template := range templates {
		metadata, err := json.Marshal(template.MetadataJSON)
		if err != nil {
			return err
		}
		_, err = s.db.ExecContext(ctx, `INSERT INTO workspace_templates
			(id, team_id, scope, type, name, description, snapshot_path, metadata_json, created_by, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			template.ID, template.TeamID, template.Scope, template.Type, template.Name, template.Description,
			template.SnapshotPath, string(metadata), template.CreatedBy, template.CreatedAt, template.UpdatedAt,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) UserExists(ctx context.Context) (bool, error) {
	var count int
	err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM workspace_users`).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (s *Store) CreateUserWithPassword(ctx context.Context, name, email, password string) (*User, *Session, string, error) {
	name = strings.TrimSpace(name)
	email, err := normalizeEmail(email)
	if err != nil {
		return nil, nil, "", err
	}
	if len(name) < 1 || len(name) > 120 {
		return nil, nil, "", fmt.Errorf("name must be between 1 and 120 characters")
	}
	if len(password) < 8 || len(password) > 128 {
		return nil, nil, "", fmt.Errorf("password must be between 8 and 128 characters")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return nil, nil, "", err
	}
	now := time.Now().UTC()
	user := &User{
		ID:        newID(),
		Name:      name,
		Username:  slugify(strings.TrimSuffix(email, email[strings.LastIndex(email, "@"):])),
		Email:     email,
		Locale:    "en",
		Timezone:  "UTC",
		CreatedAt: now,
		UpdatedAt: now,
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, nil, "", err
	}
	defer tx.Rollback()
	user.Username = uniqueUsername(ctx, tx, user.Username)
	_, err = tx.ExecContext(ctx, `INSERT INTO workspace_users
		(id, name, username, email, password_hash, avatar_url, locale, timezone, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		user.ID, user.Name, user.Username, user.Email, string(hash), user.AvatarURL, user.Locale, user.Timezone, user.CreatedAt, user.UpdatedAt,
	)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			return nil, nil, "", ErrConflict
		}
		return nil, nil, "", err
	}
	team, err := createTeamTx(ctx, tx, user.ID, name+"'s Workspace", "")
	if err != nil {
		return nil, nil, "", err
	}
	if err := insertActivityTx(ctx, tx, &user.ID, &team.ID, "team", team.ID, "member_joined", map[string]any{"role": "owner"}); err != nil {
		return nil, nil, "", err
	}
	session, token, err := createSessionTx(ctx, tx, user.ID)
	if err != nil {
		return nil, nil, "", err
	}
	if err := tx.Commit(); err != nil {
		return nil, nil, "", err
	}
	return user, session, token, nil
}

func (s *Store) CreateTeamUser(ctx context.Context, teamID string, name, email, password, role string) (*User, error) {
	name = strings.TrimSpace(name)
	email, err := normalizeEmail(email)
	if err != nil {
		return nil, err
	}
	if len(name) < 1 || len(name) > 120 {
		return nil, fmt.Errorf("name must be between 1 and 120 characters")
	}
	if len(password) < 8 || len(password) > 128 {
		return nil, fmt.Errorf("password must be between 8 and 128 characters")
	}
	if role != "owner" && role != "admin" && role != "editor" && role != "viewer" {
		return nil, fmt.Errorf("invalid role")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	user := &User{
		ID:        newID(),
		Name:      name,
		Username:  slugify(strings.TrimSuffix(email, email[strings.LastIndex(email, "@"):])),
		Email:     email,
		Locale:    "en",
		Timezone:  "UTC",
		CreatedAt: now,
		UpdatedAt: now,
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	user.Username = uniqueUsername(ctx, tx, user.Username)
	_, err = tx.ExecContext(ctx, `INSERT INTO workspace_users
		(id, name, username, email, password_hash, avatar_url, locale, timezone, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		user.ID, user.Name, user.Username, user.Email, string(hash), user.AvatarURL, user.Locale, user.Timezone, user.CreatedAt, user.UpdatedAt,
	)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			return nil, ErrConflict
		}
		return nil, err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO workspace_team_memberships
		(id, team_id, user_id, role, joined_at)
		VALUES (?, ?, ?, ?, ?)`, newID(), teamID, user.ID, role, now)
	if err != nil {
		return nil, err
	}
	if err := insertActivityTx(ctx, tx, &user.ID, &teamID, "team", teamID, "member_joined", map[string]any{"role": role}); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return user, nil
}

func (s *Store) AuthenticatePassword(ctx context.Context, email, password string) (*User, *Session, string, error) {
	email, err := normalizeEmail(email)
	if err != nil {
		return nil, nil, "", err
	}
	row := s.db.QueryRowContext(ctx, `SELECT id, name, username, email, password_hash, avatar_url, locale, timezone, created_at, updated_at
		FROM workspace_users WHERE email = ?`, email)
	user, hash, err := scanUserWithHash(row)
	if err != nil {
		return nil, nil, "", ErrForbidden
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		return nil, nil, "", ErrForbidden
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, nil, "", err
	}
	defer tx.Rollback()
	session, token, err := createSessionTx(ctx, tx, user.ID)
	if err != nil {
		return nil, nil, "", err
	}
	if err := insertActivityTx(ctx, tx, &user.ID, nil, "user", user.ID, "login_success", map[string]any{}); err != nil {
		return nil, nil, "", err
	}
	if err := tx.Commit(); err != nil {
		return nil, nil, "", err
	}
	return user, session, token, nil
}

func (s *Store) UserBySessionToken(ctx context.Context, token string) (*User, *Session, error) {
	hash := hashToken(token)
	row := s.db.QueryRowContext(ctx, `SELECT u.id, u.name, u.username, u.email, u.avatar_url, u.locale, u.timezone, u.created_at, u.updated_at,
		s.id, s.user_id, s.expires_at, s.created_at
		FROM workspace_sessions s
		JOIN workspace_users u ON u.id = s.user_id
		WHERE s.token_hash = ? AND s.expires_at > ?`, hash, time.Now().UTC())
	var user User
	var session Session
	if err := row.Scan(&user.ID, &user.Name, &user.Username, &user.Email, &user.AvatarURL, &user.Locale, &user.Timezone, &user.CreatedAt, &user.UpdatedAt, &session.ID, &session.UserID, &session.ExpiresAt, &session.CreatedAt); err != nil {
		return nil, nil, err
	}
	return &user, &session, nil
}

func (s *Store) DeleteSession(ctx context.Context, token string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM workspace_sessions WHERE token_hash = ?`, hashToken(token))
	return err
}

func (s *Store) ListTeamsForUser(ctx context.Context, userID string) ([]Team, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT t.id, t.name, t.slug, t.owner_user_id, t.plan_type, t.created_at, t.updated_at
		FROM workspace_teams t
		JOIN workspace_team_memberships m ON m.team_id = t.id
		WHERE m.user_id = ?
		ORDER BY t.created_at ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var teams []Team
	for rows.Next() {
		var team Team
		if err := rows.Scan(&team.ID, &team.Name, &team.Slug, &team.OwnerUserID, &team.PlanType, &team.CreatedAt, &team.UpdatedAt); err != nil {
			return nil, err
		}
		teams = append(teams, team)
	}
	if teams == nil {
		teams = []Team{}
	}
	return teams, rows.Err()
}

func (s *Store) CreateTeam(ctx context.Context, ownerUserID, name, slug string) (*Team, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	team, err := createTeamTx(ctx, tx, ownerUserID, name, slug)
	if err != nil {
		return nil, err
	}
	if err := insertActivityTx(ctx, tx, &ownerUserID, &team.ID, "team", team.ID, "member_joined", map[string]any{"role": "owner"}); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return team, nil
}

func (s *Store) UpdateTeam(ctx context.Context, userID, teamID string, name, slug *string) (*Team, error) {
	var role string
	err := s.db.QueryRowContext(ctx, `SELECT role FROM workspace_team_memberships WHERE user_id = ? AND team_id = ?`, userID, teamID).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	if err != nil {
		return nil, err
	}
	if role != "owner" && role != "admin" {
		return nil, ErrForbidden
	}

	updates := []string{}
	args := []any{}
	if name != nil {
		n := strings.TrimSpace(*name)
		if n == "" || len(n) > 120 {
			return nil, fmt.Errorf("team name must be between 1 and 120 characters")
		}
		updates = append(updates, "name = ?")
		args = append(args, n)
	}
	if slug != nil {
		s := slugify(*slug)
		if s == "" {
			return nil, fmt.Errorf("team slug must not be empty")
		}
		updates = append(updates, "slug = ?")
		args = append(args, s)
	}
	if len(updates) == 0 {
		return s.GetTeam(ctx, teamID)
	}

	updates = append(updates, "updated_at = ?")
	args = append(args, time.Now().UTC())
	args = append(args, teamID)

	query := "UPDATE workspace_teams SET " + strings.Join(updates, ", ") + " WHERE id = ?"
	if _, err := s.db.ExecContext(ctx, query, args...); err != nil {
		return nil, err
	}
	return s.GetTeam(ctx, teamID)
}

func (s *Store) GetTeam(ctx context.Context, teamID string) (*Team, error) {
	row := s.db.QueryRowContext(ctx, `SELECT id, name, slug, owner_user_id, plan_type, created_at, updated_at FROM workspace_teams WHERE id = ?`, teamID)
	var t Team
	if err := row.Scan(&t.ID, &t.Name, &t.Slug, &t.OwnerUserID, &t.PlanType, &t.CreatedAt, &t.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &t, nil
}

func (s *Store) UserCanAccessTeam(ctx context.Context, userID, teamID string) (bool, error) {
	var found int
	err := s.db.QueryRowContext(ctx, `SELECT 1 FROM workspace_team_memberships WHERE user_id = ? AND team_id = ?`, userID, teamID).Scan(&found)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

func (s *Store) ListTeamMembers(ctx context.Context, teamID string) ([]TeamMembership, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT m.id, m.team_id, m.user_id, m.role, m.joined_at,
		u.id, u.name, u.username, u.email, u.avatar_url, u.locale, u.timezone, u.created_at, u.updated_at
		FROM workspace_team_memberships m
		JOIN workspace_users u ON u.id = m.user_id
		WHERE m.team_id = ?
		ORDER BY m.joined_at ASC`, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	members := []TeamMembership{}
	for rows.Next() {
		var member TeamMembership
		var user User
		if err := rows.Scan(&member.ID, &member.TeamID, &member.UserID, &member.Role, &member.JoinedAt,
			&user.ID, &user.Name, &user.Username, &user.Email, &user.AvatarURL, &user.Locale, &user.Timezone, &user.CreatedAt, &user.UpdatedAt); err != nil {
			return nil, err
		}
		member.User = &user
		members = append(members, member)
	}
	return members, rows.Err()
}

func (s *Store) ListDrawings(ctx context.Context, userID, teamID string) ([]Drawing, error) {
	if teamID != "" {
		if ok, err := s.UserCanAccessTeam(ctx, userID, teamID); err != nil || !ok {
			return nil, ErrForbidden
		}
		return s.listDrawingsByQuery(ctx, `d.team_id = ?`, teamID)
	}
	return s.listDrawingsByQuery(ctx, `d.team_id IN (SELECT team_id FROM workspace_team_memberships WHERE user_id = ?)`, userID)
}

func (s *Store) listDrawingsByQuery(ctx context.Context, where string, arg string) ([]Drawing, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT d.id, d.team_id, d.folder_id, d.project_id, d.slug, d.title, d.description,
		d.owner_user_id, d.latest_revision_id, d.visibility, d.is_archived, d.thumbnail_asset_id, d.created_at, d.updated_at, d.deleted_at,
		u.id, u.name, u.username, u.email, u.avatar_url, u.locale, u.timezone, u.created_at, u.updated_at
		FROM workspace_drawings d
		JOIN workspace_users u ON u.id = d.owner_user_id
		WHERE d.deleted_at IS NULL AND `+where+`
		ORDER BY d.updated_at DESC`, arg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	drawings := []Drawing{}
	for rows.Next() {
		drawing, err := scanDrawing(rows)
		if err != nil {
			return nil, err
		}
		drawings = append(drawings, *drawing)
	}
	return drawings, rows.Err()
}

// SearchDrawings performs a fulltext-like search over drawing titles and descriptions
// for drawings the user can access via their team memberships.
func (s *Store) SearchDrawings(ctx context.Context, userID string, q string) ([]Drawing, error) {
	searchPattern := "%" + strings.TrimSpace(q) + "%"
	where := `d.team_id IN (SELECT team_id FROM workspace_team_memberships WHERE user_id = ?)`
	rows, err := s.db.QueryContext(ctx, `SELECT d.id, d.team_id, d.folder_id, d.project_id, d.slug, d.title, d.description,
		d.owner_user_id, d.latest_revision_id, d.visibility, d.is_archived, d.thumbnail_asset_id, d.created_at, d.updated_at, d.deleted_at,
		u.id, u.name, u.username, u.email, u.avatar_url, u.locale, u.timezone, u.created_at, u.updated_at
		FROM workspace_drawings d
		JOIN workspace_users u ON u.id = d.owner_user_id
		WHERE d.deleted_at IS NULL AND `+where+` AND (d.title LIKE ? OR d.description LIKE ?)
		ORDER BY d.updated_at DESC`, userID, searchPattern, searchPattern)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	drawings := []Drawing{}
	for rows.Next() {
		drawing, err := scanDrawing(rows)
		if err != nil {
			return nil, err
		}
		drawings = append(drawings, *drawing)
	}
	return drawings, rows.Err()
}

func (s *Store) CreateDrawing(ctx context.Context, userID string, req CreateDrawingRequest) (*Drawing, error) {
	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = "Untitled drawing"
	}
	if len(title) > 160 {
		return nil, fmt.Errorf("title must be at most 160 characters")
	}
	teamID := deref(req.TeamID)
	if teamID == "" {
		var err error
		teamID, err = s.defaultTeamID(ctx, userID)
		if err != nil {
			return nil, err
		}
	}
	if ok, err := s.UserCanAccessTeam(ctx, userID, teamID); err != nil || !ok {
		return nil, ErrForbidden
	}
	visibility := req.Visibility
	if visibility == "" {
		visibility = "team"
	}
	if !validDrawingVisibility(visibility) {
		return nil, fmt.Errorf("invalid drawing visibility")
	}
	now := time.Now().UTC()
	drawing := &Drawing{
		ID:          newID(),
		TeamID:      teamID,
		FolderID:    req.FolderID,
		ProjectID:   req.ProjectID,
		Title:       title,
		Description: req.Description,
		OwnerUserID: userID,
		Visibility:  visibility,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	slug := slugify(title)
	drawing.Slug = &slug
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx, `INSERT INTO workspace_drawings
		(id, team_id, folder_id, project_id, slug, title, description, owner_user_id, latest_revision_id, visibility, is_archived, thumbnail_asset_id, created_at, updated_at, deleted_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		drawing.ID, drawing.TeamID, drawing.FolderID, drawing.ProjectID, drawing.Slug, drawing.Title, drawing.Description,
		drawing.OwnerUserID, drawing.LatestRevisionID, drawing.Visibility, drawing.IsArchived, drawing.ThumbnailAssetID,
		drawing.CreatedAt, drawing.UpdatedAt, drawing.DeletedAt,
	)
	if err != nil {
		return nil, err
	}
	if len(req.Snapshot) > 0 {
		rev, err := createRevisionTx(ctx, tx, userID, drawing.ID, req.Snapshot, nil)
		if err != nil {
			return nil, err
		}
		drawing.LatestRevisionID = &rev.ID
	}
	if err := insertActivityTx(ctx, tx, &userID, &drawing.TeamID, "drawing", drawing.ID, "drawing_created", map[string]any{"title": drawing.Title}); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return s.GetDrawing(ctx, userID, drawing.ID)
}

func (s *Store) GetDrawing(ctx context.Context, userID, drawingID string) (*Drawing, error) {
	if err := s.ensureDrawingAccess(ctx, userID, drawingID, "view"); err != nil {
		return nil, err
	}
	row := s.db.QueryRowContext(ctx, `SELECT d.id, d.team_id, d.folder_id, d.project_id, d.slug, d.title, d.description,
		d.owner_user_id, d.latest_revision_id, d.visibility, d.is_archived, d.thumbnail_asset_id, d.created_at, d.updated_at, d.deleted_at,
		u.id, u.name, u.username, u.email, u.avatar_url, u.locale, u.timezone, u.created_at, u.updated_at
		FROM workspace_drawings d
		JOIN workspace_users u ON u.id = d.owner_user_id
		WHERE d.id = ? AND d.deleted_at IS NULL`, drawingID)
	return scanDrawing(row)
}

func (s *Store) UpdateDrawing(ctx context.Context, userID, drawingID string, req UpdateDrawingRequest) (*Drawing, error) {
	if err := s.ensureDrawingAccess(ctx, userID, drawingID, "edit"); err != nil {
		return nil, err
	}
	current, err := s.GetDrawing(ctx, userID, drawingID)
	if err != nil {
		return nil, err
	}
	if req.Title != nil {
		title := strings.TrimSpace(*req.Title)
		if title == "" || len(title) > 160 {
			return nil, fmt.Errorf("title must be between 1 and 160 characters")
		}
		current.Title = title
		slug := slugify(title)
		current.Slug = &slug
	}
	if req.Description != nil {
		current.Description = req.Description
	}
	if req.Visibility != nil {
		if !validDrawingVisibility(*req.Visibility) {
			return nil, fmt.Errorf("invalid drawing visibility")
		}
		current.Visibility = *req.Visibility
	}
	if req.FolderID != nil {
		current.FolderID = req.FolderID
	}
	if req.ProjectID != nil {
		current.ProjectID = req.ProjectID
	}
	now := time.Now().UTC()
	_, err = s.db.ExecContext(ctx, `UPDATE workspace_drawings
		SET folder_id = ?, project_id = ?, slug = ?, title = ?, description = ?, visibility = ?, updated_at = ?
		WHERE id = ?`,
		current.FolderID, current.ProjectID, current.Slug, current.Title, current.Description, current.Visibility, now, current.ID,
	)
	if err != nil {
		return nil, err
	}
	_ = s.insertActivity(ctx, &userID, &current.TeamID, "drawing", current.ID, "drawing_updated", map[string]any{"title": current.Title})
	return s.GetDrawing(ctx, userID, drawingID)
}

func (s *Store) ArchiveDrawing(ctx context.Context, userID, drawingID string) error {
	if err := s.ensureDrawingAccess(ctx, userID, drawingID, "edit"); err != nil {
		return err
	}
	now := time.Now().UTC()
	res, err := s.db.ExecContext(ctx, `UPDATE workspace_drawings SET is_archived = true, deleted_at = ?, updated_at = ? WHERE id = ?`, now, now, drawingID)
	if err != nil {
		return err
	}
	count, _ := res.RowsAffected()
	if count == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) ListRevisions(ctx context.Context, userID, drawingID string) ([]DrawingRevision, error) {
	if err := s.ensureDrawingAccess(ctx, userID, drawingID, "view"); err != nil {
		return nil, err
	}
	rows, err := s.db.QueryContext(ctx, `SELECT id, drawing_id, revision_number, snapshot_path, snapshot_size, content_hash, snapshot_json, created_by, created_at, change_summary
		FROM workspace_drawing_revisions WHERE drawing_id = ? ORDER BY revision_number DESC`, drawingID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	revisions := []DrawingRevision{}
	for rows.Next() {
		var rev DrawingRevision
		if err := rows.Scan(&rev.ID, &rev.DrawingID, &rev.RevisionNumber, &rev.SnapshotPath, &rev.SnapshotSize, &rev.ContentHash, &rev.Snapshot, &rev.CreatedBy, &rev.CreatedAt, &rev.ChangeSummary); err != nil {
			return nil, err
		}
		revisions = append(revisions, rev)
	}
	return revisions, rows.Err()
}

func (s *Store) CreateRevision(ctx context.Context, userID, drawingID string, req CreateRevisionRequest) (*DrawingRevision, error) {
	if err := s.ensureDrawingAccess(ctx, userID, drawingID, "edit"); err != nil {
		return nil, err
	}
	if len(req.Snapshot) == 0 || !json.Valid(req.Snapshot) {
		return nil, fmt.Errorf("snapshot must be valid JSON")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	rev, err := createRevisionTx(ctx, tx, userID, drawingID, req.Snapshot, req.ChangeSummary)
	if err != nil {
		return nil, err
	}
	var teamID string
	if err := tx.QueryRowContext(ctx, `SELECT team_id FROM workspace_drawings WHERE id = ?`, drawingID).Scan(&teamID); err == nil {
		if err := insertActivityTx(ctx, tx, &userID, &teamID, "drawing", drawingID, "revision_created", map[string]any{"revision_number": rev.RevisionNumber}); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return rev, nil
}

func (s *Store) ListTemplates(ctx context.Context, userID, teamID string) ([]Template, error) {
	var rows *sql.Rows
	var err error
	if teamID != "" {
		if ok, err := s.UserCanAccessTeam(ctx, userID, teamID); err != nil || !ok {
			return nil, ErrForbidden
		}
		rows, err = s.db.QueryContext(ctx, `SELECT id, team_id, scope, type, name, description, snapshot_path, metadata_json, created_by, created_at, updated_at
			FROM workspace_templates WHERE scope = 'system' OR team_id = ? ORDER BY scope, name`, teamID)
	} else {
		rows, err = s.db.QueryContext(ctx, `SELECT id, team_id, scope, type, name, description, snapshot_path, metadata_json, created_by, created_at, updated_at
			FROM workspace_templates WHERE scope = 'system' OR team_id IN (SELECT team_id FROM workspace_team_memberships WHERE user_id = ?) ORDER BY scope, name`, userID)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	templates := []Template{}
	for rows.Next() {
		var template Template
		var metadata string
		if err := rows.Scan(&template.ID, &template.TeamID, &template.Scope, &template.Type, &template.Name, &template.Description, &template.SnapshotPath, &metadata, &template.CreatedBy, &template.CreatedAt, &template.UpdatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal([]byte(metadata), &template.MetadataJSON)
		if template.MetadataJSON == nil {
			template.MetadataJSON = map[string]any{}
		}
		templates = append(templates, template)
	}
	return templates, rows.Err()
}

func (s *Store) ListActivity(ctx context.Context, userID, teamID string, limit int) ([]ActivityEvent, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	where := `a.team_id IN (SELECT team_id FROM workspace_team_memberships WHERE user_id = ?)`
	arg := userID
	if teamID != "" {
		if ok, err := s.UserCanAccessTeam(ctx, userID, teamID); err != nil || !ok {
			return nil, ErrForbidden
		}
		where = `a.team_id = ?`
		arg = teamID
	}
	rows, err := s.db.QueryContext(ctx, `SELECT a.id, a.actor_user_id, a.team_id, a.resource_type, a.resource_id, a.event_type, a.metadata_json, a.created_at,
		u.id, u.name, u.username, u.email, u.avatar_url, u.locale, u.timezone, u.created_at, u.updated_at
		FROM workspace_activity_events a
		LEFT JOIN workspace_users u ON u.id = a.actor_user_id
		WHERE `+where+`
		ORDER BY a.created_at DESC LIMIT ?`, arg, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	events := []ActivityEvent{}
	for rows.Next() {
		var event ActivityEvent
		var metadata string
		var actor User
		var actorID sql.NullString
		var actorName sql.NullString
		var actorUsername sql.NullString
		var actorEmail sql.NullString
		var actorAvatar sql.NullString
		var actorLocale sql.NullString
		var actorTimezone sql.NullString
		var actorCreated time.Time
		var actorUpdated time.Time
		if err := rows.Scan(&event.ID, &event.ActorUserID, &event.TeamID, &event.ResourceType, &event.ResourceID, &event.EventType, &metadata, &event.CreatedAt,
			&actorID, &actorName, &actorUsername, &actorEmail, &actorAvatar, &actorLocale, &actorTimezone, &actorCreated, &actorUpdated); err != nil {
			return nil, err
		}
		_ = json.Unmarshal([]byte(metadata), &event.MetadataJSON)
		if event.MetadataJSON == nil {
			event.MetadataJSON = map[string]any{}
		}
		if actorID.Valid {
			actor.ID = actorID.String
			actor.Name = actorName.String
			actor.Username = actorUsername.String
			actor.Email = actorEmail.String
			if actorAvatar.Valid {
				actor.AvatarURL = &actorAvatar.String
			}
			actor.Locale = actorLocale.String
			actor.Timezone = actorTimezone.String
			actor.CreatedAt = actorCreated
			actor.UpdatedAt = actorUpdated
			event.Actor = &actor
		}
		events = append(events, event)
	}
	return events, rows.Err()
}

func (s *Store) ListFolders(ctx context.Context, userID, teamID string) ([]Folder, error) {
	if teamID == "" {
		teamID, _ = s.defaultTeamID(ctx, userID)
	}
	if ok, err := s.UserCanAccessTeam(ctx, userID, teamID); err != nil || !ok {
		return nil, ErrForbidden
	}
	rows, err := s.db.QueryContext(ctx, `SELECT id, team_id, project_id, parent_folder_id, name, slug, path_cache, visibility, created_by, created_at, updated_at
		FROM workspace_folders WHERE team_id = ? ORDER BY path_cache ASC`, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	folders := []Folder{}
	for rows.Next() {
		var folder Folder
		if err := rows.Scan(&folder.ID, &folder.TeamID, &folder.ProjectID, &folder.ParentFolderID, &folder.Name, &folder.Slug, &folder.PathCache, &folder.Visibility, &folder.CreatedBy, &folder.CreatedAt, &folder.UpdatedAt); err != nil {
			return nil, err
		}
		folders = append(folders, folder)
	}
	return folders, rows.Err()
}

func (s *Store) CreateFolder(ctx context.Context, userID string, req CreateFolderRequest) (*Folder, error) {
	teamID := strings.TrimSpace(req.TeamID)
	if teamID == "" {
		var err error
		teamID, err = s.defaultTeamID(ctx, userID)
		if err != nil {
			return nil, err
		}
	}
	if ok, err := s.UserCanAccessTeam(ctx, userID, teamID); err != nil || !ok {
		return nil, ErrForbidden
	}
	name := strings.TrimSpace(req.Name)
	if name == "" || len(name) > 120 {
		return nil, fmt.Errorf("folder name must be between 1 and 120 characters")
	}
	visibility := req.Visibility
	if visibility == "" {
		visibility = "team"
	}
	now := time.Now().UTC()
	folder := &Folder{
		ID:             newID(),
		TeamID:         teamID,
		ProjectID:      req.ProjectID,
		ParentFolderID: req.ParentFolderID,
		Name:           name,
		Slug:           slugify(name),
		PathCache:      slugify(name),
		Visibility:     visibility,
		CreatedBy:      userID,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	_, err := s.db.ExecContext(ctx, `INSERT INTO workspace_folders
		(id, team_id, project_id, parent_folder_id, name, slug, path_cache, visibility, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		folder.ID, folder.TeamID, folder.ProjectID, folder.ParentFolderID, folder.Name, folder.Slug, folder.PathCache, folder.Visibility, folder.CreatedBy, folder.CreatedAt, folder.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return folder, nil
}

func (s *Store) ListProjects(ctx context.Context, userID, teamID string) ([]Project, error) {
	if teamID == "" {
		teamID, _ = s.defaultTeamID(ctx, userID)
	}
	if ok, err := s.UserCanAccessTeam(ctx, userID, teamID); err != nil || !ok {
		return nil, ErrForbidden
	}
	rows, err := s.db.QueryContext(ctx, `SELECT id, team_id, name, slug, description, created_by, created_at, updated_at
		FROM workspace_projects WHERE team_id = ? ORDER BY created_at ASC`, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	projects := []Project{}
	for rows.Next() {
		var project Project
		if err := rows.Scan(&project.ID, &project.TeamID, &project.Name, &project.Slug, &project.Description, &project.CreatedBy, &project.CreatedAt, &project.UpdatedAt); err != nil {
			return nil, err
		}
		projects = append(projects, project)
	}
	return projects, rows.Err()
}

func (s *Store) CreateProject(ctx context.Context, userID string, req CreateProjectRequest) (*Project, error) {
	if ok, err := s.UserCanAccessTeam(ctx, userID, req.TeamID); err != nil || !ok {
		return nil, ErrForbidden
	}
	name := strings.TrimSpace(req.Name)
	if name == "" || len(name) > 120 {
		return nil, fmt.Errorf("project name must be between 1 and 120 characters")
	}
	now := time.Now().UTC()
	project := &Project{
		ID:          newID(),
		TeamID:      req.TeamID,
		Name:        name,
		Slug:        slugify(name),
		Description: req.Description,
		CreatedBy:   userID,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	_, err := s.db.ExecContext(ctx, `INSERT INTO workspace_projects
		(id, team_id, name, slug, description, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		project.ID, project.TeamID, project.Name, project.Slug, project.Description, project.CreatedBy, project.CreatedAt, project.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return project, nil
}

func (s *Store) defaultTeamID(ctx context.Context, userID string) (string, error) {
	var teamID string
	err := s.db.QueryRowContext(ctx, `SELECT team_id FROM workspace_team_memberships WHERE user_id = ? ORDER BY joined_at ASC LIMIT 1`, userID).Scan(&teamID)
	if err != nil {
		return "", err
	}
	return teamID, nil
}

func (s *Store) ensureDrawingAccess(ctx context.Context, userID, drawingID, permission string) error {
	var teamID string
	var ownerUserID string
	var visibility string
	var role sql.NullString
	err := s.db.QueryRowContext(ctx, `SELECT d.team_id, d.owner_user_id, d.visibility, m.role
		FROM workspace_drawings d
		LEFT JOIN workspace_team_memberships m ON m.team_id = d.team_id AND m.user_id = ?
		WHERE d.id = ? AND d.deleted_at IS NULL`, userID, drawingID).Scan(&teamID, &ownerUserID, &visibility, &role)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrForbidden
	}
	if err != nil {
		return err
	}
	if ownerUserID == userID {
		return nil
	}
	if ok, err := s.grantAllows(ctx, "drawing", drawingID, userID, teamID, permission); err != nil {
		return err
	} else if ok {
		return nil
	}
	if !role.Valid {
		return ErrForbidden
	}
	if visibility == "private" || visibility == "restricted" {
		return ErrForbidden
	}
	if roleAllows(role.String, permission) {
		return nil
	}
	return ErrForbidden
}

func createTeamTx(ctx context.Context, tx *dbpostgres.Tx, ownerUserID, name, slug string) (*Team, error) {
	name = strings.TrimSpace(name)
	if name == "" || len(name) > 120 {
		return nil, fmt.Errorf("team name must be between 1 and 120 characters")
	}
	if slug == "" {
		slug = slugify(name)
	}
	slug = slugify(slug)
	slug = uniqueTeamSlug(ctx, tx, slug)
	now := time.Now().UTC()
	team := &Team{
		ID:          newID(),
		Name:        name,
		Slug:        slug,
		OwnerUserID: ownerUserID,
		PlanType:    "free",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	_, err := tx.ExecContext(ctx, `INSERT INTO workspace_teams
		(id, name, slug, owner_user_id, plan_type, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		team.ID, team.Name, team.Slug, team.OwnerUserID, team.PlanType, team.CreatedAt, team.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO workspace_team_memberships
		(id, team_id, user_id, role, joined_at)
		VALUES (?, ?, ?, ?, ?)`, newID(), team.ID, ownerUserID, "owner", now)
	if err != nil {
		return nil, err
	}
	return team, nil
}

func createSessionTx(ctx context.Context, tx *dbpostgres.Tx, userID string) (*Session, string, error) {
	token, err := randomToken()
	if err != nil {
		return nil, "", err
	}
	now := time.Now().UTC()
	session := &Session{
		ID:        newID(),
		UserID:    userID,
		ExpiresAt: now.Add(7 * 24 * time.Hour),
		CreatedAt: now,
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO workspace_sessions (id, user_id, token_hash, expires_at, created_at)
		VALUES (?, ?, ?, ?, ?)`, session.ID, session.UserID, hashToken(token), session.ExpiresAt, session.CreatedAt)
	if err != nil {
		return nil, "", err
	}
	return session, token, nil
}

func createRevisionTx(ctx context.Context, tx *dbpostgres.Tx, userID, drawingID string, snapshot json.RawMessage, summary *string) (*DrawingRevision, error) {
	if len(snapshot) == 0 {
		snapshot = json.RawMessage(`{"type":"excalidraw","elements":[],"appState":{},"files":{}}`)
	}
	if !json.Valid(snapshot) {
		return nil, fmt.Errorf("snapshot must be valid JSON")
	}
	var next int
	if err := tx.QueryRowContext(ctx, `SELECT COALESCE(MAX(revision_number), 0) + 1 FROM workspace_drawing_revisions WHERE drawing_id = ?`, drawingID).Scan(&next); err != nil {
		return nil, err
	}
	sum := sha256.Sum256(snapshot)
	now := time.Now().UTC()
	rev := &DrawingRevision{
		ID:             newID(),
		DrawingID:      drawingID,
		RevisionNumber: next,
		SnapshotPath:   fmt.Sprintf("teams/drawings/%s/revisions/%d.json", drawingID, next),
		SnapshotSize:   int64(len(snapshot)),
		ContentHash:    hex.EncodeToString(sum[:]),
		CreatedBy:      userID,
		CreatedAt:      now,
		ChangeSummary:  summary,
		Snapshot:       snapshot,
	}
	_, err := tx.ExecContext(ctx, `INSERT INTO workspace_drawing_revisions
		(id, drawing_id, revision_number, snapshot_path, snapshot_size, content_hash, snapshot_json, created_by, created_at, change_summary)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		rev.ID, rev.DrawingID, rev.RevisionNumber, rev.SnapshotPath, rev.SnapshotSize, rev.ContentHash, []byte(snapshot), rev.CreatedBy, rev.CreatedAt, rev.ChangeSummary,
	)
	if err != nil {
		return nil, err
	}
	_, err = tx.ExecContext(ctx, `UPDATE workspace_drawings SET latest_revision_id = ?, updated_at = ? WHERE id = ?`, rev.ID, now, drawingID)
	if err != nil {
		return nil, err
	}
	return rev, nil
}

func (s *Store) insertActivity(ctx context.Context, actorUserID, teamID *string, resourceType, resourceID, eventType string, metadata map[string]any) error {
	return insertActivityExec(ctx, s.db, actorUserID, teamID, resourceType, resourceID, eventType, metadata)
}

func insertActivityTx(ctx context.Context, tx *dbpostgres.Tx, actorUserID, teamID *string, resourceType, resourceID, eventType string, metadata map[string]any) error {
	return insertActivityExec(ctx, tx, actorUserID, teamID, resourceType, resourceID, eventType, metadata)
}

type execer interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
}

func insertActivityExec(ctx context.Context, exec execer, actorUserID, teamID *string, resourceType, resourceID, eventType string, metadata map[string]any) error {
	if metadata == nil {
		metadata = map[string]any{}
	}
	raw, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	_, err = exec.ExecContext(ctx, `INSERT INTO workspace_activity_events
		(id, actor_user_id, team_id, resource_type, resource_id, event_type, metadata_json, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		newID(), actorUserID, teamID, resourceType, resourceID, eventType, string(raw), time.Now().UTC(),
	)
	return err
}

type drawingScanner interface {
	Scan(dest ...any) error
}

func scanDrawing(scanner drawingScanner) (*Drawing, error) {
	var drawing Drawing
	var owner User
	if err := scanner.Scan(&drawing.ID, &drawing.TeamID, &drawing.FolderID, &drawing.ProjectID, &drawing.Slug, &drawing.Title, &drawing.Description,
		&drawing.OwnerUserID, &drawing.LatestRevisionID, &drawing.Visibility, &drawing.IsArchived, &drawing.ThumbnailAssetID, &drawing.CreatedAt, &drawing.UpdatedAt, &drawing.DeletedAt,
		&owner.ID, &owner.Name, &owner.Username, &owner.Email, &owner.AvatarURL, &owner.Locale, &owner.Timezone, &owner.CreatedAt, &owner.UpdatedAt); err != nil {
		return nil, err
	}
	drawing.Owner = &owner
	return &drawing, nil
}

type userHashScanner interface {
	Scan(dest ...any) error
}

func scanUserWithHash(scanner userHashScanner) (*User, string, error) {
	var user User
	var hash string
	err := scanner.Scan(&user.ID, &user.Name, &user.Username, &user.Email, &hash, &user.AvatarURL, &user.Locale, &user.Timezone, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, "", err
	}
	return &user, hash, nil
}

func normalizeEmail(value string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(value))
	if len(email) > 254 {
		return "", fmt.Errorf("email must be at most 254 characters")
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return "", fmt.Errorf("email must be valid")
	}
	return email, nil
}

func uniqueUsername(ctx context.Context, tx *dbpostgres.Tx, base string) string {
	if base == "" {
		base = "user"
	}
	candidate := base
	for i := 2; ; i++ {
		var found int
		err := tx.QueryRowContext(ctx, `SELECT 1 FROM workspace_users WHERE username = ?`, candidate).Scan(&found)
		if errors.Is(err, sql.ErrNoRows) {
			return candidate
		}
		candidate = fmt.Sprintf("%s-%d", base, i)
	}
}

func uniqueTeamSlug(ctx context.Context, tx *dbpostgres.Tx, base string) string {
	if base == "" {
		base = "team"
	}
	candidate := base
	for i := 2; ; i++ {
		var found int
		err := tx.QueryRowContext(ctx, `SELECT 1 FROM workspace_teams WHERE slug = ?`, candidate).Scan(&found)
		if errors.Is(err, sql.ErrNoRows) {
			return candidate
		}
		candidate = fmt.Sprintf("%s-%d", base, i)
	}
}

var nonSlugChars = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = nonSlugChars.ReplaceAllString(value, "-")
	value = strings.Trim(value, "-")
	if value == "" {
		return "item"
	}
	if len(value) > 80 {
		value = strings.Trim(value[:80], "-")
	}
	return value
}

func validDrawingVisibility(visibility string) bool {
	switch visibility {
	case "private", "team", "public", "restricted", "public-link":
		return true
	default:
		return false
	}
}

func randomToken() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func newID() string {
	return ulid.Make().String()
}

func ptr[T any](value T) *T {
	return &value
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}
