# Report workspace truth boundaries

- Date: 2026-07-28
- Scope: Completed, progressive, sample, shared, and dashboard report presentation
- Confidence: High

## Evidence

- The existing `buildFixList()` path already owns ranking and anonymous prompt access.
- Persisted Re-check history is a parent/descendant chain, so showing only direct children can omit later releases.
- The curated marketing sample is repository-owned and has no persisted Re-check sequence.

## Discovery

A shared report workspace stays trustworthy only when presentation adapters compose existing ranking, access, and persisted-history truth. Re-ranking in components, generating sample trends, or treating one generation of children as the whole release history creates subtle disagreements between surfaces.

## Correct approach

1. Build one explorer model through the existing fix-list path, then adapt it into the workspace model.
2. Keep prompt access explicit per surface and identify the single demonstrated public prompt.
3. Reconstruct the complete persisted release ancestry before ordering score history.
4. Omit the history segment unless at least two real scored releases exist.
5. Render unavailable shared states in the same geometry without loading private report data.

## Where prevention was encoded

- `lib/report/workspace-model.ts`
- `lib/report/workspace-adapters.ts`
- `lib/report/explorer-model.ts`
- `lib/report/__tests__/workspace-model.test.ts`
- `components/report/__tests__/ReportWorkspace.test.tsx`
- `app/report/[id]/load-report-route-state.ts`
- `app/(app)/dashboard/page.tsx`

