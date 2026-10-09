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

- Customer navigation is Websites, then a selected Site’s Overview, Flags, and Settings, with All websites as the return. Websites keeps one Analyze control and full-width rows. A row shows the Flag count only when Flags are the result. Stale, failed, running, or incomplete evidence keeps its own result.
- Overview leads with preview, domain, that result, monitoring, and one Add action. Add offers executable Outcomes, additional coverage, and configured connections. Freshness and coverage stay in the header. One run banner covers Analyzing, Analysis incomplete, Updates paused, and disconnected updates. Completed pipeline narration stays hidden. Category cards stay neutral: color and progress sit on the compact status signal. Each card has one label, one answer that reflows, one status, the Flag count at the bottom left when that count is the result, and one navigation target. Pages is coverage, not a Site-wide Flag inbox.
- Category depth uses one responsive surface: a dialog on desktop and a full-height sheet on mobile. Flag lists use keyboard-operable Fix first and Other Flags tabs. Open and Resolved are URL-addressable tabs. Category controls filter the list. An open row offers Copy fix prompt and View Flag. A resolved row shows recovery, proof time, affected scope, and View proof.
- The fix prompt comes from the Site endpoint. Verify fix starts a fresh run. Copying a prompt does not resolve a Flag. Monitoring is the customer word for the schedule. Ask FixFlags stays contextual and is never a nav item.
- A Flag page reads in this order: state, problem and scope, observation, expected behavior, evidence and limitations, actions, verification history. Keep suggestions distinct from Flags. Do not present an inferred unconfirmed action as verified.
- A current clear category may say 0 Flags beside the evidence that ran. Missing, partial, blocked, stale, and failed evidence stay distinct and do not turn green. Do not use rubric scores, `Looking good`, or a generic pass sentence.
- Context connections enrich existing cards and appear only when configured. Attention uses undiluted Flag Orange `--brand` (`#FF5A00`) on the status signal. Do not fade it with alpha or `--brand-muted`. Keep `--warning` amber for product caution such as billing and quota. Capture highlights must come from actual measurements. Marketing illustrations must not import retired Site Agent, Watch card, Add-card library, or Project scan controls.

## Verification

Inspect real rendering at mobile and desktop sizes, keyboard/focus order, 44px targets, reduced motion, reflow and contrast. Status never relies on color alone. Check loading, healthy, attention, partial, couldn't-verify, stale, failed and resolved states against actual evidence.

The root layout's Skip to content link targets `#main-content`. Standalone entry routes, including `/new`, must provide one focusable main landmark with that ID; check the keyboard jump in a browser, not only the link href.

Keep copy centralized in lib/marketing/copy.ts and aligned with docs/voice-and-copy.md. Use product evidence to replace weak marketing illustrations; never fake customer output. New interface acceptance is not established by passing legacy report screenshots.

## Homepage care narrative

The September 8 homepage is implemented by `components/marketing/homepage/CareHomepage.tsx` with scoped styles and centralized `CARE_HOME` copy exported through `lib/marketing/copy.ts`. Target language is docs/voice-and-copy.md. The hero keeps ink “looked after.” and Analyze. The subtitle is the promise: Keep building. FixFlags monitors your live website and lets you know when a Flag matters. Then 100+ automated tests / real browser journeys. Do not paint the promise in Flag Orange; orange stays on Analyze and Flags. Analyze sits centered in the brand button with the arrow on the right edge. The rest of the live homepage still uses older Check / Needs attention / Copy prompt copy until docs/product-masterplan.md Wave I is executed. The example board uses the same `BoardCard` contract and `CARD_CATALOG` names as the live Site. Prefer Pages as the first card name in new work. Keep the board, workflow evidence and monitoring examples explicitly illustrative until backed by released Site behavior. Do not sell Connect MCP or connected-account OAuth from Add. Use the existing `AuditInput` for real URL submission. Preserve dialog keyboard focus and responsive board behavior when refining it. The marketing nav lockup is the page brand; do not put a second FixFlags mark in the homepage hero. Hero motion is a one-shot inspection (staged copy, luminous sweep, cards resolving, Flag found, then rest). Do not restore a looping scan line. `prefers-reduced-motion` shows the completed board with no sweep. How FixFlags works should read Flag, Fix, Verify: Flag lights orange, Fix lights ink, Verify lights green. Do not restart a timed loop. Keep the board compact: short answers, Flag counts, one useful metric and small thumbnails. Move full-frame evidence, freshness, sources and checked-page results into shared card depth. Do not repeat Last checked on every card or the overall Flag count inside Pages. Use solid, non-overlapping watch cards. Evidence cards stay equal size with `/contact` page chrome and one caption each. Do not put a CTA in that section header. The `SITE_COMPARE` table (`MarketingCompareSection`, embedded) sits after workflow/evidence and before the final CTA. Cells are short phrases. A speed score plus an agent must not read as everything FixFlags does. Do not turn the cells back into complementary checkmarks.

FAQ accordions use `rounded-card`, not `rounded-full`. An open answer must stay inside the item. Learn-more links use `TextLink variant="brand"` (Flag Orange) and a live help, docs, or marketing href. `/faq` and `/pricing` emit `faqPageSchema()` JSON-LD that matches the visible questions.

Owner palette correction (September 8): use bright Flag Orange from the canonical brand token for brand buttons in both themes. Pair it with white labels as explicitly requested by the owner, and use the lighter orange hover token. Preserve the bright fill and separate status colors.

Anonymous Site board: logged-out visitors must see Sign in (existing `/sign-in?next=` flow back to the current Site or Flag URL). Keep the left rail to Overview · Flags · Settings. Monitoring status never belongs in that rail. The single header Add action remains discoverable, but anonymous configuration requires sign-in and claim with the destination preserved. Hide only empty cards with no evidence: an expired `evidenced: true` card stays visible as `Out of date` with its original checked time. Its depth gives the owner a direct Analyze again action; an anonymous visitor gets Sign in to analyze again, preserving the one-teaser gate.
