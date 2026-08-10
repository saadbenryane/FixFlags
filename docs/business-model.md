# Business Model

*Last updated: 2026-08-10*

FixFlags is Product QA for AI-built products. The business model supports the loop: Flag, Fix, Update review.

See [`year-1-operating-plan.md`](./year-1-operating-plan.md) for Year 1 revenue, customer, and growth targets. Stripe wiring: [`stripe-setup.md`](./stripe-setup.md).

## What We Ship

- **Product review** (within plan quota): full report across Message, Experience, and Reach with Flags, evidence, and fix prompts.
- **Update review** on the same URL: uses one product review credit; diffs Flags after you fix.
- **Deep review** (paid quota): journeys, funnel map, and path playback.
- **Before/after compare** (Pro+): side-by-side proof after update reviews.
- **MCP integration** (Pro+): MCP tools for Cursor and Claude Code (see `AGENTS.md` Project facts).
- **Share links and proof export** (Studio): public report links and client-ready summaries.

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

- **Free accounts get 3 product reviews (lifetime)** and **1 deep review teaser (lifetime)**.
- **Update reviews use the same product review credits** as new URLs.
- **At limit, product reviews pause** until upgrade or the next billing cycle.
- **Every free report is an upsell impression.** Upgrade when you ship weekly and need MCP, compare, or more reviews.

Pricing numbers: [`lib/marketing/copy/terminology.ts`](../lib/marketing/copy/terminology.ts) `PRICING_COPY`.

## Pricing Philosophy

- **Keep entry pricing easy to justify.** Target amounts live in marketing copy and [knowledge/strategy.md](../knowledge/strategy.md).
- **Flat-rate subscription** for monthly product review and deep review quotas.
- **Hard stop at cap** with upgrade CTA. Credit packs are a future paid overflow option.
- **Annual discount:** Later (not at launch). Monthly only until retention justifies it.
- **Launch cohort:** 12-month launch-tier discount on paid joins (first 500 positions per plan get 25% off, next 500 get 15% off). One-time offers are retired; see [docs/stripe-setup.md](./stripe-setup.md), [lib/billing/discount-tiers.ts](../lib/billing/discount-tiers.ts), and [gtm-launch-strategy.md](./gtm-launch-strategy.md).

## Pricing Tiers (Marketing target)

| Plan | Price | Product reviews/mo | Deep reviews/mo |
|------|-------|--------------------|-----------------|
| Free | $0 | 3 | 1 teaser |
| Pro | $69/mo | 25 | 4 |
| Studio | $199/mo | 80 | 10 |

Shipped Stripe IDs and enforcement: `lib/billing/plans.ts`, `lib/audit/usage.ts`.

Display name **Studio** maps to `TEAM` enum.

## Target Customer

- **Primary:** AI-first founders, indie hackers, and small teams shipping with AI tools (Cursor, Claude Code, Lovable, Bolt, Replit) faster than they can QA.
- **Secondary:** Agencies and studios that need a premium QA report before every client launch.
- **Later:** Product teams using AI coding internally, once repo integration and CI/CD checks land ("CI for product quality").
- **Not for:** Enterprise QA teams, manual test suites, compliance-driven orgs.

## Revenue Model

- Monthly subscriptions (Pro / Studio).
- Future: credit packs as paid overflow for subscribers who exceed monthly quotas.
- Future: agency white-label? Data licensing (aggregate flags report)?

## Moat Strategy

- **Data, not technology.** The AI wrapper is not defensible. But a database of flag patterns across thousands of sites is.
- Publish a "State of AI-built UIs" report with aggregate data. Become the authority on web UI quality.
- Fix prompts are the workflow innovation, not the AI judging. Anyone can run Lighthouse + GPT. Not everyone ships fix prompts tuned for AI editors.
