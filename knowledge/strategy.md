# Strategy

**Canonical home for business model direction.** Live shipped pricing: [PRODUCT.md](../PRODUCT.md) and `lib/billing/plans.ts`. Vision: [vision.md](./vision.md).

## Pricing (current — shipped)

| Tier | Plan enum | Price | Product reviews | Deep reviews | Notes |
|------|-----------|-------|-----------------|--------------|-------|
| Free | `FREE` | $0 | 3 lifetime | 1 teaser (lifetime) | Update reviews consume product-review credits |
| Pro | `BUILDER` | $69/mo | 25/mo | 4/mo | Compare, MCP, product watch |
| Studio | `TEAM` | $199/mo | 80/mo | 10/mo | Share links, projects, GitHub scans |

Display name **Studio** maps to `TEAM`. Enforcement: `lib/billing/plans.ts`, `lib/audit/usage.ts`.

Update reviews consume product-review credits. Product watch-triggered re-checks skip the manual credit pool.

## Directional packaging (implementation follow-on)

Aligned with Product Intelligence layers but not a separate billing schema today.

- **Free**: Public, local analysis plus ranked fixed findings and ranked one-time trial value.
- **Builder**: Persistent Product Contract, deeper evidence history, more volume, and integrations.
- **Team / Studio**: Multi-project collaboration, release workflow, project-level retention.
- **Enterprise**: Later, if retention supports heavier workflow guarantees.

Additional revenue (later): expert review, benchmarks, certification, agency tooling, API.

## Pricing philosophy

- Price reflects verified quality improvements, reduced churn risk, and verified fix outcomes.
- Entry is low-friction; retention is tied to recurring assurance.
- Do not over-index on pricing theater in the first value surface.
- Deterministic checks before expensive AI and strict usage bounds keep margins viable.

## Unit economics

Browser automation, screenshots, models, and storage create variable cost. Strict limits protect margins.

## Cost targets (naming only)

- Product Review: under a safe unit cost envelope.
- Deep Review: under deeper run budget.
- Watch run: under recurrence maintenance envelope.
- Gross margin: above 80% across paid usage.

## Targets

Near-term operating plan: [docs/year-1-operating-plan.md](../docs/year-1-operating-plan.md) (Studio naming). Long-term blend of builders + agencies/studios + teams; agencies carry disproportionate MRR.
