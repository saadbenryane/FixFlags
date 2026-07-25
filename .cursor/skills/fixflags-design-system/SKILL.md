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
- Every interactive target must expose at least a 44×44px hit area. Use shared `Button`, `FilterPill`, navigation, and report controls.

## Report rules

- The focused report owns the Finish Plan and at most three fixes. The detailed report owns exploration, Journey, Flow, Timeline, previews, and secondary controls.
- Progressive, focused, detailed, shared, and sample reports consume shared report/access models while retaining intentional density differences.
- `ReportExplorer` is the only detailed flag browser. Rubric summaries link into it; they do not duplicate it.
- Evidence remains device-specific. Never show a healthy twin viewport as filler.
- Sample evidence must identify itself as a curated fixture and keep URL, brand, screenshots, copy, and metadata consistent.
- Live anonymous: show real evidence; lock prompts except the one demonstrated fix. Never toast “Copied!” for a signup placeholder.
- Rubric score and Pass / Needs Attention / Blocked must not contradict; fix scoring or presentation at the shared model, not with per-page copy.
- Customer-facing Flow/Timeline never shows `chrome-error://` or other browser-internal URLs.

## Workflow

1. Identify the canonical view model, access state, and shared primitive before editing JSX.
2. Exercise loading, empty, error, forbidden, partial, completed, shared, anonymous, owner, watched, and re-check states as applicable.
3. Check 375, 768, and 1280px with no horizontal overflow, clipped actions, hydration failures, or console errors.
4. Verify keyboard order, focus visibility, semantic names, heading order, 44px targets, dialog/sheet semantics, 200% reflow, reduced motion, and contrast.
5. Run `npm run ui:drift-guard`, focused component tests, and `npm run agent -- eval ui`. Inspect browser artifacts when failures occur.

## Brand assets

- Logo and marketing visuals live under `/brand/**` and `/marketing/**`.
- Keep those paths in `next.config.ts` `images.localPatterns` whenever that allowlist exists.
- Pre-compressed brand/marketing assets use `unoptimized` so an allowlist regression cannot blank the live logo (see learning `next-image-local-patterns-blank-assets.md`).
- `npm run image:local-patterns-guard` must stay green.

## Homepage hero glass

- Runtime: `public/marketing/visuals/home-hero-glass.webp` (RGBA). True master: `docs/brand/reference/home-hero-glass-rgba-master.png`.
- Prefer a file saved directly into the repo. Cursor chat uploads often flatten transparent PNGs to JPEG-on-black.
- If only a black plate exists: flood-fill bg → soft outer edge → **preserve interior RGB** (never global-unmate text) → despill dark-on-partial-alpha → pad ~24px. Metric: `darkSemiTransparent` (lum&lt;50, 8&lt;alpha&lt;240) must be 0.
- If a true RGBA master exists: preserve alpha; only despill dark underside/rim fringe. Do not redraw glyphs.
- Current plate is landscape (~1.49). Size it to the **right column width** (`object-contain` / `object-right`). Do not height-lead in a way that overflows into the copy column.
- Hero layout: `Container variant="marketing"` (`--container-max-marketing` 92rem), grid `minmax(0,34–36rem) + 1fr`, `items-center`, soft orange ambient glow, soft drop-shadow only (no hard black outline).
- Product-true trust only: no invented builder counts or stock avatars on the hero.
- Logo strip: `EditorToolMarks variant="hero"` (not ad-hoc `[&_…]` override soup).

## Avoid

- Decorative gradients, excessive borders, arbitrary radii, tiny icon buttons, duplicate report chrome, or serif text in dense product UI.
- Hardcoded report labels or marketing claims outside `lib/marketing/copy.ts`.
- Per-page fixes for a defect shared by buttons, cards, status, navigation, or report primitives.
- Re-keying a clean RGBA master “to improve” edges, or inventing social-proof counts to match a mockup.
