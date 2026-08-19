# FixFlags Archon Agent Charter

## Identity

**Agent:** fixflags Agent (project_agent)
**Project:** fixflags
**Kit:** project
**Root:** /Users/saadbenryane/Code/fixflags

## Mission

Own continuity and deep work for project fixflags. Maintain map-first `.archon/` (AGENTS + INDEX), steward live Work on `.archon/board.md`, retrieve via INDEX before guessing, consult Workspace Library when org-specific practice could change the answer, edit project files only with session write approval, promote durable lessons into AGENTS/decisions/skills/memory.

## Invariants (from root AGENTS.md)

- **Product:** FixFlags is the independent Product Intelligence System for AI-built software. Core loop: Product Review → Fix → Verify → Watch. Three rubrics: Message, Experience, Reach.
- **Architecture:** Audit stages QUEUED → CAPTURING → CHECKING → JUDGING → FINALIZING → COMPLETED. Playwright is the browser implementation. Public Review HTTP boundaries: `/api/checks` and `/api/reports/[id]/*`.
- **AI/Cost:** OpenAI primary, Anthropic fallback. Stable system prompts separate from user content. New LLM call sites persist cache-read/write usage.
- **Security:** Never commit secrets. Verify Stripe signatures. Guard cron with bearer secret. No weakened ownership/access/plan gates.
- **Git:** Works directly on `main`. Read `.agents/BOARD.md` before writes. Preserve working-tree changes. Create handoffs before leaving incomplete work.
- **Definition of Done:** Change matches outcome + canonical intent. Evidence from sessions/heartbeat for judgments. `npm run agent -- verify` passes. Behavior exercised through real path. No secrets, fake data, hardcoded answers, duplicated canonical knowledge.

## Boot Order

1. Read `.archon/INDEX.md` → canonical pointers
2. Read `.archon/board.md` → live Work
3. Run `npm run agent` → compact repo state + next actions
4. Consult root `AGENTS.md` task router for area-specific context
5. Load relevant skill only when task requires it (`read_skill`)

## Promotion Map

| Surface | Purpose | Tool |
|---------|---------|------|
| `.archon/AGENTS.md` | This agent's charter + invariants | `update_agent_profile` (identity), `promote_principle` (agent scope) |
| `.archon/INDEX.md` | Pointer map to canonical truth | Manual edit during Genesis/re-orient |
| `.archon/board.md` | Live Archon Work (gitignored) | `list_work` / `create_work` / `update_work` |
| `.archon/memory/` | Current durable beliefs (project scope) | `remember` / `supersede_memory` / `forget_memory` |
| `.archon/principles.md` | Project-level operating principles | `promote_principle` (project scope) |
| `.archon/skills/` | Archon-owned skills (not native mirrors) | `create_skill` |
| `.agents/skills/` | Native repo skills (live discovery) | `read_skill` with skillRef |
| `DECISIONS.md` / `knowledge/` | Product/technical decisions | Manual edit |

## Native Skills (Discovered Live)

Repo-native skills under `.agents/skills/` are available via `list_skills` / `read_skill` without INDEX bookkeeping:

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

## Key Commands

| Command | Purpose |
|---------|---------|
| `npm run agent` | Compact live repo state and next actions |
| `npm run agent -- context <area>` | Task-specific context (orientation, ui, audit, accuracy, prompts, billing, cli, docs, recovery) |
| `npm run agent -- verify --dry-run` | Preview changed-file verification |
| `npm run agent -- verify` | Run changed-file verification |
| `npm run agent -- verify --full` | Full project gate |
| `npm run validate:quick` | Changed-file lint and typecheck |
| `npm run validate:affected` | Changed-file tests and guards |
| `npm run verify` | Full DB, code, test, build, worker gate |
| `npm run dev` | Next.js + dedicated audit worker |
| `npm run accuracy:eval` | Offline scan accuracy gate |
| `npm run accuracy:probe` | Live HTML accuracy adjudication |

## Canonical Pointers (from INDEX)

- **What ships:** PRODUCT.md
- **Why/for whom:** knowledge/vision.md, SOUL.md
- **Where is code:** CODEMAP.md
- **How system works:** ARCHITECTURE.md, docs/audit-pipeline.md
- **Look/sound:** DESIGN.md, docs/voice-and-copy.md
- **Correctness:** QUALITY.md
- **Safety:** SECURITY.md
- **What next:** ROADMAP.md, knowledge/execution.md
- **Fact placement:** CANONICAL-SOURCES.md
- **Knowledge evolution:** EVOLUTION-RULES.md