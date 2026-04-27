package workspace

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	dbpostgres "excalidraw-complete/internal/postgres"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type OAuthProfile struct {
	Provider       string
	ProviderUserID string
	Email          string
	Name           string
	Username       string
	AvatarURL      string
	EmailVerified  bool
}

func (s *Store) UpsertOAuthSession(ctx context.Context, profile OAuthProfile) (*User, *Session, string, error) {
	profile.Provider = strings.TrimSpace(strings.ToLower(profile.Provider))
	profile.ProviderUserID = strings.TrimSpace(profile.ProviderUserID)
	if profile.Provider == "" || profile.ProviderUserID == "" {
		return nil, nil, "", fmt.Errorf("oauth provider and provider user id are required")
	}
	email := strings.TrimSpace(profile.Email)
	if email == "" {
		email = fmt.Sprintf("%s-%s@users.local", profile.Provider, slugify(profile.ProviderUserID))
	}
	normalizedEmail, err := normalizeEmail(email)
	if err != nil {
		return nil, nil, "", err
	}
	name := strings.TrimSpace(profile.Name)
	if name == "" {
		name = strings.TrimSpace(profile.Username)
	}
	if name == "" {
		name = normalizedEmail
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, nil, "", err
	}
	defer tx.Rollback()

	userID, err := userIDByIdentityTx(ctx, tx, profile.Provider, profile.ProviderUserID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, nil, "", err
	}

	now := time.Now().UTC()
	var user *User
	if userID != "" {
		user, err = updateOAuthUserTx(ctx, tx, userID, name, profile.Username, normalizedEmail, profile.AvatarURL)
		if err != nil {
			return nil, nil, "", err
		}
	} else {
		userID, err = userIDByEmailTx(ctx, tx, normalizedEmail)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return nil, nil, "", err
		}
		if userID == "" {
			user, err = createOAuthUserTx(ctx, tx, name, profile.Username, normalizedEmail, profile.AvatarURL)
			if err != nil {
				return nil, nil, "", err
			}
			team, err := createTeamTx(ctx, tx, user.ID, name+"'s Workspace", "")
			if err != nil {
				return nil, nil, "", err
			}
			if err := insertActivityTx(ctx, tx, &user.ID, &team.ID, "team", team.ID, "member_joined", map[string]any{"role": "owner"}); err != nil {
				return nil, nil, "", err
			}
		} else {
			user, err = updateOAuthUserTx(ctx, tx, userID, name, profile.Username, normalizedEmail, profile.AvatarURL)
			if err != nil {
				return nil, nil, "", err
			}
		}
		var verifiedAt *time.Time
		if profile.EmailVerified {
			verifiedAt = &now
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO workspace_auth_identities
			(id, user_id, provider, provider_user_id, email_verified_at, created_at)
			VALUES (?, ?, ?, ?, ?, ?)`,
			newID(), user.ID, profile.Provider, profile.ProviderUserID, verifiedAt, now,
		)
		if err != nil {
			return nil, nil, "", err
		}
	}

	session, token, err := createSessionTx(ctx, tx, user.ID)
	if err != nil {
		return nil, nil, "", err
	}
	if err := insertActivityTx(ctx, tx, &user.ID, nil, "user", user.ID, "login_success", map[string]any{"provider": profile.Provider}); err != nil {
		return nil, nil, "", err
	}
	if err := tx.Commit(); err != nil {
		return nil, nil, "", err
	}
	return user, session, token, nil
}

func userIDByIdentityTx(ctx context.Context, tx *dbpostgres.Tx, provider, providerUserID string) (string, error) {
	var userID string
	err := tx.QueryRowContext(ctx, `SELECT user_id FROM workspace_auth_identities WHERE provider = ? AND provider_user_id = ?`, provider, providerUserID).Scan(&userID)
	return userID, err
}

func userIDByEmailTx(ctx context.Context, tx *dbpostgres.Tx, email string) (string, error) {
	var userID string
	err := tx.QueryRowContext(ctx, `SELECT id FROM workspace_users WHERE email = ?`, email).Scan(&userID)
	return userID, err
}

func createOAuthUserTx(ctx context.Context, tx *dbpostgres.Tx, name, username, email, avatarURL string) (*User, error) {
	password := make([]byte, 32)
	if _, err := rand.Read(password); err != nil {
		return nil, err
	}
	hash, err := bcrypt.GenerateFromPassword(password, 12)
	if err != nil {
		return nil, err
	}
	if username == "" {
		username = strings.TrimSuffix(email, email[strings.LastIndex(email, "@"):])
	}
	now := time.Now().UTC()
	user := &User{
		ID:        newID(),
		Name:      name,
		Username:  uniqueUsername(ctx, tx, slugify(username)),
		Email:     email,
		Locale:    "en",
		Timezone:  "UTC",
		CreatedAt: now,
		UpdatedAt: now,
	}
	if avatarURL != "" {
		user.AvatarURL = &avatarURL
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO workspace_users
		(id, name, username, email, password_hash, avatar_url, locale, timezone, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		user.ID, user.Name, user.Username, user.Email, string(hash), user.AvatarURL, user.Locale, user.Timezone, user.CreatedAt, user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func updateOAuthUserTx(ctx context.Context, tx *dbpostgres.Tx, userID, name, username, email, avatarURL string) (*User, error) {
	current := &User{}
	var currentAvatar *string
	err := tx.QueryRowContext(ctx, `SELECT id, name, username, email, avatar_url, locale, timezone, created_at, updated_at FROM workspace_users WHERE id = ?`, userID).
		Scan(&current.ID, &current.Name, &current.Username, &current.Email, &currentAvatar, &current.Locale, &current.Timezone, &current.CreatedAt, &current.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(name) == "" {
		name = current.Name
	}
	if strings.TrimSpace(username) == "" {
		username = current.Username
	}
	avatar := currentAvatar
	if avatarURL != "" {
		avatar = &avatarURL
	}
	now := time.Now().UTC()
	_, err = tx.ExecContext(ctx, `UPDATE workspace_users SET name = ?, avatar_url = ?, updated_at = ? WHERE id = ?`, name, avatar, now, userID)
	if err != nil {
		return nil, err
	}
	current.Name = name
	current.AvatarURL = avatar
	current.UpdatedAt = now
	return current, nil
}
