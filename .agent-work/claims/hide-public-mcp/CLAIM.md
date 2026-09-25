# hide-public-mcp

## Strategic objective

**Outcome:** A signed-out visitor does not see MCP offered as the product.

**Why now:** The footer said "MCP for agents" while MCP is not a proven public product. The old nav claim was not on the active board.

**Customer impact:** The homepage footer no longer links to MCP.

**Scope:** The footer resources list and the test that required that link.

**Out of scope:** Deleting /docs/mcp, Shopify files, and checkout.

objective: The public footer does not offer MCP
outcome: Homepage text does not include "MCP for agents"
surfaces: lib/site/nav.ts, lib/__tests__/public-product-scope.test.ts
dependencies: stranger-shopify-ready listed nav.ts but was stale. Handoff is in that claim.
status: in_progress
agent: grok-goal-01a0d504
timestamp: 2026-09-24T21:06:00Z
