# Dogfood scan accuracy closeout

**Date:** 2026-07-26  
**Target:** `https://saadbenryane.com/`  
**Scope:** rendered capture accuracy, deterministic and AI flag adjudication, cross-page consolidation, accuracy harness, and reusable skill

## Outcome

The reported mobile CTA failure was false. At the 393 by 812 mobile viewport, the homepage `Book a call` CTA starts near 393 px and the Contact CTA starts near 743 px. Both are inside the viewport. The old check used an 85% comfort threshold while claiming the CTA was hidden below the fold, and CTA candidate discovery could select image-lightbox text or form choices. The check now uses the literal viewport boundary and excludes those non-CTA controls.

The supplied baseline audit, `cms13m1yv0003gr87j5xkmxf9`, stored 41 flag occurrences. After applying the new consolidation to that report, it represented 18 distinct fixes. Further adjudication removed deterministic contradictions, page-role mistakes, artifact console errors, and overlapping symptoms.

The final fresh production-path audit, `cms15bfd30000grnalfaxc4ln`, completed with:

- score 89
- 22 stored page occurrences
- 9 distinct visible fixes
- no mobile below-fold CTA finding
- a passing Mobile CTA visibility launch gate
- one visible fix per underlying issue, with affected page evidence retained

## Remaining findings

The final nine are credible at the captured evidence level:

1. Slow 3G blank-screen delay.
2. Mobile PageSpeed performance score of 59 for the completed run.
3. Small tap targets reported by PageSpeed.
4. Newsletter input without an accessible label across affected routes.
5. Homepage headline does not identify a specific audience.
6. Weak social-proof signal on conversion-adjacent pages.
7. No privacy-policy link detected.
8. Analytics detected without a cookie-consent control.
9. CSP permits `unsafe-inline` script sources.

PageSpeed availability and scores vary between runs. The rendered slow-3G result is the stronger repeatable performance signal; PageSpeed-derived findings remain explicitly source-qualified.

## Accuracy prevention

- `npm run accuracy:browser` exercises the four rendered routes at the production mobile viewport and asserts CTA geometry, candidate selection, input semantics, and radius extraction.
- `npm run accuracy:eval` covers offline HTML and non-HTML regression cases, including the literal fold boundary.
- Deterministic-owned facts suppress contradictory AI findings.
- Page-role and root-cause suppression removes invalid landing-page heuristics and subordinate symptoms.
- The Finish Plan consolidates suffixed route occurrences by base check identity while keeping all URLs and evidence.
- `.cursor/skills/fixflags-dogfood-accuracy/SKILL.md` captures the repeatable inspect, adjudicate, fix, probe, re-scan, and learn loop.

## Verification evidence

- Rendered browser accuracy: four routes passed with no CTA-position false positives.
- Offline accuracy: 11 HTML cases and 2 gold cases passed with zero failures.
- Focused audit suites: 280 tests passed after launch-checklist reconciliation.
- Final report screenshot: `/tmp/fixflags-dogfood-captures/report-launch-proof.png`.

