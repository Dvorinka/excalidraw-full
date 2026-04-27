package workspace

import (
	"bytes"
	"context"
	"encoding/json"
	dbpostgres "excalidraw-complete/internal/postgres"
	"net/url"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func newTestStore(t *testing.T) (*Store, func()) {
	t.Helper()
	baseURL := os.Getenv("TEST_DATABASE_URL")
	if baseURL == "" {
		baseURL = os.Getenv("DATABASE_URL")
	}
	if baseURL == "" {
		t.Skip("TEST_DATABASE_URL or DATABASE_URL is required for PostgreSQL workspace tests")
	}
	schema := "test_" + strings.ToLower(newID())
	adminDB, err := dbpostgres.Open(baseURL)
	if err != nil {
		t.Fatalf("open test database error = %v", err)
	}
	if _, err := adminDB.DB.ExecContext(context.Background(), `CREATE SCHEMA "`+schema+`"`); err != nil {
		adminDB.Close()
		t.Fatalf("create test schema error = %v", err)
	}
	store, err := NewStore(databaseURLWithSearchPath(t, baseURL, schema))
	if err != nil {
		adminDB.DB.ExecContext(context.Background(), `DROP SCHEMA "`+schema+`" CASCADE`)
		adminDB.Close()
		t.Fatalf("NewStore() error = %v", err)
	}
	return store, func() {
		if err := store.Close(); err != nil {
			t.Fatalf("Close() error = %v", err)
		}
		if _, err := adminDB.DB.ExecContext(context.Background(), `DROP SCHEMA "`+schema+`" CASCADE`); err != nil {
			t.Fatalf("drop test schema error = %v", err)
		}
		if err := adminDB.Close(); err != nil {
			t.Fatalf("admin Close() error = %v", err)
		}
	}
}

func databaseURLWithSearchPath(t *testing.T, rawURL, schema string) string {
	t.Helper()
	parsed, err := url.Parse(rawURL)
	if err != nil {
		t.Fatalf("parse database URL error = %v", err)
	}
	q := parsed.Query()
	q.Set("search_path", schema)
	parsed.RawQuery = q.Encode()
	return parsed.String()
}

func newTestAPI(t *testing.T) (*API, func()) {
	t.Helper()
	store, cleanup := newTestStore(t)
	api := NewAPI(store)
	api.testMode = true
	return api, cleanup
}

func doJSON(t *testing.T, api *API, method, path string, body any, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	var raw bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&raw).Encode(body); err != nil {
			t.Fatalf("json encode error = %v", err)
		}
	}
	req := httptest.NewRequest(method, path, &raw)
	req.Header.Set("Content-Type", "application/json")
	for _, cookie := range cookies {
		req.AddCookie(cookie)
	}
	rr := httptest.NewRecorder()
	api.Routes().ServeHTTP(rr, req)
	return rr
}

func signup(t *testing.T, api *API, email string) (*http.Cookie, User, Team) {
	t.Helper()
	rr := doJSON(t, api, http.MethodPost, "/auth/signup", map[string]string{
		"name":     "Test User",
		"email":    email,
		"password": "password-123",
	})
	if rr.Code != http.StatusCreated {
		t.Fatalf("signup status = %d body = %s", rr.Code, rr.Body.String())
	}
	var payload struct {
		User User `json:"user"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("signup response decode error = %v", err)
	}
	var sessionCookie *http.Cookie
	for _, cookie := range rr.Result().Cookies() {
		if cookie.Name == sessionCookieName {
			copy := *cookie
			sessionCookie = &copy
			break
		}
	}
	if sessionCookie == nil {
		t.Fatal("signup did not set session cookie")
	}
	teamsRR := doJSON(t, api, http.MethodGet, "/teams", nil, sessionCookie)
	if teamsRR.Code != http.StatusOK {
		t.Fatalf("teams status = %d body = %s", teamsRR.Code, teamsRR.Body.String())
	}
	var teams []Team
	if err := json.Unmarshal(teamsRR.Body.Bytes(), &teams); err != nil {
		t.Fatalf("teams decode error = %v", err)
	}
	if len(teams) != 1 {
		t.Fatalf("teams len = %d, want 1", len(teams))
	}
	return sessionCookie, payload.User, teams[0]
}

func TestSignupCreatesCookieSessionAndDefaultTeam(t *testing.T) {
	api, cleanup := newTestAPI(t)
	defer cleanup()

	cookie, user, team := signup(t, api, "alice@example.com")
	if !cookie.HttpOnly {
		t.Fatal("session cookie must be httpOnly")
	}
	if user.ID == "" || user.Email != "alice@example.com" {
		t.Fatalf("unexpected user: %#v", user)
	}
	if team.OwnerUserID != user.ID || team.PlanType != "free" {
		t.Fatalf("unexpected team: %#v", team)
	}

	meRR := doJSON(t, api, http.MethodGet, "/auth/me", nil, cookie)
	if meRR.Code != http.StatusOK {
		t.Fatalf("me status = %d body = %s", meRR.Code, meRR.Body.String())
	}

	logoutRR := doJSON(t, api, http.MethodPost, "/auth/logout", nil, cookie)
	if logoutRR.Code != http.StatusOK {
		t.Fatalf("logout status = %d body = %s", logoutRR.Code, logoutRR.Body.String())
	}
	if logoutRR.Body.String() == "" {
		t.Fatal("logout must return JSON for frontend fetchApi compatibility")
	}

	afterLogoutRR := doJSON(t, api, http.MethodGet, "/auth/me", nil, cookie)
	if afterLogoutRR.Code != http.StatusUnauthorized {
		t.Fatalf("me after logout status = %d body = %s", afterLogoutRR.Code, afterLogoutRR.Body.String())
	}
}

func TestDrawingAccessRequiresTeamMembership(t *testing.T) {
	api, cleanup := newTestAPI(t)
	defer cleanup()

	aliceCookie, _, aliceTeam := signup(t, api, "alice@example.com")
	bobCookie, _, _ := signup(t, api, "bob@example.com")

	createRR := doJSON(t, api, http.MethodPost, "/drawings", map[string]any{
		"team_id": aliceTeam.ID,
		"title":   "Architecture map",
	}, aliceCookie)
	if createRR.Code != http.StatusCreated {
		t.Fatalf("create drawing status = %d body = %s", createRR.Code, createRR.Body.String())
	}
	var drawing Drawing
	if err := json.Unmarshal(createRR.Body.Bytes(), &drawing); err != nil {
		t.Fatalf("drawing decode error = %v", err)
	}

	forbiddenRR := doJSON(t, api, http.MethodGet, "/drawings/"+drawing.ID, nil, bobCookie)
	if forbiddenRR.Code != http.StatusForbidden {
		t.Fatalf("bob get drawing status = %d body = %s", forbiddenRR.Code, forbiddenRR.Body.String())
	}

	listRR := doJSON(t, api, http.MethodGet, "/drawings?team_id="+aliceTeam.ID, nil, bobCookie)
	if listRR.Code != http.StatusForbidden {
		t.Fatalf("bob list team drawings status = %d body = %s", listRR.Code, listRR.Body.String())
	}
}

func TestTeamMembersRequireMembership(t *testing.T) {
	api, cleanup := newTestAPI(t)
	defer cleanup()

	aliceCookie, _, aliceTeam := signup(t, api, "alice@example.com")
	bobCookie, _, _ := signup(t, api, "bob@example.com")

	okRR := doJSON(t, api, http.MethodGet, "/teams/"+aliceTeam.ID+"/members", nil, aliceCookie)
	if okRR.Code != http.StatusOK {
		t.Fatalf("alice members status = %d body = %s", okRR.Code, okRR.Body.String())
	}
	var members []TeamMembership
	if err := json.Unmarshal(okRR.Body.Bytes(), &members); err != nil {
		t.Fatalf("members decode error = %v", err)
	}
	if len(members) != 1 || members[0].Role != "owner" || members[0].User == nil {
		t.Fatalf("unexpected members: %#v", members)
	}

	forbiddenRR := doJSON(t, api, http.MethodGet, "/teams/"+aliceTeam.ID+"/members", nil, bobCookie)
	if forbiddenRR.Code != http.StatusForbidden {
		t.Fatalf("bob members status = %d body = %s", forbiddenRR.Code, forbiddenRR.Body.String())
	}
}

func TestDrawingRevisionsTemplatesAndActivity(t *testing.T) {
	api, cleanup := newTestAPI(t)
	defer cleanup()

	cookie, _, team := signup(t, api, "alice@example.com")
	createRR := doJSON(t, api, http.MethodPost, "/drawings", map[string]any{
		"team_id":  team.ID,
		"title":    "Launch plan",
		"snapshot": map[string]any{"type": "excalidraw", "elements": []any{}},
	}, cookie)
	if createRR.Code != http.StatusCreated {
		t.Fatalf("create drawing status = %d body = %s", createRR.Code, createRR.Body.String())
	}
	var drawing Drawing
	if err := json.Unmarshal(createRR.Body.Bytes(), &drawing); err != nil {
		t.Fatalf("drawing decode error = %v", err)
	}
	if drawing.LatestRevisionID == nil {
		t.Fatal("create drawing with snapshot must create latest_revision_id")
	}

	revisionRR := doJSON(t, api, http.MethodPost, "/drawings/"+drawing.ID+"/revisions", map[string]any{
		"snapshot":       map[string]any{"type": "excalidraw", "elements": []any{map[string]any{"id": "a"}}},
		"change_summary": "Added first shape",
	}, cookie)
	if revisionRR.Code != http.StatusCreated {
		t.Fatalf("create revision status = %d body = %s", revisionRR.Code, revisionRR.Body.String())
	}

	revisionsRR := doJSON(t, api, http.MethodGet, "/drawings/"+drawing.ID+"/revisions", nil, cookie)
	if revisionsRR.Code != http.StatusOK {
		t.Fatalf("list revisions status = %d body = %s", revisionsRR.Code, revisionsRR.Body.String())
	}
	var revisions []DrawingRevision
	if err := json.Unmarshal(revisionsRR.Body.Bytes(), &revisions); err != nil {
		t.Fatalf("revisions decode error = %v", err)
	}
	if len(revisions) != 2 || revisions[0].RevisionNumber != 2 {
		t.Fatalf("unexpected revisions: %#v", revisions)
	}

	templatesRR := doJSON(t, api, http.MethodGet, "/templates", nil, cookie)
	if templatesRR.Code != http.StatusOK {
		t.Fatalf("templates status = %d body = %s", templatesRR.Code, templatesRR.Body.String())
	}
	var templates []Template
	if err := json.Unmarshal(templatesRR.Body.Bytes(), &templates); err != nil {
		t.Fatalf("templates decode error = %v", err)
	}
	if len(templates) < 4 {
		t.Fatalf("templates len = %d, want at least 4", len(templates))
	}

	activityRR := doJSON(t, api, http.MethodGet, "/activity?team_id="+team.ID, nil, cookie)
	if activityRR.Code != http.StatusOK {
		t.Fatalf("activity status = %d body = %s", activityRR.Code, activityRR.Body.String())
	}
	var activity []ActivityEvent
	if err := json.Unmarshal(activityRR.Body.Bytes(), &activity); err != nil {
		t.Fatalf("activity decode error = %v", err)
	}
	if len(activity) == 0 {
		t.Fatal("expected activity events")
	}

	statsRR := doJSON(t, api, http.MethodGet, "/stats?team_id="+team.ID, nil, cookie)
	if statsRR.Code != http.StatusOK {
		t.Fatalf("stats status = %d body = %s", statsRR.Code, statsRR.Body.String())
	}
	var stats WorkspaceStats
	if err := json.Unmarshal(statsRR.Body.Bytes(), &stats); err != nil {
		t.Fatalf("stats decode error = %v", err)
	}
	if stats.Drawings != 1 || stats.Revisions != 2 || stats.Templates < 4 {
		t.Fatalf("unexpected stats: %#v", stats)
	}
}

func TestHealth(t *testing.T) {
	api, cleanup := newTestAPI(t)
	defer cleanup()

	rr := doJSON(t, api, http.MethodGet, "/health", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("health status = %d body = %s", rr.Code, rr.Body.String())
	}
}
