# Report Contract

This is the canonical hierarchy for report code, copy, tests, documentation, and agent skills.

## First-use loop

FixFlags is one product: **paste URL → understand what deserves attention → send the worthwhile Improvement to a builder → run an Update review → independently verify and learn**.

`buildUnifiedPlanBundle()` aggregates live and repository Flags once.

Per-issue prompts are the primary handoff from understanding to improvement.

`buildFixList()` owns the complete supporting evidence list, Product Contract bias, prompt availability, and anonymous redaction.

## Canonical report

`/report/[id]` is the default destination:

1. Compact Review header (`#report-status`) with a circular score or honest pending/unavailable state, chronological full-Review history, and the owner Update review action
2. Complete ranked Flag browser (`#report-flags`): live report and homepage Report mode are detail-first (full-width Flag detail with prev/next and `N of M`); Product Your priorities keeps the ranked list beside detail and shows the five highest-ranked Flags first with Show more for the rest. Coverage stays a muted sentence on the Product list (and path labels on Flag rows). Ranking remains Critical-first.
3. One per-issue prompt row: an expandable `Fix Prompt` on the left and an always-visible `Copy prompt` action on the right (with Copy All Prompts in the chevron when an aggregate plan prompt exists), placed under the Flag title/meta/nav row and above the desktop | mobile capture pair
4. Report actions: owner Update review (outline control), Export (Copy link and Email me this report), sample CTA when this is a curated sample, and at most one contextual signup or upgrade moment
5. Durable Product context lives on `/products/[id]`, not on the report: Product Contract (`#product-contract`) and verified Product Memory (`#product-remember`) under Product Intelligence, merged with Made with and Watch. Product Your priorities reuses the shared `ReportExplorer` list-detail Flag stack (source-review captures, Fix Prompt / Copy prompt / Copy All Prompts under Flag chrome, View report to the originating Review). Launch-gate check failures surface as ordinary Flags in Your priorities, not as a separate checklist. Update-review outcome cards (Fixed / Still open / New / Regressed / Inconclusive) sit under the Product score chart when the latest completed review has a parent.
6. Anonymous and sample reports have no Product page; they omit durable Product context entirely

The compact header does not repeat Product identity, verdict copy, the Critical count, or instructions already expressed by the ranked Fix list.
Every history point is a native link to a complete Review.
Desktop keeps Agent and Report visible throughout the review.
Mobile exposes only Agent and Report, defaulting to Agent while work is active and Report afterward.
Legacy `view=timeline` and `view=canvas` parameters normalize to `view=report`.

New anonymous scans render the progressive and completed evidence report without a blocking authentication dialog.
Anonymous viewers can inspect scores, all confirmed Flags, screenshots, textual evidence, and deterministic Agent scan messages.
The per-issue prompt row chrome (Fix Prompt dropdown and Copy prompt) stays visible on live anonymous reports.
Expanding the dropdown or copying still requires claim; the prompt body never renders and public APIs omit prompt fields.
Interactive Agent conversation, Product Memory, account history, update reviews, and export remain unavailable until their access requirement is met.
Authentication is contextual and returns through `/post-login` so the anonymous report is claimed before the same workspace unlocks.
Anonymous API serialization remains redacted: gated fields are omitted server-side, evidence remains real page evidence, and gate strings are never persisted into Flag rows.

Prompt and action projection is centralized by access capability:

- Authenticated owners receive every eligible per-Flag prompt.
- Repository-owned curated samples expose exactly one demonstrated per-Flag prompt and no aggregate Finish Plan prompt.
- Anonymous live-report viewers, non-owners, and shared-report viewers see the per-issue prompt row chrome; expand and copy open a create-account dialog. Prompt fields stay omitted from anonymous serialization.
- Static samples never expose update-review or lifecycle mutation actions.

Copying an owner prompt is a handoff, not verification.
A copied prompt is an editor handoff of a live-page observation: page, viewport, section, current text, then search, plan, and implement.
It is not a guessed file path and not a second essay around the task.
It records one idempotent `HANDOFF_COPIED` event.
“Ready to verify” records an Improvement Attempt, but only a fresh completed child Update Review can determine the result.
The web report, MCP, and CLI use the same strict verification receipts.
Only receipt outcome `IMPROVED` may say an Improvement is verified or improved and write verified Product Memory.
`INCONCLUSIVE`, `UNCHANGED`, and `REGRESSED` must preserve coverage, evidence, and remaining risk.
A Flag absent from a child update review is **Fixed** when every page that owned that Flag was fully re-checked on the child. Fixed means not observed on comparable pages, not verified. Only receipt outcome `IMPROVED` may say an Improvement is verified. Product-scoped Flags with no page still require a FULL child review. Absences whose pages were not fully re-checked stay Inconclusive.
Partial or degraded reviews never create verified Product Memory.

`/report/[id]/details` redirects to `/report/[id]`. Shared and sample detail URLs likewise redirect to their canonical report surfaces.

## Progressive report

The homepage paints report geometry as soon as a valid URL is submitted.
After `/api/checks` returns an ID, navigation history is replaced with `/report/[id]` without showing the background-check banner.
Progressive UI uses the same `ReportWorkspaceShell` and Agent transcript as the completed report.
The progress band shows honest 0–100% pipeline progress and stage detail.
Deterministic Agent messages use the same UI message envelope as authenticated model conversation but consume no model tokens and are reconstructed from persisted scan facts.
Partial Flags stream into the ranked explorer and appear once in the Agent transcript with a link to the matching report detail.
Desktop and mobile capture placeholders resolve independently inside Flag detail on mobile; the standalone capture pair stays on large screens only.
Show honest status and early findings without introducing completed-Review context while the Review is still running.
Parked Timeline, Preview, and Canvas payloads are not loaded by the default report route.
The ranked explorer uses the same gated Fix Prompt and Copy chrome as the completed report.
Prompt bodies stay empty until claim.
Keep the workspace and transcript mounted until the completed server report replaces progressive data.

## Samples and public reports

- Homepage: complete curated fix list with selected evidence and one editor-ready fix.
- `/samples`: complete, versioned curated observations selected by `?observation=`, each with its own Flags, captures, score, and exactly one demonstrated per-Flag prompt.
  Every visible history point resolves to one immutable observation.
  An absent selector opens the current curated Review; an explicit unknown selector returns not found.
- `/report/[id]` is the canonical public evidence URL. Legacy `/share/[token]` links remain readable for compatibility but are no longer created or managed in the product.
- Live unclaimed reports are never marketing samples.
  Cookie membership is `anonymous_teaser`; everyone else on a public report is `public_viewer`.
  Curated fixtures stay on the sample route.
- Unsigned Agent send, history, Copy, and private rail destinations open one signup/login dialog.
  Conversations load only for the owner.
  Last-hour anonymous URL reuse returns the existing public report without attaching it to the visitor cookie.

## Acceptance checks

- The primary report renders every persisted unresolved Flag without truncation.
- Interactive report targets are at least 44px and keyboard operable.
- Per-Flag capture comparisons show affected viewports in red with "Flagged on {device}," available unaffected viewports in green with "Not flagged on {device}" on real pixels, and missing or failed captures as Screenshot unavailable. Every state includes text and an icon.
- Flag detail is one desktop | mobile pair. Fix Prompt and Copy prompt sit above that pair. Motion evidence plays in the affected frame, not as a third screenshot.
- Screenshot overlays use measured `Flag.evidenceTargets` or an explicit page-scope chip. Unmeasured Flags do not receive a guessed rectangle.
- `CircleAlert` is reserved for Critical Flags. Important and Polish remain available as accessible text.
- Loading, empty, partial, failure, forbidden, expired, revoked, and deleted states are explicit.
- Visible report chrome lives in `lib/marketing/copy.ts`.
- Coverage is one muted sentence under Your priorities on the Product list plus path labels on Flag rows (`On /pricing`, Home for `/`). Live report detail-first mode relies on prev/next rather than a second ranked list. No JourneyBar, page map, page filter chips, Coverage dashboard, or per-page scores.
- Technology profiles expose sanitized evidence labels and evidence bands only. They never grade vendors or leak raw requests, headers, cookies, query strings, or private report existence.
- Newly submitted anonymous and non-owner live reports expose evidence and gated Copy chrome, never prompt bodies, Product Memory, account history, update-review controls, or export.
- Programmatic Agent messages are stable, monotonic, derived from persisted facts, and excluded from model usage and persisted conversation rows.
