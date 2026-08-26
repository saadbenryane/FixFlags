# Task Board archive

Older terminal BOARD rows moved here on 2026-08-26 so the live board stays small.
Do not load this file unless you need historical task provenance.

## Archived rows

| Task ID | Status/Owner | Scope | Date |
| --- | --- | --- | --- |
| goal-p5-a11y-design | done / subagent-C | Homepage, pricing, sample, shared-label, contrast, target-size, and responsive accessibility closeout | 2026-08-11 |
| goal-p7-release | abandoned / goal-agent | Superseded by `game-on-launch-complete` | 2026-08-11 |
| customer-exec-upgrade | done / pi-agent | Upgrade Customer executive agent + agentic system: worker personas (Signal Monitor, Backlog Prioritizer, Escalation Steward), canonical heartbeat template + executor, memory stack wiring, learning reinjection | 2026-08-10 |
| fixflags-vision-evolution | done / pi-agent | Integrate the new company vision into canonical docs: vision.md rewrite (Flag atomic object, Signal→Understand→Prioritize→Fix→Verify→Learn, Product Memory/Graph, 3 fix paths, 3 surfaces, brand hierarchy), loop reconciliation, SHIPPED/NEXT/VISION separation, architecture review proposals (no code), roadmap, DECISIONS row, agent invariants | 2026-08-10 |
| agent-p1-access-usage | done / subagent-A | Anonymous serialization, Timeline/prompt redaction, scan history, monthly chat usage and entitlements | 2026-08-09 |
| agent-p2-scan-messages | done / subagent-B | Unified AgentMessage contract and deterministic programmatic scan messages | 2026-08-09 |
| agent-p3-canvas-domain | done / subagent-C | Private paid Canvas schema, grounding, persistence, version APIs, authorization, and tests | 2026-08-09 |
| agent-p4-workspace-integration | done / codex-root | Title-free Agent toolbar, unified transcript, History/New scan, anonymous Report, locked Timeline, paid Canvas, mobile behavior | 2026-08-09 |
| agent-p6-streamline | done / subagent-B | Remove obsolete Activity UI and proven dead report composition paths | 2026-08-09 |
| fixflags-goal-product-spine | abandoned / goal-agent | Superseded by fixflags-agent-workspace; completed Product Spine foundation retained | 2026-08-09 |
| goal-p2-playability-memory | abandoned / goal-agent | Absorbed into fixflags-agent-workspace P4 | 2026-08-09 |
| goal-p3-chat | abandoned / subagent-A | Absorbed into fixflags-agent-workspace P1/P4 | 2026-08-09 |
| goal-p6-streamline | abandoned / subagent-D | Absorbed into fixflags-agent-workspace after workspace integration | 2026-08-09 |
| fixflags-ai-native-operating-model | done / codex-root | Codified FixFlags AI-native operating model in `.agents/company/*.md`: experiment termination states (adopt/iterate/reject/inconclusive) with learning reinjection into durable docs, release gates (PASS/Continue, FIX, DECIDE) and required checks, founder escalation format and anti-patterns, model/modality/autonomy routing with event-driven wakes + 30-60m heartbeat + daily/weekly review, lean scorecard (Business/Product/Autonomy incl. useful output per founder-attention unit), dogfooding loop and autonomy metrics, external action governance, executive paid-model approvals and objective/review cadence, full worker task contract fields; references wired in `.agents/README.md`, `.agents/BOARD.md`, `.agents/GOAL.md`, `knowledge/README.md` | 2026-08-09 |
| goal-p1-foundation | done / goal-agent | P1: matchMedia setup mock, spine component cleanup, real kind/status derivation (no fabrication), loader + sample typing, test reconciliation | 2026-08-08 |
| goal-p4-quality-tests | done / subagent-B | P4: real behavior tests + coverage toward 70% on billing/auth/audit | 2026-08-08 |
| anon-funnel-dogfood | done / pi-agent | Verified launch-promise P1 funnel on main; expert-shaped anon prompt; GradLoom dogfood killed flow unclickable + probe-residue overlay FPs | 2026-08-06 |
| workspace-chat-playback-conformance | done / auto | WS4 workspace conformance and WS5 verification/docs closure: dedicated CHAT_* workspace config separate from triage (OPEN_CODE gateway via llm-keys chain, 600-token reply clamp, per-plan 20-turn cap, owner-only gating, canned quick-prompt degradation); full bidirectional playback (scrub range, step markers, browser-frame sync, activity-click seek, ?step= replay from Funnel/Flag evidence); docs reconciled to shipped truth (workspace-interface.md chat policy, report-contract funnel anchor, DESIGN.md "Your review" heading, .env.example CHAT_* keys). New chat-route cap/canned tests and playback-strip render tests; affected verify, full verify, and accuracy eval gates green. | 2026-08-02 |
| live-review-workspace-ui | done / codex-root | Live split workspace shipped: interactive path playback synced to the matching Activity row, workspace chat grounded in ranked report Flags and persisted per report (ReportChatMessage migration), mobile Product-tab parity rendering the active browser/report view, and copy-driven workspace chrome; focused tests and the full 24-command verify gate green. Chat uses the triage OpenAI config with tight rate/token limits rather than a separate cheap model. | 2026-08-01 |
| app-wide-interface-copy-cleanup | done / codex-root | Route loading/error shells consolidated and missing shells added (admin waitlist, lead detail, repo report, demo tree); UpgradeButton on the shared pickPlan helper; dead ScoreDot removed; marketing plan prices and review counts sourced from PRICING_COPY with a billing parity test; URL validation, scan-error, docs-error, and scanning-status copy centralized; full verify gate green. Residual: the report-contract "Polish pass" section name stays (banned-phrases list conflicts with the canonical contract), SettingsSkeleton remains the shared settings loading shape, and view-tracker analytics stay in their shared components. | 2026-08-01 |
| verification-issues-closeout | done / codex-root | Closed MCP typing, isolated UI runtime port collision, footer target-size failures, CLI keyring typing/loading, ignored insecure-storage behavior, and missing completeness drift guidance. Full 25-command affected verification and the isolated canonical sample evaluation pass; credentialed release verification remains blocked only by missing designated sandbox inputs. | 2026-07-29 |
| homepage-report-tablet-signals | done / codex-root | Responsive sample-report composition with a compact shared summary, full-width tablet framing, unclipped master-detail content, and a standalone on-brand product-signals section; browser-verified at 375, 768, and 1280px with focused tests, UI drift guard, and the subsequent full verification closeout passing. | 2026-07-29 |
| docs-editor-integration-system | done / codex-root | Public multi-page docs, local search and navigation, canonical eight-editor integration/configuration contract, authenticated setup flow, CLI-managed local editors, generated MCP reference, homepage/footer integration links, Help separation, SEO, migration, completeness guards, and responsive browser proof. Credentialed vendor smokes remain a release-proof prerequisite before expanding the verified shipped-integration claim. | 2026-07-29 |
| homepage-report-reference-refactor | done / codex-root | Reference-led live homepage report preview, shared release score and history summary, calmer report Flag list and filters, restored truthful metrics, conversion-focused editor workflow, explicit marketing typography, and responsive browser proof | 2026-07-29 |
| report-first-scan-auth-refactor | done / codex-root | Direct foreground report handoff, report-owned resume state, SSO-first report authentication with inline email and provider recovery, production OAuth readiness, focused tests, and responsive real-scan browser proof | 2026-07-29 |
| homepage-product-ui-story | done / codex-root | Merged How it works with the three-rubric report demonstration, replaced decorative benefit and MCP illustrations with product-shaped UI, reduced metric clutter, corrected hero rhythm, centralized copy, and verified desktop/mobile behavior | 2026-07-29 |
| unified-report-workspace | done / codex-root | One truth-preserving report workspace across completed, progressive, curated sample, shared, homepage proof, and dashboard release hub, with responsive master/detail behavior, real persisted history, one demonstrated public prompt, terminal-state parity, and passing UI/affected verification | 2026-07-28 |
| homepage-complete-refinement | done / codex-root | Coherent reference-faithful homepage, permanent transparent artwork, restored builder workflow, canonical copy, responsive density, URL/newsletter/navigation interactions, visual comparisons, production build, and real anonymous scan/gate proof | 2026-07-28 |
| homepage-footer-reference-fidelity | done / codex-root | Reference-faithful final CTA and footer with compact six-column navigation, builder integrations, product-true trust band, functional newsletter, and responsive desktop/mobile QA | 2026-07-28 |
| homepage-hiw-illustration-refresh | done / codex-root | Replaced the pixelated three-step homepage artwork with high-resolution transparent WebP illustrations, preserved copy and layout, and verified clean light/dark rendering plus responsive geometry | 2026-07-28 |
| homepage-benefits-workflow-fidelity | done / codex-root | Reference-faithful benefits and editor-workflow composition with exact desktop proportions, compact rails, real product imagery, connector flow, canonical copy, responsive QA, and preserved integration truth | 2026-07-28 |
| check-dimensions-tab-fidelity | done / codex-root | Reference-faithful release-readiness section with outcome-led headline, compact editorial composition, product-true content across all four tabs, keyboard navigation, and responsive visual QA | 2026-07-28 |
| report-first-scan-auth | done / codex-root | Immediate report-shaped scan handoff, mandatory anonymous auth gate, shared auth flows, progressive screenshot parity, denser report chrome, and per-Flag viewport comparison; implemented and verified with a real scan, responsive browser checks, focused tests, and repository validation. | 2026-07-26 |
| launch-design-implementation | done / codex-root | Implement supplied launch references across homepage, pricing, and dashboard with responsive visual QA; browser-verified at desktop and mobile sizes; repository-wide verification remains blocked by unrelated pre-existing database drift. | 2026-07-26 |
| launch-ready-product-completion | done / codex-root | Centralized responsive spacing, permanent homepage artwork, launch-critical journey polish, canonical billing-plan reconciliation, browser QA, focused regression coverage, and a passing full repository gate | 2026-07-26 |
| dogfood-scan-accuracy | done / codex-root | Adjudicated the latest saadbenryane.com scan, removed CTA and AI false positives, consolidated repeated route occurrences, added a rendered accuracy gate and reusable dogfood skill, and proved the result with a fresh production-path scan | 2026-07-26 |
| scan-freeze-core-path | done / codex-root | Dedicated web/worker runtime, lightweight progressive report handoff, shared pipeline deadlines and terminal recovery, operational health, local real-URL browser proof, full repository verification; deployment proof handed off separately | 2026-07-26 |
| homepage-reference-polish | done / codex-root | Supplied-reference homepage hero, sample proof, supporting-section polish, correct navigation, responsive QA | 2026-07-26 |
| home-how-it-works-glass | done / auto | Homepage how-it-works glass three-step section + interim clips | 2026-07-26 |
| check-dimensions-visuals | done / auto | Check-dimensions section UI to mockup; CSS scene/pedestals (no JPEG soft-key fringe); swap-ready for hi-res RGBA | 2026-07-26 |
| hero-complete-closeout | done / auto | Homepage hero complete closeout: glass pad, marketing container, hero logos variant, dead HERO keys | 2026-07-25 |
| sample-report-mock-redesign | done / auto | Product-true sample report dashboard mock redesign | 2026-07-25 |
| sample-report-hero-polish | done / auto | Sample report section visual polish to reference | 2026-07-25 |
| hero-finalize-sizing | done / auto | Finalize homepage hero glass sizing/layout; design skill + learning | 2026-07-25 |
| hero-radius-layout | done / auto | Homepage hero radii, icons, layout rhythm to mockup; product-true trust | 2026-07-25 |
| hero-design-pass | done / auto | Hero denser layout, Product nav, illustration/input polish | 2026-07-25 |
| homepage-conversion-closeout | done / auto | Product-true homepage sample mock, hero WebP, docs sync, verify | 2026-07-25 |
| hero-design-match | done / auto | Homepage hero visual match to mockup composition/glass/input/logos | 2026-07-25 |
| hero-sample-mockup-match | done / auto | Homepage hero + sample mock to mockups (interim; honesty closeout follows) | 2026-07-25 |
| homepage-completeness-pass | done / auto | Homepage completeness: shared chrome, a11y tabs, mobile workflow, copy cleanup, footer dedupe, visual QA. | 2026-07-25 |
| homepage-redesign-mockups | done / auto | Homepage post-hero redesign to mockups | 2026-07-25 |
| hero-glass-crop-position | done / auto | Lossless crop excess alpha on hero glass PNG | 2026-07-25 |
| hero-glass-master-as-is | done / auto | Ship user transparent glass master as homepage hero PNG | 2026-07-25 |
| hero-glass-fringe-fix | done / auto | Fix white-plate + black outline on home hero glass | 2026-07-25 |
| hero-glass-user-art | done / auto | Replace homepage hero with user glass plate | 2026-07-25 |
| hero-glass-no-fringe | done / auto | Kill black fringe on home hero glass | 2026-07-25 |
| homepage-hero-polish | done / auto | Homepage hero polish | 2026-07-25 |
| homepage-hero-refresh | done / auto | Homepage hero redesigned to mockup | 2026-07-25 |
| brand-sheet-align | done / auto | Applied brand sheet mark/lockups | 2026-07-25 |
| brand-refresh-hiw-hero | done / auto | /how-it-works AI Gap hero mockup match | 2026-07-25 |
| hero-mockup-match | done / auto | Homepage hero composition aligned to mockup | 2026-07-25 |
| scan-loading-completion | done / auto | COMPLETED hold flags, re-check handoff, handoff hygiene, honest substeps, progressive parity cleanup | 2026-07-24 |
| report-chrome-honesty | done / auto | AI summary callout honesty + remove ShareStatusBanner; RubricBar counts; ShareDrawer warning | 2026-07-24 |
| scan-loading-ux | done / auto | Instant scan handoff, honest stage progress, progressive↔completed report parity, progress-ui cleanup | 2026-07-24 |
| made-with-intelligence | done / codex-root | Evidence-backed technology detection, normalized audit snapshots, report and progressive UI, re-check diffs, sanitized APIs, eligible public profiles, migration/backfill, tests, and canonical docs | 2026-07-23 |
| customer-journey-completion | done / cloud-agent | Phases 1–3 anon evidence/honest Copy/score/nav; merged to main | 2026-07-23 |
| strategic-sprint | done / cloud-agent | Preview scan access, Railway deploy gate, Lovable/Bolt partners, unified Finish Plan, MCP quality gate | 2026-07-23 |
| fix-live-images | done / cloud-agent | Restore live logo/marketing images; unoptimized public assets + localPatterns guard; merged to main | 2026-07-23 |
| launch-quality-accuracy | done / cloud-agent | Scan accuracy baseline, accuracy-eval CI gate, HTML parser FP fixes, builder fixtures, corpus refactor, completion plan, skills | 2026-07-23 |
| axi-project-agent-pilot | done / codex | Independent AXI-style project context, affected verification, real evals, bounded output, and harness measurement | 2026-07-22 |
| agent-native-cli | done / codex | Task-shaped check → Finish Plan and re-check → verification diff CLI workflows | 2026-07-22 |
| launch-check-completeness | done / auto | PI/Finish Plan/Remember, dogfood, Studio share, Project watch, skills/docs | 2026-07-22 |
| dogfood-audit-quality | done / auto | Absorbed into launch-check-completeness | 2026-07-22 |
| howitworks-visual-spacing | done / auto | Absorbed / superseded by launch-check-completeness focus | 2026-07-22 |
| merge-origin-main-sync | done / auto | Merged origin/main into local main; auto-resolved overlaps; pushed | 2026-07-21 |
| completeness-final | done / auto | Gates, truth residual, design/copy, dead code, Strength/Touch CRITICAL, skills/docs | 2026-07-20 |
| product-intelligence-vision | done / auto | Vision canon + Phase 1 PI/Finish Plan/Remember + skills | 2026-07-20 |
| lean-fix-markdown-panel | done / auto | Collapse Why/Evidence/Verify into lean Markdown Fix box; SeveritySignal; Wrench icon | 2026-07-20 |
| loading-report-seam | done / auto | Progressive→completed chrome parity; absorb streamline-meta; skills/docs | 2026-07-20 |
| report-streamline-meta | done / auto | Absorbed into loading-report-seam | 2026-07-20 |
| homepage-conversion-reorder | done / auto | Homepage conversion reorder: sample-first, deeper Flag examples, why-AI, integrations | 2026-07-20 |
| report-density-refactor | done / auto | Report density + chrome IA + progressive parity + skills | 2026-07-20 |
| report-fixloop-chrome | done / auto | Remove redundant Scanned/Top fix/count chrome from report flag list | 2026-07-20 |
| beat-scout-completeness | done / auto | Wire completed-report Contract/Timeline; editable contract; journey bias; silent failure; overlays; anti-FP; roast polish | 2026-07-20 |
| why-it-matters-first | done / auto | Why it matters first in flag detail panels | 2026-07-20 |
| anon-wedge-completion | done / auto | 1-anon teaser: central gate, claim usage, score leak, copy/skills/analytics | 2026-07-20 |
| beat-scout-precision | done / auto | Network/API Flags, overlay detection, action timeline, Product Contract, roast/CLI/IDE harden, skills/docs | 2026-07-20 |
| help-center | done / auto | First-party Help Center + chat escalation + contextual help | 2026-07-20 |
| hero-illustration-blend | done / auto | Soft glass-flag wash behind landing hero | 2026-07-19 |
| product-evidence-polish | done / auto | Product Evidence lead + Flag-shaped findings | 2026-07-19 |
| completeness-cleanup | done / auto | Sample hint, buy_credits gate, quota copy truth, skills/docs | 2026-07-19 |
| marketing-copy-cya-cut | done / auto | Cut CYA, builder vernacular across marketing + product microcopy | 2026-07-19 |
| payments-live-ready | done / auto | Stripe test + Railway vars + billing harden + copy/legal/skills | 2026-07-19 |
| ship-fully-functional | done / auto | Unblock Railway, journey flags, visual evidence, skills/docs | 2026-07-19 |
| railway-npm-ci-fix | done / auto | Folded into ship-fully-functional (zod4 + auth pins) | 2026-07-19 |
| merge-origin-main | done / auto | Merged origin/main into local main; resolved BOARD conflict | 2026-07-19 |
| ultimate-audit-product | done / auto | Ultimate audit Phases 0-5: Playwright, narrative report, journey MVP | 2026-07-19 |
| ship-completeness | done / auto | Playwright unify, visual capture, product gaps, skills/docs | 2026-07-19 |
| merge-all-to-main | done / auto | Merged unmerged branches into main; always-work-on-main rule | 2026-07-19 |
| launch-funnel-p0 | done / auto | Launch-ready homepage + funnel P0/P1; P2 handoff | 2026-07-19 |
| passkey-2fa | done / auto | Passkey-based two-factor authentication | 2026-07-19 |
| speed-opt-cwv | done / auto | Speed/CWV: homepage, report load, critical workflows | 2026-07-19 |
| app-polish-review | done / claude | Reviewed+closed first-value-journey and ship-ready-core-loop | 2026-07-18 |
| ship-ready-core-loop | done / auto | Post-claim unlock, AI pending poll, trust UX | 2026-07-17 |
| first-value-journey | done / auto | Restore anon first scan, remove post-signup double-submit | 2026-07-17 |
| completeness-refactor | done / auto | Completeness: billing gates, sample provenance, report cleanup | 2026-07-17 |
| homepage-art-direction | done / codex | World-class homepage visual system, generated brand imagery | 2026-07-17 |
| convert-ready-pass | done / auto | Conversion + report UX + marketing foundation pass | 2026-07-17 |
| branch-integration | done / auto | Merged feedback-loop-system and fix-flags-docs into main | 2026-07-16 |
| app-polish-shipping | done / claude | Ship-readiness review, scan-accuracy false-positive removal | 2026-07-15 |
| completeness-dead-paths | done / auto | Purge SUMMARY_ONLY/skipCapture dead paths + live re-check proof | 2026-07-14 |
| completeness-core-loop | done / auto | Completeness ship: FULL re-check, Free cleared UI, silent UX | 2026-07-14 |
| merge-conflicts | done / auto | Merge origin/main into local main; resolve prompt-cache conflicts | 2026-07-14 |
| recheck-clarity | done / codex | Align core-loop and paid-value copy with Flag -> Fix -> Re-check | 2026-07-12 |
| report-quality-release | done / agent | Report quality + UX release plan | 2026-07-11 |
| fixflags-lovable-lab | abandoned / pi-agent | Replaced by fixflags-lab (agent builds, Git checkpoints) | 2026-03-08 |
