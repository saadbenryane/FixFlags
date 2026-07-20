# FixFlags — Agent Operating System

**Canonical entry point for AI agents.** Read this first. Tool-specific files only redirect here.

## Project

**FixFlags** — The independent Product Intelligence System for AI-built software. Finish what your AI started: paste a URL, get a Finish Plan across Message, Experience, and Reach, with fix prompts for your AI editor. North star: `knowledge/vision.md`. Shipped truth: `PRODUCT.md`.

- **Stage:** Pre-revenue / testing. Prioritizing distribution over depth.
- **Domain:** fixflags.com | **Pricing:** Free (3 lifetime), Pro $29/mo (25/mo), Agency $99/mo (100/mo)

### Project facts (canonical — update these in place, do not duplicate elsewhere)

| Fact | Value | Source / regenerate command |
|------|-------|-----------------------------|
| Prisma models | **45** | `prisma/schema.prisma` (`grep -c '^model '`) |
| Check modules (barrel) | **22** (unique) | `lib/audit/checks/index.ts` `checkers[]` |
| Check capabilities | 47 (47 live, 0 partial, 0 planned) | `npm run audit:capabilities` |
| Check IDs | **158** | `lib/audit/check-ids.ts` `ALL_CHECK_IDS` |
| MCP tools | **16** | `lib/mcp/tools.ts` `server.tool()` |
| Pipeline version | **2.4.0** | `lib/audit/pipeline-config.ts` |
| AI models | triage `claude-haiku-4-5` / `gpt-4o-mini`, judge `claude-sonnet-5` / `gpt-4o-mini` | `lib/audit/judge-config.ts` (keep in sync with `MODEL_RATES` in `lib/billing/costs.ts`) |
| Test count | measured per run | `npm run test:unit` (do not hardcode) |

> **Glossary:** A *module* (22) is a `run*Checks()` function in `checks/index.ts`. A *capability* (47 total: 47 live, 0 partial) is a named check that may span multiple modules. A *check ID* (158) is the fine-grained flag identity in `check-ids.ts`. **Product Intelligence** is customer-owned product memory (`Project.productIntelligence`; see `knowledge/product-intelligence.md`). **Integrity Engine** is FixFlags’ general evaluator (`knowledge/integrity-engine.md`). **Finish Plan** is the ≤3 Improve artifact (`knowledge/finish-plan.md`). **Integrity dimensions** (5) are engine framework; **rubrics** (3: Message/Experience/Reach) are the shipped report model. Do not use these numbers or terms interchangeably.

## Key directories and authoritative files

| Path | What |
|------|------|
| `CODEMAP.md` | **Repository atlas** (entry points, directory map, "Where To Change Things") |
| `app/` | Next.js App Router (marketing, auth, app, audit, admin routes) |
| `components/` | React components (ui/, audit/, marketing/, layout/, etc.) |
| `lib/` | Core logic (audit engine, queue, billing, graph, prompts, MCP) |
| `lib/marketing/copy.ts` | **Single source of truth** for all marketing copy |
| `lib/help/` | Help Center catalog, search, contextual hrefs, chat SLA |
| `lib/design/tokens.css` | **Canonical design tokens** (colors, shadows, radii, type scale) |
| `lib/audit/` | Audit pipeline (runner, checks, scoring, flow, judge, persist) |
| `docs/audit-pipeline.md` | **Canonical audit pipeline reference** (triage, prescription, recovery) |
| `lib/queue/` | BullMQ queue (client, worker, inline-worker, recovery) |
| `lib/graph/` | Knowledge graph (persist, queries, snapshot) — internal only |
| `lib/billing/` | Subscription limits, credits, Stripe integration |
| `lib/prompts/system-prompt.ts` | AI triage + prescription prompts |
| `prisma/schema.prisma` | Database schema (see AGENTS.md Project facts for model count) |
| `scripts/` | CLI scripts (demo audits, backfills, guards) |
| `worker/` | Standalone audit worker |
| `knowledge/` | **Company knowledge base** (foundations, market, product, strategy, execution) |
| `docs/` | Strategy, positioning, voice, growth docs |
| `docs/growth/` | Organic growth workspace (architecture, roadmap, experiments) |
| `docs/voice-and-copy.md` | Voice & copy guidelines (276 lines) |
| `docs/design-rams-review.md` | Standing design review vs. Rams' ten principles (motion policy, status altitudes) |
| `docs/brand-positioning.md` | Brand identity and positioning |
| `docs/offering.md` | Product scope and philosophy |
| `test-strategy.md` | Testing strategy with readiness ratings |
| `.cursor/skills/fixflags-completeness/SKILL.md` | Repeatable completeness/docs-accuracy pass |
| `docs/scan-catalog.md` | All check modules catalog |
| `docs/scan-roadmap.md` | Scan module roadmap |

## Verified commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js + inline worker (single command) |
| `npm run dev:all` | Next.js + separate worker process |
| `npm run setup` | Docker up + generate + migrate + seed |
| `npm run typecheck` | `tsc --noEmit --incremental false` |
| `npm run lint` | ESLint with core-web-vitals + a11y + import |
| `npm run test:unit` | Vitest (lib/**/*.test.ts, node env, 30s timeout) |
| `npm run brand:hex-guard` | Brand color compliance |
| `npm run ui:drift-guard` | UI drift detection |
| `npm run seo:guard` | SEO compliance |
| `npm run build` | Production Next.js build |
| `npm run worker:build` | Worker TypeScript build |
| `docker build -t fixflags:local .` | Required before push when `Dockerfile`, `package.json`, `package-lock.json`, or `.npmrc` change (Railway uses Dockerfile) |
| `npm run verify` | All checks: validate + migrate status + drift + typecheck + lint + guards + test + build |
| `npm run validate:quick` | Changed-file-aware: lint changed TS + typecheck (fast feedback) |
| `npm run validate:affected` | Changed-file-aware: typecheck + lint + affected tests + guards |
| `npm run validate:full` | Full workspace validation (same as `verify` minus DB checks) |
| `npm run lint:changed` | Lint only changed TypeScript files |
| `npm run test:scripts` | Tests for repository automation scripts |
| `npm run agent:eval` | Agent evaluation harness (tests audit pipeline, prompts, scoring) |
| `npm run demo:audit:offline` | Demo fixture audit (CLI, no server) |
| `npm run demo:audit:flow` | Flow audit on demo fixture |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:deploy` | Prisma migrate deploy |
| `npm run db:seed` | Seed local admin |
| `npm run db:studio` | Prisma Studio |

## Critical invariants

### Product
- **Core loop:** Flag → Fix → Re-check. Every feature must serve this loop.
- **Re-checks are free and unlimited.** Never gate them.
- **Three rubrics only:** Message, Experience, Reach.
- **Marketing copy** lives in `lib/marketing/copy.ts` only — never hardcoded in components.
- **Banned marketing phrases:** "second pass", "flag it" (as punchline), "Ship tonight", "Fix my live site", "Start in 60 seconds", unlock, 10x, game-changing, world-class, comprehensive, robust, leverage, holistic.
- **No em dashes** anywhere in copy. Use periods, commas, or colons.
- **Homepage section order:** Hero (`LandingHeroSection`) → Sample review (`SampleReportSection` → `HeroProductPreview` → `SampleReportExplorer` → `ReportExplorer`) → Fix loop (`HowItWorksLoopSection`) → Everything we check (`CheckDimensionsSection`) → Deeper Flag examples (`ReportExamplesSection`) → Why AI (`WhyAiNeedsFixFlagsSection`) → Editor integrations (`EditorIntegrationsSection`) → Final CTA. Exactly one report explorer. Hero copy changes only when explicitly requested. Editor logos live in integrations, not the hero. Rubric card titles are Message / Experience / Reach only.
- **Social proof:** Use real product Flag output (`reportExamples`, sample explorer). Do not invent member counts or quote cards; `LANDING_PAGE.testimonials.quotes` stays empty until authentic quotes exist. `productEvidence` remains in copy for the empty-testimonials invariant but is not rendered on the homepage.
- **Browser automation:** Playwright only for audit capture (`lib/audit/browser/page-session.ts`, `lib/audit/screenshot.ts`). Do not reintroduce Puppeteer on the audit path.
- **No Scout-clone chat on the audit path.** Live proof is a structured **action timeline** (capture/flow/journey steps), not a conversational "check anything else" agent. Follow-ups are re-check + MCP.
- **Network evidence:** Same-origin XHR/fetch failures persist under `performanceData.networkFailures` and feed deterministic Flags. Journey `networkErrors` must be populated when collected.
- **Form probe safety:** Journey/flow may probe one same-origin engagement POST (signup/newsletter/contact) via `route.fetch`, record status, then fulfill/abort so the page does not keep a real subscribed state. Payment hosts and downloads stay blocked (`lib/audit/browser/journey-safety.ts`).
- **Overlay blockers:** When clicks fail because another element covers the target, emit specific overlay Flags (`overlay-blocks-*`) rather than only generic unclickable CTA.
- **Product Contract:** Inferred product intent (purpose, first-value journey, critical outcomes) persists on the audit and biases journey selection. Report shows it above Top Priorities.
- **Truth labels:** Derived on the model as Reproduced / Detected / Observed (`lib/report/explorer-model.ts`) for MCP/API. Report UI meta does **not** show truth pills. Network, overlay, and journey findings remain Reproduced in data.
- **Anti-false-positive:** Never flag tooling-path-like strings (`playwright-mcp`, `/tmp/...yml`) as content/template bugs.
- **Production Chromium:** Docker image installs system Chromium; Playwright uses `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`. Do not rely on Playwright browser download in the image.
- **Journey flags:** Created before finalize with `source: JOURNEY`. `clearAuditResults` / `persistTriageResults` must preserve them (only clear `DETERMINISTIC` + `AI`).
- **Visual evidence:** `lib/audit/capture/*` runs after flags in finalize (`tryCaptureVisualEvidenceForAudit`); stores `performanceData.flagVisualEvidence`. Wire through report page → `buildLiveExplorerModel`. Failures must not fail the audit.
- **Action timeline:** Structured scan events stream via report status API and render in progressive + completed report UI (`performanceData.actionTimeline` or pipeline log extension).
- **Changelog** (`CHANGELOG_ENTRIES` in copy.ts) is user-facing only: plain language, outcomes and benefits, never implementation details or internal terminology.
- **Social proof** must match `LANDING_PAGE.testimonials` disclaimer; never invent member counts.
- **Badge / roast SVG:** Raw hex allowed only inside generated SVG badge/roast artwork (not general UI). Prefer grade token colors.

### Architecture
- **Pipeline stages:** QUEUED → CAPTURING → CHECKING → JUDGING → FINALIZING → COMPLETED
- **22 check modules** run via `checks/index.ts` barrel; `slow-replay.ts` imported directly by `deterministic-audit.ts` (side-channel).
- **AI two-phase:** Triage (inline in audit job, 2500 chars pageText, all scans) → Prescription (async `ai-review` job, 5000 chars pageText, gated by `includeAi` + credits). **`includeAi` does not gate triage.**
- **Triage success criterion:** `triageAt` set on COMPLETED audits. Degraded triage (`triageAt` null + `failureCode`) still COMPLETED with deterministic flags.
- **Tech stack** for prescription comes from `auditPage.performanceData.detectedTech`, not `htmlMetadata`.
- **Knowledge graph** (`graph_*` tables) is internal-only. Public pages read through `lib/graph/queries.ts` only.
- **No programmatic page ships below `MIN_SAMPLE_SIZE`.** Canonical value lives in `lib/graph/queries.ts` (target: 20 distinct sites; temporarily may be lower while seeding growth pages — document any temporary value in that file).
- **Default deployment:** Single service with inline worker + self-hosted scheduler (no external cron).
- **`/post-login` is the single post-auth landing** for OAuth AND email flows: it claims anonymous audits (`useMe({claim:true})`, sets `includeAi`), then runs checkout/`next` navigation. Never navigate straight to `next` after auth: that skips the claim and leaves reports locked.
- **Report UI — Finish Plan section:** renders between verdict and flags explorer (formerly Top Priorities). Uses `rankFlagsByPriority(audit.flags, audit.rubricRows, 3)` with Product Contract / PI bias. Each card has `SeveritySignal`, rubric label, optional impact, problem text, `FixPromptBlock variant="compact"`. The header "Copy Finish Plan (N)" button uses `buildPlanModePrompt(flags, {url})`. `collectAllFixPrompts()` and per-rubric prompts remain in `ExportMenu`. See `knowledge/finish-plan.md`.
- **Report UI — Flags explorer:** Rubric + page filters only. No severity filter. Flags are pre-sorted by severity via `compareFlagsByPriority`. Flag meta: `SeveritySignal` → Rubric → Impact. Detail shows Fix via `MarkdownPromptBox` (rendered Markdown; copy is raw `buildExpertFixPrompt` with `## Why` / `## Evidence` / `## Fix` / `## Scope` / `## Verify`). No separate Why/Evidence/Verify cards. Evidence devices follow `devicesForCheck` (issue device only).
- **Report UI — section order:** Hero → ShareStatusBanner → RubricBar → sticky toolbar → verdict → status callouts (AI pending / partial / degraded) → RecheckDiffStrip (when present) → Product Contract → Finish Plan → Journey → Flow → Action Timeline (when present) → Flags → Previews → Launch → SampleFixCard (anon) → Re-check / footer. `app/report/[id]/page.tsx` must pass `productContract`, `actionTimeline`, and flag `source` into `AuditReport`.
- **Report UI — progressive chrome:** `AuditReportProgressive` uses the **same altitudes** as completed (`AuditReportHero`, `RubricBar`, `ReportStickyToolbar`, Contract → Timeline → Flags). Wire `getScanningLabel` / `getActivityMessage`. On COMPLETED, hold the progressive frame and `router.refresh()` into SSR `AuditReport`. Do not invent Journey/Flow mid-scan. Partial Callout only when `reportCompleteness === 'PARTIAL'`.
- **Report UI — sticky toolbar:** `ReportStickyToolbar` sits under the site header (`top-[var(--header-height)]`). Section nav matches DOM: Contract, Finish Plan (when present), Journey, Flow, Timeline, Flags, Previews, Launch, Re-check. No Overview tab — status callouts are not a nav destination. Fix prompts live in the explorer and Finish Plan. Below `xl`, actions and tabs stack on separate rows with denser tab height.
- **Report score ownership:** Hero = identity + `ScoreDot` only. RubricBar = per-rubric. Explorer = `ScoreRingGauge` `sm` + filters. Sticky-when-stuck = hostname + `ScoreDot`. Share status = `ShareStatusBanner` only (never duplicate in hero).
- **Anon report CTAs:** value strip + `SampleFixCard` only (no separate claim-guide card).
- **Re-check:** Manual re-check always enqueues `monitoringMode: 'FULL'` (fresh capture). Finalize diffs child flags vs parent via `diffFlagsAgainstParent`. No SUMMARY_ONLY / copy-parent / skipCapture path in application code (`SUMMARY_ONLY` remains a legacy Prisma enum value only).
- **Anonymous wedge:** Exactly **1** teaser scan without account (triage: scores, Flags, evidence; fix prompts stripped). Gate lives in `createAndEnqueueAudit` (`checkAnonymousAuditAllowed` + `trackAnonymousAuditId` + optional `clientId` IP soft ceiling). Second new URL → signup. Auth → `/post-login` claim → prescription. Claimed teaser **counts as 1** of Free's 3 lifetime new URL checks. Public APIs (report, `/api/v1/score`) never return unstripped prompts for anon. Lead URLs persist on `Audit` + `Lead` (`/admin/leads`).
- **If increasing AI pageText**, change **both**: `lib/audit/page-text-limits.ts` (storage + prompt limits) and `buildPrescriptionPrompt` in `lib/prompts/system-prompt.ts` (prompt slice).
- **Flag dedup** runs via `suppressOverlappingFlags()` in `lib/audit/checks/index.ts`: hardcoded `if` checks that drop the broader flag when a more specific sibling `checkId` is already present.
- **impactTag** is set on all deterministic checks.
- **Report component architecture:** `components/audit/` owns page-level layout (hero, toolbar, rubrics, actions). `components/report/` owns flag interaction (explorer, detail panel, fix loop, scoring). Shared primitives live in `components/ui/` (FilterPill, ScoreDot, ThumbsFeedback).
- **Shared report utilities:** `lib/audit/share-status.ts` (shareStatusMessage), `lib/audit/duration.ts` (durationFromTimestamps). Use these instead of duplicating the logic.
- **FilterPill icons:** `FilterPill` accepts an optional `icon` prop (LucideIcon). Rubric filters use `rubricIcon()` from `lib/utils.ts` (MessageSquare/Zap/Globe2). Page filter uses `Globe`. Severity is **not** a filter (sort-only via list order + `SeveritySignal` in meta).

### AI calls & cost
- **Providers:** OpenAI (`gpt-4o-mini`) primary, Anthropic fallback. Chain is `JUDGE_PROVIDER_CHAIN` (default `openai,anthropic`). Models resolve in `lib/audit/judge-config.ts`; override with `ANTHROPIC_JUDGE_MODEL` / `TRIAGE_MODEL` / `OPENAI_JUDGE_MODEL`.
- **Prompts live in `lib/prompts/system-prompt.ts`**, split into `build*SystemPrompt()` (stable, cacheable) and `build*UserPrompt()` (per-request). **Never interleave per-request page data into the system block** — that breaks the prompt-cache prefix match. Anthropic: send the system block via the `system` param with `cache_control: {type:'ephemeral'}`. OpenAI: send it as a leading `system` message (enables automatic caching).
- **Model IDs are load-bearing and go stale.** A retired ID 404s and silently falls through to the other provider. Keep `judge-config.ts`, `health/ai-providers.ts`, and `MODEL_RATES` in `lib/billing/costs.ts` in sync; add new IDs to `MODEL_RATES` (unknown models fall back to the Sonnet-tier default rate).
- **Cost tracking is cache-aware.** `estimateLlmCostUsd` prices cache reads (~0.1× Anthropic / ~0.5× OpenAI) and writes (1.25× Anthropic). When adding an LLM call site, thread `cacheReadTokens` / `cacheWriteTokens` from the judge usage object through to `persistAuditRunCost`.

### Design
- Use semantic CSS tokens (`bg-card`, `text-brand`, `shadow-card`, `rounded-card`), never raw hex except `grade.*`
- **Stack:** Tailwind + shadcn/ui (Radix primitives). Fraunces serif display, Satoshi sans UI, IBM Plex Mono labels.
- **Cards:** `border-0 shadow-card glass-surface`. Pill controls (`rounded-full`). Concentric radii (inner = outer − padding).
- See `lib/design/tokens.css`, `tailwind.config.ts`, `.cursor/rules/fixflags-ui.mdc`, `DESIGN.md`

### Voice
- Sharp senior reviewer who has shipped messy launches. Clear before clever. Calm before loud. Specific before impressive.
- Short sentences. Active voice. No filler adverbs (really, just, literally, actually).
- See `docs/voice-and-copy.md` and `SOUL.md`

### Security
- **Edge middleware** (`proxy.ts`) sets CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy. No Prisma/Node imports on edge.
- `/admin/` and `/settings/` gated by session cookie presence (server-side validation follows).
- Cron endpoints guarded by `CRON_SECRET` bearer token.
- GitHub tokens encrypted at rest (AES-256-GCM via `TOKEN_ENCRYPTION_KEY`).
- API keys hashed, prefixed `ff_live_`.
- Stripe webhook signature verified.
- See `SECURITY.md` for full details.

## Git workflow (pre-prod)

**Always work directly on `main`.** FixFlags is pre-revenue / pre-prod: no customers, no production blast radius that justifies feature branches for routine agent work.

1. `git checkout main && git pull origin main` before starting.
2. Commit and push to `main`. Do not create `agent/*`, `cursor/*`, or worktree branches unless the user explicitly asks.
3. Prefer small, reviewable commits on `main` over long-lived side branches.
4. If a remote branch already exists from earlier work, merge it into `main` promptly rather than continuing on it.

## Parallel-agent rules

1. **Read `.agents/BOARD.md` before any substantial write task.**
2. **Claim tasks** by adding a board entry before starting. One agent owns a write scope at a time. Board `Branch/worktree` should be `main`.
3. **Read-only research** (grep, search, read) may run in parallel without claiming.
4. **Do not use isolated branches or worktrees** for concurrent write-heavy tasks while pre-prod. Coordinate via BOARD.md ownership instead. (Revisit branching only if multiple agents must write the same files simultaneously and board claiming is insufficient.)
5. **Never alter, reset, clean, stash, delete, switch, overwrite, or discard another agent's work on `main`.** Prefer additive commits; do not force-push `main`.
6. **Stop and document** ambiguous ownership or conflicting state.
7. **Create a handoff** (`.agents/handoffs/<task-id>.md`) before leaving meaningful work incomplete.

## Regression-prevention checklist

Before finalizing any change, ask:

- When adding fallback logic: can stale persisted data keep this path active forever?
- When deriving UI state: is this live state, historical state, or inferred state?
- When adding store fields or context values: who reads this, how often does it change, and should it live elsewhere?
- When touching polling or bootstrap: can a lighter payload erase richer existing data?
- When handling optimistic updates: where is rollback, reconciliation, and duplicate prevention?
- When changing shared routes or state contracts: what breaks in the audit pipeline, report UI, and billing?
- When fixing a bug with a heuristic: prefer narrowing the heuristic over widening it.
- When adding a new check module: does it register in `checks/index.ts`, `check-ids.ts`, and the capability report?
- When touching prompts: did you keep system/user split intact for cache efficiency?
- When modifying persist functions: do existing tests still pass, and does the pipeline state machine hold?

## Verification and definition of done

Before claiming completion:
- [ ] **Inspect** the relevant code, UI, docs, git state, and `.agents/BOARD.md`
- [ ] **Understand** the user outcome and product intent, not just the literal ticket
- [ ] **Run** `npm run typecheck` and `npm run lint` — zero errors
- [ ] **Run** `npm run test:unit` — all passing (count measured per run; do not hardcode)
- [ ] **Run** relevant guards (`brand:hex-guard`, `ui:drift-guard`, `seo:guard`)
- [ ] **Verify** behavior by running the actual code path, not just assuming passing tests means correct behavior
- [ ] **Check** edge cases, responsive states, loading/empty/error states
- [ ] **Confirm** no secrets written, no fake data, no hardcoded answers
- [ ] **Report** uncertainty and incomplete verification honestly

## Deeper docs

| File | Contents |
|------|----------|
| `knowledge/vision.md` | **Product vision** (canonical narrative) |
| `knowledge/product-intelligence.md` | Customer Product Intelligence model |
| `knowledge/integrity-engine.md` | Integrity Engine + dimension↔rubric map |
| `knowledge/finish-plan.md` | Finish Plan artifact |
| `knowledge/privacy.md` / `open-source.md` | Privacy + OSS strategy |
| `PRODUCT.md` | Shipped users, workflows, capabilities |
| `SOUL.md` | Identity, personality, voice, product principles |
| `DESIGN.md` | Visual and interaction standards |
| `ARCHITECTURE.md` | System architecture + target layers |
| `DEVELOPMENT.md` | Setup, commands, debugging, deployment |
| `QUALITY.md` | Verification matrix, risks, required checks |
| `SECURITY.md` | Security invariants, trust boundaries |
| `DECISIONS.md` | Durable decisions with rationale |
| `ROADMAP.md` | Now / Next / Later / Not planned |
| `knowledge/` | Company knowledge index (`knowledge/README.md`) |
| `.agents/README.md` | Multi-agent coordination system |
| `.agents/BOARD.md` | Active task board |
| `.agents/learnings/` | Validated project learnings |
| `.agents/evals/` | Evaluation suites |
