# GOAL_BRIEF — FixFlags Completion: Product-Centric Workspace

Executable detail for the `/goal` contract. The goal agent reads this file first and executes it end to end. Canonical context: `AGENTS.md`, `knowledge/vision.md` (Product Memory, Experience, Product Graph, SHIPPED/NEXT/VISION), `docs/workspace-interface.md`, `QUALITY.md`, `ROADMAP.md`, `DECISIONS.md`.

## Baseline (verified 2026-08-08)

- 15/165 component tests red. Single root cause: in-flight `components/report/ScoreHistoryChart.tsx` change is missing the `cn` import (`ReferenceError: cn is not defined`), breaking ReportWorkspace, ReportWorkspaceChrome, ScoreHistoryChart, and one homepage test. This component is the seed of the Product Spine — land it properly, do not patch-and-move-on.
- Coverage 49.62% vs 70% target on `lib/audit` + `lib/billing` + `lib/auth` (QUALITY.md).
- Known a11y defects: white text on brand orange `#ff5900` (3.14:1) on primary CTAs; `definition-list`/`dlitem` on homepage; `aria-prohibited-attr` on sign-in.
- Vision docs landed uncommitted (16 modified files include the vision integration). The goal run owns committing its own work; commit the vision integration only if not already committed.
- Pre-existing working-tree change `components/report/ScoreHistoryChart.tsx` is the user's in-flight work — it is the spine seed, owned by this goal.

## Objective

Ship the Product-centric workspace: the top-of-workspace score history becomes a playable Product Spine (one bar per observation, opacity = score, green at 100), the chat becomes product-grounded, the workspace re-anchors on the Product, design is consistent and accessible, and the app is fully functional with zero temporary fixes or fallbacks. All agent-executable phases below must land green.

## Phases (execute in order; each phase ends with verification green)

### Phase 1 — Land + Green + Spine

**1.0 Baseline green (do first, small)**
- Restore the `cn` import in `ScoreHistoryChart.tsx` only as part of landing the full spine component (1.1) — do not ship a bare patch as a stop.
- Run `npx vitest run components/` and confirm the 4 failing files are the ones this goal owns.

**1.1 Product Spine (the core of this goal)**
Rewrite `components/report/ScoreHistoryChart.tsx` as the Product Spine and place it at the top of the workspace above all panels (chat / browser / report).

Spec (from the approved design direction):
- One vertical bar per observation: product review, update review, watch run. Newest right.
- Opacity encodes score: `opacity ≈ score/100` (score 0–98 → faint to near-solid ink; 99 → full opacity; 100 → success green `#22C55E`).
- No-score observations (partial/degraded/failed captures) render as a hollow/outline bar with a small dot. Never hide them. Never fake a score.
- Active bar: ink caret below, JetBrains Mono score chip above (`tabular-nums`). Date labels under bars (mono 2xs); span dates at strip edges.
- Loading state: calm shimmer bars. Live scan in progress: one indeterminate animated bar appended at the right end. Respect `prefers-reduced-motion`.
- Hit areas ≥44px per bar (bar is a visual inside a proper tap target). Arrow-key navigation, `aria-current`, meaningful `aria-label`s ("Update review, Jun 3, score 87"). Keyboard focus visible.
- Selecting a bar re-anchors the workspace: browser panel shows that observation's captures, Fix list shows that moment's Flags, chat context switches to that observation.
- Mobile: horizontal scroll strip under the header. Dark mode: fully re-authored, bars legible.
- Extend `lib/report/workspace-model.ts` `ReportWorkspaceHistoryPoint` (`id/score/checkedAt` → + observation kind label, status, nullable score) and update the loader to aggregate per-Product history across observations (Project-scoped). If the loader is per-report only, extend it; do not fake history.
- Update `ReportWorkspaceChrome.tsx` placement and any other consumers. Keep `ReportExplorer` as the only detailed Flag browser.
- Tests: rewrite `ScoreHistoryChart.test.tsx` for the spine (bars count, opacity mapping, green-at-100, hollow no-score, keyboard, aria, empty/one/many states); keep `ReportWorkspace`/`ReportWorkspaceChrome` tests accurate to the new chrome.
- Verify: `npx vitest run components/` green, `npm run ui:drift-guard`, `npx tsc --noEmit --incremental false`, `npm run lint`. Browser-verify at 375/768/1280, keyboard, reduced motion.

**1.2 Design consistency + accessibility (decide now, not later)**
- CTA contrast decision (decided): ink text on brand orange for text-bearing buttons, applied at the shared token/`Button` level (e.g., dark ink `--foreground` on `--brand` for primary CTAs), keeping Flag Orange as the single accent. Do not introduce a second accent color. Update any affected marketing/homepage/sign-in CTAs through the shared primitive only.
- Fix `definition-list`/`dlitem` on the homepage and `aria-prohibited-attr` on sign-in at the component level.
- Audit: green used ONLY as the perfect-state color; JetBrains Mono for scores/grades/dates/tabular values; one accent per surface; no traffic-light spectrums.
- Verify: axe-clean workspace and touched surfaces, `ui:drift-guard`, contrast AA at 375/768/1280.

### Phase 2 — Product-centric depth

**2.1 Product-grounded chat**
- `WorkspaceChatPanel.tsx` + chat route/model: answer product-level questions deterministically from real Product Intelligence — "what changed since the last review", "is [flag] verified", "what's unresolved", "what should I fix first". Context follows the selected spine observation.
- Provider-down path = canned answers grounded in actual data (Contract, verified learnings, diff state, unresolved Flags). Never lorem, never fake.
- Keep shipped policy: owner-only, per-report session cap, cheap router model, canned degradation.
- Tests: canned-answer correctness for each question type; context switch behavior.

**2.2 Product anchoring + Memory**
- History aggregation across observations per Project (loader/model work from 1.1 completed here if not already).
- Contract + learnings + "what good means" surface as product-level primitives (ProductMemoryStrip becomes product memory, not a report decoration).
- Reports remain for share/SEO/public. No new route unless the report workspace cannot host the spine — prefer staying on the canonical report route.
- Tests: product-level history rendering, memory surfacing, anon/owner/shared states unchanged.

### Phase 3 — Harden + Refactor

**3.1 Real quality tests (not numbers)**
- Behavioral tests for the money path: billing limits/usage metering (`lib/billing`, `lib/audit/usage.ts`), share grants (`lib/security/share-grant.ts`), access control (anon gating, report access), checks-create, health. Tests assert behavior, never implementation.
- Push coverage toward 70% on `lib/billing` + `lib/auth` + critical `lib/audit` modules with real behavior tests. Do not game coverage (no assert-everything, no skipping).
- Expand workspace state matrix: empty / one scan / many scans / degraded / failed / shared / anonymous / owner / watched / update-review diff.

**3.2 Streamline**
- Workspace duplication audit: `ReportWorkspaceSplitShell`, `ReportWorkspaceChrome`, `AuditReport`, `LiveReportExplorer`, `ReportWorkspace` — consolidate shared chrome at the primitive/model boundary. Rule: no second report app.
- Integrate the spine without dead copies of the old line chart unless it earns its place in report detail.
- Sweep unused exports/components/off-by-default flags introduced or revealed by this work.
- `lib/report/workspace-model.ts` is the single view model; remove ad-hoc model builders.
- Verify: `npx tsc --noEmit --incremental false`, `npm run lint`, app routes smoke, no unused imports.

### Phase 4 — Release readiness (agent part)
- Full `npm run verify` (per QUALITY.md) on the landed tree. Fix only regressions caused by this work.
- Local health/readiness smoke: worker, browser, AI chain (with local keys if present), `/api/health` endpoints.
- Update `docs/iteration-log.md` with a dated entry summarizing what landed.

## Work packages (subagent-executable)

Split by file-disjoint scope. Subagents start blind: each prompt carries the full brief. Subagents never commit; the goal agent integrates and verifies. P1 is DONE (landed turn 4, suite green 3563 tests).

| Pkg | Phase | Owner | Files (exclusive scope) | Status |
|-----|-------|-------|------------------------|--------|
| P1 | 1.0/1.1 foundation | goal agent | vitest.setup.ui.ts, ScoreHistoryChart.tsx(+test), workspace-model.ts(+test), ReportWorkspaceChrome.tsx(+test), button.tsx, dashboard/page.tsx, load-report-route-state.ts, curated-sample.ts, static-sample.ts, sample-report-display.ts | DONE |
| P2 | 1.1 playability + 2.2 memory | goal agent | ReportWorkspaceChrome.tsx (selection props), DashboardReleaseHub.tsx, ReportWorkspace.tsx, new observation snapshot read API + tests, ProductMemoryStrip.tsx | next |
| P3 | 2.1 product-grounded chat | subagent A | WorkspaceChatPanel.tsx, app/api/reports/[id]/chat/route.ts, chat helpers, chat tests | queued |
| P4 | 3.1 quality tests + coverage | subagent B | lib/billing/**/*.test.ts, lib/auth/**/*.test.ts, lib/audit/**/*.test.ts (new tests only) | queued |
| P5 | 1.2 a11y + design consistency | subagent C | homepage dl/dlitem fix, sign-in aria fix, CTA contrast verify through shared Button, axe checks | queued |
| P6 | 3.2 streamlining | subagent D | workspace duplication audit + dead code sweep; EXCLUDES P1/P2/P3 files | after P2/P3 |
| P7 | 4 release readiness | goal agent | full verify, health smoke, docs/iteration-log.md entry | final |

Dependency note: P2 and P3 both consume the P1 model (stable). P6 must not run concurrently with P2/P3 file edits.

## Captain queue — DO NOT ATTEMPT (operator-only; report as blockers if a phase depends on them)

- Stripe: new $69/$199 test+live prices, 4 promo codes, live webhook + `whsec_`, `PLAN_RELEASE_DATE` (docs/launch-checklist.md).
- Non-member checkout behavior decision (launch checklist #6).
- `ANTHROPIC_API_KEY` on both Railway services.
- CLI npm release (2FA, trusted publisher, protected tag).
- Release-proof sandbox (deploy URL, disposable DB, sandbox users, mailbox, GitHub fixture).
- Lab deploy URL for the dogfood loop.

If a phase needs one of these, complete everything else, then pause and report the exact blocker.

## Guardrails (winning without cheating)

- No temporary fixes or fallbacks. Every degraded path is honest and deterministic (repo standard — preserve it).
- Do not delete, skip, weaken, or narrow tests to make the goal pass.
- Do not fabricate data, scores, history, evidence, or test results.
- Do not refactor unrelated code. Do not add dependencies.
- Preserve the anonymous paste-URL → report wedge flow untouched.
- One accent (Flag Orange); green only as the perfect-state reward.
- Claim scope on `.agents/BOARD.md` (one row per work package, owner = goal agent) before starting each package; preserve all pre-existing working-tree changes.
- Every change must be exercised through its real path: loading, empty, error, responsive states.
- `ui:drift-guard`, `tsc`, lint, and the component suite must be green before a package is declared done.

## Documentation policy (smart — follow the knowledge evolution loop)

Documentation is not a changelog of edits. It is the repo's persistent memory of the product, and it must stay coherent. Follow `EVOLUTION-RULES.md` and `CANONICAL-SOURCES.md`; every concept has ONE canonical source.

1. **Before implementing a phase, check whether it changes what we know** about the product (behavior, architecture, design tokens, data model, roadmap, terminology, invariants). If yes, update the canonical source FIRST, then implement (evolution loop: update → implement → reconcile).
2. **Find the one canonical home** in `CANONICAL-SOURCES.md` and update it in place. Never create a new doc for existing knowledge. Never duplicate — replace duplicates with a link to the canonical source.
3. **Respect SHIPPED / NEXT / VISION** (`knowledge/vision.md`). Product behavior lands in `PRODUCT.md` only if it actually ships. Never claim unshipped capabilities (Product Graph, global intelligence, "Fix it for me", multi-signal Flags) as shipped in docs, copy, or reports.
4. **Link, don't restate.** If a fact belongs to another document, reference it. Keep each document answering its one primary question.
5. **Remove obsolete knowledge.** If this work supersedes a statement, delete or mark it superseded — never leave conflicting docs to rot.
6. **Update the indices.** If a canonical home changes or a new concept appears, update `CANONICAL-SOURCES.md` and `knowledge/README.md`.
7. **Don't hardcode volatile facts.** Check counts, model counts, and capability lists are generated from code (`npm run agent`, `npm run audit:capabilities`) — reference the commands, not stored numbers.
8. **Log the run.** End with a dated entry in `docs/iteration-log.md`: what landed, what changed, what is still open — evidence-backed, no filler.
9. **Voice.** Follow `docs/voice-and-copy.md` in visible docs: no em dashes, no banned filler, concise sentences.
10. **No ADRs.** Do not create ADRs. Durable decisions belong in `DECISIONS.md` only for product, soul, design, architecture, data, security, or quality decisions with real alternatives — this goal's design decisions (spine, CTA contrast) are recorded via the docs above, not new decision files.

## Verification commands

- Per checkpoint: `npx tsc --noEmit --incremental false && npm run lint && npx vitest run components/`
- Per phase end: add `npm run ui:drift-guard` (and `npm run brand:hex-guard` if design tokens change)
- End of goal: full `npm run verify` (see QUALITY.md) — fix only regressions caused by this work.
