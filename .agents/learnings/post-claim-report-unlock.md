# Post-claim report unlock (2026-07-17)

- Date: 2026-07-17
- Scope: Anonymous claim → ownership unlock → AI prescription pending UX; anon triage value
- Confidence: High

## Evidence

- `ClaimAnonymousAudits` only called `useMe({ claim: true })`, which updated client me-state and toasted, but report pages are server-rendered with `getGatedAuditForRequest`. Without `router.refresh()`, ownership and fix visibility stayed locked.
- Anon audits are created with `includeAi: false`. Setting `includeAi` before enqueue left stuck pending if the queue rejected the job.
- `stripDeterministicFixesFromFlags` removed evidence/whyItMatters, so anon "Evidence" cards fell back to problem text via `evidence ?? problem`.
- Live local scan of example.com (2026-07-17): evidence + whyItMatters + locked Fix teaser + PageSpeed Callout all rendered for anon.

## Discovery

The signup conversion moment fails silently: toast says "Saved N audits" while the report still looks anonymous. Separately, gating evidence made the free first scan feel empty, which undercuts the wedge.

## Why it matters

This is the money moment of the wedge (triage free → account for prompts). Broken unlock kills trust and paid conversion. Hidden evidence kills the free first impression.

## Correct approach

1. After successful claim (`claimedCount > 0`), always `router.refresh()`.
2. Enqueue AI review first; only then set `includeAi: true`.
3. Keep evidence + whyItMatters for anon; strip only fix prompts.
4. Surface partial capture with Callouts; Re-check nav only for owners; scroll to `#recheck-results` when a diff exists.
5. Defer dashboard MCP/Projects upsells until the user has at least one audit.

## Where prevention was encoded

- `components/dashboard/ClaimAnonymousAudits.tsx`
- `lib/audit/claim-anonymous.ts`
- `lib/audit/report-access.ts` + `lib/audit/__tests__/report-access.test.ts`
- `lib/report/explorer-model.ts`
- `components/audit/RubricCard.tsx`, `ReportStickyToolbar.tsx`, `RecheckDiffStrip.tsx`
- `app/(app)/dashboard/page.tsx`
- `lib/marketing/copy.ts`
- `.agents/sessions/2026-07-17-ship-ready-core-loop-auto.md`
