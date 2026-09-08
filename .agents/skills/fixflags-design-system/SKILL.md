---
name: fixflags-design-system
description: Design FixFlags Site and marketing surfaces using the retained brand tokens, mobile-first Home Flags Site interface, honest coverage and progressive evidence.
---

# FixFlags design system

Read AGENTS.md, DESIGN.md and docs/workspace-interface.md. The detailed flat card-board system lives in docs/card-board-experience.md. Product intent lives in knowledge/vision.md; behavior lives in docs/product-prd.md.

## Sources and scope

DESIGN.md and lib/design/tokens.css own visual foundations. lib/design/brand-spec.ts serves non-CSS consumers. Use existing primitives in components/ui. Preserve approved brand identity and orange; do not create a separate Shopify palette.

The Site contract replaces the old report/chat experience. For maintenance on existing /report routes, read knowledge/report-contract.md as compatibility guidance only. Do not import its score, rubric or pane layout requirements into the new Site.

## Design behavior

- Mobile-first Home · Flags · Site, with the same mental model on desktop.
- First analysis and dashboard share identity, navigation and genuine discovery progress.
- Human status, important Outcomes and meaningful Flags lead. Coverage and freshness make health understandable.
- A Flag progressively exposes business context, proof, technical detail, fixing and verification.
- Healthy can be short and quiet; no filler Flags, decorative analytics or invented activity.
- Missing evidence, partial coverage, blocked checks, stale checks and watch activation failures must be visibly honest.
- Context connections enrich existing cards. The dashboard is one flat card grid with a permanent Site card; categories belong only in Add Card. Checks stay underneath cards. Homepage Flag chrome uses undiluted Flag Orange `--brand` (`#FF5A00`). Do not fade it with alpha or `--brand-muted`; that reads brown. Keep `--warning` amber for product caution.
- Reuse real evidence displays when appropriate. Capture highlights must come from actual measurements.

## Verification

Inspect real rendering at mobile and desktop sizes, keyboard/focus order, 44px targets, reduced motion, reflow and contrast. Status never relies on color alone. Check loading, healthy, attention, partial, couldn't-verify, stale, failed and resolved states against actual evidence.

Keep copy centralized in lib/marketing/copy.ts. Use product evidence to replace weak marketing illustrations; never fake customer output. New interface acceptance is not established by passing legacy report screenshots.

## Homepage care narrative

The September 8 homepage is implemented by `components/marketing/homepage/CareHomepage.tsx` with scoped styles and centralized `CARE_HOME` copy exported through `lib/marketing/copy.ts`. Keep its board, connection metrics and monitoring examples explicitly illustrative until backed by released Site behavior. Use the existing `AuditInput` for real URL submission; preview Fix/Verify controls must not imply a live recovery. Preserve dialog keyboard focus and responsive board behavior when refining it.

Owner palette correction (September 8): use bright Flag Orange from the canonical brand token for brand buttons in both themes. Pair it with white labels as explicitly requested by the owner, and use the lighter orange hover token. Preserve the bright fill and separate status colors.
