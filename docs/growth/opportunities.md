# Opportunities

Weekly GSC/analytics-derived opportunities. Populated once
`scripts/growth/pull-gsc.ts` exists and analytics access is granted (see
`decision-log.md`). Until then, this file lists **structural** opportunities
inferred from the codebase and market context, clearly marked as
unvalidated.

## Unvalidated (no analytics access yet)

These are hypotheses, not measured opportunities. They will be
re-prioritized against real GSC/GA data once access exists.

- **"AI website audit" / "AI-built site QA" category ownership.** No
  competitor currently seems to explicitly own this framing based on our
  earlier product research (FixFlags' own positioning is "the QA layer for
  AI-built products" — a genuinely underserved framing as of this writing).
  Validate with real SERP research once `competitors.md` is filled in.
- **Builder-specific audiences** (Lovable, Cursor, Bolt, v0, Replit users)
  are large, active, and currently have no dedicated "does my AI-built site
  actually work" resource. The 5 tool-specific fix prompts already in the
  `Flag` model (`cursorPrompt`, `claudePrompt`, `lovablePrompt`,
  `boltPrompt`, `agentPrompt`) suggest the product already treats these as
  distinct audiences — growth content should mirror that segmentation.
- **"Open Graph preview checker"** and similar single-purpose tool queries
  are evergreen, high-intent, and low-competition relative to broader
  audit/QA terms. Good candidate for the first free tool (see `backlog.md`
  #4).

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
