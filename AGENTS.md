# FixFlags agent guide

Canonical entry point for AI agents. Load detailed context only for the task at hand.

Start with `npm run agent`. Use `npm run agent -- context <area>` for focused files, invariants, commands, and next steps.

## Product

FixFlags is the independent Product Intelligence System for AI-built software. A user submits a URL and receives a Fix list across Message, Experience, and Reach, with fix prompts for their AI editor.

- Core loop: **Product Review → Fix → Verify → Watch** (customer wedge; internal canonical loop: Observe → Understand → Judge → Improve → Verify → Learn, [knowledge/vision.md](knowledge/vision.md)).
- Canonical report hierarchy: [knowledge/report-contract.md](knowledge/report-contract.md). Do not duplicate route or section order in skills.
- Plans meter completed product reviews from first reviews, update reviews, and scheduled Studio reviews against the same monthly pool.
- Customer copy uses **update review**; internal routes may still use `re-check`.
- Stage: pre-revenue testing. Distribution has priority over additional product depth.
- Shipped truth: [PRODUCT.md](PRODUCT.md). North star and canonical loop: [knowledge/vision.md](knowledge/vision.md) (Observe → Understand → Judge → Improve → Verify → Learn; customer loop Product Review → Fix → Verify → Watch).
- Product and technical vocabulary: [knowledge/README.md](knowledge/README.md).

## Interface Layer Clarification

**Critical system architecture principle:** 
1. PiWeb (/Users/saadbenryane/Code/pi-web) is the **interface layer** used to manage agent sessions and development workflows. It is maintained via FirstMate for interface-related concerns.
2. FixFlags (/Users/saadbenryane/Code/fixflags) is the **actual product** being developed and maintained.
3. When working in PiWeb:
   - Interface/session management issues → Route through FirstMate
   - Product development work → Focus on FixFlags repository
4. All agent activity in PiWeb serves FixFlags development - there is no separate "FixedFlex" entity.

- For PiWeb interface/session issues: Contact FirstMate
- For FixFlags product development: Work directly in this repository
- The agent's purpose is FixFlags product advancement via PiWeb interface

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
| Product PRD and workspace UI | [docs/product-prd.md](docs/product-prd.md), [docs/workspace-interface.md](docs/workspace-interface.md) | `npm run agent -- context docs` |
| Failures and recovery | [QUALITY.md](QUALITY.md), `lib/queue/`, `.agents/learnings/` | `npm run agent -- context recovery` |

Do not read every linked document by default. Follow the task router and open deeper references only when the task requires them.

## Operating loop

1. Inspect `git status`, `npm run agent`, and `.agents/BOARD.md` before substantial writes.
2. For any product judgment (launch/weekly heartbeat/blockers), run `npm run agent:heartbeat -- --json` and treat the packet as source of truth.
3. Spawn and wait for a worker report in `.agents/sessions/` before finalizing blocker or release conclusions.
4. Identify the canonical source and existing implementation pattern.
5. Make the smallest coherent change that achieves the user outcome.
6. Run `npm run agent -- verify --dry-run` to select the appropriate checks.
7. Verify the actual behavior and inspect artifacts, not only exit codes.
8. Record durable, evidence-backed discoveries in `.agents/learnings/`; prefer prevention in tests, types, scripts, or CI.
9. Report what changed, what passed, and what was not verified.

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
| `npm run agent:heartbeat` | Board/goals signal summary |
| `npm run agent:release-continuity` | Runtime + CLI/MCP + cloud continuity pulse (plan mode by default) |
| `npm run validate:quick` | Changed-file lint and typecheck |
| `npm run validate:affected` | Changed-file tests and guards |
| `npm run verify` | Full DB, code, test, build, and worker gate |
| `npm run accuracy:eval` | Offline scan accuracy gate (HTML corpus + demo repair + non-HTML) |
| `npm run accuracy:probe` | Live HTML accuracy adjudication for real URLs |
| `npm run dev` | Next.js application |
| `npm run dev:all` | Application and separate worker |

See [DEVELOPMENT.md](DEVELOPMENT.md) for setup, databases, deployment, and debugging.

## Critical product invariants

- A review is an observation of the Product at a moment in time; the Product is the long-term object ([knowledge/vision.md](knowledge/vision.md)). Keep **SHIPPED / NEXT / VISION** separate — never claim vision-layer capabilities (Product Graph, global intelligence, "Fix it for me", multi-signal Flags) as shipped in product copy, docs, or reports.
- FixFlags independence: never inject unsolicited prompts into users' Cursor, Claude Code, Lovable, or other AI tools; users control how fixes happen. Verification must be a fresh independent evaluation — the system that creates a change never declares its own work correct.
- Decision filter: every major feature must improve understanding of a product or make that understanding more useful in improving it; otherwise question why it is being built.
- Marketing copy has one source of truth: `lib/marketing/copy.ts`. Do not hardcode it in components.
- The product exposes exactly three report rubrics: Message, Experience, Reach.
- Customer-facing loop language lives in `lib/marketing/copy/terminology.ts`: product review, update review, Funnel, path. Internal code may still use `re-check`, `recheck`, and `monitoring` routes and analytics names. Deep Review is reserved for the future repository-connected analysis offer and is not a current plan feature or URL-review tier.
- The anonymous wedge is one teaser scan. Evidence and deterministic Agent updates stay visible; every fix prompt, interactive Agent request, and Timeline payload stays gated until claim. Public APIs must not leak gated prompts or playback data. Do not persist signup-gate strings as evidence or fix text.
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
- Public Review HTTP boundaries are `/api/checks` and `/api/reports/[id]/*`; privacy-bounded Product Signal ingestion is `/api/products/[id]/signals`. Do not add `/api/audits` compatibility routes or generic event APIs.
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

## Goal sessions

When working toward a multi-step outcome ("Game On" runs, completion plans), track it persistently:

- **State:** the active goal lives in `.agents/GOAL.md` (gitignored): Condition, Proof commands, Constraints, turn Bound, and a **Turn log** (Turn | Work summary | Proof run | Verdict MET/PARTIAL/NOT MET | Reason).
- **Detail:** the executable spec lives in `GOAL_BRIEF.md` (repo root) or a session doc; `.agents/GOAL.md` points at it.
- **Discipline:** every turn records its proof run and an honest verdict. Append to **Achieved** only when every proof passes. Verdicts stay honest: NOT MET until the condition is truly met.
- Template: `.agents/GOAL.md.example`.

## Operating discipline

- Never auto-add your agent name as a commit co-author.
- Never manually modify auto-generated files (generated docs, lockfiles, guard reports). Fix the generator instead.
- Long Markdown files: put each full sentence on its own line. Preserve normal Markdown structure, but avoid wrapping multiple sentences onto one physical line.
- Technical decisions weigh quality, simplicity, robustness, and long-term maintainability over development cost.
- Bug fixes start by reproducing the bug through the real path (E2E / browser) as the end user experiences it, then fix the real problem.
- When testing the product, be picky and pixel-perfect. If something clearly looks off, even unrelated to the current change, fix it along the way.
- Apply the same standard to engineering excellence: if you see a lint failure, test failure, or flake, fix it even if it is not caused by your current work.
- Operator communication in plain English first; codes, UUIDs, and jargon only as footnotes.

## Token efficiency

The agent's cost is dominated by reading, not writing. Optimize every turn for context budget:

- **Output filtering:** Strip tool output to signal. A passing test suite returns `PASS`, not 800 lines. A build log returns the error line, not the full log. Every excess token rebills on every subsequent turn.
- **Skeleton before body:** Load signatures, types, and exports first when exploring a module. Load implementation bodies only when needed for the change.
- **Subagent dispatch:** Break complex multi-file changes into independent subagents. Each subagent gets a fresh, isolated context. Use the `task` tool with `subagent_type: "general"` for each subtask. Review spec compliance first, code quality second.
- **Skill loading:** Load only the skill relevant to the task. Do not pre-load every skill. Skills in `.agents/skills/` are available via the `skill` tool.
- **Prompt-cache discipline:** Keep this file and all skill content stable across a session. Do not edit system-level instructions mid-turn — that busts the cache.

## Definition of done

- The change matches the user outcome and canonical product intent.
- For release/blocker/judgment statements, include evidence from `.agents/sessions/*` and `scripts/agent-heartbeat.mjs` packet output; avoid inference without evidence.
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
