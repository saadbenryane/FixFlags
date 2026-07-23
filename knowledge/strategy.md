# Strategy

**Canonical home for business model direction.** Live shipped pricing: [PRODUCT.md](../PRODUCT.md) and `lib/billing/plans.ts`. Vision: [vision.md](./vision.md).

## Pricing (current — shipped)

| Tier | Plan enum | Price | New URL checks | Key hook |
|------|-----------|-------|----------------|----------|
| Free | `FREE` | $0 | 3 lifetime | Full report after claim, unlimited re-checks on owned reports |
| Pro | `BUILDER` | $29/mo | 25/mo | Compare, MCP / API keys, Journey Review |
| Agency | `TEAM` | $99/mo | 100/mo | Share links, projects, GitHub repo scans |

Display name **Agency** maps to `TEAM`. Do not use “Max” in docs.

Re-checks are free and unlimited. Credit packs are paid overflow for new URL checks.

## Directional packaging (not in schema yet)

Aligned with Product Intelligence layers. Do not market until built.

| Layer | Intent |
|-------|--------|
| **Free** | Public/local analysis, basic PI, limited projects, ranked Fix list, essential browser checks |
| **Builder** | Deeper analysis, persistent PI, cloud-assisted reasoning, verification history, integrations, more usage |
| **Team / Studio** | Shared PI, collaboration, multi-repo/env, agent coordination, release workflows, client workspaces |
| **Enterprise** | Private deployment options, retention, SSO, audit logs, governance, org-wide PI |

Additional revenue (later): expert review, benchmarks, certification, agency tooling, API, intelligence reports, partners.

## Pricing philosophy

- Price reflects preventing wasted development, reducing agent thrash, accelerating release readiness, and improving outcomes.
- Entry price low enough to convert; raise after retention evidence.
- Consequence and recurrence matter more than identity labels.
- Deterministic checks before expensive AI; cache and incremental analysis. See vision Cost Efficiency.

## Unit economics

Browser automation, screenshots, models, and storage create variable cost. Strict anon limits. Usage allowances on paid plans. Persistent PI should reduce repeated tokens and re-exploration.

## Targets

Near-term operating plan: [docs/year-1-operating-plan.md](../docs/year-1-operating-plan.md) (Agency naming). Long-term blend of builders + agencies/studios + teams; agencies carry disproportionate MRR.

## Open math

At $29/$99, Year-1 MRR targets require either more customers, a price increase, or a higher tier. GTM decision; docs do not invent a fix.
