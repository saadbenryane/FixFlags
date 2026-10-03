# Attributable Site first-value funnel

## Outcome

The admin analytics surface now reconstructs an immutable anonymous Site-start cohort and follows each exact
check to its first useful result and later account claim. A successful claim no longer removes the original start
from the denominator.

## Why this was the next constraint

The corrected competitive briefing made a fresh conversion baseline the dependency for later positioning work.
The existing product already emitted a 17-stage durable `SiteLifecycleEvent` registry, so adding parallel browser
events would have duplicated server truth. The actual defect was the operator query: it counted current
`Audit.userId IS NULL` rows. Claiming an anonymous Site mutates that field, making successful claimers disappear
from the start cohort.

## Implementation

- `loadSiteFirstValueFunnel` fixes cohort membership from `analyze_started:<auditId>` events whose immutable
  properties say `anonymous: true`.
- It queries those exact Audits for current claim/failure state and those exact
  `first_useful_result:<auditId>` events for first-value completion.
- Result lookup intentionally has no second date cutoff, so a start near the 30-day boundary keeps its later
  result.
- The admin page shows start, first useful result, claim, pre-result failure, reconciliation gaps and a source
  breakdown from the same cohort.
- The 17 broad lifecycle counts are retained but relabeled as non-sequential activity.
- The analytics skill and competitive briefing now distinguish browser acquisition events from durable product
  events and record the remaining visitor-to-start attribution gap.

## Verification

- `npx vitest run lib/analytics/__tests__/site-first-value-funnel.test.ts lib/analytics/__tests__/site-events.test.ts lib/analytics/__tests__/funnel-call-sites.test.ts` — 3 files, 7 tests passed.
- `npx eslint app/admin/analytics/page.tsx lib/analytics/site-first-value-funnel.ts lib/analytics/__tests__/site-first-value-funnel.test.ts` — passed.
- `npx tsc --noEmit --incremental false` — passed.
- `npm run ui:drift-guard`, `npm run agent -- eval growth`, and `npm run skills:validate` — passed.
- Read-only execution against the configured developer database returned one reconciled cohort: 27 anonymous
  starts, 9 first useful results, 1 later claim, 18 pre-result failures, 0 pending/missing results and 0 missing
  Audit records across 2 source rows. This proves the query path executes; it is not a production baseline or a
  customer-value claim.

- `npm run agent -- verify` passed its first 22 checks and then stopped at `npm audit --audit-level=moderate`
  because the unchanged shared dependency graph currently reports 10 high-severity `braces` paths through
  Tailwind, `tsc-alias`, Chokidar, Micromatch and Fast Glob. Receipt:
  `.agent-runs/2026-10-03T15-02-57-012Z-security-audit.log`. This analytics scope changes no dependency manifest
  or lockfile.
- The seven checks after the audit were run explicitly: 98 script tests passed; 472 unit-test files with 5,738
  tests passed; coverage passed at 72.72% statements / 66.47% branches / 74.24% functions / 74.47% lines;
  accuracy evaluation passed; optimized Next production build passed; worker build passed; and the container
  build completed as `fixflags:verify`.
- The effective result is 29 of 30 repository gates passed. The sole failure is the shared dependency audit,
  not an ignored analytics failure.

No deployment or production baseline is claimed.
