# Roadmap

*Repository-level direction. Not a duplicate of external tracker.*

## Recently closed

- **Beat Scout: precision over spectacle — shipped.** Network/API failure Flags, overlay click-blocker detection, structured action timeline, Product Contract, truth labels in model/API data. See board `beat-scout-precision` / `beat-scout-completeness`.
- **Help Center — shipped.** `/help` hub + articles + MCP guide; live chat escalation; contextual links on failure/limit/billing; payment-failure user email. See `lib/help/`, `DECISIONS.md`.
- **Monetization blockers — CLOSED.** All five items have automated coverage in CI via `npm run test:unit`. See [QUALITY.md § Monetization blockers](./QUALITY.md#monetization-blockers).
- **Scan depth Phase 1 — shipped.** Flow scan, slop detection, preview cards, og:image validation. See [scan-roadmap.md](./docs/scan-roadmap.md).
- **Ultimate audit Phases 0–4 — shipped.** Playwright-only stack, narrative report (Journey/Flow/Previews), Journey Review MVP (Pro+), corridor discovery + OG consistency, MCP plan-mode + re-check next-fixes. Remaining depth is demand-triggered (see Later / [scan-roadmap.md](./docs/scan-roadmap.md) Phase 3–4).

## Now

- **Distribution harden (built locally)** — Website Roast (`/roast`), badge API, `fixflags-cli`, IDE integrations exist in tree; harden entitlements, docs accuracy, and ship. Do not market as published npm global until CLI is publishable.
  *See:* `app/(marketing)/roast/`, `fixflags-cli/`, `ide-integrations/`.

- **Growth distribution** — improve conversion from anonymous → signed-up → paying:
  - Smooth onboarding flow
  - Better upsell timing and copy
  - Re-engagement for users who exhausted free AI reports
  *Signal:* >5% free-to-paid conversion.

- **Residual hardening** — not blocking ads, but required before scaling:
  - Extend API route contract tests beyond the critical path (checks, status, re-check, api-keys, projects)
  - Broader auth/session runtime coverage
  - Expand Touch-tier report-state matrix
  *Evidence baseline:* [QUALITY.md](./QUALITY.md), [test-strategy.md](./test-strategy.md).

## Readiness (reconciled)

Single honest baseline across [QUALITY.md](./QUALITY.md) and [test-strategy.md](./test-strategy.md):

| Tier | Readiness | Residual |
|------|-----------|----------|
| Truth | ~95% | Screenshot/flow/PageSpeed fixtures still not frozen into regression suite |
| Strength | ~85% | Remaining non-critical API routes; queue unit depth |
| Touch | ~35% | Progressive/failure/empty covered; full density matrix still expanding |

Monetization blockers (regression fixtures, judge contract, persist layer, pipeline state machine, billing gating) are closed.

## Next

- **Scheduling / recurring scans** — daily, weekly, or custom re-checks with email alerts on regressions. This is the retention hook. ScoutQA ships this; we don't.
  *Signal:* Users ask "can you check my site automatically?" / >10% churn from users who scan once and don't return.

- **Autonomous browser agent** — Playwright agent that navigates the app like a real user: fills forms, clicks buttons, tests auth flows, discovers issues beyond static HTML analysis. Our current Playwright only captures screenshots; this adds interaction-based testing.
  *Signal:* Users report functional bugs we missed / ScoutQA's autonomous testing gets traction.

- **Personas** — let users choose who the scan emulates: first-time visitor, power user, security tester, accessibility auditor. Each persona adjusts check weights, focus areas, and severity thresholds.
  *Signal:* Users ask "how does this look to a new visitor?" / ScoutQA's persona feature gets adoption.

- **Evolution tracking dashboard** — trend quality over time per URL. Show regression/progress charts. "Your accessibility score went from 62 to 84 after your last fix." Ties into scheduling.
  *Signal:* Users ask "did my score improve?" / re-check usage grows.

- **Full session video** — MP4/WebM replay. Action timeline + GIFs cover the live-proof job first; video only if users still ask.
  *Signal:* Users ask for scrubbable video after timeline ships.

- **Testing modes (Quick / Deep)** — let users pick scan depth. Quick = fast sanity check (60s). Deep = full audit (current default). Smart mode (natural language intent) is Phase 2.

  *Signal:* Users want faster scans / ScoutQA's mode selector gets usage.

- **Knowledge graph Phase 2** — deeper issue frequency pages, more benchmark content.
  *Signal:* Organic traffic from issue pages exceeds homepage traffic.

- **MCP polish** — Lovable/Bolt MCP support, tool refinements.
  *Signal:* MCP is reliable across all supported editors.

## Later

- **CI/CD integration** — GitHub Actions, Vercel deploy hooks. Runs audit on deploy preview.
  *Trigger:* Agency plan users requesting it / 10+ Agency subscribers.
- **Team workspaces** — seat management, shared projects, audit history.
  *Trigger:* 10+ Agency subscribers.
- **Labels, comments, mentions** — annotate flags, assign owners, notify teammates. Part of team collaboration.
  *Trigger:* Team workspaces shipped.
- **Test cases / reusable flows** — save specific check configurations and re-run them. "Test my checkout flow" as a saved, repeatable test with a test runner.
  *Trigger:* Users ask to re-run specific flows / ScoutQA's test cases get adoption.
- **Guardrail library** — promote findings to saved, repeatable health checks. Curate critical flows (onboarding, checkout, admin) into a shared library.
  *Trigger:* Test cases shipped.
- **Staging site support** — password-protected or localhost URL testing.
  *Trigger:* Feature request volume justifies complexity.
- **White-label reports** — branded PDF exports, custom domains.
  *Trigger:* Agency demand.
- **Help AI agent (Fin-style)** — retrieve from `lib/help` before human handoff.
  *Trigger:* Chat volume exceeds part-time human capacity.
- **Public status page** — uptime for scanner/API.
  *Trigger:* Paying customers ask for it.
- **Secret-leak scan** — detect exposed API keys in page source or bundles. ScoutQA has security scanning as a core dimension.
  *Trigger:* Agency plan users request it / >5 security-related support tickets.
- **Real-device mobile testing** — test on actual iPhone/Android, not just viewport emulation. ScoutQA tests mobile viewports; we capture a mobile screenshot.
  *Trigger:* Users report mobile-only bugs we missed.
- **PR automated reviews** — FixFlags reviews GitHub PRs and comments with findings. ScoutQA ships this.
  *Trigger:* CI/CD integration shipped + Agency subscribers.
- **Knowledge base per project** — organized insights from testing sessions, application graph, project summary. User-facing version of our internal knowledge graph.
  *Trigger:* Team workspaces shipped.
- **Platform-native integration** — `.fixflags` subdomain trick for Lovable/Replit/V0/Bolt (like ScoutQA's `.scoutqa`). Zero-config testing.
  *Trigger:* >500 Lovable/Replit users.
- **Journey vision expansion** — extend Journey Review MVP to cover more user flows, not just CTA clicks.
  *Trigger:* Journey Review usage grows.

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
