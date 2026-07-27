# Accuracy FP tracking infrastructure

**Date:** 2026-07-27
**Check module:** N/A (infrastructure)
**Confidence:** HIGH
**Evidence:** Created `.agents/accuracy/false-positives.json`, `.agents/accuracy/benchmark-sites.json`, updated `.agents/learnings/README.md`

## False positive pattern

No systematic tooling existed for tracking false positive patterns, benchmark sites, or accuracy learnings. FP fixes were one-off and not connected to regression prevention.

## Root cause

The accuracy system had:
- `accuracy-corpus.ts` for fixture expectations (good)
- `accuracy-eval.ts` for CI gate (good)
- Individual learnings in `.agents/learnings/` (good)
- But no structured FP registry, no benchmark site list, and no learning template

## Fix

1. Created `.agents/accuracy/false-positives.json`: structured JSON tracking all known FP patterns with id, checkId, module, pattern, rootCause, affectedSites, fixType, fixDescription, status, evidence
2. Created `.agents/accuracy/benchmark-sites.json`: JSON listing 10 diverse benchmark sites across categories (gold-saas, ai-builder, content-docs, portfolio, structural) with expectedPresent, knownFalsePositives, and notes
3. Updated `.agents/learnings/README.md`: added accuracy learning template with check module, false positive pattern, root cause, fix, regression prevention, and related corpus entries
4. Created 5 new accuracy learnings documenting the FP patterns found and fixed

## Regression prevention

- Future agents can reference `.agents/accuracy/false-positives.json` before modifying check logic
- `.agents/accuracy/benchmark-sites.json` provides a standard set of sites for accuracy evaluation
- The learning template ensures consistent documentation of FP fixes
- `npm run accuracy:eval` gate prevents regressions on existing fixtures

## Related corpus entries

- `lib/audit/accuracy-corpus.ts`: 13 fixtures across 6 tiers
- `scripts/accuracy-eval.ts`: offline accuracy gate
- `.cursor/skills/fixflags-scan-accuracy/SKILL.md`: accuracy workflow
