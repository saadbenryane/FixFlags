STATUS: IN_PROGRESS
ITERATION: 1 / 8

# Goal: Demo v1 fork clears all deterministic flags (zero on /demo/v1)

## Done when
- [ ] `tsx scripts/demo-fixture-audit.ts https://fixflags.com` → v1 flags = 0
- [ ] Original `/demo` still ≥ 8 intentional flaws (regression guard)
- [ ] `npm run test:unit` passes

## Baseline (production, pre-fix)
- original: 10 flags
- v1: 5 flags (broken-internal-links, canonical-missing, cookie-consent-absent, no-structured-data, robots-blocks-indexing)

## Iteration 1
- Remove demo layout noindex override
- v1: cookie banner, canonical, jsonLd in head, contact #signup only
- Allow localhost in audit script for pre-deploy verify
