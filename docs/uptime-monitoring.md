---
status: supporting
authority: engineering
reviewed_at: 2026-10-12
supersedes: []
---

# Uptime monitoring

An owned, eligible Site with monitoring enabled receives one public HTTP probe per five-minute schedule slot. Its full website analysis continues on the saved analysis cadence. Pausing monitoring stops both schedules. Probes use the existing public fetch capacity and strict public URL validation, including redirects, with an eight-second deadline and a bounded response body. They do not use browser credentials or full-analysis credits.

The `uptime-probes` BullMQ worker starts with the existing worker runtime. Durable monitor due times survive queue failures. A database lease and the unique monitor, target version, slot, and attempt identity prevent overlapping work and duplicate observations. After downtime, the scheduler issues the current slot and skips missed slots.

A failed origin observation schedules one confirmation after 30 seconds. Two conclusive failures open an incident. A successful observation of the same target generation records recovery. Bot challenges, access blocks, rate limits, unsafe targets, DNS infrastructure failures, and internal execution failures remain unknown. Unknown observations neither open nor recover incidents. Changing the target supersedes earlier open incidents without claiming recovery.

Overview reports 48 half-hour periods. A period is green only when all expected observations are recorded and successful. Missing or inconclusive observations remain neutral; a confirmed failure is marked separately. The 24-hour, seven-day, and 30-day history views include bounded pages of raw response evidence and incident history. Durations describe the interval between observed failure and recovery, not exact downtime. No uptime percentage is computed.

`GET /api/sites/:siteId/uptime` requires the Site owner. It accepts only `24h`, `7d`, or `30d`, with a cursor scoped to that monitor, generation, and window. Each page returns at most 100 probes. The validated Site projection exposes Uptime only to authorized owner callers and refreshes enabled summaries every minute while idle.

Each incident has one persisted outage receipt and one recovery receipt. Delivery rechecks notification preferences, current monitoring eligibility, and target generation. Confirmed public unavailability is treated as critical for critical-only notifications. Recovery alerts also require the recovery preference. Leases and a stable provider idempotency key protect delivery retries. Failed delivery is retried with bounded exponential backoff, up to eight attempts. Receipt status remains available in the database; an observation is not a notification delivery receipt.

Raw probe history is retained for 30 days. Incident records, including unresolved incidents, are preserved. The migration creates no historical observations. Existing screenshot recording times remain null; new screenshots receive a recording timestamp. The preview identifies its exact audit, viewport, and URL, and labels retained evidence during a new analysis.

Reachability incidents never update rendered-page assessments, verification attempts, or Flags. Existing default page-availability verification is linked inside Uptime details. Separately named availability checks remain in their existing category details.

Local verification uses the focused component, API, safe-fetch, worker, and disposable PostgreSQL tests. Automated browser and end-to-end tests require a separate explicit request. Production deployment is outside this change.
