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
  only opaque keys and counts, marks unusable grouped rows partial, and marks an unqueryable dimension unavailable.
- The admin analytics page joins unique consenting landing sessions through durable result and claim truth. It
  never renders a missing export as zero.

## Verification

- Focused unit/component/route coverage: 9 files, 80 tests passed.
- Scoped ESLint and non-incremental TypeScript passed.
- Broader repository gates and a real browser path are still pending.

No deployment, GA property mutation, production export, or customer validation is claimed.
