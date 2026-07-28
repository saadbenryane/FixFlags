# Business Model

*Last updated: 2026-07-19*

FixFlags is the QA layer for AI-built products. The business model supports the loop: Flag, Fix, Re-check.

See [`year-1-operating-plan.md`](./year-1-operating-plan.md) for Year 1 revenue, customer, and growth targets. Stripe wiring: [`stripe-setup.md`](./stripe-setup.md).

## What We Ship

- **Full report on each new URL check** (within plan quota): deterministic scans plus AI review across Message, Experience, and Reach. Rubric scores, flags, and fix prompts.
- **Re-check loop** (free, unlimited on owned reports): re-run the same URL and diff flags. This is the core habit.
- **Before/after compare** (Pro+): side-by-side proof after re-checks.
- **MCP integration** (Pro+): MCP tools for Cursor and Claude Code (see `AGENTS.md` Project facts).
- **Share links and proof export** (Agency): public report links and client-ready summaries.
- **Credit packs** (paid plans): +10 / +25 / +50 new URL checks ($15 / $30 / $50). Overflow only; does not change tier.

## What We Do Not Ship (Current)

- Staging / password-protected site support.
- Localhost or private network checks.
- CI/CD integration (GitHub Actions, Vercel deploy hooks). Not yet.
- Custom rubric creation.
- Team workspaces / seat management.
- API for batch scanning.
- White-label reports.
- Annual billing (monthly only at launch).

These ship when they serve the core loop and users ask for them.

## Free Tier Strategy

- **Free accounts get 3 new URL checks total.** Every check runs the full pipeline and returns the complete report with fix prompts.
- **At limit, new URL checks are blocked** until upgrade. Re-checks on owned reports stay free.
- **Every free report is an upsell impression.** Upgrade when you ship weekly and need MCP, compare, or more new checks.
- **Cost is negligible at this stage.** Prioritize distribution over optimization.

Why: habit over scarcity. More users = more data = stronger moat = more upgrades.

## Pricing Philosophy

- **Keep entry pricing easy to justify.** Current amounts and any pricing experiments live in [knowledge/strategy.md](../knowledge/strategy.md).
- **Flat-rate subscription** for the monthly new-check quota. Credit packs are optional overflow for paid plans.
- **Re-checks never gated.** The core loop (Flag, Fix, Re-check) is the habit.
- **Annual discount:** Later (not at launch). Monthly only until retention justifies it.
- **No founding offers.** Founding offers create expectation debt.

## Pricing Tiers (Current)

Current tier amounts and strategy live in [knowledge/strategy.md](../knowledge/strategy.md).
Shipped names, quotas, and capabilities come from `lib/billing/plans.ts` and [PRODUCT.md](../PRODUCT.md).

Display name **Agency** maps to `TEAM` enum. There is no Studio tier in the schema.

## Target Customer

- **Primary:** AI-first founders, indie hackers, and small teams shipping with AI tools (Cursor, Claude Code, Lovable, Bolt, Replit) faster than they can QA.
- **Secondary:** Agencies and studios that need a premium QA report before every client launch.
- **Later:** Product teams using AI coding internally, once repo integration and CI/CD checks land ("CI for product quality").
- **Not for:** Enterprise QA teams, manual test suites, compliance-driven orgs.

## Revenue Model

- Monthly subscriptions (Pro / Agency).
- Credit packs as paid overflow for subscribers who exceed monthly new-check quota.
- Future: agency white-label? Data licensing (aggregate flags report)?

## Moat Strategy

- **Data, not technology.** The AI wrapper is not defensible. But a database of flag patterns across thousands of sites is.
- Publish a "State of AI-built UIs" report with aggregate data. Become the authority on web UI quality.
- Fix prompts are the workflow innovation, not the AI judging. Anyone can run Lighthouse + GPT. Not everyone ships fix prompts tuned for AI editors.
