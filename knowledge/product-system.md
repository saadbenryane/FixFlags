# Product System

**Canonical home for the three FixFlags surfaces:** Product Review, Deep Review, and Watch. Shipped facts are in [PRODUCT.md](../PRODUCT.md). Vision is in [vision.md](./vision.md).

## Core loop

**Product Review → Fix → Verify → Watch**

The unit of value is a verified fix. The public loop is:
1. run a product review,
2. apply the highest-priority evidence-backed fixes,
3. prove fixes in a follow-up review (update review),
4. keep recurring verification for important paths (Watch).

## One intelligence, multiple surfaces

Product review, deep review, and watch share one Product Contract + Product Intelligence source.
Audience packaging is contextual, not separate products.

## Three products (shipped)

### A. Product Review

The URL-first acquisition and core product surface.

**Input:** a public or staging URL. No account required before the first value appears.

**What it gives:**
- deterministic capture and structured checks,
- a ranked `Flag` list,
- public-safe evidence and screenshots,
- scoped copy for immediate confidence,
- one complete finding and the first progress proof before signup.

**What it does not include:**
- authenticated flows,
- full multi-journey depth,
- private account history before claim.

**After account creation:**
- all confirmed Flags,
- fix prompts,
- update reviews on the same URL within the monthly allowance,
- history surfaces and authenticated report context.

### B. Deep Review

The deeper monthly-usage unit for important customer paths.

**User promise:** run your important path(s) to completion and record what actually changed.

**What it includes:**
- multiple paths / assertions,
- multi-viewport replay,
- separate deep review credits,
- stronger confidence on friction and completion conditions,
- stronger change attribution for builder handoff.

**Metering model:** deep reviews consume the separate monthly deep review allowance on every plan.

### C. Watch

The recurring verification surface.

**User promise:** know when important paths drift after deployment.

**What it includes:**
- scheduled re-verification,
- regression detection from saved paths,
- changed/unchanged evidence summaries,
- compact alerts + history visibility,
- allowance-aware pause and renewal messaging.

## Activation and paywall design

### Before signup
Show enough to establish trust: what was checked, what changed, and one complete finding with evidence.

### Free-account gate
Ask for account creation to unlock all Flags, fix prompts, update reviews, full history, and private memory.

### Usage upgrade
Every plan includes the same authenticated web product.
Paid plans provide more product reviews and deep reviews each month.
New URLs, update reviews, and completed Watch reviews share the product review allowance.

## Priority tiers

| Priority | Surface | Must include |
|----------|---------|-------------|
| P0 | Product Review | Public URL submission, route/action checks, desktop+mobile, console/network capture, metadata/a11y/performance checks, evidence-backed Flags, scope transparency, one result before signup |
| P1 | Deep Review | Progressively richer path testing, success assertions, deterministic/fallback behavior, replay, complete evidence, re-run and update review verification |
| P2 | Authenticated depth | Test-account support, role-aware flows, safe credentials handling |
| P3 | Watch | Scheduled review path, allowance-aware pause, regression signaling, alert surface |
| P4 | Repeated workflow | multi-product context, client-ready evidence, and review history |
| P5 | External evidence integration | structured correlation with external signals and real-user telemetry |

## What we will not build first

- Native mobile testing inside this core loop.
- Enterprise test management suite.
- Native product-analytics replacement.
- Full session video platform.
- Automated production payments.
- Automated destructive actions.
- Arbitrary “quality score first” product.
