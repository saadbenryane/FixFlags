---
status: canonical
authority: architecture
reviewed_at: 2026-10-12
supersedes: []
---

# Audit pipeline

Canonical reference for the FixFlags scan pipeline: stages, AI phases, degradation, recovery, and debugging.

## Progressive execution candidate

New admissions snapshot `ExecutionSpec` with `engine: progressive-v1` on the existing
Audit ledger. This describes the local implementation candidate, not deployed or
release-accepted behavior. Historical Audits retain the legacy adapter below.

Owned manual category rechecks use the same admission and progressive task ledger.
`scope: category` selects Search, Performance, Conversion, Security, Tracking or
Accessibility through one `area`. Admission freezes the latest completed full-site
inventory in the requested environment. Each required page, collector, evaluator
and interaction remains an obligation of that execution. Pages uses a full-site
check; availability retains its existing Outcome execution. A category does not
become the latest full-site analysis or certify unrelated repairs.

Category finalization records deterministic evidence without requiring screenshots
or an AI summary. Shared collectors commit only admitted findings and repair
assertions. Comparisons preserve the preceding category attempt and original
full-site observations, including recommendations without an Improvement.
The board, website list and check results request category evidence for the exact
owned broad-analysis ID they are presenting. Selection matches its environment
before reducing each category to its latest attempt. A newer recheck of another
inventory, including a retained retry, cannot hide the relevant attempt and
restore an older healthy answer. Independent account reads remain batched.
Failed, missing or unfinished required work cannot reuse an older passing answer.
API, MCP and category history use the immutable comparison and shared assessment.
History also reads each finding's recorded Search attention policy when deriving
its Flag count and links. A current indexing regression cannot become a legacy
observation merely because the history query omitted that policy. The controlled
Google worker fixture checks agreement with current Site Flags and run results,
retains the original history after independent repair, and checks recurrence.
Provider responses in this fixture are simulated; this does not establish live
Google acceptance.
Local worker acceptance covers Search rechecks, Security repair and recurrence;
live-provider and production acceptance remain separate requirements.

Site and category page responsibility share `sites/page-coverage.ts`. The recorded
scope includes admitted pages, actual page observations and discovered browser
task intent. A collector interrupted before creating an AuditPage leaves that
page in the denominator and in the next admitted monitoring or category cohort,
even after its navigation link disappears. Admission retains the existing URL
eligibility and page budget. Overview, account list, run results, category coverage
and monitoring history use the same completeness calculation. Counts do not
fabricate a page observation or a collection time for an uncollected URL.
The disposable worker fixture reproduces both a newly discovered page and a
previously retained page with neither collector able to create its row. It checks
the current customer views, subsequent scheduled collection, category repair and
recurrence. These are local execution results, not production monitoring proof.

Broad source selection belongs to the owned Site and requested environment,
rather than an exact match with its configured entry URL. The latest admitted
broad scope supplies Site cohort priority, independently of collection status.
Category rechecks retain their latest completed source as the comparison anchor.
`sites/application/monitoring-responsibility.ts` combines earlier admitted broad
entries, native page rows, planned browser URLs and valid frozen monitoring page
intent. A later independent claim cannot retire an earlier branch by becoming
the newest report. Responsibility also survives collection failure and signup
before the original analysis finishes. These are obligations to check, never
successful observations or permission to reuse an old conclusion.

`sites/application/analysis-scope.ts` owns environment provenance for source
selection, scheduled freshness, comparison and diagnostic recovery history.
An Audit's explicit environment is authoritative. If that field is absent or
null, its RunRequests must agree on their typed environment and any frozen
environment. Conflicting or malformed records cannot establish context. Only
history without any RunRequest retains the legacy production default. The SQL
projection and ORM selection have independent native database parity checks.

The default Site overview, account summary, current check results and broad trend
select production evidence through one shared selector. A newer staging analysis
cannot replace that source, including while active or failed, or through a legacy
RunRequest snapshot. Conflicting legacy environment records establish no current
source. Explicit run reads and activity history retain those analyses under
their original identity and conclusions. This changes source selection, not the
meaning or authorization of an explicitly configured Outcome.

Legacy broad RunRequest snapshots also supply retained page and behavior intent
when the original Audit has no scope snapshot. Missing environment is resolved
in the read projection; the original records remain unchanged. New execution
rebuilds current checks, bindings and authorization rather than copying them.
Flag verification automatically inherits its original attempt's source
environment. Replay checks both the recorded verifier and original source,
including after the durable issue advances to a later occurrence. Production
observations cannot close a legacy staging incident. This adds no environment
choice to the customer workflow, storage table or execution queue.

The ledger reader projects and deduplicates scope in PostgreSQL and transfers
bounded batches. It skips history when the current compatible cohort fills the
existing page budget. Rejected URLs do not consume that budget. Tenant, broad
intent and environment constrain the source query; existing public URL rules
still constrain every selected destination. Historical monitoring intent decodes
independently of unrelated binding configuration. New executions rebuild their
own current check and binding contracts. Claiming does not rewrite the original
specification, page observations or completion time. A URL-first analysis can
start on a pricing page while the claimed Site remains configured at its origin.

Broad and category admission freeze `monitoringBehaviors`, the selected page
and public-behavior pairs already admitted for continuing care. Public action,
pricing navigation, slow replay and journeys remain distinct. The shared
`publicPageBehaviors` policy supplies both the new execution snapshot and the
task graph. A category admitted before its first task rows therefore retains its
new responsibility. A later Watch keeps a discovered-page action without adding
unrelated slow replay or journeys to that page. Existing entry-role snapshots
remain supported by the historical decoder; new admission no longer writes them.

`sites/application/monitoring-responsibility.ts` combines broad entry intent,
recorded broad and category task scope, and compatible frozen behavior scope.
Failed and unfinished tasks remain obligations, not proof that a check passed.
Targeted verification and privileged binding task history cannot expand this
public-behavior cohort. Current tenant, environment, URL eligibility, page budget
and access admission still apply. The entry-only history reader was replaced,
and no separate care table, queue or customer setting was introduced. Derived
selection does not change command or retry identity. Site-wide bindings remain
once per Outcome, independently of the number of behavior pages.

Journey selection receives the page's own committed metadata. It no longer
rereads primary-page HTML metadata for a retained entry. Evaluator usage updates
include the original entry URL, and walkthrough timeline reads and merges share
the existing execution fence so independent entry tasks cannot lose each other's
observations. A local signed-claim worker fixture exercises an original entry
interaction and walkthrough under a root Watch, unchanged and improved repair,
and recurrence. Retained slow-replay admission is separately covered by the graph
contract; this fixture does not establish its native execution or production care.

Page and behavior history share a partial index over admitted `task:` rows,
keyed by Audit ID and work kind. Browser, flow, slow replay and journey selection
can avoid unrelated evaluator and receipt history. URLs stay outside the key so
long admitted navigation values cannot introduce a B-tree tuple-width failure.
Two separate concurrent migration statements create the shared index and retire
the older browser-only index. The populated disposable fixture confirms that
another write can commit while the build waits for an existing writer. Its
24,001 synthetic rows yield about 400 examined browser rows and 800 behavior
rows, rather than 24,000 behavior-query row visits before the index. These are
bounded workload and migration proofs, not 24,001 actual checks, a latency
promise or deployed database acceptance.

Full-review planning distinguishes an admitted navigation from a discovery
group. `navigationDestinationKey` retains the supplied path, trailing slash,
query ordering and values, host and fragment conditions. Explicit retained
navigations do not merge merely because discovery considers their inventory
keys equivalent. Newly discovered candidates keep their existing grouping,
importance order, plan depth and ceiling. The progressive coordinator and
compatibility runner compare actual planned navigation identities when deciding
whether a page has already run. The progressive initial graph already seeds
frozen retained URLs independently. Planner truncation now compares eligible
and selected navigations from that same selection pass, without a second scope
reconstruction.

URL admission uses `normalizeAuditNavigationUrl` and
`assertPublicNavigationUrl` for a supplied browser destination. The shared
public URL parser retains fragment state while keeping protocol, credential,
hostname, DNS and public-address checks. `normalizeAuditUrl` and
`assertPublicAuditUrl` retain their HTTP-document role, excluding fragments
from transport. Basic HTTP uptime and hook requests keep that document scope.
This follows the distinction between client-side fragment interpretation and
resource retrieval in [RFC 3986 section 3.5](https://www.rfc-editor.org/rfc/rfc3986#section-3.5).

The shared URL form trims surrounding whitespace and supplies HTTPS when no
scheme is present. It preserves the remainder of the customer's destination,
including trailing path slashes, query values and fragment routes. Removing
slashes from the entire string changed those destinations before server
admission. Post-signup resume uses the same submission path, retains the
canonical root slash and starts the handed-off URL once across remounts.

An explicitly admitted absolute fragment route remains eligible when another
state on the same document becomes the next target. Discovery still excludes
section-only candidates according to its existing bounded policy. Observed
SitePage identities, Outcome targets and inferred purchase starts retain their
full browser URL. Authorized Safe Form targets require that same navigation;
a different fragment cannot inherit fixture consent. Reset and cleanup hooks
retain their existing HTTP endpoints and authorization rules.

Progressive finalization settles page lifecycle independently of optional AI,
screenshots and performance measurements. A matching committed browser artifact
with parsed metadata completes its own active page row; HTTP-only metadata,
uncommitted collection or a different page identity cannot establish collection
success. For collected rows, unknown completeness becomes partial, and known
completeness remains unchanged. Remaining active rows settle as unavailable collection. Existing
terminal pages and source artifacts remain intact. Site, category, diagnostic,
replayed completion and exhausted finalization use this same settlement instead
of the former category-only completion loop.

Current Site overview and account-list evidence share
`sites/application/current-evidence.ts`. It selects the latest broad attempt,
retains prior observations during interruption, applies category evidence against
the same baseline and uses current active findings. The readers no longer prepare
coverage independently. Prior-observation reads omit comparison snapshots and
full task artifacts they do not consume.

A completed progressive analysis can still be publishing its findings. Its
comparison receipt must match the Audit and its original parent before current
views can report Clear. Category evidence uses the same publication boundary.
Missing or invalid publication remains inconclusive without hiding known Flags
or discarding collected observations. Historical run and monitoring conclusions
use the immutable comparison, original scope and evidence at completion, so later
repairs affect current attention without rewriting the earlier verdict. A
disposable PostgreSQL fixture reproduces the former API/overview disagreement,
checks missing and mismatched publication across the overview, list, API and
history, then verifies recovery after a matching receipt appears. Reads leave
the Audit and findings unchanged. This establishes local projection behavior,
not collection or production-provider acceptance.

New progressive Site and category publications also freeze their Site conclusion
inside the existing comparison receipt. Its versioned descriptor retains required
areas, completeness, gaps, observation and validity times, and a hash of the exact
admitted specification. Customer Flag membership references the comparison's
immutable entries, retaining their original wording without copying source
evidence into another store. `sites/application/recorded-assessment.ts` now owns
the shared interpretation for run APIs and monitoring history, replacing their
separate broad and category preparation.

Historical conclusions do not consult later detector or attention policy. Current
Site overview and account-list assurance still require evidence compatible with
current policy. Run reads can expose expiry against the original deadline;
history evaluates the published conclusion at its original completion time.
Invalid or mismatched conclusion data withholds a successful historical answer
without concealing valid comparison findings. Existing comparisons without this
descriptor retain their legacy evidence interpretation. Reads never backfill an
original conclusion or rewrite a publication whose policy was not recorded.
Local database cases exercise both Site and category detector upgrades and later
corrections to mutable Flag rows. The worker fixture separately exercises signed
claiming, default uptime, independent repair and recurrence through seven runs.
Provider and deployed-state verification remain separate.

Stored supporting observations must satisfy their private source contract.
Reduced Site and comparison projections retain a server-derived unreadability
marker without copying the private payload. A public observation summary cannot
supply missing private verification rules or provenance. Important unreadable
observations withhold both confirmed attention and a healthy conclusion across
current views, run publication, history and Watch classification. Optional
recommendations do not invalidate independently observed checks. Guidance uses
the same availability boundary, including its pending state. Valid native and
supported legacy findings retain their established classification. Older
immutable comparisons without the marker retain their historical interpretation;
reads do not retrofit an original evidence decision that was never recorded.
Editor and plan handoffs accept the private stored envelope, or a redacted public
view accompanied by that server-derived readability decision. An unmarked public
view cannot establish private evidence custody. Malformed public observations
remain unavailable even when the marker says the private source was readable.
The Site copy service derives this decision before formatting the public view.

The existing `/api/health/worker` diagnostic also checks current saved monitoring
obligations through `sites/application/monitoring-operations.ts`, shared with
operator summaries and detailed queues. Overdue schedules, overdue independent
uptime probes and failed delivery records prevent an apparently healthy result
from a live worker with an idle queue. The monitoring read uses a consistent,
read-only snapshot with bounded database waits. Unavailable evidence remains
unavailable. One ordered problem selection owns both `ok` and `status`. The
endpoint remains HTTP 200 and does not gate deployment readiness. Its aggregate
snapshot establishes current gaps, not a historical fulfillment rate, receipt of
email, complete default-monitor coverage or external alerting configuration.

Uptime operational selection starts from active Sites rather than existing
monitor rows. It includes a committed Site whose automatic monitor is absent
after the Site-creation grace, even when its next broad check is in the future.
Existing overdue monitor eligibility remains intact. Operator counts, the
paginated uptime queue and worker diagnostics share that predicate. The existing
Site reconciliation action can admit the missing monitor through the normal
uptime scheduler. No second setup or recovery path was introduced. A newly
admitted probe closes the setup gap, but the Site's uptime remains unknown until
an actual observation arrives. Removed Sites, inactive owners and Sites without
committed care cannot create a missing-monitor obligation through this read.

Shared page modules select admitted findings and assertions through
`checks/receipt.ts` before deriving a category result. Ordinary page evaluation,
specialized interaction and PageSpeed evaluation, and receipt publication use
the same selector. The mobile module's Performance assertions cannot inherit a
Conversion tap-target gap, and its Conversion assertions cannot inherit missing
or failed performance measurements. Applicable failures and missing evidence
remain in their own category. Broad checks keep all of their original
requirements. Independent repair still requires the original observation's
measurement conditions; excluding unrelated assertions does not supply missing
comparison evidence.

Repair-guidance state belongs to the finding's source Audit. Flag queries load
that small state alongside their original evidence, and the shared Flag builder
owns both usable guidance text and readiness. A newer broad analysis cannot
make an older finding pending or unavailable. Site reads no longer overwrite
individual readiness from the latest broad Audit. Pending projected guidance
keeps existing Site polling active after analysis completion; settled work
returns to the ordinary cadence. Flag actions accept live readiness only for
the same source occurrence. A changed terminal state or explanation refreshes
the existing Server Component content once per publication, retaining the
verification draft and layout. Exact historical Flags absent from the current
Site projection use settled prescription notices from their own source Audit
and validated reconnects to request a fresh detail read. The shared notice
contract lives in `sites/execution-events.ts`; client observers accept only its
validated public fields. A notice cannot make guidance ready. Observer changes
reuse the existing Site stream, and access revocation stops queued callbacks.
No second polling loop or detail endpoint was added. Manual refresh remains
available when transport is unavailable.

Pages presentation combines collection coverage with its own unresolved findings.
Completing every admitted page does not clear a Pages finding. Those findings
retain attention while later collection is incomplete, stale or in progress;
findings in other areas remain separate from the Pages conclusion.

Site resource reads settle overlapping attempts against the newest validated
read of the same Site before publishing data or errors to SWR. An obsolete
rejection cannot restore a cached failure after a successful refresh and stop
normal polling. A failed current refresh remains a failure, including when an
older request later succeeds. Each HTTP read has a fifteen-second abort bound
covering fetch and response-body reading; existing SWR retry and reconnect
behavior then recover without another retry loop. Navigation fences retain the
original Site identity, and malformed projections leave the dated view intact.
Focused hook and settings checks reproduce recovery after both an obsolete
failure and a stalled initial read. They do not establish the cause of a live
disconnect or production proxy behavior.

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

Automatic Site setup runs as an independent bounded callback in the existing
worker scheduler, with the same five-second startup and thirty-second sweep.
Due Site admission no longer invokes the setup batch. A new Site waiting on a
database lock cannot delay an already configured Site's due admission. Setup
retains its existing transactions, retry field and pause fences; each callback
remains single-flight and drains through the existing scheduler shutdown.

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

Commands for an existing Site lock its selected Project under the current owner
inside the admission transaction. They do not repeat new-URL identity resolution
or restore a removed Site. Target hostname checks retain the existing canonical
identity policy while execution preserves the configured protocol, www and port.
The original parent must belong to that same Site. Scheduled admission also
validates the exact target, cadence, due tick, attempt and unexpired scheduler
lease against that locked row before creating either ledger. Changed claims are
cancelled without a monitoring failure or retry. Previously admitted receipts
remain replayable without creating work or changing the owner's saved schedule.

Scheduled care delegates current overlap and receipt replay to shared Site
admission. An Audit status alone cannot strand the next check. Older Watch
executions without active request ownership remain protected by their physical
lease or admitted progressive recovery window. Shared request recovery also
recognizes legacy physical leases, including renewal before its conditional
retirement write. Unowned legacy execution is fenced Failed through the existing
physical expiry mechanism before its request settles, so a delayed queue delivery
cannot restart it. New progressive ownership and completed observations cannot be
retired by that legacy recovery. Completed observations remain reconcilable.
`SITE_RUN_IN_PROGRESS` defers the claimed schedule without incrementing failure
counts or erasing earlier failure information. A failed deferral write remains
isolated to that Site. Existing claim fences, backoff and history stay intact.

Replaying an unadvanced schedule tick requires a non-failed request and an
available, non-failed Audit on the same Site. A failed, missing or foreign
execution cannot count as a successful enqueue. The existing scheduler backoff
then admits fresh care under current authorization. Reuse after a concurrent
admission receives the same check; ordinary new admissions add no lookup.
Request recovery also reconciles released terminal Audits before the longer
request lease expires. Selection, global recovery and conditional settlement
share that eligibility rule. A live physical lease remains protected.

After shared execution admission, the Site's next-run clock and the admitted
RunRequest's private schedule context commit in one transaction. This also covers
a compatible manual execution serving due care. The context records the due
tick, attempt, cadence, prior failure count and a hash of the configured target,
without copying its URL or scheduler lease. Caller context cannot set this
reserved field. Receipt replay does not re-enable a paused Site.

Admission preserves earlier execution failures. Normal terminal reconciliation
and the bounded Watch recovery pass use one completion projector. A matching
failed execution schedules the existing 15-minute, one-hour or six-hour backoff,
capped at the earlier normal due time. A matching completed execution clears
the execution failure streak. Selection and the conditional write both protect
the current owner, target, cadence, due time, attempt, lease and failure count.
They preserve a newer pause, transfer or schedule decision and make concurrent
recovery idempotent. An interrupted projection remains recoverable from the
existing receipt. Historical receipts without the schedule context retain
their records and ordinary cadence; no missing obligation is invented.
Execution completion alone does not establish complete website observation or
healthy findings. Evidence freshness and unavailable checks remain separate.

Recorded analysis tasks that settle `EXHAUSTED` and `FAILED` also trigger that
completion backoff, even if their containing Run and Audit completed. The
shared recorded-completeness module owns the ORM and SQL interruption cohort.
Selection and settlement check the same task condition. Historical task gaps,
findings and the containing completed receipt stay intact. Blocked work,
inapplicable capabilities, completed inconclusive observations and prescription
enrichment do not by themselves enter this execution retry path.

Scheduled scope selection reads the newest terminal broad analysis in the
existing care window, with a bounded interrupted-task lookup. A failed execution
or exhausted broad obligation requires a fresh broad attempt instead of being
treated as reusable collection. An older completed analysis cannot conceal the
newer interruption. A binding-only interruption still reuses compatible fresh broad
collection and admits the currently authorized bindings. Each fresh attempt
uses ordinary admission, authorization and execution limits; it does not reopen
or extend the old task graph's recovery budget. Persistent failures retain
backoff rather than clearing the streak at admission.

`sites/application/scheduled-scope.ts` owns that source selection and its renewal
time. When a narrow Outcome run reuses broad evidence, schedule advancement
rechecks the source inside the locked transaction and chooses the earlier of the
ordinary cadence and that source's original renewal time. The existing one-minute
scheduler tolerance applies to both scope selection and renewal. A missing source
leaves broad work due. A narrow run cannot renew a broad observation or add a full
new period to its lifetime. The chosen date uses the existing immutable schedule
context; replay retains it. No second timer or stored monitoring state is added.
Controlled database fixtures advance the actual scheduler through four saved
cadences and verify that renewal admits a broad run. They separately preserve a
failed broad retry beside an older completed source. These establish scheduling
and admission, not successful webpage collection or sustained production care.

The source is selected by owned Site and production environment before reuse
eligibility is evaluated. An entry-URL predicate cannot hide a newer failed or
exhausted Site analysis behind older matching evidence. A completed source may
cover another entry only through its recorded pages and compatible admitted
scope. Queries, fragments, protocol and port keep their original identities.
Freshness also consults `monitoring-responsibility.ts`, the same bounded ledger
projection used by broad admission. An older analysis retained after the latest
collection can add an unobserved responsibility; it requires broad work rather
than borrowing that collection's timestamp. A missing or incompatible source
does not fall back to an older healthy branch. These checks add no new schedule,
responsibility store or customer control, and leave historical evidence unchanged.

If compatible broad evidence is still fresh but no enabled Outcome has an
enabled required binding, there is no narrow execution to admit. The scheduler
rechecks the source and that shared selection inside the existing Site authority
lock. It advances to the earlier of the normal cadence and original broad
renewal, without an Audit, RunRequest, queue delivery, alert or new observation
time. Its enqueue count remains zero. A newly enabled responsibility or an
unavailable source instead enters normal admission. Pause, ownership, account,
target, cadence and exact claim checks still apply. Disabled responsibilities
stay disabled, while independent uptime continues. Disposable PostgreSQL cases
exercise these configurations, authority changes, stale replay and renewal;
the uptime callback supplies controlled local evidence rather than a real
website or provider observation.

The shared bounded transaction retry recognizes raw PostgreSQL serialization
and deadlock SQLSTATEs as well as Prisma's write-conflict error. It retries the
whole transaction and reads the current Site again; unrelated raw SQL failures
are not retried. Disposable PostgreSQL fixtures reproduce pause and removal
during admission, a pause after the transaction's initial snapshot, replaced
claims, expiry and executable URL preservation. The worker fixture separately
exercises signed claim, default uptime, independent repair, recurrence and
operator replay. These are local proofs, not production scheduling evidence.

Monitoring controls share `sites/application/monitoring-settings.ts` across Site,
legacy Product, MCP and operator callers. Its conditional Site update fences the
current owner, non-deletion, cadence and due state; enabling also checks account
lifecycle. Schedule and Outcome freshness commit together, including within an
admitted operator transaction. Repeated saves of an active cadence preserve its
due work, lease and retry history. Changing cadence makes the first check due
immediately, including when slowing the schedule. The fresh observation receives
the new policy's validity window before ordinary cadence resumes. An old short
window cannot otherwise bridge an entire newly selected weekly period.
Paused monitoring resumes immediately using
the current saved cadence. Pause retains that cadence without depending on
Redis or account-policy availability. Disposable PostgreSQL fixtures exercise
concurrent transfer, removal, suspension and cadence edits, plus rollback of
both writes after a real database constraint failure.

Current watched-result assessment shares `sites/outcome-assessment.ts` across
Outcome views and account summaries. It validates the current binding and fixture
revisions, then caps validity at both the recorded deadline and the observation
time plus the current freshness window. Tightening care cannot leave a weekly
observation Clear under an hourly policy; loosening care cannot extend an already
expired observation's original validity. Site assessment receives this same
effective deadline. The overview captures one clock for its Outcome views.
Historical run and timeline evidence retain their original deadlines and rows.
Disposable PostgreSQL cases exercise cadence changes, current stale state,
recovery after a fresh recorded observation and unchanged historical assessments.
The installed worker fixture additionally admits hourly and weekly transitions
from the command-generated due date, collects actual controlled availability
responses and writes fresh assessments with the corresponding thirteen-hour and
eight-day validity windows. Earlier assessment rows remain unchanged. This is
local worker evidence, not sustained production monitoring or provider acceptance.

Current broad and category evidence use the same pure freshness policy in
`sites/evidence-freshness.ts`. Daily care expires broad assurance after thirty-six
hours. Hourly and shorter custom schedules retain that window because broad
collection has a daily execution floor; their explicit bindings retain their own
faster cadence and freshness. Longer custom care uses its broad interval plus
twelve hours, capped at the original eight-day maximum. Weekly and unscheduled
evidence retain that original maximum. Current source selection passes one window
through area coverage, category overlays, overall assessment and Search card
presentation. Fresh uptime cannot renew another area's observation. Published
historical conclusions retain their recorded deadlines. This changes no schedule,
commercial allowance, stored evidence or customer control. A disposable PostgreSQL
case reproduces old broad evidence remaining Clear after switching to daily care,
then verifies consistent stale state, renewal by a fresh observation and unchanged
historical receipts. Focused contracts exercise exact expiry, category and Search
presentation and the earliest assessment deadline.

Watch state uses the reader's captured clock and the saved due commitment.
A next-run date more than the five-minute monitoring grace overdue is
Delayed, even without a recorded scheduler error. Customer and operator overdue
queries share that threshold; a configured date alone cannot establish current
monitoring coverage. Reads do not advance or repair the saved schedule. Operator
summary counts and detailed queues share one set of monitoring predicates,
excluding removed Sites and inactive owners while retaining overdue uptime work
and unconfirmed deliveries independently of the broad analysis schedule. Pending
Watch alerts become operational gaps after the original completed observation
exceeds the five-minute monitoring grace, with creation time only as a fallback
for undated historical records. Pending uptime alerts use their saved due time.
SENDING receipts become gaps when their lease expires; a missing historical
lease uses the same age grace. Live claims and fresh pending work remain
excluded. `undeliveredWatchAlerts` and `undeliveredUptimeAlerts` include these
stalled receipts and recorded failures without relabeling their actual status.
The existing operator queues distinguish waiting, failed delivery and overdue
confirmation. Diagnostic reads never change the receipt. Migrated
PostgreSQL fixtures reproduce the former Watching/overdue disagreement and the
hidden uptime work after pausing broad checks, then verify current state,
recovery and unchanged schedule rows. These checks do not prove live scheduling
or external notification delivery.

`audit/watch-notification-source.ts` owns the completed-Watch source boundary
used by classification, delivery selection and pending-alert diagnostics.
Watch admission records PENDING before execution, so that marker alone cannot
establish an overdue email. Queued, unfinished and failed executions do not
enter the pending-alert cohort. Completed partial observations still await
classification. Recorded FAILED and expired SENDING deliveries retain their
own operational uncertainty, including historical rows with unavailable source
metadata. Actual run-admission fixtures reproduce four false alert gaps and
verify consistent diagnostic, operator queue and summary results without
rewriting those receipts. Existing delivery-ledger and installed scheduler
fixtures retain retries, backoff, immutable bodies and provider deduplication.
Controlled provider responses remain separate from real acceptance or inbox
delivery.

Initial automatic setup is also an owed monitoring commitment. The shared
`initialMonitoringSitesWhere` predicate selects active, untouched Sites for
worker setup and overdue operational reads. After the existing five-minute
Site-creation grace, a missing initial schedule enters `overdueSchedules`, even
while `monitoringSetupRetryAt` defers the next attempt. The existing schedule
queue shows the original creation time and awaits automatic setup; it does not
offer a due-run action before a schedule exists. Paused controls, prior attempts,
prior monitoring observations, removed Sites and inactive owners remain
excluded. Reads create no setup, execution or observation. The existing upkeep
path still owns retry and initialization. Native database fixtures reproduce a
false healthy diagnostic, then exercise actual setup and queued admission after
retry. The initial setup gap clears while missing uptime remains visible, since
admission cannot establish a website observation. No query, timer, field, metric
or customer control was added; existing summary and queue consumers share the
broadened obligation cohort.

A failed scheduled check retains an operational gap during retry backoff. The
shared predicate counts `interruptedSchedules` separately from `overdueSchedules`:
an active scheduled Site with a recorded failure and error stays interrupted
while its retry is not overdue. The cohorts are disjoint, so the existing
operator schedule queue and summary count each Site once. A future retry does
not offer a reconciliation action that cannot yet run; normal due work retains
that action. New admission alone does not clear the gap. Existing scheduled
completion owns recovery, while notification gaps retain their independent
receipts. Paused schedules, stopped care, removed Sites and inactive owners stay
excluded. The diagnostic and standalone operator summary share one bounded,
read-only repeatable snapshot in `sites/application/monitoring-operations.ts`;
operator queue reads reuse their existing snapshot. These are current saved
obligations, not a historical fulfillment percentage or proof of live delivery.

Site admission runs one bounded pass of 20 due Sites per worker every thirty
seconds, with its first pass five seconds after startup. Per-Site attempt and
lease predicates, followed by the locked admission transaction, own concurrency.
The redundant global Site-admission rate window was removed; one slow pass still
cannot overlap itself within a worker. Independent notification and provider
maintenance use their own timers. Admission frequency, the customer's
saved plan cadence and the five-minute overdue grace are separate policies.
Two real SQL sweeps selecting the same cohort admit each Site once, including
identical attempt timestamps. An installed-scheduler PostgreSQL fixture admits
61 due Sites in four bounded passes before the grace expires. Its downstream
admission is controlled, so it proves local scheduling and ownership rather than
website collection throughput or production capacity.

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

Due monitor selection skips physically locked rows before applying its batch
limit, so a busy monitor cannot repeatedly consume the available cohort. The
short selection releases its locks before queue publication. Atomic attempt
updates and generation synchronization independently skip a row that becomes
busy after selection, retaining its existing due fields for another sweep.
This uses PostgreSQL's
[queue-oriented row-lock behavior](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE),
without a new lease, timer or recovery ledger. Publication retains the original
owner, active-account, non-deleted Site, target, due-state and worker-lease guards.
Only actual probe execution supplies observations or advances the probe due time.
Controlled installed-runtime fixtures hold the earlier monitor's row lock with a
batch limit of one. The later Site is observed through Redis and the worker,
then the original monitor resumes after release, including target-generation
synchronization. Separate database cases introduce the lock after selection.
These are local contention and recovery observations, not production capacity or
sustained uptime proof.

The uptime runtime likewise schedules monitor initialization independently from
due probe dispatch. Both use the same existing eligibility, generation and
retry rules. `scheduleUptimeProbes` remains the explicit maintenance command
that composes these shared operations, including selected operator setup. It
does not define a second dispatcher. An installed-runtime PostgreSQL lock case
keeps an existing monitor observing through the real Redis queue and worker
while another monitor's creation is blocked, then completes that setup and its
first probe. HTTP responses are controlled in that fixture. Alerts, retention
and shutdown remain independent of slow setup, with admitted setup included in
the existing shutdown drain.

Recognized peer-certificate validation failures are conclusive uptime failures,
subject to the existing independent confirmation before an incident. The saved
reason distinguishes expiry, validity time, hostname mismatch, explicit
self-signed trust refusal, revocation and malformed certificate evidence.
Unknown issuers, local TLS configuration, safety refusals and uncoded error
messages remain unknown. A TLS refusal does not fabricate an HTTP status or
response URL. Existing probe, incident, notification and presentation ownership
remains unchanged. A disposable HTTPS fixture exercises eight actual observations
through the installed uptime worker, PostgreSQL and Redis, including unchanged
failure, uncertain trust, distinct peer failures, successful HTTPS recovery and
recurrence. Its controlled clock and queue promotion do not prove sustained
wall-clock scheduling. TLS and hostname verification stay enabled throughout.

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

Observed page projection and automatic purchase-start inference share the same
apex/www hostname identity as Site admission. The original observed URL remains
the page and binding target, including host spelling, path, query and fragment.
This does not equate the responses from those URLs or widen credential grants.
Other subdomains and lookalike domains remain excluded. Recorded-fact PostgreSQL
fixtures prove page associations and automatic checkout inference in both
directions, preserve owner-edited bindings during replay, and carry the exact
current binding into Watch admission. Signup inference retains its separate
authorization boundary. Source Audit evidence and page IDs are preserved; these
fixtures do not constitute fresh website visits or purchase completion.

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

Worker startup validates the database and queue before starting consumers and
maintenance. Chromium startup and later recovery share the consumer's existing
nonblocking, single-flight path. The process supervisor no longer waits for a
browser or publishes a second startup heartbeat. Browser readiness remains
false until the physical browser is connected. The shared browser manager owns
launch and shutdown cleanup; late recovery cannot publish after intake closes.

Worker diagnostics use the existing bounded Redis RPC connection, including its
five-second command deadline. They do not use BullMQ's persistent blocking
connection policy. Delayed or rejected per-job diagnostics cannot prevent an
admitted job from executing, and failures remain logged. Cleanup disconnects the
diagnostic client even if deleting its heartbeat fails. A disposable Redis pause
fixture exercises the physical deadline and deletion after the delayed write;
focused runtime fixtures exercise pending browser startup, late completion and
draining. The migrated application fixture also retains signed claiming,
automatic uptime, independent repair and recurrence. These are local proofs,
not production uptime or live-provider acceptance.

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
An ambiguous queue acknowledgement does not establish failed execution. When
Audit dispatch records failure or deferral, its guarded transition must actually
commit before it reconciles the customer Run. A worker that has started, or a
newer dispatch claim, owns the subsequent decision. Disposable PostgreSQL and
Redis cases reproduce both stale-producer failure paths and retain their Runs,
while an undelivered admission still owned after expiry settles as failed. The
started case uses the real execution claim and fenced commit in a controlled
queue consumer; it stops before website collection.
Recovery settles expired dependencies before evaluating readiness, using only
the transitions it committed. A dependent that precedes its inputs in stored
order can proceed in the same sweep. Retryable crashes retain their delay and
cannot release their dependents. Disposable worker fixtures exercise expiry,
exhausted crashes, pending retries and storage-driven partial finalization.

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

Progressive graphs no longer compete for a global analysis slot. That gate
blocked independent HTTP checks when eight earlier analyses waited on provider
delivery. Physical queues retain their own worker limits, and each resource now
has an independent cross-worker delivery window of four times its configured
concurrency, with a minimum of eight. Further work remains in the existing task
ledger. The retired `AUDIT_ACTIVE_GRAPH_LIMIT` setting and availability-only
admission exception were removed. Availability has its own resource window.

`delivery-window.ts` reserves an eligible task under a short resource-specific
transaction lock before Redis is contacted. Existing dispatch state, lease and
generation provide the reservation. `FAILED` means unconfirmed delivery and
retains that reservation after a crash or lost acknowledgement; it does not
establish failed execution or a website problem. Reconciliation inspects the
same generation and job identity. Successful acknowledgement becomes `SENT`.
Waiting for capacity rotates the due record without consuming an execution
attempt or recording an error. Normal task completion drains newly available
capacity through the existing handoff. Background recovery remains the backstop.
Completed or failed execution cannot consume live delivery capacity.

Task routing is declared once in `queues.ts`; JavaScript delivery and SQL
reservation accounting derive from those same ordered rules. A concurrent
partial index isolates reservations from unclaimed work and historical evidence.
No task artifacts enter the capacity query. The populated local case reads eight
reservations with 8,000 unclaimed and 16,000 completed tasks present.
`AUDIT_WORKER_CONCURRENCY=1 node scripts/verify-progressive-execution.mjs --only lib/audit/progressive/__tests__/admission.integration.test.ts`
verifies independent HTTP collection and Security findings at a full provider
window, routing parity, concurrent bounded delivery, coordinator replay and
recovery in disposable PostgreSQL and Redis. Delivery fixtures separately retain
lost acknowledgements and drain waiting work exactly once. These are local
scheduling proofs, not production capacity or provider acceptance. The live
reservation bound does not measure stale Redis rows for already retired work.

The same recovery pass also retires obsolete unclaimed deliveries. It inspects
bounded waiting, paused, prioritized, delayed and waiting-child entries in each
actual task queue, then batches a small ledger projection containing identity,
generation, task state and Audit status. It removes deliveries with no remaining
ledger, mismatched identity or generation, settled tasks, failed Audits, or
completed Audits whose task cannot run after completion. Valid historical
provider routing remains usable. Live retries and valid finalization or
prescription work are preserved.

Cleanup looks past the configured live delivery window before applying its
per-resource removal bound. A paused valid cohort cannot conceal retired jobs
behind it under that window. Older oversized cohorts retain their authority
until they drain or retire. Actual queue inspection also finds orphaned records
and deliveries arriving after an earlier cleanup pass, without a cleanup table,
cursor, receipt field or new timer. PostgreSQL evidence and verdicts are never
changed by cleanup. Finished transport records retain normal BullMQ retention.
Removal disables recursive child deletion, and BullMQ's atomic lock check
protects a job claimed after the cleanup read.

Cleanup runs alongside normal graph recovery. Each resource has its own bounded
pass; read or removal failure cannot stop an independent queue or live recovery.
Native database and Redis fixtures exercise retirement, preserved history,
current retries, historical routing, concurrent cleanup, orphaned records,
bounded progress at a full live window, late acknowledgement and active locks.

Preview-image and sign-in/checkout destination checks, including targeted public
link verification, use the existing HTTP task queue. Network waits no longer
occupy slots for evaluating already collected evidence. The disposable
`http-evaluator-isolation` fixture holds native destination responses open while
the installed worker commits an independent Security finding, then releases the
responses and retains the original destination failures. Resource limits, task
identities and evidence comparison rules stay shared with ordinary execution.

Public link observation uses exact requested URL identity, excluding fragments.
Representative deeper-review identity still collapses locale, generated query,
www and trailing-slash variants for its existing page budget. Discovery,
targeted verification and the HTTP batch opener now retain those distinct
physical requests in their shared link inventory. Representatives precede
additional variants so repeated links cannot displace independent pages from
the existing bounded request budget. Unchecked requests remain unknown. Native
HTTP fixtures reproduce missed variant failures, verify every original failed
URL independently, recognize recurrence and exercise the same request ceiling.

The shared link resolver applies the observed document base to fragment
references before deciding whether they stay within a document. A published
`<base href="/plans/">` can make `href="#details"` address a different HTTP
document. Those destinations now participate in discovery and public response
checks. Parsed metadata retains its observed `documentUrl` separately from
`linkBaseUrl`; native link sections use their recorded final URL. This preserves
same-document section exclusions after redirects. The metadata contract accepts
historical records without the new optional field. Same-site eligibility,
HTTP fragment removal, request budgets and recovery evidence rules are unchanged.
See the [HTML base element](https://html.spec.whatwg.org/multipage/semantics.html#the-base-element).

Public destination identity rejects embedded credentials before discovery
grouping. It cannot remove credentials and observe the resulting anonymous URL
as if it were the supplied target. Those links remain outside automatic public
checks; explicit authorized captures retain their existing grant boundary.
The real HTTP regression verifies that no substitute public request occurs.

Search resource collection shares its sitemap document and URL limits with the
persisted evidence schemas. Each page-location and declared-sitemap inventory
uses one execution-wide budget, with duplicates counted once. Larger valid
inventories retain their collected documents and bounded positive observations
while coverage remains incomplete, rather than failing the entire resource task.
Declaration membership uses a Set across robots and child indexes, avoiding
repeated scans of a growing list. Native collector fixtures exercise overlapping
and overflowing multi-file inventories, excessive declarations and malformed XML.

Search public-document reads also decode gzip file content before text parsing,
as supported by the [sitemap protocol](https://www.sitemaps.org/protocol.html).
The existing public HTTP transport owns this decoding, retaining URL validation,
redirects, admission and the execution deadline. Compressed input and streamed
decoded output both retain the document byte bound. HTTP transport compression
is not decoded twice. Corrupt streams and output limits leave unknown evidence;
fully collected invalid XML still supplies the existing syntax failure. Native
HTTP fixtures cover compressed indexes, child files, transport encoding and both
failure boundaries without contacting external websites.

The shared sitemap parser decodes XML's predefined entities and numeric character
references once, before interpreting a page or child-sitemap URL. CDATA and URL
percent escapes retain their literal meaning. Collection and evaluation use that
same parser, so query delimiters do not become `amp;` parameter names or accidental
URL fragments. The parser's installed entity decoder is declared directly,
configured for XML references only, and rejects undeclared names and prohibited
XML characters. DTD and custom-entity declarations remain refused before parsing.
Parser resource limits leave unknown evidence instead of diagnosing invalid XML.
Existing requested-resource identities remain immutable: correcting a parser's
earlier request target cannot certify that the historical target was repaired.
A disposable application/worker fixture executes six real checks through
PostgreSQL, Redis and Chromium, detecting a listed query page's noindex conflict,
refusing an unchanged fix, verifying repair and recurrence, then independently
verifying recovery of the original decoded child-sitemap URL. Its controlled
transport does not establish Google acceptance or production collection.

The same transport decodes text once after decompression, using the installed
HTML encoding sniffer now declared as a direct dependency. BOM, transport,
HTML meta and XML encoding declarations retain their precedence. Undeclared
documents keep the existing UTF-8 default. Encoded bytes and decompressed bytes
remain bounded before decoding; source text and requested URLs are preserved
without serializing a reconstructed DOM. Native HTTP fixtures cover Latin and
Japanese encodings, UTF-16, conflicting declarations and compressed resources.
They also collect and flag an actual non-ASCII link, independently observe its
repair through the shared verifier, and detect its recurrence at the same URL.
These local observations do not establish external-site or provider behavior.

Sitemap findings retain hashed requested-resource identities alongside their
page scopes. The same Search comparator supplies explicit verification and
automatic recovery, requiring every original failed resource to be observed
conclusively. Another valid sitemap, a changed query, a missing original or an
unavailable response cannot certify repair. Grouping findings preserves each
page's resource requirements, and the finding evidence identifies all recorded
failed files. Historical findings without resource identity remain readable but
cannot acquire new repair authority from a later inventory. Focused fixtures
exercise partial evidence, reordered complete repairs, recurrence and the shared
Flag recovery gate. Existing stored receipts and findings are not rewritten.

Supporting observations also freeze each source's comparison policy before
grouping or incremental publication. Recovery uses that original policy, rather
than the current Flag representative's policy. The existing observation ledger
therefore retains distinct rendered, original-response, resource and provider
requirements without another projection store. Public observation views omit
the private policy. Unknown policy formats and historical observations missing
policy custody cannot borrow fresh verification authority. A disposable database
fixture publishes controlled native Search observations incrementally, reads the
persisted policies and exercises the shared verification decision for incomplete,
unchanged and recovered conditions. Collection is controlled in this fixture;
it does not claim worker, browser or live-provider execution.

Report comparison, current incident reads and fix reconciliation prepare one
private recovery snapshot per selected Audit. They validate and index the
recorded receipts once, then compare each original condition against those
facts. No parsed snapshot or verdict is cached across database reads. Findings
sharing a page and check still retain separate policy, version, resource and
capture requirements. Incident selection and legacy Outcome membership also use
scoped indexes instead of repeatedly scanning all historical rows. Focused
comparison fixtures preserve partial, failed and unavailable decisions across
the supported sources. The disposable worker fixtures retain signed claiming,
default uptime, exact recovery across original occurrences and recurrence.
Local timing confirms reduced repeated parsing; it is not production capacity
or live-provider acceptance.

URL admission, HTTP sockets and the managed browser proxy share one public-IP
classifier using exact subnet membership. Ordinary public addresses adjacent to
reserved IPv4 ranges and the IPv6 documentation prefix remain eligible. Reserved
IPv6 ranges and non-public embedded IPv4 endpoints remain refused, including at
connection-time DNS validation. Eligibility does not establish reachability.
The combined claim and monitoring fixture uses controlled public DNS outside
TEST-NET-3, independently of real DNS availability. Native HTTP and Chromium
fixtures separately establish connection refusal after a public preflight and
preserve permitted local fixture transport. The address policy and registry
references live in `SECURITY.md`.

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

Watch and uptime notification senders share the same bounded installed-SDK
transport and acceptance parsing. Uptime separately retains its incident receipt,
frozen provider body, current delivery permission and exact attempt ownership.
Uptime delivery clocks advance across a slow batch, so later claims retain their
full lease and retries retain their delay from the actual failure time.
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

Page context compares the Search fact's full recorded URI with the requested
page, preserving protocol, hostname, port, trailing slash and query conditions.
A shared display-path normalizer no longer joins unrelated Search URLs or
collapses distinct Analytics paths. Analytics page facts now also retain the
original `pagePath` dimension in their existing recorded scope. Site audience
aggregates retain their separate property and hostname scope. Legacy Analytics
page facts without that original dimension remain stored but cannot provide
exact page context; normal refresh can collect a newly scoped observation.
Invalid dimension values such as `(not set)` do not invent a recorded page.

Search card context describes a reported page, while page-specific Search lines
require an exact URI. Analytics lines describe the provider's path aggregate,
which can include query variants inside the recorded Site aliases. This follows
Google's distinct [Search page URI](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
and [Analytics pagePath](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema)
definitions. Controlled provider transport through disposable PostgreSQL verifies
refresh, saved original dimensions, owner reads, retained unavailable context,
separate audience totals and refusal of borrowed page counts. It does not
establish real Google property behavior or production refresh.

An unavailable context report does not prevent independent URL inspection using
the current grant. Revoked, mismatched or reauthentication-required connections
still cannot execute it. Sixteen disposable-database connection fixtures cover
both provider adapters, persisted scope, current readers, retained dates, explicit
zero and credential races. Focused inspection tests also cover independent access
and refused credentials. Real Search Console acceptance remains external.

Public Search does not require a Search Console connection. When neither a Site
connection nor matching historical account access exists, its Google module
receipts use NOT_APPLICABLE while retaining unknown NOT_CONNECTED observations.
Anonymous URL-first checks do not read private provider configuration. Historical
account properties apply only to their covered pages and are not refreshed for
an unrelated Site. A Site-specific revoked, mismatched or expired grant remains
an applicable evidence gap and never falls through to broader legacy access.
An admitted provider diagnostic explicitly requires that evidence, even after
configuration is removed; missing access cannot certify recovery. Finalization
and shared current coverage exclude NOT_APPLICABLE responsibilities without
using them as positive evidence. Existing historical receipts stay unchanged.

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
Progressive receipt producers share `progressive/check-execution.ts` for
admitted detector method identity. Native flow, mobile navigation, form,
tracking, overlays, slow replay, discovery, journeys, account observations,
cross-page evaluation and CPU checks use the same recorded version map.
The receipt wrapper version remains separate from each detector's admitted
version. Unsupported admitted versions are not relabeled as current methods;
checks absent from the execution cannot borrow an auxiliary observation.
Standalone historical receipt adapters retain their existing decoding. Neither
stored source receipts nor completed verification attempts are rewritten.

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

Public certificate refusals now survive the shared HTTP collection boundary as
typed evidence. The transport retains the last attempted public redirect hop and
its recognized Node/OpenSSL certificate code, without serializing raw errors or
certificate objects. The document still has no HTTP status, headers or body and
remains incomplete. Its schema rejects contradictory response claims. Normal
certificate validation is explicitly enabled on the public dispatcher. A known
certificate refusal completes collection as an observed transport failure instead
of repeatedly retrying an unknown collection error; unrelated missing facts
remain unavailable.

`audit/http-failure.ts` now owns public request-failure classification for both
uptime and the rendered availability binding. Recognized missing DNS, refused or
reset connections, transport timeouts and explicit peer-certificate refusals can
establish unavailable reachability. Resolver uncertainty, local trust or TLS
configuration, safety refusals and generic execution errors remain unknown. The
rendered binding confirms failure with its existing second independent attempt
before publishing a Flag. An uncertain confirmation withholds the Flag and keeps
the existing execution-recovery path. Known failures no longer exhaust retries as
missing evidence. Stored attempt details retain only selected response facts and
the observation time, never native error objects. Repair guidance names the
observed cause and reuses certificate guidance. A successful HTTP response whose
configured rendered surface is missing receives distinct, accurate findings.
Recovery still requires a fresh successful public response and the matching
rendered surface. The native certificate fixture exercises six scoped availability
runs, beside the existing six public Security runs: confirmed refusal, unchanged
certificate, HTTP 200 with missing content, uncertain local trust, independent
rendered recovery and recurring Improvement identity. The direct HTTPS Site is
separate from the Security redirect fixture. Chromium response routing is local;
the HTTP stage retains actual TLS validation against a disposable CA.

Bounded redirect exhaustion also retains its last actual HTTP response and
source chain through `audit/redirect-evidence.ts`. A redirect loop requires the
last request and destination to repeat an observed route within the existing
limit. Every observed hop must use an automatic redirect status, and cookie or
explicit challenge handling withholds that conclusion. Unique long chains,
nonstandard redirect behavior and refused targets remain unknown. The existing
request, redirect, public-network and deadline limits are unchanged. This follows
the distinction between cyclical redirection and a fixed redirect limit in
[RFC 9110 section 15.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4).

The collected document remains incomplete, with no invented response body.
Pages can nevertheless publish the observed failure as `page-redirect-loop`.
The shared destination collector also carries positive loop evidence to linked
pages and sign-in or checkout destinations. Availability bindings retain their
independent confirmation attempt, and uptime retains its two-probe confirmation,
incident continuity, recovery and recurrence. Existing reason details provide
specific repair guidance without additional customer controls.

An intermediate response cannot certify final-page Security headers or TLS
recovery. Those consumers share the unresolved-redirect predicate. Independent
header observations after an interrupted final response body retain their
existing evidence boundary. A new page-loop finding recovers only after a fresh
successful public GET to the original affected URL; a long chain, cookie-handshake
loop or unavailable ending cannot certify repair. Source receipts and historical
conclusions are retained, without a schema migration or another collector.

The `security` registration declares its HTTP input directly. The ordinary
registered evaluator owns protocol, certificate and applicable resource
observations for both progressive and compatibility execution. The former
progressive Security branch and secondary observation adapter were removed.
Uptime uses the same certificate classifier, and both surfaces share the existing
reason labels. New `security-certificate-invalid` findings retain the original
request identity, the reached hostname, native repair guidance and a hashed
request scope. Displayed evidence removes query values. A certificate refusal
cannot invent missing response-header findings or a successful protocol repair.
Historical observations are not rewritten or given a new admitted check.

Operational uptime responsibility also distinguishes a due job from a useful
observation. The shared monitoring read model derives sustained inconclusive
coverage from the existing target-generation probe history, using its scoped time
index. The monitor must have recent unknown or pending-confirmation state and older current-target evidence,
with no ONLINE or confirmed FAILED observation in the ten-minute freshness window.
New targets and brief uncertainty retain grace; different targets, prior generations
and future observations cannot supply coverage. The worker diagnostic exposes
`inconclusiveUptimeSites` separately from overdue execution. The operational
uptime cohort begins with active Sites whose saved care remains enabled. A stored
inactive monitor cannot remove that responsibility: after its due-time grace it
is overdue and ordinary admission reactivates it. Conversely, an obsolete enabled
monitor does not create a probe obligation after care is fully off. Pausing broad
analysis retains the cadence and independent uptime responsibility. Reads leave
activation and evidence untouched. Disposable PostgreSQL cases exercise both
disagreements, grace, shared operator counts and scheduler recovery.
The uptime queue and summary use the same SQL cohort, with overdue work taking precedence
and each Site appearing once. Monitoring count preparation is shared with the other
operational gaps. Reads retain their original bounded, read-only snapshot and expose
only aggregate diagnostic facts. No additional state store, index, timer, customer
setting or website incident mechanism was introduced.

A FAILED primary probe without its existing confirmation marker cannot renew
conclusive assurance. Repeated failed primaries and inconclusive confirmations
retain a coverage gap during both checking and unknown state, without opening an
incident from uncertainty. Actual scheduler and executor cycles with controlled
observations prove the shared diagnostic, operator queue and summary retain the
gap until ONLINE or confirmed FAILED evidence arrives. Raw probes and monitor
history remain unchanged by those reads. A confirmed failure retains the normal
incident and notification behavior; it clears uncertainty rather than claiming
that the website is healthy. Seventeen controlled executor observations cover
both recovery paths through migrated PostgreSQL. These do not establish real
transport or production confirmation behavior.

Current uptime assurance requires a finite observation time at or before the
reader's captured clock and within the existing ten-minute freshness window.
Future last-check times stay unavailable in current summaries.
Future samples remain absent from the current timeline and cannot establish
Online or Offline. Shared incident selection also requires an already observed
confirmation and treats future recovery or supersession as unresolved at that
clock. Uptime history, Site summaries and MCP lists use the same predicate and
read clock. History projections withhold future end markers while the stored
incident and probe records remain untouched. A known outage therefore remains
attention-worthy until its recovery is available to the read. A controlled
executor and real database/MCP fixture creates failure, confirmation and recovery,
then moves only the reader clock to prove continuity and later visibility of the
original recovery without rewriting it. This does not establish production clock
health or continuous availability between probes.

Certificate recovery requires a fresh verified HTTPS response for the same
original request. An unavailable transport, an HTTP downgrade, a changed query,
another page or an unscoped historical observation cannot supply that proof.
Other incomplete HTML observations do not erase a conclusive certificate result.
The disposable application/worker fixture starts with an HTTP URL redirecting to
an expired HTTPS endpoint. Six actual runs cover URL admission, actionable owner
handoff, unchanged failure, unknown issuer trust, downgrade refusal, HTTPS repair
and recurrence. The owner run API and saved Improvement attempts agree. Browser
and provider collection are deliberately unavailable and settled through their
recorded recovery deadlines, without claiming those capabilities passed. The
separate uptime fixture retains eight real TLS observations and its incident
history. These are controlled local proofs, not deployed certificate observations
or natural production scheduling.

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

Bound availability applies one response policy to the initial public HTTP probe
and the actual browser navigation. The existing isolated session retains HTML
error documents so their status can be distinguished from scanner restrictions.
A private main-frame response listener follows document changes during settling,
including JavaScript redirects; subresources and child frames cannot supply page
status. The response must match the observed document URL, preserving path and
query identity while allowing a same-document fragment. Missing responses,
changed documents, authentication, rate limits and challenges stay inconclusive.
Ordinary browser HTTP failures require the existing second independent attempt
before a Flag. A 200 from the separate HTTP client cannot override them.

Binding receipts retain each client's status and final URL without storing the
page body. The listener is removed and its context closed after every attempt.
The existing shared challenge policy checks response headers and bounded rendered
HTML before website failure classification. A disposable worker fixture verifies
a successful HTTP probe beside actual browser 503s, a 200-to-503 JavaScript
redirect, header and content challenges, independent repair and recurring identity.
Owner run results agree with the saved attempts and the source evidence remains
unchanged. These are local controlled website observations, not production
monitoring or live network acceptance. Playwright distinguishes a received HTTP
error response from a failed navigation transport; the response status remains
available for inspection.
[Playwright navigation responses](https://playwright.dev/docs/api/class-page#page-goto).

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
with existing values are not submitted. The probe activates the selected submit
control rather than treating a false `checkValidity()` return as visible feedback.
Native feedback requires uncanceled interactive reporting on a visible, focused
invalid control owned by that form. Trusted default activation and explicit
`reportValidity()` calls are distinguished from `checkValidity()` through temporary
native-method wrappers, restored when the probe ends. Baseline validity reads use
`:invalid`, avoiding invalid-event side effects before the action. Canceled native
messages need newly visible replacement feedback; a full observation without
either produces a scoped finding. Unclassified reporting, blocked requests,
preexisting feedback, changed forms and incomplete observation do not prove a
failure or repair. Feedback timing, including delayed native reporting, and the
full negative observation window use the browser's click clock, so driver
acknowledgement delays cannot manufacture slow or missing feedback.

Constraint-only observations retain their known rejection fact but have no
invented feedback timing. The shared receipt reader qualifies the exact historical
native-shortcut representation as incomplete for current assurance, and the scoped
verifier excludes it as repair proof. Raw receipts and published history remain
unchanged. Independently observed client feedback and fresh native reporting retain
the original form identity and comparable repair criteria. These observations
establish interactive browser reporting under the fixture conditions, not native
popup pixel fidelity, complete form accessibility or successful business submission.
The browser API distinction is explicit: `checkValidity()` checks constraints;
`reportValidity()` also reports uncanceled failures.
[MDN validity checks](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/checkValidity),
[MDN interactive reporting](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/reportValidity).
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
includes the native-ownership detector policy, field kinds, logical requiredness
and native constraint participation. Making a required field optional, disabling
it directly or through a fieldset, or making it read-only cannot borrow feedback
from another field to certify recovery. Replacing custom validation on an
`aria-required` field with native `required` validation remains comparable.
Earlier contexts without these obligations remain historical and cannot certify
recovery under the corrected detector. These are bounded form-level empty-field
observations, not proof of every field's validation or successful submission.
Controlled Chromium and
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

PageSpeed field evidence retains its page and origin response records together.
Each metric selects its own available page value before recorded origin context,
preserving that record's URL and reporting scope. A page LCP measurement cannot
hide available origin INP, and a malformed sibling metric cannot erase valid
measurements. Explicit `origin_fallback` records remain origin context, following
the [provider contract](https://developers.google.com/speed/docs/insights/rest/v5/pagespeedapi/runpagespeed#PagespeedApiLoadingExperienceV5).
Stored artifacts, findings and assertions use one shared field-evidence schema
and reader. Historical single-record evidence stays readable with its original
scope, including unknown scope; it cannot acquire new comparison authority.
The disposable provider HTTP, database, queue and worker fixture records origin
INP beside page LCP, persists both cohorts and retains explicit origin fallback.
Failed and improved rolling INP values remain observations, and all three fresh
repair attempts remain inconclusive instead of certifying an immediate repair.
Those controlled responses do not establish real-provider availability or data.

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

Category rechecks use that same bounded recorded cohort from their selected
broad source, including admitted pages whose interrupted collection created no
page row. Broad and category admission share source selection and page-scope
validation. The category, source Audit and selected URLs remain frozen for replay;
unrelated responsibilities and environments remain outside the execution.
The native worker fixture exhausts both page collectors before row creation,
independently repairs the original finding through a category recheck, then
recognizes scheduled recurrence under the same Improvement identity.

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

Section-link evaluation selects the active document from its recorded browser
scope, while the requested URL retains finding ownership. Relative destinations
still resolve against the captured document base, which may intentionally point
elsewhere. The compatibility page pipeline now parses rendered HTML against the
reached URL rather than the original request. Progressive evaluation already
passes its reached URL; the shared evaluator no longer depends on that caller
interpretation. A different redirect target, changed base or removed original
link cannot establish repair of the original fragment. Existing capture and
fragment identities retain their verification rule and historical decoding.
This follows the [HTML fragment target algorithm](https://html.spec.whatwg.org/multipage/browsing-the-web.html#scroll-to-fragid),
which compares the destination with the document URL before inspecting its target.

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
timestamps remain provenance, without establishing immediate field recovery or
real-provider freshness. These fields follow the
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

Public destination checks share the guarded GET collector. Discovery, sign-in,
checkout and preview-image probes validate public DNS and every redirect, bound
HTTP capacity and body samples, and honor their execution deadline during DNS
resolution. HEAD success does not certify a destination. Transport errors,
access restrictions and scanner refusals remain unknown. The same public
transport now returns either decoded document text or unchanged resource bytes;
capacity, DNS, redirect, credential-origin, body and deadline policies have one
owner. Binary image data no longer passes through document-text decoding.

Preview images retain response facts independently of their pixel observation.
Complete PNG, JPEG, WebP and GIF buffers receive first-frame decoding through the
installed image library, bounded to 5MB, 16 million pixels and at most two seconds
of processing within the execution budget. A readable header is insufficient:
the pipeline forces pixel evaluation before recording success. Unsupported formats,
partial buffers, pixel limits and execution limits remain unknown. SVG and other
document loaders are excluded before the decoder, and no external image resource
or local file is opened by that path. The collected bytes and decoded pixels are
discarded; private native HTTP snapshots retain only bounded response, format,
dimension and disposition facts. Evaluator replay consumes those frozen facts
without another image request. These observations do not establish sharing-platform
rendering, caches, later animation frames or complete support for every image format.
[Sharp input safety and formats](https://sharp.pixelplumbing.com/api-constructor/),
[Sharp processing timeout](https://sharp.pixelplumbing.com/api-output/#timeout).

A corrupt-image finding keeps the existing check identity and recommendation
priority. Its decoding assertion has a distinct condition hash for the same page
and image destination. An old response-only receipt cannot certify that repair.
Historical HTTP observations still support their original response criterion;
current receipt interpretation withholds full image assurance when decoding was
never observed. Raw receipts and published history remain unchanged. Owner action
starts the existing Improvement cycle. A native Chromium reproduction rejects
corrupt PNG bytes that the former HTTP-only check accepted. A disposable application
and worker fixture observes unchanged data, unsupported evidence, independent
pixel recovery and Watch recurrence under the same Improvement identity. Ordinary
journey execution remains enabled; provider and media limits are recorded
explicitly. These are local observations, not production network, provider or
social-platform acceptance.

Public link discovery commits source-page scoped response assertions alongside
its findings, using the same response classification as targeted repair. Shared
destinations use the existing bounded discovery sweep; publishing observations
does not add a second normal-scan fetch. Repair admission retains every affected
source page, and each originally failed destination must provide comparable GET
proof before the Flag closes. Removed links, changed destinations and access
restrictions remain inconclusive. Recurrence reopens the existing Improvement
and preserves the original Flag's resolution.

Deeper discovery reuses conclusive public GET observations from its completed
first discovery dependency in the same Audit. Both phases retain the existing
private native HTTP evidence format, with hashed exact request identities and
no additional raw URLs, response bodies or headers. The second checkpoint
records the original task and observation time when it reuses evidence. Missing,
repeated, restricted or otherwise inconclusive observations require fresh
collection. Different request conditions cannot share evidence. Foreign,
unreadable or historical checkpoints without these facts retain bounded fresh
collection and unknown untested scope.

Each phase's existing GET ceiling applies to new requests. A full first-page
inventory no longer spends the entire second budget repeating known responses
while leaving newly discovered links untested. Response assertions use the same
shared classifier and include both reused facts and new observations. New
analyses and independent repair runs still collect fresh evidence; no global
cache, new dispatcher or parallel observation store was added.

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

The Audit coordinator admits a validated dependency graph and returns. Existing
`AuditVerifierExecution` rows checkpoint work; append-only `AuditPipelineEvent`
facts record claims, attempts, committed observations and terminal limitations.
The task token, generation, lease and Audit recovery deadline fence publication.
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

Browser collection reads the saved tasks that depend on that exact collector,
selecting only their kind and input within the execution graph limit. Module
contracts determine whether axe and mobile evidence are needed; the broader
ExecutionSpec check catalog alone cannot establish the admitted consumer scope.
Metadata, Search and tracking can retain desktop evidence without unrelated axe
or mobile work. Accessibility retains axe, native layout and motion retain mobile,
and console rechecks retain both devices and axe to preserve their original error
window. Unknown task kinds, unknown module contracts and historical contexts use
complete collection. An omitted profile has incomplete console coverage and no
metrics; skipped axe has no accessibility result. Neither is a successful check.
Existing broad consumers retain their full observations, and private media keeps
its separate two-profile task. Capture functions share named options instead of
positional flags. No additional collector or persisted scope is introduced.

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
Current Search coverage and displayed results share the recorded receipt reader.
An explicit ledger status must be completed, and any recorded page and Audit
identity must match the receipt. Malformed, unsupported, failed, running and
mismatched rows remain unfinished responsibilities even beside healthy peer-page
evidence. They cannot disappear from completeness when decoding fails. Existing
historical receipts retain only the ownership fields they actually recorded.
Robots collection settles before sitemap expansion; crawl checks depend on HTTP
and robots only. Presentation and markup use original and rendered page sources;
canonical checks additionally fetch only their declared targets on the HTTP queue.
Rendered canonical declarations do not supply target HTTP availability. The History
API can change a document's URL without requesting that destination, while the
capture still retains its earlier navigation status. Canonical collection therefore
reuses only a complete original public HTTP response whose reached URL matches the
declared target. This includes self-canonicals and actually requested redirect hops.
Other targets receive their own bounded public GET, even if the rendered URL matches.
Interrupted target bodies remain incomplete. Existing receipts retain their recorded
conclusions; the correction governs fresh execution and independent verification.
The native Chromium and installed-worker fixture exercises an HTTP 200 document
using `replaceState` to display a canonical target that independently returns 404,
then verifies unchanged refusal, interrupted-target uncertainty, repair and recurrence.
This establishes public response availability, not Google's canonical selection.
Indexing and discovery consume sitemap evidence for their policy comparisons.
Google indexed-version evaluation consumes the indexing receipt, independently of
canonical targets, markup parsing and the Search summary. Analytics remains independent.

Robots evaluation distinguishes fetch provenance from rule authority. A redirect
can move `robots.txt` to another host, scheme or port, but its rules still govern
the original request authority. The shared evaluator constructs its parser with
the recorded initial URL and retains the reached URL and redirect chain as
evidence. A response requested for another initial origin remains unknown,
including a 4xx response that would otherwise imply no crawl restriction. Existing
rule matching, deliberate exclusions, regression attention and recovery semantics
remain in place. Six native application/worker runs establish an allowed baseline,
a redirected restriction, unchanged and unavailable repair refusal, fresh recovery
and recurrence, while the source receipt remains unchanged. This evaluates public
rules, not actual Google crawling. [Robots redirect scope](https://www.rfc-editor.org/rfc/rfc9309.html#section-2.3.1.2)

Cross-page preview checks retain separate title and description assertions for
each compared pair. Findings keep both pages and their native capture conditions,
including when several comparisons collapse into one Flag. Targeted repair runs
collect every originally affected page and compare the same pairs, without
launching unrelated provider or interaction work. Missing pages, removed preview
values, changed redirects or access conditions, and unscoped historical findings
cannot certify recovery. Category checks include the cross-page responsibility.

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
Both the legacy adapter and progressive evaluator use this shared input and
the head's own page, final URL, profile and access identity for comparable
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
preview facts while excluding collector bodies and network traces. The native
worker fixture includes an oversized peer with no HTTP or browser metadata,
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
Optional content correspondence remains unknown when its context is incomplete.
The evaluator sanitizes and reads available context once, rather than cloning
the page for every entity. Independent markup failures survive that missing
context without becoming successful whole-page coverage.

Search uses one observation bound for evaluator results, compatibility workflows
and aggregate receipts. When evidence exceeds the 500-record receipt budget,
observed failures take priority over guidance and healthy observations. Retained
records keep their source order, and an explicit coverage gap prevents incomplete
evidence from certifying recovery. Exactly 500 complete records require no gap.
Structured entities with many invalid properties use multiple 30-property records
instead of discarding the evaluator result. Repair policies can retain one target
per recorded observation, including both original and rendered source evidence.

Search finding evidence carries every admitted actionable entity and property
record, qualified by the original or rendered source and published entity
identifier. Resource findings retain every admitted failing document URL.
Syntax findings include the recorded failing block locations and excerpts,
instead of replacing those failures with an entity-count summary.
Repair handoffs use this same recorded evidence through the existing public
supporting-observation view. They do not export private comparison policies or
task provenance, and presentation excerpt limits cannot remove repair scope.
The installed-worker structured-data fixture exercises the actual owner copy
service, retaining all 208 admitted targets, the late breadcrumb property and
both HTML sources while excluding private provenance and comparison policies.

Property repair compares every originally recorded entity identifier, type,
source and invalid property. Unrelated nested types outside feature validation
cannot prevent that original property's evaluation or supply replacement proof.
A different entity remains inconclusive, and historical feature Flags without
recorded property targets cannot acquire them retroactively. A disposable native
worker fixture retains simultaneous syntax and price failures under a bounded
text section, recognizes unchanged and changed-entity attempts, verifies the
original Product price, 101 independent URLs and 45 breadcrumb positions. It
refuses a partial repair beyond the first property record and preserves the
recurring Improvement during Watch.

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
timeouts after headers arrive remain incomplete body evidence and cannot establish
a missing-response outage. Physical local HTTP fixtures exercise both consumers.
An interrupted response stream or file decompression now carries its already
observed status, headers, final URL, redirect chain and bounded text prefix through
the same transport error boundary. Compressed undecoded bytes remain unavailable
text. Public document collection stores those facts with `complete: false` and
`response_body_unavailable`, without storing the native error or retrying them as
a missing response. Independent header and connection checks can use the response;
page response, content and sitemap interpretation still require their existing
complete evidence. HTML compatibility, destination, image and rendered-availability
consumers retain their body-error path. Automatic uptime retains the actual
status and final URL while classifying the original transport error, so partial
HTTP 200 evidence cannot establish recovery. The existing confirmation, incident,
notification and recurrence ledgers remain the only owners of those transitions.

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
provider recording are separate assertions. Request, response, finished and failed
events retain actual browser facts. No request body, query, cookies, headers, event
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

The public GET collector retains whether its HTML is complete. Content-sensitive
checks inspect successful HTML up to the same 1 MB allowance as the standard
public-document collector. HTTP-only checks, non-HTML resources, error responses
and header-declared challenges retain a 20 KB prefix. The shared transport selects
that budget from the final response before reading its body, within the existing
request, capacity, redirect and deadline ownership. It cannot certify the absence
of a missing-page response beyond the selected bound. An observed missing-page
heading inside the prefix still supplies failure evidence. Public sign-in paths
do not bypass this content boundary. `publicGetSucceeded` supplies one positive
response predicate to public links, action-link responses and page responses;
an unknown HTTP 200 cannot become passing evidence in a downstream consumer.
Native HTTP fixtures reproduce late error headings, retained positive failures,
sign-in paths and independent HTTP-only/binary behavior. The actual worker
journey reproduces a false IMPROVED result, then verifies inconclusive truncated
content, complete repair and recurrence under the same incident. The request
count, network boundary and historical evidence stay intact.
No extra request, browser collection, check, queue or customer control was added.
Native HTTP replay of existing archived website fixtures proves useful complete
inspection beyond 20 KB. Unending prefix-only responses prove cancellation, and
invalid budgets cannot retain transport ownership. Responses beyond the document
allowance remain inconclusive rather than successful.

Public destination collection reuses each available worker slot as soon as its
current request finishes. It does not wait for an entire fixed batch to complete
before admitting later destinations. The existing concurrency, request ceiling,
physical HTTP capacity, ordering and deadlines remain. A stalled request cannot
reserve the other slots. An interrupted adapter observation remains unknown
while independent responses survive. Private native HTTP evidence records that
unavailable destination result explicitly, matching the existing unavailable
image-response representation, so replay restores the same uncertainty without
another request. A missing replay input still fails custody validation. Native
HTTP fixtures prove a later missing destination is observed within the existing
deadline while the first request is stalled, with at most two active requests in
the selected two-slot scenario. A separate controlled adapter interruption proves
continued collection and exact evidence replay. These fixtures do not establish
production throughput or sustained monitoring capacity.

Missing-page interpretation uses the shared active HTML document parser. Script
and style text, comments, dormant templates and scripting-disabled fallback
content cannot supply document headings. Character references are decoded before
the existing missing-page wording and text-window rules run. This replaces the
independent raw tag regular expression without changing the selected budgets.
Public link observations use detector version two. The existing
recorded-version comparison refuses to certify repair across that interpretation
change while retaining historical conclusions under their recorded versions.
HTML distinguishes raw text, escapable text and template document fragments;
literal heading markup inside those scopes is not a document heading.
[HTML syntax and document boundaries](https://html.spec.whatwg.org/dev/syntax.html)
The native worker scenario retains encoded missing-page headings and missing
headings after a 100 KB prefix during unchanged repair. It verifies a complete
healthy response of that size that retains dormant error markup, and recognizes
the next real failure under the same Improvement. Its nine
actual admissions also retain restriction, removed-declaration and incomplete
content uncertainty. A focused recorded-receipt case verifies both refusal of
cross-version repair and preservation of historical conclusions.

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
of historical findings.
Public Search presentation, indexing, canonical and structured-data interpretation
now share the active HTML document boundary. Templates and scripting-disabled
fallback descendants cannot supply published directives, structured entities or
properties, page titles or discovery links. The original collected source stays
intact. Embedded Microdata and RDFa receive source with only those parser-located
fragments removed, preserving the original document or fragment shape and entity
subject. Native rendered sections exclude dormant descendants before charging
their item budgets. Hidden published declarations remain eligible, and active
body robots directives still apply. Affected HTML observations use detector
version 3; existing sitemap resource and crawl interpretation retain their prior
versions. Earlier findings remain readable, but their disappearance after this
detector correction cannot establish a customer repair.
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

Primary-action selection uses the browser-resolved destination and the active
document address. A fragment can address another document through its HTML base,
and a custom routing fragment is an interaction candidate rather than evidence
of a placeholder. Native primary probes exercise those candidates under the
existing read-only policy. The shared declaration classifier also supplies static
placeholder checks, journey entry selection and destination controls. The old
`isDeadHref` wrapper is removed; declaration shape cannot establish that a click
works. Bare placeholders and ordinary missing section targets retain their
existing meaning. This follows [HTML fragment navigation](https://html.spec.whatwg.org/multipage/browsing-the-web.html#navigating-to-a-fragment)
and [document base resolution](https://html.spec.whatwg.org/multipage/semantics.html#the-base-element).

For a custom route without a main-frame response, a URL change alone cannot
establish progress. The existing action probe compares bounded rendered copy
before the click with the copy already collected for its navigation observation.
A matching declared route can establish a content transition through changed
rendered text and a new heading, with ready document state and no recognized
loading or missing-page surface. Independently observed declared or semantic
panels retain their own native progression proof. Missing or truncated copy
cannot prove a content transition. URL-only changes, cancelled handlers,
unmatched routes and unavailable observations remain incomplete. HTTP response
evidence is never fabricated, and these observations do not establish business
completion. Original HTTP soft-404 checks and rendered route qualification now
share their existing missing-page wording rule instead of duplicating it.

Embedded credentials are excluded before public activation and cannot create an
anonymous substitute request. Their exclusion makes absence incomplete, while
independent eligible controls can still run. Journey path inspection retains
unknown routing limits independently of a known primary control. No new collector,
queue, router framework or customer setting is introduced.
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
while preserving the existing slots for other resource queues. Each page-capture
task collects desktop and mobile profiles in sequence, holding at most one native
context at a time. Device timings retain their own navigation clocks. A stalled
linked document cannot reserve both physical browser contexts, and linked work
does not move ahead of ready primary work merely because its rows were older.
Browser task budgets cover both frozen console-observation windows and their
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
The baseline reads each Improvement's latest qualifying occurrence and all
unresolved original Flags directly. Pending and inconclusive attempts do not
reload their source Audits' complete finding graphs. The same original source
checks apply regardless of repair-history length. A disposable worker fixture
retains an older repair through 25 inconclusive attempts, independent recovery
of both source occurrences and subsequent recurrence. It also checks the unacted
case, without inventing a customer repair or rewriting the original history.
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
The separately selected `CONSOLE_DB_REQUIRED=true` worker scenarios exercise
delayed console errors and unhandled exceptions, a partial repair on a second
page, mobile-only evidence after desktop refusal, an unavailable mobile window,
redirect comparability, complete repair, recurrence and bounded console floods.
These observations cover recorded windows, not every later interaction or
JavaScript execution state.

Site admission retains console windows from its compatible recorded execution
snapshot before merging newly observed error horizons. The bounded recent-Flag
lookup cannot retire a known window just because newer unrelated history fills
that lookup. Historical whole-run minima remain a fallback for later discovered
pages; per-page minima can extend that window. Recorded per-page windows remain
available to discovery without causing those pages to be collected by themselves.
Execution preparation uses the actual admitted check set, so Conversion rechecks
do not acquire console waits they never evaluate. Existing source selection,
browser limits, method identities and comparison rules still apply. No second
history scan, query, state store or customer control was added.

A later healthy comparison preserves an already fixed Flag's original
`resolvedInId`. Continued health is a new observation, not a replacement for the
run that independently verified recovery. Those closed rows do not need another
recovery-receipt read. Unresolved conditions still require their own comparable
evidence, and recurrence retains the original incident identity.

Accessibility collection retains each actual axe rule's passed, failed,
unresolved or inapplicable outcome, with engine version and the desktop capture
scope. The shared Accessibility evaluator consumes native rule evidence even
when whole-document metadata is unavailable. Captured-HTML fallback assertions
then remain incomplete, while positive comparable native results can still verify
their original rule-specific findings. A failure-only list cannot certify a repair or a healthy automated
inspection. Mixed passing and unresolved nodes retain the unresolved result;
one observed failure can still establish that the responsibility fails.
The collector projects failure text, selectors and fix details into the existing
finding contract. Transient engine internals, including undefined contrast
parser fields, cannot interrupt durable snapshot storage. The existing legacy-mode
collector limits frame injection to same-origin documents. Its outcomes remain
intact through summaries, findings and verification. A selector-name heuristic
cannot establish frame ownership, so no evaluator filters native nodes based on
words such as iframe. Top-level iframe attributes remain the Site's responsibility,
including the titles of cross-origin embeds. Native target arrays preserve frame
levels and nested shadow-root paths, following the
[axe result contract](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md).
Fix evidence labels these boundaries explicitly. Screenshot geometry traverses
open shadow roots and skips descendant-frame coordinates, which it cannot locate
in the top document. Current native summaries record the corrected same-origin
policy through the existing snapshot schema. Their comparison contexts differ
from historical summaries, preventing this interpretation change from certifying
an older finding as repaired. Historical source evidence remains unchanged.
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

HTTP and browser collectors retain observations already obtained when metadata
parsing fails. A retryable parser crash gets one bounded retry against the same
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

Form-name fallback requires nonempty name content and a real label relationship.
An empty label, whitespace-only ARIA label or missing reference cannot certify a
repair. Explicit labels retain first-ID identity; an implicit label belongs to
its first labelable control unless its `for` attribute targets another control.
Textarea contents and select options cannot supply the enclosing label's name.
Inputs, buttons and links share the same cached name-content and ARIA-reference
checks, replacing the separate input attribute-presence shortcut. Script text and
unreferenced hidden descendants do not supply a name. Explicitly referenced
hidden subtrees retain their supported naming behavior, and empty references can
fall back to other valid name sources. Reference traversal does not follow another
ARIA chain or recurse through a self-reference. These remain captured HTML
signals, not a complete accessible-name implementation or conformance result.

New metadata and durable snapshots retain control-name policy version 2. Only
those HTML name assertions receive the corresponding context identity. Older
zero counters remain insufficient positive evidence, including when a worker
resumes an earlier capture. The existing receipt reader and scoped verifier share
one qualifier for saved positive counters. Original stored values and meaningful
failures remain intact. A corrected detector cannot be credited as an old HTML
finding's repair; native axe contexts retain their existing comparison rules.

Thirty-eight native browser cases compare supported relationships with Chromium.
An independent axe 4.12.1 label observation checks missing name, nominal empty-label
repair, actual named repair and recurrence. The shared evaluator receives HTML
and a controlled PageSpeed fixture for that comparison, leaving its native rule
evidence unavailable. Only the scoped HTML responsibility can pass; the automated
Accessibility result remains incomplete. The installed application and worker
regression separately retains independent native observations through unavailable
metadata, repair and recurrence. These establish local behavior, not production
screen-reader coverage or complete accessibility assurance.

The shared public HTTP transport bounds resource admission separately from its
response budget. A caller's absolute execution deadline still limits both phases.
Local contention cannot shorten the website's configured response window and then
be labeled an origin timeout. Execution-budget exhaustion stays incomplete, and
Uptime records response duration from capacity admission, including DNS and
redirects while excluding local waiting. The native HTTP, PostgreSQL, Redis and
uptime worker fixture proves a healthy delayed response under contention without
creating an incident; focused fixtures retain genuine origin timeout detection.

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
A recorded non-advisory failure cannot be overridden by a passing summary bit.
Finalization also inspects stored incomplete assertions, so a resumed older
checkpoint cannot produce FULL coverage from conflicting summary fields. Reading
such a receipt derives an unknown result without rewriting historical evidence.
The disposable worker fixture exercises native style gaps, complete observations,
unchanged advisory repair limits, and resumption of an older conflicting receipt.
Independent positive criteria on the same partial receipt remain usable for their
original scoped repairs.

Unversioned historical module receipts use that same summary calculation after
qualifying their individual observations. Explicit incompleteness, execution
failure, unreadable assertion lists and older positive observations missing
required evidence cannot retain a conflicting passing aggregate. Readable
assertions remain available, including independent positive facts. Supported
historical aggregate-only results retain their recorded meaning without gaining
positive completeness or a missing aggregate. Coverage honors historical gaps
without promoting historical receipts into current scoped repair proof. Site
overview, account list, paginated results and MCP use these shared projections;
published run results and stored receipts are not rewritten by reads.

The shared page evaluator accepts unavailable metadata without substituting an
empty document. Registrations that consume whole-document fields explicitly
require metadata; native input sizing, CTA style, typography and radius checks
consume their captured measurements directly. Layout and mobile action judgments
retain unknown purpose when classification is unavailable, without blocking the
same input cohort's independent repair. Visual hierarchy evaluates native action
style even when prose is incomplete, and can use separately retained complete
prose without reconstructing full metadata. The legacy adapter and progressive
tasks use these same registrations, including Accessibility. The separate
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
mobile layout metrics and destination loading share one loading predicate,
including viewport position and the distinction between a blocking main loader
and a small background loader. The loader's computed visibility determines its
inherited CSS visibility: a visible child can override a hidden ancestor. Ancestor
display suppression and opacity still exclude the descendant. Native Chromium
fixtures establish the visible, hit-testable child and retain both inherited-hidden
and non-overridable hiding cases. The existing application/worker repair cycle
uses the same visible-child condition for slow, stuck, unchanged, recovered and
recurring observations. This expands observation of real blockers; the loading
thresholds, scope identities and historical records remain unchanged.
[MDN CSS visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/visibility).
Unavailable clearance remains unknown. The
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
controls and mobile action measurements share one bounded rendered control inventory. Visible captions exclude hidden
descendants. Controls without a visible caption can use bounded `aria-labelledby`
references, including explicitly referenced hidden labels. Hidden descendants of
visible referenced labels stay excluded, and editable reference values remain
unavailable. Conversion-intent scoring uses these captions. Plain conversion links do not require a special
URL or CSS class. Generic enabled buttons, button roles and styled action links
retain their presence semantics. Inert and invisible controls cannot establish
presence; a visible child may override inherited visibility. Action assertion
contexts include the detector version, so this correction cannot certify repair
of historical action findings. Missing-flow-action and journey-path assertions
also version their corrected detectors. Referenced-label discovery uses journey action
version 5, journey path version 4, flow presence version 4 and destination control
version 2. Resolved fragment declarations use journey action version 6, journey
path version 5, flow presence version 5 and destination control version 3;
`cta-dead-link` uses check version 2. Older versions remain readable but cannot
certify these detector corrections as customer repairs. Rendered headline contexts carry their own
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

Pricing-section, mobile-navigation and declared primary-panel observations use
Chromium's native `Element.checkVisibility` with opacity and CSS visibility
checks. A child's restored visibility is observable, while zero-opacity,
display-suppressed and content-suppressed ancestors remain excluded. Existing
geometry, inert/hidden controls, accessibility exclusions and per-probe viewport
rules still apply. A section or panel with its own hidden contents is not a
useful revealed destination even when its empty box is painted. Pricing fragment
conditions use `flow:pricing:v2` so the detector correction cannot certify an old
section repair; HTTP pricing destinations retain their original v1 conditions.
Mobile detector version 2 and its matching rule distinguish current native paint
evidence from the earlier hand-written visibility interpretation. Raw receipts
and published history remain unchanged. Native fixtures observe both visible
child restoration and content suppression, and installed worker fixtures retain
unchanged failures, independent recovery and recurring finding identity.

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

`Mobile navigation observation v2` freezes the panel and capture conditions,
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
registered page or action receipt that cannot be decoded remains unavailable;
collection summary bits cannot replace it. Readable legacy assertions remain
accessible, while a partly unreadable receipt keeps an unknown aggregate. A
completed Audit with an unfinished module cannot establish fulfilled coverage.
These read projections preserve the raw receipts and immutable published run
conclusions. Restored usable evidence can restore current assurance without
rewriting the earlier conclusion.
An observation in one area cannot establish a Clear Site while another required
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
Category completeness follows the persisted finalization dependencies rather
than regenerating a plan with the current planner. Every recorded obligation
must be reachable and complete or have a settled exclusion. Missing tasks,
cycles, orphaned work and unfinished dependencies retain an incomplete result.
The Site, run API and history read the same compact task dependencies without
loading full artifacts. Planner changes cannot add or remove historical work.

Diagnostic run results use the exact admitted repair attempt, source Audit,
verification Audit and immutable evidence reference. Comparable recovery is
Clear, a reproduced failure is Flag, and missing or inconclusive proof remains
unverified. Account-only reads use the committed account task. Unavailable
behavior is incomplete even alongside a successful observation. Run results
and history share these conclusions. A notification marked SENT establishes
provider acceptance, represented as `accepted`, without proving inbox delivery.

The current catalog's 108 responsibilities have explicit stable coverage identities and
registered evaluator mappings. The capability report exposes partial coverage;
registration is not execution proof. Capability check inventories derive from
the check registry rather than a second list of finding identities.
Outcome verification, Flag verification, prompt copying, settings and connection
actions use shared submission ownership and operation-specific response contracts.
Verification keeps its idempotency key after an uncertain response. Site refresh
validates the complete projection and matching identity before replacing the
recorded view; malformed responses retain visible disconnected evidence.

Outcome lists, details, confirmations and rename receipts select linked page
URLs and ownership through the same `outcomePageProjection` relation shape.
Their builder preserves page order but emits IDs and URLs only for pages still
owned by that Outcome's current Project or unclaimed provisional Site. A claimed
page cannot remain readable through an old provisional association. The former
per-Outcome page-ID lookup is removed. Lists no longer issue an additional page
lookup for every Outcome, and command receipts use the same interpretation.
Freshness, binding evidence and history continue through the existing pure
presentation functions. Signed-claim database fixtures retain valid page context
after duplicate-page migration and preserve Outcome identity and evidence.

Single and batch Outcome details use the same reader. MCP no longer reads a
summary list and then reloads each Outcome individually. PostgreSQL first selects
the bounded detail references: 20 recent assessments and runs, 20 binding
attempts, 50 binding executions, and the existing 20 occurrences and attempts
per Improvement. The last accepted successful assessment is selected separately
from the recent history window. ORM hydration is restricted to those IDs, rather
than relying on multi-parent relation `take`, which the observed query engine
applied after unrestricted history reads. Hydration cannot present a selected
success that was superseded before its record arrived. The pure detail builder
continues to own binding comparability, recovery guidance and timeline wording.
Run selections fetch only their consumed identity, status, request date, error
and Audit reference. A SQL-traced PostgreSQL fixture verifies per-parent bounds
and consistent single/batch views; installed MCP protocol fixtures retain the
same evidence and explicit unverified states.
The overview's Outcome list and account summary use the same bounded reference
foundation with one assessment and run per Outcome. Their lightweight selection
omits execution, attempt and Improvement history. The account reader scopes its
cohort to its already-authorized Project IDs and enabled Outcomes. Empty
selections do not issue a second hydration read.

Explicit Site refreshes await the validated HTTP read and write it to the
requested Site's explicit cache key. Revalidation resolving with retained data
is not proof of a fresh read. A callback captured before navigation cannot
replace the next Site's cached view or connection state; closed event streams
cannot update the next view. Superseded requests settle from the newest read
of the same Site, so an old rejection cannot reinstate a cached error after a
successful refresh. Settings, monitoring, account-check
preferences and connection controls derive their values from this shared view,
without copied initial state. Successful writes await its refresh. If the write
was accepted but refresh failed, the interface retains recorded values and
states that refresh is pending. Notification writes include only edited fields,
preserving independent preferences changed elsewhere. Revoked provider records
retain their property and observation date without another disconnect action.
Focused resource and component fixtures exercise these transitions and failures.

Composed Flag pages use `SiteResourceBoundary` to share one resource owner
between the live analysis sidebar and Flag actions. That owner controls reads,
polling, refresh ordering and the event connection. Consumers share failures
and validated data, and can observe source notices without opening another
connection. Nested actions reuse the enclosing Site owner; standalone actions
retain their own scoped owner. Changing Sites replaces the owner, while
removing a child leaves its siblings connected. Overview and settings already
own a single resource and retain their existing ownership. This is local view
composition, without a global connection registry or additional polling loop.

Current owner Site health and account summaries also require the eligible
Site's current uptime evidence. `uptime/status.ts` shares target matching,
monitor eligibility, freshness and unresolved incident scope between uptime
reads and account summaries. One shared monitor selection reads current status
and small unresolved incident descriptors with Site rows, without fetching probe
history for every website. Fresh confirmed downtime uses the existing Offline
label and attention treatment, even while a separate analysis runs. Missing,
pending, inconclusive or stale reachability evidence cannot support Clear.
A confirmed unresolved incident still needs attention after an inconclusive probe
or a stale observation. Current reachability stays Unknown, and the existing
Needs attention label preserves the distinction rather than claiming fresh
downtime. The current assessment retains that reachability gap beside the known
incident. Missing probes cannot expire the unresolved incident.

The additive `incidentOpen` fact requires an eligible active Site, the exact
monitor target and generation, and a confirmation no later than the read time.
An internally disabled monitor cannot revoke that active Site responsibility;
turning Site care off still removes the active uptime obligation.
Recovered, superseded, other-target and old-generation incidents cannot supply
current attention. During a pending retarget, historical open-incident counts
remain available without attributing the old outage to the new target. Summary,
history, owner views and MCP share this interpretation. Disposable PostgreSQL
execution confirms initial failure, independent confirmation, inconclusive and
stale attention, unchanged incident and notification records, actual recovery and
recurrence. Observation callbacks and notification delivery are controlled in
this fixture; it does not establish production reachability or email delivery.
Turning Site care off contributes no active uptime obligation. Pausing broad
analysis alone retains independent uptime care. Reachability recovery
removes only its own constraint, leaving unrelated findings and missing evidence
intact. The assessment does not invent Flags or change their counts. Recorded
run results and monitoring history retain their original conclusions. Pages
uses the run's own activity rather than the overall Site result to describe its
ongoing analysis, independently of current uptime attention.

The existing owner-scoped MCP `list_sites` read includes automatic uptime from
the shared lightweight projection. `list_outcomes` includes the application's
uptime summary even when no Outcome is configured. Optional `uptimeWindow` and
`uptimeCursor` request the same bounded probe and incident history as the private
application route. The response states its HTTP scope and rendered-verification
limit. The history cursor is separate from `resultCursor` and must belong to the
authorized monitor, target generation and requested window. Invalid cursors
return `INVALID_UPTIME_CURSOR` with a read-only restart call. The private route
and MCP share the cursor schema and typed reader error. Reads never start probes,
create findings, consume analysis credits or substitute HTTP success for browser
repair verification. Installed MCP client/server fixtures exercise these facts
over in-memory transport, separately from deployed authentication and transport.

Default monitoring resolves the effective account policy from the same scoped
transaction read as Site identity. Active plan grants contribute to the default
cadence; expired or revoked grants do not. Account lifecycle availability is
checked before creating default coverage or scheduling, and inactive accounts
are excluded before the backfill batch limit. Existing schedules and explicit
pauses remain authoritative. Disposable PostgreSQL fixtures exercise grant
lifecycle, inactive-account exclusion and claim-time scheduling without modifying
stored subscription state.

Automatic monitoring isolates account lookup, admission and retry persistence
for each due Site. A failure for one Site cannot stop the remaining due batch.
Every pause, claim, completion and retry matches the selected owner, active
account, saved cadence and due time. After claiming work, updates also require
that worker's exact lease, so a delayed worker cannot clear a replacement lease.
Disposable PostgreSQL fixtures exercise failed account lookup, lease replacement,
ownership transfer and schedule edits with a controlled admission adapter.
Independent native worker fixtures provide the separate execution evidence.

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

Candidate limitations still requiring implementation or acceptance include
working/failing/incomplete/recovery fixtures for every advertised item, keyboard
coverage beyond safely exercised declared popups and inspectable open components, embedded controls, visual focus
assessment, remaining shared action consumers, capacity/fault coverage and real provider, private-storage, notification,
MCP-client and observed owner sessions. Passing fixtures or the unit suite does not
satisfy those release requirements. The integrated main checkout is not deployed
or release accepted.

## Legacy stage adapter

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

Legacy Audit recovery, completed-result publication and expired Site RunRequest
recovery use independent two-minute callbacks and distributed claim windows.
Each callback retains its own overlap guard. A failed or slow legacy operation
cannot stop completed findings or abandoned requests from being reconciled, and
a failed individual legacy candidate does not end its remaining batch.

Completed-result recovery excludes live Audit claims and live finalizers before
applying its batch limit. It selects the least recently touched candidates,
using the existing status/activity index and deterministic ID ordering. Fenced
execution claims and releases already advance that activity clock, so an oldest
failed publication yields to untouched work on the next pass. Completion dates,
evidence and the canonical idempotent projector stay unchanged. Disposable
PostgreSQL cases reproduce starvation behind a failed oldest result and a held
claim, verify later publication, then recover the original interrupted result.
An owned progressive case publishes its missing comparison while retaining
incomplete coverage and an inconclusive Site result. These are local recovery
proofs, not production scheduling or notification-provider acceptance.

Expired Site request recovery also excludes unfinished progressive Audits before
applying its batch limit. Their physical executor owns settlement even after the
historical request lease or recovery window expires. One shared eligibility
predicate governs sweep selection, per-Site selection and the guarded terminal
write. It explicitly includes missing and null historical engine metadata, since
negating a JSON-path comparison does not include SQL nulls. A renewed lease, a
completed observation or newly acquired progressive ownership prevents the
abandonment write. Local PostgreSQL cases recover both abandoned and completed
requests beyond 100 protected rows, retain those physical executions, and
exercise historical null variants and ownership changes during recovery.

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
| `GET /api/health/worker`  | Redis, worker, queues, browser, execution deadlines and current monitoring obligations                                                                        |

Worker execution diagnostics use `health/execution.ts` for one bounded,
read-only repeatable snapshot of the oldest unfinished Audit and overdue work.
Progressive work uses its recorded recovery deadline or original admission-time
fallback, independently of whether a worker ever started it. The dispatcher and
task engine use that same recovery-window foundation. Legacy execution retains
its depth-dependent budget, with creation time only for never-started work.
Terminal observations and post-completion enrichment stay outside the overdue
execution cohort. A contended or unavailable read exposes null evidence and
`audit_unavailable`; it cannot invent zero overdue work. The route uses one
captured clock for execution and monitoring. HTTP 200, response fields and
deployment-readiness separation remain unchanged. Disposable PostgreSQL cases
exercise the actual route with controlled healthy infrastructure, expired queues,
stored and fallback deadlines, valid longer execution, legacy depths, terminal
history and an actual ledger lock. They do not establish deployed worker health
or sustained production monitoring.

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
| `lib/audit/pipeline/run-page.ts`              | Per-page stage orchestration              |
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

All audit `Page.screenshot` calls share `browser/capture-screenshot.ts`. The helper
uses Playwright's native operation timeout, capped at five seconds and shortened
by the caller's deadline. Journey and public-flow frames use a 1.5-second cap.
Expired work does not start a physical capture. Load-frame sampling also respects
its observation window, and frame uploads inherit the existing execution deadline.
No race abandons a live screenshot while claiming its browser capacity is free.
Optional viewport capture failures retain independently collected DOM,
accessibility, console and layout facts; missing images remain failed media.
A controlled native font request demonstrates capture timeout, continued page
interaction, retained journey assessment and later healthy capture.

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
| Desktop + mobile screenshots | `captureScreenshots`         | One native profile at a time; desktop required                                                                                                                                    |
| CTA flow scan                | Deferred primary desktop session | `runFlowScan` after checks when the current deadline allows; failures → `skipped`                                                                                                                                 |
| Slow 3G replay               | `pipeline/run-page.ts`       | `runSlowReplay` when deadline budget > 30s                                                                                                                          |
| Network engagement           | Desktop + mobile sessions    | Merged `networkFailures`; `journeySafe` on flow capture                                                                                                             |
| Technology profile           | Primary desktop session      | Up to 300 deduplicated public resources plus allowlisted document headers and runtime markers; no extra navigation, bodies, cookies, queries, or authorization data |
| Journey templates            | `runner.ts` (Pro+)           | Inline before finalize; not a separate queue job                                                                                                                    |
| Visual evidence              | `finalize-from-outcome.ts`   | Graceful; must not fail audit                                                                                                                                       |

The deferred CTA walk retains its network failures and current form probe in
the originating page's evidence, and stores the serialized walk on the Audit.
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

Watch retries run bounded passes every thirty seconds, starting six seconds after
worker initialization. Each alert's saved `watchNotificationNextAttemptAt` owns
its backoff, replacing the former global four-minute rate window and five-minute
timer. Null retains immediate eligibility for historical and initial work. Due
and inactive-lease predicates apply before the batch limit, with oldest activity
and identity ordering. Local passes cannot overlap; conditional database claims
protect delivery across workers. Direct delivery also respects the selected due
time and compares it again in the claim, so an intervening deferral cannot be
bypassed. Watch and uptime share exponential backoff starting five minutes after
a failed attempt and capped at six hours. Unreadable classification receives a
thirty-second deferral without consuming a provider attempt, conditional on its
selected status, attempt count, lease and due time. Acceptance and opt-out clear
the saved due time. No separate retry queue or global batch owner is required.

Notification selection applies current Site preferences to both the count and the exact Flag destination. OFF also disables recovery messages. Confidence and impact survive diff projection. Provider rejection and missing delivery configuration consume bounded claims; a confirmed provider ID records SENT, which proves acceptance rather than inbox delivery.

Watch and uptime prepare the exact message before claiming delivery. One
conditional write freezes that body, checks the previously selected payload,
rechecks current permission and consumes the bounded attempt. There is no
separate payload write after permission admission. Invalid preparation retains
the original payload and uses the existing failed-attempt policy. A claim
delayed by database contention cannot start a provider call unless its full
20-second request window remains. Disposable database regressions reproduce
permission changes at body persistence, concurrent claims, changed payloads,
invalid preparation and delayed admission. The existing worker and installed-SDK
fixture also preserves exact retry bodies, keys and late-acceptance fencing.

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

All shared Resend SDK requests and automatic-account receiving retrieval use
one team-wide capacity boundary before physical transport. Resend's default
allowance is 10 requests per second across every team API key. The existing
atomic Redis lock spaces application requests by 125 milliseconds, leaving
headroom. Web and worker clients use the same key, without retaining credentials
or reserving an unbounded future queue. Admission waits at most five seconds
and fails closed if Redis cannot establish capacity. Cancellation and late Redis
replies cannot authorize a later request. No delivery status, message body or
idempotency key is changed by admission. Existing notification retry ledgers own
failed attempts. Their 20-second request deadline includes this wait; receiving
retrieval similarly retains one eight-second total deadline. Two disposable
Redis/SDK cases exercise separate clients with different keys and an unanswered
admission command. They establish local pacing and cancellation, not real team
capacity, outside API consumers or provider acceptance.
[Resend usage limits](https://resend.com/docs/api-reference/rate-limit)

Notification retry batches exclude inactive accounts and removed Sites before
applying the batch limit. Classification itself requires a completed, dated
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

Each immutable delivery also records its first-attempt time in that same claim.
Resend retains idempotency keys for 24 hours. A replay must fit its complete
20-second request within that window, checked both before claiming and before
calling the provider. A late ambiguous delivery remains FAILED with unconfirmed
acceptance; its key is never rotated to bypass expired deduplication. Historical
snapshots without this metadata use the original observation time as a
conservative bound. A first delivery with no previous attempt starts its own
window even when the observation is older. Restoring an earlier Watch selection
retains that selection's original time. This private metadata never enters the
provider body. [Resend idempotency retention](https://resend.com/docs/dashboard/emails/idempotency-keys)
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

Top-level checkout uses that same bounded surface observation. A checkout URL
and HTTP 200 do not establish usable checkout entry. Blank, loading, challenged
or disabled surfaces remain `checkout_surface_unavailable`, without a customer
Flag or the generic interrupted-probe retry path. Known HTTP failures and visible
checkout errors retain their existing failure semantics. Native Chromium fixtures
cover direct Buy navigation, cart-to-checkout navigation and usable entry.

Binding receipts record `checkout-entry-v2` separately from customer configuration
versions. Current health, binding evidence and the last successful verification
require that positive proof. Recorded URL-only conclusions remain in history.
Reconciliation cannot upgrade an older success during interruption recovery, and
a diagnostic JourneyReview cannot substitute for the binding execution receipt.
That receipt already owns idempotency. A stricter success evaluator can verify
recovery from a genuine older failure under the same admitted responsibility;
an older URL-only Clear cannot establish the healthy interval before recurrence.
Disposable PostgreSQL cases preserve both boundaries without changing history.
The real application, queue and worker cycle keeps the original Flag open through
blank checkout, independently verifies usable checkout, then preserves recurrence.
These are local browser and execution observations, not production or payment proof.

Recorded repairs share the existing Improvement Attempt and cycle ledger across Site, API and MCP paths. A request key identifies one declared repair within its Improvement. Exact retries return the original receipt, including completed outcomes, without another attempt or event. A changed declaration under that key returns `FIX_INTENT_MISMATCH` (HTTP 409). Historical receipts without a recorded request hash retain their original receipt; their original payload cannot be reconstructed. Commit and deployment references are declared provenance, not proof that those changes were deployed.

MCP repair handoffs include the stable verification request key required by the
registered tool schema. Following `record_fix.next` can therefore start execution
without inventing another argument, and retries retain the same attempt and run.
An admitted receipt's follow-up supplies only `runId` to `get_run`, matching its
advertised schema. The installed-protocol claim fixture checks that continuation
after replaying a repair of a real recurring finding.
`get_flag` returns its exact source Flag identity, check, lifecycle status,
verification state, affected paths and stored recovery rule from the shared Site
projection. Tool errors remain failed interactions even when their JSON-RPC
transport succeeds; a successful inconclusive observation is a separate fact.
The `follows authenticated MCP repair handoffs` fixture exercises the actual
stateless HTTP handler, hashed scoped credentials, database and worker, including
read-only write refusal, cross-owner privacy, completed replay and revocation.
This establishes local protocol behavior, not acceptance by a live editor or
external MCP client.

The `20261012060000_fix_attempt_commit_reference` migration persists commit references, freezes keyed or admitted repair intent in PostgreSQL, and removes the older constraint limiting a source to one pending repair. Distinct repairs may coexist while an earlier verifier runs. The database protects source, builder, handoff, references, description and request identity after freezing. Legacy unkeyed, unadmitted drafts retain guarded preparation updates. Native conflict-safe materialization preserves existing Improvement and occurrence history under concurrent first-fix requests.

Reconciliation selects the attempt named by a targeted run, rather than whichever pending repair happens to be newest. Recording and projection share an Improvement lock. A result updates its attempt and original incident proof; only the latest repair updates the Improvement's current verification status. The original Flag's first confirmed resolution remains intact. Board and detail show checking only for an admitted, unfinished verification of the current source scope in the same Site, including interrupted finalization. History evaluates each attempt's own admitted scope. A readiness record alone does not establish checking.

Result publication conditionally updates only a pending or inconclusive attempt
under that same lock. An observation prepared before another run settled the
repair cannot overwrite its conclusive outcome, verification reference or
evidence. A rejected stale write does not update incident state, the Improvement,
cycle events, lifecycle telemetry or verified learning. Existing original-scope
rules still allow independent recovery of an inconclusive attempt. A subsequent
monitoring failure creates a recurring occurrence in the same Improvement while
retaining the successful repair's original receipt. This uses the existing
attempt and cycle ledgers without another result store or workflow.

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

Page recovery, Search comparison, verifier persistence, Performance measurement
conditions and Tracking page identities share `improvements/verifier-scope.ts`.
It preserves path, query delimiters and browser fragments: `/pricing`,
`/pricing/`, `/#/pricing/` and `/#/help` retain their own observation scopes.
The existing bare-root key, host and default-port normalization are unchanged.
Verification coverage no longer has its own lossy normalizer. Redirect
equivalence requires observed protocol evidence, rather than removing a slash
from every serialized URL. See [RFC 3986 section 6.2.4](https://www.rfc-editor.org/rfc/rfc3986.html#section-6.2.4).

Historical receipts and scope keys are retained. Their full recorded page URL
continues to supply exact comparison scope when available. An old opaque
measurement hash cannot reconstruct a path delimiter or fragment removed before
hashing; missing comparable conditions remain inconclusive. Fresh evidence uses
the shared exact identity. Representative discovery selection may still group
similar destinations for bounded review, while admitted physical requests and
recovery evidence retain their original URLs.

Finding ownership also uses the exact navigation key. A native finding on one
fragment state cannot suppress an independent page observation merely because
both states share their HTTP document. Tracking phase keys and measurement
conditions retain the same page scope. Historical immutable comparisons are not
rewritten, and an old fragment-free receipt cannot acquire missing browser-state
proof through normalization.

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
