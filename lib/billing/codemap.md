# lib/billing/ - Billing & Subscriptions

## Responsibility
Subscription management, credit tracking, audit limits, Stripe integration, cost estimation.

## Entry Points
| File | Purpose |
|------|---------|
| `limits.ts` | Audit limits per plan (Free: 3 lifetime, Pro: 5/mo, Studio: 25/mo) |
| `credits.ts` | AI credit tracking (prescription costs credits) |
| `plans.ts` | Plan definitions + feature gates |
| `config.ts` | Stripe config (prices, products) |
| `costs.ts` | `MODEL_RATES` for LLM cost estimation (keep in sync with `judge-config.ts`) |
| `env.ts` | Billing environment variables |
| `notify.ts` | Usage threshold notifications |
| `upgrade-moments.ts` | Upgrade prompt triggers |

## Architecture
- **Plans:** Free (3 lifetime new URL checks), Pro $39/mo (5/mo), Studio $129/mo (25/mo)
- **Credits:** AI prescription gated by `includeAi` + available credits
- **Stripe:** Hosted Checkout + Customer Portal + webhooks (`app/api/stripe/webhook/route.ts`)
- **Cost tracking:** Cache-aware (`estimateLlmCostUsd` prices cache reads/writes differently)

## Integration Points
- **Audit creation:** `lib/audit/create-audit.ts` checks limits before enqueue
- **AI prescription:** `lib/audit/enqueue-ai-review.ts` checks credits
- **Stripe webhook:** `app/api/stripe/webhook/route.ts` updates subscription state
- **Cost persist:** `lib/audit/persist.ts` calls `persistAuditRunCost` with cache-aware tokens

## Invariants
- Re-checks are free and unlimited (never gate them)
- Anonymous wedge: 1 teaser audit (triage only, fix prompts stripped)
- Claimed teaser counts as 1 of Free's 3 lifetime checks
- `MODEL_RATES` in `costs.ts` must stay in sync with `judge-config.ts` model IDs
