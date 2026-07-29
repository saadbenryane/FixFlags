# Roadmap

*Repository-level direction. Not a duplicate of external tracker. Vision: [knowledge/vision.md](./knowledge/vision.md). Sequencing: [knowledge/execution.md](./knowledge/execution.md).*

## Recently closed

- **Beat Scout: precision over spectacle — shipped.** Network/API failure Flags, overlay click-blocker detection, structured action timeline, Product Contract, truth labels in model/API data. See board `beat-scout-precision` / `beat-scout-completeness`.
- **Docs and Help separation — shipped locally.** `/docs` owns product usage, reports, editor integrations, CLI, MCP, generated reference, search, and stable anchors. `/help` owns billing, account, failed checks, privacy, and human support. Credentialed production smokes for newly cataloged editors remain required before expanding the verified shipped-integration claim. See `lib/docs/`, `lib/integrations/`, `lib/help/`, and `DECISIONS.md`.
- **Monetization blockers — CLOSED.** Automated coverage in CI via `npm run test:unit`. See [QUALITY.md](./QUALITY.md).
- **Scan depth Phase 1 — shipped.** Flow scan, slop detection, preview cards, og:image validation.
- **Ultimate audit Phases 0–4 — shipped.** Playwright-only stack, narrative report, Journey Review MVP, MCP plan-mode + re-check next-fixes.
- **Beat Scout precision foundations — shipped.** Network/API Flags, overlay blockers, action timeline, Product Contract MVP, truth labels.

## Now

- **Product Hunt completion release** — canonical complete Fix list workspace, deterministic curated sample, claim retry integrity, scoped share grants, responsive/accessibility checks, route guards, and release verification. Canonical acceptance contract: `knowledge/report-contract.md`. First-value dogfood: [`.agents/sessions/customer-journey-completion-plan.md`](./.agents/sessions/customer-journey-completion-plan.md).
  *Signal:* anonymous URL → progressive complete Fix list with real evidence → one demonstrated prompt (clipboard real) → successful claim → copy remaining → free re-check → diff; Studio password share → canonical report → revoke.

- **Launch Check Completeness** — every unresolved Flag ranked in one report, Contract merge-not-wipe, Remember UI, claim→Project, dogfood twin suppressions, Studio share honesty, Project product watch. Board `current-product-completion`.
  *Signal:* Contract edit keeps learnings; Copy all fixes includes every unresolved prompt; watch enqueues FULL re-check; regression email on watched projects.

- **Customer journey trust close** — Anon evidence placeholders, dishonest Copy toast, score/BLOCKED contradiction, nav CTA clarity. Brand Phase 0 done (`fix-live-images`). Board `customer-journey-completion`.
  *Signal:* Phases 1-3 of customer-journey-completion-plan accepted on production dogfood.

- **New pricing model** — Replace URL-check credits with product/journey model. Quick Check (free), Finish Check ($49 one-time), Pro ($39/mo), Studio ($129/mo). See `knowledge/strategy.md`.
  *Signal:* Finish Check purchasable without sales call; Watch triggers on deployments.

- **Growth distribution** — anon → signed-up → paying conversion; upsell timing; re-engagement.
  *Signal:* >5% free-to-paid conversion.

- **Distribution harden** — Claim the initial `fixflags` npm package with operator 2FA, configure its trusted publisher, run the protected provenance release, then complete published-package CLI and MCP dogfood.

- **Residual hardening** — API route contract tests beyond critical path; auth/session coverage; Touch-tier matrix.
  *Evidence baseline:* [QUALITY.md](./QUALITY.md), [test-strategy.md](./test-strategy.md).

## Recently closed (also)

- **Product Intelligence Phase 0–1 foundations** — Project PI, Fix list UI, Remember writes, MCP context tools (thesis UI gaps closed in launch-check-completeness).
- **Dogfood audit quality** — Absorbed into launch-check-completeness.

## Readiness (reconciled)

Single honest baseline across [QUALITY.md](./QUALITY.md) and [test-strategy.md](./test-strategy.md):

| Tier | Readiness | Residual |
|------|-----------|----------|
| Truth | ~95% | Screenshot/flow/PageSpeed fixtures still not frozen into regression suite |
| Strength | ~85% | Remaining non-critical API routes; queue unit depth |
| Touch | ~35% | First-value dogfood gaps open (see customer-journey-completion-plan); density matrix still expanding |

Monetization blockers (regression fixtures, judge contract, persist layer, pipeline state machine, billing gating) are closed.

## Next

- **Repo signals into Fix list** — Optional repo connect feeds Implementation Integrity into the same prioritized list (entitlement expansion after thesis).
- **CLI understand / finish / verify / status** — Cloud-backed first; local runtime later ([knowledge/open-source.md](./knowledge/open-source.md)).
- **Evolution tracking** — Trend quality over time per Product / URL.
- **MCP proof and distribution** — deployed Lovable/Bolt connector smokes; PI tools refined.
- **Open community skills** — Extract the in-repo loop skill (`public/.well-known/skills/`, `ide-integrations/`) into a standalone OSS repo with Cursor, Claude Code, and Kiro install paths, an MCP tool contract manifest, and CI that lints skill tool names against the live MCP surface. Ship the core Check → Fix → Re-check loop only; keep internal operator skills (`.cursor/skills/fixflags-*`) proprietary. Accept community platform extensions (Lovable, Bolt, launch-gate, Re-check-only) via contribution templates. See [knowledge/open-source.md](./knowledge/open-source.md).
  *Signal:* one-command install of the core skill; help center MCP guide links to the canonical repo; community PRs pass tool-name contract lint; platform skills do not embed engine prompts or ranking logic.
- **Knowledge graph Phase 2** — Public issue/benchmark pages (growth graph, not customer PI). See `docs/growth/growth-roadmap.md`.

## Later

- Portable PI export + open protocol/local pieces
- Agent Integrity checks (instruction drift)
- Design Integrity as first-class pass
- CI/CD integration, team workspaces, white-label share branding
- Authenticated journey architecture (staged)
- Personas, testing modes, full session video (demand-triggered)
- Platform-native `.fixflags` subdomain trick

## Shipped retention (was Next)

- **Project product watch** — Prisma `watchInterval` / `watchNextRunAt`; recovery-scheduler tick; regression-only email. Pro/Studio. Manual re-check remains free for all owners.

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
| PI thesis | Contract persistence + Fix list action + Remember on re-check |
| 100 paying users | Monetization blockers closed, conversion >5% |
| Studio viability | 10+ Studio subscribers, CI/CD or white-label share demand |
| Product-market fit | >20% MoM paid user growth for 3 consecutive months |
