STATUS: COMPLETE
ITERATION: 6 / 8

# Goal: 100% production reliability — planned capabilities live

## Done status
- [x] `npm run demo:audit:offline` — PASS (original=11, v1=0)
- [x] `npm run test:unit` — PASS (887 tests, 0 failures, 1 pre-existing skipped)
- [x] `npm run audit:capabilities` — 0 unmapped, 29 live / 1 partial (visual-polish) / 0 planned
- [x] `npm run typecheck` — only 2 pre-existing auth-env.test.ts errors (unrelated)
- [x] scripts/smoke-url-audit.ts — ran against saadbenryane.com: 0 false positives in watch set
- [x] Real-site regression: saadbenryane.com HTML parse: forms=0, no form false positive

## What was done

### Iteration 5: Form in demo fixtures (hardening)

**Problem:** `form-missing-validation` only tested via `healthyMeta()` mock in unit tests — never fired on actual fixture HTML. Flow probe `flow-form-no-validation` also had no real form to test against.

**Changes:**
- Added optional `form` field to `DemoFixture` type with fields, labels, types, and `required` flag
- Added form rendering to `render-fixture-html.ts` — renders `<form>` with `<input>`/`<select>` elements and `<label>`/`<button>` in the `#signup` section
- original.ts: 3 fields (name, email, plan) without `required` → triggers `form-missing-validation`
- v1.ts: same 3 fields with `required: true` on all → `formInputsMissingValidation = 0`

**Result:** Baseline went from 10→11 flags (added `form-missing-validation`), v1 stays at 0.

### Iteration 6: False-positive hardening

- Excluded `type="search"` from `formValidationSelectors` in metadata.ts (search fields don't need validation; flow probe already excludes them)
- Added `form select` to evidence selectors for both `form-missing-validation` and `flow-form-no-validation`

### Iteration 7: Motion a11y review

Reviewed `measureMotionA11y()` in capture-metrics.ts:
- Before/after measurement with 50% threshold: reasonable
- Proper `try/catch` for emulateMediaFeatures failures
- Restores to `no-preference` after measurement
- CSS computed styles read synchronously (no repaint delay needed)
- No changes required

### Real-site regression: saadbenryane.com

- `npm run smoke:url` via scripts/smoke-url-audit.ts: flow status=success, 0 false positives
- HTML parse: forms=0, `form-missing-validation` does not fire
- Full deterministic audit: only 2 legitimate flags (no-cta-detected, no-privacy-policy)
- All focus-area checks (form, motion, multi-step flow) correctly skip when N/A

## Critical review

- Every flag is defensible: correct CTA, evidence with counts/selectors, verification rule, trigger matrix entry
- `form-missing-validation` now fires on real fixture HTML (not just unit tests)
- v1 fixture demonstrates the fix: add `required` to mandatory fields
- `type="search"` exclusion prevents false positives on sites with search-only forms
- Evidence selectors now include `select` elements for proper screenshot highlighting
- Real-site smoke confirms no false positives for focus-area checks
- No new subsystems — minimal changes to existing types, renderer, and metadata parser
- Form detection is additive: adds to baseline count without breaking existing assertions (baseline 11, v1 0)

## Out of scope
- PageSpeed API checks in offline loop
- Commits unless asked
- `experience-visual-polish` — AI judge only; no deterministic token checks to add
- Running `demo:audit:flow` requires dev server (not available in this environment)
