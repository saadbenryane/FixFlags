# Project conventions

## Git workflow

**Always work on `main`.** This is a solo development setup — there is no need for
feature branches, and we keep only one branch (`main`) locally and on the remote.

During development, push work **directly to `origin/main`** so it deploys to the live
environment for testing. Do **not** create feature branches or open pull requests unless
explicitly asked. Production (Railway) deploys from `main`, so anything that needs to be
tested on the deployed app must land on `main`.

## Landing page

Homepage section order (canonical):

1. Hero (stable headline/subhead; one interactive report preview)
2. Logo cloud (compact bridge below hero report)
3. Three dimensions (Message, Experience, Reach — checklists + example findings)
4. Fix loop (scan → flag → fix → verify cards with arrows)
5. Example feedback (honest disclaimer; no unverifiable counts)
6. Final CTA (URL input repeated; outcome-led copy from `FINAL_CTA`)

Rules:

- Do not duplicate the report explorer below the hero
- No How-to-Start toggle, no evidence screenshots section
- Hero copy changes only when explicitly requested
- Marketing strings live in `lib/marketing/copy.ts`; guardrails in `lib/__tests__/homepage-message.test.ts`
- Social proof must match `LANDING_PAGE.testimonials` disclaimer; never invent member counts
- Avoid banned marketing phrases: "second pass", "flag it" (as punchline), "Ship tonight", "Fix my live site", "Start in 60 seconds"

## Changelog

The public changelog (`lib/marketing/copy.ts` → `CHANGELOG_ENTRIES`) is for **users**, not internal notes.

### Do
- Say what the user gets ("Sign up and create your account to start testing")
- Announce betas, new features, and improvements in plain language
- Invite feedback ("We'd love your feedback — use the chat button")
- Describe outcomes and benefits

### Don't
- Explain how something was built or mention implementation details
- Use internal terminology or backend concepts
- List technical changes (e.g. "Trust checks run as scan modules" or "Updated MCP tools")

## Report UI conventions

### Top Priorities section

- Renders between the verdict and the flags explorer, showing the top 3 flags
  by priority with compact fix prompts and individual copy buttons.
- Condition: `!isSample && explorerModel && hasFixPrompts && showPrescription`
- Uses `rankFlagsByPriority(audit.flags, audit.rubricRows, 3)` for ordering
- Each card shows: severity badge, rubric label, problem text, `FixPromptBlock`
  with `variant="compact"` and `nested`
- "Copy all N fix prompts" button in the section header calls
  `collectAllFixPrompts()` — adds `=== Fix N: Problem ===` separators

### Mini nav

- `ReportMiniNav` accepts `showFix` prop but it is **always false** since the
  old standalone fix section was removed in iteration 4. Do not reintroduce it.
- Optional sections (Overview, Previews, Flow test, Launch) are inserted at
  position 1 in the nav order; the Fix prompt tab is inserted after Flags.

### Dead code to avoid

- `topFixPrompt && !explorerModel` — logically impossible condition, don't use
- `Boolean(topFixPrompt && !explorerModel)` for `showFix` — always false

## AI prescription data flow

Key constraint: pageText available to the AI differs between triage and
prescription:

| Phase | Source | Max pageText |
|-------|--------|-------------|
| Triage | Freshly parsed HTML (in-memory) | 2500 chars (from 8000-char source) |
| Prescription | Stored `audit.htmlMetadata` (DB) | 500 chars (from 5000-char stored) |

If you need to increase AI pageText, change **both**:
1. `trimMetadataForStorage` in `lib/audit/metadata.ts` (storage limit)
2. `buildPrescriptionPrompt` in `lib/prompts/system-prompt.ts` (prompt slice)

Tech stack for prescription is extracted from `auditPage.performanceData`
(`detectedTech` array), not from `htmlMetadata`. It flows through
`PrescriptionContext.techStack` → prompt.

## Check module architecture

- 22 check modules run through `checks/index.ts` barrel via `runAllChecks()`
- `slow-replay.ts` is a side-channel: imported directly by
  `deterministic-audit.ts`, NOT through the barrel. It requires Puppeteer
  probe results.
- Dedup rules live in `lib/audit/checks/index.ts` `DEDUP_RULES` array.
  Each rule has a `keep` and a `suppress` checkId pattern.
- `impactTag` is set on all deterministic checks — verified in iteration 2.

## Organic growth / SEO

Growth and SEO documentation lives at `docs/growth/` — start with
`docs/growth/README.md`. It's the permanent memory of the organic growth
system: architecture, roadmap, decisions, experiments, and weekly reviews.

Rules that apply project-wide, not just to the growth workspace:

- Any public page that states a statistic, frequency, or benchmark must
  derive it from `lib/graph/queries.ts` (which enforces a minimum sample
  size before returning data) — never hardcode or estimate a number.
- The knowledge graph (`graph_*` Prisma models, `lib/graph/`) is
  internal-only. Public pages read derived data through
  `lib/graph/queries.ts`, never by querying `graph_*` tables directly.
- Before building a new public growth page, read
  `docs/growth/architecture.md` §5 (Boundaries and invariants).

