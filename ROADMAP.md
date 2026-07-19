# Roadmap

*Repository-level direction. Not a duplicate of external tracker.*

## Now

- **Growth distribution** — improve conversion from anonymous → signed-up → paying:
  - Smooth onboarding flow
  - Better upsell timing and copy
  - Re-engagement for users who exhausted free AI reports
  *Signal:* >5% free-to-paid conversion.

- **Residual hardening** — not blocking ads, but required before scaling:
  - Extend API route contract tests beyond primary paid endpoints
  - Auth/session runtime tests (login, logout, expiry, plan entitlements)
  - Touch-tier component tests (report states, empty states)
  *Evidence baseline:* [QUALITY.md](./QUALITY.md), [test-strategy.md](./test-strategy.md).

## Recently closed

- **Monetization blockers — CLOSED.** All five items have automated coverage in CI via `npm run test:unit`. See [QUALITY.md § Monetization blockers](./QUALITY.md#monetization-blockers).
- **Scan depth Phase 1 — shipped.** Flow scan, slop detection, preview cards, og:image validation. See [scan-roadmap.md](./docs/scan-roadmap.md).
- **Ultimate audit Phases 0–4 — shipped.** Playwright-only stack, narrative report (Journey/Flow/Previews), Journey Review MVP (Pro+), corridor discovery + OG consistency, MCP plan-mode + re-check next-fixes. Remaining depth is demand-triggered (see Later / [scan-roadmap.md](./docs/scan-roadmap.md) Phase 3–4).

## Readiness (reconciled)

Single honest baseline across [QUALITY.md](./QUALITY.md) and [test-strategy.md](./test-strategy.md):

| Tier | Readiness | Residual CRITICAL |
|------|-----------|-------------------|
| Truth | ~90% | Form validation ratio test; score math edge cases (all-CRITICAL, module failures) |
| Strength | ~80% | API route contracts (most routes untested); rate limiting; auth/session runtime; CI parity with local `verify` |
| Touch | 10% | Report rendering per audit state; empty states (no scans, no flags, deleted audit) |

Monetization blockers (regression fixtures, judge contract, persist layer, pipeline state machine, billing gating) are closed. Strength ~80% reflects that; QUALITY.md's tier table (25%) lags the closed-blocker evidence.

## Next

- **Knowledge graph Phase 2** — deeper issue frequency pages, more benchmark content.
  *Signal:* Organic traffic from issue pages exceeds homepage traffic.

- **MCP polish** — Lovable/Bolt MCP support, tool refinements.
  *Signal:* MCP is reliable across all supported editors.

## Later

- **CI/CD integration** — GitHub Actions, Vercel deploy hooks. Runs audit on deploy preview.
  *Trigger:* Agency plan users requesting it / 10+ Agency subscribers.
- **Team workspaces** — seat management, shared projects, audit history.
  *Trigger:* 10+ Agency subscribers.
- **Staging site support** — password-protected or localhost URL testing.
  *Trigger:* Feature request volume justifies complexity.
- **White-label reports** — branded PDF exports, custom domains.
  *Trigger:* Agency demand.
- **Secret-leak scan / real-device mobile / weekly pulse / journey vision fallback / graph issue pages** — see [docs/scan-roadmap.md](./docs/scan-roadmap.md) demand triggers. Do not ship without the listed signal.

## Not planned

- Enterprise compliance reports (SOC2, HIPAA)
- Custom rubric creation
- Batch/API scanning for non-MCP use
- Desktop/mobile apps
- AI model training on user data
- Bug bounty program
- On-premise deployment

## Completion signals

| Item | Signal |
|------|--------|
| 100 paying users | Monetization blockers closed, conversion >5% |
| Growth distribution | Organic traffic > paid acquisition |
| Agency viability | 10+ Agency subscribers, CI/CD integration live |
| Product-market fit | >20% MoM paid user growth for 3 consecutive months |
