# Excalidraw FULL - Frontend Design System

## Design Context

### Target Audience
- Product teams who need visual collaboration tools
- Developers creating architecture diagrams, flowcharts
- Designers wireframing and prototyping
- Educators and facilitators running workshops
- Anyone who prefers hand-drawn aesthetics over sterile diagrams

### Use Cases
- Brainstorming and ideation sessions
- System architecture and technical diagrams
- UI/UX wireframing and user flows
- Kanban boards and project planning
- Meeting notes and retrospectives
- Mind mapping and knowledge organization

### Brand Personality
**Hand-crafted technical workspace**
- Human and approachable (hand-drawn aesthetic)
- Professional but not sterile
- Creative and collaborative
- Calm, uncluttered interface
- Self-hosted, privacy-conscious

### Tone
Warm minimalism meets technical precision. The hand-drawn style softens technical content, making complex diagrams feel accessible and collaborative.

---

## Color System

### Primary Palette
```css
--color-primary: #6965db;           /* Main purple */
--color-primary-darker: #5b57d1;  /* Hover states */
--color-primary-darkest: #4a47b1;  /* Active states */
--color-primary-light: #e3e2fe;     /* Subtle backgrounds */
--color-primary-hover: #5753d0;     /* Interactive hover */
```

### Neutral Palette
```css
--color-gray-10: #f5f5f5;  /* Lightest background */
--color-gray-20: #ebebeb;  /* Card backgrounds */
--color-gray-30: #d6d6d6;  /* Borders subtle */
--color-gray-40: #b8b8b8;  /* Disabled states */
--color-gray-50: #999999;  /* Muted text */
--color-gray-60: #7a7a7a;  /* Secondary text */
--color-gray-70: #5c5c5c;  /* Body text light */
--color-gray-80: #3d3d3d;  /* Body text */
--color-gray-85: #242424;  /* Headings */
--color-gray-90: #1e1e1e;  /* Strong text */
--color-gray-100: #121212; /* Near black */
```

### Semantic Colors
```css
--color-success: #cafccc;
--color-success-text: #268029;
--color-warning: #fceeca;
--color-warning-dark: #f5c354;
--color-danger: #db6965;
--color-danger-dark: #d65550;
--color-danger-text: #700000;
```

### Surface Colors (Light Mode)
```css
--island-bg-color: #ffffff;
--color-surface-low: #f8f9fa;
--color-surface-high: #e9ecef;
--color-surface-primary-container: #e3e2fe;
--color-on-surface: #1e1e1e;
--color-on-primary-container: #4a47b1;
```

---

## Typography

### Font Stack
```css
--ui-font: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--editor-font: "Virgil", "Cascadia", "Segoe UI", sans-serif; /* Hand-drawn feel */
```

### Type Scale
```css
--text-xs: 0.75rem;    /* 12px - Captions, labels */
--text-sm: 0.875rem;   /* 14px - Secondary text */
--text-base: 1rem;     /* 16px - Body text */
--text-lg: 1.125rem;  /* 18px - Large body */
--text-xl: 1.25rem;   /* 20px - H4 */
--text-2xl: 1.5rem;   /* 24px - H3 */
--text-3xl: 1.875rem; /* 30px - H2 */
--text-4xl: 2.25rem;  /* 36px - H1 */
```

### Font Weights
- **400** Regular - Body text
- **500** Medium - Emphasis, labels
- **600** Semibold - Subheadings
- **700** Bold - Headings, important text

---

## Spacing System

### Base Unit
```css
--space-factor: 0.25rem; /* 4px base */
```

### Scale
```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

---

## Component Patterns

### Island Pattern (Excalidraw Signature)
Floating container with subtle shadow:
```css
.island {
  background: var(--island-bg-color);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-island);
  padding: var(--space-4);
}
```

### Buttons

**Primary Button**
```css
.btn-primary {
  background: var(--color-primary);
  color: white;
  border-radius: var(--border-radius-lg);
  padding: 0.625rem 1rem;
  font-weight: 500;
  
  &:hover { background: var(--color-primary-hover); }
  &:active { background: var(--color-primary-darkest); }
}
```

**Secondary Button**
```css
.btn-secondary {
  background: var(--color-surface-low);
  color: var(--color-on-surface);
  border: 1px solid var(--color-surface-high);
  border-radius: var(--border-radius-lg);
  
  &:hover { background: var(--color-surface-high); }
}
```

**Ghost Button**
```css
.btn-ghost {
  background: transparent;
  color: var(--color-on-surface);
  
  &:hover { background: var(--color-surface-low); }
}
```

### Cards

**Drawing Card**
```css
.drawing-card {
  background: var(--island-bg-color);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-island);
  overflow: hidden;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-island-stronger);
  }
}
```

### Form Inputs

**Text Input**
```css
.input {
  background: var(--input-bg-color);
  border: 1px solid var(--input-border-color);
  border-radius: var(--border-radius-md);
  padding: 0.5rem 0.75rem;
  font-size: var(--text-base);
  
  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
  }
  
  &:hover:not(:focus) {
    background: var(--input-hover-bg-color);
  }
}
```

---

## Layout Patterns

### App Shell Structure
```
┌─────────────────────────────────────────────────────────┐
│  Sidebar    │  Header                                   │
│             ├─────────────────────────────────────────────┤
│             │                                             │
│  Navigation │              Main Content                   │
│             │                                             │
│             │                                             │
│             │                                             │
└─────────────┴─────────────────────────────────────────────┘
```

### Dashboard Grid
```css
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-6);
}
```

### Sidebar Navigation
```css
.sidebar {
  width: 260px;
  background: var(--island-bg-color);
  border-right: 1px solid var(--color-gray-20);
  padding: var(--space-4);
}
```

---

## Shadows & Effects

```css
--shadow-island: 0px 0px 1px 0px rgba(0, 0, 0, 0.17),
  0px 0px 3px 0px rgba(0, 0, 0, 0.08), 
  0px 7px 14px 0px rgba(0, 0, 0, 0.05);

--shadow-island-stronger: 0px 0px 1px 0px rgba(0, 0, 0, 0.17),
  0px 0px 3px 0px rgba(0, 0, 0, 0.08), 
  0px 7px 14px 0px rgb(0 0 0 / 18%);

--modal-shadow: 0px 100px 80px rgba(0, 0, 0, 0.07),
  0px 41.7776px 33.4221px rgba(0, 0, 0, 0.05),
  0px 22.3363px 17.869px rgba(0, 0, 0, 0.04);
```

---

## Border Radius

```css
--border-radius-sm: 0.25rem;  /* 4px */
--border-radius-md: 0.375rem;  /* 6px */
--border-radius-lg: 0.5rem;    /* 8px */
--border-radius-xl: 0.75rem;   /* 12px */
--border-radius-full: 9999px;  /* Pills, avatars */
```

---

## Animation & Transitions

### Timing
```css
--duration-fast: 0.15s;
--duration-normal: 0.2s;
--duration-slow: 0.3s;
```

### Easing
```css
--ease-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

### Common Transitions
```css
/* Hover states */
transition: background-color var(--duration-fast) var(--ease-out);

/* Card interactions */
transition: transform var(--duration-fast) var(--ease-out),
            box-shadow var(--duration-fast) var(--ease-out);

/* Modal/dialog */
transition: opacity var(--duration-normal) var(--ease-out),
            transform var(--duration-normal) var(--ease-out);
```

---

## Icon System

- 16px (default-icon-size) for inline UI
- 20px (lg-icon-size) for buttons
- 24px for navigation
- Lucide icons preferred for consistency
- Stroke width: 1.5px - 2px

---

## Responsive Breakpoints

```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
--breakpoint-2xl: 1536px;
```

---

## Page Specifications

### Dashboard
- Grid of drawing cards with thumbnails
- Recent activity sidebar
- Quick actions header
- Team selector

### File Browser
- Folder tree sidebar
- Breadcrumb navigation
- Sortable/filterable drawing list
- Bulk actions toolbar

### Auth Pages
- Centered card layout
- Clean, minimal design
- Clear call-to-action
- Social auth buttons (GitHub)

### Editor (Canvas)
- Full-screen canvas
- Minimal surrounding UI
- Floating toolbars (island pattern)
- Collapsible side panels

### Settings
- Tabbed interface
- Sidebar navigation for sections
- Clear section headers
- Form-based layout
