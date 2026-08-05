# FixFlags (qewos) Investigation Report

**Date:** August 4, 2026
**Scope:** Full repository investigation for FixFlags product intelligence system
**Method:** File system exploration, canonical documentation review, architecture analysis

---

## 1. Executive Summary

FixFlags is a mature, production-ready **Product Intelligence System for AI-built software**. The system audits live URLs, produces ranked "Flags" (findings with evidence) across three rubrics (Message, Experience, Reach), generates editor-ready fix prompts, and supports a **Check → Fix → Verify → Watch** loop with update reviews and regression detection.

**Current State:** Pre-revenue testing phase. Core pipeline is shipped and verified. Distribution/polish has priority over additional depth. The codebase is clean, well-documented, and follows strict canonical source conventions.

---

## 2. Architecture Overview

### 2.1 System Layers

| Layer | Status | Description |
|-------|--------|-------------|
| **Web App** | Shipped | Next.js 15 (App Router), PostgreSQL + Prisma 6, Redis + BullMQ 5 |
| **Audit Worker** | Shipped | Dedicated process (`FIXFLAGS_PROCESS_ROLE=worker`) owning Playwright Chromium |
| **FixFlags CLI** | Shipped (beta) | Thin MCP client over cloud API (`npx fixflags check/recheck/status`) |
| **MCP Server** | Shipped | 17 public tools for editor integration (Cursor, Claude Code, Lovable, Bolt, Windsurf) |
| **Knowledge Graph** | Phase 1 | Internal growth graph (Site, Issue, FixPrompt, BenchmarkSnapshot) — separate from customer PI |

### 2.2 Directory Structure (Key Areas)

```
qewos/
├── app/                          # Next.js App Router
│   ├── (marketing)/              # Homepage, pricing, FAQ, docs, changelog
│   ├── (auth)/                   # Sign in/up, password reset
│   ├── (app)/                    # Authenticated: dashboard, billing, settings
│   ├── api/                      # Public boundaries: /api/checks, /api/reports/[id]/*
│   ├── report/[id]/              # Canonical report workspace (progressive + completed)
│   ├── admin/                    # Admin dashboard
│   └── compare/                  # Before/after comparison
├── components/
│   ├── audit/ (52)               # Progressive + completed report components
│   ├── report/ (15)              # Canonical report workspace (ReportWorkspaceSplitShell, etc.)
│   ├── ui/ (34)                  # shadcn/ui primitives
│   ├── layout/                   # Marketing, Site, Audit shells
│   └── [billing|dashboard|admin|pricing|marketing|help|auth|cli|repo-scan|demo|compare|brand|analytics|live-support|settings|system]/
├── lib/
│   ├── audit/ (120+ files)       # Pipeline, checks (22 modules), AI triage/prescription, capture
│   ├── queue/                    # BullMQ worker, recovery scheduler, heartbeat
│   ├── graph/                    # Knowledge graph (internal only)
│   ├── billing/                  # Plans, limits, Stripe integration
│   ├── marketing/copy/           # Single source of truth for all customer copy
│   ├── mcp/                      # MCP tool definitions, handlers, manifest
│   ├── report/                   # Explorer model, finish-plan builder
│   ├── auth/                     # better-auth helpers, entitlements
│   └── design/                   # Tokens, brand spec
├── fixflags-cli/                 # Standalone npm package (published separately)
│   ├── src/                      # check, recheck, status, login, init, mcp bridge
│   └── bin/fixflags.js
├── worker/                       # Dedicated worker entry point
├── prisma/schema.prisma          # 50+ models (User, Audit, Flag, Project, Graph entities, etc.)
├── knowledge/                    # Canonical product/strategy/architecture docs
└── docs/                         # Product PRD, workspace interface, audit pipeline, etc.
```

### 2.3 Audit Pipeline (Core Engine)

Full pipeline stages, per-page behavior, and recovery are canonical in [docs/audit-pipeline.md](../docs/audit-pipeline.md) — see there for the authoritative stage chain and failure handling.

**Key Files:**
- `lib/audit/runner.ts` — Top-level `runAudit()` orchestrator
- `lib/audit/pipeline/run-page.ts` — Per-page processing
- `lib/audit/checks/index.ts` — 22 check modules via `runAllChecks()`
- `lib/audit/judge-triage.ts` / `judge-prescription.ts` — AI phases
- `lib/audit/screenshot.ts` — Playwright capture singleton
- `lib/audit/task-contracts.ts` — Canonical `checkAndPlan` / `recheckAndDiff` outcomes

### 2.4 Queue & Worker System

- **BullMQ** on Redis with dedicated worker process
- **Job types:** `audit`, `ai-review`, `repo-scan`, `repo-fix-pr`
- **Recovery:** Poll-time (15s) + self-hosted scheduler (stuck audit sweep)
- **Heartbeat:** Every 20s to Redis (45s TTL) with browser diagnostics
- **Concurrency:** `WORKER_CONCURRENCY=1` locally, configurable in production

### 2.5 Auth & Authorization

- **better-auth 1.6** with Prisma adapter
- **Providers:** Email/password, Google OAuth, GitHub OAuth (runtime-resolved)
- **Session:** Cookie-based, edge-safe presence check in `proxy.ts`
- **Roles:** `user` (default), `admin` (via `ADMIN_USER_IDS`)
- **Plans:** `FREE`, `BUILDER` (Pro), `TEAM` (Studio)
- **API Keys:** Hashed, prefixed `ff_live_`, for MCP access

### 2.6 Billing & Metering

| Plan | Price | Product Reviews/mo | Deep Reviews/mo |
|------|-------|-------------------|-----------------|
| Free | $0 | 3 lifetime | 1 teaser |
| Pro | $69/mo | 25 | 4 |
| Studio | $199/mo | 80 | 10 |

- **Dual-pool metering:** Product reviews (new URL + update review share pool) + Deep reviews (separate)
- **Watch-triggered re-checks** skip product review meter
- Enforcement: `lib/billing/plans.ts`, `lib/audit/usage.ts`

---

## 3. FixFlags UI / CLI Integration Points

### 3.1 Web App → Report Workspace

**Canonical Report:** `/report/[id]` (see `knowledge/report-contract.md`)

```
1. Compact identity row (hostname, URL, status, actions)
2. Re-check result (when applicable)
3. Progress band: release score, unresolved Flag count, Re-check history, rubric coverage
4. Sticky section navigation (when ≥2 sections)
5. Top fixes (full ranked bundle)
6. Complete ranked fix list (#report-flags) with screenshot evidence + selected detail
7. Made with, Product Contract, Verified Memory (when present)
8. Funnel, Flow, Action Timeline (#report-funnel)
9. Share/search previews, launch gates, watch, export, project, MCP controls
10. Owner update review (#report-recheck)
11. At most one contextual signup/upgrade moment
```

**Progressive Report:** Homepage paints report geometry immediately on URL submit → history-replace to `/report/[id]` → polling with honest stage progress → SSR swap on completion.

**Workspace Layout** (desktop):
- **Left:** Chat + Activity (cheap router model, owner-only)
- **Right:** Browser view ↔ Report view toggle (dominant panel)
- **Bottom:** Playback strip (timeline/scrub for path replay)

### 3.2 CLI (`fixflags-cli`) — Thin MCP Client

**Commands:**
```bash
npx fixflags check <url> [--wait] [--plan] [--single] [--full] [--json]
npx fixflags recheck <reportId> [--wait] [--diff] [--full] [--json]
npx fixflags status <reportId> [--json]
npx fixflags login [--with-token] [--insecure-storage]
npx fixflags whoami [--json]
npx fixflags logout [--local-only]
npx fixflags init [url] [--editor <name>] [--scope project|user] [--dry-run]
npx fixflags mcp  # Secure local bridge for editor MCP configs
```

**MCP Tools Used:**
- `ff_check_and_plan` — Check URL → ranked Fix List
- `ff_get_check_status` — Poll completion
- `ff_get_report` / `ff_get_rubric` / `ff_get_flag` — Report data
- `ff_get_all_fixes` / `ff_get_current_finish_plan` — Complete fix bundles
- `ff_recheck_and_compare` — Update review + verification diff
- `ff_compare` — Compare two reports
- `ff_plan_mode_prompt` — Agent-ready prompt with all fixes
- `ff_get_product_context` — Product Contract + PI
- `ff_start_repo_scan` / `ff_list_repo_scans` / `ff_get_repo_scan` / `ff_get_repo_finding` — Studio repo scanning
- `ff_mark_fix_attempted` — Mark Flag fixed/ignored

**Integration Flow:**
1. CLI calls `/api/mcp` with JSON-RPC 2.0 + `x-api-key` (or stored credential)
2. Server validates API key, executes tool handler
3. Returns structured JSON → CLI renders human-readable or `--json` output
4. `--wait` polls `ff_get_check_status` until `COMPLETED`

### 3.3 MCP Server (Editor Integration)

**Public Surface:** 17 tools in `lib/mcp/tool-manifest.ts` (canonical registry)

**Editor Support:** Cursor, Claude Code, Windsurf, Lovable, Bolt, Replit, Codex, Devin, VS Code, other

**Auth:** Device authorization flow (`CliDeviceAuthorization` model) + API keys

**Bridge:** `fixflags mcp` runs local stdio bridge → proxies to `/api/mcp` with stored credential

### 3.4 API Boundaries (Public)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/checks` | Create audit (anonymous or authenticated) |
| `GET /api/reports/[id]` | Progressive/completed report state |
| `GET /api/reports/[id]/status` | Poll status |
| `POST /api/reports/[id]/re-check` | Update review (internal term) |
| `POST /api/mcp` | MCP JSON-RPC endpoint |
| `/api/auth/*` | better-auth routes |
| `/api/stripe/*` | Checkout, portal, webhooks |
| `/api/health*` | Liveness, readiness, worker, browser, AI |

---

## 4. Gaps & Improvement Opportunities

### 4.1 Critical Gaps (Launch Blockers)

| Area | Gap | Impact |
|------|-----|--------|
| **npm Package** | `fixflags` npm package claimed but **trusted-publisher release not verified**; CLI v0.2.0-beta.1, device auth, credential-store login, editor init, public customer skill **unshipped** | Cannot distribute CLI publicly with provenance |
| **Lovable/Bolt Connector Smokes** | Deployed connector smoke tests and release credential proof **not completed** | MCP integration claims unverified in production |
| **Accuracy Regression Suite** | Screenshot pixel rendering **not frozen**; offline corpus has HTML + PageSpeed + network + overlay + slow-replay + dead-end-flow but not pixel-perfect screenshots | Cannot guarantee deterministic visual evidence |
| **API Route Contract Tests** | Only critical path covered (checks create, api-keys, projects, scan-access, railway webhook, report status poll, re-check); **remaining routes lack handler-level tests** | Regression risk on non-critical endpoints |
| **Touch-Tier Tests** | Progressive chrome, failure panel, empty states covered; **full report-state matrix still expanding** | UX regressions possible in edge states |

### 4.2 Product Gaps (Post-Launch Priority)

| Area | Gap | Source |
|------|-----|--------|
| **Deep Review Browser** | Agent-class autonomous browsing (multi-step journeys, funnel traversal) — only journey capture in pipeline today | ROADMAP: "Live Review Workspace (UI)" |
| **Mobile Full-Screen Path Replay** | Bottom strip shipped; full-screen takeover open | product-prd.md open questions |
| **Free Deep Review Teaser** | One journey playback vs summary-only — unresolved | product-prd.md open questions |
| **Public API Rename** | `/re-check` → `/update-review` migration pending | product-prd.md §43, DECISIONS 2026-07-28 |
| **Repo Connect → Implementation Integrity** | Optional repo connect feeding into Fix List — entitlement expansion after thesis | ROADMAP: Next |
| **CLI Local Runtime** | Cloud-backed only; local runtime later | knowledge/open-source.md |
| **Evolution Tracking** | Trend quality over time per Product/URL | ROADMAP: Next |
| **Open Community Skills** | Extract in-repo loop skill to standalone OSS repo | ROADMAP: Next |

### 4.3 Technical Debt

| Area | Debt |
|------|------|
| **Regression Fixtures** | Screenshot pixel rendering not frozen; accuracy eval covers HTML corpus + demo repair + non-HTML but not visual pixels |
| **Route Contract Tests** | Non-critical API routes untested |
| **Auth/Session Coverage** | Incomplete test coverage for edge cases |
| **Touch-Tier Matrix** | Expanding but incomplete |
| **Localhost/Private Networks** | Not supported (Studio preview tunnels + HTTP basic auth only) |
| **Team Workspaces** | Not implemented |
| **White-Label Reports** | Not implemented |
| **CI/CD Integration** | Railway webhook only; no generic CI/CD |

### 4.4 Design/UX Polish Opportunities

| Area | Opportunity |
|------|-------------|
| **Report Workspace** | `ReportWorkspaceSplitShell` shipped but deep review browser mode not implemented |
| **Playback Strip** | Step markers + scrub shipped; full session-style takeover replay open |
| **Mobile Chat ↔ Product** | Tab switch shipped; swipe/FAB drawer alternatives open |
| **Ambient Motion** | Restricted to marketing surfaces (correct per DESIGN.md); ensure no leakage |
| **Peach Orbs** | Brand signature on marketing only; verify not on work surfaces |

---

## 5. Prioritized Next Steps

### P0 — Launch Readiness (Must Complete Before Broad Launch)

1. **Complete npm Trusted Publisher Release**
   - Configure GitHub OIDC trusted publisher for `fixflags` package
   - Run protected provenance release (`npm publish --provenance`)
   - Verify package installs with `npm install fixflags` showing provenance
   - Ship CLI v1.0.0 with device auth, credential store, editor init, customer skill

2. **Credentialed Lovable/Bolt Connector Smokes**
   - Run production dogfood scans with verified editor integrations
   - Document setup in `/docs/integrations` (code-backed catalog)
   - Only claim "verified shipped integration" after production smoke passes

3. **Freeze Accuracy Regression Fixtures**
   - Capture pixel-perfect screenshot baselines for corpus
   - Add visual regression gate to `npm run accuracy:eval`
   - Document fixture capture process in `.agents/skills/fixflags-scan-accuracy/`

4. **Complete API Route Contract Tests**
   - Target: all public `/api/*` routes have handler-level tests
   - Priority: billing, auth, share, webhook, MCP routes

5. **Resolve Public API Rename**
   - Migrate `/api/reports/[id]/re-check` → `/api/reports/[id]/update-review`
   - Update CLI, MCP tools, documentation
   - Maintain backward compatibility during transition

### P1 — Product Completion (First 30 Days Post-Launch)

6. **Deep Review Browser Mode**
   - Implement agent-class autonomous navigation in workspace browser panel
   - Funnel traversal + path recording
   - Integrate with existing journey review pipeline

7. **Mobile Full-Screen Path Replay**
   - Decide: bottom strip vs full-screen takeover (product-prd.md open question)
   - Implement chosen pattern with responsive parity

8. **Free Deep Review Teaser Decision**
   - One journey playback vs summary-only
   - Implement and gate behind existing deep review quota

9. **Repo Connect → Fix List Integration**
   - Optional GitHub connection feeds Implementation Integrity findings into ranked Fix List
   - Entitlement: Studio plan only initially

10. **Evolution Tracking (Trend Quality)**
    - Per-Product/URL quality trends over time
    - Dashboard widget + MCP tool exposure

### P2 — Distribution & Scale (Month 2-3)

11. **CLI Local Runtime**
    - Offline check capability (subset of checks)
    - Local verify without cloud round-trip

12. **Open Community Skills Repo**
    - Extract core Check → Fix → Re-check loop skill to standalone OSS
    - Cursor, Claude Code, Kiro install paths
    - MCP tool contract manifest + CI lint
    - Keep internal operator skills proprietary

13. **Knowledge Graph Phase 2**
    - Public issue/benchmark pages (growth graph)
    - Separate from customer Product Intelligence

14. **Team Workspaces / White-Label**
    - Multi-user projects, shared reports
    - Branded share links (Studio add-on)

15. **Generic CI/CD Integration**
    - Beyond Railway: GitHub Actions, GitLab, Vercel, Netlify
    - Deploy webhook standard

---

## 6. Key Files Reference (For Future Work)

### Canonical Documentation
- `AGENTS.md` — Agent operating instructions
- `ROADMAP.md` — Now/Next/Later/Not planned
- `DECISIONS.md` — Durable decisions with rationale
- `ARCHITECTURE.md` — System overview, data flows, invariants
- `DESIGN.md` — Visual/interaction standards, tokens
- `PRODUCT.md` — Shipped truth only
- `CANONICAL-SOURCES.md` — Master index of concept → source file
- `knowledge/report-contract.md` — Report hierarchy (canonical)
- `docs/product-prd.md` — Product requirements (merged live review + workspace)
- `docs/workspace-interface.md` — Layout, modes, playback, mobile spec
- `docs/audit-pipeline.md` — Pipeline stages, AI phases, degradation, recovery
- `knowledge/vision.md` — North star, Product Intelligence layers
- `knowledge/product-intelligence.md` — PI model, Product Contract, Finish Plan

### Core Implementation
- `lib/audit/runner.ts` — Audit orchestrator
- `lib/audit/checks/index.ts` — 22 deterministic check modules
- `lib/audit/judge-triage.ts` / `judge-prescription.ts` — AI phases
- `lib/audit/screenshot.ts` — Playwright capture
- `lib/audit/finish-plan.ts` — Canonical Fix List builder
- `lib/audit/task-contracts.ts` — `checkAndPlan` / `recheckAndDiff` (shared web/CLI/MCP)
- `lib/report/explorer-model.ts` — ReportExplorerModel (unified across surfaces)
- `lib/mcp/tool-manifest.ts` — Canonical MCP tool registry
- `lib/marketing/copy/terminology.ts` — Customer terminology (single source)
- `components/report/ReportWorkspaceSplitShell.tsx` — Interactive split workspace
- `components/audit/AuditReportProgressive.tsx` — Progressive report parity
- `fixflags-cli/src/workflows.ts` — CLI MCP workflows
- `worker/index.ts` — Dedicated worker runtime

### Verification Commands
```bash
npm run agent                    # Compact repo state + next actions
npm run agent -- verify --dry-run # Preview changed-file verification
npm run agent -- verify           # Changed-file verification
npm run agent -- verify --full    # Full project gate
npm run validate:quick            # Lint + typecheck
npm run validate:affected         # Tests + guards
npm run verify                    # Full DB, code, test, build, worker gate
npm run accuracy:eval             # Offline scan accuracy gate
npm run accuracy:probe            # Live HTML accuracy adjudication
npm run dev                       # Next.js app
npm run dev:all                   # App + worker
```

---

## 7. Assessment Summary

| Dimension | Status | Notes |
|-----------|--------|-------|
| **Core Pipeline** | ✅ Shipped & Verified | 22 checks, AI triage/prescription, journey reviews, visual evidence |
| **Report Workspace** | ✅ Shipped | Progressive + completed parity, split layout, playback strip |
| **CLI** | ✅ Beta Functional | Thin MCP client, all core workflows, `--json` for automation |
| **MCP Server** | ✅ Shipped | 17 tools, editor catalog, device auth bridge |
| **Billing/Metering** | ✅ Enforced | Dual-pool, Stripe, update review metering |
| **Auth/Security** | ✅ Hardened | better-auth, passkey 2FA, edge middleware, encrypted secrets |
| **Accuracy** | ⚠️ Partial | HTML corpus + demo repair gates; pixel regression not frozen |
| **Test Coverage** | ⚠️ Partial | Critical path covered; non-critical routes, touch matrix expanding |
| **npm Distribution** | ❌ Blocked | Trusted publisher release pending |
| **Editor Smokes** | ❌ Blocked | Credentialed production dogfood pending |
| **Deep Review** | 🔄 In Progress | Journey capture shipped; agent-class browser mode not started |
| **Mobile Parity** | ⚠️ Partial | Chat ↔ Product tabs; full-screen replay open |

---

## 8. Recommended Immediate Focus

**This week:** Complete P0 items 1-5 (npm release, editor smokes, accuracy freeze, API tests, API rename). These are the only hard blockers for a credible public launch.

**Next week:** Begin P1 item 6 (Deep Review browser mode) — this is the major differentiator for Product QA positioning vs. "just another Lighthouse wrapper."

The codebase is in excellent shape: canonical sources enforced, dead code removed, architecture clean, documentation current. The remaining work is **polish, distribution hardening, and the deep review differentiator** — not structural fixes.