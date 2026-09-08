# Structural completeness must prove behavior and ownership

**Date:** 2026-09-03
**Scope:** Review projection, pipeline persistence, Product application core, route contracts, and parked surfaces
**Confidence:** HIGH
**Evidence:** `npm run module:boundary-guard`, `npm run routes:contract-guard`, append-only ledger concurrency tests, and the full local verification catalog

## Discovery

A route inventory could report success when it only sent an invalid empty
request. A parked UI could still leave live Canvas mutation APIs. Concurrent
pipeline writers could replace one another because events lived in a mutable
JSON array. Access, ranking, and report state were also being projected more
than once for the same request.

## Why it matters

Nominal coverage and hidden alternate authorities make release evidence look
stronger than the product. They also make partial results, anonymous redaction,
and retry behavior difficult to reason about under concurrency.

## Correct approach

Use one server-built Review projection and one pure access decision, append
pipeline events as immutable rows, enter Product mutations through typed
commands, and require fixture-backed success evidence for customer routes.
Parking means deleting the public API and discovery paths, not hiding a link.

## Prevention encoded

- `scripts/route-contract-registry.mjs` rejects generic validation probes as success evidence.
- `scripts/module-boundary-guard.mjs` enforces runtime boundaries, cycle freedom, and absent Canvas APIs.
- `prisma/migrations/20260902233000_audit_pipeline_event_ledger/migration.sql` performs the direct ledger cutover.
- Projection, access-policy, event-concurrency, command, and Watch clock tests preserve the contracts.
