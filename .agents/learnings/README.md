# Learnings

Validated project learnings (durable, not guesses).

Each entry should include: date, scope, confidence, evidence, discovery, why it matters, correct approach, and where prevention was encoded.

See `.agents/README.md` for conventions.

## Accuracy learning template

For false positive / accuracy learnings, use this template:

```markdown
# [Title]

**Date:** YYYY-MM-DD
**Check module:** [filename.ts]
**Confidence:** HIGH / MEDIUM / LOW
**Evidence:** [command or artifact that proves the finding]

## False positive pattern

[What specific pattern caused the false positive]

## Root cause

[Why the check logic produced a false positive]

## Fix

[How it was resolved — regex change, threshold adjustment, suppression, etc.]

## Regression prevention

[What test/corpus entry prevents regression]

## Related corpus entries

[Links to specific fixture expectations in accuracy-corpus.ts]
```

## Accuracy FP registry

Known false positive patterns are tracked in `.agents/accuracy/false-positives.json`.
Benchmark sites for accuracy evaluation are tracked in `.agents/accuracy/benchmark-sites.json`.
