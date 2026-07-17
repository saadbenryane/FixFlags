# Architecture

*Current system, documented as implemented. Not aspirational.*

## System overview

Next.js 15 application (App Router) with:
- PostgreSQL 16 database (Prisma 6 ORM; model count in AGENTS.md Project facts)
- Redis 7 queue (BullMQ 5) for async audit processing
- Inline worker mode (default) or separate worker process
- Self-hosted scheduler for recovery + nurture (no external cron)
- Edge middleware for security headers + auth gating
- Docker-based local development

## Directory structure

```
app/                     # Next.js App Router
  (marketing)/           # Public: homepage, pricing, FAQ, tools, docs, changelog
  (auth)/                # Auth pages: sign-in, sign-up, forgot/reset password
  (app)/                 # Authenticated: dashboard, billing, settings
  audit/[id]/            # Live audit report (polling, progressive)
  report/[id]/           # Completed report
  demo/                  # Demo fixtures
  compare/               # Before/after comparison
  share/                 # Shared reports
  admin/                 # Admin dashboard
  api/                   # API routes (audits, auth, mcp, stripe, cron, etc.)

components/              # React components
  ui/                    # shadcn primitives (33 components)
  audit/                 # Report UI (48 components)
  marketing/             # Landing page sections
  layout/                # Layout shells (marketing, site, audit)
  billing/               # Subscription/billing UI
  settings/              # Settings panels
  admin/                 # Admin dashboard components
  dashboard/             # Dashboard components
  pricing/               # Pricing components
  repo-scan/             # Codebase scanning UI
  demo/                  # Demo components
  compare/               # Comparison UI
  auth/                  # Auth forms
  live-support/          # Chat widget
  brand/                 # Brand assets
  analytics/             # Conversion pixels
  system/                # System-level (providers, toasts)

lib/                     # Core logic
  audit/                 # Audit engine
  queue/                 # BullMQ queue
  graph/                 # Knowledge graph (internal)
  billing/               # Subscription limits, Stripe
  marketing/             # Copy, metadata, SEO, structured data
  prompts/               # AI system prompts
  design/                # Design tokens, brand spec
  mcp/                   # Model Context Protocol
  repo-scan/             # Codebase scanning
  storage/               # Screenshots (local/R2)
  auth/                  # Auth helpers (edge-safe)
  report/                # Report explorer model
  demo/                  # Demo fixtures
  email/                 # Email templates (Resend)
  support/               # Live support

worker/                  # Standalone worker entry point
prisma/                  # Schema + migrations + seed
scripts/                 # CLI scripts (20)
hooks/                   # React hooks (9)
public/                  # Static assets
docs/                    # Documentation
```

## Audit pipeline

### Pipeline stages

```
QUEUED → CAPTURING → CHECKING → JUDGING → FINALIZING → COMPLETED
```

Each page in an audit progresses through these stages independently.

### Key files

| File | Role |
|------|------|
| `lib/audit/runner.ts` | Top-level `runAudit()` orchestrator |
| `lib/audit/pipeline/run-page.ts` | Per-page processing |
| `lib/audit/pipeline/combine-pages.ts` | Multi-page result merging |
| `lib/audit/pipeline-config.ts` | Version (v2.3.0), deadlines (180s) |
| `lib/audit/deterministic-audit.ts` | 22 check modules via barrel |
| `lib/audit/checks/index.ts` | Check runner (22 modules, `suppressOverlappingFlags()`) |
| `lib/audit/checks/registry.ts` | Check descriptor registry |
| `lib/audit/judge-triage.ts` | Phase 1: AI triage |
| `lib/audit/judge-prescription.ts` | Phase 2: AI prescription |
| `lib/audit/screenshot.ts` | Puppeteer screenshot capture |
| `lib/audit/flow/` | CTA flow testing |
| `lib/audit/persist.ts` | Results persistence |
| `lib/audit/scoring.ts` | Rubric scoring |
| `lib/audit/tech-detect.ts` | Technology detection engine |
| `lib/prompts/system-prompt.ts` | AI prompts (triage + prescription) |

### Check modules (22)

Metadata, og-image, performance, accessibility, seo, trust, mobile, content, slop, layout, interaction, cta-focus, measurement, auth-checkout, security, visual-polish, security-headers, messaging-clarity, conversion-friction, trust-psychology, visual-hierarchy, mobile-ux-quality

### AI two-phase design

| Phase | pageText source | Max chars | When run |
|-------|----------------|-----------|----------|
| Triage | Freshly parsed HTML (in-memory) | 2500 | Always (deterministic + AI) |
| Prescription | Stored `audit.htmlMetadata` | 5000 | Post-signup only |

Tech stack for prescription: `auditPage.performanceData.detectedTech`, not `htmlMetadata`.

## Queue system

| File | Role |
|------|------|
| `lib/queue/client.ts` | BullMQ queue producer |
| `lib/queue/worker.ts` | BullMQ worker (audit, ai-review, repo-scan, repo-fix-pr jobs) |
| `lib/queue/inline-worker.ts` | In-process worker (default; single-service deployment) |
| `lib/queue/recovery-scheduler.ts` | Self-hosted scheduler |
| `lib/queue/worker-heartbeat.ts` | Redis heartbeat every 20s, 45s TTL |
| `lib/queue/redis.ts` | Redis connection |
| `lib/queue/lock.ts` | Redis distributed lock |
| `lib/queue/estimate.ts` | Queue wait time estimation |

### Job types
- `audit` — full audit execution
- `ai-review` — phase-2 prescription only (triage runs in `audit` job)
- `repo-scan` — codebase scan (Agency plan)
- `repo-fix-pr` — automated fix PR (Agency plan)

## Knowledge graph

Internal-only system for organic growth. Never queried directly by public pages.

| File | Role |
|------|------|
| `lib/graph/persist.ts` | Write audit data to graph tables |
| `lib/graph/queries.ts` | Public read models (enforces MIN_SAMPLE_SIZE=20) |
| `lib/graph/snapshot.ts` | Benchmark snapshots |
| `lib/graph/types.ts` | Graph entity types |

### Graph tables (in Prisma)
- Site, Page, Technology, SiteTechnology, Industry
- Issue, IssueOccurrence, FixPrompt
- BenchmarkSnapshot, Experiment, ToolUsage, GrowthArtifact

## Auth and authorization

- **Library:** better-auth 1.6 with Prisma adapter
- **Providers:** Email/password + Google OAuth + GitHub OAuth (runtime-resolved)
- **Session:** Cookie-based, edge-safe presence check in `proxy.ts`
- **Middleare:** (`proxy.ts`) sets CSP, HSTS, X-Frame-Options, CORS. Gates `/admin/` and `/settings/`.
- **Roles:** `user` (default), `admin` (via `ADMIN_USER_IDS`)
- **Plans:** FREE, BUILDER (Pro), TEAM (Agency)
- **API keys:** Hashed, prefixed `ff_live_`, for MCP access

## Billing

| Plan | Stripe product | Price | Audits/mo |
|------|---------------|-------|-----------|
| Free | — | $0 | 3 lifetime |
| Pro | `price_pro_monthly` | $29 | 25 |
| Agency | `price_agency_monthly` | $99 | 100 |
| Credits | `price_credits_*` | $10-50 | 10-50 one-time |

- Stripe integration: subscriptions + credit packs
- Cost tracking: `AuditRunCost` per audit phase (LLM tokens + estimated USD)
- Billing enforcement: `lib/billing/limits.ts`, `lib/billing/credits.ts`

## Deployment

- **Single service (default):** Next.js + inline worker + self-hosted scheduler
- **Dedicated worker:** `INLINE_WORKER=false`, deploy separate worker service
- **Container:** Docker (Debian bookworm-slim), multi-stage build
- **Platform:** Railway (fly.io-compatible)
- **Health:** `/api/health` (DB+Redis), `/api/health/worker` (heartbeat), `/api/health/browser` (Puppeteer+R2)

## Key Data Flows

### Audit flow
1. User submits URL → API route creates Audit record (QUEUED)
2. Queue picks up job → runs capture (Puppeteer screenshot + HTML)
3. Runs deterministic checks (22 modules)
4. Runs AI triage (cheap model, 2500 chars page text)
5. Persists flags + scores + screenshots
6. If user is signed up and `includeAi` → enqueues `ai-review` job for prescription (5000 chars page text)
7. Audit marked COMPLETED → user sees report (fix prompts when `aiReviewAt` set)
8. Re-check: same URL → new capture → diff against previous flags

### SaaS flow
1. Anonymous user: triage + deterministic flags → upsell at sign up for fix prompts
2. Authenticated user with credits: triage → prescription job → full report with fix prompts
3. Triage degraded: COMPLETED with flags/screenshots and honest partial-AI message (see `docs/audit-pipeline.md`)
4. Re-checks: unlimited, free, gated only by URL ownership

## Technical invariants

- No Prisma/Node imports on edge runtime (proxy.ts)
- `serverExternalPackages`: puppeteer, @prisma/client, prisma, better-auth, bullmq, ioredis, @anthropic-ai/sdk, etc.
- R2 is required for production screenshots. Missing R2 → service boots, scans fail with clear message.
- Missing AI keys → triage/prescription disabled; scans complete with deterministic checks (`/api/health` reports `aiConfigured: false`)
- No `next build`-time OAuth gating (resolved at runtime via `/api/auth/providers`)
- OAuth callback URL: `https://fixflags.com/api/auth/callback/google`

## Database snapshot

Model count: regenerate with `grep -c '^model ' prisma/schema.prisma` (canonical value in AGENTS.md Project facts).

Models span:
- **Auth:** User, Session, Account, Verification
- **Audit:** Audit, AuditPage, Screenshot, Flag, FlagFeedback, ReportRubric, AuditRunCost
- **Billing:** CreditPurchase, ProcessedStripeEvent
- **Communications:** EmailLog, NewsletterSubscriber, Lead
- **Support:** SupportTenant, SupportSession, SupportMessage
- **Codebase:** GithubConnection, RepoScan, RepoScanFinding, RepoFixPr
- **Graph:** Site, Page, Technology, SiteTechnology, Industry, Issue, IssueOccurrence, FixPrompt, BenchmarkSnapshot, Experiment, ToolUsage, GrowthArtifact
- **MCP:** McpInteraction
- **General:** ApiKey, Project, ShareLink
