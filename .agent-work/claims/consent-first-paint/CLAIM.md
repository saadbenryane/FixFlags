# consent-first-paint

## Strategic objective

**Outcome:** The first screen and Back to board stay readable while the analytics choice is open, including before client JavaScript runs.

**Why now:** The choice is position fixed. Clearance is applied only after hydration, and the Flag page client bundle did not run, so the headline and Back to board sit under the dialog.

**Customer impact:** A signed-out visitor can read the headline and use Back to board without dismissing the choice first.

**Scope:** Server-rendered page offset when no consent cookie is set, shared with the existing client measurement.

**Out of scope:** Nav, marketing copy, Shopify, the summary sentence, and Flag row wording.

objective: The analytics choice does not cover the first screen or Back to board
outcome: The document reserves the choice height before JavaScript. The headline and Back to board do not intersect the dialog.
surfaces: lib/analytics/consent.ts, app/layout.tsx, components/analytics/ConversionScripts.tsx, consent tests
dependencies: Does not edit lib/site/nav.ts or SiteBoard. stranger-shopify-ready owns nav and marketing copy.
status: complete
agent: grok-goal-01a0d506
timestamp: 2026-09-24T21:05:45Z
completed: 2026-09-24T21:08:00Z
verification: consent-padding and ConversionScripts tests passed. Signed-out homepage had 192px reserved immediately and the headline did not intersect the choice. Flag page returned 200, Back to board did not intersect the choice, and the click returned to the Site.
remaining: The Flag page client chunk can still 404 in dev, so hydration may not run. The reserved offset covers that. Paid checkout, the production canary, and the nav claim stay closed.
next: Do not remove the server-rendered offset. The MCP footer remains claimed in lib/site/nav.ts.
