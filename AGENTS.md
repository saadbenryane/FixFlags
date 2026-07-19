# FixFlags — Agent Operating System

**Canonical entry point for AI agents.** Read this first. Tool-specific files only redirect here.

## Project

**FixFlags** — The QA layer for AI-built products. Finish what your AI started: paste a URL, get Flags across Message, Experience, and Reach, with fix prompts for your AI editor.

- **Stage:** Pre-revenue / testing. Prioritizing distribution over depth.
- **Domain:** fixflags.com | **Pricing:** Free (3 lifetime), Pro $29/mo (25/mo), Agency $99/mo (100/mo)

### Project facts (canonical — update these in place, do not duplicate elsewhere)

| Fact | Value | Source / regenerate command |
|------|-------|-----------------------------|
| Prisma models | **45** | `prisma/schema.prisma` (`grep -c '^model '`) |
| Check modules (barrel) | **22** (unique) | `lib/audit/checks/index.ts` `checkers[]` |
| Check capabilities | 46 (45 live, 1 partial, 0 planned) | `npm run audit:capabilities` |
| Check IDs | **150** | `lib/audit/check-ids.ts` `ALL_CHECK_IDS` |
| MCP tools | **14** | `lib/mcp/tools.ts` `server.tool()` |
| Pipeline version | **2.4.0** | `lib/audit/pipeline-config.ts` |
| AI models | triage `claude-haiku-4-5` / `gpt-4o-mini`, judge `claude-sonnet-5` / `gpt-4o-mini` | `lib/audit/judge-config.ts` (keep in sync with `MODEL_RATES` in `lib/billing/costs.ts`) |
| Test count | measured per run | `npm run test:unit` (do not hardcode) |

> **Glossary:** A *module* (22) is a `run*Checks()` function in `checks/index.ts`. A *capability* (45) is a named check that may span multiple modules (e.g. a module produces multiple capabilities). A *check ID* (129) is the fine-grained flag identity in `check-ids.ts`. Do not use these numbers interchangeably.

## Key directories and authoritative files

| Path | What |
|------|------|
| `app/` | Next.js App Router (marketing, auth, app, audit, admin routes) |
| `components/` | React components (ui/, audit/, marketing/, layout/, etc.) |
| `lib/` | Core logic (audit engine, queue, billing, graph, prompts, MCP) |
| `lib/marketing/copy.ts` | **Single source of truth** for all marketing copy |
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
| `npm run verify` | All checks: validate + migrate status + drift + typecheck + lint + guards + test + build |
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
- **Homepage section order:** Hero (`LandingHeroSection` + editor logo cloud) → Sample review (`SampleReportSection` → `HeroProductPreview` → `SampleReportExplorer` → `ReportExplorer`) → Three dimensions (`CheckDimensionsSection`) → Fix loop (`HowItWorksLoopSection`) → Product evidence (`ProductEvidenceSection`, not invented testimonials) → Final CTA. Exactly one report explorer. Hero copy changes only when explicitly requested.
- **Social proof:** Use `LANDING_PAGE.productEvidence` (real product output). Do not invent member counts or quote cards; `LANDING_PAGE.testimonials.quotes` stays empty until authentic quotes exist.
- **Browser automation:** Playwright only for audit capture (`lib/audit/browser/page-session.ts`, `lib/audit/screenshot.ts`). Do not reintroduce Puppeteer on the audit path.
- **Visual evidence:** `lib/audit/capture/*` runs after flags in finalize (`tryCaptureVisualEvidenceForAudit`); stores `performanceData.flagVisualEvidence`. Failures must not fail the audit.
- **Changelog** (`CHANGELOG_ENTRIES` in copy.ts) is user-facing only: plain language, outcomes and benefits, never implementation details or internal terminology.
- **Social proof** must match `LANDING_PAGE.testimonials` disclaimer; never invent member counts.

### Architecture
- **Pipeline stages:** QUEUED → CAPTURING → CHECKING → JUDGING → FINALIZING → COMPLETED
- **22 check modules** run via `checks/index.ts` barrel; `slow-replay.ts` imported directly by `deterministic-audit.ts` (side-channel).
- **AI two-phase:** Triage (inline in audit job, 2500 chars pageText, all scans) → Prescription (async `ai-review` job, 5000 chars pageText, gated by `includeAi` + credits). **`includeAi` does not gate triage.**
- **Triage success criterion:** `triageAt` set on COMPLETED audits. Degraded triage (`triageAt` null + `failureCode`) still COMPLETED with deterministic flags.
- **Tech stack** for prescription comes from `auditPage.performanceData.detectedTech`, not `htmlMetadata`.
- **Knowledge graph** (`graph_*` tables) is internal-only. Public pages read through `lib/graph/queries.ts` only.
- **No programmatic page ships below `MIN_SAMPLE_SIZE` (20 distinct sites).**
- **Default deployment:** Single service with inline worker + self-hosted scheduler (no external cron).
- **`/post-login` is the single post-auth landing** for OAuth AND email flows: it claims anonymous audits (`useMe({claim:true})`, sets `includeAi`), then runs checkout/`next` navigation. Never navigate straight to `next` after auth: that skips the claim and leaves reports locked.
- **Report UI — Top Priorities section:** renders between verdict and flags explorer. Uses `rankFlagsByPriority(audit.flags, audit.rubricRows, 3)`. Each card has severity badge, rubric label, problem text, `FixPromptBlock variant="compact"`. The header "Copy fix plan (N)" button uses `buildPlanModePrompt(flags, {url})` — one plan-mode prompt that tells the editor to plan before editing (paste into Cursor/Claude plan mode). `collectAllFixPrompts()` (raw `=== Fix N: Problem ===` dump) and per-rubric prompts remain available in `ExportMenu`.
- **Report UI — sticky toolbar:** `ReportStickyToolbar` section nav (Overview when needed, Journey when multi-page, Flow when flowData exists, Flags, Previews when previewMeta exists, Launch when gates exist, Re-check for owners). Fix prompts live in the explorer and Top Priorities, not a separate nav tab. Below `xl`, actions and tabs stack on separate rows with denser tab height.
- **Re-check:** Manual re-check always enqueues `monitoringMode: 'FULL'` (fresh capture). Finalize diffs child flags vs parent via `diffFlagsAgainstParent`. No SUMMARY_ONLY / copy-parent / skipCapture path in application code (`SUMMARY_ONLY` remains a legacy Prisma enum value only).
- **If increasing AI pageText**, change **both**: `lib/audit/page-text-limits.ts` (storage + prompt limits) and `buildPrescriptionPrompt` in `lib/prompts/system-prompt.ts` (prompt slice).
- **Flag dedup** runs via `suppressOverlappingFlags()` in `lib/audit/checks/index.ts`: hardcoded `if` checks that drop the broader flag when a more specific sibling `checkId` is already present.
- **impactTag** is set on all deterministic checks.
- **Report component architecture:** `components/audit/` owns page-level layout (hero, toolbar, rubrics, actions). `components/report/` owns flag interaction (explorer, detail panel, fix loop, scoring). Shared primitives live in `components/ui/` (FilterPill, ScoreDot, ThumbsFeedback).
- **Shared report utilities:** `lib/audit/share-status.ts` (shareStatusMessage), `lib/audit/duration.ts` (durationFromTimestamps). Use these instead of duplicating the logic.
- **FilterPill icons:** `FilterPill` accepts an optional `icon` prop (LucideIcon). Rubric filters use `rubricIcon()` from `lib/utils.ts` (MessageSquare/Zap/Globe2). Severity filter uses `AlertTriangle`. Page filter uses `Globe`.

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
| `PRODUCT.md` | Users, workflows, capabilities, priorities |
| `SOUL.md` | Identity, personality, voice, product principles |
| `DESIGN.md` | Visual and interaction standards |
| `ARCHITECTURE.md` | System architecture, data flows, modules |
| `DEVELOPMENT.md` | Setup, commands, debugging, deployment |
| `QUALITY.md` | Verification matrix, risks, required checks |
| `SECURITY.md` | Security invariants, trust boundaries |
| `DECISIONS.md` | Durable decisions with rationale |
| `ROADMAP.md` | Now / Next / Later / Not planned |
| `.agents/README.md` | Multi-agent coordination system |
| `.agents/BOARD.md` | Active task board |
| `.agents/learnings/` | Validated project learnings |
| `.agents/evals/` | Evaluation suites |
