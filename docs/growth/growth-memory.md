# Growth memory

Append-only running log — the long-term memory of the organic growth system.
**Never delete an entry.** If something here is superseded, add a new entry
noting the supersession; leave the original in place.

Each entry follows this shape (per the original brief):

```md
## [YYYY-MM-DD] Title

**Objective:**
**Changes made:**
**Reasoning:**
**Expected impact:**
**Measured impact:**
**What worked:**
**What failed:**
**What we learned:**
**Recommended next steps:**
```

---

## [2026-07-09] Phase 1 — Knowledge graph foundations

**Objective:** Lay the foundational infrastructure for a self-improving
organic growth system, per the mission brief: knowledge graph first, public
surfaces only once real data exists to back them.

**Changes made:**
- Added 10 Prisma models (`Site`, `Page`, `Technology`, `SiteTechnology`,
  `Industry`, `Issue`, `IssueOccurrence`, `FixPrompt`, `BenchmarkSnapshot`,
  `Experiment`, `ToolUsage`, `GrowthArtifact`) under a `graph_*` table
  namespace.
- Added nullable FK columns linking existing tables into the graph:
  `Audit.siteId`, `AuditPage.pageId`, `Flag.issueId`.
- Built `lib/graph/persist.ts` (idempotent write path),
  `lib/graph/queries.ts` (public read models with a `MIN_SAMPLE_SIZE = 20`
  gate), `lib/graph/snapshot.ts` (audit → graph adapter), `lib/graph/types.ts`.
- Wired `persistAuditGraphSnapshot()` into `finalizeAudit()` in
  `lib/audit/finalize.ts` — fire-and-forget, `.catch()`-wrapped, runs after
  every audit completes.
- Added `scripts/graph/backfill-historical.ts` (one-shot backfill, supports
  `--limit` and `--dry-run`) and `scripts/growth/issue-frequencies.ts`
  (nightly rollup recomputing `Issue` aggregate counters + examples).
- Added `npm run graph:backfill` and `npm run growth:rollup-issues` scripts.
- Seeded the full `docs/growth/` workspace (this file + 10 others).
- Verified `npm run typecheck` and `npm run lint` both pass clean with the
  new code.

**Reasoning:** The brief explicitly frames organic growth as an engineering
system, not a content sprint: "SEO should emerge naturally from the
product... the product should generate knowledge... knowledge should
generate useful public assets." Building the graph before any public page
avoids the failure mode the brief warns against — pages that exist because
they target keywords rather than because they carry information gain. We
can't know what data we'll actually have until the graph exists and fills.

The existing `Flag` model already carried nearly everything needed
(`fingerprint`, `checkId`, `rubric`, 5 tool-specific prompts) — the graph
layer is primarily a denormalization/aggregation layer on top of data
FixFlags already collects, not a from-scratch data model.

**Expected impact:** No user-facing or SEO impact yet — this is
infrastructure. Expected impact is entirely internal: within one backfill +
one week of live audits, we should have a queryable count of sites, issues,
and occurrence frequencies, which becomes the input to every Phase 2
decision (which issue page ships first, which free tool to build first).

**Measured impact:** Not yet measured — migration has not been run against
a live database in this session (no DB connection available in this
environment). See "Recommended next steps."

**What worked:** Schema validated cleanly on the first structural pass after
one fix (removed an implicit reverse relation on `Site.flags` that Prisma's
relation validator correctly flagged — occurrence linkage lives through
`IssueOccurrence` instead, which is also the more correct model since a
site's relationship to a flag should be many-to-many through occurrences,
not a direct FK). Typecheck and lint both passed without further
iteration once the finalize.ts wiring was in place.

**What failed:** Nothing failed outright. The main constraint hit was
environment-level: this session doesn't have a live Postgres connection, so
the migration itself (`prisma migrate dev`), the backfill script, and the
rollup script are all written and typecheck-clean but **not yet executed
against real data**. That's the immediate next step, not a failure of the
design.

**What we learned:** See `learnings.md` — summarized: nullable FK columns
are the right call for non-destructive migrations on a live system; deferring
aggregate-counter computation to a scheduled rollup (rather than inline
during the audit's hot path) is a repeatable pattern worth reusing for any
future graph writes.

**Recommended next steps (in order):**
1. Run `npx prisma migrate dev` (or the production equivalent,
   `npm run db:deploy`) against a real database to actually create the
   `graph_*` tables.
2. Run `npm run graph:backfill` against production data (or a copy) to
   populate the graph from historical audits. Start with `--dry-run` and a
   `--limit` to sanity check before a full run.
3. Run `npm run growth:rollup-issues` once to compute initial aggregates.
4. Query `getGraphStats()` (via `db:studio` or a quick script) and record
   the numbers in `metrics.md` — this is the first real data point the
   whole system has produced.
5. Decide on analytics access (see `decision-log.md` — open decision).
6. Wire `growth:rollup-issues` into the self-hosted scheduler
   (`lib/queue/recovery-scheduler.ts` pattern) so it runs nightly without
   manual invocation.
7. Only after 1-2 and the numbers exist: pick the first `/issues/[checkId]`
   candidate based on which check has actually crossed `MIN_SAMPLE_SIZE`,
   and build Phase 2.

---

## [2026-07-09] Phase 1 — Production deployment + real-state audit + self-seed decision

**Objective:** Close out the remaining Phase 1 items (steps 1-2 and 6 above
were never actually executed — they existed only as recommendations from
the prior session) and verify the true state of the system in production
rather than trusting the roadmap's status table.

**Changes made:**
- Verified via Railway CLI (`railway variables`, direct Postgres connection)
  that the Phase 1 migration had never been deployed to production and that
  all growth-graph code + docs were sitting **uncommitted** in the local
  working tree — a gap the prior session's roadmap didn't surface.
- Ran `npm run db:deploy` against the production Railway Postgres —
  `graph_*` tables now exist in production.
- Ran `npm run graph:backfill` against production — found only 1 completed
  audit historically (see finding below), backfilled it.
- Refactored `scripts/growth/issue-frequencies.ts` to export a callable
  `runIssueRollup()` function (previously a CLI-only script with a bare
  `process.exit`), and wired it into `lib/queue/recovery-scheduler.ts`
  alongside the existing recovery/nurture ticks — same Redis-lock,
  unref'd-timer pattern, runs every 6h with a 23h lock TTL (nightly
  cadence). No external cron needed, consistent with existing architecture.
- Queried production directly and found:
  - 17 total audits, only 1 `COMPLETED`, 1 registered user (the project
    owner) — this is pre-launch testing, not organic traffic.
  - The 16 `FAILED` audits were caused by an R2/screenshot capture issue
    that has since been resolved — `/api/health`, `/api/health/worker`,
    `/api/health/browser` are all green as of this session.
  - Technical SEO baseline (sitemap.xml, robots.txt with per-crawler AI
    bot rules, llms.txt) is already solid and live — not a gap.
- Committed all pending work (migration, `lib/graph/*`, `docs/growth/`,
  scheduler wiring, `AGENTS.md`) and pushed to `origin/main` per the
  project's git workflow.
- Logged a new decision (see `decision-log.md` 2026-07-09) proposing the
  knowledge graph be **self-seeded** with real audits against curated
  public sites, because organic volume alone (1 real user, pre-launch)
  cannot plausibly reach `MIN_SAMPLE_SIZE = 20` in any reasonable
  timeframe. This directly answers the mission brief's instruction to
  "challenge assumptions continuously" — the original foundations-first
  sequencing assumed organic traffic would eventually fill the graph, and
  that assumption breaks down pre-launch.

**Reasoning:** The mission brief frames this as an engineering system that
should be measured against real data, not documentation. Trusting
`roadmap.md`'s "✅ Done" markers without checking production would have
meant continuing to build Phase 2 logic against a graph that had zero rows
in the real database — a wasted cycle. Verifying against Railway directly
before touching any code caught a gap the documentation didn't show.

**Expected impact:** Production now has a live, filling knowledge graph
(even if currently near-empty) and an automated nightly rollup — no more
manual `npm run growth:rollup-issues` invocations required. The real
blocker to Phase 2 (sample size, not code) is now correctly identified and
logged, instead of Phase 1 appearing "done" while silently blocked
downstream.

**Measured impact:** `getGraphStats()`-equivalent direct query after
backfill: 1 site, 1 completed audit's worth of issues persisted. Confirms
the pipeline works end-to-end; confirms the sample-size gap is real, not
hypothetical.

**What worked:** The idempotent persist/backfill design held up on first
real production run — no errors, no duplicate rows on a second dry-run
invocation. Typecheck, lint, and `worker:build` all passed clean after the
scheduler refactor with zero iteration needed.

**What failed:** Nothing failed technically. The organizational gap was
process, not code: work had been built and validated locally but never
shipped (committed + deployed) in a prior session. Documentation had marked
items "done" that were only "done in a local working tree."

**What we learned:** "Done" in growth-memory/roadmap entries must mean
verified in production, not just "code written and typechecked locally."
Add a habit: before marking any infrastructure deliverable done, confirm
it's committed, pushed, and deployed — not just present on disk. Also
learned that `MIN_SAMPLE_SIZE` as designed assumes an organic-volume growth
curve that doesn't hold pre-launch; the gate itself is sound, but the path
to satisfying it needs an explicit seeding strategy rather than passive
waiting.

**Recommended next steps (in order):**
1. Design and run a self-seed batch: choose 40-60 real public URLs
   (clustered around known AI-builder output — Lovable, Bolt, v0,
   Cursor-shipped landing pages found via Product Hunt / GitHub / Reddit)
   and run real audits against them via the existing pipeline. This
   produces genuine scan data, not fabricated statistics.
2. After the batch completes, run `getGraphStats()` and re-rank
   `backlog.md` with real numbers — pick whichever `Issue` crossed
   `MIN_SAMPLE_SIZE` first as the Phase 2 pilot.
3. Resolve the still-open analytics-access decision (GSC minimum) before
   Phase 2 prioritization — currently the only remaining Phase 1 blocker
   besides sample size.
4. Build industry/tech detection in `lib/graph/snapshot.ts` (currently
   stubbed to `null`/`[]`) in parallel with the seed batch — needed before
   any `/benchmarks/[scope]` page can exist, and the seed batch is a good
   forcing function to validate the detection heuristics against real
   HTML from real builders.
5. Once one Issue crosses threshold: ship `/issues/[checkId]` for that
   check + `/tools/meta-preview` (no pipeline dependency) as the two
   Phase 2 pilots, per `backlog.md` ranking.
