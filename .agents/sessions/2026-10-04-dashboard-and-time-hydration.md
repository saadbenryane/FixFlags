# Dashboard and evidence-time hydration repair

Date: 2026-10-04
Owner: codex-root
State: locally verified; not deployed or customer-validated

## Customer failures

1. The authenticated Sites dashboard returned HTTP 200 but React displayed an RSC serialization error. `SitesOverviewGrid`, a server component, passed the Lucide `Globe2` component function into the client `BoardCard`.
2. After the dashboard rendered, a real Site page hydrated with a different Outcome evidence time. The server showed 11:57 PM while the browser showed 10:57 PM for the same instant because `toLocaleString()` used implicit host and browser time zones.

## Repair

- `BoardCard` now accepts a serializable `SiteCardArea` key and resolves its icon inside the client module. All dashboard, Site, homepage, and test call sites use the key contract.
- `formatEvidenceTimestamp` formats persisted evidence with explicit `en-US` and `UTC` semantics. Site Outcome freshness, card evidence, connection freshness, Watch dates, and Flag proof use it anywhere a client component can pre-render and hydrate.
- Missing or invalid values stay absent rather than becoming invented dates.

## Evidence

- Authenticated local `/dashboard` rendered three Site links at 1280×900 and 375×812. Both widths had zero horizontal overflow and no `Functions cannot be passed directly to Client Components` or `Only plain objects can be passed to Client Components` errors.
- The first dashboard Site target resolved to the matching `/sites/:siteId` route.
- A fresh Site tab rendered `Last verified Sep 23, 2026, 10:57 PM UTC` at 1280×900 and 375×812 with zero console errors and no overflow.
- Focused verification: five suites, 38 tests passed. Full TypeScript and scoped ESLint passed. `git diff --check` passed.
- Complete repository verification: all 30 commands passed, including unit, coverage, security, completeness, accuracy, optimized Next, worker, and Docker image. Receipt: `.agent-runs/2026-10-04T22-58-40-683Z-container-build.log`.

## Status boundary

- Implemented and locally verified.
- Not production verified because no commit was pushed or deployed.
- Not customer validated because the evidence is an owner-controlled local fixture journey.
