# analytics-choice-words

## Strategic objective

**Outcome:** The first-visit analytics choice explains itself without the words "product journeys."

**Why now:** That sentence is the first thing a signed-out visitor reads, and it uses internal language.

**Customer impact:** The choice says FixFlags uses optional analytics to see how people use FixFlags.

**Scope:** `ANALYTICS_CONSENT_COPY.body` and the consent dialog test that renders it.

**Out of scope:** The MCP footer in `lib/site/nav.ts`, paid checkout, the production canary, and the rest of marketing copy.

objective: The analytics choice does not say product journeys
outcome: The dialog body says FixFlags uses optional analytics to see how people use FixFlags
surfaces: lib/marketing/copy/legal.ts (ANALYTICS_CONSENT_COPY.body only), components/analytics/__tests__/ConversionScripts.test.tsx
dependencies: Does not edit lib/site/nav.ts. stranger-shopify-ready lists marketing copy broadly; this edit is only the consent sentence the visitor sees first.
status: complete
agent: grok-goal-01a0d504
timestamp: 2026-09-24T20:32:13Z
completed: 2026-09-24T20:36:00Z
verification: ConversionScripts test passed. Signed-out / at 375 and 1280, twice, showed the new sentence and not "product journeys". The headline and Analyze stayed clear of the choice. Headline started below the dialog at both widths.
remaining: Paid checkout stays closed. Exact-SHA production canary was not run. The footer still links to MCP for agents because lib/site/nav.ts is claimed.
next: Remove that footer link when the nav claim is released.
