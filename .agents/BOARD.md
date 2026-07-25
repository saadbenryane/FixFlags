# Task Board

*Active tasks. One owner per scope. Archive completed records.*

| Task ID | Status | Owner | Branch/worktree | Scope | Files/areas | Dependencies | Updated |
|---------|--------|-------|-----------------|-------|-------------|--------------|---------|
| homepage-completeness-pass | in_progress | auto | main | Homepage completeness: shared chrome, a11y tabs, mobile workflow, copy cleanup, footer dedupe, visual QA. | components/marketing/landing, footer, lib/marketing/copy/landing.ts, lib/site/nav.ts | None | 2026-07-25 |
| homepage-redesign-mockups | done | auto | main | Homepage post-hero redesign to mockups: sample, loop polish, dimensions tabs, why, works, final CTA, footer. Product-true claims only. | components/marketing/landing, components/layout/footer, lib/marketing/copy/landing.ts, lib/site/nav.ts | None | 2026-07-25 |
| hero-glass-crop-position | done | auto | main | Lossless crop excess alpha on hero glass PNG; tune LandingHeroSection positioning. | public/marketing/visuals/home-hero-glass.png, LandingHeroSection | None | 2026-07-25 |
| hero-glass-master-as-is | done | auto | main | Ship user transparent glass master unaltered as homepage hero PNG. | public/marketing/visuals/home-hero-glass.png, LandingHeroSection | None | 2026-07-25 |
| hero-glass-fringe-fix | done | auto | main | Fix white-plate + black outline on home hero: RGBA unmate/despill so mesh shows through. | public/marketing/visuals/home-hero-glass.webp, LandingHeroSection, docs/brand/reference, learnings | None | 2026-07-25 |
| hero-glass-user-art | done | auto | main | Replace homepage hero with user-provided glass plate; bake to white WebP (no fringe). | public/marketing/visuals/home-hero-glass.webp, LandingHeroSection, docs/brand/reference | None | 2026-07-25 |
| hero-glass-no-fringe | done | auto | main | Kill black fringe on home hero glass: bake black-plate art to white canvas (no dark alpha edges). Encode learning. | public/marketing/visuals/home-hero-glass.webp, LandingHeroSection, .agents/learnings, fixflags-ui rule | None | 2026-07-25 |
| homepage-hero-polish | done | auto | main | Homepage hero polish: official glass illustration, desktop spacing/icon sizing, mobile input+stack. No fake social proof. | components/marketing/landing, components/audit/AuditInput.tsx, public/marketing/visuals, lib/marketing/copy/landing.ts | None | 2026-07-25 |
| homepage-hero-refresh | done | auto | main | Homepage hero redesigned to mockup: two-column, clipped glass art, HERO copy, assurances (no fake social proof). | components/marketing/landing, components/audit/AuditInput.tsx, lib/marketing/copy/landing.ts, public/marketing/visuals | None | 2026-07-25 |
| brand-sheet-align | done | auto | main | Applied brand sheet: geometric F mark (SVG), lockups/icons, UI rule + brand-rules sync. Palette/type already matched. | public/brand, lib/design/logo-mark.tsx, components/brand/Logo.tsx, scripts/generate-brand-icons.mjs, .cursor/rules/fixflags-ui.mdc | None | 2026-07-25 |
| brand-refresh-hiw-hero | done | auto | main | /how-it-works AI Gap hero re-implemented to match mockup: clean stack asset, layout proportions, annotation leaders, feature strip. | components/marketing/how-it-works, public/marketing/visuals | None | 2026-07-25 |
| current-product-completion | blocked | auto | main | Close Builder-Native + Current-Product: Phases 0–3 local work landed; release gate blocked on Prisma reset consent for disposable `fixflags_release`, RELEASE_SMOKE_URL, R2, and a quiet tree for full verify (side-effect guard). Preserve concurrent auth/journey WIP. | app, components, lib, prisma, scripts, e2e, PRODUCT.md, ROADMAP.md, QUALITY.md, .agents | Explicit user consent for `prisma migrate reset` on `fixflags_release`; RELEASE_SMOKE_URL; R2; pause concurrent writers for full verify | 2026-07-24 |

---

## Completed

| Task ID | Owner | Scope | Completed |
|---------|-------|-------|-----------|
| scan-loading-completion | auto | COMPLETED hold flags, re-check handoff, handoff hygiene, honest substeps, progressive parity cleanup | 2026-07-24 |
| report-chrome-honesty | auto | AI summary callout honesty + remove ShareStatusBanner; RubricBar counts; ShareDrawer warning | 2026-07-24 |
| scan-loading-ux | auto | Instant scan handoff, honest stage progress, progressive↔completed report parity, progress-ui cleanup | 2026-07-24 |
| made-with-intelligence | codex-root | Evidence-backed technology detection, normalized audit snapshots, report and progressive UI, re-check diffs, sanitized APIs, eligible public profiles, migration/backfill, tests, and canonical docs | 2026-07-23 |
| customer-journey-completion | cloud-agent | Phases 1–3 anon evidence/honest Copy/score/nav; merged to main | 2026-07-23 |
| strategic-sprint | cloud-agent | Preview scan access, Railway deploy gate, Lovable/Bolt partners, unified Finish Plan, MCP quality gate | 2026-07-23 |
| fix-live-images | cloud-agent | Restore live logo/marketing images; unoptimized public assets + localPatterns guard; merged to main | 2026-07-23 |
| launch-quality-accuracy | cloud-agent | Scan accuracy baseline, accuracy-eval CI gate, HTML parser FP fixes, builder fixtures, corpus refactor, completion plan, skills | 2026-07-23 |
| axi-project-agent-pilot | codex | Independent AXI-style project context, affected verification, real evals, bounded output, and harness measurement | 2026-07-22 |
| agent-native-cli | codex | Task-shaped check → Finish Plan and re-check → verification diff CLI workflows | 2026-07-22 |
| launch-check-completeness | auto | PI/Finish Plan/Remember, dogfood, Agency share, Project watch, skills/docs | 2026-07-22 |
| dogfood-audit-quality | auto | Absorbed into launch-check-completeness | 2026-07-22 |
| howitworks-visual-spacing | auto | Absorbed / superseded by launch-check-completeness focus | 2026-07-22 |
| merge-origin-main-sync | auto | Merged origin/main into local main; auto-resolved overlaps; pushed | 2026-07-21 |
| completeness-final | auto | Gates, truth residual, design/copy, dead code, Strength/Touch CRITICAL, skills/docs | 2026-07-20 |
| product-intelligence-vision | auto | Vision canon + Phase 1 PI/Finish Plan/Remember + skills | 2026-07-20 |
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
