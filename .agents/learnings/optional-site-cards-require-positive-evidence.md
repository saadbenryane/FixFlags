# Optional Site cards require positive evidence

**Date:** 2026-10-01
**Scope:** Site coverage, board-card query contract, progressive disclosure
**Confidence:** HIGH
**Evidence:** Red-before-green SiteBoard tests; coverage tests; real local `example.net` stored-scan render; full 30-command verification receipt `.agent-runs/2026-10-01T11-12-24-612Z-container-build.log`.

## Discovery

Uptime and Accessibility were already computed and could own real Flags, but `SiteBoard` discarded both because they were outside the starter-card list. Revealing every optional card would replace one failure with another: beginners would see empty, unverified chrome and could read it as coverage.

The scan already stores the positive evidence needed to make the reveal honest. A completed desktop capture plus parsed metadata proves point-in-time public reachability. `AuditVerifierExecution` records whether the accessibility module was applicable and completed. A completed applicable receipt is positive accessibility coverage; `NOT_APPLICABLE` is not.

## Correct approach

- Carry `CoverageFact.evidenced` into `BoardCardView`; do not infer evidence from health state or status copy.
- Reveal optional cards when `evidenced` is true or an open Flag exists.
- Preserve evidenced stale cards so expired freshness is not mistaken for missing coverage.
- Keep untouched and first-check `checking` optional cards hidden.
- Treat open Flags as a compatibility fallback for older serialized views that do not carry the evidence field.

## Prevention encoded

- Coverage tests pin capture-based Uptime evidence, completed Accessibility receipts, and `NOT_APPLICABLE` behavior.
- SiteBoard tests pin hidden untouched cards, healthy evidence reveal, stale evidence reveal, and legacy open-Flag reveal.
- The product skill now states the progressive-evidence contract.
