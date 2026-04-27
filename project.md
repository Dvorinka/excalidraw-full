# Excalidraw [FULL](https://github.com/BetterAndBetterII/excalidraw-full) Overhaul Plan
Version: 0.1
Owner: TDvorak
Goal: Turn `excalidraw-full` from a simple self-hosted drawing app into a secure, production-grade visual workspace with native file management, teams, permissions, templates, collaboration, and linkable canvases.

---

## 1. Product Direction

### Core positioning
This should stop behaving like a hacked-together Excalidraw wrapper and become a real product:

- visual canvas first
- self-hosted by default
- backend-owned persistence only
- team collaboration native
- file/folder/project management built in
- secure sharing and permissioning
- activity history and auditability
- templates and structured productivity tools
- rich linking between canvases, folders, files, and embedded content

### Product statement
A self-hosted visual workspace for drawing, planning, mapping, charting, and lightweight product/project management, built around a fast collaborative canvas.

### What stays
- the canvas remains the main experience
- freeform drawing remains central
- collaborative creativity stays frictionless

### What changes
- storage becomes backend-only
- browser/local save paths are removed
- every drawing becomes a first-class resource with URL, metadata, permissions, history, and relationships
- dashboard/file management becomes a first-class part of the app
- auth and team management become native
- sharing becomes structured instead of ad hoc
- security is treated seriously instead of as an afterthought

---

## 2. Main Problems To Fix

## 2.1 Product issues
- mixed product identity
- references to external branded variants and unrelated links
- non-native save flows
- weak drawing organization
- poor URL/resource model for drawings
- unclear collaboration model
- limited permissions
- no true teams/projects/folders
- no serious templates system
- weak metadata and linking

## 2.2 Technical issues
- likely weak separation between frontend canvas state and persistent backend state
- likely overreliance on client-side assumptions
- unclear access control boundaries
- probably inconsistent resource ownership logic
- potential unsafe file handling
- likely weak validation for embeds and URL inputs
- probably no proper audit/history model
- likely incomplete internationalization foundation
- likely brittle auth/session implementation

## 2.3 Security issues
These are the areas that must be assumed risky until proven otherwise:

- weak or inconsistent auth flows
- insecure session/JWT handling
- poor authorization checks at API layer
- unrestricted or unsafe file uploads
- weak sharing token design
- missing CSRF protection where relevant
- XSS risk through embeds, markdown-like fields, titles, comments, link previews
- SSRF risk from arbitrary embed or remote fetch features
- path traversal risk if saving to local files
- privilege escalation through team/folder/drawing permission inheritance bugs
- missing audit trails
- insecure defaults
- insufficient rate limiting and abuse controls

---

## 3. Product Scope for the Overhaul

## 3.1 Must-have v2 scope
- remove all Chinese text and hardcoded language strings
- full i18n support
- remove all Excalidraw+ references and branding leaks
- new canonical URL model for drawings
- backend-only persistence
- dashboard
- folders/files/projects
- shareable resources with permission settings
- team support
- invites
- auth methods: GitHub + email/password + invitations
- activity history
- templates
- robust embed system
- better collaboration model
- stats and management layer
- security hardening across the stack

## 3.2 Nice-to-have after stabilization
- comments
- mentions
- notifications
- presence indicators
- approval/review flows
- version compare/diff
- drawing backlinks and graph view
- per-team branding
- API/webhooks
- import/export pipelines
- AI-assisted template generation
- analytics dashboard per team/project

---

## 4. Product Architecture Direction

## 4.1 High-level architecture
Split the system into clean domains:

- `web-app`
  - dashboard
  - auth UI
  - drawing UI
  - file/folder management
  - sharing/admin settings
- `api`
  - auth/session
  - drawings
  - folders/projects
  - permissions
  - templates
  - embeds
  - activity/history
  - collaboration metadata
- `realtime`
  - presence
  - cursors
  - live collaboration events
- `storage`
  - local filesystem-backed asset storage
  - snapshots
  - thumbnails
  - exports
- `db`
  - relational data source for all metadata and permissions

## 4.2 Recommended stack direction
If the current project stack is messy, do not keep bad patterns just because they already exist.

Recommended direction:

- frontend: keep current UI stack if stable enough, but clean the app architecture hard
- backend: typed API with explicit validation
- database: PostgreSQL
- file storage: local filesystem on server, managed only through backend
- auth: session-based auth preferred over raw JWT-in-browser-only flows
- realtime: WebSocket layer or equivalent event transport
- queue/background jobs:
  - thumbnail generation
  - cleanup
  - activity aggregation
  - notifications later

## 4.3 Why PostgreSQL over SQLite
If this is meant to become team software, SQLite is the wrong long-term default.

Use PostgreSQL because:
- safer concurrency model
- better indexing
- row-level locking semantics
- more robust migrations
- future analytics and activity history become sane
- better for teams, sharing, revisions, permissions, and audit events

SQLite can remain for dev only if needed.

---

## 5. New Domain Model

## 5.1 Core entities
- User
- AuthIdentity
- Session
- Team
- TeamMembership
- Invite
- Project
- Folder
- Drawing
- DrawingRevision
- DrawingAsset
- Template
- ShareLink
- PermissionGrant
- ActivityEvent
- Comment
- Embed
- LinkReference
- Tag

## 5.2 Entity overview

### User
Represents a human account.

Fields:
- id
- name
- username
- email
- avatar_url
- status
- locale
- timezone
- created_at
- updated_at

### AuthIdentity
Supports multiple auth providers.

Fields:
- id
- user_id
- provider (`github`, `password`, later others)
- provider_user_id
- password_hash_nullable
- email_verified_at
- created_at

### Team
Organization/group boundary for collaboration.

Fields:
- id
- name
- slug
- owner_user_id
- plan_type
- created_at
- updated_at

### TeamMembership
Fields:
- id
- team_id
- user_id
- role (`owner`, `admin`, `editor`, `viewer`, `billing` maybe later)
- joined_at

### Project
Optional top-level workspace grouping under a team.

Fields:
- id
- team_id
- name
- slug
- description
- created_by
- created_at
- updated_at

### Folder
Hierarchical grouping unit.

Fields:
- id
- team_id
- project_id_nullable
- parent_folder_id_nullable
- name
- slug
- path_cache
- visibility
- created_by
- created_at
- updated_at

### Drawing
The primary first-class canvas resource.

Fields:
- id (UUID)
- team_id
- folder_id_nullable
- project_id_nullable
- slug_nullable
- title
- description
- owner_user_id
- latest_revision_id
- visibility (`private`, `team`, `restricted`, `public-link`)
- is_archived
- thumbnail_asset_id_nullable
- created_at
- updated_at
- deleted_at_nullable

### DrawingRevision
Immutable version history.

Fields:
- id
- drawing_id
- revision_number
- snapshot_path
- snapshot_size
- content_hash
- created_by
- created_at
- change_summary_nullable

### DrawingAsset
Stored files attached to drawings.

Fields:
- id
- drawing_id
- kind (`image`, `export`, `attachment`, `thumbnail`)
- path
- mime_type
- size
- width_nullable
- height_nullable
- uploaded_by
- created_at

### Template
Reusable starter resource.

Fields:
- id
- team_id_nullable
- scope (`system`, `team`, `personal`)
- type (`todo`, `kanban`, `brainstorm`, `flowchart`, `meeting-notes`, `architecture`, etc.)
- name
- description
- snapshot_path
- metadata_json
- created_by
- created_at
- updated_at

### ShareLink
Controlled external access.

Fields:
- id
- resource_type (`drawing`, `folder`, maybe `project`)
- resource_id
- token_hash
- permission (`view`, `comment`, `edit`)
- expires_at_nullable
- password_hash_nullable
- created_by
- revoked_at_nullable
- created_at

### PermissionGrant
Explicit resource permissions.

Fields:
- id
- resource_type
- resource_id
- subject_type (`user`, `team`, `link`)
- subject_id
- permission (`view`, `comment`, `edit`, `manage`, `share`, `invite`)
- inherited_from_nullable
- created_at

### ActivityEvent
Audit/history.

Fields:
- id
- actor_user_id_nullable
- team_id_nullable
- resource_type
- resource_id
- event_type
- metadata_json
- created_at

### Embed
Metadata for external embedded content.

Fields:
- id
- drawing_id
- source_url
- canonical_url
- provider
- embed_type
- title_nullable
- preview_asset_id_nullable
- safe_embed_html_nullable
- created_by
- created_at

### LinkReference
Cross-resource linking.

Fields:
- id
- source_resource_type
- source_resource_id
- target_resource_type
- target_resource_id
- label_nullable
- created_by
- created_at

---

## 6. Routing and URL Model

## 6.1 New canonical routes
Use human-usable and system-stable URLs.

Examples:
- `/drawing/:drawingId`
- `/d/:drawingId`
- `/team/:teamSlug/folder/:folderPath`
- `/team/:teamSlug/project/:projectSlug`
- `/team/:teamSlug/drawing/:drawingId`
- `/shared/:shareToken`

Recommended primary route:
- `/drawing/:drawingId`

Optional SEO/friendly variant:
- `/drawing/:drawingId-:slug`

Important rule:
- ID is canonical
- slug is cosmetic
- route resolution must never break if title changes

## 6.2 Folder routes
For nested folders:
- `/team/:teamSlug/f/:folderPath`

Need a path resolver that maps slug chains to folder IDs safely.

## 6.3 Link stability rules
- drawing links never change because title changed
- folder/project slugs may redirect if renamed
- shared links are token-based and revocable
- public access must never expose internal numeric IDs

---

## 7. Storage Model

## 7.1 Storage strategy
Remove browser/local persistence options from the product UI.

Only support:
- backend-managed canonical storage
- explicit export/import as secondary operations

## 7.2 What should be stored server-side
- drawing document snapshots
- revisions
- thumbnails
- exports
- uploaded assets
- template snapshots
- embed preview metadata
- activity metadata
- optional collaboration event logs if needed

## 7.3 Filesystem layout
Do not dump random files in flat folders. That becomes garbage fast.

Example:
- `/data/users/...` only if truly needed
- `/data/teams/{team_id}/drawings/{drawing_id}/revisions/{revision_id}.json`
- `/data/teams/{team_id}/drawings/{drawing_id}/assets/{asset_id}`
- `/data/teams/{team_id}/drawings/{drawing_id}/thumbnails/{asset_id}.webp`
- `/data/templates/{template_id}/snapshot.json`

## 7.4 Storage rules
- all file reads/writes only through backend service
- never trust user-provided path names
- generate internal storage paths server-side
- validate MIME type and content
- enforce size limits
- generate safe filenames
- store original metadata separately from path

---

## 8. Auth and Identity

## 8.1 Required auth methods
- GitHub OAuth
- email/password
- invite-based onboarding

## 8.2 Recommended auth model
Use secure server-side sessions with httpOnly cookies where possible.

Avoid:
- spraying long-lived bearer tokens around the browser
- mixing weak custom auth with OAuth hacks

## 8.3 Required features
- email verification for password accounts
- password reset
- invite acceptance
- linking multiple auth methods to one account
- team invites
- session revocation
- device/session management

## 8.4 Security requirements
- Argon2id or bcrypt with sane parameters for passwords
- short-lived session tokens with rotation
- secure cookie flags
- CSRF protection for cookie-authenticated mutations
- brute-force protection
- rate limiting for login, reset, invite endpoints

---

## 9. Authorization Model

## 9.1 Permission goals
Permissions must be explicit and predictable, not “hope the frontend hides the button”.

## 9.2 Resource scopes
Permissions should exist at:
- team
- project
- folder
- drawing
- share link

## 9.3 Role model
Baseline team roles:
- owner
- admin
- editor
- viewer

Resource-level permissions:
- view
- comment
- edit
- manage
- share
- invite

## 9.4 Inheritance
Suggested inheritance:
- team permissions flow down by default
- project/folder can narrow or extend access
- drawing can override within allowed rules

Need deterministic permission resolution:
1. deny if user suspended / revoked
2. team membership baseline
3. resource-specific grants
4. inherited grants
5. share-link constraints
6. owner/admin override

## 9.5 Important warning
Permission inheritance bugs will become one of the nastiest classes of bugs in this product. This needs a formal permission resolver with tests, not scattered `if` statements all over controllers.

---

## 10. Collaboration Model

## 10.1 Realtime collaboration goals
- live cursors
- live drawing edits
- live presence
- optional user attribution
- conflict-safe persistence

## 10.2 Session model
When user opens drawing:
- authenticate
- authorize access
- join collaboration room bound to drawing ID
- sync latest revision
- stream operations
- periodically snapshot

## 10.3 Save strategy
Do not save entire document blindly on every tiny event forever.

Recommended:
- live ops in memory/realtime layer
- debounced autosave snapshots
- explicit revision checkpoints
- durable revision creation on important events

## 10.4 Collaboration metadata
Track:
- who joined
- who modified
- when saved
- current editors
- last activity time

---

## 11. Dashboard and File Management

## 11.1 Dashboard goals
This is one of the most important additions. Without this, it still feels like a toy.

Dashboard should include:
- recent drawings
- recent activity
- favorites
- team overview
- storage usage
- template shortcuts
- folder tree
- owned/shared drawings
- drafts / archived drawings
- collaboration summaries

## 11.2 File/folder management
Folders must support:
- nested structure
- move
- rename
- archive
- share
- permission management
- folder link
- filter/sort/search
- bulk actions

## 11.3 Drawing management
Each drawing should support:
- title
- description
- thumbnail
- tags
- owner
- folder
- project
- permissions
- history
- duplicate
- move
- archive
- export
- share

## 11.4 Search
Must support:
- drawing title
- description
- folder name
- template name
- tags
- maybe content metadata later

---

## 12. Templates System

## 12.1 Template goals
Templates should feel native, not like random example files.

## 12.2 Template categories
- ToDo board
- Kanban
- Meeting notes
- Brainstorm
- User journey
- Mind map
- Architecture diagram
- Flowchart
- Product roadmap
- Incident response
- Retrospective
- Weekly planning
- Wireframe starter
- Empty structured grid
- Markdown notes block layout

## 12.3 Template behavior
User can:
- create drawing from template
- save current drawing as template
- browse team templates
- browse system templates
- clone/edit own templates

## 12.4 Structured widgets
To support your vision, templates should also bring semi-structured content primitives:
- kanban columns
- checklist blocks
- sticky notes
- markdown text areas
- roadmap lanes
- swimlanes
- basic tables
- quick forms
- voting dots

These can start as smart grouped elements, then become richer later.

---

## 13. Linking and Knowledge Graph

## 13.1 Required linking capabilities
Users should be able to:
- link drawing to drawing
- link drawing to folder
- link drawing to project
- link drawing to embed
- add references/backlinks

## 13.2 Example features
- “related drawings”
- “linked from”
- “linked resources”
- graph view later
- open related drawing from side panel

## 13.3 Use cases
- architecture diagram linked to implementation board
- task board linked to planning board
- team folder linked to standard template
- roadmap drawing linked to release notes resources

---

## 14. Embeds

## 14.1 Vision
Embeds should work broadly, but not recklessly.

## 14.2 Hard truth
“Embed any website” is where people accidentally build an SSRF machine, an XSS mess, and a clickjacking liability.

So the design needs two layers:

### Safe embed modes
1. URL card preview
2. iframe embed where target allows framing
3. provider-native embed adapters
4. screenshot/preview service later if needed

## 14.3 Initial embed support
Support:
- generic link cards
- iframe embeds for sites that allow it
- provider adapters for known sites
- fallback to link preview if framing blocked

## 14.4 Security rules for embeds
- sanitize all URLs
- allow only `http` and `https`
- block localhost/internal/private IP resolution
- never fetch arbitrary remote URLs server-side without SSRF protections
- sandbox iframes aggressively
- set referrer policy
- disallow dangerous protocols
- strip unsafe HTML
- never trust embed provider content

---

## 15. Activity History and Audit

## 15.1 Goals
Need both user-facing history and admin-grade audit.

## 15.2 User-facing activity examples
- created drawing
- renamed drawing
- moved drawing
- updated permissions
- shared folder
- joined team
- applied template
- inserted embed
- restored revision

## 15.3 Audit events
Log:
- login success/failure
- invite sent/accepted/revoked
- role changes
- share link created/revoked
- permission changes
- deletion/archive/restore
- export events if relevant
- admin actions

## 15.4 Revision history
Need:
- revision list
- restore revision
- compare metadata between revisions
- who changed it
- optional change summary

---

## 16. Internationalization

## 16.1 Goals
- remove all Chinese strings
- no hardcoded text
- proper locale files
- scalable translation workflow

## 16.2 Requirements
- use message keys everywhere
- locale files per language
- lazy load locales if needed
- support fallback locale
- allow user locale preference
- make date/time/number formatting locale-aware

## 16.3 Initial languages
- English
- Czech
- maybe Chinese removed initially, re-added only if intentionally translated later

## 16.4 Important rule
Do not do a dumb search-and-replace translation pass. That always rots. Build proper i18n infrastructure first.

---

## 17. Branding and Product Cleanup

## 17.1 Remove all references to Excalidraw+
- remove links
- remove branding leaks
- remove upsell references
- replace with your own product identity

## 17.2 Product naming
Decide whether this remains “Excalidraw FULL” internally or becomes a distinct product brand.
It should become its own thing if you are serious.

## 17.3 Visual identity
Need a consistent design system for:
- dashboard
- workspace shell
- folder/file browser
- sharing dialogs
- team management
- analytics widgets

---

## 18. Frontend Overhaul

## 18.1 App shell
Create a proper app shell:
- left nav
- workspace header
- folder/project sidebar
- activity drawer
- detail panel
- command palette

## 18.2 Main UX sections
- dashboard
- team/project browser
- drawing editor
- templates browser
- settings
- admin/security
- activity/history
- shared resources

## 18.3 UI/UX requirements
- clean information hierarchy
- not bloated
- drawing remains center stage
- fast loading
- keyboard friendly
- responsive
- accessible

## 18.4 Critical UX decisions
Do not turn the canvas into a crowded Frankenstein UI.
Everything extra must be layered around the canvas, not dumped on top of it.

---

## 19. Backend Overhaul

## 19.1 API domains
Split APIs into modules:
- auth
- users
- teams
- invites
- folders
- drawings
- revisions
- assets
- templates
- permissions
- shares
- activity
- embeds
- admin

## 19.2 API requirements
- strict input validation
- centralized auth middleware
- centralized permission checks
- typed responses
- consistent error model
- idempotent safe endpoints where needed
- pagination
- sorting/filtering
- audit hooks

## 19.3 Drawing save API
Need explicit endpoints for:
- create drawing
- load drawing
- autosave drawing
- create revision
- duplicate drawing
- move drawing
- archive/restore drawing
- export drawing
- list drawing history
- restore revision

---

## 20. Security Hardening Plan

## 20.1 Authentication security
- secure password hashing
- secure cookie sessions
- session rotation
- revoke sessions on password reset
- OAuth state validation
- PKCE where applicable
- email verification
- brute-force rate limits

## 20.2 Authorization security
- centralized permission engine
- no frontend-only authorization assumptions
- every read/write route checks access
- resource ownership checks tested
- no trust in client-submitted team/resource identifiers

## 20.3 Input validation
Validate:
- titles
- descriptions
- slugs
- URLs
- embed data
- invite payloads
- file metadata
- search params
- filter/sort fields

## 20.4 XSS protection
- sanitize rich text / markdown-like fields
- escape user-generated content everywhere
- sanitize embeds
- CSP policy
- avoid unsafe HTML rendering
- no blind `dangerouslySetInnerHTML` style hacks unless strictly sanitized

## 20.5 SSRF protection
Critical for embed/link preview systems:
- block private ranges
- block localhost
- block internal metadata endpoints
- DNS rebinding protections where possible
- allowlist protocols
- restrict outbound fetch behavior

## 20.6 File security
- MIME sniffing and validation
- size limits
- image processing safety
- random internal filenames
- path traversal prevention
- virus scanning optional later
- never execute uploaded content

## 20.7 CSRF/CORS
- proper CORS policy
- CSRF protection for session-auth mutations
- no wildcard origin nonsense in production
- cookie same-site settings reviewed

## 20.8 Secrets
- env validation on boot
- no secrets in frontend bundles
- secret rotation process
- secure default config

## 20.9 Abuse controls
- rate limiting
- invite abuse limits
- share link generation limits
- export abuse limits
- suspicious activity logs

## 20.10 Audit and observability
- auth audit logs
- security event logs
- failed permission attempts
- structured logs
- error monitoring
- health endpoints

---

## 21. Testing Strategy

## 21.1 Required test layers
- unit tests
- integration tests
- permission matrix tests
- realtime collaboration tests
- e2e tests
- security-focused regression tests

## 21.2 Must-test areas
- auth flows
- invite flows
- permission inheritance
- share links
- drawing load/save/revision restore
- folder move logic
- team membership changes
- embed sanitization
- file upload validation
- activity logging

## 21.3 Non-negotiable
Permission matrix tests are mandatory.
Without them, this product will leak access sooner or later.

---

## 22. Migration Plan

## 22.1 Phase 0 - Discovery
Goals:
- inspect current codebase
- map architecture
- identify auth/storage/canvas boundaries
- inventory routes and DB models
- document current security risks
- define what gets kept vs replaced

Deliverables:
- system audit
- security audit
- code map
- backlog
- target architecture spec

## 22.2 Phase 1 - Stabilization
Goals:
- remove dead/bad features
- remove broken save modes
- remove branding leaks
- add env validation
- patch obvious auth/security issues
- add logging
- add test harness
- install i18n foundation

Deliverables:
- stable baseline branch
- CI
- test runner
- basic locale system
- cleaned product copy

## 22.3 Phase 2 - Data and storage refactor
Goals:
- move to PostgreSQL
- define canonical entities
- backend-owned drawing persistence
- revision model
- asset model
- folder/project model

Deliverables:
- migrations
- new storage adapter
- drawing resource APIs
- filesystem layout
- migration scripts if old data exists

## 22.4 Phase 3 - Auth and permissions rebuild
Goals:
- proper user accounts
- GitHub + password auth
- invites
- teams
- role model
- permission engine

Deliverables:
- sessions
- auth identity tables
- invite workflow
- team membership APIs
- permission resolver
- tests

## 22.5 Phase 4 - URL and routing overhaul
Goals:
- drawing URLs
- folder routes
- resource pages
- stable canonical links

Deliverables:
- new router
- route guards
- redirects from old links
- shared/public route flow

## 22.6 Phase 5 - Dashboard and file management
Goals:
- dashboard shell
- folder tree
- project/folder pages
- drawing management
- search/filter/sort

Deliverables:
- dashboard UI
- recent activity widgets
- file browser
- management actions

## 22.7 Phase 6 - Collaboration and history
Goals:
- improve live collaboration
- revision history
- activity events
- restore flows
- who-changed-what metadata

Deliverables:
- collaboration room model
- activity feed
- revision browser
- restore action

## 22.8 Phase 7 - Templates and linking
Goals:
- built-in templates
- user/team templates
- linking between resources
- related content panel

Deliverables:
- template manager
- template gallery
- reference system
- linked resources UI

## 22.9 Phase 8 - Embeds
Goals:
- safe generic embeds
- provider adapters
- link cards
- sandboxed iframe handling

Deliverables:
- embed service
- preview metadata
- URL validation pipeline
- provider registry

## 22.10 Phase 9 - Polish and launch hardening
Goals:
- performance pass
- accessibility
- security review
- docs
- deployment scripts
- admin settings
- observability

Deliverables:
- production checklist
- deployment guide
- admin guide
- release candidate

---

## 23. Suggested Milestones

## Milestone 1 - Secure foundation
Scope:
- code audit
- remove branding leaks
- i18n setup
- env validation
- auth/session cleanup
- logging
- test infra

## Milestone 2 - Real resource model
Scope:
- Postgres
- drawings/folders/projects
- backend-only saving
- canonical URLs
- revisions

## Milestone 3 - Teams and permissions
Scope:
- users
- teams
- invites
- role model
- access engine
- sharing

## Milestone 4 - Dashboard productization
Scope:
- dashboard
- search
- browser
- stats
- management UI

## Milestone 5 - Power features
Scope:
- templates
- linking
- history
- embeds
- richer collaboration

---

## 24. Engineering Backlog by Priority

## P0 - Critical
- full codebase audit
- remove all local/browser save modes from UI and backend
- define canonical drawing resource API
- implement secure auth/session model
- centralized authorization checks
- migrate to Postgres
- add revision storage
- canonical drawing route
- remove product branding leaks
- i18n base
- file storage security hardening
- permission tests
- env validation
- security headers and CSP
- basic audit logs

## P1 - High
- dashboard
- folders/projects
- team model
- invites
- share links
- activity feed
- template system
- search/filter/sort
- thumbnails
- collaborative metadata

## P2 - Medium
- advanced embeds
- related resources
- graph/backlinks
- comments
- notifications
- export workflows
- analytics widgets

## P3 - Later
- admin analytics
- webhooks
- API tokens
- external integrations
- advanced diff tools
- AI helpers

---

## 25. Risks

## 25.1 Biggest technical risks
- current codebase may be architecturally messy
- hard to untangle canvas state from persistence
- permission inheritance complexity
- realtime sync edge cases
- embed security
- migration from current storage model
- UI bloat if dashboard and canvas are not separated properly

## 25.2 Biggest product risks
- trying to make it Notion, Miro, Jira, and Excalidraw all at once
- overbuilding before stabilizing fundamentals
- killing the simplicity that makes drawing tools good

## 25.3 How to avoid product failure
Keep the center of gravity clear:
- this is a canvas-first collaboration and planning platform
- not a generic everything app
- structure should support the canvas, not replace it

---

## 26. Recommended Delivery Approach

## 26.1 Build order
Do not start with templates or embeds.
That is how teams waste weeks on shiny nonsense.

Correct order:
1. audit and stabilize
2. auth and permissions
3. storage and data model
4. canonical URLs
5. dashboard and file management
6. revisions/activity
7. templates
8. embeds
9. polish

## 26.2 Repo strategy
Use a serious branch structure:
- `main`
- `stabilization`
- `auth-permissions`
- `storage-refactor`
- `dashboard`
- `templates`
- `embeds`

## 26.3 Documentation requirements
Maintain:
- architecture.md
- auth.md
- permissions.md
- storage.md
- api.md
- deployment.md
- security.md
- i18n.md

---

## 27. Definition of Done

A release is not done because the UI looks better.
It is done when all of this is true:

- every drawing has a canonical backend-backed URL
- no browser/local save mode remains in the product flow
- all major actions are permission-checked server-side
- auth supports GitHub, password, invites
- users can organize drawings into folders/projects
- teams and sharing work predictably
- history and revisions exist
- templates exist
- embeds are safe
- i18n is in place
- branding is cleaned
- tests cover auth, permissions, storage, sharing, and revisions
- deployment is documented
- logs and health checks exist
- obvious security holes are closed

---

## 28. Final Recommendation

This should be treated as a product rewrite in layers, not a casual cleanup.

Do not try to patch every issue inside the current structure forever.
If the current foundation is weak, carve out stable domains and replace the bad guts deliberately.

The smartest path is:
- preserve the canvas experience
- replace the weak product shell around it
- build a serious backend ownership model
- formalize permissions early
- keep the UX clean and sharp
- resist feature creep until the foundation is hard

If done right, this stops being “better self-hosted Excalidraw”
and becomes a genuinely useful visual workspace product.

---