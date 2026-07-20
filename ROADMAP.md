# Roadmap

*Repository-level direction. Not a duplicate of external tracker. Vision: [knowledge/vision.md](./knowledge/vision.md). Sequencing: [knowledge/execution.md](./knowledge/execution.md).*

## Recently closed

- **Help Center — shipped.** `/help` hub + articles + MCP guide; live chat escalation; contextual links on failure/limit/billing; payment-failure user email. See `lib/help/`, `DECISIONS.md`.
- **Monetization blockers — CLOSED.** Automated coverage in CI via `npm run test:unit`. See [QUALITY.md](./QUALITY.md).
- **Scan depth Phase 1 — shipped.** Flow scan, slop detection, preview cards, og:image validation.
- **Ultimate audit Phases 0–4 — shipped.** Playwright-only stack, narrative report, Journey Review MVP, MCP plan-mode + re-check next-fixes.
- **Beat Scout precision foundations — shipped.** Network/API Flags, overlay blockers, action timeline, Product Contract MVP, truth labels.

## Now

- **Product Intelligence Evolution (Phase 0–1)** — Canonize vision docs; persist Project-scoped Product Intelligence; promote Finish Plan; Verify→Remember on re-check; MCP PI tool aliases; agent-evals for ranking. See board `product-intelligence-vision`.
  *Signal:* Contract edit persists on next scan; Finish Plan copy/re-check updates PI learnings.

- **Dogfood audit quality** — False positives, dupes, vague findings, weak prioritization; credible top-3 Finish Plan. Board `dogfood-audit-quality`.

- **Growth distribution** — anon → signed-up → paying conversion; upsell timing; re-engagement.
  *Signal:* >5% free-to-paid conversion.

- **Distribution harden** — Website Roast, badge API, `fixflags-cli`, IDE integrations: entitlements + docs accuracy. Do not market CLI as published npm global until publishable.

- **Residual hardening** — API route contracts, auth/session runtime tests, Touch-tier component tests. See [QUALITY.md](./QUALITY.md).

## Readiness (reconciled)

| Tier | Readiness | Residual CRITICAL |
|------|-----------|-------------------|
| Truth | ~90% | Form validation ratio test; score math edge cases |
| Strength | ~80% | API route contracts; rate limiting; auth/session runtime; CI parity with local `verify` |
| Touch | 10% | Report rendering per audit state; empty states |

## Next

- **Repo signals into Finish Plan** — Optional repo connect feeds Implementation Integrity into the same prioritized plan (entitlement expansion after thesis).
- **CLI understand / finish / verify / status** — Cloud-backed first; local runtime later ([knowledge/open-source.md](./knowledge/open-source.md)).
- **Scheduling / recurring scans** — After Remember works; email on regressions.
  *Signal:* Users ask for automatic checks / churn from one-and-done scanners.
- **Evolution tracking** — Trend quality over time per Product / URL.
- **MCP polish** — Lovable/Bolt MCP; PI tools refined.
- **Knowledge graph Phase 2** — Public issue/benchmark pages (growth graph, not customer PI). See `docs/growth/growth-roadmap.md`.

## Later

- Portable PI export + open protocol/local pieces
- Agent Integrity checks (instruction drift)
- Design Integrity as first-class pass
- CI/CD integration, team workspaces, white-label share branding
- Authenticated journey architecture (staged)
- Personas, testing modes, full session video (demand-triggered)
- Platform-native `.fixflags` subdomain trick

## Not planned

- General coding agent / IDE / chatbot
- Migrating UI rubrics to five integrity dimensions before thesis validation
- Training shared models on customer Product Intelligence by default
- Open-sourcing the Intelligence Network
- Enterprise compliance reports (SOC2, HIPAA) as a product line
- Custom rubric creation
- Batch/API scanning for non-MCP use
- Desktop/mobile apps
- Bug bounty program
- On-premise deployment (until enterprise demand justifies)

## Completion signals

| Item | Signal |
|------|--------|
| PI thesis | Contract persistence + Finish Plan action + Remember on re-check |
| 100 paying users | Monetization blockers closed, conversion >5% |
| Agency viability | 10+ Agency subscribers, CI/CD or white-label share demand |
| Product-market fit | >20% MoM paid user growth for 3 consecutive months |
