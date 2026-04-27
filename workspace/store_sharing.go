package workspace

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"net/url"
	"strings"
	"time"
)

type CreateInviteRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

type CreatePermissionGrantRequest struct {
	SubjectType string `json:"subject_type"`
	SubjectID   string `json:"subject_id"`
	Email       string `json:"email"`
	Permission  string `json:"permission"`
}

type CreateShareLinkRequest struct {
	Permission string     `json:"permission"`
	ExpiresAt  *time.Time `json:"expires_at"`
}

type CreateAssetRequest struct {
	Kind     string `json:"kind"`
	MimeType string `json:"mime_type"`
	Size     int64  `json:"size"`
	Width    *int   `json:"width"`
	Height   *int   `json:"height"`
}

type CreateEmbedRequest struct {
	SourceURL string  `json:"source_url"`
	EmbedType string  `json:"embed_type"`
	Title     *string `json:"title"`
}

type CreateLinkRequest struct {
	TargetResourceType string  `json:"target_resource_type"`
	TargetResourceID   string  `json:"target_resource_id"`
	Label              *string `json:"label"`
}

func (s *Store) ListTeamInvites(ctx context.Context, userID, teamID string) ([]TeamInvite, error) {
	if err := s.ensureTeamPermission(ctx, userID, teamID, "invite"); err != nil {
		return nil, err
	}
	rows, err := s.db.QueryContext(ctx, `SELECT id, team_id, email, role, invited_by, expires_at, created_at
		FROM workspace_team_invites
		WHERE team_id = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?
		ORDER BY created_at DESC`, teamID, time.Now().UTC())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	invites := []TeamInvite{}
	for rows.Next() {
		var invite TeamInvite
		if err := rows.Scan(&invite.ID, &invite.TeamID, &invite.Email, &invite.Role, &invite.InvitedBy, &invite.ExpiresAt, &invite.CreatedAt); err != nil {
			return nil, err
		}
		invites = append(invites, invite)
	}
	return invites, rows.Err()
}

func (s *Store) CreateTeamInvite(ctx context.Context, userID, teamID string, req CreateInviteRequest) (*TeamInvite, string, error) {
	if err := s.ensureTeamPermission(ctx, userID, teamID, "invite"); err != nil {
		return nil, "", err
	}
	email, err := normalizeEmail(req.Email)
	if err != nil {
		return nil, "", err
	}
	role := req.Role
	if role == "" {
		role = "viewer"
	}
	if !validTeamRole(role) || role == "owner" {
		return nil, "", fmt.Errorf("invalid invite role")
	}
	token, err := randomToken()
	if err != nil {
		return nil, "", err
	}
	now := time.Now().UTC()
	invite := &TeamInvite{
		ID:        newID(),
		TeamID:    teamID,
		Email:     email,
		Role:      role,
		InvitedBy: userID,
		ExpiresAt: now.Add(14 * 24 * time.Hour),
		CreatedAt: now,
	}
	_, err = s.db.ExecContext(ctx, `INSERT INTO workspace_team_invites
		(id, team_id, email, role, token_hash, invited_by, expires_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		invite.ID, invite.TeamID, invite.Email, invite.Role, hashToken(token), invite.InvitedBy, invite.ExpiresAt, invite.CreatedAt,
	)
	if err != nil {
		return nil, "", err
	}
	_ = s.insertActivity(ctx, &userID, &teamID, "team", teamID, "member_invited", map[string]any{"email": email, "role": role})
	return invite, token, nil
}

func (s *Store) AcceptInvite(ctx context.Context, userID, token string) (*TeamMembership, error) {
	if strings.TrimSpace(token) == "" {
		return nil, fmt.Errorf("invite token is required")
	}
	user, err := s.userByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	var invite TeamInvite
	err = s.db.QueryRowContext(ctx, `SELECT id, team_id, email, role, invited_by, expires_at, created_at
		FROM workspace_team_invites
		WHERE token_hash = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?`,
		hashToken(token), time.Now().UTC(),
	).Scan(&invite.ID, &invite.TeamID, &invite.Email, &invite.Role, &invite.InvitedBy, &invite.ExpiresAt, &invite.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(user.Email, invite.Email) {
		return nil, ErrForbidden
	}
	now := time.Now().UTC()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx, `INSERT INTO workspace_team_memberships (id, team_id, user_id, role, joined_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(team_id, user_id) DO UPDATE SET role = excluded.role`, newID(), invite.TeamID, userID, invite.Role, now)
	if err != nil {
		return nil, err
	}
	_, err = tx.ExecContext(ctx, `UPDATE workspace_team_invites SET accepted_at = ? WHERE id = ?`, now, invite.ID)
	if err != nil {
		return nil, err
	}
	if err := insertActivityTx(ctx, tx, &userID, &invite.TeamID, "team", invite.TeamID, "member_joined", map[string]any{"role": invite.Role}); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return s.teamMembership(ctx, invite.TeamID, userID)
}

func (s *Store) ListPermissionGrants(ctx context.Context, userID, resourceType, resourceID string) ([]PermissionGrant, error) {
	if resourceType == "drawing" {
		if err := s.ensureDrawingAccess(ctx, userID, resourceID, "manage"); err != nil {
			return nil, err
		}
	}
	rows, err := s.db.QueryContext(ctx, `SELECT id, resource_type, resource_id, subject_type, subject_id, permission, inherited_from, created_at
		FROM workspace_permission_grants
		WHERE resource_type = ? AND resource_id = ?
		ORDER BY created_at DESC`, resourceType, resourceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	grants := []PermissionGrant{}
	for rows.Next() {
		var grant PermissionGrant
		if err := rows.Scan(&grant.ID, &grant.ResourceType, &grant.ResourceID, &grant.SubjectType, &grant.SubjectID, &grant.Permission, &grant.InheritedFrom, &grant.CreatedAt); err != nil {
			return nil, err
		}
		grants = append(grants, grant)
	}
	return grants, rows.Err()
}

func (s *Store) CreateDrawingPermissionGrant(ctx context.Context, userID, drawingID string, req CreatePermissionGrantRequest) (*PermissionGrant, error) {
	if err := s.ensureDrawingAccess(ctx, userID, drawingID, "share"); err != nil {
		return nil, err
	}
	if !validPermission(req.Permission) {
		return nil, fmt.Errorf("invalid permission")
	}
	subjectType := req.SubjectType
	if subjectType == "" {
		subjectType = "user"
	}
	subjectID := strings.TrimSpace(req.SubjectID)
	if subjectType == "user" && subjectID == "" {
		user, err := s.userByEmail(ctx, req.Email)
		if err != nil {
			return nil, err
		}
		subjectID = user.ID
	}
	if subjectType != "user" && subjectType != "team" {
		return nil, fmt.Errorf("invalid subject type")
	}
	if subjectID == "" {
		return nil, fmt.Errorf("subject id is required")
	}
	now := time.Now().UTC()
	grant := &PermissionGrant{
		ID:           newID(),
		ResourceType: "drawing",
		ResourceID:   drawingID,
		SubjectType:  subjectType,
		SubjectID:    subjectID,
		Permission:   req.Permission,
		CreatedAt:    now,
	}
	_, err := s.db.ExecContext(ctx, `INSERT INTO workspace_permission_grants
		(id, resource_type, resource_id, subject_type, subject_id, permission, inherited_from, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(resource_type, resource_id, subject_type, subject_id, permission) DO UPDATE SET created_at = excluded.created_at`,
		grant.ID, grant.ResourceType, grant.ResourceID, grant.SubjectType, grant.SubjectID, grant.Permission, grant.InheritedFrom, grant.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	_ = s.insertActivity(ctx, &userID, nil, "drawing", drawingID, "permission_changed", map[string]any{"permission": grant.Permission, "subject_type": grant.SubjectType})
	return grant, nil
}

func (s *Store) ListShareLinks(ctx context.Context, userID, resourceType, resourceID string) ([]ShareLink, error) {
	if resourceType == "drawing" {
		if err := s.ensureDrawingAccess(ctx, userID, resourceID, "share"); err != nil {
			return nil, err
		}
	}
	rows, err := s.db.QueryContext(ctx, `SELECT id, resource_type, resource_id, token_hash, permission, expires_at, password_hash, created_by, revoked_at, created_at
		FROM workspace_share_links
		WHERE resource_type = ? AND resource_id = ? AND revoked_at IS NULL
		ORDER BY created_at DESC`, resourceType, resourceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	links := []ShareLink{}
	for rows.Next() {
		link, err := scanShareLink(rows)
		if err != nil {
			return nil, err
		}
		link.TokenHash = ""
		links = append(links, *link)
	}
	return links, rows.Err()
}

func (s *Store) CreateDrawingShareLink(ctx context.Context, userID, drawingID string, req CreateShareLinkRequest) (*ShareLink, string, error) {
	if err := s.ensureDrawingAccess(ctx, userID, drawingID, "share"); err != nil {
		return nil, "", err
	}
	permission := req.Permission
	if permission == "" {
		permission = "view"
	}
	if permission != "view" && permission != "comment" && permission != "edit" {
		return nil, "", fmt.Errorf("invalid share permission")
	}
	token, err := randomToken()
	if err != nil {
		return nil, "", err
	}
	now := time.Now().UTC()
	link := &ShareLink{
		ID:           newID(),
		ResourceType: "drawing",
		ResourceID:   drawingID,
		TokenHash:    hashToken(token),
		Permission:   permission,
		ExpiresAt:    req.ExpiresAt,
		CreatedBy:    userID,
		CreatedAt:    now,
	}
	_, err = s.db.ExecContext(ctx, `INSERT INTO workspace_share_links
		(id, resource_type, resource_id, token_hash, permission, expires_at, password_hash, created_by, revoked_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		link.ID, link.ResourceType, link.ResourceID, link.TokenHash, link.Permission, link.ExpiresAt, link.PasswordHash, link.CreatedBy, link.RevokedAt, link.CreatedAt,
	)
	if err != nil {
		return nil, "", err
	}
	link.TokenHash = ""
	_ = s.insertActivity(ctx, &userID, nil, "drawing", drawingID, "drawing_shared", map[string]any{"permission": permission})
	return link, token, nil
}

func (s *Store) SharedResourceByToken(ctx context.Context, token string) (map[string]any, error) {
	if strings.TrimSpace(token) == "" {
		return nil, ErrNotFound
	}
	row := s.db.QueryRowContext(ctx, `SELECT id, resource_type, resource_id, token_hash, permission, expires_at, password_hash, created_by, revoked_at, created_at
		FROM workspace_share_links
		WHERE token_hash = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)`,
		hashToken(token), time.Now().UTC(),
	)
	link, err := scanShareLink(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	link.TokenHash = ""
	payload := map[string]any{"share_link": link}
	if link.ResourceType == "drawing" {
		drawing, err := s.drawingByIDNoAuth(ctx, link.ResourceID)
		if err != nil {
			return nil, err
		}
		payload["drawing"] = drawing
		return payload, nil
	}
	return payload, nil
}

func (s *Store) ListDrawingAssets(ctx context.Context, userID, drawingID string) ([]DrawingAsset, error) {
	if err := s.ensureDrawingAccess(ctx, userID, drawingID, "view"); err != nil {
		return nil, err
	}
	rows, err := s.db.QueryContext(ctx, `SELECT id, drawing_id, kind, path, mime_type, size, width, height, uploaded_by, created_at
		FROM workspace_drawing_assets WHERE drawing_id = ? ORDER BY created_at DESC`, drawingID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanAssets(rows)
}

func (s *Store) CreateDrawingAsset(ctx context.Context, userID, drawingID string, req CreateAssetRequest) (*DrawingAsset, error) {
	if err := s.ensureDrawingAccess(ctx, userID, drawingID, "edit"); err != nil {
		return nil, err
	}
	if !validAssetKind(req.Kind) {
		return nil, fmt.Errorf("invalid asset kind")
	}
	if !validAssetMIME(req.MimeType) {
		return nil, fmt.Errorf("invalid asset mime type")
	}
	if req.Size <= 0 || req.Size > 25<<20 {
		return nil, fmt.Errorf("asset size must be between 1 byte and 25 MiB")
	}
	drawing, err := s.drawingByIDNoAuth(ctx, drawingID)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	asset := &DrawingAsset{
		ID:         newID(),
		DrawingID:  drawingID,
		Kind:       req.Kind,
		MimeType:   req.MimeType,
		Size:       req.Size,
		Width:      req.Width,
		Height:     req.Height,
		UploadedBy: userID,
		CreatedAt:  now,
	}
	asset.Path = fmt.Sprintf("/data/teams/%s/drawings/%s/assets/%s", drawing.TeamID, drawingID, asset.ID)
	_, err = s.db.ExecContext(ctx, `INSERT INTO workspace_drawing_assets
		(id, drawing_id, kind, path, mime_type, size, width, height, uploaded_by, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		asset.ID, asset.DrawingID, asset.Kind, asset.Path, asset.MimeType, asset.Size, asset.Width, asset.Height, asset.UploadedBy, asset.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return asset, nil
}

func (s *Store) ListEmbeds(ctx context.Context, userID, drawingID string) ([]Embed, error) {
	if err := s.ensureDrawingAccess(ctx, userID, drawingID, "view"); err != nil {
		return nil, err
	}
	rows, err := s.db.QueryContext(ctx, `SELECT id, drawing_id, source_url, canonical_url, provider, embed_type, title, preview_asset_id, safe_embed_html, created_by, created_at
		FROM workspace_embeds WHERE drawing_id = ? ORDER BY created_at DESC`, drawingID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	embeds := []Embed{}
	for rows.Next() {
		var embed Embed
		if err := rows.Scan(&embed.ID, &embed.DrawingID, &embed.SourceURL, &embed.CanonicalURL, &embed.Provider, &embed.EmbedType, &embed.Title, &embed.PreviewAssetID, &embed.SafeEmbedHTML, &embed.CreatedBy, &embed.CreatedAt); err != nil {
			return nil, err
		}
		embeds = append(embeds, embed)
	}
	return embeds, rows.Err()
}

func (s *Store) CreateEmbed(ctx context.Context, userID, drawingID string, req CreateEmbedRequest) (*Embed, error) {
	if err := s.ensureDrawingAccess(ctx, userID, drawingID, "edit"); err != nil {
		return nil, err
	}
	canonical, provider, err := validateEmbedURL(req.SourceURL)
	if err != nil {
		return nil, err
	}
	embedType := req.EmbedType
	if embedType == "" {
		embedType = "link"
	}
	if embedType != "link" && embedType != "iframe" && embedType != "provider" {
		return nil, fmt.Errorf("invalid embed type")
	}
	now := time.Now().UTC()
	embed := &Embed{
		ID:           newID(),
		DrawingID:    drawingID,
		SourceURL:    canonical,
		CanonicalURL: canonical,
		Provider:     provider,
		EmbedType:    embedType,
		Title:        req.Title,
		CreatedBy:    userID,
		CreatedAt:    now,
	}
	_, err = s.db.ExecContext(ctx, `INSERT INTO workspace_embeds
		(id, drawing_id, source_url, canonical_url, provider, embed_type, title, preview_asset_id, safe_embed_html, created_by, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		embed.ID, embed.DrawingID, embed.SourceURL, embed.CanonicalURL, embed.Provider, embed.EmbedType, embed.Title, embed.PreviewAssetID, embed.SafeEmbedHTML, embed.CreatedBy, embed.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	_ = s.insertActivity(ctx, &userID, nil, "drawing", drawingID, "embed_created", map[string]any{"provider": provider, "embed_type": embedType})
	return embed, nil
}

func (s *Store) ListLinkReferences(ctx context.Context, userID, resourceType, resourceID string) ([]LinkReference, error) {
	if resourceType == "drawing" {
		if err := s.ensureDrawingAccess(ctx, userID, resourceID, "view"); err != nil {
			return nil, err
		}
	}
	rows, err := s.db.QueryContext(ctx, `SELECT id, source_resource_type, source_resource_id, target_resource_type, target_resource_id, label, created_by, created_at
		FROM workspace_link_references
		WHERE source_resource_type = ? AND source_resource_id = ?
		ORDER BY created_at DESC`, resourceType, resourceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	links := []LinkReference{}
	for rows.Next() {
		var link LinkReference
		if err := rows.Scan(&link.ID, &link.SourceResourceType, &link.SourceResourceID, &link.TargetResourceType, &link.TargetResourceID, &link.Label, &link.CreatedBy, &link.CreatedAt); err != nil {
			return nil, err
		}
		links = append(links, link)
	}
	return links, rows.Err()
}

func (s *Store) CreateDrawingLinkReference(ctx context.Context, userID, drawingID string, req CreateLinkRequest) (*LinkReference, error) {
	if err := s.ensureDrawingAccess(ctx, userID, drawingID, "edit"); err != nil {
		return nil, err
	}
	drawing, err := s.drawingByIDNoAuth(ctx, drawingID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureTargetInTeam(ctx, drawing.TeamID, req.TargetResourceType, req.TargetResourceID); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	link := &LinkReference{
		ID:                 newID(),
		SourceResourceType: "drawing",
		SourceResourceID:   drawingID,
		TargetResourceType: req.TargetResourceType,
		TargetResourceID:   req.TargetResourceID,
		Label:              req.Label,
		CreatedBy:          userID,
		CreatedAt:          now,
	}
	_, err = s.db.ExecContext(ctx, `INSERT INTO workspace_link_references
		(id, source_resource_type, source_resource_id, target_resource_type, target_resource_id, label, created_by, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		link.ID, link.SourceResourceType, link.SourceResourceID, link.TargetResourceType, link.TargetResourceID, link.Label, link.CreatedBy, link.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return link, nil
}

func (s *Store) ensureTeamPermission(ctx context.Context, userID, teamID, permission string) error {
	role, err := s.teamRole(ctx, userID, teamID)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrForbidden
	}
	if err != nil {
		return err
	}
	if roleAllows(role, permission) {
		return nil
	}
	return ErrForbidden
}

func (s *Store) teamRole(ctx context.Context, userID, teamID string) (string, error) {
	var role string
	err := s.db.QueryRowContext(ctx, `SELECT role FROM workspace_team_memberships WHERE user_id = ? AND team_id = ?`, userID, teamID).Scan(&role)
	return role, err
}

func (s *Store) userByID(ctx context.Context, userID string) (*User, error) {
	var user User
	err := s.db.QueryRowContext(ctx, `SELECT id, name, username, email, avatar_url, locale, timezone, created_at, updated_at FROM workspace_users WHERE id = ?`, userID).
		Scan(&user.ID, &user.Name, &user.Username, &user.Email, &user.AvatarURL, &user.Locale, &user.Timezone, &user.CreatedAt, &user.UpdatedAt)
	return &user, err
}

func (s *Store) userByEmail(ctx context.Context, email string) (*User, error) {
	email, err := normalizeEmail(email)
	if err != nil {
		return nil, err
	}
	var user User
	err = s.db.QueryRowContext(ctx, `SELECT id, name, username, email, avatar_url, locale, timezone, created_at, updated_at FROM workspace_users WHERE email = ?`, email).
		Scan(&user.ID, &user.Name, &user.Username, &user.Email, &user.AvatarURL, &user.Locale, &user.Timezone, &user.CreatedAt, &user.UpdatedAt)
	return &user, err
}

func (s *Store) teamMembership(ctx context.Context, teamID, userID string) (*TeamMembership, error) {
	var member TeamMembership
	err := s.db.QueryRowContext(ctx, `SELECT id, team_id, user_id, role, joined_at FROM workspace_team_memberships WHERE team_id = ? AND user_id = ?`, teamID, userID).
		Scan(&member.ID, &member.TeamID, &member.UserID, &member.Role, &member.JoinedAt)
	if err != nil {
		return nil, err
	}
	user, err := s.userByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	member.User = user
	return &member, nil
}

func (s *Store) drawingByIDNoAuth(ctx context.Context, drawingID string) (*Drawing, error) {
	row := s.db.QueryRowContext(ctx, `SELECT d.id, d.team_id, d.folder_id, d.project_id, d.slug, d.title, d.description,
		d.owner_user_id, d.latest_revision_id, d.visibility, d.is_archived, d.thumbnail_asset_id, d.created_at, d.updated_at, d.deleted_at,
		u.id, u.name, u.username, u.email, u.avatar_url, u.locale, u.timezone, u.created_at, u.updated_at
		FROM workspace_drawings d
		JOIN workspace_users u ON u.id = d.owner_user_id
		WHERE d.id = ? AND d.deleted_at IS NULL`, drawingID)
	return scanDrawing(row)
}

func (s *Store) ensureTargetInTeam(ctx context.Context, teamID, resourceType, resourceID string) error {
	var found int
	var query string
	switch resourceType {
	case "drawing":
		query = `SELECT 1 FROM workspace_drawings WHERE id = ? AND team_id = ? AND deleted_at IS NULL`
	case "folder":
		query = `SELECT 1 FROM workspace_folders WHERE id = ? AND team_id = ?`
	case "project":
		query = `SELECT 1 FROM workspace_projects WHERE id = ? AND team_id = ?`
	case "embed":
		query = `SELECT 1 FROM workspace_embeds e JOIN workspace_drawings d ON d.id = e.drawing_id WHERE e.id = ? AND d.team_id = ?`
	default:
		return fmt.Errorf("invalid target resource type")
	}
	err := s.db.QueryRowContext(ctx, query, resourceID, teamID).Scan(&found)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

func (s *Store) grantAllows(ctx context.Context, resourceType, resourceID, userID, teamID, required string) (bool, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT permission FROM workspace_permission_grants
		WHERE resource_type = ? AND resource_id = ? AND (
			(subject_type = 'user' AND subject_id = ?) OR
			(subject_type = 'team' AND subject_id = ?)
		)`, resourceType, resourceID, userID, teamID)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	for rows.Next() {
		var permission string
		if err := rows.Scan(&permission); err != nil {
			return false, err
		}
		if permissionAllows(permission, required) {
			return true, nil
		}
	}
	return false, rows.Err()
}

func scanShareLink(scanner interface{ Scan(dest ...any) error }) (*ShareLink, error) {
	var link ShareLink
	err := scanner.Scan(&link.ID, &link.ResourceType, &link.ResourceID, &link.TokenHash, &link.Permission, &link.ExpiresAt, &link.PasswordHash, &link.CreatedBy, &link.RevokedAt, &link.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &link, nil
}

func scanAssets(rows *sql.Rows) ([]DrawingAsset, error) {
	assets := []DrawingAsset{}
	for rows.Next() {
		var asset DrawingAsset
		if err := rows.Scan(&asset.ID, &asset.DrawingID, &asset.Kind, &asset.Path, &asset.MimeType, &asset.Size, &asset.Width, &asset.Height, &asset.UploadedBy, &asset.CreatedAt); err != nil {
			return nil, err
		}
		assets = append(assets, asset)
	}
	return assets, rows.Err()
}

func roleAllows(role, permission string) bool {
	switch role {
	case "owner", "admin":
		return true
	case "editor":
		return permission == "view" || permission == "comment" || permission == "edit"
	case "viewer":
		return permission == "view"
	default:
		return false
	}
}

func permissionAllows(grant, required string) bool {
	if grant == required {
		return true
	}
	switch grant {
	case "manage":
		return true
	case "edit":
		return required == "view" || required == "comment" || required == "edit"
	case "comment":
		return required == "view" || required == "comment"
	case "share":
		return required == "view" || required == "share"
	case "invite":
		return required == "view" || required == "invite"
	case "view":
		return required == "view"
	default:
		return false
	}
}

func validPermission(permission string) bool {
	switch permission {
	case "view", "comment", "edit", "manage", "share", "invite":
		return true
	default:
		return false
	}
}

func validTeamRole(role string) bool {
	switch role {
	case "owner", "admin", "editor", "viewer":
		return true
	default:
		return false
	}
}

func validAssetKind(kind string) bool {
	switch kind {
	case "image", "export", "attachment", "thumbnail":
		return true
	default:
		return false
	}
}

func validAssetMIME(mimeType string) bool {
	switch mimeType {
	case "image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "application/json", "text/plain":
		return true
	default:
		return false
	}
}

func validateEmbedURL(raw string) (string, string, error) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return "", "", fmt.Errorf("invalid URL")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", "", fmt.Errorf("embed URL must use http or https")
	}
	if parsed.User != nil {
		return "", "", fmt.Errorf("embed URL must not include credentials")
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "" || host == "localhost" || strings.HasSuffix(host, ".localhost") {
		return "", "", fmt.Errorf("embed URL host is not allowed")
	}
	if ip := net.ParseIP(host); ip != nil {
		addr, ok := netip.AddrFromSlice(ip)
		if !ok || !addr.IsGlobalUnicast() || addr.IsPrivate() || addr.IsLoopback() || addr.IsLinkLocalUnicast() {
			return "", "", fmt.Errorf("embed URL host is not allowed")
		}
	}
	parsed.Fragment = ""
	return parsed.String(), host, nil
}
