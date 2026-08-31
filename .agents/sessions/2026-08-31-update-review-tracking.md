# Update Review tracking — score stayed the same

**Date:** 2026-08-31  
**Board:** `game-on-url-first-complete`

## Problem

A builder fixes named Flags, runs an Update review, and sees the same score because the child Review found new stuff. It feels like the goalposts moved.

## What is already true

- Child Reviews already diff against the parent: Fixed / Still open / New / Regressed / Inconclusive.
- Those counts already render on `/products/[id]`.
- The Update review **lands on the new report**. The report loaded `recheckDiff` and only used it for analytics.
- Score is a fresh snapshot of remaining Flags. New IMPORTANT Flags offset Fixed ones.

## Plan

### Layer 1 — Receipt on the journey (this cycle)

Show the already-computed diff on the child report header, and have Agent name it. If the score is flat, say so: Fixed work counted; New observations offset it.

### Layer 2 — Detect everything on the first Review

- Same checks, pages, and judgment on parent and child.
- Unchanged-site eval: two scans of an unmodified URL must not invent new IMPORTANT Flags.
- AI Flags match by fingerprint, not prose.
- New Flags on a newly crawled page are labeled as new-page, not "you missed this last time."
- If a deterministic check would have fired on the parent capture and only appears on the child, that is a scan defect.

### Layer 3 — Like-for-like progress

A comparable score over only the parent Flag identities, shown next to the full diagnostic. Never hide the full score. Progress on last Review's Flags can rise while the full diagnostic stays flat.

### Layer 4 — Product observation ledger

Every confirmed Flag identity lives on the Product. First Review writes the set. Child New = not in that set. Polish stays tracked even when it is not Attention.

## Guardrails

- Never hide New Flags.
- Never declare Fixed without comparable re-observation.
- Partial child Reviews stay Inconclusive.
- Do not freeze the check set in a way that hides real regressions.
