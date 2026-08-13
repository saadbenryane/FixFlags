# CEO Launch Directive — 2026-08-11

**Author:** FixFlags CEO
**Replaces:** the NO-OP paralysis loop and the "blocked on codex-root / operator fixtures" framing.

## The reframe

The executive team has spent 24+ hours in NO-OP loops, all repeating "blocked on `codex-root` / operator fixtures."
That framing is **wrong for launch readiness**. The Agent-led report workspace is **implementation-complete, all gates green** (3,800 tests, build, accuracy eval, browser proof).
The three "blocked" board items (`agent-p7-release-proof`, `cli-customer-onboarding`, `current-product-completion`) are **release-proof credentials** — a deployment/verification nicety, **not** the Product Hunt launch gate.

**Product Hunt readiness is OUR work, not codex's.** The gate is: product works, UI ready, reports accurate, marketing clean, signup → sign-in → get prompts is a polished end-to-end journey.

## Operational throttle to fix first

`openai-codex` plan is **exhausted** (100%, resets ~6 days, $0 credits) → every executive on `big-pickle` is failing `429` / `400 [404] Console`.
- Executives/crews must move off `big-pickle` onto the **free fallback ladder** (`~/.pi/agent/model-ladder.json` → `mate/model-ladder.json`): `nemotron-3-ultra-free`, `laguna-s-2.1-free`, `cohere/north-mini-code:free`, `google/gemma-4-26b-a4b-it:free`, etc.
- Set thinking OFF on every spawn/session (`big-pickle` and others 400 on thinking-mode passthrough).

## Product Hunt readiness checklist — OWNED BY US

| # | Track | Owner | Work (already queued / in scope) |
|---|-------|-------|----------------------------------|
| 1 | Reports accurate | Engineering + Research | Finish `goal-p4-quality-tests` (billing/auth/audit → 70% coverage) — partially done, subagent-B has test files staged |
| 2 | UI ready | Engineering + Design | Finish `goal-p5-a11y-design` (dl/dlitem, sign-in aria, CTA contrast, axe at 375/768/1280) |
| 3 | Marketing clean | Content/Brand | Audit `lib/marketing/copy.ts` against SOUL + voice; no banned filler; Product Hunt tagline/pitch fresh |
| 4 | Signup→sign-in→prompts journey | Customer + Growth | Verify anon scan → claim → sign-in → get prompt end-to-end; no gate placeholders; `/post-login` claim before checkout |
| 5 | Product Hunt asset pack | CEO + Growth | Launcher tagline, first-comment, 3 screenshots, launch URL, pricing live, Watch feature presentable |

## Dispatch (one bounded owner each)

Each executive receives a concrete deliverable + verification command + escalation tier via `session_steer`.
No more NO-OP heartbeats while launch work is open.

## Honest verdict

**Not yet Product Hunt ready** — code is launch-shaped and workspace-complete, but:
1. Reports-accuracy coverage (70%) unfinished → accuracy risk on launch day.
2. Known a11y defects unfixed → "UI ready" not proven.
3. Marketing copy not audited for launch.
4. Signup→prompt journey not end-to-end verified on the real deployed surface.
5. openai-codex exhaustion is throttling the whole team → must route to free ladder.

**Get to work** — dispatch below.
