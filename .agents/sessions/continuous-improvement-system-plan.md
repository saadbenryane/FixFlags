# Continuous Improvement System implementation

## Objective

Make FixFlags increasingly better at knowing what a Product should improve next and proving whether the improvement worked.

The canonical internal loop is **Observe → Understand → Judge → Improve → Verify → Learn**.

The customer wedge remains **Product Review → Fix → Verify → Watch**.

## Architecture decisions

- Preserve `Project` as the persisted Product anchor, `Audit` as an immutable Review observation, and `Flag` as an observation-specific finding.
- Add a durable Product-scoped `Improvement`, `ImprovementOccurrence`, and `ImprovementAttempt` history before adding telemetry.
- Require a fresh FixFlags Review before an attempt can be marked verified.
- Keep Product Memory in `Project.productIntelligence`, with relational references rather than duplicated history.
- Keep private customer Improvements and Product Memory isolated from the cross-product growth graph and `Issue` models.
- Add only privacy-bounded native signals that materially improve judgment or verification.
- Keep current pricing and review quotas operational while measuring verified-improvement economics.

## Delivery sequence

1. Reconcile canonical terminology, shipped truth, roadmap, architecture, and acceptance contracts.
2. Add the durable Improvement data model, idempotent lazy materialization, attempts, occurrences, independent verification, and Product Memory learning.
3. Recenter Product surfaces on bounded Attention, action, verification receipts, and Product history across web, Agent, CLI, and MCP.
4. Add origin-bound Product Signal ingestion, releases, strict sanitization, retention, and the narrow browser client.
5. Demote customer analytics and disconnected surfaces, add verified-improvement operating metrics, and reconcile skills.
6. Prove the complete loop through focused tests, full repository gates, responsive browser checks, accuracy evaluation, and two versioned lab cycles.

## Acceptance boundary

The work is complete only when the implementation, canonical documentation, migrations, privacy boundary, shared transport behavior, and real two-cycle evidence agree.

Credentialed production release remains a separate operator-controlled action and must not be represented as complete without its fixtures.

## Implementation evidence — 2026-08-13

- Added the durable `Improvement`, `ImprovementOccurrence`, and `ImprovementAttempt` lifecycle with independent verification outcomes and provenance-backed Product Memory learning.
- Added bounded Product Attention, Product history, explicit builder handoffs, change declarations, verification receipts, and shared web, Agent, CLI, and MCP contracts.
- Added `ProductRelease`, origin-bound signal keys, bounded `ProductSignal` ingestion, thirty-day raw retention, synthesized signal context, and the privacy-limited browser client.
- Preserved URL-first Reviews, full update-review capture, Message / Experience / Reach, the complete Fix List, Watch, current pricing, and the independence invariant.
- Real-browser local proof completed for signup, URL-only Review, three-item Attention, complete Fix List drill-down, Product Agent grounding, signal-key setup, valid signal ingestion, malformed-payload rejection, and builder handoff creation.
- `npm run agent -- verify` passed all 26 selected commands, including database validation and drift, TypeScript, lint, unit tests, coverage, accuracy evaluation, build, worker build, completeness, MCP quality, security, and container build.

## Remaining value proof

The implementation is locally complete, but the strategic acceptance goal remains active until the separately owned versioned lab completes two genuine `Review → handoff → deployed change → independent update Review → learned outcome` cycles.
The example.com browser run cannot satisfy that criterion because FixFlags does not control or deploy that Product.
Credentialed production release proof also remains operator-controlled and separate from local implementation correctness.
