---
status: supporting
authority: architecture
reviewed_at: 2026-10-21
supersedes: []
---

# FixFlags foundational reliability review

FixFlags should make a continuing commitment to inspect the important parts of a website, surface meaningful failures, support a useful repair, and independently establish recovery. A successful analysis is one observation within that commitment. The architecture should make the commitment explicit and keep every customer surface accountable to the same evidence.

The current modular monolith, durable execution ledger and independent collectors are a sound base. The highest value work is to consolidate responsibility, evidence interpretation and operational accountability around that base. Replacing the stack or adding a second workflow engine would introduce migration cost before addressing those problems.

This review describes the current working tree and proposed changes. Production behavior requires separate verification on the deployed revision. [Product architecture](product-architecture.md), [evidence rules](../knowledge/evidence-rules.md) and [audit execution](audit-pipeline.md) retain their canonical responsibilities.

## First-principles judgment

The unit of customer value is a continuing responsibility for a website condition. An analysis, screenshot, provider response and queue job each contribute evidence toward that responsibility. None alone establishes that the website is being looked after. Every architectural change should improve the chain from admitted responsibility through a timely observation, an accurate conclusion, a useful repair and an independently observed recovery.

The principal source of unnecessary complexity is repeated interpretation of the same execution in admission, comparison, current views, history and notifications. The principal missing abstraction is a coherent account of which responsibilities are currently being fulfilled, including work that never produced a successful result. These are judgments from the concrete disagreements and stalled-work cases below, rather than a reason to replace the stack.

Consolidate a decision when its consumers already need the same facts. Preserve distinct semantics when their observations differ: public HTTP availability, rendered journeys, lab performance, field cohorts and provider reports cannot share one undifferentiated success flag. Use deterministic observations for confirmed failures and comparable recovery; contextual or AI judgment may explain those observations and recommend changes within their recorded authority. A useful refactor removes an independent interpretation or a redundant execution path and demonstrates a stronger customer guarantee.

## What looking after a website requires

**Implemented for trustworthy checkout entry:** Native Chromium reproduced two
false-success paths: direct Buy navigation and cart-to-checkout navigation both
certified a blank HTTP 200 checkout. Embedded checkout already required usable
fields. Both now share that surface observation, and known HTTP failures and
visible checkout errors retain their accepted conclusions. Missing usable UI is
inconclusive rather than a new customer Flag or a generic retryable probe error.
Playwright documents that pages can populate their interface after navigation
and load events. The native reproductions establish the local defect; the
documentation supports requiring an observed usable surface instead of treating
navigation as completion. [Playwright navigation guidance](https://playwright.dev/docs/navigations)

The binding execution receipt remains the sole idempotency owner. Reusing a
diagnostic JourneyReview as an alternative success path is removed. Positive
receipts identify the evaluator independently of customer configuration. Current
health, method evidence, last successful verification and reconciliation cannot
recertify historical URL-only success. Genuine prior failures remain eligible for
independent recovery under the same responsibility. Historical conclusions stay
unchanged, and unproven Clear cannot establish the healthy interval for recurrence.

Twenty-seven native browser cases pass. The actual application, migrated database,
Redis queue and worker complete failed cart entry, blank checkout uncertainty,
usable embedded checkout recovery and recurrence with unavailable media. Separate
PostgreSQL cases preserve older failure continuity and historical conclusions.
No customer UI, configuration, queue or storage table was introduced. These results
do not establish production checkout behavior or payment processing.

The customer promise has six obligations:

1. **Continuity.** URL admission, claiming, subsequent checks and repairs refer to the same private Site. Ownership changes must preserve authorized history without widening access.
2. **Explicit responsibility.** The system knows which pages, behaviors and conditions it is watching, why they apply, the authorized actions, and when another observation is due. Discovery can extend that responsibility. A failed discovery or missing navigation link cannot silently remove it.
3. **Dependable execution.** Due work survives closed browser sessions, queue interruptions and process restarts. Slow or unavailable evidence sources do not prevent independent observations.
4. **Trustworthy conclusions.** Failure, observed success, insufficient evidence, unsupported scope and old evidence remain distinct. A finding must identify the actual condition observed, its scope, and what would establish improvement.
5. **Independent recovery.** A repair is re-exercised under comparable conditions. Detector changes, absent pages, submitted patches and successful queue jobs do not establish recovery. Recurrence retains the incident's identity and earlier evidence.
6. **Accountability.** FixFlags detects when it is failing to meet its own monitoring commitments and brings those failures to an operator. Customer silence must not conceal a stalled service.

Google's monitoring guidance distinguishes observable symptoms from suspected causes. For FixFlags, an exercised customer path supplies failure evidence; a heuristic about the page can help explain or improve it. Those evidence types have different authority. [Google SRE monitoring guidance](https://sre.google/sre-book/monitoring-distributed-systems/) Prometheus also recommends testing the monitoring and alert-delivery path itself. For FixFlags, a live worker or a saved next-run time cannot establish fulfilled care or successful delivery. Our local fixtures prove selected application paths; an independent deployed check and live-provider acceptance remain necessary. [Prometheus alerting guidance](https://prometheus.io/docs/practices/alerting/)

## What should remain

| Foundation | Current code evidence | Engineering judgment |
| --- | --- | --- |
| Shared admission | `sites/application/run-requests.ts` and frozen `ExecutionSpec` | Preserve one authorization and intent boundary for UI, scheduling, API and agent triggers. |
| Durable work | `audit/progressive/engine.ts`, persisted dependencies, tokens and generations | PostgreSQL owns admitted work and committed evidence. Queues deliver work. Keep that separation. |
| Resource isolation | `audit/progressive/queues.ts`, `capacity.ts`, bounded parser and browser work | Preserve independent HTTP, browser, provider and evaluation progress. Isolation addresses real failure coupling. |
| Independent recovery | `audit/recovery-evidence.ts`, check assertions, supporting observations | Keep exact scope and original evidence. Generalize common mechanics while preserving specialized measurement semantics. |
| Commercial and ownership policy | Effective entitlements, shared monitoring commands and tenant queries | Reuse the current policies. Architectural simplification must preserve purchased rights, pauses and authorization. |
| Minimal customer views | Shared assessment and presentation functions | Keep the customer focused on watched scope, attention and next action. Technical accountability belongs underneath those views. |

BullMQ explicitly requires retryable jobs to produce the same final state when repeated. Our persisted intent and fenced commits are useful safeguards. They must also cover the external action itself when an operation can create an account, submit a form or send a message. [BullMQ idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs)

## Consequential weaknesses and changes

### Existing Site commands repeated URL identity admission

**Observed:** A background check could retain a claim after a customer paused monitoring, then admit work against the old schedule. The generic URL admission beneath existing Site commands could also restore a Site removed during preparation. Protecting only the scheduler's later schedule update did not protect the decision to start work.

**Implemented:** Existing Site commands now lock and validate their selected identity inside the shared admission transaction. New URL requests retain intentional creation and restoration. Scheduled work validates its exact saved claim against the same locked Site. Superseded or expired claims stop without recording a monitoring failure. Replays retain their original receipt and cannot restart work or overwrite a pause. This removes repeated hostname resolution from existing Site commands and reuses their existing transaction and execution ledgers.

**Contention:** A real PostgreSQL fixture exposed a raw `40001` serialization abort that escaped the shared Prisma conflict retry. The shared retry now recognizes the original SQLSTATE, retries the complete transaction within its existing bounds and revalidates the current decision. Other raw SQL errors remain failures. PostgreSQL requires retrying the complete decision, rather than just its last statement. [PostgreSQL serialization failure handling](https://www.postgresql.org/docs/16/mvcc-serialization-failure-handling.html)

### Historical interpretation depends on current implementation

**Implemented for current environment selection:** Disposable PostgreSQL cases
reproduced a newer staging analysis replacing production evidence in the Site
overview and account summary, including active, failed and legacy request-only
executions. The shared source selector now composes broad intent with the
existing environment-provenance boundary. Current Site reads and their broad
trend use production evidence; explicit run reads and activity history retain
other environments. A successful staging publication cannot certify an
unpublished production analysis. Configured Outcomes retain their own admitted
environment. This removes the separate unqualified source selections without
adding state, queries, a customer environment setting or an execution mechanism.
These are saved-evidence projection fixtures, not proof of website execution or
deployed environment isolation.

Forty-one disposable database cases and thirty focused contracts pass. An actual
in-memory MCP client/server read keeps production checks current and exposes the
staging checks through the existing historical cursor. Application type checking,
owned fixture types, scoped lint, worker build and module boundaries pass; prior
type diagnostics elsewhere in the larger integration fixture remain outside this
change.

**Observed:** Category coverage previously called `initialTaskPlan(spec)` while reading a result. The database already retains the task graph admitted for that run. Regenerating it can add new obligations to an old run or omit an obligation removed from today's planner. Separately, `requiredAreasForScope` and receipt validation consult current registry definitions. Some version differences intentionally require reassessment, but that must remain distinct from rewriting what an earlier execution did.

**Implemented:** Category coverage now traverses the recorded finalization dependencies. Missing tasks, unfinished dependencies, cycles and orphaned work prevent a complete conclusion. Settled recorded exclusions remain supported. Site, category history and run reads select the same dependency facts. The reader no longer imports the planner, and no additional manifest store was introduced.

**Implemented for published conclusions:** A disposable PostgreSQL reproduction confirmed that changing the current detector version changed a previously Clear timeline result into an incomplete result. New progressive Site and category comparisons now freeze their conclusion in the same immutable publication receipt. The descriptor retains the exact specification hash, original required areas, completeness, gaps, observation and validity times, and customer Flag membership through references to the comparison's original entries. Run and history readers share `sites/application/recorded-assessment.ts`; their separate broad and category evidence preparation was removed. Current Site and account-list assurance still requires compatibility with current rules. Historical conclusions and wording remain intact after detector upgrades and mutable source corrections, while expired run evidence exposes the original deadline as stale. Invalid supplementary conclusions cannot conceal valid comparison findings. No additional table, workflow or customer control was introduced.

**Remaining historical boundary:** Comparisons created without a recorded conclusion retain their existing evidence-based decoding. Reads do not manufacture an original verdict or retrofit today's policy into old publications. Policy that was never recorded cannot be recovered from those rows alone. Preserve supported historical decoders and retain explicit uncertainty when their original scope or meaning is unavailable. Future planner and detector changes should continue exercising retained executions and current reassessment separately.

### Monitoring responsibility is reconstructed across several records

**Observed:** `SitePage` stores discovered page identity. Broad execution admission carries `monitoringPages` forward from earlier execution specifications and actual `AuditPage` rows. Category admission snapshots a selected cohort. Explicit Outcomes maintain separate binding scopes and freshness. These mechanisms solve different parts of the product, but responsibility cannot be understood from one read.

**Implemented for page responsibility:** `sites/page-coverage.ts` derives the recorded page scope from admitted URLs, actual page observations and discovered browser task intent. Admission and the overview, account list, run, category and history readers now use that boundary. A page whose collection stops before creating its first row remains in the expected scope and in subsequent monitoring, even after its link disappears. The change reuses the existing task ledger and URL eligibility limits.

**Implemented for the claimed entry:** A native signed-claim reproduction found that first monitoring at the configured Site origin dropped the pricing URL used for its original analysis. Broad admission now selects source scope by owned Site and environment and validates its specification against that source's entry. The next execution retains the admitted entry and recorded cohort within the existing eligibility and page budget. Project identity and the original analysis remain intact.

**Implemented for independent admissions:** A second native reproduction found that a later signed claim into the same Site replaced an earlier entry's responsibility. Ongoing admission now merges scope from the existing broad execution ledger instead of giving the newest report authority to retire earlier branches. The latest admitted Site cohort keeps priority independently of collection status; compatible earlier entries, observed page rows, browser task intent and frozen monitoring intent fill the remaining existing budget. Scope survives failed or unfinished collection because an obligation is independent of a successful result. Category admission still requires its completed baseline. PostgreSQL projects and deduplicates the small scope records, with bounded transfer and continued paging past rejected URLs. Historical page intent is independent of obsolete binding configuration; new execution contracts still use current checks and bindings. No new persistence, scope manifest, queue or customer control was introduced.

**Implemented for historical task lookup cost:** A representative synthetic workload exposed 24,000 task-row visits to recover 400 browser obligations. The existing Audit-ID access path still filtered every unrelated evaluator row. A partial browser-scope index now isolates that lane without changing scope selection or adding another projection store. It keys only the Audit ID, keeping unbounded URLs out of B-tree tuples. A single concurrent migration avoids the normal index build's write-blocking lock. Local replay uses the installed Prisma 6 toolchain; populated-table proof holds one writer open and commits an independent write while the build waits. Historical source and page aggregation still depends on history size. This removes demonstrated unrelated-task work, not every possible cost of large histories. [PostgreSQL partial indexes and concurrent creation](https://www.postgresql.org/docs/16/sql-createindex.html)

**Implemented for navigation execution:** Focused reproductions found the shared planner and compatibility orchestrator merging an explicitly retained `/pricing/` with its healthy `/pricing` peer. The same discovery key also groups host, query, locale and fragment variants. Full-review selection now retains exact admitted navigation identities while preserving discovery grouping for new candidates. Both execution adapters consume that shared identity. The progressive graph already seeded frozen retained URLs correctly, and its native baseline passed; this is not evidence of a progressive retained-page failure. Planner selection and truncation now share one eligibility calculation instead of rebuilding the denominator separately. No collector, state store, customer control, depth or page budget was added.

**Comparison boundary:** RFC 3986 describes application-dependent URI equivalence and conditions aggressive trailing-slash equivalence on observed protocol behavior. FixFlags keeps discovery grouping as a budget policy and requires the admitted navigation for actual collection. That policy does not establish that two differently supplied URLs return different content, or authorize substituting one observation for another. [URI comparison and protocol-based normalization](https://www.rfc-editor.org/rfc/rfc3986#section-6.2.4)

**Implemented for browser-state admission:** A native anonymous request for
`/app/#/pricing` reached `/app/` instead. Initial admission stripped the fragment
before execution could retain it. A second reproduction showed monitoring
dropping an admitted route when another fragment on the same document became
the target. Browser URL admission now shares the existing safety parser while
preserving the navigation state. HTTP fetching, uptime and hooks keep their
document identity. Monitoring distinguishes admitted responsibility from new
discovery candidates. This removes conflicting uses of HTTP identity without
adding a collector, state store, router framework or customer control.

Observed SitePage and configured Outcome identities now retain those states.
Safe Form execution requires its exact authorized target and preserves hook
origin, version, dry-run and cleanup requirements. Finding ownership, Tracking
phase keys and the shared verifier scope cannot borrow another fragment's
evidence. Existing immutable comparisons remain unchanged, and missing
historical state cannot be reconstructed from an opaque old key. The existing
custom-router section-check limits remain explicit. HTML navigation can change
fragment state on the same document, so document equality alone cannot establish
rendered-state equality. [HTML fragment navigation](https://html.spec.whatwg.org/multipage/browsing-the-web.html#navigating-to-a-fragment)

**Implemented for customer URL submission:** Backend identity preservation was
insufficient while the shared URL form removed trailing slashes from the entire
input string. Four component reproductions showed it changing a path, query
value, fragment route and scheme-less supplied page before handoff. That rewrite
is removed. Existing scheme completion and safety validation remain, and the
existing dashboard resume path retains the destination across signup and
remounts. The canonical root slash stays visible. No presentation, copy, setting
or additional normalizer was introduced.

**Implemented for projected Site hostname continuity:** Four focused cases
reproduced apex and www observations disappearing from page projection or failing
to establish an automatic checkout start. Those consumers used exact hostnames
while Site identity and execution admission already treated the two hostnames as
aliases. Both now reuse the existing hostname comparison without rewriting the
observed URL. Separate paths, queries, fragments, host spellings and page IDs
remain separate execution facts. Other subdomains and lookalike domains stay
outside that Site. Credential grants and privileged fixture authority retain
their exact origin rules.

Two migrated PostgreSQL cases resolve the existing Site by URL and owner, then
exercise projection, page associations, automatic checkout binding, preservation of owner edits and subsequent Watch
admission in both directions. Their source observations and queue adapter are
controlled. They retain the original Audit, one Site identity and stable page
IDs. Inferred Signup still has no execution binding without its separate
authorization. Fourteen native authority regressions and thirty-one focused
contracts pass. No new normalizer, table, binding mechanism, queue, customer
setting or detector reset was introduced. These cases do not establish a fresh
website visit, successful purchase, external-provider acceptance or production
redirect behavior.

The existing signed-claim worker journey also passes seven actual application
executions through claim, automatic uptime, independent repair, recurrence,
operator reconciliation and cadence changes. Its fixture now checks the stored
provider interruption before expecting broad or narrow scheduled care. A broad
retry must collect browser evidence, and both paths must retain the availability
assessment, its cadence and prior history. An exhausted optional provider cannot
be treated as complete evidence merely to keep the fixture narrow. The separate
authority suite retains Outcome confirmation, withdrawal, target versioning and
tenant isolation.

Application and owned fixture type checking, scoped lint, the worker build and
module boundaries pass. The shared claim fixture retains six existing type
diagnostics outside the changed scope.

**Implemented for document-base navigation:** Public link resolution skipped
every raw fragment reference before applying the observed HTML base. A local
HTTP reproduction showed a base-directed missing document receiving no check.
The shared resolver now resolves first and excludes actual same-document
sections afterward. Parsed metadata retains the observed document address
separately from its link base, while native sections reuse their recorded final
URL. This prevents redirects from making normal sections consume another GET.
The existing strict metadata contract admits the optional address without
rejecting older evidence. Discovery and targeted repair share this decision.
Same-site limits, browser routing limits and request budgets remain unchanged.
[HTML document base semantics](https://html.spec.whatwg.org/multipage/semantics.html#the-base-element)

**Implemented for credential-bearing destinations:** The inventory normalizer
removed embedded credentials before the public HTTP boundary saw the URL.
A real HTTP case reproduced a request for the different anonymous resource,
which could become a false broken-link finding. Public destination parsing now
refuses embedded credentials instead of deleting them. Discovery grouping,
executable navigation keys and public link admission share that refusal. The
separate credential-stripping branch was removed. Explicit authorized capture
continues through its existing origin-scoped grant mechanism; a website link
does not create that authority.

**Implemented for public action interpretation:** Two native Chromium cases
reported no primary action for a working hash-router signup link and for a
fragment link whose active base addresses another document. Action selection now
uses the observed document and browser-resolved destination. The declaration
classifier is shared with static placeholder findings, journey entry selection
and destination controls. The obsolete `isDeadHref` wrapper is removed; a
declaration can be non-placeholder without proving that activation works.
Credential-bearing declarations remain outside automatic activation without
turning that refusal into a conclusive missing-action finding. Other public
controls remain independently eligible.

Custom route progression requires fresh native evidence. The existing primary
task compares bounded pre-click copy with the copy already collected by its
navigation observation. A matching route can prove a content transition through
changed text and a new heading on a ready surface without recognized loading or
missing-page content. Independently observed declared and semantic panels retain
their own conditions. URL-only changes, cancellations, gaps and unsupported
journey paths remain incomplete. No HTTP success or completed business outcome
is inferred. HTTP soft-404 inspection and native route qualification now share
the existing wording rule, without another scanner, queue, state store or router
framework. [HTML fragment navigation](https://html.spec.whatwg.org/multipage/browsing-the-web.html#navigating-to-a-fragment),
[HTML document bases](https://html.spec.whatwg.org/multipage/semantics.html#the-base-element)

Static `cta-dead-link` version 2, flow presence version 5, journey action version
6, journey path version 5 and destination control version 3 distinguish corrected
interpretation from a customer repair. Historical decoders and unaffected
headline, field, timing and response comparisons remain unchanged. Static
declaration evidence does not certify actual interaction.

**Implemented for page lifecycle:** That reproduction also found a collected page left Checking after its Audit completed because only the optional AI stage normally settled it. Progressive finalization now owns terminal page settlement from bounded, committed browser evidence. Unavailable media, AI or performance results remain gaps without erasing successful native collection. HTTP-only metadata, wrong page identity and uncommitted observations cannot manufacture success. Normal and exhausted completion share the same settlement, replacing the inconsistent category-only loop. No new lifecycle store, queue or customer control was introduced.

**Remaining:** Extend coherent responsibility selection to explicit bindings and operator freshness checks. Preserve exact navigation conditions, distinguish discovery candidates from committed responsibilities, and record intentional retirement separately from disappearance or collection failure. Introduce storage only if a demonstrated obligation cannot be represented reliably by the current records.

**Implemented for scheduled broad responsibility:** Six PostgreSQL reproductions
exposed an exact entry-URL predicate in the scheduler's freshness query. It hid
newer failed or exhausted analyses on another page behind older healthy root
evidence, and repeated broad collection when a different entry had already
covered the configured target. A further case reproduced narrow admission after
an older analysis was retained by a claim, although its admitted page was absent
from the latest successful collection.

Selection now starts from the owned Site's latest terminal production broad
attempt. Reuse checks its exact recorded page scope and the existing bounded
responsibility projection shared with admission. A new query, fragment, protocol
or port cannot inherit freshness through hostname identity. Retained unobserved
pages keep broad work due, while compatible evidence retains its original renewal
clock. No historical observation, customer setting, queue, schema, scheduler or
parallel responsibility store was added. Controlled database cases exercise
scheduling and admission, not successful webpage collection or production care.

Ninety-nine native database regressions pass across scheduled completion,
authority checks, retained responsibility and its populated-history workload.
That workload uses 24,001 synthetic task rows and retains the indexed bounded
read; those rows are not website observations. Forty-four focused contracts pass.
The signed-claim fixture separately completes seven actual application and worker
runs through default uptime, independent repair, recurrence, operator admission
and cadence changes. Its website and provider boundaries remain controlled.
Application and changed-fixture type checks, scoped lint, worker build and module
boundaries pass. Production fulfillment and provider acceptance remain unverified.

**Implemented for behavioral continuity:** Native worker reproductions exposed
two forms of the same responsibility gap. Claiming an analyzed entry into a
root-configured Site retained browser collection but lost the entry action.
Separately, a conversion category could find a broken action on a discovered
page, while the next broad Watch omitted that action. The latter case must run
at the next broad-care period; the existing fresh-check optimization correctly
avoids immediately repeating a recent broad analysis.

Admission now freezes specific page and public-behavior pairs in the existing
execution specification. One `publicPageBehaviors` policy supplies both that
snapshot and the task graph, including a queued category before its first task
rows exist. Current selection combines explicit broad entries, recorded broad
and category tasks, and valid frozen scope. Interrupted work retains its intent;
a repair cannot retire future monitoring. Public action, pricing navigation,
slow replay and journeys remain independent. The discovered-page action does
not cause unrelated slow replay or journeys to run. Bindings remain once per
Outcome and retain current authorization. Historical entry-role snapshots still
decode, while the entry-only writer and history reader were replaced. There is
no additional care table, queue, customer control or detector.

A populated workload first exposed about 24,000 examined historical task rows
for 800 behavior obligations. The shared partial index over Audit ID and work
kind now serves browser and behavior reads and retires the browser-only index.
URLs stay outside the B-tree key. Disposable migration replay and a held-writer
fixture establish ordinary write progress during the concurrent build. The
result examines about 400 browser rows and 800 behavior rows in 24,001 synthetic
ledger rows. These counts are approximate query-plan observations rather than
website executions, a latency guarantee or production capacity evidence.

Journeys consume their own committed page metadata rather than the report's
primary-page metadata. Provider accounting includes the entry URL, and timeline
read and merge share the existing fenced write. These changes prevent
cross-entry interpretation and lost updates without another projection.

Local native verification exercises category discovery, a due broad Watch,
unchanged verification, independent recovery and recurrence under the same
Improvement after the original link disappears. The earlier signed-claim action
and retained-entry walkthrough remain separate regression cases. Database
fixtures cover interrupted task intent, frozen scope before task creation,
historical entry decoding and rejection of unsupported or targeted scope.
Native retained-page slow replay, complete catalog behavior and deployed
monitoring remain separate requirements.

**Implemented for environment continuity:** A native database reproduction found
that legacy staging intent was included in production care and excluded from
staging when only the RunRequest retained its environment. A worker reproduction
also found a healthy production observation marking the legacy staging failure
Fixed without rechecking staging. Source selection, scheduled freshness,
comparison parents and diagnostic recovery history now share one provenance
rule. The physical Audit's explicit environment wins; otherwise its requests
must agree with each other and their frozen intent. Only unrequested legacy
history retains the production default. Ambiguous or malformed context stays
unavailable rather than borrowing another environment's evidence.

The same investigation found that Flag verification always defaulted to
production. It now derives the environment from the original fix attempt's
source, including receipt replay after later observations. Both the recorded
verifier and its original source must agree. Legacy Request-only page and
behavior snapshots survive in a bounded read projection without rewriting
history or reusing old authorization. No new customer setting, service, queue,
storage table or parallel workflow was introduced. Native SQL/ORM parity cases
cover missing, conflicting and malformed metadata; local worker cases cover
unchanged verification, independent repair, recurrence and the false recovery.
A later matching staging observation still closes that original staging failure,
while preserving its evidence and Request snapshot. These are controlled local results, not deployed care or provider acceptance.

**Acceptance:** A discovered page remains watched after its link disappears and after an interrupted collection. Claiming retains its identity. Pausing and resuming preserve the committed scope. Explicit retirement is attributable. Changing the plan cannot silently reduce an existing commitment.

### Result interpretation still spans several layers

**Implemented for concurrent repair results:** Two actual PostgreSQL
reproductions showed a delayed verifier overwriting a repair another run had
already settled. A saved success became failure, and a saved failure became
success. The shared Improvement lock serialized writes but the prepared attempt
was not revalidated when committing. Publication now conditionally writes only
pending or inconclusive attempts within that lock. A stale result cannot replace
the conclusive receipt or publish derivative status, history, telemetry or
learning. No additional lock, workflow, table or outcome model was introduced.

Four native service cases retain the first conclusive result in both directions,
allow later independent recovery from uncertainty, and preserve a successful
attempt when a new monitoring failure recurs on the same Improvement. Together
with atomic occurrence checks and the installed immutable-fix worker fixture,
seven selected migrated PostgreSQL and Redis cases pass. The worker fixture
performs three real executions; the race fixtures use saved observations and do
not establish website collection. Ninety-five unrelated guarded cases are
filtered out. The initial focused verification command passes 100 contracts.
Application and new fixture types, scoped lint, worker build and module
boundaries pass. Stale publication also leaves lifecycle telemetry absent.
Production execution, external providers and sustained care remain unverified.

**Implemented for retained console responsibility:** A migrated PostgreSQL
reproduction placed 101 newer unrelated console findings ahead of an older
delayed failure. The next Site admission discarded that page's recorded window
despite the compatible execution snapshot retaining it. Admission now starts
from those recorded per-page obligations and merges newly observed longer
horizons. Historical whole-run minima retain their fallback for later discovery.
Discovery can use recorded windows without those windows adding pages to the
task graph. A separate source-selection reproduction found Conversion preparing
console waits despite admitting no console evaluator. Preparation now follows
the same admitted check set as execution. This reuses the existing snapshot and
bounded query, preserving observation, repair and method semantics without
another collector, query, persistence mechanism, setting or interface change.

**Implemented for original recovery custody:** A focused comparison reproduction
showed a later healthy Site replacing an already fixed Flag's `resolvedInId`
with its own run. The comparison now leaves closed records intact and avoids
loading recovery receipts for them. It continues to evaluate every unresolved
condition against its own recorded scope. This preserves the original verified
repair, keeps continued health separate from recovery, and removes unnecessary
reads without adding state or another comparison path.

Four migrated admission cases retain scoped and historical whole-run windows
under saved-history pressure and keep Conversion free of unrelated console
preparation. Two native Chromium and worker scenarios pass: the established
partial-evidence and repair flow, and an isolated verified incident followed by
healthy Watch, 101 newer saved history rows and correctly identified recurrence.
Ten actual application/worker executions exercise these paths; the original
source captures use the explicit controlled-native custody helper. Saved history
rows are fixtures, not evidence of 101 website executions. Original observations
and the independent repair reference remain intact. Ninety focused admission and
category contracts and 102 comparison, recovery and console contracts pass.
Application types, owned fixture types, scoped lint, worker build and module
boundaries pass. Existing type diagnostics elsewhere in the large native fixture
remain outside this change. These results do not establish real-provider
behavior or production monitoring.

**Implemented for unreadable and unfinished obligations:** Focused reproductions
reported healthy Search after silently dropping malformed receipts or accepting
positive receipts from failed and running module rows. A healthy peer could hide
the unresolved page. The same pattern let unreadable page-module receipts vanish
behind collection summary bits. The shared Search receipt reader now governs
coverage and displayed results, checking recorded completion and page/Audit
ownership. Search retains unreadable obligations instead of dropping them.
The page-check decoder explicitly distinguishes unavailable data from supported
legacy observations; registered module gaps remain incomplete, including an
unfinished module beside a completed Audit. Readable historical assertions and
independent findings remain available. Current source selectors include the Audit
identity in their existing small receipt projection. Raw evidence and published
run conclusions remain unchanged. This replaces separate Search interpretation
without adding persistence, queries, collectors or customer controls.

Forty-one disposable database cases and seventy-eight focused contracts pass.
Eight new saved-evidence scenarios compare the Site overview, account summary,
displayed checks, original run and published history, then restore the original
usable receipt. Reads preserve both raw records and frozen publication. These
prove evidence interpretation and local database projection; they do not simulate
a website repair, a provider observation or production monitoring. Application
type checking, owned fixture types, scoped lint, worker build and module
boundaries pass. Older fixture type diagnostics remain outside this change.

**Observed:** `sites/coverage.ts` builds area facts; `assessment.ts` builds the Site conclusion; `category-evidence.ts` overlays newer category facts; `site-health.ts`, account lists and monitoring history supply additional inputs and presentation. The shared assessment function is useful progress. The remaining risk is disagreement in source selection, timestamps or completeness before those inputs reach it.

**Implemented for current Site evidence:** `sites/application/current-evidence.ts` now prepares the latest attempt, retained observations, current findings and applicable category evidence for both the overview and account list. Their separate coverage preparation was removed. A real saved-state fixture reproduced the overview showing Clear while the API withheld a conclusion during interrupted findings publication. Current views and category evidence now require their matching comparison receipt. Broad and category history use the same assessment rules at the original completion time and preserve the recorded findings after later repairs. Prior-observation reads omit comparison snapshots they do not consume.

**Implemented for category source selection:** A disposable PostgreSQL
reproduction showed a failed security recheck disappearing from the current
Site after a newer recheck of another inventory. The category then appeared
healthy from its older broad observation. Category reads now accept exact owned
broad-analysis references and match source, tenant, chronology and environment
before selecting the latest attempt per area. The overview, account summaries
and paginated check results all migrated. Older observations remain history,
and saved run conclusions remain unchanged. No additional read model, cache,
queue, table or customer control was added. Independent binding and category
reads now share the existing account-summary batch. Saved-state cases cover
other inventories and staging, matching multiple requested sources and refused
cross-Site pairs. Native workers separately retain category retry, repair,
recurrence and unrelated findings. These are local results, not production proof.

**Implemented for current watched results:** `sites/outcome-assessment.ts` now owns current binding comparability and effective validity for Outcome views and account summaries. A cadence change previously left an old weekly observation Clear after the policy became hourly. Current validity is now capped by both its original expiry and the observation time plus the current freshness window. Historical rows and run deadlines stay intact. Every cadence change requests a fresh check immediately, so slowing care does not leave short-lived evidence waiting a week for renewal. Repeated saves preserve the existing due work and lease.

**Implemented for current broad freshness:** A disposable PostgreSQL case reproduced three-day-old broad evidence remaining Clear on daily care beside a fresh uptime observation. Broad and category evidence now respect the current care cadence across overview, account summaries, overall assessment and Search presentation. Daily and subdaily schedules use thirty-six hours, consistent with broad collection's existing daily floor; weekly retains eight days. Longer custom schedules cannot extend the original eight-day maximum. Published history keeps its original deadline. The pure `sites/evidence-freshness.ts` foundation replaces the fixed age helper in coverage and moves existing binding freshness and broad scheduling calculations out of commercial entitlements. All consumers migrated. No stored status, schema, timer, customer setting or new database query was introduced. A fresh observation restores current assurance without rewriting the old run. Freshness is a separate service property from availability. [Google SRE service objectives](https://sre.google/workbook/implementing-slos/)

**Implemented for shared Outcome page projection:** A focused fixture reproduced 24 separate page lookups for a 24-Outcome list. It also reproduced a malformed cross-Site association appearing in projected page IDs and URLs. Outcome lists, details, confirmations and rename receipts now select the page URL and ownership fields through one shared relation shape. Their builder admits only the Outcome's current owned or provisional pages and preserves the supplied order. An old provisional link cannot borrow a page after ownership transfers. The old page-ID lookup helper was removed, along with its independent read and interpretation. The pure Outcome presentation, freshness, binding evidence and history rules remain in place. This removes demonstrated reader work without changing collection or adding a cache or another projection store.

**Implemented for bounded Outcome reads:** MCP previously read the Outcome summary list and reloaded each selected Outcome separately. It now uses one detail reader, also used by single-Outcome pages. A real SQL trace exposed a second problem in a direct ORM batch: per-parent `take` bounded the response but fetched unrestricted historical rows before trimming them. `outcome-references.ts` now selects the original bounded evidence IDs inside PostgreSQL, with separate per-Outcome and per-Improvement limits. The existing ORM hydrates only those IDs, and the existing pure builder presents their facts. The Site overview and account summary readers also use this foundation, selecting only their latest assessment and run without loading detail history. Last successful verification remains separate from recent history and excludes superseded observations. Hydration also rejects a selected success if a late writer superseded it in between the two reads. Run selections fetch only their five consumed fields, rather than repeated complete execution specifications. The per-Outcome detail reload loop and its separate query path were removed. No response evidence limit, detection rule, history capability, schema migration or projection store was added or removed.

**Implemented for category attention:** A customer-path review found the Pages category reporting healthy and “0 Flags” while its own count contained an open finding. The coverage summary had omitted category findings when deriving its conclusion. Its shared projection now receives the actual Pages findings and preserves their priority before evaluating collection, freshness or current activity. Other categories do not make Pages unhealthy. A disposable database case reproduces the contradictory saved-state read and verifies the corrected result without changing customer layout or adding another status store.

**Implemented for current uptime assurance:** Five disposable database cases reproduced a monitored Site remaining Clear with missing, unknown, pending-confirmation, offline or stale reachability evidence. Current owner views and account summaries now include uptime in their shared assessment. Confirmed fresh downtime uses the existing Offline label and attention treatment, including while another analysis is active. Missing or inconclusive current probes withhold Clear. A successful reachability observation removes only that constraint; it cannot repair another finding or establish the other capabilities. Flag counts remain actual Flags, and historical run conclusions stay unchanged. The shared `uptime/status.ts` projection now owns target matching, eligibility and freshness for both history/summary reads and the account list. Lists select current monitor fields and unresolved incident scope with their Site rows, without per-Site probe-history reads. Pages derives its own analysis activity from the recorded run rather than the overall Site result, so current downtime cannot hide an ongoing Pages analysis. No additional state store, scheduler, setting or visual element was introduced.

**Implemented for unresolved uptime attention:** A disposable application and
PostgreSQL reproduction confirmed that the incident ledger retained an open
outage after an inconclusive probe, while the Site overview and account list
downgraded it to could-not-verify. Current assurance had considered only the
latest observation. The shared uptime projection now also reads the existing
unresolved incident's target, generation and confirmation time. Summary/history,
account reads and MCP use one monitor selection and one current-scope definition.
An unresolved incident remains Needs attention while current reachability stays
Unknown, including after observation freshness expires. The assessment retains
the missing reachability evidence and does not manufacture fresh downtime or
additional Flags. Recovery, supersession, disabling Site care, target changes and generation
changes retain their own existing authority. Pausing broad analysis alone retains
independent uptime care. Historical open-incident counts can
still describe a previous target without making the new target unhealthy.
Native persistence and owner/MCP read scenarios retain the original incident and
notification through uncertainty, independently recover it and recognize
recurrence. Twenty-eight disposable persistence/scheduling cases and seventy-two
shared assessment, presentation and API contracts pass. Application types, the
owned fixture scope, scoped lint, worker build and module boundaries also pass.
No monitor writer, scheduler, table, cache, customer control or notification
policy was added. Controlled probe callbacks and provider delivery remain distinct
from production proof.

**Implemented for owner AI uptime evidence:** Code inspection found that the existing MCP Site reads returned no automatic uptime facts. A Site could have a confirmed outage without a browser Flag or configured Outcome for its AI to inspect. `list_sites` now reads the shared lightweight uptime projection with its existing account-scoped Site query. `list_outcomes` returns the same summary as the owner application, even with no Outcomes, and optionally returns the existing bounded probe and incident history through `uptimeWindow` and `uptimeCursor`. It includes the reachability scope and verification limit. History and check-result cursors remain separate. A typed cursor error and shared cursor schema replace duplicated validation and message-based error classification in the application route. Invalid history cursors return a schema-compatible read restart, without silently switching Site or target scope. No tool, privilege, monitoring writer, provider request or customer setting was added.

**Implemented for interrupted customer updates:** A local reproduction found that an older failed read could reinstate a cached error after a newer refresh had already published valid facts. The installed SWR implementation then suspended normal polling. Site reads now settle superseded attempts against their newest same-Site read before publishing either data or errors. A current failure cannot be replaced by an older success. HTTP reads also abort after fifteen seconds, allowing existing retry behavior to recover a stalled request. Navigation and schema validation remain the access and projection boundaries. The correction replaces the old sequence-only check with one ordering decision for the returned result, rather than adding another retry loop. These local defects are verified; the reported live disconnect still needs deployed-path observation. [SWR error handling](https://swr.vercel.app/docs/error-handling)

**Remaining:** Examine operational fulfillment and remaining capability evidence gaps. Current attention must retain independent repairs, while historical conclusions retain what each execution established. Keep scoped measurements and authorized provider evidence distinct; presentation may differ, but source selection must not silently change their authority.

**Implemented for observation availability:** A disposable PostgreSQL reproduction confirmed that reducing a finding to its Site seed dropped the unreadable-observation marker. The overview could show a confirmed Flag while the account list omitted the same source. Comparison reduction also dropped that fact before history and notification classification. The original storage boundary now validates the private observation contract, and reduced projections retain its small availability marker. Public observation summaries cannot replace private comparison rules or provenance. Important unavailable observations withhold both a confirmed finding and a Clear conclusion; optional recommendations do not invalidate independent verified checks. Repair guidance uses the same availability decision. Valid native observations and supported legacy findings retain their established behavior. The original evidence remains in its Flag row, without another payload store or customer control.

**Compatibility boundary:** New publications retain the availability decision they actually evaluated. Older immutable comparisons that never recorded it retain their historical decoding. Reads do not invent the original source state or rewrite those receipts. Availability is not proof that a source is complete, accurate or comparable for recovery; those remain separate evidence requirements.

**Acceptance:** Site overview, account list, category result, run API, history, notifications and available agent interfaces agree on the same underlying event. A new failed attempt retains the last success as history while exposing the current gap. No surface infers health from an empty Flag list.

**Implemented for repair-guidance origin and live readiness:** Native database cases reproduced pending guidance becoming unavailable, and unavailable guidance becoming pending, when a newer broad Audit had a different AI state from the finding's source. The Flag projection now reads the source Audit's small guidance state with its existing Flag queries. Current, durable, provisional, resolved and detail projections use the same builder. The later Site-wide reinterpretation was removed. Existing Site polling remains active while projected guidance is pending, even after analysis completion, and returns to its ordinary cadence when that work settles. Flag actions consume live readiness only for the same source Flag. A terminal state or changed guidance text refreshes the existing server-rendered explanation once per publication, preserving the customer's verification draft and the existing layout. No new customer control, endpoint, queue or pending-state store was added.

**Implemented for historical guidance updates:** An exact Flag can remain readable after a newer occurrence replaces it in the current Site projection. That historical detail now listens for settled prescription notices from its own source Audit through the existing Site connection. A validated reconnect requests catch-up as well. The notice requests a fresh tenant-scoped detail read; it cannot establish readiness itself. Unrelated sources, unfinished work and duplicate notices cannot change the historical guidance. The notice contract moved from the database application module into `sites/execution-events.ts`, shared by server transport and client parsing. Changing the observer does not replace the existing connection, and access revocation stops queued callbacks. Current findings keep their existing data-driven updates. No additional event connection, polling loop, endpoint or evidence store was introduced. Manual refresh remains available during transport failure.

**Implemented for composed Site resource ownership:** A focused customer-view fixture reproduced two simultaneous event connections on a Flag page, one for its analysis sidebar and one for its actions. Each also owned polling, refresh ordering and failure state independently. `SiteResourceBoundary` now gives that composed view one existing resource hook. Its consumers share validated reads, failures and one event connection, and subscribe to source notices without owning transport. Nested actions reuse the enclosing Site owner; standalone actions retain a local owner. A different Site receives a separate owner. Existing overview and settings views already have one owner and retain it. Removing a child does not close its siblings' connection. This removes duplicated responsibility without adding global connection registries, timers, endpoints or customer controls.

**Implemented for optional Search Console applicability:** A real worker fixture reproduced public Search becoming incomplete solely because a provider connection had never been configured. Google collection now separates configured page scope from credential availability. Unconfigured enrichment records NOT_APPLICABLE in the existing module ledger and keeps its provider observations unknown. Revoked, mismatched and expired Site grants remain unresolved applicable evidence. Explicit provider repair diagnostics still require that evidence and remain inconclusive without it. Historical account properties apply only to covered pages, without refreshing unrelated credentials; anonymous URL-first work does not read private provider configuration. Finalization and shared coverage honor recorded inapplicability without treating it as a successful observation. Independent public checks can complete, while connected failures and existing findings remain intact. No new status, configuration control, scope store or provider path was added.

**Implemented for sitemap URL identity:** Focused collector cases reproduced XML escapes becoming literal URL characters in both page inventories and child requests. A valid query page could consequently lose the positive listing evidence needed to identify a noindex conflict, while a child request used a different parameter name. The shared parser now uses the installed XML entity decoder explicitly, with single-pass predefined and numeric reference handling. CDATA and percent escapes retain their meaning; undeclared entities, prohibited characters and DTD declarations are refused. Parser resource limits remain unknown evidence. Collection and evaluation retain one interpretation, and historical requested-resource keys remain unchanged, so a detector correction cannot certify a customer repair. Six controlled application and worker executions verify affected findings, unchanged repair refusal, independent recovery and recurrence. [Sitemap escaping requirements](https://www.sitemaps.org/protocol.html#escaping)

**Implemented for active Search document scope:** Five focused cases reproduced inert template content becoming indexing exclusions, malformed JSON-LD findings and invalid Microdata or RDFa properties on active entities. Public Search now shares an active-document parser for page interpretation and structured extraction. It preserves the original evidence and the source fragment shape needed for RDF entity identity. Rendered section budgets exclude dormant descendants before counting them. Hidden published markup and active body robots directives retain their accepted meaning. Affected HTML observations use detector version 3, so a corrected detector cannot certify historical repair. The installed Search worker journey retains dormant directives and malformed template markup throughout actual failure, unchanged verification, independent recovery and recurrence, with owner API agreement. No additional collector, evidence store or customer control was introduced. [HTML template document boundaries](https://html.spec.whatwg.org/multipage/syntax.html), [Google robots directives](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)

**Implemented for canonical HTTP authority:** Focused cases reproduced a rendered document's HTTP 200 being reused for a canonical URL that had never been requested. A native Chromium fixture confirms that `history.replaceState` changes the captured address while a direct public GET to that target returns 404. Canonical collection now reuses only the original public HTTP response at an actually reached matching URL. Ordinary self-canonicals and observed redirect destinations still avoid duplicate collection; other declared targets receive a bounded public GET. Removing the rendered-response shortcut preserves the distinction between declaring a canonical and observing its response. Five actual application/worker runs establish the failure, unchanged verification, uncertainty after an interrupted target body, independent recovery and recurring identity, with owner API agreement. Published history remains unchanged. This does not establish Google's canonical selection or content equivalence. No new collector, cache, state or customer control was introduced. [History API behavior](https://html.spec.whatwg.org/multipage/nav-history-apis.html), [Google canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)

**Implemented for robots initial authority:** Five focused cases reproduced redirected rules becoming unknown across host, scheme and port changes, and another initial origin's response being borrowed as crawl permission. The parser now receives the recorded initial request URL; its fetch destination remains provenance. An explicit origin check applies before status interpretation, so a foreign 4xx cannot establish crawl permission. The correction reuses existing URL and redirect evidence, without another collector, cache, schema or customer control. Existing matching and attention semantics remain intact, including valid direct-rule recovery when the same robots request starts redirecting. Published history is unchanged. Six actual application/worker runs establish baseline permission, redirected regression, unchanged and unavailable repair refusal, independent recovery, recurring identity and owner API agreement. The distinction follows the protocol's initial-authority requirement. [RFC 9309 redirects](https://www.rfc-editor.org/rfc/rfc9309.html#section-2.3.1.2)

### Provider page identity was reduced to a display path

**Observed:** Connected Search facts retained their source URI, but page context
matched only a normalized path. Focused fact conversion and presentation reproduced
Search counts borrowed across trailing slashes, query variants, protocols and
Site hostname aliases. Analytics also collapsed distinct provider paths and
interpreted `(not set)` or a full foreign URL as a local path. A Site card called
a top provider row "this page" without establishing that relationship.

**Implemented:** Search context now matches its recorded URI. Analytics stores
its original page-path dimension in the existing fact scope and preserves that
path through conversion, persistence and reads. Its page-path aggregate remains
distinct from Search's URI and from Site audience totals. The obsolete shared
display-path normalizer was removed. Legacy Analytics page rows that lost their
original dimension remain stored without supplying invented page attribution;
new observations recover context through normal refresh. Existing context lines
identify their actual aggregation level without another customer surface or
settings decision. Provider scope follows Google's [Search URI](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
and [Analytics dimension](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema)
contracts rather than a universal URL deduplication rule.

**Verification:** Three focused reproductions first fail for borrowed Search
counts, collapsed Analytics paths and invalid page-context targets. The real
provider client, controlled transport and disposable PostgreSQL path then verify
refresh, original scopes, owner reads and retained unavailable context. Historical
ambiguous page rows remain unchanged, while independent audience context remains
available. These are local provider-contract and persistence proofs, not real
Google acceptance, website monitoring or catalog-wide completion.

### Operational health does not yet measure the full customer promise

**Implemented for independent due uptime work:** Real PostgreSQL row locks
reproduced a due monitor blocking the installed scheduler before another Site
could receive a probe. Merely skipping the later write still let the busy row
consume a batch of one on every sweep while locked. Selection now skips busy rows before its
batch limit. The guarded attempt update and target-generation synchronization
also yield if contention starts after selection. The original due intent remains
unchanged and resumes through the same dispatcher after release. The normal
path adds one bounded candidate query per sweep, rather than a transaction per
monitor or a held database lock across queue access. Atomic update predicates
retain ownership, target, pause, deletion, current due state and worker leases.

The change uses PostgreSQL's documented
[queue-oriented SKIP LOCKED behavior](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE).
Two installed-runtime cases first fail under physical row locks and then pass
with a batch limit of one, recording four controlled HTTP observations through
Redis, real worker execution and migrated PostgreSQL. Two further cases introduce
the lock after selection. Thirty-one final dispatch and persistence cases retain
pause, retarget, suspension, active lease, deletion and ownership-transfer refusal,
confirmation, incident continuity, recovery and unchanged commercial usage.
Existing reconciliation, initialization isolation and queue-interruption cases
also pass. Sixty focused uptime contracts pass. No table, lease field, queue,
retry mechanism, customer control or observation policy was added. Local
contention proof does not establish sustained production monitoring.
Application and new runtime-fixture type checks, scoped lint, worker builds and
module boundaries pass. The new selection barriers expose their await-only
contract rather than imitating Prisma transaction-array promises. The shared
service fixture retains five existing type diagnostics in unrelated clock and
MCP assertions; whole-file fixture type safety is not claimed.

**Implemented for setup isolation:** Two real PostgreSQL lock cases reproduced
ongoing care waiting for setup of an unrelated Site. The normal Site admission
sweep waited for automatic defaults, and uptime dispatch waited for missing
monitor creation. Both runtimes now schedule setup independently through their
existing timer guards. Due admissions and existing probes keep progressing while
setup is blocked, then setup resumes after release. Uptime initialization and
dispatch are shared operations; the explicit maintenance command composes them
without duplicating either implementation. Existing batch limits, cadence,
confirmation, retries, ownership, pauses and shutdown draining remain intact.
No queue, table, state field, recovery ledger or customer control was added.

Forty migrated Site scheduling and setup cases pass. The installed scheduler
admits a real existing Site request during the lock, resumes new-Site setup and
admits its first request on the next pass while retaining a paused Site. The
61-Site throughput fixture's controlled admission now performs its own guarded
schedule advancement, matching the current command rather than expecting a
second advancement in the outer sweep. Thirty-one uptime database and installed
queue/worker cases pass, including an existing probe during physical setup
contention and the new monitor's first observation after release. Their HTTP
responses and admission DNS are controlled. These cases establish local
execution and isolation, not production transport or sustained care.

The shared scheduling, worker, shutdown, default and admission command passes
171 focused contracts. Slow and failed setup cannot overlap its own batch or
stop due work, alerts and independent maintenance. Shutdown waits for admitted
setup while stopping intake. Production scheduling and provider acceptance
remain separate requirements.

Application and owned fixture type checking, scoped lint, worker build and
module boundaries pass. The two physical lock reproductions failed before the
dependency was removed and pass with the separated callbacks.

**Observed:** Readiness checks cover database access, migrations, Redis, worker acceptance, browser readiness, storage and configured providers. Admin operations expose overdue schedules and probes, unfinished work and failed notifications. These checks are valuable but do not measure the proportion of monitoring obligations fulfilled on time. A heartbeat can remain current while a specific lane stops making useful progress.

**Implemented for current deadlines:** Site monitoring state now checks the saved due date against the same five-minute overdue grace used by operations. Overdue work is Delayed even when no scheduler error was recorded. Operator summary counts and detailed queues share their eligibility predicates, so pausing broad analysis no longer hides independent uptime work or failed deliveries.

**Implemented for machine-readable operational gaps:** The existing worker diagnostic now reads overdue saved schedules, overdue uptime probes and failed notification records through those same predicates. A live heartbeat and idle queue can no longer mask these gaps. Their shared query moved from the admin layer into the Site application layer, and both admin summaries and the diagnostic consume its counts. The diagnostic reads one consistent, read-only database snapshot with bounded statement, lock and transaction waits. Missing evidence is unavailable, rather than zero or a confirmed overdue execution. Health and status now derive from one ordered set of problems, removing the former contradictory `ok: false` with `status: "ok"` browser state. The endpoint remains HTTP 200 and separate from deployment readiness. It exposes aggregate operational facts only, without another dashboard, queue or telemetry store.

**Implemented for notification responsibility:** Four actual Watch admissions
reproduced false overdue-email gaps while queued, capturing, checking or failed.
The PENDING marker was written at admission, before an observation existed to
classify. Classification, retry selection and the pending operational cohort now
share the completed-Watch source boundary. Completed partial results retain
classification responsibility. Recorded failed or uncertain deliveries keep
their own receipt authority, including historical source gaps. Manual admission
retains NOT_APPLICABLE. No receipt, provider body, due time, attempts, queue,
customer control or delivery semantics changed. Eighty-five migrated database
cases and seventy-four focused contracts pass, including the existing installed
scheduler, backoff and provider replay cases. These use controlled responses,
not real notification acceptance.

**Implemented for execution deadline accountability:** Six native database cases
reproduced healthy diagnostics for expired never-started work, missed stored
progressive deadlines and false alarms against permitted longer execution. The
diagnostic had applied the legacy start-time budget to every engine. Progressive
dispatch, task execution and expiry reads now share one recovery-window
foundation. Legacy execution keeps its depth-dependent budget and now includes
never-started work from creation time. The execution diagnostic reads the oldest
unfinished record and overdue count in one bounded read-only snapshot; database
contention becomes unavailable evidence. The route shares one clock with
monitoring and retains its response contract and readiness separation. No
execution budget, recovery behavior, state, timer or customer interface changed.
Native route fixtures use actual PostgreSQL and controlled healthy queue and
worker snapshots. They establish query and route behavior, not deployed worker
health or production care.

Ninety-six migrated database cases pass across actual route reads and scheduled
admission/completion. The fourteen route cases also pass in isolation, including
healthy states and native ledger contention. The shared queue/worker dispatch
regressions pass. Seventy focused route, admission and worker contracts pass.
Application and owned fixture types, scoped lint, worker build and module
boundaries pass. Diagnostic fixtures preserve any unrelated global execution
history and check their added responsibility instead of erasing other fixtures'
records. These checks do not establish production scheduling or delivery.

**Implemented for missing uptime setup:** A further native database case exposed the limitation of counting existing monitor rows: an established Site with committed monitoring, a future broad check and no uptime monitor still reported operationally healthy. The uptime obligation query now starts from active Sites and includes both overdue existing monitors and missing monitors for committed Sites after the Site-creation grace. Operator counts, their existing paginated uptime queue and machine diagnostics use the same Site predicate. Paused care without a monitor, removed Sites and inactive owners remain excluded. The existing `SITE_RECONCILE` action and normal uptime scheduler already own setup, so no additional initializer or state was added. Admitting the first probe clears the setup gap but leaves website uptime unknown until an observation arrives. Reads leave the Site and its history unchanged.

**Implemented for missing initial care:** A disposable PostgreSQL reproduction
reported healthy monitoring for an old untouched Site whose automatic setup was
still in retry backoff. Worker setup and operational reads now share one initial
eligibility predicate. Old eligible Sites enter the existing overdue schedule
cohort after the same creation grace, including deferred setup. Their existing
operator row shows awaiting setup without offering an unavailable due-run
action. Paused controls, prior attempts or observations, removed Sites and
inactive owners remain excluded. The normal upkeep path owns recovery. Native
execution through that path clears only the initial setup gap, while missing
uptime remains visible and no website success is claimed. No query, timer,
schema, diagnostic field, metric or customer interface was added. This removes
the diagnostic's dependence on setup having succeeded before responsibility can
be counted.

The combined migrated database command passes 134 admission, completion,
scheduling, setup and delivery cases. The actual monitoring-control command now
establishes the existing stopped-care fixture, preserving its real pause receipt.
Another 113 focused contracts pass. Application and owned fixture types, scoped
lint, worker build and module boundaries pass. These are local execution and
saved-state proofs; they do not establish production fulfillment or notification
acceptance.

**Implemented for inconclusive uptime fulfillment:** A real PostgreSQL case reproduced healthy diagnostics despite fifteen minutes of on-time UNKNOWN observations. The existing monitoring read model distinguishes overdue work from sustained inconclusive observation. Its indexed query requires an active current monitor, recent unknown or pending-confirmation state, older evidence for that exact target generation and no ONLINE or confirmed FAILED observation within the existing ten-minute freshness window. A new target or short uncertainty retains grace. Previous generations, different targets and future observations cannot establish current coverage. The diagnostic exposes `inconclusiveUptimeSites` separately from `overdueUptimeProbes`. The existing operator uptime queue and summary share the same Site cohort and show each Site once, with overdue work taking precedence. Their repeated monitoring count preparation was removed. No new state, table, index, timer, website incident, notification or customer interface was introduced. Operator consumption and sustained production observation remain external requirements.

**Implemented for unconfirmed uptime evidence:** Actual scheduler and executor
cycles with controlled observations reproduced healthy diagnostics after repeated
FAILED primary probes and UNKNOWN confirmations. The public state remained
checking or unknown, with no confirmed incident. The shared operational query
now requires the existing confirmation marker before treating a failed probe as
conclusive assurance. Pending-confirmation state retains the same sustained-gap
test. A recent ONLINE observation still supplies grace, and genuine ONLINE or
confirmed failure clears the gap. The existing diagnostic, operator queue and
summary agree without changing confirmation rules, observations, incidents,
notifications, schedules or customer presentation. Two native PostgreSQL cases
exercise seventeen scheduler/executor observations across both recovery paths,
retain raw history and prove no incident or notification is invented during
uncertainty. Their queue adapter and observations are controlled. Twenty-five
native read-model cases and forty-one focused contracts pass. Together with
diagnostic, scheduled-completion and uptime persistence regressions, 110 local
integration cases pass. The installed TLS worker retains its twelve observations
through confirmation, interruption, independent recovery and recurrence.
Application and owned fixture types, scoped lint, worker build and module
boundaries pass. Production confirmation, provider behavior and sustained care
remain unverified.

**Implemented for uptime obligation eligibility:** Two disposable database cases reproduced healthy diagnostics for an overdue inactive monitor on committed care, and a false overdue gap from an obsolete enabled monitor after care was fully off. The shared operator cohort now derives responsibility from the active Site's saved care, matching scheduler and owner-status eligibility. Monitor activation no longer overrides the commitment. Due-time grace remains unchanged, and a pause of broad analysis retains independent uptime. Ordinary scheduler admission reactivates and dispatches the inactive monitor without inventing a successful observation. No new counter, state or recovery path was added. Fifteen native PostgreSQL cases and twenty-two focused contracts pass, with clean type checking, scoped lint, worker build and module boundaries. The new scheduler proof stops after controlled queue admission; it does not establish a network observation or production monitoring.

**Implemented for certificate refusal evidence:** The installed uptime worker reproduced an expired peer certificate being saved as unknown, without entering confirmation or incident creation. The existing probe classifier now recognizes explicit Node/OpenSSL certificate failures and records a precise reason. Unknown issuers and local TLS configuration remain inconclusive. The ordinary two-observation confirmation, incident continuity, recovery and recurrence now apply without another certificate scanner, scheduler or storage system. Existing history details display these reasons, with no invented HTTP response. Eight real TLS observations through disposable PostgreSQL, Redis and the uptime worker verify expiry confirmation, uncertainty retaining the same incident, hostname mismatch, untrusted self-signed refusal, independent successful recovery and a later expired-certificate incident. No browser session or analysis credit is used. This is observed TLS reachability from the monitoring location, not proactive expiry prediction or comprehensive certificate assurance. [Node certificate error definitions](https://nodejs.org/download/release/v22.23.3/docs/api/errors.html#openssl-error-codes)

**Implemented for URL-first certificate findings:** Focused collection and evaluator cases reproduced the same peer refusal disappearing from public analysis before Security evaluation. The existing HTTP document now retains a typed refusal and the attempted redirect destination. One shared classifier supplies analysis and uptime, while one registered Security evaluator supplies findings and observations to progressive and compatibility callers. Its HTTP input replaces the planner's Security exception, and the separate progressive evaluation and secondary observation branch were removed. Known refusal evidence no longer incurs generic HTTP collection retries. A native Security finding supplies repair guidance and exact original-request comparison without requiring a browser, private capture storage or an AI provider. Unknown transport evidence and an HTTP downgrade cannot certify repair. Six installed application/worker runs verify the original redirect scope, useful owner handoff, refusal of unchanged and uncertain repairs, independently observed HTTPS recovery, recurrence and agreement with the owner run API. The existing signed-claim and monitoring journey still completes seven actual executions. No additional scanner, queue, table, settings surface or parallel recovery mechanism was introduced.

**Implemented for interrupted response bodies:** Five native HTTP cases reproduced response facts disappearing after an interrupted stream, a body deadline or corrupt file decompression. The bounded transport now preserves the already observed status, headers, reached URL and redirect chain with incomplete body evidence. Public analysis stores that partial document in its existing HTTP artifact, so independent header checks can progress without generic missing-response retries. Complete content and sitemap conclusions remain unavailable; other whole-body consumers retain their existing error path. Uptime retains the response facts while classifying the original error, so incomplete HTTP 200 evidence cannot recover an incident. Six actual URL-first application/worker runs verify real header findings, one collection attempt, refusal of unchanged, missing and challenged repair evidence, independent header recovery and recurring identity. The native TLS uptime fixture separately retains the same incident through a broken body, then requires a complete HTTPS response before recovery. No new collector, queue, table or customer control was introduced. [HTTP incomplete-message requirements](https://www.rfc-editor.org/rfc/rfc9112.html#section-8)

**Implemented for stalled alert acceptance:** Native database cases reproduced healthy operational snapshots while an old alert remained PENDING with no provider attempt. The shared operational predicate now includes pending alerts beyond the existing monitoring grace and SENDING receipts with expired leases. Historical claims without a lease use the original observation or due time and the same grace. A completed Watch observation takes precedence over Audit creation time, so a long analysis is not immediately a late notification. Active delivery ownership and fresh pending work remain excluded. The diagnostic's notification aggregates are named `undeliveredUptimeAlerts` and `undeliveredWatchAlerts`, and the existing operator summaries and queues describe notifications needing attention. Queue rows retain the distinction between delivery failure, waiting and overdue confirmation. Reads never rewrite a receipt, consume an attempt or invent provider acceptance. No separate monitoring store or customer interface was introduced.

**Implemented for recovery isolation:** Legacy Audit recovery, completed findings publication and expired Site run reconciliation now run in independent scheduler callbacks and distributed claim windows. Their former sequential chain allowed one failed or slow operation to stop the other responsibilities. Individual legacy candidates also fail independently. The completed-publication sweep excludes live claims before limiting its batch and orders by existing execution activity, so repeatedly broken oldest results cannot monopolize every pass. Native PostgreSQL cases demonstrate later publication, eventual recovery of the interrupted original and preservation of incomplete evidence after successful publication. The change reuses existing execution leases, timestamps, timer guards and projectors rather than adding another recovery ledger.

**Implemented for run recovery eligibility:** The expired-request sweep now excludes physically owned progressive work before limiting its batch. The same predicate governs per-Site selection and the terminal write, including explicit null handling for historical execution metadata. Previously 100 active physical executions could indefinitely hide an abandoned request, and legacy JSON nulls could prevent abandonment from committing. Native PostgreSQL fixtures reproduce both defects, reach the later work and preserve newly acquired physical ownership or completed observations during the guarded write. No new recovery state was added.

**Implemented for admission throughput:** A redundant global four-minute rate window and five-minute timer limited all workers to one batch of 20 due Sites. Site admission now runs bounded passes every thirty seconds, starting five seconds after worker initialization, and relies on the existing per-Site database claims and admission transaction. The local callback still cannot overlap itself. Plan cadence, independent uptime and the five-minute lateness grace remain separate. No new queue or scheduler record was added, and the global Site-admission rate window was removed. Real SQL races selecting the same cohort prove once-only admission even with identical attempt timestamps. An installed-scheduler fixture advances 61 due Sites in four bounded passes before the grace expires, controlling downstream admission rather than pretending to execute their websites. PostgreSQL rechecks conditional updates against concurrently committed row versions; the fixture verifies our actual predicates rather than relying on that general guarantee alone. [PostgreSQL transaction isolation](https://www.postgresql.org/docs/16/transaction-iso.html)

**Implemented for retry-backoff accountability:** Native PostgreSQL fixtures
reproduced healthy diagnostics after failed and exhausted scheduled checks moved
their retry dates into the future. The shared operational cohort now retains
those interrupted obligations separately from overdue schedules. Existing operator
rows and summaries count the disjoint cohorts once; future retries do not offer
an ineffective reconciliation action. The diagnostic and standalone summary now
share the same bounded read-only snapshot, removing an independent non-atomic
counting path. Actual scheduler admission and completion projections preserve the
gap through re-admission and clear it after successful completion, while an
unreconciled notification remains a separate gap. Reads retain the original
schedule, Audit and delivery evidence. No scheduler, stored status, customer
control or additional operator panel was added. Controlled terminal transitions
prove this projection, not webpage success or provider acceptance.

**Implemented for observation-time uptime assurance:** A database reproduction
returned Online beside an empty timeline because current status accepted a future
observation that history excluded. The shared state rule now rejects future and
invalid times. One incident predicate governs current selection and counts:
confirmation must be available, and future end times cannot hide an earlier
confirmed outage. Site lists, uptime history and MCP reads use the same captured
clock. A controlled uptime executor establishes failure, confirmation and recovery;
real application and MCP reads retain attention when the read clock precedes that
recovery, then expose the original recovery when it becomes available. Future
confirmations remain unknown. Raw monitor, probe, incident and historical run
records stay unchanged. The implementation adds no persistence or background
work. Production clock behavior remains outside this local proof.

**Remaining:** Measure monitoring fulfillment from due commitments, including missed work in the denominator. Track observation freshness, time from confirmed failure to notification acceptance, and time to a conclusive repair attempt. Alert operators on sustained gaps. Build on the bounded operational query and existing task, schedule and notification ledgers before considering a new telemetry service. Keep these operational details out of the customer interface.

The current-gap snapshot is an initial detection boundary, not an on-time fulfillment percentage. It accounts for missing initial care and missing monitors on committed Sites, but production still requires evidence that every eligible historical Site receives initial care, that a queued notification reaches its recipient, and that an external observer consumes the diagnostic. Prometheus recommends monitoring the monitoring system and favors a complete alert-delivery probe over component health alone. An independent observer and controlled delivery proof remain operational acceptance requirements. [Prometheus alerting guidance](https://prometheus.io/docs/practices/alerting/)

Targets should be agreed from customer expectations, plan cadence and demonstrated capacity. Arbitrary availability percentages would conceal the actual service obligation. Google explicitly includes freshness, correctness, quality and coverage among useful service indicators. [Google SRE service objectives](https://sre.google/workbook/implementing-slos/)

**Acceptance:** A live worker with a stalled lane is detected. Lost queue deliveries are recovered from persisted intent. Sustained provider unavailability appears as a coverage gap. A failed notification is visible to operations without a customer opening the app. Production acceptance includes observation over the actual scheduling window.

**Implemented for retained monitoring renewal:** Four disposable PostgreSQL
reproductions found weekly, daily, hourly and custom schedules extending the
lifetime of reused broad evidence by another full interval. A separate case
reproduced an older completed source narrowing recovery of a newer failed broad
attempt. Admission and schedule advancement now share one bounded source policy.
The newest terminal attempt must be completed without exhausted work before it
can be reused; a narrow run retains the broad source's original renewal clock.
The locked schedule transaction caps its next date at that clock and preserves
the chosen date in the existing schedule receipt. A missing source leaves broad
work due. The original cadence, daily collection floor, authorization, retry
backoff, independent uptime and published evidence remain in place. This removes
the separate scheduling interpretation without adding a timer, table, stored
status or customer control. Native database fixtures verify subsequent broad
admission and retain original source and schedule records. Controlled terminal
states establish scheduling behavior rather than webpage success or production
monitoring.

Sixty-one migrated database cases and eighty-nine focused scheduling and Watch
contracts pass, including existing pause, ownership, rollback, replay and backoff
cases. Application type checking, owned fixture types, scoped lint, worker build
and module boundaries pass. Earlier fixture type diagnostics outside the new
cases remain excluded.

**Implemented for empty scheduled selections:** Three database reproductions
found fresh broad evidence plus disabled Outcomes, disabled bindings or
supporting-only bindings attempting an empty Outcome run and entering failure
backoff. Both scope readers now share the required-binding predicate. The same
locked authority boundary used by schedule commits rechecks an empty selection
and retains the original broad renewal without creating execution or advancing
observation time. A changed source or newly enabled binding enters ordinary
admission. Disabling responsibility can retire its old failure streak without
inventing a successful check. Uptime remains independent. No timer, persistence
mechanism, status or customer setting was added.

The combined migrated PostgreSQL command passes 104 cases across admission,
completion and Watch scheduling, including ownership, pause, expiry, concurrent
selection changes and stale replay. Eighty-nine focused contracts pass.
Application and owned fixture types, scoped lint, worker build and module
boundaries pass. Controlled saved completions and an uptime callback establish
local scheduling and projection behavior; they do not establish production
monitoring or real-provider acceptance.

### Notification replay must respect external deduplication retention

**Observed:** Watch and uptime correctly retained immutable provider bodies and stable delivery keys, but treated those keys as safe for an arbitrarily late retry. Resend retains keys for 24 hours. Native database fixtures reproduced both senders contacting the provider again after a 25-hour interruption. A process lease protects current ownership; it cannot extend the provider's external deduplication window. [Resend idempotency retention](https://resend.com/docs/dashboard/emails/idempotency-keys)

**Implemented:** The shared notification snapshot records the first-attempt time for each immutable delivery, committed with its existing claim. Both senders require their complete bounded provider request to fit within retention, including a second check after database admission. Expired ambiguous work remains failed with acceptance unconfirmed, without inventing success or rotating its key. Legacy snapshots use the original observation time as a conservative lower bound. New first deliveries use their actual preparation time, preserving delayed initial delivery. Watch selection changes keep their own times, including restoration of an older uncertain selection. Metadata remains private to the existing ledger and never enters the provider body. Attempt ceilings, recipient authorization and ownership fencing remain unchanged. No new queue, scheduler, status or customer control was introduced.

**Implemented for backlog recovery:** Watch retries no longer share a service-wide four-minute rate window and five-minute timer. Their existing ledger now owns a nullable retry due time, supported by a migrated index. Bounded thirty-second passes filter due work and inactive claims before the batch limit. Historical nulls remain immediately eligible. Both the direct sender and its conditional claim respect the selected due time. Failure backoff is shared with uptime and begins at the actual failure, independently of scheduler cadence. Classification failures defer briefly without consuming provider attempts, with the selected status, attempt, lease and due time fenced against concurrent changes. Oldest activity ordering retains fairness between new and failed alerts. The local timer still prevents overlapping passes, and per-alert SQL claims retain cross-worker ownership. No retry queue or additional scheduler owner was introduced.

**Implemented for shared provider capacity:** A disposable SDK fixture reproduces 24 requests within one second from separate web and worker clients. Resend's default allowance is ten requests per second across team API keys. The shared SDK boundary now uses the existing atomic Redis lock to pace requests at 125-millisecond intervals. Automatic-account receiving retrieval uses that same admission. Waiting is bounded to five seconds, cancellation survives admission and an unanswered Redis command cannot authorize a late physical request. Notification deadlines include the wait, and stored bodies, delivery keys and retry ownership remain unchanged. This removes uncoordinated admission across the existing channels without adding a delivery queue, scheduler, schema or customer setting. [Resend usage limits](https://resend.com/docs/api-reference/rate-limit)

**Remaining:** Actual team allowance, API consumers outside this application, real-provider acceptance, inbox behavior and sustained production delivery require authorized external verification. Local controlled transport establishes admission, ledger and scheduling behavior rather than production delivery throughput.

### Public transport failure had different authority across capabilities

**Implemented for incomplete public destination content:** Three native HTTP
cases reproduced truncated HTML becoming a successful public-link response,
including a sign-in path. A real application/worker journey then marked an
unresolved missing page IMPROVED after its error heading moved beyond the
collector's former 20 KB prefix. The collector now preserves its selected completeness boundary
through classification. Positive missing-page evidence inside the prefix still
fails; absent evidence outside it remains unknown. Public links, action responses
and page responses share one positive GET predicate instead of separately
promoting status 200. Explicit HTTP-only checks and binary resources keep their
own observation scope. Existing detection thresholds, network admission
and historical evidence remain. No extra request, collector, queue, setting or
interface was introduced.

The native worker scenario passes nine actual admitted executions through
Chromium, migrated PostgreSQL and Redis: source discovery, unchanged repair,
encoded missing-page content, a missing heading after 100 KB of script, restriction,
removed declaration, truncated content, complete repair and recurrence. Both
observed missing pages remain comparable failures; the response above the
document bound remains incomparable. None resolves the original Flag. Complete
repair after a 100 KB prefix succeeds despite dormant error content and
recurrence retains the original Improvement. Native transport and consumer
contracts pass 177 distinct cases, including historical-read contracts. These
checks do not establish production transport or real-provider behavior. Full-review
fixture waits permit 60 seconds after diagnostics showed live queued work
exceeding the former 25-second gate. No production execution deadline changed.

Application type checking, scoped lint, the worker build and module boundaries
pass. The changed test code has no scoped type diagnostics; the shared native
fixture still has 44 existing diagnostics outside this change.

**Implemented for public document interpretation:** Nine native HTTP cases
reproduced raw tag matching turning healthy responses into missing-page findings
and encoded error headings into successful responses. An actual worker attempt
also falsely marked an encoded missing page IMPROVED. Public response inspection
now reuses Search's active-document parser, excluding dormant and raw-text
headings while decoding published character references. The original vocabulary
and text windows remain. Public links use detector version two;
the existing comparison guard refuses repair across the interpretation change,
and retained historical conclusions still use their recorded versions. This
removes another independent HTML interpretation without adding collection,
infrastructure or customer controls.
[HTML syntax and document boundaries](https://html.spec.whatwg.org/dev/syntax.html)

**Implemented for useful bounded destination coverage:** Thirteen of 21 existing
website fixtures exceed the former 20 KB destination-body limit. Native HTTP
replay of three archived fixtures, and healthy and missing pages behind a 100 KB
script prefix, reproduced inconclusive observations despite complete responses
within the standard public-document allowance. The transport now selects its
body budget once from the final response. Successful content-sensitive HTML
uses the shared 1 MB document allowance. HTTP-only checks, non-HTML resources,
error responses and header-declared challenges retain the 20 KB prefix. Search
and the default public transport reference the same document-bound constant.
Oversized or interrupted content still cannot certify absence. Native unending
response fixtures prove early cancellation for prefix-only work, and an invalid
budget closes the response and releases ownership. Redirects retain final-response
selection. This adds no request, collector, cache, queue, schedule, schema,
detector reset or customer decision. Archived fixtures establish local behavior,
not current behavior of those public websites or production capacity.

**Implemented for independent destination progress:** A native HTTP reproduction
left later healthy and missing destinations unobserved while one stalled request
held a fixed-batch barrier. A second controlled adapter interruption discarded
the entire collection. Bounded workers now reuse individual free slots and retain
results in their original order. Interrupted observations remain unknown while
independent responses survive. The existing native HTTP ledger records unavailable
destination results explicitly, using the same representation as unavailable image
responses. Recorded replay restores the same uncertainty and findings without a
new request; missing input still fails custody validation. No extra request,
parallel scheduler, concurrency allowance, schema migration or detector reset was
introduced. Native HTTP fixtures retain the selected two-request bound, discover
the later failure within the original deadline and preserve exact scope. Sixty-one
focused contracts and the nine-admission application/queue/worker scenario pass.
Application and owned fixture type checking, scoped lint, the worker build and
module boundaries pass. The replay regression also rejects absent recorded
inputs after per-destination interruption handling.
These establish local behavior, not production throughput or provider acceptance.

**Observed:** Uptime recognized native DNS, connection, timeout and peer-certificate failures, while the default page-load binding discarded every request exception. Conclusive failures became retryable missing evidence and eventually unknown Outcomes. A successful response with missing rendered content also received a generic finding incorrectly describing an unsuccessful response.

**Implemented:** `audit/http-failure.ts` owns the existing transport-failure decision, migrated out of uptime. Rendered availability now uses that same classification and its existing independent confirmation attempt. Unknown trust, local configuration, DNS uncertainty, safety refusals and generic execution errors retain their interrupted-observation recovery. A failed confirmation followed by uncertainty cannot create a Flag. Selected transport facts retain provenance without native errors. Cause-specific guidance reuses the existing certificate copy; missing rendered content receives its own accurate explanation. Recovery still requires the same binding's fresh HTTP and rendered observations. No check, collector, queue, retry owner, schema, customer setting or privileged operation was added. Published evidence stays unchanged.

**Verified locally:** Four focused cases first reproduced lost conclusive failures. Seventy-five shared uptime and binding contracts pass, with seventy-five guarded native cases skipped by that command. Additional catalog, incident, TLS and binding boundary checks pass. Twelve actual application/worker runs cover six public Security scenarios and six default-availability scenarios, including HTTP 200 with missing rendered content, unchanged and uncertain verification, independently observed repair, owner API agreement, recurring Improvement identity and unchanged historical assessment. The separate uptime queue/worker scenario passes twelve real TLS observations across incident confirmation, uncertainty, interruption, recovery and recurrence. Its controlled clock now explicitly crosses a regular slot boundary monotonically, rather than occasionally moving backward after confirmation. Recent conclusive evidence retains its full grace window. Type checking, scoped lint, worker build and module boundaries pass. These fixtures use disposable local services and controlled Chromium response routing. DNS, connection and timeout classification cases remain controlled inputs, and production monitoring and real-provider acceptance remain unverified.

### Execution scope and cost need one coherent dependency model

**Implemented for deeper discovery:** Two real local HTTP cases reproduced a
full 120-link first-page inventory consuming the second discovery budget again.
A broken destination declared on a newly discovered page was never requested.
The second phase now selects conclusive exact-request facts from its completed
first dependency in the same Audit and spends its unchanged new-request budget
on remaining destinations. It reuses the existing private native HTTP evidence
format, preserving hashed request conditions, the originating task and its
observation time. Unknown, repeated and unavailable facts remain eligible for
fresh collection. Foreign or unreadable checkpoints cannot supply evidence.
The original checkpoint stays unchanged, and new analyses still collect fresh
GETs. No global cache, queue, table, browser visit or customer control was added.

Five migrated PostgreSQL and local HTTP cases pass. The full first inventory
needs 121 total requests to inspect its deeper failure, compared with 240
requests that previously never reached that destination. An uncertain response
is retried and remains unknown beside the independent failure. Fresh analyses
observe repair and recurrence; missing, foreign and unsupported checkpoints
cannot borrow first-pass facts. These cases use controlled saved browser inputs
and actual local HTTP bodies. Seventy focused HTTP-evidence, destination, graph
and review-plan contracts pass. With interruption replay and the installed
browser/worker public-link regression, seven selected integration cases pass,
including nine actual application/worker executions. The worker preserves
unchanged and restricted repair evidence, positive recovery and recurring
Improvement identity. Another 127 unrelated guarded cases are filtered out.
These checks establish local execution, not production capacity or transport.

Application and owned fixture types, scoped lint, worker build and module
boundaries pass. Historical checkpoint shapes remain readable, with missing
native facts retaining the bounded fresh-collection fallback.

**Observed:** Page plans enumerate collectors, evaluator modules, Search, Google context and actions. Category and diagnostic plans then select dependency closures. Shared browser collection runs through the broad `captureScreenshots` machinery even when media is disabled. The legacy runner also retains orchestration beside progressive execution. This makes scope, resource cost and compatibility behavior harder to follow.

**Implemented for dispatch ownership:** Native queue fixtures reproduced a customer Run becoming failed after its Audit had already entered execution, or after a newer dispatcher replaced the producer's claim. The old producer's guarded Audit transition correctly refused the write, but its subsequent Run reconciliation ignored that refusal. Reconciliation now requires the committed transition. An undelivered admission still owned after expiry retains its expected failure. The started case exercises the real execution claim and fenced database commit through a controlled Redis consumer, stopping before website collection. This uses the existing ownership decision without another state, transaction owner or retry mechanism. An uncertain acknowledgement cannot establish that an operation did not happen. [AWS timeout semantics](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)

**Implemented for scheduled execution ownership:** Native database cases
reproduced two stalls from a scheduler-only Audit status check. It blocked replay
of an already queued receipt after interruption before schedule advancement,
and it kept deferring care for abandoned legacy or terminal-request history.
Current scheduled admission now uses the shared RunRequest ownership and replay
rules. The compatibility guard retains actual physical leases and progressive
recovery windows without treating a status string as ownership. Contention has
a structured admission reason and retains the existing bounded retry without
counting an execution failure or clearing earlier failure information. Failed
retry persistence cannot stop another Site in the batch.

A related shared-recovery reproduction found an expired legacy request marked
abandoned while its physical Audit still held a live lease. Active selection
and reclamation now respect that lease across manual and scheduled callers.
The recovery candidate query, read check and conditional terminal write use the
same boundary, including a physical renewal after selection. Request recovery
now uses the existing physical expiry transition to fence an unowned legacy
Audit before settling its request. Delayed queue delivery cannot restart that
retired execution. The prior RunRequest-only abandonment left the Audit queued
or mid-execution. Global expiry and scoped request recovery now share the same
conditional physical transition; progressive handoff and completed observations
retain their ownership. The decision compares token, generation, status and
lease on the Audit row itself, following PostgreSQL's concurrent-update boundary.
[PostgreSQL transaction isolation](https://www.postgresql.org/docs/16/transaction-iso.html)
Completed observations remain reconcilable before final lease release. Old evidence and
request receipts remain intact. No new lifecycle store, queue, timer, customer
control or repair workflow was introduced. Disposable PostgreSQL cases cover
ownership, replay, abandonment, concurrent renewal and schedule fences; the
signed-claim worker journey separately retains monitoring, repair and recurrence.
These are local proofs, not sustained deployed care or provider acceptance.

**Implemented for failed scheduled receipt replay:** A native PostgreSQL
reproduction found an interrupted weekly tick replaying a failed receipt as a
successful enqueue and advancing another week. Replay now requires an available,
non-failed execution on the same Site, including reuse returned after concurrent
admission. Failed or missing executions enter the existing scheduler backoff.
A second reproduction found retry still blocked by a future request lease after
its Audit had failed and released physical ownership. Candidate selection,
conditional settlement and the global recovery sweep now share a single rule
that includes released terminal Audits regardless of that older request lease.
Completed observations reconcile to their original result; live physical leases
remain protected. Repeated inline recovery predicates were removed.

Native acceptance exercises controlled queue refusal through the real
dispatcher and recovery-budget exhaustion, then ordinary backoff and fresh
admission. Other saved-state cases
cover request failure, failed Audit, missing execution, current Site ownership
and terminal lease release. Historical records remain intact and no website Flag
is fabricated from queue failure. The existing signed-claim worker journey
separately protects actual collection, repair and recurrence. No new timer,
state table, retry workflow or customer control was added. These are controlled
local results. Partial observation freshness still requires fulfillment review,
alongside deployed scheduling and real-provider acceptance.

**Implemented for failure after schedule advancement:** A second native
reproduction admitted the weekly check, advanced its clock and then exhausted
dispatch recovery. Care stayed due a week later despite the failed execution.
The shared scheduled admission service now commits its private receipt context
and Site clock together after physical admission. The scheduler's separate
clock write and admission-time failure reset were removed. Normal terminal
reconciliation and bounded Watch recovery share one completion projector.
Failures use the existing backoff, capped at the earlier normal cadence;
execution failure history clears only after a matching completed execution.

The snapshot contains a target hash rather than its URL. PostgreSQL's core
binary-string functions provide the same SHA-256 comparison without an
extension. [PostgreSQL binary-string functions](https://www.postgresql.org/docs/16/functions-binarystring.html)
The final write repeats current owner, target, cadence, due tick, attempt, lease
and failure guards. This preserves newer decisions and prevents duplicate
recovery. Caller context cannot supply the reserved schedule field. Existing
receipts without that context retain their evidence and ordinary cadence;
historical schedule ownership is not inferred.

Disposable PostgreSQL cases exercise actual dispatcher recovery exhaustion,
fresh admission after backoff, atomic rollback, compatible manual reuse,
concurrent recovery, write interruption, cadence caps and changed ownership or
schedule decisions. A target change between selection and the actual write is
also preserved. Terminal-state fixtures establish projection behavior, not
website collection. The signed-claim worker fixture separately exercises
collection, default monitoring, independent repair and recurrence. No new state
table, queue, timer, retry configuration or customer control was added. A
completed execution can still contain unavailable observations; this change
does not classify those as healthy or resolve their fulfillment policy.

Acceptance passes 75 disposable PostgreSQL cases across schedule completion,
admission and schedule ownership, plus 214 focused contracts. The signed-claim
worker journey passes against migrated PostgreSQL, isolated Redis and Chromium.
Application types, selected fixture types, scoped lint, the worker build and
module boundaries pass. The broader fixture type probe still reports existing
async Prisma spy signatures in `watch-scheduling.integration.test.ts`; its 30
runtime cases pass. No production data, provider or deployment was exercised.

**Implemented for exhausted observations inside completed runs:** Scheduled
scope selection previously accepted any recent completed broad analysis,
including one whose collection tasks exhausted recovery. Terminal completion
also excluded such a run from backoff when its execution failure count was
zero. A native worker scenario now stops both collectors for a newly discovered
page before its first page row, lets the recorded graph exhaust those tasks,
and completes the containing run with missing evidence. The normal completion
projector schedules recovery within fifteen minutes. Admission at that saved
deadline selects broad work again and the installed worker actually visits
the retained page after its discovery link disappears. The page's observed
problem becomes actionable, the earlier exhausted tasks remain unchanged, and
the execution failure streak clears after collection recovers. Only admission's
clock is advanced; collection runs on the real clock. This proves local policy
and worker recovery, not fifteen minutes of wall-clock observation.

The existing recorded-completeness module now supplies the interruption cohort
to completion recovery and scope selection. Scope selection reads the newest
completed broad analysis, preventing older complete history from masking a new
interruption. A binding-only interruption keeps compatible fresh broad evidence
and repeats normal authorized binding admission. The SQL and ORM forms agree
on exhausted failed work, historical missing task kinds, blocked work,
inapplicability, completed observations, enrichment and non-task receipts.
Saved partial conclusions are not rewritten as failed website observations or
healthy results. Ordinary partial observations and blocked authorization retain
their evidence and normal care policy. No new state, retry service, timer or
customer control was added.

Fresh monitoring attempts preserve the original graph's bounded recovery
window. They use the existing 15-minute, one-hour and six-hour backoff, capped
at normal cadence, rather than extending or reopening historical execution.
Backoff and replay safety matter because retries can amplify dependency load
and repeat effects. [AWS retry guidance](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
Repeated broad interruptions still require fresh broad admission; this does
not establish optimal cross-run collection reuse or production capacity.

Acceptance passes 54 disposable PostgreSQL cases across completion recovery and
admission, and 175 focused contracts across scheduling, recorded completeness,
coverage, category evidence and customer run policy. The worker fixture completes
both the interrupted scheduled analysis and its automatically admitted recovery
through migrated PostgreSQL, isolated Redis and Chromium. Its recovered analysis
still records provider-dependent incompleteness while clearing the execution
failure streak. Application and owned fixture types, scoped lint, worker build
and module boundaries pass. No production data or live provider was exercised.

**Implemented for resource backpressure:** The earlier independent-queue fixture
held one provider analysis. Extending that native scenario to eight reproduced
a remaining global gate: the next website's HTTP analysis never started, despite
free HTTP capacity. Graph coordination no longer reserves a whole-analysis
slot. The global advisory lock, eight-analysis setting and availability-only
exception were removed. Physical worker limits remain, while each resource has
an independent delivery window derived from its existing concurrency setting.
Unsent work remains in the durable task ledger.

`delivery-window.ts` owns the delivery reservation under a short resource lock,
using the existing dispatch state, lease and execution generation. It commits
unconfirmed delivery before Redis is contacted. A failed acknowledgement retains
that reservation until the same job identity can be reconciled, preventing
repeated uncertain sends from opening unlimited slots. Capacity waiting rotates
due work without recording a failed attempt. Normal completion drains waiting
work through the existing engine handoff. Retired executions cannot hold live
capacity. Resource routing is now declared once for both JavaScript dispatch and
SQL accounting, replacing independent routing decisions.

The installed BullMQ concurrency controls the number of processed jobs. The
delivery window instead bounds live delivery reservations, including unclaimed
jobs and uncertain acknowledgements in our authoritative ledger. It does not
replace worker concurrency or copy the workflow into Redis. [BullMQ concurrency](https://docs.bullmq.io/guide/queues/global-concurrency)
Generation-preserving recovery retains the same final execution after a lost
acknowledgement, consistent with retry idempotence. [BullMQ idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs)

A concurrent partial-index migration isolates reservation lookup from unclaimed
tasks and old evidence. A populated PostgreSQL case uses the new index to find
eight reservations beside 8,000 unclaimed and 16,000 completed records. No
artifacts are transferred for capacity accounting. Native cases exercise full
provider-window isolation, routing parity for every task kind and specialized
module, simultaneous reservations, replay, release, uncertain acknowledgement,
delivery reconstruction, lease expiry and bounded worker deadlines. The real
page worker fixture separately retains scheduled partial collection and recovery.
These establish local execution behavior, not production capacity. Stale Redis
records from already retired executions are outside the live reservation bound;
the cleanup correction below now handles obsolete unclaimed deliveries. No
customer setting or display was added.

Acceptance passes 38 native database, Redis and worker cases across graph
admission and task dispatch, plus 37 focused routing, resource-capacity and
recovery contracts. The populated lookup exercises 24,008 task rows and native
routing parity covers every task kind across eight module variants. The
scheduled page-recovery worker fixture completes both its interrupted analysis
and subsequent observation through PostgreSQL, Redis and Chromium.
The signed-claim fixture separately preserves default monitoring, independent
repair verification and recurrence through four worker executions. Application
and owned fixture types, scoped lint, worker build and module boundaries pass.
The migration was replayed locally with no schema drift; it was not applied to
production. These checks do not establish production provider behavior, query
capacity or sustained monitoring fulfillment.

**Implemented for retired queue deliveries:** A native baseline queued a real
task delivery, retired its Audit and ran the actual recovery pass. The job stayed
in Redis because failed Audits were excluded from recovery. Recovery now also
inspects the actual task queues in bounded batches and retires deliveries that
the ledger proves cannot execute. This includes orphaned task records and late
producer acknowledgements that arrive after an earlier cleanup pass. No cleanup
marker, cursor, lifecycle table or new timer was introduced.

The projection reads only task identity, generation, state and Audit status.
Current retries, pending work, authorized completion tasks and valid historical
provider routing remain usable. Settled or retired deliveries are removed without
changing any PostgreSQL row, finding, task observation, verdict or history. It
does not actively trim finished transport jobs. Each queue is independent, while
normal graph recovery proceeds alongside cleanup. A pass looks past the current
live delivery window, so a full paused cohort cannot conceal obsolete work under
that bound. Oversized historical cohorts remain protected until they drain or
retire. No unbounded queue scan or artifact read was added.

The installed BullMQ 5 implementation checks job locks in its removal script.
Cleanup explicitly avoids recursive removal. A native worker race supplies a
queued-state observation from before an actual worker claim and verifies that
the locked job survives attempted removal. The queue API documents that locked
jobs cannot be removed. [BullMQ removal contract](https://docs.bullmq.io/guide/jobs/removing-job)
Other native cases preserve database records byte for byte, retain a newer retry
generation, keep completion work, clean historical routing only after retirement,
find orphaned and late deliveries, and make bounded progress behind a full live
window. Separate cases fail a queue read or ledger lookup and verify independent
cleanup and execution progress. These are local transport and lifecycle proofs,
not production queue size, capacity or provider acceptance.

Acceptance passes 57 native PostgreSQL, Redis and worker cases across retirement,
admission and dispatch, including nineteen focused retirement cases. Fifteen
focused installed-scheduler and recovery contracts also pass. Application and
owned fixture types, scoped lint, worker build and module boundaries pass.
Local migration replay reports no schema drift. No database migration, customer
interface, production mutation or provider call was added by this correction.

**Implemented for shared module scope:** The mobile evaluator serves both Performance and Conversion, but previously calculated completeness from all of its assertions before category publication removed unrelated ones. Controlled evaluator cases reproduced a Performance result held incomplete by missing tap-target evidence and a Conversion result held incomplete by missing performance measurements. Unrelated performance failures also made a Conversion receipt fail after its findings were excluded. `checks/receipt.ts` now owns shared admitted-evidence selection. Ordinary page evaluation, specialized interaction and performance evaluation, and receipt publication use that selector. Specialized completeness is calculated from its admitted assertions. Broad checks retain their complete set of obligations, category failures retain their findings, and comparable repair still requires the original measurement profile. No collector, capability or evidence requirement within the admitted category was removed.

**Implemented for browser collection cost:** A targeted metadata or tracking task previously opened both device profiles and ran axe despite having only desktop consumers. Browser collection now reads bounded, small consumer descriptors from the existing execution ledger and derives its requirements from the shared module contracts. It does not infer narrow scope from the broader check catalog stored in ExecutionSpec. Metadata and tracking retain desktop collection; Accessibility retains axe; native layout and motion retain mobile observation. Console retains both devices and axe because its original error window includes that instrumentation. Unknown task kinds, unknown check contracts and historical contexts retain complete collection. Skipped observations stay absent or incomplete. Broad analyses retain their complete required evidence. The private desktop and mobile capture functions now use one named options contract rather than long positional argument lists. No new task kind, persisted scope, evidence store or capture pipeline was added.

**Proposed:** Keep one active planner with declarative evidence requirements and explicit dependency closure. Treat browser collection, media capture, active interaction and provider context as separate capabilities with compatible shared observations. Profile duplicate navigations and provider calls before consolidating them. Reuse evidence only when page, device, access, time window and interaction state match. Verification must still collect fresh evidence. Keep historical decoding and drain pending legacy execution before retiring superseded orchestration.

**Acceptance:** A targeted check performs only its necessary collection. PageSpeed or AI failure cannot occupy unrelated capacity. Concurrent representative Sites complete within their cadence and resource budgets. Any removal of a legacy path preserves historical reads, pending work and accepted detection semantics.

AWS documents how retries can amplify overload and how a timeout can follow a successful side effect. The task scheduler should own bounded transport retry; protected action adapters must reconcile uncertain effects before repetition. [AWS timeouts and retries](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)

### Coverage proof is still spread across different evidence levels

**Observed:** The current public catalog contains **108 items across eight areas**. Its mapping classifies 80 as public observations, seven as PageSpeed dependent, four as automatic account checks, four as authorized signup fixtures, four as Search Console dependent, two as Analytics dependent and seven as scheduled uptime responsibilities. These are inventory classifications, not completion counts. The evaluator scenario suite exercises substantial behavior but also constructs observations directly. It cannot by itself establish that collection, worker execution and customer projections work for each item.

**Proposed:** For each catalog item, link the existing proof at its actual level: evaluator fixture, native collector, integrated execution, provider observation and sustained schedule. Mark the precise missing link and add only the test or observation needed to close it. Use representative scenario families to exercise shared foundations. Keep live-provider evidence separate from controlled provider responses.

**Acceptance:** An item has a traceable path from admitted applicability to collected evidence, actionable finding, comparable recovery and recurrence where applicable. Missing credentials, unsupported interactions and insufficient samples remain explicit. Catalog registration and proof-environment labels never count as execution evidence.

**Implemented for meaningful form names:** Five native Chromium reproductions
found HTML metadata reporting a field as named solely because an empty label or
unresolved or whitespace-only ARIA declaration existed. This could certify the
HTML fallback despite the field remaining unnamed. Inputs now share the cached
name-content and reference checks used by buttons and links. Label association
retains exact first-ID identity and native implicit-label ownership. Empty SVG
titles, script text and unrelated hidden content cannot supply the missing name.
Textarea values and option text cannot label their enclosing control.

The correction preserves valid hidden referenced subtrees, ordinary labels,
image and icon names, multiple labels and fallback from empty references. The
supported behavior is checked in Chromium and follows the relevant distinctions
in the [W3C accessible-name draft](https://w3c.github.io/accname/#computation-steps).
This HTML signal parser does not replace native accessibility inspection or
establish complete accessible-name computation or conformance.

New metadata carries a control-name policy version through the existing durable
snapshot. Current assertions, the shared receipt decoder and scoped verification
use that recorded identity. Earlier zero counters cannot certify present names,
including during interrupted-work recovery. Historical stored conclusions and
meaningful failures remain unchanged. Native axe scopes keep their existing
meaning, while a changed HTML interpretation cannot be counted as a repair of an
older HTML-only finding. No detector-wide reset or parallel decoder was added.

Thirty-eight native cases exercise the supported names. A native axe
4.12.1 label result independently checks missing name, nominal empty-label repair,
real repair and recurrence against shared HTML evaluation and scoped comparison.
That evaluator intentionally receives no native rule result and uses controlled
PageSpeed context; its overall automated result remains incomplete. The existing
installed application and worker regression separately retains independent native
action, pricing, Tracking and Accessibility evidence through missing metadata,
repair and recurrence. No customer interface, queue, evidence store or historical
receipt was replaced. Production and assistive-technology acceptance remain open.

**Implemented for native Accessibility ownership:** The collector already limits
axe injection to the top document and same-origin frames, but downstream code
independently guessed ownership from words in selector text. This discarded
first-party failures in frames called iframe while retaining identical failures
in frames called payment. A second interpretation collapsed shadow-root paths
into comma-separated CSS selectors. Collection now owns the origin boundary;
summaries and findings retain its outcomes. The shared target representation
preserves frame and shadow boundaries through recorded evidence, fix guidance
and scoped verification. Screenshot harvesting follows actual open shadow roots
and leaves descendant-frame coordinates unavailable. The correction follows the
[axe native target contract](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md).

The existing summary schema carries the new policy identity. Current results
cannot certify repairs of historical findings under the older interpretation.
Four controlled Chromium cases verify first-party failures under both frame
names, cross-origin exclusion, iframe-title responsibility, shadow-root geometry,
independent repairs and recurrence. Forty-nine focused contracts retain unresolved
frame outcomes and existing evidence consumers. The installed worker regression
passes both Accessibility and registered page-structure journeys through migrated
disposable PostgreSQL, Redis and Chromium. Twenty actual worker runs retain
first-party frame controls alongside top-document controls, partial repairs,
unavailable pages, independent recovery and recurrence under the original
Improvement. Twenty-five additional consumer contracts pass; one stale malformed
legacy-receipt expectation now includes its established incomplete state.
Application and owned native/pure fixture type checks, scoped lint, worker builds,
module boundaries and scoped diff checks pass. The shared worker fixture was
validated at runtime, without claiming whole-file fixture type safety.
No new collector, execution lane, evidence store or customer interface was added.
Local automation does not establish complete accessibility conformance or
production behavior.

The policy-version boundary passes 104 focused contracts, including retained
native proof and refusal of older positive HTML counters without mutation. The
72 consumer checks cover current results, historical provenance, recorded Site
conclusions and verification coverage. The normal metadata worker journey also
retains policy version 2 in its durable snapshot and all three positive name
assertions before independent repair and Watch recurrence. Application and owned
fixture types, scoped lint, worker build and module boundaries pass. The shared
worker fixture retains its 44 existing type diagnostics outside this change.

**Implemented for historical receipt consistency:** Ten focused reproductions
found the historical decoder retaining passing module summaries after its own
assertions became incomplete or contradicted the aggregate. Explicit historical
failure and incompleteness could also leave Conversion healthy beside successful
collection. Both receipt formats now use the existing assertion summary rules.
Coverage honors negative historical completeness without granting historical
receipts additional positive authority. Readable evidence and complete advisory
semantics remain available; absent aggregates and positive completeness are not
invented. Unreadable assertion lists cannot certify an aggregate.

The correction passes 100 focused receipt, coverage, result, assessment and
category contracts. Forty-four migrated PostgreSQL current-evidence cases pass,
including three new cases comparing Site overview, account list, paginated
results and installed MCP protocol responses. Those cases preserve independent
HTTPS facts and published run history, leave saved receipts unchanged, and
restore the baseline conclusion when complete evidence returns. These are
controlled saved-evidence and application/protocol checks, not proof of live form
collection, external MCP transport or production acceptance. No new decoder,
state store, worker path or customer interface was introduced.

Application type checking, scoped lint, worker build and module boundaries pass.
The new cases have no type diagnostics. The optional fixture-only compiler still
reports six existing diagnostics in other portions of the selected test files;
whole-file fixture type safety is not established by this change.

**Implemented for observable form feedback:** A native Chromium reproduction
showed that a required field whose invalid handler canceled the browser message
was still reported as healthy with zero-millisecond feedback. The collector had
called `checkValidity()` before activating the form, confusing constraint
rejection with interactive error reporting and potentially running validation
handlers during baseline collection. Baseline validity is now read without firing
invalid events. The existing isolated probe observes actual trusted activation,
cancellation and visible focused native reporting, or newly visible custom
feedback. Temporary native-method wrappers distinguish pure validity checks from
explicit interactive reporting and are restored after observation. Delayed native
reporting uses the same measured one-second feedback threshold and two-second
negative window as custom messages. Scanner refusals remain inconclusive.

The existing evidence contract now distinguishes constraint-only facts from
interactive native feedback. One shared historical decoder serves current receipt
interpretation and scoped repair comparison, preserving raw evidence and published
history while preventing the known shortcut from certifying current health or a
repair. No alternate collector, queue, schedule, customer setting or detector-wide
identity reset was added. Fifteen native browser scenarios cover normal, canceled,
replaced, delayed and refused reporting. An actual disposable application,
PostgreSQL, Redis and worker journey starts from ordinary Site admission, keeps an
unchanged repair open, independently verifies restored native reporting, and
recognizes scheduled recurrence under the same finding identity. The existing
worker safety and client-feedback scenario also passes. No form submission reached
the fixture endpoint. These are local controlled observations, not production or
provider proof, business-submission completion or a complete accessibility audit.

**Implemented for comparable form obligations:** Native Chromium reproduced
false recovery after one of two required fields became optional, disabled or
read-only: the unchanged field still supplied browser feedback. Form identity
recorded names and ownership but omitted validation participation. The existing
context now freezes field kind, logical requiredness and native `willValidate`
participation, including inherited fieldset disabling. Custom `aria-required`
validation can still adopt native `required` reporting. Older opaque contexts
cannot reconstruct those obligations and remain unverified under the new scope.
The change reuses one collector and its existing receipt, verification and Watch
consumers. It adds no persistent state, execution path or customer control.
These form-level observations do not establish that every individual constraint
works or that a submission succeeds. HTML defines disabled controls as excluded
from constraint validation, so unchanged names alone cannot establish comparable
execution. [HTML constraint validation](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#constraint-validation)

Twenty native Chromium cases pass. Seven actual application and worker executions
through disposable migrated PostgreSQL and Redis establish original failure,
unchanged verification, three inconclusive weakened forms, independently verified
recovery and scheduled recurrence under the same Improvement. Source receipts
and settled attempts remain unchanged, and no submission reaches the fixture.
These controlled observations do not establish production monitoring or delivery.

**Implemented for actual rendered availability:** The binding originally treated
an actual browser HTTP error as unavailable collection, even when the separate
HTTP client had succeeded. A native worker reproduction left the binding retrying
with `BINDING_EXECUTION_INTERRUPTED`, without committing the observed website
failure. The same path could borrow the initial browser response after a later
JavaScript document navigation. Availability now uses the existing retained-error
session and a bounded main-frame response observation, requiring the response and
rendered document to match. The HTTP and browser clients share one response policy;
a successful response from one cannot erase a confirmed failure from the other.
Authentication, rate limiting, challenges, missing response authority and changed
documents remain inconclusive. The existing two-attempt confirmation, binding
identity, immutable assessments and recovery projection retain their ownership.
No queue, persisted state, scheduler or customer configuration was added. Native
application and worker execution observes the actual browser error, a JavaScript
redirect to another error response, header and content challenges, unchanged
repair, independent recovery and recurrence. Raw source receipts and completed
repair attempts remain unchanged. Local transport fixtures do not establish
production or provider behavior.

**Implemented for painted loading feedback:** Native Chromium confirmed a visible,
hit-testable loader inside a `visibility: hidden` ancestor whose child restored
`visibility: visible`. The shared detector had reported no loading UI. Its ancestor
loop now distinguishes inheritable visibility from ancestor display and opacity
suppression. Initial capture, clearance timing, mobile layout and destination
loading inherit the corrected observation through the existing predicate. Native
fixtures retain truly hidden loaders and non-overridable display/opacity cases.
The established worker repair scenario uses restored child visibility across
slow and stuck detection, unchanged verification, independent recovery and
recurrence. No parallel detector, evidence format, version reset, setting or job
was added. Thresholds, known failure identity and historical facts retain their
existing meaning. Six native browser scenarios and fifteen focused contracts
pass. The repair fixture retains the visibility override through eight actual
worker runs, following two controlled native source captures. Application type
checking, the owned fixture scope, scoped lint, worker build and module boundaries
pass. The observations are local and bounded to the collected window; they do not
establish arbitrary later states or production behavior. External providers remain
explicitly unavailable in the broad recurrence fixture.

**Implemented for preview-image pixels:** A native Chromium reproduction rejected
corrupt PNG data that the existing successful-HTTP/image-content-type check had
accepted. An older supposedly healthy PNG fixture also failed actual pixel
decoding. The shared public transport now exposes unchanged resource bytes through
the same admission and response reader used by document collection. Preview-image
collection derives first-frame PNG, JPEG, WebP and GIF decoding facts under byte,
pixel and processing limits, then discards the buffers. Unsupported formats and
resource or execution refusals remain unknown. Document/SVG loaders never receive
untrusted inputs through this raster path. CPU evaluator replay consumes the
private frozen facts rather than downloading or decoding the image again.

The response and decoding criteria retain distinct scoped conditions. Current
assurance qualifies historical response-only receipts as incomplete without
rewriting them or removing genuine HTTP facts. An older passing HTTP receipt
cannot close a new decoding failure. Existing check identity and recommendation
priority remain; owner action starts the existing repair record. The native worker
journey follows ordinary URL admission, unchanged verification, unsupported repair
evidence, independently decoded recovery and recurring identity, retaining source
receipts and completed attempts. Provider and media limits remain explicit.
The original multi-hour contact-support timeout coincided with host hibernation:
the macOS power log records low-power sleep at 09:45:44 UTC on October 21 and wake
at 13:09:48, about two seconds before the deadline error. That observation does
not establish a product deadlock. The focused image fixture no longer expires
journey tasks. A subsequent five-admission repair and recurrence run completed
with ordinary journey execution enabled. The earlier native campaign passed
fourteen application/worker admissions beside the Chromium decoding reproduction. Image/catalog and shared transport contract
campaigns pass, as do application types, scoped lint, worker build and module
boundaries. No parallel transport, task type, evidence store, customer setting or
presentation surface was added. Production network behavior and actual
sharing-platform previews remain external acceptance work.

**Implemented for bounded optional screenshots:** The audit path previously
mixed unbounded `Page.screenshot` calls with several independent timeout policies.
A stalled font could consume the journey deadline, and a viewport screenshot
exception could discard unrelated rendered evidence. One helper now owns the
native screenshot timeout across viewport, journey, public flow, slow replay,
frame sampling, overlays and comparisons. It respects the existing execution
deadline and refuses expired work. Load sampling and frame uploads receive that
same deadline. Optional viewport and overlay failures preserve independent
observations; unavailable media cannot manufacture successful pixels. Redundant
buffer copies were removed. No extra queue, evidence store, workflow engine or
customer setting was introduced. Native Chromium reproduces the font wait and
verifies continued interaction and journey assessment. Focused contracts cover
partial media failure, expired execution and preservation of rendered,
accessibility and console facts. Playwright documents screenshot timeout as
unbounded by default. [Playwright screenshot API](https://playwright.dev/docs/api/class-page#page-screenshot)

**Implemented for native navigation paint and method identity:** Controlled
Chromium fixtures reproduced a painted pricing section and mobile links being
reported as broken after a child restored inherited visibility. A separate case
reported mobile links as reachable despite an ancestor suppressing their contents.
The declared primary-panel probe also missed independently observable progress.
Three hand-written ancestor checks now use the native visibility primitive,
retaining each collector's geometry and safety rules. Own hidden contents still
prevent a section or panel from becoming a useful destination. Pricing fragment
conditions alone move to a new comparison identity; accepted HTTP pricing
conditions remain intact. Mobile method version 2 cannot borrow the old paint
interpretation as current assurance or repair proof. The CSSOM View draft defines
the primitive's distinct opacity, visibility and skipped-content options; native
Chromium behavior is the local acceptance evidence.
[CSSOM View visibility algorithm](https://www.w3.org/TR/cssom-view-1/#dom-element-checkvisibility)

Integrated repair then exposed a shared provenance defect: native collectors
hard-coded detector version 1 while findings used the frozen execution's newer
version. Valid unchanged and repaired observations became inconclusive. One
shared method constructor now records the admitted per-check versions across
native collectors, account observations, discovery, journeys, cross-page checks
and CPU evaluation. Unsupported methods remain unavailable, and non-admitted
checks cannot acquire comparison authority from a shared observation. The prior
CPU and cross-page validation copies and the hard-coded production receipt
identities were removed. Wrapper and detector versions keep their existing
separate meanings. No queue, table, customer control or parallel verification
path was introduced. Published history, source receipts and completed attempts
remain immutable.

Native navigation scenarios and focused catalog/recovery contracts pass. Actual
worker fixtures preserve hidden and transparent pricing failures, independently
observe child-restored recovery, retain recurring identity and leave completed
receipts unchanged. Existing HTTP pricing repair retains its original conditions.
The mobile fixture verifies unchanged, missing, changed, challenged and repaired
scope, then exercises ordinary native recurrence with controlled provider refusal.
Representative signup-journey and controlled HTTPS account-lifecycle worker
regressions also pass, including retained identity, failed signed-in checks and
cleanup after opt-out. The focused contracts include mixed method versions and
non-admitted observations. Native fixtures, types, scoped lint, worker build and
module boundaries pass. These are local observations, not live-provider or
sustained production proof.

## Evidence boundaries across the eight areas

| Area | What the product can establish | Boundary to preserve |
| --- | --- | --- |
| Uptime | Observed response, confirmed incident, recovery and recurrence at the permitted cadence | A probe reflects its URL, time and observation location. Missed probes are missing coverage. |
| Pages | Discovered and retained pages, actual responses, links and exercised destinations | A bounded crawl does not inspect every possible website state. Disappearance is not recovery. |
| Conversion | Exercised entry, navigation, validation and authorized completion criteria | A clicked button is not a completed signup, payment, delivery or business conversion. |
| Security | Inspected transport, response policies and public signals | Header presence does not establish comprehensive security or legal compliance. |
| Performance | Recorded lab measurements and available field cohorts | Device, measurement profile, origin fallback and reporting window change the meaning of the result. |
| Search | Observed declarations, crawl rules, content and authorized Google evidence | Public indexability and Google's stored indexing decision are different facts. |
| Tracking | Detected markup, libraries and recognized request attempts, plus connected reporting | An attempted request, successful transport and provider recording are separate observations. |
| Accessibility | Automated rule failures and bounded native interaction evidence | Automated checks cannot establish complete accessibility conformance. |

These boundaries are engineering requirements for accurate conclusions. Google reports CrUX over a trailing 28-day period and may fall back from page to origin data. URL Inspection returns Google's indexed version rather than a live test. Neither source can certify an immediate website repair outside that scope. [PageSpeed data](https://developers.google.com/speed/docs/insights/v5/about), [URL Inspection API](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect)

Lighthouse also documents measurement variation without a website change. Comparable lab profiles and repeated observations where variation matters are needed before attributing a performance change to a repair. This does not justify repeating every expensive check indiscriminately. [Lighthouse measurement variability](https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md)

For Analytics Measurement Protocol specifically, malformed events may receive no HTTP error, and validation events do not appear in reports. W3C likewise states that automated tools require human judgment for accessibility evaluation. These facts support our existing separation between observations and stronger conclusions. [Analytics validation](https://developers.google.com/analytics/devguides/collection/protocol/ga4/validating-events), [W3C evaluation tools](https://www.w3.org/WAI/test-evaluate/tools/selecting/)

Public security inspection is also bounded. OWASP describes security testing as a combination of techniques, rather than proof from an automated scan alone. Our collectors must themselves preserve tenant and destination isolation: OWASP's SSRF guidance explicitly distinguishes validating DNS answers from binding the actual connection to a validated address. Keep the existing socket-level public-address boundary and origin-scoped credentials when consolidating collection. Browser contexts isolate session state, but that isolation does not replace the network boundary or permission to mutate a customer's website. [OWASP testing introduction](https://owasp.github.io/www-project-web-security-testing-guide/v42/2-Introduction/), [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [Playwright browser contexts](https://playwright.dev/docs/api/class-browsercontext)

## Refactoring priorities and acceptance

Recorded category obligations, page responsibility, current Site evidence and watched-result validity now use the existing execution ledger and shared projections. Operational fulfillment and the remaining capability gaps still need examination so we can tell whether the model is meeting the promise in practice. Execution consolidation follows measured duplicate work and capability evidence gaps, rather than a predetermined category order.

Each slice must preserve a representative URL admission, claim, default monitoring, failure, repair, independent verification and recurrence journey. Compare database facts with the affected API and customer projections. Exercise interruption and one unavailable dependency where they threaten the changed guarantee. Require fewer independent interpretations or execution paths after the migration, and remove superseded mechanisms when consumers move.

Production acceptance still requires the same reviewed web and worker revision, applied migrations, actual storage and provider behavior, authorized account lifecycle, bounded notification proof and sustained monitoring. Redis configuration also needs explicit operational verification: BullMQ requires `noeviction` and recommends durable persistence. A Redis ping does not establish those properties. [BullMQ production configuration](https://docs.bullmq.io/guide/going-to-production)

The modular monolith should remain the default. Google's simplicity guidance recommends comparing a rewrite with investing the same effort in the existing system, including migration and parallel maintenance costs. For FixFlags, success means fewer authorities and duplicated decisions, while preserving the evidence needed to explain every customer conclusion. [Google SRE simplicity](https://sre.google/workbook/simplicity/)

**Implemented for exact recovery resources:** The shared verifier normalizer
removed a slash from the entire serialized URL, conflating `/pricing` with
`/pricing/` and truncating query values ending in `/`. Focused cases reproduced
healthy evidence from a different resource establishing recovery. The shared
normalizer now preserves these distinctions, and verification coverage's
duplicate normalizer was removed. Existing consumers inherit one identity for
Search, saved verifier rows, Performance conditions, Tracking and Flag comparison.
Existing root keys and historical evidence remain intact. Opaque historical
conditions that cannot establish the original exact identity remain inconclusive.
This follows the protocol requirement to observe redirect equivalence rather
than assume it for every path. No collector, schema, customer control or
additional compatibility engine was introduced.
[RFC 3986 protocol normalization](https://www.rfc-editor.org/rfc/rfc3986.html#section-6.2.4)

**Implemented for active section documents:** The shared section evaluator
previously interpreted its caller's URL as the active document. Progressive
workers already passed their reached URL, but the compatibility pipeline passed
the original request and also parsed rendered relative links against that
request. Section evaluation now consumes the browser's recorded final URL, and
the compatibility parser uses the actual reached URL as its document base.
Original requests still own findings, and declared bases can still target
another document. Existing capture identities independently constrain repair.
The change removes a caller-dependent interpretation without another collector,
URL alias store or verification contract.
[HTML fragment target selection](https://html.spec.whatwg.org/multipage/browsing-the-web.html#scroll-to-fragid)

**Implemented for observed redirect loops:** The public HTTP collector discarded
its redirect history when the existing limit was reached. Consequently a repeated
route became unknown in Pages, linked destinations, availability and uptime.
The bounded transport now retains its last response and distinguishes a repeated
request/destination pair from an unfinished chain. Cookie handshakes, challenges,
nonstandard redirect statuses and public-target refusals remain inconclusive.
The shared source supplies a native Pages finding, public-link and action-destination
failures, confirmed availability evidence and uptime incidents. An intermediate
response cannot supply final-page header or TLS recovery. Existing incomplete
body evidence retains its independent authority. No additional collector, queue,
schema migration or customer setting was introduced. Limits and historical
observations remain intact.
[HTTP redirection semantics](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4),
[HTTP cookie state](https://www.rfc-editor.org/rfc/rfc6265.html#section-3).

## Local verification

The bounded reads pass 38 focused contracts and 815 shared Site/MCP contracts, with 152 guarded cases skipped. Forty-two disposable Outcome, claim and current-evidence cases pass. One fixture has two Outcomes with 55 executions and 22 assessments each; both retain their own 50 executions and 20 recent assessments, while one keeps a valid older success outside that history window. The SQL trace asserts bounded reference selection and ID-restricted hydration. The lightweight summary hydrates only two assessment IDs for those two Outcomes and reads no binding-execution history. Single and batch views agree, and an injected supersession between selection and hydration removes the obsolete success. Signed claiming preserves valid provisional and claimed detail context. Two installed MCP protocol cases also pass for uptime lifecycle and bounded history, including a configured but unverified Outcome beside successful reachability evidence. Type checking, scoped lint, worker build and module boundaries pass. These local cases establish read boundaries and consistent evidence, not production latency, capacity or external MCP authentication.

The Outcome page fixture first fails three cases, including the 24 extra explicit page reads and both ownership boundaries. The corrected readers pass 34 focused contracts and 813 shared Site/MCP contracts, with 151 guarded cases skipped. Thirteen disposable PostgreSQL Outcome cases pass, including agreement across list, detail, confirmation and rename, retained raw associations, unchanged foreign Site data and no separate page lookup from those projections. A signed-claim database fixture verifies valid page context before and after duplicate-page migration while retaining Outcome identity, bindings and evidence. Type checking, scoped lint, worker build and module boundaries pass. These checks establish the removed application reads and local ownership behavior, not a measured production latency or capacity improvement.

MCP uptime checks cover default summary reads, missing and paused monitors, explicit bounded windows, separate result/history pagination, invalid inputs, restart arguments and denial before evidence reads. Twenty-four disposable uptime service cases pass. The installed client/server protocol, using in-memory transport, separately compares the app and MCP during failure confirmation, recovery and recurrence, checks both text and structured payloads, reads 105 saved probes as pages of 100 and 5, rejects another Site's cursor, restarts invalid history and retains an unresolved incident beyond probe retention. The broad MCP, uptime and private-route contract check passes 120 tests, with 69 guarded cases skipped. Type checking, scoped lint, worker build and module boundaries pass. This establishes local data and protocol behavior. Production key authentication, external transport, sustained monitoring and real provider delivery remain separate acceptance requirements.

Current uptime assurance first fails five native database cases, while the fresh-online control passes. Twenty current-evidence cases then pass, including matching owner/list conclusions, strict client decoding, unchanged historical run results and zero synthetic Flags. Two real probe-handler cases cover confirmation, recovery, recurrence, notification receipt creation and inconclusive observations; current views agree after the transitions and HTTP recovery alone does not make an unanalyzed Site Clear. One installed queue/worker fixture retains a failing publication and executes the independent Site normally. The shared contract check passes 876 tests, with 219 separately guarded cases skipped; focused presentation, status and overview checks pass 71 tests. Two stale MCP test expectations were corrected against the established private-report access and source-guidance contracts, without changing product behavior. Type checking, scoped lint, worker build and the module boundary guard pass. Controlled observations and receipt creation do not prove production monitoring or provider delivery.

The composed-resource fixture first fails with two event connections. After consolidation, 106 focused hook, Site overview/settings, analysis-detail, Flag-action, resolution and page checks pass. They cover shared read failure and recovery, one reconnect read, nested ownership, child removal, observer replacement, navigation fencing and access revocation. Type checking, scoped lint and the module boundary guard pass. One older overview assertion was updated to accept the already-established read timeout's AbortSignal. These client fixtures establish ownership and lifecycle behavior, not hosted stream availability or provider execution.

Historical guidance first fails five focused cases covering the missing observer and three settled prescription states. Thirty-eight hook, action and Flag-page checks then pass, including strict notice parsing, unchanged stream ownership, observer replacement, revocation, reconnect catch-up, exact source identity, duplicate suppression and retained pending state until a new server result arrives. Seven private event-route and progress contracts pass. Two disposable PostgreSQL cases cover source-state disagreement and the case where a newer occurrence replaces the historical Flag in the current Site view. They read the original execution notice and exclude another private Site owned by the same account. The direct historical detail retains its own fix text after readiness changes. These are controlled event, rendering and database proofs, not hosted stream availability or live-provider proof. Type checking, scoped lint, worker build and the module boundary guard pass.

Repair-guidance origin first reproduces both disagreement directions between a finding's source and the latest broad Audit. Twenty-six disposable PostgreSQL cases cover current evidence, publication and Outcome incident continuity. The new saved-state cases exercise durable and unbound findings, compare overview and exact detail, retain guidance state through the client contract, observe readiness after guidance arrives and leave the newer Audit unchanged. Thirty-three focused hook, action and Flag-page checks cover automatic readiness, pending-guidance polling after analysis completion, settled polling, exact source identity, changed explanations, keyboard focus and verification-draft retention. The shared Site and guidance command passes 772 contracts, with 144 separately guarded cases skipped. A separate canonical prescription-commit case verifies independent publication and replay under execution ownership. These are controlled local publication and rendering checks, not live-provider or hosted Server Component transport proof. Type checking, scoped lint, worker build and the module boundary guard pass.

Shared-module scoping first fails four focused cases for cross-category gaps, unrelated failures and an applicable failure with comparable repair. The corrected foundation passes 700 shared check, performance, publication, coverage and category contracts, with 66 separately guarded cases skipped. Four cases execute installed workers through migrated PostgreSQL and Redis: the existing HTTP evaluation-isolation case and three new scoped evidence cases. The eight additional routing contracts in that suite are not worker execution proof. The new queue cases supply controlled normalized PageSpeed evidence and verify actual evaluator execution, committed receipt completeness, admitted check identities and Flag persistence. Nineteen focused performance cases also retain profile mismatch and missing-evidence refusal. The representative claiming, monitoring, repair and recurrence fixture completes seven actual executions through PostgreSQL, Redis and Chromium. This establishes the affected local interpretation, publication and controlled journey, not live PageSpeed collection or production monitoring. Type checking, scoped lint, worker build and the module boundary guard pass.

Missing automatic uptime setup first reproduces an operationally healthy result for an established committed Site without a monitor. Nine disposable PostgreSQL cases then cover Site and operator projections, shared counts, setup grace, lifecycle exclusions and normal scheduler admission. Setup leaves website uptime unknown until an observation arrives and does not create an analysis or rewrite the Site. A separate installed BullMQ/Redis worker case executes controlled HTTP observations for independent Sites through one setup failure and its retry, without browser sessions or analysis credits. Fifty-nine focused admin, diagnostic and uptime eligibility contracts pass, with six separately guarded cases skipped. Type checking, scoped lint and the module boundary guard pass. These are local responsibility and execution proofs, not sustained production coverage or live-provider acceptance.

Observation availability passes 1,025 shared Site, report, Improvement, comparison and Watch contracts. The 142 separately guarded cases skipped by that command are not native execution proof. Twelve disposable PostgreSQL cases separately exercise current evidence and publication, including malformed aggregates, public-only summaries, empty arrays, valid native and legacy findings, and an optional recommendation that leaves independent coverage conclusive. Four additional comparison cases retain availability through new, unchanged, inconclusive and alleged fixed summaries. Scoped Outcome recovery and recurrence retain the same marker without copying private evidence. A controlled notification case sends only the valid sibling through a mocked provider. The installed-worker journey completes seven actual runs through PostgreSQL, Redis and Chromium, preserving signed claiming, default uptime, independent repair and recurrence. These results establish the affected local path, not live delivery or production observations.

Machine-readable monitoring health first reproduces a live worker with idle queues reporting healthy despite overdue work and failed notifications. The corrected endpoint passes focused contracts for each saved gap, unavailable evidence, browser readiness and execution-ledger availability. Nineteen real PostgreSQL cases cover Site delivery projection, Outcome incident continuity and operator history. They compare the diagnostic with Site views and operator queues, keep independent uptime visible after broad analysis pauses, exclude removed Sites and inactive owners, and return to healthy after the gap is cleared. The final shared health, admin, comparison, guidance and Watch command passes 224 tests, with eleven separately guarded cases skipped. Type checking, focused lint, worker build and the module boundary guard pass. External consumption of the diagnostic, sustained fulfillment and real-provider acceptance remain unverified.

Published Site conclusions pass 828 shared Site, comparison and finalization contracts. The 133 separately guarded cases skipped by that command are not database execution evidence. Seventeen disposable PostgreSQL cases separately cover Site and category upgrades, historical Flag membership and wording, claiming and interrupted publication recovery. A representative installed-worker journey completes seven actual executions through PostgreSQL, Redis and Chromium, preserving signed claim, automatic uptime, independent repair and recurrence. Controlled sources and provider unavailability do not establish real-provider acceptance or production scheduling. Focused schema checks reject unsupported conclusion versions, mismatched scope and times, contradictory completeness and invalid Flag references while retaining valid confirmed findings. Type checking, focused lint, worker build and the module boundary guard pass.

Monitoring admission throughput passes 87 focused scheduler, timer, Watch and customer monitoring-state contracts and 44 disposable PostgreSQL cases. The database run includes the installed scheduler's 61-Site cohort, both concurrent-selection variants and existing schedule, pause, claim and admission regressions. Type checking, focused lint, worker build and the module boundary guard pass. Downstream admission is controlled in the cohort fixture, so these results establish local scheduling behavior, not collection capacity, production fulfillment or live queue acceptance.

Interrupted Site updates pass 34 focused hook, settings-refresh and Flag-action checks. They reproduce an obsolete failed request after successful publication, demonstrate that ordinary polling still reaches completion, retain a current failure after an obsolete success and recover a stalled initial fetch through the existing SWR retry. Type checking and focused lint pass. These controlled HTTP and event fixtures do not establish production stream availability.

Run recovery eligibility passes 61 focused contracts and 19 disposable PostgreSQL cases, including scheduled-admission regressions. Six new database cases exercise selection beyond a full protected batch, three historical null forms and two ownership changes immediately before the actual guarded write. Type checking and focused lint pass. These checks establish local selection and settlement safety, not production recovery latency.

The Pages conclusion correction passes 52 focused presentation and card contracts and three disposable PostgreSQL cases. Known findings remain actionable during incomplete, stale or repeated collection; a finding in a different area does not alter the Pages conclusion. These are local projection checks and do not establish that the live deployment includes the correction.

Recovery isolation passes focused scheduler, legacy recovery, locking, progressive isolation and Site-run recovery contracts. Disposable PostgreSQL cases reproduce both bounded-batch starvation modes, recover the original failed result through the canonical projector and publish owned progressive findings without turning absent observations into a healthy conclusion. Scheduled-admission regression cases also pass. These checks establish local recovery and lease behavior; they do not establish a production monitoring fulfillment rate.

The watched-result correction reproduces the weekly-to-hourly freshness error in the actual overview, account list and Outcome detail readers. They agree on stale state under the tightened policy, recover after a fresh recorded assessment and retain the original run deadline and assessment rows. A separate database case reproduces delaying a slowed cadence beyond the previous evidence window, then verifies immediate due admission and normal weekly advancement. Thirty-eight focused disposable PostgreSQL cases and 103 focused contract tests pass. The claimed-monitoring worker fixture completes seven actual runs, including hourly and weekly transitions admitted from their command-generated due dates. Controlled availability collection produces fresh assessments with the expected validity windows while earlier assessments remain unchanged. Saved-state cases establish read and scheduling behavior; the worker fixture separately establishes controlled execution. Neither proves sustained production monitoring or external-provider behavior.

The current-evidence correction reproduces the false Clear conclusion during interrupted publication and verifies agreement across the overview, account list, run API and history for missing, mismatched and matching receipts. These reads do not mutate the Audit or invent a finding. Five focused disposable PostgreSQL cases cover publication and monitoring presentation. Four integrated worker cases execute 14 actual runs through PostgreSQL, Redis and Chromium, preserving claiming, default uptime, retained-page interruption, category repair and recurrence. The shared Site contract suite passes 728 tests; its separately guarded database cases are not counted as execution proof. Type checking, focused lint, the worker build and the module boundary guard pass.

The admission correction reproduces and prevents a check starting after a committed pause, a removed Site being restored during preparation, and a first scheduled run losing its selected identity when the target retains www and a port. A real serialization conflict retries against the new pause. Current claims admit normally, and their saved receipts replay after a pause without new work. The changed foundation passes 203 focused tests and 30 disposable integration cases, including installed worker, PostgreSQL, Redis and Chromium execution of signed claiming, default uptime, independent repair, recurrence, account retention and cleanup. Type checking, focused lint, the worker build and the module boundary guard pass.

The recorded-obligation correction passed focused tests covering graph integrity, category coverage, run results, monitoring history and Site assessment. The page responsibility correction passes 123 focused tests covering scope, admission, presentation and assessment contracts. Six worker executions through migrated disposable PostgreSQL, Redis and Chromium exercise a newly discovered page whose collectors stop before its first row, its subsequent scheduled collection after link removal, and the existing retained-page interruption, category repair and recurrence journey. The fixture checks the overview, account list and run reader against actual missing-page evidence. It also reads the committed category dependencies and rejects a missing required task. Type checking, focused lint, the worker build and the module boundary guard pass.

Notification replay first reproduces duplicate provider calls in four disposable PostgreSQL cases after 25 hours, with and without legacy timestamp metadata. The correction passes 51 native database cases across Watch and uptime, including short legacy retries, delayed initial delivery, changed permission, concurrent claims and a slow claim crossing the external replay deadline. Ninety-six focused transport, selection, Watch and uptime contracts pass. One installed-worker fixture preserves exact SDK request bodies, ownership fencing and late responses through PostgreSQL and Redis; 87 unrelated guarded scenarios remain skipped in that focused command. Type checking, scoped lint, the worker build and the module boundary guard pass. Provider transport is controlled locally, so these checks do not establish real acceptance or inbox delivery.

Notification backlog recovery first reproduces the global-lock dependency and an immediate second send before any backoff. The correction passes seventeen migrated PostgreSQL cases covering replay safety, exact retry deadlines, changed scheduling at admission, concurrent claims, classification deferral and a concurrently changed deferral. The installed scheduler settles 61 alerts across four bounded passes, keeps one controlled provider failure at one attempt until due, and accepts its later concurrent retry once. PENDING and expired SENDING classification failures both yield to an independent alert. Thirty-nine uptime database cases retain the shared backoff's existing semantics. The installed worker/SDK ledger fixture passes with scheduled retries and unchanged exact provider bodies. The focused scheduler, timer, email, Watch and uptime command passes 116 tests. Type checking, scoped lint, the worker build and the module boundary guard pass. Local migration replay reports no schema drift. No production migration or provider call was performed.

Stalled alert detection first reproduces healthy diagnostic snapshots with old pending Watch and uptime receipts. Nine migrated PostgreSQL cases then pass, covering matching diagnostic, summary and operator queue counts, dated completion versus Audit creation, fresh pending work, live and expired leases, missing historical leases, terminal acceptance, paused analysis, ownership privacy and unchanged records after reads. Seventy-eight health and operator contracts pass, with eleven guarded cases skipped by that command. Type checking, scoped lint, the worker build and module boundaries pass. These are local receipt and diagnostic checks; an independent production observer and real notification acceptance remain unverified.

Browser collection requirements first reproduce two native-profile allocations for a desktop-only capture request. Fifty-four focused checks then pass for capture defaults, skipped evidence, metadata parser independence, native metrics, accessibility, console and recorded consumer requirements. Four installed-worker journeys through disposable PostgreSQL, Redis and Chromium pass for metadata repair and recurrence, native Accessibility repair and contrast uncertainty, original mobile input identity, and console partial repair, unavailable captures, independent viewport failure and recurrence. Broad metadata source collection retains axe and mobile metrics; each targeted metadata verification records neither, while preserving comparable outcomes. Eighty-four unrelated scenarios remain skipped in that focused worker command. Type checking, scoped lint, worker build and module boundaries pass. These cases establish the affected local collection and recovery paths, not production latency, provider behavior or complete catalog execution proof.

Optional Search Console applicability first reproduces a public Search run held partial by an absent connection and an unrelated historical property refreshing its credential. Thirty-six focused provider, coverage and card checks pass, including anonymous access, legacy path scope and expired credentials. Twenty-two disposable PostgreSQL cases pass across the Google worker journey and current Site evidence, with the Google worker suite rerun against the final admission model. The worker compares an unconfigured public category, revoked access, stale and changed-property proof, absent configuration during an explicit provider repair, later fresh crawl and recurrence. API completion and the owner Search card retain the same local conclusions while provider observations remain unknown. Type checking, scoped lint, worker build and module boundaries pass. Actual Google acceptance remains external.

Structured-data handoff investigation identifies four invalid fixture projections that supplied redacted observations without the required server-derived readability decision. Fixtures now exercise private envelopes or the actual marked public contract. They retain refusal of unmarked, unavailable and malformed summaries, and test equivalent editor and plan handoffs without exporting private provenance. No production safeguard was relaxed. The shared Site, Search and execution command passes 893 checks, with 154 guarded cases skipped. Ninety-eight additional handoff, guidance, report and MCP checks pass. The existing installed-worker case separately passes through disposable PostgreSQL, Redis and Chromium, including the actual owner copy service with all 208 admitted structured-data targets, independent repair and recurrence. These results establish local custody and formatting behavior, not production delivery or external acceptance.

Shared provider admission first reproduces 24 requests in one second across separate SDK clients. Two disposable Redis/SDK cases then pass, preserving all message bodies and delivery keys while pacing both clients together. A real paused Redis command times out without a late send. The existing installed-worker notification-ledger case separately passes through migrated PostgreSQL and Redis, preserving claims, late responses, exact bodies and replay keys. Its 87 unrelated scenarios remain skipped. The focused email, inbound-account, lock, billing, authentication and support command passes 213 checks, with two guarded cases skipped. Type checking, scoped lint, worker build and module boundaries pass. These checks establish local admission and existing ledger compatibility, not hosted mail acceptance, a real account verification lifecycle or inbox delivery.

Sitemap identity first fails two focused cases for escaped page locations and an incorrectly requested child URL. The corrected shared parser passes 129 Search and coverage contracts, with one separately guarded worker case skipped. These include single-pass entities, literal CDATA, retained percent encoding, supplementary Unicode, prohibited character refusal, parser-limit uncertainty and refusal to credit a changed historical resource. The guarded case separately passes six actual application and worker executions through migrated PostgreSQL, Redis and Chromium. It compares saved receipts with the run API and Site findings, refuses an unchanged indexing fix, verifies recovery, preserves recurring Improvement identity and independently repairs the exact query-bearing child resource. Type checking, scoped lint, worker build and module boundaries pass. These are controlled local collection and recovery proofs, not Google indexing, production collection or sustained scheduling evidence.

Certificate refusal first fails ten focused classification cases and reproduces an expired HTTPS certificate as unknown through the installed uptime worker. The correction passes 55 focused uptime checks; 75 separately guarded cases remain skipped in that command. Thirteen existing history-component and MCP consumer checks also pass. The native TLS case separately passes eight actual queue/worker observations through migrated PostgreSQL and Redis, including confirmation, unknown issuer trust, hostname mismatch, untrusted self-signed refusal, fresh HTTPS recovery and recurrence. It retains the original monitor, two incident identities, pending outage and recovery notifications, all eight probe reasons and unchanged analysis usage. Its explicit clock and due-job promotion are controlled cadence, not sustained wall-clock scheduling. Type checking, scoped lint, worker build and module boundaries pass. Provider delivery and production certificate observations remain unverified.

Public certificate evidence first reproduces the refused peer disappearing before Security evaluation. The shared Search, check, collection and uptime contracts pass 534 tests, with 67 separately guarded cases skipped. Sixty-three focused boundary checks pass against the final schema and registered evaluator. The new installed application/worker scenario passes six actual runs through migrated PostgreSQL and Redis, checking useful owner guidance, exact request scope, unchanged and uncertain repair refusal, HTTPS recovery, recurring identity and owner API agreement. The shared uptime fixture separately retains eight real TLS observations, while the existing signed-claim and default-monitoring journey passes seven actual executions. Type checking, scoped lint, worker build and module boundaries pass. Browser and provider work in the certificate scenario is explicitly unavailable and settled through recorded deadlines. No production observation or deployment was performed.

Active Search document scope first fails five focused cases for inactive declarations, structured properties and historical repair credit. The correction passes 154 Search, catalog and native encoding contracts, with one separately guarded worker case skipped by that command, plus 65 supporting-evidence and owner-consumer checks. Six actual Search application/worker runs through migrated PostgreSQL, Redis and Chromium retain dormant markup throughout real indexing failure, unchanged verification, recovery and recurrence. A separate six-run structured-data journey preserves all 208 admitted property targets, useful owner handoff, incomplete page-context boundaries, independent repair and recurring identity. Its 87 unrelated guarded scenarios remain skipped. Type checking, scoped lint, worker build and module boundaries pass. The controlled fixtures retain explicit provider and capture limitations; they do not establish live Google interpretation or production monitoring.

Interrupted response evidence first fails five native HTTP cases. The changed transport and shared Search, check, destination, image, page-response and uptime contracts pass 566 tests, with 67 separately guarded cases skipped by that command. Sixty-two final boundary cases retain interrupted HTTP 200 and 503 challenge refusal, body-deadline uncertainty and bounded content. Six actual application/worker runs through migrated PostgreSQL and Redis establish independent header findings, one response collection attempt, unchanged, missing and challenged repair refusal, recovery, recurrence and owner API agreement. Nine real TLS uptime observations preserve the original incident through a body interruption, with no premature recovery notification. The separate signed-claim and certificate regression command passes thirteen actual worker executions, with eight unrelated guarded scenarios skipped. Type checking, scoped lint, worker build and module boundaries pass. Browser and provider work in the new header scenario remains explicitly unavailable and settles through recorded deadlines. No production observation or deployment was performed.

Inconclusive uptime fulfillment first reproduces healthy diagnostics beside fifteen minutes of on-time UNKNOWN observations. Eleven disposable PostgreSQL cases pass across monitoring gaps, owner views, operator counts and bounded queue selection. They retain initial uncertainty, count overdue work once, accept fresh conclusive failure or success as monitoring evidence, reject old-generation, other-target and future proof, and preserve records through reads. The native TLS queue/worker scenario passes eleven observations, including three successive unknown issuer refusals exposing the sustained coverage gap, a conclusive failure restoring observation capability without recovering the website incident, later complete HTTPS recovery and recurrence. Ninety-eight operator, health, eligibility and owner-projection contracts pass, with eleven separately guarded cases skipped. Type checking, scoped lint, worker build and module boundaries pass. The existing scoped probe index supplies the read model without a new projection field or migration. These are controlled local proofs; independent production diagnostic consumption, production query capacity and sustained wall-clock monitoring remain unverified.

Canonical HTTP authority first fails two focused collector cases for borrowed rendered success and wrong-source response reuse. The correction passes 139 Search and coverage contracts, with two separately guarded worker cases skipped by that command. Fifty final boundary cases retain self-canonical and actual redirect-response reuse without another GET. Five installed application/worker runs through migrated PostgreSQL, Redis and Chromium preserve the admitted Site request while the browser changes its displayed URL, observe the target's actual HTTP 404, refuse unchanged and interrupted-body repair evidence, independently establish recovery and retain recurring Improvement identity. Owner run results agree with the saved attempts. Optional media, provider and action work in this scenario remains explicitly unavailable and settles through recorded deadlines. Type checking, scoped lint, worker build and module boundaries pass. These are local response and recovery proofs, not Google canonical selection, production network behavior or broad capability completion.

Current broad freshness first reproduces Clear after a weekly-to-daily change despite three-day-old evidence and fresh uptime. Twenty-one disposable PostgreSQL cases pass across current publication, cadence, renewal, history and retained receipts. The shared Site contracts pass 764 tests, with 157 separately guarded scenarios skipped. Two older controlled Security fixtures now supply the evaluator's required public HTTP evidence; a separate missing-response case remains unknown. The signed-claim journey passes seven actual application/worker runs through migrated PostgreSQL, Redis and Chromium, retaining default uptime, independent recovery, recurrence and command-generated cadence changes. Type checking, scoped lint, worker build and module boundaries pass. The new age-boundary cases exercise saved-state projection, while the worker scenario separately protects execution. Neither establishes sustained production monitoring or real-provider behavior.

Dispatch ownership first fails two native cases after an Audit starts and after its producer claim is superseded. The undelivered owned admission retains its expected expiry failure. The correction passes all 32 existing and new PostgreSQL/Redis dispatch cases, including real delayed-provider lease renewal, independent task progress, lost delivery, claim recovery and uncertain acknowledgement. Another 104 focused admission, runner, worker and recovery contracts pass. Type checking, scoped lint, worker build and module boundaries pass. The new controlled queue consumer proves the execution claim and fenced admission boundary, not website collection. Production queue interruption behavior still requires observation on the deployed revision.

Robots initial authority first fails five focused cases, then passes 151 shared Search, catalog and owner-projection contracts, with three guarded native scenarios skipped by that command. Six separate native application/worker runs through migrated PostgreSQL, Redis and Chromium preserve the initial robots request, collect a real cross-authority redirect, detect its policy regression, refuse unchanged and HTTP 503 repair evidence, independently establish permission and retain recurring Improvement identity. Owner run results agree with saved attempts and the source receipt stays unchanged. Type checking, scoped lint, worker build and module boundaries pass. Optional providers, media and actions in the broad baseline remain explicitly unavailable. The fixture routes HTTP sockets and browser responses locally; it does not establish actual Google crawling or deployed network behavior.

Exact recovery resource identity first fails six focused cases, including healthy
Search evidence incorrectly recovering another path variant. The correction
passes 287 shared Search, comparison, measurement, Tracking and verifier tests,
with nine guarded scenarios skipped. Another focused admission and Improvement
command passes 174 checks, with three guarded scenarios skipped. These counts
overlap and are not an aggregate coverage claim. The installed application and
worker fixtures separately pass eleven actual runs through migrated disposable
PostgreSQL, Redis and Chromium, retaining signed claiming, automatic uptime,
independent repair, scheduled monitoring and recurrence. A controlled partial
publication uses actual HTTP and rendered observations for only the healthy peer;
the unobserved original remains unresolved. Two PENDING verifier rows for the
distinct resources coexist without overwriting each other. The subsequent worker
executions refuse the unchanged exact page, verify its repair and preserve the
recurring Improvement and original source receipt. Type checking, scoped lint,
worker build and module boundaries pass. Broader Site contracts also expose
unrelated stale assertions for changed GitHub integration copy and the analysis
button label; those copy changes were preserved. These local cases do not prove
complete catalog coverage, real-provider behavior or sustained production care.

Active section documents first fail three focused cases. The final shared
section, catalog, destination, detector and compatibility contracts pass 366
checks. This includes an omitted certificate-failure trigger, now supplied by
the actual shared Security evaluator rather than excluding its registered
finding. Six native Chromium observations follow real local HTTP redirects and
compare the two evaluator adapters. Unchanged targets fail, different reached
URLs and foreign bases cannot certify repair, the exact target repair passes,
and a later missing target fails again. These observations exercise the shared
evaluator and comparator; they do not execute the complete compatibility
pipeline or create persisted repair attempts. Type checking, scoped lint,
worker build and module boundaries pass.

The existing section-link application/worker fixture separately passes nine
actual runs through migrated disposable PostgreSQL, isolated Redis and Chromium.
It retains both original pages and all missing fragments, refuses unchanged,
inactive, partial, challenged, changed-destination and removed-link repair
evidence, independently verifies the complete repair and retains recurring
Improvement identity. Unrelated media and provider work remains explicitly
unavailable and can be canceled at the fixture's recorded recovery deadline.
This protects the progressive path; it does not establish a complete execution
of the compatibility pipeline or production behavior.

Observed redirect loops first fail two actual HTTP cases. The final boundary
command passes 387 checks, including routing cycles, unchanged and repaired
requests, long chains, cookies set on earlier hops, challenges, non-redirect 304
responses, private-target refusal, public-link failures and confirmed availability
classification. The shared transport, Search, check and uptime command passes
612 checks, with 145 guarded scenarios skipped; two additional boundary cases
were subsequently added for nonstandard statuses. Counts overlap rather than
representing an aggregate coverage claim. Inventory and planning checks separately
protect the new finding's registration and independent verification contract.
Three installed application/worker cases pass eighteen actual runs through
migrated disposable PostgreSQL and Redis, covering the new Pages failure and
the existing certificate and interrupted-body regressions. The loop case refuses
unchanged, long-chain and cookie-dependent repairs, verifies a fresh successful
request, retains recurring Improvement identity, agrees with the owner run API
and leaves its source artifact unchanged. Browser and provider work in that new
scenario remains explicitly unavailable.

The installed uptime queue/worker fixture separately passes seven actual HTTP
observations. Two failures confirm an incident; long and cookie-dependent chains
retain it without recovery, a successful response closes it and a later loop
creates another confirmed incident. Pending outage and recovery notifications,
history and unchanged analysis usage are checked against the saved rows. The
existing TLS fixture also passes its twelve observations. These clocks and job
promotions are controlled cadence, not sustained production monitoring. Type
checking, scoped lint, worker build and module boundaries pass. Provider delivery
and deployed network behavior remain unverified.

The claimed-entry correction passes 93 focused scope, admission, scheduler and
page-coverage checks. Another 69 execution contract, recovery, collector and
finding-commit checks pass. Seven native scenarios pass through migrated
disposable PostgreSQL, including 23 installed application/worker executions
through Redis and Chromium. The new URL-first scenario performs a real signed
claim and first saved due-watch claim, keeps the exact pricing URL without a
root-page link, independently verifies repair, recognizes recurrence through a
later Watch request and retains the same Improvement. The original Flag survives
claim unchanged, and the source page observations remain unchanged. Existing
monitoring scenarios cover disappearing links, interruption before page-row
creation, category recovery and retained-page response failures.

The direct database settlement case rejects HTTP-only, uncommitted, mismatched,
missing-metadata and malformed collection proof, preserves existing terminal and
foreign page rows, and exercises exhausted finalization and idempotent replay.
Source task artifacts remain unchanged. Type checking, scoped lint, worker build
and module boundaries pass. These initial cases established continuity for one
URL-first claim. Provider and media work in the new worker fixture remains
explicitly unavailable.

The subsequent combined-responsibility correction passes 95 focused admission,
scope, scheduler and review-budget checks. Seven selected native scenarios pass,
with seventeen installed application/worker executions through migrated
disposable PostgreSQL, Redis and Chromium. They cover successive signed claims
of independent entries, a claim while HTTP and browser collection is held open,
the first saved due-watch claim, retained-page interruption, category recovery,
independent repair and recurring Improvement identity. A pending or failed
analysis retains its obligation without acquiring a successful observation.
Original page facts and finding evidence remain intact; later identity links
are distinct from those observations and their original collection time.

Direct database cases protect tenant, environment and broad-intent boundaries,
including a supported legacy broad RunRequest. Missing native rows and an
obsolete unrelated binding cannot erase valid page intent. Two hundred repeated
source runs collapse into one small result, and rejected foreign URLs require
bounded paging instead of consuming the page budget. A full compatible cohort
skips history altogether. These cases establish bounded transfer, not a general
database-work bound for large populated task histories. Type checking, focused
fixture type checks, scoped lint, worker build and module boundaries pass. Three
unrelated worker scenarios are skipped by the selected regression filter. These
counts overlap earlier checks rather than establishing aggregate catalog proof.

These results establish the changed local path. Controlled collection and unavailable provider fixtures do not establish production scheduling, external delivery or real-provider behavior.

Navigation execution first fails two shared-planner cases and one real
compatibility-orchestrator case with heavy leaves mocked. The installed
progressive worker baseline already passes its retained-path case. The final
command passes 76 focused URL, planner, execution, graph and scope contracts.
They protect explicit path, query order, repeated query value order, empty
delimiters, host, locale and fragment identity while preserving canonical
discovery grouping, the existing depth and ceiling, and one execution across
both compatibility discovery passes. Those cases do not establish initial
fragment admission; the subsequent browser-state fixture below covers it.

Two native cases pass seven installed application/worker runs through migrated
disposable PostgreSQL, Redis and Chromium. Six progressive runs preserve the
existing exact retained-page behavior, refuse an unchanged repair beside a
healthy peer, establish the actual repair and recognize recurrence with the same
Improvement and unchanged original receipt. One actual compatibility execution
uses local private screenshot storage, captures both `/legacy-pricing` and
`/legacy-pricing/`, and produces a real title finding on the failing page.
Its stored specification has no progressive engine and creates no progressive
browser tasks. Local assets are cleaned after execution. Provider work remains
unavailable, and local media does not establish production object storage.
Type checking, focused fixture types, scoped lint, worker build and module
boundaries pass. Other URL variants have focused contract proof here rather
than a complete native browser matrix. These are local results, not deployment,
real-provider or sustained scheduling proof.

The populated task-history workload first fails with 24,000 task-row visits for
400 browser obligations. The indexed fixture adds an independent long-URL
obligation and passes with 24,001 synthetic rows and 401 browser obligations.
PostgreSQL chooses the browser-scope index and reports roughly 400 tuple visits
after rounding per-loop averages. The warm local plan measured about 3 ms,
versus about 5.7 ms in the earlier baseline. These timings are samples, not a
latency target, throughput result or production capacity proof.

The actual migration replays through the installed Prisma 6.19.3 toolchain with
no reported schema drift. Its SQL is also applied over populated history while
a writer is held open. A second write commits before the first writer releases
the concurrent build. A long incompressible URL remains writable and retained
without putting the URL into an index key. Two existing database scope cases
retain tenant, environment, legacy, pending and failed intent boundaries.
The signed-claim regression also passes four actual application/worker runs
through disposable PostgreSQL, Redis and Chromium, covering default monitoring,
independent repair and recurrence. Four selected native scenarios and 70 focused
contracts pass; two unrelated signed-claim scenarios are filtered out. Type
checking, focused fixture types and scoped lint pass. No production migration,
production query measurement or provider call was performed.

Browser-state admission first fails a native anonymous analysis because its
stored target loses `/app/#/pricing`. The corrected root-fragment journey uses
`/#/pricing/` with a healthy `/#/help` peer on the same HTTP document. It preserves
the requested URL, signed claim, first saved due-watch, distinct SitePages and
accessibility receipts, refuses unchanged repair, proves the repair on the
original state and recognizes recurrence under the same Improvement. The
original path-and-query claim journey also passes. These two cases complete ten
installed application/worker runs with migrated disposable PostgreSQL, isolated
Redis and Chromium. Their independent accounts avoid treating an earlier
fixture's future scheduled check as already due. Scheduler refusal of a future
claim remains unchanged.

Two authorized Signup cases complete twelve further installed worker runs on
document and fragment routes. In the fragment case the actual form is absent
when the fragment is lost. Both cases retain setup, dry-run authorization,
delayed completion, actionable failure, preexisting-success refusal,
failed-cleanup uncertainty, independent recovery and recurrence. Hooks use their
existing HTTP endpoints. These are controlled local reversible submissions,
not authorization or acceptance of arbitrary live forms.

The focused admission and scope command passes 268 contracts. Shared recovery,
Search, finding ownership, fixture and affected route checks pass 338 contracts,
with three separately guarded cases skipped. Counts overlap and do not establish
catalog-wide execution proof. Application type checking, scoped lint, worker
build and module boundaries pass. Selected fixture types and the modified Signup
block have no diagnostics; the optional whole shared execution-fixture check
still reports fifty diagnostics outside that modified block. Optional media and
external providers remain unavailable in the native admission cases. Historical
evidence is retained. No production action or sustained observation was performed.

Document-base navigation first fails a real local HTTP case because its resolved
destination list is empty. The corrected command passes 154 focused inventory,
metadata, artifact, section, recovery and catalog contracts. The catalog scenario
test remains evaluator evidence, rather than native proof for every item.
An installed worker case collects the actual broken link from an HTML base,
claims its report, refuses unchanged repair, independently verifies the restored
document and recognizes recurrence from the configured Site root, preserving the
original evidence and Improvement identity. Together with the original
path-and-query signed-claim regression, two selected native cases pass eight
application/worker runs through migrated disposable PostgreSQL, isolated Redis
and Chromium. Three other native cases are filtered out. Application and owned
fixture types, scoped lint, worker build and module boundaries pass. Controlled
collection with unavailable optional media and providers does not establish
production transport, storage or sustained scheduling.

Customer URL submission first fails four focused component cases because it
removes meaningful trailing slashes before invoking the shared handoff. After
removing the rewrite, 57 component, dashboard-resume, handoff and public API
contracts pass. They preserve supplied path, query and fragment conditions,
scheme completion, root canonicalization and exactly-once remount behavior.
Application type checking and scoped lint pass. This is component and request
contract evidence alongside the native backend journeys above, not a new full
browser or authentication-provider end-to-end campaign. Presentation and public
copy are unchanged.

Credential admission first fails two focused cases: the shared identity accepts
embedded credentials, and the real HTTP batch requests the anonymous path.
After refusing those targets before grouping, the local batch makes no request
and records no substituted public result. Its public-network, link, navigation,
finding-ownership and monitoring-scope command passes 121 contracts. The final
combined command passes 278 focused contracts across nineteen files, including
the document-base and customer-entry checks. These counts overlap the earlier
commands. Application and selected fixture types, scoped lint, worker build and
module boundaries pass. The eight installed worker runs above separately prove
the changed collection and repair journey; the credential refusal has actual
local HTTP and shared admission proof. Neither establishes live credentialed
provider behavior or production acceptance.

Public action interpretation first fails two native browser cases with
`no_cta`. Thirty-four final focused Chromium cases pass actual route and
base-directed activation, content-only routes, URL-only uncertainty, loading,
missing-page content, cancelled handlers, credential refusal and an independent
eligible action. They also exercise the affected journey and destination
consumers and their new evidence versions. Two further selected native journey
cases retain uncertainty for unactivated continuation; twenty-three unrelated
cases are filtered out.

Three selected installed application/worker cases pass eighteen real executions
through migrated disposable PostgreSQL, isolated Redis and Chromium. They retain
the original signed-claim and default-monitoring journey, exercise a base-directed
primary response through unchanged, restricted, challenged, replaced, removed,
competing, repaired and recurring states, and carry a disabled client-route
action through unchanged verification, independent repair, an inconclusive
URL-only monitoring observation and recurrence. The latter stores incomplete
progress and retains known action presence, without contradictory static
placeholder findings. Source evidence and Improvement identity remain intact.
Provider and optional-media work stays unavailable where the fixtures require
it. These are focused local paths, not deployment or real-provider acceptance.

The interpretation and recovery command passes 177 focused contracts. A separate
shared check, detector-version and flow-deadline command passes 383 contracts.
These are check scenarios, not capability completion counts. Application types,
owned fixture scopes, scoped lint, worker build and module boundaries pass.
The optional whole shared execution-fixture check still has fifty diagnostics
outside the modified blocks; its entire-file type safety is not established by
the focused result.
