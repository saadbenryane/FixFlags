---
name: fixflags-completeness
description: Repeatable completeness, consistency, and docs-accuracy pass for FixFlags. Use when auditing whether work is truly done, eliminating doc drift, fixing silent UX failures, or closing verification gaps. Triggers on completeness pass, docs accuracy, verify green, drift audit, ship readiness.
---

# FixFlags Completeness Pass

**Read [`AGENTS.md`](../../AGENTS.md) first.** This skill encodes a repeatable workflow; canonical facts live in AGENTS.md only.

## When to run

- After a large refactor or pre-ship audit
- When docs and code may have drifted
- Before claiming `npm run verify` green or "work complete"

## Phase 1 — Automated gates

```bash
npm run typecheck
npm run lint
npm run brand:hex-guard
npm run ui:drift-guard
npm run seo:guard
npm run test:unit   # record count; never hardcode in docs
npm run build
npm run worker:build
```

**Deploy packaging gate** (when `Dockerfile`, `package.json`, `package-lock.json`, or `.npmrc` change):

```bash
rm -rf node_modules && npm ci --include=dev
docker build -t fixflags:local .
```

Railway uses `railway.toml` `builder = "DOCKERFILE"` (not Nixpacks). If `.npmrc` exists, Dockerfile must `COPY` it before `npm ci`. Production Chromium: apt package + `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

Local full gate (requires Docker Compose + `.env.local`):

```bash
docker compose up -d && npm run setup && npm run verify
```

CI runs a **subset** of verify (no `db:validate`/`db:check`/`db:drift`, no `docker build`). Document this split; do not claim CI runs full verify.

## Phase 2 — Stale term grep

Search canonical docs and skills for:

| Term | Why stale |
|------|-----------|
| `888`, `1,629`, `1629` | Hardcoded test counts |
| `DEDUP_RULES` | Real dedup is `suppressOverlappingFlags()` |
| `STUDIO` plan | Schema is FREE/BUILDER/TEAM only |
| `/Users/saadbenryane/Code/qewos` | Use repo-relative paths |
| `CI is not on GitHub` | CI exists; claim must match `ci.yml` |
| `second pass` | Banned marketing phrase |
| `34 models`, `39 models`, `6 MCP tools`, `500 chars` prescription | See AGENTS.md Project facts |
| `133`, `133 check`, `133/129 check`, `129 check` | Hardcoded check ID counts — use `ALL_CHECK_IDS.length` / AGENTS.md |
| `13 tools`, `v2.3.0`, `multi-stage build` | Stale counts/deploy claims — AGENTS.md + Dockerfile truth |
| `Example feedback` (homepage) | Use `ReportExamplesSection` / sample explorer Flag output; no invented testimonials |
| `Analytics (NOT IMPLEMENTED` | Client funnel events are shipped in `lib/analytics/events.ts` |
| `puppeteer` on audit path | Playwright only (`page-session`, `screenshot`) |
| `Chromium/Puppeteer` in `nixpacks.toml` as deploy path | Unused; Railway uses Dockerfile |
| `RubricsPanel` as live surface | Dead; use `RubricBar` + `ReportExplorer` |
| `ReportMiniNav`, `CompletenessHeader` | Removed; use `ReportStickyToolbar`, inline report sections |
| `showOverview` / Overview sticky tab | Removed; status callouts sit under toolbar, not a nav destination |
| `hasFixPrompts` on `ReportExplorer` / `LiveReportExplorer` | Dead prop — per-flag `hasFixPrompt` drives Sparkles |
| `REPORT_COPY.explorer.scanned` / `scanning` / `stillScanning` | Removed with FixLoop status chrome |
| Explorer score `md` or `lg` | Live explorer uses `sm` only |
| `Run audit` | Stale CTA — canonical is **Review my site** (`HERO.primaryCta` in `copy.ts`) |
| `How to Start`, `How to start toggle` | Removed homepage pattern — nav is How it works / Sample / Pricing |
| `six rubrics`, `Six rubrics` | Three rubrics only: Message, Experience, Reach |
| `ai-review.*triage` in docs | ai-review is prescription only |
| `includeAi` skips triage | includeAi gates prescription only |
| `unlimited deterministic` (at Free limit) | Free = 3 new URL checks; re-checks free; new checks blocked at limit |
| `upgrade for unlimited` | Pro is 25/mo, not unlimited |
| `subscription-only` ignoring packs | Credit packs are paid overflow (`lib/billing/credits.ts`) |

## Phase 2.4 — Payments readiness

Before claiming revenue-ready:

- [ ] `docs/stripe-setup.md` price IDs match Railway `STRIPE_*_PRICE_ID`
- [ ] `/api/health` → `billingConfigured: true`
- [ ] Webhook tests pass: `app/api/webhooks/stripe/__tests__/route.test.ts`
- [ ] Terms include cancel/refund/credit-pack language
- [ ] Grep clean: `unlimited deterministic`, `upgrade for unlimited`
- [ ] `BILLING_REQUIRED=true` on Railway; secrets only in `.env.local` / Railway

## Phase 2.5 — Audit pipeline grep

- `grep -r "500 char" docs/` — prescription is 5000 chars
- `grep -r "34 model" docs/` — use `grep -c '^model ' prisma/schema.prisma`
- Confirm `docs/audit-pipeline.md` matches `lib/audit/runner.ts` flow
- Post-deploy: `npm run smoke:triage:prod` when changing triage/finalize

## Phase 3 — Cross-check facts against code

| Fact | Source of truth |
|------|-----------------|
| Prisma models | `grep -c '^model ' prisma/schema.prisma` |
| Check modules | `lib/audit/checks/index.ts` `checkers[]` |
| Check IDs | `lib/audit/check-ids.ts` `ALL_CHECK_IDS` |
| MCP tools | `lib/mcp/tools.ts` `server.tool()` |
| Page text limits | `lib/audit/page-text-limits.ts` |
| Pipeline version | `lib/audit/pipeline-config.ts` |

## Phase 4 — UX silent failure audit

In product UI (not pipeline parse fallbacks), grep for:

- Empty `catch {}` without user feedback
- `fetch` without `res.ok` + `parseApiErrorResponse`
- Pagination `hasMore` hardcoded `true`
- Hand-rolled `rounded-lg border` panels (use `Card`/`Surface`/`Callout`)

## Phase 5 — Doc alignment

- `test-strategy.md` ↔ `QUALITY.md` blocker ratings must agree
- `ROADMAP.md` Now section reflects QUALITY evidence
- Skills cross-link AGENTS.md; no duplicated volatile counts
- `lib/audit/page-text-limits.ts` is canonical for 2500/5000 limits

## Phase 6 — Billing test coverage

Core scan endpoint must have route tests:

- `app/api/checks/__tests__/route.test.ts` — 402 paths + 201 success
- Mirror pattern from `app/api/api-keys/__tests__/route.test.ts`

Re-checks are never gated (separate route; document in test comments).

## Phase 7 — Conversion & report completeness

Marketing and report surfaces must match product contracts:

- **Primary CTA:** `HERO.primaryCta` is **Review my site** (not "Run audit" or "Get started").
- **Homepage nav:** How it works / Sample / Pricing (`lib/site/nav.ts` `MARKETING_LINKS`).
- **One explorer:** exactly one report explorer on homepage (`SampleReportSection` → `HeroProductPreview` → `SampleReportExplorer`); no second in hero.
- **Report ownership:** `ReportExplorer` owns flag browsing; `RubricBar` is compact rubric jump links; do not resurrect `RubricsPanel`. Sticky tabs must match DOM (Contract / Priorities / Journey / Flow / Timeline / Flags / …). No Overview tab.
- **Report density:** explorer `ScoreRingGauge` is `sm`; no duplicate share status in hero; anon CTAs = value strip + `SampleFixCard` only.
- **Progressive:** status poll passes `productContract` + partial flag `checkId`/`source`; hide empty Action Timeline.
- **Share status:** `ShareStatusBanner` mounted on live reports (not hero-text-only).
- **Visual evidence:** either wired via `tryCaptureVisualEvidenceForAudit` or absent from the tree — no orphan `lib/audit/capture` modules.
- **Browser stack:** single vendor (Playwright). Grep for `from 'puppeteer'` under `lib/audit` must be empty.
- **Re-checks:** free and unlimited on owned reports; never gate behind quota.
- **Billing gate:** new URL checks enforce Free lifetime / paid monthly limits via `wouldBlockNewCheckWithCredits` in `create-audit.ts`.
- **Limit CTA match:** `AuditLimitGate` must honor `action` (`signup` | `upgrade` | `buy_credits`). Paid overflow links to `/billing#credit-packs`, not a fake upgrade.
- **Copy vs plans:** Free features in `copy.ts` / FAQ / email match `PLAN_DEFINITIONS.FREE` (3 new URL checks; never "unlimited deterministic").
- **No orphan marketing chrome:** no unused trust-badge components; no `trySampleHint` under the sample CTA.
- **parentId:** re-check/monitoring must validate parent ownership via `assertParentAuditAllowed`.
- **Help / support:** every new error, limit, or billing stuck surface links a help article (`lib/help/contextual.ts`) and can open chat. SLA strings single-sourced (`SUPPORT_CHAT` === `SUPPORT_WELCOME_MESSAGE`). `/faq` and `/docs/mcp` stay in sync with Help (canonical MCP = `/help/mcp`). Never market priority support.

## Phase 7.5 — Funnel / analytics

See [`.cursor/skills/fixflags-analytics/SKILL.md`](../fixflags-analytics/SKILL.md).

```bash
rg "trackEvent\('" --glob '*.{ts,tsx}' -g '!node_modules'
# Every FunnelEvent union member must have a call site (or be removed).
```

Grep skills/docs for stale conversion terms:

```bash
rg -i 'ReportMiniNav|CompletenessHeader|six rubrics|"Run audit"|How to Start|39 models|133 check|\\b133/133\\b|showOverview|explorer\\.scanned|hasFixPrompts=\{' .cursor/skills docs AGENTS.md ARCHITECTURE.md QUALITY.md test-strategy.md DESIGN.md
```

## Phase 8 — Sample provenance

Marketing sample audits use provenance `live | curated | fixture` (`SampleSource` in `lib/marketing/live-sample.ts`). Eligibility is completeness + flags + rubrics + desktop screenshot — **not** score floors.

Checks:

- `lib/marketing/__tests__/sample-provenance.test.ts` passes
- `isEligibleMarketingSample()` rejects near-empty audits regardless of score
- Homepage/sample pages label provenance honestly (live preferred; fixture offline/demo only)
- Display scores derive from production helpers (`resolveDisplayScores`, `calculateOverallScore`)

## Definition of done

- [ ] All Phase 1 commands pass (verify green locally if DB available)
- [ ] Phase 2 grep clean in canonical docs/skills
- [ ] Phase 3 facts match code
- [ ] Phase 7 conversion/report contracts verified (CTA, nav, one explorer, billing gates)
- [ ] Phase 8 sample provenance tests pass; no score-floor eligibility
- [ ] No silent UX failures in touched surfaces
- [ ] `test-strategy.md` aligned with `QUALITY.md`
- [ ] Skills updated; `lean-visual.md` exists for UI passes

## Companion skills

- `fixflags-product` — entitlements, billing, pipeline behavior
- `fixflags-design-system` + `fixflags-marketing/lean-visual.md` — token compliance
- `fixflags-ui-upgrade` — orchestrator for visual polish
