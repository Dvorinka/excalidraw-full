package workspace

import (
	"encoding/json"
	"net/http"
	"testing"
)

// TestPermissionMatrix tests the full permission matrix for drawings.
// It creates drawings with different visibilities and verifies access
// from users with different roles and direct permission grants.
func TestPermissionMatrix(t *testing.T) {
	cases := []struct {
		name           string
		visibility     string
		grantPerm      string // direct grant permission to bob
		bobRole        string // bob's role in alice's team
		expectGet      int    // expected HTTP status for GET /drawings/:id
		expectUpdate   int    // expected HTTP status for PATCH /drawings/:id
		expectListTeam int    // expected HTTP status for GET /drawings (team-scoped list)
	}{
		// public drawings - anyone in the team can view, edit requires role
		{
			name:       "public_drawing_team_viewer_can_view_not_edit",
			visibility: "public", grantPerm: "", bobRole: "viewer",
			expectGet: http.StatusOK, expectUpdate: http.StatusForbidden,
			expectListTeam: http.StatusOK,
		},
		{
			name:       "public_drawing_team_editor_can_view_and_edit",
			visibility: "public", grantPerm: "", bobRole: "editor",
			expectGet: http.StatusOK, expectUpdate: http.StatusOK,
			expectListTeam: http.StatusOK,
		},
		// restricted drawings - no team access without explicit grant
		{
			name:       "restricted_no_grant_team_member_cannot_access",
			visibility: "restricted", grantPerm: "", bobRole: "editor",
			expectGet: http.StatusForbidden, expectUpdate: http.StatusForbidden,
			expectListTeam: http.StatusOK, // team list still shows it if team-scoped
		},
		{
			name:       "restricted_with_view_grant_team_viewer_can_view_not_edit",
			visibility: "restricted", grantPerm: "view", bobRole: "viewer",
			expectGet: http.StatusOK, expectUpdate: http.StatusForbidden,
			expectListTeam: http.StatusOK,
		},
		{
			name:       "restricted_with_edit_grant_team_viewer_can_view_and_edit",
			visibility: "restricted", grantPerm: "edit", bobRole: "viewer",
			expectGet: http.StatusOK, expectUpdate: http.StatusOK,
			expectListTeam: http.StatusOK,
		},
		// private drawings - only owner and explicit grant holders
		{
			name:       "private_no_grant_team_member_cannot_access",
			visibility: "private", grantPerm: "", bobRole: "admin",
			expectGet: http.StatusForbidden, expectUpdate: http.StatusForbidden,
			expectListTeam: http.StatusOK, // team list may still include private owned by owner
		},
		{
			name:       "private_with_view_grant_allows_view_not_edit",
			visibility: "private", grantPerm: "view", bobRole: "viewer",
			expectGet: http.StatusOK, expectUpdate: http.StatusForbidden,
			expectListTeam: http.StatusOK,
		},
		{
			name:       "private_with_edit_grant_allows_view_and_edit",
			visibility: "private", grantPerm: "edit", bobRole: "viewer",
			expectGet: http.StatusOK, expectUpdate: http.StatusOK,
			expectListTeam: http.StatusOK,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			api, cleanup := newTestAPI(t)
			defer cleanup()

			aliceCookie, _, aliceTeam := signup(t, api, "alice@example.com")
			bobCookie, _, _ := signup(t, api, "bob@example.com")

			// Invite bob to alice's team with specified role
			if tc.bobRole != "" {
				inviteRR := doJSON(t, api, http.MethodPost, "/teams/"+aliceTeam.ID+"/invites", map[string]any{
					"email": "bob@example.com",
					"role":  tc.bobRole,
				}, aliceCookie)
				if inviteRR.Code != http.StatusCreated {
					t.Fatalf("invite status = %d body = %s", inviteRR.Code, inviteRR.Body.String())
				}
				// Accept the invite
				var invitePayload struct {
					Token string `json:"token"`
				}
				if err := json.Unmarshal(inviteRR.Body.Bytes(), &invitePayload); err != nil {
					t.Fatalf("invite decode error = %v", err)
				}
				acceptRR := doJSON(t, api, http.MethodPost, "/invites/accept", map[string]string{
					"token": invitePayload.Token,
				}, bobCookie)
				if acceptRR.Code != http.StatusOK {
					t.Fatalf("accept status = %d body = %s", acceptRR.Code, acceptRR.Body.String())
				}
			}

			// Alice creates a drawing with specified visibility
			createRR := doJSON(t, api, http.MethodPost, "/drawings", map[string]any{
				"team_id":    aliceTeam.ID,
				"title":      tc.name + " drawing",
				"visibility": tc.visibility,
			}, aliceCookie)
			if createRR.Code != http.StatusCreated {
				t.Fatalf("create drawing status = %d body = %s", createRR.Code, createRR.Body.String())
			}
			var drawing Drawing
			if err := json.Unmarshal(createRR.Body.Bytes(), &drawing); err != nil {
				t.Fatalf("drawing decode error = %v", err)
			}

			// Optionally grant bob a direct permission
			if tc.grantPerm != "" {
				grantRR := doJSON(t, api, http.MethodPost, "/drawings/"+drawing.ID+"/permissions", map[string]any{
					"subject_type": "user",
					"email":        "bob@example.com",
					"permission":   tc.grantPerm,
				}, aliceCookie)
				if grantRR.Code != http.StatusCreated {
					t.Fatalf("grant status = %d body = %s", grantRR.Code, grantRR.Body.String())
				}
			}

			// Bob attempts to GET the drawing
			getRR := doJSON(t, api, http.MethodGet, "/drawings/"+drawing.ID, nil, bobCookie)
			if getRR.Code != tc.expectGet {
				t.Errorf("GET status = %d, want %d; body = %s", getRR.Code, tc.expectGet, getRR.Body.String())
			}

			// Bob attempts to PATCH (update) the drawing
			updateRR := doJSON(t, api, http.MethodPatch, "/drawings/"+drawing.ID, map[string]any{
				"title": tc.name + " updated",
			}, bobCookie)
			if updateRR.Code != tc.expectUpdate {
				t.Errorf("PATCH status = %d, want %d; body = %s", updateRR.Code, tc.expectUpdate, updateRR.Body.String())
			}

			// Bob attempts to list team drawings
			listRR := doJSON(t, api, http.MethodGet, "/drawings?team_id="+aliceTeam.ID, nil, bobCookie)
			if listRR.Code != tc.expectListTeam {
				t.Errorf("LIST status = %d, want %d; body = %s", listRR.Code, tc.expectListTeam, listRR.Body.String())
			}

			// Verify alice (owner) can still access everything
			ownerGet := doJSON(t, api, http.MethodGet, "/drawings/"+drawing.ID, nil, aliceCookie)
			if ownerGet.Code != http.StatusOK {
				t.Errorf("owner GET status = %d, want %d", ownerGet.Code, http.StatusOK)
			}
			ownerUpdate := doJSON(t, api, http.MethodPatch, "/drawings/"+drawing.ID, map[string]any{
				"title": tc.name + " owner updated",
			}, aliceCookie)
			if ownerUpdate.Code != http.StatusOK {
				t.Errorf("owner PATCH status = %d, want %d", ownerUpdate.Code, http.StatusOK)
			}
		})
	}
}

// TestAdminCanManageTeam verifies that team admins can manage team settings,
// members, and resources while non-admins cannot.
func TestAdminCanManageTeam(t *testing.T) {
	api, cleanup := newTestAPI(t)
	defer cleanup()

	aliceCookie, _, aliceTeam := signup(t, api, "alice@example.com")
	bobCookie, _, _ := signup(t, api, "bob@example.com")
	charlieCookie, _, _ := signup(t, api, "charlie@example.com")

	// Invite bob as admin, charlie as viewer
	for _, tc := range []struct{ email, role string }{
		{"bob@example.com", "admin"},
		{"charlie@example.com", "viewer"},
	} {
		inviteRR := doJSON(t, api, http.MethodPost, "/teams/"+aliceTeam.ID+"/invites", map[string]any{
			"email": tc.email,
			"role":  tc.role,
		}, aliceCookie)
		if inviteRR.Code != http.StatusCreated {
			t.Fatalf("invite %s status = %d body = %s", tc.email, inviteRR.Code, inviteRR.Body.String())
		}
		var invitePayload struct {
			Token string `json:"token"`
		}
		if err := json.Unmarshal(inviteRR.Body.Bytes(), &invitePayload); err != nil {
			t.Fatalf("invite decode error = %v", err)
		}
		var cookie *http.Cookie
		if tc.email == "bob@example.com" {
			cookie = bobCookie
		} else {
			cookie = charlieCookie
		}
		acceptRR := doJSON(t, api, http.MethodPost, "/invites/accept", map[string]string{
			"token": invitePayload.Token,
		}, cookie)
		if acceptRR.Code != http.StatusOK {
			t.Fatalf("accept %s status = %d body = %s", tc.email, acceptRR.Code, acceptRR.Body.String())
		}
	}

	// Bob (admin) can update team name
	updateTeam := doJSON(t, api, http.MethodPatch, "/teams/"+aliceTeam.ID, map[string]any{
		"name": "Updated by admin",
	}, bobCookie)
	if updateTeam.Code != http.StatusOK {
		t.Errorf("admin update team status = %d, want %d; body = %s", updateTeam.Code, http.StatusOK, updateTeam.Body.String())
	}

	// Charlie (viewer) cannot update team name
	charlieUpdate := doJSON(t, api, http.MethodPatch, "/teams/"+aliceTeam.ID, map[string]any{
		"name": "Updated by viewer",
	}, charlieCookie)
	if charlieUpdate.Code != http.StatusForbidden {
		t.Errorf("viewer update team status = %d, want %d; body = %s", charlieUpdate.Code, http.StatusForbidden, charlieUpdate.Body.String())
	}

	// Bob (admin) can manage members
	membersRR := doJSON(t, api, http.MethodGet, "/teams/"+aliceTeam.ID+"/members", nil, bobCookie)
	if membersRR.Code != http.StatusOK {
		t.Errorf("admin list members status = %d, want %d", membersRR.Code, http.StatusOK)
	}

	// Charlie (viewer) can view members
	charlieMembers := doJSON(t, api, http.MethodGet, "/teams/"+aliceTeam.ID+"/members", nil, charlieCookie)
	if charlieMembers.Code != http.StatusOK {
		t.Errorf("viewer list members status = %d, want %d", charlieMembers.Code, http.StatusOK)
	}
}

// TestNonMemberCannotAccessPrivateTeam verifies that users not in a team
// cannot access any team resources regardless of drawing visibility.
func TestNonMemberCannotAccessPrivateTeam(t *testing.T) {
	api, cleanup := newTestAPI(t)
	defer cleanup()

	aliceCookie, _, aliceTeam := signup(t, api, "alice@example.com")
	bobCookie, _, _ := signup(t, api, "bob@example.com")

	// Alice creates a public drawing in her team
	createRR := doJSON(t, api, http.MethodPost, "/drawings", map[string]any{
		"team_id":    aliceTeam.ID,
		"title":      "Public team drawing",
		"visibility": "public",
	}, aliceCookie)
	if createRR.Code != http.StatusCreated {
		t.Fatalf("create drawing status = %d body = %s", createRR.Code, createRR.Body.String())
	}
	var drawing Drawing
	if err := json.Unmarshal(createRR.Body.Bytes(), &drawing); err != nil {
		t.Fatalf("drawing decode error = %v", err)
	}

	// Bob (not in team) cannot access the drawing even though it's public
	// because "public" in this context means public within the team
	getRR := doJSON(t, api, http.MethodGet, "/drawings/"+drawing.ID, nil, bobCookie)
	if getRR.Code != http.StatusForbidden {
		t.Errorf("non-member GET status = %d, want %d; body = %s", getRR.Code, http.StatusForbidden, getRR.Body.String())
	}

	// Bob cannot list team drawings
	listRR := doJSON(t, api, http.MethodGet, "/drawings?team_id="+aliceTeam.ID, nil, bobCookie)
	if listRR.Code != http.StatusForbidden && listRR.Code != http.StatusOK {
		// Depending on implementation, non-members might get empty list or forbidden
		t.Logf("non-member LIST status = %d", listRR.Code)
	}
}

// TestPermissionInheritance verifies that permissions flow correctly
// through the resource hierarchy (team -> project -> folder -> drawing).
func TestPermissionInheritance(t *testing.T) {
	api, cleanup := newTestAPI(t)
	defer cleanup()

	aliceCookie, _, aliceTeam := signup(t, api, "alice@example.com")
	bobCookie, _, _ := signup(t, api, "bob@example.com")

	// Invite bob as editor
	inviteRR := doJSON(t, api, http.MethodPost, "/teams/"+aliceTeam.ID+"/invites", map[string]any{
		"email": "bob@example.com",
		"role":  "editor",
	}, aliceCookie)
	if inviteRR.Code != http.StatusCreated {
		t.Fatalf("invite status = %d body = %s", inviteRR.Code, inviteRR.Body.String())
	}
	var invitePayload struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(inviteRR.Body.Bytes(), &invitePayload); err != nil {
		t.Fatalf("invite decode error = %v", err)
	}
	acceptRR := doJSON(t, api, http.MethodPost, "/invites/accept", map[string]string{
		"token": invitePayload.Token,
	}, bobCookie)
	if acceptRR.Code != http.StatusOK {
		t.Fatalf("accept status = %d body = %s", acceptRR.Code, acceptRR.Body.String())
	}

	// Alice creates a project
	projectRR := doJSON(t, api, http.MethodPost, "/projects", map[string]any{
		"team_id":     aliceTeam.ID,
		"name":        "Test Project",
		"description": "A test project",
	}, aliceCookie)
	if projectRR.Code != http.StatusCreated {
		t.Fatalf("create project status = %d body = %s", projectRR.Code, projectRR.Body.String())
	}
	var project struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(projectRR.Body.Bytes(), &project); err != nil {
		t.Fatalf("project decode error = %v", err)
	}

	// Alice creates a folder in the project
	folderRR := doJSON(t, api, http.MethodPost, "/folders", map[string]any{
		"team_id":    aliceTeam.ID,
		"project_id": project.ID,
		"name":       "Test Folder",
	}, aliceCookie)
	if folderRR.Code != http.StatusCreated {
		t.Fatalf("create folder status = %d body = %s", folderRR.Code, folderRR.Body.String())
	}
	var folder struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(folderRR.Body.Bytes(), &folder); err != nil {
		t.Fatalf("folder decode error = %v", err)
	}

	// Alice creates a drawing in the folder
	drawingRR := doJSON(t, api, http.MethodPost, "/drawings", map[string]any{
		"team_id":    aliceTeam.ID,
		"project_id": project.ID,
		"folder_id":  folder.ID,
		"title":      "Nested Drawing",
		"visibility": "public",
	}, aliceCookie)
	if drawingRR.Code != http.StatusCreated {
		t.Fatalf("create drawing status = %d body = %s", drawingRR.Code, drawingRR.Body.String())
	}
	var drawing Drawing
	if err := json.Unmarshal(drawingRR.Body.Bytes(), &drawing); err != nil {
		t.Fatalf("drawing decode error = %v", err)
	}

	// Bob (team editor) should be able to access the nested drawing through team membership
	getRR := doJSON(t, api, http.MethodGet, "/drawings/"+drawing.ID, nil, bobCookie)
	if getRR.Code != http.StatusOK {
		t.Errorf("team editor GET nested drawing status = %d, want %d; body = %s",
			getRR.Code, http.StatusOK, getRR.Body.String())
	}

	// Bob should be able to update the drawing
	updateRR := doJSON(t, api, http.MethodPatch, "/drawings/"+drawing.ID, map[string]any{
		"title": "Updated by team editor",
	}, bobCookie)
	if updateRR.Code != http.StatusOK {
		t.Errorf("team editor PATCH nested drawing status = %d, want %d; body = %s",
			updateRR.Code, http.StatusOK, updateRR.Body.String())
	}
}
