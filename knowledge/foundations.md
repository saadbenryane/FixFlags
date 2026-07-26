# Foundations

First-principles for FixFlags. Full narrative: [vision.md](./vision.md). Read vision before making product, architecture, or strategy decisions.

## Thesis

AI reduces the cost of creating software. That increases the supply of plausible-looking products and the cost of knowing which are ready. FixFlags captures value by becoming the independent Product Intelligence System that understands the Product, improves it through a ranked Fix list, verifies reality, and remembers what was proven.

**The company optimizes for:** judgment over volume, evidence over assertion, verified outcomes over completed tasks, and recurring Product Intelligence over isolated audits.

## Core brand idea

> Looks done is not the same as ready.

Challenge unsupported confidence. Do not attack AI building itself.

**Wedge promise (acquisition):** Confidence earned through independent checking.

**Long-term promise:** Continuously finish and protect the Product without losing its identity.

## Independence

| Role | Responsibility |
|------|----------------|
| Builder | Defines intent |
| Coding agent | Implements |
| FixFlags | Evaluates live result and maintains Product Intelligence |
| User | Decides what is acceptable |

Independence is brand, architecture, and business model.

## Principles (canonical short list)

1. **The Product is the core object** — repos, URLs, and code are signals.
2. **Understand before judge** — Product Contract / Product Intelligence precedes deep evaluation.
3. **Evidence before recommendation** — every Flag carries truth class and proof.
4. **Prioritize without hiding** — the Fix list ranks every verified unresolved Flag.
5. **Verify before confidence** — re-check is part of the product, never gated.
6. **Remember for the Product** — learnings belong to customer Product Intelligence, not one chat.
7. **Customer owns Product Intelligence** — FixFlags owns the Integrity Engine. See [privacy.md](./privacy.md).
8. **Progressive depth** — same truth; basic UX simple, advanced UX deep.
9. **Precision over check count** — false blockers destroy trust.
10. **Security is bounded** — never claim "your app is secure" from URL-only signals.
11. **Wedge before platform** — Launch Check acquires; continuous verification retains.
12. **Distribution before premature depth** — ship the loop; expand dimensions with demand.

Longer historical research notes (confirmed / refined / rejected) remain below for agents doing market work.

## Research validation

### Confirmed

- Trust and verification are genuine market problems
- AI builders fear failures that only appear when outsiders use the product
- Pre-launch is a strong emotional entry point
- Independent re-checking differs from code generation
- Basic builders and developers need progressive depth, not separate products
- AI development is growing faster than trust (Stack Overflow 2025: 51% daily AI use, 29% trust in accuracy)
- DORA connects greater AI adoption with lower delivery stability when teams increase output without improving controls
- Creation tools are already adding browser testing (Lovable, Replit Agent, Cursor agents), making "AI agent that clicks through your app" not a durable advantage
- Generic website audits are expected to be free (HubSpot Website Grader, Cloudflare URL scanning), validating free URL input as distribution
- Synthetic agents are not real customers; they expose objective failures but cannot reliably predict human motivation or behavioral variation (Nielsen Norman Group)
- Browser agents remain unreliable on long or ambiguous tasks (strongest 2026 system: 44.5% on long-horizon tasks)

### Refined

- "QA for AI-built products" is too narrow as the long-term category; use Product Intelligence for strategy, keep Launch Check language for acquisition
- Report should lead with the ranked Fix list and journey evidence, not a score
- Product intent must be captured before deep judgment
- Security cannot be a simple readiness dimension
- A recurring product requires a recurring trigger: "We changed the product. Did we break something important?"
- The most credible recurring buyers are freelancers shipping client work, small agencies delivering several products, and small product teams deploying frequently

### Rejected

- **"The browser agent is the moat"** — Browser automation is becoming a commodity and is increasingly embedded in AI builders
- **"More findings create more value"** — More findings often produce more noise, work and distrust. Three undeniable findings are more valuable than fifty speculative observations
- **"A score creates confidence"** — Only when the score is calibrated and meaningful. Journey outcomes and evidence should lead; scores should be secondary or removed until validated against real outcomes
- **"Indie builders alone create a durable business"** — Unproven. Solo builders are ideal for distribution but price-sensitive and may only need the product around a launch
- **"Collecting reports automatically creates a moat"** — The valuable data loop is: pattern found → customer accepted it → change made → same task passed afterward. Only verified outcomes compound into proprietary judgment
- A mega-prompt is the core product
- A URL audit can reliably identify source files
- The same AI system should implement and certify the result
- Pre-launch checks alone create strong subscription retention
- Every finding should be expressed with equal confidence
