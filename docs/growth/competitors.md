# Competitors

Who else ranks for FixFlags-relevant queries, their moats, our wedges. Not
yet researched in depth — this file is scaffolded for the first real
competitive pass (Phase 2).

## Adjacent categories (not direct competitors, but occupy nearby search intent)

| Category | Examples | Why they're adjacent, not direct |
|---|---|---|
| General website audit / SEO tools | Ahrefs, Semrush, Screaming Frog | Broad SEO focus, not AI-built-product-specific, not opinionated about "is this ready to ship" |
| Accessibility checkers | axe, WAVE, Lighthouse | Single-dimension (accessibility only), no fix-prompt output for AI editors |
| Performance tools | PageSpeed Insights, GTmetrix | Single-dimension (performance only) |
| AI code review tools | CodeRabbit, Greptile | Code-level review, not live-site / user-facing QA |
| Landing page critique communities | r/SaaS feedback threads, Twitter "roast my landing page" | Human-driven, not systematic or repeatable, no structured data |

## Direct competitive question (unresolved)

Is there a tool that specifically targets **"I built this with an AI tool
(Lovable/Cursor/Bolt/v0), is it actually ready to ship"**? As of this
writing we have not done a rigorous SERP pass to confirm. This is the single
most important research task before committing to programmatic-page scale —
see `backlog.md`.

## Research plan (Phase 2)

1. SERP research for: "AI website audit", "landing page audit tool",
   "[builder name] site checker", "is my AI-built site ready", "AI slop
   detector"
2. For each ranking result: what's their moat (data? brand? backlinks?
   distribution?) and what's our wedge (we run real audits with evidence;
   most competitors are generic checklists or single-dimension tools)
3. Backlink analysis of top 3 competitors per query cluster — informs
   `backlog.md` backlink-tooling decision

## Our wedge, restated

FixFlags' moat candidate, if the graph compounds as designed: **real audit
data across many AI-built sites, aggregated into frequency statistics no
generic SEO tool has**, plus **tool-specific fix prompts** (cursor/claude/
lovable/bolt) that generic auditors don't produce. This is unproven until
Phase 2/3 populate the graph and the public pages go live — track outcome in
`experiments.md`.
