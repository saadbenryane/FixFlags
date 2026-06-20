STATUS: IN PROGRESS (prior "COMPLETE" was premature — see critical review)
ITERATION: 8 / 8

# Goal: 100% production reliability — planned capabilities live

## Verified status (this iteration — independently re-verified, not trusted from prior scratchpad)

- [x] `npm run demo:audit:offline` — PASS (baseline=11, v1=0)
- [x] `npm run demo:audit` (rendered, dev server) — PASS (baseline=12, v1=0) ← prior scratchpad never ran this
- [x] `npm run demo:audit:flow` — PASS (baseline=1 `flow-pricing-nav-broken`, v1=0) ← prior scratchpad dismissed as "out of scope"
- [x] `npm run test:unit` — PASS (888 tests, 0 failures, 0 skipped — was 887/1 skipped before screenshot fix)
- [x] `npm run audit:capabilities` — 0 unmapped, 30 live / 1 partial (visual-polish) / 0 planned
- [x] Real-site regression: saadbenryane.com — 0 false positives in watch set (re-confirmed this iteration)

## What was actually wrong (critical review of prior "COMPLETE")

### Defect 1: Flow-step screenshots threw in CLI scripts (evidence gap)
**Problem:** `getAppBaseUrl()` in `lib/storage/screenshots.ts` threw when `NEXT_PUBLIC_APP_URL` was unset. CLI scripts (`tsx scripts/...`) don't load `.env.local`, so every `demo:audit:flow` and `smoke:url` run logged `Error: NEXT_PUBLIC_APP_URL ... is required` 4× per scan. Screenshots were written to disk but the URL was never returned, so flow flags had `screenshotUrl: null` — failing the "evidence with highlight" bar.

**Fix:** `getAppBaseUrl()` now falls back to `http://localhost:3000` when `NODE_ENV !== 'production'` and env is unset. Production still throws (R2 is required there). One-file, ~6-line change.

**Result:** Flow scan output is clean. Flow flags now carry real screenshot URLs. The previously-skipped unit test for screenshot storage now passes (it was skipped because of this exact env issue).

### Defect 2: Form never rendered on the live dev server (parity gap)
**Problem:** `components/demo/DemoLanding.tsx` rendered `<section id="signup" aria-hidden="true" />` — an empty anchor. The `fixture.form` field (added in iteration 5) was only consumed by `lib/demo/render-fixture-html.ts` (offline HTML), NOT by the React component used by the dev server. Consequences:
- `form-missing-validation` only fired in offline mode, never on the rendered page
- `flow-form-no-validation` probe always returned `skipped` (no form to probe) on dev server
- The prior scratchpad's claim "form-missing-validation now fires on real fixture HTML" was only true for offline HTML

**Fix:** Added form rendering to `DemoLanding.tsx` matching `renderFixtureHtml`: `<form>` with `<input>`/`<select>`/`<label>`/`<button type="submit">` in the `#signup` section. `required` attr driven by `field.required`.

**Result:** Rendered audit now shows `form-missing-validation` on baseline (12 flags, was 11). v1 stays at 0. `flow-form-no-validation` probe now has a real form to evaluate on the dev server (though it still skips on baseline because baseline fields lack `required` — see critical note below).

### Defect 3 (not fixed — documented as correct behavior): Mobile menu probe never fires on fixture
**Problem:** `flow-mobile-menu-broken` is `live` in the capability matrix but never fires on the demo fixture. The fixture has no hamburger/menu toggle — nav links are always visible (CSS wraps them on mobile). So `probeMobileMenu` always returns `skipped` because `before.visible > 0`.

**Why this is correct, not a bug:** There is genuinely no broken mobile menu to flag on the fixture. Inventing a broken hamburger just to exercise the probe would be artificial flaw injection, not a real regression case.

**Coverage that does exist:** Flag emission is unit-tested in `lib/audit/__tests__/nav-probes.test.ts` (mocked `multiStep: { mobileMenu: 'broken' }` → `flow-mobile-menu-broken` flag). The probe *logic* (DOM evaluation, toggle detection, visibility recheck) has no integration test — this is a real coverage gap but building a Puppeteer Page mock is a new test subsystem, out of scope for this iteration per "prefer minimal fixes over new subsystems".

**Follow-up:** Add a probe-level integration test (mock Page against fixture HTML) for `probeMobileMenu`, `probeFormValidation`, `probePricingNav` — the `broken`/`ok`/`skipped` paths need real DOM exercise.

### Defect 4 (not fixed — documented as design tension): form-probe skips when no `required` fields
**Problem:** `probeFormValidation` in `lib/audit/flow/form-probes.ts` requires `hasRequiredField` to proceed; if no field has `required`, it returns `skipped`. The baseline fixture form has no `required` fields, so the flow probe skips even though the form now renders.

**Why this is a design tension, not a bug:** The static check `form-missing-validation` catches "fields missing required attrs". The flow probe's job is different: "form claims to require input (has `required`) but gives no feedback on empty submit". These are two distinct defects. If the baseline form had `required` but no validation feedback, `flow-form-no-validation` would fire — but then `form-missing-validation` wouldn't (it only fires when `required` is *missing*). The two checks are mutually exclusive by design.

**Net effect:** On the demo fixture, `form-missing-validation` fires (static, correct) and `flow-form-no-validation` skips (flow, correct — nothing to probe). Both behaviors are defensible. The flow probe is exercised on real sites that have `required` fields but broken JS validation.

## Critical review (this iteration)

- Every flow flag now has a real screenshot URL (defect 1 fixed) — meets "evidence with highlight" bar
- `form-missing-validation` is now defensible on both offline AND rendered paths (defect 2 fixed)
- v1=0 holds across all three layers (offline, rendered, flow) — regression is green
- Real-site smoke (saadbenryane.com) confirms 0 false positives after screenshot fix
- Unit tests: 888/888 pass (the previously-skipped screenshot test now passes)
- Capability matrix: 30 live, 0 unmapped, trigger matrix + verification rules + evidence selectors present for all form/flow checks
- Two honest gaps remain (probe-level integration tests; mobile-menu never fires on fixture) — documented above, not papered over

## Trust assessment

Would I trust these flags on my own site? **Yes, with the documented caveats.**
- `flow-pricing-nav-broken`: verified end-to-end on fixture (baseline fires, v1 clears)
- `form-missing-validation`: verified on offline + rendered paths
- `flow-form-no-validation`: flag emission verified; probe logic relies on unit-level mocking only — would trust on a real site but want probe-level integration test before calling it bulletproof
- `flow-mobile-menu-broken`: flag emission verified; probe has never fired on a real broken case in this repo — would trust cautiously, needs integration test

## Out of scope
- Probe-level integration tests (mock Puppeteer Page against fixture HTML) — follow-up
- PageSpeed API checks in offline loop
- Commits unless asked
- `experience-visual-polish` — AI judge only; no deterministic token checks to add
