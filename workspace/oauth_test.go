package workspace

import (
	"context"
	"testing"
)

func TestUpsertOAuthSessionCreatesAndReusesIdentity(t *testing.T) {
	store, cleanup := newTestStore(t)
	defer cleanup()

	profile := OAuthProfile{
		Provider:       "github",
		ProviderUserID: "123",
		Email:          "octo@example.com",
		Name:           "Octo User",
		Username:       "octo",
		AvatarURL:      "https://example.com/avatar.png",
		EmailVerified:  true,
	}
	user, session, token, err := store.UpsertOAuthSession(context.Background(), profile)
	if err != nil {
		t.Fatalf("UpsertOAuthSession() error = %v", err)
	}
	if user.ID == "" || session.ID == "" || token == "" {
		t.Fatalf("missing oauth output user=%#v session=%#v token=%q", user, session, token)
	}
	teams, err := store.ListTeamsForUser(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("ListTeamsForUser() error = %v", err)
	}
	if len(teams) != 1 {
		t.Fatalf("teams len = %d, want 1", len(teams))
	}

	sameUser, secondSession, secondToken, err := store.UpsertOAuthSession(context.Background(), profile)
	if err != nil {
		t.Fatalf("second UpsertOAuthSession() error = %v", err)
	}
	if sameUser.ID != user.ID {
		t.Fatalf("second oauth user id = %s, want %s", sameUser.ID, user.ID)
	}
	if secondSession.ID == session.ID || secondToken == token {
		t.Fatal("oauth login should create a fresh session")
	}
}
