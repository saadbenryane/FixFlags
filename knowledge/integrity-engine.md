# Integrity Engine

**Canonical home for FixFlags’ general evaluation system.** Vision: [vision.md](./vision.md). Customer memory: [product-intelligence.md](./product-intelligence.md).

## Definition

The Integrity Engine is FixFlags’ general reasoning and evaluation system. It knows how to understand, evaluate, and improve products in general. It learns recurring patterns across many products without memorizing or exposing proprietary customer products.

**Separation:** Product Intelligence belongs to the customer. The Integrity Engine belongs to FixFlags.

## Five integrity dimensions

| Dimension | Question | Near-term coverage |
|-----------|----------|-------------------|
| **Product Integrity** | Does it deliver the value it claims? | Purpose/positioning checks, journey outcomes, Product Contract alignment |
| **Experience Integrity** | Can users understand and use it? | Experience rubric, journeys, flow, a11y, conversion friction |
| **Design Integrity** | Does it feel like one intentional system? | Visual/layout/design-system checks (expand over time) |
| **Implementation Integrity** | Can it evolve without fragility? | Agency repo scan, performance, reliability signals |
| **Agent Integrity** | Do builders share coherent project context? | Future: AGENTS.md / instruction drift (not shipped) |

## User-facing rubrics (shipped)

Reports, scoring, MCP, and marketing use **three rubrics only**:

- **Message** — clarity, audience, CTA, proof
- **Experience** — usability, a11y, performance, interactions
- **Reach** — SEO, previews, trust links, analytics

**Decision:** Do not migrate UI to five dimensions until Product Intelligence + Finish Plan thesis is validated. Dimensions guide check design and prioritization; rubrics remain the customer mental model. Recorded in [DECISIONS.md](../DECISIONS.md).

### Mapping (approximate)

| Dimension | Primary rubric(s) / channels |
|-----------|------------------------------|
| Product | Message + Contract + journey claims |
| Experience | Experience |
| Design | Experience (subset of checks) + future design pass |
| Implementation | Repo scan + performance / reliability checks |
| Agent | Not in report rubrics yet |

## What the engine learns (direction)

Common AI-built failures, missing states/journeys, weak onboarding, design inconsistency, architectural drift, duplicated logic, broken terminology, poor agent instructions, weak remediation, regressions, release-risk signals, recommendations that produce verified improvements.

Learning must use anonymous, aggregated, or abstracted patterns. See [privacy.md](./privacy.md).

## Implementation today

| Piece | Path |
|-------|------|
| Check modules | `lib/audit/checks/` (barrel `index.ts`) |
| Check IDs | `lib/audit/check-ids.ts` |
| Pipeline | `docs/audit-pipeline.md` |
| Triage / prescription | `lib/prompts/system-prompt.ts`, judge config |
| Truth labels | `lib/report/explorer-model.ts` (`Reproduced` / `Detected` / `Observed`) |
| Prioritization | `lib/audit/priority-flags.ts` |
| Cross-tenant rollups | `lib/graph/` (growth, not customer PI) |

The browser scanner is one **observer** inside the engine, not the whole product.

## Truth classes

| Class | Meaning |
|-------|---------|
| Reproduced | FixFlags directly encountered the failure |
| Detected | Objective rule failed |
| Observed | Product-quality concern identified |
| Likely cause | Inferred implementation explanation (use sparingly) |
| Repository confirmed | Validated against code (repo scan path) |

Severity = consequence. Certainty = evidence. Keep them separate.

## Security signal discipline

URL-only analysis cannot prove an app is secure. Detect visible secrets, insecure browser behavior, missing headers, obvious auth failures. Never say "Your app is secure."

## Proprietary vs open

Keep proprietary: advanced reasoning, benchmarks, ranking, cross-product patterns, orchestration. Open later: basic checks, protocol, local runtime. See [open-source.md](./open-source.md).
