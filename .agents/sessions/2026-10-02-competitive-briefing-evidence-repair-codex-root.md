# Competitive briefing evidence repair

- **Task:** `competitive-briefing-evidence-repair-2026-10-02`
- **Owner:** `codex-root`
- **Branch:** `main`
- **Status:** locally verified; no public copy or product behavior changed
- **Evidence date:** 2026-10-02

## Outcome

The new competitive and conversion briefing is no longer allowed to drive work from a false universal MCP
claim or an untraceable funnel. It now distinguishes verified facts, working notes, hypotheses and open product
gates.

## Material corrections

- Withdrew the claim that none of eight synthetic-monitoring vendors has an MCP verification surface. Checkly
  can trigger deployed checks through MCP; Datadog exposes Synthetics MCP tools.
- Narrowed the possible FixFlags differentiator to the combination of Outcome responsibility, independent
  verdict authority, and durable recovery/recurrence. Its uniqueness remains an open scenario test.
- Marked MCP as locally implemented, intentionally undiscoverable and not exact-client or production proven.
- Removed the unsupported 82% abandonment diagnosis and the 17-start/3-completion "current" baseline. The last
  committed GA4/GSC artifacts are dated 2026-09-08 and cannot produce an attributable unique-run funnel.
- Corrected the analytics registry from 52 entirely report-era events to 49 legacy-weighted events with newer
  Shopify, waitlist and Help coverage but no complete Site/Outcome/Flag/Verify loop.
- Corrected the Shopify Uptime comparison: USD 29 is the entry tier; automated UI tests are listed on USD 99 Pro.
- Replaced the broad multi-surface redesign handoff with measurement, one pre-registered experiment, and proof
  prerequisites. The MCP landing page remains blocked on product and comparison evidence.

## Sources checked

Primary sources and limitations are recorded in Part 8 of
`docs/growth/competitive-and-conversion-briefing.md`. The decisive counterexamples were Checkly's June 2026 MCP
release and Datadog's current MCP Synthetics documentation. Local product truth came from `PRODUCT.md`,
`ROADMAP.md`, `docs/voice-and-copy.md`, `lib/analytics/events.ts`, and the committed growth metric artifacts.

## Verification

- `npm run agent -- eval growth` passed. Receipt:
  `.agent-runs/2026-10-02T15-33-05-846Z-eval-growth.log`.
- `npm run seo:guard` passed.
- `npm run metadata:route-guard` passed for 23 indexable routes.
- `npm run skills:validate` passed.
- `npm run knowledge:duplication-guard` passed after removing an unsourced external price ladder and formatting
  external competitor prices as USD so they cannot be confused with FixFlags' canonical plan pricing.
- Prettier passed for the repaired briefing, skill, learning and session record.
- All seven relative links in the briefing resolve locally.
- `npm run agent -- verify` passed all 30 commands, including database validation and drift, nonincremental
  TypeScript, lint, guards, tests, optimized build and container verification. Receipt:
  `.agent-runs/2026-10-02T15-38-56-071Z-container-build.log`.

## Release and customer evidence

Documentation-only, local. No marketing copy, route, deployment, ranking or customer conversion result is
claimed.
