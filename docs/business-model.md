# Business Model

FixFlags finishes what your AI started. The business model supports that loop: check, fix, re-check, prove.

## Free Tier Strategy

- **Free users get unlimited audits.** No hard wall. First 3 audits are full AI experience. After 3, audits run through the full pipeline (capture, check, judge) but AI-generated content (screenshots, AI flags, fix prompts) is gated at the display layer. The data is saved, so if they upgrade, their past audits unlock immediately.
- **Re-checks unlimited on all plans.**
- **Every free report is an upsell impression.** Deterministic results visible. "Upgrade to see what AI found" on every page.
- **Cost is negligible at this stage.** LLM cost per audit is ~$0.00025 (gpt-4o-mini). Prioritize distribution over optimization.

Why: habit over scarcity. More users = more data = stronger moat = more upgrades.

## Pricing Philosophy

- **Entry price: $29/mo.** Low enough to convert without justification. Raise after 100 paying users if retention supports it.
- **Flat-rate** over per-scan billing. "Unlimited re-checks" is stronger than "25 audits."
- **Re-checks never gated.** The core loop (check, fix, re-check, prove) is the habit.
- **Annual discount.** Target $19/mo annually on Pro.
- **No founding offers.** $29 is the real price. Founding offers create expectation debt.

## Pricing Tiers (Current)

| Tier | Price | Audits | Key Hook |
|------|-------|--------|----------|
| Free | $0 | Unlimited (3 full) | AI gated after 3. Unlimited re-checks. |
| Pro | $29/mo | 25/mo | AI review, screenshots, fix prompts, MCP |
| Agency | $99/mo | 100/mo | Share links, up to 5 projects |
| High Volume | Custom | 500+ | Contact sales |

Studio tier ($999) is retained in schema but not marketed.

## Target Customer

- **Primary:** Indie hackers, solo builders, and small teams shipping with AI tools (Cursor, Claude Code, Lovable, Bolt).
- **Secondary:** Anyone shipping a public URL who wants a second pass before sharing.
- **Not for:** Enterprise QA teams, manual test suites, compliance-driven orgs.

## Revenue Model

- Subscription-only (no per-check or usage billing).
- $500 Expert Review add-on (human report review).
- Future: agency white-label? Data licensing (aggregate flags report)?

## Moat Strategy

- **Data, not technology.** The AI wrapper is not defensible. But a database of flag patterns across thousands of sites is.
- Publish a "State of AI-built UIs" report with aggregate data. Become the authority on web UI quality.
- Fix prompts are the workflow innovation, not the AI judging. Anyone can run Lighthouse + GPT. Not everyone ships fix prompts tuned for AI editors.
