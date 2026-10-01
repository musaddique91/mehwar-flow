---
name: mehwar-design
description: >
  Design system reference for Mehwar Flow web frontend. Use this skill before
  building any new UI feature, dialog, component, or page to ensure it matches
  the existing theme, tokens, and interaction patterns exactly.
---

# Mehwar Flow — Design System Skill

Activate this skill whenever you are:
- Building a new UI component or page in `apps/web`
- Adding a dialog, modal, menu, chip, or form
- Choosing colors, spacing, typography, or animation values
- Reviewing whether an existing component matches the theme

---

## 1. Token System

All semantic tokens live in `apps/web/src/app/globals.css` and are exposed to Tailwind via `@theme inline`.

### Color Tokens (CSS vars → Tailwind class)

| Token | Light | Dark | Tailwind usage |
|---|---|---|---|
| `--bg` | `#f6f5fb` | `#07070f` | `bg-bg` |
| `--bg-elevated` | `#ffffff` | `#0e0e1a` | `bg-elevated` |
| `--fg` | `#0f1020` | `#f4f4fb` | `text-fg` |
| `--muted` | `#62647a` | `#9a9bb5` | `text-muted` |
| `--card` | `rgba(255,255,255,0.72)` | `rgba(20,20,36,0.6)` | `bg-card` |
| `--card-strong` | `rgba(255,255,255,0.92)` | `rgba(24,24,42,0.9)` | `bg-card-strong` |
| `--line` | `rgba(15,16,32,0.14)` | `rgba(255,255,255,0.14)` | `border-line`, `bg-line` |
| `--ring` | `rgba(168,85,247,0.45)` | `rgba(192,132,252,0.5)` | `ring-[var(--ring)]` |
| `--primary` | `#9333ea` | `#c084fc` | `text-primary` |

### Brand Colors (static, not theme-aware)

```
brand-1: #8b5cf6  (violet)
brand-2: #d946ef  (fuchsia)
brand-3: #f97316  (orange)
```

### Custom Utilities

| Utility class | What it does |
|---|---|
| `brand-gradient` | `bg-image: linear-gradient(120deg, #8b5cf6, #d946ef 50%, #f97316)` — use for primary CTAs and accent fills |
| `brand-text` | Same gradient as animated text clip — use for hero headings |
| `glass` | `bg-card + border-line + backdrop-blur-xl` — use for cards, modals, panels |
| `no-scrollbar` | Hides scrollbar visually |

---

## 2. Typography

- **Font**: Geist Sans (variable `--font-geist-sans`) via `font-sans`
- **Mono**: Geist Mono (variable `--font-geist-mono`) via `font-mono`
- **Smoothing**: `-webkit-font-smoothing: antialiased` on body (do not override)
- **Heading scale pattern**:
  - Section labels: `text-sm font-bold uppercase tracking-wider text-muted`
  - Dialog title: `text-lg font-bold text-fg`
  - Card subheadings: `text-sm font-semibold text-fg`
  - Meta / captions: `text-xs text-muted` or `text-[11px] text-muted`

---

## 3. Motion & Animation

**Library**: `motion/react` (Framer Motion v11+). Always import from `motion/react`, never `framer-motion`.

### Standard transition presets (set globally in `MotionConfig`):
```
type: 'spring', stiffness: 380, damping: 30
```

### Common animation patterns

```tsx
// Fade-in on mount
initial={{ opacity: 0, y: 12 }}
animate={{ opacity: 1, y: 0 }}

// Exit
exit={{ opacity: 0, y: -8 }}

// Subtle hover lift (buttons)
whileHover={{ y: -2, scale: 1.02 }}
whileTap={{ scale: 0.96 }}

// Dropdown pop-in
initial={{ opacity: 0, scale: 0.95, y: -6 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
exit={{ opacity: 0, scale: 0.95, y: -6 }}

// Modal slide-up
initial={{ y: 30, opacity: 0, scale: 0.96 }}
animate={{ y: 0, opacity: 1, scale: 1 }}
exit={{ y: 30, opacity: 0, scale: 0.96 }}
```

Always wrap conditional presence-based elements with `<AnimatePresence>`.

---

## 4. Core Shared Components

All in `apps/web/src/components/ui/index.tsx`.

### `<Button>`
```tsx
<Button variant="primary" | "secondary" | "ghost" | "danger" | "outline" size="sm" | "md" | "lg" loading={bool}>
```
- Primary: `brand-gradient` bg, white text, fuchsia glow shadow
- Secondary: `glass` surface, `text-fg`
- Ghost: transparent, `text-muted`, hover `bg-line`
- Danger: red-tinted bg/text
- Outline: `border-line bg-card text-fg`
- All buttons: `rounded-full`, spring hover/tap animations

### `<Modal>`
```tsx
<Modal open={bool} onClose={fn} title="..." maxWidth="max-w-md">
  {children}
</Modal>
```
- Renders via **`ReactDOM.createPortal`** to `document.body` — always escapes parent stacking context
- Backdrop: `fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm`
- Panel: `glass rounded-3xl bg-card-strong p-6 max-h-[88vh] flex flex-col border-line`
- Has internal scroll container: `flex-1 overflow-y-auto min-h-0`
- Use `maxWidth` prop to widen (e.g. `"max-w-lg"` for forms, `"max-w-xl"` for complex dialogs)
- Never re-implement a modal from scratch — always use this component

### `<Card>`
```tsx
<Card className="...">  // motion.div, glass, rounded-3xl, p-5
```

### `<Input>`
```tsx
<Input label="..." icon={<Icon />} error="..." />
```
- Height `h-12`, `rounded-2xl`, `border-line`, focus ring `focus-within:ring-4 focus-within:ring-[var(--ring)]`

### `<Switch>` / `<Badge>` / `<Skeleton>` / `<Avatar>`
Use these from `ui/index.tsx` rather than building custom versions.

---

## 5. Platform Branding

`apps/web/src/lib/platforms.tsx` exports `PLATFORM_BRAND` and `<PlatformIcon>`.

```tsx
import { PlatformIcon, PLATFORM_BRAND } from '@/lib/platforms';

// Always apply brand color explicitly on icons inside colored parent contexts:
<PlatformIcon
  platform={channel.platform}
  className="size-4"
  style={{ color: PLATFORM_BRAND[channel.platform].color }}
/>

// For avatar-style circles:
<span
  className="flex size-9 items-center justify-center rounded-full text-white shadow-md"
  style={{ background: PLATFORM_BRAND[channel.platform].gradient }}
>
  <PlatformIcon platform={channel.platform} className="size-4" />
</span>
```

**Rule**: Never inherit icon color from a status/badge parent (e.g., green chip). Always set `style={{ color: PLATFORM_BRAND[p].color }}` explicitly.

---

## 6. Status Chips / Badges

Post target status chips follow this pattern:

```tsx
// PUBLISHED — emerald
'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'

// SCHEDULED — blue
'bg-blue-500/15 text-blue-600 dark:text-blue-300'

// FAILED — red
'bg-red-500/15 text-red-500'

// PUBLISHING (in-progress) — amber
'bg-amber-500/15 text-amber-600 dark:text-amber-300'

// Generic muted chip
'bg-elevated text-muted border border-line'
```

All chips use: `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold`

---

## 7. Form Elements (non-Input component)

When building textareas or custom inputs outside of `<Input>`:

```tsx
// Textarea
className="w-full rounded-2xl border border-line bg-elevated/60 px-4 py-3 text-sm text-fg
           outline-none placeholder:text-muted/60 resize-none transition
           focus:border-fuchsia-400/60 focus:ring-4 focus:ring-fuchsia-500/15"

// Section label above a field
className="text-xs font-semibold uppercase tracking-wider text-muted"
```

---

## 8. Dropdown / Popover Menus

```tsx
// Container
className="glass absolute right-0 top-8 z-30 w-52 rounded-2xl bg-card-strong p-1.5 shadow-2xl"

// Regular item
className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium hover:bg-line"

// Danger item
className="... text-red-500 hover:bg-red-500/10"

// Accent/primary action item (e.g. cross-post)
className="... text-fuchsia-500 hover:bg-fuchsia-500/10"
```

Always animate with `initial/animate/exit` using the dropdown pop-in preset above.

---

## 9. Spacing & Shape Conventions

| Element | Border radius | Padding |
|---|---|---|
| Cards / Panels / Modals | `rounded-3xl` | `p-5` or `p-6` |
| Buttons | `rounded-full` | `px-5 h-11` (md) |
| Inputs / textareas | `rounded-2xl` | `px-4 py-3` |
| Menu items | `rounded-xl` | `px-3 py-2` |
| Chips / badges | `rounded-full` | `px-2.5 py-1` |
| Small chips | `rounded-full` | `px-2 py-0.5` |

---

## 10. Page Layout Pattern

```tsx
// App content max-width grid
<div className="mx-auto grid max-w-6xl gap-6 pt-2 xl:grid-cols-[minmax(0,1fr)_320px]">
  <div className="min-w-0 space-y-6">
    {/* Main content */}
  </div>
  <aside className="space-y-4">
    {/* Sidebar */}
  </aside>
</div>
```

---

## 11. Selection / Interactive Element Pattern

When building a selectable item list (e.g., channel picker in a dialog):

```tsx
<motion.button
  whileHover={{ scale: 1.01 }}
  whileTap={{ scale: 0.98 }}
  className={cn(
    'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition',
    isSelected
      ? 'border-fuchsia-500/60 bg-fuchsia-500/10 ring-1 ring-fuchsia-500/30'
      : 'border-line bg-card/60 hover:border-line/80 hover:bg-card',
  )}
>
```

Selected state always uses **fuchsia** (`fuchsia-500`) as the accent color — matching the brand gradient.

---

## 12. Empty States

```tsx
<div className="rounded-2xl bg-line/40 px-4 py-6 text-center text-sm text-muted">
  No items found.
</div>
```

---

## 13. Data Fetching Pattern

```tsx
import { useApi, invalidate } from '@/lib/hooks';
import { api, ApiError } from '@/lib/api';

// Read
const { data, error } = useApi<MyDto[]>('/endpoint', ['cacheKey']);

// Mutate
await api('/endpoint', { method: 'POST', json: body });
invalidate('cacheKey'); // triggers refetch across all components using that key
```

Always `invalidate()` after mutations so the feed/UI reflects changes immediately.

---

## 14. Toast Notifications

```tsx
import { toast } from 'sonner';

toast.success('Done!');
toast.error((err as ApiError).message);
```

Position: `bottom-center`, theme: `system`.

---

## 15. Anti-Patterns — Never Do These

- ❌ Never use inline `style={{ background: '#hex' }}` for theme colors — use CSS tokens instead
- ❌ Never use `z-50` for modals — use `z-[9999]` via the `Modal` component (portaled)
- ❌ Never import from `framer-motion` — always `motion/react`
- ❌ Never write a custom modal backdrop — use `<Modal>` from `ui/index.tsx`
- ❌ Never use plain `<button>` for animated interactions — use `<motion.button>` or `<Button>`
- ❌ Never hardcode `#ffffff` or `#000000` — use `text-fg`, `bg-bg`, `bg-card`, etc.
- ❌ Never let a platform icon inherit a status chip's text color — always set `style={{ color: PLATFORM_BRAND[p].color }}`
- ❌ Never use `overflow-hidden` on a container that has a `Modal` child — it breaks `fixed` positioning (use portals instead)
