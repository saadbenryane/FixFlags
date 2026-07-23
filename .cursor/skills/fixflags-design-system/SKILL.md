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
- Fraunces is for marketing/editorial headlines. Satoshi is for functional UI. IBM Plex Mono is for scores, grades, labels, and tabular values.
- Cards use `rounded-card`, glass surfaces, and `shadow-card`. Controls use pill radius. Nested surfaces use the concentric radius tokens.
- Report layouts use `Container variant="report"`; prose and settings use their existing narrower variants.
- Every interactive target must expose at least a 44×44px hit area. Use shared `Button`, `FilterPill`, navigation, and report controls.

## Report rules

- The focused report owns the Finish Plan and at most three fixes. The detailed report owns exploration, Journey, Flow, Timeline, previews, and secondary controls.
- Progressive, focused, detailed, shared, and sample reports consume shared report/access models while retaining intentional density differences.
- `ReportExplorer` is the only detailed flag browser. Rubric summaries link into it; they do not duplicate it.
- Evidence remains device-specific. Never show a healthy twin viewport as filler.
- Sample evidence must identify itself as a curated fixture and keep URL, brand, screenshots, copy, and metadata consistent.

## Workflow

1. Identify the canonical view model, access state, and shared primitive before editing JSX.
2. Exercise loading, empty, error, forbidden, partial, completed, shared, anonymous, owner, watched, and re-check states as applicable.
3. Check 375, 768, and 1280px with no horizontal overflow, clipped actions, hydration failures, or console errors.
4. Verify keyboard order, focus visibility, semantic names, heading order, 44px targets, dialog/sheet semantics, 200% reflow, reduced motion, and contrast.
5. Run `npm run ui:drift-guard`, focused component tests, and `npm run agent -- eval ui`. Inspect browser artifacts when failures occur.

## Avoid

- Decorative gradients, excessive borders, arbitrary radii, tiny icon buttons, duplicate report chrome, or serif text in dense product UI.
- Hardcoded report labels or marketing claims outside `lib/marketing/copy.ts`.
- Per-page fixes for a defect shared by buttons, cards, status, navigation, or report primitives.
