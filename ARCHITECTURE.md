# Architecture

*Current system, documented as implemented. Target Product Intelligence layers are marked **Target** and must not be confused with shipped code.*

**Vision / layers:** [knowledge/vision.md](./knowledge/vision.md). **Integrity Engine:** [knowledge/integrity-engine.md](./knowledge/integrity-engine.md).

## Target system layers (not fully shipped)

| Layer | Intent | Today |
|-------|--------|-------|
| **Local runtime** | Repo inspect, portable PI, CLI, hooks, local verify | Thin `fixflags-cli` (remote MCP client); IDE skill docs |
| **Product Intelligence Protocol** | Vendor-neutral read/contribute for humans/agents | MCP tools (`lib/mcp/`); not yet a neutral published protocol |
| **FixFlags Intelligence Network** | Cloud compounding intelligence, dashboards, team | Main Next.js app + audit worker + growth graph |

Customer **Product Intelligence** (Project-scoped) is separate from the growth `graph_*` knowledge graph. See [knowledge/product-intelligence.md](./knowledge/product-intelligence.md).

## System overview

Next.js 15 application (App Router) with:
- PostgreSQL 16 database with Prisma 6 ORM
- Redis 7 queue (BullMQ 5) for async audit processing
- Required dedicated worker process for audits, Chromium, recovery, and scheduled work
- Redis worker heartbeats for browser readiness and active-context diagnostics
- Edge middleware for security headers + auth gating
- Docker-based local development

## Directory structure

```
app/                     # Next.js App Router
  (marketing)/           # Public: homepage, pricing, FAQ, Help Center, tools, docs, changelog
  (auth)/                # Auth pages: sign-in, sign-up, forgot/reset password
  (app)/                 # Authenticated: dashboard, billing, settings
  audit/[id]/            # Live audit report (polling, progressive)
  report/[id]/           # Completed report
  demo/                  # Demo fixtures
  compare/               # Before/after comparison
  share/                 # Shared reports
  admin/                 # Admin dashboard
  api/                   # Public checks/reports plus auth, MCP, Stripe, and health routes

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
  live-support/          # First-party chat widget + polling
  help/                  # Help Center UI (search, categories, articles, MCP guide)
  brand/                 # Brand assets
  analytics/             # Conversion pixels
  system/                # System-level (providers, toasts)

lib/                     # Core logic
  audit/                 # Audit engine
  queue/                 # BullMQ queue
  graph/                 # Knowledge graph (internal)
  billing/               # Subscription limits, Stripe
  marketing/             # Copy, metadata, SEO, structured data
  help/                  # Help Center catalog, search, contextual hrefs, SLA
  prompts/               # AI system prompts
  design/                # Design tokens, brand spec
  mcp/                   # Model Context Protocol
  live-support/          # Chat sessions, messages, visitor tokens
  repo-scan/             # Codebase scanning
  storage/               # Screenshots (local/R2)
  auth/                  # Auth helpers (edge-safe)
  report/                # Report explorer model
  demo/                  # Demo fixtures
  email/                 # Email templates (Resend)

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
| `lib/audit/pipeline-config.ts` | Version (v2.4.0), deadlines (180s) |
| `lib/audit/deterministic-audit.ts` | 22 check modules via barrel |
| `lib/audit/checks/index.ts` | Check runner (22 modules, `suppressOverlappingFlags()`) |
| `lib/audit/checks/registry.ts` | Check descriptor registry |
| `lib/audit/judge-triage.ts` | Phase 1: AI triage |
| `lib/audit/judge-prescription.ts` | Phase 2: AI prescription |
| `lib/audit/screenshot.ts` | Playwright screenshot capture |
| `lib/audit/flow/` | CTA flow testing |
| `lib/audit/persist.ts` | Results persistence |
| `lib/audit/scoring.ts` | Rubric scoring |
| `lib/audit/tech-detect.ts` | Technology detection engine |
| `lib/prompts/system-prompt.ts` | AI prompts (triage + prescription) |

### Check modules

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
| `worker/index.ts` | Dedicated worker runtime and browser lifecycle owner |
| `lib/queue/recovery-scheduler.ts` | Self-hosted scheduler |
| `lib/queue/worker-heartbeat.ts` | Redis heartbeat every 20s, 45s TTL |
| `lib/queue/redis.ts` | Redis connection |
| `lib/queue/lock.ts` | Redis distributed lock |
| `lib/queue/estimate.ts` | Queue wait time estimation |

### Job types
- `audit` — full audit execution
- `ai-review` — phase-2 prescription only (triage runs in `audit` job)
- `repo-scan` — codebase scan (Studio plan)
- `repo-fix-pr` — automated fix PR (Studio plan)

## Knowledge graph

Internal-only system for organic growth. Never queried directly by public pages.

| File | Role |
|------|------|
| `lib/graph/persist.ts` | Write audit data to graph tables |
| `lib/graph/queries.ts` | Public read models (enforces MIN_SAMPLE_SIZE=3, temporary; target remains higher when data volume grows) |
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
- **Plans:** FREE, BUILDER (Pro), TEAM (Studio)
- **API keys:** Hashed, prefixed `ff_live_`, for MCP access

## Billing

Target marketing prices (Stripe price IDs may lag until a revenue ops change):

| Plan | Env price ID | Marketing price | Product reviews/mo |
|------|--------------|-----------------|-------------------|
| Free | — | $0 | 3 |
| Pro (`BUILDER`) | `STRIPE_BUILDER_PRICE_ID` | $29/mo | 30 product reviews |
| Studio (`TEAM`) | `STRIPE_TEAM_PRICE_ID` | $79/mo | 90 product reviews |

Customer copy: **product review** and **update review** (same credit pool). Every plan exposes the same web capabilities and differs only by monthly Product Review usage. Deep Review is reserved for future repository-connected analysis. Internal: `/re-check` route, `recheck_*` analytics, and legacy deep-review persistence fields.

- Stripe: hosted Checkout + Customer Portal + webhooks (`docs/stripe-setup.md`)
- Cost tracking: `AuditRunCost` per audit phase (LLM tokens + estimated USD)
- Billing enforcement: `lib/billing/limits.ts`, `lib/billing/credits.ts`, `lib/billing/config.ts`
- Liveness: `/api/health` remains a low-cost diagnostic snapshot; launch readiness is `/api/health/ready`.

## Deployment

- **Web service:** `FIXFLAGS_PROCESS_ROLE=web`; enqueues jobs and serves report reads without importing the worker
- **Worker service:** `FIXFLAGS_PROCESS_ROLE=worker`; required dedicated process that owns Playwright, recovery, and browser shutdown
- **Local development:** `npm run dev` starts exactly one web process and one worker with concurrency one
- **Container:** Single-stage Docker (Debian bookworm-slim + apt Chromium). Railway uses `Dockerfile` via `railway.toml`. Playwright launches system Chromium (`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`).
- **Platform:** Railway (fly.io-compatible)
- **Health:** `/api/health` (liveness), `/api/health/ready` (strict launch contract), `/api/health/worker` (heartbeat), `/api/health/browser` (Playwright+R2), `/api/health/ai?validate=1` (live provider credentials)

## Key Data Flows

### Audit flow
1. User submits URL → API route creates Audit record (QUEUED)
2. Queue picks up job → runs capture (Playwright screenshot + HTML)
3. Runs deterministic checks (22 modules)
4. Runs AI triage (cheap model, 2500 chars page text)
5. Persists flags + scores + screenshots; resolves evidence anchors; optionally captures visual evidence (GIF/overlay) into `performanceData.flagVisualEvidence`
6. If user is signed up and `includeAi` → enqueues `ai-review` job for prescription (5000 chars page text)
7. Audit marked COMPLETED → user sees report (fix prompts when `aiReviewAt` set)
8. Update review (customer term): same URL → new capture → diff against previous flags. Internal route: `/api/reports/[id]/re-check`.

### Report UI ownership

Canonical hierarchy: [`knowledge/report-contract.md`](./knowledge/report-contract.md).

| Layer | Components |
|-------|------------|
| Canonical report workspace | `components/audit/AuditReport.tsx`, `components/report/ReportExplorer.tsx`, `lib/report/explorer-model.ts` |
| Detailed page shell | `components/audit/AuditReport.tsx`, toolbar, explorer, report actions |
| Improvement artifacts | `buildUnifiedPlanBundle()` aggregates live and repository Flags once; `buildFixArtifacts()` returns the complete ranked Fix List plus its bounded one-to-three item Finish Plan for report, API, export, task outcomes, MCP, and CLI |
| Preview scan access | `lib/audit/scan-access.ts`, encrypted on `Project`/`Audit`; Studio API + MCP `scanAccess` on check |
| Deploy CI gate | `app/api/webhooks/railway/route.ts` (`?apiKey=` + `?url=`); see `docs/railway-deploy-check.md` |
| Token share boundary | `lib/security/share-grant.ts`, `/api/share/[token]`, `/share/[token]` direct rendering; independent of `Audit.isPublic` |
| Live explorer | `LiveReportExplorer` → `ReportExplorer` |
| Sample explorer | `/samples`: `HeroProductPreview` → `SampleReportExplorer` → `ReportExplorer`. Homepage sample section: `SampleReportDashboardMock` fed by `buildSampleDashboardPreview` (product-true stylized chrome, not the live explorer). |
| Flag detail | `FlagDetailPanel` with access-redacted prompt state, then one desktop\|mobile pair via `ScreenshotWithHighlights`; GIF/overlay plays in the affected frame |

### Capture stack

Playwright Chromium via `lib/audit/screenshot.ts` + `lib/audit/browser/page-session.ts`. Visual evidence: `lib/audit/capture/*` (GIF/overlay/side-by-side), persisted by `persist-visual-evidence.ts`. Funnel analytics: `lib/analytics/events.ts`.

### Support and Help Center

- **Documentation and Help:** public product documentation lives under `/docs` (getting started, reports, troubleshooting). `/help` is the support surface for billing, account, failed checks, privacy, and human support. `/faq` is a searchable FAQ projection with `learnMore` links into Help. Content ownership and cross-link rules live in `docs/knowledge-base-ia.md`.
- **Unified search:** `KnowledgeSearch` indexes help articles and docs pages via `lib/knowledge/index.ts` (`buildKnowledgeIndex()`). Search appears on `/help`, help category/article pages, and the docs sidebar.
- **Live chat:** `SupportProvider` wraps knowledge routes (`/help`, `/faq`, `/docs`) and the authenticated app shell. APIs under `/api/support/*`. Admin inbox: `/admin/feedback`. Welcome SYSTEM message from `lib/help/sla.ts` / `SUPPORT_CHAT`.
- **Escalation:** Help articles and stuck surfaces (`AuditFailurePanel`, limit gate, billing, usage meter, report errors) call `openSupportChat` or deep-link to articles via `lib/help/contextual.ts`. `HelpChatEscalate` hides the chat button when no provider is mounted and links to contact-us instead.
- **Email:** `hello@fixflags.com` for legal/high-volume. Payment failure notifies admin + user (`lib/billing/notify.ts`).

### SaaS flow
1. Anonymous user: triage + deterministic flags → upsell at sign up for fix prompts
2. Authenticated user with credits: triage → prescription job → full report with fix prompts
3. Triage degraded: COMPLETED with flags/screenshots and honest partial-AI message (see `docs/audit-pipeline.md`)
4. Update reviews use product review credits on every plan (customer copy). Internal re-check route remains ungated by ownership only until billing enforcement ships.

## Vision alignment and architecture review

Vision evolution (2026-08): [knowledge/vision.md](./knowledge/vision.md). The Product is the long-term object, Reviews and Flags are observations, Improvements are durable decisions, and the canonical loop is Observe → Understand → Judge → Improve → Verify → Learn. The customer wedge loop (Product Review → Fix → Verify → Watch) is unchanged.

Review of the current architecture against the vision direction. **Proposals only — no code changed by this review.** Prefer reversible evolution over a speculative rewrite.

| Vision requirement | Current support | Smallest clean change (proposed) |
|---|---|---|
| Product as persistent first-class object | `Project` (`canonicalHost`, `isManaged`, `productIntelligence`) is the Product anchor | Keep `Project` as the anchor; extend `Project.productIntelligence`, do not add a new entity |
| Review as observation/version | `Audit` + `parentId` for update reviews | Keep `Audit` as the observation record; every observation already links to its Project |
| Evidence across multiple sources | Flags originate from Review checks, AI, and journeys; Product Signals are stored separately | Normalize each source into bounded provenance, then let judgment decide whether it supports an Improvement, warrants investigation, or is noise |
| Durable improvement lifecycle/history | `FlagFeedback` and update-review Flag status provide observation-level history | Add Product-scoped Improvements, occurrences, attempts, and independent verification outcomes without rewriting Flags |
| Evidence provenance | `evidenceAnchors`, `networkFailures`, visual evidence on the flag | Keep evidence attached to the Flag; no migration now |
| Product Memory | `Project.productIntelligence` JSON (Contract seed) | Keep compact Contract and learned facts in JSON; normalize only high-query Improvement history |
| Conversation / timeline | Report chat + activity timeline | Build the timeline concept; do not create a second memory store |
| Before/after verification | `diffFlagsAgainstParent` on update review | Reuse for every fix-verify flow |
| Deployment linkage | Product watch (`watchInterval` / `watchNextRunAt`) + Railway webhook | Link Flags to deployments when watch reports regressions |
| GitHub fixes/PRs | Studio repo scan + `repo-fix-pr` jobs | Extend to the GitHub-native "Fix it for me" trust model (branch/PR + independent verification) |
| Future customer/user signals | Not collected | Add a narrow privacy-bounded substrate; signals remain observations until judgment promotes them |
| Agent/API access | MCP + CLI | Already aligned |
| Private vs generalized learning | Growth graph is internal-only; customer PI is separate | Maintain the boundary; never merge ([product-intelligence.md](./knowledge/product-intelligence.md)) |

Conclusion: no structural rewrite. Evolve the existing relational system with a durable Improvement cycle first, then add only the Product Signals that improve judgment or verification.

## Technical invariants

- Public Review boundaries are `/api/checks` and `/api/reports/[id]/*`; native browser context enters only through the origin-bound `/api/products/[id]/signals` contract.
- Product Signals accept a fixed privacy-bounded schema and remain observations until Product judgment uses them.

- No Prisma/Node imports on edge runtime (proxy.ts)
- `serverExternalPackages`: playwright, @prisma/client, prisma, better-auth, bullmq, ioredis, @anthropic-ai/sdk, etc.
- R2 is required for production screenshots. Missing R2 → service boots, scans fail with clear message.
- Missing AI keys may be an explicit local degraded mode. Production startup and `/api/health/ready` reject the incomplete launch capability.
- No `next build`-time OAuth gating (resolved at runtime via `/api/auth/providers`)
- OAuth callback URL: `https://fixflags.com/api/auth/callback/google`

## Database snapshot

Generate the current model count from `prisma/schema.prisma` with `grep -c '^model ' prisma/schema.prisma`; do not store it in documentation.

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
