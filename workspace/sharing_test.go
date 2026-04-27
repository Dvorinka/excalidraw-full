package workspace

import (
	"encoding/json"
	"net/http"
	"testing"
)

func TestInviteAcceptAddsEditorMembership(t *testing.T) {
	api, cleanup := newTestAPI(t)
	defer cleanup()

	aliceCookie, _, aliceTeam := signup(t, api, "alice@example.com")
	bobCookie, _, _ := signup(t, api, "bob@example.com")

	inviteRR := doJSON(t, api, http.MethodPost, "/teams/"+aliceTeam.ID+"/invites", map[string]any{
		"email": "bob@example.com",
		"role":  "editor",
	}, aliceCookie)
	if inviteRR.Code != http.StatusCreated {
		t.Fatalf("invite status = %d body = %s", inviteRR.Code, inviteRR.Body.String())
	}
	var invite struct {
		Invite TeamInvite `json:"invite"`
		Token  string     `json:"token"`
	}
	if err := json.Unmarshal(inviteRR.Body.Bytes(), &invite); err != nil {
		t.Fatalf("invite decode error = %v", err)
	}
	if invite.Token == "" || invite.Invite.Email != "bob@example.com" {
		t.Fatalf("unexpected invite: %#v", invite)
	}

	beforeRR := doJSON(t, api, http.MethodGet, "/teams/"+aliceTeam.ID+"/members", nil, bobCookie)
	if beforeRR.Code != http.StatusForbidden {
		t.Fatalf("bob members before accept status = %d body = %s", beforeRR.Code, beforeRR.Body.String())
	}

	acceptRR := doJSON(t, api, http.MethodPost, "/invites/accept", map[string]string{"token": invite.Token}, bobCookie)
	if acceptRR.Code != http.StatusOK {
		t.Fatalf("accept status = %d body = %s", acceptRR.Code, acceptRR.Body.String())
	}

	afterRR := doJSON(t, api, http.MethodGet, "/teams/"+aliceTeam.ID+"/members", nil, bobCookie)
	if afterRR.Code != http.StatusOK {
		t.Fatalf("bob members after accept status = %d body = %s", afterRR.Code, afterRR.Body.String())
	}
}

func TestRestrictedDrawingGrantAllowsViewNotEdit(t *testing.T) {
	api, cleanup := newTestAPI(t)
	defer cleanup()

	aliceCookie, _, aliceTeam := signup(t, api, "alice@example.com")
	bobCookie, _, _ := signup(t, api, "bob@example.com")

	createRR := doJSON(t, api, http.MethodPost, "/drawings", map[string]any{
		"team_id":    aliceTeam.ID,
		"title":      "Restricted map",
		"visibility": "restricted",
	}, aliceCookie)
	if createRR.Code != http.StatusCreated {
		t.Fatalf("create drawing status = %d body = %s", createRR.Code, createRR.Body.String())
	}
	var drawing Drawing
	if err := json.Unmarshal(createRR.Body.Bytes(), &drawing); err != nil {
		t.Fatalf("drawing decode error = %v", err)
	}

	noAccessRR := doJSON(t, api, http.MethodGet, "/drawings/"+drawing.ID, nil, bobCookie)
	if noAccessRR.Code != http.StatusForbidden {
		t.Fatalf("bob get before grant status = %d body = %s", noAccessRR.Code, noAccessRR.Body.String())
	}

	grantRR := doJSON(t, api, http.MethodPost, "/drawings/"+drawing.ID+"/permissions", map[string]any{
		"subject_type": "user",
		"email":        "bob@example.com",
		"permission":   "view",
	}, aliceCookie)
	if grantRR.Code != http.StatusCreated {
		t.Fatalf("grant status = %d body = %s", grantRR.Code, grantRR.Body.String())
	}

	getRR := doJSON(t, api, http.MethodGet, "/drawings/"+drawing.ID, nil, bobCookie)
	if getRR.Code != http.StatusOK {
		t.Fatalf("bob get after grant status = %d body = %s", getRR.Code, getRR.Body.String())
	}

	editRR := doJSON(t, api, http.MethodPost, "/drawings/"+drawing.ID+"/revisions", map[string]any{
		"snapshot": map[string]any{"type": "excalidraw", "elements": []any{}},
	}, bobCookie)
	if editRR.Code != http.StatusForbidden {
		t.Fatalf("bob edit with view grant status = %d body = %s", editRR.Code, editRR.Body.String())
	}
}

func TestShareLinkAllowsUnauthenticatedDrawingRead(t *testing.T) {
	api, cleanup := newTestAPI(t)
	defer cleanup()

	aliceCookie, _, aliceTeam := signup(t, api, "alice@example.com")
	createRR := doJSON(t, api, http.MethodPost, "/drawings", map[string]any{
		"team_id": aliceTeam.ID,
		"title":   "Shared map",
	}, aliceCookie)
	if createRR.Code != http.StatusCreated {
		t.Fatalf("create drawing status = %d body = %s", createRR.Code, createRR.Body.String())
	}
	var drawing Drawing
	if err := json.Unmarshal(createRR.Body.Bytes(), &drawing); err != nil {
		t.Fatalf("drawing decode error = %v", err)
	}

	shareRR := doJSON(t, api, http.MethodPost, "/drawings/"+drawing.ID+"/share-links", map[string]any{
		"permission": "view",
	}, aliceCookie)
	if shareRR.Code != http.StatusCreated {
		t.Fatalf("share status = %d body = %s", shareRR.Code, shareRR.Body.String())
	}
	var share struct {
		ShareLink ShareLink `json:"share_link"`
		Token     string    `json:"token"`
	}
	if err := json.Unmarshal(shareRR.Body.Bytes(), &share); err != nil {
		t.Fatalf("share decode error = %v", err)
	}
	if share.Token == "" || share.ShareLink.TokenHash != "" {
		t.Fatalf("unexpected share response: %#v", share)
	}

	publicRR := doJSON(t, api, http.MethodGet, "/shared/"+share.Token, nil)
	if publicRR.Code != http.StatusOK {
		t.Fatalf("public shared status = %d body = %s", publicRR.Code, publicRR.Body.String())
	}
}

func TestEmbedsRejectUnsafeURLs(t *testing.T) {
	api, cleanup := newTestAPI(t)
	defer cleanup()

	cookie, _, team := signup(t, api, "alice@example.com")
	createRR := doJSON(t, api, http.MethodPost, "/drawings", map[string]any{
		"team_id": team.ID,
		"title":   "Embed map",
	}, cookie)
	if createRR.Code != http.StatusCreated {
		t.Fatalf("create drawing status = %d body = %s", createRR.Code, createRR.Body.String())
	}
	var drawing Drawing
	if err := json.Unmarshal(createRR.Body.Bytes(), &drawing); err != nil {
		t.Fatalf("drawing decode error = %v", err)
	}

	for _, unsafeURL := range []string{"javascript:alert(1)", "http://127.0.0.1/admin", "http://localhost:3002"} {
		rr := doJSON(t, api, http.MethodPost, "/drawings/"+drawing.ID+"/embeds", map[string]any{
			"source_url": unsafeURL,
			"embed_type": "link",
		}, cookie)
		if rr.Code != http.StatusBadRequest {
			t.Fatalf("unsafe url %q status = %d body = %s", unsafeURL, rr.Code, rr.Body.String())
		}
	}

	safeRR := doJSON(t, api, http.MethodPost, "/drawings/"+drawing.ID+"/embeds", map[string]any{
		"source_url": "https://example.com/roadmap",
		"embed_type": "link",
	}, cookie)
	if safeRR.Code != http.StatusCreated {
		t.Fatalf("safe embed status = %d body = %s", safeRR.Code, safeRR.Body.String())
	}
}

func TestAssetsAndLinkReferences(t *testing.T) {
	api, cleanup := newTestAPI(t)
	defer cleanup()

	cookie, _, team := signup(t, api, "alice@example.com")
	projectRR := doJSON(t, api, http.MethodPost, "/projects", map[string]any{
		"team_id": team.ID,
		"name":    "Roadmap",
	}, cookie)
	if projectRR.Code != http.StatusCreated {
		t.Fatalf("project status = %d body = %s", projectRR.Code, projectRR.Body.String())
	}
	var project Project
	if err := json.Unmarshal(projectRR.Body.Bytes(), &project); err != nil {
		t.Fatalf("project decode error = %v", err)
	}
	drawingRR := doJSON(t, api, http.MethodPost, "/drawings", map[string]any{
		"team_id": team.ID,
		"title":   "Linked map",
	}, cookie)
	if drawingRR.Code != http.StatusCreated {
		t.Fatalf("drawing status = %d body = %s", drawingRR.Code, drawingRR.Body.String())
	}
	var drawing Drawing
	if err := json.Unmarshal(drawingRR.Body.Bytes(), &drawing); err != nil {
		t.Fatalf("drawing decode error = %v", err)
	}

	assetRR := doJSON(t, api, http.MethodPost, "/drawings/"+drawing.ID+"/assets", map[string]any{
		"kind":      "attachment",
		"mime_type": "image/png",
		"size":      2048,
		"width":     800,
		"height":    600,
	}, cookie)
	if assetRR.Code != http.StatusCreated {
		t.Fatalf("asset status = %d body = %s", assetRR.Code, assetRR.Body.String())
	}

	linkRR := doJSON(t, api, http.MethodPost, "/drawings/"+drawing.ID+"/links", map[string]any{
		"target_resource_type": "project",
		"target_resource_id":   project.ID,
		"label":                "Roadmap project",
	}, cookie)
	if linkRR.Code != http.StatusCreated {
		t.Fatalf("link status = %d body = %s", linkRR.Code, linkRR.Body.String())
	}
}
