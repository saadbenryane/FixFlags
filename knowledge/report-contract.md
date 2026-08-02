# Report Contract

This is the canonical hierarchy for report code, copy, tests, documentation, and agent skills.

## First-use loop

FixFlags is one product: **paste URL → receive every unresolved Flag ranked by impact → copy fixes into an AI editor → re-check and prove the result**.

`buildUnifiedPlanBundle()` aggregates live and repository Flags once. `buildFixList()` then owns complete ranking, Product Contract bias, prompt availability, and anonymous redaction.

## Canonical report

`/report/[id]` is the default destination:

1. Compact identity row with hostname, URL, status, and actions
2. Re-check result, when applicable
3. Progress band (`#report-status`) with release score or scan percent, unresolved Flag count, Re-check history, and Message, Experience, Reach coverage
4. Sticky section navigation when two or more sections exist
5. Top fixes (`#report-top-fixes`) with the full ranked fix bundle, when Flags exist
6. Complete ranked fix list (`#report-flags`) with screenshot evidence and selected fix detail
7. Made with (`#report-stack`), Product Contract (`#report-contract`), verified memory (`#report-remember`), when present
8. Funnel, flow, and action timeline (`#report-funnel`)
9. Share and search previews, launch gates, watch, sharing, export, project, and MCP controls
10. Owner re-check (`#report-recheck`)
11. At most one contextual signup or upgrade moment

Sticky nav order matches DOM order: Top fixes → All fixes → Made with → Contract → Remember → Funnel → Previews → Launch → Re-check.

**Report header copy:** "Your review" with unresolved count and checked scope. The progress band owns the release score.

New anonymous scans are visually gated by a mandatory auth dialog over an inert report. Users can authenticate or return home, but cannot inspect the progressive or completed private report anonymously. Email claims and refreshes in place. OAuth, passkey, and two-factor routes claim through `/post-login` and return to the same report. Anonymous API serialization remains redacted: evidence must be real page evidence, prompt fields are removed, and gate strings are never persisted into Flag rows.

`/report/[id]/details` redirects to `/report/[id]`. Shared and sample detail URLs likewise redirect to their canonical report surfaces.

## Progressive report

The homepage paints report geometry as soon as a valid URL is submitted. After `/api/checks` returns an ID, navigation history is replaced with `/report/[id]` without showing the background-check banner. Progressive UI uses the same `ReportWorkspaceShell` as the completed report. The progress band shows honest 0–100% pipeline progress and stage detail. Partial Flags stream into the same ranked explorer. Desktop and mobile capture placeholders resolve independently inside flag detail on mobile; the standalone capture pair stays on large screens only. Show honest status, early findings, and a layout-matched Made with skeleton that resolves to verified, empty, partial, or unavailable. Contract and Action Timeline stay inside collapsed “How FixFlags is checking” until the scan completes, then promote below the work zone. Keep the frame mounted until the completed server report replaces it.

## Samples and sharing

- Homepage: complete curated fix list with selected evidence and one editor-ready fix.
- `/samples`: complete, versioned curated snapshot. `/samples/details` redirects to it. Marketing rendering never queries production audit rows.
- `/share/[token]` is the direct token surface; `/share/[token]/details` redirects after enforcing the same grant. Token access never mutates `Audit.isPublic`. Password access uses a scoped signed HttpOnly grant and protected metadata stays generic.

## Acceptance checks

- The primary report renders every persisted unresolved Flag without truncation.
- Interactive report targets are at least 44px and keyboard operable.
- Per-Flag capture comparisons show affected viewports in red, available unaffected viewports in green, and missing or failed captures neutrally. Every state includes text and an icon.
- `CircleAlert` is reserved for Critical Flags. Important and Polish remain available as accessible text.
- Loading, empty, partial, failure, forbidden, expired, revoked, and deleted states are explicit.
- Visible report chrome lives in `lib/marketing/copy.ts`.
- Technology profiles expose sanitized evidence labels and evidence bands only. They never grade vendors or leak raw requests, headers, cookies, query strings, or private report existence.
- Newly submitted private reports require authentication before evidence or prompts can be inspected. Anonymous APIs retain prompt redaction for defense in depth.
