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
`growth-roadmap.md`'s "✅ Done" markers without checking production would have
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

---

## [2026-07-09] Architecture review and four-layer redesign

**Objective:** Comprehensive system audit and architecture improvement.
Review everything built so far against the full mission brief, identify
gaps, and redesign the architecture to be more complete and measurable.

**Changes made:**
- Read and analyzed every file in `docs/growth/`, `lib/graph/`,
  `lib/marketing/`, `lib/audit/finalize.ts`, `scripts/`, `app/` routes,
  `prisma/schema.prisma`, and `package.json`.
- Redesigned `growth-architecture.md` with a four-layer model:
  - Layer 1: Data Collection (audit pipeline, GSC, analytics, backlinks, SERP)
  - Layer 2: Intelligence (rollups, opportunity scoring, competitive analysis)
  - Layer 3: Public Surfaces (issue pages, benchmarks, tools, reports, compare)
  - Layer 4: Measurement & Feedback (attribution, experiments, weekly reviews)
- Identified 6 architectural gaps:
  1. No attribution funnel (can't trace organic -> audit -> signup -> paid)
  2. No automated data pipeline (GSC, benchmarks, opportunity scoring)
  3. No dynamic sitemap (manual step to add programmatic pages)
  4. No internal linking engine (no topical authority clusters)
  5. No content freshness system (public pages go stale)
  6. No competitive intelligence (no SERP monitoring, no backlink tracking)
- Updated `growth-roadmap.md` with specific deliverables and dependencies per phase
- Updated `backlog.md` with P0-P4 priority tiers and dependency chains
- Updated `metrics.md` with a four-layer measurement framework and funnel
  metrics
- Updated `growth-architecture.md` with data flow diagram, structured data
  expansion plan, internal linking engine design, and dynamic sitemap design
- Identified 5 things that can ship immediately with no blockers:
  1. Industry/tech detection in snapshot.ts
  2. Benchmark rollup script
  3. Free tool: meta-preview
  4. Free tool: placeholder-copy-detector
  5. Attribution parameter design

**Reasoning:** The existing Phase 1 foundations are well-designed — the
knowledge graph schema, persist/query boundary, MIN_SAMPLE_SIZE gate, and
fire-and-forget audit hook are all sound. But the architecture had gaps in
the measurement and feedback layers that would have caused the system to
produce public pages without knowing if they work. The four-layer model
ensures every layer feeds the next and nothing falls through the cracks.

The most critical insight: the system can produce public pages that earn
traffic, but without attribution tracking, we can't know which pages drive
signups. This means the loop (audit -> knowledge -> pages -> trust ->
acquisition -> audit) has a measurement break. Fixing this before shipping
Phase 2 pages means every page ships with UTM/source tracking from day one.

**Expected impact:** The improved architecture means:
- Phase 2 ships with attribution from day one (not retrofitted later)
- Every public page has a clear information gain requirement (no thin pages)
- The measurement framework catches declining pages before they lose ranking
- The internal linking engine builds topical authority automatically
- The dynamic sitemap prevents index bloat automatically

**Measured impact:** Not yet measured — this is architecture work, not
shipping code. Impact will be measured by Phase 2 outcomes.

**What worked:** The existing codebase is remarkably well-structured for a
pre-launch product. The knowledge graph schema covers the right entities,
the persist/query boundary is correctly enforced, and the audit pipeline
already captures everything needed for rich public pages. The 164 check IDs
across 15+ categories are a goldmine of data waiting to be aggregated.

**What failed:** Nothing failed. The gaps identified are typical of a
system that was designed foundations-first (correctly) but hasn't yet
reached the public-surface phase.

**What we learned:**
- The attribution gap is the most dangerous architectural flaw — it's
  invisible until you try to measure the loop, and by then you've shipped
  pages without tracking. Fix this before Phase 2, not after.
- Industry/tech detection is the single biggest blocker to benchmark pages.
  The `htmlMetadata` JSON on `AuditPage` likely already contains enough
  signal (framework detection, builder fingerprints) — check there before
  building new detection logic.
- The free tools (meta-preview, placeholder-detector) have zero blockers
  and should ship in parallel with the self-seed batch — they're the
  fastest path to top-of-funnel traffic.
- The existing `seo-guard.mjs` script is a good pattern — extend it to
  cover new route registries as they're added.

**Recommended next steps:**
1. Execute the self-seed batch (#1 in backlog) — this unblocks everything
2. Ship meta-preview and placeholder-detector in parallel (#2, #3)
3. Implement industry/tech detection (#4) — use real HTML from the seed
   batch as test data
4. Resolve analytics access decision (#5) — highest-leverage unlock for
   measurement
5. Then: first issue page, attribution system, internal linking engine

---

## [2026-09-08] Brand sitelinks, not category keywords

**Objective:** Make the unpublished care-site the official Google answer
for people who already search `fixflags`.

**Changes made:**
- Added a GSC page×query export (`docs/growth/metrics/gsc-page-queries.json`).
- Pre-registered and implemented `SEO-SNIPPET-001` titles for home,
  pricing, and partners.
- Recorded timestamped SERP leftovers (Founder DB, AgentSpot, FFlags
  collision) and parked category-keyword backlog advice.

**Reasoning:** Joined GSC rows proved `/pricing` and `/partners` appear
only for the brand query. Vague sitelink titles waste the only measured
demand. Category terms still have no GSC evidence.

**Expected impact:** After deploy and recrawl, clearer official snippets
and some sitelink CTR. No near-term non-brand ranking claim.

**Measured impact:** Not yet. Next compare 2026-09-15.

**What worked:** Page×query removed the need to invent pricing keywords.

**What failed:** Production still serves the retired homepage tagline, so
this pass cannot be observed live.

**What we learned:** Extra URLs with impressions for a brand query are
sitelinks until proven otherwise. Title those pages with the brand name.

**Recommended next steps:**
1. Deploy `SEO-CRAWL-001` and `SEO-SNIPPET-001` together.
2. Run `npm run growth:verify-live`.
3. Compare page×query on 2026-09-15 before any Flag or tool title pass.

---

## [2026-10-13] Reviewed research publication and comparable journey measurement

**Objective:** Strengthen the intelligence and growth system without exposing
customer evidence or presenting incompatible measurement windows as a funnel.

**Changes made:** Public issue readers now use a reviewed aggregate release in
the existing `GrowthArtifact` store. Source, permitted-use and copy-review
references remain private. Twenty distinct sites, check versions, consistent
counts, explicit scope, limitations and expiry are enforced. The library,
related links, sitemap and detail pages share the boundary. Identifiable
examples are withheld, and legacy benchmark rows cannot become public research.
A local validation command prepares review without storage or publication.
The shared rollup counts distinct observations and current frameworks; the
seed script's competing rollup was removed.

GA journey exports retain reporting timezone and provider limitations. The
server join loads the complete GA observation window independently of the
operational start cohort, follows exact starts to results and later claims,
and withholds rates for unverifiable windows or empty denominators. Admin copy
uses tab journeys rather than sessions.

**Measured impact:** Local regression and PostgreSQL fixture evidence establish
these correctness and privacy boundaries. Three observations across two sites
remain three observations with multiple technologies and fingerprint rows;
inactive frameworks and hosting are excluded. The local validator accepts a
synthetic valid release and rejects an identifiable extra field. No dataset was
stored or published. Development data has graph observations but no approved
research release. Local reporting credentials and property configuration are
absent. No current production acquisition, retention, paid conversion, verified
fix-success, or search improvement is established.

**What we learned:** Observation volume does not establish sample diversity or
publication permission. Removing `www` does not anonymize a hostname. A journey
key alone does not make mismatched reporting windows comparable, and tab
journeys are not visitors or GA sessions. Permission-reference validation is
structural; a real reviewer must verify the underlying permission and public copy.

**Next evidence required:** Operator-authorized deployment and production
privacy assessment; a genuinely permitted, reviewed research cohort; fresh
read-only GA4/GSC exports; and measured lifecycle outcomes before scaling
acquisition or making public quality comparisons. Historical roadmap sections
that publish automatically from raw graph volume are superseded by the boundary
in `research-governance.md`. Work is locally verified, not deployed.

## [2026-10-13] Google reporting access verified and search totals corrected

**Evidence:** The production worker has the reporting configuration. Read-only
GA4 and Search Console requests succeeded for 2026-09-15 through 2026-10-12:
45 reported GA users, 48 sessions, 70 pageviews; 5 finalized web-search clicks
and 81 impressions. `metrics/reporting-access-2026-10-13.json` contains the
aggregate-only response and limitations. No production database data, provider
settings or credentials were written. This supersedes the earlier local-only
access assessment, not the privacy publication boundary.

**Implementation:** Added a repeatable aggregate reporting inspector, restricted
to known FixFlags properties and read-only scopes. Search exports now query
property totals separately from visible query rows, preserve returned-query
coverage, withhold unsupported indexed-page counts, and distinguish page-level
aggregation. GA/GSC summaries retain exact requested dates; inclusive windows
now contain the requested calendar-day count. Existing reports cannot be
compared blindly across the definition change.

**Permission finding:** Account settings, Site settings, their write schema, and
current privacy copy contain no recorded public research opt-in. Analytics
cookie consent and Google connection consent serve their existing product
purposes. Neither is a reviewed public-research release grant.

**Limits and next work:** The new exporter behavior is locally verified and
awaits authorized deployment. Google access is confirmed, but acquisition to
Site value or revenue is still unjoined. The sample does not establish a growth
improvement, indexing census, or website-quality benchmark. Keep raw customer
evidence behind the reviewed research boundary while using the now-verified
first-party reports to prioritize measured acquisition work.


## [2026-10-13] Site research permission connected to publication eligibility

**Implemented:** Added an off-by-default checkbox in Site settings and an
owner-only read/write API. It covers only new observations, aggregate findings
and independently verified fix outcomes. Private evidence, URLs, prompts,
account details and connected-provider data remain excluded. Existing private
Site lifecycle storage records versioned grants and withdrawals; no schema
migration or monitoring change is needed.

Public readers now require a private source manifest tied to the reviewed
release. They recheck current owner, Site origin and base path, latest grant, prospective
source audit dates, completed source runs and actual distinct-site diversity.
Withdrawal, deletion, owner/domain changes and regranting withhold stale
releases. A repeat save preserves the same grant. The privacy page explains
scope, withdrawal and the limit on recalling external copies.

Issue counts must match distinct deterministic source findings with confidence
of at least 0.8, available by the review time. Framework cells must match
versioned technology observations on the affected source audits. Connected
search checks are excluded from this permission scope. These checks establish
source and count consistency; detector accuracy, source-version equivalence and
free-form copy privacy still need review.

**Evidence:** Focused API, component, consent and permission tests cover default
off, owner enforcement, current wording, withdrawal, failed saves, stale grants,
foreign/pre-consent sources and missing manifests. A real isolated local
PostgreSQL fixture with 20 synthetic Sites admits the permitted cohort, rejects
a foreign owner, withholds it after withdrawal, and does not revive it when
consent is enabled again. The fixture is not a real research dataset. Final
verification passed 77 focused tests, the PostgreSQL integration check, type
checking and targeted lint.

**Status:** Locally implemented and verified. No production consent was changed,
no customer was opted in, and no dataset was published. Earlier statements that
settings contain no research opt-in describe the pre-change implementation.
Owner permission now has a concrete path; public research still needs genuinely
permitted observations, source evidence, adequate samples and review.

## [2026-10-13] Customer value reporting uses original outcome references

**Finding:** The value calculator treated absent cost records as zero and priced
older outcome events through a fix attempt's current verification pointer. A
retry could therefore replace an earlier run's cost. Outcome distributions also
kept the first inconclusive result after a later improvement.

**Implemented:** Missing, invalid, conflicting and later-recorded estimates now
withhold cost ratios and expose coverage. Outcome distributions use the latest
issued result per cycle; time to outcome still uses the first result. Future
records and invalid durations are excluded. Shared run costs are counted once.
The aggregate-only `loadCustomerValueReport` resolves each outcome event's
recorded audit ID, verifies Site lineage, and uses one read-only, repeatable-read
transaction. The local inspector refuses remote database targets and suppresses
private database errors. `metrics.md` records its definitions, limitations and
the previously verified provider baseline.

**Evidence:** 23 focused tests and an isolated PostgreSQL fixture passed. The
fixture exercised the actual report command, an inconclusive result followed by
an improved retry, distinct cost accounting, missing-cost withholding and an
output with no source identifiers. Type checking and targeted lint passed.
These synthetic checks prove behavior, not customer outcomes or economics.

**Remaining:** No production database was read or changed. The existing admin
cost projection lacks event audit IDs and now yields N/A; integration with the
new projection waits for the active admin writer's scope. The new command is
usable locally now. Acquisition-to-verified-value and revenue joins still need
actual authorized product data; another generated cycle is not human retention.

## [2026-10-13] Internal research clicks no longer invent organic acquisition

**Finding:** Issue index and CTA links generated `issue/organic` campaign tags
for every visitor. The homepage form then recorded `HOMEPAGE`, obscuring the
research entry surface. Source inference also missed canonical plural paths.

**Implemented:** Research navigation preserves existing external campaign tags
and never creates them. The analysis CTA uses the finite `ff_entry` marker;
both the request and consented start event record that declared public surface.
Explicit form sources and private entry contexts retain precedence. Canonical
plural issue/benchmark paths and existing singular aliases are recognized.
Ambiguous and invalid query values are ignored. No cookie, persistent browsing
state, identifier or additional event was added. Removed the redundant issue
methodology block that claimed automatic refresh without release review.

**Evidence:** 37 focused attribution, handoff and research-page tests passed,
with a further three-page-test check after removing the unsupported refresh
claim. Type checking and targeted lint passed. The checks exercise generated
links, preserved campaign values, the actual request body and start callback.

**Limit:** Entry declarations are not verified discovery channels or causal
attribution. Earlier issue/organic labels remain ambiguous historical data.
The change is local and awaits authorized deployment and observation; no
acquisition or conversion improvement has been measured.

## [2026-10-13] Initial analysis to repair evidence joined in a fixed cohort

**Implemented:** The existing local value inspector now has an `acquisition`
mode. It follows immutable anonymous start identities through useful-result and
exact claim receipts to the initial Flag occurrence, matching Improvement and
attempt, and a completed independent verification in the same Site and owner.
Counts use seven-day mature analysis cohorts and finite entry surfaces. Seeds,
follow-up analyses and signed-in starts are excluded. Missing sources stay in
the denominator; invalid lineage withholds shares. Missing exact claim evidence
is unclassified. Stages are independent evidence counts, not a conversion funnel.

New anonymous ownership transitions emit an idempotent private `analysis_claimed`
receipt after the existing migration commits. Telemetry failure does not fail
the claim. Already-owned retries cannot backfill a false transition timestamp.
No model migration, cookie, customer configuration or public endpoint was added.
Reports use one repeatable-read, read-only snapshot and export no source IDs,
visitor keys, raw campaigns, URLs or customer content.

**Evidence:** 44 focused cohort, claim, event and HMAC tests passed. Isolated
PostgreSQL checks exercised both inspector modes, real claim-receipt persistence
and timestamp idempotence, a source-to-verification join, rejected self-reported
results and exclusion of a later monitoring source. Type checking and targeted
lint passed. All fixtures were synthetic and isolated from existing tables.

**Remaining:** This measures repairs tied to the initial analysis, not all later
monitoring value, human retention, revenue or causal channel returns. Those
require additional explicit cohort definitions and actual authorized records.
The original goal remains incomplete. No production cohort was inspected or
changed, nothing was deployed, and no public research was published. New claim
receipts require authorized deployment and observation before business outcomes
can be measured; legacy Site-only claim receipts remain ambiguous.

## [2026-10-13] Live discovery gap verified and LLM research links governed

**Evidence:** Public HTTPS reads found a valid homepage canonical and a 308
www-to-apex redirect. The sitemap advertises 104 URLs, including 45 issue detail
pages. Two sampled pages show 13/12 sites, a three-site threshold, examples and
Dataset markup without the reviewed scope. Permission provenance remains
unverified. Sitemap inclusion does not prove indexing. The aggregate receipt
`metrics/public-discovery-2026-10-13.json` retains no customer examples or content.

**Implemented:** LLM discovery resolves current reviewed research through the
same reader as sitemap and pages. The builder excludes research by default.
Dynamic no-store responses recheck eligibility; missing research or a failed
read preserves public guides and tools. The research note describes reviewed
aggregates without promising unavailable framework comparisons.

**Validation and remaining:** 16 focused discovery, copy and published-content
tests, the SEO guard, type checking and targeted lint passed. Production was
read, not changed. Local publication safeguards await authorized deployment;
existing public material and external copies require a production assessment.
Do not count the live older path as governed research.

## [2026-10-13] Publication safeguards isolated for review

The managed worktree at
`/Users/saadbenryane/.codex/worktrees/growth-publication-boundary/FixFlags` holds
local branch `codex/research-publication-boundary`, commit
`1a941f706388de484b95c3ef103742119abe8e69`, based on `a274d585`.
Its 48 selected files contain publication/consent protection, research entry
attribution, diagnostic rollup corrections, focused tests and a release brief.
Broader analytics, product, admin and design work remains in the original
checkout. No environment files or schema/dependency changes were copied.

On the committed baseline, 138 focused tests and two isolated PostgreSQL checks
passed, together with type checking, targeted lint and the SEO guard. The
worktree is clean and the commit's path inventory matches the explicit selection.
`docs/growth/publication-release.md` records scope and release limitations. Nothing
was pushed or deployed. Production-base comparison and applicable release
validation remain necessary before an authorized deployment.

## [2026-10-13] Publication candidate corrected to the actual live revision

Read-only Railway metadata reports production web deployment `958f330a` at
`b09761772f88302546a7b72b0cb29febc4ad0951` as successful. The newer `a274d585`
deployment failed. Consequently the earlier `1a941f70` review cut is not the
production candidate: it would also include 254 unrelated changed files.

The same publication patch now sits on the live baseline in local branch
`codex/research-publication-live`, current commit `cfe9754d`, in the attached
publication worktree. The earlier branch is preserved. Exact live-lockfile
installation, Prisma client generation, 138 focused tests, two isolated
PostgreSQL checks, the full Next.js 15.5.27 web build with standalone packaging,
worker compilation and the SEO guard passed. The research pages, sitemap and LLM
index are absent from the prerender manifest. No schema, dependency or Dockerfile
changes are introduced relative to production.

Build configuration was synthetic, with unreachable loopback services and no
production credentials. Its bundle must not be deployed; an authorized release
must rebuild source with production configuration. The proposed action is a
web-service deployment only, with no worker deployment, counter refresh,
artifact installation or automatic consent change. No production action has
occurred. The release brief and safe baseline receipt are in that worktree.

## [2026-10-13] Continuing Site value includes later monitoring repairs

The local value inspector now accepts `sites` mode. It follows each Site's first
retained exact claim for seven days, choosing the first receipt before applying
the cohort interval. It counts completed production scheduled checks, issue
cycles, attempts, independent system-issued improvement, monitoring requested
after improvement, and owner-attributed WEB follow-up after one day. Unlike the
initial-analysis report, repair evidence can come from later monitoring audits.
Both reports use shared occurrence, attempt and verification lineage checks.

Source and verification audits must be completed, ownership and Site links must
match, and timestamps must be coherent. Inconsistent or deleted evidence
withholds shares. Validation runs are excluded. A later completed check does not
prove sustained recovery; owner-attributed follow-up does not establish a human
return, retention or revenue. The repeatable-read report is read-only, bounded
and aggregate-only. Definitions and the command are in `metrics.md`.

Thirty-seven focused tests and two isolated PostgreSQL integrations passed,
including the actual inspector command and a later-source repair followed by
monitoring. Targeted lint and whitespace checks passed. The full checkout type
check currently fails in concurrent admin/schema work, with no diagnostics in
the acquisition or continuing-value reporting files. No browser tests ran.

Only synthetic local fixtures were measured. Production cohorts, paid conversion
and business impact remain unmeasured. Nothing was deployed or published. The
publication candidate remains `cfe9754d`, with deployment approval pending.

## [2026-10-13] Commercial measurement awaits payment provenance and release

Inspection confirmed that subscription lifecycle prices/status cannot establish
collected revenue. Concurrent billing work adds a payment ledger, but its invoice
writer does not retain Stripe live/test or out-of-band settlement provenance.
Both paid-event types enter that writer. Stripe's official invoice and event
references confirm why a paid invoice is insufficient evidence of live Stripe
cash collection. The actionable finding and required measurement boundary are
saved in `metrics.md`; no billing code or another writer's changes were edited.
Provider-history reconciliation writes records and was not invoked.

The publication candidate is still clean at `cfe9754d`. Deployment authorization
has remained pending across the release-review turn, continuing-value turn and
this assessment. Local reporting is verified with synthetic fixtures, Google
discovery access is verified, and research permission/publication gates are
implemented. Production release, subsequent consented evidence collection,
authorized operational measurement and commercial provenance remain necessary
before claiming the complete intelligence loop or business impact. No deployment,
public research, campaign or production mutation has occurred.

## [2026-10-14] Authorized research safeguards deployed to the web service

The user authorized the reviewed web patch. Production had advanced to `62cad129`
before that answer, so the approved patch was applied to that live revision.
All 45 runtime files are byte-identical to the approved candidate. No schema,
migration, dependency, Dockerfile or Railway configuration changes were introduced.
The source is saved as `74e35e344ea45376f1f1143410b0049e580317fe` on local branch
`codex/research-publication-current`; the originally reviewed branch is preserved.

Fresh checks passed: 138 focused tests, two isolated PostgreSQL integrations,
targeted lint, the SEO guard, Next.js 16.4.0 production build with type checking
and standalone packaging, and worker compilation. No browser or E2E tests ran.
Railway rebuilt source with the existing production configuration. The initial
upload succeeded, but its runtime lacked a revision identifier. Setting the
web-only non-secret `GIT_COMMIT_SHA` and redeploying that same release produced
successful deployment `488d8bcd-6aee-4919-bd63-d517aebb123f`. Public health now
reports the exact source SHA and successful readiness and migration checks.

Public HTTP reads confirm a noindex issue library, no issue detail sitemap URLs,
no research advertisement in llms.txt, and authentication on the consent API.
Two sampled issue routes render noindex not-found states with no examples or
Dataset markup. Next.js streaming retains HTTP 200 for these not-found responses,
as documented in the installed framework guide. Search-engine removal and recall
of external copies are not established. Aggregate evidence is saved in
`metrics/publication-deployment-2026-10-14.json` without customer content.

An independent worker redeployment, `4d53e66a`, was created at 09:42 UTC before
this task's first web upload at 09:44 UTC. It succeeded on the same reported source
commit, `62cad129`. This task issued no worker deployment commands. No consent
mutation, research artifact installation, graph refresh, campaign or main-branch
push was performed. The research choice remains off by default. The deployment permission
block is resolved; an eligible consented dataset and measured business outcomes
remain unavailable. Broader analytics changes in the original checkout were not
included in this publication release.
