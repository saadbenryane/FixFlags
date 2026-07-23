# Scan accuracy — HTML parser false positives

**Date:** 2026-07-23  
**Evidence:** `scripts/accuracy-probe.ts` on v0.dev dropped from 161 → 0 IMPORTANT `links-no-text` after parser fixes; `npm run accuracy:eval` green with 9 frozen fixtures.

## Findings

1. **Hidden DOM and template siblings** — Links inside `[hidden]` subtrees must not count toward `links-no-text` / `buttons-no-text`.
2. **Card stretch links** — `<a class="absolute inset-0">` overlay links are named by sibling `h2`/`h3`/`h4` in the same card container.
3. **Weak value prop** — `messaging-weak-value-prop` should require both missing audience and missing outcome, not either/or. Headlines like "AI App Builder" name an outcome; "platform for teams" names an audience.
4. **Responsive H1 duplication** — Deduplicate repeated H1 text before messaging checks to avoid concatenated headline false positives.

## Prevention

- `npm run accuracy:eval` gates gold/builder fixtures in CI.
- Capture refreshed HTML with `npm run accuracy:capture-fixtures` when public sites change materially.
