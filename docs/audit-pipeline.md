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
The board and website list overlay only the applicable category's current evidence.
Failed, missing or unfinished required work cannot reuse an older passing answer.
API, MCP and category history use the immutable comparison and shared assessment.
Local worker acceptance covers Search rechecks, Security repair and recurrence;
live-provider and production acceptance remain separate requirements.

Owned Site admission persists automatic public availability through the existing
Outcome and binding contract. Free defaults to weekly checks; eligible paid
accounts default to daily checks. The first check is due immediately. Claiming
migrates provisional identity and bindings before adding a missing default.
Worker upkeep initializes untouched existing Sites and retains explicit pauses,
custom schedules, names and historical evidence. These defaults do not depend on
email delivery configuration or an active customer browser session.

Anonymous Site admission retains the supplied HTTP(S) origin, including its port
and host spelling, separately from hostname identity. Claiming commits Audit
ownership, provisional Site redirection, page and Outcome migration, and default
monitoring in one serializable transaction. Claim replay checks the linked Site's current owner before restoring it or writing identity and intelligence. A report possession proof cannot authorize another owner's Site; a refused claim retains its cookie for recovery. Disposable PostgreSQL fixtures exercise this ownership boundary alongside evidence continuity and rollback. Colliding Outcome slugs receive distinct internal
slugs while retaining their original IDs, bindings and history. Matching labels
do not authorize merging responsibilities. Duplicate page associations merge
without violating their unique keys. Scheduled Watch selects production
Outcomes; a staging responsibility cannot prevent production uptime admission.

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
stale connections on monitored, non-deleted Sites and reads at most two providers
at once. It refreshes dated context about daily, independently of a Site's weekly
analysis cadence, preserves prior observations on failure, and stops admitting
later connections when its scheduler lease is lost. Credential and grant fences
remain the authority for reads and commits. These local fixtures do not establish
real Google acceptance or notification delivery.

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

Site Security coverage consumes the public security evaluator's current
resource-transport assertion together with its HTTPS observation. Older explicit
image-transport receipts retain their historical scope, but cannot override a
current resource result. Failed, incomplete or advisory assertions cannot provide
the positive evidence used by the Site card. The unused parallel module-coverage
reader has been removed; Site coverage continues through the shared receipt model.

Mobile layout collection uses one document-visibility predicate for font samples,
button radii, input sizing and primary-action selection. Zero-size, hidden and
transparent content cannot populate those measurements. Below-fold controls
retain their document positions, and a descendant that explicitly restores CSS
visibility remains observable. Hidden submit labels cannot replace a visible
search input's own label. These remain top-document observations and advisory
layout signals, not proof of visitor behavior or device-specific usability.

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

The existing public flow task commits primary-action presence, click, advancement
and main-frame response observations. Failed findings and repair assertions use
the same recorded page, viewport and hashed control identity. Navigation URLs and
declared panel relationships retain their original scope without exposing signed
query values in finding copy. Native buttons and declared button roles share CTA
selection. A completed click alone cannot establish action advancement or a
completed signup, payment or other business outcome.

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
controls, declared and undeclared dialog repairs, and recurrence through a real
scheduled Site check while PageSpeed is explicitly unavailable.

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

PageSpeed normalization retains bounded resource audit measurements alongside
its established failed-opportunity projection. Score, render-blocking resources,
unused JavaScript, unused CSS and image delivery have exact repair assertions.
Detection and proof share the existing savings thresholds and units. Image
recovery requires the consolidated current insight or every supported legacy
image responsibility. Missing, errored, informative and not-applicable provider
audits remain unknown. An explicit successful empty result table can establish
zero matching resources. The provider adapter follows the
[Lighthouse insight contract](https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/insights/insight-audit.js).
Historical opportunity lists without positive measurements cannot certify
resource recovery. A complete assertion remains useful when an unrelated audit
is unavailable, through the same comparison used by explicit verification and
automatic recovery. Field-window INP retains its separate limitation.

Desktop and mobile PageSpeed results share the same resource detector and
measured-audit assertions for render blocking, unused JavaScript, unused CSS and
image delivery. Mobile findings retain separate registered identities and
`pagespeed-mobile` source observations. Desktop measurements cannot verify their
repair. Missing resource audits remain incomplete rather than becoming zero
savings. Targeted mobile repairs request only the mobile provider measurement,
reusing the existing task graph and comparison contract. The local worker
fixture exercises healthy desktop alongside failed mobile resources, an
unavailable mobile audit, complete mobile repairs and scheduled recurrence with
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
an unchanged failure, independent repair and scheduled recurrence, preserving the
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
access restrictions and scanner refusals remain unknown. Preview-image response
and content-type evidence do not establish full image decoding or a platform's
rendered preview.

Public link discovery commits source-page scoped response assertions alongside
its findings, using the same response classification as targeted repair. Shared
destinations use the existing bounded discovery sweep; publishing observations
does not add a second normal-scan fetch. Repair admission retains every affected
source page, and each originally failed destination must provide comparable GET
proof before the Flag closes. Removed links, changed destinations and access
restrictions remain inconclusive. Recurrence reopens the existing Improvement
and preserves the original Flag's resolution.

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
cannot certify recovery. Category checks include the cross-page responsibility.
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

The shared browser session uses native per-hop request interception because
Playwright bypasses user routing callbacks for HTTP redirects. Preview headers
stay on their configured origin, while redirected requests reuse the public-target
and action policy. Embedded renderers attach before their requests execute; worker
networking remains with its owning renderer. HTTP methods, bodies, real responses
and final browser URLs are preserved, without replaying protected requests.
Capture profile identity includes this request-policy version. Controlled native
fixtures verify authenticated navigation, private-target rejection, iframe scope,
worker rendering and one authorized cart request followed by a refused external
POST. Real-provider and deployed-runtime acceptance remain separate requirements.

Privileged account and configured Signup sessions pass their request policy to
this same native boundary. The policy runs once for each physical hop, including
redirected requests, without duplicating stateful admission in Playwright routes.
Browser events retain the worker's admitted async context, so request-time
permission transactions enforce execution ownership and lease fences. The
configured Signup policy refuses mutations before submission admission and
rechecks the exact fixture version and authorization before further mutations.
Account requests retain their current preference, operation and one-mutation
checks. Recognized telemetry stays suppressed by the shared guard and cannot
consume an account operation or make read-only inspection inconclusive.

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

HTML compatibility reads and raw HTTP documents share a bounded transport with
one deadline and origin-scoped configured headers. Same-origin preview access
continues across redirects; other origins receive ordinary public request headers.
Redirect responses are cancelled before the next admitted request. Response-body
timeouts after headers arrive remain incomplete body evidence and cannot establish
a missing-response outage. Physical local HTTP fixtures exercise both consumers.

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

Sample and time limits, unsafe or unsupported triggers, frames, shadow roots,
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

Recognized event collection is intercepted before transmission in Audit page
sessions, independently of the protected-action guard. These intentional refusals
do not fail unrelated customer flows. Library transfers still execute. Service
workers are blocked to maintain route ownership; worker-mediated and embedded-frame
behavior remains outside the observed scope. Tracking tests do not accept consent.
Existing action walks may dismiss consent UI, so their consent state is not inferred.
Absent attempts and browser blocking never manufacture missing-event failures.

HTTP library failures produce scoped findings and repair guidance. Repair proof
requires every originally failed page, provider, endpoint and phase. Finding collapse
retains all contextual targets. Only conclusive assertion receipts committed in the
same Run can contribute to combined proof, with their supporting task references.
Diagnostic admission selects the recorded failed pages and adds the existing
action walk only for phases that require it. Derived scope selection does not
change retry identity; the admitted execution snapshot owns the actual work. Unsupported or unobserved scopes remain unverified.

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
Section-link evaluation uses exact captured identifiers and named anchors,
resolves declarations against the observed document base, and decodes fragment
targets without lowercasing them. SEO and CTA placeholder checks share this
native-target lookup. Routing and text fragments remain outside the inspected
scope. Receipts contain at most 300 distinct targets; additional targets remain
unknown without discarding failures already observed. Current findings bind
each missing target to its requested/final page, capture profile and access
conditions. Targeted rechecks inspect all originally affected documents without
adding provider, media or unrelated action work. Missing or changed links and
historical normalized identifiers cannot certify repair. The Chromium, migrated
PostgreSQL and Redis worker fixture proves two-page detection, partial repair,
challenge uncertainty, removed/changed scope, complete repair and recurrence on
the same Improvement. These checks establish declared document targets, not
click handlers or scroll behavior.

The public link fixture runs discovery over two source pages, commits their
failed GET observations, and exercises unchanged, blocked, removed-declaration
and repaired targeted runs through the application, database, queue and worker.
Every original source scope must pass before resolution. A subsequent Watch
failure records regression on the same Improvement and retains the first Flag's
verified resolution. This controlled fixture does not establish production
transport, external-provider acceptance or notification delivery.
Primary-action fixtures exercise a failed CTA navigation, access restrictions,
an HTTP 200 challenge, replaced or removed controls, a competing working CTA,
independent repair and scheduled recurrence through migrated PostgreSQL, isolated
Redis, real Chromium and the worker. They also collect and verify missing primary
actions, disabled native and ARIA controls, and a dead end repaired by its declared
visible panel. Source identity, recorded fix attempts, Flag closure and first
resolution survive these transitions. Deeper destination semantics, unsupported
action types and extended live behavior retain their separate verification limits.
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
The separately selected `CONSOLE_DB_REQUIRED=true` worker scenarios exercise
delayed console errors and unhandled exceptions, a partial repair on a second
page, mobile-only evidence after desktop refusal, an unavailable mobile window,
redirect comparability, complete repair, recurrence and bounded console floods.
These observations cover recorded windows, not every later interaction or
JavaScript execution state.
Accessibility collection retains each actual axe rule's passed, failed,
unresolved or inapplicable outcome, with engine version and the desktop capture
scope. A failure-only list cannot certify a repair or a healthy automated
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
The Performance fixture seeds historical findings from the real HTTP collector
and detector, then exercises six fresh diagnostic admissions through the
database, queue and application worker. Missing resource audits keep a repair
inconclusive; measured repairs resolve their exact source Flags. Stored receipts
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

Rendered metadata input retains the one-million-byte parser bound. When direct
head or body script implementation and hydration text exceeds that bound,
collection preserves the complete DOM and registered analytics and consent
markers in an inert document. Script attributes, styles, JSON-LD and nested
script text remain intact. This avoids running custom-element constructors or
changing the live page. If the remaining DOM still exceeds the bound, metadata
stays unavailable and the observation cannot certify recovery.

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
path. Headline evidence checks the first visible H1 against the existing
12-character threshold. Primary action evidence requires a visible, enabled
control in the viewport. Signup field observations exclude hidden ancestors.
A reduced field-count repair still requires at least one visible field. A
bounded link search cannot establish a missing path when more than 80 anchors
exist. Blank, challenged, failed-document or restricted observations remain
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
reranked links, changed destinations, blank pages, challenges, independent
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

The current catalog's 108 responsibilities have explicit stable coverage identities and
registered evaluator mappings. The capability report exposes partial coverage;
registration is not execution proof. Capability check inventories derive from
the check registry rather than a second list of finding identities.
Outcome verification, Flag verification, prompt copying, settings and connection
actions use shared submission ownership and operation-specific response contracts.
Verification keeps its idempotency key after an uncertain response. Site refresh
validates the complete projection and matching identity before replacing the
recorded view; malformed responses retain visible disconnected evidence.

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

Candidate limitations still requiring implementation or acceptance include
working/failing/incomplete/recovery fixtures for every advertised item, keyboard
coverage beyond safely exercised declared popups, nested components, embedded controls, visual focus
assessment, remaining shared action consumers, capacity/fault coverage and real provider, private-storage, notification,
MCP-client and observed owner sessions. Passing fixtures or the unit suite does not
satisfy those release requirements. The integrated main checkout is not deployed
or release accepted.

## Legacy stage adapter

```
audit job (BullMQ, always):
  QUEUED → CAPTURING → CHECKING → JUDGING (triage) → FINALIZING → COMPLETED

ai-review job (optional, gated):
  prescription LLM → FINALIZING → COMPLETED (sets aiReviewAt)
```

Legacy triage runs inline in the audit job. Prescription runs in a separate async job after triage completes. Progressive execution uses the task graph above.

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
| `AI_PROVIDER_NOT_CONFIGURED` | Scanner temporarily unavailable |
| `AUDIT_TIMEOUT`              | Took longer than expected       |
| `AI_REVIEW_FAILED`           | Partial AI review               |
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

Production scans use **Playwright + Chromium** only (`lib/audit/screenshot.ts`, `lib/audit/browser/page-session.ts`). Do not use chrome-devtools-mcp, chrome-devtools-axi, or conversational browser agents on the audit path.

| Step                         | Where                        | Notes                                                                                                                                                               |
| ---------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop + mobile screenshots | `captureScreenshots`         | Parallel pages; desktop required                                                                                                                                    |
| CTA flow scan                | Deferred primary desktop session | `runFlowScan` after checks when the current deadline allows; failures → `skipped`                                                                                                                                 |
| Slow 3G replay               | `pipeline/run-page.ts`       | `runSlowReplay` when deadline budget > 30s                                                                                                                          |
| Network engagement           | Desktop + mobile sessions    | Merged `networkFailures`; `journeySafe` on flow capture                                                                                                             |
| Technology profile           | Primary desktop session      | Up to 300 deduplicated public resources plus allowlisted document headers and runtime markers; no extra navigation, bodies, cookies, queries, or authorization data |
| Journey templates            | `runner.ts` (Pro+)           | Inline before finalize; not a separate queue job                                                                                                                    |
| Visual evidence              | `finalize-from-outcome.ts`   | Graceful; must not fail audit                                                                                                                                       |

The deferred CTA walk retains its network failures and current form probe in
the originating page's evidence, and stores the serialized walk on the Audit.
Capture and walk findings are deduplicated before judgment. Browser contexts
close even when the walk throws. Verification receipts are written after the
walk; skipped or timed-out walks do not establish completed flow coverage.
The walk budget is checked after capture and preserves the minimum judge budget.

`lib/audit/deterministic-audit.ts` is an **offline/demo probe** (accuracy scripts, flow demos). It is not the production entry point.

Technology detection is versioned and deterministic in `lib/audit/tech-detect.ts`. Audit-owned normalized observations preserve the exact profile shown on the signed-in Product detail page. Only a complete latest audit may reconcile the knowledge graph’s current stack; partial captures never infer removals. Update-review stack changes are shown only when parent and child used the same detector version.

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

Notification retry batches exclude inactive accounts and removed Sites before
applying the batch limit. The sender also checks current Site ownership before
classification. Its physical delivery claim compares the recorded account,
Site, recipient email, current preferences and attempt ceiling. A change after
the initial read cannot admit a new provider request using stale permission.
Confirmed acceptance and live claims retain their existing ownership contract.
If a recorded comparison cannot be read, retry upkeep records the preparation
gap and moves that row behind other due alerts without consuming a provider
attempt or changing an active sender. The local worker fixture covers stale
permission changes, forty older ineligible rows, and an unreadable comparison
ahead of an active owner's alert.

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

Recorded repairs share the existing Improvement Attempt and cycle ledger across Site, API and MCP paths. A request key identifies one declared repair within its Improvement. Exact retries return the original receipt, including completed outcomes, without another attempt or event. A changed declaration under that key returns `FIX_INTENT_MISMATCH` (HTTP 409). Historical receipts without a recorded request hash retain their original receipt; their original payload cannot be reconstructed. Commit and deployment references are declared provenance, not proof that those changes were deployed.

MCP repair handoffs include the stable verification request key required by the
registered tool schema. Following `record_fix.next` can therefore start execution
without inventing another argument, and retries retain the same attempt and run.
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
Ordinary page capture cannot supply slow connection provenance. A successful
targeted repair resolves older equivalent deterministic occurrences with positive
source evidence, preserving other controls, pages and failures created after the
verification began. The `collects faithful slow connection timing` disposable
worker fixture exercises blocked navigation, a competing action, independent
repairs, occurrence recovery and subsequent monitoring recurrence. These are
local simulated observations, not deployed or real-device performance proof.

`FIX_INTENTS_DB_REQUIRED=true node scripts/verify-progressive-execution.mjs -t "immutable fix intents"` exercises concurrent first-fix recording, database immutability, distinct later repairs, exact worker reconciliation, completed replay and changed-payload refusal in migrated disposable PostgreSQL and isolated Redis. This local fixture does not establish deployed migration, production queue or external-provider behavior.

Targeted Outcome recovery consumes a completed assessment from the exact tenant RunRequest, attempt, source Audit and Outcome. Required binding keys, environment and recorded scope must match the failure, with positive execution evidence. Reconciliation projects those assessments before issuing the fix verdict. Missing, blocked, changed or unrelated scope remains inconclusive. Optional PageSpeed gaps do not invalidate a completed Checkout binding; legacy report comparisons keep their existing full-review coverage rules. A failed Outcome cannot resolve its Flag merely because a particular diagnostic row disappeared.
