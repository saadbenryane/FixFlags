# Task Board

*Active tasks. One owner per scope. Archive completed records.*

| Task ID | Status | Owner | Branch/worktree | Scope | Files/areas | Dependencies | Updated |
|---------|--------|-------|-----------------|-------|-------------|--------------|---------|
| speed-opt-cwv | review | auto | cursor/speed-opt-cwv-a9ac | Speed/CWV: homepage, report load, critical workflows | marketing homepage, layout/fonts, dynamic imports, report/audit client bundles, images, scripts | — | 2026-07-18 |
| ship-ready-core-loop | done | auto | main | Post-claim unlock, AI pending poll, trust UX (partial capture, recheck nav, locked teaser, upsell, badges) | ClaimAnonymousAudits, claim-anonymous, FlagDetailPanel, AuditReport*, copy, fetch-audit | first-value-journey | 2026-07-17 |
| first-value-journey | done | auto | main | Restore anon first scan, remove post-signup double-submit, align promise, core-loop analytics | AuditInput, dashboard, copy, analytics, report claim CTA | — | 2026-07-17 |
| completeness-refactor | done | auto | main | Completeness: billing gates, sample provenance, report cleanup, trust, skills/docs | create-audit, usage, feedback, live-sample, ReportExplorer, copy, skills | homepage-art-direction (visual ownership) | 2026-07-17 |
| homepage-art-direction | done | codex | main | World-class homepage visual system, generated brand imagery, section flow, responsive polish | marketing homepage components, assets, copy hierarchy, visual QA | — | 2026-07-17 |
| convert-ready-pass | done | auto | main | Conversion + report UX + marketing foundation pass | marketing nav/hero/copy, sample report master-detail, demo score, annotations | — | 2026-07-17 |
| completeness-dead-paths | done | auto | main | Purge SUMMARY_ONLY/skipCapture dead paths + live re-check proof | load-screenshot-base64, run-page, create-audit, smoke-recheck-full | completeness-core-loop | 2026-07-14 |
| completeness-core-loop | done | auto | main | Completeness ship: FULL re-check, Free cleared UI, silent UX, docs/facts, habit loops | lib/audit/*, components/audit/*, copy.ts, AGENTS/PRODUCT/ROADMAP/docs | — | 2026-07-14 |
| app-polish-shipping | done | claude | claude/app-polish-shipping-tqeab1 | Ship-readiness review, scan-accuracy false-positive removal, plan-mode fix prompt | audit checks, metadata parser, priority-flags, billing plan labels | — | 2026-07-15 |
| branch-integration | done | claude | main | Merged feedback-loop-system (report reactions + AI digest, +1 Prisma model + migration) and fix-flags-docs (how-it-works copy) into main | admin/report feedback, prisma schema, marketing copy | — | 2026-07-16 |
| merge-conflicts | done | auto | main | Merge origin/main into local main; resolve prompt-cache × flag-quality conflicts | lib/audit/judge-prescription.ts, lib/prompts/system-prompt.ts | — | 2026-07-14 |
| recheck-clarity | done | codex | main | Align core-loop and paid-value copy with Flag → Fix → Re-check | report actions/nav, pricing, marketing copy/tests | — | 2026-07-12 |
| report-quality-release | done | agent | main | Report quality + UX release plan | audit checks, report UI, gating | — | 2026-07-11 |

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
