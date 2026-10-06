# Marketing skill Outcome contract parity

**Task:** `marketing-skill-outcome-contract-parity-2026-10-06`  
**Status:** locally verified guidance; no public claim or runtime change; not deployed

## Drift found

The repository marketing skill said `watchableOutcomeKinds()` permitted only
Checkout and Availability and instructed agents not to describe Signup. The
executable contract now permits Checkout, Signup and Availability. Safe Signup
is locally implemented only through a synthetic-data fixture with exact-origin
reset and cleanup hooks, a successful dry run, and authorization bound to the
fixture version.

That stale instruction could make a later agent remove valid Safe Signup copy
or report a false product gap. It could also hide the actual safety boundary by
treating every protected form as equally unavailable.

## Reconciliation

- The skill now treats `watchableOutcomeKinds()` as the capability authority.
- Safe Signup is named with its reversible fixture boundary rather than as a
  generic form claim.
- Login and Password reset remain explicitly unavailable.
- The guidance still requires the visible protected-flow boundary and homepage
  claim-parity regression to move with any future contract change.

This is an instruction correction only. It does not add or change homepage
copy, enable a route, deploy the local implementation, prove production
behavior, or establish customer validation.

## Evidence

- `npm run skills:validate` passed.
- The optional skill-creator quick validator could not start because its
  standalone Python environment does not include PyYAML. No dependency was
  installed for this documentation-only change; the repository-owned skill
  validator above is the governing check.
- `npm run knowledge:duplication-guard` passed.
- `npm run completeness:audit` passed.
- `git diff --check` passed.
- The repository affected-check dry run selected the expected documentation
  and coordination checks without inventing a runtime scope.
