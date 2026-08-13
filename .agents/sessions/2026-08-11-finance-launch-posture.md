# Finance Launch Posture — 2026-08-11

Mission: assess billing/cost readiness for "Game On: launch-complete" deploy.
Scope: read-only + focused, non-DB-mutating unit tests. No code, Stripe, or env changes made.

## Verdict

- **Billing/auth unit tests:** 386 passed, 0 failed, 0 live-DB touched (all mock `@/lib/db`).
- **Stripe webhook route:** 8/8 passed.
- **MODEL_RATES sync (judge-config.ts):** IN SYNC — every runtime model is priced; cache read/write persisted.
- **Free-tier exposure:** bounded per-user but Free sign-ups run the FULL judge (not triage-only teaser); the single dominant cost lever is provider selection (25x).
- **Launch gate:** do NOT open traffic until OPENAI_API_KEY provisioning is confirmed in the launch environment (keys are unset in this sandbox by design, but primary provider choice = 25x spend swing).

## 1. Test execution (focused suites)

Commands run exactly as specified (`npx vitest run`, no `npm run verify`, no DB-mutating suites):

```
npx vitest run lib/billing        -> 15 files, 201 passed (1.15s)
npx vitest run lib/auth           -> 8 files,  167 passed (855ms)
npx vitest run app/api/webhooks/stripe -> 1 file,  8 passed  (673ms)
```

- No suite required a live database. `costs.test.ts`, every `lib/auth/__tests__`, and `app/api/webhooks/stripe/__tests__/route.test.ts` all `vi.mock('@/lib/db')`; `entitlements.test.ts` and `permissions.test.ts` import the mocked `prisma`. No mutation observed (transform/setup only).
- Stripe route coverage: signature missing -> 400; bad signature -> 400 (no leak); idempotent replay (`received:true, replay:true`); same-payload race -> 200; payload-hash mismatch -> 409; subscription.created -> `applyPlanLimits('user_1','BUILDER')` + lifecycle row; invoice.payment_failed -> resync to FREE + notify; checkout.session.completed -> credit-pack fulfillment (PAID, creditsRemaining set).

Skipped (per brief): `npm run verify` (Engineering gate) and any DB-mutating/integration suites.

## 2. MODEL_RATES sync verdict — IN SYNC

`lib/audit/judge-config.ts` runtime model IDs (defaults, no env override) vs `lib/billing/costs.ts::MODEL_RATES`:

| judge-config.ts source (runtime default) | model id | MODEL_RATES price (USD/M) | status |
|---|---|---|---|
| DEFAULTS.openai.model / triage / chat | `gpt-4o-mini` | 0.15 / 0.60 | priced |
| DEFAULTS.anthropic.model (full judge) | `claude-sonnet-5` | 3 / 15 | priced |
| triage/chat anthropic default | `claude-haiku-4-5` | 1 / 5 | priced |

Provider chain default `JUDGE_PROVIDER_CHAIN='openai,anthropic'` (lib/env.ts:51) => OpenAI (gpt-4o-mini) is primary, Anthropic (claude-sonnet-5) is fallback.

Extra/legacy MODEL_RATES entries with no runtime usage in judge-config: `claude-opus-4-8` (forward), `claude-sonnet-4-20250514`, `claude-3-5-haiku-20241022` (legacy). These are harmless (no usage gap); codemap codifies legacy retention for historical row pricing (lib/billing/codemap.md:34). `gpt-4o` appears only in test fixtures (finalize.test.ts, finalize-from-outcome.test.ts), not at runtime; `claude-code` is an editor-catalog id (lib/docs/catalog.ts:113), not an LLM model.

Cache-read/cache-write persistence (AGENTS.md AI invariant): confirmed on the audit path — `lib/audit/pipeline/finalize-from-outcome.ts:126-127`, `lib/audit/finalize.ts:78,258-259`, `lib/audit/judge-triage.ts:202-203`, `lib/audit/judge-prescription.ts:234-235`, `lib/audit/journey/{evaluator,planner}.ts:148,184`. Pricing validates cache discounts in `costs.test.ts` (claude cache read 0.1x, write 1.25x; OpenAI cache read 0.5x, write 0).

## 3. Stripe webhook + entitlement gates — sound

- Signature verification + idempotency-by-payload-hash (route.ts constructEvent) -> no double-charge/double-count.
- `subscription.created` -> `applyPlanLimits` caps `auditsUsed` to the new plan limit (lib/billing/limits.ts:computePlanLimitUpdate); revoked subs (PAST_DUE/CANCELED/UNPAID) resync to FREE (hasRevokedSubscriptionStatus).
- Hard audit gate lives in create-audit.ts:167 `wouldBlockNewCheckWithCredits` + `resolveIncludeAiForNewAudit` (serializable tx, create-audit.ts:184-265). Re-checks are free/unlimited, never gated (codemap.md:29 / AGENTS.md).

## 4. Free-tier chat allowance + cost exposure

Confirmed caps (lib/billing/plans.ts: Free 25_000 / BUILDER 500_000 / TEAM 2_000_000 chat tokens/month). Labels Free/Pro/Studio (plans.ts:planLabel).

Chat is cheap-by-design: `getChatProviderConfig` (judge-config.ts:105-106) => `CHAT_MODEL ?? (anthropic claude-haiku-4-5 / openai gpt-4o-mini)`. Never sonnet unless an operator pins `CHAT_MODEL=claude-sonnet-5`. Max chat exposure: Free 25k @ $0.60/M = $0.015/mo; Studio 2M @ $5/M output = ~$10/mo if 100% output. Bounded and negligible vs. audit pipeline.

The real cost driver is the **audit LLM pipeline**, and the gating nuance matters:
- `resolveIncludeAiForNewAudit` (lib/audit/ai-report-entitlement.ts:14): anon (no userId) => includeAi=false (teaser triage only). **Signed-up Free users get includeAi=true for audits 1-3** (under their 3-lifetime limit, not at check limit) — i.e. the full judge runs, not just the teaser. Only audits 4+ are blocked (wouldBlockNewCheckWithCredits -> UPGRADE_REQUIRED).
- Per-audit AI cost (docs/journey-review-architecture.md): triage ~$0.001, prescription ~$0.01 (cheap path, lib/billing/codemap.md:166); **$0.05-0.15 per audit on the stronger model** (sonnet-5, line 185). Plus infra: pagespeed ~5 calls @ $0.005 (~$0.025) + browser ~30-60s @ $0.0001/s (~$0.003-0.006) (costs.ts computeInfraOverheadUsd). Observed audit latency 30-60s (journey-review-architecture.md:164).

## 5. Worst-case launch-week cost (per user, then volume)

Per Free user (3 full-AI audits, the signed-up free entitlement):

| Provider regime | LLM/audit | infra/audit | per-user (3 audits) |
|---|---|---|---|
| OpenAI primary (gpt-4o-mini) | ~$0.01 | ~$0.03 | ~$0.12 |
| Anthropic fallback (claude-sonnet-5, 25x) | ~$0.05-0.15 | ~$0.03 | ~$0.24-$0.54 |

- Output rate lever: gpt-4o-mini $0.60/M vs claude-sonnet-5 $15/M = **25x**; input 20x ($0.15 vs $3). Provider selection is the first-order spend knob, not volume.
- Paid Pro free trials / credit packs (lib/billing/credits.ts:CREDIT_PACKS: 10/$15, 25/$30, 50/$50) also run full AI at plan limits (BUILDER 25/mo, TEAM 80/mo) — far larger per-user ceilings than Free; exposure scales with paid conversion.

Volume: per-user figures need the launch-week free/paid funnel projection (not present in repo; AGENTS.md: heartbeat packet is the source of truth for expected volume). Rule of thumb for Finance: per-user spend above; total = per-user × signed-up-user-week. Example: 1,000 free signups/week -> $120 (gpt-4o-mini) to ~$540 (sonnet-5) of at-risk LLM+infra for the free tier alone, before paid conversions.

## 6. Open items needing CEO / operator decisions (ASK CAPTAIN)

1. **Provider provisioning (BLOCKER):** confirm `OPENAI_API_KEY` is set in the launch env so gpt-4o-mini (primary, 25x cheaper) is used. If absent, every audit falls to claude-sonnet-5. This single config choice dominates launch-week LLM spend. Sandbox has neither key (expected locally; verify in prod).
2. **Operator model overrides:** confirm `OPENAI_JUDGE_MODEL` / `ANTHROPIC_JUDGE_MODEL` / `TRIAGE_MODEL` / `CHAT_MODEL` are either empty (use defaults above) or, if pinned to a non-default model, that the model is added to `MODEL_RATES` — an unlisted override would price at sonnet-tier defaults (DEFAULT_INPUT_RATE 3 / DEFAULT_OUTPUT_RATE 15), silently inflating cost or under-reporting it.
3. **Free-tier AI scope policy:** confirm intent that signed-up Free users run the full judge for 3 lifetime audits (current behavior). If Finance wants to restrict Free AI to triage-only (cheaper), this is a code/policy change in `resolveIncludeAiForNewAudit` / `ai-report-entitlement.ts` (ASK; not auto-fixed).
4. **Launch volume projection:** provide expected free vs paid signup funnel for launch week so per-user exposure can be converted to a total cost budget.
5. **Per-user spend cap:** no hard spend limit / circuit-breaker is observed for the Free tier (exposure is bounded only by the 3-audit gate). If desired, this is a new control (ASK; not auto-fixed).
6. **Doc drift (triager):** `lib/billing/codemap.md` is stale vs `plans.ts`: prices ($39/$129 listed vs shipped $69/$199) and limits (5/mo, 25/mo listed vs 25/mo, 80/mo shipped); webhook path listed as `app/api/stripe/webhook/route.ts` (real: `app/api/webhooks/stripe/route.ts`); persist path listed as `lib/audit/persist.ts` (real: `lib/audit/finalize.ts`). No runtime risk, but misleads cost/planning readers. Flag for docs owner to reconcile.

## 7. Caveats

- No live provider calls or DB writes were made; tests are unit-level with mocked prisma. The stripe suite covers gateway-level replay/signature/cashflow logic but not end-to-end Stripe API integration.
- Per-audit cost figures are sourced from `docs/journey-review-architecture.md` (observed) and `costs.ts` rates (sticker). True realized cost requires live traffic read via `sumEstimatedCostByPlan` / `getCostOutliers` once billing traffic flows — infra is in place to measure, not just estimate.
- Rates are "sticker"; real cost includes cache discounts (persisted on the audit path, verified above) — so observed cost is typically below the maxTokens upper bound.
