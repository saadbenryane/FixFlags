# Credentialed journey matrix

*Created: 2026-07-23. Updated: 2026-07-24. Release gate: all revenue-critical paths signed off before distribution scale.*

## Release verification

| Requirement | Status | Evidence |
|-------------|--------|----------|
| `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | Pass | `npm run doctor` passes locally |
| `RELEASE_FRESH_DATABASE_URL` + reset flag | Blocked | Not set in `.env.local`; required for `npm run verify:release` |
| `RELEASE_CONTAINER_ENV_FILE` | Blocked | Production-like container env missing |
| `RELEASE_SMOKE_URL` | Blocked | Deployed smoke target missing |
| R2 capture credentials | Blocked | `R2_*` commented out in `.env.local`; Linear full-pipeline capture requires storage |
| `npm run verify:release` | **Not run** | Blocked on credentials above |
| Credentialed Playwright suite | Scaffolded | `e2e/credentialed-journeys.spec.ts` skips unless `E2E_CREDENTIALED=true` + release DB |

Record command output here when credentials are provisioned.

## Journey matrix

| Journey | Automated proof | Status | Notes |
|---------|-----------------|--------|-------|
| Anonymous wedge | Unit + `e2e/public-journeys.spec.ts` | Code Pass; live dogfood pending | Public E2E covers sample, header, Flag focus, deleted report, unknown share. Confirm on production after deploy. |
| Passkeys / 2FA / recovery | `lib/auth/` unit tests + credentialed skeleton | Partial | Route E2E gated in `e2e/credentialed-journeys.spec.ts` |
| Billing / webhooks | `lib/billing/` + webhook + checkout handler tests | Partial | Manual Stripe checkout sign-off still required |
| Re-check / diff / Remember | Unit + sample contract | Partial | FULL re-check path covered in unit tests |
| Protected sharing | Share token + share-links handler tests | Partial | Manual password share smoke in QUALITY §86–96 |
| Product Watch | Unit + `/projects/[id]/watch` handler tests | Pass (unit/handler) | Live email delivery still needs release sandbox |
| GitHub Fix PR | Integration tests | Partial | Requires encrypted token fixture |
| MCP | Contract / tool / quality gate | Pass (local) | 17 typed tools; deployed Lovable/Bolt smokes pending |
| CLI | `npm run test:cli` | Pass | Task-shaped check → plan workflow |

## Manual smoke (QUALITY §86–96)

Run on **one anonymous** and **one signed-in** journey before distribution:

- [ ] `/report/[id]` hierarchy: identity → diff → complete ranked Fix List → Contract/Memory → Journey/Flow/Timeline → previews/gates/actions → re-check
- [ ] Anonymous: three summaries, exactly one **real** complete fix prompt (not a signup placeholder), one signup moment for remaining prompts
- [ ] Evidence visible on focused + details for anon; prompts gated except the demonstrated one
- [x] Production brand restored (`fix-live-images` / Phase 0)
- [x] Unknown report and share tokens render explicit not-found/unavailable states (`e2e/public-journeys.spec.ts`)
- [ ] Progressive route: captures and verified Flags append to the canonical ranked explorer
- [x] `/samples` and loading shell never empty (public E2E)
- [ ] Password share: generic metadata, authorize, no view inflation, revoke
- [x] 375 / 768 / 1280px, keyboard, reduced motion on sample; deleted-report state covered

## Browser / pipeline truth (2026-07-23)

- Slow 3G replay wired in `lib/audit/pipeline/run-page.ts` (production path)
- Mobile + desktop `networkFailures` merged in `captureScreenshots`
- Primary flow capture uses `journeySafe` for engagement POST probe
- AXI/chrome-devtools-axi rejected for audit capture; AXI applies to CLI/MCP agent tooling
- Recovery evaluation loads its required environment and fails rather than silently skipping; stale QUEUED and mid-CAPTURING application-queue requeues pass against Redis.

## Accuracy adjudication backlog

| Site | Status | Action / evidence |
|------|--------|-------------------|
| linear.app | Structural frozen | Fixture `lib/audit/__tests__/fixtures/sites/linear-app.html` (`captured=2026-07-23`). Corpus tier `structural` with expectedPresent `no-structured-data`, `cookie-consent-absent`. Full Playwright dogfood blocked on R2; do not elevate to gold until live pipeline adjudicates SSR a11y FPs. |
| replit.com | Structural curated | Fixture `replit-com.html` frozen with provenance. Live probe historically 403 (bot block). Keep curated fixture; do not invent gold. expectedPresent: `canonical-missing`, `h1-multiple`. |
| v0.dev | Structural frozen | Fixture `v0-dev.html` frozen with provenance (`captured=2026-07-23`). Docs that said “no frozen fixture” are stale. expectedPresent: `no-structured-data`, `measurement-ga-gtm-posthog-missing`. Elevate to gold only after FP/FN adjudication with frozen evidence. |

`npm run accuracy:eval`: Pass (2026-07-24) — 11 HTML gate fixtures, 2 gold, 0 failures.
