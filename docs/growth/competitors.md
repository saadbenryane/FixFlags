# Competitors

Who else ranks for FixFlags-relevant queries, their moats, our wedges.

Canonical market summary: [`knowledge/market.md`](../../knowledge/market.md). Moat strategy: [`knowledge/product.md`](../../knowledge/product.md).

## Direct competitors (AI-built product QA)

| Tool | What they do | Their moat | Our wedge |
|---|---|---|---|
| **Scout QA** | AI quality companion for vibe-coded products. Live agent chat, click-through testing, traffic-light ratings, fix prompts, regression tracking, Lovable workflows | Spectacle: watch an agent use your app; scheduling / follow-up chat | Precise Flags + editor-ready repair contracts + free unlimited re-check proof. Do **not** clone their chat agent. |
| **Signo** | Paste deployed app; agent navigates desktop/mobile; launch-readiness score; Claude Code prompts | URL-first autonomous browse | Same table stakes (paste URL). Win on Flag quality, truth labels, and verified repair loop. |
| **PageLens** | Adjacent URL-first testing | Broader autonomous-testing footprint | Stay in AI-builder Launch Check wedge; progressive depth for agencies. |

URL-first autonomous testing is crowded. Paste-URL is **not** a moat.

## Adjacent categories

| Category | Examples | Why adjacent |
|---|---|---|
| General website audit / SEO | Ahrefs, Semrush, Screaming Frog | Broad SEO, not ship-ready for AI-built apps |
| Accessibility checkers | axe, WAVE, Lighthouse, Pa11y | Single dimension; no AI-editor fix prompts |
| Performance tools | PageSpeed Insights, GTmetrix | Performance only |
| AI code review | CodeRabbit, Greptile | Code-level, not live-site QA |
| Autonomous test platforms | Momentic, Checkly, Mabl, Virtuoso | Compete on test-case generation; we do not |

## Positioning matrix (honest)

| Dimension | Scout QA | Generic SEO / a11y | FixFlags |
|---|---|---|---|
| AI-built product focus | Yes | No | Yes |
| Live agent chat / free-form explore | Yes | No | **No** (structured action timeline instead) |
| Multi-rubric (Message + Experience + Reach) | Partial | No | Yes |
| Screenshot / step evidence | Yes | Rare | Yes |
| Fix prompts for AI editors | Yes | No | Yes (core product) |
| Flag → Fix → Re-check proof | Partial | Manual | **Yes** (re-checks free/unlimited) |
| Recurring scheduling | Yes | Manual | **Not shipped** (Roadmap Next) |
| MCP in Cursor / Claude | Partial | No | Yes |
| Product Contract (intent layer) | No | No | Shipping (moat) |

## Our wedge (restated)

1. **Which failure matters** — Product Contract + ranked Top Priorities, not a letter grade dump.
2. **Precise repair contracts** — evidence + expected behavior + verification, rendered as Cursor/Claude/Lovable/Bolt prompts and MCP.
3. **Verified outcomes** — re-check with parent diff; cleared Flags are the proof.
4. **Truth labels** — Reproduced / Detected / Observed on every Flag (credibility vs agent spectacle false positives).

Anti-pattern: building a Scout-style conversational QA agent on the audit path. Use action timeline + network/overlay probes + fix loop instead.

## Differentiation to emphasize in copy

1. **"Not a Lighthouse wrapper"** — Message, Experience, Reach with evidence and fix prompts.
2. **"Not a chat QA agent"** — Structured findings you can fix in your editor and prove with re-check.
3. **"Built for AI builders"** — Fix prompts and MCP for Cursor, Claude, Lovable, Bolt.
4. **"Real evidence, labeled truth"** — Screenshots, network status, journey steps; truth class on every Flag.
5. **"The loop closes"** — Flag → Fix → Re-check. Re-checks are free and unlimited on owned reports.

## Research hygiene

- SERP and community monitoring remain useful for distribution, not for inventing competitors (Scout/Signo/PageLens are confirmed).
- When comparing demos: script Flag → fix in Cursor → re-check. Do not compete on "watch the agent click around."
