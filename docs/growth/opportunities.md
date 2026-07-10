# Opportunities

Weekly GSC/analytics-derived opportunities. Populated once
`scripts/growth/pull-gsc.ts` exists and analytics access is granted (see
`decision-log.md`). Until then, this file lists **structural** opportunities
inferred from the codebase and market context, clearly marked as
unvalidated.

## Structural opportunities (no analytics access yet)

These are hypotheses, not measured opportunities. They will be
re-prioritized against real GSC/GA data once access exists.

### Category ownership

- **"AI website audit" / "AI-built site QA" category ownership.** No
  competitor currently seems to explicitly own this framing based on our
  earlier product research (FixFlags' own positioning is "the QA layer for
  AI-built products" — a genuinely underserved framing as of this writing).
  Validate with real SERP research once `competitors.md` is filled in.

### Builder-specific audiences

- **Builder-specific audiences** (Lovable, Cursor, Bolt, v0, Replit users)
  are large, active, and currently have no dedicated "does my AI-built site
  actually work" resource. The 5 tool-specific fix prompts already in the
  `Flag` model (`cursorPrompt`, `claudePrompt`, `lovablePrompt`,
  `boltPrompt`, `agentPrompt`) suggest the product already treats these as
  distinct audiences — growth content should mirror that segmentation.

### Free tool queries

- **"Open Graph preview checker"** and similar single-purpose tool queries
  are evergreen, high-intent, and low-competition relative to broader
  audit/QA terms. Good candidate for the first free tool (see `backlog.md`
  #2).
- **"Placeholder text detector"** / "AI slop detector" — queries from
  builders who suspect their AI-generated content has issues but don't know
  how to check. The placeholder-copy-detector tool directly serves this
  intent.

### Issue-driven queries

- **"[specific issue] + website"** queries (e.g., "missing og image fix",
  "cta below fold mobile", "placeholder copy detected") — these are
  high-intent, low-competition, and directly served by issue pages. Each
  issue page would target the specific check ID's query cluster.

### Research-driven queries

- **"How many AI-built sites have [issue]"** — original research queries
  that only FixFlags can answer with real data. These earn backlinks and
  social shares because they contain information gain no other source has.

## How to fill this in for real

Once `pull-gsc.ts` runs:
1. Pull all queries with impressions > 0 but clicks = 0 and position 5-20 —
   these are "almost ranking" opportunities, typically the highest ROI fix
   (title/meta/content tweaks vs. building something new).
2. Pull queries with high impressions and low CTR relative to position —
   snippet/title problems, not ranking problems.
3. Cross-reference against `lib/graph/queries.ts::getGraphStats()` — do we
   have enough sample size to build a page that would satisfy the query
   intent? If not, that's a data-collection priority, not a content
   priority.
4. For each opportunity, estimate the conversion potential: does this query
   attract people who would run an audit? (vs. people who just want
   information and will leave)
