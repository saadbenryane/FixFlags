# arrival-first-flag

objective: A stranger's first Site does not show a missing-action Flag beside a slow-action Flag for the same page
outcome: Stored Flags already on a Site drop the slow-action Flag when a missing-action Flag is present. The public arrival path still reaches a first Flag.
surfaces: customer Flag projection in lib/sites/flags.ts and its test. A live board walk.
dependencies: does not edit lib/marketing/copy or Shopify files claimed by stranger-shopify-ready
status: complete
agent: grok-goal-18c5ed77dbc7
timestamp: 2026-09-24T02:00:00Z
completed: 2026-09-24T02:20:00Z
verification: customer-flags.test.ts passed. The shipped Site load drops slow-3g-cta-delayed when the same page has a hidden-cta Flag, and keeps the slow Flag when no action is missing. Stored example.org board now lists 2 Flags, the missing action and the meta description, with the slow-action Flag hidden. A new account from the homepage of https://example.edu returned to that Site: No Outcome yet, Watch this page, and one Flag, Meta description is missing. Screenshots stored-cta-1280.png and arrival-first-flag-375.png.
remaining: The analytics choice copy still says product journeys, and that file is owned by stranger-shopify-ready. Not a production canary.
next: homepage-journey-word
decision: A re-check is not required for the board to stop contradicting itself. Absence of an action and slowness of an action are not both shown.
