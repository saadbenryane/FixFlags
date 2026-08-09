# Product Intelligence

**Canonical home for the Product Intelligence model.** Vision context: [vision.md](./vision.md).

## Definition

Product Intelligence is the persistent, customer-specific understanding of one Product. The customer owns it. It should remain portable, inspectable, and usable outside FixFlags.

## Review as observation; Product as the long-term object

A scan/review is an observation of the Product at a moment in time. The Product is the long-term object ([vision.md](./vision.md)). Product Memory grows across observations: audits, update reviews, watch runs, Contract edits, and eventually non-scan signals.

Direction: extend `Project.productIntelligence` toward the vision's Product Memory (expected behavior, journeys, decisions, what "good" means for this product). Normalize into tables only when query needs prove it; do not prematurely build a graph database if the relational model represents this cleanly.

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
  constraints?: string[]
  decisions?: { text: string; at: string }[]
  knownRisks?: string[]
  verifiedLearnings?: {
    checkId?: string
    summary: string
    auditId: string
    at: string
  }[]
  intentionalNotes?: string[]  // from "this is intentional" dismissals
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

## Flag as durable unit

Reports, prompts, and scores are formats. The Flag is the durable finding unit. Strong Flags express product outcomes. See truth classes in [integrity-engine.md](./integrity-engine.md).

A Flag may eventually originate from any signal source (scan, support conversation, user feedback, session behavior, analytics, deployment/regression, another agent or system). Only scan-originated Flag sources ship today; each new source is a future Flag origin ([vision.md](./vision.md)).

## Surfaces

- **Basic (Launch Check):** Connect app → see understanding → correct Contract → Fix list → fix → re-check → PI improves.
- **Advanced:** Local runtime, MCP (`get_product_context`), repo connect, CI verify, drift over time.

Shipped surface today: [PRODUCT.md](../PRODUCT.md).
