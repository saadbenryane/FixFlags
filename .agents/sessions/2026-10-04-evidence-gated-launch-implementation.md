# Evidence-gated launch implementation

Date: 2026-10-04
Owner: codex-root
State: local implementation complete; external launch evidence remains open

## Implemented locally

- Replaced the blanket dependency audit with a policy that blocks every moderate-or-higher runtime advisory and accepts only the exact reviewed indirect `braces` toolchain advisory paths. Added the advisory owner and exploit-precondition record.
- Replaced `tsc-alias` with an esbuild worker bundle, removed unused build plugins, and made the standalone web build copy its static and public assets.
- Added tenant-scoped Outcome detail GET/PATCH, per-Outcome pause/enable, cadence-derived 36-hour daily and eight-day weekly/manual freshness, and fresh verification on stale re-enable.
- Completed Outcome detail with expectation, current answer, coverage, freshness, last successful verification, required-method evidence, limitations, active/resolved Flags, and chronological run, assessment, fix, verification, recovery, and recurrence events.
- Added the complete `OutcomeFixture` lifecycle: create, replace, dry run, authorize, revoke, delete, version-bound authorization, encrypted synthetic values and hook secret, response redaction, accessible target descriptors, and exact-origin reset/cleanup enforcement. Cleanup, reset, authorization, or execution uncertainty remains Couldn’t verify.
- Made Safe Signup discoverable only with a current authorized fixture. Login and Password reset remain unavailable. Removed global protected-form environment builders.
- Reordered Site settings by responsibility, standardized Home · Flags · Settings, made recommendation headings conditional, removed dead Product workspace components and obsolete report-era MCP copy, and preserved legacy report compatibility.
- Enriched the existing Outcome-first MCP result without adding fixture-management tools. MCP discovery remains withheld.

## Verification

- `npm run doctor`: environment, PostgreSQL, Redis, Chromium, migrations, and worker ready.
- `npm run completeness:audit`: passed.
- Focused domain after the final completeness repairs: 48 tests passed.
- Focused UI after the final responsibility-control additions: 39 tests passed.
- Validation harness: 101 tests passed.
- `npm run security:audit`: runtime clear; only reviewed build-only advisory paths accepted.
- `npm run agent -- verify`: all 30 commands passed after the final repairs, including database validation/drift, typecheck, lint, guards, unit tests, coverage, accuracy, Next build, worker build, and Docker image. Container receipt: `.agent-runs/2026-10-04T20-19-57-095Z-container-build.log`.
- Authenticated local browser walk at 1280×900 and 375×812: Settings rendered Outcomes and fixtures → Watch → Notifications → Connections → Developer access → Remove Site; desktop and mobile navigation both rendered Home · Flags · Settings; Safe Signup configuration was present; the Outcome detail rendered limitation, independent evidence, Flags, covered pages, and history; no horizontal overflow occurred. The stored Outcome honestly rendered Couldn’t verify.
- Railway production configuration read on 2026-10-04: `FixFlags` trigger `45971dea-bf14-4f61-9e48-a78598942241` and `FixFlags Worker` trigger `e5ea88f2-0776-403e-8449-4020aafe0c28` both report `checkSuites: true` on `main` for `saadbenryane/FixFlags`.

## Follow-up browser defects repaired

- The first authenticated dashboard walk exposed an RSC serialization error because the server-rendered Sites grid passed a Lucide component function into the client `BoardCard`. `BoardCard` now accepts a serializable `SiteCardArea` key and resolves the icon inside its client boundary.
- Following a real dashboard Site link exposed a second hydration defect: the server and browser formatted the same Outcome evidence one hour apart. Client-rendered persisted evidence now uses one explicit `en-US` UTC formatter.
- Authenticated `/dashboard` rendered three real Site cards at 1280×900 and 375×812 with no overflow and no component-function or plain-object serialization errors. A fresh Site tab rendered the stable UTC evidence timestamp with zero console errors at both widths.
- Five focused suites passed with 38 tests. TypeScript, scoped lint, and diff checks passed. The complete 30-command verification passed again after these fixes, including optimized Next, worker, and container builds. Final container receipt: `.agent-runs/2026-10-04T22-58-40-683Z-container-build.log`.
- Full details: `.agents/sessions/2026-10-04-dashboard-and-time-hydration.md`.

## Evidence gates deliberately left closed

- No candidate commit was pushed or deployed in this session, so production still runs an earlier SHA and none of the implementation above is production verified.
- Codex, Claude Code, and Cursor real-client authentication/reconnect/Flag/fix/recovery/recurrence matrix.
- Exact-SHA release canary, rollback rehearsal, production responsive and accessibility walk, and credentialed release suite.
- GA4 `journey_id` registration and fresh GA/GSC/server funnel baseline.
- Same-scenario competitive observation in FixFlags, Checkly, and Momentic.
- At least 14 days and 100 scheduled Watch executions meeting reliability, notification, deduplication, quiet-success, and COGS thresholds.
- Paid activation and public MCP discovery. Stripe remains waitlisted and MCP setup remains undiscoverable until their evidence gates pass.
