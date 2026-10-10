---
status: canonical
authority: operations
reviewed_at: 2026-10-10
supersedes: []
---

# FixFlags agent guide

This is the stable entry point for repository work. Keep it small; retrieve task-specific context only when needed.

## Mission and authority

FixFlags is the independent monitor for software that acts: **Your software runs. FixFlags watches.**

The accepted September 21 direction lives in [knowledge/vision.md](knowledge/vision.md). The existing Site product is the migration base. Build around important Outcomes, independent execution, meaningful Flags, fresh verification, always-on Watch, and launch-scope MCP.

Use [CANONICAL-SOURCES.md](CANONICAL-SOURCES.md) to resolve authority. Older reports, plans, sessions, handoffs, and research are evidence, not instructions. Never present VISION or NEXT behavior as SHIPPED.

For product-experience and homepage work, read the scoped [experience review](docs/experience-review.md) and [continuation handoff](.agents/handoffs/homepage-experience.md). The founder approved the October 10 homepage implementation: retain the brand and URL entry, demonstrate a comprehensive interactive board, follow coherent sample recovery, and distinguish scheduled monitoring. Show the full supported product through progressive depth. Commercial access, numerical limits, deployment and backend execution changes remain outside this scope. Inspect actual desktop and mobile rendering.

## Start here

1. Run `git status --short` and `npm run agent`.
2. Run `npm run agent -- context <area>` for the smallest relevant source map.
3. Before substantial writes, claim a non-overlapping scope with `npm run agent -- task claim`.
4. Inspect the current implementation and its focused tests before changing it.
5. Run `npm run agent -- verify --dry-run`, then the selected proportional checks.
6. Exercise the real behavior when practical; report uncertainty honestly.

Do not read the full documentation tree, task history, sessions, handoffs, or archived board by default.

## Context routes

| Work | Context command |
| --- | --- |
| Repository orientation | `npm run agent -- context orientation` |
| Product direction and Site | `npm run agent -- context product` |
| Application interface | `npm run agent -- context interface` |
| Audit pipeline and browser checks | `npm run agent -- context audit` |
| Outcomes, verification, and Watch | `npm run agent -- context outcomes` |
| MCP, CLI, and integrations | `npm run agent -- context cli` |
| Authentication and billing | `npm run agent -- context billing` |
| Security and privacy | `npm run agent -- context security` |
| AI prompts and model policy | `npm run agent -- context prompts` |
| Release and recovery | `npm run agent -- context release` |
| Growth and public language | `npm run agent -- context growth` |
| Canonical documentation | `npm run agent -- context docs` |

Open deeper references only when the returned map or the code makes them necessary.

## Product invariants

- Customer hierarchy: **Site/Product → Outcomes → execution methods → Clear or Flag → evidence/history/diagnostics**.
- The customer loop is **Flag → Fix → Verify**, continued by monitoring.
- Adapt the existing `SiteOutcome`; do not create a parallel Monitor, Task, or Objective domain.
- Site health must state coverage, scope, and freshness. No Flags does not mean untested behavior is healthy.
- Verification is a fresh independent evaluation. Never inject unsolicited prompts into a user's AI tool.
- Public claims must match released behavior and real evidence. Never invent testimonials, counts, causality, savings, or recovery.
- Customer language comes from `lib/marketing/copy.ts` and `lib/marketing/copy/terminology.ts`.
- Preserve useful Site, audit-ledger, Flag, Watch, Shopify, auth, billing, MCP, and evidence foundations during migration.
- Legacy report behavior is compatibility scope, not the target product experience.

## Architecture and security invariants

- Audit stages remain `QUEUED → CAPTURING → CHECKING → JUDGING → FINALIZING → COMPLETED`.
- Register checks through `lib/audit/checks/index.ts`; check identities live in `lib/audit/check-ids.ts`.
- Playwright is the audit browser. Do not add Puppeteer or chrome-devtools-mcp to the scan path.
- Persist journey and network evidence with its originating source.
- Verify recovery by freshly exercising the relevant behavior; absence alone cannot resolve a Flag.
- Public graph reads go through `lib/graph/queries.ts`; preserve tenant isolation.
- Edge middleware must not import Prisma or Node-only modules.
- New Site/Outcome behavior belongs in `lib/sites/application`; consumers use one tenant-scoped run command.
- Keep stable system prompts separate from request-specific user content.
- Read [SECURITY.md](SECURITY.md) before auth, billing, sharing, webhook, encryption, or middleware work.
- Never commit secrets, raw model transcripts, customer data, or telemetry containing prompts or source.

## Coordination

- One foreground writer may use the main checkout; concurrent writers use separate managed worktrees.
- Read-only investigation may share a checkout. One integration owner combines concurrent changes.
- Live ownership comes from `npm run agent -- ownership`, not `.agents/BOARD.md`.
- Heartbeat, finish, or release a lease with the `npm run agent -- task ...` commands.
- Preserve unrelated working-tree changes. Never reset, clean, stash, overwrite, or discard another worker's work.
- Create a session only for durable decisions, meaningful failures, cross-chat work, or important evidence.
- Create a handoff only when another person or agent must continue incomplete work.

See [.agents/README.md](.agents/README.md) for the coordination contract. Company heartbeat policy applies only when that workflow is explicitly invoked.

## Verification

- Localized change: run the focused test or static check.
- Shared contract: run affected package or integration tests.
- Security, auth, billing, migration, or release work: run the broader relevant suite.
- Full suite: reserve for a release boundary or demonstrated cross-cutting risk.
- Verify behavior and artifacts, not only exit codes. Avoid duplicate reviewer passes with the same remit.

## Definition of done

- The result matches the user outcome and current canonical intent.
- Ownership is finished or released; durable evidence is recorded only when warranted.
- Relevant checks pass, or the exact gap and reason are stated.
- Real-path behavior is exercised when risk justifies it.
- Documentation changes update the canonical home instead of adding a competing specification.

Commands and environment setup: [DEVELOPMENT.md](DEVELOPMENT.md). Knowledge placement and precedence: [CANONICAL-SOURCES.md](CANONICAL-SOURCES.md) and [EVOLUTION-RULES.md](EVOLUTION-RULES.md).
