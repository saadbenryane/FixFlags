# Product dashboard and Product detail vertical design review

## Scope and conclusion

This was an independent read-only audit of the signed-in dashboard, Product detail, Review history, technology profile, and per-Flag Fix Prompt paths.

The leanest coherent change is to make the dashboard one vertically scannable Product list, make Product detail one action-led vertical story, make Reviews a dedicated vertical timeline instead of showing them twice, and move technology evidence into that owner-only Product projection.

The per-Flag report should show and copy the existing resolved editor prompt directly.
The generated `Goal / Constraint / Context / Plan / Verify` essay is a second prompt wrapped around the real prompt and is the source of the unwanted UI.

## Current canonical implementation

- Signed-in dashboard route: `app/(app)/dashboard/page.tsx`.
- Dashboard Product cards: `components/dashboard/ProductOverviewGrid.tsx`.
- Dashboard read model: `loadProductOverview()` and `ProductOverviewDTO` in `lib/products/workspace.ts`.
- Signed-in Product route and owner gate: `app/(app)/products/[id]/page.tsx` calls `getAppViewer()` and then `loadProductWorkspace(id, userId, ...)`.
- Product page composition: `components/product/ProductWorkspace.tsx`.
- Product priorities: `components/product/ProductPriorities.tsx`.
- Product Review action: `components/product/ProductReviewAction.tsx`.
- Product state, mixed activity history, and access-bounded queries: `ProductWorkspaceDTO` and `loadProductWorkspace()` in `lib/products/workspace.ts`.
- Report Review header/history: `components/report/ReportOutcomeBar.tsx` and `components/report/ScoreHistoryChart.tsx`.
- Per-Flag prompt row: `components/report/FlagDetailPanel.tsx`.
- Display-versus-copy primitive: `components/audit/FixPromptBlock.tsx` accepts `prompt` for display and optional `copyPrompt` for clipboard text.
- Clipboard action and owner handoff receipt: `components/audit/PromptCopyButton.tsx`.
- Per-Flag report projection: `mapLiveFlag()` in `lib/report/explorer-model.ts`.
- Existing editor prompt resolution: `resolveFixPrompt()` in `lib/audit/priority-flags.ts` prefers `agentPrompt`, then tool-specific prompts, then the plain fix.
- Generated headed prompt: `buildExpertFixPrompt()` in `lib/audit/flag-copy.ts` adds `Goal`, `Constraint`, `Context`, `Why it matters`, `Plan`, and `Verify` around that resolved prompt.
- Aggregate copy payload: `buildPlanModePrompt()` in `lib/audit/priority-flags.ts` adds the builder instruction, severity, rubric, confidence, evidence, and the resolved prompt.
- Technology persistence and sanitized read model: `lib/audit/technology-profile.ts` over `AuditTechnologyObservation`, `Technology`, and the Audit technology status/version/timestamp fields.
- Technology UI: `components/audit/MadeWithProfile.tsx`.
- Current report exposure: `getGatedAuditForRequest()` in `lib/audit/fetch-audit.ts`, `app/api/reports/[id]/status/route.ts`, `components/audit/AuditReport.tsx`, and `components/audit/AuditReportProgressive.tsx`.
- Current public growth surface: `app/(marketing)/madewith/[hostname]/page.tsx`, `getMadewithPage()` and `getIndexableMadewithProfiles()` in `lib/graph/queries.ts`, plus `app/sitemap.ts`.

## Finding 1: the Flag disclosure displays a generated wrapper, not just the existing prompt

`mapLiveFlag()` currently sets `fixPrompt = buildExpertFixPrompt(flag)` and `copyFixPrompt = buildPlanModePrompt([flag], { limit: 1 })`.

`FlagDetailPanel` displays `fixPrompt` but the orange Copy action copies `copyFixPrompt`.
The screen therefore shows the generated headed essay while the clipboard receives a different aggregate-shaped payload.
This mismatch makes the disclosure longer, less trustworthy, and harder to predict.

For the per-Flag web row, resolve one prompt with `resolveFixPrompt(flag)` and use that same value for both display and copy.
This directly satisfies the request to remove `Goal`, `Context`, `Plan`, and `Verify`, and it gives the user honest preview parity with the clipboard.

Keep `FixPromptBlock`'s separate `copyPrompt` capability because other surfaces may legitimately need it.
Keep `buildExpertFixPrompt()` and `buildPlanModePrompt()` only where an aggregate task or transport explicitly requires a structured bundle, such as all-prompt export, MCP, CLI, or a multi-Flag handoff.
Do not globally strip headings from persisted prompts because an AI-authored `agentPrompt` may intentionally contain useful Markdown.

`ProductPriorities` already copies the raw persisted `agentPrompt`, so using `resolveFixPrompt()` in the report also makes the Product and Review surfaces agree.

## Finding 2: the dashboard is a repetitive card grid where a vertical Product index is more usable

`ProductOverviewGrid` renders one elevated card per Product in a two-column grid.
Every card repeats identity, latest status, score, date, Attention, and an `Open Product` button inside substantial card chrome.
The result is visually heavy and makes comparison across Products harder than necessary.

Replace the grid with a single `ProductOverviewList` surface containing divided, full-row links.
Use only the fields already in `ProductOverviewDTO`:

1. Left: Product name, hostname, and one-line purpose.
2. Middle: the top open Improvement title and an `N open` count, or the existing honest empty, running, or failed state.
3. Right: latest Review score/status, reviewed date, optional Watch badge, and a chevron.

The whole row should be one native link to `/products/[id]`, with a 44px minimum target and a visible focus ring.
At 375px, stack identity above a compact metadata row instead of retaining desktop columns.
Do not add remote favicons or technology logos.

Keep `Review a URL` above the list because it is the primary product loop.
Make its submit action the single orange focal point in that region, and remove extra explanatory copy that repeats what the Product list demonstrates.
The empty state should continue to use the same URL form rather than introduce a second CTA.

## Finding 3: Product detail tells the Review-history story twice

`ProductWorkspace` renders Score plus `ScoreHistoryChart`, then renders the same Review events again inside `Recent activity` with attempts and verified learning.
This duplicates Review navigation and makes the Product page feel like stacked report widgets rather than one durable Product record.

The chart is also built from `workspace.history.events`, which is a 20-item mixed page of Reviews, attempts, and learnings.
Enough attempts can therefore push older Reviews out of the chart even though the UI presents it as Review history.

Create a dedicated Review-history projection from existing Audit rows instead of deriving versions from the mixed activity page.
No schema change is required.
Expose Review summaries independently from attempts and learning, with their own stable ordering and older-history cursor if pagination remains necessary.

Use one vertical Review timeline:

- Current Review is visually selected at the top.
- Each row shows Product review, Update review, or Watch review; date; status; mono score or honest pending/unavailable state; and unresolved count when completed.
- Each row is a native link to the complete `/report/[id]?view=report` Review.
- A thin rail and restrained nodes express chronology without decorative animation.
- Do not call these releases or versions unless a real release identifier exists.

Attempts and verified learning can remain a smaller `Changes and learning` disclosure below the Review timeline.
They should not compete with Review navigation or consume slots in its pagination.

## Recommended Product detail vertical

1. Compact back link.
2. Product identity, URL, Watch state, and one primary orange `Update review` or `Open review` action.
3. One current-Review strip with score/status, date, unresolved count, and Review type.
4. `Your priorities` as a single-column ranked accordion/list, with one item expanded in normal flow.
5. `Review history` as the dedicated vertical timeline described above.
6. `Made with` as owner-only Product context, with detected technology chips and an evidence disclosure.
7. `Watch and Signals` as one secondary disclosure, preserving all honest unavailable, error, and entitlement states.

This removes the horizontal score chart, the two-column priority master/detail, duplicate Product-context headings, and card-within-card treatment.
It keeps the page calm at every width and lets a user scan from current state to work, history, and supporting context.

The priority accordion should preserve the current evidence, recommended change, success condition, source Review link, prompt action, ranking, and five-item default.
Only its layout changes.

## Safest owner-only Made with move

Technology observations belong to a Review, but the Product page is already the owner-bounded durable projection.
Add `technologyProfile: TechnologyProfile | null` plus source Review ID/date to `ProductWorkspaceDTO`.

Resolve the freshest completed Product-associated Review that has technology state, including a completed Watch Review if it is newer, because this section describes the current Product rather than only the latest manual action.
The source timestamp and Review link must stay visible so the observation is not presented as timeless truth.

The ownership check must occur in the database predicate, not only in the page component.
The safest helper shape is an owner-scoped lookup such as `loadOwnedProductTechnologyProfile(productId, userId)` whose Audit query includes `project: { id: productId, userId }` and `status: 'COMPLETED'` before calling the sanitized technology projector.
Return `null` for a missing or foreign Product without querying by an untrusted Audit ID.

Render a Product-specific flat section or a `variant="product"` of `MadeWithProfile`.
Retain category icons, `Verified` or `Strong signal`, sanitized evidence labels, detector date, partial/unavailable/not-captured states, and comparable detector-version diff behavior.
Do not render the existing compact report disclosure inside another Product card.

If Made with is now signed-in Product context, remove it from every public Review payload and surface, not merely from JSX:

- Stop adding `technologyProfile` in `getGatedAuditForRequest()`.
- Stop returning it from `/api/reports/[id]/status`.
- Remove progressive client plumbing and report context rendering.
- Remove `/madewith/[hostname]` and its metadata, sitemap entries, public graph read model, and related-profile links, or make the route a hard 404 while deleting all discovery.
- Do not redirect a hostname to a private Product because that would reveal whether an account owns that hostname.
- Preserve the detector, Audit observations, and graph persistence because they still power the owner Product profile and graph-backed issue analysis.

The current public Made with route is access-filtered, but leaving it indexed would contradict the requested signed-in placement.
The current report status endpoint returns the technology profile for every authorized public-report access context, so a UI-only move would still leak the data through JSON.

Update `PRODUCT.md`, `DESIGN.md`, `knowledge/report-contract.md`, `docs/workspace-interface.md`, and `docs/growth/growth-architecture.md` after behavior changes, because each currently declares report or public Made with behavior.

## Required tests

### Fix Prompt

- `lib/report/__tests__/explorer-model.test.ts`: the per-Flag display prompt equals `resolveFixPrompt()` and contains no generated `## Goal`, `## Constraint`, `## Context`, `## Plan`, or generated `## Verify` headings.
- `components/report/__tests__/FlagDetailPanel.test.tsx`: opening `Fix Prompt` shows the exact resolved prompt in normal flow with no nested card.
- `components/audit/__tests__/PromptCopyButton.test.tsx`: clipboard text exactly matches the visible per-Flag prompt and owner copy still records `HANDOFF_COPIED`.
- Keep anonymous, shared, non-owner, and curated-sample prompt projection tests to prove zero prompt leakage and exactly one sample prompt.
- Keep aggregate export/MCP/CLI prompt tests separate so simplifying the web row does not silently weaken those payloads.

### Technology access and projection

- `lib/products/workspace.test.ts`: foreign/missing Product returns no profile; latest completed Product Review is selected; a newer completed Watch Review wins; incomplete Review does not replace the last complete profile; and complete, partial, unavailable, legacy, and empty profiles project honestly.
- Product route test: unauthenticated viewers redirect before Product data loads and an owner receives the profile.
- Report route and status tests: `technologyProfile` is absent for anonymous, owner, shared, and sample responses after the move.
- Sitemap and route tests: `/madewith/[hostname]` is undiscoverable/404 and no sitemap entry remains.
- Product component tests: technology evidence labels remain sanitized, category icons have accessible labeling, no remote logo is requested, and the source Review/date is visible.

### Dashboard and Product states

- Dashboard: zero Products, one Product, many Products, completed, partial, pending, failed, Watch active, and review-limit states.
- Product: no Review, active first Review, active Update review with prior priorities, failed latest Review, no priorities, more than five priorities, partial Review, full Review, Watch failure, Signals ineligible, and paginated Reviews.
- Review timeline: native links, stable chronological order, pending/unavailable labels, Watch and Update-review labels, and no duplicate Review navigation surface.
- Interaction: keyboard order, visible focus, 44px targets, one-open priority behavior, disclosure semantics, and Back/Forward preservation.
- Browser proof at 375px, 768px, and 1280px, plus 200% reflow, reduced motion, no horizontal overflow, no clipped orange actions, and no console or hydration errors.

Run `npm run ui:drift-guard`, focused dashboard/Product/report tests, `npm run agent -- eval ui`, `npm run agent -- verify --dry-run`, and then `npm run agent -- verify` after implementation.

## Implementation boundary

No product source files were changed during this audit.
The current working tree already contained unrelated edits and they were preserved.
