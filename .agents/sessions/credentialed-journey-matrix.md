# Credentialed journey matrix

*Created: 2026-07-23. Release gate: all revenue-critical paths signed off before distribution scale.*

## Release verification

| Requirement | Status | Evidence |
|-------------|--------|----------|
| `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | Blocked | Run `npm run doctor` locally |
| `RELEASE_FRESH_DATABASE_URL` + reset flag | Blocked | Required for `npm run verify:release` |
| `RELEASE_CONTAINER_ENV_FILE` | Blocked | Production-like container env |
| `RELEASE_SMOKE_URL` | Blocked | Deployed smoke target |
| `npm run verify:release` | **Not run** | Blocked on credentials above |

Record command output here when credentials are provisioned.

## Journey matrix

| Journey | Automated proof | Status | Notes |
|---------|-----------------|--------|-------|
| Anonymous wedge | `e2e/public-journeys.spec.ts` (`E2E_FULL=true`) | Partial | Queue-backed anon journey exists; run with full env |
| Passkeys / 2FA / recovery | `lib/auth/` unit tests | Partial | Route E2E not in default suite |
| Billing / webhooks | `lib/billing/` + webhook route tests | Partial | Manual Stripe checkout sign-off required |
| Re-check / diff / Remember | Unit + sample contract | Partial | FULL re-check path covered in unit tests |
| Protected sharing | `lib/security/` route tests | Partial | Manual password share smoke in QUALITY §86–96 |
| Product Watch | `lib/growth/` unit tests | Pass | Regression email idempotency tested |
| GitHub Fix PR | Integration tests | Partial | Requires encrypted token fixture |
| MCP | Contract / tool tests | Partial | `npm run completeness:audit` inventories 16 tools |
| CLI | `npm run test:cli` | Pass | Task-shaped check → plan workflow |

## Manual smoke (QUALITY §86–96)

Run on **one anonymous** and **one signed-in** journey before distribution:

- [ ] `/report/[id]` hierarchy: identity → diff → Finish Plan (≤3) → rubric → full review → re-check
- [ ] Anonymous: three summaries, exactly one complete fix prompt, one signup moment
- [ ] `/report/[id]/details`: Contract, Journey/Flow/Timeline, Flags, previews, watch
- [ ] Progressive route: captures, early findings, three Finish Plan cards
- [ ] `/samples` and loading shell never empty
- [ ] Password share: generic metadata, authorize, no view inflation, revoke
- [ ] 375 / 768 / 1280px, keyboard, reduced motion, partial/failure/deleted states

## Browser / pipeline truth (2026-07-23)

- Slow 3G replay wired in `lib/audit/pipeline/run-page.ts` (production path)
- Mobile + desktop `networkFailures` merged in `captureScreenshots`
- Primary flow capture uses `journeySafe` for engagement POST probe
- AXI/chrome-devtools-axi rejected for audit capture; AXI applies to CLI/MCP agent tooling

## Accuracy adjudication backlog

| Site | Status | Action |
|------|--------|--------|
| linear.app | Open | Full Playwright dogfood; adjudicate SSR a11y FPs; freeze rendered fixture if needed |
| replit.com | Open | Curated fixture or documented skip (403 on live probe) |
| v0.dev | Partial | Parser fixed live; no frozen fixture yet |
