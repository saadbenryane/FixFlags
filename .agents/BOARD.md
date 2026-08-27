# Task Board

_Active tasks. One owner per scope. Archive completed records._

| Task ID | Status | Owner | Branch/worktree | Scope | Files/areas | Dependencies | Updated |
| --- | --- | --- | --- | --- | --- | --- | --- |
| product-page-clarity | in-progress | composer | main | Coverage page counts, Made with scroll row, drop launch gates UI, simplify Watch, Product Intelligence | ProductWorkspace, MadeWithProfile, copy, report-contract, DESIGN | — | 2026-08-27 |
| app-page-gutters | review | composer | main | Restore horizontal page padding on app dashboard/product pages (remove lg:px-0) | dashboard, products pages | Uses shared Container padding (1.25–2rem) | 2026-08-27 |
| sidebar-account-chrome | review | composer | main | Theme toggle above avatar; Settings last in rail; avatar opens Products/Settings/Help/Log out menu | sidebar, AvatarMenu | Focused layout tests green | 2026-08-27 |
| billing-page-cleanup | review | composer | main | Clean billing redundancy; show plans below; modal upgrade CTA; billing history section | billing/page, UsageMeter, PlanPicker, BILLING_PAGE_COPY | Tests green for UsageMeter + billing sections + PlanPicker. | 2026-08-27 |
| agent-chat-suggestions | review | composer | main | Move Agent suggested prompts above composer outside the input box; improve suggestion copy | WorkspaceChatPanel, report-workspace copy | Tests green. Chips: What should I fix first? / What's still open? Outside form. | 2026-08-27 |
| score-ring-pending-loader | review | composer | main | Center pending score dots; brand rotating loader arc on ScoreRing | ScoreRing, ReportOutcomeBar | Tests green. Pending uses three centered dots + brand arc spinner (motion-safe). | 2026-08-27 |
| report-explorer-chrome | review | composer | main | Report explorer chrome cleanup: Top Flags, prompt shell, outcome actions, footer align | ReportExplorer, FlagDetailPanel, AuditPageActions, ExportMenu, copy | 108 focused tests green. Update review kept; Export icon-only; Copy all in Fix Prompt menu. | 2026-08-27 |
| review-depth-truth | review | grok | main | Closeout: one reviewDepth contract, unique-path Flag identity, honest coverage, persist union after each page, retire 6-URL crawler teaching | consolidate-flags, persist, runner, combine-pages, scan-catalog, audit-pipeline, product coverageLabel, dead critical-path | Live depth-2 fixture `cmtas0uwf0000gpr8o6p22xcp` (18 pages, PARTIAL, On N pages). Browser 375/768/1280. Agent verify passed. Do not unpark CLI/MCP. | 2026-08-27 |
| public-review-depth | review | grok | main | Plan-based reviewDepth: open-check unique public destinations, full review by plan, equal judgment, Flag-based score, lean coverage UI, pricing copy | url-identity, open-check, review-depth, runner, create-audit, pricing copy, report/product chrome | Closeout completed by review-depth-truth. Live fixture `cmtas0uwf0000gpr8o6p22xcp`. Do not unpark CLI/MCP. | 2026-08-27 |
| knowledge-base-completion | review | codex-root | main | Game On: help/docs/faq chat, search, parity, in-product help, dead-code removal, CI guards | lib/help, lib/knowledge, components/help, components/docs, app/(marketing)/help, scripts/help-catalog-guard.mjs, CANONICAL-SOURCES, ARCHITECTURE | Session: `.agents/sessions/knowledge-base-completion.md`. Automated proof green; manual browser checklist pending. | 2026-08-26 |
| simplify-product-report-ux | in-progress | codex-root | main | Complete the URL-first product: preserve and park power-tool code, finish the calm Product/Report hierarchy, and convert plans to shared web capabilities with monthly usage limits | Product workspace, public surface boundary, billing/usage/entitlements, pricing/marketing/help/docs, auth claim flow, release guards/health, focused and full verification | Parking, billing, schema, and dormant-tool gates pass. A concurrent report task currently hides retained Preview, Timeline, and Canvas and causes 17 report UI failures. Production Stripe and deployed proof also remain. | 2026-08-25 |
| game-on-product-completion | review | grok | main | Code-owned customer loop shipped: honest claim, progressive gated Copy chrome, designed handoff, docs match parked Preview/Timeline/Canvas. Operator Railway/Stripe/npm stay on game-on-release-evidence. | ReportClaimDialog, AuthFlow, AuditInput, ReportHeaderAuth, WorkspaceChatPanel, post-login claim flow, explorer-model, AuditReportProgressive, start-scan-handoff, report loading, PRODUCT/DESIGN/report-contract | Agent verify passed. Browser 375/768/1280: header 56 leftover 0; Copy opens save-report create-account. Operator packet: `.agents/sessions/game-on-wedge-operator-packet.md`. | 2026-08-26 |
| continuous-improvement-system  | in-progress | codex-root | main            | Production dogfood exposed an unsupported mobile-CTA verdict; candidate now grounds verdicts in validated persisted Flags and retains the failure as rendered and deterministic regression evidence | Judgment integrity; release matrix; production dogfood; CLI/MCP parity; qualified customer value proof | No product expansion; release fixture and deployment-safety defects must be resolved before push/deploy; preserve separately owned `fixflags-lab` | 2026-08-13 |
| game-on-release-evidence       | review | unassigned | main            | Split disposable release and production trust boundaries, attest exact-SHA deployments, and prove candidate-to-latest CLI promotion | `scripts/release-*`, `scripts/validate*`, release workflows/package scripts/tests only | Local contract and 87 release-script tests pass; Railway settings, exact-SHA deployment, candidate publication, dogfood, and promotion receipts remain external gates | 2026-08-25 |
| game-on-verification-matrix | proposed | unassigned | main | Replace brittle completeness assertions and prove the shared workspace, access matrix, keyboard behavior, responsive reflow, and browser states | completeness/report-pane/UI-eval/public-journey verification scripts and tests only | Resume browser proof after the integrated accessibility fixes; remove the conditional E2E skip by running the full environment, then run report-pane, UI eval, agent verify, and full verify | 2026-08-25 |
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
