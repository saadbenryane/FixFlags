# Consent-aware landing-to-Site attribution

## Outcome

A consenting homepage session can now be joined to its exact anonymous Site start, first useful result, and later
claim without exposing the private Site-owner identity or persisting a raw URL. Missing or incomplete GA
telemetry remains visibly unavailable or partial.

## Why this was the next constraint

The immutable server cohort shipped locally in the previous cycle, but the acquisition session before a Site
start still lived only in aggregate browser analytics. That prevented a reproducible landing-to-claim baseline,
which blocks honest diagnosis and conversion experiments.

## Implementation

- `readOrCreateAnalyticsJourneyId` creates one 128-bit opaque key in session storage only after analytics consent.
- `LandingViewTracker` now records a landing when consent is granted after mount and still sends at most once per
  mount.
- Homepage Site creation sends the same key to `landing_view`, `started_audit`, and the exact
  `analyze_started:<auditId>` lifecycle event. The API validates the key format; the Audit row and private
  `ff_anon_visitor` ownership token remain untouched.
- The GA setup command registers `journey_id` as an event-scoped custom dimension. The rolling GA pull stores
  only opaque keys and counts, marks unusable grouped rows or a saturated export row limit partial, and marks an
  unqueryable dimension unavailable.
- The admin analytics page joins unique consenting landing sessions through durable result and claim truth. It
  never renders a missing export as zero.

## Verification

- Focused unit/component/route coverage: 9 files, 80 tests passed.
- Scoped ESLint and non-incremental TypeScript passed.
- A real 375×812 Playwright path waited for hydration, granted analytics consent, submitted `example.com`, and
  intercepted the check API before any scan. The same `ffj_…` key appeared in session storage, the POST body,
  `landing_view`, and `started_audit`; the latter also carried `audit-browser-proof` and `reused: false`. The page
  had no horizontal overflow.
- The configured developer database loader still reconciles 27 anonymous starts, 9 results, and 1 later claim.
  With no rolling GA journey artifact yet it returned `landing.status: missing`, null landing/result/claim values,
  and zero instrumented starts rather than a fabricated zero-conversion cohort.
- Growth evaluation, skill validation, UI drift, copy drift, scoped ESLint, and non-incremental TypeScript passed.
- This machine has a developer database but no `GA4_PROPERTY_ID` or GA service-account key, so the external
  dimension and read-only export could not be exercised here.
- Broader repository gates are still pending.

No deployment, GA property mutation, production export, or customer validation is claimed.
