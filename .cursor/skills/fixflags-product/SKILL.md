---
name: fixflags-product
description: Route FixFlags product changes to canonical behavior, access, billing, report, task, and deployment sources while preserving launch-contract invariants.
---

# FixFlags product

Read `AGENTS.md` first. This skill routes work; canonical sources own detailed truth.

## Route by concern

| Concern | Canonical source |
|---|---|
| Shipped promise | `PRODUCT.md` |
| Product direction | `knowledge/vision.md`, `ROADMAP.md` |
| Report hierarchy | `knowledge/report-contract.md` |
| Audit stages and recovery | `docs/audit-pipeline.md`, `lib/audit/` |
| Plans and quotas | `lib/billing/plans.ts`, `lib/auth/entitlements.ts`, `lib/auth/permissions.ts` |
| Access and sharing | `lib/audit/report-access.ts`, `lib/security/share-grant.ts`, `SECURITY.md` |
| Check/re-check task outcomes | `lib/audit/task-contracts.ts` |
| Product Contract and Remember | `lib/audit/product-contract.ts`, `lib/audit/product-intelligence.ts` |
| Marketing copy | `lib/marketing/copy.ts` |
| Runtime requirements | `lib/env.ts`, `lib/health/readiness.ts`, `DEVELOPMENT.md` |
| Runtime and release execution | `.cursor/skills/fixflags-runtime-release/SKILL.md` |
| Verification | `scripts/validate.mjs`, `QUALITY.md` |

## Invariants

- The user loop is Flag → Fix → Re-check; re-checks are fresh, full, free, and diff against their parent.
- Public rubrics are exactly Message, Experience, and Reach.
- Anonymous users receive one teaser scan: real evidence on all Finish Plan items, exactly one complete demonstrated fix prompt, remaining prompts gated until claim (`PRODUCT.md`, `knowledge/report-contract.md`). Never persist signup-gate strings as flag evidence/fix.
- Authentication returns through `/post-login` so claim occurs before checkout or onward navigation.
- HTTP, MCP, CLI, watch, and UI transports call shared task/application services; routes validate access and adapt responses.
- Public boundaries remain `/api/checks` and `/api/reports/[id]/*`; do not add legacy audit routes.
- Plan, ownership, report access, Stripe, and deterministic product truth are never delegated to an LLM.
- Production starts only when launch-required capabilities are configured and `/api/health/ready` is healthy.

## Workflow

1. Load focused context with `npm run agent -- context <area>`.
2. Trace the outcome through route, service, persistence, access/entitlement, UI, and transport reuse.
3. Add tests at the business boundary first, then route-contract and journey coverage where behavior is exposed.
4. Preserve public HTTP paths, MCP tool names, CLI commands, and entitlement semantics unless the user explicitly changes the contract.
5. Run `npm run agent -- verify --dry-run`, the focused evaluation, and `npm run agent -- verify`.
6. Update canonical Markdown only after behavior passes.

## Anonymous wedge checklist

1. Trace `getGatedAuditForRequest` → `promptAccess` → Finish Plan → Copy UI → `/details` explorer.
2. Assert live anon evidence is real page evidence, not `Create a free account to see evidence…`.
3. Assert Copy prompt is absent or copies a real editor prompt; never toast success on a gate placeholder.
4. Keep marketing sample unlock on the sample path only (`isPublicMarketingSample` / `variant="sample"`).

## Do not ship

- Roadmap “Next” or “Later” work disguised as completion.
- Silent production degradation, hardcoded provider answers, fake proof, duplicated canonical facts, or compatibility fallbacks.
- A UI-only gate without matching server access control, or a route-only implementation unavailable to other transports.
- Production dogfood gaps filed as “Touch later” when they break first-value trust (see `.agents/sessions/customer-journey-completion-plan.md`).
