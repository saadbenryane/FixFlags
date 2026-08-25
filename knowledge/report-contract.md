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
2. Update-review result, when present
3. Complete ranked Fix list (`#report-flags`) with filters, screenshot evidence, selected detail, and canonical Critical-first ranking
4. Collapsed `Preview prompt` with an always-visible per-issue `Copy prompt`
5. Collapsed evidence and Product context: Made with (`#report-stack`), Product Contract (`#report-contract`), and verified Product Memory (`#report-remember`), when present
6. Subordinate sharing, Watch, export, and Product controls
7. At most one contextual signup or upgrade moment

The compact header does not repeat Product identity, verdict copy, the Critical count, or instructions already expressed by the ranked Fix list.
Every history point is a native link to a complete Review.
Desktop keeps Agent and Report visible throughout the review.
Mobile exposes Agent, Preview or Timeline, Report, and Canvas when each surface is available, defaulting to Agent while work is active and Report afterward.
`view=timeline`, `view=report`, and `view=canvas` are durable, URL-backed views for signed-in report owners.

New anonymous scans render the progressive and completed evidence report without a blocking authentication dialog.
Anonymous viewers can inspect scores, all confirmed Flags, screenshots, textual evidence, public-safe technology context, and deterministic Agent scan messages.
Fix prompts, interactive Agent conversation, live Timeline and path replay payloads, private memory, private history, update reviews, export, restricted sharing, and Canvas remain unavailable until their access requirement is met.
Authentication is contextual and returns through `/post-login` so the anonymous report is claimed before the same workspace unlocks.
Anonymous API serialization remains redacted: gated fields are omitted server-side, evidence remains real page evidence, and gate strings are never persisted into Flag rows.

Prompt and action projection is centralized by access capability:

- Authenticated owners receive every eligible per-Flag prompt.
- Repository-owned curated samples expose exactly one demonstrated per-Flag prompt and no aggregate Finish Plan prompt.
- Anonymous live-report viewers, non-owners, and shared-report viewers receive zero prompts and no copy controls.
- Static samples never expose update-review or lifecycle mutation actions.

Copying an owner prompt is a handoff, not verification.
It records one idempotent `HANDOFF_COPIED` event.
“Ready to verify” records an Improvement Attempt, but only a fresh completed child Update Review can determine the result.
The web report, MCP, and CLI use the same strict verification receipts.
Only receipt outcome `IMPROVED` may say an Improvement is verified or improved and write verified Product Memory.
`INCONCLUSIVE`, `UNCHANGED`, and `REGRESSED` must preserve coverage, evidence, and remaining risk.
A Flag absent from a raw child review is “No longer observed in this review,” not verified.
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
Show honest status, early findings, and a layout-matched Made with skeleton that resolves to verified, empty, partial, or unavailable.
Live Timeline and path replay remain authenticated evidence surfaces and never supply raw activity labels as Agent claims.
Keep the workspace and transcript mounted until the completed server report replaces progressive data.

## Samples and sharing

- Homepage: complete curated fix list with selected evidence and one editor-ready fix.
- `/samples`: complete, versioned curated observations selected by `?observation=`, each with its own Flags, captures, score, exactly one demonstrated per-Flag prompt, and repository-owned static Timeline.
  Every visible history point resolves to one immutable observation.
  An absent selector opens the current curated Review; an explicit unknown selector returns not found.
  Public sample playback is the only anonymous Timeline exception and never queries production audit rows.
- `/share/[token]` is the direct token surface; `/share/[token]/details` redirects after enforcing the same grant. Token access never mutates `Audit.isPublic`. Password access uses a scoped signed HttpOnly grant and protected metadata stays generic.

## Acceptance checks

- The primary report renders every persisted unresolved Flag without truncation.
- Interactive report targets are at least 44px and keyboard operable.
- Per-Flag capture comparisons show affected viewports in red, available unaffected viewports in green, and missing or failed captures neutrally. Every state includes text and an icon.
- Screenshot overlays use measured `Flag.evidenceTargets` or an explicit page-scope chip. Unmeasured Flags do not receive a guessed rectangle.
- `CircleAlert` is reserved for Critical Flags. Important and Polish remain available as accessible text.
- Loading, empty, partial, failure, forbidden, expired, revoked, and deleted states are explicit.
- Visible report chrome lives in `lib/marketing/copy.ts`.
- Technology profiles expose sanitized evidence labels and evidence bands only. They never grade vendors or leak raw requests, headers, cookies, query strings, or private report existence.
- Newly submitted anonymous and non-owner live reports expose evidence but never prompts, Timeline payloads, private memory/history, update-review controls, export, restricted sharing, or Canvas data.
- Repository-owned curated samples may expose only their static versioned Timeline payloads; this exception does not authorize live report playback.
- Programmatic Agent messages are stable, monotonic, derived from persisted facts, and excluded from model usage and persisted conversation rows.
