# Product System

**Canonical home for the FixFlags Product Review and its supporting surfaces.** Shipped facts are in [PRODUCT.md](../PRODUCT.md). Vision is in [vision.md](./vision.md).

## Core loop

**Product Review → Fix → Verify → Watch**

The unit of value is a verified fix. The public loop is:
1. run a product review,
2. apply the highest-priority evidence-backed fixes,
3. prove fixes in a follow-up review (update review),
4. keep recurring verification for important paths (Watch).

## One product, multiple moments

Product Review, Update Review, and Watch share one Product Contract + Product Intelligence source.
They are moments in one product loop, not separate products or capability tiers.

## The shipped product

### A. Product Review

The URL-first acquisition and core product surface.

**Input:** a public or staging URL. No account required before the first value appears.

**What it gives:**
- deterministic capture and structured checks,
- a ranked `Flag` list,
- public-safe evidence and screenshots,
- scoped copy for immediate confidence,
- one complete finding and the first progress proof before signup.

**What remains gated before account creation:**
- authenticated flows,
- fix prompts,
- private account history before claim.

**After account creation:**
- all confirmed Flags,
- fix prompts,
- update reviews on the same URL within the monthly allowance,
- history surfaces and authenticated report context.

### Watch

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
Paid plans provide more product reviews each month.
New URLs, update reviews, and completed Watch reviews share the product review allowance.

## Priority tiers

| Priority | Surface | Must include |
|----------|---------|-------------|
| P0 | Product Review | Public URL submission, route/action checks, desktop+mobile, console/network capture, metadata/a11y/performance checks, evidence-backed Flags, scope transparency, one result before signup |
| P1 | Product Review depth | Progressively richer path testing, success assertions, deterministic/fallback behavior, replay, complete evidence, re-run and update review verification |
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

## Future Deep Review

Deep Review is reserved for a future repository-connected analysis product.
It will combine the live Product Review with source-code context to explain structural causes and produce codebase-aware fixes.
Repository access, repository scanning, and editor protocols stay parked until the URL-first Product Review converts consistently.
Deep Review is not included in current plans, quotas, or checkout promises.
