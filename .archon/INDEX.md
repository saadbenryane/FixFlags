# FixFlags — Archon Index

**What this project is:** FixFlags is the independent Product Intelligence System for AI-built software. A user submits a URL and receives a ranked Fix list across Message, Experience, and Reach, with fix prompts for their AI editor. The product is a Next.js 15 application with a dedicated Playwright audit worker, Prisma/Postgres, Redis/BullMQ queue, and an MCP server for AI editor integration. The public `fixflags` CLI package is published to npm.

**Public website:** https://fixflags.com
**Local development:** `npm run dev` (starts Next.js web + dedicated audit worker; requires Docker for Postgres/Redis and `.env.local` with `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`)

## Canonical Truth Pointers

| Question | Source |
|----------|--------|
| What ships today? | [PRODUCT.md](../PRODUCT.md) |
| Why and for whom? | [knowledge/vision.md](../knowledge/vision.md), [SOUL.md](../SOUL.md) |
| Where is code? | [CODEMAP.md](../CODEMAP.md) |
| How does the system work? | [ARCHITECTURE.md](../ARCHITECTURE.md), [docs/audit-pipeline.md](../docs/audit-pipeline.md) |
| How should it look and sound? | [DESIGN.md](../DESIGN.md), [docs/voice-and-copy.md](../docs/voice-and-copy.md) |
| How is correctness verified? | [QUALITY.md](../QUALITY.md) |
| What is safe? | [SECURITY.md](../SECURITY.md) |
| What should happen next? | [ROADMAP.md](../ROADMAP.md), [knowledge/execution.md](../knowledge/execution.md) |
| Where does a fact belong? | [CANONICAL-SOURCES.md](../CANONICAL-SOURCES.md) |
| How does knowledge evolve? | [EVOLUTION-RULES.md](../EVOLUTION-RULES.md) |

## Repository Entry Points

| Area | Entry Point |
|------|-------------|
| Next.js bootstrap | `app/layout.tsx` |
| Edge middleware (CSP, HSTS, auth, rate limit) | `middleware.ts` → `proxy.ts` |
| Audit pipeline orchestration | `lib/audit/runner.ts` |
| Task contracts (check-to-plan, re-check-to-diff) | `lib/audit/task-contracts.ts` |
| Queue processor (BullMQ) | `lib/queue/worker.ts` |
| Worker runtime (Playwright, recovery) | `worker/index.ts` |
| Marketing copy (SSoT) | `lib/marketing/copy.ts` |
| Design tokens | `lib/design/tokens.css` |
| AI system prompts | `lib/prompts/system-prompt.ts` |
| Database schema | `prisma/schema.prisma` |
| Validation planner (quick/affected/full) | `scripts/validate.mjs` |

## Directory Map (Pointers)

| Directory | Responsibility | Detailed Map |
|-----------|----------------|--------------|
| `app/` | Next.js App Router routes | [app/codemap.md](../app/codemap.md) |
| `components/` | React components by feature | [components/codemap.md](../components/codemap.md) |
| `lib/` | Core business logic | [lib/codemap.md](../lib/codemap.md) |
| `lib/audit/` | Audit engine (90 files) | [lib/audit/codemap.md](../lib/audit/codemap.md) |
| `lib/queue/` | BullMQ queue | [lib/queue/codemap.md](../lib/queue/codemap.md) |
| `lib/billing/` | Subscription, credits, Stripe | [lib/billing/codemap.md](../lib/billing/codemap.md) |
| `scripts/` | CLI scripts, guards, validation | [scripts/codemap.md](../scripts/codemap.md) |
| `worker/` | Standalone audit worker | — |
| `knowledge/` | Company knowledge base | — |
| `docs/` | Strategy, positioning, voice, growth | — |
| `.agents/` | Multi-agent coordination | — |
| `fixflags-cli/` | Public CLI package | — |
| `ide-integrations/` | Cursor, Claude Code, Kiro | — |

## Cross-System Flows (Pointers)

- **Audit pipeline:** `app/api/checks/route.ts` → BullMQ (`lib/queue/client.ts`) → `worker/index.ts` → stages QUEUED→CAPTURING→CHECKING→JUDGING→FINALIZING→COMPLETED → capture (`lib/audit/browser/page-session.ts`) → 22 checks (`lib/audit/checks/index.ts`) → AI judge (`lib/prompts/system-prompt.ts`) → persist (`lib/audit/persist.ts`) → report UI (`app/report/[id]/page.tsx`)
- **Billing:** Stripe webhook (`app/api/stripe/webhook/route.ts`) → `lib/billing/` → audit creation checks limits (`lib/billing/limits.ts`) → AI prescription gated by credits (`lib/billing/credits.ts`)
- **Anonymous wedge:** Unauthenticated URL submit → one teaser audit (triage only, fix prompts stripped) → second URL requires signup → `/post-login` claims anonymous audit → prescription unlocked

## Live Archon Work

**Board:** `.archon/board.md` (gitignored on this checkout) — use `list_work` / `create_work` / `update_work`

## Native Skills (Live Discovery)

Repo-native skills under `.agents/skills/` — available via `list_skills` / `read_skill` without INDEX bookkeeping:

- fixflags
- fixflags-analytics
- fixflags-audit-pipeline
- fixflags-browser-capture
- fixflags-completeness
- fixflags-design-system
- fixflags-dogfood-accuracy
- fixflags-marketing
- fixflags-npm-operations
- fixflags-product
- fixflags-product-intelligence
- fixflags-runtime-release
- fixflags-scan-accuracy

## Key Commands (Reference)

| Command | Purpose |
|---------|---------|
| `npm run agent` | Compact live repo state + next actions |
| `npm run agent -- context <area>` | Task-specific context |
| `npm run agent -- verify` | Changed-file verification |
| `npm run validate:quick` | Changed-file lint + typecheck |
| `npm run verify` | Full gate (DB, code, test, build, worker) |
| `npm run dev` | Next.js + dedicated worker |
| `npm run accuracy:eval` | Offline scan accuracy gate |
| `npm run accuracy:probe` | Live HTML accuracy adjudication |

## Architecture Invariants (Reference)

- Audit stages: QUEUED → CAPTURING → CHECKING → JUDGING → FINALIZING → COMPLETED
- Deterministic checks register through `lib/audit/checks/index.ts`; IDs in `lib/audit/check-ids.ts`
- Playwright only on audit path (no Puppeteer, no chrome-devtools-mcp)
- Journey/network evidence persists attached to originating source
- Manual re-check = fresh full capture + diff against parent
- Public graph reads via `lib/graph/queries.ts`
- Edge middleware (`proxy.ts`) — no Prisma/Node-only imports
- Shared report behavior in audit/report utilities, not duplicated
- Check-to-plan and re-check-to-diff in `lib/audit/task-contracts.ts`
- Public Review HTTP: `/api/checks` and `/api/reports/[id]/*`; Product Signals: `/api/products/[id]/signals`
- No off-by-default feature flags for unproven code — remove entirely