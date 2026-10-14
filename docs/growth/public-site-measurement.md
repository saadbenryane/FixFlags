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
`G-5GEP9X4ZWG`. Pageviews on browser history changes are enabled in the stream;
keep that as the single navigation tracking path instead of adding a second
manual pageview sender. `NEXT_PUBLIC_GA_ID` must be supplied when building the web
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

Google reporting access and public research permissions are separate. Site
settings now include an explicit, optional research opt-in, locally verified
and awaiting deployment. The cookie
choice controls optional product analytics; the Google connection authorizes
Site-scoped traffic/search context. Neither substitutes for the Site research choice or a reviewed source manifest.
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
| analyze_started | The product recorded an analysis start. |
| first_useful_result | The product recorded usable evidence. |
| site_claimed | The analyzed Site was saved to an account. |
| analysis_claimed | One exact anonymous analysis was newly claimed, with a private owner/Site receipt. |
| watch_enabled | A monitoring schedule was enabled. |

Browser marketing events use the existing analytics-consent gate. An opaque
journey_id connects consented page activity to the analysis handoff in the same
tab. Page identifiers exclude query strings. Targets describe fixed interface
actions, not user URLs, emails, prompts, or evidence. Shared navigation does not
measure private Site or account routes.

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
cohort. Results and later claims follow the exact joined starts. A missing
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
