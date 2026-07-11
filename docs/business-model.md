# Business Model

*Last updated: 2026-07-10*

FixFlags is the QA layer for AI-built products. The business model supports the loop: Flag, Fix, Re-check.

See [`year-1-operating-plan.md`](./year-1-operating-plan.md) for Year 1 revenue, customer, and growth targets.

## What We Ship

- **Deterministic checks** (free forever, unlimited): metadata scanning, accessibility basics, performance data, SEO tags, trust signals, mobile viewport checks, content analysis, slop detection, og:image validation.
- **CTA flow test** (free): automated click-through on the primary CTA with before/after screenshots and flow flags.
- **Preview cards** (free): live Google snippet and social link preview rendered in the report.
- **Full report on every check** (free): deterministic scans plus AI review across Message, Experience, and Reach. Rubric scores, AI-generated flags, and fix prompts on every report.
- **Fix prompts** (free): copy-ready instructions tuned for Cursor, Claude Code, Lovable, and Bolt. Each prompt includes specific evidence from your page.
- **Re-check loop** (free, unlimited on owned reports): re-run the same URL and diff flags. This is the core habit.
- **Before/after compare** (Pro+): side-by-side proof after re-checks.
- **MCP integration** (Pro+): 13 MCP tools for Cursor and Claude Code (see `AGENTS.md` Project facts). Lovable/Bolt MCP not supported yet.
- **Share links and proof export** (Agency+): public report links and client-ready summaries.

## What We Do Not Ship (Current)

- Staging / password-protected site support.
- Localhost or private network checks.
- CI/CD integration (GitHub Actions, Vercel deploy hooks). Not yet.
- Custom rubric creation.
- Team workspaces / seat management.
- API for batch scanning.
- White-label reports.

These are not planned until 100 paying users validate demand.

## Free Tier Strategy

- **Free accounts get 3 new URL checks total.** Every check runs the full pipeline and returns the complete report with fix prompts.
- **Re-checks are unlimited on reports you own** and never count against the 3-check cap.
- **Every free report is an upsell impression.** Deterministic results visible. Upgrade when you ship weekly and need MCP, compare, or more new checks.
- **Cost is negligible at this stage.** LLM cost per audit is ~$0.00025 (gpt-4o-mini). Prioritize distribution over optimization.

Why: habit over scarcity. More users = more data = stronger moat = more upgrades.

## Pricing Philosophy

- **Entry price: $29/mo.** Low enough to convert without justification. Raise after 100 paying users if retention supports it.
- **Flat-rate** over per-scan billing. "Unlimited re-checks" is stronger than "25 audits."
- **Re-checks never gated.** The core loop (Flag, Fix, Re-check) is the habit.
- **Annual discount.** Target $19/mo annually on Pro.
- **No founding offers.** $29 is the real price. Founding offers create expectation debt.

## Pricing Tiers (Current)

Live tiers, as defined in `lib/billing/plans.ts` (`Plan` enum: `FREE | BUILDER | TEAM`):

| Tier | Plan enum | Price | New URL checks | Key Hook |
|------|-----------|-------|----------------|----------|
| Free | `FREE` | $0 | 3 lifetime | Full report, unlimited re-checks on owned reports |
| Pro | `BUILDER` | $29/mo | 25/mo | Unlimited re-checks + compare, MCP integration |
| Agency | `TEAM` | $99/mo | 100/mo | Everything in Pro, public share links, up to 5 projects |

Display name **Agency** maps to `TEAM` enum. There is no Studio tier in the schema.

## Target Customer

- **Primary:** AI-first founders, indie hackers, and small teams shipping with AI tools (Cursor, Claude Code, Lovable, Bolt, Replit) faster than they can QA.
- **Secondary:** Agencies and studios that need a premium QA report before every client launch.
- **Later:** Product teams using AI coding internally, once repo integration and CI/CD checks land ("CI for product quality").
- **Not for:** Enterprise QA teams, manual test suites, compliance-driven orgs.

## Revenue Model

- Subscription-only (no per-check or usage billing).
- Future: agency white-label? Data licensing (aggregate flags report)?

## Moat Strategy

- **Data, not technology.** The AI wrapper is not defensible. But a database of flag patterns across thousands of sites is.
- Publish a "State of AI-built UIs" report with aggregate data. Become the authority on web UI quality.
- Fix prompts are the workflow innovation, not the AI judging. Anyone can run Lighthouse + GPT. Not everyone ships fix prompts tuned for AI editors.
