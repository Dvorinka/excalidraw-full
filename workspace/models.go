package workspace

import (
	"encoding/json"
	"time"
)

type User struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	AvatarURL *string   `json:"avatar_url"`
	Locale    string    `json:"locale"`
	Timezone  string    `json:"timezone"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Session struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

type Team struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	OwnerUserID string    `json:"owner_user_id"`
	PlanType    string    `json:"plan_type"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type TeamMembership struct {
	ID       string    `json:"id"`
	TeamID   string    `json:"team_id"`
	UserID   string    `json:"user_id"`
	Role     string    `json:"role"`
	JoinedAt time.Time `json:"joined_at"`
	User     *User     `json:"user,omitempty"`
}

type TeamInvite struct {
	ID        string    `json:"id"`
	TeamID    string    `json:"team_id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	InvitedBy string    `json:"invited_by"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

type Project struct {
	ID          string    `json:"id"`
	TeamID      string    `json:"team_id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Description *string   `json:"description"`
	CreatedBy   string    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Folder struct {
	ID             string    `json:"id"`
	TeamID         string    `json:"team_id"`
	ProjectID      *string   `json:"project_id"`
	ParentFolderID *string   `json:"parent_folder_id"`
	Name           string    `json:"name"`
	Slug           string    `json:"slug"`
	PathCache      string    `json:"path_cache"`
	Visibility     string    `json:"visibility"`
	CreatedBy      string    `json:"created_by"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type Drawing struct {
	ID               string     `json:"id"`
	TeamID           string     `json:"team_id"`
	FolderID         *string    `json:"folder_id"`
	ProjectID        *string    `json:"project_id"`
	Slug             *string    `json:"slug"`
	Title            string     `json:"title"`
	Description      *string    `json:"description"`
	OwnerUserID      string     `json:"owner_user_id"`
	LatestRevisionID *string    `json:"latest_revision_id"`
	Visibility       string     `json:"visibility"`
	IsArchived       bool       `json:"is_archived"`
	ThumbnailAssetID *string    `json:"thumbnail_asset_id"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	DeletedAt        *time.Time `json:"deleted_at"`
	Owner            *User      `json:"owner,omitempty"`
	Folder           *Folder    `json:"folder,omitempty"`
	Project          *Project   `json:"project,omitempty"`
	ThumbnailURL     *string    `json:"thumbnail_url,omitempty"`
}

type DrawingRevision struct {
	ID             string          `json:"id"`
	DrawingID      string          `json:"drawing_id"`
	RevisionNumber int             `json:"revision_number"`
	SnapshotPath   string          `json:"snapshot_path"`
	SnapshotSize   int64           `json:"snapshot_size"`
	ContentHash    string          `json:"content_hash"`
	CreatedBy      string          `json:"created_by"`
	CreatedAt      time.Time       `json:"created_at"`
	ChangeSummary  *string         `json:"change_summary"`
	Snapshot       json.RawMessage `json:"snapshot,omitempty"`
	CreatedByUser  *User           `json:"created_by_user,omitempty"`
}

type DrawingAsset struct {
	ID         string    `json:"id"`
	DrawingID  string    `json:"drawing_id"`
	Kind       string    `json:"kind"`
	Path       string    `json:"path"`
	MimeType   string    `json:"mime_type"`
	Size       int64     `json:"size"`
	Width      *int      `json:"width"`
	Height     *int      `json:"height"`
	UploadedBy string    `json:"uploaded_by"`
	CreatedAt  time.Time `json:"created_at"`
	URL        *string   `json:"url,omitempty"`
}

type Template struct {
	ID           string         `json:"id"`
	TeamID       *string        `json:"team_id"`
	Scope        string         `json:"scope"`
	Type         string         `json:"type"`
	Name         string         `json:"name"`
	Description  *string        `json:"description"`
	SnapshotPath string         `json:"snapshot_path"`
	MetadataJSON map[string]any `json:"metadata_json"`
	CreatedBy    string         `json:"created_by"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	PreviewURL   *string        `json:"preview_url,omitempty"`
}

type ActivityEvent struct {
	ID           string         `json:"id"`
	ActorUserID  *string        `json:"actor_user_id"`
	TeamID       *string        `json:"team_id"`
	ResourceType string         `json:"resource_type"`
	ResourceID   string         `json:"resource_id"`
	EventType    string         `json:"event_type"`
	MetadataJSON map[string]any `json:"metadata_json"`
	CreatedAt    time.Time      `json:"created_at"`
	Actor        *User          `json:"actor,omitempty"`
}

type ShareLink struct {
	ID           string     `json:"id"`
	ResourceType string     `json:"resource_type"`
	ResourceID   string     `json:"resource_id"`
	TokenHash    string     `json:"token_hash,omitempty"`
	Permission   string     `json:"permission"`
	ExpiresAt    *time.Time `json:"expires_at"`
	PasswordHash *string    `json:"-"`
	CreatedBy    string     `json:"created_by"`
	RevokedAt    *time.Time `json:"revoked_at"`
	CreatedAt    time.Time  `json:"created_at"`
}

type PermissionGrant struct {
	ID            string    `json:"id"`
	ResourceType  string    `json:"resource_type"`
	ResourceID    string    `json:"resource_id"`
	SubjectType   string    `json:"subject_type"`
	SubjectID     string    `json:"subject_id"`
	Permission    string    `json:"permission"`
	InheritedFrom *string   `json:"inherited_from"`
	CreatedAt     time.Time `json:"created_at"`
}

type Embed struct {
	ID             string    `json:"id"`
	DrawingID      string    `json:"drawing_id"`
	SourceURL      string    `json:"source_url"`
	CanonicalURL   string    `json:"canonical_url"`
	Provider       string    `json:"provider"`
	EmbedType      string    `json:"embed_type"`
	Title          *string   `json:"title"`
	PreviewAssetID *string   `json:"preview_asset_id"`
	SafeEmbedHTML  *string   `json:"safe_embed_html"`
	CreatedBy      string    `json:"created_by"`
	CreatedAt      time.Time `json:"created_at"`
}

type LinkReference struct {
	ID                 string    `json:"id"`
	SourceResourceType string    `json:"source_resource_type"`
	SourceResourceID   string    `json:"source_resource_id"`
	TargetResourceType string    `json:"target_resource_type"`
	TargetResourceID   string    `json:"target_resource_id"`
	Label              *string   `json:"label"`
	CreatedBy          string    `json:"created_by"`
	CreatedAt          time.Time `json:"created_at"`
}

type WorkspaceStats struct {
	Teams        int   `json:"teams"`
	Members      int   `json:"members"`
	Projects     int   `json:"projects"`
	Folders      int   `json:"folders"`
	Drawings     int   `json:"drawings"`
	Templates    int   `json:"templates"`
	Revisions    int   `json:"revisions"`
	Assets       int   `json:"assets"`
	StorageBytes int64 `json:"storage_bytes"`
}
