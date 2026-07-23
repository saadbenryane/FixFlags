# Report Contract

This is the canonical hierarchy for report code, copy, tests, documentation, and agent skills.

## First-use loop

FixFlags is one product: **paste URL → receive every unresolved Flag ranked by impact → copy fixes into an AI editor → re-check and prove the result**.

`buildFixList()` in `lib/audit/finish-plan.ts` owns ranking, Product Contract bias, prompt availability, and anonymous redaction. `buildFinishPlan()` remains only as a deprecated three-item compatibility artifact.

## Canonical report

`/report/[id]` is the default destination:

1. Identity, URL, verdict, readiness
2. Re-check result, when applicable
3. Complete ranked fix list with screenshot evidence and selected fix detail
4. Product Contract and verified memory, when present
5. Journey, flow, and action timeline
6. Share and search previews, launch gates, watch, sharing, export, project, and MCP controls
7. Owner re-check
8. At most one contextual signup or upgrade moment

Anonymous reports expose every problem and evidence summary and exactly one complete demonstrated prompt. Other prompt fields are removed before rendering or API serialization.

`/report/[id]/details` redirects to `/report/[id]`. Shared and sample detail URLs likewise redirect to their canonical report surfaces.

## Progressive report

Progressive UI appends every verified Flag to the same ranked explorer used by the completed report. Show honest status, captures, and early findings. Put Contract and Action Timeline inside “How FixFlags is checking.” Keep the frame mounted until the completed server report replaces it.

## Samples and sharing

- Homepage: complete curated fix list with selected evidence and one editor-ready fix.
- `/samples`: complete, versioned curated snapshot. `/samples/details` redirects to it. Marketing rendering never queries production audit rows.
- `/share/[token]` is the direct token surface; `/share/[token]/details` redirects after enforcing the same grant. Token access never mutates `Audit.isPublic`. Password access uses a scoped signed HttpOnly grant and protected metadata stays generic.

## Acceptance checks

- The primary report renders every persisted unresolved Flag without truncation.
- Interactive report targets are at least 44px and keyboard operable.
- Loading, empty, partial, failure, forbidden, expired, revoked, and deleted states are explicit.
- Visible report chrome lives in `lib/marketing/copy.ts`.
