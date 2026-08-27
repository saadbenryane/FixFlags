# Design Standards

_Validated visual and interaction standards. Code-enforced where possible, documented where not._

**Customer vs internal language:** Customer surfaces use Product QA, product review, update review, Funnel, and path. Internal code may still use re-check routes, recheck components, monitoring implementation names, and legacy deep-review fields. Deep Review is reserved for the future repository-connected analysis offer.

**Product UI direction (locked):** Layout modes, chat, funnel/path replay, and mobile parity live in [docs/workspace-interface.md](../docs/workspace-interface.md). Product requirements: [docs/product-prd.md](../docs/product-prd.md). Visual tokens and component rules stay in this file.

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

| Role                          | Font                           | Weight  | Size              |
| ----------------------------- | ------------------------------ | ------- | ----------------- |
| Display (marketing hero only) | Inter Tight (var-font-display) | 600–700 | text-5xl (3.5rem) |
| Heading                       | Inter Tight                    | 600     | text-2xl/3xl/4xl  |
| Body                          | Inter (var-font-sans)          | 400     | text-base         |
| Labels (uppercase)            | JetBrains Mono (var-font-mono) | 500     | text-xs           |
| Score numbers                 | JetBrains Mono                 | 500–600 | tabular-nums      |

- `text-balance` on headings, `text-pretty` on body
- `tabular-nums` on all numeric scores
- Inter is UI font everywhere; Inter Tight reserved for marketing headings and display

## Color system (60/30/10)

| Proportion | Role                  | Token values                                          |
| ---------- | --------------------- | ----------------------------------------------------- |
| 60%        | Background / canvas   | `--background` (white `#FFFFFF` / dark ink `#0B0B0D`) |
| 30%        | Foreground / ink      | `--foreground`, `--card`, `--muted` (stone `#F5F6F7`) |
| 10%        | Brand orange (signal) | `--brand` (Flag Orange `#FF5A00` / dark `#FF5C1A`)    |

- Dark mode: fully re-authored, not inverted. Graphite canvas, charcoal glass, warm orbs.
- One accent per surface. Do not layer multiple accent colors.
- Grade colors (A-F) used only in report score contexts, not marketing.

### Report altitude (score ownership)

| Altitude       | Surface                                      | Score treatment                                                                                                                                           |
| -------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity       | Product pane header and `WorkspaceChatPanel` | Product name with hostname fallback, reviewed address, and current review activity. No score.                                                             |
| Review status  | `ReportOutcomeBar` (fixed Report header)     | Visible `Score N`, honest pending/unavailable state, chronological full-Review history, and scan progress while a review runs                             |
| Working triage | `ReportExplorer` (Report body)               | Complete ranked Flag list plus rubric, severity, impact, and page filters; Critical Flags lead through canonical ranking rather than a duplicate shortcut |
| Product page   | `/products/[id]` Product Intelligence        | Contract and compounding Product Memory live with Made with and Watch. Failed launch-gate checks appear as Flags in Your priorities. The report has no Review context drawer. |

The compact Review header is the single score surface.
It uses one compact circular score with an accessible pending or unavailable label beside the chronological Review history.
Each history point has a complete Review destination, chronological placement, a 44px target, and an accessible label containing Review number, kind, date, and score or status.
The explorer owns the complete ranked Fix list count and every Flag navigation action.
Do not repeat Pass, Needs Attention, Blocked, or share-readiness labels beside severity counts.
The report URL is public evidence by default. Agent chat, prompts, Product Memory, history, and owner actions remain server-gated.
Tokens: `--header-height` (3.5rem), `--header-offset` (6.5rem) for `scroll-mt`.

**Made with:** Technology evidence lives on the signed-in Product detail page, based on that Product’s latest completed Review. Product Contract and verified Product Memory share that page. On the Product page, Made with is one horizontally scrollable row of detected technologies (no dropdown). The full evidence card (when used elsewhere) shows at most four summary chips; expansion groups the stack and exposes short sanitized evidence labels. Technology confidence is “Verified” or “Strong signal,” never a vendor score. Empty, legacy, partial, unavailable, and same-detector update-review diff states are explicit. Use locally bundled brand marks when available and Lucide category icons as the fallback; never depend on remote logo delivery.

**Flags chrome:** Meta row is Severity → Rubric → Impact. Only Critical uses the `CircleAlert` icon; Important and Polish use accessible text. The list is ranked by launch impact and supports compact rubric, severity, impact, and page filters. When both captures exist, each selected Flag compares desktop and mobile in one pair: affected is red with “Flagged on {device},” available unaffected is green with “Not flagged on {device}” on the real screenshot, and missing or failed remains “Screenshot unavailable.” Motion evidence (GIF or overlay) replaces the static image in the affected frame. Never invent a healthy twin capture as filler.

**Progressive / loading:** The living review is editor chrome, not a carded report page. Full-bleed under thin immersive header (`showFooter={false}`) with the same compact app rail as the signed-in product (Products, Settings, Billing, Help). Signed-out private destinations open the create-account dialog. Flush Agent | Product split with a divider only (no pane cards), left thinner than right. FixFlags understanding is chat on the left; the Product pane renders the Report immediately and fills in score, priorities, and evidence as findings arrive. Desktop keeps Agent and Report side by side; mobile switches only between Agent and Report. Anonymous reports keep public-safe evidence visible and use a brand Sign up CTA plus contextual sign-in for private capabilities.

**Product stage and transport:** Preview, Timeline, and Canvas stay parked on `/report/[id]`. The default Product pane is the Report: compact `ReportOutcomeBar` plus the ranked Fix list. Do not mount Preview stage, device toggle, or playback transport on that route. The immersive shell carries no floating support bubble.

**Report pane:** Report mode uses a fixed compact `ReportOutcomeBar` with circular score, chronological Review history, and the owner Update review action.
The shared `ReportPane` starts its ranked list with `Your priorities`, shows the five highest-ranked issues by default, and places the selected-issue evidence beside it without a separate filter bar.
Each issue uses one desktop | mobile evidence pair, then a docked prompt row with an expandable `Fix Prompt` and a branded copy action on the right.
The prompt expands in normal flow without a nested card.
The web report does not render the aggregate Fix plan or a Review context disclosure.
Only the explorer body sits inside `data-report-frame` using `WORKSPACE_REPORT_FRAME_CLASS`, so a wide pane gives the body exactly one pane height and each column scrolls itself, while a narrow pane releases that height and scrolls as one column.
Everything inside the pane is pane-relative: container queries (`@container/pane`, `@[40rem]/pane:`), never `lg:`, `100vh`, `--header-offset` sticky, or `overflow-clip`.
Filters stay visible at every pane width, and `goToFlag` scrolls the nearest scroll parent instead of the document.
Guards: `npm run ui:drift-guard` and `node scripts/report-pane-proof.mjs`.

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

Report information architecture is defined once in [`knowledge/report-contract.md`](./knowledge/report-contract.md).
The canonical report is one calm, dense-enough workspace: compact Score/history header, then a ranked master/detail Fix list containing every unresolved Flag, then collapsed review context.
Identity belongs to the Agent activity and Product Preview surfaces, not to a duplicate Report title row.
Each column scrolls itself in a wide pane; a narrow pane stacks the list above the selected detail.

`ReportWorkspaceModel` composes the canonical `ReportExplorerModel` with identity, unresolved and Critical counts, rubric coverage, chronological Review history, and capabilities. Completed, progressive, curated sample, shared, update-review, and homepage proof surfaces project this same model. Density changes spacing and available actions, never ranking, evidence, access policy, or scoring semantics.

The compact header owns only Score, full-Review history, and active scan progress.
The explorer owns ranking, per-rubric filters, the Fix count, evidence, and fix detail.
Public curated samples expose the same ranked report design and exactly one demonstrated prompt.
Their history contains only complete generated observation bundles. Each bundle binds a repository revision and source path to capture hashes, document hash, date, score, Flags, Timeline, and evidence anchors; incomplete or reused comparison captures are a release failure.
Live anonymous, non-owner, and shared reports show Fix Prompt and Copy chrome with empty prompt bodies.
Copy and the Fix Prompt control open create-account and never write the clipboard or leak prompt text.
Prompt bodies appear only after a successful `/post-login` claim.
Only a strict `IMPROVED` verification receipt may present an Improvement as verified or write verified Product Memory.
Raw absence in an update review is “No longer observed in this review.”
Copy records a handoff and never declares verification.

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
