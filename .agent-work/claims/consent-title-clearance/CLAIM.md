# consent-title-clearance

objective: Keep the Outcome title readable while the analytics choice is open
outcome: On a wide board the choice sits at the top and the page starts below its bottom edge, so the Outcome title is not covered
surfaces: components/analytics/ConversionScripts.tsx and its test
dependencies: does not edit marketing copy or Shopify files
status: complete
agent: grok-goal-18c5ed77dbc7
timestamp: 2026-09-24T01:05:00Z
completed: 2026-09-24T01:12:00Z
verification: ConversionScripts test passed. A dialog bottom of 280px reserves 296px. At 1280 on the example.net board, the choice ended at 192px and the Outcome title "This page loads" started at 357px. Screenshot consent-clearance-1280.png.
remaining: First-check Flags still say "journey" and repeat the same missing-CTA finding.
next: flag-language
