---
status: supporting
authority: engineering
reviewed_at: 2026-10-12
supersedes: []
---

# Uptime monitoring

An owned, eligible Site with monitoring enabled receives one public HTTP probe per five-minute schedule slot. Its full website analysis continues on the saved analysis cadence. Pausing monitoring stops both schedules. Probes use the existing public fetch capacity and strict public URL validation, including redirects, with an eight-second deadline and a bounded response body. They do not use browser credentials or full-analysis credits.

The `uptime-probes` BullMQ worker starts with the existing worker runtime. Durable monitor due times survive queue failures. A database lease and the unique monitor, target version, slot, and attempt identity prevent overlapping work and duplicate observations. After downtime, the scheduler issues the current slot and skips missed slots.

Scheduling, notification delivery and history retention run independently, with at most one local sweep of each operation in flight. A slow email provider or cleanup cannot block probe dispatch. The uptime heartbeat describes scheduling readiness; notification failure remains in its delivery receipt. Shutdown stops worker intake immediately, drains admitted maintenance and active probes, and closes the producer only after dispatch finishes. Paused and deleted Sites do not consume the bounded dispatch batch. Restarted schedules can reactivate an existing disabled monitor without replacing its identity.

Monitor initialization also isolates each Site. A failed initialization leaves
that Site eligible for a later attempt while the sweep continues creating other
monitors and dispatching existing due work. A disposable PostgreSQL fixture
injects one setup failure, verifies both kinds of independent dispatch, then
verifies setup and dispatch for the failed Site on retry. No full-analysis
credits or Audit rows are consumed.

The separate dispatch fixture exercises the installed BullMQ producer and worker
against isolated Redis, with migrated disposable PostgreSQL and shared summary
reads. It verifies independent dispatch and retry without a customer browser
session, preserves the existing monitor identity, and records three successful
observations. Its HTTP responses are controlled at the document adapter. It
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

The additive `20261014060000_freeze_uptime_notification_payload` migration stores
these snapshots without inventing historical provider bodies. Existing receipts
retain their original provider key; an older uncaptured body cannot be recovered
retroactively. Local migrated-database fixtures cover immutable retries, changed
recipients, stale batch permissions and late expired senders. Controlled installed
SDK tests exercise request abortion and acceptance parsing. These checks do not
prove real-provider acceptance or inbox delivery.

Raw probe history is retained for 30 days. Incident records, including unresolved incidents, are preserved. The migration creates no historical observations. Existing screenshot recording times remain null; new screenshots receive a recording timestamp. The preview identifies its exact audit, viewport, and URL, and labels retained evidence during a new analysis.

Reachability incidents never update rendered-page assessments, verification attempts, or Flags. Existing default page-availability verification is linked inside Uptime details. Separately named availability checks remain in their existing category details.

Local verification uses the focused component, API, safe-fetch, worker, and disposable PostgreSQL tests. Automated browser and end-to-end tests require a separate explicit request. Production deployment is outside this change.
