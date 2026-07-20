# Revenue Model

## Pricing (Current)

| Tier | Plan enum | Price | New URL checks | Key Hook |
|------|-----------|-------|----------------|----------|
| Free | `FREE` | $0 | 3 lifetime | Full report, unlimited re-checks on owned reports |
| Pro | `BUILDER` | $29/mo | 25/mo | Unlimited re-checks + compare, MCP |
| Agency | `TEAM` | $99/mo | 100/mo | Share links, projects, GitHub repo scans |

Display name **Agency** maps to `TEAM` enum. No Studio tier in schema yet.

## Pricing Philosophy

- Entry price low enough to convert without justification. Raise after 100 paying users if retention supports it.
- Flat-rate subscription for monthly new-check quota. Credit packs are optional overflow.
- Re-checks never gated. The core loop (Flag, Fix, Re-check) is the habit.
- No founding offers. $29 is the real price. Founding offers create expectation debt.

## Pricing Should Follow Consequences, Not Identity

Labels like Builder, Studio, Team are packaging. The actual pricing engine should be based on:

| Dimension | What it measures |
|-----------|-----------------|
| Projects | Number of distinct products tracked |
| Deep journeys | Number of critical paths tested per project |
| Run frequency | How often checks execute |
| Authenticated personas | Test accounts with different roles |
| Evidence retention | How long screenshots, traces, findings are kept |
| Integrations | GitHub, Vercel, MCP connections |
| Human review | Expert validation of high-risk Flags |
| Team collaboration | Seats, roles, approval states |

Browser monitoring products combine subscriptions with check-run allowances or overage pricing because execution volume creates real variable costs (e.g., Checkly prices browser-check overages by run volume).

## Target Revenue Model (12-Month)

| Segment | Customers | Avg. price/mo | Monthly MRR |
|---------|-----------|---------------|-------------|
| Builders (self-serve) | 600 | $49 | $29,400 |
| Studios | 100 | $399 | $39,900 |
| Teams | 30 | $499 | $14,970 |
| One-off launch reviews | — | — | ~$5,000 |
| **Total** | | | **~$84,270** |

**$84,270 MRR = ~$1.01M ARR.**

Agencies and studios carry almost half the target. Reaching it entirely through basic builders would require too many customers, too much support, and unusually strong six-month retention.

## Revenue at $1M ARR

| Metric | Value |
|--------|-------|
| Monthly revenue needed | ~$83,000 |
| Pure $29/mo customers required | ~2,860 |
| Pure $99/mo customers required | ~840 |
| Actual target | Blended mix (builders + studios + teams) |

## Segment Roles

| Segment | Role | What they create |
|---------|------|------------------|
| Basic builders | Volume, word of mouth, product data, future upgrades | Cultural relevance, funnel |
| Studios / agencies | Revenue, retention, distribution through client work | MRR, referrals |
| Teams | Revenue, long-term contracts, workflow integration | ARR stability |

## Tier Pricing (Proposed Evolution)

| Tier | Price | What they buy |
|------|-------|--------------|
| One-off Launch Check | $19-$49 | A launch outcome. Fits episodic demand. Sits between Free and Builder. |
| Builder | $39-$79/mo | Project memory, repeat checks, deep journeys |
| Studio | $199-$499/mo | Client throughput, risk reduction, branded reports |
| Team | $500-$2,000+/mo | Release-process integration, authenticated journeys, audit logs |

**The biggest missing product may be a one-off paid Launch Check.** It fits episodic demand instead of forcing every user into a subscription they will cancel after launch.

## Studio Pricing Rationale

Studios pay $299-$499/mo, not $99. They buy a business outcome:

> "Catch it before the client does."

They do not primarily pay for scan volume. They pay to:
- Avoid embarrassing client feedback
- Reduce manual review time
- Demonstrate professional quality

Studio needs:
- Multiple client projects
- Private branded reports
- Client-safe language
- Before-and-after evidence
- Team members and approval states
- Recurring checks
- Exportable launch summaries
- Optional white-labeling
- Predictable audit allowance

## Team Pricing Notes

- A $499 team tier may actually be too low for teams receiving material workflow value.
- Some contracts should land at $6,000-$15,000 annually.
- Sell annual contracts with: authenticated journeys, preview checks, shared project memory, role-based access, release history, higher run limits, priority support, API/MCP access, custom retention and privacy controls.

## Unit Economics Constraints

- Browser automation, screenshots, model calls, storage, and re-checks can become expensive.
- Use deterministic checks before expensive AI interpretation.
- Focused rather than full re-checks.
- Cached and reusable evidence.
- Lower-cost models for classification, premium models only for high-value reasoning.
- Strict anonymous limits.
- Usage allowances on paid plans.

## Open Math Gap

At current pricing ($29/$99), the 600-customer and $50-60k MRR targets in the Year 1 operating plan are not simultaneously achievable. Closing this gap requires one of:
- (a) A materially larger paying-customer count (~1,250-1,500)
- (b) A price increase on Pro/Max
- (c) A new higher-priced tier (agency/team above Max)

This is a GTM decision, not something docs resolve.
