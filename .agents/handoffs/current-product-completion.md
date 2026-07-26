# Current product completion handoff

## Status

Local current-product implementation and verification completed on 2026-07-26. Release verification remains blocked only on operator-provided disposable fixtures, reset consent, deployed service configuration, and external sandbox credentials. No production database reset was attempted.

## Completed in this closeout pass

- Report truth now uses consolidated Fix identities across the report route, rubric counts, task contracts, MCP, and explorer state; raw route occurrences remain evidence only.
- The report route uses a neutral loading shell until a real status exists, completed SSR reports do not flash a scan stage, active audits poll with bounded backoff, and terminal/inaccessible/deleted audits clear across same-tab and cross-tab state.
- `GET /api/me` is read-only, anonymous claim moved to idempotent `POST /api/me/claim`, and one shared `MeProvider` owns client identity state.
- Verdicts are reconciled to the highest-ranked unresolved Fix and PageSpeed coverage distinguishes complete, partial, and unavailable evidence.
- The report explorer persists `flag`, `rubric`, `severity`, `impact`, and `page` in the URL and deterministically recovers from stale selections.
- Live accuracy tooling is consolidated on rendered evidence. The 375 × 812 dogfood probe measured “Book a call” at 394px and produced no `cta-below-fold-mobile`, `no-cta-detected`, or `skip-link-missing` false positive.
- Verification and E2E builds share the isolated build runner and delete only their dedicated incremental TypeScript state; the real BullMQ missing-job contract is asserted.
- Every generated API contract records executable handler, credentialed journey, or deployed boundary evidence.
- Dedicated web/worker lifecycle, browser prewarming, per-replica Redis heartbeat aggregation, terminal job guarantees, and production-like Postgres/Redis/web/worker container smoke.
- Real credentialed Playwright journeys replaced all deliberate throws for anonymous claim/re-check, WebAuthn/2FA recovery, Stripe, protected sharing, Product Watch, GitHub Fix PR, MCP, and packaged CLI workflows.
- Release preflight now fails before setup unless every disposable fixture and explicit database-reset consent are present.
- Auth, billing, examples, and report Suspense states use layout-matched loading UI; auth wordmark bounds, touch targets, themes, reduced motion, 200% text, and responsive reflow are covered by public Playwright tests.
- Anonymous prompt selection survives progressive-to-completed report hydration and exposes exactly one demonstrated prompt while the remaining prompts stay gated.
- Homepage scan inputs remain disabled until hydration, preventing native pre-hydration form navigation and controlled-input value loss.
- Local production-like Playwright enables real quota enforcement instead of development's intentional unlimited-scan mode.

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

- `npm run agent -- verify --full`: 24-command gate passed on 2026-07-26, including the production web build, worker build, CLI, accuracy corpus, migrations/drift, skill validation, dependency audit, and container build.
- Focused UI, accuracy, recovery, auth, billing, security, prompts, and CLI evaluations passed.
- Direct browser checks passed at 320/375 mobile widths: seven visible sample Fixes were seven unique issues, selected Flag state survived refresh, and no horizontal overflow was present.
- Vitest: 184 files passed, 2,420 tests passed; one file and two tests skipped by their declared environments.
- Dependency audit: zero moderate-or-higher vulnerabilities.
- Accuracy: 11 HTML gate fixtures, 2 gold fixtures, zero failures.
- Isolated production public Playwright: 27 passed, one credentialed/full-scan test skipped by default.
- Production-like anonymous full scan: one passed in 38.9 seconds, including terminal completion, exactly one demonstrated prompt, clipboard content, and the second-URL signup gate.
- Changed-file verification: TypeScript, lint, audit/component/prompt tests, brand, UI drift, image policy, and SEO all passed.

## Remaining release blockers

`node scripts/release-preflight.mjs` stops safely until these are supplied:

- `RELEASE_FRESH_DATABASE_URL`, `RELEASE_CONTAINER_ENV_FILE`, `RELEASE_SMOKE_URL`, and `RELEASE_ALLOW_DATABASE_RESET=true`
- `E2E_AUDIT_URL`, `E2E_SIGNUP_PASSWORD`, and the disposable WebAuthn/2FA fixture values
- Disposable free/paid billing users
- Disposable share owner/report/password values
- Disposable Product Watch user/project plus mail-sandbox assertion URL
- Disposable GitHub user and dedicated test repository
- Authenticated release `E2E_API_KEY`

The release environment file must contain the required R2, Stripe, email, GitHub, AI, PageSpeed, database, Redis, and service-role values checked by preflight and readiness. Both Railway services and deployed dogfood remain operator-dependent.

## Local gate evidence (2026-07-26)

- Full repository gate and affected gate pass.
- Public production Playwright passes at 320, 375, 768, and 1280 px.
- The real anonymous queue-backed journey passes with production quota gates enabled.
- Release preflight is the only local failure, and reports missing external inputs before any reset or sandbox mutation.

## Safe release command (after consent + smoke URL)

```bash
source .cache/release/exports.sh
export RELEASE_SMOKE_URL='https://<deployed-host>'
# After explicit user consent for migrate reset on fixflags_release:
export PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='<exact user consent message>'
npm run verify:release
```

The database gate is destructive only to `RELEASE_FRESH_DATABASE_URL` and refuses the normal `DATABASE_URL` or a database name without `release`/`test`.
