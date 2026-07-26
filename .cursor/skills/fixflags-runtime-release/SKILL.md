---
name: fixflags-runtime-release
description: Build, diagnose, and verify FixFlags production runtime and releases across Node, Next standalone, worker, Prisma migrations, Chromium, containers, readiness, and deployed smoke checks.
---

# FixFlags runtime and release

Read `AGENTS.md`, `.agents/BOARD.md`, `DEVELOPMENT.md`, `QUALITY.md`, and `SECURITY.md` before changing production startup or release behavior.

## Runtime contract

- Node 22 is the supported repository, CI, CLI, build, and runtime baseline.
- `scripts/runtime-start.mjs` is the shell-free entry point for `web` and `worker` modes.
- Process configuration wins. Local `.env.local` loading is development convenience and never overrides injected values.
- Prisma commands use argument arrays. Runtime code must not import `scripts/` implementations or write into the repository.
- The image contains standalone Next output, static/public assets, the compiled worker, production dependencies, Prisma client/migrations, and explicit startup helpers.
- Web and worker use the same immutable image. The selected mode changes only the launched process.
- Readiness reports missing database, Redis, migrations, browser/storage, AI, email, and worker requirements honestly.

## Workflow

1. Run `npm run agent -- context release` and inspect Git ownership before edits.
2. Treat a push to `origin/main` as a production code deployment. Commit only
   the intended verified changes, push `main`, and wait for the Railway `QewOS`
   deployment to reach `SUCCESS`.
3. Trace configuration from `lib/env.ts` through readiness, startup, migrations, web, worker, and scheduler.
4. Build once. Exercise both web and worker modes from that image, including graceful termination and restart.
5. Inspect image contents and history for secrets, local data, repository-write assumptions, missing standalone assets, and unnecessary files.
6. Run `npm run agent -- verify`, then `npm run verify:release` with explicit disposable database reset authorization and required smoke credentials.
7. Verify production behavior and `/api/health` after the new deployment, not
   against the previous live version.
8. Treat missing release resources as a blocker. Never turn a required probe into a skip or fallback.

## Release inputs

Generate the current input list from `scripts/validate.mjs`. At minimum, container definitions, package manifests and locks, Next configuration, Prisma runtime, worker build, startup helpers, and deployment configuration must route to the container gate.

## Verification evidence

- Clean dependency install, schema validation, migrations, drift check, typecheck, lint, unit and browser suites.
- Built image starts web and dedicated worker, exposes correct health failures, finds Chromium, and forwards shutdown signals.
- Queue recovery, retry exhaustion, duplicate-job idempotency, and scheduler locks are exercised against disposable PostgreSQL and Redis.
- Deployed smoke validates health, browser/storage, AI configuration, generated route authorization boundaries, and optimized brand/marketing `_next/image` URLs (200, not `"url" parameter is not allowed`).
- No required check is skipped and no shipped-readiness claim is updated before the credentialed journey matrix passes.
- After every production deploy, confirm `/api/health` commit matches the intended `main` tip before claiming UI fixes are live.

## Release credential checklist

From [`.agents/handoffs/current-product-completion.md`](../../../.agents/handoffs/current-product-completion.md):

1. `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
2. `RELEASE_FRESH_DATABASE_URL` + `RELEASE_ALLOW_DATABASE_RESET=true` (name includes `release` or `test`)
3. `RELEASE_CONTAINER_ENV_FILE`
4. `RELEASE_SMOKE_URL` (+ bearer if required)
5. `npm run verify:release` end-to-end

Record pass/fail in [`.agents/sessions/credentialed-journey-matrix.md`](../../../.agents/sessions/credentialed-journey-matrix.md).
