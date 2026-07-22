# Design Standards

*Validated visual and interaction standards. Code-enforced where possible, documented where not.*

## Design principles

1. **Editorial + technical credibility** — the product looks like a sharp review, not a SaaS dashboard. Fraunces serif, glass cards, shadow depth, mono labels.
2. **Calm authority** — no gradients competing with content, no animations that distract. Motion serves understanding.
3. **Physical, not flat** — glass surfaces, layered shadows, concentric radii. Cards feel like they have depth.
4. **Contained, not sprawling** — three rubrics, not forty categories. Pill-shaped controls, not sharp corners.
5. **Recognizable, not generic** — Flag Orange, Fraunces headlines, mono labels. Unmistakably FixFlags.

These five compress Dieter Rams' ten principles of good design. The standing review of how well the product lives up to them, and the rules it produced (motion policy, status-component altitudes, durable core vs. treatment), lives in `docs/design-rams-review.md`.

## Authoritative sources (in priority order)

1. `lib/design/tokens.css` — CSS custom properties for all colors, shadows, radii, type scale, glass effects, animations
2. `tailwind.config.ts` — Tailwind theme: font families, colors, box shadows, border radii, letter spacing, line heights, keyframes
3. `components/ui/` — shadcn/ui primitives (34 components: button, card, dialog, accordion, etc.)
4. `components/` — application components following the tokens
5. `.cursor/rules/fixflags-ui.mdc` — UI craft rules (semantic tokens, anti-slop)
6. `.ui-craft/brief.md` — Design brief with product context

## Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| Display (marketing hero only) | Fraunces (var-font-serif) | 600 | text-5xl (3.5rem) |
| Heading | Fraunces | 600 | text-2xl/3xl/4xl |
| Body | Satoshi (var-font-sans) | 400 | text-base |
| Labels (uppercase) | IBM Plex Mono (var-font-mono) | 500 | text-xs |
| Score numbers | IBM Plex Mono | 600 | tabular-nums |

- `text-balance` on headings, `text-pretty` on body
- `tabular-nums` on all numeric scores
- Satoshi is UI font everywhere; Fraunces reserved for marketing headings and display

## Color system (60/30/10)

| Proportion | Role | Token values |
|------------|------|--------------|
| 60% | Background / canvas | `--background` (warm white `#FAF8F4` / dark graphite `#111`) |
| 30% | Foreground / ink | `--foreground`, `--card`, `--muted` |
| 10% | Brand orange (signal) | `--brand` (Flag Orange `#FF4B00` / dark `#FF5C1A`) |

- Dark mode: fully re-authored, not inverted. Graphite canvas, charcoal glass, warm orbs.
- One accent per surface. Do not layer multiple accent colors.
- Grade colors (A-F) used only in report score contexts, not marketing.

### Report altitude (score ownership)

| Altitude | Surface | Score treatment |
|----------|---------|-----------------|
| Identity | `AuditReportHero` | `ScoreDot` only |
| Rubric summary | `RubricBar` | Per-rubric numbers |
| Working triage | `ReportExplorer` | `ScoreRingGauge` **sm** (68px) beside rubric/page filters (no severity filter) |
| Stuck chrome | `ReportStickyToolbar` when stuck | hostname + `ScoreDot` |

Share status appears once (`ShareStatusBanner`). Sticky toolbar uses `top-[var(--header-height)]` under the site header. Tokens: `--header-height` (3.5rem), `--header-offset` (6.5rem) for `scroll-mt`.

**Flags chrome:** Meta row is `SeveritySignal` → Rubric → Impact. List is severity-ranked; no severity filter pills. Evidence screenshots match `devicesForCheck` (issue device only).

**Progressive / loading:** The in-progress report uses the same altitudes as completed (`AuditReportHero` with scanning label, `RubricBar` loading, sticky, Contract → Timeline → Flags). Progress advances with real pipeline stages and partial flags; never fake. On COMPLETED, hold the progressive frame until `router.refresh()` swaps in SSR `AuditReport`.

See `lib/design/tokens.css` for full HSL values. Raw hex only in `lib/design/brand-spec.ts` for non-CSS consumers.

## Shapes and radius

- Cards: `border-0 shadow-card glass-surface` + `rounded-card` (~27px / `--radius-card`)
- Controls: `rounded-full` (9999px pill shape)
- Concentric radii: inner = outer minus padding (`--radius-nested-md` = `--radius-card` − `--gap-nested-md`)
- Inputs: `rounded-pill` (pill inputs)

## Depth

- Shadow-first layering. Cards get `shadow-card` resting and `shadow-card-hover` on interaction.
- Glass surfaces: `glass-shadow` with subtle border inset.
- Borders only on inputs and table rows. Cards use shadows, not borders.
- Sections separated by `bg-muted/35`, not `border-y`.
- Floating action offset: `--floating-action-offset` (1.25rem).

## Motion

- `--motion-fast`: 200ms base duration
- `--ease-out`: cubic-bezier(0, 0, 0.2, 1)
- `active:scale-[0.96]` on buttons for press feedback
- `prefers-reduced-motion` respected globally — no motion if user prefers reduced
- Entry animations: `fade-in-up` (0.4s), `scale-in` (0.3s), `soft-reveal` (0.2s)
- List/accordion: `accordion-down/up` (0.2s)
- No `transition: all`. Be specific about what animates.
- Peach orbs: gentle drift (22-30s cycle), breathe (14s cycle).
- **Ambient motion is a marketing-landing signature only.** App, report,
  dashboard, and admin surfaces idle at zero running animations — motion there
  communicates state (progress, expansion, feedback) or does not exist.
  `SiteShell` enforces this via its `backdrop` prop; surfaces that use the
  marketing header for anonymous visitors (report/compare views) pass
  `backdrop="minimal"`. All ambient loops are `motion-safe:` gated. See
  `docs/design-rams-review.md` (principles 5 and 9).

## Spacing

| Token | Value | Used for |
|-------|-------|----------|
| `--space-card` | 1.25rem | Card padding |
| `--space-section-inner` | 2.125rem | Section internal spacing |
| `--space-section-y` | 2.75rem | Section vertical margins |
| `--header-offset` | 6.5rem | Top offset for page content below fixed header |
| `--gap-nested-sm/md/lg` | 0.5/0.75/1rem | Nested element gaps |

## Components

### Button
- Pill shape, `rounded-full`
- `active:scale-[0.96]` press effect
- Layered shadow on hover
- Min 44×44px hit target (`min-h-11 min-w-11`); carousel prev/next controls follow same rule
- Focus ring on `--ring`

### Card (`glass-surface`)
- `border-0 shadow-card`
- Inner elements use `rounded-nested-md`
- Raised shadow (`shadow-raised`) for elevation
- `glass-bg` variants: subtle, base, strong, elevated, nav

### Input
- Pill shape (`rounded-pill` / `rounded-input`)
- Border from `--input`
- Focus ring from `--ring`

## Responsive behavior

- Container max-width: 1280px
- Padding: 1.25rem (default), 1.5rem (sm), 2rem (lg)
- Screenshots: 1280x900 desktop, 375x812 mobile aspect ratios
- Mobile frame width in UI: 240px

## States

Report information architecture is defined once in [`knowledge/report-contract.md`](./knowledge/report-contract.md). The focused route is a calm decision surface with three numbered fixes. The details route is the dense inspection workspace. Do not merge their densities.

Every interactive element must define: rest, hover, focus, active, disabled.

- Focus: `--focus-ring` (Flag Orange)
- Disabled: muted opacity, no shadow
- Error: `--destructive` color
- Loading: progressive report chrome (same altitudes as completed) + Skeleton for captures; not a separate loading route aesthetic
- Empty: EmptyState component with clear message + next action

## Icons

- Library: lucide-react (via `optimizePackageImports`)
- Sentence case labels. No all-caps except `section-label` (mono uppercase).
- No zap/lightning badge icons. No checkmark pill rows.

## Accessibility

- Focus rings on all interactive elements
- `prefers-reduced-motion` respected
- 44×44px minimum hit targets (`min-h-11 min-w-11`)
- Screen reader support in shadcn primitives (Radix)
- Heading hierarchy (h1 > h2 > h3) enforced by lint rules
- Color contrast: brand orange on backgrounds at WCAG AA minimum

## What to avoid

- Grid/dot backgrounds behind hero (marketing `GlobalMeshBackdrop intensity="full"` is glow only; grid is app/admin `minimal` only)
- Rotated cards with blur halos
- Traffic-light window chrome (unless showing real product UI)
- Staggered translate-y on grid items for fake depth
- Default blue/inter font stacks
- `transition: all`
- Raw hex values except `grade.*`
- Borders on cards (use shadows)
- Default gray backgrounds (use warm paper / graphite)
