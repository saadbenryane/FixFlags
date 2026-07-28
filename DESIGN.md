# Design Standards

*Validated visual and interaction standards. Code-enforced where possible, documented where not.*

## Design principles

1. **Editorial + technical credibility** — the product looks like a sharp review, not a SaaS dashboard. Inter Tight display, glass cards, shadow depth, mono labels.
2. **Calm authority** — no gradients competing with content, no animations that distract. Motion serves understanding.
3. **Physical, not flat** — glass surfaces, layered shadows, concentric radii. Cards feel like they have depth.
4. **Contained, not sprawling** — three rubrics, not forty categories. Soft control radius, not sharp corners.
5. **Recognizable, not generic** — Flag Orange, Inter Tight headlines, mono labels. Unmistakably FixFlags.

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
| Display (marketing hero only) | Inter Tight (var-font-display) | 600–700 | text-5xl (3.5rem) |
| Heading | Inter Tight | 600 | text-2xl/3xl/4xl |
| Body | Inter (var-font-sans) | 400 | text-base |
| Labels (uppercase) | JetBrains Mono (var-font-mono) | 500 | text-xs |
| Score numbers | JetBrains Mono | 500–600 | tabular-nums |

- `text-balance` on headings, `text-pretty` on body
- `tabular-nums` on all numeric scores
- Inter is UI font everywhere; Inter Tight reserved for marketing headings and display

## Color system (60/30/10)

| Proportion | Role | Token values |
|------------|------|--------------|
| 60% | Background / canvas | `--background` (white `#FFFFFF` / dark ink `#0B0B0D`) |
| 30% | Foreground / ink | `--foreground`, `--card`, `--muted` (stone `#F5F6F7`) |
| 10% | Brand orange (signal) | `--brand` (Flag Orange `#FF5A00` / dark `#FF5C1A`) |

- Dark mode: fully re-authored, not inverted. Graphite canvas, charcoal glass, warm orbs.
- One accent per surface. Do not layer multiple accent colors.
- Grade colors (A-F) used only in report score contexts, not marketing.

### Report altitude (score ownership)

| Altitude | Surface | Score treatment |
|----------|---------|-----------------|
| Identity | `AuditReportHero` | Hostname, URL, scan status, and actions only |
| Summary | `ReportWorkspaceSummary` | Total Critical Flags plus Critical counts for Message, Experience, and Reach |
| Working triage | `ReportExplorer` | `ScoreRingGauge` **sm** (68px) beside rubric/page filters (no severity filter) |
| Stuck chrome | `ReportStickyToolbar` when stuck | Hostname only, with no repeated score |

The summary is a shortcut, not a second scoring system. Its Critical total opens the first Critical Flag; each rubric control opens that rubric and its first Critical Flag when one exists. Do not repeat Pass, Needs Attention, Blocked, or share-readiness labels beside severity counts. When shareStatus is `fix_before_sharing`, ShareDrawer may show one warning line. Sticky toolbar uses `top-[var(--header-height)]` under the site header. Tokens: `--header-height` (3.5rem), `--header-offset` (6.5rem) for `scroll-mt`.

**Made with:** One compact glass disclosure sits before the complete Fix list. The collapsed state shows at most four detected technologies; expansion groups the stack and exposes short sanitized evidence labels. Confidence is “Verified” or “Strong signal,” never a vendor score. Empty, legacy, partial, unavailable, and same-detector re-check diff states are explicit. Use Lucide category icons, not remote logos.

**Flags chrome:** Meta row is Severity → Rubric → Impact. Only Critical uses the `CircleAlert` icon; Important and Polish use accessible text. The list is ranked by launch impact and supports compact rubric, severity, impact, and page filters. When both captures exist, each selected Flag compares desktop and mobile: affected is red, available unaffected is green, and missing or failed remains neutral.

**Progressive / loading:** The in-progress report uses the same altitudes as completed (`AuditReportHero` with scanning stage label, `ReportOverviewBand` loading, sticky wayfinding when sections exist, Flags-first Fix list, then Contract/Timeline under “How FixFlags is checking”). Desktop and mobile placeholders resolve independently. Progress advances with real pipeline stages and partial flags; never fake rotating copy. On COMPLETED, hold the progressive frame until `router.refresh()` swaps in SSR `AuditReport`. Submit replaces homepage content with the same progressive chrome while `POST /api/checks` completes. A new anonymous private report adds a focus-trapped auth dialog over blurred, inert report content; Escape cannot reveal the report, and the only non-auth exit returns home.

See `lib/design/tokens.css` for full HSL values. Raw hex only in `lib/design/brand-spec.ts` for non-CSS consumers.

## Shapes and radius

- Cards: `border-0 shadow-card glass-surface` + `rounded-card` (~24px / `--radius-card`)
- Controls: `rounded-[var(--radius-control)]` (~10px)
- Concentric radii: inner = outer minus padding (`--radius-nested-md` = `--radius-card` − `--gap-nested-md`)
- Inputs: `--radius-input` (= control radius)

## Depth

- Shadow-first layering. Cards get `shadow-card` resting and `shadow-card-hover` on interaction.
- Glass surfaces: `glass-shadow` with subtle border inset.
- Borders on inputs, tables, and outlined controls. Cards prefer shadows.
- Sections separated by `bg-muted/35`, not `border-y`.
- Floating action offset: `--floating-action-offset` (1.25rem).

## Motion

- `--motion-fast`: 200ms base duration
- `--ease-out`: cubic-bezier(0, 0, 0.2, 1)
- `active:scale-[0.98]` on buttons for press feedback
- `prefers-reduced-motion` respected globally — no motion if user prefers reduced
- Entry animations: `fade-in-up` (0.4s), `scale-in` (0.3s), `soft-reveal` (0.2s)
- List/accordion: `accordion-down/up` (0.2s)
- No `transition: all`. Be specific about what animates.
- Marketing uses a quiet static canvas with restrained section tints.
- App, report, dashboard, and admin surfaces idle at zero running animations.
  Motion communicates state, expansion, or feedback.

## Spacing

| Token | Value | Used for |
|-------|-------|----------|
| `--space-card` | 1.25rem | Card padding |
| `--space-section-inner` | 2.125rem | Section internal spacing |
| `--space-section-y` | 2.75rem | Legacy compact section rhythm |
| `--space-section-default` | clamp(3rem, 5vw, 4.5rem) | General page sections |
| `--space-section-marketing` | clamp(4rem, 7vw, 7rem) | Marketing narrative sections |
| `--space-hero-start/end` | clamp(2rem–4.5rem) / clamp(3rem–6rem) | Responsive homepage hero breathing room |
| `--space-block` | 2rem | Block-level spacing within sections |
| `--header-offset` | 6.5rem | Top offset for page content below fixed header |
| `--gap-nested-sm/md/lg` | 0.5/0.75/1rem | Nested element gaps |
| `--container-max-marketing` | 88rem | Wider container for marketing hero/feature sections |

## Components

### Button
- Control radius (`--radius-control` ~10px)
- `active:scale-[0.98]` press effect
- Layered shadow on hover
- Min 44×44px hit target (`min-h-11 min-w-11`); carousel prev/next controls follow same rule
- Focus ring on `--ring`
- Light mode product primary: ink. Marketing accent CTAs: brand orange (`variant="brand"`).

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

Report information architecture is defined once in [`knowledge/report-contract.md`](./knowledge/report-contract.md). The canonical report is one calm, dense-enough workspace: identity, Critical counts, then a ranked master/detail Fix list containing every unresolved Flag. Keep the list independently scrollable on desktop and place the selected detail after the list on mobile. Legacy details URLs redirect to this workspace.

`ReportWorkspaceModel` composes the canonical `ReportExplorerModel` with identity, unresolved and Critical counts, rubric coverage, real Re-check history, and capabilities. Completed, progressive, curated sample, shared, Re-check, homepage proof, and dashboard release-hub surfaces project this same model. Density may be `compact`, `full`, or `hub`; density changes spacing and available actions, never ranking, evidence, access policy, or scoring semantics.

The workspace heading is “Fix list.” Its supporting line states the unresolved count and checked scope. The segmented summary owns the total Critical count, per-rubric Critical shortcuts, and score history. History appears only with two or more persisted completed points ordered by completion time. Public curated samples expose the complete ranked list and exactly one demonstrated prompt.

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

- Grid/dot backgrounds or decorative glow behind the hero
- Rotated cards with blur halos
- Traffic-light window chrome (unless showing real product UI)
- Staggered translate-y on grid items for fake depth
- Default blue/inter font stacks
- `transition: all`
- Raw hex values except `grade.*`
- Borders on cards (use shadows)
- Default gray backgrounds (use white canvas / ink)
