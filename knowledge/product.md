# Product (pointer hub)

**Aspirational and model detail lives in dedicated files.** Shipped behavior: [PRODUCT.md](../PRODUCT.md). Vision: [vision.md](./vision.md).

| Topic | Canonical home |
|-------|----------------|
| Full vision | [vision.md](./vision.md) |
| Three products (Quick Check, Finish Check, Watch) | [product-system.md](./product-system.md) |
| Product Intelligence model, Contract seed, dismissals | [product-intelligence.md](./product-intelligence.md) |
| Integrity Engine, 5 dimensions, truth classes, security discipline | [integrity-engine.md](./integrity-engine.md) |
| Fix List artifact | [finish-plan.md](./finish-plan.md) |
| Evidence and severity rules | [evidence-rules.md](./evidence-rules.md) |
| User personas and journey | [user-journey.md](./user-journey.md) |
| Growth and distribution | [growth.md](./growth.md) |
| Launch requirements and validation | [launch-requirements.md](./launch-requirements.md) |
| Technical architecture spec | [technical-architecture-spec.md](./technical-architecture-spec.md) |
| Privacy | [privacy.md](./privacy.md) |
| Open source | [open-source.md](./open-source.md) |
| Near-term build order | [execution.md](./execution.md) |
| Pricing | [strategy.md](./strategy.md) + PRODUCT.md |

## Three products

| Product | Promise | Price |
|---------|---------|-------|
| **Quick Check** | See what you missed | Free |
| **Finish Check** | Test what customers came to do | $49 one-time |
| **Watch** | Know when an important path breaks | $39/mo (Pro) |

Detail: [product-system.md](./product-system.md).

## Two surfaces (progressive depth)

| Surface | Audience | Entry |
|---------|----------|-------|
| **Launch Check** | Lovable / Bolt / Replit / less-technical | URL → Fix list → fix → re-check |
| **Release Verification** | Agencies, developers, teams | URL + repo + history + CI (deeper over time) |

Architecture supports progressive depth. Marketing starts with Launch Check. Do not dump Release Verification into the first experience.

## Moat (short)

Knowing which failure matters, feedback precise enough to resolve it, and learning whether the repair worked — backed by persistent Product Intelligence. Precision is the product. Detail: [vision.md](./vision.md#moat).

## Benchmark

Internal human-validated eval set before expanding checks or traffic. Harness: `npm run agent:eval`. Metrics: blocker recall, false-blocker rate, evidence correctness, verified repair rate. This is a company asset; demos must not redefine quality.
