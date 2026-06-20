STATUS: IN_PROGRESS
ITERATION: 1 / 8

# Goal: Organized audit system that covers copy, flow, loading, and design — verifiable locally

## Done when (all must pass)
- [ ] `npm run audit:capabilities` lists live matrix with 0 unmapped checks
- [ ] `npm run demo:audit` → v1 in-scope flags = 0
- [ ] `npm run demo:audit:flow` → v1 flow flags = 0
- [ ] `npm run test:unit` passes

## Out of scope (this iteration)
- Production smoke (`demo:audit:production`)
- Full design-token deterministic checks (planned in matrix)
- Multi-step flow (pricing nav, form submit)

## Baseline
- 59 deterministic checks, no capability taxonomy
- No loading-state check, no heading hierarchy check
- Flow audit not in local loop

## Iteration 1 (this session)
- `lib/audit/capability-matrix.ts` + `npm run audit:capabilities`
- New checks: `heading-hierarchy-missing`, `loading-indicator-stuck`
- `npm run demo:audit:flow` for CTA navigation on localhost
- Demo signup anchor for hash CTA flow success
