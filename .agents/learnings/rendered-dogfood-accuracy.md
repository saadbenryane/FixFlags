# Rendered dogfood accuracy

**Date:** 2026-07-26  
**Scope:** full-browser checks, AI triage truth, multi-page Finish Plans, and accuracy evaluation  
**Confidence:** high  
**Evidence:** four-page rendered probe, repeated production-path audits of `saadbenryane.com`, focused tests, and offline accuracy gate.

## Findings

1. A check title must match its threshold literally. “Hidden below the fold” cannot use an 85% comfort boundary; a CTA whose top edge is inside the viewport is visible.
2. CTA selection must reject media controls and form choices before scoring marketing words. Image alt text containing “pricing” and a choice labeled “Startup” are not conversion CTAs.
3. Browser geometry and metadata presence are deterministic-owned truth. AI may interpret quality, but must not contradict CTA position, privacy/contact presence, or cookie detection.
4. Critical-path scans create useful page occurrences, not necessarily distinct fixes. Consolidate by base check ID for the Finish Plan while retaining every affected page and evidence.
5. Input-type semantics matter. Radio controls do not trigger iOS text zoom and optional radio choices do not prove missing form validation.
6. Page-role context prevents landing-page heuristics from mislabeling valid Contact and About headings.

## Prevention

- Live rendered corpus: `lib/audit/accuracy-browser-corpus.ts`
- Browser probe: `scripts/accuracy-browser-probe.ts`
- Offline geometry cases: `lib/audit/__tests__/fixtures/non-html-regression.json`
- CTA selection and mobile metrics: `lib/audit/capture-metrics.ts`
- AI deterministic ownership: `lib/audit/deduplicate.ts`
- Multi-page consolidation: `lib/audit/consolidate-flags.ts`
- Role-aware suppression: `lib/audit/suppression.ts`
- Repeatable workflow: `.cursor/skills/fixflags-dogfood-accuracy/SKILL.md`
