# Dogfood quality closeout (FixFlags → Cursor lesson)

**Date:** 2026-08-27  
**Board:** `fixflags-dogfood-quality`  
**Target lesson:** https://saadbenryane.com/ FixFlags findings pasted into Cursor

## What shipped

| Dogfood class | Code change |
|---|---|
| Generic journey friction Tasks | Type-specific fixes in `evaluation-fix.ts` |
| Heading → keyboard/ARIA Task mismatch | Barrier classification + `heading-order-skipped` ID |
| Security headers overclaim | Core-only consolidation; hardening rollup only when cores present |
| Cookie CMP-only Task | First-party + Consent Mode allowed in `trust.ts` |
| Personal + contact CTAs → SaaS journeys | `page-purpose` + journey catalog + dead-end copy |
| About commercial broken promise | Evaluator prompt + `shouldKeepBrokenPromise` |
| Editor invents pricing/signup | Handoff scope guardrail |

## Verification

- `npm run accuracy:eval` — pass (0 failures)
- Focused vitest: dogfood-quality-remediation, accuracy-defects, checks security headers, beat-scout journey ordering, editor-handoff, regression-sites

## Live re-adjudication status

Code-level adjudication complete against the Cursor remediation verdict table. A fresh production-path Product Review of `https://saadbenryane.com/` should confirm journey Flags no longer invent pricing/signup dead-ends or mismatched heading Tasks; that live pass remains an operator follow-up when a review credit is available.

## Success criteria check

1. Tasks match problem text for journey friction/a11y — yes  
2. Security Flag never claims cores missing when CSP+HSTS+XCTO+frame present — yes  
3. Personal contact-led sites skip SaaS pricing/signup journeys — yes  
4. Heading-order never ships keyboard-only Tasks — yes  
5. Offline accuracy gate green — yes  
