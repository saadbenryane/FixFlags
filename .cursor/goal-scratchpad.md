STATUS: COMPLETE
ITERATION: 4 / 8

# Goal: 100% production reliability — planned capabilities live

## Done status
- [x] `npm run demo:audit:offline` — PASS (original=10, v1=0)
- [x] `npm run test:unit` — PASS (888 tests, 0 failures, 1 pre-existing skipped)
- [x] `npm run audit:capabilities` — 0 unmapped, 29 live / 1 partial (visual-polish) / 0 planned
- [x] `npm run typecheck` — only 2 pre-existing auth-env.test.ts errors (unrelated)
- [x] `scripts/smoke-url-audit.ts` — includes `flow-form-no-validation` in watch set

## What was done

### Iteration 4: `experience-form-feedback` (planned → live)

**New check: `form-missing-validation`** (html-parse)
- Added `formInputsMissingValidation` to `PageMetadata` — counts form input/textarea/select elements without `required`, `aria-required`, or `pattern` attributes
- Check fires when `forms > 0 && formInputsMissingValidation > 0`
- Evidence: count of forms + fields missing validation attributes
- Fix: "Add required or aria-required to mandatory fields"
- Trigger matrix: verified with `healthyMeta({ forms: 1, formInputsMissingValidation: 2 })`
- Verification rule: "Inspect form fields; required/aria-required/pattern attributes should be present"
- Capability: `experience-form-feedback` moved from planned → live

**Pre-existing: `flow-form-no-validation`** (flow-navigation)
- Flow probe already implemented in `flow/form-probes.ts` — submits empty form and checks for inline validation feedback
- Already integrated into `runMultiStepProbes` in nav-probes.ts
- Already registered in check-ids.ts, checks/flow.ts, verification-rules, tests, evidence-selectors, flag-copy
- Was missing from capability matrix — now added

### Previously done (iteration 3): `experience-multi-step-flow`
- `flow-pricing-nav-broken` — nav probes in nav-probes.ts
- `flow-mobile-menu-broken` — mobile viewport probe + toggle
- All: check IDs, triggers, verifications, capability mapping

## Final capability matrix
- **78 deterministic checks** registered
- All 78 mapped to capabilities (0 unmapped)
- **29 live**, 1 partial (visual-polish — AI judge only, out of scope)
- **0 planned** capabilities remaining

## Critical review
- Every flag is defensible: correct CTA, evidence with counts/selectors, verification rule, trigger matrix entry
- No false positives on demo fixtures (form check only fires when forms exist)
- Multi-step flow has same probe pattern as form validation
- No new subsystems — added metadata field + check to existing content.ts module
- `flow-form-no-validation` form probe already existed; just needed capability mapping
- Smoke script at `scripts/smoke-url-audit.ts` already watches flow-form-no-validation for saadbenryane.com

## Out of scope
- PageSpeed API checks in offline loop
- Commits unless asked
- `experience-visual-polish` — AI judge only; no deterministic token checks to add
- Running `demo:audit:flow` requires dev server (not available in this environment)
