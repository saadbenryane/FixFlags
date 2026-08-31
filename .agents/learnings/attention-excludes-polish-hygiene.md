# Attention excludes Polish hygiene from first judgment

**Date:** 2026-08-31
**Scope:** Agent transcript, Report default Flag, Finish Plan Attention
**Confidence:** high
**Evidence:** `lib/audit/__tests__/scan-agent-messages.test.ts`, `lib/marketing/__tests__/sample-provenance.test.ts`, `lib/audit/attention.ts`

## Discovery

Finish Plan already refused Polish, low-confidence, and empty-fix Flags as worthwhile Attention. Agent still named the top three ranked Flags, so cookie consent, structured data, and other hygiene observations could be the first thing a customer heard. The complete Fix list was never the problem. The first judgment was.

## Why it matters

The reaction we want is "FixFlags saw something important I missed," not "it found meta tags." Ranking Message above SEO at the same severity is not enough when the top remaining Flags are all Polish.

## Correct approach

Share one Attention-candidate rule. Agent names up to three candidates while a Review runs. On a fully completed Review it names the same worthwhile Flags as Finish Plan, which also require a recommended change. Additional-count copy only counts leftover Attention candidates, never Polish leftovers. The Report still lists every Flag, default-opens the first candidate, and does not freeze a streamed Polish Flag into the URL. A fully completed Review with no worthwhile Flag says it did not find anything that deserves action yet. Partial Reviews never make that claim.

## Prevention

- `lib/audit/attention.ts`
- Agent, Finish Plan, and Report default selection consume it
- Regression: Polish-only completed Review, mixed Review, partial completeness, curated DemoSite sample
