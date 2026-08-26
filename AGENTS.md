# FixFlags agent guide

Canonical entry point for AI agents. Load detailed context only for the task at hand.

Start with `npm run agent`. Use `npm run agent -- context <area>` for focused files, invariants, commands, and next steps.

PiWeb is the session interface for this repository. Product work happens here. See [`.agents/README.md`](.agents/README.md) for coordination, PiWeb routing, and skills.

## Product

FixFlags is the independent Product Intelligence System for AI-built software. A user submits a URL and receives a Fix list across Message, Experience, and Reach, with fix prompts for their AI editor.

- Customer loop: **Product Review → Fix → Verify → Watch**. Internal loop: Observe → Understand → Judge → Improve → Verify → Learn ([knowledge/vision.md](knowledge/vision.md)).
- Report hierarchy: [knowledge/report-contract.md](knowledge/report-contract.md). Do not duplicate route or section order in skills.
- Plans meter completed product reviews (first reviews, update reviews, scheduled Studio reviews) against one monthly pool.
- Customer copy uses **update review**; internal routes may still use `re-check`.
- Stage: pre-revenue testing. Distribution has priority over additional product depth.
- Shipped truth: [PRODUCT.md](PRODUCT.md). Vocabulary: [knowledge/README.md](knowledge/README.md).

## Task router

| Area | Start here | Agent command |
|------|------------|---------------|
| Repository orientation | [CODEMAP.md](CODEMAP.md), [ROADMAP.md](ROADMAP.md) | `npm run agent -- context orientation` |
| Report or application UI | [DESIGN.md](DESIGN.md), [knowledge/report-contract.md](knowledge/report-contract.md), `components/audit/`, `components/report/` | `npm run agent -- context ui` |
| Report hierarchy or sharing | [knowledge/report-contract.md](knowledge/report-contract.md), [SECURITY.md](SECURITY.md) | `npm run agent -- context ui` |
| First-value / anon dogfood | [PRODUCT.md](PRODUCT.md), [knowledge/report-contract.md](knowledge/report-contract.md) | `npm run agent -- context ui` |
| Audit pipeline and checks | [docs/audit-pipeline.md](docs/audit-pipeline.md), `lib/audit/` | `npm run agent -- context audit` |
| Browser capture (Playwright) | [`.agents/skills/fixflags-browser-capture/SKILL.md`](.agents/skills/fixflags-browser-capture/SKILL.md), `lib/audit/screenshot.ts` | `npm run agent -- context audit` |
| Scan accuracy and fixtures | `lib/audit/accuracy-corpus.ts`, [`.agents/skills/fixflags-scan-accuracy/SKILL.md`](.agents/skills/fixflags-scan-accuracy/SKILL.md) | `npm run agent -- context accuracy` |
| AI prompts and models | `lib/prompts/system-prompt.ts`, `lib/audit/judge-config.ts` | `npm run agent -- context prompts` |
| Billing and entitlements | `lib/billing/`, `lib/auth/entitlements.ts` | `npm run agent -- context billing` |
| Parked CLI / MCP / repo-scan | `fixflags-cli/`, [`.agents/skills/fixflags-npm-operations/SKILL.md`](.agents/skills/fixflags-npm-operations/SKILL.md) | `npm run agent -- context cli` |
| Canonical knowledge | [CANONICAL-SOURCES.md](CANONICAL-SOURCES.md), [EVOLUTION-RULES.md](EVOLUTION-RULES.md) | `npm run agent -- context docs` |
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
- Exactly three report rubrics: Message, Experience, Reach.
- Customer loop language lives in `lib/marketing/copy/terminology.ts`. Deep Review is not a current plan feature.
- One anonymous teaser scan. Evidence and deterministic Agent updates stay visible; fix prompts, interactive Agent, and Timeline stay gated until claim. Do not persist signup-gate strings as evidence or fix text.
- Auth lands on `/post-login` so anonymous audits are claimed before checkout or `next` navigation.
- Real product output is the proof surface. No invented testimonials, member counts, or fake reports.
- Visible language: [SOUL.md](SOUL.md) and [docs/voice-and-copy.md](docs/voice-and-copy.md). No em dashes or banned marketing filler.

## Critical architecture invariants

- Audit stages: QUEUED → CAPTURING → CHECKING → JUDGING → FINALIZING → COMPLETED.
- Checks register through `lib/audit/checks/index.ts`; identities live in `lib/audit/check-ids.ts`.
- Playwright is the audit browser. Do not reintroduce Puppeteer or chrome-devtools-mcp on the scan path.
- Journey and network evidence must survive persistence attached to the originating source.
- Manual re-check is a fresh full capture that diffs against its parent.
- Public graph reads go through `lib/graph/queries.ts`.
- Edge middleware must not import Prisma or Node-only modules.
- Shared report behavior belongs in existing audit/report utilities.
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
| What ships today? | [PRODUCT.md](PRODUCT.md) |
| Why and for whom? | [knowledge/vision.md](knowledge/vision.md), [SOUL.md](SOUL.md) |
| Where is code? | [CODEMAP.md](CODEMAP.md) |
| How does the system work? | [ARCHITECTURE.md](ARCHITECTURE.md), [docs/audit-pipeline.md](docs/audit-pipeline.md) |
| How should it look and sound? | [DESIGN.md](DESIGN.md), [docs/voice-and-copy.md](docs/voice-and-copy.md) |
| How is correctness verified? | [QUALITY.md](QUALITY.md) |
| What is safe? | [SECURITY.md](SECURITY.md) |
| What should happen next? | [ROADMAP.md](ROADMAP.md), [knowledge/execution.md](knowledge/execution.md) |
| Where does a fact belong? | [CANONICAL-SOURCES.md](CANONICAL-SOURCES.md) |
| How does knowledge evolve? | [EVOLUTION-RULES.md](EVOLUTION-RULES.md) |
