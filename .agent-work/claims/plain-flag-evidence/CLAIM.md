# plain-flag-evidence

## Strategic objective

**Outcome:** A page with no next step is described in plain language. The Flag does not add internal walk notes.

**Why now:** The public MCP footer is still claimed. The first-check Flag evidence still appends "same-origin" and "Journey reached".

**Customer impact:** The Flag says the page has no link to another page on the same site, without operator language.

**Scope:** Customer evidence helpers in `lib/audit/journey/run-template.ts` and a test that calls them.

**Out of scope:** Marketing copy, `lib/site/nav.ts`, Shopify, connections, checkout execution, and the accuracy corpus.

objective: First-check Flags do not include internal walk notes
outcome: A page with no next step uses one customer sentence. A long path does not say Journey.
surfaces: lib/audit/journey/run-template.ts and lib/audit/journey/__tests__/customer-evidence.test.ts
dependencies: nav.ts stays with stranger-shopify-ready. Does not edit marketing copy, homepage, Shopify, connections, or the accuracy corpus. run-template.ts already has uncommitted flag-language edits; this only changes customer evidence strings.
status: complete
agent: grok-goal-01a0d504
timestamp: 2026-09-24T20:29:00Z
completed: 2026-09-24T20:31:00Z
verification: customer-evidence.test.ts and customer-findings.test.ts passed. The shipped helpers print the same customer sentences on two runs. lib/site/nav.ts stays claimed, so the MCP footer link was not removed.
remaining: Public footer still links to MCP for agents. Analytics choice still says product journeys. Paid checkout and the exact-SHA canary stay open.
next: Remove the public MCP footer link when stranger-shopify-ready releases lib/site/nav.ts.
