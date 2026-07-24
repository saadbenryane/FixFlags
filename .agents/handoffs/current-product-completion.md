# Current product completion handoff

## Status

Local launch verification is green on the combined worktree. The release bar is implemented and intentionally blocked until designated external resources are provided. Do not replace those failures with test fallbacks.

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
- The report browser contract passes at 375, 768, and 1280px, including 200% zoom/reflow, reduced motion, keyboard-accessible names, redirects, report error states, and no client errors.
- The production auth shell is request-rendered, which removes the stale static-shell hydration mismatch exposed by the production browser suite.
- The builder-native MCP path uses typed API-key clients and validated builder prompts. Missing builder-specific prompts remain an explicit typed unavailable state instead of silently relabeling the universal prompt.
- The Railway deploy webhook consumes the typed API-key authentication context and has handler coverage for valid and invalid keys.
- The typed 17-tool MCP manifest, modular registration, documentation, complete Fix List task outcomes, and completeness guard are aligned.
- Repository skills were consolidated and a validator now enforces frontmatter, naming, links, reference depth, stale terms, size, and volatile-fact rules.
- Canonical Markdown no longer references a nonexistent AGENTS “Project facts” section.

## Verified

- `npm run agent -- verify`: passed all 23 commands, including database checks, 2,293 unit tests (three intentional skips), CLI verification, application build, and worker build. Log: `.agent-runs/2026-07-24T11-01-52-306Z-worker-build.log`.
- `npm run test:e2e`: 14 passed, one environment-gated queue-backed test skipped.
- Detailed sample Playwright contract after final PlantDad correction: three passed.
- `npm run doctor`: passed environment, PostgreSQL, Redis, Chromium, migrations, and worker readiness.
- `npm run accuracy:eval` and `npm run agent -- eval accuracy`: passed.
- `npm run agent -- eval recovery`: passed against local PostgreSQL and Redis. Log: `.agent-runs/2026-07-24T11-02-13-776Z-eval-recovery.log`.
- `npm run mcp:quality-gate`: passed all 17 typed tools.
- `npm audit --audit-level=moderate`: zero advisories.
- `npm run test:scripts`, `npm run lint`, and `git diff --check`: passed after the final release-only additions.
- `npm run verify:release`: clean install completed with zero advisories, then stopped safely before database mutation because `RELEASE_FRESH_DATABASE_URL` is not configured.

## Remaining release blockers

1. Local AI configuration is present and `npm run doctor` passes.
2. Provide `RELEASE_FRESH_DATABASE_URL` for a disposable database whose name includes `release` or `test`, plus `RELEASE_ALLOW_DATABASE_RESET=true`.
3. Provide `RELEASE_CONTAINER_ENV_FILE` with production-like non-customer resources.
4. Provide `RELEASE_SMOKE_URL` (and bearer token when required).
5. Provide the R2 account, access key, secret, and bucket configuration required by the real capture path. An environment-gated Linear audit correctly entered `FAILED` at CAPTURING with `STORAGE_NOT_CONFIGURED`; it did not report a false success or use a fallback.
6. Run `npm run verify:release`, then the remaining credentialed journey matrix for anonymous claim, passkeys/2FA/recovery, billing/webhooks, re-check/diff/Remember, protected sharing, Product Watch delivery, GitHub Fix PR, support/admin, MCP, and CLI. Matrix file: `.agents/sessions/credentialed-journey-matrix.md`.
7. Deploy the exact verified commit and repeat the anonymous, signed-in, billing, protected-share, and re-check dogfood journeys against production.

## Pipeline truth (2026-07-23)

- Slow 3G replay wired in `lib/audit/pipeline/run-page.ts` (production path).
- Mobile + desktop `networkFailures` merged; primary flow capture uses `journeySafe` for engagement probe.
- AXI/chrome-devtools-axi documented as rejected for audit capture; new `fixflags-browser-capture` skill.
- `npm run verify:release` attempted; blocked at `RELEASE_FRESH_DATABASE_URL` (expected).

## Safe release command

Run `npm run verify:release` only with the designated release resources above. The database gate is destructive only to `RELEASE_FRESH_DATABASE_URL` and refuses the normal `DATABASE_URL` or a database name without `release`/`test`.
