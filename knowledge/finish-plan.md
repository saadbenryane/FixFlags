# Finish Plan

**Canonical home for the Finish Plan product artifact.** Vision: [vision.md](./vision.md). Ranking implementation: `lib/audit/priority-flags.ts`.

## Definition

At any moment, FixFlags should answer: **What should we improve next?**

The Finish Plan is prioritized, scoped, evidence-backed, contextual, actionable, verifiable, and continuously updated. It is not a generic backlog.

## Relationship to shipped UI

| Concept | Role |
|---------|------|
| **Finish Plan** | Primary Improve artifact (≤3 highest-leverage items) |
| Flag list | Full inventory for exploration |
| `buildPlanModePrompt` | Agent export of the Finish Plan (plan-before-edit) |
| Product Contract / PI | Context that biases ranking and journey selection |

Basic users should feel: **Let’s finish your app.** Advanced users and agents get evidence, dependencies, verification, and implementation context inside fix prompts / MCP.

## Quality bar

- Few items (default top 3), not dozens
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
- Not “find every issue”
- Not an autonomous executive that makes irreversible business decisions

## Analytics (thesis)

Instrument: finish plan view/copy, contract edit, recheck verified learning. See [execution.md](./execution.md).
