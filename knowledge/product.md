# Product (pointer hub)

**Aspirational and model detail lives in dedicated files.**
Shipped behavior: [PRODUCT.md](../PRODUCT.md). Vision: [vision.md](./vision.md).

| Topic | Canonical home |
|-------|-----------------|
| Full vision | [vision.md](./vision.md) |
| Product Review, Update Review, Watch, and future Deep Review | [product-system.md](./product-system.md) |
| Product Intelligence model, Contract seed, dismissals | [product-intelligence.md](./product-intelligence.md) |
| Fix List artifact | [finish-plan.md](./finish-plan.md) |
| Evidence and severity rules | [evidence-rules.md](./evidence-rules.md) |
| User personas and journey | [user-journey.md](./user-journey.md) |
| Growth and distribution | [growth.md](./growth.md) |
| Launch requirements and validation | [launch-requirements.md](./launch-requirements.md) |
| Technical architecture spec | [technical-architecture-spec.md](./technical-architecture-spec.md) |
| Pricing | [strategy.md](./strategy.md) + PRODUCT.md |

## Core system surfaces

FixFlags is one Product Review system with supporting moments:
- **Product Review** (URL-first acquisition and paid usage unit)
- **Update Review** (fresh Product Review after a fix)
- **Watch** (recurring regression monitoring)
- **Deep Review** (future repository-connected analysis, not currently sold)

## Progressive depth (authenticated layers)

- **Public acquisition surface**: URL-only evidence, public-safe Flag set, quick confidence, and immediate next action.
- **Authenticated depth**: update reviews, one-click path retest, and recurring verification posture.

Architecture must ship both now and progressively strengthen both over time.

## Product Moat (short)

Know what failed, with evidence, then help the builder fix it and prove the result.
Precision is the product.

## Moat details

- Deterministic checks anchored to objective evidence.
- Product contract before interpretation.
- Evidence-first Flag anatomy with confidence and severity.
- Explicit truth levels and dismissal taxonomy.
- `Fix` artifact and `update review` continuity.
- Product Memory + Contract merge so each cycle improves the next run.

## User-facing outcome model

The loop is not a number game. It is: Flag, Fix, Update review.
