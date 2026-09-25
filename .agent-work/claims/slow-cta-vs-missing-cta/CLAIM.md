# slow-cta-vs-missing-cta

objective: Do not say a primary action was slow when no primary action appeared
outcome: A CTA that shows up after 8 seconds on a slow connection stays a Flag. A CTA that never appears is left to the missing-action Flag.
surfaces: lib/audit/checks/slow-replay.ts and a unit test
dependencies: does not edit marketing copy or Shopify files
status: complete
agent: grok-goal-18c5ed77dbc7
timestamp: 2026-09-24T01:45:00Z
completed: 2026-09-24T01:50:00Z
verification: runSlowReplayChecks flags a CTA seen at 9s and does not flag the 30s never-appeared sentinel. Existing slow-3g cases in checks.test.ts still pass. A stored example.org Flag from before this change is unchanged until the next check.
remaining: Not a production canary. Paid checkout stays closed.
next: first-run-on-a-real-store
