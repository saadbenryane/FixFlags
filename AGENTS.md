# FixFlags agent guide

Canonical entry point for AI agents. Load detailed context only for the task at hand.

Start with `npm run agent`. Use `npm run agent -- context <area>` for focused files, invariants, commands, and next steps.

## Product

FixFlags is the independent Product Intelligence System for AI-built software. A user submits a URL and receives a Finish Plan across Message, Experience, and Reach, with fix prompts for their AI editor.

- Core loop: **Build → Review → Fix → Verify → Learn**.
- Canonical report hierarchy: [knowledge/report-contract.md](knowledge/report-contract.md). Do not duplicate route or section order in skills.
- Plans meter product reviews (new URLs and update reviews share the same credit pool). Customer copy uses **update review**; internal routes may still use `re-check`.
- Stage: pre-revenue testing. Distribution has priority over additional product depth.
- Shipped truth: [PRODUCT.md](PRODUCT.md). North star: [knowledge/vision.md](knowledge/vision.md).
- Product and technical vocabulary: [knowledge/README.md](knowledge/README.md).

## Task router

| Area | Start here | Agent command |
|------|------------|---------------|
| Repository orientation | [CODEMAP.md](CODEMAP.md), [ROADMAP.md](ROADMAP.md) | `npm run agent -- context orientation` |
| Report or application UI | [DESIGN.md](DESIGN.md), `components/audit/`, `components/report/` | `npm run agent -- context ui` |
| Report hierarchy or sharing | [knowledge/report-contract.md](knowledge/report-contract.md), [SECURITY.md](SECURITY.md) | `npm run agent -- context ui` |
| First-value / anon dogfood | [`.agents/sessions/customer-journey-completion-plan.md`](.agents/sessions/customer-journey-completion-plan.md), [PRODUCT.md](PRODUCT.md) | `npm run agent -- context ui` |
| Audit pipeline and checks | [docs/audit-pipeline.md](docs/audit-pipeline.md), `lib/audit/` | `npm run agent -- context audit` |
| Browser capture (Playwright) | [`.agents/skills/fixflags-browser-capture/SKILL.md`](.agents/skills/fixflags-browser-capture/SKILL.md), `lib/audit/screenshot.ts` | `npm run agent -- context audit` |
| Scan accuracy and fixtures | [`.agents/sessions/launch-readiness-completion-plan.md`](.agents/sessions/launch-readiness-completion-plan.md), `lib/audit/accuracy-corpus.ts`, [`.agents/skills/fixflags-scan-accuracy/SKILL.md`](.agents/skills/fixflags-scan-accuracy/SKILL.md), [`.agents/skills/fixflags-dogfood-accuracy/SKILL.md`](.agents/skills/fixflags-dogfood-accuracy/SKILL.md) | `npm run agent -- context accuracy` |
| AI prompts and models | `lib/prompts/system-prompt.ts`, `lib/audit/judge-config.ts` | `npm run agent -- context prompts` |
| Billing and entitlements | `lib/billing/`, `lib/auth/entitlements.ts` | `npm run agent -- context billing` |
| Public CLI | `fixflags-cli/`, [`.agents/skills/fixflags-npm-operations/SKILL.md`](.agents/skills/fixflags-npm-operations/SKILL.md) | `npm run agent -- context cli` |
| Canonical knowledge | [CANONICAL-SOURCES.md](CANONICAL-SOURCES.md), [EVOLUTION-RULES.md](EVOLUTION-RULES.md) | `npm run agent -- context docs` |
| Failures and recovery | [QUALITY.md](QUALITY.md), `lib/queue/`, `.agents/learnings/` | `npm run agent -- context recovery` |

Do not read every linked document by default. Follow the task router and open deeper references only when the task requires them.

## Operating loop

1. Inspect `git status`, `npm run agent`, and `.agents/BOARD.md` before substantial writes.
2. Identify the canonical source and existing implementation pattern.
3. Make the smallest coherent change that achieves the user outcome.
4. Run `npm run agent -- verify --dry-run` to select the appropriate checks.
5. Verify the actual behavior and inspect artifacts, not only exit codes.
6. Record durable, evidence-backed discoveries in `.agents/learnings/`; prefer prevention in tests, types, scripts, or CI.
7. Report what changed, what passed, and what was not verified.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run agent` | Compact live repository state and next actions |
| `npm run agent -- context <area>` | Task-specific context |
| `npm run agent -- verify --dry-run` | Preview changed-file verification |
| `npm run agent -- verify` | Run changed-file verification with bounded output |
| `npm run agent -- verify --full` | Run the full project gate |
| `npm run agent -- eval <area>` | Run a focused real evaluation |
| `npm run agent -- learn` | List validated project learnings |
| `npm run validate:quick` | Changed-file lint and typecheck |
| `npm run validate:affected` | Changed-file tests and guards |
| `npm run verify` | Full DB, code, test, build, and worker gate |
| `npm run accuracy:eval` | Offline scan accuracy gate (HTML corpus + demo repair + non-HTML) |
| `npm run accuracy:probe` | Live HTML accuracy adjudication for real URLs |
| `npm run dev` | Next.js application |
| `npm run dev:all` | Application and separate worker |

See [DEVELOPMENT.md](DEVELOPMENT.md) for setup, databases, deployment, and debugging.

## Critical product invariants

- Marketing copy has one source of truth: `lib/marketing/copy.ts`. Do not hardcode it in components.
- The product exposes exactly three report rubrics: Message, Experience, Reach.
- Customer-facing loop language lives in `lib/marketing/copy/terminology.ts`: product review, update review, deep review, Funnel, path. Internal code may still use `re-check`, `recheck`, and `monitoring` routes and analytics names.
- The anonymous wedge is one teaser scan. Evidence stays visible on the Finish Plan; exactly one complete demonstrated fix prompt is shown; remaining prompts stay gated until claim. Public APIs must not leak gated prompts. Do not persist signup-gate strings as evidence or fix text.
- Authentication flows land on `/post-login` so anonymous audits are claimed before checkout or `next` navigation.
- Real product output is the proof surface. Do not invent testimonials, member counts, fake reports, or unsupported product claims.
- Follow [SOUL.md](SOUL.md) and [docs/voice-and-copy.md](docs/voice-and-copy.md) for visible language. No em dashes or banned marketing filler.

## Critical architecture invariants

- Audit stages: QUEUED → CAPTURING → CHECKING → JUDGING → FINALIZING → COMPLETED.
- Deterministic checks register through `lib/audit/checks/index.ts`; check identities live in `lib/audit/check-ids.ts`.
- Playwright is the browser implementation on the audit path. Do not reintroduce Puppeteer or adopt chrome-devtools-mcp / chrome-devtools-axi for scans. AXI principles apply to agent-facing CLI/MCP tooling (`fixflags-cli/`, `lib/mcp/tools.ts`), not the audit capture pipeline.
- Journey and network evidence must survive persistence and remain attached to the originating source.
- Manual re-check always performs a fresh full capture and diffs against its parent.
- Public graph reads go through `lib/graph/queries.ts`.
- Edge middleware must not import Prisma or Node-only modules.
- Shared report behavior belongs in existing audit/report utilities, not duplicated component logic.
- Check-to-plan and re-check-to-diff behavior belongs in `lib/audit/task-contracts.ts`; transports call one task-shaped outcome.
- Public HTTP boundaries are `/api/checks` and `/api/reports/[id]/*`. Do not add `/api/audits` compatibility routes.
- Do not keep off-by-default feature flags for unproven or unused code. If a feature is not wired into a product surface and has not shipped, remove it entirely rather than gating it behind a `USE_*` env flag. Re-add only when product need is demonstrated.

Full pipeline behavior and report composition live in [docs/audit-pipeline.md](docs/audit-pipeline.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [DESIGN.md](DESIGN.md).

## AI and cost invariants

- OpenAI is primary and Anthropic is fallback unless the canonical judge configuration says otherwise.
- Keep stable system prompts separate from request-specific user content. Mixing page data into the system block breaks prompt-cache reuse.
- Keep model identifiers, provider health checks, and `MODEL_RATES` synchronized.
- New LLM call sites must persist cache-read and cache-write usage when the provider reports it.
- An LLM may interpret evidence but must not replace deterministic product, billing, or access-control truth.

## Security

- Never commit `.env`, credentials, tokens, or secrets.
- Verify Stripe signatures and guard cron endpoints with their configured bearer secret.
- Store GitHub tokens encrypted and API keys hashed.
- Do not weaken ownership, report-access, anonymous-prompt, or plan gates for test convenience.
- See [SECURITY.md](SECURITY.md) before authentication, billing, sharing, webhook, encryption, or middleware changes.

## Git and coordination

FixFlags currently works directly on `main`.

1. Read `.agents/BOARD.md` before substantial writes and claim a non-overlapping scope.
2. Do not create branches or worktrees unless the user explicitly asks.
3. Preserve all existing working-tree changes. Never reset, clean, stash, overwrite, or discard another task's work.
4. Read-only research may run concurrently. One owner controls each write scope.
5. Create `.agents/handoffs/<task-id>.md` before leaving meaningful work incomplete.
6. Use `.agents/sessions/` for substantial implementation or durable decisions, not transcripts or exhaustive command logs.

## Token efficiency

The agent's cost is dominated by reading, not writing. Optimize every turn for context budget:

- **Output filtering:** Strip tool output to signal. A passing test suite returns `PASS`, not 800 lines. A build log returns the error line, not the full log. Every excess token rebills on every subsequent turn.
- **Skeleton before body:** Load signatures, types, and exports first when exploring a module. Load implementation bodies only when needed for the change.
- **Subagent dispatch:** Break complex multi-file changes into independent subagents. Each subagent gets a fresh, isolated context. Use the `task` tool with `subagent_type: "general"` for each subtask. Review spec compliance first, code quality second.
- **Skill loading:** Load only the skill relevant to the task. Do not pre-load every skill. Skills in `.agents/skills/` are available via the `skill` tool.
- **Prompt-cache discipline:** Keep this file and all skill content stable across a session. Do not edit system-level instructions mid-turn — that busts the cache.

## Definition of done

- The change matches the user outcome and canonical product intent.
- Relevant code, docs, current Git state, and task ownership were inspected.
- `npm run agent -- verify` or an explicitly justified equivalent passed.
- Behavior was exercised through its real path, including loading, empty, error, and responsive states when applicable.
- No secrets, fake data, hardcoded answers, or duplicated canonical knowledge were introduced.
- New project facts were generated or measured rather than guessed.
- Uncertainty and incomplete verification are reported honestly.

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
