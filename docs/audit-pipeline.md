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
monitoring in one transaction. Colliding Outcome slugs receive distinct internal
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

One scheduled tick retains its admitted scope and binding selection on retries.
A replay returns the recorded selection, not newly derived coverage. A new
request cannot reuse an active broad run that lacks its current binding scope.
Bound incidents remain owned by Outcome assessments; broad diagnostics do not
rewrite them through the report comparison. Notification classification combines
both committed projections after reconciliation. Successful availability does
not certify whole-Site Clear through the run API.

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
Scope, source and admitted version must match. Keyboard and Tracking use the
same scoped proof logic for automatic recovery and explicit fix verification.
Rolling field INP does not prove an immediate repair. Unsupported proof stays
inconclusive even when the surrounding module succeeds.

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

The Audit coordinator admits a validated dependency graph and returns. Existing
`AuditVerifierExecution` rows checkpoint work; append-only `AuditPipelineEvent`
facts record claims, attempts, committed observations and terminal limitations.
The task token, generation, lease and Audit recovery deadline fence publication.
Queue delivery completion is not analysis completion.

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
same popup context, with conclusive evidence for that responsibility. Independent
proved controls can verify a repair even while another popup remains incomplete.
All failed popup scopes survive page-level finding aggregation. Geometry follows
the normalized evidence target contract; popup controls retain selectors and scope
without drawing rectangles over an initial-state capture that cannot show them.

Sample and time limits, unsafe or unsupported triggers, frames, shadow roots,
unresolved focus effects, and scanner refusals remain visible unknowns. Blocked
interactions do not erase earlier independent observations. Computed focus styles
do not certify visual contrast or every custom effect. Accessibility cards cannot
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
and structured-data parsing runs in a bounded worker thread. These defaults do
not establish production capacity; capacity and starvation acceptance remain required.

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
Confirmed customer failures are committed, not retried in pursuit of a pass.
Expired work becomes a visible unknown; completed observations and prior captures
remain intact. Finalization and completion projections are idempotent.

The legacy Audit stages remain monotonic projections of graph activity, not the
source of task ownership. Site events use private, replayable durable cursors;
clients refresh authoritative tenant-scoped queries. Neither event reconnect nor
HTTP/MCP polling performs recovery. Module execution completion is distinct from
assertion success. Current results require comparable page/configuration/source;
older receipts are explicit historical evidence.

Site coverage applies incomplete module receipts, failed module ownership, local
Search responsibilities and Tracking delivery limits before deriving overall
health. Category cards and account summaries consume these same facts. A current
observation in one area cannot establish a Clear Site while another required
area or recorded page is unresolved. Confirmed Flags remain actionable alongside
incomplete evidence. Completed partial reports retain the existing recheck action,
including runs with no fatal failure code. The independent Search worker fixture
checks agreement among the overview, account list and monitoring history using
the fully migrated disposable database and Redis queues.

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

The homepage's 104 responsibilities have explicit stable coverage identities and
registered evaluator mappings. The capability report exposes partial coverage;
registration is not execution proof. Capability check inventories derive from
the check registry rather than a second list of finding identities.
Outcome verification, Flag verification, prompt copying, settings and connection
actions use shared submission ownership and operation-specific response contracts.
Verification keeps its idempotency key after an uncertain response. Site refresh
validates the complete projection and matching identity before replacing the
recorded view; malformed responses retain visible disconnected evidence.

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

Watch parent lookup normalizes the selected URL with the same function used at Audit creation. A canonical Site root without a slash must match its persisted root-page Audit. `WATCH` provenance is retained even without a completed parent; finalization then classifies current observations as new, with no invented recovery. The retry sweep also includes those first Watch alerts.

Notification selection applies current Site preferences to both the count and the exact Flag destination. OFF also disables recovery messages. Confidence and impact survive diff projection. Provider rejection and missing delivery configuration consume bounded claims; a confirmed provider ID records SENT, which proves acceptance rather than inbox delivery.

Classification cannot overwrite a live sender or confirmed acceptance. A claim
compares the observed attempt count, and terminal delivery writes require that
exact attempt and lease. An expired sender cannot undo a newer acceptance or
release a newer active claim. Opting out cancels due or expired work while
preserving a live provider call's recorded ownership. Provider requests use a
20-second abort deadline, forwarding the signal through the installed SDK to
the actual HTTP call. Retries retain the alert's stable provider idempotency key
and five-attempt ceiling. The migrated PostgreSQL/Redis worker fixture exercises
stale classification reads, late rejection and acceptance after reclamation,
live and expired opt-outs, exact recipients and Flag links through the installed
SDK with a controlled HTTP boundary. This establishes local ledger and SDK
behavior, not real-provider acceptance or inbox delivery.

Checkout proof records the final main-frame response after navigation and checks visible checkout errors before success. Reaching a checkout URL with HTTP 503 is not Clear. Failed confirmation attempts and their response status remain recorded. A Site verification request may omit its change description; store null rather than an invented repair, preserve existing pending context on retries, and let fresh execution determine the result.

Recorded repairs share the existing Improvement Attempt and cycle ledger across Site, API and MCP paths. A request key identifies one declared repair within its Improvement. Exact retries return the original receipt, including completed outcomes, without another attempt or event. A changed declaration under that key returns `FIX_INTENT_MISMATCH` (HTTP 409). Historical receipts without a recorded request hash retain their original receipt; their original payload cannot be reconstructed. Commit and deployment references are declared provenance, not proof that those changes were deployed.

The `20261012060000_fix_attempt_commit_reference` migration persists commit references, freezes keyed or admitted repair intent in PostgreSQL, and removes the older constraint limiting a source to one pending repair. Distinct repairs may coexist while an earlier verifier runs. The database protects source, builder, handoff, references, description and request identity after freezing. Legacy unkeyed, unadmitted drafts retain guarded preparation updates. Native conflict-safe materialization preserves existing Improvement and occurrence history under concurrent first-fix requests.

Reconciliation selects the attempt named by a targeted run, rather than whichever pending repair happens to be newest. Recording and projection share an Improvement lock. A result updates its attempt and original incident proof; only the latest repair updates the Improvement's current verification status. The original Flag's first confirmed resolution remains intact. Board and detail show checking only for an admitted, unfinished verification of the current source scope in the same Site, including interrupted finalization. History evaluates each attempt's own admitted scope. A readiness record alone does not establish checking.

`FIX_INTENTS_DB_REQUIRED=true node scripts/verify-progressive-execution.mjs -t "immutable fix intents"` exercises concurrent first-fix recording, database immutability, distinct later repairs, exact worker reconciliation, completed replay and changed-payload refusal in migrated disposable PostgreSQL and isolated Redis. This local fixture does not establish deployed migration, production queue or external-provider behavior.

Targeted Outcome recovery consumes a completed assessment from the exact tenant RunRequest, attempt, source Audit and Outcome. Required binding keys, environment and recorded scope must match the failure, with positive execution evidence. Reconciliation projects those assessments before issuing the fix verdict. Missing, blocked, changed or unrelated scope remains inconclusive. Optional PageSpeed gaps do not invalidate a completed Checkout binding; legacy report comparisons keep their existing full-review coverage rules. A failed Outcome cannot resolve its Flag merely because a particular diagnostic row disappeared.
