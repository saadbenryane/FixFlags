# Strategy

**Canonical home for business model direction.** Live shipped pricing: [PRODUCT.md](../PRODUCT.md) and `lib/billing/plans.ts`. Vision: [vision.md](./vision.md).

## Pricing (new — product/journey model)

The new model sells products and journeys, not URL-check credits.

| Product | Price | What it includes |
|---------|-------|-----------------|
| **Quick Check** (Free) | $0 | One active product, three public Quick Checks per month, one complete Flag before signup, three complete Flags with free account, fix prompts, one saved re-check, private report |
| **Finish Check** (one-time) | $49 | One product, three important journeys, desktop and mobile, public or staging environment, test-account support, complete replay and evidence, full Finish Plan, builder-ready fixes, unlimited re-checks for seven days |
| **Pro** (monthly) | $39/mo | One active product, five saved journeys, deployment-triggered checks, before-and-after history, GitHub integration, CLI and MCP, confirmed regression alerts, included monthly journey allowance, additional usage available |
| **Studio** (monthly) | $129/mo | Up to ten active products, twenty-five saved journeys, client-ready reports, team access, project templates, GitHub and deployment integrations, branded exports, more included runs, priority support |

**Pricing rule:** Do not sell "credits" in the primary interface. Customers should understand products, journeys, checks after deploy, and re-checks. Technical usage can exist behind fair limits.

Adjacent tools currently range from low-cost browser access around $19 monthly, website-feedback products from roughly $39 monthly, AI testing products from $69 to $125 monthly and higher. The proposed FixFlags range is plausible but must be validated through actual purchases.

## Pricing (current — shipped)

| Tier | Plan enum | Price | New URL checks | Key hook |
|------|-----------|-------|----------------|----------|
| Free | `FREE` | $0 | 3 lifetime | Full report after claim, unlimited re-checks on owned reports |
| Pro | `BUILDER` | $39/mo | 25/mo | Compare, MCP / API keys, Journey Review |
| Studio | `TEAM` | $129/mo | 100/mo | Share links, projects, GitHub repo scans |

Display name **Studio** maps to `TEAM`. Do not use "Max" in docs.

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

## Cost targets

- Quick Check: below $0.25
- Finish Check: below $3
- Normal Watch run with no issue: below $0.50
- Deep authenticated check: below $5
- Gross margin: above 80% across paid usage

## Targets

Near-term operating plan: [docs/year-1-operating-plan.md](../docs/year-1-operating-plan.md) (Studio naming). Long-term blend of builders + agencies/studios + teams; agencies carry disproportionate MRR.

## Open math

At $39/$129, Year-1 MRR targets require either more customers, a price increase, or a higher tier. GTM decision; docs do not invent a fix.
