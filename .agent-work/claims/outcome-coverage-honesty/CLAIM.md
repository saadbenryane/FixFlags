# outcome-coverage-honesty

objective: A health card cannot say Looking good unless its required check actually ran
outcome: Conversion stays unchecked without a journey. Performance stays unchecked without a PageSpeed run. A messaging or experience score cannot paint either card healthy.
surfaces: lib/sites/coverage.ts and lib/sites/__tests__/card-areas.test.ts
dependencies: does not edit marketing copy, Shopify, or the checkout execution path
status: complete
agent: grok-goal-18c5ed77dbc7
timestamp: 2026-09-23T23:58:00Z
completed: 2026-09-24T00:05:00Z
verification: card-areas.test.ts 13 passed, including a messaging score of 92 and an experience score of 99 with no journey and no PageSpeed. Those cards stay "Not checked yet". A flowScan marks Conversion "Looking good". Signed-in example.com board shows Conversion and Performance as Not checked yet, and the Search Flag remains. Screenshot coverage-honesty-1280.png.
remaining: Anonymous teaser scans log flow_skipped_teaser, so a stranger's first check does not walk a purchase path.
next: teaser-journey
