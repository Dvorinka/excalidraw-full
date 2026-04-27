package workspace

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
)

func (a *API) handleListTeamInvites(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	invites, err := a.store.ListTeamInvites(r.Context(), user.ID, chi.URLParam(r, "teamID"))
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, invites)
}

func (a *API) handleCreateTeamInvite(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	var req CreateInviteRequest
	if !decodeJSON(w, r, &req, 64<<10) {
		return
	}
	invite, token, err := a.store.CreateTeamInvite(r.Context(), user.ID, chi.URLParam(r, "teamID"), req)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"invite": invite, "token": token})
}

func (a *API) handleAcceptInvite(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	var req struct {
		Token string `json:"token"`
	}
	if !decodeJSON(w, r, &req, 32<<10) {
		return
	}
	membership, err := a.store.AcceptInvite(r.Context(), user.ID, req.Token)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, membership)
}

func (a *API) handleListPermissions(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	grants, err := a.store.ListPermissionGrants(r.Context(), user.ID, "drawing", chi.URLParam(r, "drawingID"))
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, grants)
}

func (a *API) handleCreatePermission(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	var req CreatePermissionGrantRequest
	if !decodeJSON(w, r, &req, 64<<10) {
		return
	}
	grant, err := a.store.CreateDrawingPermissionGrant(r.Context(), user.ID, chi.URLParam(r, "drawingID"), req)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, grant)
}

func (a *API) handleListShareLinks(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	links, err := a.store.ListShareLinks(r.Context(), user.ID, "drawing", chi.URLParam(r, "drawingID"))
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, links)
}

func (a *API) handleCreateShareLink(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	var req CreateShareLinkRequest
	if !decodeJSON(w, r, &req, 64<<10) {
		return
	}
	link, token, err := a.store.CreateDrawingShareLink(r.Context(), user.ID, chi.URLParam(r, "drawingID"), req)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"share_link": link, "token": token})
}

func (a *API) handleSharedResource(w http.ResponseWriter, r *http.Request) {
	payload, err := a.store.SharedResourceByToken(r.Context(), chi.URLParam(r, "token"))
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

func (a *API) handleListAssets(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	assets, err := a.store.ListDrawingAssets(r.Context(), user.ID, chi.URLParam(r, "drawingID"))
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, assets)
}

func (a *API) handleCreateAsset(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	var req CreateAssetRequest
	if !decodeJSON(w, r, &req, 64<<10) {
		return
	}
	asset, err := a.store.CreateDrawingAsset(r.Context(), user.ID, chi.URLParam(r, "drawingID"), req)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, asset)
}

func (a *API) handleListEmbeds(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	embeds, err := a.store.ListEmbeds(r.Context(), user.ID, chi.URLParam(r, "drawingID"))
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, embeds)
}

func (a *API) handleCreateEmbed(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	var req CreateEmbedRequest
	if !decodeJSON(w, r, &req, 64<<10) {
		return
	}
	embed, err := a.store.CreateEmbed(r.Context(), user.ID, chi.URLParam(r, "drawingID"), req)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, embed)
}

func (a *API) handleListLinks(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	links, err := a.store.ListLinkReferences(r.Context(), user.ID, "drawing", chi.URLParam(r, "drawingID"))
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, links)
}

func (a *API) handleCreateLink(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	var req CreateLinkRequest
	if !decodeJSON(w, r, &req, 64<<10) {
		return
	}
	link, err := a.store.CreateDrawingLinkReference(r.Context(), user.ID, chi.URLParam(r, "drawingID"), req)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, link)
}

func (a *API) handleCreateTeamUser(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	teamID := chi.URLParam(r, "teamID")
	var role string
	err := a.store.db.QueryRowContext(r.Context(), `SELECT role FROM workspace_team_memberships WHERE user_id = ? AND team_id = ?`, user.ID, teamID).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && role != "owner" && role != "admin") {
		writeError(w, http.StatusForbidden, "Only team owners and admins can add members")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to verify team access")
		return
	}

	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if !decodeJSON(w, r, &req, 32<<10) {
		return
	}

	newUser, err := a.store.CreateTeamUser(r.Context(), teamID, req.Name, req.Email, req.Password, req.Role)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, ErrConflict) {
			status = http.StatusConflict
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, newUser)
}
