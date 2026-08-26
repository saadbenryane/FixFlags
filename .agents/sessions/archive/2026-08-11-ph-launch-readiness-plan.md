# Product Hunt Launch-Readiness Plan — 2026-08-11

**Author:** FixFlags CEO
**Status:** ACTIVE — this is the #1 company priority.
**Evidence basis:** live deployed surface verified this run.

## Verified current state (evidence)

- `https://fixflags.com` **live** → home/sign-in/post-login/docs all 200 (0.5s)
- `/api/health/ready` → **all subsystems green**: database, redis, worker, browser, storage, ai, pagespeed, auth, billing, email, productWatch
- Agent-led workspace **implementation-complete** (3,800 tests, build, accuracy, browser proof)
- **NOT true**: "blocked on operator fixtures / codex-root." Those are release-proof *credentials* for `verify:release`, NOT the launch gate.

## Green verdict = 5 things (critical path, owned by us)

| # | Gate | Evidence of green | Owner | Status |
|---|------|-------------------|-------|--------|
| 1 | **Reports accurate** | billing/auth/audit coverage ≥70% (`goal-p4-quality-tests`) | Engineering | In progress (crew running on free ladder) |
| 2 | **UI ready** | a11y defects fixed + axe passes 375/768/1280 (`goal-p5-a11y-design`) | Engineering | Crew rerouted to free ladder, resuming |
| 3 | **Journey verified live** | anon scan → claim → sign-in → real prompt end-to-end on fixflags.com | Customer | **Pending — THE critical gate** |
| 4 | **Marketing clean** | copy audit vs SOUL/voice + PH tagline/first-comment | Content/Brand | Rerouted to free ladder, starting |
| 5 | **Launch pack** | tagline, first-comment, 3 screenshots, pricing live, Watch demo | CEO+Growth | After 1–4 green |

## Critical path (dependency order)

```
3 (journey verified live)  ← hardest, prove it
   ↑
1 (accuracy 70%)  ─┐
2 (a11y)          ─┴── run in parallel (both already dispatched)
4 (marketing)     ───── parallel, low risk
```
- **The single gate that makes or breaks launch:** Gate 3 — a PH reviewer pastes a URL, sees real evidence, signs in, copies a real prompt. If that breaks on the live surface, nothing else matters.
- 1, 2, 4 run in parallel and are already dispatched/rerouted.

## Model routing (done)

- Customer → `openrouter/cohere/north-mini-code:free`
- Content/Brand → `openrouter/google/gemma-4-26b-a4b-it:free`
- Engineering crews (a11y ×2, quality-tests, smoke) → openrouter free ladder
- All thinking OFF. No crew on exhausted codex plan.

## What I need from you (Captain)

1. **SSO provider registration confirmation** — README requires `https://fixflags.com/api/auth/callback/google` + `/github` for sign-in buttons to light up. If not registered, Google/GitHub sign-in is dead on launch day. (`npm run auth:check` will confirm.)
2. **Stripe test→live confirmation** — billing is green at health, but confirm Stripe is in **live mode** (not test) for real PH signups. No action if already live.
3. **No action otherwise** — I can assemble the launch pack, run the journey proof, and drive 1/2/4 to completion without further input.

## Immediate next owner

**Customer executive** → prove Gate 3 on the live surface today. All others proceed in parallel.
