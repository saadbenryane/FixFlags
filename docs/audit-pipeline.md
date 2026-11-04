---
status: canonical
authority: architecture
reviewed_at: 2026-10-30
supersedes: []
---

# Audit pipeline

Canonical reference for the FixFlags scan pipeline: stages, AI phases, degradation, recovery, and debugging.

Dedicated BullMQ workers and producers share one Redis ownership boundary. Native
graceful close drains work and acknowledgements before its supplied client disconnects,
and shutdown waits for a live client's terminal event. An already disconnected
client cancels its reconnect delay without waiting for a second end event.
Repeated close calls share
one drain. Audit, progressive, uptime and administrative workers use this rule;
uptime and administrative producers retain their clients until admitted
maintenance has settled. Shared process producers keep their separate owner.
Disposable Redis fixtures reproduce the seven retained progressive clients,
verify two drain/restart cycles, and retain a live job's acknowledgement before
releasing its worker client. This establishes local lifecycle behavior, not
production recovery or sustained monitoring.

Task admission selects one typed Audit metadata context shared by all handlers.
Retained HTML, performance, console and flow payloads remain in their evidence
ledgers instead of being copied into every physical task and continuation.
Handlers retain their dependency and scoped evidence reads. Coordination reads
only the admitted execution and status. A disposable PostgreSQL and Redis worker
fixture retains an 8,002,287-byte Audit while four deliveries each receive a
512-byte Audit context. These are synthetic payload measurements, not production
latency or capacity evidence.

Recorded page assembly projects findings from check and flow artifacts alongside
the existing behavior summaries. Full assertion targets, response receipts and
interaction payloads stay in their original task and receipt ledgers. Independent
receipt reads still identify incomplete modules. A disposable PostgreSQL fixture
reduces a schema-valid retained check and flow cohort from 3,714,746 bytes to
2,698 bytes, preserving findings, page identity, flow completion, coverage gaps
and every stored source. Malformed artifact data remains rejected rather than
becoming an empty projected observation. These are local transfer and custody
measurements, not production memory or latency guarantees.

Dependency reads likewise select observation identity, kind, state, admitted input
and artifact. Delivery state and legacy detail stay outside this context.
Non-Search consumers omit retained browser markup in PostgreSQL; Search keeps the
original document for its established rendered-HTML evaluation. This changes no
stored artifact or observation conditions. Invalid markup types, missing fields
and unavailable results remain unchanged for the existing validation boundary.
A disposable worker fixture transfers 1,505 bytes to a check and 901,555 bytes
to Search from the same retained browser observation, while retaining its markup
and unused legacy payloads in the database. These are synthetic local payloads.

## Progressive execution candidate

An interrupted response body does not erase its already received HTTP status.
Page, destination, uptime and preview-image interpretation retain known
missing-page and server-error responses through the existing public classifiers.
Restrictions and challenges keep their unknown result, including the observed
uptime restriction reason. Interrupted successful content cannot establish a
healthy destination, page, uptime recovery or valid preview image. Both direct
and replayable preview collection use one response adapter. The HTTP replay
journal still excludes raw bodies, URLs and credential-bearing headers.

Local socket fixtures exercise response resets, status retention, access
restrictions and replay without a second request. Installed workers detect a
received server error, refuse partial and challenged repair, verify a complete
response and preserve recurrence. A separate disposable uptime database case
uses the real probe classifier to confirm incidents, retain them through unknown
content, record recovery and open a distinct recurring incident. These establish
local interpretation and lifecycle behavior, not production monitoring.

Search classifies credentialed browser collection separately from its public
HTTP sources. A saved browser access grant does not withhold the independent
public response, robots, sitemaps or original canonical targets. The credentialed
DOM, bounded rendered sections, response headers and canonical declarations do
not enter public Search evidence. Legacy all-private collection retains its
existing withholding policy. Missing or restricted public responses remain
unknown; a successful private capture cannot replace them.

Repair keeps the original Search source requirement. A later public response can
verify its original public finding, while a private rendered observation stays
unavailable for public rendered-source recovery. Native Chromium and installed
workers reproduce a missing public title hidden by the former whole-capture
gate, then exercise public-source repair and recurrence with the browser grant
still enabled. Private title and credential markers never enter Search receipts,
and the private canonical is not requested. This is local evidence, not provider
or production acceptance. Recurrence uses future admission freshness while
native collection keeps real time; it does not establish natural cadence.

Page collection and metadata parsing have separate evidence boundaries. A
completed desktop document observation can retain its collected page when the
whole-document parser is unavailable. Collector commit and finalization share
one rule requiring a successful native HTTP response, document readiness, exact
page and final-URL scope, known capture access, and no document restriction.
Blank content can still be an observed document; its detectors retain their own
conclusions. Mobile observations cannot satisfy a missing required desktop.
Legacy parsed-metadata proof retains its existing contract.
An earlier `BROWSER_SCOPE_UNAVAILABLE` gap can settle under the same native proof
when finalization resumes; unrelated recorded failures remain unchanged.

This settles the page lifecycle, without manufacturing metadata, detector
receipts, passing checks or full coverage. Finalization reads only the needed
observation scalars alongside its existing metadata projection. A disposable
database fixture retains a two-megabyte document while transferring less than
twenty kilobytes across ten page cases. Native Chromium and installed workers
exercise an Accessibility failure, independent repair and recurrence while the
metadata parser is deliberately unavailable throughout. These are local proofs,
not production or external-provider acceptance.

Bounded page projections retain the native rendered document's final URL beside
its link section and observed base. Discovery can therefore distinguish a local
fragment from another document after a redirect even when whole-document
metadata is unavailable. A declared foreign base still grants the fragment its
actual destination; query variants remain separate public GET responsibilities.
Native Chromium and PostgreSQL fixtures compare direct capture and projected
discovery planning, retaining the originally admitted page identity.

New admissions snapshot `ExecutionSpec` with `engine: progressive-v1` on the existing
Audit ledger. This describes the local implementation candidate, not deployed or
release-accepted behavior. Historical Audits retain their stored stage and
projection contracts below.

Owned manual category rechecks use the same admission and progressive task ledger.
`scope: category` selects Search, Performance, Conversion, Security, Tracking or
Accessibility through one `area`. Admission freezes the latest completed full-site
inventory in the requested environment. Each required page, collector, evaluator
and interaction remains an obligation of that execution. Pages uses a full-site
check; availability retains its existing Outcome execution. A category does not
become the latest full-site analysis or certify unrelated repairs.
Category observations select their collectors through the task dependency
closure. Unconsumed raw-HTTP work is not admitted, and standalone Search tasks
do not request mobile page captures. Cross-page preview comparisons retain
their required desktop captures explicitly. Native Accessibility category
checking, comparable repair and recurrence can therefore settle while the
unrelated raw-HTTP queue is paused, without weakening required observations.
Diagnostic browser profiles follow the named check even when admission retains
the full registry snapshot. A three-page preview repair therefore repeats its
three desktop observations without three unrelated mobile captures. Historical
unknown modules keep their conservative collection policy.

Search category rechecks include the public destination responsibility when
`broken-internal-links` is admitted. They reuse bounded discovery observations
across every frozen source page, including distinct query variants. A shared
destination needs one GET, with separate assertions for each source page. Newly
linked destinations receive only the admitted HTTP observation, without adding
pages, browser captures, second-hop discovery or unrelated evaluators. Missing
page inventories and restricted responses remain unknown, and finalization waits
for the destination cohort as well as the independent Search work.

The disposable native worker case exercises two frozen pages sharing a failed
destination and retaining a separate query variant. It checks one GET per
destination, scoped receipts on both pages, blocked and removed-link uncertainty,
fresh response recovery and recurrence of the same Improvement. The full-site
baseline and page inventory remain unchanged throughout the category attempts.
The failed original destinations span separate continuation batches, so recovery
also exercises the existing receipt combiner across independently committed GETs.

Category finalization records deterministic evidence without requiring screenshots
or an AI summary. Shared collectors commit only admitted findings and repair
assertions. Comparisons preserve the preceding category attempt and original
full-site observations, including recommendations without an Improvement.
The board and website list overlay only the applicable category's current evidence.
Failed, missing or unfinished required work cannot reuse an older passing answer.
When another full-site check starts, last-known coverage retains the preceding
completed inventory's latest category observations and their original dates.
The home and batched Site-list readers select only the applicable completed
inventory in the existing category read. These observations remain historical
evidence; they cannot replace fresh Flags, incomplete method receipts or fresh observations from the
new execution. Their existing freshness window still expires. Once the new
full-site check completes, categories tied to the previous inventory retire.
Account summaries select the latest broad Audit, completed broad Audit and
displayed desktop preview in PostgreSQL before loading their payloads. They use
the existing claimed-analysis authority adapter, including request-backed and
provisional history. Historical Audits and unused previews are not transferred
for ORM deduplication. Board and email summaries retain the same evidence
projection. A disposable 120-Audit, 120-preview fixture returned 4 rows and
46,434 serialized bytes for these reads, compared with 361 rows and 5,557,214
bytes through the preceding queries. These are synthetic local database
measurements, not production latency or capacity evidence.
Disposable PostgreSQL fixtures exercise queued, running and failed broad checks
through the owner home, client schema and Site-list freshness projection, using
explicitly persisted observations rather than claiming new webpage collection.
API, MCP and category history use the immutable comparison and shared assessment.
History also reads each finding's recorded Search attention policy when deriving
its Flag count and links. A current indexing regression cannot become a legacy
observation merely because the history query omitted that policy. The controlled
Google worker fixture checks agreement with current Site Flags and run results,
retains the original history after independent repair, and checks recurrence.
Provider responses in this fixture are simulated; this does not establish live
Google acceptance.
Per-check Google reads retain their Site owner, property and authorization grant
through evidence commit. Project and connection locks serialize that comparison
with transfer, disconnect and replacement. A changed grant records unknown
evidence without committing indexing or performance facts or certifying repair.
The legacy account connection follows the same rule; its refresh write compares
the admitted credential and active owner, and returns the resulting grant with
the token. Normal access-token refresh and provider-issued refresh-token rotation
remain usable. Previously committed receipts remain immutable history. Migrated
PostgreSQL fixtures reproduce in-flight grant changes, refused stale refresh
writes, normal refresh and historical replay; the installed worker fixture
separately retains indexed-version repair and recurrence. These are local proofs,
with controlled provider responses.
Local worker acceptance covers Search rechecks, Security repair and recurrence;
live-provider and production acceptance remain separate requirements.

Grouped repair attempts freeze their selected source Flag IDs, independently of
the representative capture and later monitoring observations. The execution
snapshot retains that selection and every original page and phase; collectors
read those original controls through the shared diagnostic source selector.
New declarations also freeze the comparison facts on those Flags. Incremental
source projection can add pages or controls without changing an existing repair.
Admission binds the execution to the stored declaration, and native collectors
read that same comparison through one shared source reader. A repair can run
while its original analysis finishes collecting. Reconciliation locks the Site,
then the improvement ledger, and compares the live Flag before closing it.
Uncovered later observations remain actionable even when the declared repair
succeeds. A late projection preserves earlier recovery only when its recorded
proof also covers the newly projected conditions. No historical comparison
facts are backfilled from mutable rows.
Brief-based declarations recheck the retrieved revision under the same Site and
improvement locks used for capture. A concurrent observation refuses a stale
declaration without writing an attempt; a recorded request key still replays its
original declaration after the live findings change.
Overlapping qualified observations use failure precedence within each original
condition before combining the original scopes. Receipt ordering cannot hide a
recorded failure behind a passing peer. Method, execution, version, applicability
and responsibility-specific completeness still qualify each candidate. Stored
module observations remain immutable, and derived repair summaries reference the
actual failing task. A disposable database case exercises the receipt writer and
canonical recovery reader together after a healthy peer arrives before failure.

Form, primary-action and pricing verification also freeze distinct control
contexts by original page. A page behavior retains its control cohort in one
durable task. Each delivery observes one control, commits its immutable receipt
and checkpoint together, then releases the worker before continuing. Repeated
captures of the same control reuse one observation. Shared page evidence remains
a shared dependency. The fixed task-row limit does not grow with control history.
Its 1,312-row bound covers the full 24-page catalog with retained entry behaviors,
independent browser profiles and the preceding Site-obligation allowance.
Profile separation adds at most one task per page to the former 1,280-row bound.
The earlier 1,200-row bound rejected the 1,229-task base graph even without
additional controls. Dependency validation and progress reads share the bound.
Missing controls stay unknown; a healthy first control cannot hide a failed
second control or certify the whole repair. Single-control historical requests
retain their existing execution shape. Native Chromium fixtures reproduce the
two-form failure and exercise grouped form, primary-action and pricing recovery
with disposable workers, including missing controls and partial repairs.
Ordinary care retains these controls in the existing per-page monitoring intent,
using admitted snapshots and attributable native receipts from the same Site and
environment. The read returns only page/context pairs. Known controls use the
same continuation as repair; discovery has its own observation and skips
controls already assigned a recorded context. An empty discovery remainder is
inapplicable, rather than an incomplete walk or proof that known controls passed.
The full cohort finishes before explanation and finalization. Controlled care runs exercise a failure returning
on the second repaired control, independent later recovery and discovery of a
new form. Other capabilities are deliberately unavailable in those bounded
fixtures; these are not full-site coverage or production monitoring claims.
Continuations initially run behind untried browser work. The existing generation and lease
fences protect every delivery; duplicate jobs cannot advance the checkpoint.
Database reconciliation and initial broker delivery use the same continuation priority.
An admission that yields to earlier waiting work rotates its due time, just like
a saturated admission, so it cannot repeatedly occupy a bounded dispatch pass
and conceal an independent resource. Yielding creates no attempt or failure and
retains the saved observation. Disposable PostgreSQL/Redis workers exercise fresh
linked-page work ahead of primary continuations and HTTP progress while another
Site awaits browser admission.

Queued observations receive primary priority after one minute at the broker,
using the existing delivery recheck and persisted queue timestamp. Fresh primary
work retains its initial lead, while later arrivals cannot perpetually displace
an older linked page or continued observation. Promotion happens once and keeps
its place among equal-priority deliveries on later rechecks. It changes no task
generation, attempt, lease or evidence. A disposable PostgreSQL/Redis worker
fixture models an already queued minute, reproduces primary arrivals overtaking
the old observation, and checks execution order, single attempts and unchanged
younger priority after promotion. This is local queue behavior, not production
capacity or a wall-clock service guarantee.

Retry allowance applies to the current observation, and the global analysis
deadline still bounds the whole cohort. Earlier observations and findings remain
available if later work is interrupted or exhausts. Only opted-in read-only
handlers may continue. Flag publication and page evidence compilation read the
committed control receipts, so a later successful control cannot erase an earlier
failure or hide it from the repair handoff. Disposable PostgreSQL/Redis cases exercise atomic rollback,
replay, interruption, retry allowance and dependent completion. A 24-page planning
case retains 5,000 controls without adding task rows; native functional fixtures
exercise smaller original cohorts, not a 5,000-control browser run.
Flow, journey and slow-connection continuations share one observation commit
on the existing receipt ledger. Checkpoint identity retains the physical task as
well as its page and logical observation. Primary-action, pricing and form
discovery cannot occupy one another's checkpoint on the same page. A legacy key
is reused only for its recorded task; ownerless historical receipts remain
unchanged. The compatibility lookup and commit return only ownership scalars,
without transferring an earlier observation body. Disposable database cases
retain all three independent findings after later control deliveries return no
findings, and preserve historical receipt identity across replay.
Journeys observe one frozen route per delivery;
slow-connection tasks observe at most 20 original actions per delivery. The first
observation commits its cohort once, with its evidence and checkpoint. Later
deliveries retain a reference and read only their next slice. Configuration is
not a website observation. References repeat the Audit, task, page and method
boundary, and cannot fall back to rediscovery when the cohort is unavailable.
Historical flow receipts remain readable. Page summaries omit cohort payloads,
and finalization retains incomplete assessments from every committed journey
observation. Disposable native fixtures exercise 21 slow controls and two original
signup routes through partial repairs, unavailable evidence, recovery and care
recurrence. The larger database fixture establishes bounded transfer, not native
execution of 5,000 controls or production capacity.

New admissions record `browserCollection: per-profile-v1`. Desktop and mobile
DOM, semantics, console and metric collection use independent browser tasks and
deadlines, each holding at most one native context. Desktop document, copy,
Tracking, Search and behavior consumers can proceed before mobile finishes.
Checks requiring both profiles still wait for both. Existing capture profiles,
native comparison conditions, detector versions and physical resource limits
remain intact. Historical snapshots without this collection marker retain their
original combined task. The marker changes execution scheduling, not repair,
retry or request identity.

Within a desktop observation, head metadata, runtime technology markers,
bounded Search sections, whole HTML, published signals, visible copy and
Accessibility retain independent collection boundaries. A failed document read
does not erase the received response or prevent later observations. The browser
task admits independently scoped native evidence even when whole HTML is
unavailable; that missing document stays unknown. Unavailable runtime markers
remain absent rather than becoming an invented empty inventory. A native
Chromium fixture interrupts the HTML read and retains the actual Accessibility
failure, comparable independent repair, recurrence and console evidence through
the real browser collector and evaluator. Focused fault cases separately cover
head, runtime-marker and published-signal failures.

The existing public action collector also owns engagement request receipts.
Its native monitor retains at most 64 same-origin top-frame request observations,
including successful transfers, without another request or browser task. Request
identities retain URL and method comparisons through hashes; receipt text omits
query values. Original page, phase, control and capture conditions constrain
both targeted repair and Watch recovery. One comparable failure disproves repair;
every original request must complete successfully before recovery is established.
The collector settles only already observed pending transfers, for at most four
seconds within its task deadline, with cancellation and disposal releasing the
wait. It does not depend on screenshot or destination-probe latency to receive
the response. Explicit access challenges cannot supply comparable success.
Absent requests, changed queries, missing controls, unfinished transfers and
different access responses cannot supply success. Form-response assertions also
require the same observed form probe. HTTP evidence cannot establish silent
feedback repair or recover unscoped historical findings. Privileged operations
retain their existing authorization boundary.

Disposable native worker scenarios retain 401 and 503 observations across page
loading and the selected public action. They exercise partial repair, absent or
changed requests, different access responses, genuine recovery and recurrence
with the same Improvement. Focused collector tests cover transfer completion,
observation limits, cancellation, exact origins, embedded-frame exclusion and
challenge refusal. These are controlled local HTTP observations, not proof of
live integrations, submitted forms or authenticated business completion.

Diagnostic browser dependencies follow the named repair responsibility, including
ordinary admission snapshots that retain the complete detector-version catalog.
Mobile input sizing, mobile loading windows, persistent mobile loading UI and
paired reduced-motion observations can use their independently recorded mobile
scope. Checks needing desktop page purpose or original paired conditions retain
those dependencies. Historical combined captures keep their execution shape.
Mobile-only Accessibility evidence also establishes applicability in the shared
page adapter; it cannot be mislabeled inapplicable because desktop evidence was
not requested. Unobserved desktop responsibilities remain unknown.

Native worker fixtures exercise ordinary repair admission with its full detector
snapshot and one mobile collector. They retain the original input cohort through
unchanged, missing, replaced and advisory observations, and independently verify
motion repair and recurrence. The loading cohort preserves unavailable evidence,
advisory limits and both recurrence conditions. A mobile-only Accessibility
fixture records an actual target-size rule failure, an applicable receipt and
the resulting Flag. Desktop loading and delayed-mobile collection retain their
existing native regression proofs. These are controlled local observations.

The shared reader joins each profile's own observations. Desktop remains the
document and metadata authority; mobile owns its measurements, motion and native
accessibility evidence. A missing profile stays unknown and cannot borrow its
peer's success. Browser metadata and console summaries commit atomically with
their fenced artifact. The bounded summary query reads only the peer's console
observations, preserving mobile failures without transferring its HTML.
Console normalization retains one private page salt in the task
ledger so the same exception is not counted twice across profiles or retries.
It is not copied into the normalized observation. Mobile-only checks settle
their collected page without requiring an unadmitted desktop document. Broader
pages retain their desktop collection obligation. Controlled native worker
fixtures hold a mobile response while a desktop finding commits, then collect
the mobile result and join console observations. They also exercise mobile-only
Accessibility collection; a full 24-page planning fixture retains both profiles
and existing binding allowance. Discovery allocates page positions independently
of profile count and retains all 24 page positions on replay. These establish
local execution behavior, not production throughput or external-provider acceptance.

Interaction evaluation consumes the native observations it uses rather than
requiring a complete mobile layout measurement. An independently recorded desktop
loading delay remains actionable when mobile collection is unavailable. Mobile
loading and motion stay unknown, and repair still requires every originally
affected device under its original page, profile and access conditions.
The native worker fixture retains a desktop delay through mobile HTTP 503,
records a fix through the application, independently verifies the original
desktop condition and preserves its incident identity on recurrence. The
broader console fixture also exercises both viewport outages, partial repair,
changed navigation, complete recovery and recurrence through native workers.
Paired normal and reduced-preference motion observations also feed interaction
evaluation independently of mobile layout metrics. A failed layout measurement
cannot erase a recorded motion violation. It supplies no loading or content
success: blank or incomplete motion windows still cannot certify recovery.
The native worker fixture interrupts only layout measurement, retains the actual
paired motion violation, verifies an application-recorded repair from fresh
observations and preserves the incident on recurrence. Detector thresholds,
original target cohorts and capture conditions remain unchanged.

Each capture uses its own recorded rules, versions and evidence when assessing
recovery. One comparable failure disproves repair, unavailable peer evidence
cannot certify success, and recovery requires all selected conditions. The
verified write resolves every selected original capture in the same transaction.
Web actions, copied repair briefs and MCP retain the selected incident reference.
Exact historical Flag references and pre-migration attempts keep their original
scope. The additive source-scope migration supplies an empty legacy selection,
rather than reconstructing or enlarging old repairs. Disposable PostgreSQL and
installed HTTP task-worker fixtures exercise this contract, frozen retries,
later observations and cross-Site refusal. The controlled native customer loop
separately exercises URL analysis, claim, default uptime, repair and recurrence;
neither fixture establishes public signup, real providers or deployed behavior.

Verification reconciliation compares the selected attempt's outcome and assigned
verification at the result write, under the existing attempt lock. A delayed
snapshot cannot replace a result already committed by another reconciliation,
borrow a changed assignment or revive a rejected or superseded Improvement.
Refused snapshots publish no result, cycle event or verified learning.
Inconclusive attempts can still resume through comparable committed recovery of
their exact source. Disposable PostgreSQL fixtures reproduce both stale pending
and inconclusive overwrites, owner decisions and reassignment; these are local
checks of result ownership using controlled stored observations.

Owned Site admission persists automatic public availability through the existing
Outcome and binding contract. Free defaults to weekly checks; eligible paid
accounts default to daily checks. The first check is due immediately. Claiming
migrates provisional identity and bindings before adding a missing default.
Worker upkeep initializes untouched existing Sites and retains explicit pauses,
custom schedules, names and historical evidence. Automatic setup and uptime-monitor
initialization share a persisted one-minute retry. Untouched Sites precede due
retries, so a full failing setup batch cannot repeatedly exclude later Sites.
Retry writes retain the original owner, target and setup-state fences, rather than
using the owner's pause or monitoring-error fields. Successful setup clears the
retry; no analysis credit or uptime incident is created by setup failure. These defaults do not depend on
email delivery configuration or an active customer browser session.

Legacy Project deletion uses the same locked Site removal command as current
Site and operator callers. Remaining test accounts require the same exact
acknowledgement. Removal fences pending Runs and task leases, preserves completed
observations and account records, and cannot be reversed by automatic setup.
The Project list excludes removed Sites. Identity edits retain the owner and
non-deletion predicate at the write and preserve the configured protocol and port.
Explicit restoration through a new URL admission, signed claim or Project
creation rechecks capacity and resumes public defaults atomically with identity.
Existing Outcomes, bindings and past assessment dates remain intact; their future
freshness follows the restored schedule. Privileged account checks stay disabled,
and an ordinary pause does not become a restoration. Project creation responses
read the post-setup schedule. Disposable PostgreSQL fixtures exercise actual
routes, ownership transfer during blocked writes, account acknowledgement,
replacement admission and all three restoration paths. These are local proofs,
not evidence that ambiguous historical legacy rows were classified or changed.

Monitoring controls share `sites/application/monitoring-settings.ts` across Site,
legacy Product, MCP and operator callers. Its conditional Site update fences the
current owner, non-deletion, cadence and due state; enabling also checks account
lifecycle. Schedule and Outcome freshness commit together, including within an
admitted operator transaction. Repeated saves of an active cadence preserve its
due work, lease and retry history. Paused monitoring resumes immediately using
the current saved cadence. Pause retains that cadence without depending on
Redis or account-policy availability. Disposable PostgreSQL fixtures exercise
concurrent transfer, removal, suspension and cadence edits, plus rollback of
both writes after a real database constraint failure.

Outcome permission and label commands retain the caller resolved by owner
access. Reloading a Site cannot replace that caller with a new owner, and a
body-supplied actor has no authority. Availability setup, page-specific creation,
confirmation, withdrawal, renaming and enablement share one authority transaction.
It locks the active account, expected Site owner and target before any mutation.
Creation and its confirmed binding commit together; rejected confirmation cannot
leave an unconfirmed Outcome behind. Signup fixture and exact-target validation
use that same transaction. Existing identity, names, authorization revisions,
assessment history and binding rules remain authoritative. Disposable PostgreSQL
fixtures reproduce former-owner commands, stale setup, inactive owners and real
confirmation-write failures. They also retain concurrent withdrawal, renewal,
native task fencing, cleanup and cross-Site isolation.

`Project.watchPausedAt` records explicit monitoring intent independently of
the next analysis time. Pause disables the uptime monitor and revokes its probe
lease in the same transaction. Scheduling, admission, current status, completion
recovery and both alert paths honor that intent. Late probe results cannot
publish after pause, and incidents stay open until a fresh observation after
resume proves recovery. Observation commits lock the admitted account, Site and
monitor in that order, retaining ownership and active-account authority through
the evidence, incident and notification-receipt writes. An expired probe lease,
including expiry while waiting for those locks, cannot record recovery or consume
the due slot. A fresh authorized probe can retry that slot on the same monitor.
Basic uptime continues through an allowance-limited or
halted analysis clock when the Site is not explicitly paused. Owner restoration
of a removed Site clears pause through default admission. The additive migration
preserves known explicit pause markers and leaves quota and absent-clock states
unpaused; its timestamp is a migration baseline, not historical provenance.
Disposable database fixtures exercise the real pause command, retained cadence,
queued and active probes, incident continuity, stale alert claims and migration.
Site home and list use the same explicit intent for their existing paused state.
A quota-limited or halted analysis clock retains its existing quota or delayed
state while uptime remains active, rather than describing the whole Site as paused.
Scheduler selection and missing-monitor diagnostics share the current-Site
eligibility predicate. Operational uptime counts and queues exclude explicit
pauses, including Sites without a monitor, while retaining historical delivery
failures as their separate operational obligations. Disposable PostgreSQL lock
fixtures and the installed BullMQ worker verify these local boundaries; they do
not establish deployed behavior or live notification delivery.

Operator reconciliation checks its scoped grant before scheduler changes and
passes the operator through scheduled admission. A new RunRequest records the
operator as requester with the operation reference. Reusing a scheduled receipt
also revalidates the operator's session, role and lease. The local worker fixture
exercises actual admission, completion, replay and session revocation alongside
the ordinary signed claim, default uptime, repair and recurrence journey.

Due uptime dispatch also rotates by a persisted attempt timestamp, independently
of observation and due clocks. Failed publications and jobs awaiting execution
retain their due work while later Sites receive a turn in bounded batches.
Publication checks the selected Site authority, target generation, schedule,
due state and worker lease. Confirmation retries retain their original failure
slot. Disposable PostgreSQL and installed BullMQ worker fixtures verify this
fairness and recovery with controlled HTTP responses; they do not establish
production scheduling or external-provider behavior.

Uptime queue recovery also revives a retained terminal job when its persisted
slot remains due. Exhausted worker attempts and completed jobs that skipped an
unexpired database lease cannot permanently strand that slot. Replay retains
the original queue identity and observation claim, respects confirmation due
times, and does not replace historical probe or incident evidence. Disposable
installed-worker fixtures establish actual observation after both interruptions.

Anonymous Site admission retains the supplied HTTP(S) origin, including its port
and host spelling, separately from hostname identity. Claiming commits Audit
ownership, provisional Site redirection, page and Outcome migration, and default
monitoring in one serializable transaction. Claim replay checks the linked Site's current owner before restoring it or writing identity and intelligence. A report possession proof cannot authorize another owner's Site; a refused claim retains its cookie for recovery. Disposable PostgreSQL fixtures exercise this ownership boundary alongside evidence continuity and rollback. Colliding Outcome slugs receive distinct internal
slugs while retaining their original IDs, bindings and history. Matching labels
do not authorize merging responsibilities. Duplicate page associations merge
without violating their unique keys. Scheduled Watch selects production
Outcomes; a staging responsibility cannot prevent production uptime admission.

Optional prescription admission retains the worker's Project-before-Audit lock
order and shared Site authority. That guard reads authorization in a new statement
after acquiring the project row lock; a pre-wait ownership decision cannot survive
a committed transfer, removal, physical deletion or suspension. Recovery excludes
former-owner reports before its batch limit and counts only admitted work.
Historical reports and original evidence remain unchanged. Disposable PostgreSQL
fixtures exercise blocked coordinator and task writers, delayed prescription
admission, eligible recovery behind retained reports and legacy owned reports
without a Site. Same-owner account cleanup retains its existing exception.

Coordinator and task admission, guarded writes, lease renewal and prescription
admission acquire Site and Audit locks through one execution-scope guard. After
the Audit lock is acquired, its Site identity must still match the locked scope.
An anonymous-to-owned claim crossing that wait rolls back and retries through
the existing bounded transaction policy, before the observation writer runs.
It does not repeat collection or discard the worker's completed observation.
Consumers no longer reconstruct the parent Audit lock independently. Disposable
PostgreSQL fixtures hold a real claim open while coordinator and task writers
wait, then prove one observation commit and retained Site protection afterward.

Scheduled Site care uses the existing broad task graph when the configured
production target needs fresh Site evidence. Daily and weekly schedules repeat
that graph on their saved cadence; shorter schedules retain their availability
and configured binding cadence while reusing recent broad observations and
refreshing them about daily. A scoped verification cannot stand in for a broad
Site check. Enabled required bindings are derived at admission without requiring
another confirmation; privileged mechanisms retain their own live authorization
and fixture safety checks. Broad requests start at the Site, rather than a single
binding's destination, and compare against a recorded broad parent.

Scheduled admission saves each Site's next execution without waiting for optional
Google context or email delivery. The existing worker scheduler runs admission,
notification retries and Google context upkeep independently, with local overlap
guards and their own distributed ownership. Google upkeep selects at most 20
stale connections on monitored, non-deleted Sites with active owners and reads
at most two providers at once. Inactive owners are excluded before the batch
limit, and the same active-owner condition fences cached credentials, token
refresh and context commits. It refreshes dated context about daily, independently
of a Site's weekly analysis cadence, preserves prior observations on failure, and stops admitting
later connections when its scheduler lease is lost. Credential and grant fences
remain the authority for reads and commits. Each pair settles independently,
including claim and failure-write errors, so one connection cannot abort later
selected contexts. Disposable database fixtures exercise inactive owners,
in-flight lifecycle changes and per-connection persistence failures. These local
fixtures do not establish real Google acceptance or notification delivery.

Summary scheduling acquires the account before creating or updating its
preferences and delivery receipts, matching the Settings save lock order.
Concurrent saves cannot restore a consumed due slot or deadlock against the
receipt's account foreign key. Saving another email preference also reconciles
an effective monitoring-cadence change, advancing the schedule and receipt
revision together. Unchanged schedules retain due work. Disposable PostgreSQL
fixtures exercise initialization, competing admission, cadence changes and real
row-lock contention; provider delivery remains mocked in these fixtures.

Google OAuth completion now owns Site admission in the connection application
code. After code exchange, its credential write rechecks the admitted owner,
active account, non-deleted Site and original URL and hostname in one short
transaction. Refresh and context publication carry the expected owner from
their admitting route, Search check or scheduler selection. Account and Site
locks follow User, Project, connection order and retain permission through the
credential or fact commit. Provider calls remain outside those transactions.
Changed ownership cannot admit a cached token, rotate an older credential,
or replace dated context from an in-flight read. Disposable database fixtures
reproduce refused initial and replacement OAuth grants, ownership changes during
refresh and collection, removal, suspension and target changes. Existing scoped
Search and Analytics behavior and historical facts remain intact. These are
local permission and persistence checks, not real-provider authorization proof.

Site Google connections also retain the authorizing owner separately from the
Site's current owner. Cached-token reads, refreshes, context writes, per-check
Search admission and disconnect compare both identities. A transferred Site
cannot borrow the former owner's grant or display that owner's retained provider
context. Upkeep joins grant and Site ownership before its batch limit, preserving
progress for eligible connections. A fresh OAuth callback can bind the new owner,
but resets the old property identity and observation date before any new context
is published. Retained facts stay in storage until ordinary successful refresh
replaces that projection; a failed new-owner refresh cannot relabel them.

Migration `20261026170000_site_connection_authorizer` binds existing grants to the
current ownership baseline without changing tokens or facts. This preserves the
previous connection contract; it does not reconstruct original authorization
provenance. Authorizer erasure removes that binding. Disposable PostgreSQL fixtures
apply the exact migration to legacy-shaped tables, verify cached and expired
grant refusal on both providers, fresh-owner reconnection and bounded upkeep.
The existing native Search repair and recurrence cycle passes with the bound
grant. These are local checks; migration rollout and real Google acceptance
remain external verification requirements.

Site Google token admission compares the admitted refresh grant and current
owner, then reads its latest credential. Independent index, performance and
context workers can reuse an already committed renewal. Refresh writes still
compare the selected credential and cannot replace a newer token. A losing
write or competing provider refusal only reuses a sufficiently fresh credential
for that same grant and owner; changed grants, revocation and inactive owners
remain refused. Disposable database fixtures reproduce simultaneous index and
performance admission and delayed successful, rejected and malformed refreshes.
The native Search worker cycle starts with expired credentials and retains all
four page/module receipts before exercising failure, repair and recurrence.
No provider operation or waiting worker holds a database transaction open.

OAuth and report responses share bounded Google response parsing and typed
failure classification. Token-service outages, quotas and malformed credentials
cannot become invented authorization expiry. Search admission retains provider
retry guidance for both Site and legacy credentials; transient attempts use the
existing worker retry path before committing a final observation. The native
worker fixture observes a token-service failure, resumes without reconnection,
and then completes the existing Search evidence, repair and recurrence cycle.
Manual refresh returns a retryable failure without changing permission. Context
upkeep retains dated facts and requires reauthentication only for an explicit
grant or permission refusal, never words or status digits in an exception.
Compatibility token-only readers retain their nullable response while the
evidence reader preserves failure meaning. These are controlled local provider
responses, not live Google outage or authorization proof.

Analytics property selection follows account-summary and data-stream pagination
and stops at the first stream on the Site's hostname aliases. It no longer
returns a partial list of twenty properties as a complete catalog. Refresh of a
retained property reads that property's metadata and streams directly, preserving
its identity without enumerating unrelated accounts. Discovery shares the
existing twenty-second provider deadline and permits at most one hundred Admin
API requests. Exhausted budgets, repeated page tokens and failed reads remain
unavailable, preserving dated facts; only a completed unsuccessful search can
establish a mismatch. Controlled provider responses and disposable PostgreSQL
fixtures exercise matches beyond the old limit, later account and stream pages,
direct refresh and incomplete discovery. Pagination follows Google's
[account-summary](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/accountSummaries/list)
and [data-stream](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.dataStreams/list)
contracts. Real Google acceptance remains separate.

Bounded Watch admission rotates by the existing `watchLastAttemptAt`, with
never-attempted Sites first. A fenced write records admission effort before
account-policy reads and retry persistence. A Site whose read and retry write
both fail therefore retains its original due check without occupying the next
batch ahead of untouched Sites. Rotation checks the selected owner, schedule,
account lifecycle, available lease and prior attempt clock. It does not advance
the analysis due date or establish website evidence. Disposable PostgreSQL
fixtures reproduce one-Site batches across interruption and retry, and exercise
concurrent control and ownership changes. Admission is controlled in those
fixtures; webpage execution remains covered by the separate native worker cases.

Execution recovery also isolates pending Audit dispatch, coordinator admission,
individual task delivery and each existing Audit graph. A failed claim or read
retains its intent and cannot abort later items in the bounded batch. Active
Audit dispatch leases are excluded before selecting the batch. Coordinator
recovery compares the selected due time and moves attempted admissions behind
other due work before reading them, so repeated read failures or capacity waits
do not monopolize the next pass. Task batches settle every dispatch result and
count only successful deliveries. A failed pending-dispatch sweep still permits
recovery of previously admitted graphs. Disposable PostgreSQL and real Redis
worker fixtures exercise claim and read failures, independent execution, lease
exclusion and subsequent retries; native application fixtures separately verify
broad partial coverage, recovery and recurrence.
Recovery settles expired dependencies before evaluating readiness, using only
the transitions it committed. A dependent that precedes its inputs in stored
order can proceed in the same sweep. Retryable crashes retain their delay and
cannot release their dependents. Disposable worker fixtures exercise expiry,
exhausted crashes, pending retries and storage-driven partial finalization.
Worker failure callbacks also retain the exact delivery ID, Audit and unclaimed
generation before expediting a retry. A failure after a committed continuation
cannot release the next generation's delivery reservation or change its due
time. Malformed callbacks and retired analysis work leave the ledger untouched;
eligible completion work retains its recovery path. A real Redis worker fixture
reproduces interruption after the next delivery is queued and checks the saved
observation and reservation remain unchanged.

The shared task engine enforces each handler's budget across protected-effect
reconciliation, evaluation and commit. Expiry releases the queue worker and uses
the existing bounded crash retry policy, retaining incomplete evidence. The
handler's cancellation signal follows nested execution scopes. Cancelled
continuations cannot start guarded writes, and guarded transactions recheck
cancellation before committing so in-flight writes roll back. The engine retains
separate authority to record the failure. This boundary does not reverse external
effects or terminate arbitrary JavaScript; collectors retain their physical
resource deadlines, and protected retries still require reconciliation before
another effect. Disposable worker fixtures verify queue progress, late-write
denial, transaction rollback, exhausted retries and protected reconciliation.

Public HTTP collection also follows the owning execution's cancellation through
capacity admission, DNS validation, redirects, response reads and gzip decoding.
Canceled requests leave the shared queue or close their active transport without
becoming a website timeout finding. Parser cancellation retires the worker before
releasing its single physical slot, so an obsolete response cannot satisfy a
later request. PageSpeed tasks pass the same execution signal to their existing
provider transport; canceled attempts cannot replace cached measurements with a
failure sentinel. Native HTTP and parser fixtures and disposable PostgreSQL,
Redis and worker fixtures exercise cancellation, task replacement, retained
incomplete work and independent subsequent observations. Provider responses are
controlled locally; these results do not establish production acceptance.
The shared AI SDK transport also inherits execution cancellation for every
triage, prescription and journey consumer. Its application retry runner cancels
backoff and refuses further attempts or provider fallback after ownership ends.
Installed OpenAI and Anthropic SDKs against local HTTP fixtures verify transport
closure and a later independent request. Existing provider-consumption custody
remains authoritative; transport cancellation does not prove that a provider
stopped computation or incurred no charge.

Progressive graph admission uses a bounded cross-worker window, independently of
legacy whole-audit concurrency. `AUDIT_ACTIVE_GRAPH_LIMIT` defaults to eight;
HTTP, browser, provider and evaluator queues retain their own physical limits.
A waiting provider no longer consumes the sole local coordinator's effective
analysis capacity. The existing admission lock bounds concurrent reservations,
coordinator replay preserves task identity, and scheduled recovery admits waiting
work after a slot opens. Public availability retains its reserved admission path.
`AUDIT_WORKER_CONCURRENCY=1 node scripts/verify-progressive-execution.mjs --only lib/audit/progressive/__tests__/admission.integration.test.ts`
verifies independent HTTP collection and Security findings alongside paused
provider work, concurrent bounded admission, replay and recovery in disposable
PostgreSQL and Redis. This is local scheduling evidence, not production capacity
or provider acceptance.

Checked pages assess their recorded public GET independently of rendered content.
Missing pages and server errors create a `page-http-error` Flag through the shared
check registry. The evaluator reuses public destination classification and the
existing HTTP collector, without another request. Challenges, restricted access,
incomplete bodies and mismatched request scope remain unknown. Repair repeats
every originally affected URL through HTTP-only tasks; successful redirects prove
transport recovery without claiming rendered behavior. Retained-page worker
fixtures cover failure, challenge uncertainty, exact repair and recurrence after
the page's navigation link disappears. Final projection and rubric scoring read
all committed task findings, including pages whose metadata could not be compiled;
no synthetic HTML or successful rendering is substituted. These fixtures establish
local behavior, not deployed monitoring or production acceptance.

Run lease cleanup requires observed abandonment. A failed Audit read or failed
result reconciliation defers the request, preserving completed observations and
any assessment already committed. A completed Audit awaiting reconciliation
still owns its active request. The abandonment write rechecks the selected Audit
identity, unfinished legacy or failed execution, and expired request lease, so
late completion or Audit attachment cannot be overwritten. Recovery continues
for other Sites after a candidate query fails. Migrated disposable PostgreSQL
fixtures exercise both interruptions, both races, idempotent assessment retry and
continued reclamation of genuinely expired legacy requests.

The scheduled request-recovery pass selects at most 100 candidates by oldest row
activity, then request time and identity. Before attempting reconciliation it
conditionally advances only that selected request's activity timestamp, requiring
unchanged activity and still-recoverable ownership. Persistent failures therefore
yield the next pass to untouched Sites without extending a lease or inventing a
verification result. Concurrent renewal, settlement or other activity skips the
candidate. A disposable database fixture holds 100 result projections interrupted,
recovers later completed and abandoned requests on the next pass, then reconciles
all preserved results after the fault clears. Original Audit rows remain unchanged.

Normal run settlement and abandoned-run recovery select only the source Audit's
completion time and latest checkout journey references. Retained report JSON,
journey plans, action details and accessibility trees do not cross this read
boundary. A disposable PostgreSQL fixture reduces the selected run from about
nine megabytes to 2,364 bytes while preserving successful, failed and blocked
binding conclusions, ordered screenshot references, freshness and replay. Stored
Audits, journeys and binding observations remain unchanged. This measures local
data transfer for that fixture, not production throughput or checkout collection.

Binding settlement and current method evidence share one recorded-revision reader.
Both require an explicitly recorded matching revision, including revision one.
Admission or assessment coverage cannot supply an observation's missing revision.
Existing explicit revisions in legacy observation detail remain usable;
the structured revision remains authoritative when both are recorded. A
comparable required failure still takes precedence over another method's missing
correspondence. Disposable PostgreSQL fixtures reproduce the former false Clear
and false Flag, retain the original observations and completed Audits, and check
the shared run result and idempotent assessment replay after correction. Current
method cards and MCP withhold the same unmatched proof while preserving its raw
timeline. Native availability and authorized Signup scenarios retain their current
failure reasons, uncertainty, independent repair and recurrence.

Watch and uptime notification senders share the same bounded installed-SDK
transport and acceptance parsing. Uptime separately retains its incident receipt,
frozen provider body, current delivery permission and exact attempt ownership.
Uptime delivery clocks advance across a slow batch, so later claims retain their
full lease and retries retain their delay from the actual failure time.
Obsolete outage and recovery messages retire without rewriting historical
incidents or delivery bodies. Recovery admission fences a newer confirmed
incident as well as current delivery permission.
The uptime delivery contract and additive payload migration are described in
`docs/uptime-monitoring.md`.

Analytics property matching identifies a web stream, then filters every report
to the Site's exact bare and www hostname aliases. Sibling subdomains and other
websites sharing the property are excluded. One same-property batch obtains
bounded page session and `screenPageViews` counts and a separate dimensionless
Site aggregate for sessions, active users and views. A third report explicitly
requests the Site entry and up to 25 paths from recent saved Site pages, with the
same hostname filter and reporting window. This keeps low-traffic watched pages
outside the top 25 report observable. Duplicate top and watched rows use one
provider aggregate, never a sum. Malformed and foreign saved URLs cannot expand
the scope. Page counts never sum into Site totals. Response
columns are matched by their names, and absent counts remain unknown while
explicit zero counts remain valid. An empty or malformed report preserves earlier
context and its original date rather than manufacturing a fresh zero.

Each Analytics fact stores its reporting period and versioned property/hostname
scope. Current readers require that scope to match the connection and owning
Site. Historical unscoped facts remain stored but cannot supply current traffic
context. Audience evidence cannot establish tracking ingestion or resolve Flags.
The nullable `reportScope`, `activeUsers` and `pageViews` columns require migration
`20261014050000_scope_analytics_site_reports`. The full migration history and
adapter, persistence, reader and credential-race fixtures pass against a disposable
local database; the configured application database is unchanged. Real Google
acceptance and reporting semantics still require authorized provider verification.

The page-traffic fixture supplies a full top-25 report, independent watched-page
rows and a distinct Site audience aggregate through the live adapter, then
persists and reads them through the actual database path. It proves low-traffic
entry and saved-page visibility, overlap deduplication, named-column parsing,
unknown counts and cross-host refusal. Page context uses genuine views when
available and labels sessions separately when only those were reported. Existing
context presentation stays compact; no new dashboard or settings are introduced.

Connected Search Console context shares the hostname scope foundation in
`lib/sites/connections/report-scope.ts`. Its page regex filter limits the property
query before the provider selects top page/query rows. Local conversion also
rejects sibling and foreign hosts, relative URLs, embedded credentials and URLs
outside the selected property's protocol, host, port or path prefix. Each fact
retains the complete provider page URL in its recorded scope, along with its
reporting period. Readers withhold legacy unscoped context without assigning it
an invented origin. Missing impressions or clicks stay unknown; an empty report
retains earlier dated context. Provider top rows are context, not exhaustive
Search coverage or a Site total.

An unavailable context report does not prevent independent URL inspection using
the current grant. Revoked, mismatched or reauthentication-required connections
still cannot execute it. Sixteen disposable-database connection fixtures cover
both provider adapters, persisted scope, current readers, retained dates, explicit
zero and credential races. Focused inspection tests also cover independent access
and refused credentials. Real Search Console acceptance remains external.

Admission reads saved website access under the owning Site lock and seals that
decision in the execution specification. A child uses current saved access,
rather than its parent's private snapshot. Explicit one-off credentials and
public opt-outs stay independent and cannot acquire Site access later. Saved
grants bind executable credentials to an origin and reference. Replacing or
removing credentials rotates the reference, cancels unfinished dependent work,
settles pending repair attempts as inconclusive and invalidates stale write
leases. Restoring the same secret does not revive an earlier grant. Changing
only the handoff note preserves the grant and active work. Completed reports
retain their original encrypted evidence. Unversioned credential snapshots
require a matching live legacy Site grant; absent or unreadable access fails
closed. These records reuse existing encrypted storage and execution metadata.

Saved access also retains the owner who supplied or revoked that decision.
Ownership changes do not transfer executable credentials. Fresh admissions use
public access until the new owner supplies credentials, while previously
borrowed snapshots fail the shared execution resolver. Explicit one-off access
retains its independent scope. Supplying even identical credentials under a new
owner rotates the grant reference and cannot revive old borrowed work. Settings
read the same grant envelope and revocation marker as execution, so removing
access is unconfigured rather than an unreadable-secret error. New credential
writes use User then Site locks and require an active account; revocation remains
available after suspension or erasure begins.

Migration `20261026173000_scan_access_authorizer` preserves retained decisions
under their current owner baseline without reencrypting secrets or rewriting
Audit evidence. It does not reconstruct historical authorization provenance.
Disposable database fixtures apply the exact migration to legacy-shaped tables,
exercise removal, ownership, unreadable owned access, snapshot refusal and
inactive-account revocation. The existing native worker fixture still uses
current authorized Site access independently of its parent snapshot. Production
migration and private-site acceptance remain separate requirements.

Browser Basic authentication and custom headers, and separately fetched flow
destinations, use the approved origin. Default cookies keep that origin's host;
explicit cookie domains and paths retain their declared browser behavior.
Primary-action and form comparison scopes include native capture access and
profile identity, so a different login or capture setup cannot certify recovery.

The shared page evaluator also scopes page-level metadata, trust, content and
layout findings to native capture conditions. Detection remains available when
comparison scope is missing, but neither a new fix verification nor Watch can
use unknown scope as recovery proof. Metrics-based layout comparisons retain
both the desktop document and mobile observation. Existing control, loading,
network, accessibility and HTTP contracts remain their own evidence sources.
For a finding affecting several pages, every original page condition must be
observed in the same execution and check version. A historical page finding
without native conditions cannot borrow a new scoped receipt. Advisory content
and visual judgments remain observations, rather than verified business results.

Metadata presence checks record explicit completed observations for preview
image, title and description, favicon, page language and viewport declarations.
The same assertions supply targeted repair and automatic recovery evidence under
the original native page conditions. A missing completion marker cannot certify
repair. These observations establish declaration presence, not image delivery,
rendered sharing previews, language accuracy or successful mobile rendering.
Disposable worker fixtures exercise all six repairs from fresh browser evidence,
unchanged and incomplete results, scheduled recurrence under the same incident
identity, and later automatic recovery. Unrelated provider, image and interaction
work stays explicitly unavailable in this local proof.

Public trust observations use one bounded native collector for landing and
reached documents. It shares the published privacy/contact predicate and markup
vocabulary with parsed metadata, and stores only signal facts, collection time
and the actual browser capture conditions. Public contact text, links, structured
data and analytics declarations have independent bounds. A positive observation
survives another source's limit; uninspected absence remains unknown. Contact
inspection walks bounded text directly without cloning the whole document.

When full metadata is unavailable, the trust evaluator consumes those native
facts and the existing independently collected consent controls. Controls must
match the same page, profile and access conditions. Changed URLs, non-successful
page responses, read restrictions and unrecorded scopes cannot certify repair.
An observed consent control establishes its presence without claiming analytics
delivery, enforcement or legal compliance. Unobserved analytics with no control
remains inconclusive. Ordinary full-metadata checks retain their prior semantics.

Collection follows the admitted browser consumers. Unrelated targeted checks
skip this native walk; historical or unknown plans retain complete collection.
The shared page adapters publish the same assertions for detection, independent
repair and monitoring, using the native observation time. The destination-only
collector is removed. Native worker fixtures establish privacy, contact and
consent repairs with oversized DOM content, preserve access and unavailable-scope
uncertainty, and recognize privacy recurrence on the same Improvement. Controlled
destination regressions retain their large-document and incomplete evidence.
These are local proofs, with provider delivery and production acceptance separate.

Site Security coverage consumes the public security evaluator's current
resource-transport assertion together with its HTTPS observation. Older explicit
image-transport receipts retain their historical scope, but cannot override a
current resource result. Failed, incomplete or advisory assertions cannot provide
the positive evidence used by the Site card. The unused parallel module-coverage
reader has been removed; Site coverage continues through the shared receipt model.

Mobile layout uses the shared bounded rendered action inventory for primary-action
selection, style cohorts and button radii. Font and field samples retain their
independent document-visibility measurements. Incomplete action inventories withhold
primary-action labels, positions and complete style or radius assessments. Zero-size, hidden and
transparent content cannot populate those measurements. Below-fold controls
retain their document positions, and a descendant that explicitly restores CSS
visibility remains observable. Hidden submit labels cannot replace a visible
search input's own label. These remain top-document observations and advisory
layout signals, not proof of visitor behavior or device-specific usability.

CTA focus and action hierarchy share the mobile collector's bounded style cohort.
It records up to 40 visible high-intent action samples, compares solid filled,
outlined and text surfaces, then type size, weight and control height within the
strongest surface tier. Labels remain deduplicated. Width does not determine
weight because label length changes it. Secondary styling can therefore reduce
the competing-action count without removing useful actions. Both evaluators
retain their existing thresholds. Background images, filters, blend modes,
translucent surfaces and a truncated style inventory leave the assessment
incomplete. These are advisory style signals, not measured visitor attention or
conversion outcomes.
Native Chromium fixtures exercise filled, outlined, smaller and demoted actions
and gradient uncertainty. A disposable worker fixture records demotion, complex
paint and restored competition through the actual collector and evaluator. Its
repair attempts remain inconclusive because an advisory style observation cannot
certify a customer outcome.

Input sizing retains unique DOM selectors and hashed control semantics without
field values or raw identities. Passing, failing and unidentified controls keep
separate bounded assertions. Repair compares every originally failed input under
the same page, redirect, mobile profile and access conditions. Another same-named
field cannot certify a removed input, and replacing its type or form scope cannot
borrow the original proof. Adding unrelated fields does not invalidate a measured
repair. Indistinguishable anonymous controls, incomplete inventory and historical
unscoped targets stay unverified. Native fixtures cover shared names, repeated IDs,
replacement, privacy and independent CSS repair. The disposable application,
queue and worker fixture exercises unchanged, removed, replaced and repaired forms,
an additional healthy form, and recurrence with the original Improvement.

HTTPS detection and repair share the public security transport evaluator and
registry ownership. A targeted HTTPS check collects only HTTP evidence and
finalization; it has no browser, storage or provider dependency. The original
admission URL remains its scope, so an observed redirect to HTTPS can establish
the intended transport repair. A recorded HTTP response can establish protocol
even when HTML is unavailable, without certifying resource declarations or page
health. Missing response evidence remains unknown. A later HTTP response retains
the original issue identity as recurrence. Findings redact query and fragment
values from displayed URLs, and historical original-HTML receipts remain readable.

Site health uses the shared resolved-Flag predicate. Open, unchanged, regressed
and unverified findings continue to require attention even beside newer passing
evidence. Fixed and ignored findings do not contribute to current counts or
severity. This keeps category refreshes and the broad Site card aligned with the
same recurrence facts used by history and independent verification.

Browser authentication and header interception use the saved access origin rather
than rebinding permission to the initial navigation URL. A redirect from a public
alias to that approved origin can use the existing grant; the alias and foreign
authentication challenges receive no Basic credentials or configured headers.
Cookies retain their declared domains and paths. Capture identity marks this
Basic/header replay policy when the initial origin differs, and all screenshot, loading,
motion, overlay and live-page consumers share that identity. Earlier captures
with different executable access remain unverified.

One scheduled tick retains its admitted scope and binding selection on retries.
A replay returns the recorded selection, not newly derived coverage. A new
request cannot reuse an active broad run that lacks its current binding scope.
Bound incidents remain owned by Outcome assessments; broad diagnostics do not
rewrite them through the report comparison. Notification classification combines
both committed projections after reconciliation. Successful availability does
not certify whole-Site Clear through the run API.

Finalization persists alert eligibility before its completion receipt and leaves
provider delivery to the independent notification sweep. The sweep selects only
completed projections and rechecks current notification preferences before a
leased provider attempt. A held email response cannot delay useful results or
consume another check's worker. Local provider fixtures establish this isolation
and stale-sender fencing, rather than real email acceptance.

Flag projection groups observations by their existing fingerprint and writes each
Improvement, all source occurrences and cycle events in one fenced transaction.
Each group is projected once, retaining every source Flag and its idempotent
history. An interrupted cycle write rolls back the group for a complete retry.

Bound findings retain Outcome and binding identity, with the originating Flag
referenced by the binding execution. Outcome assessments commit incident
continuity and recovery with their Flag and Improvement projections. Unknown
checks preserve an unresolved incident; repeated failures do not create another
alert. Comparable successful execution of every required binding closes the
incident, and a later failure records recurrence. Configuration, environment,
version and fixture changes cannot certify an earlier failure as repaired.

Authorized Signup fixtures submit once and observe their declared text, visible
target or exact destination within a bounded eight-second window. A success
signal already present before submission, an exhausted execution budget, a
scanner refusal or unproven cleanup remains inconclusive. Confirmed missing
completion creates a scoped Flag in the same transaction as the binding result.
Observation receipts retain the criterion type and before/after presence without
fixture values, DOM contents or credentialed screenshots.

Public form validation runs independently from the CTA walk. An isolated browser
allows local validation handlers, prevents native submission and denies outbound
requests, popups and live transports during the probe. Worker, clipboard and
dialog restrictions make dependent observations inconclusive. Required fields
with existing values are not submitted. Native constraint rejection or newly
visible form feedback supplies positive evidence; blocked requests, preexisting
feedback, changed forms and incomplete observation do not prove a failure or repair.
Feedback timing and the full negative observation window use the browser's click
clock, so driver acknowledgement delays cannot manufacture slow or missing feedback.
Captured metadata also assigns each field and submit control to its actual HTML
form owner, including external `form` associations, empty or unresolved owners
and first-ID collisions. One inventory supplies field counts, declared-validation
counts and conversion-form size; submit input values can identify an external
signup control. Existing field-type and all-disabled-form exclusions remain in
place. Native Chromium fixtures compare these counts with actual `.form`
ownership. A disposable application and worker fixture observes unchanged and
reduced field counts and retains the same advisory finding through monitoring.
These observations cannot certify conversion improvement or close an advisory
Flag as a verified repair.

The probe uses native form ownership for fields and submitters, including
controls associated with `form="..."` outside the form subtree. It excludes
controls owned by another form, inspects and activates the same visible
submitter, and honors that submitter's `formnovalidate` setting. External fields'
explicit error references remain scoped to their owning form. The form context
includes the native-ownership detector policy; earlier subtree-only observations
cannot certify recovery under the corrected detector. Controlled Chromium and
disposable worker fixtures exercise associated fields, unchanged validation and
independent repair without transmitting a submission. These establish local
behavior, not real account creation, provider delivery or production acceptance.

The existing public flow task commits primary-action presence, click, advancement
and main-frame response observations. Failed findings and repair assertions use
the same recorded page, viewport and hashed control identity. Navigation URLs and
declared panel relationships retain their original scope without exposing signed
query values in finding copy. Native buttons, input buttons, submit inputs and
declared button roles share CTA selection. Input button and submit captions use
the displayed value; editable field values never supply action captions. The shared rendered collector excludes inert controls and controls
hidden by visibility, ancestor opacity or content visibility. A child with an
explicit visible override remains eligible. Disabled visible controls remain
eligible so the action walk can diagnose their actual failure. Native Chromium
fixtures exercise these conditions, visible navigation fallback and actual
navigation to the selected destination. A temporary main-frame response listener
records JavaScript-driven button navigation during the existing click window,
without waiting for navigation on every same-page action or fetching the target
again. Missing responses stay unknown. A completed click alone cannot establish
action advancement or a completed signup, payment or other business outcome.

Targeted primary-action repair selects the originally recorded control, even when
another CTA becomes the highest-ranked candidate. It uses the existing guarded
flow task without repeating unrelated navigation probes, provider work or capture
uploads. An unrelated successful control, changed href, removed control, refused
operation, unavailable response or access challenge cannot certify repair. A
newly visible declared panel can establish its own observed advancement without
pretending that an HTTP navigation occurred. Utility pages without a primary-action
responsibility record that absence as an observation. Historical findings without
comparable action scope remain unverified.

Primary-action observation also recognizes a newly visible dialog or form with
an enabled, visible next control when no `aria-controls` relationship is present.
Before and after reads inspect at most 30 top-document panels and 200 controls
per panel, with viewport hit tests. They retain opaque identities without field
values or form submission. Existing panel text changes, replacement, inaccessible
controls and unsupported new panels remain inconclusive. A completed click or an
unavailable main-frame response cannot establish completed signup or purchase.
Disabled primary controls retain their directly observed failure before optional
overlay inspection. The native worker fixture exercises missing and disabled
controls with invisible higher-ranked links present, declared and undeclared
dialog repairs, and recurrence through a real scheduled Site check while
PageSpeed is explicitly unavailable.

Form assertions retain the original page and hashed form identity. Explicit fix
verification and automatic recovery require the same scoped positive proof.
Removing a form or validating an unrelated form cannot close the original Flag.
Collection bounds the inventory to 40 forms and 100 descendant controls per form,
then probes one selected visible form. This does not establish exhaustive coverage
of embedded, shadow-root or server-dependent validation. Authorized Signup
fixtures retain their separate submission and cleanup contract.

Scheduled and requested Outcome verification share the same scope comparison.
A fresh scheduled child may verify an owner's pending fix when it checks the
same responsibility. Assessment time comes from recorded execution, rather than
the time a delayed projection happens to run. Scoped monitoring history uses
its own proof, without requiring unrelated broad-report pages.
After an intervening inconclusive check, committed recovery may also refine the
fix attempt for its exact source incident. The fix must precede the recovery
execution, its source Flag must have been closed by that recovery, and the
original Outcome scope must still match. Earlier inconclusive cycle events
remain recorded; the new result adds its own provenance.

Historical single-binding Improvement IDs are retained when recorded scope,
version, execution and Outcome ownership prove the migration. Ambiguous or
unversioned history remains unverified. Notification classification reads the
committed transition even after an intervening gap; notification retries cannot
rewind the latest monitoring time or clear a scheduler lease. Missing email
configuration limits notification delivery, while scheduling remains available.

Progressive recovery requires the original responsibility's committed assertion
or comparable Search receipt, rather than an absent Flag or a completed page.

Explicit fix verification and automatic recovery share a recorded-condition
verdict for the original Flag. Progressive verification evaluates that original
scope even when a current Flag still exists. A comparable remaining failure
records unchanged; passing requires every original affected page and native
condition. Missing comparable evidence remains inconclusive. Reconciliation
consumes this same verdict for the attempt, source Flag and learned facts. A
representative-page verifier remains an individual observation in the ledger.
The local two-page Performance worker fixture exercises a passing representative
alongside a failed peer, unavailable peer evidence, complete repair and scheduled
recurrence using controlled PageSpeed HTTP responses. This establishes local
collection, comparison and lifecycle behavior, not real-provider measurements.
Scope, source and admitted version must match. Keyboard and Tracking use the
same scoped proof logic for automatic recovery and explicit fix verification.
Rolling field INP does not prove an immediate repair. Unsupported proof stays
inconclusive even when the surrounding module succeeds.

Legacy and progressive performance execution share explicit score, LCP, CLS and
resource observations for each device. Missing or invalid lab metrics record
incomplete assertions rather than disappearing from a receipt. Progressive
module completeness derives from these assertions, removing a separate metric
presence rule. Missing mobile vitals belong to Performance and do not invalidate
independently completed tap-target observations. The provider parser discards
numeric lab values when their audit reports an error, manual or informative
status, or non-applicability; separately recorded field data remains historical
provider context. A disposable worker fixture retains desktop and mobile LCP
and CLS incidents through absent and errored measurements, then verifies genuine
repair from fresh controlled measurements. It does not prove real-provider
behavior or an immediate field-data improvement.

The response container and individual measurements have separate validation.
An unrelated malformed audit or category cannot erase valid lab or field data.
Scores, numeric lab metrics, resource savings and mobile target criteria remain
unknown when their own required values or status are invalid. Lab, resource,
target and accessibility readers share the same provider measurement-status
rules, including refusal of error, manual, informative and non-applicable
results. Zero remains a real measurement; strings and booleans are not coerced.
Provider-response fixtures exercise these distinctions. Disposable workers
exercise original desktop and mobile failures, missing measurements, independent
repair and field-INP scope with a malformed unrelated diagnostic retained in the
controlled response. These local proofs do not establish live Google behavior.

PageSpeed field observations also survive a failed or missing Lighthouse result.
The [provider response contract](https://developers.google.com/speed/docs/insights/v5/reference/pagespeedapi/runpagespeed)
records loading experiences separately from the Lighthouse runtime result. Each
field cohort still validates its own page or origin. A foreign lab request cannot
authorize an unrelated final-page cohort. Failed lab values, resource savings,
tap targets and accessibility summaries remain unknown even when the response
retains numeric values. The cache stores the observation and typed failure
together, using the existing shorter failure lifetime.

A read-only task can retain a validated independent observation while recording
failure. The task artifact, observation event and primary-page projection commit
in one fenced transaction. Retry attempts and the original recovery deadline
continue unchanged. Later failures without measurements retain the earlier
observation and its original collection time; a successful retry replaces it.
Dependent checks wait for the collector to settle and then consume its recorded
facts, including after terminal refusal or exhaustion. Field INP remains advisory
and cannot prove an immediate fix, while unavailable lab measurements cannot
resolve a lab incident. Controlled provider and disposable worker fixtures
exercise cache reuse, retry replacement, retained observations after refusal,
transaction rollback, invalid observation refusal and genuine later lab repair.
These are local proofs, not live-provider or production acceptance.

Completed-page and evaluator reads share the same settled PageSpeed evidence
reader. A terminal lab failure cannot discard its independently retained field
observations or their limitation. Page summaries remove historical raw provider
payloads in PostgreSQL while retaining measured facts and stored history.
Progressive report coverage also reads exact-Audit, exact-page task evidence,
rather than unpopulated legacy page summaries. Its bounded projection includes
scalar lab metrics and normalized field cohorts, excluding provider traces,
resource tables and diagnostics. Empty objects and invalid metrics cannot become
observations. Available field data or partial lab values retain partial coverage;
complete collection requires valid score, LCP, CLS, FCP and TBT for both devices
on every reported page. Coverage describes collection, not a healthy result or
comparable repair. Historical reports keep their existing source columns.
Disposable PostgreSQL fixtures prove page isolation, retained field evidence,
compact reads and later complete measurements without adding stored copies.
The installed worker separately verifies lab retries, refusal, exhaustion and
independent repair while preserving the original evidence and advisory INP policy.

Fresh CrUX cohorts must match the requested page or the provider-recorded final
page. Page records compare protocol, host, port and pathname; origin records
must identify a matching origin itself. Credential-bearing and unrelated
records cannot supply field metrics or INP findings. This field identity follows
[CrUX page aggregation](https://developer.chrome.com/docs/crux/methodology#page-eligibility),
which removes query strings and fragments, without changing exact live-page
verification scope. Each accepted cohort retains its own original reported URL
and page/origin classification. Invalid field context does not discard an
independent lab score, LCP or CLS measurement. Existing stored evidence remains
readable. Focused provider-response cases and a disposable worker fixture
exercise withheld foreign page/origin metrics, retained lab facts and the
continued refusal to certify an immediate repair from rolling INP data.
Controlled provider responses do not establish live Google measurement proof.

Page summaries retain incomplete module receipts alongside failed tasks in both
execution adapters. Progressive reads obtain bounded module identifiers and map
redirected observations through their owning task; they do not transfer another
copy of collector bodies. The retained `failedModules` compatibility summary
includes unfinished responsibilities, while the receipt's `failed` and
`complete` fields distinguish exceptions from incomplete observations. Page
judging, existing uncertainty scoring and report finalization consume that
summary. Collector presence cannot upgrade a report with recorded gaps to full
completion, including a later prescription phase. Valid individual assertions
remain eligible for comparable repair proof. Disposable SQL fixtures verify
redirect attribution, exclusion of inapplicable modules, retained findings and
partial deterministic finalization with otherwise available collectors.

Broad Site admission retains a bounded page inventory from the latest completed
full Site observation for the same owned target and environment. The stored
execution freezes those URLs across replay. Later care retains that admitted
cohort even when an interrupted collection did not create every page row.
Existing review depth and the
24-page ceiling still apply; new discovery uses the remaining capacity. Retained
pages start independently of entry-page discovery, so removing a navigation link
does not silently remove a previously observed page from care. Foreign,
credential-bearing, malformed and non-page URLs cannot enter the retained scope.
Both execution adapters use the same retained-page policy. The native worker
fixture discovers a page and then exercises scheduled recovery and same-incident
recurrence after its link disappears. Its explicit PageSpeed refusal leaves
Performance unavailable, without manufacturing successful measurements.

Response-header detection and observations share their inspected configuration
predicates. Single findings and consolidated core or hardening findings retain
the exact originally failed header responsibilities and hashed final response
URL. Explicit repair and automatic recovery consume the same scoped assertions.
A rollup disappearing, a different redirect destination, an unavailable response
or malformed HSTS duration cannot certify repair. Missing HSTS recovery requires
the duration recommended by its original finding. Other independently proved
header repairs remain useful while an unrelated declaration is unknown. Header
presence and declarations do not establish policy effectiveness or browser HSTS
preload-list enrollment. Historical unscoped rollups remain inconclusive.

HSTS duration, subdomain and preload observations share one directive parser.
Names match complete case-insensitive tokens, quoted values retain their own
separators, and a quoted numeric max-age is supported. Duplicate directives,
invalid values and missing duration leave the whole declaration incomplete;
syntactically valid unknown extensions remain separate from recognized directives.
A zero duration removes the recorded policy, so its subdomain or preload text
cannot certify protection. The existing one-year duration threshold is retained.
Detection and recovery use the same interpretation, replacing the earlier
permissive detection and strict duration-only proof. Corrected HSTS contexts stay
distinct from historical substring observations. Disposable HTTP and worker
fixtures exercise exact directives, malformed and quoted durations, independent
repair and scheduled recurrence under the original Improvement. This verifies
response interpretation and lifecycle behavior, without proving a browser's
cached or inherited HSTS policy, certificate trust or preload enrollment. Parsing
follows [RFC 6797](https://www.rfc-editor.org/rfc/rfc6797.html#section-6.1).

Permissions-Policy detection and recovery parse an RFC 8941 dictionary through
the pinned, dependency-free `structured-headers` parser. The existing camera,
microphone and geolocation wildcard responsibility recognizes bare and inner-list
tokens, respects the last duplicate key, and distinguishes strings, parameters
and unrelated features. Malformed dictionaries remain incomplete. The pinned
parser retains RFC 8941 grammar: newer date and display-string values rejected
by the tested Chromium cannot make an invalid header look successfully parsed.
Corrected permission contexts remain distinct from earlier substring observations.
Native fixtures compare policy introspection for all three features, without
requesting device access. Disposable worker fixtures verify malformed replacements,
exact repair and scheduled recurrence under the original Improvement. A response
wildcard does not establish device permission, iframe delegation or effective
access after inherited restrictions. The interpretation follows the
[Permissions-Policy dictionary algorithm](https://w3c.github.io/webappsec-permissions-policy/#construct-policy-from-dictionary-and-origin).

Cross-origin opener and embedder observations parse recognized, case-sensitive
Structured Field tokens, including supported reporting parameters. Resource
policy uses its exact case-sensitive value; quotes, parameters and combined
values cannot stand in for a recognized CORP declaration. Unsupported or malformed
policies stay incomplete. Explicit `unsafe-none` and CORP `cross-origin` remain
observable permissive configuration, without creating a new missing-header
finding or certifying a restrictive repair. Current versioned contexts separate
these observations from historical presence-only proof. Native fixtures compare
actual isolation and Chromium's per-frame COOP/COEP state, plus real loopback HTTP
resource delivery across different sites. Intercepted responses do not establish
CORP enforcement. Disposable worker fixtures exercise ignored values, permissive
declarations, exact repairs and scheduled recurrence under the original Improvement.
The response checks do not themselves establish browser isolation or deployment
compatibility. Parsing follows the [HTML cross-origin policy algorithms](https://html.spec.whatwg.org/multipage/browsers.html#cross-origin-opener-policies)
and [Fetch resource-policy rules](https://fetch.spec.whatwg.org/#cross-origin-resource-policy-header).

CSP script and framing interpretation follows bounded
[CSP3](https://www.w3.org/TR/CSP3/) policy parsing: the first duplicate directive
wins, enforced policies intersect, and element/attribute directives override
their script fallback. Nonces, hashes and strict-dynamic can suppress arbitrary
inline permission. WebAssembly-only permission does not grant JavaScript string
evaluation. Enforced frame-ancestors overrides X-Frame-Options; arbitrary web
origins produce a scoped finding, while unsupported ancestor patterns stay
unknown. Corrected script, object and framing observations use versioned contexts.
Older substring or directive-presence observations cannot certify a repair under
the corrected interpretation. Controlled Chromium scenarios compare
actual script execution and embedding with these observations. Disposable worker
fixtures separately verify unchanged permissions, exact repairs and scheduled
recurrence. This is local configuration evidence, not penetration testing or
cross-browser and production acceptance.

Content-type and referrer response observations use the same token interpretation
for detection, exact repair and automatic recovery. MIME protection requires the
first field value to be `nosniff`, rather than a substring anywhere in the header.
Referrer configuration uses the last recognized policy in its fallback list;
quoted unknown values cannot supply a policy token. An entirely unrecognized
referrer declaration remains incomplete, without claiming that a browser default
exposes full URLs. Historical substring observations remain distinct from the
corrected policy contexts. Controlled Chromium fixtures compare actual script
execution and outgoing referrer headers with the collected conclusions. Disposable
worker fixtures separately verify unchanged and unknown declarations, exact
repairs and scheduled recurrence under the original Improvement. These are
response configuration checks; document and per-request overrides and other
browsers remain separate. The rules follow the
[Fetch MIME-protection algorithm](https://fetch.spec.whatwg.org/#x-content-type-options-header)
and [Referrer-Policy fallback algorithm](https://w3c.github.io/webappsec-referrer-policy/#parse-referrer-policy-from-header),
with the installed Chromium's observed case handling retained.

PageSpeed normalization retains bounded resource audit measurements alongside
its established failed-opportunity projection. Score, render-blocking resources,
unused JavaScript, unused CSS and image delivery have exact repair assertions.
Lab, resource and mobile tap-target recovery also require the original requested
page, final destination, Lighthouse version, device and reported measurement
profile. The collector hashes these conditions before discarding raw provider
responses. URL query values and unrecognized settings are not retained in that
scope. A response explicitly reporting a different requested page or device is
unavailable. Missing conditions can still supply observed measurements, but
cannot certify a repair. Historical findings without these conditions remain
inconclusive. The same comparison governs explicit verification and Watch
recovery, with a separate original scope for every affected page. Provider
timestamps retain their provider provenance. Each request also records its local
start and receipt times. Lab scores, resources and mobile tap targets certify
repair only when the reported fetch time falls inside that request window.
Old, future, missing or historically unrecorded timing leaves assertions incomplete
and recovery unverified while retaining the measured numbers and findings.
Requalifying an already scoped context applies the same current timing check.
Controlled worker fixtures reproduce a day-old response that previously marked
a repair Improved, then verify refusal, fresh recovery and recurrence. This
timestamp check does not establish immediate field recovery or production
provider acceptance. These fields follow the
[PageSpeed response contract](https://developers.google.com/speed/docs/insights/v5/reference/pagespeedapi/runpagespeed).
Detection and proof share one resource policy with the existing savings thresholds
and units. New findings retain each failed provider audit, original page, device,
unit and threshold. Page identity is hashed without exposing query values.
Merged findings compare each page against its own original criteria and retain
a separate proof for every affected page. Repair and Watch recovery require those exact measured criteria;
a different provider audit cannot certify the original repair merely because it
normalizes to the same resource category. Image recovery also retains the
completeness requirement for its current insight or supported legacy family.
Historical findings without recorded criteria remain unverified. Missing,
errored, informative and not-applicable provider
audits remain unknown. An explicit successful empty result table can establish
zero matching resources. The provider adapter follows the
[Lighthouse insight contract](https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/insights/insight-audit.js).
Historical opportunity lists without positive measurements cannot certify
resource recovery. A complete assertion remains useful when an unrelated audit
is unavailable, through the same comparison used by explicit verification and
automatic recovery. Field-window INP retains its separate limitation.

Resource receipts retain structured results for each measured provider audit
inside the existing aggregate assertion. Each result keeps its original page,
provider identity, device, unit, threshold and measurement conditions. A known
failure on an original audit remains comparable when another original audit is
unavailable. A failure on a different audit cannot stand in for a missing original.
Success still requires every original scope and the complete relevant provider
family. Historical aggregate receipts keep their existing completeness rules;
individual verdicts are never inferred from their summary text. Controlled
PageSpeed HTTP responses exercise both devices through actual admission,
PostgreSQL, queues and application workers, including unknown evidence, changed
profiles, unchanged failures and complete recovery. Real provider acceptance
remains separate.

Desktop and mobile PageSpeed results share the same resource detector and
measured-audit assertions for render blocking, unused JavaScript, unused CSS and
image delivery. Mobile findings retain separate registered identities and
`pagespeed-mobile` source observations. Desktop measurements cannot verify their
repair. Missing resource audits remain incomplete rather than becoming zero
savings. Targeted mobile repairs request only the mobile provider measurement,
reusing the existing task graph and comparison contract. The local worker
fixture exercises healthy desktop alongside failed mobile resources, an
unavailable mobile audit, changed provider criteria, complete mobile repairs and scheduled recurrence with
controlled provider responses. Real PageSpeed acceptance and measurements remain
an external verification requirement.

Incident comparison reads the Site's completed issue history, including targeted
and historical analyses, even when no broad report can serve as a parent. It
retains environment, ownership, time and category selection limits and excludes
fixture setup runs. A newly observed failure can therefore recur after an
independently verified historical repair without rewriting the original recovery.
Broad report eligibility remains separate from incident continuity.

Mobile tap-target normalization retains bounded scores and counts for each
provider audit, including success. Current target-size and older tap-target
criteria remain distinct. Findings retain their originating audit identities;
repair requires fresh mobile measurements for every originating identity.
An unavailable audit, an errored measurement or a different passing audit cannot
certify repair. Historical findings without recorded criteria remain inconclusive.
The detector keeps its established failed-audit policy and recommends comfortable
touch areas without describing that recommendation as the provider's threshold.
The disposable worker fixture exercises missing and changed provider criteria,
changed or missing measurement conditions, an unchanged failure, independent
repair and scheduled recurrence, preserving the
original Improvement and resolution. Its provider responses are controlled local
fixtures, not evidence of real PageSpeed acceptance.

Mixed-content observations retain bounded, redacted HTTP resource declarations
from collected HTML, including scripts, stylesheets, responsive images, frames
and media. Inert fallback and template content are excluded. These observations
do not assert actual browser delivery, external CSS contents or later dynamic
requests. Incomplete collection cannot certify recovery.
The existing bounded parser worker can inspect these declarations directly from
the same complete public response when whole-page metadata is unavailable.
Collected resource facts are reused when present. Targeted transport checks skip
the unrelated metadata parse and require no browser task. Restricted, mismatched,
failed and incomplete responses cannot become resource repair evidence. Local
worker fixtures retain the original issue through uncertainty, independent repair
and recurrence without fetching the declared resources.

Public destination checks share the guarded GET collector. Discovery, sign-in,
checkout and preview-image probes validate public DNS and every redirect, bound
HTTP capacity and body samples, and honor their execution deadline during DNS
resolution. HEAD success does not certify a destination. Transport errors,
access restrictions and scanner refusals remain unknown. Preview-image response
and content-type evidence do not establish full image decoding or a platform's
rendered preview.

Sign-in and checkout classification shares the bounded active-document link
inventory with discovery. Oversized full-page HTML does not withhold native
hrefs, labels or the observed document base. Label truncation is recorded
separately from href completeness, so public link coverage remains usable while
unread action labels stay unknown. Complete parsed metadata can cover an
exhausted native inventory. Clipped labels cannot invent action classifications;
complete sibling labels and hrefs remain usable. Document restrictions withhold action probes;
refusing a privileged side action does not discard the public page. Detection
and independent repair use the same destination assertions and GET policy.
Reached-page privacy and contact observations use the shared native public-page
reader directly. They no longer serialize or parse the entire destination just
to obtain those declarations. This trust-only collection skips the analytics
markup walk; headline, control and load observations retain their own scope.
Observed declarations survive unrelated document limits, while uninspected
absence remains unknown.
Targeted action repair reserves its eight-destination budget for the original
failed URLs still declared in the current inventory. Newly added actions cannot
displace that repair work. Removed or changed original destinations remain
unknown. Public-link and action repair share source-page and detector-rule
selection for grouped observations.
Normal action monitoring also reserves its bounded response budget for
still-declared historical targets, including resolved Flags, so new links cannot
displace recurrence checks. It shares discovery's environment-scoped recorded
target stream and intersects history with the current classified inventory.
Current-context matching filters and deduplicates the keys in PostgreSQL, so
historical labels, rectangles and repeated display evidence are not transferred
for this decision. Keyset traversal retains matches beyond a single batch;
history cannot add a destination absent from the current capture. Journey and
slow-action readers still receive the full targets their original conditions
require. Calls without a Site identity skip history collection entirely.
Historical URLs cannot authorize a new fetch, and untested fresh actions remain
unknown when the destination budget is exhausted.

Response consumers use one successful-GET policy. Public links and checkout
destinations cannot recover from a sign-in response merely because it returns
HTTP 200. An intended auth entry and an HTTP-only page check retain their
explicit reachability scope. Auth classification reads the parsed destination
path, so sign-in return queries cannot conceal a restriction and query values
containing `/login` cannot invent one. The same collected decision feeds findings,
independent repair and scheduled recovery without another request.

Public link discovery commits source-page scoped response assertions alongside
its findings, using the same response classification as targeted repair. Shared
destinations use the existing bounded discovery sweep; publishing observations
does not add a second normal-scan fetch. Repair admission retains every affected
source page, and each originally failed destination must provide comparable GET
proof before the Flag closes. Removed links, changed destinations and access
restrictions remain inconclusive. Recurrence reopens the existing Improvement
and preserves the original Flag's resolution.

Targeted public-link repair selects current declarations matching each original
page's immutable destination contexts. It does not spend the response budget on
unrelated new links. A removed or changed declaration leaves an explicit unknown
assertion under its original context. Grouped source observations retain their
own pages, detector rules and query identity. Historical unscoped requests keep
their earlier observation path and cannot borrow the corrected detector as proof.
The native worker fixture adds 130 unrelated links before both original failures
and establishes recovery by fetching only those two original destinations.

Each discovery task freezes its destination cohort once and uses the existing
observation continuation ledger. A delivery checks at most six destinations,
commits its scoped receipts, findings and checkpoint together, then releases the
worker. Later deliveries read only their next cohort slice and retain the
original page inventory and budgets. Shared destinations are fetched once per
discovery phase and serve every applicable source page. First and second phases
have distinct observation identities. Inventory limits and omitted destinations
remain explicit unknowns; not-yet-run batches do not write stale unknown
assertions over their later observations. No additional task rows or browser
captures are needed. Page expansion remains idempotent, and finalization waits
for the admitted discovery work.

Before freezing a new discovery cohort, the existing historical target reader
retains matching public-link responsibilities from completed observations in the
same Site and environment, including resolved incidents. Only destinations still
declared on the same current source page can reserve the existing GET budget;
changed query values, moved source pages and removed links cannot acquire that
authority. The bounded reader transfers target contexts and retains only current
matches. Continuations reuse their frozen cohort without rereading history.

Selected destinations retain source ownership before applying the per-page
inventory limit. This also preserves fresh high-priority links appearing late
in a large document: their GET can still create a Flag and support exact repair.
The existing page, destination and source inventory budgets remain in effect.
Omitted destinations and truncated inventories remain explicit unknowns.

The native discovery fixture places 130 new links before the selected failing
destinations and retains both failed destinations within an 80-GET scope. The category worker
fixture then preserves its original incident through added links, restricted and
removed destinations, comparable recovery and recurrence. Resolved historical
targets keep their monitoring priority, while skipped new work leaves the overall
category assessment partial. These are controlled local worker observations.

The disposable native worker fixture commits an early broken link, pauses at the
durable checkpoint, completes independent HTTP work while a later batch waits,
and retains both early and late failures through independent repair. A second
case exhausts the remainder and preserves the early Flag, receipt history and
partial assessment without fetching the unobserved destinations. The existing
24-page and interrupted-expansion database fixtures retain their planning and
replay proofs. These are controlled local observations, not production capacity
or sustained live-monitoring acceptance.

Public GET missing-page interpretation uses the shared scripting-enabled HTML
parser. Script and style text, dormant template and noscript contents, and SVG
title nodes cannot supply a page headline or missing-page prose. Active text is
entity-decoded before applying the existing missing-page wording rules. This
removes the separate raw-tag stripping and title regex. Public-link response v2
records that interpretation in its comparison identity; historical raw-text
observations remain separate and cannot treat a detector correction as repair.
The native application and worker fixture retains actual HTTP errors, active
HTTP-200 missing pages, blocked and removed destinations, independent repair
through dormant error markup, and recurrence with the same Improvement. It also
follows actual sign-in redirects with return queries, retains uncertainty through
grouped repair and scheduled recovery, and distinguishes a restricted checkout
from a working auth entry. These use disposable local infrastructure and
controlled destination responses, not live-provider acceptance.

Discovery and targeted public-link repair read the existing bounded native anchor
section independently of whole-document metadata. They share its captured
`document.baseURI`, decoded hrefs and the existing URL eligibility, depth and GET
budgets. No extra browser navigation or duplicate stored inventory is needed.
Incomplete sections retain their observed links while leaving inventory coverage
incomplete; an individually observed destination can still provide scoped proof.
Complete parsed metadata from the same capture can cover an exhausted native
section without dropping previously supported destinations.
A removed or out-of-window target supplies no proof. Historical native sections
without a recorded base can use genuine parsed metadata, never an invented base.
Summary finalization retains every admitted page's observations and missing
metadata, so a healthy peer cannot hide the entry page's collection gap.

Inventory deduplication keys are separate from fetch URLs. Normalizing a key
cannot strip a supplied host, locale, trailing slash or meaningful query from
the URL inspected. Relative declarations resolve against their observed document
base, including redirects and a published base element. Response assertions
require the actual fetched destination, rather than an equivalent inventory key.
Finding copy removes destination query values while hashed contexts retain exact
comparison scope. Historical metadata without a recorded base retains its
original page URL adapter.

Auth, checkout and preview-image assertions retain hashed destination and page
scope, without signed query values in findings. Repair and automatic recovery
require every originally failed destination. Disappearing markup, changed URLs,
an unrelated successful destination or an incomplete subset do not establish
recovery. Targeted admission includes the recorded affected pages and reuses the
same scoped proof logic. Historical findings without this scope remain
inconclusive. Independent proved destinations remain usable when unrelated
destinations are blocked or the bounded inventory is incomplete.
Targeted verified repairs resolve their source Flag in the same transaction as
the Improvement Attempt and its verification outcome. Failed or inconclusive
proof leaves that Flag open, and unrelated historical Flags are not rewritten.

Public HTTP and browser observations share challenge classification. Ordinary
Cloudflare mentions, analytics resources and embedded CAPTCHA widgets do not
block availability. Explicit mitigation headers or a challenge document remain
unknown, including an HTTP 200 challenge. Search retains that observed response
as incomplete, and security-header checks do not diagnose the challenge's
headers as origin configuration. The mitigation signal follows Cloudflare's
[documented response contract](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/detect-response/).

Delivered task jobs rotate behind undispatched work between bounded queue
rechecks. Lost queue deliveries remain reconstructible. Dispatch responses are
fenced by ready state, generation and dispatch lease, so late acknowledgements
cannot replace a worker's newer retry or completion state.

`lib/sites/application/run-requests.ts` is the Site command boundary. Admission
creates identity, quota admission, Audit, RunRequest and durable dispatch intent in
one transaction. Redis and provider availability cannot manufacture a successful
execution. Identical idempotent intent reuses the recorded execution; conflicting
intent is refused.
Owned RunRequest admission is private. A user-requested retry creates a fresh
linked Audit through admission, keeps the prior Audit terminal and preserves its
public/private boundary. Anonymous retries retain the owning browser identity
and claim cookie. They do not reopen completed task checkpoints or delete jobs.
Owned report and operator retries share the admitted-scope reconstruction path.
Category retries retain their selected area and pages; diagnostic retries retain
the original Flag, repair attempt and source. Current authorization and
configuration must reproduce the recorded responsibility hash. Changed or
unavailable scope is refused instead of becoming a broad check. Owner retries
retain a stable request key, record their prior Audit and RunRequest lineage and
return the persisted execution state. Claimed historical analyses without an
admission snapshot retain a fresh broad retry of their known original URL.
The obsolete unreferenced retry implementation has been removed.
Saved-access metadata is sealed by admission, separately from the requested
responsibility identity. Matching a repeated request therefore ignores that
derived field and returns its original immutable execution. A fresh retry resolves
current authorized Site access; it does not restore or inherit an old grant.
Grant revocation, execution fences and evidence comparison continue to apply.
Report retry buttons validate the shared admission response and open its returned
execution identity. They do not refresh or resume polling the prior terminal
report. Submission ownership prevents overlapping requests, and malformed or
refused responses retain the recorded failure. Site-board retries keep their
existing refresh flow and replace state only from the validated Site projection.

New Site-care requests share live work only when its frozen execution plan covers
the newly requested page, behavior and control obligations. Compatibility uses
the existing task planner, including implicit primary and legacy entry behavior,
category-specific work and retained control contexts. A narrower active run stays
owned and the new request receives the existing busy refusal; admission does not
expand that run or certify the missing work. Exact keyed replay retains its
original request and snapshot after responsibility grows. Disposable database
fixtures exercise ordinary compatible sharing, all three scope expansions,
unchanged live rows and exact replay. Pure planner fixtures also retain broader
compatible work and exclude behavior irrelevant to the selected category.

Original and joined idempotency keys now resolve through `run_request_keys`,
which binds each Site/source/key to one existing RunRequest. Sharing live work
retains the supplied key before returning, so a delayed retry after completion or
failure returns the same recorded execution. The original request, charging,
selection and results remain unchanged. New calls without a supplied key do not
accumulate discarded generated aliases. All keyed admission, verification and
scheduler readers use the same resolver. Account, Site and operator authority are
rechecked when joining; immutable bindings and a composite foreign key prevent
retargeting and cross-Site mapping. Actor erasure remains permitted.
The additive migrations build the reference index concurrently, backfill original
keys without changing historical requests, and register new original keys in the
same database transaction, including older writers. A colliding older insert
therefore rolls back instead of creating duplicate work. Disposable fixtures
exercise settled replay, concurrent same-key and competing-intent joins, source
separation, ownership changes, erasure, backfill and an independent write during
index construction. They do not establish production migration timing or rollout
acceptance.

Exact Site-run retries recover the accepted receipt before rebuilding current
execution intent. A changed detector catalog, retired fixture, disabled Outcome,
paused account-check preference or unavailable collection history cannot strand
that receipt. Receipt reads and key joins share the existing short User then
Site transaction, rechecking active-account or admitted cleanup authority,
current ownership, operator permission and the original key actor. Comparison
uses the recorded command scope, environment, selected Outcomes, category,
fixture, account mode, explicit URL and verification target. It does not treat
today's derived execution plan as a replacement for the accepted snapshot.
An expected retry-responsibility constraint still compares the recorded scope.
New keys continue through current planning and admission; sharing a different key
still requires current execution coverage and compatible definitions. If an
admission response is lost after commit, the same receipt path recovers its
result without repeating execution or charging. Historical rows without readable
scope retain only their conservative legacy Outcome-selection replay.
Disposable PostgreSQL fixtures exercise all six run scopes, command conflicts,
current-planning failures, ownership and account refusal, actor erasure and
unchanged request history. Focused fixtures reproduce post-commit response loss.
The native URL-first worker fixture separately exercises claim, default uptime,
repair, scheduled recurrence and MCP reads. These remain local observations,
not production acceptance or external provider proof.

The Audit coordinator admits a validated dependency graph and returns. Existing
`AuditVerifierExecution` rows checkpoint work; append-only `AuditPipelineEvent`
facts record claims, attempts, committed observations and terminal limitations.
The task token, generation, lease and Audit recovery deadline fence publication.
The source Audit must also belong to the Site's current owner. Coordinator and
task claims, guarded writes, lease renewal and the read-only resource watch share
that authority rule. Stale deliveries cannot consume another execution attempt. The
Site lock remains held through publication, while the watch closes native work
after transfer without waiting for renewal. Cleanup may outlive Site removal or
account deactivation, but cannot acquire a new owner's authority. Anonymous
claiming keeps the original execution when the Audit and Site owners agree.
Queue delivery completion is not analysis completion.
Public category admission requires a live worker with support for its scope,
without requiring every collector to be healthy. Browser tasks retain their
existing recovery window while HTTP, provider and evaluator tasks proceed.
Explicit account-check and Signup setup admission retain their browser gate.
The worker publishes its actual browser state on every idle heartbeat, including
failed recovery attempts, so a live independent executor cannot disappear merely
because rendering remains unavailable. A disposable worker fixture physically
closes Chromium, records a measured security failure and settles unavailable
browser work as partial coverage without inventing successful rendering.

Public HTTP, rendered DOM/semantics, private captures, PageSpeed and authorized
provider collection are independent work units. Deterministic evaluators wait only
for declared inputs. DOM collection does not upload screenshots: storage recovery
cannot prevent a rendered title or accessibility result from committing. An axe
exception is missing evidence, never an empty successful scan. Captures retain
their own task, source and time; they are not a pixel-perfect claim about a separate
DOM observation. AI explanation consumes committed results and captures downstream
and cannot establish an assertion or recovery.

Private object storage shares a ten-second operation budget across signing,
retries, upload and response-body consumption. Cleanup listing and deletion share
one thirty-second budget. An earlier execution deadline or caller cancellation
also stops the operation. Every operation closes its S3 client and sockets;
missing objects remain distinct from interrupted reads, and partial deletion
errors remain visible for reconciliation. Capture, flow, journey, slow-replay and
explanation consumers pass their remaining deadlines through the shared adapter.
Initial and final viewport uploads run alongside observation. Captures close their
browser contexts before awaiting those uploads, so a stalled store cannot retain
physical browser capacity needed by independent DOM collection. Recorded image
references are filled only from successful uploads, preserving initial image,
flow landing and timeline references.
Installed-SDK fixtures exercise stalled headers and bodies, upload and health
requests, cleanup, cancellation, binary reads and socket release. The disposable
worker fixture observes HTTP findings and DOM completion while native capture
uploads remain stalled, then verifies released sockets, an expired retry lease
and honest partial finalization. These are controlled local storage results,
not acceptance by the production object store.

Browser readiness passes timeout options separately from the page-function
argument. Missing titles retain their bounded three-second observation window;
document readiness retains eight seconds. Title absence remains inspectable
evidence and cannot occupy browser capacity for the driver's default timeout.

Local Search responsibilities have separate task checkpoints and receipts.
Robots collection settles before sitemap expansion; crawl checks depend on HTTP
and robots only. Presentation and markup use original and rendered page sources;
canonical checks additionally fetch only their declared targets on the HTTP queue.
Indexing and discovery consume sitemap evidence for their policy comparisons.
Google indexed-version evaluation consumes the indexing receipt, independently of
canonical targets, markup parsing and the Search summary. Analytics remains independent.

Cross-page preview checks retain separate title and description assertions for
each compared pair. Findings keep both pages and their native capture conditions,
including when several comparisons collapse into one Flag. Targeted repair runs
collect every originally affected page and compare the same pairs, without
launching unrelated provider or interaction work. Missing pages, removed preview
values, changed redirects or access conditions, and unscoped historical findings
cannot certify recovery. Search category checks include the cross-page
responsibility. Its registered checks, module assertions, current results,
findings and incomplete coverage all belong to Search. New Conversion rechecks
do not duplicate this work. Older execution snapshots still run their explicitly
admitted preview checks; recorded identities, versions, timestamps and repair
conditions remain unchanged. The local native worker fixture exercises current
Search results through independent repair, recurrence and automatic recovery.
Detailed result history selects observations individually, including those in a
selected category run that now belong to another area. Such observations remain
historical when a different source owns the area's current results. Counts and
pagination apply the same selection without rewriting stored receipts.

Preview comparison consumes a bounded native head observation from the existing
desktop capture. Its page, final URL, browser profile and access identity are
recorded independently of whole-document HTML. Missing, oversized or restricted
head fields remain unknown per responsibility; a known title does not imply a
known description. Native observed absence never borrows an older parsed value.
The comparison source is part of each page-pair identity, so new native-head
measurements cannot certify repair of historical metadata-based comparisons.

The same bounded native head reader supplies metadata presence checks for page
titles, descriptions, preview declarations, favicon, viewport and language.
Each field retains known presence, observed absence or unavailable evidence.
Full-document byte, inventory and parser limits do not erase these independent
observations. An oversized head field is omitted at collection and remains
unknown without discarding other fields. Native null or false values replace
older parsed declarations; omitted native values do not invent absence.
Registered metadata checks use this shared input and the head's own page,
final URL, profile and access identity for comparable
verification. Whole-document consumers still require real parsed metadata.
The migrated worker fixture retains an original failure on oversized HTML,
rejects a 503 response and oversized preview title as recovery proof, verifies
six independent declaration repairs with metadata unavailable, and retains
scheduled recurrence and automatic recovery. Preview comparisons use the same
reader. These are local collection and lifecycle results, not platform preview
rendering or production acceptance.

Preview-image availability uses that same native declaration without requiring
whole-document metadata. The browser resolves a relative image against its
actual document base before recording the bounded URL. Older relative head
observations require an observed parsed base; an unrecorded base is unknown.
The existing bounded public GET, response restrictions and exact destination
comparison remain authoritative. The destination worker fixture reproduces the
original failed image on oversized HTML, rejects a different healthy base as
repair, and verifies the original repaired image while parsed metadata remains
unavailable. Image decoding and sharing-platform caches remain separate.

The canonical committed-page reader retains every admitted page, including those
without parsed metadata. Cross-page previews and checked-page Search titles read
their independent observations from that projection. Whole-page review consumers
use an explicit metadata-requiring adapter. The SQL projection retains bounded
preview facts while excluding collector bodies and network traces. The Search
handoff retains independently bounded sections when whole-document HTML
exceeds its limit. Each section still requires its own complete observation;
refused document dependencies withhold the sections as well as the whole body.
The native worker fixture includes an oversized peer with no HTTP or browser metadata,
retains all original comparisons and duplicate Search titles, rejects partial or
missing proof, verifies both preview repairs, and preserves recurrence and fresh
automatic recovery. These are controlled local observations, not production proof.
Title comparisons retain the existing Open Graph or document-title fallback.
When native collection establishes that an optional preview value is absent,
that absence is recorded as an observation. It does not pass a comparison or
certify repair of an earlier duplicated value. A pair with no eligible values
is not applicable; missing native conditions remain incomplete. This keeps
completed inspection distinct from positive verification and collection gaps.
The local three-page worker fixture exercises partial repair, unavailable peer
evidence, independent title and description repair, incident recurrence, and
automatic recovery from a later category observation without a new fix attempt.
It also refuses to certify removal of the original duplicated descriptions.

URL Inspection preserves the typed page-fetch status rather than discarding it.
Google fetch, crawl/indexing restrictions and canonical selection have separate
registered observations, with property and last-crawl provenance. Missing fields
remain unknown. Soft 404 and explicit blocked-fetch or noindex states can establish
an indexing regression after a previously indexed page has a later crawl, provided
current local indexing policy allows it. Intentional local exclusions are retained,
and a different Google canonical is review guidance rather than a website failure.
Contradictory passing and failed provider fields cannot certify indexing success.
Independent recovery requires a later recorded crawl of the original property.

Collapsed Search Flags retain typed recovery requirements for each originating
page, including the observed sources, entity/property targets and Google property
and crawl timestamp. Aggregation preserves every page's evidence text and scopes
through repeated projections. Explicit verification and automatic recovery use
the same per-page comparison, so one page's earlier crawl or repaired markup
cannot certify a peer's different original failure. Verifiers are recorded for
every affected page. Missing, malformed or unscoped historical peer requirements
remain inconclusive rather than acquiring invented provenance.

The two-page disposable Google fixture uses different original crawl dates,
refuses stale, changed-property and partial repairs, then verifies both original
pages and preserves recurrence. Focused structured-data cases also exercise
different required properties on pages with the same entity identifier.

Structured-data syntax and feature-property inspection use their own captured
section even when metadata, links or readable page text exceed a separate bound.
The shared section reader can also use complete same-capture HTML when a native
section reaches its smaller limit. Truncated document bytes cannot cover that gap.
Optional content correspondence remains unknown when its context is incomplete.
Selected headings, controls and links are useful structural hints, but cannot
stand in for the complete page prose. Correspondence reads the same captured
document's complete HTML when available, so names published in ordinary
paragraphs are not misclassified as absent from the page. Without complete HTML,
content correspondence stays unknown while bounded syntax, property inspection
and independently observed structural opportunities remain available.
The evaluator sanitizes and reads available context once, rather than cloning
the page for every entity. Independent markup failures survive that missing
context without becoming successful whole-page coverage.

Property repair compares every originally recorded entity identifier, type,
source and invalid property. Unrelated nested types outside feature validation
cannot prevent that original property's evaluation or supply replacement proof.
A different entity remains inconclusive, and historical feature Flags without
recorded property targets cannot acquire them retroactively. A disposable native
worker fixture retains simultaneous syntax and price failures under a bounded
text section, recognizes unchanged and changed-entity attempts, verifies the
original Product price and preserves its recurring Improvement during Watch.

The disposable Google worker fixture performs a real category baseline, records a
new soft 404 with an excluded verdict, refuses stale or changed-property repair
proof, verifies a later crawl and preserves recurring incident identity. Its page
transport and Google responses are controlled fixtures. A prior-page admission
record supplies scope without inventing passing Site coverage. Real Google
acceptance and crawling remain external verification requirements.
The summary combines recorded parts, retains honest limits and does not duplicate
customer result rows. Historical aggregate receipts remain comparable through the
same receipt adapter. Evaluator receipts, verifier proofs and findings commit with
their owning task artifact.

Keyboard navigation uses the existing guarded browser collector, deterministic
assessment, and task ledger. Bounded Tab navigation records the page control set.
Up to four declared menu, dialog, or disclosure triggers may then be opened with
Enter or Space. A guarded pointer fallback can confirm a keyboard-only opening
failure. Popup actions, submissions, and links are never selected. Requests that
mutate, subsequent navigations, and new windows are refused; this session also
blocks service workers and WebSockets so they cannot bypass request routing.

The shared browser session admits first requests through one handler on the owner
page and its context. Request identity prevents duplicate admission when a request
falls through both routes. Auxiliary documents and workers receive the same policy.
Native interception supplies per-hop credential headers and redirect admission,
because Playwright can omit redirect callbacks. Preview headers stay on their
configured origin. Auxiliary requests wait for native interception before transport;
embedded renderers attach before execution and worker networking stays with its
owning renderer. HTTP methods, bodies, real responses and final browser URLs are
preserved without replaying protected requests. Capture profile identity now uses
`native-request-boundary-v3`. Controlled native
fixtures verify authenticated navigation, private-target rejection, iframe scope,
worker rendering and one authorized cart request followed by a refused external
POST. Real-provider and deployed-runtime acceptance remain separate requirements.

Privileged account and configured Signup sessions pass their request policy to
this same boundary. First-request routing and native redirects share its bound
policy without duplicating stateful admission.
Browser events retain the worker's admitted async context, so request-time
permission transactions enforce execution ownership and lease fences. The
configured Signup policy refuses mutations before submission admission and
rechecks the exact fixture version and authorization before further mutations.
Account requests retain their current preference, operation and one-mutation
checks. Recognized telemetry stays suppressed by the shared guard and cannot
consume an account operation or make read-only inspection inconclusive.

Request authority lasts through context closure, including auxiliary pages after
the original page closes. Concurrent contexts retain separate policies and headers;
closing one does not release another's guards. Read-only WebSocket refusal also
belongs to the context. State-changing document navigation belongs to the original
main frame. Existing account walks close popups and cannot confirm their navigation
or cleanup, so auxiliary form navigation is refused before a write. This records
`auxiliary_document_unavailable` and leaves account recovery unverified. Initial
popup requests cannot create an untracked identity or carry an approved write
through an unobserved redirect. Native fixtures exercise these refusals, approved
main-document writes, replay denial, nested popups, workers, sockets and simultaneous
contexts. Older capture conditions cannot certify recovery under the new boundary.

Native fixtures verify an allowed submission and same-origin landing, refused
external body-preserving redirects, refused unrelated account effects, permission
revocation and retained async context. The migrated Signup worker fixtures cover
delayed completion, reset and cleanup, interrupted ownership, repair and recurrence
against disposable PostgreSQL and Redis. These controlled scenarios do not prove
the full automatic HTTPS account and email lifecycle or real-provider acceptance.

The separate disposable HTTPS account fixture runs normal account admission and
the actual worker against an exact validation origin. It exercises signed email
receiving with simulated provider content, retained identity reuse, disposable
deletion, signed-in failures, independent repair and recurrence, unresolved
deletion and cleanup after opt-out. Its temporary certificate is accepted only
by the fixture browser context. No email is sent and production lifecycle gates
remain disabled. Real receiving infrastructure and customer compatibility remain
external verification requirements.

Account inspection can retain a rendered error response only for a previously
active or deleting identity. This lets authenticated page failures reach the
existing response assessment instead of becoming collector retries. Initial
discovery and signup retain strict capture, and bot challenges remain refused.

Public page inspection shares an access-restriction policy across uptime probes,
configured availability and public link responses. Plain HTTP 401, 403 and 429
responses remain restricted observations, even without a recognizable bot page.
Availability records the exact status and restriction without creating an outage
Flag or a recovery transition. Public Security header verification also withholds
proof from restricted responses, whether their headers are missing or appear
healthy. Native worker fixtures cover all three statuses through assessments,
API results, history, later rendered recovery and recurrence. Uptime consumes the
same controlled HTTP responses. Genuine missing pages and server errors keep
their existing detection policies; successful availability still requires its
configured rendered surface. This is local evidence, not production observation.

HTML compatibility reads and raw HTTP documents share a bounded transport with
one deadline and origin-scoped configured headers. Same-origin preview access
continues across redirects; other origins receive ordinary public request headers.
Redirect responses are cancelled before the next admitted request. Response-body
timeouts and connection resets after headers arrive remain incomplete body
evidence and cannot establish a missing-response outage. Both uptime and
availability use that shared failure classification, retaining the received
status and final URL. An incomplete observation cannot open or recover an uptime
incident, or confirm an availability Flag. Physical local HTTP fixtures exercise
both consumers; disposable database checks preserve incident and notification
continuity until an independent complete response establishes recovery.

Public discovery can retain HTTP navigation when whole-page metadata is
unavailable. It reads the same complete successful HTML response through the
existing bounded parser, without another GET or parsing unrelated JSON-LD.
Metadata and navigation share crawler fallback, anchor and document-base
interpretation. Existing metadata remains reusable; navigation is collected
separately only when a discovery consumer needs it and metadata is unavailable.
Its 10,000-anchor inventory limit records incomplete scope rather than certifying
omitted destinations. Incomplete responses and unavailable parsing authorize no
new links. Summary projection transfers the link inventory and base, without the
response body. Native HTTP and installed-worker fixtures retain discovery and
actual missing-destination findings when the unrelated JSON-LD inventory exceeds
the metadata limit; browser collection remains independently unavailable in that
worker scenario.

Menu item focus includes DOM focus and valid aria-activedescendant. Orientation
selects the tested arrow directions. Menu traversal samples items within the
same interaction bound; unvisited items keep the scope incomplete. Modal Tab and Shift+Tab containment, Escape,
and restoration are observed separately. Lost focus is a finding only when the
trigger still exists and no visible workflow destination receives focus. Removed
triggers and alternate destinations require review. Ordinary disclosures do not
inherit modal dismissal requirements. An intentional modal boundary is not a trap
merely because focus cycles. These expectations follow the W3C
[menu button](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/),
[menu](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/), and
[dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) patterns.

Each assertion retains its exercised scope and can remain explicitly unknown.
Repair verification requires every originally flagged selector and label in the
same popup context, requested and final page, browser profile and secret-safe
access conditions, with conclusive evidence for that responsibility. Historical
controls without capture scope cannot certify repair. Diagnostic execution
revisits the original requested page, including client-side landing navigation,
and aggregates only receipts from the same execution and check version. Independent
proved controls can verify a repair even while another popup remains incomplete.
All failed popup scopes survive page-level finding aggregation. Geometry follows
the normalized evidence target contract; popup controls retain selectors and scope
without drawing rectangles over an initial-state capture that cannot show them.

Native fixtures compare independent desktop, mobile and session-cookie contexts.
Only the original capture conditions certify the recorded focus repair. The
worker fixture independently verifies focus indicators and popup restoration
after client-side landing navigation. Scan cookies use explicit domain and path,
including host and root-path defaults, avoiding Chromium's rejected combination
of URL and domain fields. These fixtures establish controlled local behavior;
real signed-in owner sessions remain separate acceptance work.

The same collector follows deep active focus, composed ancestry and assigned
slots through inspectable open shadow roots. Targets retain their actual root
path, so repeated IDs in separate components do not share repair evidence.
Declared popup IDs resolve within the trigger's root, and interactions retain
the original trigger node instead of repeating a selector query. Bounded native
fixtures exercise nested roots, slots, delegated focus, component traps, menus
and reused IDs. The real application and worker fixture verifies partial repair,
closed-root uncertainty, exact recovery and recurrence on the same Improvement.
Page and modal inventories use native radio-group Tab stops, grouped by tree,
form owner and name. Unchecked peers do not become fictitious unreachable
controls. Native fixtures exercise checked, unchecked, disabled, unnamed and
positive-tabindex groups, separate forms and roots, and modal containment.

Sample and time limits, unsafe or unsupported triggers, frames, closed roots,
unresolved focus effects, and scanner refusals remain visible unknowns. Blocked
interactions do not erase earlier independent observations. Focus-style comparisons
exclude hidden descendants and ungenerated pseudo-elements, and normalize fully
transparent outlines and shadows. Unsupported color observations stay unknown.
Focus-style success requires an observed change from the recorded unfocused
control. A permanent outline or decoration cannot identify which control has
keyboard focus. Already-focused controls without an unfocused baseline and
unchanged editable controls with potentially visible carets remain inconclusive.
Native fixtures detect permanent decoration, independently verify a distinct
focus-style repair and retain caret uncertainty.
Outline observations compare opaque colors with a known uniform surrounding
background. An indistinguishable outline cannot establish focus visibility.
Patterned backgrounds, clipping, translucent effects and unresolved dark canvas
colors remain inconclusive. Native fixtures verify a contrasting repair, and the
worker fixture exercises the same-color failure through targeted recovery.
Focus profiles also normalize unpainted borders, zero-area element and generated
backgrounds, and text-decoration colors without a drawn line. Visible border
patterns, colors, text decoration and generated backgrounds retain their observed
changes. Text color follows Chromium's actual text-fill property on recorded
glyph content, with text shadows and decorations kept separate. Empty boxes,
empty generated content and fixed-fill SVG icons cannot use an inherited color
change as focus proof. SVG geometry retains its own observed fill and stroke
colors. Native fixtures retain real text, shadow, decoration and icon changes
while reproducing these unused-color false passes.
New native observations record `painted-properties-v3` in the focus
comparison identity. Historical focus evidence keeps its original identity;
the earlier `painted-properties-v2` remains readable but cannot borrow the new
detector as repair proof. Navigation and popup behavior keep their existing scope. Native fixtures
reproduce the invisible-declaration false passes. The application and worker
fixture retains the failure through an ineffective repair, then independently
verifies the contrasting outline. Component repair and recurrence use the same
collector and comparison.
Computed focus styles do not certify visual contrast or every custom effect. Accessibility cards cannot
use a completed axe receipt or successful subset to conceal unfinished keyboard
scope in the current task plan.

Tracking uses the shared browser network monitor, without a new collector queue or
additional interaction campaign. Initial rendered evidence snapshots page-loading
requests before the action walk. The existing public-action task records its own
phase. The bounded HTTP endpoint inventory covers Google Analytics, Google Tag
Manager, PostHog, Plausible, Segment, Vercel Analytics and Cloudflare Web Analytics.
Unknown providers and proxies remain explicit limits. Valid in-page CTA targets
are checked before selection; missing fragments remain non-actionable.

Markup, library-resource transfer, event initiation, endpoint HTTP response and
provider recording are separate assertions. Markup detection shares the bounded native
public-page signal reader with trust checks and uses the existing detection
vocabulary. Its observed booleans survive unrelated metadata inventory limits;
uninspected absence and historical snapshots without the general analytics field
remain unknown. Tracking-only collection skips privacy, contact and JSON-LD
interpretation. The persisted v1 signal field remains compatible with historical
trust snapshots. Measurement uses the common page evaluator and comparison
scope, while resource transfers and provider recording retain their own facts.
Low-confidence markup absence keeps its existing advisory policy.

Request, response, finished and failed events retain actual browser facts. No request body, query, cookies, headers, event
values or visitor identifiers enter the Tracking artifact; project-bearing resource
paths use canonical templates. Page scopes use the shared pure verifier URL identity
and a hash rather than duplicating a sensitive page URL in each network context.
Opaque request identities additionally retain the complete request URL and method
through a one-way hash, so redacted project paths and query-bearing library URLs
cannot collapse distinct requests. Capture identities reuse the shared exact page,
final URL, browser profile and access conditions. Ending a browser phase freezes
its capture identity before a later action changes the page.

Recognized event collection is intercepted before transmission in Audit page
sessions, independently of the protected-action guard. These intentional refusals
do not fail unrelated customer flows. Library transfers still execute. Service
workers are blocked to maintain route ownership; worker-mediated and embedded-frame
behavior remains outside the observed scope. Tracking tests do not accept consent.
Existing action walks may dismiss consent UI, so their consent state is not inferred.
Absent attempts and browser blocking never manufacture missing-event failures.

HTTP library failures produce scoped findings and repair guidance. Repair proof
requires every originally failed page, provider, request URL, method, phase and
capture identity under the version-two observation rule. Historical observations
without those identities remain readable but cannot certify comparable repair.
Finding collapse
retains all contextual targets. Only conclusive assertion receipts committed in the
same Run can contribute to combined proof, with their supporting task references.
Diagnostic admission selects the recorded failed pages and adds the existing
action walk only for phases that require it. Derived scope selection does not
change retry identity; the admitted execution snapshot owns the actual work.
Exact recorded page URLs remain separate at admission, including fragment routes
and trailing-slash variants with different browser conditions.
Unsupported or unobserved scopes remain unverified.

Controlled Chromium reproduces and rejects a healthy replacement Segment project
as proof of the original failed download, then accepts the repaired original URL.
The database, queue and worker fixture exercises changed library queries in both
phases, a changed action-only request, exact repair and recurrence on the same
Improvement. Raw project keys and query values remain absent from the resulting
findings and receipts. These fixtures do not establish live provider ingestion.

Successful HTTP responses do not establish provider ingestion. Google explicitly
[separates receipt from processing](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference);
Plausible documents [events dropped by bot filtering](https://plausible.io/docs/custom-event-goals),
and PostHog documents [successful capture responses when a quota prevents capture](https://posthog.com/docs/api).
Normal audits suppress recognized event traffic, so destination availability and
provider recording remain unknown for those attempts. Connected aggregate Analytics
reports are separate audience evidence. Authorized event-level provider confirmation,
consent-controlled scenarios and configured first-party proxies still require implementation.

Safe Signup setup uses `FIXTURE_SETUP` admission through the same Site RunRequest
and Audit transaction. The admitted intent snapshots only the fixture identity and
version; encrypted values stay on the fixture. Admission clears previous approval
and dry-run proof atomically. The request returns acceptance; the browser worker
owns reset, one submission, configured confirmation and cleanup. Task retries and
new runs check previous fixture submission facts across Audits before resetting or
submitting again. Hook resolution, capacity admission and responses share a bounded
call budget; reset rechecks current ownership and consent after waiting for resources.
An uncertain operation requires a cleanup response acknowledging
its exact operation ID with `settled: true`. Configuration changes cannot redirect
that reconciliation through replacement hooks. Recorded completed cleanup remains
usable after an edit. Revocation advances the fixture version, invalidating pending
setup consent. Authorization requires a successful exact-version receipt with proved
cleanup. Settings show pending, recovery and incomplete states from recorded work;
reads do not initiate execution or cleanup. Setup-only Audits do not replace Site
report evidence or enter report comparison and Improvement learning.

Safe Form configuration now retains its supplying owner independently of later
Site ownership. Fixture writes lock User then Site, check the expected owner,
and normalize against the current locked Site URL. Creation, replacement and
authorization require an active account. Revocation and deletion remain
available after suspension or erasure begins. A new owner must replace the
configuration and establish a fresh exact-version dry run before authorizing it.
Fixture views, setup admission, native request permission and current Outcome
comparability use that same ownership fact. Historical configuration and proof
stay stored without becoming the new owner's executable permission. Outcome
binding changes compare Site ownership and fixture authority inside their write
transaction, preventing stale reads from installing a binding after transfer.

Cleanup reconciliation selects unsettled operations before its limit. A newer
completed operation cannot hide an older unresolved one. Receipts match operation,
Site, fixture and version, even when a later recovery Audit records settlement.
Two bounded cleanup calls may run per reconciliation; remaining operations keep
replay unavailable. The recorded submission permits only cleanup through the
unchanged fixture, including setup-only operations after account deactivation.
It cannot authorize another reset or submission, which still require live
consent. Changed-version hooks remain unavailable for an old operation.

Migration `20261026180000_fixture_configuration_owner` preserves retained
configuration under the current ownership baseline without reconstructing its
historical authorizer. Erasure nulls that binding. Partial indexes keep submission
and cleanup lookup separate from unrelated observation events. The exact migration
and ownership changes have disposable PostgreSQL proof. Native local hooks verify
that unrelated cleanup cannot grant replay and that owed cleanup survives account
deactivation. The real Signup worker cycle retains setup, confirmation, failure,
cleanup uncertainty, independent repair and recurrence. These are local results;
production migration and real-site hook acceptance remain separate requirements.

Completion readers project metadata, media references and result artifacts in
PostgreSQL, without transferring collected HTML, sitemap bodies or browser traces.
Targeted and setup finalization bypass broad page reconstruction. These bounds
still require capacity and broader real database/worker fault acceptance.

`node scripts/verify-progressive-execution.mjs` applies the full migration history
to a newly created local database, checks migration status and schema drift, and
uses a disposable Redis container with the application worker. Representative
Search collection and partial completion, expired Signup ownership with unsettled
cleanup, and keyboard focus-style, menu restoration and Tracking library failure-to-repair verification have been exercised through
this boundary. Public checkout, sign-in and preview-image failures now have
targeted repair evidence and source-Flag resolution through the same worker.
The authorized Signup fixture exercises delayed rendered completion, a missing
signal, a preexisting signal without another submission, observed success with
failed cleanup, comparable repair and recurrence. Its owner fix progresses from
inconclusive to improved across the gap while retaining both cycle events.
Section-link evaluation uses fragment links, exact identifiers and named anchors
from the scripting-enabled captured document. Template and noscript descendants
cannot invent a live section link or count as a restored target. Section and CTA
placeholder checks share the same active-document link inventory. Crawler fallback
links retain their separate metadata behavior. Evaluation resolves declarations
against the observed document base and decodes fragment
targets without lowercasing them. SEO and CTA placeholder checks share this
native-target lookup. Routing and text fragments remain outside the inspected
scope. Receipts contain at most 300 distinct targets; additional targets remain
unknown without discarding failures already observed. Current findings bind
each missing target to its requested/final page, capture profile and access
conditions. Targeted rechecks inspect all originally affected documents without
adding provider, media or unrelated action work. Missing or changed links and
historical normalized identifiers cannot certify repair. New section contexts
use detector version two; older observations remain readable but cannot certify
a repair from this parser correction. The Chromium, migrated PostgreSQL and Redis
worker fixture proves two-page detection, inactive-only targets, partial repair,
challenge uncertainty, removed/changed scope, complete repair and recurrence on
the same Improvement. These checks establish declared document targets, not
click handlers or scroll behavior.

The same browser snapshot now retains bounded native fragment declarations and
their exact active id or named-anchor matches. This collection reuses the native
anchor inventory, with limits of 300 distinct fragments, 2,000 source links and
128,000 bytes. A complete same-capture document can cover an incomplete native
inventory. Restrictions and mismatched final URLs withhold native proof.
When whole HTML exceeds its separate limit, section evidence retains the recorded
desktop profile and access conditions only if its final URL matches the native
head capture. This does not mark the whole document as collected. Progressive
and legacy page adapters pass this section scope to the shared evaluator.

The section worker fixture now exercises its full failure, uncertainty, repair
and recurrence journey with unavailable whole-page metadata on both sources.
Scoped fragment assertions remain conclusive while the module discloses the
unavailable heading evidence. No additional browser navigation, HTTP request,
provider dependency or task kind is introduced.

The public link fixture runs discovery over two source pages, commits their
failed GET observations, and exercises unchanged, blocked, removed-declaration
and repaired targeted runs through the application, database, queue and worker.
Both source documents exceed the whole-page parser budget. Their native anchor
sections still preserve the published base and exclude inactive fallback and
template links. A separate oversized-entry fixture discovers pricing, retains it
after its entry link disappears, verifies recovery and recognizes recurrence.
Every original source scope must pass before resolution. A subsequent Watch
failure records regression on the same Improvement and retains the first Flag's
verified resolution. This controlled fixture does not establish production
transport, external-provider acceptance or notification delivery.
Relative public action, preview-image and canonical destinations use the active
document base. Metadata and declared resource transport share its scripting-enabled
parser, so bases inside templates or fallback content cannot redirect inspection.
Client-rendered preview metadata retains absolute resolved URLs when merged into
the stored metadata. Checkout and sign-in reuse the same resolved link inventory
as public link discovery. Changing a base to a competing healthy destination
cannot verify the originally failed public action or image URL.
Search canonical collection and evaluation share declaration parsing. HTML links
use the document base; HTTP Link headers use the response URL. Bounded rendered
Search sections retain the native `document.baseURI`, independently of whole-page
HTML availability. Historical isolated canonical sections without a recorded base
remain unknown unless complete document HTML is available. Canonical observations
use detector version 3, preventing this parser correction from certifying repairs
of historical findings. Other Search detector versions remain unchanged.
The disposable Chromium and worker fixture exercises a foreign base, inert base
declarations, failed destinations, changed-base uncertainty and independent repair,
including the canonical target. Provider and production behavior remain separate.
Primary-action fixtures exercise a failed CTA navigation, access restrictions,
an HTTP 200 challenge, replaced or removed controls, a competing working CTA,
independent repair and scheduled recurrence through migrated PostgreSQL, isolated
Redis, real Chromium and the worker. They also collect and verify missing primary
actions, disabled native and ARIA controls, and a dead end repaired by its declared
visible panel. Source identity, recorded fix attempts, Flag closure and first
resolution survive these transitions. Deeper destination semantics, unsupported
action types and extended live behavior retain their separate verification limits.
Completed failed main-frame responses finish the primary action before optional
loading and destination inspection. The error-step screenshot has a one-second
budget and cannot replace the observed HTTP failure with a timeout. Challenge
headings use rendered copy; hidden challenge templates cannot make an ordinary
destination unavailable. Incomplete challenge inspection cannot certify a normal
successful response. Native fixtures reproduce both earlier failures and retain
the failed response while a font blocks screenshots. The primary-action worker
lifecycle also exercises persistent loading markup on failed destinations and
hidden challenge markup during independent repair.
Destination UX reuses the reached browser document and the existing post-click
loading observation. It does not refetch the document or start another loading
window. Headline checks use bounded rendered prose; control checks share the
enabled rendered action inventory, including controls below the fold. Incomplete
copy or declarations remain unknown without suppressing independent control
observations. The native full-flow fixture checks actual navigation, hidden
headlines, destination trust declarations and the absence of duplicate document
requests. These observations do not add independent repair certificates for
deeper destination semantics.
Post-click observation starts on the actual main-frame commit while the click
and navigation are pending. Content timing uses the click-request clock; blank
viewport observations begin at commit. Queue waits and prior screenshots do not
enter this timing, and DOMContentLoaded does not delay sampling. Deferred JavaScript
cannot erase a loading interval that occurred before DOMContentLoaded, and an
already useful document does not wait for an unrelated deferred script.
Viewport content and blocking loaders use the shared native predicates, including
decoded images, ancestor visibility and viewport position. The duplicate flow
loading selector and separate raw-text loader scan have been removed.

Version-two metrics retain the first observed content time and the latest proved
absence separately. A sampling interval spanning the threshold is incomplete;
its later positive sample cannot prove a delayed arrival. Expired observation
windows do not invent an arrival time. An actual document response establishes
pre-commit destination delay, while the prior page is not labeled blank. A late
SPA history update supplies no such lower bound. Unsupported viewport graphics,
missing samples and changed documents remain unknown. Destination declarations
and overall flow completeness remain incomplete until DOMContentLoaded, while
already observed content timing remains usable. Both the worker artifact and
audit flow history retain the bounded metrics, and the flow receipt records
content and loading completeness independently. Fresh normal main-frame
observations bind content-delay and loading-UI assertions to the original control
identity (including page, capture profile and access), reached URL and detector.
Independent repair and Watch recovery use the same comparison. Diagnostic loading
rechecks replay the recorded control and omit unrelated pricing, scrolling, form
and menu probes. Changed or removed controls, redirects to another URL, access
restrictions, incomplete samples and historical unscoped findings remain
inconclusive. A blank page cannot establish recovery of a previously stuck loader.
No timing observation establishes completed signup, payment or later interactions.
Browser dispatch prioritizes ready primary-page work within the browser cohort
while preserving the existing slots for other resource queues. New admissions
collect desktop and mobile in independent browser tasks. Historical combined
tasks and optional media captures collect profiles in sequence. Each task holds
at most one native context, and device timings retain their own navigation clocks. A stalled
linked document cannot reserve both physical browser contexts, and linked work
does not move ahead of ready primary work merely because its rows were older.
Browser task budgets cover their own frozen console-observation windows and
bounded navigation work, while the admitted audit recovery deadline still binds.
Native fixtures check deferred scripts, already visible content, decoded images,
hidden prose, graphics uncertainty and parser completeness. The disposable worker
fixture commits both delayed and fast destination observations and verifies the
same facts in the artifact, receipt, Flag and audit record. It also checks pending
deferred scripts, incomplete destination declarations and primary action
publication while retained linked pages are still waiting. Those deliberately
unavailable linked recovery windows are then exhausted explicitly. Their missing
evidence is not converted into successful collection.
The destination-loading worker fixture separately checks unchanged failures,
removed and changed actions, changed redirects, challenges, a competing healthy
action, blank recovery, independent repair, clear diagnostic Run results and
recurrence under the same Improvement. Source resolution stays intact after
recurrence. A later Watch independently resolves the recurrent occurrence with
no new recorded fix or verification attempt. Native loading observations without
the original public action scope remain advisory.
Pricing navigation uses the shared rendered action inventory and the same reached
response classifier as primary actions. Hidden mobile copies cannot displace the
visible header link. Bounded observations support decoded section fragments,
useful declared pages with localized routes and observed SPA navigation. Disabled
controls, missing sections, completed failed responses and clicks with no request
or advancement can establish failure. Pending requests, challenges, access
restrictions, blank destinations, separate-tab actions and unclassified redirects remain incomplete.
No second request supplies a destination verdict.
Progressive pricing collection runs as an independent task on the existing flow
queue, alongside primary-action collection. Both retain separate flow and tracking
receipts; pricing cannot overwrite the primary action history. A pricing diagnostic
collects only its original control, without a preliminary whole-page metadata task.
Pricing admission has no dependency on that collector. Native scope binds the original control, page,
capture profile and access conditions. The existing scoped assertion comparator
serves both independent repair and Watch recovery; historical unscoped findings,
missing controls and changed control identity cannot certify repair. The legacy
combined adapter restores its landing document even after an inconclusive pricing
navigation and refuses primary-action collection when restoration fails.
Controlled Chromium scenarios exercise visible navigation, fragments, disabled
controls, document failures, challenges, blank pages, localized paths, SPA routes,
pending responses and original-control replay. Disposable worker fixtures exercise
unchanged failures, missing and changed controls, challenges, a changed route,
competing healthy navigation, independent repair, recurrence and automatic recovery
without another recorded fix. Primary and pricing observations remain separate.

Default uptime has been exercised as a Watch run without a customer session,
including healthy Cloudflare/CAPTCHA markup and an explicit HTTP 200 challenge.
The outage fixture exercises failure, an inconclusive gap, ongoing failure,
an owner's recorded fix verified by scheduled recovery, and recurrence. It also
checks historical identity migration, independent pages with identical binding
keys, history completion, and a delayed notification against a live scheduler
lease. Notification selection and bounded missing-provider failure are local
evidence, not provider acceptance or inbox delivery.
Broad diagnostic comparison also uses the latest durable Improvement occurrence
from an earlier completed Site run in the same environment. An inconclusive
report cannot turn an ongoing failure into a new incident. A later failure after
recorded recovery is regressed, while the original fixed Flag and its resolution
remain intact. Healthy runs omit old recoveries. Pending fixes from an older
source require positive evidence for that original Flag's affected pages and
responsibility before reconciliation resumes. Flag closure and fix verification
consume the same recorded recovery predicate, including source requirements,
assertions and check versions. A partial unrelated module cannot certify repair
or invalidate an independently completed responsibility.
After both diagnostic and bound projections commit, finalization records the
comparison once under `projection:flag-comparison` in the existing execution
ledger. This is a comparison projection, not a verifier assertion or another
incident engine. Report readers and delayed Watch notifications use its original
buckets and Flag summaries, so a later recovery cannot rewrite an older failure
or evidence gap. Retries retain the first committed projection and still apply
current notification preferences. A failed comparison write leaves finalization
retryable. Historical runs without this receipt retain their compatibility
comparison; their mutable Flag rows cannot reconstruct lost historical facts.
The separately selected `SCHEDULED_SITE_CARE_REQUIRED=true` worker scenario
exercises four broad scheduled runs, immutable tick replay and a fresh
binding-only tick. A real HTTP 503 creates a diagnostic gap before comparable
title recovery and recurrence. The fixture expires unavailable provider work
to keep the local scenario bounded. Explicit unsuccessful page responses settle
affected browser tasks after one attempt, retaining structured response evidence
and failed coverage. A refused response is not a worker crash or a successful
check. Network, database and unclassified browser/parser interruptions retain
their existing bounded retry policy. The scenario does not establish provider
delivery or timing for infrastructure interruptions in production.
Public trust detection and recovery share explicit privacy-link, published
contact and cookie-consent signal predicates. Contact evidence excludes script,
style, hidden and template implementation text, while retaining published
content, contact links and structured data. Unobserved analytics without a
consent signal is an observation, not proof that an earlier consent finding was
repaired. These predicates do not establish policy quality, contact destination
availability, consent enforcement or legal compliance.
The separately selected `PUBLIC_TRUST_DB_REQUIRED=true` worker scenario collects
three source findings through Chromium, the real metadata parser and detector.
Fresh targeted application runs prove unrepaired conditions, an HTTP 503 gap,
unobserved analytics, an independent contact repair and privacy/consent repairs
despite unrelated console errors. A broad follow-up recognizes recurrence with
the same Improvement and preserves the original resolution. Existing
Improvements also retain observations when the current finding is a
recommendation, preserving its priority and dismissal state. Resolved or ignored
observations and unengaged recommendations do not expand automatic Attention.
Console collection is a separate page evaluator, using desktop and mobile
page-load windows even when desktop HTML or media storage is unavailable. It
records actionable console errors and unhandled page exceptions, with distinct
message identities and bounded retention. Truncation cannot certify recovery.
Repair requires the original requested and final URLs (including fragment
routes), capture profiles and access conditions on every originally affected
page. Credentialed conditions
use a keyed digest; secret values do not enter the scope receipt. One positively
observed remaining error disproves an all-clear responsibility, including when
the count falls below the original critical threshold or another viewport is
unavailable. Clearing a finding requires every original window to complete
without errors through its recorded failure horizon. The frozen execution
snapshot carries this minimum observation time into verification and later
Site care, within existing browser deadlines. Broad care retains each page's
own horizon, so one delayed failure does not slow every page. Client navigation
restarts the final document's window, retaining its actual final URL. Media-only
tasks do not repeat console observation waits. A shortened or unavailable window
remains inconclusive. Historical findings without these scopes, and legacy
captures mixing page load with public actions, cannot establish scoped recovery.
Care admission and category rechecks also retain a claimed Site's original
legacy analysis when it predates execution snapshots. The same persisted
primary-Audit relationship used by history identifies that baseline. Its entry,
recorded pages and planned browser pages remain responsibilities after a newer
incomplete run. Other unscoped runs, another Site's history, targeted Outcome or
repair runs, setup work and incompatible environments cannot establish that
legacy baseline. A disposable PostgreSQL regression exercises admission,
historical scope retention, relationship removal and unchanged original rows.
Physical task reads also retain the namespace and work-kind predicates required
by the existing admitted-scope partial index. The populated-history guard rebuilds
that installed index on the migrated task table, verifies an independent write
can commit during its concurrent build, and checks page and behavior query plans.
With 24,001 synthetic task rows, the page query's rounded tuple-visit estimate
fell from 24,000 to 400 after restoring those predicates. This is a local query
workload observation, not an execution count or production latency guarantee.

Care admission retains the maximum original console horizon for each admitted
page across completed Site history, including resolved findings. Unfinished or
failed analyses contribute only completed finding task artifacts and committed
observation checkpoints through the same source projection used to reconstruct
findings. An uncommitted artifact or an ungrounded unfinished Flag cannot create
a retained responsibility. This also preserves slow-action, journey and current
destination responsibilities when unrelated source work does not finish. These
targets establish future observation obligations, never a passing assessment or
permission for privileged actions. The reader applies the
shared environment boundary and excludes setup observations. Historical page and
context pairs are deduplicated in PostgreSQL and read in batches of 512. Console
and journey responsibility readers select only the original context strings
through the shared historical-target reader, without transferring display labels,
text or other target payloads. Slow-action observation retains its required
selector and label. The
latest hundred findings cannot retire an older timing obligation. Only admitted
pages' maxima remain in memory. Disposable database fixtures cover 600 newer
contexts, staging and another Site, uncommitted/setup observations and invalid
timing scopes without modifying the original evidence.
An installed-worker fixture collects a delayed console failure through native
Chromium, leaves the source analysis unfinished, then retains its actual failure
horizon in a fresh care capture and observes the delayed failure again. Separate
database fixtures exercise completed task and checkpoint targets from running
and failed sources, including journey, slow-action and current-link readers.
The separately selected `CONSOLE_DB_REQUIRED=true` worker scenarios exercise
delayed console errors and unhandled exceptions, a partial repair on a second
page, mobile-only evidence after desktop refusal, an unavailable mobile window,
redirect comparability, complete repair, recurrence and bounded console floods.
These observations cover recorded windows, not every later interaction or
JavaScript execution state.
Accessibility collection retains each actual axe rule's passed, failed,
unresolved or inapplicable outcome, with engine version and the desktop capture
scope. The target-size responsibility also runs in the native mobile profile,
including Accessibility-only runs and focused target-size verification. Its
snapshot, element evidence and assertions retain the mobile profile separately.
A desktop pass cannot certify a mobile repair, and an admitted mobile capture
without valid rule outcomes remains incomplete. The shared Accessibility evaluator consumes native rule evidence even
when whole-document metadata is unavailable. Captured-HTML fallback assertions
then remain incomplete, while positive comparable native results can still verify
their original rule-specific findings. A failure-only list cannot certify a repair or a healthy automated
inspection. Mixed passing and unresolved nodes retain the unresolved result;
one observed failure can still establish that the responsibility fails.
The collector projects failure text, selectors and fix details into the existing
finding contract. Transient engine internals, including undefined contrast
parser fields, cannot interrupt durable snapshot storage. Top-level iframe
attributes remain the Site's responsibility; nodes inside embedded frames retain
their existing scope limit.
The portable WCAG rule inventory follows the installed engine and existing
rule-to-finding aliases. Rules emitted by the selected WCAG policy have
registered execution identities and verification assertions. Missing rules or changed
engine, requested/final URL, profile or access scope remain inconclusive.
The browser also explicitly enables the seven registered page-structure rules:
heading order, banner/contentinfo/main nesting, duplicate banners, a main landmark,
and a first-level heading. These are axe best-practice observations alongside the
existing WCAG tag selection, rather than a claim that each is a WCAG violation.
The registered duplicate-active-ID rule also runs as a legacy control-identifier
diagnostic, without treating the retired parsing criterion as current WCAG policy.
The policy does not enable the entire best-practice or experimental rule sets.
Collection and the portable registration guard share this selected rule inventory.
The disposable `mobile-accessibility.integration.test.ts` scenario uses actual
HTTP documents, responsive controls, native Chromium and the application/worker
path. It checks a mobile-only failure, a desktop-only change that leaves the Flag
open, a refused mobile document that remains inconclusive, a comparable mobile
repair and recurrence with the original finding identity.
Verification repeats every originally affected page, requiring positive outcomes
for the same rule family. Unrelated failures do not invalidate an independently
proved repair. Captured-HTML fallbacks retain their existing copy and severity,
and carry distinct predicates rather than borrowing an axe rule's pass. An
unavailable axe engine leaves automated coverage incomplete while retaining
those actual HTML observations. Historical unscoped findings cannot acquire
comparable source facts retroactively. Manual and assistive-technology review
remain outside these automated assertions.
The separately selected `ACCESSIBILITY_DB_REQUIRED=true` worker scenario
collects real accessible-name, contrast, iframe-title and ARIA failures. It
exercises a partial repair on another page, HTTP 503 uncertainty, independent
name recovery, genuinely unresolved gradient contrast, measured contrast and
ARIA repairs, and recurrence with the original Improvement and resolution.
A separate category worker fixture supplies two previously discovered pages and
runs the real browser policy. It exercises all eight structure and identifier findings, an
unchanged missing-main condition, unavailable original-page evidence, independent
repair of each responsibility and recurrence with the same Improvements. This
is local automated-rule evidence, not assistive-technology or production acceptance.
The Performance fixture seeds historical findings from the real HTTP collector
and detector, then exercises fresh diagnostic admissions through the
database, queue and application worker. Missing resource audits keep a repair
inconclusive. Changed provider criteria also remain inconclusive on both devices;
matching measured repairs resolve their exact source Flags. Stored receipts
also demonstrate independent score recovery despite unknown resource audits.
Its PageSpeed responses come from a controlled local HTTP fixture, without
establishing real Google provider acceptance. The verifier accepts Vitest name
filters, for example `node scripts/verify-progressive-execution.mjs --testNamePattern 'Performance score and resource'`.
HTTP transport is served by controlled fixtures; browser evidence is collected
in Chromium. The Signup interruption is modeled in the durable ledger
after a fenced submission-admission fact, not by creating a real account or killing
a production worker. Existing local databases are neither migrated nor reset by
this command. These checks do not establish provider or production acceptance.

Resource queues separate HTTP, browser, provider, evaluation and availability
work. HTTP defaults to four concurrent requests and the shared browser semaphore
to two contexts per worker, prioritizing queued availability. CPU-heavy metadata
and structured-data parsing runs serially in a reusable, memory-bounded worker
thread. Each call supplies its own input and deadline; no parsed evidence is
reused across calls. A crash or deadline terminates the worker before capacity
is released, so a late response cannot satisfy the next task. Idle workers are
retired after 30 seconds, and worker shutdown closes the parser after active
task queues drain. This avoids reloading the parser for every Search obligation
without changing detection or proof semantics. Search collector output and the
isolated parser share strict document and evidence schemas, including the
collector version and bounded rendered sections. Raw-HTML and bounded-section
collector output are exercised through both development and compiled parser
workers. This prevents a private worker schema from rejecting valid observations
and leaving broad monitoring unable to finalize. These defaults do not establish
production capacity; capacity and starvation acceptance remain required.

The compiled runtime has a separate opt-in integration check. After
`npm run worker:build`, run
`COMPILED_WORKER_REQUIRED=true node scripts/verify-progressive-execution.mjs --only worker/__tests__/compiled-runtime.integration.test.ts`.
It starts the actual `dist/worker/index.js` child with `NODE_ENV=production`
against migrated disposable PostgreSQL, isolated Redis and a local HTTP fixture.
Provider credentials are disabled. Native failure evidence, parsed browser
metadata, comparable independent repair and clean process shutdown are required.
The child exercises the compiled parser even though the parent Vitest process
uses test mode. This is local artifact/runtime evidence, not a deployed service,
container-image or real-provider acceptance result.
Desktop metadata assertions select the recorded `task:p0:browser` task. This
keeps proof tied to its captured profile when mobile and desktop complete in
either order.
Explicitly selecting this fixture first runs its focused TypeScript contract
check, before creating disposable services. The fixture's uptime reader retains
the admitted Site owner scope. A stale application call therefore fails before
the natural timer checks begin.

After building both web and worker artifacts, the same check can exercise the
normal authenticated HTTP boundary with
`COMPILED_WEB_REQUIRED=true node scripts/verify-progressive-execution.mjs --only worker/__tests__/compiled-runtime.integration.test.ts`.
Set `NEXT_DIST_DIR` to the web build's directory when using an isolated build.
This mode starts the built standalone web process, signs in an ordinary Site
owner against the local credential fixture, validates the Site and Flag response
contracts, admits the category check over HTTP and verifies the repair through
the normal Flag endpoint. Durable issue identity stays distinct from its source
occurrence. The API must return the same fixed state recorded by the worker, and
replaying verification must reuse its original execution and attempt. The test
does not exercise signup email delivery, third-party sign-in or browser cookies.

HTTP and browser collectors derive collection requirements from their admitted
consumers. Response-only HTTP checks and Search
document evaluation skip whole-page metadata parsing. Discovery retains its
document-link fallback, and resource-declaration checks retain their metadata.
Unknown and historical consumers keep full collection. HTTP and browser
requirements share the same bounded read of actual task dependencies, rather
than inferring work from the broader execution catalog. The worker fixture
verifies header repair while unrelated parser work remains pending.

Collectors retain observations already obtained when metadata
parsing fails. Metadata parsing finishes before the collector's publication
deadline, reserving two seconds for validation and its fenced observation write.
A parser that stalls or a collector with too little remaining enrichment time
therefore retains its already collected response and native facts, with the
metadata gap recorded separately. This does not guarantee publication through
an unrelated database outage or expired execution owner. A retryable parser
crash gets one bounded retry against the same
in-memory document, within the existing deadline. Collection is not repeated.
If parsing remains unavailable, the collector records null metadata and a bounded
failure code and attempt count; raw parser error messages are not retained.
Metadata-dependent checks stay unavailable, while response headers, Search source
documents, console, native Accessibility and independent metrics keep their own
evidence. Local worker fixtures terminate actual parser threads and verify a
partial report, header repair during continued parser failure, and later native
Accessibility repair. They do not establish production fault or capacity behavior.

The shared metadata parser resolves ARIA ID references, explicit label targets
and form owners through literal document identifiers. One index retains the first
active element for each exact ID; punctuation in component IDs never becomes
CSS selector syntax, and template descendants cannot supply a target. This
prevents ordinary component labels from crashing metadata collection or borrowing
an unrelated selector match. Native Chromium fixtures compare ARIA and label
relationships, including punctuation and first-ID collisions. The disposable
worker fixture retains metadata from the same component document through full
Site admission, independent privacy-link repair and scheduled recurrence. Static
name counters remain supplemental; rendered Accessibility proof still comes from
its native engine and recorded source conditions.

The shared public HTTP transport bounds resource admission separately from its
response budget. A caller's absolute execution deadline still limits both phases.
Local contention cannot shorten the website's configured response window and then
be labeled an origin timeout. Execution-budget exhaustion stays incomplete, and
Uptime records response duration from capacity admission, including DNS and
redirects while excluding local waiting. The native HTTP, PostgreSQL, Redis and
uptime worker fixture proves a healthy delayed response under contention without
creating an incident; focused fixtures retain genuine origin timeout detection.
An admitted HTTP operation leases its reusable dispatcher under that same
capacity permit. Its connection-time lookup belongs to the operation, even when
another Site is being checked concurrently. Expiry before address validation
finishes is unknown evidence, not an origin timeout. Completed DNS failures keep
their original classification through the fetch wrapper. Healthy connections
remain reusable; interrupted dispatchers and their DNS work are stopped before
capacity is released. No second admission queue is introduced.
Native UDP and HTTP fixtures exercise a successful public preflight followed by
an unanswered connection lookup, a simultaneous genuine origin timeout, and
healthy connection reuse. Installed uptime worker cases retain unknown probes
without opening an incident or recovering an existing one. Existing TLS failure,
recovery, recurrence and delayed-response evidence remain separate checks.

The same public address policy now owns connection-time lookup for Node HTTP
and managed Chromium. A changed DNS answer cannot move an approved public URL
onto a private socket. Chromium uses one loopback proxy per browser process;
HTTP forwarding, opaque TLS tunnels and WebSocket upgrades retain normal browser
behavior and the existing request-time credential and mutation guards. Browser
disconnection closes its proxy and active connections. Explicit localhost fixture
access remains scoped to its existing context option, with exact hostname checks.
The updated browser policy identity preserves historical evidence while requiring
new comparable capture conditions for repair. Native connection fixtures and
disposable HTTPS account and retained-page worker journeys verify this local
behavior, without claiming production or live-provider acceptance.
URL-first admission and socket validation use independently owned native DNS
resolvers with a five-second lookup ceiling. Caller cancellation stops pending
A and AAAA queries instead of abandoning their Promise; an unsafe answer cancels
the other family immediately. Expired partial answers remain unavailable, while
completed absent-record and public-address classifications retain their existing
semantics. A controlled local UDP server exercises actual resolver cancellation,
the admission ceiling and isolation between simultaneous Site lookups. The DNS
fixture adapter models the same ownership for HTTP and native browser fixtures;
it does not turn controlled answers into live DNS or production acceptance.

Rendered metadata input retains the one-million-byte parser bound. When direct
head or body script implementation and hydration text exceeds that bound,
collection preserves the complete DOM and registered analytics and consent
markers in an inert document. Script attributes, styles, JSON-LD and nested
script text remain intact. This avoids running custom-element constructors or
changing the live page. If the remaining DOM still exceeds the bound, metadata
stays unavailable and cannot certify metadata-dependent recovery. Typed metadata
record and size limits also withhold metadata without retrying a deterministic
bound as a parser crash. Unexpected contracts and interrupted parser execution
retain their existing recovery behavior. Both HTTP and browser collectors preserve
their independently collected observations when a metadata inventory exceeds its
bound. No synthetic or truncated metadata supplies a passing answer.

Native primary-action and pricing observations do not require a parsed whole
document. An observed original control, response or loading condition can still
establish failure and comparable repair. When page purpose is unavailable, a
missing primary action remains an incomplete obligation, rather than a missing-CTA
finding or a healthy not-applicable result. Tracking likewise retains recognized
endpoint failures and exact endpoint repair evidence while HTML snippet presence
and absence remain unknown. It does not generate a missing-analytics hint from
unavailable markup. The disposable worker fixture exercises byte-bound HTML,
metadata record bounds, original-control removal, independent repairs and
monitored recurrence for action, pricing, Tracking and native Accessibility
findings. The native accessible-name repair does not certify unavailable HTML
fallbacks or the whole Accessibility module as healthy. Metadata-dependent
checks remain incomplete throughout these local scenarios.

Module summaries use the same assertion facts at evaluation, durable commit and
read time. An unfinished advisory observation still leaves the inspection
incomplete; advisory status limits repair authority rather than removing an
evidence gap. Complete advisory observations retain their diagnostic meaning.

Evidence freshness follows collection time. Joined desktop/mobile input retains
the older profile time; a fresh dependent GET cannot renew its older source-page
declaration. Check receipts retain the oldest required recorded input and omit
collection provenance when their source was not collected. Evaluation time and
audit completion remain separate lifecycle facts.

Area coverage, card projections, Search and Site assessments share the same
area-scoped observation clock. An unrelated recent check or later batch cannot
make an older required observation fresh. Legacy observations without a recorded
collection time retain their historical audit-time interpretation. Confirmed
Flags remain visible when assurance expires, and independently fresh areas retain
their own health. Saved conclusions keep their original membership and stored
payload. Current assurance can expire sooner from their immutable source times,
with the relevant stale areas exposed without rerunning a later attention policy.
Search reuses its existing local assurance boundary; provider reporting windows
remain enrichment and cannot expire independent public observations.
Focused fixtures cover delayed finalization, mixed profile times, fresh response
probes over old declarations, mixed-area freshness and read-only saved expiry.
A recorded non-advisory failure cannot be overridden by a passing summary bit.
Finalization also inspects stored incomplete assertions, so a resumed older
checkpoint cannot produce FULL coverage from conflicting summary fields. Reading
such a receipt derives an unknown result without rewriting historical evidence.
The disposable worker fixture exercises native style gaps, complete observations,
unchanged advisory repair limits, and resumption of an older conflicting receipt.
Independent positive criteria on the same partial receipt remain usable for their
original scoped repairs.

The shared page evaluator accepts unavailable metadata without substituting an
empty document. Registrations that consume whole-document fields explicitly
require metadata; native input sizing, CTA style, typography and radius checks
consume their captured measurements directly. Layout and mobile action judgments
retain unknown purpose when classification is unavailable, without blocking the
same input cohort's independent repair. Visual hierarchy evaluates native action
style even when prose is incomplete, and can use separately retained complete
prose without reconstructing full metadata. Runtime tasks and offline fixtures
use these same registrations, including Accessibility. The separate
progressive Accessibility branch is removed. PageSpeed and response-header
observations no longer receive an unused empty metadata document.
The controlled worker fixtures retain input-font failure, repair and recurrence
through metadata bounds, and CTA style observations through both bounds. Styling
remains advisory and cannot independently certify repair.

Bounded native prose remains in the browser receipt when whole-document metadata
is unavailable. Once parsed metadata owns that observation, the snapshot omits its
duplicate. HTML byte and metadata inventory bounds cannot delete the independently
collected prose. Retention does not promote incomplete HTML or supply synthetic
metadata to dependent checks. The same worker fixture verifies this ownership
under both bounds alongside native failure, repair and recurrence.

Copy evaluation also consumes that retained prose directly. Content, placeholder,
messaging, friction and trust-context checks no longer require a parsed whole
document for their independent copy criteria. Hierarchy uses the same narrow
reader. Page purpose, controls, links, images and form declarations still require
their own observations; missing context stays unknown beside known copy facts.
Each native prose capture retains its own page, final URL, desktop profile and
access identity when full HTML exceeds its limit. A refused document dependency,
changed destination or incomplete prose cannot borrow full-document scope or
parsed text as recovery evidence. Historical captures retain their recorded
compatibility. The local worker fixture exercises five copy evaluators on an
oversized page, a 503 gap, later reassessment and same-incident recurrence.
Advisory criteria remain advisory, including after their patterns disappear;
the targeted repair attempt stays inconclusive rather than claiming independent
recovery or visitor understanding. Provider, platform and human validation are
separate requirements.

Copy judgments retain a separate versioned native layout observation alongside
HTML declarations. The bounded top-document light-DOM walk excludes unpainted
ancestors, hidden text and code samples, honors visible children overriding
inherited visibility, and retains laid-out prose below the initial viewport.
It samples at most 8,000 prose characters and 100 headings while bounding
traversal to 20,000 text nodes. Later headings are independent of the prose
length cap. Oversized individual text nodes and exhausted traversal remain
incomplete. Embedded documents, shadow trees, generated content and later
interaction states are outside this observation.

Content, placeholder, messaging, conversion-friction, trust-context and hierarchy
checks share this observation. Page-purpose classification, triage and prescription
use the same observed prose. Browser metadata also uses an explicit rendered
mode in the shared bounded parser. Inactive noscript and template descendants
cannot become live forms, action destinations, headings or structured trust
signals. Progressive browser collection, legacy rendered-page collection and
destination inspection share that mode; HTTP metadata retains crawler fallback
behavior. Native worker fixtures keep a ten-link inactive prefix ahead of broken
public checkout and sign-in controls, then verify the actual destinations after
repair. Original HTML and Search declarations remain separate. A failed native observation cannot
fall back to hidden markup to make copy judgments or feed an AI provider;
independent metadata checks continue. Stored prose retains the existing 5,000
character limit and records truncation. Legacy evidence without the new
observation keeps its compatibility behavior; advisory findings do not gain a
new repair certificate from this detector correction.
The persisted browser metadata contract validates and retains this bounded
observation. Integrated fixtures require the browser task's committed artifact,
so metadata written before a failed task cannot substitute for completed evidence.

Native Chromium fixtures reproduce hidden placeholder false positives, visible
recurrence, visibility overrides, below-fold content, sampling bounds and honest
incompleteness. The actual application and worker fixture retains hidden template
markup through URL admission, signed claim, default monitoring, independent
Security repair and recurrence without creating a copy Flag. Separate provider
input tests verify prose selection and refusal of unavailable observations;
actual AI-provider quality and acceptance remain unverified.

The scheduler owns dispatch and interrupted-work reconciliation independently of
customer reads. Transient tasks have a 30-minute recovery window from first
interruption, bounded by one hour from admission; repeated worker/parser crashes
stop after three execution attempts. Calls retain short deadlines. Protected
actions require current fixture authorization and reconciled cleanup before replay.
Public journey guards never transmit signup/contact mutations as status probes.
Hostname equality cannot authorize cart mutations across protocol or port. A
scanner-imposed refusal is an explicit coverage limit, not a website failure.
Cart-entry permission does not authorize payment, wallet or checkout submission.
An isolated Checkout probe has a bounded navigation context and records a safe
execution boundary rather than blaming the website when the scanner refuses an action.
Checkout and configurable browser journeys share one optional media stage.
Live steps record their observed URL and a bounded native frame without waiting
for private storage. Missing or navigation-crossing frames retain null entries,
preserving the association between each observation and its image. Native context
closure must acknowledge before uploads or GIF composition begin. One five-second
budget, shortened by the caller deadline or execution cancellation, covers all
optional media work. A late operation cannot attach a URL or launch more work
after that budget. Observations and verdicts survive media failure. Recording
cleanup waits for native closure and removes only the attempt's directory.
Production media reads, writes and prefix deletion share the private screenshot
transport and its abortable SDK requests. Missing production storage yields
unavailable media rather than an unusable worker-local URL. Outcome namespaces
include the execution generation so retried work cannot replace prior evidence.
The controlled native fixture holds storage open through a completed Checkout
and a configurable goal walk, verifies native context release, then requires
unchanged observations with null media references. The disposable PostgreSQL and
Redis worker fixture runs failed cart entry, independent repair and recurrence
with unavailable media, retaining the original finding and repair lineage.
Signed local webhook fixtures require connection revocation before cleanup and
a failure response while private deletion remains incomplete. Path cleanup uses
the durable path namespace, covering frames and artifacts without a video receipt.

Shopify path work carries the connection's authorization version and exact path
identity. Uninstall and replacement advance that version; ordinary credential
renewal preserves it. Token refresh independently compares the admitted version
and credentials before accepting a provider response. Path publication and
scheduler claims use one short transaction that locks Project, Shop and Path in
that order, keeping browser work, HTTP requests and queue calls outside the lock.
History, current verification receipt and linked failure projection commit
together. A late result cannot overwrite a newer receipt, reschedule a revoked
connection or replace advice collected for a different source. Rejected walks
delete only their own media namespace. Producers, storage cleanup and authorized
asset reads share the namespace protocol, including historical names.

Path alerts load the exact committed verification receipt and check the current
connection, source and recipient at each provider admission. A held email call
cannot authorize a later Slack call after revocation or a newer observation.
Recovery describes observed checkout entry; independent-attempt claims require
the persisted attempt count. Accepted delivery metrics require a provider receipt
or successful webhook response. These guards do not provide a durable retry ledger.
Eighteen disposable PostgreSQL lifecycle and token-refresh cases exercise stale
completion, uninstall, replacement, renewal, receipt ordering and an installed
Redis queue/worker path. Browser and external provider boundaries in those cases
are controlled fixtures; native checkout evidence is established separately.
Migration `20261016103000_shopify_authorization_version` adds the connection
version and nullable current receipt reference without inventing historical
receipts. It has been applied only to disposable local verification databases.

Visitor loading timers start at navigation after browser-capacity admission.
Queue waits are operational latency, never page-performance evidence. A loading-UI
diagnosis requires an actually observed blocking loading state; absence of that
state has no loading-clearance duration. Historical observations are not rewritten.
Loading clearance begins as soon as the initial DOM observation records blocking
UI. Its browser timestamp is independent of screenshots, media uploads, protocol
acknowledgement, document readiness and title waits. The initial frame timestamp
excludes upload time. Desktop and mobile collectors, their clearance waits and
mobile layout metrics share one loading predicate, including viewport position,
ancestor visibility and the distinction between a blocking main loader and a
small background loader. Unavailable clearance remains unknown. The
`records browser loading clearance` Chromium fixture checks fast, slow and
persistent loaders with delayed titles and nonblocking loading elements; the
media-delay regression reproduced a 500ms clearance incorrectly reported as
8001ms before this correction. Loading observations remain bounded to the initial
loading window and post-load capture, not later interactions or arbitrary future
states.

Loading findings now record each originally affected device under the requested
and final page, browser profile, access condition and `Loading UI observation v1`
rule. Repair requires a matching observation with visible top-level text or a
decoded main image, completed document readiness and no scanner restriction.
Removing a spinner from a blank page cannot prove recovery. Delayed-loading
repair retains the existing 3000ms and mobile-specific 4000ms thresholds, and
requires every originally failed device. Legacy findings without original scope
remain unverified. The shared viewport collector supplies content evidence to
both ordinary loading and slow connection observation without adding another
browser capture.

Interaction evidence and targeted mobile loading verification do not require
unrelated desktop metadata. The `verifies original loading windows` disposable
Chromium, PostgreSQL, Redis and worker fixture covers blank and challenged
responses, partial desktop repair, independent mobile recovery after desktop
refusal, complete repair and recurrence of delayed and persistent loading
conditions. It verifies Flag, attempt and Run results while preserving historical
resolution. These observations do not establish production or real-device
performance acceptance.

Reduced-motion evaluation observes native running effects from navigation through
two seconds after DOMContentLoaded. Each rendered top-document element is counted
once within its CSS animation, CSS transition or Animation API family. Paused and
finished effects and elements hidden by an ancestor do not establish moving
content. The initial window retains finite introductions that finish before
screenshots, uploads or metadata collection. Effects still pending beyond the
window leave incomplete evidence.

The ordinary mobile capture supplies the normal-preference window. An independent
`motion` browser task loads the same page with reduced motion enabled before
navigation. This catches initialization-only preference handling. It depends on
the ordinary capture and contributes only to the interaction evaluator, allowing
unrelated page checks to publish first. The legacy page runner uses the same
reader and comparison after closing its ordinary contexts. Auxiliary observation
does not hold the existing desktop and mobile capacity slots.

`Initial reduced-motion observation v1` freezes requested and final URLs, browser
profile, secret-safe access conditions, observation horizon, failing motion
families and the original element cohort and baseline counts. Independent repair
and Watch recovery share this comparator. Each failing family retains the
existing below-half reduction threshold. Adding unrelated honoring animations
cannot dilute motion that remains in the original cohort. Blank, challenged,
partial, changed-scope and legacy unscoped evidence cannot certify recovery.
These bounded observations do not cover canvas or requestAnimationFrame drawing,
SVG SMIL, embedded documents, shadow-root motion or later user-triggered motion.
The disposable native-motion fixture covers repeated ancestor selections, hidden
and paused animation, finite introductions, initialization-only Animation API
preferences and CSS transitions. The worker lifecycle verifies source-cohort
padding, blank and challenged evidence, independent repair, clear Run results,
recurrence and preservation of the historical resolution. Shared loading and
slow connection regression scenarios pass locally. This establishes controlled
local behavior, not real-device or production accessibility acceptance.

Initial overlay observation owns an independent `overlays` browser task per
device. The checker uses bounded read-only hit tests on visible enabled controls,
retaining the existing 900ms persistence and coverage thresholds and the consent
chrome exclusion. It records requested and final pages, browser profile, access,
stable control identity and device. No control is clicked, form submitted or
consent decision made. Hidden, removed, changed, blank or challenged conditions
cannot certify original-control recovery. Diagnostic admission now resolves all
three overlay responsibilities instead of referencing the absent `network`
verifier. Repair and automatic recovery share the same scoped comparator.

The native fixture covers navigation, action and form overlays on both devices,
transient covers, consent chrome and unavailable original-control evidence. The
disposable database, queue and worker fixture independently verifies a natively
recorded initial action cohort: blank, challenged and hidden evidence remains
inconclusive, desktop-only repair remains unchanged, full repair yields a clear
Run, and Watch recurrence preserves identity and historical resolution. This is
initial-cohort proof.

Flow, pricing navigation, form validation and journey probes also record the
original control and interaction phase using `Control overlay observation v2`.
Before-action observations use the existing safe click trial. Positive evidence
for an after-action condition requires a completed activation; a failed attempt
followed by a clear hit test remains unknown. Diagnostic admission freezes the
recorded phases and selects their workflow, including the original journey type
when the current page classification changes. Legacy unscoped failures remain
explicitly unknown when combined with scoped observations.

The interaction worker fixture checks hover-triggered action, navigation and
form covers: unchanged covers remain failures, blank pages remain inconclusive,
independent repair yields a clear Run, and Watch recurrence preserves the
historical resolution and improvement identity. A separate journey fixture
replays a recorded signup navigation condition after page classification changes.
The after-action fixture checks that completed activation can replace an
unknown observation, while retaining an observed failure. Its worker replay
leaves blank evidence inconclusive and confirms independent recovery after
activation. Journey navigation uses the browser's resolved link and exact origin,
so relative and fragment links exercise their actual controls. Journey overlay
Flags use the common fenced projection. Finalization retains initial, flow and
journey conditions, with native journey findings linked to the same customer
Flag. Prescription enrichment preserves native evidence targets and verification
rules. These are controlled local browser,
database, queue and worker results. Legacy findings without original scope,
unsupported controls and external provider behavior remain unverified.

Public first-visit, pricing and signup page conditions use `Public journey page
observation v1`. Each observation retains the original admission URL, final URL,
desktop capture profile, access identity, journey type, phase and selected control
path. Headline evidence checks the first rendered H1 against the existing
12-character threshold. Hidden descendants cannot pad a short heading, and a
visible child may override inherited visibility. An incomplete rendered-copy
walk leaves the headline condition unknown. Primary action evidence requires a visible, enabled
control in the viewport. Signup field observations exclude hidden ancestors.
Journey action presence, route discovery, flow selection, pricing, destination
controls and mobile action measurements share one bounded rendered control inventory. Labels exclude hidden
descendants, and conversion-intent scoring uses those rendered labels. Plain conversion links do not require a special
URL or CSS class. Generic enabled buttons, button roles and styled action links
retain their presence semantics. Inert and invisible controls cannot establish
presence; a visible child may override inherited visibility. Action assertion
contexts include the detector version, so this correction cannot certify repair
of historical action findings. Missing-flow-action and journey-path assertions
also version their corrected detectors. Native-input discovery uses journey action
version 4 and flow presence version 3; older versions remain readable but cannot
certify these corrected presence findings as repaired. Rendered headline contexts carry their own
detector version. Unchanged response, timing and form conditions retain their
comparable contexts.
Signup field observations exclude button, submit, reset and image activation
controls. Field assertion version 2 keeps that detector correction distinct from
repairs. A reduced field-count repair still requires at least one visible field. A
control inventory inspects at most 2,000 candidate elements and 20,000 label text
nodes, with 1,000 characters per label. Exceeding these bounds withholds absence
claims. Viewport action completeness is independent of offscreen label bounds.
Eligible rendered routes are ranked before deduplication and retention of at most
80 destinations. Hidden navigation copies cannot consume those retained routes.
Discovery retains the exact selected control for native activation. A failed
original activation cannot certify destination repair through direct navigation
or a competing healthy control. Blank, challenged, failed-document or restricted observations remain
incomplete.

Native findings and phase receipts use the common fenced task projection, with
raw Journey Findings linked to the customer Flag. The destination remains in
step history while verification starts at the original admission page. Named
diagnostics replay original controls rather than the current highest-ranked
link, stop after page observations and never submit signup forms. Monitoring
retains recorded journey types and paths after page classification changes.
Whole-document metadata enriches journey selection without gating native
collection. When its parser fails or its document bounds are exceeded, recorded
routes still run and fresh selection keeps its existing unclassified-page
policy. The journey's own browser observations decide findings and comparable
repair. Missing metadata remains unavailable for the checks that require it;
it is never synthesized from an earlier report. The disposable worker fixture
terminates metadata parsers during multi-route signup verification and subsequent
care, retaining partial evidence, independent recovery and recurrence without
submitting forms.
Journey, slow-connection and console care share the historical observation reader. It
selects completed evidence from the same Site and environment, retains repaired
Flags and original observations grouped into another display Flag, and traverses
distinct targets in bounded database batches. Newer unrelated findings cannot
evict original routes through a display-row limit. Domain readers retain the
original page boundary and deduplicate equivalent routes or action identities.
Console admission retains the longest original error horizon, including a source
observation grouped behind a shorter display representative. Historical console
targets retain their existing check-identity policy rather than acquiring a new
verification rule from the current registry.
Shared missing-action and dead-end identities are registered; unsupported
walkthrough conditions retain an unknown marker when combined with native
evidence. Bare journey completion is no longer a repair verifier.

The disposable worker fixture verifies missing and hidden signup fields,
hidden duplicate links, reranked links, disabled original controls with competing
healthy destinations, changed destinations, blank pages, challenges, independent
repair and recurrence. A shared-action fixture checks the original three journey
types, and a native visibility fixture checks hidden ancestors, disabled and
offscreen controls. These are local page-condition results. They do not prove
successful account creation, conversion rates, AI judgments or real-provider
behavior.

Mobile navigation uses an independent `flow` task with module
`mobile-navigation`. It creates the 375px mobile browser profile with touch
input enabled and uses a native tap to open menus. Capture identity includes the
touch capability, preserving the desktop identity while keeping older mobile
conditions distinct. The task
does not depend on desktop capture, primary-action execution or providers. The
progressive desktop flow skips the old mobile viewport detour. The stage adapter
uses the same collector through its compatibility entry point. The collector
observes at most four navigation panels and 40 links per panel, including
declared portals mounted after opening. A declared menu that fails to reveal
links within 1500ms is recorded as a failure. An undeclared opener whose intended
panel cannot be established remains unknown. Compact visible navigation remains
supported; the existing full-navigation-without-a-menu criterion is retained.

`Mobile navigation observation v1` freezes the panel and capture conditions,
and records hashed link identities. It does not persist link query credentials.
Independent repair requires every originally recorded link to remain present
and visible. Removing a link, changing its destination, losing the original
panel, or collecting blank or challenged evidence cannot certify recovery.
Repair and monitoring use the same assertion comparator and fenced projection.
Failed execution publishes a module failure receipt. Native menu and keyboard
observations share the read-only interaction boundary, which refuses submission,
navigation and additional windows. Navigation links are never followed during
this observation, and visibility does not prove destination health or every
possible overlay interaction.

The native fixture exercises missing and ineffective openers, touch-only handlers, existing and
dynamically created portals, compact navigation, undeclared scope, and refused
newsletter submission. The disposable database, queue and worker fixture checks
unchanged menus, removed or changed links, unavailable pages, independent repair
and recurrence with preserved incident identity. Diagnostic work runs only the
mobile navigation observer and finalization. Existing keyboard fixtures pass
with the shared guard. These are controlled local results; real-device behavior,
unsupported widgets and production runtime acceptance remain separate.

Confirmed customer failures are committed, not retried in pursuit of a pass.
Expired work becomes a visible unknown; completed observations and prior captures
remain intact. Finalization and completion projections are idempotent.

Streaming deterministic findings, finalization and Flag-based scores share one
page-scoped projection. A specific finding suppresses an overlapping warning
only on the same affected pages. Progressive publication supplies the complete
committed observation union, so later evidence can trim obsolete paths while
preserving the surviving Flag ID. Unreferenced duplicate rows may be removed
only from unfinished reports. Source task receipts, customer feedback, linked
Improvement occurrences and completed or failed reports retain their evidence.
Tasks with no new findings still commit their module receipts and comparable
repair proofs, but skip rebuilding the finding projection. Finding publication
reads only nonempty committed finding arrays. Finalization continues to derive
the completed report and scores from the settled observation graph.

The legacy Audit stages remain monotonic projections of graph activity, not the
source of task ownership. Site events use private, replayable durable cursors;
clients refresh authoritative tenant-scoped queries. Neither event reconnect nor
HTTP/MCP polling performs recovery. Module execution completion is distinct from
assertion success. Current results require comparable page/configuration/source;
older receipts are explicit historical evidence.

Site progress reads only task identity, recorded state, timing and the page,
module and device scalars needed for display. PostgreSQL omits full executable
inputs, including retained control cohorts. This read does not parse historical
tasks against today's admission schema or modify execution eligibility. Missing
display fields remain unknown, and recovery keeps the original recorded reasons.
Classification considers the supported full task graph while the detail list
stays bounded to 100 rows. Category activity is projected from that same full
graph, so later running, retrying or waiting work does not disappear behind the
detail limit. The existing activity display consumes one compact entry per
category, retaining running-over-retrying-over-waiting precedence and recorded
order within a state. Disposable database fixtures retain 5,000 controls and
a 2 MB historical input while each actual progress query transfers under 4 KB.
They exercise the real Site-home reader and client projection validator; these
are read-path fixtures, not evidence that those synthetic tasks executed.
Provisional progress and event reads stay on the exact primary Audit, including
the originating visitor's permitted view after claim. Parent, task and count
reads retain that boundary across a claim between successive reads. Another
Audit in the claimed Site cannot enter that provisional projection.

Result totals use the same result projection and repeatable-read snapshot as
pagination. Count reads select at most 100 receipts and around one MiB of detail
per batch; an oversized receipt is inspected alone. Database filtering and cursor
ordering preserve Site, category, page and provisional-report scope. The complete
receipt fingerprint still refuses changed evidence, including edits at the same
timestamp. A disposable PostgreSQL fixture counts 1,000 results from 500 receipts
with 10 receipt reads, compared with 54 before batching, and checks dense payloads
and compatibility with the preceding cursor fingerprint. This reduces round
trips; exact totals still inspect all eligible history and do not establish
production latency or capacity.

Website summaries and Outcome detail readers apply the same current required
binding versions, mechanisms and environment before treating an assessment as
current. Protected form results also require the exact Site-owned fixture,
current authorization and recorded successful dry-run version. One scoped batch
loads fixture authority for an Outcome list or website summary batch. Changed,
disabled, revoked or unrecorded responsibilities remain unverified without
rewriting their historical assessment. This read projection does not authorize
execution; admission and worker permission checks remain independent.
Outcome detail selects assessments by the originating request time, matching
list readers, so a delayed older run cannot replace the latest requested answer.
Required method proof belongs to that assessment's physical Audit. Individual
method evidence also needs recorded binding revisions, mechanism, environment
and fixture correspondence. Unscoped or obsolete executions remain in History,
including legacy executions without retained attempt rows. A passing method
describes that one check; only the aggregate assessment can claim every required
check passed.
Outcome incident projection follows request order as well as observation time.
An older request completing after a newer assessment retains its own conclusion,
but cannot clear the newer incident, reclassify its Flags or publish a recovery
transition. Its receipt records the superseding assessment and remains historical
in later incident comparisons. A subsequent comparable current check can still
recover every original occurrence and recognize recurrence without rewriting the
earlier receipts.

Site coverage applies incomplete module receipts, failed module ownership, local
Search responsibilities and Tracking delivery limits before deriving overall
health. Category cards and account summaries consume these same facts. A current
observation in one area cannot establish a Clear Site while another required
area or recorded page is unresolved. Confirmed Flags remain actionable alongside
incomplete evidence. Completed partial reports retain the existing recheck action,
including runs with no fatal failure code. The independent Search worker fixture
checks agreement among the overview, account list and monitoring history using
the fully migrated disposable database and Redis queues.
Coverage gaps use each registered assertion's customer area, rather than only
the enclosing module's default area. Mobile tap-target gaps belong to Conversion;
mobile font gaps belong to Accessibility. Explicit gaps do not invalidate
independent observations in another area. An unavailable shared collector leaves
all of its registered areas unknown, including across page receipts. The same
attribution applies to the final incomplete-module summary. Focused card fixtures
and the real mobile repair worker fixture verify these conclusions.

Category depth reads compose the current category receipts with the remaining
full-site receipts. Superseded area observations retain their originating Audit
and date in history. Pagination is bounded and tied to this evidence selection;
a cursor from a different selection cannot relabel older evidence as current.
HTTP and MCP readers select the full-site baseline explicitly, so a newer
diagnostic or category execution cannot replace its identity.

Diagnostic run results use the exact admitted repair attempt, source Audit,
verification Audit and immutable evidence reference. Comparable recovery is
Clear, a reproduced failure is Flag, and missing or inconclusive proof remains
unverified. Account-only reads use the committed account task. Unavailable
behavior is incomplete even alongside a successful observation. Run results
and history share these conclusions. A notification marked SENT establishes
provider acceptance, represented as `accepted`, without proving inbox delivery.
Recovery of an accepted uptime email's delivery history follows its frozen owner
and recipient after Site transfer or an address change. It does not resend the
message or expose it to the new owner. Missing or erased original ownership stays
unattributed. Disposable database fixtures verify this projection and reconcile
an early bounce only against the original recipient.
Accepted mail reuses its source receipt's retry clock for delivery-history
recovery. An invalid retained timestamp or a conflicting provider identity
defers that receipt without changing its SENT status, acceptance time, recipient,
payload or provider-attempt count. Later receipts can recover in subsequent
bounded batches. Completed projections cannot be deferred. This uses the existing
source lifecycle rather than a separate recovery queue; no accepted message is
resent. Disposable database cases cover all four channels, the exact retry
boundary and recovery after the retained fault is corrected.
Summary history retains sending while the final request lease is live. Exhausted
attempts without an acceptance receipt are unconfirmed, rather than proof of
non-delivery. Provider-reported delivery failures remain separate dated facts.
Watch and uptime alerts use the current verified recipient at batch selection
and conditional provider admission, matching summaries and onboarding mail.
Unverified accounts retain monitoring, finding classification, incidents and
pending alert identity without spending delivery attempts. After verification,
the existing queue resumes eligible delivery. A changed verification flag during
preparation refuses the claim. Frozen historical recipients and accepted provider
facts keep their original meaning. Disposable database cases exercise both
senders, verification races and bounded backlog progress.
Event correlation checks the same stored expiry during direct acceptance recovery
as during maintenance selection. Expired early events cannot restore a delivery,
bounce or complaint claim, or suppress a recipient. Acceptance remains recorded
without inventing a delivery result. Disposable database fixtures exercise the
exact expiry boundary, cleanup and a still-valid event one millisecond before it.

The current catalog's 108 responsibilities have explicit stable coverage identities and
registered evaluator mappings. The capability report exposes partial coverage;
registration is not execution proof. Capability check inventories derive from
the check registry rather than a second list of finding identities.
Catalog scenarios require certified comparable repair for responsibilities that
can verify a repair, including every returned facet. Auth-link proof uses its
actual detector and original destination scope. Internal links and section anchors
map to their page evaluator, separately from sitemap discovery observations;
unused-code proof exercises both JavaScript and CSS. Uptime provenance records
URL, time and response evidence without inventing a failure or healing transition.
Provider, lifecycle and scheduled observation obligations remain explicit.
Search completeness may use a recorded alternate source only for the same
execution, exact page URL, check and detector version. A readable page cannot
cover an unavailable page, and module inventories cannot combine executions.
The projection indexes recorded source membership once for the loaded scope.
Site overview, account-list and notification projections retain these gaps;
summary completeness uses the shared Site assessment rather than a separate
subset of its facts. Focused source and disposable database fixtures reproduce
the false healthy result and omitted summary limitation without rewriting stored
observations.
Overview, account-list and prepared summary freshness also follow the shared
assessment's stale gaps. Fresh broad evidence cannot conceal an expired watched
result. When required observations are both incomplete and stale, the result
remains unverified while freshness retains the stale warning. Disposable fixtures
exercise cadence changes, prepared email content and a later fresh observation,
while preserving the original historical conclusion and validity window.
Outcome verification, Flag verification, prompt copying, settings and connection
actions use shared submission ownership and operation-specific response contracts.
Verification keeps its idempotency key after an uncertain response. Site refresh
validates the complete projection and matching identity before replacing the
recorded view; malformed responses retain visible disconnected evidence.

Explicit Site refreshes await the validated HTTP read and write it to the
requested Site's explicit cache key. Revalidation resolving with retained data
is not proof of a fresh read. A callback captured before navigation cannot
replace the next Site's cached view or connection state; closed event streams
cannot update the next view. A late failed request preserves newer validated
facts while exposing the transport failure. Settings, monitoring, account-check
preferences and connection controls derive their values from this shared view,
without copied initial state. Successful writes await its refresh. If the write
was accepted but refresh failed, the interface retains recorded values and
states that refresh is pending. Notification writes include only edited fields,
preserving independent preferences changed elsewhere. Revoked provider records
retain their property and observation date without another disconnect action.
Focused resource and component fixtures exercise these transitions and failures.

Account and email-preference drafts also reconcile their retained tab-memory
patch when refreshed server values arrive. Fields already confirmed by the
server leave the draft and unload guard, including a save completed after route
unmount. Other edited fields remain retained. A later server change to a clean
field cannot resurrect its earlier draft value. Baseline refreshes and local
edits use the same owner-generation and mounted-lifetime guard. Focused hook and
email-form fixtures reproduce the stale value and ghost warning without browser
history interception or persistent storage of account data.

Default monitoring resolves the effective account policy from the same scoped
transaction read as Site identity. Active plan grants contribute to the default
cadence; expired or revoked grants do not. Account lifecycle availability is
checked before creating default coverage or scheduling, and inactive accounts
are excluded before the backfill batch limit. Existing schedules and explicit
pauses remain authoritative. Disposable PostgreSQL fixtures exercise grant
lifecycle, inactive-account exclusion and claim-time scheduling without modifying
stored subscription state.

Schedule options and explicit activation read this effective entitlement policy
as well. They no longer use a separate subscription-only interval helper.
Unexpired cadence grants, grant expiry or revocation and inactive accounts agree
between offered options and the authoritative save path. Disposable database
fixtures compare those reads with actual persisted schedule changes; beta
schedule access and stored commercial subscription state remain intact.

Explicit activation after a pause recognizes the retained cadence and absent due
clock. It admits a fresh first availability check instead of presenting a
pre-pause completed run as newly requested work. Repeated activation reuses the
new pending check and retains the saved due time. The post-save read also keeps
the original owner and refuses a replacement owner's schedule. A disposable
PostgreSQL/Redis fixture exercises real admission and replay with controlled
public DNS. It does not execute that fixture's website or prove provider behavior.

The same upkeep also selects a clock halted by the scheduler's exact known
schedule-permission refusal. It resumes the saved cadence only after current
entitlements permit it again, preserving custom timing, last-run history and
existing Outcome bindings. Still-disallowed cadences use the shared bounded
setup retry so they cannot occupy every batch. Explicit owner pauses, active
leases and unrelated missing-clock reasons cannot enter this recovery path.
The normal scheduler and admission transaction then own the next check.
Disposable database fixtures reproduce refusal followed by restored permission
and confirm a new queued Watch receipt, plus batch progress and authority
exclusions. This is local scheduling evidence, not production observation.

Automatic monitoring isolates account lookup, admission and retry persistence
for each due Site. A failure for one Site cannot stop the remaining due batch.
Every pause, claim, completion and retry matches the selected owner, active
account, saved cadence and due time. After claiming work, updates also require
that worker's exact lease, so a delayed worker cannot clear a replacement lease.
Disposable PostgreSQL fixtures exercise failed account lookup, lease replacement,
ownership transfer and schedule edits with a controlled admission adapter.
Independent native worker fixtures provide the separate execution evidence.

Scheduled completion recovery uses a partial expression index on the committed
production schedule's Site, attempt time, next-run time and failure count. The
existing JSON comparisons can locate the current clock without reading every
retained request. Completion, interruption and ownership guards remain in the
same query and conditional write. In a disposable PostgreSQL fixture with 10,000
retained synthetic requests, the former empty sweep visited 10,001 requests.
The indexed query visited one request while settling a matching completion and
zero on the empty sweep afterward. The fixture retains all 10,001 requests and
settles only once. These are local query-plan observations, not a production
throughput or naturally scheduled monitoring claim.

Scheduled completion sweeps rotate attempted requests using the existing run
activity timestamp, as abandoned-run recovery already does. A conditional update
records effort before parsing or projecting a completion. Strictly advancing the
timestamp also preserves that claim with an unchanged clock. Repeated projection
failures and unreadable historical contexts therefore yield to untouched Sites
across bounded sweeps. The immutable schedule context, source evidence, failure
streak and Site clock retain their existing comparison and write boundaries.
Disposable PostgreSQL cases reproduce starvation with a one-row batch, retain
both failing Sites unchanged while a third receives its retry schedule, then
recover the retained Sites once their obstruction clears. No replacement queue,
lease or operational retry field is introduced.
Native worker fixtures separately retain discovered and previously monitored
pages after every desktop, mobile and media collector is interrupted before a
page row exists. They exercise scheduled retry, category recovery and subsequent
recurrence while preserving the original exhausted task identities. Unavailable
provider measurements remain partial coverage in these local scenarios.

Monitoring sweeps use the shared clock as a time source rather than freezing all
work at the batch cutoff. Default setup evaluates each Site and transaction retry
at its own current time, so a grant that expires during earlier setup cannot
authorize a later Site's cadence. Watch attempt rotation remains part of every
subsequent mutation fence. Leases begin after account lookup; an expired admission
lease retains its original due intent for a fresh claim. Successful cadence uses
the actual admission time while preserving the original scheduled intent key.
Busy deferral, failed admission and fallback after a past renewal use their result
time. Uptime publication selects the current slot for each monitor, and workers
finish authority reads before allocating their observation lease. Slot and lease
checks run again before the public request. Delays do not become fresh evidence
or trigger synthetic catch-up observations. Disposable PostgreSQL and real queue
fixtures exercise these boundaries independently of production acceptance.

An in-flight uptime job treats physical monitor, Site or account removal as
cancellation. Both synchronization and observation publication re-read after the
monitor lock and stop when its row is gone. No probe, recovery or confirmation
is published, and the job cannot recreate removed state. The disposable lock
fixture verifies removal while synchronization waits. A real worker and
controlled HTTP fixture remove the Site during its request and confirm that the
job completes on its first attempt, with no queued confirmation. This is a
specific missing-monitor branch, not a catch for database or transport failures.

A combined disposable application fixture starts with anonymous URL admission,
completes native public collection, claims the signed anonymous evidence and
checks the original Site, page and Flag identities. The actual uptime worker
executes the default monitor. An owner-recorded CSP repair is independently
verified through the audit worker; a scheduled Watch then recognizes recurrence
under the same Improvement while retaining the uptime monitor. The installed MCP
client and server also read this Site's paginated evidence and lifecycle facts,
record a repair of the recurrence, replay its admitted receipt and independently
verify it through the worker. Every returned next-tool argument must belong to
the advertised input schema. Application and MCP evidence pages agree, and a
different owner cannot read the Flag or run. The protocol transport in this
fixture is in memory; external client and authentication acceptance remain
separate. It also checks that an ordinary visible conversion link produces no
missing-action Flag.
Provider work is explicitly unavailable in this fixture, with its recovery
window exhausted rather than a fabricated provider response. These results
establish controlled local lifecycle behavior, not live provider acceptance,
production storage, notification delivery or sustained production monitoring.

A separate opt-in compiled browser fixture submits `https://example.com/` through
the actual homepage form, with no API admission fallback or substituted response.
Native collection records the real page title before ordinary browser sign-in
claims the same Audit, page and Flag identities and enables default monitoring
and uptime. Its external transport allows only GET or HEAD of that exact root
URL; other external paths and provider calls are refused. The application,
PostgreSQL and Redis remain local and disposable. The sign-in identity is seeded,
so this does not prove signup or email delivery. This public-entry observation is
separate from the controlled local repair and recurrence fixture, and does not
establish an externally published repair or production acceptance.
With matching compiled web and worker artifacts, run it explicitly using
`COMPILED_PUBLIC_ENTRY_REQUIRED=true node scripts/verify-progressive-execution.mjs --only worker/__tests__/compiled-runtime.integration.test.ts -t 'admits a real public URL'`.
Retained evidence for the November 1 run is under
`test-results/runtime/public-entry-2026-11-01/92ee291d9ec8/receipt.json`.

Email signup distinguishes account creation from an authenticated session. When
the auth service requires verification and returns no session token, the shared
auth form waits at email verification and offers a link retry. Neither the
authenticated callback nor Site claiming runs at that point. A sign-in refused
for an unverified email reaches the same recovery state. Link retries preserve
the original post-login destination; native verification and automatic sign-in
then continue through the existing Site claim.
The public-entry fixture can exercise ordinary browser signup instead of a
seeded identity with `COMPILED_SIGNUP_REQUIRED=true`, using the installed mail
SDK against a controlled loopback endpoint and requiring email verification.
It checks that the Site stays provisional before verification and retains its
original Audit, pages and Flags after the actual verification link is opened.
Run with matching compiled web and worker artifacts using
`COMPILED_SIGNUP_REQUIRED=true node scripts/verify-progressive-execution.mjs --only worker/__tests__/compiled-runtime.integration.test.ts -t 'admits a real public URL'`.
This establishes the local application flow, not real provider acceptance or
inbox delivery. The actual public target remains limited to its exact root URL.

An opt-in compiled notification fixture uses the installed Resend SDK with a
loopback HTTP endpoint and dummy credentials. It starts from a native category
finding and a seeded due summary preference. The worker's ordinary timer owns
schedule admission and sending. The local endpoint loses its first response
after a signed delivery event reaches the actual webhook route; the next sweep
must replay the frozen body and provider key and reconcile that early event.
Only the fixture receipt's retry eligibility is advanced to avoid waiting through
backoff. The fixture then checks authenticated Settings, signature refusal, a
signed bounce and suppression on a subsequent worker sweep. External provider
requests remain refused. This does not establish real Resend behavior, inbox
delivery or observation of a naturally reached daily calendar slot.
Summary delivery takes its eligibility timestamp after schedule admission.
Receipts created while scheduling runs can therefore enter the same delivery
sweep. Future retry times remain deferred, and the existing permission, attempt,
payload and lease fences still own each provider request. A disposable database
regression advances the admission clock across the committed write and retains
an independently scheduled future receipt.
Run explicitly with matching web and worker artifacts using
`COMPILED_NOTIFICATION_REQUIRED=true node scripts/verify-progressive-execution.mjs --only worker/__tests__/compiled-runtime.integration.test.ts -t 'sends scheduled summaries'`.

The production bootstrap owns the physical Chromium server through Playwright's
process handle, while the worker retains the shared Browser and context APIs.
Private IPC carries its loopback control connection. Worker exit waits for owned
browser termination, so an abruptly killed collector cannot leave an uncounted
Chromium process consuming host resources. The existing task ledger, leases and
scheduler continue to own execution recovery.
An opt-in compiled interruption fixture holds a real browser navigation, kills
the worker child and checks physical browser cleanup. It starts a replacement
worker and requires an independent Site to finish before the original lease
expires. It then waits for natural lease expiry and scheduler recovery of the
same browser task, request and Audit, without advancing clocks or leases.
Run with current compiled worker artifacts using
`COMPILED_INTERRUPTION_REQUIRED=true node scripts/verify-progressive-execution.mjs --only worker/__tests__/compiled-runtime.integration.test.ts -t 'recovers the same native browser task'`.
This controlled local fixture does not establish production restart behavior or
sustained monitoring acceptance.

Candidate limitations still requiring implementation or acceptance include
working/failing/incomplete/recovery fixtures for every advertised item, keyboard
coverage beyond safely exercised declared popups and inspectable open components, embedded controls, visual focus
assessment, remaining shared action consumers, capacity/fault coverage and real provider, private-storage, notification,
MCP-client and observed owner sessions. Passing fixtures or the unit suite does not
satisfy those release requirements. The integrated main checkout is not deployed
or release accepted.

## Historical stage records

The serial page orchestrator has been removed. Old stage names and stored
evidence remain readable through the shared persistence and projection contracts
below. New work uses the task graph above; the coordinator retires unfinished
historical execution without replaying its external work. Capability verification
uses current task handlers and native worker fixtures rather than the removed
orchestrator's mocked test path.
The unused tool-availability verification writer has also been removed. Current
recovery uses recorded assertion receipts and their original comparison scope;
registering a tool cannot supply successful repair evidence. Stable target and
URL keys share a pure identity module, so comparison readers do not load database
writers or the capability map. Historical receipts retain their existing readers.

```
audit job (BullMQ, always):
  QUEUED → CAPTURING → CHECKING → JUDGING (triage) → FINALIZING → COMPLETED

prescription task (optional, gated, provider queue):
  completed triage → prescription LLM → prompt enrichment (sets aiReviewAt)
```

Legacy triage runs inline in the audit job. Prescription uses the shared task
ledger after triage completes, including for historical reports. Old `ai-review`
queue deliveries only admit that task. Progressive execution uses the task graph above.

An Audit is an immutable Review observation of the Product at a moment in time ([knowledge/vision.md](../knowledge/vision.md)).

A Flag is a finding from one Review.

Overlay rectangles live on `Flag.evidenceTargets`. They are harvested on the capture page immediately after the viewport screenshot. Finalize must not re-open the URL to guess a box.

A Product-scoped Improvement is the durable judgment and action object across Reviews.

Product Signals and integrations add evidence; they do not become Flags or confirmed claims automatically.

## Execution context and ledger

Every run receives one `ReviewExecutionContext` with its clock, deadline, event
sink, scan access, and trace identity. Stage boundaries return a typed
`ReviewStageResult` of `complete`, `partial`, `failed`, or `skipped`, including
artifacts, duration, evidence gaps, and a structured failure when applicable.
Partial evidence remains partial; it is never promoted to manufactured success.

Pipeline history is stored as append-only `AuditPipelineEvent` rows. Each row
contains the Review and execution identifiers, trace, attempt, stage, event,
status, timestamp, duration, and sanitized details. Writers insert events rather
than reading and replacing a JSON array, so concurrent worker and recovery events
cannot overwrite each other. Retry attempts use a PostgreSQL advisory lock to
allocate a stable next attempt. The migration copied and counted all legacy JSON
events before dropping `Audit.pipelineLog`; there is no dual-write path.

## Audit modes and review depth

| Mode          | Enum            | Behavior |
| ------------- | --------------- | -------- |
| Teaser capture | `SINGLE` | Anonymous teaser. Reduced pipeline (no slow-3G). Walk the primary CTA when the remaining deadline allows. Fully review the pasted page. Open-check unique eligible public destinations. Stored `reviewDepth` is 1. |
| Full capture | `CRITICAL_PATH` | Signed-in and claimed reviews. Full pasted-page capture (flow, slow-3G). How far full judgment goes is stored `reviewDepth`, not this enum. Keep the enum value for existing rows and parked MCP. It is not a 6-URL crawler. |

`reviewDepth` is stored at create time from the owner's plan (`lib/billing/plans.ts` `reviewDepthForPlan`). Update reviews and Watch copy that stored value.

| Depth | Plan | Fully review | Open-check |
| ----- | ---- | ------------ | ---------- |
| 1 | Anonymous teaser and Free | The pasted page | Every unique eligible public destination that page exposes |
| 2 | Pro | The pasted page and eligible public pages it links to | Pasted-page destinations only |
| 3 | Studio | Pasted page, linked pages, and one level beyond | Pasted page and those linked pages |

Eligible destination: same-origin `http(s)` HTML navigation. Canonical identity (`lib/audit/url-identity.ts`) collapses hashes, trailing slashes, tracking params, locale/pagination/host variants, and duplicate URLs. Open-check (`lib/audit/open-check.ts`) uses GET/render as authority; HEAD is optional. Dead-destination Flags require evidence. Importance order (`lib/audit/review-depth.ts`) ranks pages before expensive review. Every reviewed page runs the same judgment, including triage. Product score comes from Flags, not page averages. Repeated issues collapse via `affectedPaths[]`.

If allowed depth cannot finish inside the deadline and internal ceilings, the Review is `PARTIAL`. Never silently drop eligible pages and call it complete. Missing PageSpeed on a fully reviewed page is also `PARTIAL` for that evidence.

New signed-in audits store full capture (`CRITICAL_PATH` enum) and `reviewDepth` from the plan. Anonymous teasers store `SINGLE` and `reviewDepth` 1. Expansion never uses a 6-URL crawler.

## Report completeness (`FULL` vs `PARTIAL`)

`reportCompleteness` on the audit and `completeness` on each `AuditPage` reflect missing evidence, not scan failure:

| Condition                                                                  | Completeness                                                         |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Desktop screenshot + metadata + both PageSpeed results + mobile screenshot | `FULL`                                                               |
| PageSpeed 429 or partial capture                                           | `PARTIAL` — flags still run; perf data or screenshots may be missing |
| Triage degraded (no LLM)                                                   | `PARTIAL` — deterministic flags + honest degraded verdict            |
| Rubric dimension missing score on any page                                 | Rubric `assessmentState: PARTIAL`, score `null`                      |

Users still get a usable report on `PARTIAL`; UI should not treat it as a failed scan.

## Re-check (post-change FULL path)

Manual re-check is the core loop habit. Implementation invariants:

1. **Always `monitoringMode: FULL`** — `startMonitoringAudit` in `lib/audit/monitoring.ts` always enqueues FULL. App code never writes `SUMMARY_ONLY` (legacy Prisma enum value only).
2. **Fresh evaluation** — a user re-check is a new linked Audit. Interrupted execution preserves committed pages, captures and observations; it never deletes earlier evidence to restart. There is no copy-parent certification path.
3. **Quota policy** — admission preserves the current access and quota policy. Recovery reuses the admitted Audit and cannot charge another analysis merely because a task retries.
4. **One active manual Review per Product** — manual creation takes a Product-scoped PostgreSQL transaction advisory lock before checking for an active Review. Concurrent first or update requests reuse the persisted active Review, create no second queue job, and consume no second credit. Watch runs are classified separately and do not block the manual Review.
5. **Persisted parent is authoritative** — the creation result returns the active or newly created Review's stored `parentId`. Re-check comparison and verification consume only that returned parent, never the caller's requested parent. A conflicting request resumes the active Review without fabricating a comparison.
6. **Flag diff after durable completion** — when `audit.parentId` is set, the idempotent completion projection calls `diffFlagsAgainstParent` (`lib/audit/diff-flags.ts`) to mark child flags FIXED / REGRESSED / NEW vs the parent report.
7. **Improvement verification** — the completion projection reconciles pending Improvement Attempts only when the Review is a fresh child of the attempted Review and the applicable page, evidence, and verifier completed comparably.
8. **Inconclusive evidence is honest** — missing, partial, degraded, failed, or non-comparable verifier evidence records `INCONCLUSIVE`, leaves the Improvement unverified, and never writes Product Memory.
9. **Verified learning** — Product Memory receives a learned fact only for an `IMPROVED` attempt with comparable before/after Review evidence and provenance.

Screenshot base64 for prescription is loaded via `loadAuditScreenshotBase64` from the **current** audit's stored screenshots (`lib/audit/load-screenshot-base64.ts`).

## AI phases

| Phase                  | When              | Job         | Gated by                          |
| ---------------------- | ----------------- | ----------- | --------------------------------- |
| Deterministic checks   | Always            | `audit`     | —                                 |
| Triage (phase 1)       | Every fully reviewed page | `audit`     | LLM keys + deadline budget        |
| Prescription (phase 2) | After triage      | `ai-review` | `includeAi` + signed-in + credits |

### `includeAi` vs `triageAt` vs `aiReviewAt`

- **`triageAt`** — phase-1 triage succeeded (score, verdict, rubric grades, AI flag titles).
- **`aiReviewAt`** — phase-2 prescription succeeded (fix prompts, evidence, whyItMatters).
- **`includeAi`** — resolved by `lib/audit/ai-report-entitlement.ts` at audit create time. Controls whether prescription is enqueued after triage, not whether triage runs.

Claiming a partial report preserves entitlement and monitoring without queuing
prescription when triage evidence is absent. Finalization persists the report
independently of optional queue delivery. The progressive finalizer and legacy
runner then share a fresh readiness read of owner, entitlement, successful
triage and completion. Entitlement and the single prescription task commit
together before best-effort Redis delivery. The existing recovery pass
reconstructs missing deliveries and backfills authorized interrupted handoffs;
inactive accounts and archived Sites do not receive new tasks. Repeated claims
and legacy queue jobs reuse the task rather than starting another execution.

Prescription retains the report's `COMPLETED` state and progress while its
execution lease and events track enrichment. Provider delay or interruption
cannot reopen the underlying analysis or monitoring run. Successful enrichment
preserves its completion time, assessment and Improvement projection and clears
the prior prescription error. Website progress and category health select only
analysis tasks; prescription cannot make a completed website check appear active.
Disposable PostgreSQL and Redis fixtures exercise
failed delivery, deletion after queue acknowledgement, concurrent admission and
actual worker recovery. The provider task owns its lease, generation and recovery
clock independently of an older source report. A live legacy writer delays it;
an expired writer cannot overwrite the recorded completion. Provider attempts,
fallback, backoff and prescription batches share the remaining execution budget.
Optional prescription deliveries have lower priority than fresh provider checks.

An actual worker fixture recovers an eight-day-old interrupted prescription,
holds a controlled provider, records failure and retries successfully against
local stored evidence. Interruption after enrichment commits but before task
acknowledgement reuses the saved result without another provider call. Its
supplied triage, one-pixel capture and provider output are lifecycle fixtures,
not evidence of real AI-provider quality or acceptance. Historical rows already
marked `FAILED` and live-provider behavior remain separate verification cases.

AI triage may return zero new findings. MESSAGE and REACH findings require an
exact quoted excerpt from the supplied page text or metadata; unsupported or
invented excerpts are discarded before persistence and verdict selection.
The headline and subheading are evaluated together. A visible named testimonial
with a numerical result must not be described as lacking those details.

Anonymous visitors: triage runs; fix prompts stripped by `lib/audit/report-access.ts`.

## Degradation matrix

| Trigger                                | Outcome                                                     | User sees                          |
| -------------------------------------- | ----------------------------------------------------------- | ---------------------------------- |
| Triage succeeds                        | `COMPLETED`, `triageAt` set                                 | Score, verdict, rubrics            |
| Triage fails (keys, timeout, provider) | `COMPLETED`, `triageAt` null, `failureCode` set             | Flags + honest degraded verdict    |
| Capture fails                          | Progressive: capture limitation; legacy: `FAILED`           | Recorded results plus missing capture evidence |
| Prescription fails                     | `COMPLETED`, `triageAt` set, `failureCode` AI_REVIEW_FAILED | Triage report + partial AI callout |
| PageSpeed 429                          | PARTIAL completeness                                        | Flags still run; perf data missing |
| R2 missing (prod)                      | Capture task remains limited; independent public checks continue | Missing private capture evidence |
| Worker down / stuck                    | Scheduler recovery, then explicit exhausted coverage if necessary | Automatic recovery or honest limitation |

Exhausted native observation tasks publish explicit module coverage gaps for
their admitted responsibilities. Primary actions, pricing navigation, forms,
mobile navigation, journeys, overlays, slow connections, cross-page previews,
discovery and automatic account observations use the same terminal publisher.
Each unfinished remainder has a task-specific receipt scope, preserving earlier
completed observations and making repeated recovery idempotent. A shared action
task cannot add failure claims outside its admitted check set. Unknown historical
modules retain an unavailable marker without requiring a current assertion
schema, so failure publication cannot strand their task. Controlled PostgreSQL
and Redis delivery fixtures retain a completed route beside an interrupted
remainder and prove that only the observed original route can establish recovery.
These establish local execution and projection behavior, not provider acceptance
or production interruption evidence.

## Failure codes

Internal codes map to user copy via `lib/audit/user-facing-errors.ts` and `AUDIT_ERRORS` in `lib/marketing/copy.ts`.

| Code                         | User message theme              |
| ---------------------------- | ------------------------------- |
| `AI_PROVIDER_NOT_CONFIGURED` | Check could not finish          |
| `AUDIT_TIMEOUT`              | Took longer than expected       |
| `AI_REVIEW_FAILED`           | Some fix guidance was not written |
| `DESKTOP_CAPTURE_FAILED`     | Could not capture screenshot    |

## Recovery

`lib/queue/recovery-scheduler.ts` owns recovery. Progressive work is reconciled in
bounded passes on a ten-second cadence; the historical adapter uses its slower
stuck-Audit pass. Scheduler leases renew and release atomically by ownership token.
Site, report and MCP reads return persisted state without initiating either path.
Progressive recovery windows are not legacy `AUDIT_DEADLINE_MS` call budgets.

## Environment variables

| Variable                               | Purpose                                              |
| -------------------------------------- | ---------------------------------------------------- |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Required for triage, not independent deterministic execution |
| `JUDGE_PROVIDER_CHAIN`                 | Provider fallback order (default `openai,anthropic`) |
| `TRIAGE_MODEL`, `TRIAGE_MAX_TOKENS`    | Cheap triage pass tuning                             |
| `PAGESPEED_API_KEY`                    | Recommended prod; avoids 429                         |
| `R2_*` (five vars)                     | Required for prod screenshots                        |
| `AUDIT_DEADLINE_MS`                    | Legacy call budget (default 180000); not progressive recovery window |
| `MIN_JUDGE_BUDGET_MS`                  | Min time before triage starts (default 25000)        |

## Health endpoints

| Endpoint                  | Checks                                                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/health`         | DB, `storageConfigured`, `aiConfigured`                                                                                                                      |
| `GET /api/health/ready`   | Strict database, Redis, worker, Chromium, R2, AI, PageSpeed, auth, billing, email, and Product Watch readiness; returns 503 on any missing launch capability |
| `GET /api/health/ai`      | Provider keys + triage schema loaded                                                                                                                         |
| `GET /api/health/browser` | Chromium + R2 connectivity                                                                                                                                   |
| `GET /api/health/worker`  | Redis + worker heartbeat                                                                                                                                     |

The worker launcher's separate HTTP endpoint returns 503 until its child has
connected every queue consumer, and again while stopping or after 45 seconds
without child acknowledgement. This is process readiness, not provider acceptance.
The application worker diagnostic endpoint retains its JSON diagnostic contract;
monitoring must inspect its `ok` field rather than treating HTTP 200 as health.
`lastBrowserConnectedAt` records connection observation only. Allocator diagnostics
report owned, unowned and expired contexts plus reserved capacity. Opaque context
IDs correlate with private allocation/release logs; public diagnostics include no
target URLs, credentials or tenant identifiers. Physical slots remain held until
native closure, including after execution-scope cancellation.

## Debugging runbook

1. `curl https://fixflags.com/api/health/ready` — confirm `ok: true`
2. Check Railway worker env: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` on the dedicated worker service
3. Redeploy after setting keys (SDK clients init at module load)
4. Execution ledger events: `triage_step_failed`, `triage_degraded`, `triage_runner_retry`, `recovery_force_failed`
5. Post-deploy: `npm run smoke:triage:prod`

## Canonical files

| File                                          | Role                                      |
| --------------------------------------------- | ----------------------------------------- |
| `lib/audit/runner.ts`                         | Top-level orchestrator                    |
| `lib/audit/progressive/runtime.ts`            | Task coordination and worker registration |
| `lib/audit/progressive/engine.ts`             | Fenced task delivery and recovery         |
| `lib/audit/progressive/collectors.ts`         | Independent evidence collection           |
| `lib/audit/progressive/evaluators.ts`         | Checks against recorded task evidence     |
| `lib/audit/progressive/actions.ts`            | Public action and slow connection tasks   |
| `lib/audit/pipeline/stages/judge-page.ts`     | Typed Judge stage                         |
| `lib/audit/pipeline/types.ts`                 | Execution context and stage result types  |
| `lib/audit/pipeline-log.ts`                   | Append-only event ledger                  |
| `lib/audit/pipeline/finalize-from-outcome.ts` | Outcome → finalize routing                |
| `lib/audit/pipeline/outcome.ts`               | Resolve triage_complete vs degraded       |
| `lib/audit/judge-triage.ts`                   | Triage LLM + retry                        |
| `lib/audit/judge-prescription.ts`             | Prescription LLM                          |
| `lib/audit/finalize.ts`                       | Triage / prescription / degraded finalize |
| `lib/audit/run-ai-review.ts`                  | Phase-2 prescription job                  |
| `lib/audit/recover-audit-job.ts`              | Stuck audit recovery                      |
| `lib/audit/pipeline-config.ts`                | Deadlines and budgets                     |

## Browser capture (production)

Production scans use **Playwright + Chromium** only (`lib/audit/screenshot.ts`, `lib/audit/browser/page-session.ts`). Do not use chrome-devtools-mcp, chrome-devtools-axi, or conversational browser agents on the audit path.

`browser/context-lifetime.ts` owns capacity admission, native context allocation,
setup cancellation and physical release for the shared page factory. The explicit
capture deadline and inherited task signal include allocation and setup. Calls
without an explicit deadline receive a 30-second admission/setup window, then
retain caller-owned context closure after preparation. Cancellation rejects the
caller without waiting for a stalled native allocation or close. Pending allocation
keeps its slot until failure, confirmed native context removal or browser disconnection;
a late context closes before page setup. An isolated cleanup failure cannot close
the shared browser or declare a live slot free. Setup and per-request guards also
refuse late continuations, including a policy read that finishes after cancellation.
Controlled native fixtures exercise those boundaries alongside a live sibling,
including Playwright returning early from a repeated close while the first close
is still pending. The disposable worker fixture checks signed claim, uptime,
repair and recurrence. These results establish local behavior, not production acceptance.

| Step                         | Where                        | Notes                                                                                                                                                               |
| ---------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop + mobile evidence    | `progressive/collectors.ts`   | Independent profile tasks and separate optional media collection; a task owns one native context at a time |
| CTA flow scan                | `progressive/actions.ts`     | A public-action task uses its own bounded desktop observation and records incomplete action scope explicitly |
| Slow 3G replay               | `progressive/actions.ts`     | An independent slow-connection task uses its own deadline and native comparison scope; the existing teaser policy is retained |
| Network engagement           | `browser/network-monitor.ts` | Page-loading and public-action observations retain request, phase and capture identity; unsafe actions remain refused |
| Technology profile           | Primary desktop session      | Up to 300 deduplicated public resources plus allowlisted document headers and runtime markers; no extra navigation, bodies, cookies, queries, or authorization data |
| Journey templates            | `progressive/lifecycle.ts`   | Durable bounded observation cohorts retain each original page and control through interruption |
| Visual evidence              | `progressive/collectors.ts`  | Optional media work cannot withhold independent check evidence |

The public-action task retains phase-scoped network facts and their originating
receipts, and stores the primary serialized walk on the Audit. An unavailable
walk cannot certify completed action coverage or discard an independently
recorded API failure.
Optional Flag visual capture owns one device session at a time. It selects only
devices required by the findings, deduplicates visual check identities, captures
clean comparison frames, and closes each session before opening the next. Device
comparisons compose those retained frames after both sessions close, with desktop
pixels under Desktop and mobile pixels under Mobile. A missing device cannot
produce a substitute pair or prevent independent visuals on the other device.
The parent review deadline and a one-minute optional capture ceiling bound new
session admission. The visual compositor cannot acquire browser capacity.
Controlled native Chromium fixtures exercise concurrent captures with one slot
available and inspect actual composed pixels. These are local resource and image
provenance checks, not physical-device or production acceptance.

Source/destination visuals read the recorded Landing and After click frames from
the matching failed flow. Each captured walk appends a fresh observation identity
to its asset prefix, preventing a sibling or repeated walk from replacing its
destination image. Composition uses same-Audit desktop storage references on the
configured app origin, retains those references with the derived image, and never
reopens the website to invent the two states. Missing images, mismatched walks,
foreign Audit references and historical overwrite-prone `flow-1` destinations
remain unavailable. Existing source hero frames can still be reused. Native
fixtures retain the first source/destination pixels after another differently
colored walk with the same supplied prefix, then compose without new requests.

Capture and walk findings are deduplicated before judgment. Browser contexts
close even when the walk throws. Verification receipts are written after the
walk; skipped or timed-out walks do not establish completed flow coverage.
The walk budget is checked after capture and preserves the minimum judge budget.

`lib/audit/deterministic-audit.ts` is an **offline/demo probe** (accuracy scripts, flow demos). It is not the production entry point.

Technology detection is versioned and deterministic in `lib/audit/tech-detect.ts`.
Both execution paths use `technology-capture.ts` to assess the existing primary
desktop observation before credentialed HTML is removed. Progressive browser
tasks publish the normalized profile in the same fenced transaction as their
completed checkpoint. Linked-page and media tasks cannot overwrite it, and old
checkpoints without a technology observation remain uncaptured.

The detector tests resource hosts individually and reuses recognized Tracking
providers, including first-party libraries and suppressed event attempts.
Evidence labels contain no request queries, credentials, visitor payloads or
private HTML. A detected tool does not prove successful delivery or provider
recording. The Tracking card uses its fresh category profile when available;
the broader Site profile retains its own source.

Compacted or truncated documents, bounded-inventory overflow, missing native
inputs and restricted captures preserve positive detections as partial evidence.
Unavailable captures cannot become complete empty inventories. Parent and child
profiles can report changes only when both are complete and have the same
detector version, page, final URL, browser profile and executable access identity.
Historical profiles without recorded capture scope cannot establish removals.

Only the latest completed broad analysis, selected with the shared Site analysis
authority rules, can publish the knowledge graph's current stack. Recorded legacy
primary analyses retain their authority. Category, diagnostic, setup and account
runs cannot replace it. Partial broad observations can add positives without
inferring removals. Host serialization, latest-source selection and reconciliation
share one transaction, so retries and interrupted writes cannot leave a mixed stack.

## Page text limits

Prescription uses **5000 chars** from `lib/audit/page-text-limits.ts`. Triage uses **2500 chars**. Change both the limits file and `buildPrescriptionPrompt` in `lib/prompts/system-prompt.ts` together.

## Watch notification classification and recovery evidence

Site alert selection follows completed-check chronology, then stable creation and identity ties. Updating an older delivery cannot replace a newer alert. The board and Settings consume the server-projected delivery state, which already applies the alert's saved attempt ceiling and lease, rather than inferring a second state from a fixed retry limit. Disposable database and component fixtures exercise chronological selection, saved delivery budgets, exhaustion, and later provider acceptance.

Watch parent lookup normalizes the selected URL with the same function used at Audit creation. A canonical Site root without a slash must match its persisted root-page Audit. `WATCH` provenance is retained even without a completed parent; finalization then classifies current observations as new, with no invented recovery. The retry sweep also includes those first Watch alerts.

Notification selection applies current Site preferences to both the count and the exact Flag destination. OFF also disables recovery messages. Confidence and impact survive diff projection. Provider rejection and missing delivery configuration consume bounded claims; a confirmed provider ID records SENT, which proves acceptance rather than inbox delivery.

Classification cannot overwrite a live sender or confirmed acceptance. A claim
compares the observed attempt count, and terminal delivery writes require that
exact attempt and lease. An expired sender cannot undo a newer acceptance or
release a newer active claim. A SENDING row with no recorded lease has no active owner: it remains eligible for bounded retry, or becomes FAILED at its saved attempt ceiling without another send. The shared delivery view reports that exhausted uncertainty as undelivered. Classification failures also defer these rows so they cannot starve later alerts. Opting out cancels due or expired work while
preserving a live provider call's recorded ownership. Provider requests use a
20-second abort deadline, forwarding the signal through the installed SDK to
the actual HTTP call. Retries retain the permitted selection's stable provider idempotency key
and five-attempt ceiling. The migrated PostgreSQL/Redis worker fixture exercises
stale classification reads, late rejection and acceptance after reclamation,
live and expired opt-outs, exact recipients and Flag links through the installed
SDK with a controlled HTTP boundary. This establishes local ledger and SDK
behavior, not real-provider acceptance or inbox delivery.

Notification retry batches exclude inactive accounts, removed or transferred
Sites, and undated observations before applying the batch limit. The selection
joins the observation to its current Site owner, so historical ineligible rows
cannot repeatedly occupy the batch ahead of valid alerts. Disposable database
fixtures reproduce this starvation for pending, failed and abandoned deliveries
and verify that history is preserved while current-owner alerts proceed.
Classification itself requires a completed, dated
Watch observation belonging to the current active Site owner. Direct delivery
also requires the durable projection receipt. Completion time updates compare
that exact source observation and current ownership at the Site write, without
substituting the retry time for a missing observation date. Classification
writes and physical delivery claims share the same current account, Site,
completion, recipient and preference predicates. Delivery also compares the
saved attempt ceiling. A change after the initial read cannot publish stale
classification or admit a provider request using stale permission.
Confirmed acceptance and live claims retain their existing ownership contract.
If a recorded comparison cannot be read, retry upkeep records the preparation
gap and moves that row behind other due alerts without consuming a provider
attempt or changing an active sender. The local worker fixture covers stale
permission changes, incomplete and undated source runs, a missing projection
receipt, forty older ineligible rows, and an unreadable comparison ahead of an
active owner's alert. It also verifies that classification can commit before
the final projection receipt without contacting the provider.

The stored provider body includes the selected Site and finding identities.
Retries with the same permitted selection reuse the exact body and key, even
after names or templates change. Narrowing to critical Flags or disabling
recovery messages creates a new permitted message with its own delivery key.
Earlier uncertain bodies and keys stay recorded in the same notification
ledger. Returning to a previously selected set reuses its original delivery.
Unscoped historical messages retain compatibility under broad preferences;
restrictive preferences require an exact current body or a new scoped message.
Selection and delivery history never enter the provider's email body. The
existing attempt ceiling, ownership fencing and confirmed acceptance remain
shared across these selections.
The migrated worker fixture also saves a scoped revision of a historical
message and retries that exact body and key through the installed SDK after
another owner-name change. Focused selection tests cover critical-only and
recovery opt-outs with previously recorded mixed messages.

Checkout proof records the final main-frame response after navigation and checks visible checkout errors before success. Reaching a checkout URL with HTTP 503 is not Clear. Failed confirmation attempts and their response status remain recorded. A Site verification request may omit its change description; store null rather than an invented repair, preserve existing pending context on retries, and let fresh execution determine the result.

Shop Pay branding and arbitrary Shopify frames do not establish checkout entry.
Embedded entry requires a checkout destination with its own observed navigation
response, visibility through its enclosing frames, usable checkout fields and a
newly reached state. The observation bounds frame traversal and never reads field
values or submits payment. Empty or challenged checkout surfaces remain unknown;
an observed checkout HTTP failure retains its status. The JourneyStep keeps the
outer page URL and the qualified embedded destination separately. Cart detection
requires painted cart UI, counts or confirmation text, so a hidden or transparent
drawer cannot suppress a real failed Add to cart action. Controlled Chromium
fixtures exercise branding, hidden frames and drawers, usable embedded entry,
loading, challenge and HTTP failure. The database and worker cycle uses these
observations with unavailable media and retains independent repair and recurrence.

Recorded repairs share the existing Improvement Attempt and cycle ledger across Site, API and MCP paths. A request key identifies one declared repair within its Improvement. Exact retries return the original receipt, including completed outcomes, without another attempt or event. A changed declaration under that key returns `FIX_INTENT_MISMATCH` (HTTP 409). Historical receipts without a recorded request hash retain their original receipt; their original payload cannot be reconstructed. Commit and deployment references are declared provenance, not proof that those changes were deployed.

MCP OAuth grant consumption and replacement access/refresh creation share one
transaction under the existing active-account lock. A failure at either
credential write retains the original grant for a retry and leaves no partial
credentials. Concurrent exchanges still issue one pair. Expired grants and
unavailable owners cannot issue credentials, and client, redirect, resource,
scope and PKCE binding remain enforced. Disposable PostgreSQL fixtures reproduce
the formerly spent-grant failure, then exercise successful retry and rotation
through the token handler and scoped admission through the installed MCP handler.
Those handler calls are local; external client acceptance remains separate.

OAuth client metadata uses the same bounded public transport as website
evidence, including socket-time DNS validation. It refuses redirects and bodies
larger than 64,000 bytes or otherwise incomplete, before parsing the exact client
and redirect identities. Controlled DNS cases and a native TCP fixture verify
that changed DNS cannot connect metadata admission to a private service.

MCP repair handoffs include the stable verification request key required by the
registered tool schema. Following `record_fix.next` can therefore start execution
without inventing another argument, and retries retain the same attempt and run.
An admitted receipt's follow-up supplies only `runId` to `get_run`, matching its
advertised schema. The installed-protocol claim fixture checks that continuation
after replaying a repair of a real recurring finding.
The brief's `afterDeployment.arguments` also carries its context revision into
`record_fix`. A first declaration with that revision must still describe the same
evidence, source membership and repair criteria before it records an attempt.
Changed context returns `REPAIR_CONTEXT_CHANGED` with `prepare_new_prompt`,
without creating an attempt or starting verification. Callers without a brief
retain the existing declaration contract. A keyed retry replays its already
frozen source scope even after monitoring advances or verification resolves it;
the original change-intent conflict checks still apply. A controlled grouped
worker fixture adds a capture after retrieval and verifies refusal plus frozen
retry. The installed MCP fixture follows the emitted arguments through the real
handler and worker, including denied scope, changed revision, successful repair
and replay after completion. These are local protocol and worker observations.

Repair projection and delivery have separate responsibilities. The validated
public brief retains each complete observation and repair definition. Ordinary
pages still contain at most 25 observations and fit the 256 KiB JSON budget.
When one record or another public field cannot fit, `deliverSiteRepairBrief`
emits `fixflags.repair-brief-fragment.v1` through both HTTP and MCP. Its text
fragments concatenate in UTF-8 byte-offset order into the exact original brief
page. Every continuation requires the context revision and document digest;
changed serialization returns `REPAIR_DOCUMENT_CHANGED` with
`read_document_from_start`. Completed documents retain the existing observation
continuation. No observation is truncated, treated as read or marked recovered
by delivery. Every request retains owner or scoped developer-key authorization.

Large copied tasks carry the original source and context references and require
complete retrieval before a change. Normal copied tasks remain inline. Receipt
writing and repair declaration retain their existing revision and frozen-source
contracts. The old MCP Flag alias derives evidence and guidance from the same
brief and becomes explicitly null when duplication would exceed the payload
budget. Optional images remain separate native content and are not repeated on
later document fragments. No new storage, snapshot cache or repair policy is
introduced. Focused local HTTP, installed MCP SDK and disposable PostgreSQL
fixtures establish complete large-record retrieval, private comparison-field
exclusion, copy custody, revision-checked declaration and replay. They do not
establish external editor acceptance, clipboard usability or deployed behavior.

Owners can also obtain `fixflags.repair-file.v1` from the existing instruction
preview. `POST /api/sites/:siteId/fix-prompt?view=file` requires the prepared
single-task hash or bundle manifest revision. Shared brief preparation projects
the complete public task once; shared repair selection owns scope and manifest
identity for copied bundles and files. Files include every readable textual
observation, the repair definition, original source references and independent
verification criteria. Screenshots and extra provider data are explicitly absent.
The file can be read offline without borrowing the owner's FixFlags credentials.

File delivery retains one task at a time, emits chunks of at most 64 KiB and
uses the existing owner/scoped-key boundary. It rechecks source revisions and
the full selection before emitting completion and a digest of the serialized
task array. There is no transaction held across delivery, new snapshot store or
repair policy. Response cancellation stops subsequent source reads; a bounded
deadline prevents abandoned exports from running indefinitely. The browser
validates the expected Site, scope and completion count before offering a Blob
download. Partial, revoked or changed delivery cannot become a completed file.
Downloading does not record a clipboard handoff or declare or verify a repair.

Focused fixtures cover complete 65- and 5,000-observation groups, a category with
103 tasks, source/selection/authority changes, cancellation, partial responses
and the existing preview's download action. Disposable PostgreSQL checks retain
both selected source Audits and a large recorded observation while leaving copy
and repair ledgers unchanged. These are local software observations; native
download behavior and actual external editor acceptance remain open.

The public performance measurement schema now lives in
`performance-measurement-contract.ts`. Browser-readable evidence contracts do
not import the server's hashing and recovery calculations. Schema/type consumers
have migrated to that owner without a parallel compatibility export. Page
selection also uses a bounded prefix search to preserve the same largest fitting
observation page without repeatedly encoding every shorter large array.

Current Site findings, durable incident details and account/notification summaries
share one history reader. It selects source references in 128-row batches across
bounded Site and incident selections. Each batch retains the existing independent
recovery comparison, releases proven historical sources, and preserves every
unresolved capture. There is no history cutoff or replacement recovery policy.
Full diagnoses and repair text are loaded only for current sources, also in
bounded queries. Exact historical Flag detail reads its own source and proof
without loading its incident history or unused full Improvement proposals.
Current and resolved sources select the same complete comparison inputs, keeping
the original page, paths, rule, targets and supporting observations together.

All three current views select the newest recorded observation rather than the
latest identity-link time. A delayed historical materialization cannot replace a
newer observation's priority or choose a different source in incident detail.
Disposable PostgreSQL fixtures reproduce that disagreement, retain unproven
fixed rows and an older unbound failure behind recovered history, and preserve
263 simultaneously unresolved captures across batch boundaries. In the controlled
history fixture, the former overview presentation queries transfer 19,836,745
bytes; the current overview's finding reads transfer 634,554 bytes, with at most
128 source rows per query. Stored Flag rows remain unchanged. Exact historical
detail retains its proven recovery while omitting a large unused proposal.
These are local row and transfer measurements, not production latency, peak
memory, provider acceptance or sustained-monitoring guarantees.

Resolved history selects completed native recovery references and accepted
legacy verification references before loading diagnoses. The existing 50-incident
display limit applies after independent proof and deduplication, so repeated
source captures cannot hide a recently repaired longstanding incident. Candidate
and source reads use 128-row pages and continue beyond unproven references.
An older recovery for the same incident is evaluated only when its newer
reference cannot establish recovery. Independent incidents share compatible
evidence within each batch; one changed source cannot invalidate its peers.
Full presentation and editor guidance belong only to the selected sources.

Native recovery retains the existing per-condition comparator. Legacy accepted
outcomes retain the exact original Audit, Flag handoff, Site and completed parent
lineage. Verification completion supplies the recovery date. A missing completion
time stays unknown, including in proof detail; report creation and the owner's
earlier declaration cannot supply it. This does not change acceptance of an
otherwise established legacy recovery. After presentation loads, changed source
state, scope, conditions or incident membership refuses that read instead of
borrowing the previously selected proof.

Disposable PostgreSQL cases reproduce the former missing-input and history-limit
failures, retain actual affected paths and Outcome identity, cross a full page of
unproven references, reject foreign or missing evidence, and exercise a source
change between selection and presentation. Legacy history cases now exercise the
migrated database instead of relying on ORM mocks to honor its projections.
The controlled legacy fixture retains 7,000,000 characters of historical guidance
and proposals while transferring 2,438 bytes through the selected finding model
reads. Eight candidate incidents share one native proof read; a changed peer
stays unverified. These are scoped local query and transfer observations, not
production memory, latency or provider acceptance. Installed workers also retain
the signed-claim, default-uptime, independent repair and recurring-monitor loop.

Customer Flag actions and fix declarations retain an active account at each
transactional write boundary. The shared transaction entry point takes the User
lock before inherited worker Site and Audit authority, then the existing Site
and improvement ledger locks protect the source. Suspension or erasure after an
initial read cannot publish acceptance, rejection, handoff or a fix attempt.
Disposable PostgreSQL fixtures reproduce both late-account boundaries, observe
actual suspension lock waits, trace the inherited worker lock order, and retain
all original repair records. Restored-account retries preserve idempotency.
These are local authority and continuity proofs, not authentication-provider or
production acceptance.

Retained Site findings use the current active Site owner for repair identity,
declaration and Site-scoped parent admission. The original Audit creator remains
provenance, including a null creator after account erasure. Transfer cannot
reassign historical evidence or reuse the previous actor's keyed fix intent.
New verification belongs to the current owner and admits only that actor's scan
access grant. Previous worker executions retain their original authority fence;
report-only continuation retains creator authorization. Disposable PostgreSQL
fixtures cover unlinked and existing identities, erased creators, old-key
conflicts, foreign Sites and former owners. A native worker fixture verifies
grouped retained public captures, public-only collection despite a saved previous
owner grant, independent repair and subsequent Watch recurrence under the same
incident. Optional provider recovery expires with unavailable evidence in this
controlled fixture. These are local proofs, not provider or production acceptance.

Retained private report access now uses that same current Site ownership rule.
Report pages, status, screenshots, prompt capabilities and the retained MCP access
helper no longer treat original Audit authorship as present authority. A bounded
scalar lookup reads the stored attachment, Site owner, removal state, account
lifecycle and public visibility. Unattached reports retain their active creator
rule. Signed anonymous possession remains scoped to an unattached original
analysis. Explicit public reports and current share grants retain their existing
access without private Site memory or owner-only fix bodies.

Report permission precedes full graph loading, including progressive report
reads. Report and screenshot responses revalidate after evidence collection;
changed authority refuses the previously computed response. Owner history uses
current Site permission without filtering retained observations by their former
author, and receipt reads use the actual viewer. Pure ownership rules stay
separate from the live database resolver and are shared by prompt-capability
helpers, preserving the client/server boundary.

The legacy product-contract route delegates to one protected application action.
Active User, Site and Audit locks precede a fresh ownership and attachment check.
Report context, conditional attachment and Site memory commit together through
the existing intelligence writer. Context failure rolls back the whole action;
neither transfer nor original-author erasure changes historical authorship.
An unattached report resolves its owned target before taking the Audit lock.
Retained owner retries likewise request fresh ordinary admission as the current
Site actor, with a distinct key after transfer. Original responsibility and all
current grant, account, configuration and operator checks remain in force.

Disposable PostgreSQL fixtures use actual report projection and screenshot route
handlers to exercise transfer, creator erasure, denied graph loading, public and
revoked-share behavior, standalone claims, removal, suspension and authority
changes during evidence reads. Contract cases exercise atomic rollback and an
actual Site-lock wait through transfer. Focused retry contracts retain category
and diagnostic responsibility, actor identity and key separation. Installed
workers separately retain the signed claim, included uptime, independent repair,
recurrence and admitted grouped retry paths. These are local proofs, without
real authentication-provider, private-bucket or production acceptance.

Owner feedback uses the same protected finding action as Site repair. An
`already_fixed` assertion records readiness without hiding the observed failure
or certifying recovery. Rejection, the legacy ignored projection and intentional
context or accepted risk commit in one account and Site transaction through the
existing intelligence writer. A context-write failure rolls back the entire
decision. Current Site ownership governs retained feedback; former creators can
still vote without changing owner decisions. Legacy unattached reports retain
their original creator rule, with conditional attachment that cannot replace a
concurrent claim. Disposable database fixtures cover rollback, transfer, erasure,
preserved product context and attachment races. A native worker fixture keeps the
reported repair open after a comparable failed check and closes it only after
independent recovery, preserving both verification attempts. This is local proof.

A fresh repair declaration supersedes dismissal for its frozen selected sources
inside the existing active-account, Site and improvement transaction. Original
failure or recurrence returns to attention; an independently established prior
recovery stays recovered. The shared recovery comparator reads through that same
transaction, without a parallel recovery policy. A completed Audit pointer alone
cannot prove recovery, and unselected dismissed captures retain their decision.
A fresh unkeyed declaration after dismissal creates a new attempt rather than
reusing an older frozen draft. A keyed replay returns its original receipt before
these transitions, so an old repair request cannot undo a later dismissal.

Cycle events preserve the original assertion and observation time. Changed
actors, notes, outcomes or context append a deterministically keyed revision;
equivalent retries return the original event. Atomic database upserts retain one
receipt per assertion under concurrent retries. There is no schema migration or
second event store. Disposable PostgreSQL fixtures cover original receipts,
changed rejection notes, Site transfer, concurrent retries, frozen attempts,
exact selected scope and proven versus unproven recovery. Installed task workers
check unchanged failure followed by independent recovery both before and after
dismissal. These are local proofs.

The one-time `20261103230000_restore_declared_repair_attention` migration repairs
the earlier already-fixed action's unconditional ignored projection. Eligibility
requires an exact retained `user-decision` attempt, Flag handoff, source Audit,
selection and same-Site occurrence. A rejection status, timestamp, reason, note
or cycle event preserves the dismissal. The original occurrence kind restores
open, regressed or formerly fixed state; existing recovery pointers and all
source evidence, attempts and history stay unchanged. A formerly fixed source
still needs the existing independent proof, otherwise it remains unverified.

The migration takes candidate Site locks in deterministic order and rechecks
eligibility in a fresh statement after each lock. It cannot overwrite a dismissal
that commits while the correction waits. Reapplying it leaves corrected rows and
later explicit decisions unchanged. Disposable PostgreSQL fixtures exercise
retained pending and completed repairs, incompatible or foreign proofs, ambiguous
lineage, prior rejection, transfer, actor erasure and a real owner-lock wait.
Installed task workers admit the corrected retained attempt, preserve an unchanged
failure and close it only after independent recovery. This migration has been
applied only to disposable local databases in these checks. Ambiguous historical
decisions remain preserved and require fresh explicit owner action.

Accepted recovery uses one bounded scalar reader shared by current
sources, exact detail, resolved history and monitoring comparisons. Comparable
improved outcome, exact source, handoff, completed parent and same-Site conditions
remain required. A later repair declaration or recurrence can change incident
workflow without revoking its original source's independent certificate. Copied
drafts and the twelve-entry detail display cannot remove that certificate either.
Exact detail carries its selected proof reference directly; stored Flag pointers
remain unchanged. Candidate history references are rechecked against the recorded
attempt rather than reconstructing an accepted assertion from previously selected
metadata. Unknown recovery times remain unknown. Monitoring accepts a retained
certificate as prior recovery only when it completed before that observation.
The former attempt-history predicate and overview/summary draft reads have been
removed.

Snapshot-bearing attempts additionally use the shared native recovery reader
against the full live source Flag. An improved frozen subset cannot clear newly
appended observations. A valid native proof can restore the read projection when
an older writer omitted its lifecycle update. If a candidate cannot prove that
full scope, the scalar search continues to earlier eligible certificates without
loading frozen artifacts or imposing a display-history cutoff.

Frozen native selections may span several source Audits in the same Site.
Accepted proof follows that exact membership, with its parent attached to the
attempt's primary source Audit. Later peers cannot inherit the proof, including
peers on the same page. Current findings, exact detail, history and monitoring
share `loadAcceptedFlagRecoveries`; the former legacy-only helper is removed.
Disposable PostgreSQL checks cover compatibility and bounded transfer. Installed
workers establish recovery for a two-Audit selection, retain it when lifecycle
projections are missing, reject foreign source lineage and leave later peers
unresolved. Extending one source through native aggregation invalidates only
that source's earlier certificate. These are local proofs, not production proof.

Healthy follow-ups preserve established recovery pointers and do not emit the
same recovery again. Each still-unresolved peer retains its own proof decision;
an unproven fixed pointer can obtain its first valid recovery through a new
comparable observation. A published comparison also fences replay of its mutable
Flag projection, preserving state changed by later observations.

Unfinished diagnostic comparisons also distinguish their admission-time history
from current lifecycle state. A native recovery completed after admission cannot
establish earlier recurrence or replace that run's captured failure with a pass.
That accepted recovery nevertheless protects the live source from an older
projection. Prior eligible legacy certificates retain the same cutoff, including
an older certificate when a later one is outside the comparison window. Explicit
dismissals remain preserved and do not become recovery events.

Diagnostic comparison reads, proof evaluation and lifecycle updates share one
repeatable-read execution transaction. A concurrent source expansion, repair or
dismissal aborts an outdated write; the existing execution retry rereads the
entire comparison. It does not retry a precomputed update list. Already-correct
projections avoid writes, and changed sources are updated in stable identifier
order. Collection and comparison reuse the existing ledgers and ownership fence,
without an additional scheduler, projection store or Site-wide writer lock.
New failures own their own recurrence and severity projection; a still-failing
ancestor is no longer rewritten by every later failure. Historical comparison
also reconstructs an older writer's propagated regression from the actual parent
and severity instead of borrowing a later lifecycle state. Existing recorded
attention remains preserved until comparable recovery.

The retained fixture follows a proven source beyond twenty later drafts through
overview, exact detail, durable incident detail, history and notification facts,
while an unresolved peer and later recurrence remain current. Other cases cover
accepted unbound fingerprint scope, inconsistent membership, rejection of another
Site or parent, failed and incomparable checks, original regressed/ignored states
and more than one 200-source scalar batch. Stored repair artifacts are not read by
the certificate query. Installed native task workers exercise retained legacy
recurrence and growing source scope before and after verification, including a
missing lifecycle projection after a full native repair. PostgreSQL fixtures
exercise recovery chronology, per-source follow-up and published comparison
replay, plus real concurrent commits between comparison reads and writes.
These are local functional and transfer boundaries, not production
performance or provider acceptance.

Frozen repair sources retain every database Flag provenance, including `JOURNEY`
findings from Checkout. The snapshot cannot relabel a journey as deterministic or
refuse an otherwise authorized repair merely because it came from that collector.
A focused schema contract follows the database source enum and still refuses
unknown sources and duplicated captures. The native Checkout worker fixture
exercises fix declaration, independent repair and recurrence with optional media
storage unavailable. This is local application and worker proof.

Flag overview and detail reads use that frozen selection for active grouped
verification, including captures from earlier source Audits. A later or excluded
capture cannot inherit checking activity, even if it shares the representative
Audit. The latest actual verification, source-parent and Site checks, terminal
outcomes and finalization activity remain authoritative. This is a read projection
of the admitted repair, not a second execution status. The controlled grouped
worker fixture checks these views before fresh collection and independent repair.

Current verification is selected independently of copied repair drafts and the
12-entry detail history. A bounded scalar query selects the latest admitted
verification for each original Flag, using the verification Audit's creation
time, exact grouped membership or legacy source and Flag handoff, and the same
Site and parent guards. Additional drafts cannot hide checking or its completed
feedback. Exact historical Flag links retain their own observation date when a
later recurrence exists. This read creates no execution state and transfers no
source snapshots or task artifacts. Disposable PostgreSQL fixtures cover long
draft histories, actual admission order, interrupted finalization, grouped and
legacy scope, historical recurrence, and a retained two-megabyte source snapshot.

Site-agent conversation mutations retain the active original owner under short
User then Site row locks, replacing the former conversation-only advisory lock.
Admission, allowance binding, saved replies, completion, failure and recovery
share that boundary. Provider calls and usage settlement run outside those locks;
completion compares ownership again before publishing. History uses the shared
evidence-read guard, and selecting a Flag cannot adopt a replacement owner.
Changed permission preserves stored replies, refuses further publication, releases
unused reservations and still accounts for consumed provider work. Receipt replay
uses the stored response without rewriting completion time or creating another
assistant message. A pending reply already superseded by recovery cannot become
ready again. Disposable PostgreSQL scenarios cover transfer, removal, suspension,
concurrent admission, an actual row-lock wait, delayed history and reply commits,
and normal response replay with local provider doubles. These scenarios make no
external model calls and do not establish provider or production acceptance.

Site-agent evidence comes from the same current finding, repair-definition and
independent recovery readers used by the Site board and Flag detail. It no longer
loads twelve raw Improvements with their newest occurrence and copied attempt.
Confirmed unbound findings remain available before materialization, workflow
`VERIFIED` alone cannot certify recovery, and current recurrence takes precedence
over that incident's earlier recovery. Exact historical questions retain the
selected source Flag and its own proof. Repair ordering shares Site priority,
including a higher-priority finding that has no Improvement yet. Checking and
unavailable proof remain distinct from continued failure.

Deterministic answers use the complete current finding set. Open-ended model
requests receive at most twelve prioritized Flag records and twelve current
repair tasks, with explicit scope, counts, state, verification, page and recorded
time. A subset or completed execution cannot establish website health. Prompt
construction and allowance estimation share one input contract.
Deterministic answers carry their actual source Flag IDs into citations instead
of citing whichever records happen to be first in the context.
The native signed claim, default uptime, independent repair and scheduled
recurrence fixture checks
the agent alongside the existing Site, history, API and installed MCP facts,
including retained historical recovery. Those answers make no model calls.

Whole-Site conversation context also reads current uptime through
`loadUptimeStatus`. That owner-fenced reader shares the account-summary status
projection and `uptimeAssessment`, without loading probe samples, timelines or
incident counts. The default attention and next-step suggestions, and direct
availability questions, use deterministic recorded facts. A confirmed outage
precedes audit repairs; independent Flags remain available. Missing or stale
evidence, first-failure confirmation, pause, retargeting and unresolved incidents
retain distinct conclusions. Zero audit Flags cannot hide an incident or establish
whole-Site success. Exact historical Flag questions retain their captured scope.

Availability sources use the existing monitoring citation contract and the
existing uptime view. History rebuilds that destination under the owning Site;
untrusted URLs cannot grant access to another Site. Disposable database fixtures
cover these answers without a model, bounded reads and owner changes. The native
HTTP redirect and installed uptime-worker fixture checks the same answers through
first failure, confirmation, inconclusive redirects, independent recovery and
recurrence. This proves local collection and projection, not production uptime or
external provider acceptance.

Owned finding overviews, recommendations, resolved history and exact Flag detail
retain the authorized Site owner through the shared evidence-read boundary. The
active account, non-deleted Site and original owner are checked before collection
and again before returning multi-query results. Private repair captures use the
same boundary around storage reads, without holding database locks during that
I/O. Copy preparation and bundles pass the authorized Site record directly rather
than reloading identity by ID and adopting a replacement owner. A refused read
returns Site-not-found instead of private evidence or a misleading empty result.
The original provisional board keeps its single-Audit possession scope.
Disposable PostgreSQL fixtures reproduce transfer before and during finding
collection, transfer during an actual private-image read, account suspension,
deletion and Site removal. New-owner reads retain the original history and
grouped repair scope. These are local custody and continuity proofs, not live
storage-provider or external-editor acceptance.

Uptime history, summaries and incident events use the same retained-owner read
boundary. REST, MCP and the Site board pass their admitted Site scope instead of
only a project ID. A transfer, removal or account suspension during collection
withholds the result without changing probe or incident evidence. Provisional
possession cannot expand into project monitoring history. Disposable PostgreSQL
fixtures check each reader across those changes and confirm that the current
owner can still read the original observations and open incident. This establishes
local read authority and continuity, not production monitoring availability.

Recorded check pages (including counted database snapshots), monitoring history,
Outcome summaries and details retain that same owner throughout their collection.
The composed Site view rechecks after its independent reads settle, including a
delayed supplied connection projection. A transfer cannot release a previously
collected private view. Current-owner reads keep the same receipts, audit history
and Outcome identities. These read guards do not lock long database snapshots,
change stored observations or authorize writes. Disposable PostgreSQL fixtures
reproduce transfer during each projection and check the current owner's retained
evidence after refusal.

Run results retain the same active owner before and after result assembly,
including dependent account-check observations. The HTTP reader binds the run
to the admitted canonical Site, and both HTTP and MCP refuse a retained run
whose source Audit belongs to another Site. Disposable PostgreSQL fixtures
reproduce transfer, removal and suspension after the initial run snapshot and
during account evidence collection. Refusal preserves requests, source tasks and
history for the current authorized owner. These are local read-authority proofs.

Live projection notices retain the owner through the same read boundary, in
addition to the stream's existing per-poll session check. A transfer during the
event query closes the stream without publishing the collected notice. The
current owner can replay that original committed notice using the existing
Site-scoped cursor; no event or monitoring history is rewritten.

Account website and notification summaries revalidate the originally selected
Sites in one final owner-and-lifecycle batch. A transferred or removed Site is
omitted while unrelated owned Sites stay visible; an inactive account receives
no private summaries. This preserves the constant query count as an account
grows, without loading full Site views or deleting historical evidence. Local
database cases reproduce transfer, removal and suspension during both summary
reads and confirm access for the current active owner.

The grouped-worker fixture also exercises the ordinary owner retry of an expired
queued verification. Controlled source Flags come from the shared header detector;
the retry collects fresh HTTP evidence through the installed task workers. It
retains both frozen source captures after a later observation joins the incident,
resolves only those original captures, leaves the later observation visibly open,
and replays the completed retry without changing the failed Audit or request.
This proves the local queued-expiry boundary, not interruption during an active
browser task or production recovery timing. Reproduce the focused case with
`node scripts/verify-progressive-execution.mjs --only lib/sites/application/__tests__/grouped-flag-verification.integration.test.ts -t 'retries an expired grouped'`.

`get_flag` returns its exact source Flag identity, check, lifecycle status,
verification state, affected paths and stored recovery rule from the shared Site
projection. Tool errors remain failed interactions even when their JSON-RPC
transport succeeds; a successful inconclusive observation is a separate fact.
The `follows authenticated MCP repair handoffs` fixture exercises the actual
stateless HTTP handler, hashed scoped credentials, database and worker, including
read-only write refusal, cross-owner privacy, completed replay and revocation.
This establishes local protocol behavior, not acceptance by a live editor or
external MCP client.

CLI device login uses the existing developer-key account lock and limit. Approval
and denial serialize on the device code, so a competing decision cannot leave an
orphan key or overwrite approval. Only an approved, uncollected credential belongs
to device-code expiry; collecting the credential transfers its lifetime to the
scoped developer key. Expired-code polling and bounded cleanup use the same
conditional revocation transaction. Starting another login therefore cannot
revoke an earlier collected key. Unreadable encrypted credentials retain their
one-use grant for retry. Disposable database fixtures exercise expiry, cleanup,
concurrent decisions and key limits, inactive owners, and collection through the
token handler. They establish local behavior, not production or external CLI
acceptance.

The `20261012060000_fix_attempt_commit_reference` migration persists commit references, freezes keyed or admitted repair intent in PostgreSQL, and removes the older constraint limiting a source to one pending repair. Distinct repairs may coexist while an earlier verifier runs. The database protects source, builder, handoff, references, description and request identity after freezing. Legacy unkeyed, unadmitted drafts retain guarded preparation updates. Native conflict-safe materialization preserves existing Improvement and occurrence history under concurrent first-fix requests.

Reconciliation selects the attempt named by a targeted run, rather than whichever pending repair happens to be newest. Recording and projection share an Improvement lock. A result updates its attempt and original incident proof; only the latest repair updates the Improvement's current verification status. The original Flag's first confirmed resolution remains intact. Board and detail show checking only for an admitted, unfinished verification of the current source scope in the same Site, including interrupted finalization. History evaluates each attempt's own admitted scope. A readiness record alone does not establish checking.

Verification resolves the repair's recorded source Flag and Audit within the owned
Site, even after monitoring adds a newer occurrence to its durable Improvement.
An exact raw Flag link cannot use another occurrence's attempt. Completed replay
validates the same recorded source and execution target; an explicit attempt also
retains its derived request key when the caller omits one. Historical attempts
without a Flag reference remain usable only while their source still matches.
A successful exact repair keeps its `IMPROVED` receipt while other open occurrences
keep the grouped Improvement proposed and visible. Both changes are verified by
the `verifies the frozen repair scope` worker fixture with migrated disposable
PostgreSQL and isolated Redis, rather than production observation.

Web fix actions use the physical Flag shown in the current projection, separately
from its grouped incident navigation link. The same identity survives card
refreshes. Copying or starting verification from retained evidence therefore
cannot silently switch to an occurrence discovered after rendering. Verification
responses preserve the addressed Flag identity on admission and replay, so the
client can recognize an accepted check. Individual and category fix prompts
retain every affected page in a collapsed observation. The frozen-source worker
fixture covers both a prior MCP repair intent and a web repair recorded from an
older displayed capture after monitoring advances.

Scoped repair comparison combines independently qualified original observations
with one shared rule: a comparable failure disproves repair even when another
original comparison is unavailable. Passing still requires every original scope.
The failed proof retains the evidence gap in its observation and cites only the
tasks actually compared. It does not mark the underlying incomplete module
complete. Whole-cohort input sizing and aggregate resource receipts retain their
membership requirements because their summary cannot attribute a failure to an
unmatched original member. Explicit verification and automatic recovery use the
same comparator. Controlled HTTP, disposable database, queue and worker fixtures
exercise failed, inconclusive and fully repaired header states. These establish
local behavior, not production acceptance.

Incremental finding publication reads the changed check's complete overlap
family, including its grouped page observations, instead of reconstructing every
unrelated responsibility after each task. The family derives from the existing
suppression policy. Original task and continuation receipts remain authoritative;
final report compilation still reads their complete union. Existing related
Flags retain their positions, and new findings append without rewriting unrelated
rows. Authoritative writes select only matching identities and do not reload
prior supporting evidence that the projection already supplies. A disposable
PostgreSQL fixture retains 1,600 unrelated observations while its finding-ledger
read transfers under 4 KB and leaves the unrelated Flag unchanged. Mutation
responses project only the identifiers needed by their caller instead of
returning report bodies, guidance or the entire Audit. Alias, multi-page
suppression, customer feedback and historical-evidence fixtures cover the same
projection path. These are local workload observations, not production throughput
or latency measurements.

Explicit repair certification selects each original Flag directly through its
pending repair relation, in stable batches of 500. It does not truncate attempts
or linked occurrences, and multiple attempts do not duplicate the same source
Flag. Contextual comparison reads all matching module observations in stable
batches of 128. PostgreSQL projects only the original comparison contexts and
their registered assertion families, including nested control scopes, slow
capture identities and comparable console windows. The existing comparator still
decides completeness, comparability and recovery. Unrelated assertions and
collector diagnostics do not enter this transaction. Disposable PostgreSQL
fixtures cover 330 observations, 501 attempts and 601 original occurrences,
including late failures, missing evidence, changed methods and exact source
selection. Their measured transfer reduction is fixture evidence, not production
resource or latency proof.

After a successful targeted diagnostic repair, reconciliation visits all eligible
earlier captures of the same incident in stable batches of 100. There is no total
capture cutoff. The shared recorded-evidence comparator must establish recovery
for each capture; unobserved pages and unavailable conditions remain open without
blocking later comparable captures. Findings created after verification began
remain outside this recovery. The attempt outcome, capture updates and incident
status share the existing transaction. Disposable PostgreSQL fixtures reproduce
the former 100-of-320 cutoff, prove complete recovery, preserve independent gaps
and later captures, and verify settled replay and concurrent result custody.

Automatic recovery reads completed receipts for the missing Flags' related
responsibilities in stable batches of 512, without a total row cutoff. The
comparison receives every selected receipt, so a late positive observation can
establish recovery and a later comparable failure still prevents it. Unreadable
rows establish nothing. The native grouped-form fixture places 1,201 unreadable
rows before the real monitoring observation and verifies that the regressed Flag
recovers. Focused comparison tests cover late passing, failed and missing proof.
These are local fixtures, not production volume measurements.

Scheduled care can share a compatible manual execution while preserving its
original trigger, request source, billing policy and observation identity.
Monitoring classification and alert readers recognize the committed schedule
context together with its registered Watch key. Provider admission rechecks
that exact validated context, key, Site and current owner. A schedule-shaped
caller context is insufficient. The existing notification retry queue also
discovers completed shared executions that were projected before their schedule
attached. Missing classification is retried without spending a provider attempt;
sustained gaps remain visible to operations. No second delivery ledger or
schedule engine is introduced.
Retry selection keeps native Watch work and committed shared receipts in
separate query branches, applying ownership before the final limit. An additive
concurrent partial index serves the shared receipt cohort. In the disposable
10,000-row manual-history fixture, the empty sweep inspected one Audit instead
of 10,001. The stored history remained intact; this is a query-plan observation,
not a production throughput measurement.
Disposable database fixtures cover immediate and deferred classification,
controlled provider acceptance and refusal, owner-visible delivery state,
operational counts and authority removal before a send. An opt-in compiled
fixture uses a real local HTTP 503, ordinary API admission and native Outcome
assessment, then lets the worker's notification timer send through the installed
mail SDK to a loopback endpoint. Run with current compiled web and worker
artifacts using
`COMPILED_SHARED_WATCH_REQUIRED=true node scripts/verify-progressive-execution.mjs --only worker/__tests__/compiled-runtime.integration.test.ts -t 'delivers a scheduled alert from shared manual work'`.
This local evidence does not establish real-provider acceptance, inbox delivery
or an unattended production cadence.

Monitoring comparison retains the strongest result across original page rows
that share one Flag identity. A recurrence or severity increase cannot disappear
because an unchanged page was read first. Status projection and the recorded
summary both consider those original conditions. Disposable PostgreSQL fixtures
exercise retained per-page observations, preserve completed recoveries and
confirm that the resulting Watch alert remains eligible when a later recovery
changes the mutable Flag. They do not send a provider notification.

Repair reconciliation reads the physical verification receipts and selects only
check, module and AI verdict namespaces. It does not load scheduling diagnostics
or full per-control collector journals through the historical composition view.
A disposable database fixture retains a 2 MB collector journal and 100 KB task
diagnostic while the real reconciliation read stays below 4 KB and retains all
three verdict namespaces. Historical verdicts and collector evidence remain
stored unchanged.

Flag detail, current attention and Site summaries distinguish the Improvement's
repair workflow from each captured occurrence. A legacy `VERIFIED` workflow can
close an unchanged `OPEN` row only through a comparable `IMPROVED` attempt for
that source Audit and, when recorded, that exact Flag. Its verification Audit
must be completed, belong to the same Site and retain the original source as its
parent. Newer unresolved occurrences remain visible. Resolved history limits
affected pages to the recovered source and links its physical Flag, so opening
proof cannot redirect to a newer problem in the grouped incident.

Slow connection checks share a registered `slow-replay` collector and module
receipt. Its own mobile capture runs independently of ordinary browser evidence;
targeted verification schedules only that collector and finalization. Sampling
and the 2, 5 and 8 second screenshots start with navigation,
under the recorded mobile viewport, user agent, network throttle and public
read-only request policy. Each capture records its requested time, actual start,
frame completion and upload completion. Content means visible viewport text or a
decoded main image. Unclassified graphics, navigation restrictions, bounded
sampling gaps and unavailable navigation do not establish a blank page or a
repair. The ten second observation never becomes a claimed thirty second delay.
Content and action assertions retain their independent completeness.

Action repair compares the originally observed name, destination, page and
capture profile. An unrelated early action cannot close a delayed action, while
a DOM path rename retains comparable action evidence and its actual new path.
The version-two repair scope reuses the native capture's original target, final
URL, browser/request-policy profile and access identity alongside the recorded
network throttle. Content and action targets retain that hashed scope, without
storing access headers or credentials. Control lookup projects the original
name and destination for measurement; proof separately compares the current
capture, so changed access cannot inherit the source's comparison identity.
An original-source URL hash keeps action lookup attached to the admitted target
when a client redirect changes the document URL.
Ordinary care retains the repaired action even when an unrelated action becomes
visible earlier. Repeated captures of the same name and destination consume one
sample position. The collector still bounds each native observation to 20 original
actions. Progressive execution continues through a larger retained cohort before
finalization. An interrupted or exhausted cohort keeps its earlier observations
and incomplete remaining coverage. Direct collector calls that exceed the sample
bound remain explicitly incomplete; independent measured failures remain actionable.
Historical timing observations without capture conditions remain readable and
can still describe their measured failure, but cannot certify comparable repair.
Multiple original page scopes require conclusive receipts from the same Run for
both explicit verification and automatic recovery. The collector retains the
admitted target as the finding and receipt URL after redirects.
Ordinary page capture cannot supply slow connection provenance. A successful
targeted repair resolves older equivalent deterministic occurrences with positive
source evidence, preserving other controls, pages and failures created after the
verification began. The `collects faithful slow connection timing` disposable
worker fixture exercises a client redirect, blocked navigation, changed-access uncertainty for both
responsibilities, a competing action, independent public-condition repairs,
occurrence recovery and subsequent monitoring recurrence. These are
local simulated observations, not deployed or real-device performance proof.

`FIX_INTENTS_DB_REQUIRED=true node scripts/verify-progressive-execution.mjs -t "immutable fix intents"` exercises concurrent first-fix recording, database immutability, distinct later repairs, exact worker reconciliation, completed replay and changed-payload refusal in migrated disposable PostgreSQL and isolated Redis. This local fixture does not establish deployed migration, production queue or external-provider behavior.

Targeted Outcome recovery consumes a completed assessment from the exact tenant RunRequest, attempt, source Audit and Outcome. Required binding keys, environment and recorded scope must match the failure, with positive execution evidence. Reconciliation projects those assessments before issuing the fix verdict. Missing, blocked, changed or unrelated scope remains inconclusive. Optional PageSpeed gaps do not invalidate a completed Checkout binding; legacy report comparisons keep their existing full-review coverage rules. A failed Outcome cannot resolve its Flag merely because a particular diagnostic row disappeared.

Account board and notification summaries likewise select current membership
before loading supporting observations. Historical rows retain the metadata
needed for scope, path counts and lifecycle selection. Only fixed rows needing
recovery comparison receive private rule and target inputs; current findings
receive their supporting evidence in a separate account-wide batch. These reads
use the existing recovery and customer-Flag rules. Missing selected evidence
leaves coverage incomplete rather than certifying a clear result. Legacy unbound
findings use their complete recorded affected-path count for priority, matching
the Site view. A controlled 120-capture bound-history fixture reduced transferred
finding data from 576,320 to 51,580 bytes while preserving all history and current
Flag counts. The unbound fixture transferred 56,353 bytes and retained the same
multi-path priority. Real PostgreSQL fixtures also exercise private recovery
comparison, removal of its proof, and summary delivery claims. These are local
read-workload and projection observations, not production latency measurements.

Owned Site finding reads select incident representatives before loading their
editor prompts. Historical and unbound observations still supply original scope,
readability and recovery evidence; only selected representatives load the current
editor tasks and their source Audit's guidance state. Both reads retain the Site
boundary. This removes discarded historical prompts without capping observations,
affected pages or available history. Disposable database fixtures retain 120
synthetic observations and all 24 affected pages while preserving editor-only
guidance. For the measured finding queries, transferred data fell from about
2.6 MB to 74–80 KB. Those are local query-result measurements, not browser payload
sizes or production latency guarantees. Stored prompts remain unchanged.

Recovery reads for Site findings, account summaries and report comparisons share
one receipt selector. It includes every check in the original supporting
observations, with current and historical Search receipt locations. Selection is
bounded by 64 source runs and 512 receipt rows per query, without truncating the
matching history. Current findings combine incident and unbound sources before
reading proofs. Unrelated module payloads are not loaded, and each original
condition still requires its own comparable recovery. Outcome recovery retains
its committed incident certificate and tenant boundary. Disposable database
fixtures cover 65 recovery sources, an opposing observation after 600 matching
receipts, repaired evidence and refusal of another Site's proof. These establish
local read behavior, not production latency or provider acceptance.

## Local objective verification, 2026-10-26

This is a local engineering evidence snapshot. It does not attest a deployed
revision, real-provider acceptance, external-client acceptance or sustained live
monitoring. The objective's six completion criteria were checked as follows.

1. **URL-first monitoring and repair.** The native
   `claimed-monitoring.integration.test.ts` path exercises signed anonymous
   claim, retained Site and evidence identity, default uptime, owner views,
   independent repair and recurrence. Scheduling, completion and uptime database
   fixtures separately exercise interruptions, explicit pause, restoration,
   restored schedule permission and incident continuity. The compiled-runtime
   fixture adds actual authenticated HTTP admission and repair through the built
   web process and compiled worker under an ordinary owner account. Replayed
   verification retains the original attempt and execution.
2. **The complete current catalog.** `advertised-coverage.ts` maps all 108
   catalog responsibilities: 80 public, seven uptime, and 21 requiring provider
   or authorized lifecycle evidence. `catalog-evidence.test.ts` invokes real
   evaluators for every required local scenario. Comparable repair requires
   positive certified evidence for every returned facet; recurrence retains its
   original failure identity. Native HTTP, Chromium and worker scenarios provide
   separate collection and integration evidence. Heuristics, rolling field data
   and provider context retain their narrower observation semantics. The six
   Search Console and Analytics responsibilities remain explicitly marked
   coming soon by the existing release policy.
3. **Consistent facts and authority.** Current core contracts passed across
   Sites, audit execution, uptime, integrations, CLI and MCP. Disposable database
   and native transport fixtures cover tenant ownership, credential custody,
   authorization revision, exact source scope, notification selection and
   independent verification. The compiled HTTP fixture validates the client Site
   and Flag schemas, the durable issue/source-occurrence relationship, and the
   fixed state recorded by the worker. Missing evidence cannot certify repair.
4. **Shared execution foundations.** Normal admission uses the durable request
   and task ledger. Current and compatibility adapters share registered check
   evaluators and comparison policies. Claims, writes, lease renewal and resource
   cancellation share execution authority. Browser, parser, HTTP and provider
   work remain independently bounded, with capacity retained until physical work
   ends. Default setup and permitted schedule recovery share bounded upkeep;
   cleanup reconciles exact unsettled operations instead of inventing success.
   Module-boundary and product-contract guards passed.
5. **The existing customer experience.** Site component checks and claim,
   navigation and refresh hook checks passed. The compiled HTTP fixture validates
   the same projection consumed by those surfaces. Monitoring intent and
   operational errors remain separate. No additional dashboard, metric surface,
   branding or homepage presentation was introduced for this work. Component
   checks do not establish physical-device rendering or external usability proof.
6. **Integrated local execution.** Full migrations and schema drift checks pass
   in disposable PostgreSQL. Representative queue, worker, native HTTP/browser,
   recovery and authorization scenarios pass on isolated services. Both web and
   worker production builds pass. The compiled web/worker/parser fixture passes
   with external provider credentials disabled. Typechecking and focused lint
   pass. The latest core run passed 4,364 tests; gated database/native
   scenarios are accounted for by their separate executions, not counted as
   passing merely because a unit run skipped them.

### Remaining provider and production verification

- Real PageSpeed acceptance, quota behavior and returned measurements remain
  unverified. Current primary Lighthouse formats were reviewed independently of
  the local provider-response fixtures. A configured key is not provider proof.
- Search Console and Analytics need configured OAuth clients, an authorized
  matching validation property, actual consent/refresh/reporting evidence and
  validation before their existing customer release gates can change. Local
  fixtures establish contracts and custody, not live Google acceptance.
- Live automatic account and Safe Signup proof still requires an explicitly
  authorized controlled target, actual receiving-event processing, reversible
  lifecycle and exact cleanup. Production automatic-account enablement remains
  gated. Site Login and Password Reset remain outside the current supported
  execution set.
- Private storage needs real object write/read/delete and tenant-isolation proof.
  Notification delivery needs an authorized validation mailbox, confirmed provider
  acceptance and receiving evidence. Local SDK/socket fixtures do not prove
  provider acceptance or inbox delivery.
- Deployed migrations, web and worker revision agreement, the Linux container
  runtime, naturally scheduled monitoring and extended incident/recurrence
  observation require their own evidence. Nothing in this snapshot establishes
  production readiness, sustained capacity or the separate paid-opening window.
- Real external agent/client sessions retain a separate acceptance boundary from
  the locally verified CLI and MCP protocols. Existing planned integrations,
  repository execution and paid opening were not activated by these checks.

No deployment, live customer mutation, real notification delivery, production
feature activation or credential-bearing provider request was performed for
these local verification steps.


## Claim identity and customer-loop checkpoint, 2026-10-27

This is the October 27 local checkpoint. The [current completion plan](product-masterplan.md#current-completion-plan-2026-10-28) records the later deployment, retained-row preservation, current runtime observation and remaining provider, experience and recovery requirements.

- `ensureOwnedFlagIdentities` is the shared identity writer for claim and first repair. The claim transaction publishes current native observations before ownership/defaults become visible. Bounded conflict-safe inserts preserve existing proposals, verification decisions and event metadata. Claim replay creates no customer action and truncates no observations.
- Finding materialization, repair declarations, verification and legacy identity adoption share `lockImprovementLedger` on the durable Improvement ID. Materialization initializes a missing identity with a conflict-safe insert, takes that lock before updating an existing row, and re-reads its exact source observations. Resolved or dismissed attention cannot reopen a verified Improvement or replace its recovery criteria from a delayed snapshot. An unreferenced provisional identity is discarded within the same transaction. PostgreSQL race fixtures exercise delayed source reads and both commit orders, observe the actual advisory wait, preserve independent recovery, and require no lock retry. Rollback and recurrence keep the existing occurrence and cycle contracts.
- Current customer acceptance/rejection/handoff and identity publication share a Site row lock and transaction. A transfer or removal settles before authority is rechecked; an already-linked observation cannot skip that boundary. Independent source occurrence links remain historical resources.
- Shared Site reads and Flag detail caches retain their actual viewer/scope lifetime. Single and bundle controls share physical clipboard and acknowledgement behavior. The Outcome route observes the same composed live resource instead of refreshing only at admission.
- Server-generated task, evidence and protocol URLs use the configured Node runtime origin. A compiled regression caught build-time public-URL inlining; final browser checks prove both copied reference prefixes and the authenticated original-report lookup.

Final controlled browser evidence: `test-results/browser/site-plan-compiled-worker-32f9ac9b-87d5-4388-b8a0-221fe610c464/`. Final Linux evidence: `test-results/runtime/site-plan-linux-04f93b62/`. The latter supersedes the October 26 snapshot's untested local Linux boundary for the exercised native repair/migration/fixture-restore scope only. Neither establishes provider acceptance, real public URL entry, email delivery, production restore compatibility, sustained natural monitoring or a frozen/deployed release candidate. The current contrast exception remains explicitly accepted, and full-AA claims remain false.
