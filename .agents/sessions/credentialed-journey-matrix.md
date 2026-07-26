# Credentialed journey matrix

*Created: 2026-07-23. Updated: 2026-07-26. Release gate: all revenue-critical paths signed off before distribution scale.*

## Release verification

| Requirement | Status | Evidence |
|-------------|--------|----------|
| `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | Pass | `npm run doctor` passes locally |
| `RELEASE_FRESH_DATABASE_URL` + reset flag | Blocked | Variables are absent. Reset of a disposable `fixflags_release` database also requires explicit user consent. |
| `RELEASE_CONTAINER_ENV_FILE` | Partial | `.cache/release/container.env` written (gitignored) |
| `RELEASE_SMOKE_URL` | Blocked | Deployed smoke target still missing |
| R2 capture credentials | Blocked | Required `R2_*` variables are absent |
| Email / Product Watch credentials | Blocked | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `ADMIN_NOTIFICATION_EMAIL` are absent |
| `npm run verify` | Pass | Full gate passed 2026-07-26: 2,387 unit tests, accuracy, CLI, production web build, worker build, dependency audit, and Docker image |
| `npm run verify:release` | Blocked at preflight | `npm run agent -- eval release` stopped safely because `RELEASE_FRESH_DATABASE_URL` is absent; smoke, R2, email, and reset consent also remain required |
| Credentialed Playwright suite | Implemented; sandbox run blocked | Eight executable journeys replace the former deliberate failures. `verify:release` now enables them and preflights every disposable fixture before destructive setup. Sandbox credentials remain absent locally. |
| Dedicated worker topology | Local Pass; deploy pending | Stable local startup reported web role, one worker, concurrency one, zero contexts, and no stalled or overdue jobs. The container smoke now provisions Postgres, Redis, web, and worker, submits a real check, observes worker readiness, and requires a completed report. Railway deployment and external heartbeat smoke remain required. |

Record command output here when credentials are provisioned.

## Journey matrix

| Journey | Automated proof | Status | Notes |
|---------|-----------------|--------|-------|
| Anonymous wedge | Unit + `e2e/public-journeys.spec.ts` + local browser dogfood | Local Pass; deployed dogfood pending | `saadbenryane.com` audit `cms10xj8n0001gr82h9f3l989` completed `FULL` in 155 seconds without restart. Progressive handoff rendered without a frozen frame. Confirm gates and claim flow after deploy. |
| Passkeys / 2FA / recovery | Unit tests + virtual WebAuthn and backup-code E2E | Implemented; sandbox run pending | Release fixture supplies the registered credential material and one disposable backup code. |
| Billing / webhooks | Unit/handler tests + checkout/portal E2E | Implemented; sandbox run pending | Uses separate free and paid Stripe test users. Signed webhook lifecycle still relies on the existing handler tests plus operator Stripe dogfood. |
| Re-check / diff / Remember | Unit + claim/re-check E2E | Implemented; sandbox run pending | Claims the anonymous report through `/post-login`, unlocks the Fix List, performs a fresh FULL re-check, and asserts diff and Remember UI. |
| Protected sharing | Handler tests + credentialed E2E | Implemented; sandbox run pending | Creates a password/expiry/max-view link, verifies one scoped view, revokes it, and asserts denial in a clean context. |
| Product Watch | Unit/handler tests + scheduler/mailbox E2E | Implemented; sandbox run pending | Requires a due disposable project and a mail-sandbox assertion endpoint; asserts exactly one matching message. |
| GitHub Fix PR | Integration tests + dedicated-repository E2E | Implemented; sandbox run pending | Starts a real repo scan, selects a permitted fixable finding, and requires an open GitHub PR URL. |
| MCP | Contract / tool / quality gate + release E2E | Implemented; sandbox run pending | Authenticates, checks, polls, reads the complete Fix List, and starts a re-check. |
| CLI | Unit tests + packaged release E2E | Implemented; sandbox run pending | Runs the packaged CLI against the release app for check, Fix List, and re-check. |

## Manual smoke (QUALITY §86–96)

Run on **one anonymous** and **one signed-in** journey before distribution:

- [ ] `/report/[id]` hierarchy: identity → diff → complete ranked Fix List → Contract/Memory → Journey/Flow/Timeline → previews/gates/actions → re-check
- [ ] Anonymous: three summaries, exactly one **real** complete fix prompt (not a signup placeholder), one signup moment for remaining prompts
- [ ] Evidence visible on focused + details for anon; prompts gated except the demonstrated one
- [x] Production brand restored (`fix-live-images` / Phase 0)
- [x] Unknown report and share tokens render explicit not-found/unavailable states (`e2e/public-journeys.spec.ts`)
- [x] Progressive route: lightweight status UI renders immediately and advances through the canonical stages without loading the completed-report graph
- [x] `/samples` and loading shell never empty (public E2E)
- [ ] Password share: generic metadata, authorize, no view inflation, revoke
- [x] Progressive report has no horizontal overflow at 320 / 375 / 768 / 1280px; Back navigation and invalid-input recovery work
- [ ] Keyboard submission, reduced motion, and 200% text still require the deployed release smoke

## Browser / pipeline truth (2026-07-23)

- Slow 3G replay wired in `lib/audit/pipeline/run-page.ts` (production path)
- Mobile + desktop `networkFailures` merged in `captureScreenshots`
- Primary flow capture uses `journeySafe` for engagement POST probe
- AXI/chrome-devtools-axi rejected for audit capture; AXI applies to CLI/MCP agent tooling
- Recovery evaluation loads its required environment and fails rather than silently skipping. Stale unstarted QUEUED jobs may requeue; a lost job after CAPTURING fails explicitly instead of silently restarting the report.

## Accuracy adjudication backlog

| Site | Status | Action / evidence |
|------|--------|-------------------|
| linear.app | Structural frozen | Fixture `lib/audit/__tests__/fixtures/sites/linear-app.html` (`captured=2026-07-23`). Corpus tier `structural` with expectedPresent `no-structured-data`, `cookie-consent-absent`. Full Playwright dogfood blocked on R2; do not elevate to gold until live pipeline adjudicates SSR a11y FPs. |
| replit.com | Structural curated | Fixture `replit-com.html` frozen with provenance. Live probe historically 403 (bot block). Keep curated fixture; do not invent gold. expectedPresent: `canonical-missing`, `h1-multiple`. |
| v0.dev | Structural frozen | Fixture `v0-dev.html` frozen with provenance (`captured=2026-07-23`). Docs that said “no frozen fixture” are stale. expectedPresent: `no-structured-data`, `measurement-ga-gtm-posthog-missing`. Elevate to gold only after FP/FN adjudication with frozen evidence. |

`npm run accuracy:eval`: Pass (2026-07-26) — 11 HTML gate fixtures, 2 gold, 0 failures.
