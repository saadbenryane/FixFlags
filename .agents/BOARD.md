# Task Board

_Active tasks. One owner per scope. Archive completed records._

| Task ID | Status | Owner | Branch/worktree | Scope | Files/areas | Dependencies | Updated |
| --- | --- | --- | --- | --- | --- | --- | --- |
| game-on-url-first-complete | in-progress | grok | main | URL-first loop. Current hill: Update review receipt on the child report so a flat score cannot hide Fixed vs New. First-scan completeness and like-for-like progress are next. Preview/Timeline/Canvas/CLI/MCP stay parked. | report outcome bar, Agent scan messages, update-review-progress, accessibility prescriptions | Operator SHA/Watch/Update-review receipts stay on game-on-release-evidence. Do not unpark power tools. | 2026-08-31 |
| continuous-improvement-system  | in-progress | codex-root | main            | Production dogfood exposed an unsupported mobile-CTA verdict; candidate now grounds verdicts in validated persisted Flags and retains the failure as rendered and deterministic regression evidence | Judgment integrity; release matrix; production dogfood; CLI/MCP parity; qualified customer value proof | No product expansion; release fixture and deployment-safety defects must be resolved before push/deploy; preserve separately owned `fixflags-lab` | 2026-08-13 |
| game-on-release-evidence       | review | unassigned | main            | Split disposable release and production trust boundaries, attest exact-SHA deployments, and prove candidate-to-latest CLI promotion | `scripts/release-*`, `scripts/validate*`, release workflows/package scripts/tests only | Local contract and 87 release-script tests pass; Railway settings, exact-SHA deployment, candidate publication, dogfood, and promotion receipts remain external gates | 2026-08-25 |
| agent-heartbeat-refactor        | in-progress | pi-agent   | main            | Refactor company heartbeat: restart-safe cadence state + history log, three tiers (6h operational / daily / weekly) with deterministic evidence packets, productivity deltas (turns/board/fleet), fixflags readout --json/--tier modes, docs reconciled, config migrated (poll 60m, operational 6h) | lib/heartbeat.mjs, server.mjs, scripts/test-heartbeat.mjs, data/company-heartbeat.json (pi-web); scripts/agent-heartbeat.mjs + .agents/company/*.md + .agents/README.md (fixflags) | None; preserve other agents' uncommitted pi-web edits | 2026-08-10 |
| agent-p7-release-proof         | blocked     | codex-root | main            | Credentialed release verification and production role journeys; continuation checklist in `.agents/sessions/agent-workspace-completion.md` | release environment, disposable database, sandbox Free/Pro/Studio accounts, production URL | Operator-provided release credentials, reset consent, and fixtures; local Docker image proof passes | 2026-08-11 |
| fixflags-lab            | in-progress | pi-agent   | main            | Agent-built lab app + Git checkpoints + FixFlags dogfood loop; no Lovable, no MCP auth blockers                                           | `.agents/sessions/fixflags-lab-plan.md`, sibling `fixflags-lab-01`, accuracy/learnings                                                     | Operator: deploy URL for lab repo, FixFlags local env working                                                                              | 2026-03-08 |
| cli-customer-onboarding         | blocked     | codex-root | main            | Publish-ready CLI, safe browser/token auth, customer skill, editor init, unified onboarding, and release verification                                                         | fixflags-cli, app/api/cli, app/cli, public/.well-known/skills, prisma, .github/workflows, CLI/MCP docs                                         | Operator must rotate the exposed key, claim npm package with 2FA, configure trusted publishing, and push the protected release tag                  | 2026-07-26 |
| current-product-completion      | blocked     | codex-root | main            | Local product completion merged to main 2026-08-02; credentialed deployed release proof remains.                                                                 | app, components, lib, e2e, docs, .agents                                                                                                       | Operator-provided release URL, disposable database/reset consent, sandbox users, mailbox assertion, GitHub fixture, and container environment       | 2026-08-02 |

---

## Completed

_Recent terminal work (from 2026-08-12). Older history: `.agents/BOARD-archive.md`._

| Task ID | Owner | Scope | Completed |
| --- | --- | --- | --- |
| game-on-wedge-honesty | composer | Superseded by game-on-url-first-complete. Park-clean Agent\|Report and outcome-card honesty remain. | 2026-08-31 |
| simplify-product-report-ux | codex-root | Superseded by game-on-url-first-complete. URL-first Product/Report hierarchy remains. | 2026-08-31 |
| game-on-product-completion | grok | Superseded by game-on-url-first-complete. Code-owned claim and gated Copy chrome remain. | 2026-08-31 |
| game-on-verification-matrix | unassigned | Superseded by game-on-url-first-complete. Launch-scope Playwright rewrites live in that umbrella. | 2026-08-31 |
| report-detail-overlay-truth | composer | Detail-only report Flag viewer; orange nav; outline Update review; consent overlay truth. Agent verify + accuracy:eval green. | 2026-08-29 |
| product-status-chrome | composer | Mobile Agent/Report icons; outcome cards on Product under chart. | 2026-08-29 |
| report-scroll-latest | composer | Auto-scroll Review history to right + Agent chat to bottom on load. | 2026-08-29 |
| report-finish-tight | composer | Outcome cards, remove Compare, capture-comparable Fixed. Deploy attested; Fixed dogfood continues on game-on-wedge-honesty. | 2026-08-29 |
| report-trust-polish-game-on | composer | Superseded by report-finish-tight. | 2026-08-29 |
| report-chrome-fixed-game-on | composer | Page-comparable Fixed + report chrome; Fixed dogfood continues on game-on-wedge-honesty. | 2026-08-29 |
| update-review-trust-game-on | composer | PARTIAL trust copy + prescription reliability; Compare later removed. | 2026-08-29 |
| update-review-work-identity | composer | reportId=work for Update review; startScanWithHandoff unified. | 2026-08-29 |
| products-dashboard-lean | composer | Lean Products dashboard; used-of-total meter; DemoSite sample. | 2026-08-29 |
| feedback-create-on-message | composer | SupportSession only after first visitor message. | 2026-08-29 |
| fixflags-dogfood-quality | composer | Journey honesty + security-header consolidation + corpus. | 2026-08-29 |
| changelog-aug-catchup | composer | Public /changelog catchup through Aug ships. | 2026-08-29 |
| score-rings-product-rubrics | composer | History ScoreRing sm + product rubric bars. | 2026-08-29 |
| product-prompt-chrome-parity | composer | Product Copy All via polishPassPrompt. | 2026-08-29 |
| post-login-empty-claim | composer | Empty claim is success; continue escape on failure. | 2026-08-29 |
| product-priorities-report-parity | composer | Absorbed into product-prompt-chrome-parity. | 2026-08-29 |
| product-page-clarity | composer | Coverage counts, Made with, Watch, Product Intelligence. | 2026-08-29 |
| app-page-gutters | composer | Shared Container padding on dashboard/product pages. | 2026-08-29 |
| sidebar-account-chrome | composer | Theme toggle above avatar; Settings last; avatar menu. | 2026-08-29 |
| billing-page-cleanup | composer | Billing redundancy cleanup; plans + history. | 2026-08-29 |
| agent-chat-suggestions | composer | Suggested prompts above composer. | 2026-08-29 |
| score-ring-pending-loader | composer | Pending score dots + brand arc spinner. | 2026-08-29 |
| report-explorer-chrome | composer | Top Flags, prompt shell, Export icon-only. | 2026-08-29 |
| review-depth-truth | grok | One reviewDepth contract; unique-path Flag identity; live fixture. | 2026-08-29 |
| public-review-depth | grok | Closeout completed by review-depth-truth. | 2026-08-29 |
| knowledge-base-completion | codex-root | Help/docs/faq chat, search, parity, CI guards. Automated proof green. | 2026-08-29 |
| app-chrome-honesty-closeout | grok | Signed-in Dashboard, Product, Settings, and Billing tell one story: used-of-total meters, sibling Settings cards, Studio naming, Help/QUALITY honesty, signed-in browser proof at 375/768/1280. Not Game On release-attested. | 2026-08-27 |
| billing-usage-clarity | grok | Absorbed into app-chrome-honesty-closeout. | 2026-08-27 |
| settings-account-flatten | grok | Absorbed into app-chrome-honesty-closeout. | 2026-08-27 |
| product-page-identity-review | grok | Absorbed into app-chrome-honesty-closeout. | 2026-08-27 |
| products-overview-evidence | grok | Absorbed into app-chrome-honesty-closeout. | 2026-08-27 |
| top-five-refactors | grok | Shrink agent OS, Agent+Report shell, quarantine power-tool UI, delete true dead code, collapse access/ranking duplicates. | 2026-08-26 |
| report-prompt-chrome | grok | Rename aggregate CTA to Copy all. Dock Fix Prompt + Copy prompt at the bottom of the report detail column across live, progressive, sample, and homepage. | 2026-08-26 |
| homepage-sample-centered-gate | grok | Center homepage sample review (title, subtitle, report, CTA below). Rename Copy Mega Prompt. Gate demo copy/send to signup. Fix chat placeholder truncation. | 2026-08-26 |
| editor-prompt-handoff | grok | Assemble copy-paste editor handoffs that name the live page, section, and search-then-plan method | 2026-08-26 |
| build-error-fix | grok | Test Next.js production build and fix compile/type errors that fail the build | 2026-08-26 |
| site-og-share-image | grok | Use the supplied 3D FixFlags artwork as the site Open Graph and Twitter share image | 2026-08-26 |
| report-export-email-declutter | grok | Move Email me this report into Export as a modal; remove Return to Product, Fix prompts on the way, and the report-level helpfulness box | 2026-08-26 |
| report-flag-evidence-ia | grok | One desktop/mobile Flag evidence pair, honest not-flagged badges, GIF in the affected frame, Product contract/memory/gates on products, remove report Review context drawer | 2026-08-26 |
| review-handoff-chrome | grok | Instant Review handoff shell, thin immersive header, kill gray strip, anon prompt chrome gated by create-account dialog | 2026-08-26 |
| homepage-final-cta-copy-left | grok | Swap the homepage final CTA card so copy and URL input sit on the left and the review plaque sits on the right. | 2026-08-26 |
| anon-report-chrome | grok | Logged-out scanning chrome matches signed-in completed reports: brand signup/login CTA, gated app rail, cookie-aware teaser access, last-hour anonymous URL reuse without sharing Agent chats | 2026-08-26 |
| homepage-hero-signal-field | grok | Paint the homepage hero on the same white canvas as the rest of the page. No generated field; no gray surface wash. | 2026-08-26 |
| homepage-conversion-visual-refresh | codex-root | Rewrote weak homepage conversion copy, renamed the curated sample to DemoSite, added restrained hero motion, refreshed How it works and rubric visuals, and redesigned the final URL CTA | 2026-08-26 |
| public-reports-copy-link | codex-root | Make report evidence public at the canonical report URL, remove protected-sharing product controls and privacy claims, and put Copy link in Export | 2026-08-25 |
| url-first-public-scope | codex-root | Park repository scanning, MCP, and CLI as undiscoverable power-user infrastructure so the public and signed-in product lead only to URL-based Product Reviews | 2026-08-25 |
| homepage-human-language-pass | homepage-wave1 | Finish the homepage as one human narrative, remove repeated proof/metrics, and validate the committed language pass at launch widths | 2026-08-25 |
| game-on-copy-docs | report-workspace-wave1 | Reconcile Update review, Finish Plan, prompt/Timeline access, and strict verification truth across canonical copy, docs, and repo skills | 2026-08-25 |
| game-on-judgment-ledger | product-loop-wave1 | Complete append-only Improvement actions, durable completion projection, and transport-consistent independent verification receipts | 2026-08-25 |
| homepage-proof-workflow-presence | codex-root | Polished homepage proof and How it works sections, added customer-led Message / Experience / Reach explanation, and documented space-first grouping | 2026-08-22 |
| lean-product-review-experience | codex-root | One canonical Review workspace with compact Score/history navigation, sample-only public Timeline, and an honest lean Product dashboard with real update-review actions | 2026-08-22 |
| game-on-product-loop | subagent-product | Superseded by `lean-product-review-experience`; its Product receipt provenance, operational states, and accessibility requirements remain acceptance criteria | 2026-08-20 |
| preview-evidence-overlay | grok | Measure Flag evidence at capture time and spotlight the real element on Product Preview. No preset boxes. Honest chip for page-scope / unmeasured. | 2026-08-19 |
| html-fallback-a11y-severity | root | HTML-only accessible-name fallbacks (unlabeled inputs, unnamed buttons/links) stay visible but are POLISH unless axe ran. Ranking must not lead with unverified a11y. | 2026-08-17 |
| report-rank-customer-visible | root | Shared Flag ranking prefers customer-visible Message/Experience over Reach SEO at the same severity. Agent, Report list, and Finish Plan use one comparator. | 2026-08-17 |
| agent-announce-ranked-flags | root | Agent transcript announces the highest-ranked Flags, not discovery-order SEO. Report still lists every confirmed Flag. | 2026-08-17 |
| report-pane-redesign | root | Report mode is a pane-native three-row surface: `ReportOutcomeBar`, container-query master/detail explorer, collapsed `ReportContextDisclosure`. Removed duplicated counts, CTAs, signup surfaces, and recheck entry points; deleted the sticky toolbar, workspace shell/chrome, rubric bar, and fix-list header. | 2026-08-17 |
| living-review-chat-chrome | root | Agent column is chat (bubbles, one working mark, ArrowUp composer, gate-on-send); Product header owns Preview-first toggle and device icons. | 2026-08-17 |
| preview-stage-launchpad | root | Three-row stage proven on homepage, /samples, and a live example.com scan at 375/768/1280. | 2026-08-17 |
| living-review-game-on | root | One full-bleed living editor for all live reports (spine in Report pane), restore Report context/CTA, samples+homepage shared chrome, delete dual-layout debt, docs/skills | 2026-08-16 |
| fullbleed-living-review | root | Full-bleed editor workspace: no pane cards, one scan-to-complete shell, Desktop/Mobile toggle, curated homepage emulation | 2026-08-16 |
| immersive-agent-workspace | root | Living Product review workspace: immersive no-footer active review, Product identity + curated FixFlags understanding, Preview-first evidence, Report-first completion, finite homepage value story, docs/skills | 2026-08-16 |
| scan-agent-first-ux | root | Rework the in-progress scan experience to be agent-first: Working status with clean animated indicator, IDE-style streaming transcript, no score at the top while scanning, Report | 2026-08-15 |
| sandbox-entry-journey | goal-agent | Superseded by `continuous-improvement-system`; its real entry-journey proof remains a required acceptance path | 2026-08-13 |
| game-on-launch-complete | codex-root | Superseded by `continuous-improvement-system`; its local and credentialed release gates remain required | 2026-08-13 |
| fixflags-agent-workspace | codex-root | Superseded by `continuous-improvement-system`; completed Agent workspace behavior is retained and must remain green | 2026-08-13 |

## Status definitions

- **proposed** — idea, not claimed
- **claimed** — owner assigned, work not started
- **in_progress** / **in-progress** — active work
- **blocked** — waiting on dependency
- **review** — ready for review
- **done** — completed and verified
- **abandoned** — no longer relevant

## Rules

- Read this board before any substantial write task
- Claim tasks by adding a row before starting
- Update status, ownership, branch, and worktree as they change
- Archive completed records (recent terminal work below the divider; older history in `BOARD-archive.md`)
- The board does not replace Git, tests, PRs, or external trackers
