# Design Standards

_Validated visual and interaction standards. Code-enforced where possible, documented where not._

**Target experience:** [docs/product-architecture.md](docs/product-architecture.md) owns objects and navigation. [docs/workspace-interface.md](docs/workspace-interface.md) owns states. [docs/product-prd.md](docs/product-prd.md) owns behavior. [knowledge/vision.md](knowledge/vision.md) owns direction. [docs/voice-and-copy.md](docs/voice-and-copy.md) owns customer-facing language. Current report layout rules are compatibility-only in [knowledge/report-contract.md](knowledge/report-contract.md).

## Design principles

1. Calm, clear care for the website. Human status and evidence lead. Public language follows Flag. Fix. Verify. and 0 Flags, not dashboard-operation copy.
2. Preserve FixFlags' brand identity and approved orange through canonical tokens.
3. Mobile-first simplicity. Desktop shares the same mental model.
4. Progressive depth: understandable Flag first, technical detail when needed.
5. Coverage and freshness make healthy states trustworthy; scores remain secondary.

## Authoritative sources (in priority order)

1. `lib/design/tokens.css` — CSS custom properties for all colors, shadows, radii, type scale, glass effects, animations
2. `tailwind.config.ts` — Tailwind theme: font families, colors, box shadows, border radii, letter spacing, line heights, keyframes
3. `components/ui/` — shadcn/ui primitives (34 components: button, card, dialog, accordion, etc.)
4. `components/` — application components following the tokens
5. `.cursor/rules/fixflags-ui.mdc` — UI craft rules (semantic tokens, anti-slop)
6. `.ui-craft/brief.md` — Design brief with product context

## Typography

| Role                          | Font                           | Weight  | Size              |
| ----------------------------- | ------------------------------ | ------- | ----------------- |
| Display (marketing hero only) | Inter Tight (var-font-display) | 600–700 | text-5xl (3.5rem) |
| Heading                       | Inter Tight                    | 600     | text-2xl/3xl/4xl  |
| Body                          | Inter (var-font-sans)          | 400     | text-base         |
| Marketing labels / eyebrows   | Inter                          | 600     | text-xs           |
| Score numbers                 | JetBrains Mono                 | 500–600 | tabular-nums      |
| Code, IDs, dates, step index  | JetBrains Mono (var-font-mono) | 500     | text-xs           |

- Marketing eyebrows and section labels are sentence case, muted, not uppercase, not mono
- Plan prices use Inter Tight with `tabular-nums`; status words such as Waitlist use the same display face
- JetBrains Mono is not a marketing display face
- `text-balance` on headings, `text-pretty` on body
- `tabular-nums` on all numeric scores
- Inter is UI font everywhere; Inter Tight reserved for marketing headings and display

## Color system (60/30/10)

| Proportion | Role                  | Token values                                          |
| ---------- | --------------------- | ----------------------------------------------------- |
| 60%        | Background / canvas   | `--background` (white `#FFFFFF` / dark ink `#0B0B0D`) |
| 30%        | Foreground / ink      | `--foreground`, `--card`, `--muted` (stone `#F5F6F7`) |
| 10%        | Brand orange (signal) | `--brand` Flag Orange `#FF5A00` in both themes, with accessible ink CTA text |

- Dark mode: fully re-authored, not inverted. Graphite canvas, charcoal glass, warm orbs.
- One accent per surface. Do not layer multiple accent colors.
- Grade colors (A-F) used only in report score contexts, not marketing.

### Status and evidence

Site status, Outcome state and Flag certainty follow [knowledge/evidence-rules.md](knowledge/evidence-rules.md). Brand and severity are different roles; include text with status color. Board attention and problem dots use `--brand`. Keep `--warning` amber for billing and quota caution. Keep evidence matched to source, viewport and time. Never invent a healthy twin capture or guess an overlay rectangle.

See `lib/design/tokens.css` for full HSL values. Raw hex only in `lib/design/brand-spec.ts` for non-CSS consumers.

## Shapes and radius

- Target board cards: thin subtle borders, approximately 13px radius and restrained shadows; see [card-board contract](docs/card-board-experience.md). Existing 24px glass/shadow cards are compatibility-only until migrated.
- Controls: `rounded-[var(--radius-control)]` (~10px)
- Concentric radii: inner = outer minus padding (`--radius-nested-md` = `--radius-card` − `--gap-nested-md`)
- Inputs: `--radius-input` (= control radius)

## Depth

- Target board: white/neutral surfaces, subtle borders and nearly imperceptible resting shadows. Avoid glass effects, excessive gradients and loud healthy fills.
- Borders remain appropriate on inputs, tables, controls and board cards.
- The dashboard has no visual sections. Library categories must not become dashboard boundaries.
- Marketing surfaces group content with whitespace, surface tone, and type hierarchy before strokes. Do not use divider lines between marketing rows, metrics, or narrative steps. Keep borders for controls and functional data boundaries only.
- Floating action offset: `--floating-action-offset` (1.25rem).

## Motion

- `--motion-fast`: 200ms base duration
- `--ease-out`: cubic-bezier(0, 0, 0.2, 1)
- `active:scale-[0.98]` on buttons for press feedback
- `prefers-reduced-motion` respected globally — no motion if user prefers reduced
- Entry animations: `fade-in-up` (0.4s), `scale-in` (0.3s), `soft-reveal` (0.2s), `capture-fade` (0.25s, opacity only, for captured evidence that must not move layout)
- Flag overlay on Preview is an inspect spotlight on a capture-time rectangle. Page-scope and unmeasured Flags use a chip. Never paint a guessed hero box.
- List/accordion: `accordion-down/up` (0.2s)
- No `transition: all`. Be specific about what animates.
- Marketing uses a quiet static canvas with restrained section tints.
- App, report, dashboard, and admin surfaces idle at zero running animations.
  Motion communicates state, expansion, or feedback.

## Spacing

| Token                       | Value                                 | Used for                                            |
| --------------------------- | ------------------------------------- | --------------------------------------------------- |
| `--space-card`              | 1.25rem                               | Card padding                                        |
| `--space-section-inner`     | 2.125rem                              | Section internal spacing                            |
| `--space-section-y`         | 2.75rem                               | Legacy compact section rhythm                       |
| `--space-section-default`   | clamp(3rem, 5vw, 4.5rem)              | General page sections                               |
| `--space-section-marketing` | clamp(4rem, 7vw, 7rem)                | Marketing narrative sections                        |
| `--space-hero-start/end`    | clamp(2rem–4.5rem) / clamp(3rem–6rem) | Responsive homepage hero breathing room             |
| `--space-block`             | 2rem                                  | Block-level spacing within sections                 |
| `--header-offset`           | 6.5rem                                | Top offset for page content below fixed header      |
| `--gap-nested-sm/md/lg`     | 0.5/0.75/1rem                         | Nested element gaps                                 |
| `--container-max-marketing` | 88rem                                 | Wider container for marketing hero/feature sections |

## Components

### Button

- Control radius (`--radius-control` ~10px)
- `active:scale-[0.98]` press effect
- Layered shadow on hover
- Min 44×44px hit target (`min-h-11 min-w-11`); carousel prev/next controls follow same rule
- Focus ring on `--ring`
- Light mode product primary: ink. Marketing accent CTAs: bright brand orange with ink labels (`variant="brand"`) so normal-size text meets WCAG AA. The owner’s September 8 palette replaces the former dark orange button fill.

### Card (`glass-surface`)

- `border-0 shadow-card`
- Inner elements use `rounded-nested-md`
- Raised shadow (`shadow-raised`) for elevation
- `glass-bg` variants: subtle, base, strong, elevated, nav

### Input

- Control radius (`--radius-input` / `--radius-control` ~10px)
- Border from `--input` / `--border`
- Focus ring from `--ring`

## Responsive behavior

- Default container max-width: 1280px (`max-w-5xl` / report `max-w-6xl`)
- Marketing hero / feature sections: `--container-max-marketing` (88rem) via `Container variant="marketing"`
- Marketing header height: `--header-height-marketing` (4.75rem); app header: `--header-height` (3.5rem); `--header-offset` (6.5rem) for `scroll-mt`
- Section tinting: Use `Section tint="subtle"` for consistent `bg-muted/20` background on alternating sections
- Padding: 1.25rem (default), 1.5rem (sm), 2rem (lg)
- Screenshots: 1280x900 desktop, 375x812 mobile aspect ratios
- Mobile frame width in UI: 240px

## States

The Site state matrix is in [docs/workspace-interface.md](docs/workspace-interface.md). The first analysis and completed Site share one persistent shell. Healthy, partial, unverified, stale, failed and paused states need truthful coverage and useful recovery actions.

Every interactive element must define: rest, hover, focus, active, disabled.

- Focus: `--focus-ring` (Flag Orange)
- Disabled: muted opacity, no shadow
- Error: `--destructive` color
- Loading: the same Site shell with persisted discoveries and skeletons for unavailable captures.
- Empty: EmptyState component with clear message + next action

## Icons

- Library: lucide-react (via `optimizePackageImports`)
- Sentence case labels. No all-caps on marketing eyebrows or section labels.
- No zap/lightning badge icons. No checkmark pill rows.

## Accessibility

- Focus rings on all interactive elements
- `prefers-reduced-motion` respected
- 44×44px minimum hit targets (`min-h-11 min-w-11`)
- Screen reader support in shadcn primitives (Radix)
- Heading hierarchy (h1 > h2 > h3) enforced by lint rules
- Color contrast: brand orange on backgrounds at WCAG AA minimum

## What to avoid

- Grid/dot backgrounds or decorative glow behind the hero
- Rotated cards with blur halos
- Traffic-light window chrome (unless showing real product UI)
- Staggered translate-y on grid items for fake depth
- Default blue/inter font stacks
- `transition: all`
- Raw hex values except `grade.*`
- Borders on cards (use shadows)
- Default gray backgrounds (use white canvas / ink)
