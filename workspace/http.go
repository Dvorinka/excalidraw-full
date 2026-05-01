package workspace

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/sirupsen/logrus"
)

const sessionCookieName = "excalidraw_session"

type API struct {
	store    *Store
	limiter  *rateLimiter
	testMode bool
}

func NewAPI(store *Store) *API {
	return &API{
		store:   store,
		limiter: newRateLimiter(10, 15*time.Minute),
	}
}

func (a *API) Routes() chi.Router {
	r := chi.NewRouter()

	r.Group(func(r chi.Router) {
		r.Get("/health", a.handleHealth)
		r.Get("/auth/setup-status", a.handleSetupStatus)
		r.Post("/auth/signup", a.handleSignup)
		r.Post("/auth/login", a.handleLogin)
		r.Post("/auth/logout", a.handleLogout)
		r.Get("/shared/{token}", a.handleSharedResource)
	})

	r.Group(func(r chi.Router) {
		r.Use(a.requireSession)
		r.Use(requireSameOriginMutation)
		r.Get("/auth/me", a.handleMe)
		r.Get("/teams", a.handleListTeams)
		r.Post("/teams", a.handleCreateTeam)
		r.Patch("/teams/{teamID}", a.handleUpdateTeam)
		r.Get("/teams/{teamID}/members", a.handleListTeamMembers)
		r.Get("/teams/{teamID}/invites", a.handleListTeamInvites)
		r.Post("/teams/{teamID}/invites", a.handleCreateTeamInvite)
		r.Post("/teams/{teamID}/users", a.handleCreateTeamUser)
		r.Post("/invites/accept", a.handleAcceptInvite)
		r.Get("/drawings", a.handleListDrawings)
		r.Post("/drawings", a.handleCreateDrawing)
		r.Get("/drawings/{drawingID}", a.handleGetDrawing)
		r.Patch("/drawings/{drawingID}", a.handleUpdateDrawing)
		r.Delete("/drawings/{drawingID}", a.handleArchiveDrawing)
		r.Get("/drawings/{drawingID}/revisions", a.handleListRevisions)
		r.Post("/drawings/{drawingID}/revisions", a.handleCreateRevision)
		r.Get("/search", a.handleSearch)
		r.Get("/drawings/{drawingID}/permissions", a.handleListPermissions)
		r.Post("/drawings/{drawingID}/permissions", a.handleCreatePermission)
		r.Get("/drawings/{drawingID}/share-links", a.handleListShareLinks)
		r.Post("/drawings/{drawingID}/share-links", a.handleCreateShareLink)
		r.Get("/drawings/{drawingID}/assets", a.handleListAssets)
		r.Post("/drawings/{drawingID}/assets", a.handleCreateAsset)
		r.Get("/drawings/{drawingID}/embeds", a.handleListEmbeds)
		r.Post("/drawings/{drawingID}/embeds", a.handleCreateEmbed)
		r.Get("/drawings/{drawingID}/links", a.handleListLinks)
		r.Post("/drawings/{drawingID}/links", a.handleCreateLink)
		r.Get("/drawings/{drawingID}/thumbnail", a.handleThumbnail)
		r.Get("/templates", a.handleListTemplates)
		r.Post("/templates", a.handleCreateTemplate)
		r.Delete("/templates/{templateID}", a.handleDeleteTemplate)
		r.Get("/activity", a.handleListActivity)
		r.Get("/stats", a.handleStats)
		r.Get("/folders", a.handleListFolders)
		r.Post("/folders", a.handleCreateFolder)
		r.Get("/projects", a.handleListProjects)
		r.Post("/projects", a.handleCreateProject)
		r.Get("/notifications", a.handleListNotifications)
		r.Post("/notifications/{notificationID}/read", a.handleMarkNotificationRead)
		r.Post("/notifications/read-all", a.handleMarkAllNotificationsRead)
	})

	return r
}

func (a *API) handleHealth(w http.ResponseWriter, r *http.Request) {
	if err := a.store.Ping(r.Context()); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"status": "unhealthy"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok"})
}

func (a *API) handleSetupStatus(w http.ResponseWriter, r *http.Request) {
	hasUsers, err := a.store.UserExists(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to check setup status")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"has_users": hasUsers})
}

type contextKey string

const currentUserKey = contextKey("workspace_user")

func (a *API) requireSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookieName)
		if err != nil || cookie.Value == "" {
			writeError(w, http.StatusUnauthorized, "Authentication required")
			return
		}
		user, session, err := a.store.UserBySessionToken(r.Context(), cookie.Value)
		if err != nil {
			clearSessionCookie(w, r)
			writeError(w, http.StatusUnauthorized, "Authentication required")
			return
		}
		ctx := withUser(r.Context(), user, session)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func requireSameOriginMutation(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			next.ServeHTTP(w, r)
			return
		}
		origin := r.Header.Get("Origin")
		if origin == "" {
			next.ServeHTTP(w, r)
			return
		}
		host := r.Host
		if fwd := r.Header.Get("X-Forwarded-Host"); fwd != "" {
			host = fwd
		}
		proto := "http"
		if fwd := r.Header.Get("X-Forwarded-Proto"); fwd != "" {
			proto = fwd
		} else if r.TLS != nil {
			proto = "https"
		}
		expected := proto + "://" + host
		if origin != expected {
			// also allow without port in case proxy strips it
			expectedNoPort := proto + "://" + strings.SplitN(host, ":", 2)[0]
			originNoPort := strings.SplitN(origin, "://", 2)[1]
			originNoPort = strings.SplitN(originNoPort, ":", 2)[0]
			if originNoPort != expectedNoPort {
				writeError(w, http.StatusForbidden, "Cross-origin mutation denied")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func (a *API) handleSignup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decodeJSON(w, r, &req, 64<<10) {
		return
	}
	// First-run: only allow signup if no users exist yet
	if !a.testMode {
		hasUsers, err := a.store.UserExists(r.Context())
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to check setup status")
			return
		}
		if hasUsers {
			writeError(w, http.StatusForbidden, "Registration is closed. Contact an administrator.")
			return
		}
	}
	ipKey := "signup:" + clientIP(r)
	if !a.limiter.allow(ipKey) {
		writeError(w, http.StatusTooManyRequests, "Too many signup attempts")
		return
	}
	user, session, token, err := a.store.CreateUserWithPassword(r.Context(), req.Name, req.Email, req.Password)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, ErrConflict) {
			status = http.StatusConflict
		}
		writeError(w, status, err.Error())
		return
	}
	setSessionCookie(w, r, token, session.ExpiresAt)
	writeJSON(w, http.StatusCreated, map[string]any{"user": user, "session": session})
}

func (a *API) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decodeJSON(w, r, &req, 32<<10) {
		return
	}
	key := "login:" + clientIP(r) + ":" + strings.ToLower(strings.TrimSpace(req.Email))
	if !a.limiter.allow(key) {
		writeError(w, http.StatusTooManyRequests, "Too many login attempts")
		return
	}
	user, session, token, err := a.store.AuthenticatePassword(r.Context(), req.Email, req.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}
	setSessionCookie(w, r, token, session.ExpiresAt)
	writeJSON(w, http.StatusOK, map[string]any{"user": user, "session": session})
}

func (a *API) handleLogout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(sessionCookieName); err == nil && cookie.Value != "" {
		if err := a.store.DeleteSession(r.Context(), cookie.Value); err != nil {
			logrus.WithError(err).Warn("failed to delete session")
		}
	}
	clearSessionCookie(w, r)
	writeJSON(w, http.StatusOK, map[string]any{})
}

func (a *API) handleMe(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	writeJSON(w, http.StatusOK, user)
}

func (a *API) handleListTeams(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	teams, err := a.store.ListTeamsForUser(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to list teams")
		return
	}
	writeJSON(w, http.StatusOK, teams)
}

func (a *API) handleCreateTeam(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	var req struct {
		Name string `json:"name"`
		Slug string `json:"slug"`
	}
	if !decodeJSON(w, r, &req, 64<<10) {
		return
	}
	team, err := a.store.CreateTeam(r.Context(), user.ID, req.Name, req.Slug)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, team)
}

func (a *API) handleUpdateTeam(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	var req struct {
		Name *string `json:"name"`
		Slug *string `json:"slug"`
	}
	if !decodeJSON(w, r, &req, 64<<10) {
		return
	}
	team, err := a.store.UpdateTeam(r.Context(), user.ID, chi.URLParam(r, "teamID"), req.Name, req.Slug)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, team)
}

func (a *API) handleListTeamMembers(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	teamID := chi.URLParam(r, "teamID")
	if ok, err := a.store.UserCanAccessTeam(r.Context(), user.ID, teamID); err != nil || !ok {
		writeError(w, http.StatusForbidden, "Team access denied")
		return
	}
	members, err := a.store.ListTeamMembers(r.Context(), teamID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to list team members")
		return
	}
	writeJSON(w, http.StatusOK, members)
}

func (a *API) handleListDrawings(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	teamID := strings.TrimSpace(r.URL.Query().Get("team_id"))
	drawings, err := a.store.ListDrawings(r.Context(), user.ID, teamID)
	if err != nil {
		if errors.Is(err, ErrForbidden) {
			writeError(w, http.StatusForbidden, "Team access denied")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to list drawings")
		return
	}
	writeJSON(w, http.StatusOK, drawings)
}

func (a *API) handleCreateDrawing(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	var req CreateDrawingRequest
	if !decodeJSON(w, r, &req, 256<<10) {
		return
	}
	drawing, err := a.store.CreateDrawing(r.Context(), user.ID, req)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, ErrForbidden) {
			status = http.StatusForbidden
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, drawing)
}

func (a *API) handleGetDrawing(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	drawing, err := a.store.GetDrawing(r.Context(), user.ID, chi.URLParam(r, "drawingID"))
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, drawing)
}

func (a *API) handleUpdateDrawing(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	var req UpdateDrawingRequest
	if !decodeJSON(w, r, &req, 256<<10) {
		return
	}
	drawing, err := a.store.UpdateDrawing(r.Context(), user.ID, chi.URLParam(r, "drawingID"), req)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, drawing)
}

func (a *API) handleArchiveDrawing(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	if err := a.store.ArchiveDrawing(r.Context(), user.ID, chi.URLParam(r, "drawingID")); err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *API) handleListRevisions(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	revisions, err := a.store.ListRevisions(r.Context(), user.ID, chi.URLParam(r, "drawingID"))
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, revisions)
}

func (a *API) handleCreateRevision(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	var req CreateRevisionRequest
	if !decodeJSON(w, r, &req, 10<<20) {
		return
	}
	revision, err := a.store.CreateRevision(r.Context(), user.ID, chi.URLParam(r, "drawingID"), req)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, revision)
}

func (a *API) handleThumbnail(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	drawingID := chi.URLParam(r, "drawingID")
	revisions, err := a.store.ListRevisions(r.Context(), user.ID, drawingID)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	if len(revisions) == 0 || revisions[0].Snapshot == nil {
		w.Header().Set("Content-Type", "image/svg+xml")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><rect width="320" height="240" fill="#f8f9fa"/><text x="160" y="120" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#999">No preview</text></svg>`))
		return
	}

	var snapshot struct {
		Elements []struct {
			Type   string  `json:"type"`
			X      float64 `json:"x"`
			Y      float64 `json:"y"`
			Width  float64 `json:"width"`
			Height float64 `json:"height"`
			Stroke string  `json:"strokeColor"`
			Bg     string  `json:"backgroundColor"`
			Text   string  `json:"text"`
		} `json:"elements"`
	}
	if err := json.Unmarshal(revisions[0].Snapshot, &snapshot); err != nil {
		w.Header().Set("Content-Type", "image/svg+xml")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><rect width="320" height="240" fill="#f8f9fa"/><text x="160" y="120" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#999">Preview unavailable</text></svg>`))
		return
	}

	// Generate a simple SVG thumbnail from element bounding boxes
	const vw, vh = 320, 240
	var b strings.Builder
	b.WriteString(`<svg xmlns="http://www.w3.org/2000/svg" width="` + itoa(vw) + `" height="` + itoa(vh) + `" viewBox="0 0 ` + itoa(vw) + ` ` + itoa(vh) + `">`)
	b.WriteString(`<rect width="` + itoa(vw) + `" height="` + itoa(vh) + `" fill="#ffffff"/>`)

	// Compute bounding box to fit elements into view
	minX, minY, maxX, maxY := 1e9, 1e9, -1e9, -1e9
	for _, el := range snapshot.Elements {
		if el.X < minX {
			minX = el.X
		}
		if el.Y < minY {
			minY = el.Y
		}
		if el.X+el.Width > maxX {
			maxX = el.X + el.Width
		}
		if el.Y+el.Height > maxY {
			maxY = el.Y + el.Height
		}
	}
	if maxX <= minX || maxY <= minY {
		minX, minY, maxX, maxY = 0, 0, 320, 240
	}
	pad := 20.0
	scaleX := float64(vw-40) / (maxX - minX + 1e-6)
	scaleY := float64(vh-40) / (maxY - minY + 1e-6)
	scale := scaleX
	if scaleY < scaleX {
		scale = scaleY
	}
	offX := pad - minX*scale
	offY := pad - minY*scale

	for _, el := range snapshot.Elements {
		x := el.X*scale + offX
		y := el.Y*scale + offY
		w := el.Width * scale
		h := el.Height * scale
		stroke := el.Stroke
		if stroke == "" {
			stroke = "#1e1e1e"
		}
		bg := el.Bg
		if bg == "" || bg == "transparent" {
			bg = "none"
		}
		switch el.Type {
		case "rectangle", "diamond":
			b.WriteString(`<rect x="` + ftoa(x) + `" y="` + ftoa(y) + `" width="` + ftoa(w) + `" height="` + ftoa(h) + `" fill="` + bg + `" stroke="` + stroke + `" stroke-width="1"/>`)
		case "ellipse":
			b.WriteString(`<ellipse cx="` + ftoa(x+w/2) + `" cy="` + ftoa(y+h/2) + `" rx="` + ftoa(w/2) + `" ry="` + ftoa(h/2) + `" fill="` + bg + `" stroke="` + stroke + `" stroke-width="1"/>`)
		case "line", "arrow":
			b.WriteString(`<line x1="` + ftoa(x) + `" y1="` + ftoa(y+h/2) + `" x2="` + ftoa(x+w) + `" y2="` + ftoa(y+h/2) + `" stroke="` + stroke + `" stroke-width="1"/>`)
		case "text":
			b.WriteString(`<text x="` + ftoa(x) + `" y="` + ftoa(y+h/2) + `" font-family="sans-serif" font-size="12" fill="` + stroke + `">` + htmlEscape(el.Text) + `</text>`)
		default:
			b.WriteString(`<rect x="` + ftoa(x) + `" y="` + ftoa(y) + `" width="` + ftoa(w) + `" height="` + ftoa(h) + `" fill="none" stroke="#ccc" stroke-width="0.5"/>`)
		}
	}
	b.WriteString(`</svg>`)

	w.Header().Set("Content-Type", "image/svg+xml")
	w.Header().Set("Cache-Control", "max-age=60")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(b.String()))
}

func ftoa(f float64) string { return strconv.FormatFloat(f, 'f', 2, 64) }
func itoa(i int) string     { return strconv.Itoa(i) }
func htmlEscape(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, `"`, "&quot;")
	return s
}

func (a *API) handleListTemplates(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	teamID := strings.TrimSpace(r.URL.Query().Get("team_id"))
	templates, err := a.store.ListTemplates(r.Context(), user.ID, teamID)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, templates)
}

func (a *API) handleCreateTemplate(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	var req CreateTemplateRequest
	if !decodeJSON(w, r, &req, 5<<20) {
		return
	}
	template, err := a.store.CreateTemplate(r.Context(), user.ID, req)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, template)
}

func (a *API) handleDeleteTemplate(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	templateID := chi.URLParam(r, "templateID")
	if err := a.store.DeleteTemplate(r.Context(), user.ID, templateID); err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *API) handleListActivity(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	teamID := strings.TrimSpace(r.URL.Query().Get("team_id"))
	activity, err := a.store.ListActivity(r.Context(), user.ID, teamID, 50)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, activity)
}

func (a *API) handleStats(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	teamID := strings.TrimSpace(r.URL.Query().Get("team_id"))
	stats, err := a.store.WorkspaceStats(r.Context(), user.ID, teamID)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (a *API) handleListFolders(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	teamID := strings.TrimSpace(r.URL.Query().Get("team_id"))
	folders, err := a.store.ListFolders(r.Context(), user.ID, teamID)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, folders)
}

func (a *API) handleCreateFolder(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	var req CreateFolderRequest
	if !decodeJSON(w, r, &req, 128<<10) {
		return
	}
	folder, err := a.store.CreateFolder(r.Context(), user.ID, req)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, folder)
}

func (a *API) handleListProjects(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	teamID := strings.TrimSpace(r.URL.Query().Get("team_id"))
	projects, err := a.store.ListProjects(r.Context(), user.ID, teamID)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, projects)
}

func (a *API) handleCreateProject(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	var req CreateProjectRequest
	if !decodeJSON(w, r, &req, 128<<10) {
		return
	}
	project, err := a.store.CreateProject(r.Context(), user.ID, req)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, project)
}

func (a *API) handleSearch(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		writeJSON(w, http.StatusOK, []Drawing{})
		return
	}
	drawings, err := a.store.SearchDrawings(r.Context(), user.ID, q)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, drawings)
}

func writeLookupError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrForbidden):
		writeError(w, http.StatusForbidden, "Access denied")
	case errors.Is(err, sql.ErrNoRows), errors.Is(err, ErrNotFound):
		writeError(w, http.StatusNotFound, "Resource not found")
	default:
		writeError(w, http.StatusBadRequest, err.Error())
	}
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any, limit int64) bool {
	defer r.Body.Close()
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		logrus.WithError(err).Warn("failed to encode response")
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func setSessionCookie(w http.ResponseWriter, r *http.Request, token string, expires time.Time) {
	SetSessionCookie(w, r, token, expires)
}

func SetSessionCookie(w http.ResponseWriter, r *http.Request, token string, expires time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Path:     "/",
		Expires:  expires,
		HttpOnly: true,
		Secure:   isSecureRequest(r),
		SameSite: http.SameSiteLaxMode,
	})
}

func clearSessionCookie(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   isSecureRequest(r),
		SameSite: http.SameSiteLaxMode,
	})
}

// Notification handlers
func (a *API) handleListNotifications(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	if user == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "unauthorized"})
		return
	}
	ctx := r.Context()
	notifications, err := a.store.ListNotifications(ctx, user.ID, 50)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, notifications)
}

func (a *API) handleMarkNotificationRead(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	if user == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "unauthorized"})
		return
	}
	ctx := r.Context()
	notificationID := chi.URLParam(r, "notificationID")
	if err := a.store.MarkNotificationRead(ctx, user.ID, notificationID); err != nil {
		if errors.Is(err, ErrNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": "not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *API) handleMarkAllNotificationsRead(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	if user == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "unauthorized"})
		return
	}
	ctx := r.Context()
	if err := a.store.MarkAllNotificationsRead(ctx, user.ID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func isSecureRequest(r *http.Request) bool {
	return r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}

func clientIP(r *http.Request) string {
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		return strings.TrimSpace(strings.Split(forwarded, ",")[0])
	}
	host := r.RemoteAddr
	if idx := strings.LastIndex(host, ":"); idx > 0 {
		return host[:idx]
	}
	return host
}
