---
name: fixflags-design-system
description: Design FixFlags Site and marketing surfaces using the retained brand tokens, mobile-first Home Flags Site interface, honest coverage and progressive evidence.
---

# FixFlags design system

Read AGENTS.md, DESIGN.md, docs/product-architecture.md, docs/workspace-interface.md and docs/voice-and-copy.md. The detailed flat card-board system lives in docs/card-board-experience.md. Product intent lives in knowledge/vision.md; behavior lives in docs/product-prd.md. Implementation sequence is docs/product-masterplan.md.

## Sources and scope

DESIGN.md and lib/design/tokens.css own visual foundations. lib/design/brand-spec.ts serves non-CSS consumers. Use existing primitives in components/ui. Preserve approved brand identity and orange; do not create a separate Shopify palette.

The Site contract replaces the old report/chat experience. For maintenance on existing /report routes, read knowledge/report-contract.md as compatibility guidance only. Do not import its score, rubric or pane layout requirements into the new Site.

## Design behavior

- Mobile-first Home · Flags, with Site settings and the same mental model on desktop. Pages and Journeys live on cards. The FixFlags Agent is a later FAB, not a nav item.
- First analysis and dashboard share identity, navigation and genuine discovery progress.
- Human status, Journeys and meaningful Flags lead. Coverage and freshness make health understandable. Customer language is Flag. Fix. Verify.; 0 Flags is the quiet attention state.
- A Flag progressively exposes business context, proof, technical detail, fixing and verification.
- Healthy can be short and quiet; no filler Flags, decorative analytics or invented activity.
- Missing evidence, partial coverage, blocked checks, stale checks and watch activation failures must be visibly honest.
- Context connections enrich existing cards. The dashboard is one flat card grid with a permanent Pages card; categories belong only in Add Card. Automated tests stay underneath cards. Board health uses undiluted Flag Orange `--brand` (`#FF5A00`) for attention and problems. Do not fade it with alpha or `--brand-muted`; that reads brown. Keep `--warning` amber for product caution such as billing and quota.
- Reuse real evidence displays when appropriate. Capture highlights must come from actual measurements.

## Verification

Inspect real rendering at mobile and desktop sizes, keyboard/focus order, 44px targets, reduced motion, reflow and contrast. Status never relies on color alone. Check loading, healthy, attention, partial, couldn't-verify, stale, failed and resolved states against actual evidence.

Keep copy centralized in lib/marketing/copy.ts and aligned with docs/voice-and-copy.md. Use product evidence to replace weak marketing illustrations; never fake customer output. New interface acceptance is not established by passing legacy report screenshots.

## Homepage care narrative

The September 8 homepage is implemented by `components/marketing/homepage/CareHomepage.tsx` with scoped styles and centralized `CARE_HOME` copy exported through `lib/marketing/copy.ts`. Target language is docs/voice-and-copy.md. The hero keeps ink “looked after.” and Analyze. The subtitle is the promise: Keep building. FixFlags monitors your live website and lets you know when a Flag matters. Then 100+ automated tests / real browser journeys. Do not paint the promise in Flag Orange; orange stays on Analyze and Flags. Analyze sits centered in the brand button with the arrow on the right edge. The rest of the live homepage still uses older Check / Needs attention / Copy prompt copy until docs/product-masterplan.md Wave I is executed. The example board uses the same `BoardCard` contract and `CARD_CATALOG` names as the live Site. Prefer Pages as the first card name in new work. Keep the board, workflow evidence and monitoring examples explicitly illustrative until backed by released Site behavior. Do not sell Connect MCP or connected-account OAuth from Add. Use the existing `AuditInput` for real URL submission. Preserve dialog keyboard focus and responsive board behavior when refining it. The marketing nav lockup is the page brand; do not put a second FixFlags mark in the homepage hero. Hero motion is a one-shot inspection (staged copy, luminous sweep, cards resolving, Flag found, then rest). Do not restore a looping scan line. `prefers-reduced-motion` shows the completed board with no sweep. How FixFlags works should read Flag, Fix, Verify: Flag lights orange, Fix lights ink, Verify lights green. Do not restart a timed loop. Keep the board compact: short answers, Flag counts, one useful metric and small thumbnails. Move full-frame evidence, freshness, sources and checked-page results into shared card depth. Do not repeat Last checked on every card or the overall Flag count inside Pages. Use solid, non-overlapping watch cards. Evidence cards stay equal size with `/contact` page chrome and one caption each. Do not put a CTA in that section header.

FAQ accordions use `rounded-card`, not `rounded-full`. An open answer must stay inside the item. Learn-more links use `TextLink variant="brand"` (Flag Orange) and a live help, docs, or marketing href. `/faq` and `/pricing` emit `faqPageSchema()` JSON-LD that matches the visible questions.

Owner palette correction (September 8): use bright Flag Orange from the canonical brand token for brand buttons in both themes. Pair it with white labels as explicitly requested by the owner, and use the lighter orange hover token. Preserve the bright fill and separate status colors.
