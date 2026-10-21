---
status: supporting
authority: engineering
reviewed_at: 2026-10-12
supersedes: []
---

# Uptime monitoring

An owned, eligible Site with monitoring enabled receives one public HTTP probe per five-minute schedule slot. Its full website analysis continues on the saved analysis cadence. Pausing monitoring stops both schedules. Probes use the existing public fetch capacity and strict public URL validation, including redirects, with an eight-second response deadline after local HTTP admission and a bounded response body. They do not use browser credentials or full-analysis credits.

Basic uptime is included separately on every plan, including Free. Its eligibility
requires an active account, a non-deleted Site and an enabled monitoring intent.
The saved analysis interval, analysis allowances, entitlement grants and next
analysis date do not authorize or revoke five-minute HTTP reachability. An
analysis schedule halted by an entitlement change cannot strand uptime setup,
dispatch, observations, history or notifications. Explicitly pausing the Site
clears its monitoring interval and still stops both schedules.

One eligibility function supplies initialization, execution, read projections
and alert delivery. These paths do not query billing grants. Notification claims
retain current owner, account lifecycle, monitoring intent, recipient, preference,
incident and target-generation fences, independently of analysis billing changes.
Controlled closed-beta-policy fixtures exercise default setup, real HTTP, BullMQ
and PostgreSQL while grants expire or are revoked, and with a halted legacy
analysis clock. Healthy uptime observations and notifications continue without
subscription changes, complete analyses or scan credits. Simulated-provider
fixtures retain one delivery identity across grant changes; explicit pauses,
suspension and target changes remain enforced. These checks do not establish
production scheduling or real-provider acceptance.

Local HTTP admission is independently bounded and excluded from recorded response
duration. A caller's execution deadline still caps the whole operation. Exhausted
local capacity or a shorter execution deadline leaves unknown evidence; only an
actually started request exhausting its full response budget can establish a
response timeout. A controlled native HTTP fixture reproduces four seconds of
local waiting followed by a healthy six-second response. Installed BullMQ and
disposable PostgreSQL execution record that response as online, retain its actual
response duration, and create no failure confirmation or incident. Focused
fixtures separately retain genuine eight-second response failure and bounded
execution uncertainty. These checks do not establish production capacity.

The `uptime-probes` BullMQ worker starts with the existing worker runtime. Durable monitor due times survive queue failures. A database lease and the unique monitor, target version, slot, and attempt identity prevent overlapping work and duplicate observations. After downtime, the scheduler issues the current slot and skips missed slots.

The scheduler reads the shared clock for each initialization, dispatch attempt and
publication. A slow earlier Site cannot stamp a later probe with an old slot.
Workers complete their current Site and target authority reads before claiming
the observation lease, then recheck the slot and lease before the HTTP request.
Expired preparation leaves the due intent available for a fresh attempt and
cannot create a probe or an incident. Tests advance controlled clocks across
slow queue and database work, then exercise the real persistence path.

Due monitors rotate by their oldest dispatch attempt, with never-attempted monitors
first. A persisted `lastDispatchAttemptAt` records the attempt before queue
publication, so a failed publication or a queued job awaiting execution cannot
occupy every bounded batch. The write checks the selected owner, target,
schedule, monitor generation, due state and worker lease. It does not advance
probe due times or establish a successful observation. Failed work remains due
for a later turn, including confirmation jobs using their original failure slot.
Target changes, resumed monitoring and expired confirmations reset the dispatch
position as the monitor synchronizes its new work.

Reconciliation treats a selected row as a hint. Under the monitor lock it reads
the current Site and recomputes whether synchronization is still required.
Expired confirmation cleanup cannot clear an active observation lease or erase
a newer success or failure confirmation. Dispatch rechecks the resulting due
times before publishing. Disposable PostgreSQL regressions interleave selection
with actual probe execution and a Site target change, retaining the committed
observations, pending confirmation, lease and incident history.

Queue publication also revives retained failed or completed jobs when the
database still requires their slot. A completed job can have skipped observation
because another worker's database lease had not expired. The existing BullMQ
identity and worker claim remain unchanged; replay cannot create a duplicate
probe or incident. Future confirmations wait for their original due time before
reviving a terminal job. Installed-worker fixtures exercise exhausted delivery
and an abandoned lease, then establish recovery through an actual observation.

Scheduling, notification delivery and history retention run independently, with at most one local sweep of each operation in flight. A slow email provider or cleanup cannot block probe dispatch. The uptime heartbeat describes scheduling readiness; notification failure remains in its delivery receipt. Shutdown stops worker intake immediately, drains admitted maintenance and active probes, and closes the producer only after dispatch finishes. Paused and deleted Sites do not consume the bounded dispatch batch. Restarted schedules can reactivate an existing disabled monitor without replacing its identity.

Notification processing also isolates each receipt within a batch. Interrupted
claims defer only the still-eligible selected receipt without consuming a provider
attempt. Failed deferral cannot stop later receipts. A claimed attempt keeps its
lease, frozen payload and provider idempotency key when retry persistence fails;
expired-lease recovery resumes that same delivery identity. Disposable PostgreSQL
fixtures exercise claim, retry-write and deferral failures alongside independent
acceptance, stale permissions and late senders. The email provider is controlled
in these fixtures; acceptance does not establish real inbox delivery.

Monitor initialization also isolates each Site. Automatic default setup and
uptime-monitor creation share a persisted one-minute setup retry on the Site.
Bounded sweeps select untouched Sites before due retries. A full failing batch
cannot monopolize later sweeps; failed Sites remain eligible when the retry is
due. Owner, target and unchanged setup-state fences protect retry writes, while
explicit pause fields retain their separate authority. Successful setup clears
its retry without replacing existing monitor identity or evidence. Existing due
probes continue independently of initialization. A disposable PostgreSQL fixture
injects setup failure, covers a full failing prefix and unsafe retained targets,
verifies independent dispatch, then
verifies setup and dispatch for the failed Site on retry. No full-analysis
credits or Audit rows are consumed.

The separate dispatch fixture exercises the installed BullMQ producer and worker
against isolated Redis, with migrated disposable PostgreSQL and shared summary
reads. It verifies independent dispatch and retry without a customer browser
session, preserves the existing monitor identity, and records three successful
observations. A further fixture holds the oldest monitor's queue publication in
failure, observes a later Site through the real worker, then recovers the retained
monitor on retry without creating an incident or consuming analysis credits.
Its HTTP responses are controlled at the document adapter. It
does not establish production scheduling, real network behavior or provider
acceptance.

Probe execution loads account lifecycle status at admission, immediately before
the public request, and while committing the observation. A suspended account
cannot execute queued probes or publish a late recovery from an in-flight
request. Reactivation resumes the same monitor identity and retained incidents.
Disposable database fixtures exercise both suspension boundaries and reactivation.
Execution and history reads share a typed account selection that requires
lifecycle status. A suspended account's earlier observations remain historical,
while overview and detailed history both show monitoring paused.

A failed origin observation schedules one confirmation after 30 seconds. Two conclusive failures open an incident. A successful observation of the same target generation records recovery. Bot challenges, access blocks, rate limits, unsafe targets, DNS infrastructure failures, and internal execution failures remain unknown. Unknown observations neither open nor recover incidents. Changing the target supersedes earlier open incidents without claiming recovery.

Recognized peer-certificate refusals use this same failure and confirmation
policy. Expired, not-yet-valid, wrong-host, explicitly untrusted self-signed,
revoked and malformed certificate evidence retains a specific reason from the
Node/OpenSSL error code. Messages alone cannot establish one of these failures.
Unknown issuers, incomplete local trust and client TLS configuration remain
unknown. A refused TLS connection records no invented HTTP status or final
response URL. History presents the reason through its existing details view.
The underlying TLS client still verifies certificates and hostnames normally.
[Node certificate error definitions](https://nodejs.org/download/release/v22.23.3/docs/api/errors.html#openssl-error-codes)

A disposable HTTPS fixture reproduces an expired certificate remaining unknown,
then verifies the correction through eleven installed-worker observations with
PostgreSQL and Redis. It serves CA-signed expired, hostname-mismatched and valid
certificates, plus an untrusted self-signed certificate. The client trusts only
the fixture CA for that transport, retains the recorded hostname and never
disables certificate verification. Missing issuer trust stays unknown without
recovering the incident. Three consecutive inconclusive observations expose the
separate operational coverage gap once prior conclusive evidence expires. A fresh
recognized certificate refusal clears that coverage gap while retaining the
website incident. A valid TLS connection whose HTTP 200 body is interrupted
also stays unknown, retaining the observed status and final URL without sending
a recovery notification. The original underlying error retains its existing
classification; response facts alone cannot turn that failed read into ONLINE.
A later complete HTTPS response independently recovers it,
and a later expiry opens the next incident. Probe history, pending outage and
recovery receipts, original monitor identity and unchanged analysis usage are
checked. The fixture advances its explicit clock and promotes due queue jobs;
it proves controlled local execution, not natural production scheduling or
notification acceptance.

The worker diagnostic distinguishes overdue probes from sustained inconclusive
observation through `inconclusiveUptimeSites`. Recent unknown state with current
target-generation history spanning more than the ten-minute freshness window,
and no conclusive ONLINE or FAILED observation within that window, needs operator
attention even if every queue job completed on time. Initial and short uncertainty
retain grace. Old generations, other targets and future observations cannot renew
this responsibility. The existing operator uptime queue and summary use the same
indexed, read-only cohort. Overdue work takes precedence so each Site appears
once. This measures a current evidence gap, not historical on-time fulfillment or
a website outage. These reads never open or recover incidents or send alerts.

Overview reports 48 half-hour periods. A period is green only when all expected observations are recorded and successful. Missing or inconclusive observations remain neutral; a confirmed failure is marked separately. The 24-hour, seven-day, and 30-day history views include bounded pages of raw response evidence and incident history. Durations describe the interval between observed failure and recovery, not exact downtime. No uptime percentage is computed.

`GET /api/sites/:siteId/uptime` requires the Site owner. It accepts only `24h`, `7d`, or `30d`, with a cursor scoped to that monitor, generation, and window. Each page returns at most 100 probes. The validated Site projection exposes Uptime only to authorized owner callers and refreshes enabled summaries every minute while idle.

Overview and detailed history share the same projection and eligibility policy. Overview reads the observation samples and unresolved-incident count needed for its summary, without loading paginated probe rows or detailed incidents. Read paths do not import the queue or execution service.

Each incident has one persisted outage receipt and one recovery receipt. Delivery rechecks notification preferences, current monitoring eligibility, and target generation. Confirmed public unavailability is treated as critical for critical-only notifications. Recovery alerts also require the recovery preference. Leases and a stable provider idempotency key protect delivery retries. Failed delivery is retried with bounded exponential backoff, up to eight attempts. Receipt status remains available in the database; an observation is not a notification delivery receipt.

Uptime and Watch alerts share one SDK sender with a 20-second physical request
abort deadline and an explicit provider-acceptance requirement. Uptime stores
the exact provider body before sending. Subsequent retries preserve it across
sender configuration changes and refuse to reuse it for a different owner,
recipient or incident. The physical database claim also compares current Site,
account, preferences, target generation and attempt ceiling. Completion writes
require the claimed status, attempt and lease, so an expired sender cannot
overwrite newer acceptance or release another sender. An expired final claim
becomes failed uncertainty without another provider request.

The batch due-time cutoff stays fixed, while claim, acceptance and retry clocks
advance with elapsed work. Each receipt receives its lease when its own delivery
begins. Earlier slow provider requests cannot expire a later lease before sending
or consume the later receipt's retry delay. Failed delivery backoff and interrupted
claim deferral start at their observed failure time. Attempt and lease fences,
frozen provider bodies and receipt idempotency keys retain their existing scope.

The additive `20261014060000_freeze_uptime_notification_payload` migration stores
these snapshots without inventing historical provider bodies. Existing receipts
retain their original provider key; an older uncaptured body cannot be recovered
retroactively. Local migrated-database fixtures cover immutable retries, changed
recipients, stale batch permissions and late expired senders. Controlled installed
SDK tests exercise request abortion and acceptance parsing. These checks do not
prove real-provider acceptance or inbox delivery.
The slow-batch fixture advances four provider calls by 19 seconds each and holds
the fifth while a concurrent sweep runs. It verifies one live fifth attempt and
its final acceptance. Separate cases verify failure-time backoff and claim deferral
without changing the stored message or consuming an unclaimed provider attempt.

Raw probe history is retained for 30 days. Incident records, including unresolved incidents, are preserved. The migration creates no historical observations. Existing screenshot recording times remain null; new screenshots receive a recording timestamp. The preview identifies its exact audit, viewport, and URL, and labels retained evidence during a new analysis.

Reachability incidents never update rendered-page assessments, verification attempts, or Flags. Existing default page-availability verification is linked inside Uptime details. Separately named availability checks remain in their existing category details.

Local verification uses the focused component, API, safe-fetch, worker, and disposable PostgreSQL tests. Automated browser and end-to-end tests require a separate explicit request. Production deployment is outside this change.
