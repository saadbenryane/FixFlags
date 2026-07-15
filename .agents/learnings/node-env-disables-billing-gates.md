# NODE_ENV=development silently disables billing/plan gates in tests

- Date: 2026-07-15
- Scope: Test reliability, billing gate enforcement
- Confidence: High

## Evidence

- `lib/auth/permissions.ts` `isDevUnlimitedScans()` returns true when
  `process.env.NODE_ENV === 'development' && DEV_SIMULATE_BILLING !== 'true'`.
- `hasUnlimitedScans()`, `getEffectiveScanLimit()`, and
  `shouldEnforcePlanGates()` all key off that helper, so in development the
  plan/quota gates are bypassed by design (local dev convenience).
- `vitest` does not force `NODE_ENV`; it inherits the shell. This remote
  execution environment exports `NODE_ENV=development`.
- Result observed: `npm run test:unit` failed 7 billing-gate tests
  (`usage-limits`, `assert-audit-access`, `api-keys/route`) locally, while the
  same tests pass in CI. The tests were correct; the code was correct; only the
  ambient `NODE_ENV` differed.

## Discovery

The exact tests that verify "a lapsed/revoked subscription forfeits AI and paid
features" are the ones silently disabled when the runner inherits
`NODE_ENV=development`, because the gate they assert is turned off in dev. A CI
runner or developer shell with `NODE_ENV=development` would see these tests
pass-by-bypass, so a real billing-gate regression could ship green.

## Correct approach

Pin the test environment in the runner, not the shell. `vitest.config.ts` now
sets `test.env = { NODE_ENV: 'test' }`. Gate-enforcement tests use
`test` env (or set `DEV_SIMULATE_BILLING='true'` explicitly, as several already
do) so they exercise production gate behavior regardless of the ambient shell.

When touching billing/entitlement code, run tests without a `NODE_ENV` prefix
and confirm they still pass — that proves the config pin is working.

## Prevention

- Encoded in `vitest.config.ts` (`test.env.NODE_ENV='test'`).
- The existing gate tests act as the tripwire: if the pin is removed and the
  shell exports `NODE_ENV=development`, they fail loudly again.

## Remaining risks

- Any NEW gate helper that keys off `NODE_ENV` outside `isDevUnlimitedScans` /
  `shouldEnforcePlanGates` would reintroduce the footgun. Route new gates
  through those helpers so the single `NODE_ENV=test` pin keeps covering them.
