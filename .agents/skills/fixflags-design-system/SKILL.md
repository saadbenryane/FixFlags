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

## Homepage review and refinement

Current direction and public words come from knowledge/vision.md and docs/voice-and-copy.md. Do not restore the retired website-care headline or a prescribed scan animation from an older session. The homepage uses `CareHomepage.tsx`, `HomepageHero.tsx`, `HomepageSections.tsx`, scoped CSS, and `CARE_HOME` in `lib/marketing/copy/care-homepage.ts`. The name CareHomepage is an implementation identifier, not positioning authority.

The sample uses the shared `BoardCard` and `CARD_CATALOG`. Fixtures are illustrative, not deployed-customer recovery proof. Keep the Sample designation and use the existing `AuditInput` for real URL submission. Inspect the shared card with long category names, Flag lists, clear answers, media, and incomplete states at mobile and desktop widths. Category and status must not collide; avoid giving clear answers greater emphasis than the failure requiring action. Preserve keyboard depth, focus restoration, and reduced motion.

The founder approved October 10 homepage implementation: promise and URL, comprehensive interactive website board, coherent Flag recovery, and truthful ongoing monitoring. Full supported product exploration replaces teaser optimization. Reuse shared components; keep analysis, configured schedules, and verification distinct. The scoped continuation is `.agents/handoffs/homepage-experience.md`; research in `docs/experience-review.md` remains evidence. Do not change billing, entitlements, quotas or execution semantics in this slice.

FAQ accordions use `rounded-card`, not `rounded-full`. An open answer must stay inside the item. Learn-more links use `TextLink variant="brand"` (Flag Orange) and a live help, docs, or marketing href. `/faq` and `/pricing` emit `faqPageSchema()` JSON-LD that matches the visible questions.

Owner palette correction (September 8): use bright Flag Orange from the canonical brand token for brand buttons in both themes. Pair it with white labels as explicitly requested by the owner, and use the lighter orange hover token. Preserve the bright fill and separate status colors.

Anonymous Site board: logged-out visitors must see Sign in (existing `/sign-in?next=` flow back to the current Site or Flag URL). Keep the left rail to Overview · Flags · Settings. Monitoring status never belongs in that rail. The single header Add action remains discoverable, but anonymous configuration requires sign-in and claim with the destination preserved. Hide only empty cards with no evidence: an expired `evidenced: true` card stays visible as `Out of date` with its original checked time. Its depth gives the owner a direct Analyze again action; an anonymous visitor gets Sign in to analyze again, preserving the one-teaser gate.
