# Fix List and Finish Plan

**Canonical home for the complete Fix List and bounded Finish Plan.** Vision: [vision.md](./vision.md). Ranking implementation: `lib/audit/finish-plan.ts`. Evidence rules: [evidence-rules.md](./evidence-rules.md).

## Definition

At any moment, FixFlags should answer: **What should we improve next?**

The Fix List contains every unresolved Flag. It is prioritized, scoped, evidence-backed, contextual, actionable, verifiable, and continuously updated.

## Relationship to shipped UI

| Concept | Role |
|---------|------|
| **Fix List** | Primary Improve artifact containing every ranked unresolved Flag |
| **Finish Plan** | Highest-leverage one to three items derived from the same ranked Fix List |
| All fix prompts | Separate authenticated export containing every eligible prompt; never labelled as a Finish Plan |
| Product Contract / PI | Context that biases ranking and journey selection |

Basic users should feel: **Let's finish your app.** Advanced users and agents get evidence, dependencies, verification, and implementation context inside fix prompts / MCP.

## Report header

The report header leads with outcomes, not a score:

> Fix these before you share it
> 1 blocker found in the paths we tested
> Checked: 14 routes, 51 links and actions, Desktop and mobile, 3 important journeys

## Flag order

1. **Confirmed blockers** — Failures that prevent a defined goal
2. **Observed friction** — The task completed, but an observable problem increased effort or uncertainty
3. **Suggestions** — Heuristic improvements that may strengthen clarity or polish

## Flag anatomy

Every Flag contains:
- **What happened** — A factual description
- **Evidence** — Replay, screenshot, request, error or page state
- **Why it matters** — The goal or system requirement affected
- **Confidence** — Confirmed, observed or suggested
- **Fix** — The smallest useful change
- **Scope** — What should remain unchanged
- **Verify** — The exact condition FixFlags will test again

Full anatomy and examples: [evidence-rules.md](./evidence-rules.md).

## Quality bar

- Every persisted unresolved Flag is present exactly once
- Finish Plan contains one to three of the highest-ranked Fix List items
- Ranking makes the next action clear without hiding lower-priority work
- Tied to Product identity (Contract / PI) when available
- Each item has problem, impact, fix path, verify path
- Updated after re-check (cleared items leave verified learnings)

## Ranking inputs (near-term)

1. Severity / consequence
2. `impactTag` (revenue, conversion, trust, …)
3. Confidence / truth class
4. Corridor / journey relevance
5. **Product Contract / PI alignment** (boost Flags that block purpose or first-value journey)

## Non-goals

- Not a project-management backlog
- Not passed checks, informational diagnostics, or speculative defects
- Not an autonomous executive that makes irreversible business decisions

## Analytics (thesis)

Instrument: Fix list view/copy, contract edit, recheck verified learning. See [execution.md](./execution.md).
