---
name: fixflags-design-system
description: Design, review, and polish FixFlags product and marketing interfaces using the canonical tokens, report contract, interaction standards, and evidence-first visual language.
---

# FixFlags design system

Use this skill for UI implementation, responsive review, accessibility, or visual polish. Read `AGENTS.md`, `DESIGN.md`, `knowledge/report-contract.md`, and `lib/design/tokens.css` before changing a report surface.

## Principles

- The interface is product proof. It must be calmer, clearer, and more trustworthy than the product it evaluates.
- Content and evidence lead; chrome recedes. Use one orange focal point per region.
- Show state and recovery clearly. Never hide partial, failed, gated, or loading states behind optimistic copy.
- Prefer recognition over recall: visible labels, persistent context, and actions beside their evidence.
- Use shared primitives and tokens. Fix inconsistencies at the primitive or view-model boundary, not with page-specific CSS.

## Canonical visual language

- Warm-white canvas, soft-stone surfaces, ink structure, Flag orange for CTAs/focus/status, and link blue for links.
- Inter Tight is for marketing/editorial headlines. Inter is for functional UI. JetBrains Mono is for scores, grades, labels, and tabular values.
- Cards use `rounded-card`, glass surfaces, and `shadow-card`. Controls use `--radius-control` (~10px). Nested surfaces use the concentric radius tokens.
- Report layouts use `Container variant="report"`; prose and settings use their existing narrower variants.
- Every interactive target must expose at least a 44x44px hit area. Use shared `Button`, `FilterPill`, navigation, and report controls.

## Report rules

- The live `/report/[id]` route is Agent beside Report. Preview, Timeline, and Canvas stay parked there and are not loaded on that route.
- Active and completed owner/anon reviews share one full-bleed living-review editor: flush split under thin site chrome, no marketing footer, no pane cards (`rounded-card` / `shadow-card` / `glass-surface` on Agent or Product columns). Separation is a single vertical divider.
- Desktop and mobile expose only Agent and Report. Active mobile defaults to Agent; completed reviews default to Report. Do not mount Preview stage, device toggle, or playback transport on `/report/[id]`.
- Desktop grid stays `minmax(280px, 32%)_minmax(0, 1fr)` with `gap-0`. Do not wrap the workspace region in `Container variant="report"` / `max-w-6xl`.
- Treat the panes as **FixFlags understanding** (identity, activity, observation, judgment, conversation) and **the Report** (score, Flags, evidence, prompts). Never reduce them to generic chat and dashboard.
- Completed reports must not jump to a hero/summary document above the split.
- Small screens use a single tab bar (Agent, Report) over the same Report pane. The immersive shell carries no floating support bubble.
- Agent is chat: one Flag mark (animated while scanning), bubble transcript, one-row ArrowUp composer. Anonymous submit gates to sign-in. No "Working · N%" strip. Homepage Report mode uses `ReportExplorer` detail-first, never a hand-rolled Flag card.
- Report mode uses a fixed compact `ReportOutcomeBar` and the shared `ReportPane` with `ReportExplorer` detail-first (`layout="detail"`). Product Your priorities keeps `list-detail`. Only the explorer body lives inside `data-report-frame` using `WORKSPACE_REPORT_FRAME_CLASS`. Hard checks before you call Report work done:
  1. **Pane-relative, never viewport-relative.** Container queries only (`@container/pane`, `@[40rem]/pane:`). No `lg:` breakpoint, `100vh` cap, `--header-offset` sticky, or `overflow-clip` inside the explorer. A 1280px viewport can still be a 527px pane.
  2. **One score surface.** Accessible `Score N` (or pending/unavailable), diagnostic help text, full-Review history, and scan progress live only in the compact header. Ranking, the Fix count, Critical-first order, evidence, and next action live only in the explorer. No circular gauge, Critical shortcut, duplicated verdict, or instructional summary.
  3. **Detail scrolls inside the pane.** Live report is full-width Flag detail with prev/next; Product list-detail keeps list and detail columns each `min-h-0 overflow-y-auto` at wide pane widths. Fix Prompt / Copy prompt sit under the Flag title/meta/nav row, above the capture pair. `goToFlag` and anchors scroll the nearest scroll parent.
  4. **Filters always visible.** Rubric, severity, impact, and page filters stay in the bar at every pane width when the list-detail layout is active.
  5. **Product context is on the Product page.** Contract, memory, and launch gates live on `/products/[id]` with Made with, Watch, and Signals. The report does not mount a Review context disclosure. Flag detail is one desktop|mobile pair; GIF/overlay plays in the affected frame.
  6. **One of each.** One CTA per surface, at most one contextual signup or upgrade moment, one owner update-review entry point, and `rounded-card` on every in-pane box. The canonical aggregate surface is `ReportFinishPlan`.
  Guards: `npm run ui:drift-guard`, `components/report/__tests__/workspace-geometry.test.ts`, and `node scripts/report-pane-proof.mjs`.
- Honest pending/failed states for the active device only.
- Agent activity is customer-meaningful and evidence-bound. Name up to three worthwhile Flags (not Polish, not low-confidence). Never expose technical execution logs, simulated reasoning, or noisy stage churn.
- Homepage playback must emulate the live editor visual language and tell one finite value story: experience Product → notice issue → show evidence → surface Flag → recommend improvement. Drive from curated sample + `buildFixFlagsScanMessages` only; never live `/api/checks`. Identity is Launchpad / `fixflags.com/demo`. Publish a history point only when the generator binds its repository revision and source path to distinct real WebPs, capture and document hashes, date, score, Flags, Timeline, and evidence anchors. An explicit unknown sample observation returns not found. Reduced motion shows the complete final state.
- The canonical detailed workspace owns the complete ranked Fix list and the bounded zero-to-three Finish Plan. Funnel, Flow, Timeline, previews, and secondary controls remain subordinate context or sibling capabilities.
- Progressive, focused, detailed, shared, and sample reports consume shared report/access models while retaining intentional density differences.
- `ReportExplorer` is the only detailed flag browser. Rubric summaries link into it; they do not duplicate it.
- Evidence remains device-specific. Never invent a healthy twin capture as filler. If both captures exist, show both. Unaffected viewports keep their real pixels and a “Not flagged” badge.
- Sample evidence must identify itself as a curated fixture and keep URL, brand, screenshots, copy, and metadata consistent.
- Live anonymous, shared, and non-owner reports show real evidence and the per-issue Fix Prompt / Copy prompt chrome. Expand and copy open create-account; prompt bodies, update-review actions, lifecycle mutations, and Timeline payload stay gated.
- Repository-owned curated samples may expose exactly one demonstrated per-Flag prompt. They expose no aggregate Finish Plan prompt, Timeline, or update-review action.
- Copying an owner prompt records a handoff. Only a strict `IMPROVED` receipt may present an Improvement as verified or write verified Product Memory.
- Rubric score and Pass / Needs Attention / Blocked must not contradict; fix scoring or presentation at the shared model, not with per-page copy.
- Customer-facing Flow/Timeline never shows `chrome-error://` or other browser-internal URLs.

## Living-review checklist

- [ ] No Agent/Product pane cards; full-width flush split; left thinner than right
- [ ] Agent | Report only; Preview, Timeline, and Canvas stay parked
- [ ] Completed stays in the same shell with Report selected
- [ ] Homepage shows Launchpad / `fixflags.com/demo`, real demo captures, `ReportExplorer` in Report mode, emulated story (no network scan)
- [ ] Agent: chat bubbles + gate-on-send composer; one Flag working mark; no Working percent strip
- [ ] Live anonymous reports show the owner Fix Prompt dropdown and orange Copy prompt; both clicks open create-account, never prompt text
- [ ] Report: compact Score/history header → detail-first explorer with Fix Prompt and Copy prompt under Flag chrome above one capture pair; every history point opens a complete Review; prev/next and keyboard arrows navigate Flags; Product Your priorities still shows the ranked list
- [ ] First-time comprehension: Product identity, current activity, observation→Flag, where to inspect evidence

## Workflow

1. Identify the canonical view model, access state, and shared primitive before editing JSX.
2. Exercise loading, empty, error, forbidden, partial, completed, shared, anonymous, owner, watched, and update-review states as applicable.
3. Check 375, 768, and 1280px with no horizontal overflow, clipped actions, hydration failures, or console errors.
4. For active reviews, verify a first-time user can identify the Product, current FixFlags activity, observed behavior, important finding state, and where to inspect Product evidence.
5. Verify keyboard order, focus visibility, semantic names, heading order, 44px targets, dialog/sheet semantics, 200% reflow, reduced motion, and contrast.
6. Run `npm run ui:drift-guard`, focused component tests, and `npm run agent -- eval ui`. Inspect browser artifacts when failures occur.

## Brand assets

- Logo and marketing visuals live under `/brand/**` and `/marketing/**`.
- Keep those paths in `next.config.ts` `images.localPatterns` whenever that allowlist exists.
- Pre-compressed brand/marketing assets use `unoptimized` so an allowlist regression cannot blank the live logo (see learning `next-image-local-patterns-blank-assets.md`).
- `npm run image:local-patterns-guard` must stay green.

## Homepage hero glass

- Runtime: `public/marketing/visuals/home-hero-glass.webp` (RGBA). True master: `docs/brand/reference/home-hero-glass-rgba-master.png`.
- Prefer a file saved directly into the repo. Cursor chat uploads often flatten transparent PNGs to JPEG-on-black.
- If only a black plate exists: flood-fill bg → soft outer edge → **preserve interior RGB** (never global-unmate text) → despill dark-on-partial-alpha → pad ~24px. Metric: `darkSemiTransparent` (lum<50, 8<alpha<240) must be 0.
- If a true RGBA master exists: preserve alpha; only despill dark underside/rim fringe. Do not redraw glyphs.
- Current plate is landscape (~1.49). Size it to the **right column width** (`object-contain` / `object-right`). Do not height-lead in a way that overflows into the copy column.
- Hero layout: `Container variant="marketing"` (`--container-max-marketing` 92rem), grid `minmax(0,34-36rem) + 1fr`, `items-center`, soft orange ambient glow, soft drop-shadow only (no hard black outline).
- Product-true trust only: no invented builder counts or stock avatars on the hero.
- Logo strip: `EditorToolMarks variant="hero"` (not ad-hoc `[&_…]` override soup).

## Avoid

- Decorative gradients, excessive borders, arbitrary radii, tiny icon buttons, duplicate report chrome, or serif text in dense product UI.
- Hardcoded report labels or marketing claims outside `lib/marketing/copy.ts`.
- Per-page fixes for a defect shared by buttons, cards, status, navigation, or report primitives.
- Re-keying a clean RGBA master "to improve" edges, or inventing social-proof counts to match a mockup.
