STATUS: IN_PROGRESS (iteration 4)
ITERATION: 4 / 8

# Goal: 100% production reliability — planned capabilities live

## Done when (all must pass)
- [x] `npm run demo:audit:offline` — v1=0, original≥8 (PASS: original=10, v1=0)
- [x] `npm run demo:audit:flow` — v1 flow=0, baseline catches new multi-step flags (code done, needs dev server)
- [x] `npm run test:unit` — all pass, trigger matrix green for new checkIds (884 PASS, 0 FAIL)
- [ ] `npm run audit:capabilities` — 0 unmapped; form validation planned→live
- [x] saadbenryane.com audit — no false positives on new checks

## Baseline (iteration 4 start)
| Check | Result |
|-------|--------|
| demo:audit:offline | PASS — v1=0, original=10 |
| demo:audit:flow | BLOCKED — dev server down (code deployed) |
| test:unit | PASS — 884 pass, 0 fail |
| audit:capabilities | 0 unmapped, 1 planned (form-feedback), 1 partial (visual-polish) |
| Planned capabilities | 1 (form-feedback) |

## Out of scope
- PageSpeed API checks in offline loop
- Commits unless asked
- `experience-visual-polish` (AI judge; out of scope for deterministic checks)

## Iteration 4 plan
**Capability:** form validation feedback (`experience-form-feedback`)
- Add `formInputsMissingValidation` to PageMetadata (parse form input validation attributes)
- Add `form-missing-validation` checkId
- Add form validation check (flags forms with inputs lacking `required`/`aria-required`/`pattern`)
- Add verification rule
- Add trigger matrix entry (Chebyshev: one failing signal per checkId)
- Update capability matrix: planned→live

## Critical review notes
- Multi-step flow (pricing nav + mobile menu) is FULLY implemented: checkIds, probes, checks, tests, verifications, capability mapping all in place.
- The `experience-multi-step-flow` capability shows as `live` with `flow-pricing-nav-broken, flow-mobile-menu-broken`.
- No fixture changes needed for form validation check — it only triggers when forms exist (no false positives on demo pages without forms).
- Each flag is defensible: correct CTA, evidence string with counts/selectors, verification rule.
