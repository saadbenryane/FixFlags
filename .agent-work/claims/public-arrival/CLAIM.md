# public-arrival

objective: Walk the signed-out arrival path and fix anything that blocks a stranger from understanding the product and starting
outcome: At phone and desktop width, the homepage states what FixFlags does, the start control is reachable, and the analytics choice does not cover it
surfaces: public `/` and the start control only if a walk shows a blocker outside other claims
dependencies: does not edit lib/marketing/copy, help, docs, nav, Shopify workspace, or pricing (stranger-shopify-ready). Does not edit Site settings connections (site-connections).
status: complete
agent: grok-goal-18c5ed77dbc7
timestamp: 2026-09-23T23:13:00Z
completed: 2026-09-23T23:20:00Z
verification: Signed-out `/` at 375 and 1280 returned 200. Headline "Your software runs. FixFlags watches." Analyze and the URL field sit below the analytics choice and do not intersect it. Phone menu lists Product, Pricing, Integrations, Docs, and Sign in. Empty submit says "Enter a URL like https://yoursite.com". Analyze of https://example.com returned 201 and opened `/sites/p_cmuenwglk000igukcw98426n8` with heading "Your board" and a learning state. No product code change. Worker was not running, so this did not produce a Flag.
remaining: Phone Site Agent button still covers Flag rows for a signed-in customer. A live first Flag still needs the worker.
next: phone-agent-button
