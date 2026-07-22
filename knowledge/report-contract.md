# Report Contract

This is the canonical hierarchy for report code, copy, tests, documentation, and agent skills.

## First-use loop

FixFlags is one product: **paste URL → receive three prioritized fixes → copy into an AI editor → re-check and prove the result**.

`buildFinishPlan()` in `lib/audit/finish-plan.ts` owns ranking, Product Contract bias, the three-item cap, prompt availability, and anonymous redaction. Web, export, MCP, CLI, re-check, and sample surfaces delegate to it.

## Focused report

`/report/[id]` is the default destination:

1. Identity, URL, verdict, readiness
2. Re-check result, when applicable
3. Finish Plan, at most three items
4. Copy Finish Plan
5. Compact Message / Experience / Reach proof
6. Full review link
7. Owner re-check
8. At most one contextual signup or upgrade moment

Anonymous reports expose all three problem and evidence summaries and exactly one complete demonstrated prompt. Other prompt fields are removed before rendering or API serialization.

## Detailed review

`/report/[id]/details` owns Product Contract, verified memory, journey, flow, action timeline, full Flag explorer, previews, launch gates, watch, sharing, export, project, and MCP controls. Its sticky navigation matches rendered sections. It always provides a route back to the Finish Plan.

## Progressive report

Progressive UI builds toward three Finish Plan cards. Show honest status, captures, and early findings. Put Contract and Action Timeline inside “How FixFlags is checking.” Keep the frame mounted until the completed server report replaces it.

## Samples and sharing

- Homepage: one three-item preview with selected evidence and one complete editor-ready fix.
- `/samples`: focused, versioned curated snapshot. `/samples/details`: full snapshot. Marketing rendering never queries production audit rows.
- `/share/[token]` and `/share/[token]/details`: direct token surfaces. Token access never mutates `Audit.isPublic`. Password access uses a scoped signed HttpOnly grant and protected metadata stays generic.

## Acceptance checks

- Focused UI does not import the explorer, journey, timeline, previews, or launch-gate client modules.
- Interactive report targets are at least 44px and keyboard operable.
- Loading, empty, partial, failure, forbidden, expired, revoked, and deleted states are explicit.
- Visible report chrome lives in `lib/marketing/copy.ts`.
