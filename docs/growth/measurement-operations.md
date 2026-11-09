---
status: supporting
authority: operations
reviewed_at: 2026-10-20
supersedes: []
---

# Growth measurement operations

Use fresh, scoped observations with explicit windows. Missing credentials, reports,
observations or mature follow-up are unavailable evidence. A recorded zero is
appropriate only for an observed absence within an available source.

## Configuration and reporting readiness

```sh
node --import tsx scripts/growth/inspect-growth-readiness.ts 2026-09-15 2026-10-12
node --import tsx scripts/growth/inspect-growth-readiness.ts 2026-09-15 2026-10-12 --live
```

The default checks the actual process environment without contacting a provider.
It checks each known FixFlags GA4 property, Search Console property, credential
presence, browser measurement configuration and operational database presence
separately. It never prints configured values, credential paths or exceptions.
A present credential is unverified. Browser environment presence does not prove
that the deployed bundle was built with it. A missing prerequisite does not
become a traffic, signup or conversion zero.

`--live` reuses `lib/growth/reporting-access.ts` with the supplied inclusive
calendar window. It requests only the existing FixFlags aggregate GA4 and
finalized Search Console web-search reports with read-only scopes. Arbitrary
properties are refused. It makes no GA configuration changes and writes no
database or artifact. Partial provider reports remain partial; a successful
request with no metrics does not establish zero activity. The report retains
source, window, extraction time and existing provider limitations. Nonzero exit
means a requested live report could not be fully accessed.

The known production measurement targets are documented in
[public-site-measurement.md](public-site-measurement.md). Reports use each source's
calendar conventions. Consent, reporting lag, sampling, thresholds, grouped-row
loss and hidden search queries limit interpretation. The browser journey is an
opaque consented tab key, not a person or GA session. Search impressions are not
an indexing census, and position is not a live ranking. Do not combine these
sources into a conversion rate without the existing validated join.

For a guide baseline, use the same read-only inspector with a registered guide
slug or `guides-index`. Run it in the authorized reporting environment with
explicit, finalized dates:

```sh
node --import tsx scripts/growth/inspect-reporting-access.ts 2026-10-09 2026-11-05 --guide website-online-but-not-working
```

GA4 filters the exact production web stream `15085844419`, public hostname
and guide path, then reads page views and the consented
`guide_analyze_clicked` event in separate reports. A third report counts
sessions whose first pageview path was the guide, using the same host and
stream filters and omitting query strings. Landing sessions distinguish
entries from later navigation. They cover all channels represented in GA4.
The guide readout requires the production stream and an unlimited provider
receipt before displaying a GA4 count. The new
event begins with the release that emits it. Historical guide Analyze clicks
were general interaction events. GA4 does not expose the old action or target
parameters as reportable dimensions on this property. Search Console filters
the canonical page URL and requires confirmation of page-level aggregation.
Reports contain counts only, with no query rows or journey IDs. Empty results
remain unavailable. Keep these aggregates separate from the guide starts,
claims, and repairs in the operational report.

Add `--ai-referrals` to request one separate aggregate for the production
host and stream. With `--guide`, the report covers sessions whose first
pageview path was that guide. Without it, the report is sitewide. The
report selects GA4 sessions labeled `referral` from exactly `chatgpt.com`,
`claude.ai`, `copilot.microsoft.com`, or `perplexity.ai`. The request
returns a single count without source rows, referrer URLs or tab identifiers.
GA4 source labels can come from campaign tags. Missing referrers, other labels,
and visits outside GA4 are beyond this measure. The guide readout keeps it
separate from recorded AI-answer citations, search clicks and verified repairs.
[GA4 session dimensions](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema) ·
[GA4 traffic source tagging](https://support.google.com/analytics/answer/11242870)

Guide reports also check finalized web-search coverage one date at a time
on the unfiltered FixFlags property. This uses Search Console's Pacific
calendar. The exact guide total is read after the coverage check and stays
separate from it. The report retains the number of dates present and the
first missing date, without daily property metrics. Search Console omits
dates without data, so an omitted date leaves the window unconfirmed.
The guide study retains a reported total for reference but requires full
window coverage for a directional decision. Historical receipts without
this check can still describe the total returned at the time.

See the provider definitions for
[GA4 report dimensions](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema)
and [Search Console page filters](https://developers.google.com/webmaster-tools/v1/searchanalytics/query).

The private admin landing report uses consented tab keys from the GA4
`landing_view` event at `fixflags.com/` in production property
`541892062` and web stream `15085844419`. The pull pins the property and
filters the stream, hostname, page path, and event before requesting the
keys. Pulls for other properties skip this report. The routine pull
requests the same number of calendar dates as the other GA4 reports,
ending nine UTC date labels earlier to
leave a full seven days of follow-up across reporting timezones. A joined
start must share the exact key and fall within the exported dates in the
reported timezone. The completion receipt must date from admission through
seven days after the start receipt. The exact claim must date from that
start through the same deadline. Dispatch can complete before the start
receipt is written.

The admin report shows observed counts from partial exports and withholds
their percentages. The provider check treats a mismatch between the total
row count and returned rows, or reported truncation, as partial coverage.
Version 3 snapshots retain their observed counts and require a fresh
version 4 pull for percentages. Outcome percentages require a mature reporting window
and enough retained evidence to resolve joined outcomes. These are shares
of exported, consenting browser tabs. The joined evidence does not
establish traffic-wide conversion or customer usefulness.

The pull joins provider tab keys in memory against a bounded, read-only
snapshot of retained start, completion, and claim receipts. It stores the
aggregate counts and their calculation time at the existing report path.
The snapshot reflects evidence retained at calculation time. A later pull
recomputes it. Provider keys and operational receipt identifiers are
excluded from the stored payload and the pull result. The admin requires
the same source scope on the stored aggregate. Older exports without
that scope remain unavailable until a scoped refresh replaces the report.
Legacy exports at other paths require separate cleanup.

To inspect a fixed landing window from the authorized reporting and database
environment without refreshing the stored admin report, run:

```sh
node --import tsx scripts/growth/inspect-landing-value.ts 2026-10-04 2026-10-31
```

This command makes one scoped GA4 request and runs the existing join in a
read-only transaction. `startReceiptCoverage` counts retained anonymous
start receipts in the same reporting calendar window, including those with
a usable tab key and those with an exact match to an exported landing key.
These are counts of start receipts across acquisition surfaces. Multiple
starts can share one tab. An unkeyed or unmatched start does not identify
its source or establish why the key is missing. The command leaves
percentages unavailable when provider or receipt coverage is partial. A November 9
worker run returned a mature window with partial coverage because a landing
event had no usable tab key. The database retained anonymous starts for the
same dates, and none carried a usable key. The serving revision has the key
writer. The aggregate cannot distinguish consent, entry path, or telemetry loss.
Keep the receipt in private operator storage.

Google documents sampling, restrictions and truncation separately from the
total row count, which can exceed the returned rows.
[GA4 report metadata](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/ResponseMetaData) ·
[GA4 reporting guide](https://developers.google.com/analytics/devguides/reporting/data/v1/basics)

Readiness leaves operational cohorts explicitly not requested. Reuse the existing
aggregate inspector with an authorized local loopback PostgreSQL environment:

```sh
node --import tsx scripts/growth/inspect-customer-value.ts 30 acquisition
node --import tsx scripts/growth/inspect-customer-value.ts 30 sites
node --import tsx scripts/growth/inspect-customer-value.ts 60 sites28
node --import tsx scripts/growth/inspect-customer-value.ts 30 cycles
node --import tsx scripts/growth/inspect-customer-value.ts 60 outcomes
```

The existing queries retain read-only transactions, bounded source reads, exact
claim receipts and repair lineage. `sites` preserves the seven-day follow-up
default; `sites28` selects a complete 28-day follow-up. The first numeric argument
is the claim lookback window, not the follow-up duration. For example, a 60-day
lookback gives older claims an opportunity to mature for 28 days. Immature Sites
are counted separately and excluded from every outcome denominator. Reports
record their selected `followupDays`; only compare matching follow-up windows.
These counts remain observed operational evidence, not human retention or revenue. Keep their source
window and limitations beside the output. This command cannot establish cash
received, public research permission or total acquisition coverage. Do not export
raw customer rows or copy a production credential into a local file.

The `sites` and `sites28` reports include private `guideEntries` counts for
mature Sites whose first retained claim matches the exact consented guide
start and occurred within seven days of that start. An older retained claim
prevents a later start from acquiring credit for the Site. The follow-up window
starts at claim, so a verified improvement from a later monitoring audit can
count. The rows also distinguish a completed scheduled check from an
owner-attributed web request at least one day after claim. An empty guide list
means no qualifying records were observed. These counts describe a
subset of claimed Sites, including pre-existing Sites. Keep them separate from
guide visits, Analyze clicks, and the anonymous-start cohorts. The report
includes no per-guide rates or identifiers.

The Site reports also count a prepared repair copied through the website
when its retained task receipt matches the owner's clipboard
acknowledgement within the same claim follow-up. The source Flag, audit,
and improvement cycle must belong to that Site. Legacy copy requests,
investigation tasks, and unmatched acknowledgements stay outside the
count. The report counts each Site once and omits prompt hashes, task
details, and rates. A clipboard acknowledgement does not establish
implementation or verified improvement.

The reports separately count Sites where a frozen verification attempt was
recorded after that acknowledgement for the same improvement cycle, source
audit, and exact Flag set. The result must come from a completed independent
verification within the same claim window. A second count isolates verified
improvements from the other outcomes. Older copy receipts without the Flag set
can still count as acknowledgements. These linked observations establish
sequence and scope. They cannot establish whether the copied task caused the
result.

The Site reports and guide study readout include a count of independently
verified public-link repairs. Each Site counts once when a Flag from the
versioned public-link response check reaches an improved result and the
independent verification audit was admitted at or after the claim. Both
admission and the result must fall within the Site's follow-up window. This
count covers the check behind the study's destination examples. It does not
identify the original HTTP status, confirm a booking or other interaction, or
establish that reading the guide led to a repair.

Two counts describe what happened after a verified public-link repair within
the same Site follow-up window. A comparable scheduled recheck requires a
completed production Watch run requested after the verified result. It must
retain the original public-link check version and observe the frozen repair
scope. The module receipt must be retained by the Site follow-up cutoff and
match its completed task, audit and page. A pass requires all original captures
to pass. A repeat failure needs a comparable failure on at least one of those
captures. Both counts are per Site. A skipped, blocked, incomplete, or unrelated link check leaves that
repair's follow-up unobserved. A recorded pass only describes the recheck.

The `sites28` report also includes `nativeOutcomeFollowup` totals and per-guide
counts. A Site can qualify for native recovery when the original failed
request and its independently verified recovery both start at or after claim and
finish inside the 28-day Site window. The normal receipt checks still require
matching ownership, Outcome, binding, and failure-to-recovery lineage.
The recovery can count even when its seven-day follow-up would end after
the Site window. In that case it is excluded from the mature follow-up,
recurrence, and owner web check counts. The owner count requires an
owner-attributed production web request at least 24 hours after verified
recovery, with a matching completed audit by day seven. It measures
observed repeat check usage. It does not establish a return visit,
customer retention, or causation. Each count uses Sites as the unit.
Keep these counts separate from the improvement-cycle measures.

For a release evaluation, fix the dates of eligible analysis starts and rerun
with those same dates as follow-up arrives. This example uses the baseline date
labels, with the final day exclusive at UTC midnight.

```sh
node --import tsx scripts/growth/inspect-customer-value.ts acquisition --start-window 2026-10-09 2026-11-06
node --import tsx scripts/growth/inspect-customer-value.ts sites28 --start-window 2026-10-09 2026-11-06
node --import tsx scripts/growth/inspect-customer-value.ts destination-study --start-window 2026-10-09 2026-11-06
```

Use `destination-study` for the [registered guide experiment](experiments.md#assemble-the-readout).
It requires 28 closed UTC days and emits the guide's acquisition, Site
and recovery counts from one read-only snapshot. Search and analytics
still come from their separate provider report.

Fixed-window `acquisition` includes anonymous starts inside the interval.
Fixed-window `sites` and `sites28` include only Sites first claimed from an
exact consented guide start inside that same interval. A claim can arrive
up to seven days after its start, including after the window closes. Once
claimed, the Site has its own seven- or 28-day follow-up. The reports publish
their end and maturity timestamps and withhold shares until the whole window
is mature. Allow seven days after cutoff for acquisition, 14 for `sites`,
and 35 for `sites28`. The reports use current retained records. Corrections,
owner changes, and deletions can change a rerun. The date labels do not align
individual records with GA4 or Search Console, which have their own timezones.

An acquisition claim must be dated at or after its exact retained start
and no later than seven days after it. A receipt before the start or beyond
follow-up has its own diagnostic count. Neither receives claim credit in
the seven-day cohort. This matches the ordering already used by the
guide-attributed Site and billing reports.

In `acquisition`, the `processingEvidence` counts partition mature anonymous starts.
A qualifying completion receipt takes precedence. Without one, a retained
completed audit with coherent start and completion timestamps is counted inside
or after the seven-day follow-up. Other starts have no dated completion or no
usable source audit. Use this split to distinguish receipt coverage from
processing evidence before investigating the claim transition. These are
retained records as of the report, and a missing dated completion does not
establish failure, abandonment, or a missing report view. The study readout
retains this partition for starts that qualify for its guide. It also counts
claims with a completion receipt for the same analysis within follow-up.
The paired count distinguishes those claims from claims with missing completion
telemetry. It measures receipt coexistence, without inferring the order of
events or whether the owner saw the result. Older snapshots may lack these
guide diagnostics.

The `processingGaps` counts split the retained starts with no dated
completion receipt or usable completion timestamp. A failed audit can have
a coherent terminal timestamp before the start receipt, inside follow-up,
or after follow-up. A missing or inconsistent terminal time stays in a
separate bucket. A nonterminal status is a snapshot observation and gives
no proof that work is still active. `recordedFailureCodes` counts finite
retained classifications and groups other codes without exporting their
values. It does not establish root causes. The study readout retains the
timing counts for its guide and leaves the aggregate code breakdown in the
private acquisition report.

The acquisition report also checks `admissionReceiptCoverage` against
retained provisional Site pointers and exact claim receipts. It counts
distinct mature anonymous admissions in the window, including ones with
a missing or unusable start receipt. A valid start recorded on or after
the fixed cutoff is reported separately. These gaps make the report
partial and withhold shares. They do not add starts to any guide or
reassign timestamps. A replaced provisional pointer, deleted evidence,
or an admission without either independent link can escape this check.
Use the counts as a lower bound on observable gaps.

Use `outcomes` for monitoring after an independently recorded binding recovery.
The report joins the Flag to its original failed assessment and the native
recovery receipt on the same Site and Outcome. It requires a recorded positive
result for the recovered binding and matching responsibility. A later scheduled
assessment qualifies only with a comparable version, evaluator and observed
binding result. Checkout also requires the retained purchase path evidence.
The first comparable result within seven days of recovery is counted once per
recovered Flag. `anyComparableFailure` counts each recovered Flag with at
least one comparable failure in that window, even if its first scheduled
result passed. `comparableFailureAfterScheduledPass` requires a comparable
failing request to start after a comparable scheduled pass finished.
Overlapping requests do not establish that sequence. Both counts use the
same mature recovery cohort. No retained scheduled assessment and a scheduled
assessment with unusable evidence remain separate. A later pass describes one
observation. Root cause, sustained recovery, and public research permission
require their own evidence. The report emits aggregate counts only.

## Commercial evidence

```sh
node --import tsx scripts/growth/inspect-commercial-evidence.ts 60
node --import tsx scripts/growth/inspect-commercial-evidence.ts 60 --after-claim
node --import tsx scripts/growth/inspect-commercial-evidence.ts 60 --verify-live
node --import tsx scripts/growth/inspect-commercial-evidence.ts 60 --verify-live --after-claim
node --import tsx scripts/growth/inspect-commercial-evidence.ts 60 --verify-live --after-claim --first-paid-invoice
```

The default reads a bounded ledger snapshot from an authorized loopback
database in a read-only transaction. It does not call Stripe. Ledger
occurrence dates define the window. Positive rows, zero-value settlements,
and refund records are counted separately. A retained positive amount
does not establish that Stripe captured it.

Use `--verify-live` only with permission to read the matching Stripe
account's payment records. A test or missing credential prevents provider
reads. The inspector reads at most 50 candidate PaymentIntents by exact
reference and checks the expanded Charge. Live mode, successful capture,
positive amount, currency, customer, and invoice identity when applicable
must agree. Repeated references are withheld, including those outside the
selected window. Provider objects and errors stay in memory. The output
shows aggregate matches and gross captured minor units by currency, with
missing or incompatible evidence accounted for separately.

The `--after-claim` option reads the mature owner cohort independently of
the billing ledger. It considers each active account's earliest retained
claim receipt before applying the reporting window. That receipt must name
an initial audit and a current, active Site owned by the same account. The
28-day follow-up must be complete. The report counts owners with a
current billing customer and owners with or without a matching positive
ledger invoice in follow-up. A missing ledger invoice leaves payment
unknown. The report withholds the cohort if the bounded claim scan exceeds
5,000 candidate owners.

Add `--verify-live` to read exact invoices after capture verification. A
matching live invoice must link the
same payment and customer, match the ledger amount, currency, and paid
timestamp, and fall strictly after claim and within follow-up. The report
counts invoices and distinct owners separately. Credit purchases and manually
marked payments do not qualify for this milestone. A lookback longer than
28 days allows mature claims to enter the report.

Add `--first-paid-invoice` to check whether the current Stripe customer
record's earliest positive paid invoice is among its exact, verified
post-claim invoices. It reads one page of up to 100 paid invoices per
qualifying customer and uses Stripe's recorded paid times for ordering.
Zero-value invoices are excluded. Earlier positive invoices marked paid
outside Stripe still rule out the milestone. A truncated history, a missing
or incompatible invoice, or a tie at the earliest paid timestamp leaves the
customer unresolved. Only counts and coverage diagnostics are returned.

This is a milestone for the current Stripe customer record. Prior customer
records, credit purchases, and eligible accounts without an invoice require
separate evidence to establish an account-level paid-conversion rate.

For a private guide cohort, use the same start and exclusive end dates as
the acquisition readout.

```sh
node --import tsx scripts/growth/inspect-commercial-evidence.ts --verify-live --after-claim --guide website-online-but-not-working --starts-from 2026-10-09 --starts-before 2026-11-06
```

The guide mode requires 28 closed UTC days and waits 35 days after cutoff
before any Stripe reads. The billing owner's earliest retained claim must
also be the Site's earliest retained claim. Its exact anonymous Homepage
start must carry the selected guide label and consented journey, occur
inside the window, and precede or coincide with the claim by no more than
seven days. Capture and invoice requests are restricted to matching
account-owned invoices in the claim's 28-day follow-up. The report keeps
its wider ledger counts separate from these provider matches.

Pass the aggregate file to the study readout using `--commercial-report`.
The readout checks the exact guide and start window, the 35-day maturity
cutoff, and the consistency of owner and verified invoice counts. It keeps
the billing observation time separate from the operational snapshot and omits
amounts and identifiers. The account-payment milestone remains descriptive.
Multiple invoices can belong to one owner. A guide payment match cannot
establish causal attribution or a conversion rate based on the study's
Site count.

Gross capture does not establish the date money settled, net revenue, or
the first payment after a Site claim. The new milestone establishes observed
invoice payment for an account. A paid-conversion rate still needs complete
payment-history coverage and a defined eligible account denominator. Payout
and net revenue claims need settled payment
timing, refunds and adjustments where applicable, a verified owner join,
and appropriate historical coverage. Keep this private operator report
separate from public research.

See [Stripe PaymentIntent retrieval](https://docs.stripe.com/api/payment_intents/retrieve?api-version=2025-02-24.acacia),
[Charge fields](https://docs.stripe.com/api/charges/object?api-version=2025-02-24.acacia),
[Invoice fields](https://docs.stripe.com/api/invoices/object?api-version=2025-02-24.acacia),
and [List paid invoices](https://docs.stripe.com/api/invoices/list).

## Recorded public AI answers

```sh
node --import tsx scripts/growth/evaluate-ai-visibility.ts --prompts
node --import tsx scripts/growth/evaluate-ai-visibility.ts
node --import tsx scripts/growth/evaluate-ai-visibility.ts .data/ai-visibility/observations.json
```

The fixed versioned set contains 24 branded, unbranded buying, comparison and
negative/out-of-scope prompts. Record the exact prompt in a public model interface
and retain platform, model/version and UTC observation timestamp. Never insert
customer domains, prompts, private findings or account data. The tool does not
contact models, fetch citations or make paid calls. A run with no file reports
unavailable observations, not invented responses or zero brand visibility.

Raw JSON must be a user-supplied ignored local file. The CLI checks Git ignore
status, resolves symlinks and rejects files outside the repository or over 10 MB.
It writes nothing. Do not commit the input or place it in growth artifacts. A
minimal observation shape is:

```json
{
  "publicBrandAnswersOnly": true,
  "observations": [
    {
      "promptId": "branded-01",
      "platform": "chatgpt",
      "model": "record-the-observed-model-version",
      "observedAt": "2026-10-20T12:00:00Z",
      "answer": "Replace with an actually observed public brand answer.",
      "citationUrls": [],
      "review": { "offer": "unreviewed", "mcp": "unreviewed", "capabilities": "unreviewed" }
    }
  ]
}
```

This shape is instructional and is not evidence. Platforms are `chatgpt`,
`google-ai`, `perplexity`, `claude`, `copilot` and `other`. Model labels are required
on inputs but withheld from output, along with answers and URLs. Prompt IDs must
come from `--prompts`. Exact repeated prompt/platform/model/timestamp observations
are rejected. Repeated observations on different dates or models increase the
observation count, never the prompt coverage count. Unknown fields and malformed
or private citation syntax fail without reflecting their content. Citation URLs
must use HTTPS with a DNS hostname, without credentials, query, fragment, custom
port or private FixFlags route. This syntax validation does not verify that the
cited page is public, reachable or supports the answer.

Output contains aggregate mention and citation counts, aggregate observation
window/platforms and finite per-prompt coverage statuses. An observed answer
without the literal FixFlags brand name counts as observed absence. A missing
prompt stays unavailable. Citation counts describe recorded citations; no raw
citation or answer is serialized. Input truthfulness remains the recorder's
responsibility, and the public-only declaration is not automatic privacy review.

Use `unbrandedDiscovery` to assess whether FixFlags appears without being
named in the prompt. It reports the six buying prompts separately by observed
platform label, with distinct-prompt coverage and answer counts. A branded-only
platform has unavailable buying coverage. Registered guide citations use a
finite list of public route labels and count each guide once per answer.
The label identifies the cited route. It cannot establish which edition was
shown, whether the answer used the study, or whether the cited page supports
a claim.

Manual factual review remains required. Review `offer`, `mcp` and `capabilities`
against canonical source files at the observation date, then label each
`supported`, `contradicted`, `not-addressed` or `unreviewed`. These are supplied
reviewer judgments, kept separate from observable literal counts. The report
includes current workspace public-offer copy and MCP discovery state by importing
the canonical modules. It does not duplicate pricing numbers or reinterpret a
withheld MCP discovery gate as live external-client availability. Use
`lib/billing/beta-policy.ts`, `lib/marketing/copy/plans.ts`,
`lib/marketing/copy/public-offer.ts`, `lib/mcp/discoverability.ts`,
`lib/mcp/access.ts` and `lib/docs/mcp-tool-reference.ts`. Current workspace state
is neither historical source evidence nor proof of the deployed revision.

Use matched prompt sets, platform/model versions and comparable windows when
comparing runs. Repeated observations do not prove independent demand, market
share, causal ranking improvement or that any website change caused a mention.
Technical discovery checks in [acquisition-evaluation.md](acquisition-evaluation.md)
remain separate from indexing, AI citations, customer activation and retained use.

## Search ownership and IndexNow

Set `GOOGLE_SITE_VERIFICATION` and `BING_SITE_VERIFICATION` only to tokens issued
for the actual FixFlags account. Metadata supports both. A rendered token is not
proof that an account has accepted ownership or that URLs were indexed.

`INDEXNOW_KEY` is a public verification key, 8 to 128 letters, digits or hyphens.
When configured, `/indexnow-key.txt` serves it as plain text. An unset key returns
404. Deploy the route and matching key before requesting submission:

```sh
npm run growth:indexnow -- --paths=/guides,/guides/checking-after-publishing
npm run growth:indexnow -- --paths=/guides,/guides/checking-after-publishing --submit
```

The first command prepares only registered public URLs and sends nothing. The
explicit `--submit` mode verifies the deployed key, then checks every submitted
page for an HTTP 200 HTML response, its production self-canonical, and absence of
noindex. It fails before posting if any preflight is unavailable or wrong. URLs
with query strings, fragments or unregistered/private paths are refused. Redirects
are not followed. Requests use fixed provider and production origins, bounded
bodies and timeouts. A provider 200 means receipt, 202 means pending key validation;
neither establishes indexing, ranking, citations, or traffic. No submission has
been made as part of this implementation.
