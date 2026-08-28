# Update-review trust adjudication

**Date:** 2026-08-28  
**Report:** [`cmtby9oky000dl720o44n3wfq`](https://fixflags.com/report/cmtby9oky000dl720o44n3wfq)  
**Board:** `update-review-trust-game-on`

## One-sentence verdict

Child review is `PARTIAL` (so absences cannot become “No longer observed”) and prescription hit `AI_REVIEW_FAILED` (so Fix prompts never wrote), while Experience **F / 30** from slow-3G and other EXPERIENCE Flags honestly pulled the overall score to **70**.

## Public status facts

| Field | Value |
|-------|-------|
| status | COMPLETED |
| progress | **70** stuck (“Checking which Flags matter most”) |
| score | 70 |
| Message / Experience / Reach | 94 / **30** / 99 |
| reportCompleteness | PARTIAL |
| failureCode | AI_REVIEW_FAILED |
| flagCount | 18 |
| triage completedAt | ~20:06:01Z |
| updatedAt (after fail) | ~20:06:35Z |

## Why 0 clears + 8 inconclusive

`getFlagDiffSummary` only credits “No longer observed” when the child is COMPLETED **and** `reportCompleteness === 'FULL'`. Under PARTIAL, the same absences become **Inconclusive**. Banner copy did not name PARTIAL.

## Why prompts failed (`AI_REVIEW_FAILED` cause)

**Exact `errorMsg` (from public report JSON):**

```text
400 Invalid schema for response_format 'quality_prescription': In context=('properties', 'flagPrescriptions', 'items'), 'required' is required to be supplied and to be an array including every key in properties. Missing 'agentPrompt'.
```

OpenAI strict mode requires every property key to appear in `required`. Prescription used `.optional()` for `agentPrompt` (and sibling tool prompts). Triage already used nullable+required. Follow-up: `judge-prescription-schema.ts` now mirrors that pattern.

Parent and child shared this failure — systemic, not a one-off timeout.

## Experience 30

Weighted score math: Experience dominates the drop. Live verdict leads with slow-3G blank (~10822ms). Other EXPERIENCE Flags (overlay, journey, friction) compound.

## New vs rematch

Production still shows old wording (`4 security headers are missing or weak`, `journey-contact-support-dead-end`). Dogfood-quality accuracy fixes were not what this production run executed. Treat New Flags as a mix of deeper multi-page discovery and still-open product FPs until accuracy ships + re-dogfood.

## Implementation closeout (2026-08-28)

Shipped in this pass:

1. **Progress clear** on prescription failure (`progress: 100`)
2. **PARTIAL-aware** inconclusive + coverage sentence copy
3. **Compare page** includes inconclusive + PARTIAL note; New Flags can show “Found on a newly reviewed page”
4. **Prescription** soft-fails mismatched `agentPrompt`; batches when >12 Flags; higher OpenAI maxTokens/timeout
5. **IA:** two-row OutcomeBar; labeled Update review | Compare; compact RecheckDiffStrip one-liner

Dogfood accuracy (`evaluation-fix`, core security honesty, personal purpose) is already on `main`. Fair re-dogfood of saadbenryane.com remains an operator step after deploy of this trust pass.

**Do not cheat:** Experience F from slow-3G remains a real Flag until the site first-paint improves.
