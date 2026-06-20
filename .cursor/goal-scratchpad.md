STATUS: DONE (local foundation)
ITERATION: 3 / 8

# Goal: Demo v1 fork clears in-scope deterministic flags locally

## Done when (local-first)
- [x] `npm run demo:audit:offline` → v1 in-scope flags = 0
- [x] `npm run demo:audit` (localhost) → v1 in-scope flags = 0
- [x] Original `/demo` still ≥ 8 intentional flaws
- [x] `npm run test:unit` passes

## Out of scope (production smoke only)
- Full production audit: `npm run demo:audit:production`

## Baseline (first run)
- original: 10 production / 9 offline scoped
- v1: 5 production / 1 offline (no-https before scope)

## Final (iteration 3)
- offline: original 9, v1 **0**
- live localhost: original 9, v1 **0**
- scoped via `lib/demo/demo-audit-scope.ts`
