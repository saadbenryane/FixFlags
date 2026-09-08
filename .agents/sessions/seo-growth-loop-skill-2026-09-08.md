# SEO growth-loop skill

Date: 2026-09-08
Owner: cursor-seo-loop
Branch: main

## Outcome

Implemented a FixFlags-native project skill for repeatable organic-search
improvement without a separate agent runtime or paid SERP provider.

The loop:

1. checks ownership, prior experiments, artifact freshness, and target-page state
2. measures comparable GSC, GA4, crawl/index, and product signals
3. researches current intent and sampled results
4. generates candidates across distinct ethical mechanisms
5. pre-registers one focused intervention
6. builds and verifies the smallest coherent change
7. closes the result as keep, revise, revert, or inconclusive

Every pass ends as `implemented`, `baseline`, or `blocked`. The skill
explicitly distinguishes GSC impression-weighted average position from an
exact rank and prohibits ranking wins without comparable follow-up evidence.

## Files

- `.agents/skills/fixflags-seo-growth-loop/`
- `.cursor/skills/fixflags-seo-growth-loop/SKILL.md`
- `.agents/evals/seo-growth-loop.md`
- `docs/growth/`
- `scripts/skill-validator.mjs`
- `scripts/project-agent.mjs`
- `AGENTS.md`

`.agents/README.md` was intentionally not changed because
`agent-heartbeat-refactor` owns it. Canonical routing was added to `AGENTS.md`
and the growth context instead.

## Verification

Passed:

- `npm run skills:validate`
- `node --test scripts/skill-validator.test.mjs scripts/project-agent.test.mjs`
- `npm run seo:guard`
- `npm run agent -- eval growth`
- `npm run agent -- verify --dry-run`
- `npx eslint scripts/skill-validator.mjs scripts/project-agent.mjs`
- scoped `git diff --check`
- IDE lint diagnostics for edited scripts

Known unrelated failure:

- `npm run metadata:route-guard` reports
  `app/(marketing)/protect/page.tsx (/protect) does not use an approved metadata helper`.
  That file was unchanged before and during this task, so this scope did not
  alter another agent's marketing work.

## Research basis

- Atom Eve SEO Improver's prior-run baseline, stable recommendation IDs,
  movement reporting, and next-pass verification
- Google Search Central people-first content, title-link, canonicalization,
  Search Analytics API, and spam-policy guidance
- existing FixFlags GSC/GA4 exports, graph-backed issue pages, sample gates,
  structured data, sitemap, attribution foundation, SEO guards, and growth
  memory
