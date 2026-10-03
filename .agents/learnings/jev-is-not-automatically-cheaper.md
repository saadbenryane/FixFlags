# JEV (TypeSafe System One) is not automatically cheaper than the LLM judge

**Date:** 2026-09-29
**Scope:** `lib/audit/jev-client.ts`, `scripts/jev-validate.ts`, JEV vs current triage/prescription economics
**Confidence:** HIGH for the economics (arithmetic against `lib/billing/costs.ts` MODEL_RATES). UNTESTED for accuracy (no `TYPESAFE_API_KEY` in the environment).

## Discovery

Two claims about JEV do not survive contact with FixFlags' actual cost model.

1. **"40-1000x cheaper than LLMs" is false against our triage model.** JEV is billed on input tokens only, at $0.42/M ($0.25/M at the $100 prepaid tier). `gpt-4o-mini` input is $0.15/M. On a 6,400-token state, JEV input alone costs $0.00269 while gpt-4o-mini input costs $0.00096. JEV only wins once the LLM's *output* tokens are counted. Measured break-even against gpt-4o-mini is roughly **2,880 output tokens** for this state size.

2. **The win is real, but only against the expensive models.** The prescription pass runs `claude-sonnet-5` ($3/M in, $15/M out). At 800 output tokens that is $0.031 per call, about **11.6x more than JEV**. The haiku baseline is 3.9x more. So the defensible claim is: *JEV is dramatically cheaper than our prescription judge, and roughly cost-neutral to worse than our triage judge.*

3. **JEV cannot do the job on its own.** Our triage contract requires prose the model cannot produce: `pageJob`, a two-sentence `verdict`, per-rubric `summary`, and AI-authored `newFlags` with `evidence` and `whyItMatters`. JEV gives up string generation entirely. A JEV triage can only fill `score`, `pageType`, `launchReadiness`, and the five `launchChecklist` noul gates. Everything else is either templated or still needs an LLM.

## A real bug this uncovered

`lib/audit/jev-triage.ts` (committed in `fa960fae`, owned by another agent) treated the JEV `score` answer as a 0-100 value:

```ts
const score = Math.round(overallScoreAnswer.score)
```

JEV returns a **fractional 0-based index into the ordered criteria array**. With 10 levels, a top answer is `9`, not `90`. That code turns a strong page into `score: 9` and every rubric into grade `F`. The harness now rescales properly (`jevScoreToHundred` in `scripts/jev-validate.ts`) and asserts grade coherence, so the same class of bug fails loudly instead of silently.

## Correct approach

- Judge JEV against a named baseline at a named state size. Never quote a raw "Nx cheaper" ratio.
- Report the break-even output token count, not just a percentage. It tells you whether a given swap is worth making.
- Treat a JEV call as a **cheap router in front of the LLM**, not a replacement for it. Use `noul`/`choice`/`score` to decide *whether and how* to spend a prescription call, not to produce the prescription.
- Pin the model version. `jev-latest` shifts thresholds between releases, which would silently move confidence gates.
- Validate `noul` probabilities are actually calibrated before trusting them as gates. A confidence number that does not predict accuracy is worse than no number.

## Where prevention was encoded

- `scripts/jev-validate.ts` prints cost against every baseline plus break-even output tokens, so the ratio cannot be quoted out of context.
- `gradeCoherence` fails the run if a rubric's reported grade disagrees with its rescaled score.
- `lib/audit/__tests__/jev-client.test.ts` pins the request shape and documents the two contract assumptions (score is a level index; noul is 0-1).

## Still open

- No live JEV run has happened. Accuracy, calibration, and real latency are all unmeasured. The harness is proven to execute; it is not proven to be accurate.
- `lib/audit/jev-triage.ts` does not typecheck and is a separate, already-claimed task (`restore-ci-triage-adapter-2026-09-29`). This work deliberately does not import or modify it.
