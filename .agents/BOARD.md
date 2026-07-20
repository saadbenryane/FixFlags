# Task Board

*Active tasks. One owner per scope. Archive completed records.*

| Task ID | Status | Owner | Branch/worktree | Scope | Files/areas | Dependencies | Updated |
|---------|--------|-------|-----------------|-------|-------------|--------------|---------|
| howitworks-visual-spacing | in_progress | auto | main | Framed loop step tiles (subject crops, lean WebP) + marketing spacing | HowItWorksLoopSection, public/marketing/visuals/loop-0* | — | 2026-07-20 |
| dogfood-audit-quality | in_progress | auto | main | Dogfood deep audits on fixflags.com + saadbenryane.com; fix false positives, dupes, vague findings, weak prioritization; credible top-3 | lib/audit checks + priority-flags + scoring, scripts harness | — | 2026-07-20 |

---

## Completed

| Task ID | Owner | Scope | Completed |
|---------|-------|-------|-----------|
| lean-fix-markdown-panel | auto | Collapse Why/Evidence/Verify into lean Markdown Fix box; SeveritySignal; Wrench icon | 2026-07-20 |
| loading-report-seam | auto | Progressive→completed chrome parity; absorb streamline-meta; skills/docs | 2026-07-20 |
| report-streamline-meta | auto | Absorbed into loading-report-seam | 2026-07-20 |
| homepage-conversion-reorder | auto | Homepage conversion reorder: sample-first, deeper Flag examples, why-AI, integrations | 2026-07-20 |
| report-density-refactor | auto | Report density + chrome IA + progressive parity + skills | 2026-07-20 |
| report-fixloop-chrome | auto | Remove redundant Scanned/Top fix/count chrome from report flag list | 2026-07-20 |
| beat-scout-completeness | auto | Wire completed-report Contract/Timeline; editable contract; journey bias; silent failure; overlays; anti-FP; roast polish | 2026-07-20 |
| why-it-matters-first | auto | Why it matters first in flag detail panels | 2026-07-20 |
| anon-wedge-completion | auto | 1-anon teaser: central gate, claim usage, score leak, copy/skills/analytics | 2026-07-20 |
| beat-scout-precision | auto | Network/API Flags, overlay detection, action timeline, Product Contract, roast/CLI/IDE harden, skills/docs | 2026-07-20 |
| help-center | auto | First-party Help Center + chat escalation + contextual help | 2026-07-20 |
| hero-illustration-blend | auto | Soft glass-flag wash behind landing hero | 2026-07-19 |
| product-evidence-polish | auto | Product Evidence lead + Flag-shaped findings | 2026-07-19 |
| completeness-cleanup | auto | Sample hint, buy_credits gate, quota copy truth, skills/docs | 2026-07-19 |
| marketing-copy-cya-cut | auto | Cut CYA, builder vernacular across marketing + product microcopy | 2026-07-19 |
| payments-live-ready | auto | Stripe test + Railway vars + billing harden + copy/legal/skills | 2026-07-19 |
| ship-fully-functional | auto | Unblock Railway, journey flags, visual evidence, skills/docs | 2026-07-19 |
| railway-npm-ci-fix | auto | Folded into ship-fully-functional (zod4 + auth pins) | 2026-07-19 |
| merge-origin-main | auto | Merged origin/main into local main; resolved BOARD conflict | 2026-07-19 |
| ultimate-audit-product | auto | Ultimate audit Phases 0-5: Playwright, narrative report, journey MVP | 2026-07-19 |
| ship-completeness | auto | Playwright unify, visual capture, product gaps, skills/docs | 2026-07-19 |
| merge-all-to-main | auto | Merged unmerged branches into main; always-work-on-main rule | 2026-07-19 |
| launch-funnel-p0 | auto | Launch-ready homepage + funnel P0/P1; P2 handoff | 2026-07-19 |
| passkey-2fa | auto | Passkey-based two-factor authentication | 2026-07-19 |
| speed-opt-cwv | auto | Speed/CWV: homepage, report load, critical workflows | 2026-07-19 |
| app-polish-review | claude | Reviewed+closed first-value-journey and ship-ready-core-loop | 2026-07-18 |
| ship-ready-core-loop | auto | Post-claim unlock, AI pending poll, trust UX | 2026-07-17 |
| first-value-journey | auto | Restore anon first scan, remove post-signup double-submit | 2026-07-17 |
| completeness-refactor | auto | Completeness: billing gates, sample provenance, report cleanup | 2026-07-17 |
| homepage-art-direction | codex | World-class homepage visual system, generated brand imagery | 2026-07-17 |
| convert-ready-pass | auto | Conversion + report UX + marketing foundation pass | 2026-07-17 |
| completeness-dead-paths | auto | Purge SUMMARY_ONLY/skipCapture dead paths + live re-check proof | 2026-07-14 |
| completeness-core-loop | auto | Completeness ship: FULL re-check, Free cleared UI, silent UX | 2026-07-14 |
| app-polish-shipping | claude | Ship-readiness review, scan-accuracy false-positive removal | 2026-07-15 |
| branch-integration | auto | Merged feedback-loop-system and fix-flags-docs into main | 2026-07-16 |
| merge-conflicts | auto | Merge origin/main into local main; resolve prompt-cache conflicts | 2026-07-14 |
| recheck-clarity | codex | Align core-loop and paid-value copy with Flag -> Fix -> Re-check | 2026-07-12 |
| report-quality-release | agent | Report quality + UX release plan | 2026-07-11 |

---

## Status definitions

- **proposed** — idea, not claimed
- **claimed** — owner assigned, work not started
- **in_progress** — active work
- **blocked** — waiting on dependency
- **review** — ready for review
- **done** — completed and verified
- **abandoned** — no longer relevant

## Rules

- Read this board before any substantial write task
- Claim tasks by adding a row before starting
- Update status, ownership, branch, and worktree as they change
- Archive completed records (move below the divider)
- The board does not replace Git, tests, PRs, or external trackers
