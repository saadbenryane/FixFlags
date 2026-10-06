# A measured gate must own the release transition it protects

Date: 2026-10-06
Scope: Watch reliability/economics and paid opening
Confidence: high

## Discovery

FixFlags had a conservative, tested Watch launch-readiness projection and an Admin readout, but `billing-open` ran only Stripe journeys. The release system could therefore produce a paid-opening receipt while the required Watch sample was still collecting.

## Rule

An operational metric is not a release gate until the transition it protects consumes the same calculation and preserves its evidence. Documentation and dashboards are visibility, not enforcement.

## Prevention encoded

- `billing-open` runs the existing `watch:launch-readiness` calculation before its billing journey.
- The query uses an explicit Watch evidence database distinct from the resettable release database and runs inside a read-only transaction.
- The artifact is bound to candidate SHA and a hashed canonical database identity.
- Receipt validation requires all seven gate states and the named sample, reliability, deduplication, quiet-success, and COGS thresholds.
- Final release aggregation rejects a `billing-open` receipt without passing Watch evidence.
