# teaser-journey

objective: A stranger's first check walks the page, so Conversion coverage on that Site comes from the walk
outcome: Anonymous teaser scans run the deferred flow walk. Slow 3G replay stays off. Conversion is not left unchecked merely because the walk was skipped.
surfaces: lib/audit/pipeline/run-page.ts, lib/audit/pipeline/mode.ts, the run-page production-path test
dependencies: local worker and the Site board. Does not edit marketing copy or Shopify files.
status: complete
agent: grok-goal-18c5ed77dbc7
timestamp: 2026-09-24T00:08:00Z
completed: 2026-09-24T00:18:00Z
verification: run-page production-path test shows an anonymous teaser calls runFlowScan, records flowScan, and does not log flow_skipped_teaser. Slow replay stays skipped. Live anonymous check of https://example.org logged flow_deferred, flow_started_deferred, flow_completed_deferred. evidenceCoverage.flowScan is true. The Site board shows Conversion Looking good beside the Search Flag. Screenshot teaser-journey-1280.png.
remaining: The first Site still has no confirmed Outcome on the board. AI triage still needs a provider key.
next: first-site-outcome
decision: The teaser used to skip the walk to save 30-60s. That left Conversion with no journey evidence on the Site a stranger just created. The walk is the check Conversion is allowed to trust. Slow replay stays skipped.
