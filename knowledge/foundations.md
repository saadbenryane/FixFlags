# Foundations

First-principles reasoning behind FixFlags. Read this before any product, code, or strategy decision.

## The Thesis

AI reduces the cost of creating software. As creation becomes cheaper, more products are produced by people who cannot fully inspect everything they generated. That increases the supply of plausible-looking software and the cost of determining which products are genuinely ready.

FixFlags captures that value by becoming the independent system that:

1. Understands what the product is trying to accomplish.
2. Tests its essential journeys in the live environment.
3. Identifies the failures that carry real consequences.
4. Expresses each failure as an evidence-backed behavioral contract.
5. Gives the builder's chosen agent a precise repair objective.
6. Repeats the journey and verifies the outcome.
7. Remembers what has been proven across future releases.

**The company optimizes for:** judgment over volume, evidence over assertion, verified outcomes over completed tasks, and recurring product memory over isolated audits.

## Core Brand Idea

> Looks done is not the same as ready.

FixFlags should never attack AI building itself. It should challenge unsupported confidence. The central promise is:

> Confidence earned through independent checking.

The scarce resource is not code. It is the ability to make a credible claim that the resulting product works.

## Independence

The same agent that generated a feature has incomplete incentives and context for judging its own work. The system needs independent evidence.

**Division of responsibility:**
- The builder defines intent
- The coding agent implements
- FixFlags evaluates the live result
- The user decides what is acceptable

This independence is part of the brand, architecture, and business model.

## 25 Foundational Principles

1. **Confidence through independent checking.** Sell confidence, not more generation.
2. **False confidence is the strongest pain.** "Looks done is not the same as ready."
3. **Release decision, not audit report.** Hierarchy: verdict, journey status, Flags, scores.
4. **Verify rendered outcomes, not generated code.** A successful build is not evidence.
5. **Independence is essential.** Builder, agent, reviewer, user are separate roles.
6. **Product intent precedes judgment.** Know what the product is supposed to do first.
7. **Generate and remember critical journeys.** Users cannot write test plans. FixFlags should.
8. **The Flag is the durable unit.** Reports, prompts, scores are formats. The Flag is the value.
9. **Precision over check count.** Three important problems beat fifty technically correct details.
10. **False blockers destroy trust.** Severity = consequence. Certainty = evidence. Always separate.
11. **Explicit truth system.** Every claim carries a truth class (Reproduced, Detected, Observed, Likely cause, Repository confirmed).
12. **Repair specification over prompt.** The contract is stable. The prompt is a rendering layer.
13. **Progressive depth.** Same truth at different depths. Default understandable without a repository.
14. **Complete loop before paywall.** Flag, Fix, Re-check, Verified. Not scan, score.
15. **Pre-launch is the wedge, not the business.** Acquisition product vs retention product.
16. **Change awareness over full rescan.** Test what changed, not everything again.
17. **Authenticated testing divides checker from verifier.** Core architecture problem, not a later setting.
18. **Security is carefully bounded.** Never provide a generalized "secure" verdict.
19. **Human calibration is an early advantage.** Selective human review builds proprietary judgment.
20. **Moat from outcomes, not detections.** The outcome graph is harder to reproduce than checklists.
21. **Dismissals are intelligence.** Each response type updates a different part of product memory.
22. **Agencies are a calibration and distribution channel.** Reports sent to clients introduce FixFlags.
23. **Reports distribute themselves.** Every shared report should be credible enough to forward.
24. **Pricing reflects consequence and recurrence.** Hybrid packaging, not one-size subscriptions.
25. **Private benchmark over public score.** Protect the company from confusing demos with quality.

## Research Validation

### Confirmed

- Trust and verification are genuine market problems
- AI builders fear failures that only appear when outsiders use the product
- Pre-launch is a strong emotional entry point
- Independent re-checking is meaningfully different from code generation
- Deployment infrastructure can support recurring verification
- Human oversight remains necessary in ambiguous testing contexts

### Refined

- "QA for AI-built products" is too broad
- "PageSpeed Insights for AI apps" is useful as an analogy but weak as a moat
- Report should lead with release decision and journey evidence rather than a score
- Product intent must be captured before deep judgment
- Security cannot be presented as a simple readiness dimension
- Basic builders and developers need progressive depth rather than separate products

### Rejected

- More checks automatically create more value
- A mega-prompt is the core product
- A URL audit can reliably identify source files
- The same AI system should implement and certify the result
- Pre-launch checks alone can create strong subscription retention
- Every finding should be expressed with equal confidence
