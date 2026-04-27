# Excalidraw FULL Frontend

Production-grade frontend for the Excalidraw FULL overhaul.

## Stack

- React 19 + TypeScript
- Vite (fast HMR, optimized builds)
- SCSS Modules (scoped styles)
- Zustand (state management)
- React Router (routing)
- Lucide React (icons)

## Design System

Excalidraw's hand-drawn aesthetic preserved:
- **Island UI**: Floating panels with subtle shadows
- **Primary**: Purple (`#6965db`)
- **Typography**: Inter font, clear hierarchy
- **Shadows**: Multi-layer island shadows
- **Radii**: Consistent 6-12px rounding

## Pages

| Route | Page | Features |
|-------|------|----------|
| `/` | Dashboard | Stats, recent drawings, activity, templates |
| `/login` | Login | Email/password + GitHub OAuth |
| `/signup` | Signup | Account creation |
| `/files` | File Browser | Folder tree, grid/list view, drawing cards |
| `/team` | Team Settings | Members, roles, invites |
| `/settings` | User Settings | Profile, account, notifications, appearance |
| `/templates` | Templates | Gallery with categories |
| `/drawing/:id` | Editor | Canvas placeholder (integrate Excalidraw) |

## Quick Start

```bash
npm install
npm run dev        # Development server at http://localhost:3000
npm run typecheck  # Type checking
npm run build      # Production build
```

## API Integration

Update `src/services/api.ts` endpoints to match your Go backend:
- `GET /api/auth/me` - Current user
- `POST /api/auth/login` - Login
- `GET /api/drawings` - List drawings
- `GET /api/teams` - List teams

The Vite proxy forwards `/api` to `http://localhost:3002`.

## Canvas Integration

To integrate the existing Excalidraw canvas:

1. Install package: `npm install @excalidraw/excalidraw`
2. Import in `Editor.tsx`: `import { Excalidraw } from '@excalidraw/excalidraw'`
3. Replace the placeholder div with the `<Excalidraw />` component
4. Wire up `onChange` to save via API

## Project Structure

```
src/
├── components/    # Reusable UI (Button, Input, Card, Layout)
├── pages/         # Route components
├── stores/        # Zustand state
├── services/      # API clients
├── types/         # TypeScript interfaces
└── styles/        # SCSS variables, global styles
```
