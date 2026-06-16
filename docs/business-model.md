# Business Model

FixFlags finishes what your AI started. The business model supports that loop: check, fix, re-check, prove.

## Free Tier Strategy

- **Deterministic checks are free forever with no limit.** No caps, no gating. Every free check is an upsell impression and a data point for our moat.
- **First 3 audits** include the full experience: AI review + fix prompts + screenshots. This shows the ceiling of what paid unlocks.
- **After 3, free tier continues** with deterministic checks only. Every result page has "Upgrade to see what AI found" on every flag.
- **No screenshots on free.** Puppeteer compute is expensive. Free reports show evidence text but no captures.

Why: habit over scarcity. 100 free checks/month = 100 upsell CTAs vs. 3 and silence. Also beats the "just use Lighthouse" objection.

## Pricing Philosophy

- **Entry price: $19-29/mo.** $49/mo competes with free (Lighthouse) and feels expensive for solo builders.
- **Flat-rate unlimited** over per-scan billing. Psychology of "unlimited" is stronger than "25 audits."
- **Re-checks are never gated.** The core loop (check, fix, re-check, prove) is the habit. Do not interrupt it with paywalls.
- **Annual discount** to lock in committed users.

## Pricing Tiers (Current)

| Tier | Price | Audits | Key Hook |
|------|-------|--------|----------|
| Free | $0 | 3 full, unlimited deterministic | No screenshots, no AI after 3 |
| Pro | $49 ($29 founding) | 25/mo | Unlimited re-checks, MCP, AI, screenshots |
| Agency | $199 | 100/mo | Share links, up to 5 projects |
| Studio | $999 ($499 founding) | 500/mo | Up to 20 projects, agency use |
| High Volume | Custom | 500+ | Contact sales |

Note: pricing needs validation. $49 may be too high for the target market.

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
