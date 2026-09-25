# flag-prompt-outcome

## Strategic objective

**Outcome:** The prompt a customer copies from a Flag names the Outcome, not a Journey.

**Why now:** `lib/site/nav.ts` is still claimed, so the public MCP link stays. The next action on a Flag still says Journey.

**Customer impact:** Send a Flag to your AI includes "Outcome:" when a result is attached.

**Scope:** `boardFlagPrompt` in `lib/sites/board-card.ts` and its test.

**Out of scope:** Nav, marketing copy, checkout execution, and the accuracy corpus.

objective: The copied Flag prompt uses Outcome
outcome: A named result is labeled Outcome, and the prompt does not say Journey
surfaces: lib/sites/board-card.ts, lib/sites/__tests__/board-card.test.ts
dependencies: Does not edit lib/site/nav.ts or marketing copy. The flag page already passes the outcome name into this prompt.
status: complete
agent: grok-goal-01a0d504
timestamp: 2026-09-24T20:35:36Z
completed: 2026-09-24T20:45:00Z
verification: board-card.test.ts passed. The copied prompt says Outcome, not Journey. A signed-out visitor analyzed a URL, saw Check failed with the unreachable reason at 375 and 1280, twice, and Retry returned 200 with "Check started again".
remaining: Paid checkout stays closed. Exact-SHA production canary was not run. The footer still links to MCP for agents because lib/site/nav.ts is claimed.
next: Remove that footer link when the nav claim is released.
