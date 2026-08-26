# Game On operator packet

This is not code completion. Do not treat it as MET.

The code-owned customer loop (claim, gated Copy chrome, designed handoff, docs honesty) is implemented on `main` in this working tree.
Release attestation is still operator-owned on `game-on-release-evidence`.

## Still required from the operator

1. Railway Wait for CI on web and worker.
2. Prove `/api/health` reports the exact SHA that GitHub CI passed.
3. Credentialed release matrix with disposable-database reset consent: auth, Free/Pro/Studio, billing, Watch email, GitHub, deployment triggers.
4. Publish `fixflags@1.0.5` under `candidate`, install clean, production dogfood with a real `IMPROVED` and an honest `INCONCLUSIVE`, then promote that exact version to `latest`.
5. Stripe sandbox and production webhook proof.

## Not code, and not shipped as Free

- Watch (scheduled reviews) is Studio/`TEAM` only.
- Free and Pro stop at manual Update review.
- Preview, Timeline, and Canvas stay parked on the default live `/report/[id]` route.

## Local proof that is not production proof

- `npm run agent -- verify` passed after the wedge changes.
- UI vitest project: 231 passed.
- Browser at 375/768/1280: header 56px, leftover 0, Log in carries `next=/report/{id}`, Copy opens save-report create-account copy.
- Local `NODE_ENV=development` sets `isDevUnlimitedScans()`, so the second anonymous homepage scan is not blocked here. The AUTH_REQUIRED dialog is covered by unit tests. Production and `DEV_SIMULATE_BILLING=true` still enforce one teaser.
- Public journeys: 37 passed, 1 skipped (`E2E_FULL`), 7 failed before E2E contract updates; after updates, mobile Flag selection and pricing `$29`/`$79` pass. Remaining Axe failures are brand-orange-on-white contrast (`#ff5900` / `#ffffff` at 14px, 3.14:1) on the marketing header Review CTA. That is a brand-token decision, not a claim-loop defect.
- `E2E_FULL` queue-backed anonymous journey was not run in this session.
