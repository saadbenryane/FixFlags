# Current product completion handoff

## Status

Local completion work for Builder-Native + Current-Product closeout advanced on 2026-07-24. Release verification remains blocked on operator consent for disposable DB reset, R2 credentials, container/smoke URLs, and deployed dogfood.

Preserve concurrent auth WIP (`PasskeyEnrollPrompt`, ConnectedAccounts, sign-in/post-login/2FA, marketing auth copy) and journey schema fields.

## Completed in this closeout pass

- Validation side-effect guard hardened: `normalizeRepositoryState` / `assertRepositoryUnchanged` in `scripts/validate.mjs` with unit tests; ignores generated artifact paths.
- Report API Fix List parity: `GET /api/reports/[id]` uses `buildUnifiedFixList` (includes Agency repo Flags). Parity + route tests added.
- PRODUCT.md: Lovable/Bolt MCP listed as shipped; remaining limitation is deployed connector smoke / release proof.
- Builder registry alignment: help MCP guide derives editors from `BUILDERS`; repo-scan prompt tools include `lovable` / `bolt`.
- Public E2E expanded (unknown share, details redirect, MCP help/docs). Credentialed suite scaffolded at `e2e/credentialed-journeys.spec.ts` (skips unless `E2E_CREDENTIALED=true` + release DB).
- Accuracy matrix updated: linear/replit/v0 frozen HTML fixtures documented; `accuracy:eval` green (11 fixtures, 2 gold).
- Handler tests added: share-links, cron secret gates, project watch, Stripe checkout/portal, me/preferences, admin support sessions.
- Journey WIP unblocked for verify: migration `20260724130000_journey_plan_and_element_fields`, funnel check IDs wired into verification rules + capability matrix, type/lint fixes.
- Local disposable DB `fixflags_release` created; `.cache/release/exports.sh` and container env prepared (gitignored under `.cache/`).

## Verified

- `npm run agent -- verify` (affected): passed after journey/capability fixes.
- `npm run mcp:quality-gate`: 17 tools.
- `npm run completeness:audit`: passed.
- `npm run accuracy:eval`: passed.
- Targeted route/parity vitests: passed.

## Remaining release blockers

1. **Prisma AI consent required** to run `npx prisma migrate reset --force --skip-seed` against disposable `fixflags_release` only (not `fixflags` / production). Prisma blocks Cursor agents until the user explicitly consents and the exact consent text is passed as `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`.
2. `RELEASE_SMOKE_URL` (and bearer if required) for deployed readiness/browser/AI smoke.
3. Real R2 credentials for capture-backed Linear full-pipeline adjudication and browser health.
4. **Quiet working tree** for `npm run verify` / `verify:release`: the validation side-effect guard correctly fails while concurrent writers keep editing auth/journey/status files mid-run. Pause overlapping agents, then re-run full verify.
5. After reset consent: run `source .cache/release/exports.sh`, set `RELEASE_SMOKE_URL`, then `npm run verify:release`.
6. Execute credentialed matrix rows and Lovable/Bolt real connector smokes against the deployed commit.
7. Production dogfood (anon, signed-in, billing, protected-share, re-check).

## Local gate evidence (2026-07-24)

- `npm run agent -- verify` (affected path): passed after journey/capability/typecheck/lint fixes.
- Mid-run `npm run verify` (full) aborted by side-effect guard when concurrent agents modified `app/api/reports/[id]/status`, `hooks/useMe.ts`, `lib/audit/active-audit.ts`, `app/(auth)/error.tsx`, etc. Guard behavior is correct; exclusive ownership needed for a clean full pass.

## Safe release command (after consent + smoke URL)

```bash
source .cache/release/exports.sh
export RELEASE_SMOKE_URL='https://<deployed-host>'
# After explicit user consent for migrate reset on fixflags_release:
export PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='<exact user consent message>'
npm run verify:release
```

The database gate is destructive only to `RELEASE_FRESH_DATABASE_URL` and refuses the normal `DATABASE_URL` or a database name without `release`/`test`.
