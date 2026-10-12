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
| watch_enabled | A monitoring schedule was enabled. |

Browser marketing events use the existing analytics-consent gate. An opaque
journey_id connects consented page activity to the analysis handoff in the same
tab. Page identifiers exclude query strings. Targets describe fixed interface
actions, not user URLs, emails, prompts, or evidence. Shared navigation does not
measure private Site or account routes.

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
