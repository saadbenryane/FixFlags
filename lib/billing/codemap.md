# lib/billing/ - Billing & Subscriptions

## Responsibility
Subscription management, credit tracking, audit limits, Stripe integration, cost estimation.

## Entry Points
| File | Purpose |
|------|---------|
| `limits.ts` | Monthly Product Review and deep-review limits from the canonical plan definitions |
| `credits.ts` | AI credit tracking (prescription costs credits) |
| `plans.ts` | Canonical plan names, prices, and usage allowances |
| `config.ts` | Stripe config (prices, products) |
| `costs.ts` | `MODEL_RATES` for LLM cost estimation (keep in sync with `judge-config.ts`) |
| `env.ts` | Billing environment variables |
| `notify.ts` | Usage threshold notifications |
| `upgrade-moments.ts` | Upgrade prompt triggers |

## Architecture
- **Plans:** Free (3 Product Reviews/month), Pro $29/month (15), Studio $79/month (50). Browser-path depth is included inside Product Reviews; legacy deep-review counters remain persistence-only.
- **Capabilities:** Every plan has the same web product. Plans differ by monthly usage only.
- **Credits:** AI prescription gated by `includeAi` + available credits
- **Stripe:** Hosted Checkout + Customer Portal + webhooks (`app/api/stripe/webhook/route.ts`)
- **Cost tracking:** Cache-aware (`estimateLlmCostUsd` prices cache reads/writes differently)

## Integration Points
- **Audit creation:** `lib/audit/create-audit.ts` checks limits before enqueue
- **AI prescription:** `lib/audit/enqueue-ai-review.ts` checks credits
- **Stripe webhook:** `app/api/stripe/webhook/route.ts` updates subscription state
- **Cost persist:** `lib/audit/persist.ts` calls `persistAuditRunCost` with cache-aware tokens

## Invariants
- New URLs, update reviews, and completed scheduled Watch reviews use the same Product Review allowance
- Usage periods roll atomically; Free uses UTC calendar months and paid plans use Stripe subscription periods
- Anonymous wedge: 1 teaser audit (triage only, fix prompts stripped)
- A claimed anonymous teaser counts once against the current monthly Product Review allowance
- `MODEL_RATES` in `costs.ts` must stay in sync with `judge-config.ts` model IDs
