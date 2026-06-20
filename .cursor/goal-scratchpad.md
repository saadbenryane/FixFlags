STATUS: PARTIAL (deploy required for production check)
ITERATION: 2 / 8

# Goal: Demo v1 fork clears all deterministic flags (zero on /demo/v1)

## Done when
- [ ] `tsx scripts/demo-fixture-audit.ts https://fixflags.com` → v1 flags = 0 (blocked: not deployed)
- [x] Original `/demo` still ≥ 8 intentional flaws (production: 10)
- [x] `npm run test:unit` passes (803 tests)

## Baseline (production, pre-fix)
- original: 10 flags
- v1: 5 flags (broken-internal-links, canonical-missing, cookie-consent-absent, no-structured-data, robots-blocks-indexing)

## After iteration 2
- offline `--offline`: original 9, v1 **0**
- localhost live: original 10, v1 **1** (no-https only — expected on http://)
- production live: original 10, v1 **5** (old deploy)

## Iteration 1
- Remove demo layout noindex override
- v1 fixture: cookie banner, canonical, jsonLd, contact #signup

## Iteration 2
- Cookie banner UI in DemoLanding + CSS
- Offline fixture audit pipeline (`render-fixture-html`, `audit-fixture-offline`, `--offline` flag)
- Localhost audit path (`audit-demo-local.ts`)
- Regression test `lib/demo/__tests__/v1-fixture-audit.test.ts`
