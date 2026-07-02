# Business Model

FixFlags is the QA layer for AI-built products. The business model supports the loop: Flag, Fix, Re-check.

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

| Tier | Price | New URL checks | Key Hook |
|------|-------|----------------|----------|
| Free | $0 | 3 lifetime | Full report, unlimited re-checks on owned reports |
| Pro | $29/mo | 25/mo | Compare, MCP, 25 new checks/month |
| Agency | $99/mo | 100/mo | Share links, exports, up to 5 projects |
| High Volume | Custom | 500+ | Contact sales |

Studio tier ($999) is retained in schema but not marketed.

## Target Customer

- **Primary:** AI-first founders, indie hackers, and small teams shipping with AI tools (Cursor, Claude Code, Lovable, Bolt, Replit) faster than they can QA.
- **Secondary:** Agencies and studios that need a premium QA report before every client launch.
- **Later:** Product teams using AI coding internally, once repo integration and CI/CD checks land ("CI for product quality").
- **Not for:** Enterprise QA teams, manual test suites, compliance-driven orgs.

## Revenue Model

- Subscription-only (no per-check or usage billing).
- $500 Expert Review add-on (human report review).
- Future: agency white-label? Data licensing (aggregate flags report)?

## Moat Strategy

- **Data, not technology.** The AI wrapper is not defensible. But a database of flag patterns across thousands of sites is.
- Publish a "State of AI-built UIs" report with aggregate data. Become the authority on web UI quality.
- Fix prompts are the workflow innovation, not the AI judging. Anyone can run Lighthouse + GPT. Not everyone ships fix prompts tuned for AI editors.
