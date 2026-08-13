# Product Intelligence

**Canonical home for the Product Intelligence model.** Vision context: [vision.md](./vision.md).

## Definition

Product Intelligence is the persistent, customer-specific understanding of one Product. The customer owns it. It should remain portable, inspectable, and usable outside FixFlags.

## Review as observation; Product as the long-term object

A scan/review is an observation of the Product at a moment in time.

The Product is the long-term object ([vision.md](./vision.md)).

Product Memory grows across Reviews, Improvement attempts, independent verification, Watch runs, Contract edits, releases, decisions, and bounded Product Signals.

Keep contract-like knowledge and compact learned facts in `Project.productIntelligence`.

Normalize the high-query Improvement history into relational tables.

Do not build a graph database while the relational model represents the loop cleanly.

## Canonical product primitives

| Primitive | Meaning |
|---|---|
| Product | The long-lived customer object, persisted as `Project` |
| Review | An immutable observation of a Product, persisted as `Audit` |
| Flag | An evidence-backed finding from one Review |
| Improvement | A durable Product-scoped judgment about a worthwhile change |
| Improvement Attempt | A builder handoff or declared implementation tied to an Improvement |
| Verification Outcome | The independent result `IMPROVED`, `UNCHANGED`, `REGRESSED`, or `INCONCLUSIVE` from a fresh Review |
| Product Signal | Privacy-bounded native or external evidence that remains an observation until judged |
| Product Release | A Product deployment or version used to correlate observations and changes |
| Product Memory | Provenance-carrying Contract, decisions, constraints, and verified learning for one Product |
| Watch | Continued independent observation after first value is proven |
| Agent | A Product-grounded interface that explains evidence, judgment, action, verification, and history |
| MCP and CLI | Action interfaces over the same Product judgment contract |
| Integration | A provenance-preserving source adapter that adds context without becoming a separate product area |

Customer Product Memory and Improvements are private.

They never merge with the cross-product `graph_*` growth intelligence or `Issue` models.

## Relationship to Product Contract

The **Product Contract** is the MVP seed of Product Intelligence: purpose, first-value journey, critical outcomes (inferred or user-edited).

| Layer | Scope | Persistence |
|-------|-------|-------------|
| Audit `productContract` | Snapshot for one report | Immutable for that audit |
| Project `productIntelligence` | Living understanding of the Product | Survives audits and re-checks |

User edits update Project PI and the current audit snapshot. New audits for the same project carry forward Project PI.

## What it may include

Mission, intended users, jobs to be done, positioning, value proposition, journeys, capabilities, terminology, business rules, design language, architecture notes, implementation state, release goals, constraints, decisions, known risks, priorities, findings pointers, evidence pointers, history, verified knowledge.

Near-term schema (JSON on `Project`) prioritizes:

```ts
{
  purpose: string
  firstValueJourney: string
  criticalOutcomes: string[]
  importantJourneys?: string[]
  successConditions?: string[]
  constraints?: string[]
  decisions?: { text: string; at: string }[]
  knownRisks?: string[]
  verifiedLearnings?: {
    checkId?: string
    summary: string
    auditId: string
    improvementId?: string
    attemptId?: string
    at: string
  }[]
  intentionalNotes?: string[]  // from "this is intentional" dismissals
  sourceReliability?: {
    source: string
    status: 'reliable' | 'degraded' | 'unknown'
    lastObservedAt?: string
  }[]
  source: 'heuristic' | 'user' | 'merged'
  updatedAt: string
}
```

## Separation from FixFlags growth graph

| System | Tables / path | Purpose |
|--------|---------------|---------|
| Customer Product Intelligence | `Project.productIntelligence` | Per-customer product memory |
| Growth knowledge graph | `graph_*` via `lib/graph/` | Cross-tenant SEO / market intelligence for FixFlags |

Do not merge these. Public pages never read customer PI.

## Portability (direction)

Human-readable repository files may eventually project PI. Long-term internal representation may be a graph of entities, evidence, relationships, decisions, and history. Export before any lock-in narrative. See [open-source.md](./open-source.md) and [privacy.md](./privacy.md).

## Dismissal → intelligence

| Response | Updates |
|----------|---------|
| Fix this | Repair flow |
| Accept for now | Debt / known risk (future) |
| This is intentional | `intentionalNotes` + Contract intent |
| Incorrect finding | Flag quality signal (Integrity Engine) |
| Needs human review | Automation confidence (future) |

## Flag and Improvement

Reports, prompts, and scores are formats.

A Flag belongs to an observation.

An Improvement is stable across observations and records the judgment, expected benefit, recommended change, protected scope, success condition, priority, attempts, verification, and outcome.

Strong Flags express product consequences and supply evidence to Improvements.

See truth classes in [integrity-engine.md](./integrity-engine.md).

A Flag may eventually be supported by any evidence source.

Product Signals are not Flags by default.

Judgment decides whether a signal pattern supports an Improvement, warrants investigation, or is noise.

## Surfaces

- **Basic (Launch Check):** Connect app → see understanding → correct Contract → Fix list → fix → re-check → PI improves.
- **Advanced:** Local runtime, MCP (`get_product_context`), repo connect, CI verify, drift over time.

Shipped surface today: [PRODUCT.md](../PRODUCT.md).
