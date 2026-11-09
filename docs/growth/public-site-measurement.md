---
status: supporting
authority: operations
reviewed_at: 2026-10-11
supersedes: []
---

# Public site measurement

Evaluate the supporting pages by the useful product experience they lead to.
Preserve the homepage sections and establish a baseline before claiming an improvement.

## Events and attribution

The Google tag uses advanced Consent Mode. All four Google storage and advertising
consent types default to denied before configuration. GA4 can send cookieless
measurement signals before a choice and after a necessary-only choice. Optional
cookies, custom funnel events, the journey key, click-ID capture, Google Ads, and
Meta remain behind explicit consent. Withdrawal updates the loaded Google tag and
clears FixFlags attribution storage.

Cookieless signals do not establish a count of distinct visitors or sessions.
Google only includes unconsented activity in reports when the property meets its
[behavioral modeling prerequisites](https://support.google.com/analytics/answer/11161109),
including at least 1,000 denied events per day for seven days and 1,000 consented
daily users on seven of the previous 28 days. Below these thresholds, GA4 reports
can still omit unconsented visits. Do not describe those reports as total traffic.

Production uses property `541892062`, stream `15085844419`, and measurement ID
`G-5GEP9X4ZWG`. The production stream currently counts browser-history changes
automatically. `NEXT_PUBLIC_GA_ID` must be supplied when building the web
bundle. Reporting credentials (`GA4_PROPERTY_ID` and `GSC_SERVICE_ACCOUNT_KEY`)
are currently available on the Railway worker. Do not copy or print the credential
when using it locally. Read-only access is sufficient for reports and inspections;
the configuration command requires Analytics Editor access.

Read-only GA4 and Search Console report requests succeeded on 2026-10-13 using
the worker's existing reporting configuration. The aggregate-only evidence is
saved in `metrics/reporting-access-2026-10-13.json` for 2026-09-15 through
2026-10-12. GA4 reported 45 users, 48 sessions and 70 pageviews; Search Console
reported 5 clicks and 81 impressions. These sources have separate denominators
and calendar conventions. They do not establish a Site, signup, paid conversion,
or public research permission.

`scripts/growth/inspect-reporting-access.ts` requests only aggregate reports for
the known FixFlags properties with Google read-only scopes. It never imports a
database client, persists a growth artifact, or prints a credential, journey
identifier, search query, or raw provider error. In an authorized reporting
environment, run:

```bash
node --import tsx scripts/growth/inspect-reporting-access.ts 2026-09-15 2026-10-12
```

Google reporting access and public research permissions are separate. The
cookie choice controls optional product analytics. The Google connection
authorizes Site-scoped traffic and search context. Public research requires
the separate Site research choice and a reviewed source manifest.
Continue to use the boundary in
`research-governance.md` until permitted evidence is established.

The stream registers the event-scoped `journey_id` dimension for consented
attribution and redacts email patterns and sensitive URL parameters, including
authentication tokens, authorization codes, and submitted website URLs. Client
signup events also exclude email from the GA4 payload. The separate advertising
enhanced-conversion path remains consented.

| Event | Meaning |
| --- | --- |
| marketing_page_view | A supporting page opened. |
| marketing_interaction, navigate | A header, footer, or main supporting-page action was selected. |
| marketing_interaction, expand | Coverage detail or sample provenance opened. |
| marketing_interaction, copy | The retained demo fix prompt was successfully copied. |
| guide_analyze_clicked | A consented visitor selected Analyze from the guide or guide index. This replaces the guide's generic Analyze interaction after release. |
| analyze_started | The product recorded an analysis start. |
| first_useful_result | The product recorded usable evidence. |
| site_claimed | The analyzed Site was saved to an account. |
| analysis_claimed | One exact anonymous analysis was newly claimed, with a private owner/Site receipt. |
| watch_enabled | A monitoring schedule was enabled. |

Browser marketing events use the existing analytics-consent gate. An opaque
journey_id connects consented page activity to the analysis handoff in the same
tab. Withdrawing consent clears the key in the current tab. Granting consent
again on the mounted homepage records a fresh landing event with the new key,
which can also accompany a later Analyze request. Page identifiers exclude query
strings. Targets describe fixed interface
actions, not user URLs, emails, prompts, or evidence. Shared navigation does not
measure private Site or account routes.

The browser `started_audit` event uses the consented tab key for acquisition
measurement. The exact Audit identifier stays in the first-party receipt and
application handoff. A November 9 read of the production GA4 metadata returned
`journey_id` as a reportable custom dimension and no `audit_id` dimension.
[GA4 reporting metadata](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/getMetadata)

Explicit browser analytics payloads omit internal account, Audit, parent
Audit, and Flag identifiers. Flag events keep the stable product check type
and presentation context. Signup advertising uses its existing separate
consented conversion and deduplication calls.

The local implementation excludes Site, Report and comparison URLs, legacy
share links, password reset pages, CLI approval pages, and auth continuations
to those destinations from browser analytics and ad click capture. The responses
send a no-referrer policy because the URLs can carry product record IDs or
credentials, including inside the auth `next` parameter. The public sample and
ordinary signup retain the existing consent gate.

The exclusion also removes optional report views, Flag detail events, and
browser signup conversions from the protected URLs. Use the existing first-party
analysis, completion, and exact claim receipts for product value measurement.
An earlier browser event series can have broader coverage. The checks cover
document entry and suppression after a client navigation commits. Automatic
history collection by an already-loaded tag remains a separate release concern.
[Google tag URL and referrer defaults](https://developers.google.com/analytics/devguides/collection/ga4/reference/config)

A November 9 read of the production web stream confirmed that Enhanced
Measurement and browser-history pageviews are enabled. Google documents
history pageviews as independent of the tag's initial pageview setting.
[Google Analytics pageview settings](https://developers.google.com/analytics/devguides/collection/ga4/views)

### Controlled pageview candidate

Build with `NEXT_PUBLIC_GA_PAGEVIEW_MODE=controlled` to exercise the local
sender. The server supplies the same finite route labels used by the public
page export. The sender disables the initial automatic GA4 pageview and
queues one view per committed allowed path. Query-only changes do not count
as a new pageview. A return from an excluded page starts a fresh view without
passing the excluded page as a referrer.

Page context uses the public path as its title, retains bounded campaign
labels and a consented Google click ID, and drops other query values and
fragments. External referrers are reduced to origins. Internal referrers
use an allowed path with its query removed. This mode covers Google pageview
and shared page context. Provider-side behavior and Meta collection need
separate validation.

The default build mode is `automatic`. Production activation requires approval
to turn off browser-history pageviews for the exact web stream and deploy the
controlled build. Confirm the stream setting before enabling the new sender
to avoid duplicate views. In the authorized read-only reporting environment,
supply the intended build's `NEXT_PUBLIC_GA_ID` and
`NEXT_PUBLIC_GA_PAGEVIEW_MODE` to the preflight.

```sh
node --import tsx scripts/growth/inspect-ga-pageview-cutover.ts
```

The preflight checks the exact property, web stream, measurement ID and
production origin. It exits successfully only when the stream explicitly
reports browser-history collection or Enhanced Measurement disabled. Omitted
settings remain unverified. The receipt verifies the provider prerequisite
and the supplied build settings.

```sh
SEO_VERIFY_ORIGIN=http://127.0.0.1:3000 node --import tsx scripts/growth/verify-ga-pageview-documents.ts
```

Use the document verifier against the built candidate with its configured
canonical origin. The command above assumes the build uses that loopback
origin. The verifier checks the exact server-delivered public path list in
the canonical homepage and study guide.
Its receipt describes HTML and does not execute the client bundle. Verify one
view each for initial load and public
navigation, plus the absence of private route data, in an authorized test
stream. At 18:45 UTC on November 9 the preflight matched the production
web stream and returned `browser-history-enabled`.
[Google Analytics manual pageviews](https://developers.google.com/analytics/devguides/collection/ga4/views) ·
[GA4 Enhanced Measurement settings](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1alpha/EnhancedMeasurementSettings)

The live HTML read at 18:47 UTC found both canonical pages without the
controlled marker. The isolated production build used serving revision
`3e7453bc20d3d79c3e72730c64ee90d0af9c4ed7`, an eight-file analytics overlay
with SHA-256 `e5d2d5c39af04022c1ff22ae7c7dcdcd389c635490e7af48d3345f4b3f898783`,
and a synthetic measurement ID. Its prerendered files matched. At 18:49 UTC
both documents served over loopback also matched with the canonical host.
This is HTML verification of the isolated build. Browser and provider
runtime remain unverified.

A November 9 read-only GA4 report filtered the production host and web stream
to the `/share/` path prefix from October 9 through November 5, 2026. The
aggregate showed no positive pageview count. The request returned no individual
URLs or tokens. The result leaves historical token collection unresolved.

Use `inspect-reporting-access.ts` with `--route-privacy` for a bounded GA4 check.
It requests ungrouped views for fixed path families on the production host
and stream, with the homepage as a control. The result contains presence,
absence of a metric row, or unavailable evidence. It contains no counts or
individual paths. On November 9 the control returned a positive aggregate in
both windows. The September 15 through October 12 window also returned a positive
aggregate for Site paths. The October 9 through November 5 window returned no
metric row for any sensitive route group. An empty report leaves collection
unresolved.

The FixFlags page export requests only registered public route labels on
that host and stream and filters the provider rows again before writing.
The checked-in September page export is now a filtered historical projection.
Earlier Git history and previously stored reporting artifacts require
separate review.

The browser counts `started_audit` and sends Meta `Lead` only when the check
response confirms a new admission. A reused response emits `audit_reused`
for behavioral reporting. An unclassified response can still open its Site.
Historical `started_audit` totals could include reuse and cannot establish the
number of new admissions by themselves.
A November 9 read confirmed `started_audit` is a GA4 key event counted once
per event, and `audit_reused` is outside the key-event list.
[GA4 key-event reporting access](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.keyEvents/list)

Internal issue-library navigation uses `ff_entry=issue_page` for the analysis
handoff. The marker identifies the declared public entry surface, not an organic
discovery channel. Existing external campaign tags are carried through index,
related and CTA links without replacement. Unprovided tags stay absent; repeated,
blank, control-character or over-200-character values are not forwarded. Only
the three existing source/medium/campaign tags are forwarded, excluding unrelated
query fields and ad click IDs. The input accepts one known public surface marker
only for its default landing context. Explicit source props and private forms
take precedence. This adds no cookies or persistent browsing state and leaves
the analytics consent gate in place. Old internally generated issue/organic UTMs
must not be counted as verified organic acquisition.

Consented guide Analyze links carry one allowlisted `ff_guide` label to
`/new`. The check endpoint accepts the label from the public Analyze referrer
only for a new anonymous start with a consent cookie and a valid tab journey
key. The API also requires consent before sending the journey key to the
start receipt, even if a client submits a well-formed key without consent.
It removes guide and journey markers from stored referrers even when the
referrer cannot qualify for attribution. The original Audit source and
campaign fields keep their existing meanings. Reused checks do not get a
new start receipt. Browser referrer suppression, denied consent, and missing
journey keys all leave the guide unavailable. A retained label is a declared
entry and can come from a copied link.

Use the read-only `acquisition` inspector's `guideEntries` for each guide's
mature starts, processing receipts, exact claims, and independently recorded
repair results. Those counts are subsets of the existing Homepage cohort.
The provider report separates guide landing sessions, pageviews, and Analyze
clicks. Landing sessions count sessions whose first pageview path was the
guide. The report contains no journey identifiers. These counts cannot
estimate conversion from all guide visits or isolate the effect of an
editorial change.

## Weekly review

Compare entry page and device cohorts across analysis starts, first useful results,
Site claims, and saved monitoring schedules. Use the existing Admin analytics
lifecycle views for product progression and the consented marketing events for
navigation and exploration. A sample copy is product exploration, not a real fix.

Report cohort counts, the observation period, failures before useful results,
running checks, and missing attribution. Browser consented sessions and total
operational events have different denominators. Do not combine them into a single
conversion rate unless they are joined by the recorded journey key.

Read support questions alongside these counts. Repeated confusion about coverage,
signup, or monitoring setup is a reason to revise the relevant guide. Waitlist
interest does not establish willingness to pay. Low-volume changes are directional
observations, not statistically established conversion improvements.


## Comparable journey windows

The Admin landing-to-value join counts opaque tab journeys, not GA sessions,
visitors, or people. GA exports now retain the reporting timezone and whether
GA reports sampling, thresholding, or grouped-row data loss. Those limitations
make the export partial even when all returned keys are valid.

Joined starts must fall within the export's calendar dates in its reporting
timezone and occur no later than the extraction cutoff. The server queries that
complete observation window independently of the operational 30-day start
cohort. A later claim requires an exact analysis claim receipt dated at or
after the start and linked to the audit's current active Site and owner.
The Admin funnel keeps retained claim counts visible and withholds the
claim rate when missing source audits or unproven owner transitions could
change it. A missing
reporting timezone, invalid date window, or missing event timestamps withholds
rates rather than displaying zero. Legacy exports need a fresh read-only pull
before they can support a comparable join.

A matching tab key establishes an observed join, not causal attribution or
proof of the order of individual pageviews. Processing lag and incomplete GA
coverage still apply. Keep observed journey conversion separate from total
operational progression and revenue until those joins are separately verified.

## Search summary definitions

Search totals come from a separate property-aggregated, ungrouped report. The
sum of returned query rows may omit hidden queries and must not stand in for
property totals. `returnedQueryClicks`, `returnedQueryImpressions`, and
`queryClickCoverage` retain that limitation. `brandedShare` is the share of
property clicks visible in returned branded query rows, not proof of the full
brand/non-brand distribution. Page reports use page aggregation and cannot be
summed into property totals.

`pagesWithSearchImpressions` counts returned pages with impressions in the
window. It is not an indexing census. `indexedPages` is withheld as `null` until
independent indexing evidence exists. Empty property reports leave total clicks,
impressions, CTR and position unknown rather than replacing them with query-row
totals. Both export summaries record their requested dates; inclusive API date
ranges now contain the requested number of calendar days. Current-day GA data
and recent finalized Search Console coverage may still be incomplete. Historical
snapshots retain their original data but cannot be read using the corrected
definitions without re-exporting them.
