STATUS: IN_PROGRESS (iteration 3)
ITERATION: 3 / 8

# Goal: 100% production reliability — planned capabilities live

## Done when (all must pass)
- [ ] `npm run demo:audit:offline` — v1=0, original≥8
- [ ] `npm run demo:audit:flow` — v1 flow=0, baseline catches new multi-step flags
- [ ] `npm run test:unit` — all pass, trigger matrix green for new checkIds
- [ ] `npm run audit:capabilities` — 0 unmapped; multi-step + motion + form planned→live
- [ ] saadbenryane.com audit — no false positives on new checks

## Baseline (iteration 3 start)
| Check | Result |
|-------|--------|
| demo:audit:offline | PASS — v1=0, original=10 |
| demo:audit:flow | BLOCKED — dev server down |
| test:unit | FAIL — 3 em-dash lint failures |
| Planned capabilities | 3 (multi-step, form-feedback, motion-a11y) |

## Out of scope
- PageSpeed API checks in offline loop
- Commits unless asked

## Iteration 3 plan
**Capability:** multi-step flow (pricing nav + mobile menu probes)
- Add `flow-pricing-nav-broken`, `flow-mobile-menu-broken`
- Fix `selector` TDZ bug in run-flow-scan.ts
- Fix em-dash unit test blockers
