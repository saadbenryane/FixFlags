# flag-language

objective: A page with no next step produces one customer Flag, without the word journey
outcome: Repeating the same missing action does not add another Flag. The dead-end sentence no longer says journey. The Site board shows one missing-action Flag.
surfaces: lib/audit/journey/run-template.ts, lib/audit/journey/run-journey-reviews.ts, customer-findings test
dependencies: local worker for the live walk. Does not edit marketing copy or Shopify files.
status: complete
agent: grok-goal-18c5ed77dbc7
timestamp: 2026-09-24T01:20:00Z
completed: 2026-09-24T01:30:00Z
verification: customer-findings.test.ts passed. A repeated missing-action finding is not stored again, and the saved sentence does not say journey. A missing action no longer also creates the dead-end Flag. Live signed-in check of https://example.org stored "No obvious primary CTA on first visit" once. The board shows that Flag once in the list, with no journey sentence. Screenshot flag-language-1280.png.
remaining: The same page can also say the primary action is slow to appear on a slow connection, which is a different check.
next: slow-cta-vs-missing-cta
