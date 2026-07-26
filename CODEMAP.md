# Repository Atlas: FixFlags

## Project Responsibility

FixFlags is the independent Product Intelligence System for AI-built software. Paste a URL, get every unresolved Flag ranked across Message, Experience, and Reach, apply the fixes in your AI editor, then re-check the result.

## System Entry Points

| Entry Point | File | Purpose |
|-------------|------|---------|
| Next.js bootstrap | `app/layout.tsx` | Root layout, providers, global styles |
| Edge middleware | `middleware.ts` → `proxy.ts` | CSP, HSTS, auth gating, rate limiting |
| Audit pipeline | `lib/audit/runner.ts` | Pipeline orchestration and completion behavior |
| Task contracts | `lib/audit/task-contracts.ts` | Check-to-plan and re-check-to-diff application outcomes |
| Queue processor | `lib/queue/worker.ts` | BullMQ audit job processor |
| Worker runtime | `worker/index.ts` | Required dedicated Playwright and recovery process |
| Marketing copy | `lib/marketing/copy.ts` | Single source of truth for all marketing text |
| Design tokens | `lib/design/tokens.css` | Canonical design tokens (colors, shadows, radii) |
| AI prompts | `lib/prompts/system-prompt.ts` | Triage + prescription prompt builders |
| DB schema | `prisma/schema.prisma` | Prisma schema and migrations |
| Validation planner | `scripts/validate.mjs` | Changed-file-aware validation (quick/affected/full) |

## Repository Directory Map

| Directory | Responsibility | Detailed Map |
|-----------|----------------|--------------|
| `app/` | Next.js App Router routes (marketing, auth, dashboard, audit, admin, API) | [app/codemap.md](app/codemap.md) |
| `app/(marketing)/` | Public pages: homepage, pricing, FAQ, help, tools, docs, changelog, roast | — |
| `app/(auth)/` | Sign-in, sign-up, forgot/reset password | — |
| `app/(app)/` | Authenticated dashboard, billing, settings | — |
| `app/report/[id]/` | Canonical complete report and ranked Fix list; `details/` redirects here | `knowledge/report-contract.md` |
| `app/share/[token]/` | Scoped canonical share rendering; shared details links redirect after access checks | `lib/security/share-grant.ts` |
| `app/admin/` | Admin dashboard | — |
| `app/api/` | All API routes (audits, auth, MCP, Stripe, cron, health) | — |
| `components/` | React components organized by feature area | [components/codemap.md](components/codemap.md) |
| `components/ui/` | 33+ shadcn/ui primitives (shared) | — |
| `components/audit/` | Report page layout (hero, toolbar, rubrics, actions) | — |
| `components/report/` | Flag interaction (explorer, detail panel, fix loop, scoring) | — |
| `lib/` | Core business logic | [lib/codemap.md](lib/codemap.md) |
| `lib/audit/` | Audit engine (90 files: runner, checks, scoring, flow, judge, persist, capture) | [lib/audit/codemap.md](lib/audit/codemap.md) |
| `lib/audit/checks/` | 22 check modules (metadata, performance, accessibility, SEO, trust, etc.) | — |
| `lib/queue/` | BullMQ queue (client, worker, heartbeat, recovery) | [lib/queue/codemap.md](lib/queue/codemap.md) |
| `lib/billing/` | Subscription limits, credits, Stripe integration | [lib/billing/codemap.md](lib/billing/codemap.md) |
| `lib/graph/` | Knowledge graph (persist, queries, snapshot) — internal only | — |
| `lib/prompts/` | AI system prompts (triage + prescription) | — |
| `lib/marketing/` | Copy SSoT, metadata, SEO, structured data | — |
| `lib/help/` | Help Center catalog, search, contextual hrefs, SLA | — |
| `lib/mcp/` | Model Context Protocol server (16 tools) | — |
| `lib/design/` | Design tokens, brand spec | — |
| `prisma/` | Database schema, migrations, seed | — |
| `scripts/` | CLI scripts (demo audits, backfills, guards, validation) | [scripts/codemap.md](scripts/codemap.md) |
| `worker/` | Standalone audit worker (production) | — |
| `knowledge/` | Company knowledge base (foundations, market, product, strategy, execution) | — |
| `docs/` | Strategy, positioning, voice, growth docs | — |
| `docs/growth/` | Organic growth workspace (architecture, roadmap, experiments) | — |
| `.agents/` | Multi-agent coordination (board, learnings, evals, handoffs) | — |
| `fixflags-cli/` | Standalone CLI package | — |
| `ide-integrations/` | Cursor, Claude Code, Kiro integrations | — |

## Where To Change Things

- **Audit pipeline (checks, scoring, flow, judge, persist)** → `lib/audit/` (read `lib/audit/codemap.md` first)
- **New check module** → add to `lib/audit/checks/`, register in `checks/index.ts` barrel, add check IDs to `check-ids.ts`, update capability report
- **Queue/worker behavior** → `lib/queue/` (read `lib/queue/codemap.md`)
- **Billing/subscription logic** → `lib/billing/` (read `lib/billing/codemap.md`)
- **Marketing copy** → `lib/marketing/copy.ts` ONLY (never hardcode in components)
- **Design tokens** → `lib/design/tokens.css` (semantic tokens, never raw hex)
- **Canonical report UI** → `components/audit/AuditReport.tsx`, `components/report/ReportExplorer.tsx`, `lib/report/explorer-model.ts`
- **Detailed report UI** → `components/audit/AuditReport.tsx`, `components/report/ReportExplorer.tsx`
- **Flag interaction UI** → `components/report/` (explorer, detail panel, fix loop)
- **Shared UI primitives** → `components/ui/` (shadcn-based)
- **API routes** → `app/api/` (audits, auth, MCP, Stripe, cron, health)
- **Marketing pages** → `app/(marketing)/` (homepage, pricing, FAQ, etc.)
- **Auth pages** → `app/(auth)/` (sign-in, sign-up, password reset)
- **Dashboard pages** → `app/(app)/` (authenticated user area)
- **Edge middleware** → `proxy.ts` (CSP, HSTS, auth gating; no Prisma/Node imports)
- **AI prompts** → `lib/prompts/system-prompt.ts` (keep system/user split for cache)
- **Validation scripts** → `scripts/` (read `scripts/codemap.md`)
- **Guard scripts** → `scripts/brand-hex-guard.mjs`, `scripts/ui-drift-guard.mjs`, `scripts/seo-guard.mjs`

## Cross-System Flows

### Audit Pipeline Flow
1. User submits URL → `app/api/checks/route.ts` calls the shared check-to-plan task contract
2. Audit enqueued to BullMQ → `lib/queue/client.ts`
3. Dedicated worker picks up job → `worker/index.ts` → `lib/queue/worker.ts`
4. Pipeline stages: QUEUED → CAPTURING → CHECKING → JUDGING → FINALIZING → COMPLETED
5. Capture: Playwright loads page, collects HTML/screenshots/console errors → `lib/audit/browser/page-session.ts`
6. Check: 22 modules run via `lib/audit/checks/index.ts` barrel
7. Judge: AI triage (inline) + prescription (async, post-signup) → `lib/prompts/system-prompt.ts`
8. Persist: flags, scores, metadata saved to DB → `lib/audit/persist.ts`
9. Report UI reads from DB → `app/report/[id]/page.tsx` → `components/audit/` + `components/report/`

### Billing Flow
1. User subscribes → Stripe Checkout → webhook → `app/api/stripe/webhook/route.ts`
2. Subscription state persisted → `lib/billing/`
3. Audit creation checks limits → `lib/billing/limits.ts`
4. AI prescription gated by `includeAi` + credits → `lib/billing/credits.ts`

### Anonymous Wedge Flow
1. Unauthenticated user submits URL → `createAndEnqueueAudit` checks `checkAnonymousAuditAllowed`
2. One teaser audit allowed (triage only, fix prompts stripped)
3. Second URL → signup required
4. Auth → `/post-login` claims anonymous audit → prescription unlocked

## Integration Notes

- **Edge middleware** (`proxy.ts`) must stay Prisma-free (edge runtime limitation)
- **Knowledge graph** (`graph_*` tables) is internal-only; public pages read through `lib/graph/queries.ts`
- **Marketing copy** is centralized in `lib/marketing/copy.ts`; components import from there
- **Design tokens** use semantic names (`bg-card`, `text-brand`); raw hex only in `tokens.css` and `brand-spec.ts`
- **AI prompts** split system (stable, cacheable) from user (per-request) for prompt caching
- **Report UI** has strict section order documented in `knowledge/report-contract.md`: identity/readiness/re-check → complete Fix list → Product Contract → Journey → Flow → Action Timeline → previews/launch/watch/share.
