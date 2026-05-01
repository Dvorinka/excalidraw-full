// ============================================
// User & Auth Types
// ============================================

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar_url: string | null;
  locale: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface AuthIdentity {
  id: string;
  user_id: string;
  provider: 'github' | 'password' | 'google';
  provider_user_id: string;
  email_verified_at: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

// ============================================
// Team Types
// ============================================

export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface Team {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  plan_type: 'free' | 'pro';
  created_at: string;
  updated_at: string;
}

export interface TeamMembership {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
  user?: User;
}

export interface TeamInvite {
  id: string;
  team_id: string;
  email: string;
  role: TeamRole;
  invited_by: string;
  expires_at: string;
  created_at: string;
}

// ============================================
// Project & Folder Types
// ============================================

export interface Project {
  id: string;
  team_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  team_id: string;
  project_id: string | null;
  parent_folder_id: string | null;
  name: string;
  slug: string;
  path_cache: string;
  visibility: 'private' | 'team';
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Drawing Types
// ============================================

export type DrawingVisibility = 'private' | 'team' | 'restricted' | 'public-link';

export interface Drawing {
  id: string;
  team_id: string;
  folder_id: string | null;
  project_id: string | null;
  slug: string | null;
  title: string;
  description: string | null;
  owner_user_id: string;
  latest_revision_id: string | null;
  visibility: DrawingVisibility;
  is_archived: boolean;
  thumbnail_asset_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Joined fields
  owner?: User;
  folder?: Folder;
  project?: Project;
  thumbnail_url?: string;
}

export interface DrawingRevision {
  id: string;
  drawing_id: string;
  revision_number: number;
  snapshot_path: string;
  snapshot_size: number;
  content_hash: string;
  created_by: string;
  created_at: string;
  change_summary: string | null;
  snapshot?: string | Record<string, unknown>;
  created_by_user?: User;
}

export interface DrawingAsset {
  id: string;
  drawing_id: string;
  kind: 'image' | 'export' | 'attachment' | 'thumbnail';
  path: string;
  mime_type: string;
  size: number;
  width: number | null;
  height: number | null;
  uploaded_by: string;
  created_at: string;
  url?: string;
}

// ============================================
// Template Types
// ============================================

export type TemplateScope = 'system' | 'team' | 'personal';
export type TemplateType =
  | 'todo'
  | 'kanban'
  | 'brainstorm'
  | 'flowchart'
  | 'meeting-notes'
  | 'architecture'
  | 'mindmap'
  | 'wireframe'
  | 'retrospective'
  | 'swot'
  | 'storymap'
  | 'empty';

export interface Template {
  id: string;
  team_id: string | null;
  scope: TemplateScope;
  type: TemplateType;
  name: string;
  description: string | null;
  snapshot_path: string;
  metadata_json: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
  preview_url?: string;
}

// ============================================
// Share & Permission Types
// ============================================

export type Permission = 'view' | 'comment' | 'edit' | 'manage' | 'share' | 'invite';

export interface ShareLink {
  id: string;
  resource_type: 'drawing' | 'folder' | 'project';
  resource_id: string;
  token_hash: string;
  permission: Permission;
  expires_at: string | null;
  password_hash: string | null;
  created_by: string;
  revoked_at: string | null;
  created_at: string;
}

export interface PermissionGrant {
  id: string;
  resource_type: string;
  resource_id: string;
  subject_type: 'user' | 'team' | 'link';
  subject_id: string;
  permission: Permission;
  inherited_from: string | null;
  created_at: string;
}

// ============================================
// Activity Types
// ============================================

export type ActivityEventType = 
  | 'drawing_created'
  | 'drawing_updated'
  | 'drawing_deleted'
  | 'drawing_moved'
  | 'drawing_renamed'
  | 'drawing_shared'
  | 'folder_created'
  | 'folder_updated'
  | 'folder_deleted'
  | 'folder_shared'
  | 'member_joined'
  | 'member_left'
  | 'member_invited'
  | 'member_role_changed'
  | 'revision_created'
  | 'revision_restored'
  | 'template_applied';

export interface ActivityEvent {
  id: string;
  actor_user_id: string | null;
  team_id: string | null;
  resource_type: string;
  resource_id: string;
  event_type: ActivityEventType;
  metadata_json: Record<string, unknown>;
  created_at: string;
  actor?: User;
}

// ============================================
// UI Types
// ============================================

export type Theme = 'light' | 'dark' | 'system';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface FilterOptions {
  sortBy: 'name' | 'updated' | 'created';
  sortOrder: 'asc' | 'desc';
  view: 'grid' | 'list';
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  data: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}
