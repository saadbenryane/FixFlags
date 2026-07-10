# Competitors

Who else ranks for FixFlags-relevant queries, their moats, our wedges.

## Competitive landscape

### Direct competitors (AI-built product QA)

| Tool | What they do | Their moat | Our wedge |
|---|---|---|---|
| **Unknown** (TBD via SERP research) | We have not yet confirmed a direct "AI-built site QA" competitor exists | — | First-mover in category if none exists |

**Key question (unresolved):** Is there a tool that specifically targets
**"I built this with an AI tool (Lovable/Cursor/Bolt/v0), is it actually
ready to ship"**? As of this writing we have not done a rigorous SERP pass
to confirm. This is the single most important research task before committing
to programmatic-page scale — see `backlog.md`.

### Adjacent categories (not direct competitors, but occupy nearby search intent)

| Category | Examples | Why they're adjacent, not direct |
|---|---|---|
| General website audit / SEO tools | Ahrefs, Semrush, Screaming Frog, Sitebulb | Broad SEO focus, not AI-built-product-specific, not opinionated about "is this ready to ship" |
| Accessibility checkers | axe, WAVE, Lighthouse, Pa11y | Single-dimension (accessibility only), no fix-prompt output for AI editors |
| Performance tools | PageSpeed Insights, GTmetrix, WebPageTest | Single-dimension (performance only) |
| AI code review tools | CodeRabbit, Greptile, CodeReview | Code-level review, not live-site / user-facing QA |
| Landing page critique communities | r/SaaS feedback threads, Twitter "roast my landing page" | Human-driven, not systematic or repeatable, no structured data |
| OG/social preview checkers | opengraph.xyz, metatags.io | Single-dimension (social preview only), no fix prompts, no audit pipeline |
| Linting / code quality | ESLint, Prettier, SonarQube | Code-level, not user-facing QA |

### Competitive positioning matrix

| Dimension | Generic SEO tools | Accessibility tools | FixFlags |
|---|---|---|---|
| AI-built product focus | No | No | Yes |
| Multi-rubric (Message + Experience + Reach) | No | No | Yes |
| Screenshot-based evidence | No | No | Yes |
| Fix prompts for AI editors | No | No | Yes |
| Monitoring loop | Manual | No | Built-in |
| MCP integration | No | No | Yes |
| Builder-specific prompts | No | No | Yes (Cursor, Claude, Lovable, Bolt) |

## Our wedge (restated)

FixFlags' moat candidate, if the graph compounds as designed: **real audit
data across many AI-built sites, aggregated into frequency statistics no
generic SEO tool has**, plus **tool-specific fix prompts** (cursor/claude/
lovable/bolt) that generic auditors don't produce. This is unproven until
Phase 2/3 populate the graph and the public pages go live — track outcome in
`experiments.md`.

## Research plan (Phase 2 — first priority in competitors track)

1. **SERP research** for target query clusters:
   - "AI website audit"
   - "landing page audit tool"
   - "[builder name] site checker" (lovable, bolt, cursor, v0)
   - "is my AI-built site ready"
   - "AI slop detector"
   - "open graph preview checker"
   - "website QA tool"

2. **For each ranking result:** what's their moat (data? brand? backlinks?
   distribution?) and what's our wedge (we run real audits with evidence;
   most competitors are generic checklists or single-dimension tools)

3. **Backlink analysis** of top 3 competitors per query cluster — informs
   `backlog.md` backlink-tooling decision

4. **Community monitoring** (Reddit r/lovable, r/cursor, r/bolt, Hacker News,
   X) — what are AI builders actually searching for when they want QA?

## Differentiation to emphasize

When we know who we're competing against, we can sharpen these messages:

1. **"Not a Lighthouse wrapper"** — Lighthouse scores performance; we review
   the whole page (message, experience, reach) with evidence and fix prompts.
2. **"Not a manual QA service"** — We're automated, instant, and agent-ready.
3. **"Built for AI builders"** — Fix prompts for Cursor, Claude, Lovable, Bolt.
   Generic tools don't know what to tell your agent.
4. **"Real data, not opinions"** — Every finding has screenshot evidence and
   a severity rating. No "your site looks fine" without data.
5. **"The monitoring loop"** — Fix, then re-scan to prove it worked. No other
   tool closes the loop.
