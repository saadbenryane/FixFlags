# Current product completion handoff

## Status

Local launch verification is green. The release bar is implemented and intentionally blocked until designated external resources are provided. Do not replace those failures with test fallbacks.

The main branch changed concurrently during this work. Commit `da73376` contains the coordinated product, auth, report, readiness, verification, skill, and documentation changes. It accidentally captured `.cache/next-build.lock` while a verification build was active; the current working tree deletes that ephemeral tracked file.

## Completed

- `scripts/validate.mjs` is the shared full/release command manifest used by local verification and CI.
- Generated Next, coverage, distribution, cache, and test artifact trees are excluded from lint and changed-file planning.
- Full verification covers database validation/status/drift, source lint, typecheck, guards, route/skill/completeness audits, dependency audit, script/unit/CLI tests, application build, and worker build.
- Verification builds use a recoverable process lock and `.next-verify`; Playwright uses isolated `.next-e2e` and port 3107.
- `verify:release` adds clean install, explicit disposable database reset, E2E, Docker image build, container readiness, and deployed readiness/browser/R2/AI probes.
- `/api/health/ready` returns 503 until every launch-required subsystem is ready; production startup rejects missing launch capabilities. Explicit degraded mode is loopback-only.
- The dependency audit reports no advisories.
- The generated route-contract registry covers every current API route without storing a volatile count.
- Live PostgreSQL/Redis recovery evaluation covers processing, retry-after-failure, and duplicate-job idempotency. Product Watch unit coverage includes regression-only and idempotent notifications.
- The detailed PlantDad sample now renders Contract, Remember, Journey, Flow, Timeline, Flags, previews, and launch gates with consistent fixture identity.
- Shared controls, navigation, report actions, and footer targets meet the 44×44px interaction contract.
- The report browser contract passes at 375, 768, and 1280px with no overflow or client errors.
- Repository skills were consolidated and a validator now enforces frontmatter, naming, links, reference depth, stale terms, size, and volatile-fact rules.
- Canonical Markdown no longer references a nonexistent AGENTS “Project facts” section.

## Verified

- `npm run verify`: passed, including database checks, 2,044 unit tests (one intentional skip), CLI package verification, production application build, and worker build.
- `npm run test:e2e`: eight passed, one credentialed queue-backed test skipped.
- Detailed sample Playwright contract after final PlantDad correction: three passed.
- `npm run agent -- eval recovery`: passed against local PostgreSQL and Redis.
- `npm audit --audit-level=moderate`: zero advisories.
- `npm run test:scripts`, `npm run lint`, and `git diff --check`: passed after the final release-only additions.

## Remaining release blockers

1. Provide `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`; local doctor currently fails only the AI environment requirement.
2. Provide `RELEASE_FRESH_DATABASE_URL` for a disposable database whose name includes `release` or `test`, plus `RELEASE_ALLOW_DATABASE_RESET=true`.
3. Provide `RELEASE_CONTAINER_ENV_FILE` with production-like non-customer resources.
4. Provide `RELEASE_SMOKE_URL` (and bearer token when required), then run `npm run verify:release`.
5. Run the credentialed journey matrix for anonymous claim, passkeys/2FA/recovery, billing/webhooks, re-check/diff/Remember, protected sharing, Product Watch delivery, GitHub Fix PR, support/admin, MCP, and CLI. The current route registry describes applicable cases but does not substitute for per-route integration tests.
6. Extend the runtime recovery evaluation from an isolated BullMQ queue to the application audit queue for stale-job recovery and lock contention.
7. Complete the remaining report/MCP/marketing module splits and dead-code adjudication. Do not refactor solely to meet a file-size target.

## Safe release command

Run `npm run verify:release` only with the designated release resources above. The database gate is destructive only to `RELEASE_FRESH_DATABASE_URL` and refuses the normal `DATABASE_URL` or a database name without `release`/`test`.
