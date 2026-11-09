# Experiments

Append-only hypothesis to implementation to outcome log. Pre-register an
intervention before editing, then append dated observations and the final
decision to the same entry. Never rewrite the baseline after seeing results.

Template for new SEO entries:

```md
## SEO-[TYPE]-[NNN] - [title]

**Registered:** YYYY-MM-DD
**Status:** planned | implemented | observing | concluded
**Target:** query, canonical page, audience, and intent
**Evidence window:** exact dates, property, country/device/search-type filters
**Baseline:** clicks, impressions, CTR, impression-weighted average position,
and one product/business guardrail
**Data caveats:** missing rows, small sample, partial period, attribution limits

**Hypothesis:** If we make [exact change], then [primary metric] should move
because [causal mechanism], without harming [guardrail].

**Exact implementation:** files and visible behavior to change
**Primary metric:** one search metric
**Guardrail:** one qualified product or business metric
**Observation window:** next comparable measurement date or recrawl condition
**Decision rule:** what means keep, revise, revert, or inconclusive
**Confidence and evidence:** low | medium | high, with dated sources

### YYYY-MM-DD observation

- Applied/deployed:
- Crawled/reprocessed:
- Comparable result:
- Confounders:
- Next action:

### Conclusion

**Decision:** keep | revise | revert | inconclusive
**Outcome:** baseline to result for the primary metric and guardrail
**Lessons learned:** reusable finding, if any
**Future recommendation:** what this unlocks or rules out
```

Search Console average position is not an exact live rank. Keep manual SERP
observations timestamped and separate from first-party performance metrics.

---

## SEO-SNIPPET-001 - Brand sitelink titles for the new care story

**Registered:** 2026-09-08
**Status:** implemented, awaiting deployment and recrawl
**Target:** query `fixflags`; canonical pages `/`, `/pricing`, and
`/partners`; people who already know the name and need the official product,
cost, or studio-delivery answer
**Evidence window:** GSC web data pulled 2026-09-08T18:50Z for a rolling
28-day window, including page×query rows; free SERP samples the same evening
**Baseline:** 7 query clicks, 53 query impressions, all branded.
Page×query shows `/pricing` (19 impressions, 0 clicks, position 9.37) and
`/partners` (21 impressions, 0 clicks, position 7.43) appear only for
`fixflags`, not for distinct commercial queries. Homepage CTR for
`fixflags` is 10.5% on apex and 27.3% on www. Production titles still use
the retired AI-QA story; Google still shows directory leftovers on the
retired tagline.
**Data caveats:** page totals still exceed joined page×query rows, so some
low-volume queries remain hidden. Sample is tiny. GA4 cannot join Google
sessions to Site starts.

**Hypothesis:** If the official homepage, pricing, and partners snippets
name FixFlags, describe the live-website check with evidence and a fix
path, and drop vague labels (`Pricing`, `Expert program`) plus retired
tagline language, then brand searchers will recognize the same product
under the care story and click the official sitelinks, without harming
brand clicks or Site starts.

**Exact implementation:** Update `lib/marketing/copy/seo.ts` titles and
descriptions for home, pricing, and partners; align roast metadata away
from grade language; replace the Shopify-only pricing note in
`lib/marketing/seo-routes.ts` llms copy. Do not rewrite homepage editorial
sections.
**Primary metric:** combined CTR on `/pricing` and `/partners` for query
`fixflags` after recrawl, from a 0% baseline
**Guardrail:** homepage `fixflags` clicks and GA4 Google sessions do not
collapse versus the 2026-09-08 baseline
**Observation window:** immediate production title check after deploy;
first GSC page×query compare on 2026-09-15 or after a confirmed recrawl
**Decision rule:** keep if official titles are live and sitelink CTR does
not fall while brand clicks hold; revise if Google ignores the new titles
or sitelink CTR stays at zero after recrawl; revert if brand clicks or
Google sessions drop without a matching crawl or SERP confounder
**Confidence and evidence:** medium for clearer brand recognition, low for
near-term ranking movement. Evidence is the 2026-09-08 page×query pull and
timestamped directory SERP leftovers.

### 2026-09-08 observation

- Applied/deployed: implemented locally in copy, llms notes, roast metadata,
  and page×query export; not deployed
- Crawled/reprocessed: no
- Comparable result: n/a
- Confounders: production homepage and pricing HTML are behind the
  repository; SEO-CRAWL-001 is in the same unpublished cut; Google snippets
  for `/pricing` still showed stale $69/$199 copy in a 2026-09-08 search
- Next action: deploy with crawl repairs, then compare page×query CTR on
  2026-09-15

---

## SEO-CRAWL-001 - Keep page-scoped Flag variants out of public discovery

**Registered:** 2026-09-08
**Status:** implemented, awaiting deployment and recrawl
**Target:** `/sitemap.xml`, `/issues`, and issue-page related links for people
and crawlers navigating the public Flag Library
**Evidence window:** GSC web data pulled 2026-09-08 for rolling 7-day and
28-day windows; live production inspection at 2026-09-08T17:21Z
**Baseline:** GSC's 28-day query export has 7 clicks, 53 impressions, 13.21%
CTR, and 1.83 impression-weighted average position, all from branded or
brand-adjacent queries. The live sitemap exposes 19 `::page:N` URLs that
return Not Found, and one sampled issue page renders the same related URL
three times.
**Data caveats:** GSC query and page dimensions aggregate independently and
the API may omit low-volume rows. The current GA4 export has 10 Google
sessions in 28 days, but it cannot attribute Site starts to those sessions.
This intervention has crawl-quality evidence, not ranking causality.

**Hypothesis:** If public discovery surfaces expose only canonical base check
IDs and deduplicate related links, then crawlers and visitors will stop
receiving known Not Found Flag URLs, without reducing access to valid
sample-gated issue pages.

**Exact implementation:** Filter page-scoped `::page:N` check variants from
the indexable issue query, deduplicate related issues by canonical check ID,
and add regression tests for both public projections.
**Primary metric:** zero `::page:N` URLs in the generated sitemap after
deployment
**Guardrail:** canonical sample-gated issue URLs and up to three distinct
related issue links continue to render
**Observation window:** verify immediately after deployment, then inspect GSC
page/indexing data after Google recrawls the sitemap; first review 2026-09-15
**Decision rule:** keep if invalid sitemap entries are zero and valid issue
coverage remains; revise if variants still leak through another public query;
revert if canonical eligible issues disappear.
**Confidence and evidence:** high for removing invalid discovery URLs, low for
near-term ranking impact. Evidence is the live sitemap and sampled 404 pages.

### 2026-09-08 observation

- Applied/deployed: implemented and regression-tested locally; not deployed
- Crawled/reprocessed: no
- Comparable result: the local database projection generated 73 distinct
  sitemap URLs with zero page variants or duplicates; the sampled issue
  returned three distinct related links
- Confounders: current production still uses legacy homepage/product wording;
  GSC volume is small and branded
- Next action: deploy through the release owner, verify zero `::page:N` URLs
  in production, then review GSC after recrawl

---

The entries below predate the first executed SEO loop and remain historical
planned experiments until separately re-baselined.

---

## [PLANNED] First issue page: does data-backed content earn organic traffic?

**Hypothesis:** A page that displays FixFlags-unique data (issue frequency,
top frameworks, anonymized examples, canonical fix prompt) will earn organic
impressions within 4 weeks of indexing, at a higher rate than a generic
"what is X issue" article — because it carries information gain no other
page has.

**Implementation:** Ship `/issues/[checkId]` for the first check crossing
MIN_SAMPLE_SIZE after the self-seed batch. Include structured data
(`Article` + `Dataset`), internal links to related issues, and an audit CTA.

**Success metric:** >500 impressions within 30 days of indexing (GSC data),
or >100 impressions within 30 days if GSC access is not yet available
(fallback: verify crawlable via `curl` and robots checks).

**Outcome:** (fill after implementation)

**Lessons learned:** (fill after outcome)

**Future recommendations:** (fill after lessons)

---

## [PLANNED] Free tool conversion: does meta-preview drive audit starts?

**Hypothesis:** A free OG preview checker tool will generate top-of-funnel
traffic and convert a meaningful percentage of users into audit starts —
because the tool demonstrates FixFlags' capability and the natural next step
is "run a full audit."

**Implementation:** Ship `/tools/meta-preview` with a prominent "Run a full
audit" CTA below the tool result. Track via `ToolUsage` with `sessionId`
correlation to `Audit.source`.

**Success metric:** >15% of tool sessions result in an audit start (measured
via `ToolUsage.sessionId` → `Audit` correlation). >100 tool uses within 30
days.

**Outcome:** (fill after implementation)

**Lessons learned:** (fill after outcome)

**Future recommendations:** (fill after lessons)

## SEO-RESEARCH-001 · Destination study in the existing guide

**Registered** November 9, 2026 after local implementation and before
production publication. **Status** local candidate awaiting publication review.

**Target** People troubleshooting a website that responds successfully but
still has a broken link or action. Use the existing canonical guide at
`/guides/website-online-but-not-working`.

**Hypothesis** A reproducible comparison that shows what a successful HTTP
response can miss gives people a reason to discover the guide and try a
check on their own Site. This single-page before-and-after observation can
surface useful evidence. Attribution of a change to the study would require
a stronger comparison design.

**Intervention** Publish only the reviewed eleven-case section in the
existing guide, with its observation date, limitations and citations.
Use the existing Analyze link. The later [paired comparison](destination-study.md#follow-up-comparison-of-two-fixflags-checks)
is supporting product evidence and is outside this release candidate.

**Baseline** October 9 through November 5. Finalized Search Console web
search returned one impression and zero clicks for the exact canonical guide.
GA4 returned no metric row for guide pageviews or the dedicated Analyze
event. The local fixed-window reports found no qualifying guide start or
claim. The dedicated event and start label were local at baseline, so their
absence is unavailable measurement. This is a historical observation. The
release-specific comparison uses the dates and coverage rules below.
[Google reporting receipt](metrics/guide-discovery-baseline-2026-11-09.json)

**Primary metric** Finalized Search Console clicks for the exact canonical
URL. Retain impressions alongside clicks. Report the new GA4 Analyze event
as a separate consented series. Report GA4 sessions that started on the
guide separately from total guide pageviews. This describes guide entry
across channels. The directional decision still uses the registered Search
Console and operational evidence.

**Guardrail** Use retained analysis completions and exact claims to
distinguish clicks from customer progress. Keep verified improvements,
native recoveries and later comparable checks separate. If source
coverage is partial, investigate the missing or failed transitions before
using this release to justify broader distribution.

**Observation window** After authorized publication, verify the exact guide
edition and its discovery path. Start with the next full calendar day and
record 28 days. Retain provider calendars and a matching set of UTC date
labels for the operational start window. Wait seven days after cutoff
for acquisition and 35 days for 28-day Site follow-up. Use the
[fixed-window commands](measurement-operations.md#configuration-and-reporting-readiness).

**Decision rule** Use the first complete post-release window to establish
the new telemetry baseline. For a directional decision about expanding this
approach, require finalized property coverage for every requested Search
Console date, at least one finalized search click and at least 20 mature
consented starts. At least one Site first claimed from an exact guide
start must also have an independently verified repair of a public link
inside its 28-day follow-up, with verification admitted at or after claim.
Other verified improvements and native
recoveries remain descriptive. This evidence threshold was tightened
before publication to match the study's subject. With fewer starts,
no verified public-link repair, or incomplete coverage, record the result
as inconclusive and name the missing evidence. Historical Site rows without
the public-link measure require a fresh operational snapshot for this decision.
If the discovery path passes but processing or verification cannot be
confirmed, investigate that transition before scaling. Keep paid conversion
unavailable until live billing provenance and owner-level payment-history
coverage can establish it.

### Assemble the readout

Save the exact-guide output of `inspect-reporting-access.ts` from the authorized
Google reporting environment. Save the operational snapshot from loopback
PostgreSQL with the same date labels and an exclusive UTC end date. Use
those two aggregate files with the local readout.

```sh
node --import tsx scripts/growth/inspect-customer-value.ts destination-study --start-window 2026-10-09 2026-11-06 > operational.json
node --import tsx scripts/growth/read-destination-study.ts reporting.json operational.json
```

After authorized publication, save the exact public edition check on the UTC
day you verify the guide. The 28-day cohort starts the following UTC day.
Run the same check again on the first UTC day after the 28-day window
closes. Save that receipt separately even if the customer follow-up
will take another 35 days to mature.

```sh
node --import tsx scripts/growth/verify-destination-study.ts --require-match > publication.json
node --import tsx scripts/growth/verify-destination-study.ts --require-match > window-end.json
node --import tsx scripts/growth/read-destination-study.ts reporting.json operational.json --released-on YYYY-MM-DD --publication-check publication.json --window-end-check window-end.json
```

For the before-and-after comparison, get both inclusive Search Console
windows from the UTC release date:

```sh
node --import tsx scripts/growth/read-destination-study.ts --search-windows --released-on YYYY-MM-DD
```

The baseline uses the last 28 Pacific dates that finish before the UTC
release day starts. The post-release window starts with the next UTC date
label. This leaves out both Pacific dates that could overlap the UTC release
day. Use the baseline dates in the existing reporting inspector with
`--guide website-online-but-not-working` and add
`--baseline-report baseline.json` to the release readout. When both windows
have complete finalized coverage and the opening and closing edition checks
pass, the readout reports absolute changes in clicks and impressions. The
comparison is descriptive and does not change the registered decision rule.

The verifier compares the canonical guide's table, interpretation, date and
citations with the candidate edition. The version 4 receipt checks for
indexing restrictions, confirms that robots rules allow the guide for the
tracked search crawlers and advertise the canonical sitemap, and checks that
the sitemap entry and Article metadata describe the same edition. It requires
the reviewed Article citation set and a single canonical guide link in
`llms.txt`. It also
follows the public Analyze link to confirm the URL form appears in the
returned HTML. Server-rendered controls may be disabled until hydration.

The readout requires matching edition and version 4 discovery evidence on
both dates. An earlier receipt or a missing or late closing receipt leaves
the directional result inconclusive. These are two HTTP observations of
technical eligibility. Search indexing, uninterrupted availability, and form
submission remain unobserved. Search, analytics, and private customer
outcomes remain separate. Keep aggregate report files in private operator
storage.

The operational command reads acquisition and Site outcomes in one read-only
repeatable-read transaction with one observation time. It emits only the
registered guide and its aggregate counts. Version 2 applies the post-claim
verification admission boundary. Version 1 counts remain visible for comparison,
and the release decision requires a fresh version 2 snapshot. The readout rejects a
Site count above the corresponding exact claim count. It reports completed
owner web checks after verified recovery alongside the mature recovery
cohort as descriptive evidence. The earlier
three-file command remains available for historical baselines. When used
with a release date it withholds the directional decision.

### November 9 local baseline recheck

The fixed October 9 through November 5 acquisition read found 19 anonymous
start receipts. Seven lacked a source audit. There were no qualifying guide
entries in acquisition, 28-day Site use, or native recovery. The full windows
mature November 13 and December 11 UTC, respectively. The original 11
observations and the ten paired comparison results reproduced. The guide
study still requires publication approval. The experiment has no post-release
observations yet.

The readout assembled the saved exact-guide Google report with fresh local
cohorts for those dates. It returned an inconclusive result. The sources
showed one reported impression, zero clicks, no guide-labelled cohorts and
partial acquisition coverage. The saved Google report predates the daily
property coverage check, so its window remains unconfirmed. A separate
synthetic test met the directional threshold with full date coverage, an
exact-claim Site, and a native verified recovery.

A public GET at 14:21 UTC confirmed the canonical guide was available and the
candidate study section was absent. The local rendered edition matched the
verifier. Changing a recorded verdict or citation, or omitting the React
stream placement instruction, withheld the publication receipt.

### November 9 isolated release candidate

The 26-file review patch was cut against local revision `3e7453bc`. It
contains the guide section and its original receipt, consented Analyze
instrumentation, metadata and sitemap gating, and the public edition and
readout checks. The audit admission change adds only the optional guide
label to its existing start receipt. The publication gate is still off.
The operational cohort tools remain in the shared checkout.

The patch applied cleanly to a fresh archive of that revision and reproduced
the tested files byte for byte. Patch SHA-256
`74b270e86b7dce9f2dba3cd0dc330d276e7fa2f3f19f2c8fc974aaad12603119`.
This is a local review cut. It still needs comparison with the deployed
revision and explicit publication approval.

### November 9 comparison with the serving revision

At 14:26 UTC, public health and the latest successful Railway web and worker
deployment metadata agreed on revision `3e7453bc20d3d79c3e72730c64ee90d0af9c4ed7`.
The base of the review cut matches production.

A separate publication-enabled patch was verified on a fresh archive of that
revision. All 119 focused tests, lint, and targeted type checking passed. The
production-mode tests render the study and revise the sitemap date for the
target guide only. The shared checkout retains its disabled publication gate.
The patch has SHA-256
`e69c67c59b621df8c81efffc1fc4520162e627654ec2ff45f9eb78c3f47957e7`.
Publication and deployment require approval. A push to `main` triggers both
production services under the repository's existing Railway setup.

### November 9 replay correction before publication

The prior publication patch is superseded. A replay on its exact serving
base matched ten of eleven original verdicts. The oversized response
returned Reachable on that base, while the worktree evaluator had returned
Unknown. The guide draft now uses the serving-base receipt and explicitly
describes the incomplete response. Both receipts are retained in the
[study methods and results](destination-study.md#replay-on-the-serving-revision).

The corrected 26-file publication candidate applied cleanly to a fresh
archive of the serving revision. Its files matched the isolated build
inputs byte for byte. Patch SHA-256
`16a1ac26eedd148b81e47360b48a9d59858be2901b753ebca93c6b1a8d18e19f`.
The isolated checks passed 120 tests, including a mocked collector test
through the serving revision's default path. Lint, targeted type checking,
the production web build and the worker build also passed.

The edition verifier matched the generated HTML for the target guide.
Edition SHA-256
`e8cd459c902533f56bae56adcdf2d74db49c0fe44d628235026294068c253782`.
The generated HTML for the comparison guide had no study section. The
corrected edition still requires publication and deployment approval.

### November 9 shared operational snapshot

The local PostgreSQL read at 14:42 UTC used one observation time for
acquisition and Site outcomes. The October 9 through November 5 baseline
still has no qualifying guide starts, Sites or recoveries. The saved Google
report for the exact guide has one finalized impression and zero clicks.
The baseline remains inconclusive with immature follow-up and partial
operational coverage.

In a disposable database, the native run reconciler and the new operator
command joined one exact guide start and claim to one Site and one verified
recovery. With synthetic discovery and edition inputs, the decision remained
inconclusive because the cohort had only one start. The aggregate snapshot
omitted the source identifiers. The publication patch remains a separate
review artifact.

### November 9 guide payment evidence

The private [commercial report](measurement-operations.md#commercial-evidence)
accepts the guide's fixed start window and can follow an exact consented
claim to a verified account invoice. The readout keeps this milestone
separate from its directional decision and from first-ever conversion.

The 14:47 UTC loopback baseline held zero ledger rows for the window and
the guide follow-up was immature. The report left invoice results unknown
and made no Stripe requests. An isolated PostgreSQL replay with supplied
provider responses matched two paid invoices for one owner. A label on a
different audit, an earlier claim on the same Site and an immature window
each withheld the guide match.

### November 9 opening and closing discovery receipts

The operator readout now checks the exact edition and public Analyze path
at release and on the first UTC day after the cohort window. The new
verifier matched the archived candidate's built HTML, including the
streamed Analyze link and the form present in the static `/new` HTML.
Its initial enabled-control requirement was removed after verifying the
form's hydration behavior in source and built HTML. The check establishes
the returned markup only.

Local tests withheld a directional result when the closing receipt was
missing, late, or for a changed edition, or when the Analyze path or
index directive failed. A disposable PostgreSQL fixture also exercised the
readout with a native verified recovery and synthetic opening and closing
receipts. No production release or closing observation has occurred for
this edition.

### November 9 consent check through the real receipt writers

The check endpoint now requires an affirmative analytics cookie before
accepting a journey key. It strips the guide and journey query markers
from stored referrers. In the migrated PostgreSQL fixture, a denied request
created an analysis and start receipt without those identifiers. A
consented request retained its label, and reuse with a different label
kept the original receipt. The normal analysis projection and anonymous
claim writers supplied the completion and claim receipts used by the
same-Site native recovery readout. The fixture substituted request
context and queue transport and used controlled settled audit evidence.

The consent correction supersedes the earlier publication-enabled patch.
The revised 26-file patch applied cleanly to a fresh archive of
`3e7453bc20d3d79c3e72730c64ee90d0af9c4ed7` and matched the isolated
build inputs byte for byte. Patch SHA-256
`6f30206f5f1edf21a0c3992d47d08e2c3ff22c83d5aacab2a95f4e5fef50bde6`.
The isolated candidate passed 125 focused tests, lint, targeted type
checking, and both production builds. The newly generated target guide
matched the edition and Analyze discovery verifier. The comparison guide
had no study section. Publication and deployment require authorization.

### November 9 discovery receipt for the archived candidate

At 16:37 UTC the public guide still omitted the study. Its Analyze path
was present and robots rules allowed the guide. The sitemap date and Article
metadata did not match the candidate edition. At 16:39 UTC the version 3
verifier passed all of those checks against the archived production build
served over loopback, including the exact study digest and sitemap date.
The replay used isolated startup configuration and local-only service URLs.
The result verifies the archived candidate's HTTP output. Publication
approval is still pending.

### Controlled guide-to-repair replay

A disposable PostgreSQL fixture starts a consented guide analysis and claims
the Site through the normal application writers. The controlled booking URL
returns HTTP 200 with a missing-page heading, then HTTP 200 with the restored
booking heading. FixFlags records the clipboard acknowledgement, admits a
verification of the original destination, writes the HTTP check receipt, and
settles the attempt. The private study snapshot moves from one acknowledgement
and zero verified public-link repairs to one independently verified public-link
repair on that same Site. The snapshot omits private identifiers and task
details.

The same fixture records four scheduled check receipts after the repair. An
unrelated broken link and an access-gated response leave the two follow-up
counts at zero. A comparable pass adds one Site with a scheduled recheck.
When the missing-page response returns at the original URL, the report also
counts one Site with a repeat failure. That Site keeps its original verified
repair in the report.

The replay substitutes HTTP responses and queue dispatch, and advances the
report's as-of time for cohort maturity. It tests receipt custody and
reporting on a synthetic Site. The fixture does not measure a real booking,
guide visitor, or customer outcome.

The prepublication readout now uses the verified public-link repair count
for the decision. The native availability fixture still shows a recovery
and a later owner check, with the public-link requirement unsatisfied.
The 17:20 UTC baseline recheck found no qualifying guide starts or Sites.
The saved exact-guide search receipt reports one impression and zero clicks,
with no record confirming full-window coverage. The baseline is inconclusive.

```sh
node scripts/verify-progressive-execution.mjs --only lib/analytics/__tests__/outcome-recovery-native.integration.test.ts
```

### November 9 combined guide and discovery review candidate

The 29-file review patch combines the consented guide instrumentation and
reviewed study edition with the dynamic no-store sitemap. It includes the
current edition verifier and version 2 readout. Patch SHA-256
`dc477eb068f69a79abffa22a58e5dd1070c71591a21f3a777e10b9149f3dd03c`.
The patch reproduced the reviewed source on a clean archive of the revision
reported by public health, `3e7453bc20d3d79c3e72730c64ee90d0af9c4ed7`.

The isolated candidate passed 148 focused tests, targeted lint, the power-tools
visibility guard, and the production web and worker builds. Loopback HTTP
matched the study, Article metadata, crawler rules and Analyze form. All
eight withdrawal checks passed against an empty local PostgreSQL database.
The sitemap served all 67 live entries in the same order with no-store. Its
only entry change was the target guide's modification date. The archived
readout accepted the retained version 2 operational baseline and kept the
decision inconclusive. Publication and deployment require authorization.

### November 9 live reporting scope verification

At 17:48 UTC the current inspector ran with read-only scopes inside the
existing FixFlags Railway worker. GA4 accepted the exact production stream,
hostname, and guide-path filters for pageviews and Analyze clicks. Both
requests succeeded with no metric row. Search Console returned one impression
and zero clicks for the canonical guide and confirmed all 28 finalized dates
on the unfiltered property for October 9 through November 5.

The version 2 readout combined the provider receipt with a fresh local
read-only snapshot. It found no qualifying guide starts or Sites and kept
the decision inconclusive. The provider read validates reporting access and
scope before publication. The operator command used the worker's existing
credential in place and returned aggregate output.

At 18:11 UTC, GA4 also accepted the separate landing-session query for the
same guide, host, stream, and dates. It returned no usable aggregate count.
The readout leaves landing sessions unavailable for that baseline.

At 18:21 UTC, GA4 accepted the opt-in referral-session query both sitewide
and for sessions landing on the study guide. Both used the production host,
web stream, and October 9 through November 5 window. Neither returned a
usable count for the four fixed AI platform source labels. The baseline
leaves those counts unavailable.

### November 9 discovery recheck

At 18:24 UTC the public guide still omitted the study. The version 4 verifier
confirmed the canonical `llms.txt` link, allowed crawler rules, and Analyze
link and form. The sitemap date and Article metadata belonged to the earlier
guide edition.

At 18:26 UTC the same verifier replayed the archived 29-file candidate over
loopback. All five HTTP resources returned 200, and the exact study digest,
reviewed Article citations, sitemap date, and canonical `llms.txt` entry
matched. The replay used isolated startup settings. It establishes the
archived candidate's HTTP output. Publication approval is still pending.
