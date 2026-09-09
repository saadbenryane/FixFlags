# FixFlags agent guide

Canonical entry point for AI agents. Load detailed context only for the task at hand.

Start with `npm run agent`. Use `npm run agent -- context <area>` for focused files, invariants, commands, and next steps.

PiWeb is the session interface for this repository. Product work happens here. See [`.agents/README.md`](.agents/README.md) for coordination, PiWeb routing, and skills.

## Product

**Your website, looked after.** The accepted [September 8 vision](knowledge/vision.md) replaces the report experience with a persistent Site, inferred Journeys, meaningful Flags and ongoing care.

- Target loop: **Flag. Fix. Verify.**, continued by monitoring. Customer-facing language: [docs/voice-and-copy.md](docs/voice-and-copy.md).
- Information architecture: [docs/product-architecture.md](docs/product-architecture.md). Complete plan: [docs/product-masterplan.md](docs/product-masterplan.md).
- Interface states and acceptance: [docs/workspace-interface.md](docs/workspace-interface.md), [docs/product-prd.md](docs/product-prd.md).
- Site engineering phases: [ROADMAP.md](ROADMAP.md); reuse and ownership: [docs/site-v2-migration.md](docs/site-v2-migration.md).
- Preserve the brand, accounts, billing, plans and useful evidence infrastructure. Shopify is a connection and distribution wedge in one product.
- [PRODUCT.md](PRODUCT.md) is the existing implementation baseline, not the new target. [knowledge/report-contract.md](knowledge/report-contract.md) governs legacy report compatibility only.
- Older task plans, rubric locks, report/chat layouts and Shopify-only commercial bets are superseded as new-product instructions.

## Task router

| Area | Start here | Agent command |
|------|------------|---------------|
| Repository orientation | [CODEMAP.md](CODEMAP.md), [ROADMAP.md](ROADMAP.md) | `npm run agent -- context orientation` |
| New Site or application UI | [DESIGN.md](DESIGN.md), [docs/product-architecture.md](docs/product-architecture.md), [docs/workspace-interface.md](docs/workspace-interface.md), [docs/product-prd.md](docs/product-prd.md), [docs/voice-and-copy.md](docs/voice-and-copy.md) | `npm run agent -- context ui` |
| Legacy report or sharing | [knowledge/report-contract.md](knowledge/report-contract.md), [SECURITY.md](SECURITY.md) | `npm run agent -- context ui` |
| First-value / anon dogfood | [docs/product-prd.md](docs/product-prd.md), [SECURITY.md](SECURITY.md); legacy routes also use the report contract | `npm run agent -- context ui` |
| Audit pipeline and checks | [docs/audit-pipeline.md](docs/audit-pipeline.md), `lib/audit/` | `npm run agent -- context audit` |
| Browser capture (Playwright) | [`.agents/skills/fixflags-browser-capture/SKILL.md`](.agents/skills/fixflags-browser-capture/SKILL.md), `lib/audit/screenshot.ts` | `npm run agent -- context audit` |
| Scan accuracy and fixtures | `lib/audit/accuracy-corpus.ts`, [`.agents/skills/fixflags-scan-accuracy/SKILL.md`](.agents/skills/fixflags-scan-accuracy/SKILL.md) | `npm run agent -- context accuracy` |
| AI prompts and models | `lib/prompts/system-prompt.ts`, `lib/audit/judge-config.ts` | `npm run agent -- context prompts` |
| Billing and entitlements | `lib/billing/`, `lib/auth/entitlements.ts` | `npm run agent -- context billing` |
| SEO growth loop and organic measurement | `docs/growth/`, `lib/growth/`, [`.agents/skills/fixflags-seo-growth-loop/SKILL.md`](.agents/skills/fixflags-seo-growth-loop/SKILL.md) | `npm run agent -- context growth` |
| Parked CLI / MCP / repo-scan | `fixflags-cli/`, [`.agents/skills/fixflags-npm-operations/SKILL.md`](.agents/skills/fixflags-npm-operations/SKILL.md) | `npm run agent -- context cli` |
| Canonical knowledge | [CANONICAL-SOURCES.md](CANONICAL-SOURCES.md), [EVOLUTION-RULES.md](EVOLUTION-RULES.md) | `npm run agent -- context docs` |
| Messaging and public language | [docs/voice-and-copy.md](docs/voice-and-copy.md), [docs/product-masterplan.md](docs/product-masterplan.md) | `npm run agent -- context docs` |
| Failures and recovery | [QUALITY.md](QUALITY.md), `lib/queue/`, `.agents/learnings/` | `npm run agent -- context recovery` |

Do not read every linked document by default. Open deeper references only when the task requires them.

## Operating loop

1. Inspect `git status`, `npm run agent`, and `.agents/BOARD.md` before substantial writes.
2. For launch, heartbeat, or blocker judgment, run `npm run agent:heartbeat -- --json` and treat the packet as source of truth.
3. Identify the canonical source and existing implementation pattern.
4. Make the smallest coherent change that achieves the user outcome.
5. Run `npm run agent -- verify --dry-run`, then the selected checks.
6. Verify real behavior and artifacts, not only exit codes.
7. Record durable discoveries in `.agents/learnings/`. Prefer prevention in tests, types, scripts, or CI.

Commands: `npm run agent`, `npm run agent -- context <area>`, `npm run agent -- verify`, `npm run agent:heartbeat`. Full catalog: [DEVELOPMENT.md](DEVELOPMENT.md).

## Critical product invariants

- Keep **SHIPPED / NEXT / VISION** separate. Never claim vision-layer capabilities as shipped.
- Never inject unsolicited prompts into users' AI tools. Verification is a fresh independent evaluation.
- Decision filter: a major feature must improve understanding of a product or make that understanding more useful.
- Marketing copy lives in `lib/marketing/copy.ts`. Do not hardcode it in components.
- Site health requires explicit coverage, scope and freshness. No Flags does not mean untested behavior is healthy. Use [knowledge/evidence-rules.md](knowledge/evidence-rules.md).
- Customer loop language lives in `lib/marketing/copy/terminology.ts`. Change public claims only with corresponding behavior; roadmap capabilities are not shipped.
- Legacy report compatibility: one anonymous teaser scan. Evidence and deterministic Agent updates stay visible; fix prompts, interactive Agent, and Timeline stay gated until claim. Do not persist signup-gate strings as evidence or fix text.
- Auth lands on `/post-login` so anonymous audits are claimed before checkout or `next` navigation.
- Real product output is the proof surface. No invented testimonials, member counts, or fake reports.
- Visible language: [SOUL.md](SOUL.md) and [docs/voice-and-copy.md](docs/voice-and-copy.md). No em dashes or banned marketing filler.

## Critical architecture invariants

- Audit stages: QUEUED → CAPTURING → CHECKING → JUDGING → FINALIZING → COMPLETED.
- Checks register through `lib/audit/checks/index.ts`; identities live in `lib/audit/check-ids.ts`.
- Playwright is the audit browser. Do not reintroduce Puppeteer or chrome-devtools-mcp on the scan path.
- Journey and network evidence must survive persistence attached to the originating source.
- Legacy manual re-check is a fresh full capture that diffs against its parent. Target Verify fix must freshly exercise the relevant behavior and prove recovery; absence alone cannot resolve a Flag.
- Public graph reads go through `lib/graph/queries.ts`. Prisma Site/Page are global graph models, not the private customer Site; preserve tenant isolation.
- Edge middleware must not import Prisma or Node-only modules.
- Shared legacy report behavior belongs in existing audit/report utilities. New Site behavior belongs in a coherent domain/application boundary, not duplicate report and Shopify projections.
- Check-to-plan and re-check-to-diff live in `lib/audit/task-contracts.ts`.
- Public Review HTTP: `/api/checks` and `/api/reports/[id]/*`. Product Signals: `/api/products/[id]/signals`. No `/api/audits` compatibility routes.
- Do not keep off-by-default feature flags for unused code. Parked power-tools stay undiscoverable, not env-gated.

## AI, security, and git

- OpenAI is primary and Anthropic is fallback unless the judge config says otherwise.
- Keep stable system prompts separate from request-specific user content.
- Never commit secrets. See [SECURITY.md](SECURITY.md) before auth, billing, sharing, webhook, encryption, or middleware changes.
- Work on `main`. Claim a non-overlapping scope on `.agents/BOARD.md`. Preserve other agents' working-tree changes.
- Goal-session tracking: [`.agents/README.md`](.agents/README.md) and `.agents/GOAL.md.example`.

## Definition of done

- The change matches the user outcome and canonical product intent.
- Release or blocker claims cite `.agents/sessions/*` and heartbeat packet output.
- `npm run agent -- verify` or an explicitly justified equivalent passed.
- Behavior was exercised through its real path. Uncertainty is reported honestly.

## Canonical map

| Question | Source |
|----------|--------|
| What is implemented today? | [PRODUCT.md](PRODUCT.md) |
| Why and for whom? | [knowledge/vision.md](knowledge/vision.md), [SOUL.md](SOUL.md) |
| Where is code? | [CODEMAP.md](CODEMAP.md) |
| How does the system work? | [ARCHITECTURE.md](ARCHITECTURE.md), [docs/audit-pipeline.md](docs/audit-pipeline.md) |
| How should it look and sound? | [DESIGN.md](DESIGN.md), [docs/voice-and-copy.md](docs/voice-and-copy.md) |
| How is correctness verified? | [QUALITY.md](QUALITY.md) |
| What is safe? | [SECURITY.md](SECURITY.md) |
| What should happen next? | [ROADMAP.md](ROADMAP.md), [knowledge/execution.md](knowledge/execution.md) |
| Where does a fact belong? | [CANONICAL-SOURCES.md](CANONICAL-SOURCES.md) |
| How does knowledge evolve? | [EVOLUTION-RULES.md](EVOLUTION-RULES.md) |
