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
